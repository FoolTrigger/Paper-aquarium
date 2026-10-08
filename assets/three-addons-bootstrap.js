// assets/three-addons-bootstrap.js
// ------------------------------------------------------------
// Раньше vendor/GLTFLoader.js, DRACOLoader.js, SkeletonUtils.js,
// RoomEnvironment.js были самодостаточными UMD-скриптами под r128: каждый
// сам вешал себя на глобальный window.THREE (THREE.GLTFLoader = ...).
// Их актуальные версии из пакета three.js — обычные ES-модули с именованным
// экспортом (import { GLTFLoader } from '...'), без побочного эффекта на
// глобал. Чтобы не переписывать десятки мест в realistic-tank.html и
// fish-glb.js, где код по старой памяти ждёт THREE.GLTFLoader/
// THREE.SkeletonUtils.clone(...), здесь воспроизводится тот же побочный
// эффект вручную — единственная задача этого файла.
//
// Собраны esbuild'ом (--bundle --external:three) из examples/jsm пакета
// three@0.185 — так все транзитивные импорты (BufferGeometryUtils и т.п.)
// уже включены в сам файл, а сам three резолвится через общий import map
// на тот же модуль, что и three-bootstrap.js, — один и тот же граф модулей,
// без дублирования классов THREE.* (иначе `instanceof` начал бы врать).
//
// Грузить сразу после three-bootstrap.js, до всех классических скриптов.

import { GLTFLoader } from '/vendor/GLTFLoader.webgpu.js';
import { DRACOLoader } from '/vendor/DRACOLoader.webgpu.js';
import * as SkeletonUtilsNS from '/vendor/SkeletonUtils.webgpu.js';
import { RoomEnvironment } from '/vendor/RoomEnvironment.webgpu.js';

window.THREE.GLTFLoader = GLTFLoader;
window.THREE.DRACOLoader = DRACOLoader;
window.THREE.SkeletonUtils = SkeletonUtilsNS; // { clone, retarget, retargetClip }
window.THREE.RoomEnvironment = RoomEnvironment;
