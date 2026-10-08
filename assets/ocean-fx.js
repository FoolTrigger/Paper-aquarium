// assets/ocean-fx.js
// ------------------------------------------------------------
// Окружение аквариума: фон, дно и то, что плавает в толще воды помимо рыб.
//
// ПОРТИРОВАНО НА WebGPURenderer/TSL. Внешний API (OceanFX.init/setBackground/
// update/onResize) и вся математика эффектов сохранены один-в-один с
// исходной GLSL-версией — менялась только форма записи (TSL node graph
// вместо строк GLSL), потому что WebGPURenderer не выполняет произвольный
// GLSL из THREE.ShaderMaterial: WebGPU понимает только WGSL, а TSL — это
// кроссплатформенный слой, который компилируется и в WGSL (WebGPU-бэкенд),
// и в GLSL (WebGL-бэкенд, на случай отката через forceWebGL). Материалы без
// собственного шейдера (buildRocks — обычный MeshStandardMaterial) вообще
// не тронуты: WebGPURenderer сам оборачивает классические материалы в
// эквивалентный node-граф на лету.
//
// Функция узора каустики раньше была скопирована по всему проекту вручную
// (см. историческую заметку в git-истории) — в TSL связывание тривиально,
// поэтому она вынесена в assets/tsl-caustics.js и импортируется, а не
// копируется третий раз.
//
// API:
//   OceanFX.init(ctx)                  — один раз при старте сцены
//   OceanFX.setBackground(spec)        — { kind: 'file', url } | { kind: 'shader', shaderId }
//   OceanFX.update(dt, t)              — каждый кадр, после физики рыб
//   OceanFX.onResize()                 — при изменении размера окна

import {
  Fn, uniform, attribute, varying, positionLocal, positionWorld, modelViewMatrix,
  normalLocal, normalView, normalWorld, dot,
  uv, pointUV, texture, mix, smoothstep, length, clamp, sin, cos, abs, pow, step, fract,
  floor as tslFloor, mod, vec2, vec3, vec4, float, max as tslMax,
} from 'three/tsl';
import { causticPattern } from './tsl-caustics.js';

