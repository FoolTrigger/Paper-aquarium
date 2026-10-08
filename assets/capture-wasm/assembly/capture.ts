// assets/capture-wasm/assembly/capture.ts
// ------------------------------------------------------------
// WASM-ускорение трёх самых дорогих пиксельных циклов assets/capture.js —
// именно тех, что реально греют телефон при обработке снимка листа
// раскраски. Каждая функция — byte-for-byte порт соответствующего JS-цикла
// (см. комментарий-ссылку на исходную функцию перед каждой), без изменения
// алгоритма: если поведение когда-нибудь разойдётся с JS-версией — это баг
// порта, а не «улучшение по пути».
//
// Сознательно НЕ портированы (см. MIGRATION_PLAN.md):
//  - findMarkers()  — поиск меток на уменьшенном (WORK_MAX-bounded) кадре,
//    сильно ветвистый код с ранними выходами; на таком малом разрешении
//    выигрыш от WASM не окупает риск рассинхронизации с JS-версией.
//  - feather-проход — всего 3 итерации, дешёво уже в JS.
//
// Сборка: см. assets/capture-wasm/build.sh (asc, ESM-таргет).
// Память: линейная память экспортируется наружу (см. package.json "exports"
// секцию сборки) — JS-обёртка (assets/capture-wasm/index.js) сама management
// буферов через __new/__pin/__unpin из рантайма AssemblyScript, WASM-код
// ничего не аллоцирует сам — все буферы передаются готовыми указателями.

// ── 1. Перспективная развёртка листа: assets/capture.js, processPhoto(),
//    цикл вокруг applyH() (строки ~313-326). Nearest-neighbor сэмплинг —
//    как в оригинале, без билинейной интерполяции: лист печатный, четкие
//    края важнее сглаживания.
export function warpPerspective(
  srcPtr: usize, W: i32, H: i32,
  dstPtr: usize, SW: i32, SH: i32,
  h0: f64, h1: f64, h2: f64, h3: f64, h4: f64, h5: f64, h6: f64, h7: f64, h8: f64
): void {
  for (let y: i32 = 0; y < SH; y++) {
    for (let x: i32 = 0; x < SW; x++) {
      const fx = <f64>x, fy = <f64>y;
      const d = h6 * fx + h7 * fy + h8;
      const px = (h0 * fx + h1 * fy + h2) / d;
      const py = (h3 * fx + h4 * fy + h5) / d;
      const xi = <i32>Math.round(px);
      const yi = <i32>Math.round(py);
      const o = (y * SW + x) * 4;

      if (xi >= 0 && yi >= 0 && xi < W && yi < H) {
        const si = (yi * W + xi) * 4;
        store<u8>(dstPtr + o, load<u8>(srcPtr + si));
        store<u8>(dstPtr + o + 1, load<u8>(srcPtr + si + 1));
        store<u8>(dstPtr + o + 2, load<u8>(srcPtr + si + 2));
      } else {
        store<u8>(dstPtr + o, 255);
        store<u8>(dstPtr + o + 1, 255);
        store<u8>(dstPtr + o + 2, 255);
      }
      store<u8>(dstPtr + o + 3, 255);
    }
  }
}

