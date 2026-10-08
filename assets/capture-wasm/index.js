// assets/capture-wasm/index.js
// ------------------------------------------------------------
// Тонкая обвязка над скомпилированным assets/capture-wasm/capture.wasm.
// capture.js вызывает эти функции вместо своих же горячих циклов, когда
// WASM доступен; если модуль не загрузился (сеть, очень старый браузер,
// CSP без 'wasm-unsafe-eval' и т.п.) — WasmCapture.available остаётся
// false, и capture.js выполняет ровно тот же алгоритм на чистом JS,
// как и раньше. Деградация полная и бесшумная — на экране не появляется
// никакой разницы, кроме скорости на слабых телефонах.
//
// Экспортирует один объект WasmCapture:
//   WasmCapture.ready                       — Promise, резолвится, когда
//                                              известно available true/false
//   WasmCapture.available                   — boolean, после ready
//   WasmCapture.warpPerspective(src, W, H, SW, SH, h)  → Uint8ClampedArray(SW*SH*4)
//   WasmCapture.applyFlatField(data, SW, SH, gainFlat35x3, gridX, gridY, pxPerMM, cellWmm, cellHmm)
//                                            → мутирует data на месте, как и JS-версия
//   WasmCapture.dilateFill(data, filled, texW, texH, maxPasses)
//                                            → мутирует data на месте, как и JS-версия

export const WasmCapture = { available: false, ready: null };

var instance = null;

function alloc(nBytes) {
  // id=0 — «сырой» блок памяти без RTTI-класса; так и рассчитан
  // capture.wasm (runtime: stub, никакого GC-трейсинга полей не нужно —
  // JS-сторона сама решает, когда буфер больше не нужен).
  return instance.exports.__new(nBytes, 0);
}

WasmCapture.ready = (async function () {
  try {
    var url = new URL('./capture.wasm', import.meta.url);
    var resp = await fetch(url);
    if (!resp.ok) throw new Error('capture.wasm: HTTP ' + resp.status);
    var { instance: inst } = await WebAssembly.instantiateStreaming(resp, {
      env: {
        abort: function (msg, file, line, col) {
          throw new Error('capture.wasm abort @' + line + ':' + col);
        }
      }
    });
    instance = inst;
    WasmCapture.available = true;
  } catch (e) {
    console.warn('[capture-wasm] недоступен, используем чистый JS:', e.message);
    WasmCapture.available = false;
  }
  return WasmCapture.available;
})();

WasmCapture.warpPerspective = function (srcRGBA, W, H, SW, SH, h) {
  var srcPtr = alloc(W * H * 4);
  var dstPtr = alloc(SW * SH * 4);
  new Uint8Array(instance.exports.memory.buffer, srcPtr, W * H * 4).set(srcRGBA);

  instance.exports.warpPerspective(
    srcPtr, W, H, dstPtr, SW, SH,
    h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], h[8]
  );

  // Копия наружу: буфер внутри WASM-памяти жив только до следующего alloc()
  // (память может переиспользоваться/расти), возвращаем вызывающему коду
  // собственный, стабильный Uint8ClampedArray.
  var out = new Uint8ClampedArray(SW * SH * 4);
  out.set(new Uint8Array(instance.exports.memory.buffer, dstPtr, SW * SH * 4));
  return out;
};

WasmCapture.applyFlatField = function (data, SW, SH, gainFlat, gridX, gridY, pxPerMM, cellWmm, cellHmm) {
  var dataPtr = alloc(SW * SH * 4);
  var gainPtr = alloc(gainFlat.length * 8);
  new Uint8Array(instance.exports.memory.buffer, dataPtr, SW * SH * 4).set(data);
  new Float64Array(instance.exports.memory.buffer, gainPtr, gainFlat.length).set(gainFlat);

  instance.exports.applyFlatField(dataPtr, SW, SH, gainPtr, gridX, gridY, pxPerMM, cellWmm, cellHmm);

  data.set(new Uint8Array(instance.exports.memory.buffer, dataPtr, SW * SH * 4));
};

WasmCapture.dilateFill = function (data, filled, texW, texH, maxPasses) {
  var N = texW * texH;
  var dataPtr = alloc(N * 4);
  var filledPtr = alloc(N);
  var nextPtr = alloc(N);
  new Uint8Array(instance.exports.memory.buffer, dataPtr, N * 4).set(data);
  new Uint8Array(instance.exports.memory.buffer, filledPtr, N).set(filled);

  instance.exports.dilateFill(dataPtr, filledPtr, nextPtr, texW, texH, maxPasses);

  data.set(new Uint8Array(instance.exports.memory.buffer, dataPtr, N * 4));
  filled.set(new Uint8Array(instance.exports.memory.buffer, filledPtr, N));
};
