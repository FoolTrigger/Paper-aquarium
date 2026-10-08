// Универсальный движок морских обитателей.
//
// Раньше в demos/realistic-tank.html был один класс Fish на всех: свободное
// плавание в объёме камеры годится для рыб, акул и дельфинов, но не годится
// для краба, который должен ходить по дну, и не годится для медузы, которая
// не «плывёт», а пульсирует и медленно тонет. Вместо того чтобы обрастить
// один update() десятком if (this.kind === …), сюда вынесен целый ярус
// движения — так же, как FishFrame отвечает только за ориентацию модели,
// не зная о сцене вовсе.
//
// Модуль НЕ хранит ссылку на сцену сам — она и так уже живёт в замыкании
// demos/realistic-tank.html, дублировать её тут означало бы одну и ту же
// правду в двух местах. Вместо этого вызывающий код один раз внедряет нужные
// зависимости через CreatureBehaviors.init(ctx), а дальше только:
//   var c = CreatureBehaviors.spawn(spec, built, fishes);
//   fishes.push(c);
//   …
//   CreatureBehaviors.updateAll(fishes, dt, t);
//
// spec.locomotion (из manifest.json / pack.json) выбирает ярус:
//   "pelagic" (по умолчанию) — рыбы, акулы, дельфины: свободное плавание
//                               в объёме камеры, стайное поведение, испуг
//                               перед хищником;
//   "bottom"                 — крабы, звёзды, скаты, камбала: движение
//                               вдоль пола, головой по курсу, без всплытия;
//   "drifter"                — медузы, кальмары: вертикальный дрейф вниз
//                               с периодическими импульсами вверх и пульсом
//                               тела через масштаб меша.
(function () {
  'use strict';

  var ctx = null;
  // ctx = {
  //   THREE, scene,
  //   foods,                 // живой массив { mesh, seed, sink, gone } — тот же, что в сцене
  //   limitsAt(z), frameAt(z),  // те же функции, что считают объём кадра
  //   floor, floorRoom, margin, zNear, zFar, beatsPerLength,
  //   eatNear(pos, maxCount) -> число съеденных гранул,
  //   now()                  // -> текущее время сцены (clock.elapsedTime)
  // }

  // Точка интереса от пальца/курсора — assets/touch-interaction.js двигает
  // её через setInterest()/clearInterest(), а PelagicSwimmer/Drifter читают
  // прямо из ctx каждый кадр в своём update(). Общее состояние в закрытом
  // объекте дешевле, чем гонять его отдельным параметром через updateAll().
  function init(context) {
    ctx = context;
    ctx.interest = { active: false, point: new context.THREE.Vector3(), radius: 6.5 };
  }

  // radius — необязательный, если не передан, действует прежний.
  function setInterest(point, radius) {
    if (!ctx) return;
    ctx.interest.active = true;
    ctx.interest.point.copy(point);
    if (radius != null) ctx.interest.radius = radius;
  }
  function clearInterest() { if (ctx) ctx.interest.active = false; }

  // ── общий предок ──────────────────────────────────────────────────────
  function Creature(spec, built) {
    this.kind = spec.name;
    this.spec = spec;
    this.mesh = built.group;
    this.mixer = built.mixer;
    this.beatHz = built.beatHz;
    this.phase = built.phase;
    this.len = spec.length || 2;
    this.radius = this.len * 0.5;
    // 'predator' пугает соседей, 'prey' ничего особого не делает сама —
    // реагирует на предиктора наравне с остальными, 'neutral' — по умолчанию.
    this.role = spec.role || 'neutral';
    this.petName = spec.petName || null;
    this.nameSprite = null;
    this._nameUntil = 0;
    // «Смелость» — у каждой рыбки своя, случайная. Влияет сразу на три вещи:
    // насколько далеко она замечает точку интереса пальца, насколько сильно
    // на неё реагирует, и как быстро отходит после испуга. Без этого трейта
    // весь косяк реагировал бы синхронно, как одна рыба, размноженная копией.
    this.boldness = 0.55 + Math.random() * 0.7;
    // Испуг: startleUntil — до какой секунды длится «рывок прочь», после
    // startleBoostMul перестаёт множить скорость. _flinch — короткая дрожь
    // тела сразу после толчка, гасится сама за десяток кадров.
    this.startleUntil = 0;
    this.startleBoostMul = 1;
    this._flinch = 0;
    // Поглаживание: _petUntil — до какой секунды длится довольная анимация.
    this._petUntil = 0;
    // Голод — общий для всех ярусов, хотя реагируют на еду по-разному.
    this.fullUntil = 0;
    this.noticeFood = 6 + Math.random() * 6;
    ctx.scene.add(this.mesh);
  }

  Creature.prototype.update = function (/* dt, t */) {};

  // Испуг переопределяется в каждом ярусе — рыба бросается прочь, краб
  // делает резкий скачок и замирает, медуза дёргается сжатием. Базовая
  // реализация — no-op, чтобы startleAll() можно было безопасно звать на
  // весь список, не проверяя тип объекта.
  //
  // fromPoint — откуда испугались (THREE.Vector3) или null для «отовсюду
  // сразу» (тряска телефона — направление роли не играет).
  // strength   — 0..~1.5, сила толчка (ближний тап сильнее дальнего).
  Creature.prototype.startle = function (/* fromPoint, strength, t */) {};

  // Довольная реакция на поглаживание — общая для всех ярусов: лёгкое
  // покачивание телом и всплеск сердечек. Сам «вилять» каждый ярус решает
  // в своём update() по _petUntil, здесь только заводим таймер и частицы.
  Creature.prototype.petHappy = function (t) {
    this._petUntil = t + 1.6;
    spawnHearts(this.mesh.position, this.radius);
  };

  Creature.prototype.dispose = function () {
    ctx.scene.remove(this.mesh);
    if (this.nameSprite) ctx.scene.remove(this.nameSprite);
  };

  // ── бейдж с именем ────────────────────────────────────────────────────
  // Canvas-текстура на спрайте: THREE.Sprite сам разворачивается к камере,
  // поэтому не нужно ничего вычислять руками. Заводим лениво — если рыбку
  // не назвали или никто на неё не наводился, спрайта просто не будет.
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function makeNameSprite(text) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var g = c.getContext('2d');
    g.font = '600 30px system-ui, -apple-system, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(6, 20, 32, 0.62)';
    roundRect(g, 6, 10, 244, 44, 14);
    g.fill();
    g.fillStyle = '#eaf6ff';
    // Длинные имена не ломают бейдж — просто ужимаются, честная раскраска
    // ребёнка может назвать рыбку как угодно.
    var text2 = text.length > 14 ? text.slice(0, 13) + '…' : text;
    g.fillText(text2, 128, 33);
    var tex = new ctx.THREE.CanvasTexture(c);
    // Раньше: if (ctx.THREE.sRGBEncoding) tex.encoding = ...  — в современном
    // three.js sRGBEncoding убран целиком, старая защитная проверка тихо
    // переставала бы что-либо делать (цвет бейджа стал бы чуть тусклее,
    // без единой ошибки в консоли). colorSpace — прямая замена.
    tex.colorSpace = ctx.THREE.SRGBColorSpace;
    var mat = new ctx.THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, depthWrite: false
    });
    var spr = new ctx.THREE.Sprite(mat);
    spr.scale.set(1.7, 0.42, 1);
    spr.renderOrder = 20;
    return spr;
  }

  // seconds — сколько подержать бейдж видимым; повторный вызов просто
  // продлевает срок, поэтому наведение мышью можно дёргать каждый кадр.
  Creature.prototype.showName = function (seconds) {
    if (!this.petName) return;
    if (!this.nameSprite) {
      this.nameSprite = makeNameSprite(this.petName);
      ctx.scene.add(this.nameSprite);
    }
    this.nameSprite.visible = true;
    this._nameUntil = ctx.now() + (seconds || 3);
  };

  Creature.prototype.updateNameBadge = function (t) {
    if (!this.nameSprite || !this.nameSprite.visible) return;
    this.nameSprite.position.copy(this.mesh.position);
    this.nameSprite.position.y += this.radius + 0.55;
    if (t > this._nameUntil) this.nameSprite.visible = false;
  };

  // ── сердечки от поглаживания ─────────────────────────────────────────
  // Маленький пул спрайтов с ❤ — от эмодзи не нужна ни одна текстура-файл,
  // canvas рисует символ сам. Пул фиксированного размера: поглаживаний за
  // раз бывает немного, гонять GC на каждое не нужно.
  var HEART_MAX = 24;
  var heartPool = null, heartCursor = 0;
  var _heartTex = null;

  function heartTexture() {
    if (_heartTex) return _heartTex;
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    g.font = '46px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('❤️', 32, 34);
    _heartTex = new ctx.THREE.CanvasTexture(c);
    return _heartTex;
  }

  function ensureHeartPool() {
    if (heartPool) return;
    heartPool = [];
    var tex = heartTexture();
    for (var i = 0; i < HEART_MAX; i++) {
      var mat = new ctx.THREE.SpriteMaterial({
        map: tex, transparent: true, depthTest: false, depthWrite: false, opacity: 0
      });
      var spr = new ctx.THREE.Sprite(mat);
      spr.visible = false;
      spr.renderOrder = 25;
      ctx.scene.add(spr);
      heartPool.push({ sprite: spr, mat: mat, vx: 0, vy: 0, born: 0, until: 0 });
    }
  }

  // Три сердечка чуть в стороны и вверх от рыбки — не одно скучное, но и не
  // фейерверк на весь экран.
  function spawnHearts(pos, radius) {
    ensureHeartPool();
    var t = ctx.now();
    for (var i = 0; i < 3; i++) {
      var h = heartPool[heartCursor];
      heartCursor = (heartCursor + 1) % HEART_MAX;
      h.sprite.position.copy(pos);
      h.sprite.position.x += (Math.random() - 0.5) * radius;
      h.sprite.position.y += radius * 0.6 + Math.random() * 0.3;
      var s = 0.35 + Math.random() * 0.2;
      h.sprite.scale.set(s, s, 1);
      h.sprite.visible = true;
      h.mat.opacity = 0.95;
      h.vx = (Math.random() - 0.5) * 0.3;
      h.vy = 0.5 + Math.random() * 0.3;
      h.born = t;
      h.until = t + 1.1 + Math.random() * 0.4;
    }
  }

  function updateHearts(dt, t) {
    if (!heartPool) return;
    for (var i = 0; i < heartPool.length; i++) {
      var h = heartPool[i];
      if (!h.sprite.visible) continue;
      if (t > h.until) { h.sprite.visible = false; continue; }
      h.sprite.position.x += h.vx * dt;
      h.sprite.position.y += h.vy * dt;
      var life = (h.until - t) / Math.max(0.01, h.until - h.born);
      h.mat.opacity = Math.max(0, Math.min(1, life)) * 0.95;
    }
  }

  // ── boids: разделение + сплочение + выравнивание ────────────────────────
  // Правила Рейнольдса, но только среди своего вида — иначе клоуны и ангелы
  // слипаются в один общий ком вместо двух разных косяков.
  var _sep = null, _cohSum = null, _align = null, _tmp = null;
  function boids(self, list, sepR, cohR, w) {
    if (!_sep) {
      _sep = new ctx.THREE.Vector3(); _cohSum = new ctx.THREE.Vector3();
      _align = new ctx.THREE.Vector3(); _tmp = new ctx.THREE.Vector3();
    }
    _sep.set(0, 0, 0); _cohSum.set(0, 0, 0); _align.set(0, 0, 0);
    var nCoh = 0, nAlign = 0;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === self || o.kind !== self.kind || !o.pos) continue;
      var d = self.pos.distanceTo(o.pos);
      if (d < sepR && d > 0.001) {
        _tmp.subVectors(self.pos, o.pos).divideScalar(d * d);
        _sep.add(_tmp);
      }
      if (d < cohR) {
        _cohSum.add(o.pos); nCoh++;
        if (o.vel) { _align.add(o.vel); nAlign++; }
      }
    }
    var out = new ctx.THREE.Vector3().addScaledVector(_sep, w.separation);
    if (nCoh) {
      _tmp.copy(_cohSum).divideScalar(nCoh).sub(self.pos);
      if (_tmp.lengthSq() > 0.01) out.addScaledVector(_tmp.normalize(), w.cohesion);
    }
    if (nAlign) {
      _tmp.copy(_align).divideScalar(nAlign);
      if (_tmp.lengthSq() > 0.01) out.addScaledVector(_tmp.normalize(), w.alignment);
    }
    return out;
  }

  // Хищник рядом разгоняет мелкоту резче обычного «не толкаться». Сам
  // хищник других хищников не пугается — крупная рыба не шарахается
  // от такой же крупной.
  var _pp = null;
  function predatorPush(self, list) {
    if (!_pp) _pp = new ctx.THREE.Vector3();
    var out = new ctx.THREE.Vector3();
    if (self.role === 'predator') return out;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === self || o.role !== 'predator' || !o.pos) continue;
      var d = self.pos.distanceTo(o.pos);
      var scareR = (o.radius + self.radius) * 2.4;
      if (d < scareR && d > 0.001) {
        _pp.subVectors(self.pos, o.pos).divideScalar(d * d);
        out.addScaledVector(_pp, 3.4);
      }
    }
    return out;
  }

  // ── испуг: общее для всех ярусов направление «прочь» ────────────────────
  // fromPoint = null означает «испугались отовсюду сразу» (тряска телефона,
  // а не палец в конкретной точке) — тогда направление просто случайное.
  var _sdir = null;
  function _startleDir(pos, fromPoint) {
    if (!_sdir) _sdir = new ctx.THREE.Vector3();
    if (fromPoint) {
      _sdir.subVectors(pos, fromPoint);
      if (_sdir.lengthSq() < 1e-6) _sdir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
    } else {
      _sdir.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5);
    }
    return _sdir.normalize();
  }

  // ── ярус 1: пелагические (рыбы, акулы, дельфины) ────────────────────────
  var _look = null, _acc = null, _dir = null;
  function PelagicSwimmer(spec, built, list) {
    Creature.call(this, spec, built);
    this.list = list;
    var z0 = ctx.zFar + Math.random() * (ctx.zNear - ctx.zFar);
    var l0 = ctx.limitsAt(z0);
    var inX = Math.max(0.5, l0.hw - ctx.margin);
    var inLo = l0.yBot + ctx.margin;
    var inHi = l0.yTop - ctx.margin;
    if (inHi <= inLo) inHi = inLo + 0.5;
    this.pos = new ctx.THREE.Vector3(
      (Math.random() * 2 - 1) * inX,
      inLo + Math.random() * (inHi - inLo),
      z0
    );
    this.vel = new ctx.THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5)
      .normalize().multiplyScalar(spec.speed || 1.4);
    this.speed = (spec.speed || 1.4) * (0.85 + Math.random() * 0.3);
  }
  PelagicSwimmer.prototype = Object.create(Creature.prototype);
  PelagicSwimmer.prototype.constructor = PelagicSwimmer;

  PelagicSwimmer.prototype.update = function (dt, t) {
    if (!_acc) { _acc = new ctx.THREE.Vector3(); _look = new ctx.THREE.Vector3(); _dir = new ctx.THREE.Vector3(); }
    var startled = t < this.startleUntil;

    _acc.set(
      Math.sin(t * 0.42 + this.phase) * 0.5,
      Math.sin(t * 0.3 + this.phase * 1.6) * 0.22,
      Math.cos(t * 0.37 + this.phase) * 0.5
    );

    if (this.spec.school) {
      _acc.add(boids(this, this.list, 1.2, 5, { separation: 1.6, cohesion: 0.7, alignment: 0.5 }));
    }
    _acc.add(predatorPush(this, this.list));

    // Пока рыба удирает от испуга, ей не до еды и не до пальца — это
    // единственная причина, по которой она может проигнорировать точку
    // интереса или гранулу прямо у носа: только что напугалась.
    if (!startled && ctx.foods.length && t > this.fullUntil) {
      var best = -1, bestD = 1e9;
      for (var fi = 0; fi < ctx.foods.length; fi++) {
        var fd = this.pos.distanceTo(ctx.foods[fi].mesh.position);
        if (fd < bestD) { bestD = fd; best = fi; }
      }
      if (best >= 0 && bestD < this.noticeFood) {
        if (bestD < ctx.eatReach) {
          var got = ctx.eatNear(this.pos, 1 + Math.floor(Math.random() * 3));
          if (got) this.fullUntil = t + 2.5 + Math.random() * 8;
        } else {
          _dir.copy(ctx.foods[best].mesh.position).sub(this.pos).normalize();
          _acc.addScaledVector(_dir, bestD < 6 ? 4.5 : 2.2);
        }
      }
    }

    // Точка интереса пальца — тянет только тех, кто рядом, и тянет тем
    // слабее, чем ближе к краю радиуса. boldness растягивает и радиус,
    // и силу: смелая рыба замечает палец издалека и подплывает решительно,
    // пугливая — только вплотную и неохотно. Это и даёт «не всем скопом»
    // без отдельного вероятностного гейта: расстояние плюс случайный трейт
    // уже сами по себе размазывают реакцию по времени.
    if (!startled && ctx.interest.active) {
      var effR = ctx.interest.radius * (0.7 + this.boldness * 0.5);
      var distI = this.pos.distanceTo(ctx.interest.point);
      if (distI < effR) {
        var pull = (1 - distI / effR) * this.boldness;
        _dir.copy(ctx.interest.point).sub(this.pos);
        if (_dir.lengthSq() > 0.0001) _acc.addScaledVector(_dir.normalize(), pull * 3.2);
      }
    }

    var M = ctx.margin, W = 6;
    if (this.pos.z > ctx.zNear - M) {
      var penZ = (this.pos.z - (ctx.zNear - M)) / M;
      _acc.z -= W * (1 + penZ * 4);
    }
    if (this.pos.z < ctx.zFar + M) {
      var penZfar = ((ctx.zFar + M) - this.pos.z) / M;
      _acc.z += W * (1 + penZfar * 4);
    }
    var lim = ctx.limitsAt(this.pos.z);
    if (this.pos.x > lim.hw - M) {
      var penX = (this.pos.x - (lim.hw - M)) / M;
      _acc.x -= W * (1 + penX * 3);
    }
    if (this.pos.x < -lim.hw + M) {
      var penXneg = ((-lim.hw + M) - this.pos.x) / M;
      _acc.x += W * (1 + penXneg * 3);
    }
    if (this.pos.y > lim.yTop - M) {
      var penY = (this.pos.y - (lim.yTop - M)) / M;
      _acc.y -= W * (1 + penY * 3);
    }
    if (this.pos.y < lim.yBot + M) {
      var penYbot = ((lim.yBot + M) - this.pos.y) / M;
      _acc.y += W * (1 + penYbot * 3);
    }
    var floor = ctx.floor + ctx.floorRoom;
    if (this.pos.y < floor) _acc.y += (floor - this.pos.y) * 6;

    this.vel.addScaledVector(_acc, dt * 2.0);
    var maxSp = this.speed * (startled ? this.startleBoostMul : 1);
    var sp = this.vel.length();
    if (sp > maxSp) this.vel.multiplyScalar(maxSp / sp);
    if (!startled && sp < this.speed * 0.35) this.vel.multiplyScalar(1.05);

    this.pos.addScaledVector(this.vel, dt);

    // Жесткие границы: рыба физически не может выйти за пределы аквариума
    // или приблизиться к объективу камеры ближе безопасной дистанции.
    if (this.pos.z > ctx.zNear) {
      this.pos.z = ctx.zNear;
      if (this.vel.z > 0) this.vel.z *= -0.4;
    } else if (this.pos.z < ctx.zFar) {
      this.pos.z = ctx.zFar;
      if (this.vel.z < 0) this.vel.z *= -0.4;
    }

    var hardLim = ctx.limitsAt(this.pos.z);
    if (this.pos.x > hardLim.hw) {
      this.pos.x = hardLim.hw;
      if (this.vel.x > 0) this.vel.x *= -0.4;
    } else if (this.pos.x < -hardLim.hw) {
      this.pos.x = -hardLim.hw;
      if (this.vel.x < 0) this.vel.x *= -0.4;
    }

    if (this.pos.y > hardLim.yTop) {
      this.pos.y = hardLim.yTop;
      if (this.vel.y > 0) this.vel.y *= -0.4;
    } else if (this.pos.y < hardLim.yBot) {
      this.pos.y = hardLim.yBot;
      if (this.vel.y < 0) this.vel.y *= -0.4;
    }

    this.mesh.position.copy(this.pos);
    this.mesh.lookAt(_look.copy(this.pos).add(this.vel));
    var wiggle = Math.sin(t * 2.5 + this.phase) * 0.015;
    // Дрожь сразу после испуга — быстрая и резкая, гаснет за десяток
    // кадров; довольное покачивание после поглаживания — медленнее и мягче,
    // держится дольше. Разная частота и амплитуда не дают их спутать.
    if (this._flinch > 0.01) { wiggle += Math.sin(t * 40) * 0.25 * this._flinch; this._flinch *= 0.88; }
    else this._flinch = 0;
    if (t < this._petUntil) wiggle += Math.sin(t * 6 + this.phase) * 0.08;
    this.mesh.rotation.z += wiggle;

    if (this.mixer) {
      var scale;
      if (this.beatHz) {
        var want = ctx.beatsPerLength * this.vel.length() / this.len;
        scale = want / this.beatHz;
      } else {
        scale = 0.6 + this.vel.length() / this.speed * 0.6;
      }
      this.mixer.update(dt * Math.max(0.25, Math.min(2, scale)));
    }
    this.updateNameBadge(t);
  };

  PelagicSwimmer.prototype.startle = function (fromPoint, strength, t) {
    var dir = _startleDir(this.pos, fromPoint);
    // Смелая рыба пугается слабее и отходит быстрее — тот же boldness,
    // что решает, кто первым подплывёт к пальцу, решает и кто первым
    // успокоится после толчка.
    var kick = 3.4 * strength * (1.15 - this.boldness * 0.3);
    this.vel.addScaledVector(dir, kick);
    this.startleUntil = t + (0.45 + Math.random() * 0.35) * (1.25 - this.boldness * 0.3);
    this.startleBoostMul = 1.6 + strength * 0.5;
    this._flinch = 1;
  };

  // ── ярус 2: донные (крабы, морские звёзды, скаты, камбала) ──────────────
  // Живут вплотную к полу: своя высота над ним, курс держат в плоскости XZ
  // и меняют его не каждый кадр, а раз в несколько секунд — иначе краб
  // дрожит на месте вместо того, чтобы куда-то идти.
  function BottomCrawler(spec, built, list) {
    Creature.call(this, spec, built);
    this.list = list;
    // gait: 'scuttle' — идёт рывками с паузами (краб, звезда),
    //       'glide'   — скользит непрерывно, слегка виляя краем тела (скат, камбала)
    this.gait = spec.gait || 'scuttle';
    this.hover = spec.hoverHeight != null ? spec.hoverHeight : 0.12;
    this.speed = (spec.speed || 0.7) * (0.8 + Math.random() * 0.4);
    this.heading = Math.random() * Math.PI * 2;
    this.headingTarget = this.heading;
    this.nextTurn = Math.random() * 4;
    this.pauseUntil = 0;

    var f0 = ctx.frameAt(0);
    var inX = Math.max(0.5, f0.hw - ctx.margin * 1.5);
    this.pos = new ctx.THREE.Vector3(
      (Math.random() * 2 - 1) * inX,
      ctx.floor + this.hover,
      ctx.zFar + Math.random() * (ctx.zNear - ctx.zFar)
    );
    this.vel = new ctx.THREE.Vector3();
  }
  BottomCrawler.prototype = Object.create(Creature.prototype);
  BottomCrawler.prototype.constructor = BottomCrawler;

  BottomCrawler.prototype.update = function (dt, t) {
    // Курс меняем не мгновенно — плавный поворот выглядит как «выбрал
    // направление», а не как рыскание.
    this.nextTurn -= dt;
    if (this.nextTurn <= 0) {
      this.headingTarget = this.heading + (Math.random() - 0.5) * 2.4;
      this.nextTurn = 2.5 + Math.random() * 4;
      if (this.gait === 'scuttle' && Math.random() < 0.4) {
        this.pauseUntil = t + 0.6 + Math.random() * 1.6;
      }
    }
    var dh = this.headingTarget - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += dh * Math.min(1, dt * 1.4);

    var moving = t > this.pauseUntil;
    var startleMul = t < this.startleUntil ? this.startleBoostMul : 1;
    var sp = moving ? this.speed * startleMul : 0;
    // Рывками — краб буквально идёт короткими всплесками, а не плавно.
    // Во время испуга рывки не нужны — это как раз один сплошной бросок.
    if (this.gait === 'scuttle' && moving && startleMul === 1) {
      sp *= 0.55 + 0.45 * Math.max(0, Math.sin(t * 6 + this.phase));
    }

    this.vel.set(Math.sin(this.heading) * sp, 0, Math.cos(this.heading) * sp);

    // Границы — по кадру на глубине пола, без верхней/нижней стенки:
    // донный житель не всплывает, поэтому Y не участвует в отталкивании.
    var lim = ctx.frameAt(this.pos.z);
    var M = ctx.margin;
    if (this.pos.x > lim.hw - M) this.heading += Math.PI * 0.5 * dt * 3;
    if (this.pos.x < -lim.hw + M) this.heading -= Math.PI * 0.5 * dt * 3;
    if (this.pos.z > ctx.zNear - M) this.headingTarget = Math.PI;
    this.pos.addScaledVector(this.vel, dt);
    this.pos.y = ctx.floor + this.hover;

    if (this.pos.z > ctx.zNear) { this.pos.z = ctx.zNear; this.headingTarget = Math.PI; }
    else if (this.pos.z < ctx.zFar) { this.pos.z = ctx.zFar; this.headingTarget = 0; }
    var hardLim = ctx.frameAt(this.pos.z);
    if (this.pos.x > hardLim.hw) { this.pos.x = hardLim.hw; this.headingTarget = -Math.PI / 2; }
    else if (this.pos.x < -hardLim.hw) { this.pos.x = -hardLim.hw; this.headingTarget = Math.PI / 2; }

    this.mesh.position.copy(this.pos);
    if (!_look) _look = new ctx.THREE.Vector3();
    // lookAt только по курсу (yaw) — донный житель не задирает нос и не
    // клюёт носом в грунт, он весь плоский и идёт горизонтально.
    _look.set(this.pos.x + this.vel.x, this.pos.y, this.pos.z + this.vel.z);
    if (this.vel.lengthSq() > 0.0001) this.mesh.lookAt(_look);

    // Реагирует на корм только когда тот уже осел у дна — краб не смотрит
    // вверх и не поплывёт за гранулой, которая ещё тонет над ним.
    if (ctx.foods.length && t > this.fullUntil) {
      var best = -1, bestD = 1e9;
      for (var fi = 0; fi < ctx.foods.length; fi++) {
        var fm = ctx.foods[fi].mesh;
        if (fm.position.y > ctx.floor + ctx.floorRoom + 0.6) continue;
        var fd = this.pos.distanceTo(fm.position);
        if (fd < bestD) { bestD = fd; best = fi; }
      }
      if (best >= 0 && bestD < 5) {
        if (bestD < ctx.eatReach + 0.3) {
          var got = ctx.eatNear(this.pos, 1);
          if (got) this.fullUntil = t + 3 + Math.random() * 6;
        } else {
          var dx = ctx.foods[best].mesh.position.x - this.pos.x;
          var dz = ctx.foods[best].mesh.position.z - this.pos.z;
          this.headingTarget = Math.atan2(dx, dz);
          this.nextTurn = Math.max(this.nextTurn, 1);
        }
      }
    }

    if (this.mixer) this.mixer.update(dt * (moving ? 1 : 0.3));
    this.updateNameBadge(t);
  };

  BottomCrawler.prototype.startle = function (fromPoint, strength, t) {
    // Краб не «плывёт прочь» плавно — он мгновенно разворачивается носом
    // от опасности и делает короткий резкий бросок, а не разгоняется как
    // рыба. Курс меняем сразу (heading = headingTarget), а не через обычный
    // плавный доворот update() — испуг есть испуг, тут не до приличий.
    if (fromPoint) {
      var dx = this.pos.x - fromPoint.x, dz = this.pos.z - fromPoint.z;
      this.headingTarget = Math.atan2(dx, dz);
    } else {
      this.headingTarget = Math.random() * Math.PI * 2;
    }
    this.heading = this.headingTarget;
    this.nextTurn = 0.4 + Math.random() * 0.4;   // короткий бросок, потом снова осторожно
    this.pauseUntil = 0;                          // точно не стоим на паузе прямо сейчас
    this.startleUntil = t + 0.5 + strength * 0.2;
    this.startleBoostMul = 2.2 + strength * 0.6;
  };

  // ── ярус 3: пульсирующие/планктонные (медузы, кальмары) ─────────────────
  // Пульс тела делаем через масштаб группы — без правки spawnFromModel
  // и без отдельного шейдера: сжатие купола примерно так и выглядит,
  // а интеграция остаётся в одну строку на стороне сцены.
  function Drifter(spec, built, list) {
    Creature.call(this, spec, built);
    this.list = list;
    this.pulseHz = spec.pulseHz || 0.55;
    this.thrustEvery = 3 + Math.random() * 2.5;
    this.nextThrust = Math.random() * this.thrustEvery;
    this.sinkSpeed = spec.sinkSpeed != null ? spec.sinkSpeed : 0.12;
    this.driftSpeed = (spec.speed || 0.35) * (0.7 + Math.random() * 0.5);

    var z0 = ctx.zFar + Math.random() * (ctx.zNear - ctx.zFar);
    var l0 = ctx.limitsAt(z0);
    var inLo = l0.yBot + ctx.margin;
    var inHi = l0.yTop - ctx.margin;
    if (inHi <= inLo) inHi = inLo + 0.5;
    this.pos = new ctx.THREE.Vector3(
      (Math.random() * 2 - 1) * Math.max(0.5, l0.hw - ctx.margin),
      inLo + Math.random() * (inHi - inLo),
      z0
    );
    this.vel = new ctx.THREE.Vector3(
      (Math.random() - 0.5) * this.driftSpeed, -this.sinkSpeed, (Math.random() - 0.5) * this.driftSpeed
    );
    this._baseScale = null;
  }
  Drifter.prototype = Object.create(Creature.prototype);
  Drifter.prototype.constructor = Drifter;

  Drifter.prototype.update = function (dt, t) {
    if (!this._baseScale) this._baseScale = this.mesh.scale.clone();
    var startled = t < this.startleUntil;

    // Медленный горизонтальный дрейф со сменой направления — течением
    // сносит, а не «плывёт к цели».
    this.vel.x += Math.sin(t * 0.15 + this.phase) * dt * 0.2;
    this.vel.z += Math.cos(t * 0.13 + this.phase) * dt * 0.2;

    // Импульс вверх — как настоящая медуза: долгий снос вниз, короткий
    // рывок вверх, и снова тонет.
    this.nextThrust -= dt;
    if (this.nextThrust <= 0) {
      this.vel.y = 0.9 + Math.random() * 0.4;
      this.nextThrust = this.thrustEvery * (0.7 + Math.random() * 0.6);
    } else {
      // гасим импульс до спокойного тонущего дрейфа
      this.vel.y += (-this.sinkSpeed - this.vel.y) * Math.min(1, dt * 1.5);
    }

    var lim = ctx.limitsAt(this.pos.z);
    var M = ctx.margin;
    if (this.pos.x > lim.hw - M) this.vel.x -= 0.4;
    if (this.pos.x < -lim.hw + M) this.vel.x += 0.4;
    if (this.pos.z > ctx.zNear - M) this.vel.z -= 0.4;
    if (this.pos.z < ctx.zFar + M) this.vel.z += 0.4;
    var floor = ctx.floor + ctx.floorRoom;
    if (this.pos.y < floor) { this.pos.y = floor; this.vel.y = Math.abs(this.vel.y) * 0.4 + 0.3; }
    if (this.pos.y > lim.yTop - M) { this.pos.y = lim.yTop - M; this.vel.y = -0.1; }

    // Слабое пассивное притяжение к близкому корму — медуза не охотится,
    // но проплывающую мимо гранулу может обволочь.
    if (!startled && ctx.foods.length && t > this.fullUntil) {
      var best = -1, bestD = 1e9;
      for (var fi = 0; fi < ctx.foods.length; fi++) {
        var fd = this.pos.distanceTo(ctx.foods[fi].mesh.position);
        if (fd < bestD) { bestD = fd; best = fi; }
      }
      if (best >= 0 && bestD < 2.2) {
        if (bestD < ctx.eatReach + 0.4) {
          var got = ctx.eatNear(this.pos, 1);
          if (got) this.fullUntil = t + 4 + Math.random() * 6;
        } else {
          this.vel.x += (ctx.foods[best].mesh.position.x - this.pos.x) * dt * 0.3;
          this.vel.z += (ctx.foods[best].mesh.position.z - this.pos.z) * dt * 0.3;
        }
      }
    }

    // Палец рядом — тоже просто снос, не осознанное плавание: медуза не
    // «решает» подплыть, её едва заметно тянет туда, куда и корм.
    if (!startled && ctx.interest.active) {
      var distI = this.pos.distanceTo(ctx.interest.point);
      var effR = ctx.interest.radius * 0.75 * (0.7 + this.boldness * 0.5);
      if (distI < effR) {
        this.vel.x += (ctx.interest.point.x - this.pos.x) * dt * 0.18 * this.boldness;
        this.vel.z += (ctx.interest.point.z - this.pos.z) * dt * 0.18 * this.boldness;
      }
    }

    this.pos.addScaledVector(this.vel, dt * 0.6);

    if (this.pos.z > ctx.zNear) { this.pos.z = ctx.zNear; this.vel.z = -Math.abs(this.vel.z) * 0.5; }
    else if (this.pos.z < ctx.zFar) { this.pos.z = ctx.zFar; this.vel.z = Math.abs(this.vel.z) * 0.5; }
    var hardLim = ctx.limitsAt(this.pos.z);
    if (this.pos.x > hardLim.hw) { this.pos.x = hardLim.hw; this.vel.x = -Math.abs(this.vel.x) * 0.5; }
    else if (this.pos.x < -hardLim.hw) { this.pos.x = -hardLim.hw; this.vel.x = Math.abs(this.vel.x) * 0.5; }
    if (this.pos.y > hardLim.yTop) { this.pos.y = hardLim.yTop; this.vel.y = -0.1; }
    else if (this.pos.y < hardLim.yBot) { this.pos.y = hardLim.yBot; this.vel.y = Math.abs(this.vel.y) * 0.4 + 0.3; }

    this.mesh.position.copy(this.pos);
    // Пульс купола: сжатие по высоте и раскрытие в стороны в противофазе —
    // на глаз читается как «вдох-выдох», а не просто общее «дыхание» меша.
    // Во время испуга — резче и чаще, будто судорожно сжимается от толчка.
    var pulseHz = startled ? this.pulseHz * 2.6 : this.pulseHz;
    var pulseAmp = startled ? 0.26 : 0.14;
    var pulse = Math.sin(t * pulseHz * Math.PI * 2 + this.phase);
    var squash = 1 + pulse * pulseAmp;
    var bulge = 1 - pulse * pulseAmp * 0.6;
    this.mesh.scale.set(this._baseScale.x * bulge, this._baseScale.y * squash, this._baseScale.z * bulge);
    // Медленное вращение вокруг своей оси — придаёт «плавучести», без
    // ориентации по направлению движения, которого у медузы фактически нет.
    this.mesh.rotation.y += dt * 0.15;

    if (this.mixer) this.mixer.update(dt * 0.4);
    this.updateNameBadge(t);
  };

  Drifter.prototype.startle = function (fromPoint, strength, t) {
    var dir = _startleDir(this.pos, fromPoint);
    // Медуза не может рвануть, как рыба, — только puff-толчок и резкая
    // судорога купола (частоту/амплитуду пульса меняет update() по
    // startleUntil). nextThrust=0 заодно сразу вызывает обычный «взмах
    // вверх» на следующем кадре — так испуг ещё и естественно встряхивает
    // траекторию, без отдельной ветки для вертикали.
    this.vel.addScaledVector(dir, 1.5 * strength);
    this.nextThrust = 0;
    this.startleUntil = t + 0.7 + strength * 0.3;
  };

  // ── диспетчер ─────────────────────────────────────────────────────────
  function spawn(spec, built, list) {
    var layer = spec.locomotion || 'pelagic';
    if (layer === 'bottom') return new BottomCrawler(spec, built, list);
    if (layer === 'drifter') return new Drifter(spec, built, list);
    return new PelagicSwimmer(spec, built, list);
  }

  function updateAll(list, dt, t) {
    for (var i = 0; i < list.length; i++) list[i].update(dt, t);
    updateHearts(dt, t);
  }

  // ── имя по клику/наведению ───────────────────────────────────────────
  // Полноценный raycast по мешу дорог на 40 моделях сразу — а нам достаточно
  // проверить расстояние от луча взгляда до центра каждой рыбки: бейдж
  // и так весь размером с рыбку, точность до полигона тут не нужна.
  function attachNaming(renderer, camera, getList) {
    var raycaster = new ctx.THREE.Raycaster();
    var ndc = new ctx.THREE.Vector2();
    var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    var lastHover = 0;

    function pick(clientX, clientY) {
      var rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      var list = getList();
      var best = null, bestD = Infinity;
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (!c.petName || !c.pos) continue;
        var d = raycaster.ray.distanceToPoint(c.pos);
        if (d < c.radius + 0.5 && d < bestD) { bestD = d; best = c; }
      }
      return best;
    }

    renderer.domElement.addEventListener('pointerdown', function (e) {
      var c = pick(e.clientX, e.clientY);
      if (c) c.showName(3.5);
    });

    if (canHover) {
      renderer.domElement.addEventListener('pointermove', function (e) {
        var now = performance.now();
        if (now - lastHover < 120) return;
        lastHover = now;
        var c = pick(e.clientX, e.clientY);
        if (c) c.showName(1.2);
      });
    }
  }

  window.CreatureBehaviors = {
    init: init,
    spawn: spawn,
    updateAll: updateAll,
    attachNaming: attachNaming,
    // точка интереса пальца/курсора — двигает assets/touch-interaction.js
    setInterest: setInterest,
    clearInterest: clearInterest,
    // экспортируем классы — пригодится, если понадобится instanceof снаружи
    Creature: Creature,
    PelagicSwimmer: PelagicSwimmer,
    BottomCrawler: BottomCrawler,
    Drifter: Drifter
  };
})();