// ── 2. Применение гейна flat-field: assets/capture.js, цикл после gainAt()
//    (строки ~398-408). Сама сетка 7×5 (сбор средней яркости бумаги по
//    клеткам) остаётся в JS — она однопроходная и дешёвая, только полный
//    прогон по SW×SH пикселям с билинейной интерполяцией гейна перенесён
//    сюда. gainPtr — 35 клеток × 3 канала f64, row-major (gy*7+gx)*3+ch.
export function applyFlatField(
  dataPtr: usize, SW: i32, SH: i32,
  gainPtr: usize, gridX: i32, gridY: i32,
  pxPerMM: f64, cellWmm: f64, cellHmm: f64
): void {
  for (let y: i32 = 0; y < SH; y++) {
    const ymm = <f64>y / pxPerMM;
    let fy = ymm / cellHmm - 0.5;
    if (fy < 0) fy = 0;
    const fyMax = <f64>(gridY - 1) - 0.001;
    if (fy > fyMax) fy = fyMax;
    const gy0 = <i32>Math.floor(fy);
    const gy1 = min<i32>(gridY - 1, gy0 + 1);
    const ty = fy - <f64>gy0;

    for (let x: i32 = 0; x < SW; x++) {
      const xmm = <f64>x / pxPerMM;
      let fx = xmm / cellWmm - 0.5;
      if (fx < 0) fx = 0;
      const fxMax = <f64>(gridX - 1) - 0.001;
      if (fx > fxMax) fx = fxMax;
      const gx0 = <i32>Math.floor(fx);
      const gx1 = min<i32>(gridX - 1, gx0 + 1);
      const tx = fx - <f64>gx0;

      const p = (y * SW + x) * 4;
      for (let ch: i32 = 0; ch < 3; ch++) {
        const g00 = load<f64>(gainPtr + ((gy0 * gridX + gx0) * 3 + ch) * 8);
        const g10 = load<f64>(gainPtr + ((gy0 * gridX + gx1) * 3 + ch) * 8);
        const g01 = load<f64>(gainPtr + ((gy1 * gridX + gx0) * 3 + ch) * 8);
        const g11 = load<f64>(gainPtr + ((gy1 * gridX + gx1) * 3 + ch) * 8);
        const top = g00 + (g10 - g00) * tx;
        const bot = g01 + (g11 - g01) * tx;
        const gain = top + (bot - top) * ty;

        const idx = dataPtr + p + ch;
        let v = <f64>load<u8>(idx) * gain;
        if (v > 255) v = 255;
        store<u8>(idx, <u8>v);
      }
    }
  }
}

// ── 3. Дилатация цвета за срезанный контур: assets/capture.js, цикл
//    passes/changed вокруг d[]/filled[] (строки ~465-487). Вся серия
//    проходов — внутри одного вызова, чтобы не платить за переход JS↔WASM
//    на каждый из ~10-15 проходов. Двойная буферизация filled — как в
//    оригинале (next = copy, swap на следующей итерации), ранний выход при
//    !changed тоже сохранён.
export function dilateFill(
  dataPtr: usize, filledPtr: usize, nextPtr: usize,
  texW: i32, texH: i32, maxPasses: i32
): void {
  const N = texW * texH;
  for (let p: i32 = 0; p < maxPasses; p++) {
    memory.copy(nextPtr, filledPtr, N);
    let changed = false;

    for (let y: i32 = 0; y < texH; y++) {
      for (let x: i32 = 0; x < texW; x++) {
        const i = y * texW + x;
        if (load<u8>(filledPtr + i) != 0) continue;

        let sr: i32 = 0, sg: i32 = 0, sb: i32 = 0, c: i32 = 0;
        if (x > 0 && load<u8>(filledPtr + i - 1) != 0) {
          const q = (i - 1) * 4;
          sr += load<u8>(dataPtr + q); sg += load<u8>(dataPtr + q + 1); sb += load<u8>(dataPtr + q + 2);
          c++;
        }
        if (x < texW - 1 && load<u8>(filledPtr + i + 1) != 0) {
          const q = (i + 1) * 4;
          sr += load<u8>(dataPtr + q); sg += load<u8>(dataPtr + q + 1); sb += load<u8>(dataPtr + q + 2);
          c++;
        }
        if (y > 0 && load<u8>(filledPtr + i - texW) != 0) {
          const q = (i - texW) * 4;
          sr += load<u8>(dataPtr + q); sg += load<u8>(dataPtr + q + 1); sb += load<u8>(dataPtr + q + 2);
          c++;
        }
        if (y < texH - 1 && load<u8>(filledPtr + i + texW) != 0) {
          const q = (i + texW) * 4;
          sr += load<u8>(dataPtr + q); sg += load<u8>(dataPtr + q + 1); sb += load<u8>(dataPtr + q + 2);
          c++;
        }

        if (c > 0) {
          const o = i * 4;
          store<u8>(dataPtr + o, <u8>(sr / c));
          store<u8>(dataPtr + o + 1, <u8>(sg / c));
          store<u8>(dataPtr + o + 2, <u8>(sb / c));
          store<u8>(nextPtr + i, 1);
          changed = true;
        }
      }
    }

    memory.copy(filledPtr, nextPtr, N);
    if (!changed) break;
  }
}
