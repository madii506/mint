// MINT world: one endless field of light, the market as a landscape (peaks in mint, valleys in red).
// The intro glides over it, accelerates, and throws you into the site; the same field then lives behind every section,
// moving as you scroll. No text, no logo.
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer } from './vendor/EffectComposer.js';
import { RenderPass } from './vendor/RenderPass.js';
import { UnrealBloomPass } from './vendor/UnrealBloomPass.js';
import { OutputPass } from './vendor/OutputPass.js';

export const END = 6.2, REVEAL = 4.6;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export function createWorld(canvas, opts = {}) {
  const intro = opts.intro !== false, small = Math.min(innerWidth, innerHeight) < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
  const dpr = Math.min(window.devicePixelRatio || 1, opts.dpr || (small ? 1.5 : 1.6)); renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#040607');
  const cam = new THREE.PerspectiveCamera(58, 1, .1, 500);
  const D = 170, W = 170;

  // the field: a grid that wraps forever as you travel over it
  const GX = small ? 150 : 230, GZ = small ? 110 : 150, N = GX * GZ, pos = new Float32Array(N * 3), rnd = new Float32Array(N);
  let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < N; i++) { const gx = i % GX, gz = Math.floor(i / GX); pos[i * 3] = (gx / (GX - 1) - .5) * W + (r() - .5) * .3; pos[i * 3 + 2] = -(gz / (GZ - 1)) * D; rnd[i] = r(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
  const uni = { t: { value: 0 }, travel: { value: 0 }, fade: { value: 0 }, dim: { value: 1 }, amp: { value: 1 }, bias: { value: 0 }, px: { value: dpr }, D: { value: D } };
  const mat = new THREE.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float t, travel, fade, dim, amp, bias, px, D; attribute float rnd; varying vec3 vC; varying float vA;
      float h(vec2 p){ return sin(p.x*.09+t*.5)*2.4 + sin(p.y*.06)*2.8 + sin((p.x+p.y)*.045+t*.3)*1.9 + sin(p.x*.27-p.y*.21)*.7; }
      void main(){ float z = mod(position.z + travel, D) - D + 26.; vec2 q = vec2(position.x, z - travel);
        float y = h(q) * amp, dy = h(q + vec2(0., -1.4)) * amp - y; vec3 p = vec3(position.x, y, z);
        vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.2 + rnd * 1.4) * px * (58. / max(2., -mv.z));
        vec3 up = vec3(.24, .95, .66), dn = vec3(1., .36, .38);
        vC = mix(dn, up, smoothstep(-.9 - bias, .25 - bias, dy)) * (.38 + .5 * smoothstep(-4., 5., y));
        vA = .58 * fade * dim * smoothstep(-D + 26., -D + 80., z) * (1. - smoothstep(14., 26., z)); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(vC, vA * smoothstep(.5, 0., d)); }` });
  scene.add(new THREE.Points(geo, mat));

  // dust in the air: it is what makes the speed felt
  const M = small ? 700 : 1400, dpos = new Float32Array(M * 3), drnd = new Float32Array(M);
  for (let i = 0; i < M; i++) { dpos[i * 3] = (r() - .5) * 90; dpos[i * 3 + 1] = 1 + r() * 26; dpos[i * 3 + 2] = -r() * D; drnd[i] = r(); }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3)); dgeo.setAttribute('rnd', new THREE.BufferAttribute(drnd, 1));
  const dmat = new THREE.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float travel, fade, dim, px, D; attribute float rnd; varying float vA;
      void main(){ float z = mod(position.z + travel * (1.2 + rnd * .6), D) - D + 26.; vec4 mv = modelViewMatrix * vec4(position.x, position.y, z, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = (1. + rnd * 2.) * px * (40. / max(2., -mv.z)); vA = .5 * fade * dim * smoothstep(-D + 26., -D + 70., z) * (1. - smoothstep(16., 26., z)); }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(.75, 1., .9, vA * smoothstep(.5, 0., d)); }` });
  scene.add(new THREE.Points(dgeo, dmat));

  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, cam)); const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .75, .45, .3); composer.addPass(bloom); composer.addPass(new OutputPass());
  function size() { const w = canvas.clientWidth || innerWidth, hh = canvas.clientHeight || innerHeight; renderer.setSize(w, hh, false); composer.setSize(w, hh); bloom.resolution.set(w * dpr / 2, hh * dpr / 2); cam.aspect = w / hh; cam.updateProjectionMatrix(); }
  size(); addEventListener('resize', size);

  // speed over the intro: a glide, a rush, then a settle into the site
  const warp = t => sm(2.4, 4.0, t) * (1 - sm(4.4, 5.6, t)), speed = t => 7 * (1 - sm(4.6, END, t)) + 120 * warp(t) + 1.4 * sm(4.6, END, t);
  let tableT = -1, tableV = 0; const travelAt = t => { let v = 0; for (let x = 0; x < t; x += 1 / 60) v += speed(x) / 60; return v; };
  const look = new THREE.Vector3(); let scrollY = 0, sy = 0, pxT = 0, pyT = 0, pxS = 0, pyS = 0, bias = 0, base = 0;
  const portrait = () => innerWidth < innerHeight;
  // the same height field on the CPU, so the low glide never dips under a hill
  const hgt = (x, y, t) => Math.sin(x * .09 + t * .5) * 2.4 + Math.sin(y * .06) * 2.8 + Math.sin((x + y) * .045 + t * .3) * 1.9 + Math.sin(x * .27 - y * .21) * .7; let ground = 4;
  function pose(t, dt) { uni.t.value = t;
    const w = warp(t), settle = intro ? sm(4.5, 5.9, t) : 1, ti = Math.min(t, END);
    if (tableT !== ti) { tableV = travelAt(ti); tableT = ti; }
    sy += (scrollY - sy) * Math.min(1, dt * 4); pxS += (pxT - pxS) * Math.min(1, dt * 2); pyS += (pyT - pyS) * Math.min(1, dt * 2);
    base += t > END || !intro ? dt * 1.4 : 0;
    uni.travel.value = (intro ? tableV : 0) + base + sy * .045;
    uni.fade.value = intro ? sm(0, 1.1, t) : Math.min(1, uni.fade.value + dt * 1.2);
    const deep = clamp(sy / (innerHeight * 1.2));
    uni.dim.value = lerp(1, lerp(1.6, .9, deep), settle); uni.amp.value = lerp(1, 1.25, deep) ; uni.bias.value += (bias - uni.bias.value) * Math.min(1, dt);
    const tr = uni.travel.value, cx = Math.sin(t * .3) * 3; let gmax = -9; for (const z of [4, 10, 16, 22]) gmax = Math.max(gmax, hgt(cx, z - tr, t) * uni.amp.value); ground += (gmax - ground) * Math.min(1, dt * 3); const lowY = Math.max(2.6, ground + 2.4) + Math.sin(t * .7) * .3, siteY = portrait() ? 13 : 11;
    cam.position.set(Math.sin(t * .3) * 3 * (1 - settle) + pxS * 3 * settle, lerp(lowY, siteY - deep * 3, settle) - pyS * 1.2 * settle, 30);
    cam.fov = lerp(58 + w * 34, portrait() ? 70 : 56, settle); cam.updateProjectionMatrix();
    look.set(Math.sin(t * .25) * 4 * (1 - settle) + pxS * 6 * settle, lerp(2.2, -2 - deep * 2, settle), -50);
    cam.up.set(Math.sin(t * .5) * .06 * (1 - settle) + w * Math.sin(t * 2.3) * .02, 1, 0).normalize(); cam.lookAt(look);
    bloom.strength = intro ? (.75 + w * .3) * (1 - sm(4.9, END, t)) : 0; }
  let t0 = null, last = null, raf = 0, dead = false, still = null, revealed = false, ended = false, jump = 0;
  function frame(now) { if (dead) return; raf = requestAnimationFrame(frame); if (t0 == null) { t0 = now; last = now; }
    const dt = Math.min(.05, (now - last) / 1000); last = now; const t = still != null ? still : (intro ? (now - t0) / 1000 + jump : END + (now - t0) / 1000);
    pose(t, still != null ? 1 : dt);
    if (bloom.strength > .01) composer.render(); else renderer.render(scene, cam);
    if (!revealed && (!intro || t >= REVEAL)) { revealed = true; opts.onReveal && opts.onReveal(); }
    if (!ended && (!intro || t >= END)) { ended = true; opts.onEnd && opts.onEnd(); } }
  raf = requestAnimationFrame(frame);
  return {
    still(t) { still = t; }, skip() { if (intro && t0 != null) { const now = performance.now(), t = (now - t0) / 1000 + jump; if (t < 4.5) jump += 4.5 - t; } },
    setScroll(y) { scrollY = y; }, setPointer(x, y) { pxT = x; pyT = y; }, setBias(b) { bias = clamp(b, -1, 1) * .5; },
    dispose() { dead = true; cancelAnimationFrame(raf); removeEventListener('resize', size); geo.dispose(); dgeo.dispose(); mat.dispose(); dmat.dispose(); renderer.dispose(); } };
}
