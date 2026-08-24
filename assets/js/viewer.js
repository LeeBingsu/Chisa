/* ═══════════════════════════════════════════
   CHISA · 千咲  —  MMD (PMX) 뷰어
   내 PC의 zip / pmx 를 브라우저에서 그대로 읽어 물리까지 돌린다.
   모델 파일은 저장소에 담지 않는다 (제작자가 재배포를 금지).
   ═══════════════════════════════════════════ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MMDLoader } from 'three/addons/loaders/MMDLoader.js';
import { MMDAnimationHelper } from 'three/addons/animation/MMDAnimationHelper.js';

const RES = 'chisazip/';                 // MMDLoader 가 텍스처 앞에 붙일 가상 경로
const q = (s, r = document) => r.querySelector(s);
const qa = (s, r = document) => [...r.querySelectorAll(s)];
const say = m => { const n = q('#vwMsg'); if (n) n.textContent = m; };

/* ══════════ 아주 작은 ZIP 리더 ══════════
   store(0) 와 deflate(8) 만 다룬다. 파일명은 UTF-8 플래그가 없으면 GBK 로 읽는다. */
async function readZip(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  const u16 = o => dv.getUint16(o, true), u32 = o => dv.getUint32(o, true);

  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (u32(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('ZIP 구조를 찾지 못했습니다');

  const count = u16(eocd + 10);
  let p = u32(eocd + 16);
  const out = [];

  for (let i = 0; i < count && u32(p) === 0x02014b50; i++) {
    const flag = u16(p + 8), method = u16(p + 10);
    const csize = u32(p + 20), nameLen = u16(p + 28);
    const extraLen = u16(p + 30), commentLen = u16(p + 32);
    const local = u32(p + 42);
    const raw = buf.subarray(p + 46, p + 46 + nameLen);

    let name;
    try {
      name = new TextDecoder(flag & 0x800 ? 'utf-8' : 'gbk', { fatal: true }).decode(raw);
    } catch { name = new TextDecoder('utf-8').decode(raw); }
    name = name.replace(/\\/g, '/');

    const dataAt = local + 30 + u16(local + 26) + u16(local + 28);
    const bytes = buf.subarray(dataAt, dataAt + csize);
    if (!name.endsWith('/')) out.push({ name, method, bytes });

    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function inflate(entry) {
  if (entry.method === 0) return entry.bytes;
  if (typeof DecompressionStream !== 'function') throw new Error('이 브라우저는 압축 해제를 지원하지 않습니다');
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([entry.bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/* ══════════ 가상 파일 시스템 ══════════ */
const VFS = new Map();           // 정규화 경로 → blob URL
const norm = s => s.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
const base = s => norm(s).split('/').pop();

function put(name, bytes) {
  const url = URL.createObjectURL(new Blob([bytes]));
  VFS.set(norm(name), url);
  if (!VFS.has('~' + base(name))) VFS.set('~' + base(name), url);   // 파일명만으로도 찾게
  return url;
}
function find(path) {
  const n = norm(path);
  return VFS.get(n) || VFS.get('~' + base(path)) || null;
}

/* ══════════ 씬 ══════════ */
let renderer, scene, camera, controls, clock, helper, stageGroup, key;
let mesh = null, physicsOn = true, spinOn = false, swayOn = false;
let ready = false;

function initScene() {
  if (ready) return;
  const canvas = q('#vwCanvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  camera.position.set(0, 12, 26);

  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  scene.add(new THREE.HemisphereLight(0xfff2f4, 0x3a1218, 1.1));

  key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(6, 22, 16); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xffe9ec, 1.1);
  fill.position.set(-14, 9, 12); scene.add(fill);

  const rim = new THREE.DirectionalLight(0xff5068, 2.4);
  rim.position.set(-9, 13, -15); scene.add(rim);

  // 바닥 · 링 · 그리드는 모델 크기에 맞춰 나중에 스케일한다
  stageGroup = new THREE.Group(); scene.add(stageGroup);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.9, 64).rotateX(-Math.PI / 2),
    new THREE.ShadowMaterial({ opacity: .45 })
  );
  ground.receiveShadow = true; stageGroup.add(ground);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(.94, .97, 128).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xe0243c, transparent: true, opacity: .4, side: THREE.DoubleSide })
  );
  ring.position.y = .004; stageGroup.add(ring);

  const grid = new THREE.PolarGridHelper(1.8, 8, 5, 64, 0x4a252c, 0x2a171b);
  grid.material.transparent = true; grid.material.opacity = .4;
  stageGroup.add(grid);

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .06;
  controls.target.set(0, 10, 0);
  controls.minDistance = 4; controls.maxDistance = 70;

  helper = new MMDAnimationHelper({ afterglow: 2.0, resetPhysicsOnLoop: true });
  clock = new THREE.Clock();
  ready = true;

  resize();
  addEventListener('resize', resize);
  renderer.setAnimationLoop(tick);
}

function resize() {
  const box = q('#vwStage');
  if (!box || !renderer) return;
  const w = box.clientWidth, h = box.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1); camera.updateProjectionMatrix();
}

let swayT = 0;
function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  if (mesh) {
    if (spinOn) mesh.rotation.y += dt * .45;
    if (swayOn) { swayT += dt; mesh.rotation.y = Math.sin(swayT * 1.7) * .55; }
    if (physicsOn) { try { helper.update(dt); } catch (e) { /* 물리 폭주 방지 */ } }
  }
  controls.update();
  renderer.render(scene, camera);
}

