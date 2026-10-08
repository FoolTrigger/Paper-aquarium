// assets/three-bootstrap.js
// ------------------------------------------------------------
// Единственная точка входа three.js в проекте. Раньше vendor/three.min.js
// (r128, UMD-сборка только под WebGL) сам вешал себя на window.THREE, и
// все остальные <script> просто читали глобал. WebGPU-сборка three.js
// поставляется только как ES-модуль (three/webgpu + three/tsl, см.
// import map в <head> каждой страницы), поэтому подключаем её здесь и
// публикуем в window.THREE/window.TSL — этого достаточно, чтобы все
// классические скрипты (fish-frame.js, creature-behaviors.js, ocean-fx.js,
// touch-interaction.js и т.д.) продолжали работать без единой правки в
// своей внутренней логике: они видят тот же по форме объект THREE, что
// и раньше, только теперь способный создавать WebGPURenderer.
//
// ВАЖНО: этот файл обязан быть первым <script type="module"> на странице
// и должен идти раньше всех остальных script-тегов (включая non-module),
// иначе window.THREE ещё не будет существовать, когда они выполнятся.
// Module-скрипты в браузере исполняются в порядке следования в документе
// (как defer), поэтому просто ставьте этот тег первым в списке — этого
// достаточно, отдельно ждать ничего не нужно.

import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';

window.THREE = Object.assign({}, THREE);
window.TSL = Object.assign({}, TSL);

// WebGPU в Three.js на мобильных устройствах (Android/iOS) нестабилен и вызывает сбои
// драйверов (Adreno/Mali). Поэтому на мобильных устройствах всегда используем WebGL2-бэкенд.
var isMobileDevice = (function () {
  if (typeof navigator === 'undefined') return false;
  var ua = navigator.userAgent || '';
  if (/Windows NT|Macintosh/i.test(ua)) return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ||
         (typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1);
})();
window.__aquaIsMobile = isMobileDevice;
window.__aquaSupportsWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu && !isMobileDevice;
