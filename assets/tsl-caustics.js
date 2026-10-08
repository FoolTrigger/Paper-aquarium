// assets/tsl-caustics.js
// ------------------------------------------------------------
// TSL-эквивалент CAUSTIC_GLSL, который раньше был скопирован вручную в
// трёх местах (demos/realistic-tank.html addCaustics, assets/ocean-fx.js
// buildFloor, assets/ocean-fx.js SHADERS['depth-gradient']) — комментарий
// в исходнике честно объяснял, что копия дешевле связывания в чистом GLSL.
// В TSL связывание — это просто импорт функции, так что копии больше не
// нужны, а математика узора сохранена один-в-один с оригиналом (тот же
// 3-итерационный domain-warp через синусы), чтобы визуально ничего не
// изменилось.
//
// Используется как: import { causticPattern } from './tsl-caustics.js'
// Модуль публикует и window.TSLCaustics — на случай, если понадобится
// использовать функцию из не-модульного контекста через глобал.

import { Fn, float, vec2, int, Loop, sin, cos, abs, pow, clamp } from 'three/tsl';

export const causticPattern = Fn(([p, t]) => {
  const q = p.mul(0.55).toVar();
  const c = float(0.0).toVar();

  Loop({ start: int(0), end: int(3) }, ({ i }) => {
    const fi = float(i).add(1.0);
    q.addAssign(
      vec2(
        sin(q.y.mul(1.35).add(t.mul(1.05).mul(fi))),
        cos(q.x.mul(1.6).add(t.mul(0.9).mul(fi)))
      ).mul(0.42)
    );
    c.addAssign(float(0.32).div(abs(sin(q.x).mul(sin(q.y))).mul(3.3).add(0.32)));
  });

  return pow(clamp(c.mul(0.16), 0.0, 1.0), 2.5);
});

if (typeof window !== 'undefined') {
  window.TSLCaustics = { causticPattern };
}