/* ══════════ 모델 적재 ══════════ */
const loadingManager = new THREE.LoadingManager();
loadingManager.setURLModifier(url => {
  if (!url.startsWith(RES)) return url;                 // toon data: URI 등은 그대로
  const hit = find(url.slice(RES.length));
  if (!hit) console.warn('텍스처 없음:', url.slice(RES.length));
  return hit || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
});

const mmd = new MMDLoader(loadingManager);
mmd.setResourcePath(RES);

function disposeCurrent() {
  if (!mesh) return;
  helper.remove(mesh);
  scene.remove(mesh);
  mesh.geometry.dispose();
  (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => {
    ['map', 'gradientMap', 'matcap', 'envMap'].forEach(k => m[k]?.dispose?.());
    m.dispose();
  });
  mesh = null;
}

function frameModel(obj) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const mid = box.getCenter(new THREE.Vector3());
  const dist = size.y * 1.5;

  if (stageGroup) stageGroup.scale.setScalar(size.y * .30);
  if (key) {
    key.position.set(size.y * .35, size.y * 1.3, size.y * .9);
    const c = key.shadow.camera;
    c.top = c.right = size.y * .8; c.bottom = c.left = -size.y * .8;
    c.near = .1; c.far = size.y * 4; c.updateProjectionMatrix();
  }

  controls.target.set(0, mid.y, 0);
  camera.position.set(dist * .25, mid.y + size.y * .18, dist);
  camera.near = Math.max(.05, dist / 400); camera.far = dist * 12;
  camera.updateProjectionMatrix();
  controls.minDistance = size.y * .25; controls.maxDistance = dist * 5;
  controls.update();
}

