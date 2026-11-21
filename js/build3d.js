/* SBK Architects — "From first line to final light"  (the realistic build)
   A scroll-driven construction sequence in three.js, lit and shaded like a photographed
   architectural model standing on the page's ivory ground.

   The story: the villa is drawn as a gold blueprint, then built for real. Footings are
   dug and poured, rebar cages rise, slabs are cast on props and plywood decks, brick
   walls climb course by course inside tube-and-board scaffolding while a tower crane
   slews loads, the shell is glazed in champagne frames, lime plaster and stone wash up
   the walls, and the garden, pool and lights arrive for the handover.
   Gold lines mark each piece while it is planned and built and fade once it is done.
   The finished house keeps its gold only as champagne window frames and brass trims.

   How it works
   - main.js turns the scroll position into window.AA.buildS (0..1).
   - Every piece is an instance of a unit box (or a small kit shape) in one
     InstancedMesh per material ("batch"). A patched MeshStandardMaterial maps
     procedural textures in world space, adds a derivative bump, draws constant-width
     gold edges from the face UVs, "pours" each piece (per-instance fill) and washes
     the finish material up the building (uFinishY).
   - Desktops (HQ) render through an EffectComposer with ground-truth ambient occlusion
     (GTAO), a high-threshold bloom for lit windows and Khronos PBR Neutral tone mapping.
     Phones and small GPUs (LOW) render directly with smaller shadows and textures.
   - The page colour is reproduced exactly in both paths, so the scene melts into the
     page with no visible canvas edge. */
