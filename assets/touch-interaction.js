// Сенсорное взаимодействие с аквариумом.
//
// Палец превращается в точку в воде (луч от камеры пересекает невидимую
// плоскость чуть за стеклом — так рыба «подплывает к пальцу», как к
// собственному носу через стекло в настоящем аквариуме, а не куда-то в
// глубину кадра). Дальше — простой словарь жестов:
//
//   короткий тап рядом с рыбкой   → вздрагивает и уплывает (startle)
//   удержание пальца              → рыбки в радиусе интереса подплывают,
//                                    ближние и смелые — охотнее дальних
//                                    и пугливых (радиус + случайная
//                                    «смелость» не дают подплыть всем сразу)
//   резкое движение пальца        → те, кто подплыл, шарахаются прочь
//   удержание прямо на рыбке      → через полторы секунды она радуется
//                                    (сердечки, довольное покачивание)
//   двойной тап где угодно        → лёгкий испуг у всех сразу («стук по
//                                    стеклу»)
//   встряхнуть телефон            → то же самое, но без точки — испуг
//                                    отовсюду
//   два пальца, тап               → щепотка корма в эту точку
//   два пальца, провести          → дорожка корма вдоль движения
//
// Вся физика реакции (импульс скорости, дрожь тела, пульс медузы, разворот
// краба) уже живёт в assets/creature-behaviors.js — этот модуль только
// распознаёт жест и дёргает готовые creature.startle()/petHappy() либо
// CreatureBehaviors.setInterest()/clearInterest().
(function () {
  'use strict';

  var ctx = null;
  // ctx = {
  //   THREE, scene, camera, renderer,
  //   zNear,                    // Z_NEAR сцены — отсюда считается PLANE_Z
  //   getList(),                // -> живой массив тварей (тот же fishes)
  //   dropFoodAt(x, y, z, opts), // -> кладёт корм в конкретную точку
  //   now()                     // -> текущее время сцены
  // }

  // ── тайминги и пороги жестов ──────────────────────────────────────────
  var TAP_MS = 200;          // короче — тап, длиннее — уже не тап
  var TAP_MOVE_PX = 12;      // сколько пальцу можно съехать и остаться тапом
  var HOLD_MS = 220;         // после этого срока необлегчённый тап становится удержанием
  var DOUBLE_TAP_MS = 360;   // окно между двумя тапами для «стука по стеклу»
  var DOUBLE_TAP_PX = 46;    // насколько близко должен лечь второй тап
  var SCATTER_SPEED = 7;     // мировых единиц/сек — быстрее этого палец «спугивает», а не «манит»
  var TAP_STARTLE_RADIUS_MUL = 2.0;   // во сколько раз радиуса рыбки достаточно для тап-испуга
  var PET_SEARCH_MUL = 1.0;           // радиус «палец прямо на рыбке» — почти впритык
  var PET_HOLD_S = 1.5;               // сколько держать, чтобы рыбка обрадовалась
  var INTEREST_RADIUS = 6.5;          // база — каждая рыбка домножает на свою смелость
  var GLASS_KNOCK_FALLOFF = 0.16;     // выше — испуг гаснет быстрее с расстоянием
  var SHAKE_JERK = 22;                // м/с² — порог резкого скачка ускорения
  var SHAKE_COOLDOWN_S = 1.6;
  var FOOD_TRAIL_GAP_S = 0.14;        // как часто сыплется дорожка корма при протяжке
  var BUBBLE_GAP_S = 0.05;            // как часто рождаются пузырьки при движении пальца

  var PLANE_Z = 0;   // считается в init() как «чуть за стеклом»

  function init(context) {
    ctx = context;
    PLANE_Z = ctx.zNear - 1.2;
    ctx.renderer.domElement.style.touchAction = 'none';   // не отдаём жесты браузеру (скролл/зум)
    bindPointer();
    bindDeviceMotion();
    ensureBubblePool();
  }

  // ── экран → луч / точка в воде ─────────────────────────────────────────
  // Для «подплыть к пальцу» нужна конкретная точка в толще воды на разумной
  // глубине — берём пересечение луча с плоскостью чуть за стеклом.
  //
  // А вот для «попал ли тап по рыбке» глубина не важна вовсе: важно, на
  // сколько рыбка (на своей собственной глубине, где бы она ни плавала)
  // визуально легла под палец — это расстояние от рыбки до всего луча
  // взгляда, а не до одной точки, зафиксированной по глубине. Иначе рыбы
  // дальше плоскости взаимодействия — а это бОльшая часть объёма аквариума —
  // вообще никогда не реагировали бы на тап. Тот же приём уже работает для
  // бейджа с именем в creature-behaviors.js (attachNaming → pick()).
  var _raycaster = null, _ndc = null, _plane = null, _hit = null;

  function updateRay(clientX, clientY) {
    if (!_raycaster) {
      _raycaster = new ctx.THREE.Raycaster();
      _ndc = new ctx.THREE.Vector2();
      _plane = new ctx.THREE.Plane(new ctx.THREE.Vector3(0, 0, 1), -PLANE_Z);
      _hit = new ctx.THREE.Vector3();
    }
    var rect = ctx.renderer.domElement.getBoundingClientRect();
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_ndc, ctx.camera);
  }

  function screenToWorld(clientX, clientY) {
    updateRay(clientX, clientY);
    _raycaster.ray.intersectPlane(_plane, _hit);
    return _hit;
  }

  // Ближайшая тварь К ЛУЧУ (не к плоской точке) — использует луч, уже
  // выставленный последним updateRay()/screenToWorld(). radiusMul умножает
  // радиус каждой твари отдельно; fixedRadius, если задан, перекрывает это
  // единым порогом (нужно для поглаживания — там порог не зависит от вида).
  function nearestOnRay(radiusMul, fixedRadius) {
    var list = ctx.getList();
    var best = null, bestD = Infinity;
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c.pos || !c.startle) continue;
      var d = _raycaster.ray.distanceToPoint(c.pos);
      var thresh = fixedRadius != null ? fixedRadius : c.radius * radiusMul;
      if (d < thresh && d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function startleAll(origin, strengthBase) {
    var list = ctx.getList();
    var t = ctx.now();
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c.startle || !c.pos) continue;
      var s = strengthBase;
      if (origin) s = strengthBase / (1 + c.pos.distanceTo(origin) * GLASS_KNOCK_FALLOFF);
      c.startle(origin, Math.max(0.15, s), t);
    }
  }

  // ── состояние жеста ────────────────────────────────────────────────────
  var pointers = {};          // id -> {x, y}
  var mode = 'idle';          // 'idle' | 'single' | 'two'
  var single = null;          // {id, x0, y0, t0, holding, lastWorld, petTarget, petSince, petted}
  var twoFinger = null;       // {ids, x0, y0, t0, dragged, lastDrop}
  var lastTap = null;         // {x, y, t} — для двойного тапа
  var swallowClick = false;

  function midpoint() {
    var ids = Object.keys(pointers);
    var a = pointers[ids[0]], b = pointers[ids[1]];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function handleTap(x, y, t) {
    updateRay(x, y);

    if (lastTap && (t - lastTap.t) < DOUBLE_TAP_MS / 1000 &&
        Math.hypot(x - lastTap.x, y - lastTap.y) < DOUBLE_TAP_PX) {
      // «Стук по стеклу» — пугает всех, с падением силы по расстоянию от
      // места стука. Одиночный тап рядом с рыбкой при этом не срабатывает
      // отдельно ещё раз — это один жест, не два подряд.
      _raycaster.ray.intersectPlane(_plane, _hit);
      startleAll(_hit.clone(), 1.1);
      lastTap = null;
      swallowClick = true;
      return;
    }
    lastTap = { x: x, y: y, t: t };

    // Луч уже выставлен той же точкой (x, y) — попадание считаем по нему,
    // а «откуда бежать» рыбке достаточно знать примерно, куда смотрел
    // палец на глубине стекла, поэтому для направления берём точку на
    // плоскости взаимодействия, а не истинную глубину самой рыбки.
    var hit = nearestOnRay(TAP_STARTLE_RADIUS_MUL);
    if (hit) {
      _raycaster.ray.intersectPlane(_plane, _hit);
      hit.startle(_hit.clone(), 1, t);
      // Одиночный короткий тап не глушит клик: иначе в плотном аквариуме
      // на мобильном невозможно вызвать меню тапом по воде.
    }
    // Мимо рыбки — ничего не делаем: клику дальше можно спокойно открыть
    // меню, как и раньше.
  }

  function onPointerDown(e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var t = ctx.now();

    if (Object.keys(pointers).length >= 2) {
      // Второй палец — отменяем всё, что успел начать первый (тап/удержание
      // одним пальцем не должны сработать вдобавок к жесту с кормом).
      CreatureBehaviors.clearInterest();
      single = null;
      var m = midpoint();
      twoFinger = { x0: m.x, y0: m.y, t0: t, dragged: false, lastDrop: 0 };
      mode = 'two';
      return;
    }

    if (mode === 'idle') {
      single = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: t, holding: false,
                 lastWorld: null, petTarget: null, petSince: 0, petted: false };
      mode = 'single';
    }
  }

  function onPointerMove(e) {
    if (!pointers[e.pointerId]) return;
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };

    if (mode === 'two' && twoFinger) {
      var m = midpoint();
      if (Math.hypot(m.x - twoFinger.x0, m.y - twoFinger.y0) > TAP_MOVE_PX) twoFinger.dragged = true;
      return;   // остальное — в update(), там же считается мировая скорость
    }

    if (mode === 'single' && single && e.pointerId === single.id) {
      var t = ctx.now();
      if (!single.holding && t - single.t0 >= HOLD_MS / 1000) single.holding = true;
    }
  }

  function onPointerUp(e) {
    var t = ctx.now();

    if (mode === 'two') {
      // Позицию пальца, который сейчас поднимается, берём из события —
      // из карты pointers мы вот-вот его уберём. Позицию оставшегося
      // пальца (если он ещё держится) — из карты, пока она ещё жива.
      var otherIds = Object.keys(pointers).filter(function (id) { return Number(id) !== e.pointerId; });
      var mx = e.clientX, my = e.clientY;
      if (otherIds.length) {
        mx = (mx + pointers[otherIds[0]].x) / 2;
        my = (my + pointers[otherIds[0]].y) / 2;
      }
      delete pointers[e.pointerId];
      var left = Object.keys(pointers).length;

      if (left < 2) {
        if (twoFinger && !twoFinger.dragged && (t - twoFinger.t0) < (TAP_MS * 1.5) / 1000) {
          var wp = screenToWorld(mx, my);
          ctx.dropFoodAt(wp.x, wp.y, wp.z, { count: 5, spread: 0.3 });
        }
        swallowClick = true;
        twoFinger = null;
        // Если один палец ещё лежит на стекле — не пытаемся на лету
        // превратить его в новый одиночный жест: ждём его собственного
        // pointerup, а до тех пор просто ничего не делаем.
        mode = 'idle';
      }
      return;
    }

    delete pointers[e.pointerId];

    if (mode === 'single' && single && e.pointerId === single.id) {
      var dur = t - single.t0;
      var moved = Math.hypot(e.clientX - single.x0, e.clientY - single.y0);
      if (!single.holding) {
        if (dur < TAP_MS / 1000 && moved < TAP_MOVE_PX) handleTap(e.clientX, e.clientY, t);
      } else {
        swallowClick = true;   // любое завершённое удержание — не тап по меню
      }
      CreatureBehaviors.clearInterest();
      single = null;
      mode = 'idle';
    }
  }

  function onPointerCancel(e) {
    delete pointers[e.pointerId];
    if (single && e.pointerId === single.id) { CreatureBehaviors.clearInterest(); single = null; }
    if (Object.keys(pointers).length < 2) twoFinger = null;
    if (Object.keys(pointers).length === 0) mode = 'idle';
  }

  function bindPointer() {
    var el = ctx.renderer.domElement;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('pointerleave', onPointerCancel);

    // Существующее меню открывается по клику на весь документ (см.
    // demos/realistic-tank.html). Слушатель на самом канвасе срабатывает
    // раньше, чем событие всплывёт до document, — глушим клик там, где
    // жест уже что-то сделал с рыбкой/кормом, и пропускаем его дальше,
    // если палец просто ткнул в пустую воду (тогда меню открывается, как
    // и раньше).
    el.addEventListener('click', function (e) {
      if (swallowClick) { e.stopPropagation(); swallowClick = false; }
    });
  }

  // ── тряска телефона ─────────────────────────────────────────────────
  var lastAccMag = null, lastShakeAt = 0, motionBound = false;

  function onDeviceMotion(e) {
    var acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc || acc.x == null) return;
    var mag = Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z);
    var t = ctx.now();
    if (lastAccMag != null) {
      var jerk = Math.abs(mag - lastAccMag);
      if (jerk > SHAKE_JERK && t - lastShakeAt > SHAKE_COOLDOWN_S) {
        startleAll(null, 1);   // без точки — испуг отовсюду сразу
        lastShakeAt = t;
      }
    }
    lastAccMag = mag;
  }

  function bindDeviceMotion() {
    if (typeof DeviceMotionEvent === 'undefined') return;   // датчиков нет — тихо пропускаем фичу
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      // iOS требует явного разрешения по жесту пользователя — просим его
      // при первом касании канваса, а не сразу при загрузке страницы
      // (запрос без жеста браузер просто отклонит).
      var askOnce = function () {
        ctx.renderer.domElement.removeEventListener('pointerdown', askOnce);
        DeviceMotionEvent.requestPermission().then(function (state) {
          if (state === 'granted' && !motionBound) {
            motionBound = true;
            addEventListener('devicemotion', onDeviceMotion);
          }
        }).catch(function () { /* отказали — тряски не будет, остальное работает */ });
      };
      ctx.renderer.domElement.addEventListener('pointerdown', askOnce);
    } else {
      motionBound = true;
      addEventListener('devicemotion', onDeviceMotion);
    }
  }

  // ── пузырьки за пальцем ─────────────────────────────────────────────
  // Пул фиксированного размера с готовым материалом на каждый слот —
  // рождение пузырька это просто «включить видимость и сбросить таймер»,
  // без единой аллокации в кадре жеста.
  var BUBBLE_MAX = 48;
  var bubblePool = null, bubbleCursor = 0, _bubbleTex = null;

  function bubbleTexture() {
    if (_bubbleTex) return _bubbleTex;
    var c = document.createElement('canvas');
    c.width = c.height = 32;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(16, 16, 5, 16, 16, 15);
    grd.addColorStop(0, 'rgba(190, 230, 255, 0.05)');
    grd.addColorStop(0.7, 'rgba(205, 238, 255, 0.55)');
    grd.addColorStop(1, 'rgba(205, 238, 255, 0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
    _bubbleTex = new ctx.THREE.CanvasTexture(c);
    return _bubbleTex;
  }

  function ensureBubblePool() {
    if (bubblePool) return;
    bubblePool = [];
    var tex = bubbleTexture();
    for (var i = 0; i < BUBBLE_MAX; i++) {
      var mat = new ctx.THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
      var spr = new ctx.THREE.Sprite(mat);
      spr.visible = false;
      ctx.scene.add(spr);
      bubblePool.push({ sprite: spr, mat: mat, vy: 0, seed: Math.random() * 6.28, born: 0, until: 0 });
    }
  }

  function spawnBubble(point, t) {
    var b = bubblePool[bubbleCursor];
    bubbleCursor = (bubbleCursor + 1) % BUBBLE_MAX;
    b.sprite.position.copy(point);
    b.sprite.position.x += (Math.random() - 0.5) * 0.2;
    b.sprite.position.y += (Math.random() - 0.5) * 0.12;
    var s = 0.07 + Math.random() * 0.12;
    b.sprite.scale.set(s, s, 1);
    b.sprite.visible = true;
    b.mat.opacity = 0.8;
    b.vy = 0.45 + Math.random() * 0.5;
    b.seed = Math.random() * 6.28;
    b.born = t;
    b.until = t + 1.0 + Math.random() * 0.7;
  }

  function updateBubbles(dt, t) {
    for (var i = 0; i < bubblePool.length; i++) {
      var b = bubblePool[i];
      if (!b.sprite.visible) continue;
      if (t > b.until) { b.sprite.visible = false; continue; }
      b.sprite.position.y += b.vy * dt;
      b.sprite.position.x += Math.sin(t * 3 + b.seed) * dt * 0.06;
      var life = (b.until - t) / Math.max(0.01, b.until - b.born);
      b.mat.opacity = Math.max(0, Math.min(1, life)) * 0.8;
    }
  }

  var lastBubbleAt = 0;
  function maybeSpawnBubble(point, t) {
    if (t - lastBubbleAt < BUBBLE_GAP_S) return;
    lastBubbleAt = t;
    spawnBubble(point, t);
  }

  // ── общий тик кадра ─────────────────────────────────────────────────
  function update(dt, t) {
    if (mode === 'single' && single && single.holding) {
      var wp = screenToWorld(pointers[single.id].x, pointers[single.id].y).clone();

      if (single.lastWorld) {
        var speed = wp.distanceTo(single.lastWorld) / Math.max(dt, 0.001);
        if (speed > SCATTER_SPEED) {
          // Резкое движение — не манит, а пугает тех, кто был рядом с
          // ПРЕЖНЕЙ точкой пальца (там, где они уже собрались на зов),
          // а не с новой — палец успел улететь дальше, чем рыба, и проверка
          // расстояния до новой точки могла бы никого не задеть.
          var origin = single.lastWorld;
          var list = ctx.getList();
          for (var i = 0; i < list.length; i++) {
            var c = list[i];
            if (c.pos && c.startle && c.pos.distanceTo(origin) < INTEREST_RADIUS) c.startle(origin, 0.8, t);
          }
          CreatureBehaviors.clearInterest();
        } else {
          CreatureBehaviors.setInterest(wp, INTEREST_RADIUS);
        }
      } else {
        CreatureBehaviors.setInterest(wp, INTEREST_RADIUS);
      }
      single.lastWorld = wp;

      // Погладить: палец держится ВПЛОТНУЮ к одной и той же рыбке достаточно
      // долго. Луч уже выставлен для этой же точки screenToWorld() чуть
      // выше — попадание считаем по нему, а не по глубине плоскости
      // взаимодействия, иначе рыбу глубже в аквариуме погладить не
      // получилось бы никогда. Смена цели (палец съехал на другую рыбку
      // или в пустоту) сбрасывает отсчёт — гладить нужно именно её, а не
      // мимоходом задеть.
      var near = nearestOnRay(PET_SEARCH_MUL, null);
      if (near && near === single.petTarget) {
        single.petSince += dt;
        if (single.petSince > PET_HOLD_S && !single.petted) {
          near.petHappy(t);
          single.petted = true;
        }
      } else {
        single.petTarget = near;
        single.petSince = 0;
        single.petted = false;
      }

      maybeSpawnBubble(wp, t);
    }

    if (mode === 'two' && twoFinger) {
      var m = midpoint();
      var wp2 = screenToWorld(m.x, m.y).clone();
      if (twoFinger.dragged && t - twoFinger.lastDrop > FOOD_TRAIL_GAP_S) {
        ctx.dropFoodAt(wp2.x, wp2.y, wp2.z, { count: 2 + Math.floor(Math.random() * 2), spread: 0.4 });
        twoFinger.lastDrop = t;
      }
      if (twoFinger.dragged) maybeSpawnBubble(wp2, t);
    }

    updateBubbles(dt, t);
  }

  window.TouchInteraction = { init: init, update: update };
})();
