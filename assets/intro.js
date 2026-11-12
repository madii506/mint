// MINT intro, no text. 40,000 points are the market: a living landscape of mint peaks and red valleys.
// The camera glides over it, the landscape lifts off the ground, pours into the M, and the M breathes once before the site opens.
import * as THREE from './vendor/three.module.min.js';
import { EffectComposer } from './vendor/EffectComposer.js';
import { RenderPass } from './vendor/RenderPass.js';
import { UnrealBloomPass } from './vendor/UnrealBloomPass.js';
import { OutputPass } from './vendor/OutputPass.js';

export const END = 7.4;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function createIntro(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
  const dpr = Math.min(window.devicePixelRatio || 1, opts.dpr || 1.75); renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#020405');
  const cam = new THREE.PerspectiveCamera(55, 1, .1, 400);

  // the landscape grid and, for every point, its seat in the M
  const GX = 260, GZ = 150, N = GX * GZ, pos = new Float32Array(N * 3), seat = new Float32Array(N * 3), rnd = new Float32Array(N);
  const M = [[-1, -.62], [-.55, .62], [0, -.12], [.55, .62], [1, -.62]], segL = [], L0 = []; let tot = 0;
  for (let i = 0; i < 4; i++) { const l = Math.hypot(M[i + 1][0] - M[i][0], M[i + 1][1] - M[i][1]); L0.push(tot); segL.push(l); tot += l; }
  let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < N; i++) { const gx = i % GX, gz = Math.floor(i / GX); pos[i * 3] = (gx / (GX - 1) - .5) * 120; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = -(gz / (GZ - 1)) * 150 + 20; rnd[i] = r();
    // a point on the M stroke, with thickness, so the letter reads as a ribbon of light
    let d = r() * tot, k = 0; while (k < 3 && d > L0[k] + segL[k]) k++; const u = (d - L0[k]) / segL[k], a = M[k], b = M[k + 1], nx = -(b[1] - a[1]) / segL[k], ny = (b[0] - a[0]) / segL[k], w = (r() - .5) * .16, depth = (r() - .5) * .14;
    seat[i * 3] = (a[0] + (b[0] - a[0]) * u + nx * w) * 9; seat[i * 3 + 1] = (a[1] + (b[1] - a[1]) * u + ny * w) * 9 + 9; seat[i * 3 + 2] = depth * 9 - 60;
    if (rnd[i] < .022) { const an = r() * 6.283, rr = Math.sqrt(r()) * .17; seat[i * 3] = (1 + Math.cos(an) * rr) * 9; seat[i * 3 + 1] = (-.62 + Math.sin(an) * rr) * 9 + 9; seat[i * 3 + 2] = -60; } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seat', new THREE.BufferAttribute(seat, 3)); geo.setAttribute('rnd', new THREE.BufferAttribute(rnd, 1));
  const uni = { t: { value: 0 }, morph: { value: 0 }, burst: { value: 0 }, px: { value: dpr } };
  const mat = new THREE.ShaderMaterial({ uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float t, morph, burst, px; attribute vec3 seat; attribute float rnd; varying vec3 vC; varying float vA;
      float h(vec2 p){ return sin(p.x*.11+t*.9)*2.2 + sin(p.y*.07-t*.6)*2.6 + sin((p.x+p.y)*.05+t*.4)*1.8 + sin(p.x*.31-p.y*.23+t*1.3)*.6; }
      void main(){ vec3 p = position; float y = h(p.xz); float dy = h(p.xz+vec2(0.,-1.)) - y; p.y = y;
        float join = step(rnd, .34); float m = join * smoothstep(0., 1., clamp((morph*1.6 - rnd*1.6), 0., 1.)); p.y -= (1. - join) * morph * 14.;
        vec3 lift = mix(p, seat + vec3(0., sin(t*3.+rnd*30.)*.05, 0.), m);
        lift += normalize(seat - vec3(0.,9.,-60.) + vec3(.0001)) * burst * (8. + rnd*40.);
        vec4 mv = modelViewMatrix * vec4(lift, 1.); gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.4 + rnd*1.4 - m*.4) * px * (60. / -mv.z);
        vec3 up = vec3(.22,.95,.64), dn = vec3(1.,.33,.36); vC = mix(mix(dn, up, smoothstep(-.9,.25,dy)) * (.45 + .4*smoothstep(-4.,5.,y)), (rnd < .022 ? vec3(.95,.97,.96) : vec3(.36,.95,.72)), m);
        vA = mix(.5, .26, m) * (1. - burst) * (join > .5 ? 1. : 1. - smoothstep(0., .7, morph)) * smoothstep(-150., -10., p.z*(1.-m) - 10.*m); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ vec2 c = gl_PointCoord-.5; float d = length(c); if(d>.5) discard; gl_FragColor = vec4(vC, vA * smoothstep(.5, .0, d)); }` });
  scene.add(new THREE.Points(geo, mat));

  const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, cam)); const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .7, .5, .22); composer.addPass(bloom); composer.addPass(new OutputPass());
  function size() { const w = canvas.clientWidth || innerWidth, hh = canvas.clientHeight || innerHeight; renderer.setSize(w, hh, false); composer.setSize(w, hh); bloom.resolution.set(w * dpr / 2, hh * dpr / 2); cam.aspect = w / hh; cam.fov = w < hh ? 75 : 55; cam.updateProjectionMatrix(); }
  size(); addEventListener('resize', size);
  const look = new THREE.Vector3();
  function pose(t) { uni.t.value = t; const glide = ease(clamp(t / 4.2)), morph = sm(2.9, 5.6, t), lift = ease(sm(2.6, 5.4, t));
    uni.morph.value = morph; uni.burst.value = ease(sm(6.55, END, t));
    const fly = new THREE.Vector3(Math.sin(t * .35) * 6, lerp(7, 5, glide), lerp(30, -20, glide)), front = new THREE.Vector3(0, 9, -60 + (innerWidth < innerHeight ? 62 : 40));
    cam.position.copy(fly.lerp(front, lift)); look.set(Math.sin(t * .3) * 4, 0, cam.position.z - 40).lerp(new THREE.Vector3(0, 9, -60), lift); cam.up.set(Math.sin(t * .4) * .05 * (1 - lift), 1, 0).normalize(); cam.lookAt(look);
    const breathe = sm(5.4, 6.0, t) * (1 - sm(6.0, 6.6, t)); bloom.strength = .7 + breathe * .45; }
  let t0 = null, raf = 0, dead = false, still = null, done = false;
  (function frame(now) { if (dead) return; raf = requestAnimationFrame(frame); if (t0 == null) t0 = now; const t = still != null ? still : (now - t0) / 1000; pose(Math.min(t, END)); composer.render(); if (!done && t >= END) { done = true; opts.onEnd && opts.onEnd(); } })(performance.now());
  return { still(t) { still = t; }, render(t) { pose(t); composer.render(); }, dispose() { dead = true; cancelAnimationFrame(raf); removeEventListener('resize', size); geo.dispose(); mat.dispose(); renderer.dispose(); } };
}