(() => {
  'use strict';

  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
  const stage = document.querySelector('[data-stage]');
  if (!stage) return;
  const canvas = stage.querySelector('[data-canvas]');
  const labelLayer = stage.querySelector('[data-labels]');
  const AA = (window.AA = window.AA || { buildS: 0, chapter: 0 });
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fallback(reason) {
    stage.classList.add('is-fallback');
    const fb = stage.querySelector('[data-fallback]');
    if (fb && typeof AA.elevation === 'function') {
      fb.innerHTML = AA.elevation('villa');
      fb.hidden = false;
    }
    if (canvas) canvas.style.display = 'none';
    if (reason) console.info('[build] 3D view unavailable:', reason);
  }

  let hasGL2 = false;
  try { hasGL2 = !!document.createElement('canvas').getContext('webgl2'); } catch (e) { hasGL2 = false; }
  if (!hasGL2) { fallback('WebGL2 not supported'); return; }

  // Quality tier. LOW: phones, tablets and machines with few cores or little memory.
  const narrow = window.matchMedia('(max-width: 860px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const LOW = !!window.AA_FORCE_LOW || (!window.AA_FORCE_HQ && (narrow || coarse ||
    (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4));

  async function boot() {
    let THREE;
    try { THREE = await import('three'); }           // resolved by the import map
    catch (e) { THREE = await import(THREE_URL); }   // no import map support: same file, by URL
    let post = null;
    if (!LOW) {
      try {
        const names = ['EffectComposer', 'RenderPass', 'GTAOPass', 'UnrealBloomPass', 'OutputPass'];
        const mods = await Promise.all(names.map((n) => import('three/addons/postprocessing/' + n + '.js')));
        post = {};
        names.forEach((n, k) => { post[n] = mods[k][n]; });
      } catch (e) {
        post = null;
        console.info('[build] post-processing unavailable, rendering directly');
      }
    }
    init(THREE, post);
  }
  boot().catch((err) => { console.error(err); fallback(err && err.message ? err.message : 'three.js did not load'); });

  /* ================================================================== */
  function init(THREE, post) {
    const HQ = !!post;

    /* ---------- helpers ---------- */
    const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const ramp = (s, a, b) => clamp01((s - a) / (b - a));
    const ease = (t) => t * t * (3 - 2 * t);
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const easeIn = (t) => t * t * t;
    const lerp = (a, b, t) => a + (b - a) * t;
    let seed = 20261031;
    const rnd = () => {           // deterministic, so every visitor sees the same site
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const rr = (a, b) => a + (b - a) * rnd();

    /* ---------- colour management ----------
       Both paths use Khronos PBR Neutral tone mapping. Drawn on the canvas directly
       (LOW), the clear colour and "exact" colours skip tone mapping. Through the
       composer (HQ) the whole frame is tone-mapped at the end, so those colours are
       written as the linear value that the tone mapper maps back onto the target. */
    const EXPOSURE = 1.0;
    const hexRGB = (hex) => { const n = parseInt(hex.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
    const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    function neutral(c) {
      let r = c[0] * EXPOSURE, g = c[1] * EXPOSURE, b = c[2] * EXPOSURE;
      const x = Math.min(r, g, b);
      const off = x < 0.08 ? x - 6.25 * x * x : 0.04;
      r -= off; g -= off; b -= off;
      const peak = Math.max(r, g, b), SC = 0.76;
      if (peak < SC) return [r, g, b];
      const d = 1 - SC, np = 1 - (d * d) / (peak + d - SC);
      r *= np / peak; g *= np / peak; b *= np / peak;
      const k = 1 - 1 / (0.15 * (peak - np) + 1);
      return [lerp(r, np, k), lerp(g, np, k), lerp(b, np, k)];
    }
    function preimage(target) {
      let c = target.slice();
      for (let k = 0; k < 240; k++) {
        const f = neutral(c);
        c = c.map((v, i) => Math.max(0, v + (target[i] - f[i]) * 1.5));
      }
      return c;
    }
    const exactLin = (hex) => { const lin = hexRGB(hex).map(toLin); return HQ ? preimage(lin) : lin; };
    const exactColor = (hex) => new THREE.Color().setRGB(...exactLin(hex), THREE.LinearSRGBColorSpace);
    // for values written after the colour-space conversion at the very end of a shader
    const outVec = (hex) => new THREE.Vector3(...(HQ ? preimage(hexRGB(hex).map(toLin)) : hexRGB(hex)));

    /* ---------- renderer, scene, camera ---------- */
    const PAPER = '#F1EEE6';
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !HQ, alpha: false, powerPreference: 'high-performance', stencil: false });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = EXPOSURE;
    renderer.setClearColor(HQ ? exactColor(PAPER) : new THREE.Color(PAPER), 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    let dpr = Math.min(window.devicePixelRatio || 1, HQ ? 1.5 : 1.6);
    renderer.setPixelRatio(dpr);
    const MAXANISO = renderer.capabilities.getMaxAnisotropy();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 2, 260);

    /* ---------- studio environment: soft dome + three softboxes, prefiltered ---------- */
    function studio() {
      const env = new THREE.Scene();
      const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `varying vec3 vDir;
          void main(){
            float y = vDir.y;
            vec3 floorC = vec3(0.50, 0.46, 0.40);
            vec3 horiz = vec3(0.92, 0.90, 0.86);
            vec3 top = vec3(0.70, 0.78, 0.92);
            vec3 c = y < 0.0 ? mix(horiz, floorC, smoothstep(0.0, 0.3, -y)) : mix(horiz, top, smoothstep(0.0, 0.75, y));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }));
      env.add(dome);
      const box = (w, h, p, k, hex) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
        m.position.set(p[0], p[1], p[2]);
        m.lookAt(0, 0, 0);
        env.add(m);
      };
      box(34, 20, [22, 38, 26], 3.4, '#FFF4E6');   // key: high, front right
      box(46, 7, [-46, 16, -8], 1.7, '#FFFFFF');   // long strip: left rim
      box(26, 12, [-12, 26, 42], 1.1, '#F3F0FF');  // fill: front left
      const pm = new THREE.PMREMGenerator(renderer);
      const tex = pm.fromScene(env, 0.035).texture;
      pm.dispose();
      env.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      return tex;
    }
    scene.environment = studio();
    scene.environmentIntensity = 0.5;

    /* ---------- sun ---------- */
    const SUN_DAY = new THREE.Color('#FFF1DE');
    const SUN_GOLD = new THREE.Color('#FFA552');
    const sun = new THREE.DirectionalLight(SUN_DAY.clone(), 3.0);
    sun.castShadow = true;
    const SM = HQ ? 2048 : 1024;
    sun.shadow.mapSize.set(SM, SM);
    Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 2, far: 150 });
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.022;
    sun.target.position.set(0, 0, 2);
    scene.add(sun, sun.target);
    function placeSun(azDeg, elDeg) {
      const az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(elDeg), R = 60;
      sun.position.set(Math.sin(az) * Math.cos(el) * R, Math.sin(el) * R, 2 + Math.cos(az) * Math.cos(el) * R);
    }
    placeSun(48, 52);

    /* ---------- shared uniforms ---------- */
    const U = {
      uGold: { value: outVec('#B08A4A') },
      uGoldHi: { value: outVec('#EBD39C') },
      uEdgeW: { value: 0.9 * dpr },
      uFinishY: { value: -50 },
      uSweep: { value: -200 },
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uGlowCol: { value: new THREE.Color('#FFB35C') },
    };

    /* ---------- procedural textures ----------
       Generated once at start-up, all tileable. RGB is the colour (sRGB), alpha is a
       height value used for the bump. One shared fractal-noise field is sampled at
       different scales and offsets by every texture, which keeps generation fast. */
    const TS = HQ ? 512 : 256;
    const NF = (() => {
      const N = TS, out = new Float32Array(N * N);
      for (const [G, amp] of [[4, 0.5], [8, 0.26], [16, 0.13], [32, 0.07], [64, 0.04]]) {
        const g = new Float32Array(G * G);
        for (let k = 0; k < g.length; k++) g[k] = rnd();
        const cell = N / G;
        for (let y = 0; y < N; y++) {
          const fy = y / cell, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
          const r0 = (y0 % G) * G, r1 = ((y0 + 1) % G) * G;
          for (let x = 0; x < N; x++) {
            const fx = x / cell, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx);
            const c0 = x0 % G, c1 = (x0 + 1) % G;
            const a = g[r0 + c0] + (g[r0 + c1] - g[r0 + c0]) * sx;
            const b = g[r1 + c0] + (g[r1 + c1] - g[r1 + c0]) * sx;
            out[y * N + x] += (a + (b - a) * sy) * amp;
          }
        }
      }
      let mn = Infinity, mx = -Infinity;
      for (let k = 0; k < out.length; k++) { if (out[k] < mn) mn = out[k]; if (out[k] > mx) mx = out[k]; }
      for (let k = 0; k < out.length; k++) out[k] = (out[k] - mn) / (mx - mn);
      return out;
    })();
    const wrap = (v) => ((v % TS) + TS) % TS;
    // fractal noise at pixel (x, y); kx/ky stretch it (integers), ox/oy decorrelate textures
    const nf = (x, y, kx = 1, ky = kx, ox = 0, oy = 0) => NF[wrap(y * ky + oy) * TS + wrap(x * kx + ox)];
    const hash = (x, y) => {
      let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };

    function dataTex(fn) {
      const N = TS, d = new Uint8ClampedArray(N * N * 4), c = [0, 0, 0, 1];
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          c[3] = 1;
          fn(x, y, c);
          const k = (y * N + x) * 4;
          d[k] = c[0] * 255; d[k + 1] = c[1] * 255; d[k + 2] = c[2] * 255; d[k + 3] = c[3] * 255;
        }
      }
      const t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = Math.min(HQ ? 8 : 4, MAXANISO);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      return t;
    }
    const set = (c, r, g, b, h) => { c[0] = r; c[1] = g; c[2] = b; c[3] = h; };
    const T = {};
    const TILE = {};   // metres covered by one repeat of each texture

    // Board-marked concrete: 1.2 x 0.6 m plywood panels, tie holes, pores, blotches.
    TILE.concrete = 2.4;
    T.concrete = dataTex((x, y, c) => {
      const n = nf(x, y, 1, 1, 37, 91), n2 = nf(x, y, 4, 4, 11, 5), pw = TS / 2, ph = TS / 4;
      const px = x % pw, py = y % ph;
      const joint = Math.min(px, pw - px) < 1.1 || Math.min(py, ph - py) < 0.9;
      const hx = Math.abs(px - pw * 0.25) % (pw * 0.5), hy = Math.abs(py - ph * 0.5);
      const tie = Math.hypot(Math.min(hx, pw * 0.5 - hx), hy) < TS / 300 + 0.8;
      const pore = hash(x + 7, y + 3) > 0.994;
      let l = 0.76 + (n - 0.5) * 0.13 + (n2 - 0.5) * 0.05 + (hash(x, y) - 0.5) * 0.035;
      if (joint) l -= 0.05;
      if (tie) l -= 0.1;
      if (pore) l -= 0.14;
      set(c, l, l * 0.978, l * 0.94, 0.78 + (n2 - 0.5) * 0.25 - (joint ? 0.2 : 0) - (tie ? 0.5 : 0) - (pore ? 0.3 : 0));
    });

    // Lime plaster: warm white, trowel clouds.
    TILE.plaster = 3;
    T.plaster = dataTex((x, y, c) => {
      const n = nf(x, y, 1, 1, 5, 77), n2 = nf(x, y, 2, 2, 51, 13);
      const l = 0.935 + (n - 0.5) * 0.035 + (n2 - 0.5) * 0.02 + (hash(x, y) - 0.5) * 0.012;
      set(c, l, l * 0.982, l * 0.948, 0.7 + (n2 - 0.5) * 0.3);
    });

    // Wire-cut brick, running bond: 12 bricks x 34 courses per repeat (240 x 85 mm modules).
    TILE.brick = 2.88;
    T.brick = dataTex((x, y, c) => {
      const rowH = TS / 34, colW = TS / 12;
      const row = Math.floor(y / rowH), fy = y - row * rowH;
      const xx = wrap(x + (row % 2) * colW * 0.5), col = Math.floor(xx / colW), fx = xx - col * colW;
      const n = nf(x, y, 4, 4, 3, 17);
      if (fy < Math.max(1, rowH * 0.12) || fx < Math.max(1, colW * 0.045)) {
        const l = 0.69 + (n - 0.5) * 0.1 + (hash(x, y) - 0.5) * 0.05;
        set(c, l, l * 0.965, l * 0.91, 0.45 + n * 0.1);
        return;
      }
      const id = hash(col * 13 + 1, row * 7 + 3), id2 = hash(col + 99, row + 41);
      const base = id < 0.1 ? [0.50, 0.27, 0.19] : id < 0.32 ? [0.74, 0.45, 0.31] : [0.66, 0.37, 0.25];
      const k = 0.9 + id2 * 0.18 + (n - 0.5) * 0.2 + (hash(x, y) - 0.5) * 0.07;
      set(c, base[0] * k, base[1] * k, base[2] * k, 0.9 + (n - 0.5) * 0.12);
    });

    // Sandstone cladding: 300 mm courses of random-length slabs, fine veining.
    TILE.stone = 2.4;
    T.stone = dataTex((x, y, c) => {
      const rows = 8, rowH = TS / rows, row = Math.floor(y / rowH), fy = y - row * rowH;
      const L = TS / (3 + (row % 3)), xx = wrap(x + Math.floor(hash(row, 5) * TS)), col = Math.floor(xx / L), fx = xx - col * L;
      const joint = fy < 1 || fx < 1;
      const id = hash(col + 3, row + 11);
      const vein = Math.abs(Math.sin((nf(x, y, 2, 1, 70, 20) * 9 + y / TS * 3) * 3.1));
      const n = nf(x, y, 2, 2, 31, 63);
      const l = 0.84 + (id - 0.5) * 0.1 + (n - 0.5) * 0.07 - Math.pow(1 - vein, 8) * 0.06 + (hash(x, y) - 0.5) * 0.03;
      if (joint) { set(c, 0.6, 0.56, 0.5, 0.35); return; }
      set(c, l, l * 0.925, l * 0.79, 0.85 + (n - 0.5) * 0.15);
    });

    // Wood grain along v (tinted per material: raw timber or oiled teak).
    TILE.wood = 1.6;
    T.wood = dataTex((x, y, c) => {
      const g = nf(x, y, 8, 1, 3, 9), g2 = nf(x, y, 16, 1, 41, 70);
      const ring = 0.5 + 0.5 * Math.sin(g * 36 + g2 * 6);
      const l = 0.78 + (ring - 0.5) * 0.14 + (g2 - 0.5) * 0.1 + (hash(x, y) - 0.5) * 0.04;
      set(c, l, l * 0.95, l * 0.9, 0.6 + ring * 0.3);
    });

    // Limestone pavers 600 x 600 mm.
    TILE.pave = 2.4;
    T.pave = dataTex((x, y, c) => {
      const P = TS / 4, px = x % P, py = y % P, joint = px < 1 || py < 1;
      const id = hash(Math.floor(x / P) + 5, Math.floor(y / P) + 9);
      const n = nf(x, y, 2, 2, 8, 44), speck = hash(x * 3, y * 5) > 0.992 ? -0.08 : 0;
      const l = 0.9 + (id - 0.5) * 0.06 + (n - 0.5) * 0.06 + speck + (hash(x, y) - 0.5) * 0.025;
      if (joint) { set(c, 0.62, 0.6, 0.56, 0.3); return; }
      set(c, l, l * 0.965, l * 0.9, 0.85 + (n - 0.5) * 0.1);
    });

    // Lawn: mown stripes, clumps and blades.
    TILE.grass = 2.4;
    T.grass = dataTex((x, y, c) => {
      const n = nf(x, y, 2, 2, 17, 3), n2 = nf(x, y, 8, 8, 5, 29), h = hash(x, y);
      const stripe = Math.floor((x / TS) * 3) % 2 ? 0.018 : -0.018;
      const k = 0.92 + (n - 0.5) * 0.22 + (n2 - 0.5) * 0.12 + (h - 0.5) * 0.16 + stripe;
      set(c, 0.47 * k, 0.53 * k, 0.35 * k, 0.4 + n2 * 0.4 + h * 0.2);
    });

    // Site soil: dry, sandy earth with pebbles, ruts and damp patches.
    TILE.soil = 3.2;
    T.soil = dataTex((x, y, c) => {
      const n = nf(x, y, 1, 1, 60, 6), n2 = nf(x, y, 4, 4, 23, 51), n3 = nf(x, y, 8, 8, 3, 3), h = hash(x, y);
      const peb = hash(x >> 1, y >> 1) > 0.982 ? 0.16 * (hash(x >> 1, (y >> 1) + 7) - 0.3) : 0;
      const rut = Math.pow(Math.abs(Math.sin((x / TS) * Math.PI * 4 + nf(x, y, 1, 1, 7, 70) * 2.5)), 24) * 0.06;
      const k = 0.92 + (n - 0.5) * 0.3 + (n2 - 0.5) * 0.16 + (n3 - 0.5) * 0.08 + (h - 0.5) * 0.12 + peb - rut;
      set(c, 0.75 * k, 0.65 * k, 0.53 * k, 0.5 + n2 * 0.25 + n3 * 0.15 + peb * 2 - rut * 3);
    });

    // Shuttering plywood: 1.2 x 2.4 m sheets, veneer, cement splashes.
    TILE.ply = 2.4;
    T.ply = dataTex((x, y, c) => {
      const sx = x % (TS / 2), edge = Math.min(sx, TS / 2 - sx) < 1.5;
      const v = nf(x, y, 1, 6, 9, 2), n = nf(x, y, 2, 2, 90, 31);
      const stain = n > 0.72 ? (n - 0.72) * 2.2 : 0;
      const k = 0.9 + (v - 0.5) * 0.2 + (hash(x, y) - 0.5) * 0.05 - (edge ? 0.2 : 0);
      set(c, lerp(0.71 * k, 0.7, stain), lerp(0.53 * k, 0.69, stain), lerp(0.37 * k, 0.66, stain), 0.7 - (edge ? 0.3 : 0));
    });

    // Scaffold boards: 225 mm planks along u.
    TILE.board = 2.4;
    T.board = dataTex((x, y, c) => {
      const P = TS / 10, py = y % P, gap = py < 1.2;
      const id = hash(5, Math.floor(y / P));
      const g = nf(x, y, 1, 8, 12, 40);
      const k = 0.88 + (id - 0.5) * 0.2 + (g - 0.5) * 0.18 + (hash(x, y) - 0.5) * 0.05;
      if (gap) { set(c, 0.25, 0.22, 0.18, 0.1); return; }
      set(c, 0.74 * k, 0.6 * k, 0.43 * k, 0.75 + (g - 0.5) * 0.2);
    });

    // Neutral metal: fine grain and streaks (tinted per material).
    TILE.metal = 1.2;
    T.metal = dataTex((x, y, c) => {
      const s = nf(x, y, 1, 8, 4, 8), n = nf(x, y, 4, 4, 70, 70);
      const l = 0.82 + (s - 0.5) * 0.1 + (n - 0.5) * 0.06 + (hash(x, y) - 0.5) * 0.04;
      set(c, l, l, l, 0.6 + (n - 0.5) * 0.3);
    });

    // Corrugated steel (container walls): 150 mm ribs, faint rust streaks.
    TILE.corr = 0.6;
    T.corr = dataTex((x, y, c) => {
      const rib = 0.5 + 0.5 * Math.cos((x / TS) * Math.PI * 8);
      const n = nf(x, y, 2, 2, 13, 77), streak = nf(x, y, 8, 1, 50, 9);
      const l = 0.86 + (rib - 0.5) * 0.08 + (n - 0.5) * 0.06 - Math.max(0, streak - 0.62) * 0.3 + (hash(x, y) - 0.5) * 0.02;
      set(c, l, l * 0.985, l * 0.95, 0.25 + rib * 0.7);
    });

    // Moulded ribs (plastic water tank).
    TILE.ribs = 1.2;
    T.ribs = dataTex((x, y, c) => {
      const rib = 0.5 + 0.5 * Math.cos((y / TS) * Math.PI * 10);
      const n = nf(x, y, 2, 2, 33, 1);
      const l = 0.8 + (rib - 0.5) * 0.12 + (n - 0.5) * 0.05;
      set(c, l, l, l, 0.3 + rib * 0.6);
    });

    // Pool mosaic: 25 mm glass tiles.
    TILE.pool = 1;
    T.pool = dataTex((x, y, c) => {
      const P = TS / 40, px = x % P, py = y % P;
      if (px < 0.9 || py < 0.9) { set(c, 0.86, 0.9, 0.9, 0.3); return; }
      const id = hash(Math.floor(x / P), Math.floor(y / P));
      const k = 0.88 + id * 0.22;
      set(c, 0.33 * k, 0.62 * k, 0.68 * k, 0.9);
    });

    /* ---------- canvas textures with transparency (foliage) and the site hoarding ---------- */
    function canvasTex(w, h, draw, srgb = true) {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      draw(cv.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(cv);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(4, MAXANISO);
      t.userData.redraw = () => { const x = cv.getContext('2d'); x.clearRect(0, 0, w, h); draw(x, w, h); t.needsUpdate = true; };
      return t;
    }
    const LS = HQ ? 256 : 128;
    // A cluster of leaves for the canopy cards.
    T.leaves = canvasTex(LS, LS, (x, w) => {
      for (let k = 0; k < 52; k++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * w * 0.38;
        const cx = w / 2 + Math.cos(a) * r, cy = w / 2 + Math.sin(a) * r;
        const L = w * rr(0.08, 0.14), shade = rr(0.7, 1.08);
        x.save();
        x.translate(cx, cy);
        x.rotate(rnd() * Math.PI * 2);
        x.fillStyle = `rgb(${Math.round(98 * shade)},${Math.round(120 * shade)},${Math.round(70 * shade)})`;
        x.beginPath();
        x.ellipse(0, 0, L, L * 0.42, 0, 0, Math.PI * 2);
        x.fill();
        x.restore();
      }
    });
    // A palm frond seen from above: a rib with drooping leaflets.
    T.frond = canvasTex(LS / 2, LS * 2, (x, w, h) => {
      x.strokeStyle = 'rgb(118,128,72)';
      x.lineWidth = Math.max(1, w * 0.03);
      x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
      for (let k = 0; k < 46; k++) {
        const t = k / 46, y0 = t * h, len = w * 0.48 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08));
        const shade = rr(0.7, 1.05);
        x.strokeStyle = `rgb(${Math.round(84 * shade)},${Math.round(112 * shade)},${Math.round(50 * shade)})`;
        x.lineWidth = Math.max(1, w * 0.045);
        for (const sgn of [-1, 1]) {
          x.beginPath();
          x.moveTo(w / 2, y0);
          x.quadraticCurveTo(w / 2 + sgn * len * 0.6, y0 + h * 0.01, w / 2 + sgn * len, y0 + h * 0.045);
          x.stroke();
        }
      }
    });
    // Hoarding: ivory panels, gold band, the studio's name.
    T.hoard = canvasTex(2048, 192, (x, w, h) => {
      x.fillStyle = '#F4F1EA'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#B08A4A'; x.fillRect(0, h - 22, w, 10); x.fillRect(0, 12, w, 3);
      x.fillStyle = 'rgba(40,48,65,0.12)';
      for (let k = 1; k < 12; k++) x.fillRect(Math.round((k * w) / 12), 0, 2, h);
      x.textBaseline = 'middle';
      x.fillStyle = '#18202E';
      x.font = '500 76px "Noto Serif Display", Georgia, serif';
      for (const cx of [0.27, 0.73]) {
        x.textAlign = 'center';
        x.fillText('SBK Architects', w * cx, h * 0.44);
        x.font = '600 21px Archivo, Helvetica, Arial, sans-serif';
        x.fillStyle = '#7F6129';
        x.fillText('A R C H I T E C T U R E   ·   C I V I L   C O N S T R U C T I O N   ·   M Y S O R E', w * cx, h * 0.76);
        x.fillStyle = '#18202E';
        x.font = '500 76px "Noto Serif Display", Georgia, serif';
      }
    });
    T.hoardSide = canvasTex(512, 64, (x, w, h) => {
      x.fillStyle = '#F4F1EA'; x.fillRect(0, 0, w, h);
      x.fillStyle = '#B08A4A'; x.fillRect(0, h - 8, w, 4); x.fillRect(0, 4, w, 1);
      x.fillStyle = 'rgba(40,48,65,0.12)';
      for (let k = 1; k < 4; k++) x.fillRect(Math.round((k * w) / 4), 0, 1, h);
    });
    T.hoardSide.wrapS = THREE.RepeatWrapping;
    // the hoarding is lettered in the page fonts: redraw once they have loaded
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => T.hoard.userData.redraw());

    /* ---------- the surface material ----------
       One patched MeshStandardMaterial drives every building and site piece:
       - textures are mapped in world space (dominant-axis projection), so a wall that
         grows keeps its brick courses fixed in place
       - a derivative bump turns the texture's height channel into joints and pores
       - per-instance aFx = (fill, gold-edge strength, fill axis): the unfilled part of a
         piece is drawn as a gold outline only, with a gold line at the pour front
       - per-instance aMeta = (takes the finish, random seed): under uFinishY the piece
         changes from its construction material (A) to its finished material (B) */
    const SURF_V_COMMON = `#include <common>
      attribute vec3 aFx;
      attribute vec2 aMeta;
      varying vec3 vFx;
      varying vec2 vMeta;
      varying vec3 vLocal;
      varying vec3 vWPos;
      varying vec3 vONrm;`;
    const SURF_V_BEGIN = `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vFx = aFx; vMeta = aMeta;
      #else
        vFx = vec3(1.0, 0.0, 0.0); vMeta = vec2(0.0, 0.5);
      #endif
      vLocal = position + 0.5;
      vONrm = normal;`;
    const SURF_V_WPOS = `#include <fog_vertex>
      vec4 aaW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        aaW = instanceMatrix * aaW;
      #endif
      vWPos = (modelMatrix * aaW).xyz;`;
    const F_COMMON = `
      uniform vec3 uGold;
      uniform vec3 uGoldHi;
      uniform float uEdgeW;
      uniform float uFinishY;
      uniform float uSweep;
      uniform float uGlow;
      uniform vec3 uGlowCol;
      varying vec3 vFx;
      varying vec2 vMeta;
      varying vec3 vLocal;
      varying vec3 vWPos;
      varying vec3 vONrm;
      float aaEdge(vec2 uv, float w) {
        vec2 fw = max(fwidth(uv), vec2(1e-6));
        vec2 d = min(uv, 1.0 - uv) / fw;
        return 1.0 - smoothstep(w - 0.7, w + 0.7, min(d.x, d.y));
      }`;

    function surface(o) {
      const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, side: o.side || THREE.FrontSide });
      const uni = {
        uMapA: { value: T[o.a] },
        uMapB: { value: T[o.b || o.a] },
        uScaleA: { value: 1 / TILE[o.a] },
        uScaleB: { value: 1 / TILE[o.b || o.a] },
        uColA: { value: new THREE.Color(o.ca || '#ffffff') },
        uColB: { value: new THREE.Color(o.cb || o.ca || '#ffffff') },
        uRM: { value: new THREE.Vector4(o.ra ?? 0.9, o.rb ?? o.ra ?? 0.9, o.ma ?? 0, o.mb ?? o.ma ?? 0) },
        uBump: { value: o.bump ?? 1 },
        uJitter: { value: o.jitter ?? 1 },
        uSweepK: { value: o.sweep || 0 },
        uGlowK: { value: o.glow || 0 },
      };
      mat.defines = { USE_UV: '' };
      mat.customProgramCacheKey = () => 'aa-surface-v2';
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U, uni);
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', SURF_V_COMMON)
          .replace('#include <begin_vertex>', SURF_V_BEGIN)
          .replace('#include <fog_vertex>', SURF_V_WPOS);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
            ${F_COMMON}
            uniform sampler2D uMapA;
            uniform sampler2D uMapB;
            uniform float uScaleA;
            uniform float uScaleB;
            uniform vec3 uColA;
            uniform vec3 uColB;
            uniform vec4 uRM;
            uniform float uBump;
            uniform float uJitter;
            uniform float uSweepK;
            uniform float uGlowK;
            vec3 aaPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
              vec3 vSigmaX = normalize(dFdx(surf_pos));
              vec3 vSigmaY = normalize(dFdy(surf_pos));
              vec3 R1 = cross(vSigmaY, surf_norm);
              vec3 R2 = cross(surf_norm, vSigmaX);
              float fDet = dot(vSigmaX, R1) * faceDir;
              vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
              return normalize(abs(fDet) * surf_norm - vGrad);
            }`)
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
            float aaE = aaEdge(vUv, uEdgeW) * vFx.y;
            float aaC = vFx.z < 0.5 ? vLocal.y : (vFx.z < 1.5 ? vLocal.x : vLocal.z);
            float aaFw = max(fwidth(aaC), 1e-5);
            float aaFill = vFx.x >= 0.999 ? 1.0 : 1.0 - smoothstep(vFx.x - aaFw, vFx.x + aaFw, aaC);
            float aaFront = (vFx.x > 0.001 && vFx.x < 0.999) ? (1.0 - smoothstep(0.0, aaFw * 1.6, abs(aaC - vFx.x))) * step(0.01, vFx.y) : 0.0;
            float aaLine = max(aaE, aaFront);
            if (aaFill < 0.5 && aaLine < 0.04) discard;
            vec3 aaAN = abs(vONrm);
            vec2 aaUV = aaAN.x > 0.5 ? vWPos.zy : (aaAN.y > 0.5 ? vWPos.xz : vWPos.xy);
            aaUV += vMeta.y * uJitter * vec2(17.0, 5.0);
            float aaFin = vMeta.x * (1.0 - smoothstep(uFinishY - 0.04, uFinishY + 0.04, vWPos.y));
            vec4 aaTex = mix(texture(uMapA, aaUV * uScaleA) * vec4(uColA, 1.0), texture(uMapB, aaUV * uScaleB) * vec4(uColB, 1.0), aaFin);`)
          .replace('#include <map_fragment>', `diffuseColor.rgb *= aaTex.rgb;
            diffuseColor.rgb *= 1.0 - 0.14 * step(abs(vONrm.y), 0.5) * smoothstep(-0.05, 0.02, vWPos.y) * (1.0 - smoothstep(0.02, 0.55, vWPos.y));`)
          .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(uRM.x, uRM.y, aaFin) * (0.9 + 0.2 * (1.0 - aaTex.a));')
          .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = mix(uRM.z, uRM.w, aaFin);')
          .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
            normal = aaPerturb(-vViewPosition, normal, vec2(dFdx(aaTex.a), dFdy(aaTex.a)) * uBump, faceDirection);`)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            totalEmissiveRadiance += uGlowCol * (uGlow * uGlowK * vMeta.x) * (0.25 + 1.1 * vLocal.y * vLocal.y) * (0.75 + 0.5 * vMeta.y);`)
          .replace('#include <dithering_fragment>', `#include <dithering_fragment>
            float aaSw = 1.0 - smoothstep(0.0, 1.8, abs(vWPos.x * 0.8 + vWPos.z * 0.6 + vWPos.y * 0.35 - uSweep));
            vec3 aaGold = mix(uGold, uGoldHi, aaSw);
            float aaBand = vMeta.x * (1.0 - smoothstep(0.0, 0.1, abs(vWPos.y - uFinishY))) * step(-1.0, uFinishY) * step(uFinishY, 14.0);
            if (aaFill < 0.5) {
              gl_FragColor = vec4(aaGold, aaLine);
            } else {
              gl_FragColor.rgb = mix(gl_FragColor.rgb, aaGold, max(aaLine, aaBand * 0.55 * (1.0 - uGlowK)));
              gl_FragColor.rgb += aaGold * aaSw * uSweepK * 0.35;
              gl_FragColor.a = 1.0;
            }`);
      };
      mat.alphaToCoverage = true;
      return mat;
    }

    // Shadows follow the pour: the unfilled part of a piece casts no shadow.
    const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depthMat.customProgramCacheKey = () => 'aa-depth-v2';
    depthMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec3 aFx; varying vec3 vFx; varying vec3 vLocal;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vFx = aFx;
          #else
            vFx = vec3(1.0, 0.0, 0.0);
          #endif
          vLocal = position + 0.5;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vFx; varying vec3 vLocal;`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float aaC = vFx.z < 0.5 ? vLocal.y : (vFx.z < 1.5 ? vLocal.x : vLocal.z);
          if (vFx.x < 0.999 && aaC > vFx.x) discard;`);
    };

    // Glazing: tinted, reflective, fades in with a gold outline; aFx.x = appear.
    function glassMaterial() {
      const m = new THREE.MeshStandardMaterial({ color: new THREE.Color('#55666A'), roughness: 0.05, metalness: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.7 });
      m.defines = { USE_UV: '' };
      m.customProgramCacheKey = () => 'aa-glass-v2';
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', SURF_V_COMMON)
          .replace('#include <begin_vertex>', SURF_V_BEGIN)
          .replace('#include <fog_vertex>', SURF_V_WPOS);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', `#include <common>
            ${F_COMMON}`)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            totalEmissiveRadiance += uGlowCol * (uGlow * vMeta.x * 0.22);`)
          .replace('#include <dithering_fragment>', `#include <dithering_fragment>
            float aaFres = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 4.0);
            float aaA = mix(0.5 + 0.35 * aaFres, 0.4 + 0.3 * aaFres, uGlow * vMeta.x) * vFx.x;
            float aaL = aaEdge(vUv, uEdgeW) * vFx.y;
            gl_FragColor = vec4(mix(gl_FragColor.rgb, uGold, aaL), max(aaA, aaL));
            if (gl_FragColor.a < 0.01) discard;`);
      };
      return m;
    }

    const MAT = {
      conc: surface({ a: 'concrete', b: 'plaster', ra: 0.9, rb: 0.86, bump: 1.4 }),
      stoneclad: surface({ a: 'concrete', b: 'stone', ra: 0.9, rb: 0.6, bump: 1.5, jitter: 0 }),
      brick: surface({ a: 'brick', b: 'plaster', ra: 0.92, rb: 0.86, bump: 2.2, jitter: 0 }),
      pave: surface({ a: 'pave', ra: 0.6, bump: 1.2, jitter: 0 }),
      wood: surface({ a: 'wood', ca: '#EAD7B2', cb: '#9E6A40', ra: 0.78, rb: 0.5, bump: 0.8 }),
      bronze: surface({ a: 'metal', ca: '#4A3E2E', ra: 0.42, ma: 0.9, bump: 0.3 }),
      champ: surface({ a: 'metal', ca: '#E3CC98', ra: 0.26, ma: 1, bump: 0.2, sweep: 1 }),
      rebar: surface({ a: 'metal', ca: '#6E4630', ra: 0.72, ma: 0.55, bump: 0.5 }),
      ply: surface({ a: 'ply', ra: 0.7, bump: 0.6 }),
      galv: surface({ a: 'metal', ca: '#C9CED0', ra: 0.36, ma: 0.85, bump: 0.3 }),
      board: surface({ a: 'board', ra: 0.85, bump: 1.0 }),
      pit: surface({ a: 'soil', ca: '#76695B', ra: 1, bump: 1.6 }),
      sand: surface({ a: 'soil', ca: '#F0D9AE', ra: 1, bump: 1.0 }),
      pool: surface({ a: 'pool', ra: 0.18, bump: 0.6, jitter: 0 }),
      paint: surface({ a: 'plaster', ca: '#F7F5F0', ra: 0.55 }),
      dark: surface({ a: 'metal', ca: '#2E2F31', ra: 0.55, ma: 0.15, bump: 0.3 }),
      yellow: surface({ a: 'metal', ca: '#DDA436', ra: 0.5, ma: 0.25, bump: 0.3 }),
      room: surface({ a: 'plaster', ca: '#8D8377', ra: 1, glow: 1, side: THREE.BackSide }),
      glass: glassMaterial(),
    };

    /* ---------- batches: one InstancedMesh per material ----------
       add(batch, [x0,x1, y0,y1, z0,z1], opts) in metres. Options:
       t, d   start and duration of growth along g ('y', 'x', '-x', 'z', '-z', '-y', 'none')
       p, pd  start and duration of the pour along ax (0 y, 1 x, 2 z); null = solid at once
       q      pour in steps of q metres (brick courses)
       edge   gold edge strength while building (0 for temporary works)
       fin    1 = takes the batch's finish material under the finish wash
       o, od  removal start and duration (temporary works)
       gh     part of the blueprint ghost (default: permanent pieces)
       m      a full Matrix4 for rotated pieces (they pop in and out instead) */
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    const BATCHES = [];
    const BT = {};
    function batch(name, mat, o = {}) {
      const B = { name, mat, list: [], geo: o.geo || unitBox, shadow: o.shadow !== false, recv: o.recv !== false, noAO: !!o.noAO, order: o.order || 0 };
      BATCHES.push(B);
      BT[name] = B;
      return B;
    }
    function add(name, b, o) {
      const e = Object.assign({ b, t: 0, d: 0.02, g: 'y', p: null, pd: 0.02, ax: 0, edge: 1, fin: 0, q: 0, o: null, od: 0.012, gh: undefined, m: null }, o);
      if (e.gh === undefined) e.gh = e.edge > 0 && !e.m;
      BT[name].list.push(e);
      return e;
    }
    const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
    function compose(e, g) {
      if (g <= 0) return ZERO;
      if (e.m) return g >= 1 ? e.m : _m.copy(e.m).multiply(_m2.makeScale(g, g, g));
      const [x0, x1, y0, y1, z0, z1] = e.b;
      let sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
      let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2;
      switch (e.g) {
        case 'y': sy *= g; cy = y0 + sy / 2; break;
        case '-y': sy *= g; cy = y1 - sy / 2; break;
        case 'x': sx *= g; cx = x0 + sx / 2; break;
        case '-x': sx *= g; cx = x1 - sx / 2; break;
        case 'z': sz *= g; cz = z0 + sz / 2; break;
        case '-z': sz *= g; cz = z1 - sz / 2; break;
        default: sx *= g; sy *= g; sz *= g; break;
      }
      return _m.compose(_p.set(cx, cy, cz), _q.identity(), _s.set(Math.max(sx, 1e-4), Math.max(sy, 1e-4), Math.max(sz, 1e-4)));
    }
    // a rotated member between two points, w x h in section (crane lattice, braces)
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
    function beamMatrix(a, b, w, h = w) {
      _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]);
      const len = _a.distanceTo(_b);
      const dir = _b.clone().sub(_a).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(_up, dir);
      return new THREE.Matrix4().compose(_a.clone().add(_b).multiplyScalar(0.5), q, new THREE.Vector3(w, len, h));
    }

    /* ---------- kit shapes (normalised to a unit cube, like the box) ---------- */
    function mergeBoxes(list) {   // [cx, cy, cz, sx, sy, sz] in unit-cube space
      const pos = [], nrm = [], uv = [], idx = [];
      for (const [cx, cy, cz, sx, sy, sz] of list) {
        const g = new THREE.BoxGeometry(sx, sy, sz).translate(cx, cy, cz);
        const base = pos.length / 3;
        pos.push(...g.attributes.position.array);
        nrm.push(...g.attributes.normal.array);
        uv.push(...g.attributes.uv.array);
        for (const k of g.index.array) idx.push(base + k);
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      return geo;
    }
    // a column cage: four bars and sixteen ties, for a 0.28 m square cage
    const cageGeo = (() => {
      const L = [], b = 0.09, r = 0.5 - b / 2;
      for (const [x, z] of [[-r, -r], [r, -r], [r, r], [-r, r]]) L.push([x, 0, z, b, 1, b]);
      for (let k = 0; k < 16; k++) {
        const y = -0.5 + (k + 0.5) / 16, t = 0.035, w = 0.006;
        L.push([0, y, -0.5 + t / 2, 1, w, t], [0, y, 0.5 - t / 2, 1, w, t], [-0.5 + t / 2, y, 0, t, w, 1], [0.5 - t / 2, y, 0, t, w, 1]);
      }
      return mergeBoxes(L);
    })();
    // a heap of loose material: rounded top, ~33 degree flanks, irregular toe
    function moundGeo() {
      const seg = 56, rings = 18, pos = [], uv = [], idx = [];
      const a1 = rr(0, 6.28), a2 = rr(0, 6.28), a3 = rr(0, 6.28);
      const edge = (th) => 1 + 0.09 * Math.sin(2 * th + a1) + 0.06 * Math.sin(3 * th + a2) + 0.035 * Math.sin(7 * th + a3);
      for (let i = 0; i <= rings; i++) {
        const t = i / rings;
        for (let j = 0; j <= seg; j++) {
          const th = (j / seg) * Math.PI * 2, r = 0.47 * t * edge(th);
          let h = t < 0.18 ? 1 - 0.55 * t * t / 0.18 : (1 - t) / 0.82 * 0.9;
          h *= 1 + 0.05 * Math.sin(9 * th + 13 * t + a1) * Math.sin(Math.PI * t);
          if (i === rings) h = 0;
          pos.push(Math.cos(th) * r, h - 0.5, Math.sin(th) * r);
          uv.push(j / seg, t);
        }
      }
      for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
        const a = i * (seg + 1) + j, b = a + seg + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }
    const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1);

    batch('pit', MAT.pit, { shadow: false });
    batch('conc', MAT.conc);
    batch('stoneclad', MAT.stoneclad);
    batch('brick', MAT.brick);
    batch('rebar', MAT.rebar);
    batch('cage', MAT.rebar, { geo: cageGeo });
    batch('ply', MAT.ply);
    batch('galv', MAT.galv);
    batch('board', MAT.board);
    batch('pave', MAT.pave);
    batch('wood', MAT.wood);
    batch('bronze', MAT.bronze);
    batch('champ', MAT.champ);
    batch('dark', MAT.dark);
    batch('room', MAT.room, { shadow: false, noAO: true });
    batch('pool', MAT.pool);
    batch('paint', MAT.paint);
    batch('yellow', MAT.yellow);
    batch('sand', MAT.sand, { geo: moundGeo() });
    batch('tank', surface({ a: 'ribs', ca: '#2D2F31', ra: 0.5, bump: 2.0, jitter: 0 }), { geo: cylGeo });
    batch('lamp', surface({ a: 'plaster', ca: '#F6EEDD', ra: 0.4, glow: 3.2 }), { shadow: false, geo: cylGeo });
    batch('bollard', MAT.bronze, { geo: cylGeo });
    batch('glass', MAT.glass, { shadow: false, noAO: true, order: 3 });

    /* ---------- the villa (metres; x right, y up, z towards the garden) ---------- */
    const GX = [-6.75, -2.25, 2.25, 6.75];
    const GZ = [-5.5, -1.5, 2.5, 5.5];
    const PL = 0.9, L1 = 4.2, L2 = 7.5, L3 = 10.8;
    const COL = 0.36, BW = 0.3, BD = 0.45, SL = 0.2, WT = 0.23;
    const FF = { x0: -8.25, x1: 6.75, z0: -5.5, z1: 7.5 };
    const SF = { x0: -2.25, x1: 6.75, z0: -5.5, z1: 2.5 };
    const RF = { x0: SF.x0 - 0.6, x1: SF.x1 + 0.6, z0: SF.z0 - 0.6, z1: SF.z1 + 1.7 };
    const g1 = L1 - BD, g2 = L2 - BD, g3 = L3 - BD;
    const TUCK = 0.005;                    // members cast with a slab stop just below its top face
    const TMP = { edge: 0, gh: false };     // temporary works: no gold, not in the drawing
    const near = (x, z, xs, zs, r) => xs.some((cx) => zs.some((cz) => Math.abs(x - cx) < r && Math.abs(z - cz) < r));
    let i;

    // 02 Foundation: pits dug below the ground, blinding, bar mats, footings, starter
    // cages and pedestals, then backfill and the plinth beams
    const PIT = 1.15, PB = -1.15;           // pit half-size and bottom level
    i = 0;
    for (const z of GZ) for (const x of GX) {
      const k = i * 0.0012, pit = { ...TMP, t: 0.161, d: 0.004, g: 'none', o: 0.262, od: 0.002 };
      add('pit', [x - PIT, x + PIT, PB - 0.03, PB, z - PIT, z + PIT], pit);
      add('pit', [x - PIT, x + PIT, PB, 0, z - PIT - 0.03, z - PIT], pit);
      add('pit', [x - PIT, x + PIT, PB, 0, z + PIT, z + PIT + 0.03], pit);
      add('pit', [x - PIT - 0.03, x - PIT, PB, 0, z - PIT, z + PIT], pit);
      add('pit', [x + PIT, x + PIT + 0.03, PB, 0, z - PIT, z + PIT], pit);
      add('conc', [x - 0.9, x + 0.9, PB, PB + 0.06, z - 0.9, z + 0.9], { ...TMP, t: 0.168 + k, d: 0.006, g: 'none', o: 0.262, od: 0.002 });
      for (let j = 0; j < 6; j++) {
        const o = -0.62 + j * 0.248, y = PB + 0.13;
        add('rebar', [x - 0.72, x + 0.72, y, y + 0.024, z + o - 0.012, z + o + 0.012], { ...TMP, t: 0.173 + k + j * 0.0005, d: 0.005, g: 'x', o: 0.262, od: 0.002 });
        add('rebar', [x + o - 0.012, x + o + 0.012, y + 0.024, y + 0.048, z - 0.72, z + 0.72], { ...TMP, t: 0.176 + k + j * 0.0005, d: 0.005, g: 'z', o: 0.262, od: 0.002 });
      }
      add('conc', [x - 0.8, x + 0.8, PB + 0.06, PB + 0.45, z - 0.8, z + 0.8], { t: 0.183 + i * 0.0022, d: 0.004, p: 0.186 + i * 0.0022, pd: 0.012, gh: false, o: 0.262, od: 0.002 });
      add('cage', [x - 0.14, x + 0.14, PB + 0.45, PL + 0.9, z - 0.14, z + 0.14], { ...TMP, t: 0.2 + i * 0.0014, d: 0.002, p: 0.2 + i * 0.0014, pd: 0.01 });
      add('conc', [x - 0.22, x + 0.22, PB + 0.45, PL - 2 * TUCK, z - 0.22, z + 0.22], { t: 0.216 + i * 0.0016, d: 0.004, p: 0.218 + i * 0.0016, pd: 0.01, gh: false });
      i++;
    }
    GZ.forEach((z, k) => {
      for (const sd of [-1, 1]) add('ply', [GX[0] - 0.25, GX[3] + 0.25, 0.5, PL + 0.05, z + sd * (BW / 2 + 0.015) - 0.015, z + sd * (BW / 2 + 0.015) + 0.015], { ...TMP, t: 0.232 + k * 0.002, d: 0.008, g: 'x', o: 0.27, od: 0.008 });
      add('stoneclad', [GX[0], GX[3], 0.55, PL - TUCK, z - BW / 2, z + BW / 2], { t: 0.238 + k * 0.004, d: 0.003, g: 'x', p: 0.25 + k * 0.004, pd: 0.012, ax: 1, fin: 1, gh: false });
    });
    GX.forEach((x, k) => {
      for (const sd of [-1, 1]) add('ply', [x + sd * (BW / 2 + 0.015) - 0.015, x + sd * (BW / 2 + 0.015) + 0.015, 0.5, PL + 0.05, GZ[0] - 0.25, GZ[3] + 0.25], { ...TMP, t: 0.235 + k * 0.002, d: 0.008, g: 'z', o: 0.272, od: 0.008 });
      add('stoneclad', [x - BW / 2, x + BW / 2, 0.55, PL - TUCK, GZ[0], GZ[3]], { t: 0.242 + k * 0.004, d: 0.003, g: 'z', p: 0.254 + k * 0.004, pd: 0.012, ax: 2, fin: 1, gh: false });
    });
    // plinth walls down to the ground, clad in stone at the finishes
    add('stoneclad', [GX[0] - 0.15, GX[3] + 0.15, 0, 0.55, GZ[3] - 0.15, GZ[3] + 0.15], { t: 0.262, d: 0.012, g: 'x', fin: 1 });
    add('stoneclad', [GX[0] - 0.15, GX[3] + 0.15, 0, 0.55, GZ[0] - 0.15, GZ[0] + 0.15], { t: 0.264, d: 0.012, g: 'x', fin: 1 });
    add('stoneclad', [GX[0] - 0.15, GX[0] + 0.15, 0, 0.55, GZ[0], GZ[3]], { t: 0.266, d: 0.012, g: 'z', fin: 1 });
    add('stoneclad', [GX[3] - 0.15, GX[3] + 0.15, 0, 0.55, GZ[0], GZ[3]], { t: 0.268, d: 0.012, g: 'z', fin: 1 });
    add('stoneclad', [GX[0], GX[3], 0.74, PL, GZ[0], GZ[3]], { t: 0.27, d: 0.006, g: 'z', p: 0.276, pd: 0.016, ax: 1, fin: 1 });

    // 03 Frame. A floor = cages, columns poured into their outlines, props and a ply
    // deck, edge forms, bar mesh, then beams and slab poured across.
    function columns(xs, zs, y0, y1, t, step, cont = () => false) {
      let n = 0;
      for (const z of zs) for (const x of xs) {
        add('cage', [x - 0.13, x + 0.13, y0, y1 + (cont(x, z) ? 0.6 : 0.02), z - 0.13, z + 0.13], { ...TMP, t: t + n * step * 0.7, d: 0.002, p: t + n * step * 0.7, pd: 0.01 });
        add('conc', [x - COL / 2, x + COL / 2, y0, y1 - TUCK, z - COL / 2, z + COL / 2], { t: t + 0.008 + n * step, d: 0.004, p: t + 0.011 + n * step, pd: 0.013, fin: 1 });
        n++;
      }
    }
    function shoring(r, inside, base0, top, t, out, onlyInside = false) {
      const xs = [], zs = [];
      for (let x = r.x0 + 0.4; x <= r.x1 - 0.3; x += 1.25) xs.push(x);
      for (let z = r.z0 + 0.4; z <= r.z1 - 0.3; z += 1.25) zs.push(z);
      for (const z of zs) {
        add('board', [r.x0, r.x1, top - 0.1, top, z - 0.05, z + 0.05], { ...TMP, t: t + 0.004, d: 0.008, g: 'x', o: out + 0.004, od: 0.008 });
        for (const x of xs) {
          if (near(x, z, GX, GZ, 0.45) || (onlyInside && !inside(x, z))) continue;
          const base = inside(x, z) ? base0 : 0;
          add('galv', [x - 0.03, x + 0.03, base, top - 0.1, z - 0.03, z + 0.03], { ...TMP, t: t + ((x - r.x0) / (r.x1 - r.x0)) * 0.005, d: 0.005, o: out + rnd() * 0.008, od: 0.006 });
        }
      }
      add('ply', [r.x0, r.x1, top, top + 0.025, r.z0, r.z1], { ...TMP, t: t + 0.008, d: 0.01, g: 'x', o: out, od: 0.01 });
    }
    function edgeForms(r, y0, y1, t, out) {
      const k = 0.03;
      add('ply', [r.x0 - k, r.x1 + k, y0, y1, r.z1, r.z1 + k], { ...TMP, t, d: 0.008, g: 'x', o: out, od: 0.006 });
      add('ply', [r.x0 - k, r.x1 + k, y0, y1, r.z0 - k, r.z0], { ...TMP, t, d: 0.008, g: 'x', o: out, od: 0.006 });
      add('ply', [r.x0 - k, r.x0, y0, y1, r.z0, r.z1], { ...TMP, t, d: 0.008, g: 'z', o: out, od: 0.006 });
      add('ply', [r.x1, r.x1 + k, y0, y1, r.z0, r.z1], { ...TMP, t, d: 0.008, g: 'z', o: out, od: 0.006 });
    }
    function barMesh(r, y, t) {
      for (let z = r.z0 + 0.12, n = 0; z < r.z1 - 0.05; z += 0.3, n++) add('rebar', [r.x0 + 0.05, r.x1 - 0.05, y, y + 0.02, z - 0.01, z + 0.01], { ...TMP, t: t + n * 0.00012, d: 0.006, g: 'x' });
      for (let x = r.x0 + 0.12, n = 0; x < r.x1 - 0.05; x += 0.3, n++) add('rebar', [x - 0.01, x + 0.01, y + 0.02, y + 0.04, r.z0 + 0.05, r.z1 - 0.05], { ...TMP, t: t + 0.003 + n * 0.00012, d: 0.006, g: 'z' });
    }
    function beams(r, xs, zs, top, depth, t, p, step) {
      zs.forEach((z, k) => add('conc', [r.x0, r.x1, top - depth, top - TUCK, z - BW / 2, z + BW / 2], { t: t + k * step, d: 0.003, g: 'x', p: p + k * step, pd: 0.01, ax: 1, fin: 1, gh: false }));
      xs.forEach((x, k) => add('conc', [x - BW / 2, x + BW / 2, top - depth - 0.002, top - TUCK - 0.002, r.z0, r.z1], { t: t + 0.002 + k * step, d: 0.003, g: 'z', p: p + 0.002 + k * step, pd: 0.01, ax: 2, fin: 1, gh: false }));
    }
    const inGF = (x, z) => x > GX[0] && x < GX[3] && z > GZ[0] && z < GZ[3];
    const inFF = (x, z) => x > FF.x0 && x < FF.x1 && z > FF.z0 && z < FF.z1;
    const inSF = (x, z) => x > SF.x0 && x < SF.x1 && z > SF.z0 && z < SF.z1;
    const FZ = [FF.z0, -1.5, 2.5, 5.5, FF.z1], FXL = [FF.x0, -6.75, -2.25, 2.25, 6.75];
    // ground floor
    columns(GX, GZ, PL, L1, 0.298, 0.0021, () => true);
    shoring(FF, inGF, PL, L1 - SL - 0.03, 0.33, 0.4);
    edgeForms(FF, L1 - SL - 0.03, L1 + 0.04, 0.342, 0.394);
    barMesh(FF, L1 - 0.08, 0.346);
    beams(FF, FXL, FZ, L1, BD, 0.352, 0.36, 0.0025);
    add('conc', [FF.x0, FF.x1, L1 - SL, L1, FF.z0, FF.z1], { t: 0.364, d: 0.004, g: 'z', p: 0.368, pd: 0.02, ax: 1, fin: 1 });
    // first floor
    columns(GX, GZ, L1, L2, 0.392, 0.0018, (x, z) => x > -3 && z < 3);
    shoring(FF, inFF, L1, L2 - SL - 0.03, 0.422, 0.476);
    edgeForms(FF, L2 - SL - 0.03, L2 + 0.04, 0.43, 0.47);
    barMesh(FF, L2 - 0.08, 0.433);
    beams(FF, FXL, FZ, L2, BD, 0.438, 0.444, 0.002);
    add('conc', [FF.x0, FF.x1, L2 - SL, L2, FF.z0, FF.z1], { t: 0.448, d: 0.004, g: 'z', p: 0.452, pd: 0.014, ax: 1, fin: 1 });
    // pavilion
    const SFX = [-2.25, 2.25, 6.75], SFZ = [-5.5, -1.5, 2.5];
    columns(SFX, SFZ, L2, L3, 0.462, 0.0014);
    shoring(RF, inFF, L2, L3 - 0.27, 0.476, 0.503, true);
    edgeForms(RF, L3 - 0.27, L3 + 0.04, 0.479, 0.5);
    barMesh(RF, L3 - 0.08, 0.481);
    beams(SF, SFX, SFZ, L3 - 0.05, BD - 0.05, 0.482, 0.486, 0.0015);
    add('conc', [RF.x0, RF.x1, L3 - 0.24, L3, RF.z0, RF.z1], { t: 0.487, d: 0.003, g: 'z', p: 0.489, pd: 0.009, ax: 1, fin: 1 });
    // stair and lift core, slip-formed as the frame rises; clad in stone
    add('stoneclad', [4.35, 6.905, PL, 12.1, -5.655, -2.9], { t: 0.302, d: 0.004, p: 0.32, pd: 0.178, fin: 1 });

    // 04 Masonry: brick walls laid course by course, plastered at the finishes
    const wall = (b, t) => add('brick', b, { t, d: 0.003, p: t + 0.004, pd: 0.026, q: 0.0857, fin: 1 });
    const wallX = (z, x0, x1, y0, y1, t) => wall([x0, x1, y0, y1, z - WT / 2, z + WT / 2], t);
    const wallZ = (x, z0, z1, y0, y1, t) => wall([x - WT / 2, x + WT / 2, y0, y1, z0, z1], t);
    wallX(-5.5, -6.57, -2.43, PL, g1, 0.502); wallX(-5.5, -2.07, 2.07, PL, g1, 0.505); wallX(-5.5, 2.43, 4.35, PL, g1, 0.508);
    wallZ(-6.75, -5.32, -1.68, PL, g1, 0.511); wallZ(-6.75, 2.68, 5.32, PL, g1, 0.514);
    wallZ(6.75, -2.9, -1.68, PL, g1, 0.516); wallZ(6.75, -1.32, 2.32, PL, g1, 0.518);
    wallX(-5.5, -8.25, -6.93, L1, g2, 0.528); wallX(-5.5, -6.57, -2.43, L1, g2, 0.531); wallX(-5.5, 2.43, 4.35, L1, g2, 0.534);
    wallZ(FF.x0, -5.5, -1.5, L1, g2, 0.537); wallZ(FF.x0, 3.0, 7.5, L1, g2, 0.54);
    wallZ(FF.x0, -1.5, 3.0, L1, L1 + 0.9, 0.541);
    wallZ(6.75, -2.9, -1.68, L1, g2, 0.543); wallZ(6.75, -1.32, 2.32, L1, g2, 0.546); wallZ(6.75, 5.5, 7.5, L1, g2, 0.549);
    wallX(-5.5, -2.07, 2.07, L2, g3, 0.57); wallX(-5.5, 2.43, 4.35, L2, g3, 0.573);
    wallZ(-2.25, -5.32, -1.68, L2, g3, 0.576); wallZ(6.75, -2.9, -1.68, L2, g3, 0.579);
    // terrace upstands and the roof parapet
    wall([FF.x0, SF.x0, L2, L2 + 0.25, FF.z0 - 0.0, FF.z0 + 0.2], 0.582);
    wall([FF.x0, FF.x0 + 0.2, L2, L2 + 0.25, FF.z0, FF.z1], 0.584);
    wall([FF.x0, FF.x1, L2, L2 + 0.25, FF.z1 - 0.2, FF.z1], 0.586);
    wall([FF.x1 - 0.2, FF.x1, L2, L2 + 0.25, SF.z1, FF.z1], 0.588);

    // 05 Envelope: champagne-framed glazing with the rooms behind, membranes,
    // balustrades, teak fins, pergola, brass trims
    function opening(axis, c, a0, a1, y0, y1, t, o = {}) {
      const F = 0.065, D = 0.14, n = o.n || Math.max(1, Math.round((a1 - a0) / 2.1));
      const B = (u0, u1, v0, v1, d0, d1) => (axis === 'x' ? [u0, u1, v0, v1, c + d0, c + d1] : [c + d0, c + d1, v0, v1, u0, u1]);
      const fr = { t, d: 0.01, edge: 0.7, gh: false };
      add('champ', B(a0, a1, y1 - F, y1, -D / 2, D / 2), { ...fr, g: axis });
      add('champ', B(a0, a1, y0, y0 + F, -D / 2, D / 2), { ...fr, g: axis });
      for (let k = 0; k <= n; k++) {
        const u = a0 + ((a1 - a0) * k) / n;
        const u0 = k === 0 ? a0 : k === n ? a1 - F : u - F / 2;
        add('champ', B(u0, u0 + F, y0 + F, y1 - F, -D / 2, D / 2), { ...fr, t: t + 0.002 + k * 0.0008 });
      }
      for (let k = 0; k < n; k++) {
        const u0 = a0 + ((a1 - a0) * k) / n + (k === 0 ? F : F / 2);
        const u1 = a0 + ((a1 - a0) * (k + 1)) / n - (k === n - 1 ? F : F / 2);
        add('glass', B(u0, u1, y0 + F, y1 - F, -0.012, 0.012), { t: t + 0.008 + k * 0.001, d: 0.014, fin: o.glow ?? 1 });
      }
    }
    const room = (b, t) => add('room', b, { t, d: 0.004, g: 'none', edge: 0, gh: false, fin: 1 });
    // the room volumes stand clear of the slabs and walls: surfaces that coincide flicker
    const RI = 0.2, RY = 0.03;
    room([GX[0] + RI, GX[3] - RI, PL + RY, L1 - SL - RY, GZ[0] + RI, GZ[3] - RI], 0.618);
    room([FF.x0 + RI, FF.x1 - RI, L1 + RY, L2 - SL - RY, FF.z0 + RI, FF.z1 - RI], 0.636);
    room([SF.x0 + RI, SF.x1 - RI, L2 + RY, L3 - 0.24 - RY, SF.z0 + RI, SF.z1 - RI], 0.652);
    // ground floor: sliders to the garden, side windows
    opening('x', GZ[3], -6.57, -2.43, PL, g1, 0.622, { n: 2 });
    opening('x', GZ[3], -2.07, 2.07, PL, g1, 0.626, { n: 2 });
    opening('x', GZ[3], 2.43, 6.57, PL, g1, 0.63, { n: 2 });
    opening('z', GX[0], -1.32, 2.32, PL, g1, 0.634, { n: 2 });
    opening('z', GX[3], 2.68, 5.32, PL, g1, 0.636, { n: 1 });
    // first floor: a glass front behind teak fins, side and back windows
    opening('x', FF.z1, -8.25, -4.5, L1, g2, 0.64, { n: 2 });
    opening('x', FF.z1, -4.5, -0.75, L1, g2, 0.642, { n: 2 });
    opening('x', FF.z1, -0.75, 3.0, L1, g2, 0.644, { n: 2 });
    opening('x', FF.z1, 3.0, 6.75, L1, g2, 0.646, { n: 2 });
    opening('z', FF.x0, -1.5, 3.0, L1 + 0.9, g2, 0.648, { n: 2 });
    opening('x', GZ[0], -2.07, 2.07, L1, g2, 0.65, { n: 2 });
    opening('z', GX[3], 2.68, 5.5, L1, g2, 0.652, { n: 1 });
    // pavilion
    opening('x', SF.z1, -2.07, 2.07, L2, g3, 0.656, { n: 2 });
    opening('x', SF.z1, 2.43, 6.57, L2, g3, 0.658, { n: 2 });
    opening('z', SF.x0, -1.32, 2.32, L2, g3, 0.66, { n: 2 });
    opening('z', SF.x1, -1.32, 2.32, L2, g3, 0.662, { n: 2 });
    // waterproofing membranes (paved over at the finishes)
    add('dark', [FF.x0 + 0.2, SF.x0, L2, L2 + 0.012, FF.z0 + 0.2, FF.z1 - 0.2], { ...TMP, t: 0.6, d: 0.01, g: 'z' });
    add('dark', [SF.x0, FF.x1 - 0.2, L2, L2 + 0.012, SF.z1, FF.z1 - 0.2], { ...TMP, t: 0.604, d: 0.008, g: 'x' });
    add('dark', [RF.x0, RF.x1, L3, L3 + 0.012, RF.z0, RF.z1], { ...TMP, t: 0.607, d: 0.01, g: 'z' });
    // terrace balustrade: glass on the upstands, brass handrail
    const BY0 = L2 + 0.25, BY1 = L2 + 1.1;
    add('glass', [FF.x0 + 0.088, FF.x0 + 0.112, BY0, BY1, FF.z0 + 0.2, FF.z1 - 0.2], { t: 0.69, d: 0.012, fin: 0 });
    add('glass', [FF.x0 + 0.2, FF.x1 - 0.2, BY0, BY1, FF.z1 - 0.112, FF.z1 - 0.088], { t: 0.692, d: 0.012, fin: 0 });
    add('glass', [FF.x1 - 0.112, FF.x1 - 0.088, BY0, BY1, SF.z1, FF.z1 - 0.2], { t: 0.694, d: 0.012, fin: 0 });
    add('glass', [FF.x0 + 0.2, SF.x0, BY0, BY1, FF.z0 + 0.088, FF.z0 + 0.112], { t: 0.696, d: 0.012, fin: 0 });
    const rail = { d: 0.012, edge: 0.7 };
    add('champ', [FF.x0 + 0.07, FF.x0 + 0.13, BY1, BY1 + 0.05, FF.z0 + 0.07, FF.z1 - 0.07], { ...rail, t: 0.698, g: 'z' });
    add('champ', [FF.x0 + 0.07, FF.x1 - 0.07, BY1, BY1 + 0.05, FF.z1 - 0.13, FF.z1 - 0.07], { ...rail, t: 0.7, g: 'x' });
    add('champ', [FF.x1 - 0.13, FF.x1 - 0.07, BY1, BY1 + 0.05, SF.z1, FF.z1 - 0.07], { ...rail, t: 0.702, g: '-z' });
    add('champ', [FF.x0 + 0.07, SF.x0, BY1, BY1 + 0.05, FF.z0 + 0.07, FF.z0 + 0.13], { ...rail, t: 0.703, g: 'x' });
    // polished brass fascia lines at each slab edge
    add('champ', [FF.x0 - 0.015, FF.x1 + 0.015, L1 - 0.07, L1 - 0.035, FF.z1, FF.z1 + 0.016], { ...rail, t: 0.706, g: 'x' });
    add('champ', [RF.x0 - 0.015, RF.x1 + 0.015, L3 - 0.07, L3 - 0.035, RF.z1, RF.z1 + 0.016], { ...rail, t: 0.708, g: 'x' });
    add('champ', [RF.x0 - 0.016, RF.x0, L3 - 0.07, L3 - 0.035, RF.z0, RF.z1], { ...rail, t: 0.709, g: 'z' });
    // teak fins in front of the first-floor glass
    i = 0;
    for (let x = -8.0; x <= 6.55; x += 0.75) {
      add('wood', [x - 0.045, x + 0.045, L1 - 0.15, L2 - 0.05, FF.z1 + 0.12, FF.z1 + 0.56], { t: 0.664 + i * 0.0014, d: 0.016, fin: 1 });
      i++;
    }
    add('wood', [FF.x0 - 0.05, FF.x1 + 0.05, L2 - 0.12, L2 - 0.02, FF.z1 + 0.1, FF.z1 + 0.6], { t: 0.684, d: 0.012, g: 'x', fin: 1 });
    // terrace pergola: bronze frame, teak slats
    [[-8.0, -1.3], [-8.0, 5.3], [-2.6, -1.3], [-2.6, 5.3]].forEach(([x, z], k) =>
      add('bronze', [x - 0.07, x + 0.07, L2 + 0.05, L2 + 2.7, z - 0.07, z + 0.07], { t: 0.71 + k * 0.002, d: 0.012 }));
    add('bronze', [-8.1, -2.5, L2 + 2.55, L2 + 2.7, -1.38, -1.22], { t: 0.716, d: 0.01, g: 'x' });
    add('bronze', [-8.1, -2.5, L2 + 2.55, L2 + 2.7, 5.22, 5.38], { t: 0.718, d: 0.01, g: 'x' });
    i = 0;
    for (let x = -7.85; x <= -2.7; x += 0.43) {
      add('wood', [x - 0.04, x + 0.04, L2 + 2.7, L2 + 2.86, -1.5, 5.5], { t: 0.72 + i * 0.0014, d: 0.012, g: 'z', fin: 1, gh: false });
      i++;
    }

    // 06 Finishes and landscape: pavers, pool, boundary walls, paths, garden lights
    add('pave', [FF.x0 + 0.2, SF.x0, L2 + 0.012, L2 + 0.05, FF.z0 + 0.2, FF.z1 - 0.2], { t: 0.786, d: 0.012, g: 'z' });
    add('pave', [SF.x0, FF.x1 - 0.2, L2 + 0.012, L2 + 0.05, SF.z1, FF.z1 - 0.2], { t: 0.79, d: 0.008, g: 'x' });
    add('pave', [RF.x0 + 0.05, RF.x1 - 0.05, L3 + 0.012, L3 + 0.04, RF.z0 + 0.05, RF.z1 - 0.05], { t: 0.792, d: 0.01, g: 'z' });
    add('pave', [GX[0] - 0.005, GX[3] + 0.005, 0.6, PL, GZ[3], 8.6], { t: 0.79, d: 0.014, g: 'z' });
    add('pave', [-2.2, 2.2, 0, 0.675, 8.6, 8.95], { t: 0.798, d: 0.008 });
    add('pave', [-2.2, 2.2, 0, 0.45, 8.95, 9.3], { t: 0.801, d: 0.008 });
    add('pave', [-2.2, 2.2, 0, 0.225, 9.3, 9.65], { t: 0.804, d: 0.008 });
    const PX0 = -5.5, PX1 = 4.5, PZ0 = 10.7, PZ1 = 13.7, CP = 0.45, PD = 1.25;
    add('pool', [PX0, PX1, -PD - 0.05, -PD, PZ0, PZ1], { t: 0.8, d: 0.008, g: 'x', edge: 0.6, gh: false });
    add('pool', [PX0 - 0.2, PX0, -PD - 0.05, 0, PZ0 - 0.2, PZ1 + 0.2], { t: 0.802, d: 0.008, edge: 0.6, gh: false });
    add('pool', [PX1, PX1 + 0.2, -PD - 0.05, 0, PZ0 - 0.2, PZ1 + 0.2], { t: 0.803, d: 0.008, edge: 0.6, gh: false });
    add('pool', [PX0, PX1, -PD - 0.05, 0, PZ0 - 0.2, PZ0], { t: 0.804, d: 0.008, edge: 0.6, gh: false });
    add('pool', [PX0, PX1, -PD - 0.05, 0, PZ1, PZ1 + 0.2], { t: 0.805, d: 0.008, edge: 0.6, gh: false });
    add('pave', [PX0 - CP, PX1 + CP, 0, 0.14, PZ0 - CP, PZ0], { t: 0.806, d: 0.01, g: 'x' });
    add('pave', [PX0 - CP, PX1 + CP, 0, 0.14, PZ1, PZ1 + CP], { t: 0.808, d: 0.01, g: '-x' });
    add('pave', [PX0 - CP, PX0, 0, 0.14, PZ0, PZ1], { t: 0.81, d: 0.008, g: 'z' });
    add('pave', [PX1, PX1 + CP, 0, 0.14, PZ0, PZ1], { t: 0.812, d: 0.008, g: '-z' });
    add('pave', [-1.1, 1.1, 0, 0.035, 9.65, PZ0 - CP], { t: 0.806, d: 0.006, g: 'z' });
    add('pave', [PX1 + CP, PX1 + CP + 1.4, 0, 0.035, 9.65, 15.0], { t: 0.809, d: 0.01, g: 'z' });
    add('pave', [7.9, 12.4, 0, 0.03, -8.9, -2.6], { t: 0.812, d: 0.012, g: 'z', gh: false });
    add('stoneclad', [-13.0, 13.0, 0, 1.6, -9.6, -9.4], { t: 0.82, d: 0.02, g: 'x', fin: 1 });
    add('stoneclad', [-13.1, -12.9, 0, 1.6, -9.4, 15.0], { t: 0.824, d: 0.02, g: 'z', fin: 1 });
    add('champ', [-13.0, 13.0, 1.6, 1.63, -9.62, -9.38], { t: 0.83, d: 0.012, g: 'x', edge: 0.6 });
    [[-6.2, 9.2], [5.6, 9.2]].forEach(([x, z], k) => add('stoneclad', [x - 0.45, x + 0.45, 0, 0.7, z - 0.32, z + 0.32], { t: 0.828 + k * 0.004, d: 0.01, fin: 1 }));
    // garden lights on the lawn and paths around the pool (never in the water)
    const LAMPS = [[-2.6, 9.95], [2.6, 9.95], [-6.45, 11.2], [-6.45, 13.2], [6.15, 10.6], [6.15, 13.6], [-3.5, 14.7], [0.5, 14.7], [-7.2, 6.4], [7.2, 6.4], [-11.4, 6.0], [10.2, 8.4]];
    LAMPS.forEach(([x, z]) => {
      if (x > PX0 - CP - 0.1 && x < PX1 + CP + 0.1 && z > PZ0 - CP - 0.1 && z < PZ1 + CP + 0.1) console.warn('[build] garden light inside the pool area', x, z);
    });
    LAMPS.forEach(([x, z], k) => {
      const t = 0.846 + k * 0.0012;
      add('bollard', [x - 0.06, x + 0.06, 0, 0.5, z - 0.06, z + 0.06], { t, d: 0.008, gh: false, edge: 0 });
      add('lamp', [x - 0.052, x + 0.052, 0.5, 0.62, z - 0.052, z + 0.052], { t, d: 0.008, fin: 1, edge: 0, gh: false });
      add('bollard', [x - 0.068, x + 0.068, 0.62, 0.68, z - 0.068, z + 0.068], { t, d: 0.008, gh: false, edge: 0 });
    });

    /* ---------- temporary works: scaffolding, site set-up, stock ---------- */
    // Tube-and-board scaffold along one face. dir 'x': the face is the plane z = c, run
    // along x from a0 to a1; dir 'z': the plane x = c. out = +1 / -1 points away from
    // the building; r0 = distance of the inner standards from the face.
    function scaffoldRun(dir, c, a0, a1, out, y0, lifts, t0, o0, r0 = 0.35) {
      const r1 = r0 + 0.95, T = 0.021;
      const B = (s0, s1, q0, q1, v0, v1) => {
        const p0 = c + out * q0, p1 = c + out * q1, lo = Math.min(p0, p1), hi = Math.max(p0, p1);
        return dir === 'x' ? [s0, s1, v0, v1, lo, hi] : [lo, hi, v0, v1, s0, s1];
      };
      const len = a1 - a0, n = Math.max(1, Math.round(len / 2.1)), nl = lifts.length;
      const top = lifts[nl - 1] + 1.05, dur = 0.05, odur = 0.028;
      for (let k = 0; k <= n; k++) {
        const s = a0 + (len * k) / n;
        for (const r of [r0, r1]) add('galv', B(s - T, s + T, r - T, r + T, y0, top), { ...TMP, t: t0, d: dur, o: o0, od: odur });
      }
      lifts.forEach((y, l) => {
        const tl = t0 + ((l + 0.6) / nl) * dur, ol = o0 + (1 - (l + 1) / nl) * odur * 0.9;
        const lo = { ...TMP, t: tl, d: 0.006, g: dir, o: ol, od: 0.005 };
        add('galv', B(a0 - 0.15, a1 + 0.15, r0 - T, r0 + T, y - T, y + T), lo);
        add('galv', B(a0 - 0.15, a1 + 0.15, r1 - T, r1 + T, y - T, y + T), lo);
        add('galv', B(a0 - 0.15, a1 + 0.15, r1 - T, r1 + T, y + 1.0 - T, y + 1.0 + T), lo);
        add('board', B(a0, a1, r0 + 0.03, r1 - 0.03, y + T, y + T + 0.04), { ...lo, t: tl + 0.003 });
        add('board', B(a0, a1, r1 - 0.04, r1 - 0.015, y + T, y + T + 0.15), { ...lo, t: tl + 0.004 });
        for (let k = 0; k <= n; k++) {
          const s = a0 + (len * k) / n;
          add('galv', B(s - T, s + T, r0 - 0.1, r1 + 0.1, y - 3 * T, y - T), { ...TMP, t: tl, d: 0.004, g: 'none', o: ol, od: 0.005 });
        }
      });
    }
    const LIFT_LO = [2.0, 4.1, 6.1, 8.1], LIFT_HI = [2.0, 4.1, 6.1, 8.1, 10.1, 11.7];
    scaffoldRun('x', FF.z1, FF.x0, FF.x1, 1, 0, LIFT_LO, 0.5, 0.8, 0.75);
    scaffoldRun('z', FF.x0, FF.z0, FF.z1, -1, 0, LIFT_LO, 0.503, 0.802);
    scaffoldRun('x', FF.z0, FF.x0, SF.x0, -1, 0, LIFT_LO, 0.506, 0.804, 0.5);
    scaffoldRun('x', FF.z0, SF.x0, FF.x1, -1, 0, LIFT_HI, 0.506, 0.8, 0.5);
    scaffoldRun('z', FF.x1, SF.z1, FF.z1, 1, 0, LIFT_LO, 0.509, 0.806, 0.5);
    scaffoldRun('z', FF.x1, FF.z0, SF.z1, 1, 0, LIFT_HI, 0.509, 0.8, 0.5);
    scaffoldRun('x', SF.z1, SF.x0, SF.x1, 1, L2, [9.6, 11.7], 0.535, 0.805, 0.5);
    scaffoldRun('z', SF.x0, SF.z0, SF.z1, -1, L2, [9.6, 11.7], 0.538, 0.806, 0.5);

    // site cabin, water tank, cement store, sand and aggregate, rebar stock, brick stacks
    batch('agg', surface({ a: 'soil', ca: '#C4C2BE', ra: 1, bump: 2.4 }), { geo: moundGeo() });
    const siteT = { ...TMP, d: 0.01, o: 0.8, od: 0.012 };
    batch('corr', surface({ a: 'corr', ca: '#E6E2D9', ra: 0.5, ma: 0.35, bump: 2.4, jitter: 0 }));
    add('board', [6.75, 6.95, 0, 0.1, -9.3, -6.66], { ...siteT, t: 0.136 });
    add('board', [12.3, 12.5, 0, 0.1, -9.3, -6.66], { ...siteT, t: 0.136 });
    add('corr', [6.6, 12.66, 0.1, 2.69, -9.2, -6.76], { ...siteT, t: 0.138 });
    add('galv', [6.58, 12.68, 2.69, 2.72, -9.22, -6.74], { ...siteT, t: 0.14 });
    add('dark', [7.25, 8.15, 0.16, 2.25, -6.765, -6.745], { ...siteT, t: 0.141 });
    add('galv', [9.35, 11.05, 1.0, 2.05, -6.772, -6.745], { ...siteT, t: 0.141 });
    add('glass', [9.42, 10.98, 1.07, 1.98, -6.78, -6.77], { ...siteT, t: 0.142, fin: 0 });
    add('board', [7.2, 8.2, 0, 0.12, -6.76, -6.3], { ...siteT, t: 0.142 });
    [[11.2, -6.2], [12.2, -6.2], [11.2, -5.2], [12.2, -5.2]].forEach(([x, z]) => add('galv', [x - 0.04, x + 0.04, 0, 2.3, z - 0.04, z + 0.04], { ...siteT, t: 0.146 }));
    add('galv', [11.05, 12.35, 2.3, 2.38, -6.35, -5.05], { ...siteT, t: 0.148 });
    add('tank', [11.1, 12.3, 2.38, 3.5, -6.3, -5.1], { ...siteT, t: 0.15, g: 'y' });
    add('sand', [8.2, 11.4, 0, 1.15, -3.6, -0.4], { ...siteT, t: 0.155, d: 0.012 });
    add('agg', [9.4, 12.2, 0, 0.95, 0.2, 2.8], { ...siteT, t: 0.158, d: 0.012 });
    for (let k = 0; k < 9; k++) add('rebar', [8.2, 12.6, 0.06 + (k % 3) * 0.035, 0.09 + (k % 3) * 0.035, 3.6 + Math.floor(k / 3) * 0.05 + k * 0.012, 3.63 + Math.floor(k / 3) * 0.05 + k * 0.012], { ...TMP, t: 0.168 + k * 0.0006, d: 0.008, g: 'x', o: 0.47, od: 0.01 });
    [[-10.4, 3.2], [-10.4, -1.4], [9.0, 5.6], [-3.2, 9.4], [3.6, 9.4]].forEach(([x, z], k) => {
      add('board', [x - 0.6, x + 0.6, 0, 0.12, z - 0.5, z + 0.5], { ...TMP, t: 0.47 + k * 0.003, d: 0.006, o: 0.6 + k * 0.002, od: 0.008 });
      add('brick', [x - 0.55, x + 0.55, 0.12, 1.05, z - 0.45, z + 0.45], { ...TMP, t: 0.473 + k * 0.003, d: 0.008, o: 0.545 + k * 0.012, od: 0.03 });
    });

    /* ---------- standalone kit meshes (crane, tree trunks) share the surface material ---------- */
    function kitMesh(geo, mat, n, o = {}) {
      const g = geo.clone();
      const fx = new Float32Array(n * 3), meta = new Float32Array(n * 2);
      for (let k = 0; k < n; k++) { fx[k * 3] = 1; meta[k * 2 + 1] = rnd(); }
      g.setAttribute('aFx', new THREE.InstancedBufferAttribute(fx, 3));
      g.setAttribute('aMeta', new THREE.InstancedBufferAttribute(meta, 2));
      const m = new THREE.InstancedMesh(g, mat, n);
      m.castShadow = o.shadow !== false;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.userData.noAO = !!o.noAO;
      return m;
    }
    function kitFromMatrices(list, mat, o) {
      const m = kitMesh(unitBox, mat, list.length, o);
      list.forEach((mx, k) => m.setMatrixAt(k, mx));
      m.instanceMatrix.needsUpdate = true;
      return m;
    }
    const boxM = (x0, x1, y0, y1, z0, z1) => new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion(), new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0));

    /* ---------- tower crane ---------- */
    const crane = new THREE.Group();
    crane.position.set(-2.0, 0, -8.7);
    const CH = 20.8, HS = 1.6, CA = 0.8;
    const mastList = [];
    {
      const cs = [[-CA, -CA], [CA, -CA], [CA, CA], [-CA, CA]];
      for (let y = 0; y < CH - 0.01; y += HS) {
        for (let k = 0; k < 4; k++) {
          const [x1, z1] = cs[k], [x2, z2] = cs[(k + 1) % 4];
          mastList.push(beamMatrix([x1, y, z1], [x1, y + HS, z1], 0.12));
          mastList.push(beamMatrix([x1, y + 0.05, z1], [x2, y + 0.05, z2], 0.07));
          mastList.push(beamMatrix([x1, y + 0.05, z1], [x2, y + HS - 0.05, z2], 0.06));
        }
      }
    }
    const mast = kitFromMatrices(mastList, MAT.yellow, { noAO: true });
    crane.add(mast);
    const slew = new THREE.Group();
    slew.position.y = CH;
    crane.add(slew);
    {
      const Y = [], P = [], G = [], C = [], D = [];
      const JL = 24, KL = 9, JH = 1.5, JW = 0.6;
      Y.push(boxM(-1.1, 1.1, 0, 0.9, -1.1, 1.1));
      // tower head and pendants
      for (const [x, z] of [[-CA, -CA], [CA, -CA], [CA, CA], [-CA, CA]]) Y.push(beamMatrix([x, 0.9, z], [0, 6.2, 0], 0.09));
      G.push(beamMatrix([0, 6.2, 0], [-16, JH + 0.9, 0], 0.035), beamMatrix([0, 6.2, 0], [KL, 1.2, 0], 0.035));
      // jib: triangular lattice
      for (let x = 0; x > -JL + 0.01; x -= HS) {
        const xa = x, xb = Math.max(-JL, x - HS);
        Y.push(beamMatrix([xa, 0.9, -JW], [xb, 0.9, -JW], 0.09), beamMatrix([xa, 0.9, JW], [xb, 0.9, JW], 0.09), beamMatrix([xa, 0.9 + JH, 0], [xb, 0.9 + JH, 0], 0.08));
        Y.push(beamMatrix([xa, 0.9, -JW], [xa, 0.9, JW], 0.05));
        Y.push(beamMatrix([xa, 0.9, -JW], [(xa + xb) / 2, 0.9 + JH, 0], 0.05), beamMatrix([xa, 0.9, JW], [(xa + xb) / 2, 0.9 + JH, 0], 0.05));
        Y.push(beamMatrix([(xa + xb) / 2, 0.9 + JH, 0], [xb, 0.9, -JW], 0.05), beamMatrix([(xa + xb) / 2, 0.9 + JH, 0], [xb, 0.9, JW], 0.05));
      }
      // counter-jib: platform, walkway grating, counterweights
      Y.push(boxM(0, KL, 0.75, 1.0, -0.9, -0.75), boxM(0, KL, 0.75, 1.0, 0.75, 0.9));
      P.push(boxM(0.6, KL, 1.0, 1.04, -0.75, 0.75));
      C.push(boxM(KL - 2.6, KL - 0.2, 0.0, 1.9, -1.0, 1.0));
      // operator cab
      P.push(boxM(-0.6, 0.9, 0.95, 2.45, 1.15, 2.45));
      D.push(boxM(-0.66, -0.6, 1.4, 2.3, 1.25, 2.35));
      slew.add(kitFromMatrices(Y, MAT.yellow, { noAO: true }), kitFromMatrices(P, MAT.paint, { noAO: true }), kitFromMatrices(G, MAT.galv, { noAO: true }), kitFromMatrices(C, MAT.conc, { noAO: true }), kitFromMatrices(D, MAT.dark, { noAO: true }));
    }
    // trolley, rope, hook block and the load it carries
    const hook = kitMesh(unitBox, MAT.yellow, 2, { noAO: true });
    const rope = kitMesh(unitBox, MAT.dark, 1, { shadow: false, noAO: true });
    const loads = {
      rebar: kitMesh(unitBox, MAT.rebar, 1, { noAO: true }),
      brick: kitMesh(unitBox, MAT.brick, 1, { noAO: true }),
      crate: kitMesh(unitBox, MAT.ply, 1, { noAO: true }),
    };
    slew.add(hook, rope, loads.rebar, loads.brick, loads.crate);
    crane.visible = false;
    scene.add(crane);

    /* ---------- the site ground: soil, then lawn; it fades into the page ---------- */
    const PLOT = { x0: -13, x1: 13, z0: -9.5, z1: 15 };
    const POOL = new THREE.Vector4(PX0 - 0.2, PX1 + 0.2, PZ0 - 0.2, PZ1 + 0.2);
    const groundU = {
      uSoil: { value: T.soil }, uGrass: { value: T.grass },
      uLawn: { value: 0 }, uGround: { value: 0 }, uPoolCut: { value: 0 },
      uPool: { value: POOL }, uPlot: { value: new THREE.Vector4(PLOT.x0, PLOT.x1, PLOT.z0, PLOT.z1) },
      uPit: { value: 0 }, uPitR: { value: PIT }, uPitX: { value: new THREE.Vector4(...GX) }, uPitZ: { value: new THREE.Vector4(...GZ) },
    };
    // footing pits are holes in the ground while they are open
    const PIT_GLSL = `
      bool inPit(vec2 q) {
        if (uPit < 0.5) return false;
        for (int a = 0; a < 4; a++) for (int b = 0; b < 4; b++) {
          if (abs(q.x - uPitX[a]) < uPitR && abs(q.y - uPitZ[b]) < uPitR) return true;
        }
        return false;
      }`;
    const PIT_UNI = 'uniform float uPit; uniform float uPitR; uniform vec4 uPitX; uniform vec4 uPitZ;';
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0, transparent: true });
    groundMat.customProgramCacheKey = () => 'aa-ground-v2';
    groundMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, groundU);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D uSoil; uniform sampler2D uGrass;
          uniform float uLawn; uniform float uGround; uniform float uPoolCut;
          uniform vec4 uPool; uniform vec4 uPlot;
          ${PIT_UNI}
          varying vec3 vWPos;
          float gH;
          ${PIT_GLSL}`)
        .replace('#include <map_fragment>', `
          vec2 gp = vWPos.xz;
          if (uPoolCut > 0.5 && gp.x > uPool.x && gp.x < uPool.y && gp.y > uPool.z && gp.y < uPool.w) discard;
          if (inPit(gp)) discard;
          vec4 gS = texture(uSoil, gp / 3.2);
          vec4 gG = texture(uGrass, gp / 2.4);
          float gN = texture(uSoil, gp * 0.05).a;
          float gL = smoothstep(0.0, 1.4, uLawn * 36.0 - (16.0 - gp.y) - gN * 3.0);
          vec4 gT = mix(gS, gG, gL);
          gT.rgb *= 0.9 + 0.2 * gN;
          gH = gT.a;
          diffuseColor.rgb *= gT.rgb;
          vec2 gO = max(vec2(max(uPlot.x - gp.x, gp.x - uPlot.y), max(uPlot.z - gp.y, gp.y - uPlot.w)), 0.0);
          diffuseColor.a *= uGround * (1.0 - smoothstep(0.0, 2.8, length(gO)));`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec3 sx = normalize(dFdx(-vViewPosition)), sy = normalize(dFdy(-vViewPosition));
            vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
            float det = dot(sx, r1);
            vec3 grad = sign(det) * (dFdx(gH) * r1 + dFdy(gH) * r2) * 1.4;
            normal = normalize(abs(det) * normal - grad);
          }`);
    };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(PLOT.x1 - PLOT.x0 + 7, PLOT.z1 - PLOT.z0 + 7).rotateX(-Math.PI / 2), groundMat);
    ground.position.set((PLOT.x0 + PLOT.x1) / 2, 0, (PLOT.z0 + PLOT.z1) / 2);
    ground.receiveShadow = true;
    ground.renderOrder = -1;
    ground.visible = false;
    scene.add(ground);

    // the page itself catches the shadows that fall outside the plot
    const pageMat = new THREE.ShadowMaterial({ color: new THREE.Color('#3E3326'), opacity: 0.18, depthWrite: false });
    pageMat.onBeforeCompile = (sh) => {
      sh.uniforms.uPool = { value: POOL };
      for (const k of ['uPoolCut', 'uPit', 'uPitR', 'uPitX', 'uPitZ']) sh.uniforms[k] = groundU[k];
      sh.uniforms.uPlotIn = { value: new THREE.Vector4(PLOT.x0 + 0.6, PLOT.x1 - 0.6, PLOT.z0 + 0.6, PLOT.z1 - 0.6) };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec4 uPool; uniform float uPoolCut; uniform vec4 uPlotIn; varying vec3 vWPos;
          ${PIT_UNI}
          ${PIT_GLSL}`)
        .replace('#include <tonemapping_fragment>', `gl_FragColor.a *= 1.0 - smoothstep(13.0, 25.0, length(vWPos.xz - vec2(0.0, 2.75)));
          #include <tonemapping_fragment>`)
        .replace('void main() {', `void main() {
          if (uPoolCut > 0.5 && vWPos.x > uPool.x && vWPos.x < uPool.y && vWPos.z > uPool.z && vWPos.z < uPool.w) discard;
          if (inPit(vWPos.xz)) discard;
          if (vWPos.x > uPlotIn.x && vWPos.x < uPlotIn.y && vWPos.z > uPlotIn.z && vWPos.z < uPlotIn.w) discard;`);
    };
    const page = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), pageMat);
    page.position.y = -0.02;
    page.receiveShadow = true;
    page.renderOrder = -2;
    page.userData.noAO = true;
    scene.add(page);

    /* ---------- pool water ---------- */
    const waterMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#2C8193'), roughness: 0.03, metalness: 0, transparent: true, envMapIntensity: 2.4, depthWrite: false });
    waterMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vWPos;')
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          {
            vec2 q = vWPos.xz;
            float t = uTime;
            vec2 d = vec2(cos(q.x * 2.1 + t * 1.3) + 0.6 * cos(q.x * 4.7 - q.y * 3.1 + t * 2.1), sin(q.y * 2.6 - t * 1.1) + 0.6 * sin(q.y * 5.3 + q.x * 2.2 - t * 1.7));
            normal = normalize(normal + (viewMatrix * vec4(d.x * 0.06, 0.0, d.y * 0.06, 0.0)).xyz);
            diffuseColor.a = mix(0.48, 0.95, pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0));
          }`);
    };
    const water = new THREE.Mesh(new THREE.PlaneGeometry(PX1 - PX0, PZ1 - PZ0).rotateX(-Math.PI / 2), waterMat);
    water.position.set((PX0 + PX1) / 2, -PD, (PZ0 + PZ1) / 2);
    water.visible = false;
    water.renderOrder = 2;
    water.userData.noAO = true;
    scene.add(water);

    /* ---------- planting: shade trees and shrubs of leaf cards, palms with fronds ---------- */
    const leafMat = new THREE.MeshStandardMaterial({ map: T.leaves, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, color: new THREE.Color('#F4F6EC') });
    leafMat.alphaToCoverage = true;
    // light the cards as one soft volume: normals point out from the canopy centre
    leafMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
        #ifdef USE_INSTANCING
          transformedNormal = normalize(mix(transformedNormal, normalMatrix * normalize(instanceMatrix[3].xyz + vec3(0.0, 0.25, 0.0)), 0.8));
        #endif`);
    };
    const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: T.leaves, alphaTest: 0.5 });
    const frondMat = new THREE.MeshStandardMaterial({ map: T.frond, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, color: new THREE.Color('#EEF0E2') });
    frondMat.alphaToCoverage = true;
    const frondDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: T.frond, alphaTest: 0.5 });
    const barkMat = surface({ a: 'wood', ca: '#9C8C78', ra: 0.95, bump: 1.4 });
    const cardGeo = new THREE.PlaneGeometry(1, 1);
    const CARD_N = HQ ? 130 : 80;
    function canopy(n, rx, ry, size) {
      const m = new THREE.InstancedMesh(cardGeo, leafMat, n);
      m.customDepthMaterial = leafDepth;
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData.noAO = true;
      const e = new THREE.Euler(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
      for (let k = 0; k < n; k++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.cbrt(rr(0.25, 1));
        const sxz = Math.sqrt(1 - u * u) * r;
        p.set(Math.cos(a) * sxz * rx, u * r * ry, Math.sin(a) * sxz * rx);
        e.set(rr(-1.2, 1.2), rr(0, Math.PI * 2), rr(-1.2, 1.2));
        const z = size * rr(0.75, 1.25);
        m.setMatrixAt(k, new THREE.Matrix4().compose(p, q.setFromEuler(e), sc.set(z, z, z)));
        const lt = 0.74 + 0.26 * r;
        m.setColorAt(k, new THREE.Color(lt * rr(0.88, 1), lt * rr(0.93, 1), lt * rr(0.8, 1)));
      }
      return m;
    }
    function trunk(points, r0, r1) {
      const curve = new THREE.CatmullRomCurve3(points.map((v) => new THREE.Vector3(v[0], v[1], v[2])));
      const geo = new THREE.TubeGeometry(curve, 10, 1, 7, false);
      const pos = geo.attributes.position, n = 11, ring = 8;
      for (let k = 0; k < pos.count; k++) {        // taper the unit tube from r0 to r1
        const seg = Math.floor(k / ring), t = seg / (n - 1);
        const c = curve.getPointAt(Math.min(1, t));
        const v = new THREE.Vector3().fromBufferAttribute(pos, k).sub(c).multiplyScalar(lerp(r0, r1, t));
        pos.setXYZ(k, c.x + v.x, c.y + v.y, c.z + v.z);
      }
      geo.computeVertexNormals();
      const geoI = geo;
      const m = kitMesh(geoI, barkMat, 1);
      m.setMatrixAt(0, new THREE.Matrix4());
      return m;
    }
    const plants = [];
    // shade trees: [x, z, height, canopy radius, planting time]
    [[-10.6, 1.0, 4.6, 2.3, 0.836], [-11.0, 11.8, 4.0, 2.0, 0.842], [10.8, 4.4, 4.8, 2.4, 0.839], [10.4, -7.0, 4.2, 2.1, 0.845], [-10.4, -6.6, 4.4, 2.2, 0.848]].forEach(([x, z, h, r, t]) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const lean = rr(-0.3, 0.3);
      g.add(trunk([[0, 0, 0], [lean * 0.4, h * 0.45, 0.1], [lean, h * 0.8, -0.1]], 0.16, 0.08));
      g.add(trunk([[lean * 0.4, h * 0.45, 0.1], [lean + 0.9, h * 0.72, 0.5], [lean + 1.3, h * 0.88, 0.7]], 0.08, 0.04));
      g.add(trunk([[lean * 0.4, h * 0.5, 0.1], [lean - 0.8, h * 0.75, -0.4], [lean - 1.1, h * 0.92, -0.6]], 0.08, 0.04));
      const c = canopy(CARD_N, r, r * 0.68, 1.35);
      c.position.set(lean * 0.6, h * 0.86, 0);
      g.add(c);
      g.visible = false;
      g.userData = { t, kind: 'tree' };
      scene.add(g);
      plants.push(g);
    });
    // palms by the pool and the gate: [x, z, height, planting time]
    const frondGeo = (() => {
      const g = new THREE.PlaneGeometry(0.85, 3.4, 1, 10).rotateX(-Math.PI / 2).translate(0, 0, 1.7);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const z = p.getZ(k); p.setY(k, 0.35 * z - 0.16 * z * z); }
      g.computeVertexNormals();
      return g;
    })();
    [[-7.4, 12.8, 6.2, 0.84], [-7.0, 10.9, 5.0, 0.843], [6.6, 12.4, 5.6, 0.846], [8.4, 14.0, 6.6, 0.849]].forEach(([x, z, h, t]) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      const bx = rr(-0.7, 0.7), bz = rr(-0.7, 0.7);
      g.add(trunk([[0, 0, 0], [bx * 0.2, h * 0.4, bz * 0.2], [bx * 0.6, h * 0.75, bz * 0.6], [bx, h, bz]], 0.16, 0.11));
      const fr = new THREE.InstancedMesh(frondGeo, frondMat, 14);
      fr.customDepthMaterial = frondDepth;
      fr.castShadow = true;
      fr.receiveShadow = true;
      fr.userData.noAO = true;
      for (let k = 0; k < 14; k++) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rr(-0.15, 0.55) * (k % 2 ? 1 : 0.6), (k / 14) * Math.PI * 2 + rr(-0.2, 0.2), 0, 'YXZ'));
        fr.setMatrixAt(k, new THREE.Matrix4().compose(new THREE.Vector3(bx, h, bz), q, new THREE.Vector3(1, 1, rr(0.8, 1.1))));
      }
      g.add(fr);
      g.visible = false;
      g.userData = { t, kind: 'palm' };
      scene.add(g);
      plants.push(g);
    });
    // shrubs: clipped clumps along the walls, the deck and the pool
    const SHRUBS = [];
    for (let x = -12.0; x <= 12.0; x += 1.5) SHRUBS.push([x, -8.8, 0.62]);
    for (let z = -7.5; z <= 13.5; z += 1.6) SHRUBS.push([-12.3, z, 0.6]);
    for (const x of [-6.0, -4.6, 3.4, 4.8, 6.2]) SHRUBS.push([x, 9.25, 0.5]);
    for (const z of [11.2, 12.4, 13.4]) SHRUBS.push([PX1 + CP + 2.2, z, 0.55]);
    const SPER = HQ ? 16 : 10, SN = SHRUBS.length * SPER;
    const shrubMat = new THREE.MeshStandardMaterial({ map: T.leaves, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, color: new THREE.Color('#DCE4CF') });
    shrubMat.alphaToCoverage = true;
    shrubMat.customProgramCacheKey = () => 'aa-shrub-v2';
    shrubMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aClump;')
        .replace('#include <defaultnormal_vertex>', `#include <defaultnormal_vertex>
          #ifdef USE_INSTANCING
            transformedNormal = normalize(mix(transformedNormal, normalMatrix * normalize(instanceMatrix[3].xyz - aClump + vec3(0.0, 0.2, 0.0)), 0.8));
          #endif`);
    };
    const shrubGeo = cardGeo.clone();
    const clumpAttr = new Float32Array(SN * 3);
    const shrubCards = [];
    SHRUBS.forEach(([x, z, r], k) => {
      const t = 0.838 + (k / SHRUBS.length) * 0.02;
      const c = new THREE.Vector3(x, r * 0.6, z);
      for (let j = 0; j < SPER; j++) {
        const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, rad = Math.cbrt(rr(0.25, 1)), sxz = Math.sqrt(1 - u * u) * rad;
        const local = new THREE.Matrix4().compose(
          new THREE.Vector3(Math.cos(a) * sxz * r, u * rad * r * 0.7, Math.sin(a) * sxz * r),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rr(-1.2, 1.2), rr(0, Math.PI * 2), rr(-1.2, 1.2))),
          new THREE.Vector3(1, 1, 1).multiplyScalar(0.55 * rr(0.75, 1.25)));
        clumpAttr.set([c.x, c.y, c.z], shrubCards.length * 3);
        shrubCards.push({ c, t, local });
      }
    });
    shrubGeo.setAttribute('aClump', new THREE.InstancedBufferAttribute(clumpAttr, 3));
    const shrubs = new THREE.InstancedMesh(shrubGeo, shrubMat, SN);
    shrubs.customDepthMaterial = leafDepth;
    for (let k = 0; k < SN; k++) shrubs.setColorAt(k, new THREE.Color(rr(0.8, 1), rr(0.86, 1), rr(0.74, 0.95)));
    shrubs.castShadow = true;
    shrubs.receiveShadow = true;
    shrubs.frustumCulled = false;
    shrubs.userData.noAO = true;
    shrubs.visible = false;
    scene.add(shrubs);
    let shrubS = -1;
    function growShrubs(s) {
      if (Math.abs(s - shrubS) < 1e-5) return;
      shrubS = s;
      shrubs.visible = s > 0.838;
      if (!shrubs.visible) return;
      const T0 = new THREE.Matrix4(), Sc = new THREE.Matrix4();
      shrubCards.forEach((cd, k) => {
        const g = easeOut(ramp(s, cd.t, cd.t + 0.016));
        if (g <= 0.001) { shrubs.setMatrixAt(k, ZERO); return; }
        T0.makeTranslation(cd.c.x, cd.c.y * g, cd.c.z).multiply(Sc.makeScale(g, g, g)).multiply(cd.local);
        shrubs.setMatrixAt(k, T0);
      });
      shrubs.instanceMatrix.needsUpdate = true;
    }

    /* ---------- the site hoarding, lettered with the studio's name ---------- */
    const hoardPlain = new THREE.MeshStandardMaterial({ color: new THREE.Color('#F3F0E9'), roughness: 0.7 });
    const hoardFront = new THREE.MeshStandardMaterial({ map: T.hoard, roughness: 0.6 });
    const sideTex = (len) => { const t = T.hoardSide.clone(); t.repeat.set(len / 8, 1); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }); };
    const HH = 2.4;
    const hoard = new THREE.Group();
    const panel = (w, d, x, z, mats) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, HH, d).translate(0, HH / 2, 0), mats);
      m.position.set(x, 0, z);
      m.castShadow = true;
      m.receiveShadow = true;
      hoard.add(m);
    };
    panel(26.6, 0.08, 0, PLOT.z1 + 0.3, [hoardPlain, hoardPlain, hoardPlain, hoardPlain, hoardFront, hoardPlain]);
    const sideR = sideTex(25.0), sideL = sideTex(25.0), back = sideTex(26.6);
    panel(0.08, 25.0, PLOT.x1 + 0.3, 2.75, [sideR, hoardPlain, hoardPlain, hoardPlain, hoardPlain, hoardPlain]);
    panel(0.08, 25.0, PLOT.x0 - 0.3, 2.75, [hoardPlain, sideL, hoardPlain, hoardPlain, hoardPlain, hoardPlain]);
    panel(26.6, 0.08, 0, PLOT.z0 - 0.3, [hoardPlain, hoardPlain, hoardPlain, hoardPlain, hoardPlain, back]);
    hoard.visible = false;
    scene.add(hoard);

    /* ---------- instanced meshes for every batch ---------- */
    for (const B of BATCHES) {
      const n = B.list.length;
      if (!n) continue;
      const geo = B.geo.clone();
      const fx = new Float32Array(n * 3), meta = new Float32Array(n * 2);
      B.list.forEach((e, k) => {
        fx[k * 3 + 2] = e.ax;
        meta[k * 2] = e.fin;
        meta[k * 2 + 1] = rnd();
        e.done = Math.max(e.t + e.d, e.p == null ? 0 : e.p + e.pd);
        if (e.b) e.len = e.ax === 0 ? e.b[3] - e.b[2] : e.ax === 1 ? e.b[1] - e.b[0] : e.b[5] - e.b[4];
        e._g = -1; e._f = -1; e._e = -1;
      });
      const fxA = new THREE.InstancedBufferAttribute(fx, 3);
      fxA.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aFx', fxA);
      geo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(meta, 2));
      const mesh = new THREE.InstancedMesh(geo, B.mat, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = B.shadow;
      mesh.receiveShadow = B.recv;
      mesh.customDepthMaterial = depthMat;
      mesh.renderOrder = B.order;
      mesh.userData.noAO = B.noAO;
      for (let k = 0; k < n; k++) mesh.setMatrixAt(k, ZERO);
      scene.add(mesh);
      B.mesh = mesh;
      B.fx = fxA;
      B.fade = B.name === 'glass';
    }
    const LIVE = BATCHES.filter((B) => B.mesh);

    /* ---------- blueprint ghost: dashed gold outline of everything still to be built ---------- */
    const ALL = [];
    for (const B of LIVE) for (const e of B.list) if (e.gh && e.b) { e._gi = ALL.length; ALL.push(e); }
    const ghostGeo = unitBox.clone();
    const ghostAttr = new THREE.InstancedBufferAttribute(new Float32Array(ALL.length).fill(1), 1);
    ghostAttr.setUsage(THREE.DynamicDrawUsage);
    ghostGeo.setAttribute('aGhost', ghostAttr);
    const ghostMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: outVec('#8E6E33') }, uAlpha: { value: 0 }, uReveal: { value: 0 }, uTime: U.uTime, uEdge: U.uEdgeW },
      vertexShader: `
        attribute float aGhost;
        varying vec2 vUv; varying vec3 vW; varying float vG;
        void main() {
          vUv = uv; vG = aGhost;
          vec4 p = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            p = instanceMatrix * p;
          #endif
          vec4 w = modelMatrix * p;
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uAlpha; uniform float uReveal; uniform float uTime; uniform float uEdge;
        varying vec2 vUv; varying vec3 vW; varying float vG;
        void main() {
          vec2 fw = max(fwidth(vUv), vec2(1e-6));
          vec2 d = min(vUv, 1.0 - vUv) / fw;
          float e = 1.0 - smoothstep(uEdge * 0.6 - 0.6, uEdge * 0.6 + 0.6, min(d.x, d.y));
          float dash = smoothstep(0.24, 0.31, fract((vW.x + vW.y + vW.z) * 1.5 - uTime * 0.1));
          float r = length(vW.xz - vec2(0.0, 1.0)) + vW.y * 0.6;
          float rev = 1.0 - smoothstep(uReveal - 2.5, uReveal, r);
          float a = e * dash * vG * uAlpha * rev;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ghost = new THREE.InstancedMesh(ghostGeo, ghostMat, ALL.length);
    ghost.frustumCulled = false;
    ghost.renderOrder = 4;
    ghost.userData.noAO = true;
    ALL.forEach((e, k) => {
      const [x0, x1, y0, y1, z0, z1] = e.b;
      ghost.setMatrixAt(k, _m.compose(_p.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), _q.identity(), _s.set(x1 - x0, y1 - y0, z1 - z0)));
    });
    scene.add(ghost);

    /* ---------- the drawing on the page: grid, plot line, dimensions ---------- */
    function gridTexture() {
      const c = document.createElement('canvas');
      c.width = c.height = 1024;
      const x = c.getContext('2d');
      const N = 64, px = 1024 / N;
      for (let k = 0; k <= N; k++) {
        const major = k % 5 === 0;
        x.strokeStyle = major ? 'rgba(127,97,41,0.34)' : 'rgba(127,97,41,0.14)';
        x.lineWidth = major ? 1.4 : 1;
        const v = Math.round(k * px) + 0.5;
        x.beginPath(); x.moveTo(v, 0); x.lineTo(v, 1024); x.stroke();
        x.beginPath(); x.moveTo(0, v); x.lineTo(1024, v); x.stroke();
      }
      x.globalCompositeOperation = 'destination-in';
      const g = x.createRadialGradient(512, 512, 60, 512, 512, 512);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.8)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 1024, 1024);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, MAXANISO);
      return t;
    }
    const gridMat = new THREE.MeshBasicMaterial({ map: gridTexture(), transparent: true, depthWrite: false, opacity: 0, toneMapped: false });
    const gridPlane = new THREE.Mesh(new THREE.PlaneGeometry(64, 64).rotateX(-Math.PI / 2), gridMat);
    gridPlane.position.set(0, 0.004, 2.75);
    gridPlane.renderOrder = -3;
    gridPlane.userData.noAO = true;
    scene.add(gridPlane);

    const segGeo = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return g; };
    const goldLine = (opacity) => new THREE.LineBasicMaterial({ color: exactColor('#A88342'), transparent: true, opacity, depthWrite: false, toneMapped: false });
    const bpts = [];
    const corners = [[PLOT.x0, PLOT.z0], [PLOT.x1, PLOT.z0], [PLOT.x1, PLOT.z1], [PLOT.x0, PLOT.z1], [PLOT.x0, PLOT.z0]];
    for (let k = 0; k < 4; k++) {
      const [ax, az] = corners[k], [bx, bz] = corners[k + 1];
      for (let j = 0; j < 48; j++) {
        const t0 = j / 48, t1 = (j + 0.62) / 48;
        bpts.push(lerp(ax, bx, t0), 0.03, lerp(az, bz, t0), lerp(ax, bx, t1), 0.03, lerp(az, bz, t1));
      }
    }
    const boundaryCount = bpts.length / 3;
    const boundary = new THREE.LineSegments(segGeo(bpts), goldLine(0.9));
    boundary.geometry.setDrawRange(0, 0);
    scene.add(boundary);
    const site = [], dim = [];
    corners.slice(0, 4).forEach(([x, z]) => site.push(x - 0.7, 0.03, z, x + 0.7, 0.03, z, x, 0.03, z - 0.7, x, 0.03, z + 0.7));
    const DZ = PLOT.z1 + 1.3, DX = PLOT.x1 + 1.3;
    dim.push(PLOT.x0, 0.03, DZ, PLOT.x1, 0.03, DZ, PLOT.x0, 0.03, PLOT.z1 + 0.3, PLOT.x0, 0.03, DZ + 0.5, PLOT.x1, 0.03, PLOT.z1 + 0.3, PLOT.x1, 0.03, DZ + 0.5);
    dim.push(PLOT.x0 - 0.35, 0.03, DZ + 0.35, PLOT.x0 + 0.35, 0.03, DZ - 0.35, PLOT.x1 - 0.35, 0.03, DZ + 0.35, PLOT.x1 + 0.35, 0.03, DZ - 0.35);
    dim.push(DX, 0.03, PLOT.z0, DX, 0.03, PLOT.z1, PLOT.x1 + 0.3, 0.03, PLOT.z0, DX + 0.5, 0.03, PLOT.z0, PLOT.x1 + 0.3, 0.03, PLOT.z1, DX + 0.5, 0.03, PLOT.z1);
    dim.push(DX - 0.35, 0.03, PLOT.z0 + 0.35, DX + 0.35, 0.03, PLOT.z0 - 0.35, DX - 0.35, 0.03, PLOT.z1 + 0.35, DX + 0.35, 0.03, PLOT.z1 - 0.35);
    const siteLines = new THREE.LineSegments(segGeo(site.concat(dim)), goldLine(0));
    scene.add(siteLines);
    const gridl = [];
    GX.forEach((x) => gridl.push(x, 0.04, -8.2, x, 0.04, 9.9));
    GZ.forEach((z) => gridl.push(-11.4, 0.04, z, 9.4, 0.04, z));
    const gridLines = new THREE.LineSegments(segGeo(gridl), new THREE.LineDashedMaterial({ color: exactColor('#A88342'), dashSize: 0.7, gapSize: 0.28, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    gridLines.computeLineDistances();
    scene.add(gridLines);

    /* ---------- annotation labels (HTML, projected) ---------- */
    const labels = [];
    const addLabel = (text, pos, cls, vis, avoid) => {
      const node = document.createElement('span');
      node.className = 'tag3d ' + cls;
      node.textContent = text;
      labelLayer.appendChild(node);
      labels.push({ node, p: new THREE.Vector3(pos[0], pos[1], pos[2]), vis, o: -1, avoid: !!avoid });
    };
    const gridVis = (s, it) => it * ramp(s, 0.03, 0.07) * (1 - ramp(s, 0.27, 0.32));
    ['A', 'B', 'C', 'D'].forEach((n, k) => addLabel(n, [GX[k], 0, -8.9], 'tag3d--bubble', gridVis));
    ['1', '2', '3', '4'].forEach((n, k) => addLabel(n, [-12.1, 0, GZ[k]], 'tag3d--bubble', gridVis));
    addLabel('26.00 m', [0, 0, DZ], 'tag3d--dim', (s, it) => it * ramp(s, 0.03, 0.07) * (1 - ramp(s, 0.12, 0.15)));
    addLabel('24.50 m', [DX, 0, 2.75], 'tag3d--dim', (s, it) => it * ramp(s, 0.03, 0.07) * (1 - ramp(s, 0.12, 0.15)));
    [[PL, '+0.90  PLINTH', 0.286], [L1, '+4.20  FIRST', 0.392], [L2, '+7.50  SECOND', 0.472], [L3, '+10.80  ROOF', 0.497]].forEach(([y, text, at]) =>
      addLabel(text, [FF.x0 - 0.9, y, FF.z1 + 0.6], 'tag3d--level', (s) => ramp(s, at - 0.004, at + 0.012) * (1 - ramp(s, 0.735, 0.775)), true));

    /* ---------- camera choreography (keyframes over S) ---------- */
    // s, azimuth°, elevation°, distance, targetY, targetZ, offsetX (fraction), offsetY, fit radius
    const KEYS = [
      [0.0, 36, 27, 56, 3.4, 2.2, 0.0, -0.25, 17],
      [0.05, 31, 37, 50, 2.0, 2.5, 0.15, 0.0, 17],
      [0.16, 24, 40, 46, 1.0, 2.2, 0.16, 0.0, 16],
      [0.3, 16, 29, 42, 1.8, 1.0, 0.16, 0.0, 13.5],
      [0.5, 2, 24, 44, 4.8, 1.0, 0.16, 0.0, 13.8],
      [0.62, -10, 20, 42, 5.0, 1.5, 0.16, 0.0, 13.2],
      [0.74, -20, 17, 39, 5.0, 2.0, 0.16, 0.0, 13],
      [0.88, -31, 22, 47, 4.0, 2.8, 0.16, 0.0, 15],
      [1.0, -23, 14, 43, 4.0, 2.6, 0.16, 0.0, 13.5],
    ];
    const cam = { th: 0, ph: 0, d: 0, ty: 0, tz: 0, ox: 0, oy: 0, r: 0 };
    function sampleCam(s) {
      let k = 0;
      while (k < KEYS.length - 2 && s > KEYS[k + 1][0]) k++;
      const a = KEYS[k], b = KEYS[k + 1];
      const t = ease(clamp01((s - a[0]) / (b[0] - a[0])));
      cam.th = lerp(a[1], b[1], t); cam.ph = lerp(a[2], b[2], t); cam.d = lerp(a[3], b[3], t);
      cam.ty = lerp(a[4], b[4], t); cam.tz = lerp(a[5], b[5], t); cam.ox = lerp(a[6], b[6], t);
      cam.oy = lerp(a[7], b[7], t); cam.r = lerp(a[8], b[8], t);
    }

    /* ---------- post-processing (desktop) ---------- */
    let composer = null, gtao = null, bloom = null;
    const aoHidden = [];
    if (HQ) {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      composer = new post.EffectComposer(renderer, rt);
      composer.addPass(new post.RenderPass(scene, camera));
      gtao = new post.GTAOPass(scene, camera, 1, 1);
      gtao.blendIntensity = 0.85;
      gtao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12, distanceFallOff: 1.0 });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      composer.addPass(gtao);
      bloom = new post.UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 1.45);
      bloom.enabled = false;
      composer.addPass(bloom);
      composer.addPass(new post.OutputPass());
      // While GTAO reads the scene: leave out see-through things, thin lattices and
      // foliage (noAO), and pieces that are still only an outline or half poured.
      const ov = gtao.overrideVisibility.bind(gtao), rv = gtao.restoreVisibility.bind(gtao);
      gtao.overrideVisibility = () => {
        ov();
        scene.traverse((o) => { if (o.userData.noAO) o.visible = false; });
        for (const [B, k] of aoHidden) { B.mesh.setMatrixAt(k, ZERO); B.mesh.instanceMatrix.needsUpdate = true; }
      };
      gtao.restoreVisibility = () => {
        for (const [B, k] of aoHidden) { const e = B.list[k]; B.mesh.setMatrixAt(k, compose(e, e._g)); B.mesh.instanceMatrix.needsUpdate = true; }
        rv();
      };
    }

    /* ---------- sizing ---------- */
    let W = 1, H = 1, portrait = false, avoidX = 0;
    function resize() {
      W = Math.max(1, stage.clientWidth);
      H = Math.max(1, stage.clientHeight);
      portrait = W / H < 0.9;
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
      if (composer) { composer.setPixelRatio(dpr); composer.setSize(W, H); }
      U.uEdgeW.value = 0.9 * dpr;
      camera.aspect = W / H;
      camera.fov = portrait ? 40 : 30;
      camera.updateProjectionMatrix();
      const card = document.querySelector('.chapter__card');
      avoidX = portrait ? 18 : 0;
      if (card && !portrait) {
        const r = card.getBoundingClientRect(), sr = stage.getBoundingClientRect();
        avoidX = r.right - sr.left + 14;
      }
    }
    resize();
    window.addEventListener('resize', resize);
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);

    /* ---------- pointer parallax (fine pointers only) ---------- */
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    if (!reduce && window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', (e) => {
        pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }

    /* ---------- per-frame updates ---------- */
    function updateBatches(s) {
      aoHidden.length = 0;
      let dirtyGhost = false;
      for (const B of LIVE) {
        const L = B.list, fx = B.fx.array;
        let dm = false, df = false;
        for (let k = 0; k < L.length; k++) {
          const e = L[k];
          let g, f;
          if (B.fade) {
            f = ease(ramp(s, e.t, e.t + e.d));
            if (e.o != null) f *= 1 - ramp(s, e.o, e.o + e.od);
            g = f > 0 ? 1 : 0;
          } else {
            g = easeOut(ramp(s, e.t, e.t + e.d));
            if (e.o != null) g *= 1 - ease(ramp(s, e.o, e.o + e.od));
            f = e.p == null ? 1 : ramp(s, e.p, e.p + e.pd);
            if (e.q && f > 0 && f < 1) { const n = Math.max(1, Math.round(e.len / e.q)); f = Math.ceil(f * n) / n; }
          }
          const ea = g > 0 ? e.edge * (1 - ramp(s, e.done + 0.002, e.done + 0.03)) : 0;
          if (g !== e._g) {
            B.mesh.setMatrixAt(k, compose(e, g));
            e._g = g;
            dm = true;
          }
          if (f !== e._f || ea !== e._e) { fx[k * 3] = f; fx[k * 3 + 1] = ea; e._f = f; e._e = ea; df = true; }
          if (e._gi !== undefined) {
            const gv = B.fade ? 1 - f : 1 - g;
            if (ghostAttr.array[e._gi] !== gv) { ghostAttr.array[e._gi] = gv; dirtyGhost = true; }
          }
          if (g > 0 && f < 0.999 && !B.fade) aoHidden.push([B, k]);
        }
        if (dm) B.mesh.instanceMatrix.needsUpdate = true;
        if (df) B.fx.needsUpdate = true;
      }
      if (dirtyGhost) ghostAttr.needsUpdate = true;
    }

    const proj = new THREE.Vector3();
    function updateLabels(s, intro) {
      for (const L of labels) {
        const o = clamp01(L.vis(s, intro));
        if (o < 0.01) {
          if (L.o !== 0) { L.node.style.opacity = '0'; L.o = 0; }
          continue;
        }
        proj.copy(L.p).project(camera);
        if (proj.z > 1 || proj.z < -1) { L.node.style.opacity = '0'; L.o = 0; continue; }
        let x = (proj.x * 0.5 + 0.5) * W;
        const y = (-proj.y * 0.5 + 0.5) * H;
        if (L.avoid && x < avoidX) x = avoidX;
        if (x < 6 || x > W - 64 || y < 60 || y > H - 40) { if (L.o !== 0) { L.node.style.opacity = '0'; L.o = 0; } continue; }
        L.node.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        if (Math.abs(o - L.o) > 0.01) { L.node.style.opacity = o.toFixed(2); L.o = o; }
      }
    }

    function updateCrane(s, time) {
      const mk = easeOut(ramp(s, 0.285, 0.318)) * (1 - easeIn(ramp(s, 0.745, 0.778)));
      crane.visible = mk > 0.001;
      if (!crane.visible) return;
      const secs = Math.max(1, Math.round((mastList.length / 12) * mk));
      mast.count = secs * 12;
      slew.position.y = secs * HS;
      slew.visible = secs >= 4;
      slew.rotation.y = 1.79 + Math.sin(time * 0.21) * 0.42 + (s - 0.5) * 1.1;
      const dist = 9 + Math.sin(time * 0.33) * 3.5;
      const level = s < 0.4 ? L1 + 1.8 : s < 0.475 ? L2 + 1.8 : s < 0.5 ? L3 + 1.8 : s < 0.62 ? 7.2 : 9.8;
      const drop = Math.max(2.2, slew.position.y - level + Math.sin(time * 0.5) * 0.5);
      hook.setMatrixAt(0, boxM(-dist - 0.4, -dist + 0.4, 0.62, 0.9, -0.55, 0.55));
      hook.setMatrixAt(1, boxM(-dist - 0.2, -dist + 0.2, -drop, -drop + 0.55, -0.14, 0.14));
      hook.instanceMatrix.needsUpdate = true;
      rope.setMatrixAt(0, boxM(-dist - 0.014, -dist + 0.014, -drop + 0.55, 0.62, -0.014, 0.014));
      rope.instanceMatrix.needsUpdate = true;
      const which = s < 0.5 ? 'rebar' : s < 0.62 ? 'brick' : 'crate';
      for (const k in loads) loads[k].visible = k === which;
      const L = loads[which];
      if (which === 'rebar') L.setMatrixAt(0, boxM(-dist - 2.2, -dist + 2.2, -drop - 0.75, -drop - 0.5, -0.16, 0.16));
      else if (which === 'brick') L.setMatrixAt(0, boxM(-dist - 0.55, -dist + 0.55, -drop - 1.5, -drop - 0.55, -0.45, 0.45));
      else L.setMatrixAt(0, boxM(-dist - 1.3, -dist + 1.3, -drop - 0.95, -drop - 0.4, -0.25, 0.25));
      L.instanceMatrix.needsUpdate = true;
    }

    let sNow = AA.buildS || 0;
    let introStart = -1;
    let last = performance.now();
    const t0 = last;
    let visible = true;
    let firstFrame = true;
    const reducedTarget = () => {
      const ends = [0, 0.16, 0.3, 0.5, 0.62, 0.74, 0.88, 1];
      return ends[AA.chapter || 0] != null ? ends[AA.chapter || 0] : 1;
    };

    // adaptive quality: if frames are slow, lower the pixel ratio, then drop the AO
    let slowFrames = 0, sampled = 0;
    function adapt(dt) {
      sampled++;
      if (dt > 1 / 36) slowFrames++;
      if (sampled >= 90) {
        if (slowFrames > 55) {
          if (dpr > 1) { dpr = Math.max(1, dpr - 0.25); resize(); }
          else if (gtao && gtao.enabled) gtao.enabled = false;
        }
        sampled = 0; slowFrames = 0;
      }
    }

    AA.frames = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      AA.frames++;
      if (!visible || AA.paused) { last = now; return; }
      const dt = Math.min(0.06, (now - last) / 1000);
      last = now;
      const time = (now - t0) / 1000;
      if (introStart < 0) introStart = now;
      const intro = reduce ? 1 : ease(clamp01((now - introStart) / 2800));

      const target = reduce ? reducedTarget() : AA.buildS || 0;
      if (reduce || AA.snap) sNow = target;
      else {
        sNow += (target - sNow) * (1 - Math.exp(-dt * 6.5));
        if (Math.abs(target - sNow) < 1e-5) sNow = target;
      }
      const s = sNow;
      U.uTime.value = time;

      updateBatches(s);

      // the drawing: ghost, pen line, dimensions, grid
      ghostMat.uniforms.uAlpha.value = intro * (0.36 + 0.3 * ramp(s, 0.02, 0.1) - 0.36 * ramp(s, 0.15, 0.26)) * (1 - ramp(s, 0.7, 0.8));
      ghostMat.uniforms.uReveal.value = 2 + easeOut(intro) * 42;
      const pen = Math.floor((boundaryCount * easeOut(clamp01(intro * 1.15))) / 2) * 2;
      boundary.geometry.setDrawRange(0, pen);
      boundary.material.opacity = 0.9 * (1 - ramp(s, 0.12, 0.17) * 0.75);
      siteLines.material.opacity = 0.8 * intro * (1 - ramp(s, 0.12, 0.17));
      gridLines.material.opacity = 0.75 * clamp01(intro * 1.4 - 0.2) * (1 - ramp(s, 0.27, 0.32));
      gridMat.opacity = intro * 0.95 * (1 - ramp(s, 0.12, 0.18));
      gridPlane.visible = gridMat.opacity > 0.002;

      // the site appears on the page, then turns to lawn; the pool is dug and filled
      groundU.uGround.value = ease(ramp(s, 0.115, 0.165));
      ground.visible = groundU.uGround.value > 0.001;
      groundU.uLawn.value = ramp(s, 0.8, 0.865);
      groundU.uPoolCut.value = s >= 0.8 ? 1 : 0;
      groundU.uPit.value = s >= 0.161 && s < 0.262 ? 1 : 0;
      water.visible = s > 0.836;
      water.position.y = lerp(-PD + 0.03, -0.09, ease(ramp(s, 0.836, 0.872)));

      // finish wash rises up the building
      U.uFinishY.value = s < 0.745 ? -50 : lerp(-0.6, 13.2, ease(ramp(s, 0.745, 0.84)));

      updateCrane(s, time);
      const hk = easeOut(ramp(s, 0.125, 0.152)) * (1 - easeIn(ramp(s, 0.815, 0.842)));
      hoard.visible = hk > 0.001;
      hoard.scale.y = Math.max(0.001, hk);
      for (const p of plants) {
        const g = easeOut(ramp(s, p.userData.t, p.userData.t + 0.022));
        p.visible = g > 0.001;
        if (p.visible) p.scale.setScalar(Math.max(0.001, g));
      }
      growShrubs(s);

      // handover: rooms light up, the sun drops to a golden evening, gold glint sweeps
      const glow = ease(ramp(s, 0.88, 0.95));
      U.uGlow.value = glow;
      sun.color.copy(SUN_DAY).lerp(SUN_GOLD, glow * 0.85);
      sun.intensity = lerp(3.0, 2.5, glow);
      placeSun(lerp(48, 62, glow), lerp(52, 32, glow));
      scene.environmentIntensity = lerp(0.5, 0.36, glow);
      if (bloom) bloom.enabled = glow > 0.01;
      if (s > 0.985 && !reduce) U.uSweep.value = -32 + ((time * 7) % 80);
      else if (s > 0.9) U.uSweep.value = lerp(-32, 32, ramp(s, 0.9, 0.985));
      else U.uSweep.value = -200;

      // camera
      sampleCam(s);
      if (!reduce) {
        pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 3));
        pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 3));
      }
      const th = cam.th + (reduce ? 0 : Math.sin(time * 0.13) * 1.1 + pointer.sx * 2.6);
      const ph = cam.ph + (reduce ? 0 : -pointer.sy * 1.4);
      let ox = cam.ox, oy = cam.oy, fitR = cam.r;
      if (portrait) { ox = 0; oy = s < 0.04 ? lerp(0.02, 0.12, ramp(s, 0, 0.04)) : 0.12; fitR *= 0.82; }
      const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
      const d = Math.max(cam.d, (fitR * (1 + ox)) / Math.sin(hfov / 2));
      const thr = THREE.MathUtils.degToRad(th), phr = THREE.MathUtils.degToRad(ph);
      camera.position.set(Math.sin(thr) * Math.cos(phr) * d, cam.ty + Math.sin(phr) * d, cam.tz + Math.cos(thr) * Math.cos(phr) * d);
      camera.lookAt(0, cam.ty, cam.tz);
      camera.setViewOffset(W, H, -ox * W, oy * H, W, H);

      updateLabels(s, intro);
      if (composer) composer.render(dt);
      else renderer.render(scene, camera);

      if (firstFrame) { firstFrame = false; canvas.classList.add('is-ready'); stage.classList.add('is-3d'); }
      if (!reduce) adapt(dt);
    }

    // only render while the build section is on screen
    const section = stage.closest('[data-build]') || stage;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => { visible = entries[0].isIntersecting && !document.hidden; }, { rootMargin: '100px 0px' }).observe(section);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) visible = false;
      else { const r = section.getBoundingClientRect(); visible = r.bottom > 0 && r.top < window.innerHeight; }
    });

    // compile every material up front (everything visible for one pass), so nothing hitches mid-scroll
    const hiddenNow = [];
    scene.traverse((o) => { if (!o.visible) { hiddenNow.push(o); o.visible = true; } });
    renderer.compile(scene, camera);
    hiddenNow.forEach((o) => { o.visible = false; });
    requestAnimationFrame(frame);
    AA.three = { renderer, scene, camera, composer, HQ, U, batches: LIVE };
  }
})();