(function () {
  'use strict';

  var ctx = null;
  // ctx = { THREE, scene, camera, renderer, uTime, floor, frameAt(z), zNear, zFar }
  // ВАЖНО: ctx.uTime теперь обязан быть TSL uniform-нодой (TSL.uniform(0)), а
  // не старым { value: 0 } — см. правку в demos/realistic-tank.html. У нод
  // тоже есть settable .value, так что вызывающий код (`uTime.value = t;`)
  // не поменялся ни на строку.

  var isLowEnd = (function () {
    if (typeof navigator === 'undefined') return false;
    var mem = navigator.deviceMemory || 8;
    var cores = navigator.hardwareConcurrency || 8;
    var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    return mem <= 4 || cores <= 4 || isMobile;
  })();

  var floorMesh = null, weedMesh = null, reefGroup = null;
  var bubblePoints = null, planktonPoints = null, godRayGroup = null;
  var anemoneTentacles = [];
  var bgVideo = null, bgVideoTex = null, bgShaderMesh = null;
  var appliedBg = null;
  var uCaustics = uniform(1.0);

  var decorState = {
    weed: true,
    reef: true,
    bubbles: true,
    plankton: true,
    rays: true,
    caustics: true,
    floor: true
  };

  function setDecorVisible(type, visible) {
    if (type in decorState) decorState[type] = !!visible;
    if (type === 'weed' && weedMesh) weedMesh.visible = !!visible;
    if (type === 'reef' && reefGroup) reefGroup.visible = !!visible;
    if (type === 'bubbles' && bubblePoints) bubblePoints.visible = !!visible;
    if (type === 'plankton' && planktonPoints) planktonPoints.visible = !!visible;
    if (type === 'rays' && godRayGroup) godRayGroup.visible = !!visible;
    if (type === 'floor' && floorMesh) floorMesh.visible = !!visible;
    if (type === 'caustics') {
      uCaustics.value = visible ? 1.0 : 0.0;
    }
  }

  function getDecorState() {
    return Object.assign({}, decorState);
  }

  function init(context) {
    ctx = context;
    buildFloor();
    buildSeaweed();
    buildReefFlora();
    buildBubbles();
    buildPlankton();
    buildGodRays();
    for (var k in decorState) {
      setDecorVisible(k, decorState[k]);
    }
  }

  // ── дно: почти невидимая песчаная плоскость, только затем, чтобы было
  // на чём играть каустике и на чём стоять водорослям ────────────────────
  function buildFloor() {
    var geo = new ctx.THREE.PlaneGeometry(90, 90, 1, 1);
    geo.rotateX(-Math.PI / 2);

    var uColor = uniform(new ctx.THREE.Color(0x18354a));
    var mat = new ctx.THREE.MeshBasicNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = true;

    var caus = causticPattern(positionWorld.xz, ctx.uTime.mul(0.35));
    // затухает к краям — дно читается как пятно света, а не ковёр во весь экран
    var fall = smoothstep(float(45.0), float(8.0), length(positionWorld.xz));
    mat.colorNode = uColor.add(vec3(0.35, 0.55, 0.6).mul(caus).mul(fall).mul(uCaustics));
    mat.opacityNode = fall.mul(0.85);

    floorMesh = new ctx.THREE.Mesh(geo, mat);
    floorMesh.position.y = ctx.floor;
    floorMesh.renderOrder = -5;
    ctx.scene.add(floorMesh);
  }

  // ── геометрия лезвия водоросли: изящный тонкий лист с 3D-прогибом ────────
  function createBladeGeometry(width, segs) {
    var geo = new ctx.THREE.PlaneGeometry(width, 1.0, 3, segs);
    geo.translate(0, 0.5, 0); // основание в (0,0,0)
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i);
      var x = pos.getX(i);
      // Плавное сужение: гибкий черешок у корня (0.12), мягкое расширение в нижней трети (1.0),
      // и тонкий изящный кончик (0.04)
      var taper = Math.sin(Math.pow(y, 0.65) * Math.PI) * 0.88 + (1.0 - y) * 0.08 + 0.04;
      pos.setX(i, x * taper);
      // 3D-прогиб: центральная жилка листа слегка выдвинута вперёд
      var rib = 1.0 - Math.min(1.0, Math.abs(x / (width * 0.5)));
      pos.setZ(i, rib * 0.035 * taper);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // ── водоросли: изящные заросли валлиснерии / ламинарии, обрамляющие края ──
  var WEED_COUNT = isLowEnd ? 44 : 84;
  function buildSeaweed() {
    // Тонкое, изящное лезвие (ширина 0.24 — гармонично в масштабе аквариума)
    var blade = createBladeGeometry(0.24, isLowEnd ? 10 : 18);

    var geo = new ctx.THREE.InstancedBufferGeometry();
    geo.index = blade.index;
    geo.attributes.position = blade.attributes.position;
    geo.attributes.uv = blade.attributes.uv;

    var offsets = new Float32Array(WEED_COUNT * 3);
    var params = new Float32Array(WEED_COUNT * 4); // height, phase, sway, hue
    var sideBias = new Float32Array(WEED_COUNT);   // -1 для левой кулисы, +1 для правой

    for (var i = 0; i < WEED_COUNT; i++) {
      var isRight = i >= WEED_COUNT / 2;
      // Глубина строго в толще воды (от zFar*0.8 до zFar*0.18, никогда в упор к камере!)
      var z = ctx.zFar * (0.22 + Math.random() * 0.58);
      var fz = ctx.frameAt(z);

      // Расположение по бокам: от 64% до 96% ширины кадра на этой глубине.
      // Центр (64% сцены) остаётся абсолютно открытым для корабля и рыб!
      var xRatio = 0.64 + Math.random() * 0.32;
      var x = isRight ? fz.hw * xRatio : -fz.hw * xRatio;

      // Три яруса высоты: задние величественные стебли, средние заросли и невысокие кустики у камней
      var tier = Math.random();
      var h;
      if (tier < 0.35) {
        h = 4.6 + Math.random() * 2.8; // высокие задние (4.6 - 7.4)
      } else if (tier < 0.80) {
        h = 2.7 + Math.random() * 1.8; // средние (2.7 - 4.5)
      } else {
        h = 1.3 + Math.random() * 1.3; // придонные (1.3 - 2.6)
      }

      var sway = 0.07 + Math.random() * 0.08;

      offsets[i * 3] = x;
      offsets[i * 3 + 1] = ctx.floor;
      offsets[i * 3 + 2] = z;

      params[i * 4] = h;
      params[i * 4 + 1] = Math.random() * 6.28;
      params[i * 4 + 2] = sway;
      params[i * 4 + 3] = Math.random();

      sideBias[i] = isRight ? 1.0 : -1.0;
    }

    geo.setAttribute('iOffset', new ctx.THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('iParams', new ctx.THREE.InstancedBufferAttribute(params, 4));
    geo.setAttribute('iSide', new ctx.THREE.InstancedBufferAttribute(sideBias, 1));
    geo.instanceCount = WEED_COUNT;

    var mat = new ctx.THREE.MeshStandardNodeMaterial();
    mat.side = ctx.THREE.DoubleSide;
    mat.roughness = 0.50;
    mat.metalness = 0.02;

    var iOffset = attribute('iOffset', 'vec3');
    var iParams = attribute('iParams', 'vec4');
    var iSide = attribute('iSide', 'float');
    var h = iParams.x, phase = iParams.y, sway = iParams.z, hue = iParams.w;

    var py = positionLocal.y.mul(h);
    var k = clamp(positionLocal.y, 0.0, 1.0);
    var k2 = k.mul(k);
    var k3 = k2.mul(k);

    // Плавное колыхание в течении воды
    var wave1 = sin(ctx.uTime.mul(0.95).add(phase).add(k2.mul(1.8))).mul(sway).mul(k2).mul(h);
    var wave2 = sin(ctx.uTime.mul(1.9).add(phase.mul(1.4)).add(k.mul(2.6))).mul(sway.mul(0.18)).mul(k3).mul(h);

    // Естественный веерный наклон листьев в стороны от центра сцены
    var leanX = iSide.mul(float(0.18)).mul(k2).mul(h);
    var px = positionLocal.x.add(wave1).add(wave2).add(leanX);

    var waveZ = cos(ctx.uTime.mul(0.8).add(phase.mul(1.1))).mul(sway.mul(0.25)).mul(k2).mul(h);
    var pz = positionLocal.z.add(waveZ);

    var p = vec3(px, py, pz);
    var worldPos = p.add(iOffset);
    mat.positionNode = worldPos;

    var vT = varying(k, 'vSeaweedT');
    var vHue = varying(hue, 'vSeaweedHue');

    // Насыщенные естественные подводные оттенки (глубокий изумрудный, нефритовый, оливковый)
    var colRoot = vec3(0.008, 0.055, 0.020);
    var colMid  = vec3(0.045, 0.280, 0.065);
    var colTip  = vec3(0.180, 0.440, 0.080);

    var cLow = mix(colRoot, colMid, vT.mul(2.0));
    var cHigh = mix(colMid, colTip, vT.sub(0.5).mul(2.0));
    var baseKelp = mix(cLow, cHigh, step(0.5, vT));

    var tint = mix(vec3(-0.015, 0.04, -0.01), vec3(0.04, 0.05, 0.015), vHue);
    var finalKelpColor = baseKelp.add(tint);

    // Мягкая игра солнечных бликов на листве
    var caus = causticPattern(worldPos.xz.mul(0.6), ctx.uTime.mul(0.3));
    var sunlit = caus.mul(0.09).mul(vT).mul(uCaustics);
    mat.colorNode = finalKelpColor.add(sunlit);

    weedMesh = new ctx.THREE.Mesh(geo, mat);
    weedMesh.frustumCulled = false;
    ctx.scene.add(weedMesh);
  }

  // ── коралловый риф: живописные скалы, ветвистые кораллы, губки и актинии ─
  function buildReefFlora() {
    reefGroup = new ctx.THREE.Group();
    var f0 = ctx.frameAt(0);

    // Процедурные рифовые камни с естественными неровностями и уступами
    function createRockGeometry(r) {
      var geo = new ctx.THREE.DodecahedronGeometry(r, 2);
      var pos = geo.attributes.position;
      var v = new ctx.THREE.Vector3();
      for (var i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        var n = 1.0 + Math.sin(v.x * 3.2 + v.y * 2.0) * 0.13
                    + Math.cos(v.y * 3.8 + v.z * 2.8) * 0.11
                    + Math.sin(v.z * 5.0 + v.x * 4.0) * 0.07;
        v.multiplyScalar(n);
        if (v.y < 0) v.y *= 0.6; // приплюснутое основание для естественной посадки в песок
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      return geo;
    }

    var rockGeoLarge = createRockGeometry(1.4);
    var rockGeoMid   = createRockGeometry(1.0);
    var rockGeoSmall = createRockGeometry(0.65);

    var rockMats = [
      new ctx.THREE.MeshStandardMaterial({ color: 0x16242c, roughness: 0.90, metalness: 0.04 }), // вулканический базальт
      new ctx.THREE.MeshStandardMaterial({ color: 0x2b1b26, roughness: 0.86, metalness: 0.05 }), // кораллиновая корка
      new ctx.THREE.MeshStandardMaterial({ color: 0x1c2b21, roughness: 0.92, metalness: 0.04 })  // замшелый известняк
    ];

    function addRock(geo, matIdx, x, z, sx, sy, sz, rotY, rotX) {
      var m = new ctx.THREE.Mesh(geo, rockMats[matIdx]);
      m.scale.set(sx, sy, sz);
      m.position.set(x, ctx.floor + sy * 0.12, z);
      m.rotation.set(rotX || 0.1, rotY || 0, (Math.random() - 0.5) * 0.2);
      reefGroup.add(m);
    }

    // Левый рифовый мыс: живописная гряда камней, образующая террасу
    addRock(rockGeoLarge, 0, -f0.hw * 0.88, ctx.zFar * 0.38, 1.8, 0.95, 1.5, 0.4, 0.1);
    addRock(rockGeoLarge, 1, -f0.hw * 0.74, ctx.zFar * 0.30, 1.5, 0.85, 1.3, -0.6, -0.1);
    addRock(rockGeoMid,   2, -f0.hw * 0.64, ctx.zFar * 0.20, 1.3, 0.70, 1.1, 1.1, 0.15);
    addRock(rockGeoMid,   0, -f0.hw * 0.82, ctx.zFar * 0.16, 1.4, 0.65, 1.2, 0.2, -0.1);
    addRock(rockGeoSmall, 1, -f0.hw * 0.55, ctx.zFar * 0.12, 1.1, 0.50, 0.9, -0.4, 0.2);

    // Правый рифовый мыс: гряда камней справа
    addRock(rockGeoLarge, 1, f0.hw * 0.88, ctx.zFar * 0.35, 1.8, 0.95, 1.5, -0.5, 0.1);
    addRock(rockGeoLarge, 0, f0.hw * 0.75, ctx.zFar * 0.28, 1.5, 0.85, 1.3, 0.8, -0.1);
    addRock(rockGeoMid,   2, f0.hw * 0.65, ctx.zFar * 0.18, 1.3, 0.70, 1.1, -1.2, 0.15);
    addRock(rockGeoMid,   1, f0.hw * 0.84, ctx.zFar * 0.15, 1.4, 0.65, 1.2, 0.3, -0.1);
    addRock(rockGeoSmall, 0, f0.hw * 0.56, ctx.zFar * 0.11, 1.1, 0.50, 0.9, 0.6, 0.2);

    // 1. Ветвистые кораллы (Acropora / оленьи рога)
    function addBranchingCoral(cx, cz, baseH, s, rotY, colorHex) {
      var coral = new ctx.THREE.Group();
      var mat = new ctx.THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.42,
        metalness: 0.05
      });

      // Главный ствол
      var stemGeo = new ctx.THREE.CylinderGeometry(0.12 * s, 0.20 * s, 1.1 * s, 10);
      stemGeo.translate(0, 0.55 * s, 0);
      coral.add(new ctx.THREE.Mesh(stemGeo, mat));

      // Расходящиеся изогнутые ветви
      var branchSpecs = [
        { rotY: 0.2,  tilt: 0.48, h: 1.3, r: 0.095, dy: 0.38 },
        { rotY: 1.8,  tilt: 0.54, h: 1.15, r: 0.085, dy: 0.48 },
        { rotY: 3.4,  tilt: 0.44, h: 1.35, r: 0.09, dy: 0.32 },
        { rotY: 4.9,  tilt: 0.50, h: 1.05, r: 0.08, dy: 0.58 }
      ];

      branchSpecs.forEach(function (b) {
        var bGeo = new ctx.THREE.CylinderGeometry(b.r * 0.55 * s, b.r * s, b.h * s, 8);
        bGeo.translate(0, b.h * 0.5 * s, 0);
        var tipGeo = new ctx.THREE.SphereGeometry(b.r * 0.7 * s, 8, 6);
        tipGeo.translate(0, b.h * s, 0);

        var bMesh = new ctx.THREE.Mesh(bGeo, mat);
        var tipMesh = new ctx.THREE.Mesh(tipGeo, mat);

        var bGroup = new ctx.THREE.Group();
        bGroup.position.y = b.dy * s;
        bGroup.rotation.y = b.rotY;
        bGroup.rotation.z = b.tilt;
        bGroup.add(bMesh);
        bGroup.add(tipMesh);
        coral.add(bGroup);
      });

      coral.position.set(cx, ctx.floor + baseH, cz);
      coral.rotation.y = rotY;
      reefGroup.add(coral);
    }

    // Розовый коралл на левом рифе и бирюзовый на правом
    addBranchingCoral(-f0.hw * 0.72, ctx.zFar * 0.32, 0.85, 1.35, 0.4, 0xf06292);
    addBranchingCoral(f0.hw * 0.75, ctx.zFar * 0.28, 0.85, 1.30, -0.5, 0x00e5ff);

    // 2. Тропические трубчатые губки (Aplysina / органные кораллы)
    function addSpongeColony(cx, cz, baseH, specs, mainColor, rimColor) {
      var colGroup = new ctx.THREE.Group();
      var tubeMat = new ctx.THREE.MeshStandardMaterial({
        color: mainColor,
        roughness: 0.48,
        metalness: 0.05
      });
      var rimMat = new ctx.THREE.MeshStandardMaterial({
        color: rimColor || mainColor,
        roughness: 0.32,
        metalness: 0.08
      });
      var innerMat = new ctx.THREE.MeshBasicMaterial({ color: 0x050c12 });

      specs.forEach(function (spec) {
        var rTop = spec.r || 0.15;
        var rBot = rTop * 1.35;
        var h = spec.h;
        var tGeo = new ctx.THREE.CylinderGeometry(rTop, rBot, h, 14, 1, false);
        var tube = new ctx.THREE.Mesh(tGeo, tubeMat);
        tube.position.set(spec.dx, h * 0.5, spec.dz);
        tube.rotation.z = spec.tz || 0;
        tube.rotation.x = spec.tx || 0;

        var rimGeo = new ctx.THREE.TorusGeometry(rTop * 0.95, rTop * 0.22, 8, 14);
        rimGeo.rotateX(Math.PI / 2);
        var rim = new ctx.THREE.Mesh(rimGeo, rimMat);
        rim.position.y = h * 0.5;
        tube.add(rim);

        var inGeo = new ctx.THREE.CircleGeometry(rTop * 0.85, 12);
        inGeo.rotateX(-Math.PI / 2);
        var inMesh = new ctx.THREE.Mesh(inGeo, innerMat);
        inMesh.position.y = h * 0.5 - 0.02;
        tube.add(inMesh);

        colGroup.add(tube);
      });

      colGroup.position.set(cx, ctx.floor + baseH, cz);
      reefGroup.add(colGroup);
    }

    // Колония 1: Слева — мандариново-оранжевые губки
    addSpongeColony(-f0.hw * 0.58, ctx.zFar * 0.18, 0.55, [
      { dx: 0, dz: 0, h: 2.1, r: 0.16, tz: -0.06, tx: 0.04 },
      { dx: 0.28, dz: 0.14, h: 1.7, r: 0.14, tz: 0.10, tx: -0.05 },
      { dx: -0.25, dz: -0.10, h: 1.4, r: 0.13, tz: -0.12, tx: 0.06 },
      { dx: 0.10, dz: -0.22, h: 1.0, r: 0.12, tz: 0.05, tx: -0.10 }
    ], 0xff6d00, 0xffca28);

    // Колония 2: Слева сзади — королевский фиолетовый
    addSpongeColony(-f0.hw * 0.84, ctx.zFar * 0.36, 0.85, [
      { dx: 0, dz: 0, h: 2.5, r: 0.17, tz: 0.05, tx: -0.06 },
      { dx: -0.28, dz: 0.15, h: 2.0, r: 0.15, tz: -0.10, tx: 0.05 },
      { dx: 0.24, dz: -0.12, h: 1.6, r: 0.13, tz: 0.12, tx: -0.08 },
      { dx: -0.12, dz: -0.25, h: 1.2, r: 0.12, tz: -0.05, tx: -0.10 }
    ], 0x8e24aa, 0xe040fb);

    // Колония 3: Справа — карибская бирюза
    addSpongeColony(f0.hw * 0.60, ctx.zFar * 0.15, 0.52, [
      { dx: 0, dz: 0, h: 2.2, r: 0.16, tz: 0.06, tx: -0.05 },
      { dx: -0.26, dz: 0.12, h: 1.75, r: 0.14, tz: -0.10, tx: 0.06 },
      { dx: 0.22, dz: -0.12, h: 1.4, r: 0.13, tz: 0.12, tx: -0.07 },
      { dx: -0.08, dz: -0.20, h: 1.05, r: 0.12, tz: -0.05, tx: -0.10 }
    ], 0x00acc1, 0x80deea);

    // Колония 4: Справа сзади — теплый золотистый янтарь
    addSpongeColony(f0.hw * 0.82, ctx.zFar * 0.32, 0.85, [
      { dx: 0, dz: 0, h: 2.4, r: 0.17, tz: -0.06, tx: 0.05 },
      { dx: 0.26, dz: 0.14, h: 1.9, r: 0.14, tz: 0.10, tx: -0.06 },
      { dx: -0.22, dz: -0.12, h: 1.5, r: 0.13, tz: -0.12, tx: 0.07 },
      { dx: 0.12, dz: -0.22, h: 1.15, r: 0.12, tz: 0.06, tx: -0.08 }
    ], 0xf59e0b, 0xfff59d);

    // 3. Морские актинии с живыми колышущимися щупальцами
    function addAnemone(cx, cz, baseH, colorHex, tentacleCount) {
      var anGroup = new ctx.THREE.Group();
      var bMat = new ctx.THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.55 });
      var bMesh = new ctx.THREE.Mesh(new ctx.THREE.SphereGeometry(0.24, 12, 8), bMat);
      bMesh.scale.set(1.3, 0.55, 1.3);
      anGroup.add(bMesh);

      var tMat = new ctx.THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.32,
        emissive: colorHex,
        emissiveIntensity: 0.18
      });
      var tGeo = new ctx.THREE.ConeGeometry(0.034, 0.65, 6);
      tGeo.translate(0, 0.32, 0);

      for (var i = 0; i < tentacleCount; i++) {
        var angle = (i / tentacleCount) * Math.PI * 2;
        var r = 0.11 + Math.random() * 0.09;
        var tMesh = new ctx.THREE.Mesh(tGeo, tMat);
        tMesh.position.set(Math.cos(angle) * r, 0.1, Math.sin(angle) * r);
        tMesh.rotation.z = -Math.cos(angle) * 0.45;
        tMesh.rotation.x = Math.sin(angle) * 0.45;
        anGroup.add(tMesh);
        anemoneTentacles.push({
          mesh: tMesh,
          baseRotZ: tMesh.rotation.z,
          baseRotX: tMesh.rotation.x,
          phase: Math.random() * 6.28
        });
      }

      anGroup.position.set(cx, ctx.floor + baseH, cz);
      reefGroup.add(anGroup);
    }

    addAnemone(-f0.hw * 0.64, ctx.zFar * 0.22, 0.68, 0xff4081, isLowEnd ? 12 : 20); // флуоресцентная розовая актиния слева
    addAnemone(f0.hw * 0.66, ctx.zFar * 0.19, 0.68, 0x00e676, isLowEnd ? 12 : 20);  // неоновая морская волна справа

    // 4. Морские звёзды на песчаном дне
    function addStarfish(cx, cz, s, rot, colorHex) {
      var star = new ctx.THREE.Group();
      var sMat = new ctx.THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.62 });
      var armGeo = new ctx.THREE.ConeGeometry(0.075 * s, 0.36 * s, 5);
      armGeo.translate(0, 0.18 * s, 0);
      armGeo.rotateX(Math.PI / 2);
      for (var i = 0; i < 5; i++) {
        var a = (i / 5) * Math.PI * 2;
        var arm = new ctx.THREE.Mesh(armGeo, sMat);
        arm.rotation.y = a;
        star.add(arm);
      }
      var center = new ctx.THREE.Mesh(new ctx.THREE.SphereGeometry(0.09 * s, 10, 8), sMat);
      center.scale.y = 0.4;
      star.add(center);

      star.position.set(cx, ctx.floor + 0.05, cz);
      star.rotation.y = rot;
      star.rotation.x = -0.05;
      reefGroup.add(star);
    }

    addStarfish(-f0.hw * 0.52, ctx.zFar * 0.08, 1.2, 0.35, 0xff5722); // терракотовая звезда слева
    addStarfish(f0.hw * 0.54, ctx.zFar * 0.07, 0.95, -0.6, 0x1976d2); // синяя морская звезда справа

    // 5. Гладкая морская галька у подножия рифа
    var pebbleGeo = new ctx.THREE.SphereGeometry(0.18, 8, 6);
    var pebbleMat = new ctx.THREE.MeshStandardMaterial({ color: 0x22363f, roughness: 0.85 });
    function addPebble(x, z, sx, sy, sz) {
      var pMesh = new ctx.THREE.Mesh(pebbleGeo, pebbleMat);
      pMesh.scale.set(sx, sy, sz);
      pMesh.position.set(x, ctx.floor + sy * 0.15, z);
      pMesh.rotation.set(Math.random(), Math.random(), Math.random());
      reefGroup.add(pMesh);
    }
    addPebble(-f0.hw * 0.51, ctx.zFar * 0.14, 0.9, 0.45, 0.7);
    addPebble(-f0.hw * 0.48, ctx.zFar * 0.10, 0.7, 0.35, 0.6);
    addPebble(f0.hw * 0.52, ctx.zFar * 0.13, 0.85, 0.40, 0.75);
    addPebble(f0.hw * 0.49, ctx.zFar * 0.09, 0.65, 0.30, 0.55);

    ctx.scene.add(reefGroup);
  }

  // ── искрящиеся пузырьки: 3D-сферы Френеля, всплывающие из аэраторов ──────
  var BUBBLE_COUNT = isLowEnd ? 36 : 70;
  function buildBubbles() {
    var sphereGeo = new ctx.THREE.SphereGeometry(1.0, 12, 8);
    var geo = new ctx.THREE.InstancedBufferGeometry();
    geo.index = sphereGeo.index;
    geo.attributes.position = sphereGeo.attributes.position;
    geo.attributes.normal = sphereGeo.attributes.normal;
    geo.attributes.uv = sphereGeo.attributes.uv;

    var offsets = new Float32Array(BUBBLE_COUNT * 3);
    var seeds = new Float32Array(BUBBLE_COUNT * 3); // phase, speed, radius

    var f0 = ctx.frameAt(0);
    for (var i = 0; i < BUBBLE_COUNT; i++) {
      var isLeft = i < BUBBLE_COUNT / 2;
      var bx = isLeft ? -f0.hw * (0.69 + (Math.random() - 0.5) * 0.08) : f0.hw * (0.71 + (Math.random() - 0.5) * 0.08);
      var bz = isLeft ? ctx.zFar * 0.28 + (Math.random() - 0.5) * 1.2 : ctx.zFar * 0.24 + (Math.random() - 0.5) * 1.2;

      offsets[i * 3] = bx;
      offsets[i * 3 + 1] = ctx.floor + 0.3;
      offsets[i * 3 + 2] = bz;

      seeds[i * 3] = Math.random() * 6.28;
      seeds[i * 3 + 1] = 0.85 + Math.random() * 0.5; // скорость всплытия
      seeds[i * 3 + 2] = 0.08 + Math.random() * 0.12; // радиус пузырька
    }

    geo.setAttribute('iOffset', new ctx.THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute('iSeed', new ctx.THREE.InstancedBufferAttribute(seeds, 3));
    geo.instanceCount = BUBBLE_COUNT;

    var mat = new ctx.THREE.MeshStandardNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    mat.roughness = 0.12;
    mat.metalness = 0.08;

    var iOffset = attribute('iOffset', 'vec3');
    var iSeed = attribute('iSeed', 'vec3');

    var totalHeight = float(14.5);
    var rise = mod(ctx.uTime.mul(iSeed.y.mul(2.2)).add(iSeed.x.mul(3.5)), totalHeight);

    var wobbleX = sin(ctx.uTime.mul(3.8).add(iSeed.x)).mul(0.18);
    var wobbleZ = cos(ctx.uTime.mul(3.2).add(iSeed.x)).mul(0.14);

    var expand = float(1.0).add(rise.div(totalHeight).mul(0.45));
    var radius = iSeed.z.mul(expand);
    var pScaled = positionLocal.mul(radius);

    var px = pScaled.x.add(iOffset.x).add(wobbleX);
    var py = pScaled.y.add(iOffset.y).add(rise);
    var pz = pScaled.z.add(iOffset.z).add(wobbleZ);
    mat.positionNode = vec3(px, py, pz);

    // Эффект Френеля: прозрачное тело пузырька со сверкающей кромкой
    var normalDotView = abs(dot(normalView, vec3(0.0, 0.0, 1.0)));
    var fresnel = float(1.0).sub(normalDotView).pow(2.2);

    var fadeIn = smoothstep(float(0.0), float(0.8), rise);
    var fadeOut = smoothstep(totalHeight, totalHeight.sub(1.2), rise);
    var alpha = fadeIn.mul(fadeOut);

    mat.colorNode = mix(vec3(0.72, 0.92, 1.0), vec3(1.0, 1.0, 1.0), fresnel);
    mat.opacityNode = fresnel.mul(0.82).add(0.14).mul(alpha);

    bubblePoints = new ctx.THREE.Mesh(geo, mat);
    bubblePoints.frustumCulled = false;
    ctx.scene.add(bubblePoints);
  }

  // ── планктон: THREE.Points, весь дрейф считает TSL positionNode ────────
  // На среднем телефоне лишний JS-цикл по сотням точек каждый кадр заметен
  // на профайлере, а GPU эти же синусы посчитает бесплатно параллельно
  // с растеризацией — поэтому CPU трогает позиции только один раз, при
  // создании, а не на каждом кадре.
  var PLANKTON_COUNT = isLowEnd ? 120 : 260;
  function dotTexture() {
    var c = document.createElement('canvas');
    c.width = c.height = 32;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return new ctx.THREE.CanvasTexture(c);
  }
  function buildPlankton() {
    var geo = new ctx.THREE.BufferGeometry();
    var pos = new Float32Array(PLANKTON_COUNT * 3);
    var seed = new Float32Array(PLANKTON_COUNT * 3);   // seedX, seedY, size
    var f0 = ctx.frameAt(0);
    for (var i = 0; i < PLANKTON_COUNT; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * f0.hw;
      pos[i * 3 + 1] = ctx.floor + Math.random() * 12;
      pos[i * 3 + 2] = ctx.zFar + Math.random() * (ctx.zNear - ctx.zFar);
      seed[i * 3] = Math.random() * 6.28;
      seed[i * 3 + 1] = Math.random() * 6.28;
      seed[i * 3 + 2] = 0.02 + Math.random() * 0.05;
    }
    geo.setAttribute('position', new ctx.THREE.BufferAttribute(pos, 3));
    geo.setAttribute('iSeed', new ctx.THREE.BufferAttribute(seed, 3));

    var mat = new ctx.THREE.PointsNodeMaterial();
    mat.transparent = true;
    mat.depthWrite = false;
    mat.blending = ctx.THREE.AdditiveBlending;
    mat.map = dotTexture();
    mat.sizeAttenuation = false; // формула размера считается вручную ниже, byte-for-byte как в GLSL

    var iSeed = attribute('iSeed', 'vec3');
    var px = positionLocal.x.add(sin(ctx.uTime.mul(0.25).add(iSeed.x)).mul(0.6));
    var pz = positionLocal.z.add(cos(ctx.uTime.mul(0.2).add(iSeed.y)).mul(0.6));
    // медленно поднимается и зацикливается по высоте — «пылинки в луче света»
    var rise = mod(ctx.uTime.mul(0.06).add(iSeed.x), 12.0);
    var py = positionLocal.y.add(rise);
    var p = vec3(px, py, pz);
    mat.positionNode = p;

    var mv = modelViewMatrix.mul(vec4(p, 1.0));
    mat.sizeNode = float(300.0).mul(iSeed.z).div(tslMax(mv.z.negate(), 1.0));

    var vAlpha = varying(float(0.55).add(float(0.45).mul(sin(ctx.uTime.mul(1.4).add(iSeed.y)))), 'vPlanktonAlpha');
    mat.colorNode = vec3(0.85, 0.95, 1.0);
    mat.opacityNode = vAlpha.mul(0.35);

    planktonPoints = new ctx.THREE.Points(geo, mat);
    planktonPoints.frustumCulled = false;
    ctx.scene.add(planktonPoints);
  }

  // ── лучи света: несколько полупрозрачных конусов сверху, аддитивно ─────
  function buildGodRays() {
    godRayGroup = new ctx.THREE.Group();
    var count = 4;
    for (var i = 0; i < count; i++) {
      var geo = new ctx.THREE.PlaneGeometry(2.4, 18, 1, 12);
      geo.translate(0, -9, 0);   // верх у источника, низ уходит в глубину

      var uSeed = uniform(Math.random() * 10);
      var mat = new ctx.THREE.MeshBasicNodeMaterial();
      mat.transparent = true;
      mat.depthWrite = false;
      mat.side = ctx.THREE.DoubleSide;
      mat.blending = ctx.THREE.AdditiveBlending;

      var vUv = uv();
      // затухание к низу (глубина) и к краям луча (профиль конуса)
      var depthFade = pow(float(1.0).sub(vUv.y), 1.6);
      var edgeFade = float(1.0).sub(abs(vUv.x.sub(0.5)).mul(2.0));
      var flicker = float(0.75).add(float(0.25).mul(sin(ctx.uTime.mul(0.6).add(uSeed).add(vUv.y.mul(4.0)))));
      var a = depthFade.mul(edgeFade).mul(flicker).mul(0.10);

      mat.colorNode = vec3(0.75, 0.9, 1.0);
      mat.opacityNode = a;

      var mesh = new ctx.THREE.Mesh(geo, mat);
      var f0 = ctx.frameAt(3);
      mesh.position.set((Math.random() * 2 - 1) * f0.hw * 0.6, 15, ctx.zNear - 2 - Math.random() * 8);
      mesh.rotation.z = (Math.random() - 0.5) * 0.3;
      mesh.rotation.y = (Math.random() - 0.5) * 0.4;
      mesh.renderOrder = 5;
      godRayGroup.add(mesh);
    }
    ctx.scene.add(godRayGroup);
  }

  // ── фон: картинка/видео-петля (общий загруженный файл) или процедурный
  // шейдер. Кадрирование cover — та же идея, что раньше жила в
  // applyBackground()/fitBackground() внутри realistic-tank.html, только
  // подхватывает и видео тоже. ────────────────────────────────────────────

  // Градиент глубины: тёплый верх у поверхности, холодный низ у дна.
  var depthGradientColorNode = Fn(() => {
    var vUv = uv();
    var top = vec3(0.16, 0.42, 0.55);
    var bottom = vec3(0.01, 0.06, 0.11);
    var col = mix(bottom, top, pow(vUv.y, 1.3)).toVar();
    var caus = causticPattern(vUv.mul(8.0), ctx.uTime.mul(0.3));
    col.addAssign(vec3(0.05, 0.09, 0.1).mul(caus).mul(vUv.y).mul(uCaustics));
    return col;
  });

  // Взвесь: тот же градиент плюс мелкие плывущие частицы прямо в фоне —
  // пригождается, когда хочется фон подвижным, а бюджет не тянет полноценные
  // Points поверх сцены (Smart TV с урезанным GPU).
  var hash2 = Fn(([p]) => {
    return fract(sin(p.dot(vec2(41.3, 289.1))).mul(43758.5453));
  });
  var particlesColorNode = Fn(() => {
    var vUv = uv();
    var top = vec3(0.14, 0.38, 0.5);
    var bottom = vec3(0.02, 0.07, 0.12);
    var col = mix(bottom, top, pow(vUv.y, 1.3)).toVar();
    var grid = vUv.mul(vec2(40.0, 60.0));
    var cell = tslFloor(grid);
    var speck = hash2(cell);
    var twinkle = step(0.985, speck);
    var drift = fract(vUv.y.mul(60.0).add(ctx.uTime.mul(0.15)).add(speck.mul(6.28)));
    col.addAssign(twinkle.mul(float(1.0).sub(abs(drift.sub(0.5)).mul(2.0))).mul(vec3(0.5, 0.6, 0.6)));
    return col;
  });

  var SHADERS = {
    'depth-gradient': { colorNode: depthGradientColorNode },
    'particles': { colorNode: particlesColorNode },
  };

  function clearVideoBg() {
    if (bgVideo) { bgVideo.pause(); bgVideo.src = ''; bgVideo = null; }
    if (bgVideoTex) { bgVideoTex.dispose(); bgVideoTex = null; }
  }
  function clearShaderBg() {
    if (bgShaderMesh) {
      ctx.scene.remove(bgShaderMesh);
      bgShaderMesh.geometry.dispose();
      bgShaderMesh.material.dispose();
      bgShaderMesh = null;
    }
  }

  function isVideoUrl(url) { return /\.(mp4|webm|mov)(\?|$)/i.test(url || ''); }

  function setBackground(spec, onApplied) {
    var key = JSON.stringify(spec);
    if (key === appliedBg) { if (onApplied) onApplied(); return; }
    appliedBg = key;
    clearShaderBg();

    if (!spec || spec.kind === 'file') {
      var url = spec && spec.url;
      if (url && isVideoUrl(url)) {
        clearVideoBg();
        if (!url) { ctx.scene.background = new ctx.THREE.Color(0x0e1013); if (onApplied) onApplied(); return; }
        bgVideo = document.createElement('video');
        bgVideo.src = url; bgVideo.loop = true; bgVideo.muted = true;
        bgVideo.playsInline = true; bgVideo.autoplay = true;
        bgVideo.play().catch(function () { /* автоплей могли заблокировать — сработает после первого клика по сцене */ });
        bgVideoTex = new ctx.THREE.VideoTexture(bgVideo);
        bgVideoTex.colorSpace = ctx.THREE.SRGBColorSpace;
        ctx.scene.background = bgVideoTex;
        fitBackground();
        if (onApplied) onApplied();
        return;
      }
      clearVideoBg();
      if (!url) { ctx.scene.background = new ctx.THREE.Color(0x0e1013); if (onApplied) onApplied(); return; }
      new ctx.THREE.TextureLoader().load(url, function (tex) {
        if (key !== appliedBg) return;   // выбрали другой фон, пока грузился этот
        tex.colorSpace = ctx.THREE.SRGBColorSpace;
        ctx.scene.background = tex;
        fitBackground();
        if (onApplied) onApplied();
      });
      return;
    }

    if (spec.kind === 'shader') {
      clearVideoBg();
      ctx.scene.background = new ctx.THREE.Color(0x0e1013);
      var def = SHADERS[spec.shaderId] || SHADERS['depth-gradient'];
      var f = ctx.frameAt(ctx.zFar - 25);
      var geo = new ctx.THREE.PlaneGeometry(f.hw * 2.4, (f.yTop - f.yBot) * 2.4, 1, 1);
      var mat = new ctx.THREE.MeshBasicNodeMaterial();
      mat.depthWrite = false;
      mat.depthTest = false;
      mat.colorNode = def.colorNode();
      bgShaderMesh = new ctx.THREE.Mesh(geo, mat);
      bgShaderMesh.position.set(0, (f.yTop + f.yBot) / 2, ctx.zFar - 25);
      bgShaderMesh.renderOrder = -10;
      ctx.scene.add(bgShaderMesh);
      if (onApplied) onApplied();
    }
  }

  // Тот же приём cover, что раньше был в realistic-tank.html: обрезаем
  // картинку/видео по краю, а не растягиваем — годится и для сплюснутого
  // портретного экрана телефона, и для широкого телевизора.
  function fitBackground() {
    var tex = ctx.scene.background;
    if (!tex || !tex.isTexture) return;
    var iw = tex.image && (tex.image.videoWidth || tex.image.width);
    var ih = tex.image && (tex.image.videoHeight || tex.image.height);
    if (!iw || !ih) return;
    var screenAspect = innerWidth / innerHeight;
    var imageAspect = iw / ih;
    if (screenAspect > imageAspect) {
      var ry = imageAspect / screenAspect;
      tex.repeat.set(1, ry); tex.offset.set(0, (1 - ry) / 2);
    } else {
      var rx = screenAspect / imageAspect;
      tex.repeat.set(rx, 1); tex.offset.set((1 - rx) / 2, 0);
    }
  }

  function update(dt, t) {
    // uTime уже общий (ctx.uTime.value обновляет сама сцена), плюс лёгкое
    // покачивание группы лучей — целиком считать в шейдере смысла нет,
    // их всего четыре. Если лучи или риф скрыты — пропускаем цикл для экономии CPU.
    if (godRayGroup && godRayGroup.visible) {
      for (var i = 0; i < godRayGroup.children.length; i++) {
        godRayGroup.children[i].rotation.z += Math.sin(t * 0.1 + i) * dt * 0.02;
      }
    }
    if (anemoneTentacles && anemoneTentacles.length && (!reefGroup || reefGroup.visible)) {
      for (var j = 0; j < anemoneTentacles.length; j++) {
        var ten = anemoneTentacles[j];
        ten.mesh.rotation.z = ten.baseRotZ + Math.sin(t * 1.5 + ten.phase) * 0.07;
        ten.mesh.rotation.x = ten.baseRotX + Math.cos(t * 1.2 + ten.phase) * 0.07;
      }
    }
  }

  function onResize() { fitBackground(); }

  window.OceanFX = {
    init: init,
    setBackground: setBackground,
    update: update,
    onResize: onResize,
    setDecorVisible: setDecorVisible,
    getDecorState: getDecorState,
    _debug: function () {
      return {
        bubblePoints: bubblePoints,
        weedMesh: weedMesh,
        reefGroup: reefGroup,
        floorMesh: floorMesh,
        godRayGroup: godRayGroup,
        planktonPoints: planktonPoints,
        uCaustics: uCaustics
      };
    }
  };
})();