async function loadPMX(path) {
  initScene();
  if (!find(path)) return say('PMX 파일을 찾지 못했습니다.');
  // MMDLoader 는 URL 끝의 확장자로 포맷을 정한다. blob: 에는 확장자가 없으니
  // 가상 경로를 넘기고 LoadingManager 가 blob 으로 바꿔치기하게 한다.
  const url = RES + norm(path);

  say('모델을 읽는 중…');
  q('#vwStage').classList.add('is-busy');
  disposeCurrent();

  await new Promise(res => {
    mmd.load(url, obj => {
      mesh = obj;
      mesh.castShadow = true; mesh.receiveShadow = true;
      scene.add(mesh);
      frameModel(mesh);

      try {
        helper.add(mesh, { physics: physicsOn });
        say(`불러왔습니다 — 물리 ${physicsOn ? '켜짐' : '꺼짐'}`);
      } catch (e) {
        physicsOn = false;
        q('#vwPhysics')?.classList.remove('is-on');
        say('물리 엔진을 켜지 못해 정지 상태로 표시합니다: ' + e.message);
      }

      buildMaterialPanel();
      buildMorphPanel();
      q('#vwStage').classList.remove('is-busy');
      q('#vwPanels').hidden = false;
      res();
    }, p => {
      if (p.total) say(`모델을 읽는 중… ${Math.round(p.loaded / p.total * 100)}%`);
    }, err => {
      console.error(err);
      say('읽지 못했습니다: ' + (err?.message || err));
      q('#vwStage').classList.remove('is-busy');
      res();
    });
  });
}

/* ══════════ 재질(의상 파츠) 패널 ══════════ */
function buildMaterialPanel() {
  const wrap = q('#vwMats');
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

  const groups = new Map();
  mats.forEach((m, i) => {
    const name = m.name || `재질 ${i}`;
    const g = name.includes('_') ? name.split('_')[0] : '기타';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push({ i, name });
  });

  wrap.innerHTML = [...groups].map(([g, items]) => `
    <div class="vgroup">
      <div class="vgroup__h">
        <span>${g}</span>
        <button type="button" class="vmini" data-group="${g}" data-on="0">모두 끄기</button>
      </div>
      <div class="vgroup__b">
        ${items.map(it => `
          <label class="vchk"><input type="checkbox" data-mat="${it.i}" checked>
            <span>${it.name}</span></label>`).join('')}
      </div>
    </div>`).join('');

  wrap.onchange = e => {
    const c = e.target.closest('[data-mat]'); if (!c) return;
    mats[+c.dataset.mat].visible = c.checked;
  };
  wrap.onclick = e => {
    const b = e.target.closest('[data-group]'); if (!b) return;
    const on = b.dataset.on === '1';
    groups.get(b.dataset.group).forEach(({ i }) => {
      mats[i].visible = on;
      const c = wrap.querySelector(`[data-mat="${i}"]`); if (c) c.checked = on;
    });
    b.dataset.on = on ? '0' : '1';
    b.textContent = on ? '모두 끄기' : '모두 켜기';
  };
}

/* ══════════ 표정 모프 패널 ══════════ */
function buildMorphPanel() {
  const wrap = q('#vwMorphs');
  const dict = mesh.morphTargetDictionary || {};
  const names = Object.keys(dict);
  if (!names.length) { wrap.innerHTML = '<p class="vhint">이 모델에는 모프가 없습니다.</p>'; return; }

  const draw = filter => {
    const list = names.filter(n => !filter || n.toLowerCase().includes(filter)).slice(0, 120);
    q('#vwMorphList').innerHTML = list.map(n => `
      <label class="vslider">
        <span>${n}</span>
        <input type="range" min="0" max="1" step="0.05" value="${mesh.morphTargetInfluences[dict[n]] || 0}"
               data-morph="${dict[n]}">
      </label>`).join('') || '<p class="vhint">검색 결과가 없습니다.</p>';
  };

  wrap.innerHTML = `
    <div class="vrow">
      <input id="vwMorphFind" type="search" placeholder="모프 검색 — 笑い, まばたき …">
      <button type="button" class="vmini" id="vwMorphReset">초기화</button>
    </div>
    <div id="vwMorphList" class="vmorphs"></div>`;
  draw('');

  q('#vwMorphFind').oninput = e => draw(e.target.value.trim().toLowerCase());
  q('#vwMorphReset').onclick = () => {
    mesh.morphTargetInfluences.fill(0);
    qa('[data-morph]', wrap).forEach(r => { r.value = 0; });
  };
  wrap.addEventListener('input', e => {
    const r = e.target.closest('[data-morph]'); if (!r) return;
    mesh.morphTargetInfluences[+r.dataset.morph] = +r.value;
  });
}

