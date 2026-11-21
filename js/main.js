/* SBK Architects — page behaviour: smooth scroll, menu, build progress, drawings, work carousel, form. */
(() => {
  'use strict';

  const doc = document.documentElement;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const AA = (window.AA = window.AA || {});
  AA.reduce = reduceMQ.matches;
  AA.buildS = 0;
  AA.chapter = 0;
  doc.classList.add('js');

  /* ------------------------------------------------------------------
     1. Architectural line drawings (elevations), generated as SVG
     ------------------------------------------------------------------ */
  const G = {
    r: (x, y, w, h, c = 'ln') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}" pathLength="1"/>`,
    l: (x1, y1, x2, y2, c = 'lt') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c}" pathLength="1"/>`,
    p: (d, c = 'ln') => `<path d="${d}" class="${c}" pathLength="1"/>`,
    c: (cx, cy, r, c = 'ln') => `<circle cx="${cx}" cy="${cy}" r="${r}" class="${c}" pathLength="1"/>`,
    t: (x, y, s, a = 'start') => `<text x="${x}" y="${y}" text-anchor="${a}">${s}</text>`,
    fill: (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="${c}"/>`,
  };
  function glass(x, y, w, h, n) {
    let s = G.fill(x, y, w, h, 'gl') + G.r(x, y, w, h);
    for (let i = 1; i < n; i++) { const xx = +(x + (w * i) / n).toFixed(1); s += G.l(xx, y, xx, y + h); }
    return s;
  }
  function fins(x0, x1, y0, y1, step) {
    let s = '';
    for (let x = x0; x <= x1; x += step) s += G.l(x, y0, x, y1);
    return s;
  }
  function tree(cx, gy, r, trunk) {
    const cy = gy - trunk - r * 0.85;
    return G.l(cx, gy, cx, gy - trunk, 'ln') + G.c(cx, cy, r) + G.c(cx - r * 0.28, cy + r * 0.18, r * 0.52, 'lt') + G.c(cx + r * 0.34, cy - r * 0.2, r * 0.36, 'lt');
  }
  function palm(x, gy) {
    const tx = x + 14, ty = gy - 104;
    let s = G.p(`M${x} ${gy} C${x - 2} ${gy - 36} ${x + 4} ${gy - 74} ${tx} ${ty}`);
    [[-46, 18], [-34, -10], [-10, -26], [16, -22], [38, -4], [44, 22]].forEach(([dx, dy]) => {
      s += G.p(`M${tx} ${ty} Q${tx + dx * 0.55} ${ty + dy * 0.55 - 12} ${tx + dx} ${ty + dy}`, 'lt');
    });
    return s;
  }
  function ground(gy) {
    let s = G.l(18, gy, 382, gy, 'ln');
    for (let x = 30; x <= 380; x += 13) s += G.l(x, gy + 2, x - 7, gy + 9);
    return s;
  }
  function scalebar(y) {
    return G.l(40, y, 120, y, 'ln') + G.l(40, y - 4, 40, y + 4, 'ln') + G.l(80, y - 3, 80, y + 3) + G.l(120, y - 4, 120, y + 4, 'ln') +
      G.fill(40, y - 1.6, 40, 3.2, 'sh') + G.t(40, y + 15, '0') + G.t(80, y + 15, '5', 'middle') + G.t(120, y + 15, '10 M', 'middle');
  }
  function levels(x, items) {
    return items.map(([y, s]) => G.p(`M${x} ${y} l4 -6 h-8 z`, 'lt') + G.t(x + 8, y - 1, s)).join('');
  }

  const DRAW = {
    // Arun Hotel is traced from its 3D street view, in the card's own 960 x 1200 frame (see
    // VIEW below), so each line lands on the photograph that follows. The view is drawn in
    // perspective: lines along the tower's front run to a vanishing point far to the left, so
    // they are given by their height at x = 490 and bent through yAt().
    arun() {
      const VX = -3850, VY = 833, f = (v) => Math.round(v * 10) / 10;
      const yAt = (y, x) => f(VY + ((y - VY) * (x - VX)) / (490 - VX));
      const hl = (y, a, b, c = 'lt') => G.l(a, yAt(y, a), b, yAt(y, b), c);
      const quad = (a, b, y0, y1) => `M${a} ${yAt(y0, a)}L${b} ${yAt(y0, b)}L${b} ${yAt(y1, b)}L${a} ${yAt(y1, a)}Z`;
      const leaves = (pts) => pts.map(([x, y, r]) => G.c(x, y, r, 'lt')).join('');
      let s = '';

      // atrium: the sloping roof beam, its glazing and the round window
      const CX = 117, CY = 527, R = 88;
      s += G.p('M0 362H38V346H134V305L205 300V310') + G.r(80, 330, 50, 15, 'lt');
      s += G.l(0, 428, 276, 270, 'ln') + G.l(0, 452, 276, 296, 'ln');
      [30, 66, 150, 182, 212, 242, 264].forEach((x) => {
        const top = f(452 - 0.565 * x), foot = x < 108 ? 537 : 598, d = R * R - (x - CX) * (x - CX);
        if (d <= 0) { s += G.l(x, top, x, foot); return; }
        const h = Math.sqrt(d);
        if (CY - h > top + 4) s += G.l(x, top, x, f(CY - h));
        if (CY + h < foot - 4) s += G.l(x, f(CY + h), x, foot);
      });
      s += G.l(208, 500, 276, 500) + G.l(208, 550, 276, 550);
      s += G.p('M29.6 537A88 88 0 1 1 169 598') + G.p('M45.7 537A72 72 0 1 1 129 598', 'lt') + G.p('M68 537A50 50 0 1 1 108 576') + G.c(CX, CY, 12);
      const shown = (x, y) => y < 596 && !(x < 108 && y > 537);
      for (let a = -180; a < 180; a += 15) {
        const c = Math.cos((a * Math.PI) / 180), n = Math.sin((a * Math.PI) / 180);
        [[15, 47], [53, 69]].forEach(([r0, r1]) => {
          const x0 = f(CX + r0 * c), y0 = f(CY + r0 * n), x1 = f(CX + r1 * c), y1 = f(CY + r1 * n);
          if (shown(x0, y0) && shown(x1, y1)) s += G.l(x0, y0, x1, y1);
        });
      }

      // lower wing in front of the atrium: parapet, lintel, timber fins, stone pier
      s += G.l(0, 536, 107, 544, 'ln') + G.l(0, 552, 107, 559) + G.l(107, 544, 107, 598, 'ln');
      s += G.l(8, 618, 172, 607, 'ln') + G.l(8, 630, 172, 619) + fins(18, 116, 634, 790, 8);
      s += G.r(122, 612, 48, 178) + G.l(170, 610, 278, 597, 'ln');

      // the room tower: pier cap, roof edge, corner, roof terrace and its planting
      s += G.p(`M278 ${yAt(688, 278)}V${yAt(197, 278)}L345 ${yAt(197, 345)}V${yAt(212, 345)}L838 ${yAt(212, 838)}V${yAt(688, 838)}`);
      s += hl(183, 392, 812) + leaves([[412, 192, 13], [439, 185, 15], [462, 193, 10], [768, 134, 20], [793, 118, 25], [816, 136, 15]]);
      s += G.p(`M815 ${yAt(212, 815)}V102L905 89V${yAt(688, 905)}`) + G.l(872, 158, 872, yAt(688, 872));
      s += G.p('M905 128L954 158V700', 'lt') + G.l(922, 140, 922, 690);
      // five floors of recessed balconies in four bays
      const bays = [[340, 422], [445, 533], [583, 682], [705, 803]];
      for (let k = 0; k < 5; k++) {
        const o = 90.5 * k, top = 239 + o, sill = 312 + o;
        bays.forEach(([a, b]) => {
          const q = quad(a, b, top, sill), m = (b - a) / 3;
          s += `<path d="${q}" class="gl"/>` + G.p(q) + hl(sill - 28, a + 3, b - 3) + hl(323 + o, a - 2, b + 2, 'ln');
          [a + m, a + 2 * m].forEach((x) => { x = f(x); s += G.l(x, f(yAt(top, x) + 8), x, yAt(sill - 28, x)); });
        });
      }

      // entrance: canopy, columns, lobby glazing
      s += G.p(quad(247, 930, 688, 715.5)) + hl(726, 352, 815);
      s += G.r(297, 731, 53, 174) + G.r(815, 707, 57, 251);
      const lobby = quad(478, 815, 752, 922);
      s += `<path d="${lobby}" class="gl"/>` + G.p(lobby, 'lt');
      [520, 557, 596, 636, 676, 716, 756, 786].forEach((x) => { s += G.l(x, yAt(752, x), x, yAt(922, x)); });
      s += fins(356, 474, 738, 905, 12);

      // street front: gate piers, the sign, the gate, planting, kerb and lane markings
      s += G.r(80, 902, 41, 98) + G.l(76, 899, 125, 899, 'ln');
      s += G.r(121, 842, 185, 158);
      s += G.p('M203 879C195 870 196 859 203 851C210 859 211 870 203 879Z', 'lt') + G.p('M203 879C193 876 186 869 184 860C193 862 200 869 203 879', 'lt') + G.p('M203 879C213 876 220 869 222 860C213 862 206 869 203 879', 'lt');
      s += G.l(170, 898, 238, 898) + G.l(148, 925, 262, 925) + G.l(160, 949, 247, 949, 'ln');
      s += G.r(295, 884, 82, 136) + G.l(290, 878, 382, 878, 'ln');
      s += G.r(377, 908, 90, 104) + fins(385, 460, 910, 1010, 8);
      s += G.r(870, 884, 76, 178) + G.l(865, 879, 951, 879, 'ln');
      let hedge = 'M0 992';
      for (let x = 0; x < 288; x += 24) hedge += 'q12 -18 24 0';
      s += G.p(hedge, 'lt');
      s += G.l(0, 1012, 960, 1085, 'ln') + G.l(0, 1028, 960, 1101);
      s += G.l(10, 1097, 95, 1104) + G.l(285, 1131, 450, 1152) + G.l(565, 1170, 745, 1190);
      s += tree(48, 995, 46, 80) + tree(228, 842, 44, 10) + tree(925, 882, 30, 8);
      return s;
    },
    // Shukavana is traced from its front elevation, in the card's own 960 x 1200 frame (see VIEW).
    shukavana() {
      const f = (v) => Math.round(v * 10) / 10;
      const ell = (cx, cy, rx, ry, c = 'lt') => G.p(`M${f(cx - rx)} ${f(cy)}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`, c);
      const crown = (cx, cy, r) => G.c(cx, cy, r, 'lt') + G.c(f(cx - r * 0.3), f(cy + r * 0.2), f(r * 0.5), 'lt') + G.c(f(cx + r * 0.35), f(cy - r * 0.2), f(r * 0.34), 'lt');
      // a parrot with its feet at (x, y), h tall, facing right (d = 1) or left (d = -1)
      const parrot = (x, y, h, d) => {
        const P = (u, v) => `${f(x + d * u * h)} ${f(y + v * h)}`;
        return G.p(`M${P(0.24, -0.78)}Q${P(0.12, -1.04)} ${P(-0.04, -0.98)}Q${P(-0.2, -0.92)} ${P(-0.2, -0.68)}C${P(-0.25, -0.38)} ${P(-0.16, -0.12)} ${P(-0.2, 0.3)}L${P(-0.1, 0.32)}C${P(-0.04, 0.1)} ${P(0.04, -0.02)} ${P(0.06, -0.08)}C${P(0.23, -0.26)} ${P(0.23, -0.55)} ${P(0.12, -0.7)}Q${P(0.2, -0.69)} ${P(0.24, -0.78)}Z`)
          + G.p(`M${P(0.24, -0.78)}Q${P(0.15, -0.81)} ${P(0.1, -0.75)}`, 'lt')
          + G.p(`M${P(-0.15, -0.62)}C${P(-0.03, -0.46)} ${P(-0.04, -0.2)} ${P(-0.15, 0.04)}`, 'lt')
          + G.c(f(x + d * 0.04 * h), f(y - 0.86 * h), f(Math.max(1.4, 0.022 * h)), 'lt');
      };
      // a bonsai: a pot centred on x with its rim at y, a trunk and flat pads of leaves
      const bonsai = (x, y, w, d, pads) => G.p(`M${f(x - w / 2)} ${y}H${f(x + w / 2)}L${f(x + w / 2 - 6)} ${y + d}H${f(x - w / 2 + 6)}Z`)
        + G.p(`M${x} ${y}C${x - 8} ${y - 22} ${x + 12} ${y - 36} ${x + 2} ${y - 58}`, 'lt')
        + pads.map(([px, py, rx, ry]) => ell(px, py, rx, ry)).join('');
      // a lattice of diamonds inside a rectangle (the jaali screens)
      const lattice = (x0, y0, w, h, step) => {
        let o = '';
        for (let k = step; k < w + h; k += step) {
          const a = [Math.min(k, w), Math.max(0, k - w)], b = [Math.max(0, k - h), Math.min(k, h)];
          o += G.l(x0 + a[0], y0 + a[1], x0 + b[0], y0 + b[1]) + G.l(x0 + w - a[0], y0 + a[1], x0 + w - b[0], y0 + b[1]);
        }
        return o;
      };
      // a creeper: a wavy stem with leaves
      const vine = (x, y0, y1, amp) => {
        let o = `M${x} ${y0}`, leaves = '';
        for (let y = y0, i = 0; y < y1; y += 28, i++) {
          const s = i % 2 ? 1 : -1;
          o += `Q${x + s * amp} ${y + 14} ${x} ${Math.min(y + 28, y1)}`;
          leaves += G.p(`M${x + s * amp * 0.6} ${y + 12}q${s * 7} -9 ${s * 15} -5q${-s * 6} 8 ${-s * 15} 5`, 'lt');
        }
        return G.p(o, 'lt') + leaves;
      };
      const plinth = (x, y, w, h) => G.r(x - 3, y, w + 6, 7) + G.r(x, y + 7, w, h - 7);
      const box = (x, y, w, h) => G.r(x, y, w, h) + G.r(x + 5, y + 6, w - 10, h - 12, 'lt');
      const lamp = (x, y) => G.p(`M${x - 20} ${y + 10}L${x} ${y - 2}L${x + 20} ${y + 10}Z`) + G.r(x - 15, y + 10, 30, 46)
        + G.l(x - 15, y + 33, x + 15, y + 33, 'lt') + G.r(x - 19, y + 56, 38, 6) + G.l(x, y + 62, x, 1200, 'ln');
      const lantern = (x) => G.l(x, 256, x, 296, 'lt') + G.p(`M${x - 13} 296Q${x - 23} 314 ${x - 13} 332H${x + 13}Q${x + 23} 314 ${x + 13} 296Z`)
        + G.l(x - 18, 308, x + 18, 308, 'lt') + G.l(x - 18, 320, x + 18, 320, 'lt') + G.r(x - 8, 332, 16, 5, 'lt') + G.l(x, 337, x, 384, 'lt');
      const word = (x, y, w, size, t) => `<text x="${x}" y="${y}" text-anchor="middle" textLength="${w}" lengthAdjust="spacingAndGlyphs" style="font-size:${size}px">${t}</text>`;
      let s = '';

      // trees behind the roof, and the creepers on the walls either side
      s += crown(300, 70, 80) + crown(222, 150, 62) + crown(362, 150, 40) + crown(790, 118, 66) + crown(872, 200, 58);
      s += vine(42, 300, 690, 12) + vine(918, 290, 690, 12);

      // the roof: a low hip, its timber fascia and the deep soffit, with lanterns under the eaves
      s += G.p('M0 223L480 208L960 223', 'ln') + G.l(0, 231, 960, 231, 'ln') + G.l(0, 254, 960, 254, 'ln') + G.l(150, 289, 792, 289);
      [330, 480, 630].forEach((x) => { s += G.c(x, 268, 2.2, 'lt'); });
      s += lantern(93) + lantern(840);

      // the glass room upstairs: frame and mullions, lattice screens, the ring light, bonsai and parrots on the ledge
      s += G.r(158, 289, 622, 227);
      [296, 390, 583, 677].forEach((x) => { s += G.l(x, 289, x, 516, 'ln'); });
      s += G.l(298, 362, 581, 362);
      s += lattice(170, 300, 120, 100, 16) + lattice(588, 300, 84, 110, 16) + lattice(683, 300, 88, 110, 16);
      s += G.l(479, 316, 479, 378) + ell(479, 386, 40, 9, 'ln') + ell(479, 386, 33, 6);
      s += bonsai(145, 494, 80, 20, [[145, 445, 50, 17], [128, 425, 26, 9]]);
      s += bonsai(281, 486, 98, 28, [[295, 370, 54, 13], [228, 442, 34, 16], [318, 421, 34, 11], [262, 404, 30, 10]]);
      s += bonsai(487, 500, 48, 12, [[487, 489, 30, 9]]);
      s += bonsai(775, 486, 108, 28, [[788, 400, 42, 13], [782, 446, 66, 14], [745, 424, 26, 9]]);
      s += bonsai(852, 492, 44, 18, [[852, 482, 22, 8]]);
      s += parrot(418, 506, 54, 1) + parrot(562, 506, 52, -1);

      // the ledge and the sign: the name in four scripts around a round emblem
      s += G.r(76, 516, 820, 10, 'ln') + G.r(86, 526, 800, 129) + G.r(84, 655, 802, 13);
      s += word(266, 583, 178, 36, 'ಶುಕವನ') + word(279, 636, 212, 40, 'SHUKAVANA');
      s += word(685, 584, 194, 34, 'ശുകവനം') + word(685, 632, 150, 36, 'शुकवन');
      s += G.c(484, 590, 50) + G.c(484, 590, 41, 'lt') + parrot(480, 622, 50, 1);
      s += G.p('M438 624Q484 644 530 624L526 640Q484 660 442 640Z', 'lt');

      // the entrance: vine-clad piers, the passage and the door through to the garden
      s += G.l(90, 700, 240, 700) + G.l(735, 700, 880, 700) + G.c(484, 683, 2.2, 'lt');
      s += G.r(240, 668, 60, 222, 'ln') + G.r(670, 668, 65, 222, 'ln') + vine(270, 674, 886, 10) + vine(702, 674, 886, 10);
      s += G.l(300, 694, 383, 714) + G.l(595, 714, 670, 694);
      s += G.p('M383 890V714H595V890', 'ln') + G.p('M408 890V722H570V890');
      s += G.c(440, 790, 26, 'lt') + G.c(474, 768, 22, 'lt') + G.c(530, 778, 28, 'lt');
      s += G.p('M445 852L412 890M528 852L568 890M445 852H528', 'lt');

      // the path: kerbs, paving joints, lamps
      s += G.l(220, 1200, 382, 972, 'ln') + G.l(236, 1200, 390, 972) + G.l(752, 1200, 598, 972, 'ln') + G.l(737, 1200, 590, 972);
      s += G.l(390, 972, 408, 890) + G.l(590, 972, 570, 890);
      [1150, 1080, 1020].forEach((y) => { s += G.l(f(236 + (1200 - y) * 0.675), y, f(737 - (1200 - y) * 0.645), y); });
      s += G.r(346, 932, 12, 16, 'lt') + G.l(352, 948, 352, 975, 'lt') + G.r(614, 932, 12, 16, 'lt') + G.l(620, 948, 620, 975, 'lt');
      s += lamp(182, 1072) + lamp(799, 1076);

      // painted parrots on painted boxes, on pedestals either side of the path
      s += plinth(310, 947, 40, 40) + box(304, 906, 26, 41) + parrot(322, 906, 66, 1);
      s += plinth(255, 984, 68, 57) + box(275, 946, 35, 38) + parrot(292, 946, 48, 1);
      s += plinth(191, 1040, 88, 66) + box(224, 998, 36, 42) + parrot(242, 998, 52, 1);
      s += plinth(68, 1115, 100, 85) + box(102, 1032, 68, 83) + parrot(145, 1032, 118, 1);
      s += plinth(624, 947, 44, 40) + box(636, 906, 32, 41) + parrot(648, 906, 66, -1);
      s += plinth(657, 984, 62, 57) + box(668, 946, 32, 38) + parrot(688, 946, 48, -1);
      s += plinth(702, 1040, 92, 66) + box(722, 992, 42, 48) + parrot(744, 992, 54, -1);
      s += plinth(818, 1115, 114, 85) + box(832, 1032, 62, 83) + parrot(862, 1032, 132, -1);

      // a bonsai on a stone plinth, and the hedges behind
      s += G.r(0, 964, 96, 14) + G.r(14, 978, 34, 140) + G.p('M0 912H92L84 962H8Z') + G.p('M30 912C18 880 52 860 34 830C24 812 40 800 46 790', 'lt');
      let hedge = 'M0 712';
      for (let x = 0; x < 236; x += 30) hedge += 'q15 -22 30 -6';
      s += G.p(hedge, 'lt');
      hedge = 'M738 706';
      for (let x = 738; x < 958; x += 30) hedge += 'q15 -22 30 -6';
      s += G.p(hedge, 'lt');
      return s;
    },
    // Guruprasad Residence is traced from its 3D view, in the card's own 960 x 1200 frame (see VIEW).
    guruprasad() {
      const f = (v) => Math.round(v * 10) / 10;
      const wheel = (cx, cy, r) => G.c(cx, cy, r) + G.c(cx, cy, f(r * 0.62), 'lt') + G.c(cx, cy, f(r * 0.14), 'lt');
      let s = '';

      // the plastered tower above the roof, with its thin cap slab
      s += G.p('M137 34L320 9L620 52Q632 54 632 64V198', 'ln') + G.p('M137 34V50L215 57V155', 'ln') + G.l(320, 10, 320, 166);

      // the tiled roof: ridge, verge board, gutter, and the courses of tiles between them
      s += G.p('M103 144L720 212L960 280', 'ln') + G.p('M103 144V160L487 293', 'ln') + G.l(103, 150, 487, 279);
      s += G.l(487, 279, 960, 320, 'ln') + G.l(490, 292, 960, 334);
      const ridge = (x) => (x < 720 ? 144 + ((x - 103) * 68) / 617 : 212 + ((x - 720) * 68) / 240);
      for (let k = 1; k <= 7; k++) {
        const t = k / 8, px = 487 - 384 * t, py = 279 - 132 * t;
        let x = px;
        while (x < 960 && py + (x - px) * 0.0867 > ridge(x) + 2) x += 4;
        s += G.l(f(px), f(py), f(Math.min(x, 960)), f(py + (Math.min(x, 960) - px) * 0.0867), 'lt');
      }

      // the walls: plaster, dark stone with a slit window, timber boards, stone with fins, the framed window
      s += G.l(0, 172, 103, 162, 'ln') + G.l(293, 204, 293, 418, 'ln') + G.l(210, 418, 293, 418, 'ln');
      s += G.p('M0 415H32V575H0', 'ln') + G.p('M0 425H23V565H0', 'lt');
      s += G.r(216, 424, 62, 170) + G.l(247, 424, 247, 594, 'lt');
      s += G.r(355, 415, 42, 157) + G.r(364, 425, 24, 137, 'lt');
      s += G.l(487, 293, 487, 597, 'ln') + [520, 556, 596].map((x) => G.l(x, 296, x, 597)).join('') + G.l(633, 305, 633, 640, 'ln');
      s += G.r(545, 455, 14, 26, 'lt') + G.r(724, 458, 14, 26, 'lt');
      [646, 672, 697, 758, 781].forEach((x) => { s += G.l(x, 308, x, 640, 'lt'); });
      s += G.l(805, 314, 805, 388, 'ln');
      s += G.r(806, 388, 150, 192) + G.r(832, 401, 112, 166, 'lt') + G.l(888, 401, 888, 567, 'lt') + G.l(832, 456, 944, 456, 'lt') + G.l(832, 511, 944, 511, 'lt');
      s += G.l(692, 640, 960, 640, 'ln') + G.l(692, 655, 960, 655);

      // a topiary in a pot by the balcony door
      s += G.c(203, 446, 46, 'lt') + G.c(186, 432, 18, 'lt') + G.c(222, 460, 14, 'lt') + G.l(203, 492, 203, 560, 'lt');
      s += G.p('M203 560C170 538 140 546 124 560C150 572 180 570 203 560ZM203 560C236 536 262 546 274 562C250 574 224 572 203 560Z', 'lt');

      // the balcony over the car porch: its plastered frame and the wrought-iron railing
      s += G.p('M152 800V597H692V800', 'ln') + G.r(166, 612, 502, 113);
      s += G.l(166, 620, 668, 620, 'lt') + G.l(166, 717, 668, 717, 'lt');
      for (let x = 216; x < 668; x += 50) s += G.l(x, 612, x, 725, 'lt');
      for (let x = 166; x + 49 < 668; x += 50) {
        const cx = x + 25;
        s += G.p(`M${cx - 13} 708C${cx - 24} 676 ${cx - 2} 654 ${cx} 672C${cx + 2} 654 ${cx + 24} 676 ${cx + 13} 708`, 'lt') + G.c(cx - 9, 640, 6, 'lt') + G.c(cx + 9, 640, 6, 'lt');
      }
      s += G.l(152, 725, 692, 725, 'ln') + G.l(152, 800, 692, 800, 'ln');

      // the car porch: columns, the back wall and its door; the slatted gate between its piers
      s += G.r(400, 800, 37, 237) + G.r(670, 800, 22, 245);
      s += G.r(530, 800, 85, 87, 'lt') + G.l(510, 887, 665, 887, 'lt');
      s += G.p('M692 737H885V1045', 'ln') + G.l(692, 787, 850, 787) + G.r(787, 787, 63, 233);
      for (let y = 801; y < 1015; y += 14) s += G.l(791, y, 846, y, 'lt');
      s += G.r(692, 870, 95, 175) + G.l(740, 870, 740, 1045, 'lt') + G.l(692, 958, 787, 958, 'lt');
      s += G.p('M712 870q4 -26 12 -36M726 870q2 -30 18 -44M742 870q-2 -24 -12 -36', 'lt');
      s += G.r(887, 745, 50, 120) + G.l(912, 745, 912, 865, 'lt');

      // a cypress by the porch
      s += G.p('M100 620C70 700 14 800 20 900C22 930 40 945 60 948H160C186 945 200 920 196 880C190 790 130 700 100 620Z', 'lt');
      s += G.p('M100 660C92 720 70 800 64 900M100 660C110 730 140 820 150 900', 'lt');

      // the car in the porch, and the one in front
      s += G.p('M196 1000V882Q200 860 222 856L455 850Q472 854 500 908L604 948Q614 956 616 1000L620 1030', 'lt');
      s += G.p('M222 866H372L392 915H222Z', 'lt') + G.r(522, 954, 86, 40, 'lt') + G.l(456, 950, 516, 958, 'lt');
      s += G.p('M0 975C70 958 170 950 248 958C300 966 340 992 382 1022C440 1028 492 1040 504 1058L516 1112L508 1126', 'ln');
      s += G.p('M0 1150H88M203 1160H406', 'ln') + G.p('M88 1150A60 60 0 0 1 203 1160M406 1160A57 57 0 0 1 516 1126', 'ln');
      s += wheel(145, 1155, 50) + wheel(460, 1130, 45);
      s += G.p('M98 1030L150 972L300 976L352 1020Z', 'lt') + G.l(0, 1046, 500, 1052, 'lt') + G.p('M0 1058H80L84 1082H0', 'lt');

      // the footpath, the kerb and the road
      s += G.l(516, 1046, 960, 1030) + G.l(516, 1096, 960, 1052, 'ln') + G.l(516, 1112, 960, 1062, 'lt');
      return s;
    },
    // The last card in Selected work: a passage of arches, each the card's own shape, running
    // towards a vanishing point where the rest of the work waits.
    more() {
      const f = (v) => Math.round(v * 10) / 10;
      const VX = 480, VY = 860;
      let s = '', last = null;
      for (let k = 0; k < 7; k++) {
        const t = Math.pow(0.74, k), r = f(430 * t);
        const x0 = f(VX - 430 * t), x1 = f(VX + 430 * t), sy = f(VY - (VY - 470) * t), by = f(VY + (1200 - VY) * t);
        s += G.p(`M${x0} ${by}V${sy}A${r} ${r} 0 0 1 ${x1} ${sy}V${by}`, k % 2 ? 'lt' : 'ln') + G.l(x0, by, x1, by, 'lt');
        last = { x0, x1, sy, by };
      }
      s += G.l(50, 1200, last.x0, last.by, 'lt') + G.l(910, 1200, last.x1, last.by, 'lt');
      s += G.l(50, 470, last.x0, last.sy, 'lt') + G.l(910, 470, last.x1, last.sy, 'lt');
      s += G.c(VX, VY - 10, 24) + G.l(VX - 12, VY - 10, VX + 12, VY - 10) + G.l(VX, VY - 22, VX, VY + 2);
      return s;
    },
    // Chandrashekar's Residency is traced from its corner view, in the card's own 960 x 1200 frame (see VIEW).
    chandrashekar() {
      const f = (v) => Math.round(v * 10) / 10;
      const P = (pts, c = 'ln') => G.p('M' + pts.map((q) => q.join(' ')).join('L') + 'Z', c);
      const at = (a, b, x) => f(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
      const between = (a0, a1, b0, b1, n) => {        // n - 1 lines between line a and line b (louvres)
        let o = '';
        for (let i = 1; i < n; i++) {
          const t = i / n;
          o += G.l(f(a0[0] + (b0[0] - a0[0]) * t), f(a0[1] + (b0[1] - a0[1]) * t), f(a1[0] + (b1[0] - a1[0]) * t), f(a1[1] + (b1[1] - a1[1]) * t));
        }
        return o;
      };
      const dots = (pts) => pts.map(([x, y]) => G.c(x, y, 3.4, 'lt')).join('');
      const glow = (x, y0, y1) => G.p(`M${x} ${y0}Q${x - 8} ${f((y0 + y1) / 2)} ${x} ${y1}Q${x + 8} ${f((y0 + y1) / 2)} ${x} ${y0}`, 'lt');
      let s = '';

      // the top floor: roof slab, soffit lights, timber louvres either side of a timber panel
      s += G.l(468, 9, 960, 205, 'ln') + G.l(476, 27, 960, 219, 'ln') + G.l(468, 9, 476, 27, 'ln');
      s += G.l(468, 9, 262, 244, 'ln') + G.l(476, 27, 272, 262, 'ln') + G.l(262, 244, 272, 262, 'ln');
      s += dots([[523, 68], [629, 111], [858, 198], [940, 231], [438, 92], [367, 170], [306, 236]]);
      s += G.l(481, 74, 481, 240, 'ln') + G.l(481, 76, 658, 142) + between([481, 76], [658, 142], [481, 238], [658, 294], 12);
      s += G.l(658, 142, 658, 296, 'ln') + G.l(842, 206, 842, 354, 'ln') + G.r(767, 229, 8, 13) + glow(771, 227, 182) + glow(771, 244, 300);
      s += G.l(842, 206, 960, 253) + between([842, 206], [960, 253], [842, 354], [960, 391], 9);
      s += G.l(481, 113, 337, 258) + between([481, 113], [337, 258], [481, 222], [337, 350], 10) + G.l(337, 258, 337, 350, 'ln') + G.l(290, 302, 290, 428);

      // the second slab, wrapping the corner
      s += G.l(455, 228, 960, 393, 'ln') + G.l(460, 246, 960, 406, 'ln') + G.l(455, 228, 460, 246, 'ln');
      s += G.l(455, 228, 242, 423, 'ln') + G.l(460, 246, 272, 440, 'ln') + G.p('M242 423L246 438L272 440', 'ln');
      s += dots([[410, 301], [340, 363], [281, 415], [519, 276], [644, 314], [735, 347]]);

      // left face: the framed window, and the box of dark fins below it
      s += G.l(224, 430, 224, 648, 'ln') + G.l(270, 444, 270, 625);
      s += P([[285, 474], [388, 404], [388, 553], [285, 610]]) + P([[296, 476], [379, 418], [379, 550], [296, 600]], 'lt') + G.l(337, 439, 337, 580);
      s += G.l(226, 645, 478, 504, 'ln') + G.l(234, 656, 470, 520) + G.l(232, 652, 232, 876, 'ln');
      for (let x = 244; x < 466; x += 12) s += G.l(x, at([234, 656], [470, 520], x), x, at([45, 922], [471, 821], x));
      s += G.l(471, 330, 471, 822, 'ln');

      // right face: grey panels with wall lights, two white piers around a stone strip with slit windows
      s += G.l(472, 329, 680, 382) + G.l(472, 527, 680, 562) + G.l(472, 722, 680, 747) + G.l(549, 350, 549, 832);
      s += G.r(581, 551, 8, 15) + glow(585, 549, 405) + glow(585, 568, 698) + G.r(581, 700, 8, 15) + glow(585, 717, 806);
      s += G.p('M680 846V329L703 331V848', 'ln') + G.p('M765 850V348L797 352V858', 'ln');
      s += P([[712, 401], [751, 407], [748, 571], [712, 567]]) + P([[719, 409], [744, 413], [742, 563], [719, 560]], 'lt');
      s += P([[704, 651], [732, 656], [731, 817], [705, 817]]) + P([[710, 659], [726, 662], [725, 810], [711, 810]], 'lt');
      [[756, 452], [758, 488], [755, 620], [759, 700], [756, 760], [740, 830]].forEach(([x, y]) => { s += G.l(x - 8, y, x + 6, y + 2); });

      // the corner balcony: lit ceiling, glass railing over planting, dark fins below
      s += G.l(797, 446, 865, 462) + G.l(865, 462, 865, 545) + G.l(797, 493, 865, 501) + dots([[814, 380], [921, 411], [855, 444]]);
      s += G.l(797, 541, 958, 574, 'ln');
      for (let x = 806; x < 955; x += 10) { const y = at([797, 541], [958, 574], x); s += G.l(x, y + 20, x - 3, f(y + 44)); }
      [[888, 503, 5], [906, 520, 6], [928, 505, 5], [946, 527, 5], [897, 542, 4], [866, 540, 4], [872, 522, 3]].forEach(([x, y, r]) => { s += G.c(x, y, r); });
      s += G.l(797, 600, 960, 634, 'ln') + G.l(797, 612, 960, 645, 'ln');
      for (let x = 806; x < 958; x += 12) s += G.l(x, f(at([797, 612], [960, 645], x) + 4), x, f(at([471, 821], [960, 869], x) - 2));

      // the third slab, over the ground floor
      s += G.l(45, 922, 471, 821, 'ln') + G.l(45, 935, 471, 836, 'ln') + G.l(45, 922, 45, 935, 'ln');
      s += G.l(471, 821, 960, 869, 'ln') + G.l(471, 836, 960, 885, 'ln');
      s += dots([[272, 885], [363, 863], [415, 851], [514, 849], [635, 859], [747, 867], [851, 876], [947, 884]]);

      // the left wing: its roof slab and soffit lights, panels, a stone bay with two windows, timber louvres
      s += G.l(288, 88, 0, 452, 'ln') + G.l(285, 128, 0, 484, 'ln') + G.p('M288 88L370 118L370 130L284 132', 'ln');
      s += dots([[210, 254], [181, 290], [125, 357], [104, 384], [55, 441], [38, 461], [21, 485]]);
      s += G.l(88, 374, 88, 548) + G.l(150, 302, 150, 500) + G.l(169, 276, 169, 478) + G.l(220, 232, 220, 425, 'ln');
      s += G.l(0, 631, 224, 420, 'ln') + G.l(0, 639, 218, 437, 'ln') + G.l(224, 420, 218, 437, 'ln') + dots([[45, 627], [29, 641]]);
      s += G.l(56, 566, 56, 905);
      s += P([[74, 610], [131, 565], [131, 709], [74, 740]]) + P([[82, 608], [124, 573], [124, 705], [82, 731]], 'lt');
      s += P([[74, 779], [131, 747], [131, 875], [74, 895]]) + P([[82, 778], [124, 755], [124, 869], [82, 886]], 'lt');
      s += G.r(132, 712, 7, 12) + G.r(56, 756, 7, 12);
      s += G.l(150, 500, 150, 905, 'ln') + G.l(220, 437, 220, 880, 'ln');
      for (let y = 452; y + 40 < 905; y += 18) s += G.l(220, y, 150, y + 40);
      s += G.l(0, 795, 56, 758, 'ln') + G.l(0, 770, 56, 733) + G.c(28, 712, 5) + G.c(40, 705, 4);

      // ground floor: canopy, garages, the lamp post, a grey wall, windows over a lit garden wall
      s += G.l(0, 971, 180, 937, 'ln') + G.l(0, 985, 178, 953, 'ln') + G.l(0, 992, 65, 984) + G.l(65, 984, 65, 1095);
      s += P([[105, 962], [178, 956], [178, 1097], [105, 1097]]);
      [120, 135, 150, 165].forEach((x) => { s += G.l(x, at([105, 962], [178, 956], x), x, 1097); });
      s += G.l(178, 937, 258, 940, 'ln') + G.l(258, 940, 258, 1100, 'ln');
      s += P([[288, 946], [440, 924], [440, 1102], [288, 1100]]);
      for (let x = 307; x < 436; x += 19) s += G.l(x, at([288, 946], [440, 924], x), x, at([288, 1100], [440, 1102], x));
      s += G.l(392, 940, 392, 1132, 'ln') + G.p('M382 906L392 893L402 906L399 937H385Z', 'ln') + G.l(384, 918, 400, 918) + G.r(386, 1126, 12, 8);
      s += G.l(402, 966, 596, 972, 'ln') + G.l(402, 966, 402, 1105);
      s += G.p('M557 963V922L688 929V966', 'ln') + G.l(622, 925, 622, 964) + G.p('M786 968V935L888 940V970', 'ln') + G.l(837, 937, 837, 968);
      s += G.p('M596 1100V964L945 975V1100', 'ln') + P([[658, 982], [904, 990], [904, 1040], [658, 1035]], 'lt');
      for (let x = 616; x < 944; x += 14) s += G.p(`M${x} 1104q-3 -24 -9 -40M${x} 1104q2 -26 7 -44`, 'lt');
      s += G.l(0, 1100, 960, 1110);
      return s;
    },
    // Gopal Raju's Commercial Complex is traced from its night view, in the card's own 960 x 1200 frame (see VIEW).
    gopalraju() {
      const f = (v) => Math.round(v * 10) / 10;
      const P = (pts, c = 'ln') => G.p('M' + pts.map((q) => q.join(' ')).join('L') + 'Z', c);
      const at = (a, b, x) => f(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
      const between = (a0, a1, b0, b1, n) => {
        let o = '';
        for (let i = 1; i < n; i++) {
          const t = i / n;
          o += G.l(f(a0[0] + (b0[0] - a0[0]) * t), f(a0[1] + (b0[1] - a0[1]) * t), f(a1[0] + (b1[0] - a1[0]) * t), f(a1[1] + (b1[1] - a1[1]) * t));
        }
        return o;
      };
      const dots = (pts) => pts.map(([x, y]) => G.c(x, y, 3.2, 'lt')).join('');
      const glow = (x, y0, y1) => G.p(`M${x} ${y0}Q${x - 9} ${f((y0 + y1) / 2)} ${x} ${y1}Q${x + 9} ${f((y0 + y1) / 2)} ${x} ${y0}`, 'lt');
      const lamp = (x, y) => G.r(x - 3, y - 6, 6, 12) + glow(x, y - 8, y - 70) + glow(x, y + 8, y + 70);
      const win = (x0, x1, top, bot, k) => {
        const d = f((x1 - x0) * k), m = f((x0 + x1) / 2);
        return P([[x0, top], [x1, top + d], [x1, bot + d], [x0, bot]]) + G.l(x0, top + 16, x1, f(top + 16 + d)) + G.l(m, f(top + 16 + d / 2), m, f(bot + d / 2));
      };
      let s = '';

      // the crown: a deep frame with a perforated band and two rows of lights in its soffit
      s += G.l(443, 1, 43, 242, 'ln') + G.l(451, 1, 922, 293, 'ln') + G.l(446, 1, 446, 105, 'ln');
      s += G.l(446, 58, 80, 250) + G.l(446, 105, 80, 293, 'ln') + between([446, 58], [80, 250], [446, 105], [80, 293], 3);
      s += G.l(449, 56, 889, 294) + G.l(449, 104, 889, 342, 'ln') + between([449, 56], [889, 294], [449, 104], [889, 342], 3);
      s += dots([[406, 55], [329, 98], [269, 131], [214, 162], [143, 203], [89, 234], [403, 141], [328, 180], [269, 209], [214, 238], [145, 269], [92, 298]]);
      s += dots([[496, 59], [608, 128], [683, 173], [750, 211], [811, 248], [877, 288], [497, 145], [609, 204], [685, 244], [749, 280], [811, 313]]);
      // the frame's ends, with light strips and timber panels inside them
      s += G.l(43, 242, 43, 697, 'ln') + G.l(72, 300, 72, 694) + G.l(922, 293, 920, 722, 'ln') + G.l(889, 342, 920, 342);
      s += G.l(76, 300, 76, 690) + G.l(76, 706, 76, 810) + G.l(163, 258, 163, 678) + G.l(163, 692, 163, 800);
      s += G.l(128, 297, 128, 688) + G.l(128, 706, 128, 805) + lamp(100, 500) + lamp(144, 484);
      s += G.l(892, 347, 892, 819) + G.l(846, 347, 846, 805) + lamp(872, 531);

      // the corner: a timber-clad pier on both faces, with wall lights
      s += G.l(384, 128, 384, 630, 'ln') + G.l(384, 648, 384, 785, 'ln') + G.l(448, 105, 448, 632, 'ln') + G.l(448, 648, 448, 795, 'ln');
      s += G.l(515, 145, 515, 640, 'ln') + G.l(515, 650, 515, 798, 'ln');
      s += lamp(412, 394) + lamp(489, 394) + lamp(412, 700) + lamp(489, 700);

      // left face: balconies cut into the floors, with openings on their back walls
      s += P([[186, 418], [384, 353], [384, 398], [186, 459]]) + P([[186, 546], [384, 497], [384, 536], [186, 584]]);
      s += P([[205, 367], [240, 362], [240, 405], [205, 410]], 'lt') + G.l(205, 381, 240, 376) + G.l(205, 395, 240, 390);
      s += P([[252, 500], [288, 495], [288, 520], [252, 524]], 'lt') + P([[252, 618], [288, 613], [288, 650], [252, 652]], 'lt') + P([[252, 733], [288, 728], [288, 793], [252, 795]], 'lt');
      s += dots([[333, 279], [276, 304], [223, 327], [346, 328], [291, 350], [224, 450], [291, 469], [346, 453], [291, 590], [346, 575], [270, 672], [329, 661], [291, 703], [346, 691]]);
      s += G.l(186, 300, 186, 418) + G.l(186, 459, 186, 546) + G.l(186, 584, 186, 690);

      // right face: the window block, its grey frames and windows
      s += P([[514, 181], [842, 338], [842, 628], [514, 551]]);
      [[600, 633], [664, 699], [735, 771], [808, 842]].forEach(([a, b]) => {
        s += G.l(a, at([514, 181], [842, 338], a), a, at([514, 551], [842, 628], a), 'ln') + G.l(b, at([514, 181], [842, 338], b), b, at([514, 551], [842, 628], b));
      });
      s += win(537, 597, 269, 372, 0.36) + win(537, 597, 409, 506, 0.32) + win(638, 659, 314, 330, 0.36) + win(638, 659, 446, 532, 0.32);
      s += win(692, 733, 341, 425, 0.34) + win(692, 733, 466, 545, 0.3) + win(771, 805, 377, 455, 0.34) + win(771, 805, 495, 565, 0.3);

      // two open floors under the windows, with columns and lit ceilings
      s += G.l(444, 632, 920, 722, 'ln') + G.l(444, 648, 920, 736, 'ln') + G.l(47, 696, 444, 632, 'ln') + G.l(47, 713, 444, 648, 'ln');
      [[560, 589, 560, 645, 691, 785], [686, 714, 588, 672, 701, 795], [771, 796, 616, 690, 720, 802]].forEach(([a, b, t1, b1, t2, b2]) => {
        s += G.l(a, t1, a, b1) + G.l(b, t1, b, b1) + G.l(a, t2, a, b2) + G.l(b, t2, b, b2);
      });
      s += dots([[527, 559], [522, 588], [521, 609], [636, 588], [731, 609], [672, 622], [621, 628], [606, 647], [524, 688], [522, 709], [636, 706], [671, 728], [617, 728], [752, 694], [811, 706]]);

      // the ground floor: canopy, columns and shopfronts, the entrance steps and the planter
      s += G.l(37, 815, 444, 782, 'ln') + G.l(37, 826, 444, 797, 'ln') + G.l(444, 795, 885, 830, 'ln') + G.l(444, 815, 885, 842, 'ln');
      s += G.l(37, 826, 37, 935, 'ln') + G.l(75, 826, 75, 935) + G.l(394, 800, 394, 940, 'ln') + G.l(410, 800, 410, 940, 'ln');
      s += P([[187, 836], [237, 834], [237, 937], [187, 937]]) + G.l(212, 835, 212, 937) + G.l(220, 884, 220, 906) + G.l(204, 884, 204, 906);
      [134, 169, 256, 300, 345].forEach((x) => { s += G.l(x, 832, x, 937); });
      [[558, 591, 828], [686, 714, 834], [771, 796, 841], [849, 880, 847]].forEach(([a, b, t]) => { s += G.l(a, t, a, 931, 'ln') + G.l(b, t, b, 931, 'ln'); });
      s += G.l(452, 868, 849, 882);
      for (let i = 0; i < 7; i++) s += G.l(57, f(935 + i * 4.5), 206, f(937 + i * 4.5));
      s += G.l(206, 928, 206, 966, 'ln') + G.l(40, 966, 210, 969);
      s += G.l(219, 948, 860, 928, 'ln') + G.l(219, 975, 860, 968, 'ln');
      for (let x = 230; x < 856; x += 22) { const y = at([219, 948], [860, 928], x); s += G.p(`M${x} ${y}q-4 -12 -10 -16M${x} ${y}q3 -14 9 -17`, 'lt'); }
      s += G.l(0, 972, 357, 990) + G.l(357, 990, 958, 1005);
      return s;
    },
    // Mahadev's Residence is traced from its corner view at dusk, in the card's own 960 x 1200 frame (see VIEW).
    mahadev() {
      const f = (v) => Math.round(v * 10) / 10;
      const P = (pts, c = 'ln') => G.p('M' + pts.map((q) => q.join(' ')).join('L') + 'Z', c);
      const at = (a, b, x) => f(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
      const ribs = (x0, x1, step, top, bot) => {        // ribbed cladding: thin verticals between two edges
        let o = '';
        for (let x = x0 + step; x < x1 - 2; x += step) o += G.l(x, f(at(top[0], top[1], x) + 4), x, f(at(bot[0], bot[1], x) - 3));
        return o;
      };
      const creeper = (a, b, n, drop) => {                // planting spilling over a parapet from a to b
        let o = '';
        for (let i = 0; i <= n; i++) {
          const t = i / n, x = f(a[0] + (b[0] - a[0]) * t), y = f(a[1] + (b[1] - a[1]) * t), d = drop * (0.55 + 0.45 * Math.sin(i * 2.3));
          o += G.p(`M${x} ${y}q-5 ${f(d / 2)} 1 ${f(d)}`, 'lt') + G.c(x, f(y - 5), 3.2, 'lt');
        }
        return o;
      };
      const glow = (x, y0, y1) => G.p(`M${x} ${y0}Q${x - 8} ${f((y0 + y1) / 2)} ${x} ${y1}Q${x + 8} ${f((y0 + y1) / 2)} ${x} ${y0}`, 'lt');
      const bush = (x0, x1, by, h) => {                   // a shrub: rounded lobes along the ground
        const n = Math.max(2, Math.round((x1 - x0) / 20)), w = (x1 - x0) / n;
        let d = `M${x0} ${by}`;
        for (let i = 0; i < n; i++) {
          const a = x0 + w * i, b = a + w, top = by - h * (0.75 + 0.25 * Math.sin(i * 1.9 + 1));
          d += `C${f(a)} ${f(top)} ${f(b)} ${f(top)} ${f(b)} ${f(i === n - 1 ? by : by - h * 0.4)}`;
        }
        return G.p(d, 'lt');
      };
      const cane = (x, y0, y1, lean) => {                 // a bamboo cane, its leaves in pairs
        let d = '';
        for (let i = 1; i <= 4; i++) {
          const t = i / 4.6, px = f(x + lean * t * t), py = f(y0 + (y1 - y0) * t);
          d += `M${px} ${py}l-10 -5M${px} ${py}l9 -7`;
        }
        return G.p(`M${x} ${y0}Q${x} ${f((y0 + y1) / 2)} ${x + lean} ${y1}`, 'lt') + G.p(d, 'lt');
      };
      const frond = (x0, y0, cx, cy, x1, y1, n, len) => { // a palm frond: its rib out of the crown, leaflets down both sides
        let a = '', b = '';
        for (let i = 1; i <= n; i++) {
          const t = i / (n + 1), u = 1 - t, l = len * Math.sin(Math.PI * (0.2 + 0.7 * t));
          const px = u * u * x0 + 2 * u * t * cx + t * t * x1, py = u * u * y0 + 2 * u * t * cy + t * t * y1;
          let tx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), ty = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
          const m = Math.hypot(tx, ty);
          tx /= m; ty /= m;
          a += `M${f(px)} ${f(py)}l${f((tx * 0.6 - ty) * l)} ${f((ty * 0.6 + tx + 0.4) * l)}`;
          b += `M${f(px)} ${f(py)}l${f((tx * 0.6 + ty) * l)} ${f((ty * 0.6 - tx + 0.4) * l)}`;
        }
        return G.p(`M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`, 'ln') + G.p(a, 'lt') + G.p(b, 'lt');
      };
      const W = [[0, 861], [960, 1050]];                   // the pavement's inner edge, along the foot of the walls
      let s = '';

      // the corner box on top: two faces of ribbed cladding, planting over its parapet, a wall light
      s += G.p('M541 177L650 100L817 213', 'ln') + G.l(650, 100, 650, 448, 'ln') + G.l(541, 177, 541, 492, 'ln') + G.l(817, 213, 817, 519, 'ln');
      s += G.p('M541 492L650 448L817 519', 'ln');
      s += ribs(541, 650, 18, [[541, 177], [650, 100]], [[541, 492], [650, 448]]) + ribs(650, 817, 20, [[650, 100], [817, 213]], [[650, 448], [817, 519]]);
      s += creeper([546, 172], [646, 104], 7, 70) + creeper([656, 104], [812, 210], 10, 80);
      s += G.r(746, 322, 8, 14) + glow(750, 318, 270) + glow(750, 340, 400);

      // the long top floor behind it: the cantilevered roof slab, planting over the parapet, louvres, windows and lights
      s += G.l(179, 403, 500, 165, 'ln') + G.l(179, 413, 497, 174, 'ln') + G.l(500, 165, 541, 181, 'ln') + G.l(179, 403, 179, 413, 'ln');
      s += G.l(148, 432, 497, 213, 'ln') + G.l(148, 432, 148, 624, 'ln') + G.l(148, 624, 400, 556);
      s += creeper([154, 428], [492, 216], 16, 55);
      s += G.l(497, 213, 497, 556, 'ln');
      for (let y = 241; y <= 307; y += 11) s += G.l(497, y, 538, y - 24);
      s += P([[414, 410], [448, 403], [448, 516], [414, 520]]) + G.l(431, 407, 431, 518);
      s += P([[297, 461], [326, 455], [326, 553], [297, 556]]) + P([[242, 494], [258, 490], [258, 556], [242, 558]]) + P([[190, 519], [201, 516], [201, 558], [190, 560]]);
      s += G.l(271, 380, 271, 556) + G.l(287, 372, 287, 556);
      s += G.c(371, 357, 4) + G.c(197, 463, 4);

      // the lit band under the boxes, and the ribbed first floor with its window and light
      s += G.l(400, 556, 541, 494, 'lt');
      s += G.p('M400 594L652 532L804 576', 'ln') + G.l(652, 532, 652, 712, 'ln') + G.l(804, 576, 804, 730, 'ln') + G.p('M400 730L652 712L804 730', 'ln');
      s += ribs(400, 652, 22, [[400, 594], [652, 532]], [[400, 730], [652, 712]]) + ribs(652, 804, 22, [[652, 532], [804, 576]], [[652, 712], [804, 730]]);
      s += P([[412, 604], [448, 598], [448, 718], [412, 721]]) + G.l(430, 601, 430, 719) + G.r(528, 632, 8, 13);

      // the timber frame round the first-floor window: splayed reveals, slatted shutters, two wall lights
      s += P([[220, 598], [398, 550], [400, 756], [222, 764]]) + P([[276, 640], [372, 628], [372, 730], [276, 736]]);
      s += G.l(220, 598, 276, 640) + G.l(398, 550, 372, 628) + G.l(400, 756, 372, 730) + G.l(222, 764, 276, 736);
      s += G.l(305, 637, 305, 734) + G.l(345, 632, 345, 732);
      for (let y = 646; y < 728; y += 8) s += G.l(281, y, 303, y - 1) + G.l(347, y - 4, 368, y - 5);
      s += G.r(241, 682, 6, 11) + G.r(363, 658, 6, 11);

      // the balcony beside it: terracotta jaali, a glass rail and the slab; the porch beam below
      s += P([[160, 664], [178, 662], [178, 764], [160, 765]], 'lt') + P([[196, 668], [214, 666], [214, 760], [196, 762]], 'lt');
      for (let y = 676; y < 756; y += 12) s += G.l(160, y, 178, y - 1) + G.l(196, y, 214, y - 1);
      s += G.l(152, 726, 220, 718);
      s += G.l(148, 764, 400, 754, 'ln') + G.l(120, 788, 405, 785, 'ln') + G.l(147, 795, 367, 795);

      // the porch: its posts, a lit timber panel and the dark opening, white fins with bamboo and shrubs
      s += G.l(120, 788, 120, at(...W, 120), 'ln') + G.l(147, 795, 147, at(...W, 147)) + G.l(367, 795, 367, 847, 'ln') + G.l(405, 785, 405, 849, 'ln');
      s += P([[182, 795], [239, 795], [239, 896], [182, 896]]) + glow(165, 802, 856);
      [250, 276, 290, 320, 336].forEach((x) => { s += G.l(x, 796, x, f(at(...W, x) - 2)); });
      s += cane(266, 909, 822, -6) + cane(292, 914, 828, 6) + cane(330, 924, 832, -5) + cane(352, 928, 838, 5);
      s += bush(122, 180, 890, 52) + bush(212, 262, 906, 40) + bush(338, 368, 929, 34);

      // the house front past the porch: a window with timber shutters, the entrance under a canopy on a tie rod
      s += G.p('M504 857V794L638 800V867', 'ln') + G.l(542, 796, 542, 859) + G.l(593, 798, 593, 862);
      s += G.p('M660 869V772L792 778V879', 'ln') + G.l(750, 776, 750, 876) + P([[656, 754], [876, 762], [876, 776], [656, 768]]) + G.l(670, 678, 748, 754, 'ln');

      // the boundary: stone panels between white fins, then a wall of white jaali blocks under a coping
      const sT = [[374, 846], [617, 866]], sB = [[374, 936], [617, 978]];
      s += G.p('M374 936V846L617 866', 'ln') + G.l(374, 936, 617, 978, 'ln');
      [390, 417, 446, 476, 510, 547, 586].forEach((x) => { s += G.l(x - 3, at(...sT, x - 3), x - 3, at(...sB, x - 3)) + G.l(x + 3, at(...sT, x + 3), x + 3, at(...sB, x + 3)); });
      const jU = [[617, 872], [960, 900]], jB = [[617, 964], [960, 1023]];
      s += G.p('M617 982V866L960 892', 'ln') + G.l(617, 872, 960, 900) + G.l(617, 964, 960, 1023, 'ln');
      for (let i = 1; i < 5; i++) { const t = i / 5; s += G.l(617, f(872 + 92 * t), 960, f(900 + 123 * t)); }
      for (let x = 633.3; x < 958; x += 16.3) s += G.l(f(x), at(...jU, x), f(x), at(...jB, x));

      // palms in front of the corner: a tall one and two shorter ones beside it
      s += G.p('M872 884C870 800 863 734 861 680', 'ln') + G.p('M882 884C880 800 871 734 869 680', 'ln');
      s += G.p('M885 830Q889 790 888 748', 'ln') + G.p('M832 876Q840 810 846 750', 'ln');
      s += frond(865, 672, 812, 560, 755, 544, 9, 15) + frond(865, 672, 878, 585, 852, 518, 9, 14) + frond(865, 672, 915, 545, 958, 526, 9, 15);
      s += frond(865, 672, 790, 612, 728, 634, 9, 14) + frond(865, 672, 922, 600, 960, 630, 8, 14);
      s += frond(865, 672, 820, 650, 790, 702, 7, 12) + frond(865, 672, 915, 650, 956, 692, 7, 12);
      s += frond(888, 744, 925, 700, 958, 714, 6, 10) + frond(888, 744, 915, 735, 936, 770, 5, 9) + frond(888, 744, 862, 700, 836, 706, 6, 10);
      s += frond(846, 746, 815, 702, 796, 704, 6, 10) + frond(846, 746, 824, 728, 806, 742, 5, 9) + frond(846, 746, 840, 716, 852, 702, 4, 8);

      // two street trees on the left, the pavement and its kerb
      s += tree(31, 867, 44, 56) + tree(77, 877, 40, 50);
      s += G.l(0, 861, 960, 1050, 'ln') + G.l(0, 867, 960, 1076, 'ln') + G.l(0, 872, 960, 1092);
      let k = '';
      for (let x = 14; x < 960; x += 10 + x * 0.018) k += `M${f(x)} ${at([0, 867], [960, 1076], x)}L${f(x - 1)} ${at([0, 872], [960, 1092], x - 1)}`;
      return s + G.p(k, 'lt');
    },
    // Kiran Babu's Residency is traced from its corner view at night, in the card's own 960 x 1200 frame (see VIEW).
    // The edges in T (x1, y1, x2, y2 for each) were found in the photograph itself; the soffit lights, the fins,
    // the planting, the street lamp and the pavement are drawn over them.
    kiranbabu() {
      const f = (v) => Math.round(v * 10) / 10;
      const at = (a, b, x) => f(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
      const T = [
        364,52,430,84, 386,75,439,101, 344,144,424,95, 350,164,444,107, 349,179,459,114, 350,193,474,121, 363,198,486,128, 27,276,356,52,
        378,205,502,135, 33,288,366,67, 398,214,523,146, 116,271,406,88, 41,292,374,73, 411,219,537,152, 56,296,391,81, 424,225,548,159,
        444,233,568,169, 650,194,708,222, 463,241,588,178, 476,246,600,184, 487,252,614,190, 500,256,626,196, 518,264,643,205, 617,188,834,295,
        535,271,659,214, 552,278,677,222, 563,283,690,227, 580,289,704,234, 591,293,716,239, 706,276,752,257, 341,393,348,146, 602,299,726,246,
        706,286,762,264, 626,299,740,251, 726,291,777,271, 180,346,187,227, 730,302,793,278, 263,427,274,170, 90,329,94,276, 707,322,806,284,
        319,380,324,236, 708,331,815,290, 708,342,830,296, 694,273,696,371, 878,309,941,341, 716,349,841,302, 704,275,708,388, 734,356,860,311,
        183,458,196,230, 51,402,60,296, 708,380,879,320, 877,362,928,345, 709,391,895,328, 876,370,941,350, 629,297,631,426, 709,401,908,334,
        359,358,458,392, 375,338,631,426, 100,497,115,270, 374,347,631,435, 361,390,403,403, 803,372,806,441, 866,352,873,485, 875,370,882,489,
        520,412,629,448, 336,449,411,419, 230,469,378,408, 633,447,687,429, 258,467,394,412, 345,456,427,424, 357,462,444,429, 380,468,465,437,
        395,472,480,441, 451,466,503,448, 52,522,349,393, 644,476,732,449, 540,487,674,444, 713,475,765,460, 431,482,517,453, 55,533,362,404,
        406,417,746,522, 523,503,715,443, 459,489,545,460, 479,495,566,466, 658,482,714,499, 340,458,614,534, 883,492,953,518, 557,504,657,532,
        79,538,173,499, 657,532,713,517, 222,547,238,505, 891,534,937,523, 656,543,739,521, 349,524,524,566, 350,532,518,573, 32,657,47,454,
        332,677,339,451, 346,626,349,525, 432,619,432,552, 440,621,441,553, 357,623,357,555, 252,694,260,491, 87,646,94,540, 525,638,525,566,
        513,634,513,571, 459,668,459,565, 408,619,541,645, 199,765,214,506, 183,676,188,600, 128,723,137,574, 1,676,5,624, 99,730,109,578,
        479,680,480,633, 117,725,125,592, 61,731,72,586, 439,674,517,687, 21,750,31,617, 4,757,15,612, 217,703,332,677, 208,886,222,548,
        395,745,448,736, 435,735,519,746, 439,751,497,742, 22,791,27,722, 74,791,409,732, 382,800,383,746, 368,821,370,747, 398,823,400,747,
        346,823,348,752, 333,824,336,753, 212,802,294,789, 72,790,196,801, 505,808,579,799, 428,803,486,809, 212,812,282,802, 306,829,361,822,
        318,844,365,839, 362,822,826,862, 366,839,498,849, 706,840,804,850, 232,893,235,814, 216,891,219,817, 375,850,491,859, 56,923,66,789,
        279,912,283,803, 244,911,248,814, 857,822,861,907, 567,864,743,877, 389,868,501,875, 2,911,7,843, 567,875,800,890, 551,857,551,969,
        827,863,831,964, 844,906,846,955, 359,1034,362,936, 800,889,808,1085, 740,888,746,1089, 616,880,618,1098, 567,876,568,1102, 436,1106,439,873,
        385,1110,390,869, 683,888,688,1093, 693,896,698,1092, 675,898,680,1093, 603,894,605,1099, 750,918,756,1088, 408,1108,412,909, 400,1108,404,911,
        417,1107,420,912, 626,923,629,1097, 425,1107,428,918, 702,943,706,1091, 668,946,671,1094, 730,952,734,1090, 762,966,766,1088, 636,980,638,1097,
        713,987,715,1091, 592,1041,592,1099, 646,1044,647,1096, 551,1039,551,1106, 568,1103,796,1088, 891,1106,959,1103,
      ];
      let s = '';
      for (let i = 0; i < T.length; i += 4) {
        const [x1, y1, x2, y2] = T.slice(i, i + 4);
        s += G.l(x1, y1, x2, y2, Math.hypot(x2 - x1, y2 - y1) > 120 ? 'ln' : 'lt');
      }
      const dots = (pts) => pts.map(([x, y]) => G.c(x, y, 3.4, 'lt')).join('');
      const leaf = (x, y, dx, dy, w) => {                  // a broad leaf from its stalk at (x, y) to its tip
        const mx = x + dx / 2, my = y + dy / 2, l = Math.hypot(dx, dy), nx = (-dy / l) * w, ny = (dx / l) * w;
        return G.p(`M${x} ${y}Q${f(mx + nx)} ${f(my + ny)} ${x + dx} ${y + dy}Q${f(mx - nx)} ${f(my - ny)} ${x} ${y}`, 'lt');
      };

      // the roof canopy: its fascia along both arms, the edge of its slatted soffit over the open frame, downlights
      s += G.p('M28 277L357 52L941 338', 'ln') + G.p('M40 290L364 66L941 349', 'ln') + G.l(28, 277, 40, 290, 'ln') + G.l(941, 338, 941, 349, 'ln');
      s += G.l(350, 151, 630, 298, 'ln');
      s += dots([[86, 277], [133, 246], [192, 208], [263, 163], [318, 127], [413, 167], [497, 205], [572, 239], [643, 270], [720, 302], [777, 329], [827, 351]]);
      s += dots([[104, 528], [176, 502], [342, 432], [438, 460], [526, 486], [766, 481], [821, 499], [869, 515], [916, 532]]);

      // terracotta jaali: a strip on the side, a band along the top terrace, a panel by the right-hand pier
      for (let y = 244; y < 446; y += 15) s += G.l(at([183, 461], [192, 234], y), y, at([216, 446], [227, 224], y), y - 3);
      for (let x = 384; x < 628; x += 16) s += G.l(x, f(at([374, 347], [631, 435], x) + 4), x, f(at([355, 400], [746, 522], x) - 4));
      s += G.l(374, f(at([374, 347], [631, 435], 374) + 26), 628, f(at([374, 347], [631, 435], 628) + 26));
      for (let x = 714; x < 800; x += 15) s += G.l(x, f(386 + (x - 708) * 0.25), x, f(466 + (x - 708) * 0.25));

      // timber fins up the right-hand bay, beside a white pier lit from above
      for (let x = 714; x <= 882; x += 10.5) s += G.l(f(x), at([704, 488], [885, 530], x), f(x + 4), at([712, 702], [885, 722], x));
      s += G.l(657, 527, 659, 696, 'ln') + G.l(711, 530, 713, 698, 'ln') + G.l(885, 530, 890, 722, 'ln');

      // the planter along the balcony: leaves along its top, creepers hanging over its face, the lit soffit below
      s += G.l(622, 697, 960, 734, 'ln') + G.l(560, 756, 960, 802, 'ln') + G.l(560, 776, 960, 826);
      let c = '';
      for (let x = 628; x < 958; x += 13) {
        const y = at([622, 697], [960, 734], x) + 6, d = 34 + 46 * (0.5 + 0.5 * Math.sin(x * 0.37));
        c += `M${x} ${f(y)}q-6 ${f(d / 2)} 2 ${f(d)}`;
      }
      s += G.p(c, 'lt');
      for (let x = 630; x < 955; x += 24) s += G.p(`M${x} ${at([622, 697], [960, 734], x)}q6 -14 14 -16q-2 10 -14 16`, 'lt');
      s += tree(652, 700, 54, 22);

      // the street lamp: its pole is in T; the head and its shade
      s += G.p('M178 478Q220 466 262 478Q220 490 178 478Z', 'ln') + G.p('M182 481L212 522M258 481L228 522M212 522H228', 'lt');

      // planting: shrubs by the side and by the timber wall, broad leaves along it, the pavement and its paving joints
      [[30, 1040, 70], [105, 1012, 66], [175, 1036, 58], [240, 1008, 64], [296, 1042, 52], [934, 1046, 46]].forEach(([x, y, r]) => { s += G.c(x, y, r, 'lt'); });
      [[848, 1092, -38, -128, 15], [870, 1094, -6, -150, 17], [890, 1094, 30, -130, 15], [912, 1096, 46, -96, 13], [836, 1094, -60, -70, 12]].forEach((l) => { s += leaf(...l); });
      s += G.l(0, 1132, 960, 1078, 'ln') + G.l(0, 1158, 960, 1110);
      for (let x = 30; x < 960; x += 42) s += G.l(x, at([0, 1132], [960, 1078], x), x - 8, at([0, 1158], [960, 1110], x - 8));
      return s;
    },
    // A plain elevation for projects on the View more page that have no drawing of their own:
    // a building drawn to no project in particular (data-elevation="generic").
    generic() {
      const gy = 430; let s = '';
      s += G.fill(112, 262, 176, 7, 'sh');
      s += G.r(104, 246, 192, 10);
      s += G.r(114, 256, 172, 118);
      s += G.l(108, 314, 292, 314, 'ln') + G.l(108, 318, 292, 318);
      [126, 174, 222].forEach((x) => { s += glass(x, 268, 38, 36, 2) + glass(x, 328, 38, 36, 2); });
      s += G.r(100, 374, 200, 8);
      s += G.l(122, 382, 122, gy, 'ln') + G.l(278, 382, 278, gy, 'ln');
      s += glass(136, 392, 52, 38, 3) + glass(212, 392, 52, 38, 3);
      s += G.r(190, 392, 20, 38) + G.l(200, 392, 200, gy);
      s += tree(62, gy, 22, 40) + tree(340, gy, 17, 32);
      s += ground(gy) + scalebar(470);
      return s;
    },
    villa() {
      const gy = 430; let s = '';
      s += G.fill(96, 365, 208, 10, 'sh');
      s += G.r(78, 416, 244, 14);                        // plinth
      s += glass(96, 368, 208, 48, 8);                   // ground-floor glazing
      s += G.r(73, 311, 231, 54);                        // first-floor box (cantilevered)
      s += G.l(66, 365, 310, 365, 'ln') + G.l(66, 311, 310, 311, 'ln');
      s += fins(78, 300, 314, 362, 7.4);                 // teak fins
      s += glass(165, 262, 139, 49, 5);                  // pavilion
      s += G.r(156, 256, 157, 6);                        // floating roof
      s += G.r(267, 244, 39, 67);                        // stone core
      s += G.l(271, 252, 271, 300) + G.l(276, 252, 276, 300);
      s += G.l(78, 311, 78, 272, 'ln') + G.l(158, 311, 158, 272, 'ln') + G.l(73, 272, 163, 272, 'ln'); // pergola
      for (let x = 80; x < 158; x += 6.5) s += G.r(x, 268.5, 2.2, 3.5, 'lt');
      s += G.l(73, 294, 165, 294) + G.l(73, 298, 165, 298);   // balustrade
      s += tree(40, gy, 22, 36);
      s += levels(338, [[264, '+10.80'], [314, '+7.50'], [366, '+4.20'], [418, '+0.90']]);
      s += ground(gy) + scalebar(470);
      return s;
    },
    // Selected work: each elevation is drawn from the project's photograph.
    ashraya() {               // Ashraya Residency: rooftop terrace, jali pavilion, louvred screens
      const gy = 430; let s = '';
      s += G.p('M22 300 L96 252 L170 300');
      for (let k = 1; k < 8; k++) s += G.l(96, 254, 22 + k * 18.5, 300);
      s += G.r(22, 300, 148, 14);
      for (let x = 30; x < 170; x += 11) s += G.c(x, 307, 3.4, 'lt');
      s += G.l(34, 314, 34, 418, 'ln') + G.l(158, 314, 158, 418, 'ln');
      s += G.r(46, 336, 50, 82);
      for (let y = 344; y < 418; y += 8) s += G.l(46, y, 96, y);
      s += G.r(104, 336, 46, 60, 'lt');
      for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) s += G.c(110 + i * 11, 342 + j * 11, 3.6, 'lt');
      s += G.r(56, 398, 30, 20) + G.r(110, 400, 36, 18);
      s += G.r(170, 312, 212, 6);
      [176, 246, 316, 378].forEach((x) => { s += G.r(x - 4, 318, 8, 100); });
      for (let y = 324; y < 392; y += 6) s += G.l(180, y, 242, y) + G.l(250, y, 312, y) + G.l(320, y, 374, y);
      [184, 214, 254, 284, 322, 350].forEach((x) => {
        s += G.r(x, 392, 24, 26);
        for (let k = -2; k <= 2; k++) s += G.p(`M${x + 12} 392 Q${x + 12 + k * 3} 372 ${x + 12 + k * 7} 352`, 'lt');
      });
      s += G.l(18, 418, 382, 418, 'ln') + G.l(18, 424, 382, 424);
      s += ground(gy) + scalebar(470);
      return s;
    },
    commercial() {            // Commercial Shopping Complex: timber blade, stone portal, double-height glass
      const gy = 430; let s = '';
      s += G.r(26, 318, 96, 112, 'lt');
      for (let x = 34; x < 122; x += 8) s += G.l(x, 318, x, 430);
      for (let y = 326; y < 430; y += 8) s += G.l(26, y, 122, y);
      s += G.r(318, 330, 64, 100, 'lt');
      for (let x = 326; x < 382; x += 8) s += G.l(x, 330, x, 430);
      for (let y = 338; y < 430; y += 8) s += G.l(318, y, 382, y);
      s += G.r(112, 182, 64, 248);
      s += G.r(146, 214, 172, 210);
      s += G.p('M160 424 V236 H304 V424');
      s += G.r(158, 196, 160, 18);
      for (let x = 162; x < 316; x += 4.5) s += G.l(x, 197, x, 213);
      s += G.r(160, 236, 54, 188);
      for (let x = 165; x < 214; x += 5) s += G.l(x, 238, x, 422);
      s += glass(214, 244, 82, 180, 3);
      s += G.l(214, 330, 296, 330, 'ln') + G.l(214, 338, 296, 338, 'ln');
      for (let x = 222; x < 296; x += 12) s += G.c(x, 240, 1.4, 'lt');
      s += G.l(306, 252, 306, 396) + G.l(311, 252, 311, 372);
      s += G.r(176, 300, 4, 8, 'lt') + G.r(194, 300, 4, 8, 'lt');
      s += G.r(236, 416, 62, 8) + G.r(244, 408, 46, 8, 'lt');
      s += G.r(160, 400, 56, 24) + G.r(300, 404, 40, 20);
      for (let x = 164; x < 214; x += 7) s += G.c(x, 397, 3.2, 'lt');
      for (let x = 304; x < 338; x += 7) s += G.c(x, 401, 3, 'lt');
      s += palm(16, gy) + palm(378, gy);
      s += ground(gy) + scalebar(470);
      return s;
    },
    apollo() {                // Apollo Hospital: arcaded front block, planted ledge, tower behind
      const gy = 430; let s = '';
      s += G.r(40, 160, 320, 136);
      for (let x = 80; x < 360; x += 40) s += G.l(x, 160, x, 296);
      for (let y = 190; y < 296; y += 30) s += G.l(40, y, 360, y);
      s += G.r(24, 296, 352, 8);
      for (let x = 30; x < 372; x += 6) s += G.l(x, 297, x, 303);
      s += glass(36, 306, 250, 34, 10);
      s += G.r(296, 306, 66, 34) + G.c(330, 323, 13) + G.c(330, 323, 9, 'lt');
      s += G.r(20, 340, 360, 8);
      for (let x = 28; x < 374; x += 19) s += G.r(x, 333, 12, 7, 'lt') + G.c(x + 6, 329, 4.2, 'lt');
      s += G.r(20, 348, 360, 70);
      const arch = (x) => G.p(`M${x} 416 V382 a15 15 0 0 1 30 0 V416`) + G.l(x + 15, 367, x + 15, 416) + G.l(x, 392, x + 30, 392);
      [36, 86, 136, 234, 284, 334].forEach((x) => { s += arch(x); });
      [28, 78, 128, 178, 222, 272, 322, 372].forEach((x) => { s += G.l(x, 350, x, 416, 'lt'); });
      s += G.r(186, 368, 28, 48) + G.l(200, 368, 200, 416);
      s += G.c(200, 358, 7) + G.c(200, 358, 4.5, 'lt');
      [31, 81, 131, 179, 221, 269, 319, 369].forEach((x) => { s += G.p(`M${x - 5} 418 Q${x} 394 ${x + 5} 418`, 'lt'); });
      s += G.r(18, 418, 364, 6);
      for (let x = 24; x < 380; x += 22) s += G.l(x, 418, x, 424);
      s += ground(gy) + scalebar(470);
      return s;
    },
    emerald() {               // Abhishek Emerald Enclave: tile-patterned box, roof garden, glass wing
      const gy = 430; let s = '';
      s += G.r(22, 386, 96, 44);
      for (let x = 28; x < 118; x += 9) s += G.l(x, 360, x, 386);
      s += G.l(22, 360, 118, 360);
      s += G.r(266, 250, 66, 172) + glass(274, 262, 50, 150, 2);
      s += G.l(266, 336, 332, 336, 'ln');
      const X0 = 124, Y0 = 244, C = 17.75;
      const win = [[146, 262, 244, 328], [146, 340, 244, 410]];
      s += G.r(X0, Y0, 142, 178);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 10; j++) {
        const x = X0 + i * C, y = Y0 + j * C;
        if (win.some(([a, b, c, d]) => x + C > a && x < c && y + C > b && y < d)) continue;
        s += (i + j) % 2 ? G.l(x, y, x + C, y + C) : G.l(x + C, y, x, y + C);
      }
      s += G.r(146, 262, 98, 66) + glass(152, 268, 86, 54, 2);
      s += G.r(146, 340, 98, 70) + glass(152, 346, 86, 58, 2);
      s += G.r(112, 236, 172, 8) + G.r(118, 214, 160, 7);
      for (let x = 124; x < 276; x += 9) s += G.c(x, 209, 4, 'lt');
      s += G.l(266, 422, 382, 422, 'ln');
      s += tree(348, gy, 20, 76) + tree(378, gy, 15, 60) + tree(30, 386, 13, 8);
      s += ground(gy) + scalebar(470);
      return s;
    },
  };

  // A drawing traced from its photograph uses the photograph's frame instead of the shared sheet.
  const PHOTO = ['0 0 960 1200', 'xMidYMid slice', ' elev--photo'];
  const VIEW = { arun: PHOTO, shukavana: PHOTO, guruprasad: PHOTO, more: PHOTO, chandrashekar: PHOTO, gopalraju: PHOTO, mahadev: PHOTO, kiranbabu: PHOTO };
  function elevation(kind) {
    const body = (DRAW[kind] || DRAW.villa)();
    const [box, fit, cls] = VIEW[kind] || ['6 150 388 350', 'xMidYMax meet', ''];
    return `<svg class="elev${cls}" viewBox="${box}" preserveAspectRatio="${fit}" aria-hidden="true" focusable="false">${body}</svg>`;
  }
  AA.elevation = elevation;
  $$('[data-elevation]').forEach((el) => {
    el.insertAdjacentHTML('beforeend', elevation(el.dataset.elevation));
    if (el.hasAttribute('data-draw')) el.querySelector('svg').classList.add('elev--draw');
  });

  // Selected work: each card draws its elevation, then gives way to the photograph.
  // Hovering a card (with a mouse) replays the drawing.
  const workCards = $$('.work');
  const DRAW_MS = 2600;
  workCards.forEach((card) => {
    let timer = 0;
    card.aaPlay = () => {
      clearTimeout(timer);
      card.classList.remove('is-built', 'is-drawing');
      void card.offsetWidth;
      card.classList.add('is-drawing');
      timer = setTimeout(() => card.classList.add('is-built'), DRAW_MS);
    };
    if (!AA.reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const hot = card.classList.contains('more-item') ? $('.arch', card) || card : card;
      hot.addEventListener('mouseenter', () => { if (card.classList.contains('is-built')) card.aaPlay(); });
    }
  });
  if (AA.reduce || !('IntersectionObserver' in window)) workCards.forEach((c) => c.classList.add('is-built'));
  else {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { io.unobserve(e.target); if (!e.target.classList.contains('is-built')) e.target.aaPlay(); }
    }), { threshold: 0.45 });
    workCards.forEach((c) => io.observe(c));
  }

  /* ------------------------------------------------------------------
     2. Smooth scrolling (Lenis), anchor links
     ------------------------------------------------------------------ */
  let lenis = null;
  if (!AA.reduce && typeof window.Lenis === 'function') {
    try {
      lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1 });
      const loop = (t) => { lenis.raf(t); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    } catch (err) {
      lenis = null;
    }
  }
  AA.lenis = lenis;

  function scrollToY(y, opts = {}) {
    if (lenis) lenis.scrollTo(y, { duration: opts.duration || 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else window.scrollTo({ top: y, behavior: AA.reduce ? 'auto' : 'smooth' });
  }
  const pageY = (el) => el.getBoundingClientRect().top + window.scrollY;

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (!id) { e.preventDefault(); return; }
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    closeMenu(false);
    const phase = /^phase-(\d)$/.exec(id);
    if (phase) scrollToY(phaseY(+phase[1]));
    else if (id === 'top') scrollToY(0);
    else scrollToY(pageY(target));
    if (target.tabIndex >= 0 || target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
  });

  /* ------------------------------------------------------------------
     3. Header: hide on the way down, return on the way up
     ------------------------------------------------------------------ */
  const header = $('[data-header]');
  let lastY = window.scrollY;
  function updateHeader(y) {
    if (!header) return;
    header.classList.toggle('is-scrolled', y > 24);
    const down = y > lastY + 2, up = y < lastY - 2;
    if (down && y > 220 && !menuOpen) header.classList.add('is-hidden');
    else if (up || y < 220) header.classList.remove('is-hidden');
    lastY = y;
  }

  /* ------------------------------------------------------------------
     4. Menu (dialog)
     ------------------------------------------------------------------ */
  const menu = $('[data-menu]');
  const openBtn = $('[data-menu-open]');
  const closeBtn = $('[data-menu-close]');
  let menuOpen = false;
  function openMenu() {
    if (!menu) return;
    menuOpen = true;
    menu.removeAttribute('inert');
    menu.classList.add('is-open');
    openBtn.setAttribute('aria-expanded', 'true');
    header && header.classList.remove('is-hidden');
    lenis && lenis.stop();
    doc.style.overflow = 'hidden';
    setTimeout(() => { const first = $('.menu__links a', menu); first && first.focus(); }, 60);
  }
  function closeMenu(restoreFocus = true) {
    if (!menu || !menuOpen) return;
    menuOpen = false;
    menu.classList.remove('is-open');
    menu.setAttribute('inert', '');
    openBtn.setAttribute('aria-expanded', 'false');
    doc.style.overflow = '';
    lenis && lenis.start();
    if (restoreFocus) openBtn.focus();
  }
  openBtn && openBtn.addEventListener('click', openMenu);
  closeBtn && closeBtn.addEventListener('click', () => closeMenu());
  document.addEventListener('keydown', (e) => {
    if (!menuOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); }
    if (e.key === 'Tab') {
      const items = $$('a[href], button:not([disabled])', menu).filter((n) => n.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ------------------------------------------------------------------
     5. The build: scroll position -> construction progress S (0..1)
        Each chapter owns a slice of S, so the 3D scene and the text agree.
     ------------------------------------------------------------------ */
  const build = $('[data-build]');
  const chapters = $$('[data-chapter]');
  const PH = [0, 0.04, 0.16, 0.30, 0.50, 0.62, 0.74, 0.88, 1];
  const NAMES = ['Site', 'Drawing', 'Foundation', 'Frame', 'Masonry', 'Envelope', 'Finishes', 'Handover'];
  const railLinks = $$('[data-rail] a');
  const hudPhase = $('[data-hud-phase]');
  const hudLevel = $('[data-hud-level]');
  const hudPct = $('[data-hud-pct]');
  const progress = $('[data-progress]');
  const stage = $('[data-stage]');
  let bounds = [];
  const narrowMQ = window.matchMedia('(max-width: 860px)');

  function measure() {
    if (!build || !chapters.length) return;
    const vh = window.innerHeight;
    const top = pageY(build);
    const end = top + build.offsetHeight - vh;
    const lead = narrowMQ.matches ? 1 : 0.62;
    bounds = chapters.map((c, i) => (i === 0 ? top : clamp(pageY(c) - vh * lead, top, end)));
    bounds.push(end);
  }
  function sAt(y) {
    if (!bounds.length) return 0;
    if (y <= bounds[0]) return 0;
    for (let i = 0; i < bounds.length - 1; i++) {
      if (y < bounds[i + 1]) {
        const t = (y - bounds[i]) / Math.max(1, bounds[i + 1] - bounds[i]);
        return PH[i] + (PH[i + 1] - PH[i]) * t;
      }
    }
    return 1;
  }
  function phaseY(k) {
    if (!bounds.length) measure();
    const a = bounds[k], b = bounds[k + 1];
    return a + (b - a) * 0.72;
  }
  AA.phaseY = phaseY;
  AA.yForS = (s) => {
    if (!bounds.length) measure();
    for (let i = 0; i < PH.length - 1; i++) {
      if (s <= PH[i + 1]) return bounds[i] + ((s - PH[i]) / (PH[i + 1] - PH[i])) * (bounds[i + 1] - bounds[i]);
    }
    return bounds[bounds.length - 1];
  };
  function levelFor(s) {
    if (s >= 0.497) return '+10.80';
    if (s >= 0.472) return '+7.50';
    if (s >= 0.392) return '+4.20';
    if (s >= 0.286) return '+0.90';
    return '±0.00';
  }
  let lastChapter = -1, lastPct = -1, lastLevel = '';
  function updateBuild(y) {
    if (!build) return;
    const s = clamp(sAt(y));
    AA.buildS = s;
    let k = 0;
    for (let i = 1; i < PH.length - 1; i++) if (s >= PH[i] - 1e-6) k = i;
    AA.chapter = k;
    if (k !== lastChapter) {
      lastChapter = k;
      if (hudPhase) hudPhase.textContent = NAMES[k];
      chapters.forEach((c, i) => c.classList.toggle('is-active', i === k));
      railLinks.forEach((a, i) => {
        if (i + 1 === k) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
        a.classList.toggle('is-done', i + 1 < k);
      });
    }
    const pct = Math.round(s * 100);
    if (pct !== lastPct) { lastPct = pct; if (hudPct) hudPct.textContent = pct + '%'; }
    const lv = levelFor(s);
    if (lv !== lastLevel) { lastLevel = lv; if (hudLevel) hudLevel.textContent = lv; }
    if (progress) progress.style.setProperty('--p', s.toFixed(4));
    if (stage) stage.classList.toggle('is-live', s > 0.02);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY;
      updateHeader(y);
      updateBuild(y);
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  const remeasure = () => { measure(); updateBuild(window.scrollY); };
  window.addEventListener('resize', remeasure);
  window.addEventListener('load', remeasure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  if ('ResizeObserver' in window && build) new ResizeObserver(remeasure).observe(build);
  remeasure();
  updateHeader(window.scrollY);

  /* ------------------------------------------------------------------
     6. Counters (numbers are final in the HTML; this only animates them)
     ------------------------------------------------------------------ */
  const counters = $$('[data-count]');
  if (!AA.reduce && 'IntersectionObserver' in window && counters.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const el = en.target, to = parseFloat(el.dataset.count), dec = +(el.dataset.decimals || 0);
        const t0 = performance.now(), dur = 1600;
        const tick = (now) => {
          const t = clamp((now - t0) / dur), e = 1 - Math.pow(1 - t, 4);
          el.textContent = (to * e).toFixed(dec);
          if (t < 1) requestAnimationFrame(tick); else el.textContent = to.toFixed(dec);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => {
      if (c.getBoundingClientRect().top > window.innerHeight) io.observe(c);
    });
  }

  /* ------------------------------------------------------------------
     7. Work carousel: native horizontal scroll + arrows + mouse drag
     ------------------------------------------------------------------ */
  const track = $('[data-works-track]');
  const prev = $('[data-works-prev]');
  const next = $('[data-works-next]');
  if (track) {
    const cardStep = () => {
      const cards = $$('.work', track);
      if (cards.length < 2) return track.clientWidth;
      return cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
    };
    const updateNav = () => {
      const max = track.scrollWidth - track.clientWidth - 4;
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled = track.scrollLeft >= max;
    };
    prev && prev.addEventListener('click', () => track.scrollBy({ left: -cardStep(), behavior: AA.reduce ? 'auto' : 'smooth' }));
    next && next.addEventListener('click', () => track.scrollBy({ left: cardStep(), behavior: AA.reduce ? 'auto' : 'smooth' }));
    track.addEventListener('scroll', () => requestAnimationFrame(updateNav), { passive: true });
    window.addEventListener('resize', updateNav);
    updateNav();

    let down = false, moved = false, startX = 0, startLeft = 0;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 6) { moved = true; track.classList.add('is-dragging'); }
      if (moved) track.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (!moved) return;
      track.classList.remove('is-dragging');
      const step = cardStep();
      const target = Math.round(track.scrollLeft / step) * step;
      track.scrollTo({ left: target, behavior: AA.reduce ? 'auto' : 'smooth' });
    });
    track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  }

  /* ------------------------------------------------------------------
     8. Materials marquee: pause control
     ------------------------------------------------------------------ */
  const marquee = $('[data-marquee]');
  const mToggle = $('[data-marquee-toggle]');
  if (marquee && mToggle) {
    mToggle.addEventListener('click', () => {
      const paused = marquee.classList.toggle('is-paused');
      mToggle.setAttribute('aria-pressed', String(paused));
      mToggle.textContent = paused ? 'Play' : 'Pause';
    });
  }

  /* ------------------------------------------------------------------
     9. Copy buttons (phone, email)
     ------------------------------------------------------------------ */
  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.parentElement.querySelector('[data-copy-value]');
      if (!val) return;
      const text = val.textContent.trim();
      const done = (label) => {
        btn.textContent = label;
        btn.classList.add('is-done');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('is-done'); }, 1800);
      };
      const selectIt = () => {
        const range = document.createRange();
        range.selectNodeContents(val);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
        done('Selected');
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done('Copied'), selectIt);
        else selectIt();
      } catch (err) { selectIt(); }
    });
  });

  /* ------------------------------------------------------------------
     10. Enquiry form
         Set FORM_ENDPOINT to a form service URL (Formspree, Getform,
         Basin…) to receive enquiries by email. Empty = preview mode.
     ------------------------------------------------------------------ */
  const FORM_ENDPOINT = '';
  const form = $('[data-form]');
  if (form) {
    const status = $('[data-form-status]', form);
    const submit = $('[data-submit]', form);
    const rules = {
      name: (v) => v.trim().length >= 2 || 'Enter your name so we know whom to ask for.',
      phone: (v) => v.replace(/\D/g, '').length >= 10 || 'Enter a phone number with at least 10 digits, including the area or mobile code.',
      email: (v) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Check the email address (it needs an @ and a domain), or leave it empty.',
    };
    const touched = new Set();
    const check = (input) => {
      const rule = rules[input.name];
      if (!rule) return true;
      const res = rule(input.value);
      const err = document.getElementById(input.id + '-err');
      if (res === true) {
        input.removeAttribute('aria-invalid');
        if (err) { err.hidden = true; err.textContent = ''; }
        return true;
      }
      input.setAttribute('aria-invalid', 'true');
      if (err) { err.hidden = false; err.textContent = res; }
      return false;
    };
    Object.keys(rules).forEach((name) => {
      const input = form.elements[name];
      if (!input) return;
      input.addEventListener('blur', () => { if (input.value || touched.has(name)) { touched.add(name); check(input); } });
      input.addEventListener('input', () => { if (touched.has(name)) check(input); });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const invalid = Object.keys(rules).map((n) => form.elements[n]).filter((input) => { touched.add(input.name); return !check(input); });
      if (invalid.length) {
        invalid[0].focus();
        if (status) status.textContent = invalid.length === 1 ? 'One field needs attention.' : invalid.length + ' fields need attention.';
        return;
      }
      const label = $('[data-submit-label]', submit);
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      label.textContent = 'Sending';
      submit.insertAdjacentHTML('afterbegin', '<span class="spinner" aria-hidden="true"></span>');
      const data = new FormData(form);
      const firstName = String(data.get('name') || '').trim().split(/\s+/)[0];
      const phone = String(data.get('phone') || '').trim();

      const finish = (ok) => {
        submit.disabled = false;
        submit.removeAttribute('aria-busy');
        const sp = $('.spinner', submit); sp && sp.remove();
        label.textContent = 'Request a site visit';
        if (!ok) {
          if (status) status.textContent = 'The request did not go through.';
          let box = $('.form__error-box', form);
          if (!box) {
            box = document.createElement('p');
            box.className = 'field__error form__error-box';
            box.style.gridColumn = '1 / -1';
            form.insertBefore(box, $('.form__actions', form));
          }
          box.textContent = 'The request did not go through. Check your connection and press the button again, or call us on the number shown.';
          return;
        }
        const preview = !FORM_ENDPOINT;
        form.innerHTML = `<div class="form__success" tabindex="-1">
            <p class="label label--gold">Request received</p>
            <h3>Thank you${firstName ? ', ' + firstName.replace(/[<>&"]/g, '') : ''}.</h3>
            <p>We will call ${phone ? 'you on ' + phone.replace(/[<>&"]/g, '') : 'you'} within one working day to fix a time for the site visit.</p>
            ${preview ? '<p class="form__note">Preview mode: this form is not connected to an inbox yet, so nothing was sent.</p>' : ''}
          </div>`;
        const box = $('.form__success', form);
        box && box.focus();
      };

      if (!FORM_ENDPOINT) { setTimeout(() => finish(true), 900); return; }
      fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
        .then((r) => finish(r.ok))
        .catch(() => finish(false));
    });
  }

  /* ------------------------------------------------------------------
     11. Small things
     ------------------------------------------------------------------ */
  const year = String(new Date().getFullYear());
  $$('[data-year]').forEach((el) => { el.textContent = year; });

  /* ------------------------------------------------------------------
     12. Project pages: the card's arch opens into the project page
         Click: the page fades to paper around the card's arch, then the
         browser moves on. The project page starts with the arch in the
         same place and opens it out into its hero picture, a rectangle
         (js/project.js). Coming back, the home page closes the picture
         into the card's arch again.
     ------------------------------------------------------------------ */
  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (err) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (err) { /* private mode */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch (err) { /* private mode */ } },
  };
  const rectOf = (el) => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; };
  const place = (el, r) => { el.style.left = r[0] + 'px'; el.style.top = r[1] + 'px'; el.style.width = r[2] + 'px'; el.style.height = r[3] + 'px'; };
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  // Move a picture from one rectangle to another. The target is measured every frame, so it lands
  // exactly even if fonts or scrolling move the target on the way. radius(e, target) gives the
  // rounding of the top corners as it goes: the card's arch is a rectangle whose top corners are
  // rounded by half its width.
  function fly(el, from, to, o) {
    const t0 = performance.now();
    const step = (now) => {
      const t = clamp((now - t0) / o.ms), e = easeIO(t), r = to();
      place(el, from.map((v, i) => v + (r[i] - v) * e));
      if (o.radius) { const rr = Math.max(0, o.radius(e, r)).toFixed(1) + 'px'; el.style.borderTopLeftRadius = rr; el.style.borderTopRightRadius = rr; }
      if (o.step) o.step(e);
      if (t < 1) requestAnimationFrame(step); else if (o.done) o.done();
    };
    requestAnimationFrame(step);
  }
  // The flying picture. o.pos frames it as the page's picture is framed (object-position);
  // o.lqip is a tiny copy shown until the photograph is decoded; o.flat starts it square-cornered,
  // without the arch's gold line.
  function arch(r, src, o = {}) {
    const g = document.createElement('div');
    g.className = 'arch xfer' + (o.flat ? ' is-plain' : '');
    g.setAttribute('aria-hidden', 'true');
    if (o.lqip) g.style.setProperty('--lqip', o.lqip);
    if (o.pos) g.style.setProperty('--pos', o.pos);
    if (o.flat) g.style.borderRadius = '0';
    const img = document.createElement('img');
    img.alt = '';
    img.src = src;
    g.appendChild(img);
    place(g, r);
    document.body.appendChild(g);
    return g;
  }
  function veil(opacity) {
    const v = document.createElement('div');
    v.className = 'xfer-veil';
    v.style.opacity = opacity;
    document.body.appendChild(v);
    return v;
  }
  const fade = (el, from, to, ms) => el.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
  const pageKey = (u) => new URL(u, location.href).pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
  const samePage = (a, b) => pageKey(a) === pageKey(b);
  // The trail: for each page reached through a card or a View more link, where it was reached
  // from and how that page was scrolled, so "back" can return to exactly that place.
  const trail = {
    all: () => store.get('sbk:trail') || {},
    set(to) {
      const m = trail.all(), strip = $('[data-works-track]');
      m[pageKey(to)] = { url: location.href.split('#')[0], y: window.scrollY, x: strip ? strip.scrollLeft : 0, t: Date.now() };
      store.set('sbk:trail', m);
    },
    to: (page) => trail.all()[pageKey(page)] || null,                     // how `page` was reached
    from: (page) => Object.values(trail.all()).filter((e) => e && samePage(e.url, page)).sort((a, b) => b.t - a.t)[0] || null,  // the latest step away from `page`
  };
  AA.xfer = { store, rectOf, place, fly, arch, veil, fade, samePage, trail };

  // back (or forward) to this page after a reload: put the Selected work carousel where it was left
  (() => {
    const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
    const from = trail.from(location.href);
    const strip = $('[data-works-track]');
    if (strip && nav && nav.type === 'back_forward' && from && samePage(from.url, location.href) && typeof from.x === 'number') strip.scrollLeft = from.x;
  })();

  $$('[data-fade]').forEach((a) => {
    a.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (AA.reduce || typeof Element.prototype.animate !== 'function') return;   // a plain link
      e.preventDefault();
      trail.set(a.href);
      if (lenis) lenis.stop();
      fade(veil(0), 0, 1, 320);
      setTimeout(() => { location.href = a.href; }, 300);
    });
  });

  const expanders = $$('[data-expand]');
  let leaving = false;
  expanders.forEach((link) => {
    const card = link.closest('.work');
    const box = card && $('.arch', card);
    const photo = box && $('.work__photo', box);
    if (!box || !photo) return;
    let warmed = false;
    const warm = () => {               // fetch the page and its picture early, so the arch is not kept waiting
      if (warmed) return;
      warmed = true;
      [link.href, link.dataset.prefetch].filter(Boolean).forEach((href) => {
        const l = document.createElement('link');
        l.rel = 'prefetch';
        l.href = href;
        document.head.appendChild(l);
      });
    };
    link.addEventListener('pointerenter', warm);
    link.addEventListener('focus', warm);
    card.addEventListener('pointerenter', warm);
    card.addEventListener('pointerdown', warm, { passive: true });
    link.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (AA.reduce || typeof Element.prototype.animate !== 'function') return;   // a plain link
      e.preventDefault();
      if (leaving) return;
      leaving = true;
      const r = rectOf(box);
      store.set('sbk:xfer', { to: link.href, r, src: photo.currentSrc || photo.src, t: Date.now() });
      trail.set(link.href);
      if (lenis) lenis.stop();
      const v = veil(0);
      const g = arch(r, photo.currentSrc || photo.src);
      if (!card.classList.contains('is-built')) fade(g, 0, 1, 260);   // mid-drawing: the photograph takes over
      fade(v, 0, 1, 320);
      setTimeout(() => { location.href = link.href; }, 300);
    });
  });

  // Back from a project page: the picture closes into its card's arch while the paper lifts.
  // Restored from the back/forward cache, the page is exactly as it was left (pageshow). Loaded
  // afresh, the page is covered before it first paints (the script at the top of index.html), put
  // back where the visitor left it at once, and the picture moves once the page has settled.
  function prepareReturn(reloaded) {
    const back = store.get('sbk:back');
    store.del('sbk:back');
    const early = reloaded ? { v: $('.xfer-veil'), g: $('.arch.xfer') } : {};
    const drop = () => { if (early.v) early.v.remove(); if (early.g) early.g.remove(); return null; };
    if (!back || Date.now() - back.t > 8000 || AA.reduce) return drop();
    const link = expanders.find((a) => samePage(a.href, back.from));
    const card = link && link.closest('.work');
    const box = card && $('.arch', card);
    if (!box) return drop();
    if (reloaded) {
      const nav = performance.getEntriesByType ? performance.getEntriesByType('navigation')[0] : null;
      const from = trail.to(back.from);
      const target = location.hash && document.getElementById(location.hash.slice(1));
      let y = null;
      if (nav && nav.type === 'back_forward' && from && samePage(from.url, location.href) && typeof from.y === 'number') {
        y = from.y;
        if (card.parentElement && typeof from.x === 'number') card.parentElement.scrollLeft = from.x;
      } else if (target) y = pageY(target);
      if (y !== null) { if (lenis) lenis.scrollTo(y, { immediate: true, force: true }); else window.scrollTo(0, y); }
    }
    card.classList.add('is-instant', 'is-built');      // the photograph is simply there, no reveal
    void card.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.remove('is-instant')));
    return { back, box, v: early.v || veil(1), g: early.g || arch(back.r, back.src, { lqip: back.lqip, pos: back.pos, flat: true }) };
  }
  function landReturn(job, tries = 0) {
    const { back, box, v, g } = job;
    const r = rectOf(box);
    const seen = r[1] + r[3] > 0 && r[1] < window.innerHeight && r[0] + r[2] > 0 && r[0] < window.innerWidth;
    if (!seen && tries < 30) { requestAnimationFrame(() => landReturn(job, tries + 1)); return; }
    if (seen) {
      fly(g, back.r, () => rectOf(box), {
        ms: 900,
        radius: (e, t) => e * t[2] / 2,                 // the square corners round into the arch
        step: (e) => { if (e > 0.75) g.classList.remove('is-plain'); },
        done: () => g.remove(),
      });
    } else fade(g, 1, 0, 300).onfinish = () => g.remove();
    fade(v, 1, 0, 760).onfinish = () => v.remove();
  }
  // after a reload, wait for the page to finish starting up (the 3D scene), so the move is smooth
  const settled = (fn) => {
    const go = () => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 700 }) : setTimeout(fn, 150));
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
  };
  if (!expanders.length && $$('[data-fade]').length) {
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      $$('.xfer, .xfer-veil').forEach((n) => n.remove());
      if (lenis) lenis.start();
    });
  }
  if (expanders.length) {
    const first = prepareReturn(true);
    if (first) settled(() => requestAnimationFrame(() => landReturn(first)));
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      $$('.xfer, .xfer-veil').forEach((n) => n.remove());
      leaving = false;
      if (lenis) lenis.start();
      const job = prepareReturn(false);
      if (job) requestAnimationFrame(() => landReturn(job));
    });
  }
})();
