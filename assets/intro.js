// MINT intro, no text: a price line runs down a street of candles, the camera rides it, rises, and the line folds into the M.
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer } from './vendor/EffectComposer.js';
import { RenderPass } from './vendor/RenderPass.js';
import { UnrealBloomPass } from './vendor/UnrealBloomPass.js';
import { OutputPass } from './vendor/OutputPass.js';

const G = new THREE.Color('#5cf2b8'), R = new THREE.Color('#ff6b6b'), W = new THREE.Color('#eef3f1');
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const END = 8.6;

export function createIntro(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
  const dpr = Math.min(window.devicePixelRatio || 1, opts.dpr || 1.75); renderer.setPixelRatio(dpr); renderer.setClearColor(0x05080a, 1);
  const scene = new THREE.Scene(), BGC = new THREE.Color('#030506'); scene.background = BGC; scene.fog = new THREE.Fog(BGC, 30, 150);
  const cam = new THREE.PerspectiveCamera(62, 1, .1, 600);

  // the street: a random walk of candles on both sides, green up, red down
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const N = 150, step = 1.6, candles = new THREE.Group(); scene.add(candles);
  const box = new THREE.BoxGeometry(1, 1, 1), wick = new THREE.BoxGeometry(.08, 1, .08);
  const mG = new THREE.MeshStandardMaterial({ color: G, emissive: G, emissiveIntensity: .35, roughness: .4 }), mR = new THREE.MeshStandardMaterial({ color: R, emissive: R, emissiveIntensity: .3, roughness: .4 });
  for (const side of [-1, 1]) { let p = 2.5; for (let i = 0; i < N; i++) { const o = p, c = clamp(p + (rnd() - .49) * 1.6, .5, 5.5), up = c >= o, lo = Math.min(o, c), hi = Math.max(o, c), body = Math.max(.25, hi - lo);
      const z = -i * step, x = side * (7 + rnd() * 1.5), m = new THREE.Mesh(box, up ? mG : mR); m.scale.set(.9, body, .9); m.position.set(x, lo + body / 2, z); m.userData = { y: m.position.y, h: body, d: i }; candles.add(m);
      const wk = new THREE.Mesh(wick, up ? mG : mR), wl = body + .6 + rnd() * 1.2; wk.scale.y = wl; wk.position.set(x, lo + body / 2, z); wk.userData = { y: wk.position.y, h: wl, d: i }; candles.add(wk); p = c; } }
  // the floor: a fading grid
  const grid = new THREE.GridHelper(400, 160, 0x0f2a22, 0x0a1714); grid.position.set(0, 0, -120); grid.material.transparent = true; grid.material.opacity = .4; scene.add(grid);
  // the price line the camera rides, then the M it becomes
  const pts = []; let y = 2.2; for (let i = 0; i <= 120; i++) { y = clamp(y + (rnd() - .47) * .9, .8, 5); pts.push(new THREE.Vector3(Math.sin(i * .12) * 1.2, y, -i * 1.9)); }
  const lineCurve = new THREE.CatmullRomCurve3(pts), tube = new THREE.TubeGeometry(lineCurve, 700, .09, 8, false), tubeM = new THREE.MeshBasicMaterial({ color: G, toneMapped: false, transparent: true });
  const line = new THREE.Mesh(tube, tubeM); scene.add(line); const tubeIdx = tube.index.count; tube.setDrawRange(0, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 20, 20), new THREE.MeshBasicMaterial({ color: W, toneMapped: false })); scene.add(head);
  const Mz = -232, Mpts = [[-6, -3.5], [-3.3, 4.2], [0, -.7], [3.3, 4.2], [6, -3.5]].map(([x, yy]) => new THREE.Vector3(x, yy + 14, Mz));
  const mCurve = new THREE.CurvePath(); for (let i = 0; i < 4; i++) mCurve.add(new THREE.LineCurve3(Mpts[i], Mpts[i + 1]));
  const mTube = new THREE.TubeGeometry(mCurve, 200, .55, 12, false), mMesh = new THREE.Mesh(mTube, new THREE.MeshBasicMaterial({ color: G, toneMapped: false, transparent: true, opacity: 1 })); scene.add(mMesh); mTube.setDrawRange(0, 0);
  const mDot = new THREE.Mesh(new THREE.SphereGeometry(1.05, 28, 28), new THREE.MeshBasicMaterial({ color: W, toneMapped: false })); mDot.position.copy(Mpts[4]); mDot.scale.setScalar(0); scene.add(mDot);
  // dust
  const DN = 1200, dp = new Float32Array(DN * 3); for (let i = 0; i < DN; i++) { dp[i * 3] = (rnd() - .5) * 60; dp[i * 3 + 1] = rnd() * 30; dp[i * 3 + 2] = -rnd() * 260; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); scene.add(new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x9fe9cd, size: .06, transparent: true, opacity: .35, depthWrite: false })));
  scene.add(new THREE.AmbientLight(0x88a59b, .35)); const key = new THREE.DirectionalLight(0xdffbf0, .9); key.position.set(4, 12, 6); scene.add(key);

  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, cam)); const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .5, .3, .55); composer.addPass(bloom); composer.addPass(new OutputPass());
  function size() { const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w * dpr / 2, h * dpr / 2); cam.aspect = w / h; cam.fov = w < h ? 78 : 62; cam.updateProjectionMatrix(); }
  size(); addEventListener('resize', size);

  const look = new THREE.Vector3(), tmp = new THREE.Vector3();
  function pose(t) {
    // 0–5.4s: ride the line; 5.4–7.4s: rise and turn to the sky; 7.4+: the M draws itself
    const ride = ease(clamp(t / 5.6)), u = lerp(.02, .93, ride), p = lineCurve.getPointAt(u), ahead = lineCurve.getPointAt(Math.min(1, u + .05));
    tube.setDrawRange(0, Math.floor(tubeIdx * Math.min(1, u + .06) / 6) * 6); head.position.copy(lineCurve.getPointAt(Math.min(1, u + .06)));
    const rise = ease(sm(5.0, 7.6, t)), camPos = new THREE.Vector3(p.x - 1.4, p.y + 2.3, p.z + 7.5).lerp(new THREE.Vector3(0, 13, Mz + 34), rise);
    cam.position.copy(camPos); look.copy(ahead).setY(ahead.y + .1).lerp(new THREE.Vector3(0, 14, Mz), rise); cam.up.set(Math.sin(t * .5) * .04 * (1 - rise), 1, 0).normalize(); cam.lookAt(look);
    // candles rise out of the floor as the camera reaches them
    const front = -camPos.z; candles.children.forEach(c => { const k = sm(front - 4, front + 22, c.userData.d * step), s = 1 - k * 0 + 0; const g2 = sm(-1, 1, (front + 30 - c.userData.d * step) / 8); c.scale.y = c.userData.h * Math.max(.001, g2); c.position.y = c.userData.y - c.userData.h / 2 * (1 - g2); });
    const mk = sm(6.6, 8.0, t); mTube.setDrawRange(0, Math.floor(mTube.index.count * mk / 6) * 6); mDot.scale.setScalar(ease(sm(7.8, 8.3, t)));
    grid.material.opacity = .4 * (1 - rise * .7); tubeM.opacity = 1 - sm(6.0, 7.4, t) * .85; head.visible = t < 7.2;
  }
  let t0 = null, raf = 0, dead = false, still = null, done = false;
  function frame(now) { if (dead) return; raf = requestAnimationFrame(frame); if (t0 == null) t0 = now; const t = still != null ? still : (now - t0) / 1000; pose(Math.min(t, END + 1)); composer.render(); if (!done && t >= END) { done = true; opts.onEnd && opts.onEnd(); } }
  raf = requestAnimationFrame(frame);
  return { still(t) { still = t; }, render(t) { pose(t); composer.render(); }, dispose() { dead = true; cancelAnimationFrame(raf); removeEventListener('resize', size); renderer.dispose(); } };
}