/* ══════════ 파일 받기 ══════════ */
async function intake(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  initScene();
  say('압축을 푸는 중…');

  const pmx = [];
  for (const f of files) {
    if (/\.pmx$/i.test(f.name)) {
      put(f.name, new Uint8Array(await f.arrayBuffer()));
      pmx.push(f.name);
      continue;
    }
    if (!/\.zip$/i.test(f.name)) continue;
    let entries;
    try { entries = await readZip(f); }
    catch (e) { say(`${f.name}: ${e.message}`); continue; }

    for (const en of entries) {
      try {
        const bytes = await inflate(en);
        put(en.name, bytes);
        if (/\.pmx$/i.test(en.name)) pmx.push(en.name);
      } catch (e) { console.warn('건너뜀', en.name, e); }
    }
  }

  if (!pmx.length) return say('zip 안에서 .pmx 를 찾지 못했습니다.');

  const list = q('#vwModels');
  list.innerHTML = pmx.map((p, i) =>
    `<button type="button" class="vmodel${i === 0 ? ' is-on' : ''}" data-pmx="${p}">
       ${p.split('/').pop().replace(/\.pmx$/i, '')}</button>`).join('');
  list.onclick = e => {
    const b = e.target.closest('[data-pmx]'); if (!b) return;
    qa('.vmodel', list).forEach(x => x.classList.toggle('is-on', x === b));
    loadPMX(b.dataset.pmx);
  };
  q('#vwLoaded').hidden = false;
  say(`모델 ${pmx.length}개를 찾았습니다.`);
  await loadPMX(pmx[0]);
}

/* ══════════ UI 배선 ══════════ */
export function mountViewer() {
  const drop = q('#vwDrop'), input = q('#vwFile');
  if (!drop) return;

  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', e => intake(e.target.files));

  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => {
    e.preventDefault(); drop.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => {
    e.preventDefault(); drop.classList.remove('is-over');
  }));
  drop.addEventListener('drop', e => intake(e.dataTransfer.files));

  const toggle = (id, fn) => q(id)?.addEventListener('click', e => {
    const on = e.currentTarget.classList.toggle('is-on');
    fn(on);
  });

  toggle('#vwPhysics', on => {
    physicsOn = on;
    if (!mesh) return;
    helper.remove(mesh);
    try { helper.add(mesh, { physics: on }); say(`물리 ${on ? '켜짐' : '꺼짐'}`); }
    catch (err) { say('물리를 켜지 못했습니다: ' + err.message); }
  });
  toggle('#vwSpin', on => { spinOn = on; if (!on && mesh) mesh.rotation.y = 0; });
  toggle('#vwSway', on => { swayOn = on; if (!on && mesh) mesh.rotation.y = 0; });

  q('#vwShake')?.addEventListener('click', () => {
    if (!mesh) return;
    const start = performance.now();
    const spin = () => {
      const t = (performance.now() - start) / 1000;
      if (t > 1.1) { mesh.rotation.y = 0; return; }
      mesh.rotation.y = Math.sin(t * 11) * .85 * (1 - t / 1.1);
      requestAnimationFrame(spin);
    };
    spin();
  });

  q('#vwShot')?.addEventListener('click', () => {
    if (!renderer) return;
    renderer.render(scene, camera);
    renderer.domElement.toBlob(b => {
      const u = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = u; a.download = 'chisa_3d.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
      say('스크린샷을 저장했습니다.');
    }, 'image/png');
  });

  q('#vwReset')?.addEventListener('click', () => { if (mesh) frameModel(mesh); });
}

// 디버그 훅 (콘솔에서 상태 확인용)
window.__chisa = {
  get mesh() { return mesh; },
  get helper() { return helper; },
  get physics() { return physicsOn; },
  boneSum() {
    if (!mesh) return 0;
    let n = 0;
    for (const b of mesh.skeleton.bones) n += b.position.x + b.position.y + b.position.z;
    return n;
  }
};

mountViewer();
