/*! ASCII Sharks — https://github.com/stackedlol/ascii-sharks
Pinned revision a0074c16a106f0abc665fe9712ca445f8f98ad8e.
MIT License

Copyright (c) 2026 drewdi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Geist font notice:
Copyright (c) 2023 Vercel, in collaboration with basement.studio

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL

-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION AND CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
*/
// 用户参考中的固定版本引擎；保留群游、捕食、摆尾和字符栅格化逻辑。
export function createSimulation(seed, document) {
  let state = seed | 0;
  const Math2 = Object.create(globalThis.Math);
  Math2.random = () => {
    state = state + 1831565813 | 0;
    let t = globalThis.Math.imul(state ^ state >>> 15, 1 | state);
    t = t + globalThis.Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  var AsciiSharksCore = (() => {
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    var ascii_sharks_upstream_exports = {};
    __export(ascii_sharks_upstream_exports, {
      AsciiRenderer: () => AsciiRenderer,
      World: () => World
    });
    var TAU = Math2.PI * 2;
    var clamp2 = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
    var rand = (lo, hi) => lo + Math2.random() * (hi - lo);
    var randInt = (lo, hi) => Math2.floor(rand(lo, hi + 1));
    function smoothstep(e0, e1, x) {
      const t = clamp2((x - e0) / (e1 - e0), 0, 1);
      return t * t * (3 - 2 * t);
    }
    function angleDiff(a, b) {
      let d = (b - a) % TAU;
      if (d > Math2.PI) d -= TAU;
      if (d < -Math2.PI) d += TAU;
      return d;
    }
    function hash3(x, y, z) {
      let h = Math2.imul(x | 0, 374761393) ^ Math2.imul(y | 0, 668265263) ^ Math2.imul(z | 0, 1442695041);
      h = Math2.imul(h ^ h >>> 13, 1274126177);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    }
    var K1 = 1 / 260;
    var K2 = 1 / 310;
    var K3 = 1 / 190;
    var CURRENT_SCALE = 3400;
    function current(x, y, t, out) {
      const a = x * K1 + t * 0.07;
      const b = y * K2 - t * 0.05;
      const c = (x + y) * K3 + t * 0.11;
      out.x = (-K2 * Math2.sin(a) * Math2.sin(b) + 0.5 * K3 * Math2.cos(c)) * CURRENT_SCALE;
      out.y = (-K1 * Math2.cos(a) * Math2.cos(b) - 0.5 * K3 * Math2.cos(c)) * CURRENT_SCALE;
      return out;
    }
    var SPECIES = [
      {
        name: "sardine",
        cruise: 36,
        maxSpeed: 64,
        minSpeed: 18,
        weight: 3,
        schoolSize: [18, 28],
        spacing: [1.8, 1.1],
        align: 1.6,
        cohesion: 1.6,
        jitter: 40,
        mill: 70,
        verticalDrag: 0.5
      },
      {
        name: "anchovy",
        cruise: 46,
        maxSpeed: 78,
        minSpeed: 22,
        weight: 3,
        schoolSize: [20, 32],
        spacing: [1.5, 1],
        align: 3.2,
        cohesion: 0.45,
        jitter: 30,
        mill: 0,
        verticalDrag: 1.4
      },
      {
        name: "silverside",
        cruise: 40,
        maxSpeed: 70,
        minSpeed: 20,
        weight: 3,
        schoolSize: [12, 20],
        spacing: [2, 1.1],
        align: 2.4,
        cohesion: 1.1,
        jitter: 35,
        mill: 0,
        verticalDrag: 1.6
      },
      {
        name: "mackerel",
        cruise: 32,
        maxSpeed: 60,
        minSpeed: 16,
        weight: 2,
        schoolSize: [5, 9],
        spacing: [2.6, 1.3],
        align: 2,
        cohesion: 0.9,
        jitter: 25,
        mill: 0,
        verticalDrag: 2
      },
      {
        name: "goby",
        cruise: 26,
        maxSpeed: 56,
        minSpeed: 10,
        weight: 1,
        schoolSize: [8, 12],
        spacing: [1.4, 1.1],
        align: 0.35,
        cohesion: 1.4,
        jitter: 110,
        mill: 0,
        verticalDrag: 0.3
      }
    ];
    var TOTAL_WEIGHT = SPECIES.reduce((sum, s) => sum + s.weight, 0);
    function pickSpecies() {
      let r = Math2.random() * TOTAL_WEIGHT;
      for (let i = 0; i < SPECIES.length; i++) {
        r -= SPECIES[i].weight;
        if (r <= 0) return i;
      }
      return 0;
    }
    var SHARK_NODES = 20;
    var DEFAULT_SHARKS = [
      { kind: "classic", size: 1 },
      { kind: "classic", size: 0.7 },
      { kind: "classic", size: 0.84 },
      { kind: "classic", size: 0.77 }
    ];
    var FISH_SEPARATION_K = 420;
    var FISH_ALIGN_K = 1.4;
    var FISH_COHESION_K = 1;
    var FISH_FLEE_K = 1100;
    var BLIND_COS = -0.6;
    var World = class {
      /** fishCount overrides the area-based population (the sidebar wants a single small school). */
      constructor(sharkSpecs2 = DEFAULT_SHARKS, fishCount) {
        this.sharkSpecs = sharkSpecs2;
        this.fishCount = fishCount;
        this.width = 0;
        this.height = 0;
        this.time = 0;
        this.fish = [];
        this.sharks = [];
        this.events = [];
        this.pointer = { x: 0, y: 0, active: false };
        this.perception = 60;
        this.sepX = [];
        this.sepY = [];
        this.foreignSep = 40;
        this.bucketCols = 0;
        this.bucketRows = 0;
        this.bucketHead = new Int32Array(0);
        this.bucketCount = new Uint16Array(0);
        this.bucketNext = new Int32Array(0);
        this.lastSpawn = 0;
        this.tmp = { x: 0, y: 0 };
      }
      resize(width, height, cellW, cellH) {
        const first = this.width === 0;
        this.width = width;
        this.height = height;
        this.sepX = SPECIES.map((sp) => sp.spacing[0] * cellW);
        this.sepY = SPECIES.map((sp) => sp.spacing[1] * cellH);
        this.perception = Math2.max(cellH * 3, cellW * 5.5);
        this.foreignSep = cellW * 3;
        if (first || this.fish.length === 0) {
          this.seed();
          return;
        }
        for (const f of this.fish) {
          f.x = clamp2(f.x, 0, width);
          f.y = clamp2(f.y, 0, height);
        }
      }
      seed() {
        const { width: W, height: H } = this;
        const minSide = Math2.min(W, H);
        const baseLength = clamp2(minSide * 0.44, 170, 430);
        const sharkCount = this.sharkSpecs.length;
        this.sharks = [];
        for (let i = 0; i < sharkCount; i++) {
          const { kind, size } = this.sharkSpecs[i];
          const length = baseLength * size;
          const orbitRadius = minSide * rand(0.28, 0.4);
          const a = i / sharkCount * TAU + rand(-0.4, 0.4);
          const orbitDir = i % 2 === 0 ? 1 : -1;
          const x = W / 2 + Math2.cos(a) * orbitRadius * (W / minSide) * 0.9;
          const y = H / 2 + Math2.sin(a) * orbitRadius;
          const heading = a + orbitDir * Math2.PI / 2;
          const nodes = new Float32Array(SHARK_NODES * 2);
          const seg = length / (SHARK_NODES - 1);
          for (let n = 0; n < SHARK_NODES; n++) {
            nodes[n * 2] = x - Math2.cos(heading) * seg * n;
            nodes[n * 2 + 1] = y - Math2.sin(heading) * seg * n;
          }
          this.sharks.push({
            id: i + 1,
            kind,
            length,
            nodes,
            heading,
            speed: 30,
            phase: rand(0, TAU),
            turn: 0,
            hunger: rand(0.25, 0.75),
            wander: 0,
            orbitDir,
            orbitRadius,
            target: null,
            retargetAt: 0,
            depth: size
          });
        }
        this.sharks.sort((a, b) => a.length - b.length);
        const total = this.fishCount ?? clamp2(Math2.round(W * H / 4400), 85, 340);
        this.fish = [];
        while (this.fish.length < total) {
          const species = pickSpecies();
          const sp = SPECIES[species];
          const size = Math2.min(randInt(sp.schoolSize[0], sp.schoolSize[1]), total - this.fish.length);
          const millDir = Math2.random() < 0.5 ? 1 : -1;
          const cx = rand(W * 0.06, W * 0.94);
          const cy = rand(H * 0.08, H * 0.92);
          const dir = (Math2.random() < 0.5 ? 0 : Math2.PI) + rand(-0.5, 0.5);
          for (let k = 0; k < size; k++) {
            this.fish.push({
              x: cx + rand(-1, 1) * this.sepX[species] * Math2.sqrt(size),
              y: cy + rand(-1, 1) * this.sepY[species] * Math2.sqrt(size) * 0.6,
              vx: Math2.cos(dir) * sp.cruise,
              vy: Math2.sin(dir) * sp.cruise,
              species,
              alarm: 0,
              alive: true,
              respawnAt: 0,
              phase: rand(0, TAU),
              turn: 0,
              depth: rand(0.55, 1),
              millDir
            });
          }
        }
        this.bucketNext = new Int32Array(this.fish.length);
      }
      splash(x, y) {
        this.events.push({ kind: "splash", x, y });
        const r = 240;
        for (const f of this.fish) {
          if (!f.alive) continue;
          const dx = f.x - x;
          const dy = f.y - y;
          const d = Math2.hypot(dx, dy);
          if (d > r || d < 1e-3) continue;
          const k = (1 - d / r) * 260;
          f.vx += dx / d * k;
          f.vy += dy / d * k;
          f.alarm = 1;
        }
      }
      step(dt) {
        this.time += dt;
        this.rebuildHash();
        this.stepFish(dt);
        this.stepSharks(dt);
        this.respawn();
      }
      rebuildHash() {
        const size = this.perception;
        const pad = 2;
        this.bucketCols = Math2.ceil(this.width / size) + pad * 2;
        this.bucketRows = Math2.ceil(this.height / size) + pad * 2;
        const n = this.bucketCols * this.bucketRows;
        if (this.bucketHead.length !== n) {
          this.bucketHead = new Int32Array(n);
          this.bucketCount = new Uint16Array(n);
        }
        this.bucketHead.fill(-1);
        this.bucketCount.fill(0);
        if (this.bucketNext.length !== this.fish.length) {
          this.bucketNext = new Int32Array(this.fish.length);
        }
        for (let i = 0; i < this.fish.length; i++) {
          const f = this.fish[i];
          if (!f.alive) continue;
          const b = this.bucketOf(f.x, f.y);
          this.bucketNext[i] = this.bucketHead[b];
          this.bucketHead[b] = i;
          this.bucketCount[b]++;
        }
      }
      bucketOf(x, y) {
        const size = this.perception;
        const c = clamp2(Math2.floor(x / size) + 2, 0, this.bucketCols - 1);
        const r = clamp2(Math2.floor(y / size) + 2, 0, this.bucketRows - 1);
        return r * this.bucketCols + c;
      }
      stepFish(dt) {
        const { fish, sharks, pointer, width: W, height: H, time } = this;
        const R = this.perception;
        const R2 = R * R;
        const foreignSep = this.foreignSep;
        const size = this.perception;
        const cols = this.bucketCols;
        const rows = this.bucketRows;
        const head = this.bucketHead;
        const next = this.bucketNext;
        const cur = this.tmp;
        const calmDecay = Math2.exp(-dt * 0.7);
        const contagion = Math2.min(1, dt * 6);
        for (let i = 0; i < fish.length; i++) {
          const f = fish[i];
          if (!f.alive) continue;
          const sp = SPECIES[f.species];
          const spread = 1 + 1.8 * f.alarm;
          const sepX = this.sepX[f.species] * spread;
          const sepY = this.sepY[f.species] * spread;
          const speed = Math2.hypot(f.vx, f.vy) || 1;
          const hx = f.vx / speed;
          const hy = f.vy / speed;
          let ax = 0;
          let ay = 0;
          let sx = 0;
          let sy = 0;
          let avx = 0;
          let avy = 0;
          let cx = 0;
          let cy = 0;
          let n = 0;
          let neighbourAlarm = 0;
          const bc = clamp2(Math2.floor(f.x / size) + 2, 0, cols - 1);
          const br = clamp2(Math2.floor(f.y / size) + 2, 0, rows - 1);
          for (let r = Math2.max(0, br - 1); r <= Math2.min(rows - 1, br + 1); r++) {
            for (let c = Math2.max(0, bc - 1); c <= Math2.min(cols - 1, bc + 1); c++) {
              let j = head[r * cols + c];
              while (j !== -1) {
                if (j !== i) {
                  const o = fish[j];
                  const dx = o.x - f.x;
                  const dy = o.y - f.y;
                  const d2 = dx * dx + dy * dy;
                  if (d2 < R2 && d2 > 1e-6) {
                    const d = Math2.sqrt(d2);
                    if ((dx * hx + dy * hy) / d > BLIND_COS) {
                      const qx = dx / sepX;
                      const qy = dy / sepY;
                      const q2 = qx * qx + qy * qy;
                      if (q2 < 1) {
                        const q = Math2.sqrt(q2) || 1e-3;
                        const k = (1 - q) / q;
                        sx -= qx * k;
                        sy -= qy * k;
                      }
                      if (o.species === f.species) {
                        avx += o.vx;
                        avy += o.vy;
                        cx += dx;
                        cy += dy;
                        n++;
                      } else if (d < foreignSep) {
                        const k = (1 - d / foreignSep) / d * 0.6;
                        sx -= dx * k;
                        sy -= dy * k;
                      }
                      if (o.alarm > neighbourAlarm) neighbourAlarm = o.alarm;
                    }
                  }
                }
                j = next[j];
              }
            }
          }
          ax += sx * FISH_SEPARATION_K;
          ay += sy * FISH_SEPARATION_K;
          if (n > 0) {
            const alignK = FISH_ALIGN_K * sp.align;
            const cohesionK = FISH_COHESION_K * sp.cohesion * (1 - 0.8 * f.alarm);
            ax += (avx / n - f.vx) * alignK + cx / n * cohesionK;
            ay += (avy / n - f.vy) * alignK + cy / n * cohesionK;
            if (sp.mill > 0) {
              const cl = Math2.hypot(cx, cy) || 1;
              ax += -cy / cl * f.millDir * sp.mill * (1 - f.alarm);
              ay += cx / cl * f.millDir * sp.mill * (1 - f.alarm);
            }
          }
          let fear = 0;
          for (const sh of sharks) {
            const fearR = sh.length * 0.6 + 60;
            let best = Infinity;
            let bx = 0;
            let by = 0;
            for (let k = 0; k <= 12; k += 3) {
              const nx = sh.nodes[k * 2];
              const ny = sh.nodes[k * 2 + 1];
              const d2 = (f.x - nx) ** 2 + (f.y - ny) ** 2;
              if (d2 < best) {
                best = d2;
                bx = nx;
                by = ny;
              }
            }
            const d = Math2.sqrt(best);
            if (d >= fearR || d < 1e-3) continue;
            let w = 1 - d / fearR;
            w *= w;
            const awayX = (f.x - bx) / d;
            const awayY = (f.y - by) / d;
            const shx = Math2.cos(sh.heading);
            const shy = Math2.sin(sh.heading);
            const side = shx * (f.y - sh.nodes[1]) - shy * (f.x - sh.nodes[0]) >= 0 ? 1 : -1;
            ax += (awayX * 0.7 - shy * side * 0.9) * FISH_FLEE_K * w;
            ay += (awayY * 0.7 + shx * side * 0.9) * FISH_FLEE_K * w;
            fear = Math2.max(fear, Math2.sqrt(w));
          }
          if (pointer.active) {
            const pr = 130;
            const dx = f.x - pointer.x;
            const dy = f.y - pointer.y;
            const d = Math2.hypot(dx, dy);
            if (d < pr && d > 1e-3) {
              const w = (1 - d / pr) ** 2;
              ax += dx / d * FISH_FLEE_K * w;
              ay += dy / d * FISH_FLEE_K * w;
              fear = Math2.max(fear, Math2.sqrt(w) * 0.8);
            }
          }
          let alarm = Math2.max(f.alarm * calmDecay, fear);
          const relayed = neighbourAlarm * 0.86;
          if (relayed > alarm) alarm += (relayed - alarm) * contagion;
          f.alarm = alarm;
          const m = 36;
          if (f.x < m) ax += (m - f.x) * 7;
          else if (f.x > W - m) ax -= (f.x - (W - m)) * 7;
          if (f.y < m) ay += (m - f.y) * 7;
          else if (f.y > H - m) ay -= (f.y - (H - m)) * 7;
          current(f.x, f.y, time, cur);
          ax += cur.x * 0.5 + (Math2.random() - 0.5) * sp.jitter;
          ay += cur.y * 0.5 + (Math2.random() - 0.5) * sp.jitter;
          ay -= f.vy * sp.verticalDrag * (1 - 0.7 * f.alarm);
          const preferred = sp.cruise * (1 + 1.3 * f.alarm);
          ax += (preferred - speed) * hx * 1.6;
          ay += (preferred - speed) * hy * 1.6;
          const before = Math2.atan2(f.vy, f.vx);
          f.vx += ax * dt;
          f.vy += ay * dt;
          const maxSpeed = sp.maxSpeed * (1 + 1.8 * f.alarm);
          const s = Math2.hypot(f.vx, f.vy);
          if (s > maxSpeed) {
            f.vx *= maxSpeed / s;
            f.vy *= maxSpeed / s;
          } else if (s < sp.minSpeed && s > 1e-3) {
            f.vx *= sp.minSpeed / s;
            f.vy *= sp.minSpeed / s;
          }
          f.turn += (angleDiff(before, Math2.atan2(f.vy, f.vx)) / dt - f.turn) * Math2.min(1, dt * 8);
          f.phase += dt * (7 + Math2.hypot(f.vx, f.vy) * 0.12);
          f.x = clamp2(f.x + f.vx * dt, -60, W + 60);
          f.y = clamp2(f.y + f.vy * dt, -60, H + 60);
        }
      }
      stepSharks(dt) {
        const { sharks, width: W, height: H, time } = this;
        const minSide = Math2.min(W, H);
        const cxW = W / 2;
        const cyW = H / 2;
        for (const sh of sharks) {
          const L = sh.length;
          const nodes = sh.nodes;
          const hx = nodes[0];
          const hy = nodes[1];
          sh.hunger = Math2.min(1, sh.hunger + dt * 0.03);
          let dx = Math2.cos(sh.heading);
          let dy = Math2.sin(sh.heading);
          sh.wander = clamp2(sh.wander + (Math2.random() - 0.5) * dt * 3.2, -1.1, 1.1);
          dx += Math2.cos(sh.heading + sh.wander) * 0.45;
          dy += Math2.sin(sh.heading + sh.wander) * 0.45;
          if (time >= sh.retargetAt) {
            sh.target = this.findPrey(sh);
            sh.retargetAt = time + 0.45;
          }
          const t = sh.target;
          let hunting = false;
          let closing = 0;
          if (t && t.alive && sh.hunger > 0.3) {
            const tx = t.x + t.vx * 0.35 - hx;
            const ty = t.y + t.vy * 0.35 - hy;
            const d = Math2.hypot(tx, ty) || 1;
            const w = 1.4 + 2.6 * sh.hunger;
            dx += tx / d * w;
            dy += ty / d * w;
            hunting = true;
            closing = clamp2(1 - d / (L * 0.9), 0, 1);
          } else {
            const rx = (hx - cxW) / (W / minSide);
            const ry = hy - cyW;
            const r = Math2.hypot(rx, ry) || 1;
            const radius = sh.orbitRadius * (1 + 0.15 * Math2.sin(time * 0.05 + sh.id));
            const radial = clamp2((radius - r) / radius, -1, 1);
            dx += (-ry / r * sh.orbitDir + rx / r * radial * 0.9) * 0.55;
            dy += (rx / r * sh.orbitDir + ry / r * radial * 0.9) * 0.55;
          }
          for (const other of sharks) {
            if (other === sh) continue;
            for (let k = 0; k < SHARK_NODES; k += 4) {
              const ox = hx - other.nodes[k * 2];
              const oy = hy - other.nodes[k * 2 + 1];
              const d = Math2.hypot(ox, oy);
              const range = (L + other.length) * 0.45;
              if (d < range && d > 1e-3) {
                const w = (1 - d / range) * 3;
                dx += ox / d * w;
                dy += oy / d * w;
              }
            }
          }
          const ex = (hx - cxW) / (W * 0.3);
          const ey = (hy - cyW) / (H * 0.16);
          const e2 = ex * ex + ey * ey;
          if (e2 < 1) {
            const e = Math2.sqrt(e2) || 1e-3;
            const w = (1 - e) * (hunting ? 1 : 2.5);
            dx += ex / e * w;
            dy += ey / e * w;
          }
          const over = Math2.max(-hx, hx - W, -hy, hy - H);
          if (over > -L * 0.05) {
            const w = clamp2((over + L * 0.05) / (L * 0.35), 0, 1) * 3.5;
            const toX = cxW - hx;
            const toY = cyW - hy;
            const d = Math2.hypot(toX, toY) || 1;
            dx += toX / d * w;
            dy += toY / d * w;
          }
          const desired = Math2.atan2(dy, dx);
          const agility = Math2.min(hunting ? 1.7 + closing : 0.8, sh.speed / (L * 0.22));
          const maxTurn = agility * dt;
          const turned = clamp2(angleDiff(sh.heading, desired), -maxTurn, maxTurn);
          sh.heading += turned;
          sh.turn += (turned / dt - sh.turn) * Math2.min(1, dt * 3);
          const cruise = 30 + L * 0.04;
          const targetSpeed = hunting ? cruise * (1.45 + closing * 1.5) : cruise;
          sh.speed += (targetSpeed - sh.speed) * Math2.min(1, dt * 1.1);
          sh.phase += dt * (2 + sh.speed / 24);
          nodes[0] += Math2.cos(sh.heading) * sh.speed * dt;
          nodes[1] += Math2.sin(sh.heading) * sh.speed * dt;
          const seg = L / (SHARK_NODES - 1);
          const maxBend = 0.16;
          let prevAngle = sh.heading + Math2.PI;
          for (let k = 1; k < SHARK_NODES; k++) {
            const px = nodes[(k - 1) * 2];
            const py = nodes[(k - 1) * 2 + 1];
            let angle = Math2.atan2(nodes[k * 2 + 1] - py, nodes[k * 2] - px);
            angle = prevAngle + clamp2(angleDiff(prevAngle, angle), -maxBend, maxBend);
            nodes[k * 2] = px + Math2.cos(angle) * seg;
            nodes[k * 2 + 1] = py + Math2.sin(angle) * seg;
            prevAngle = angle;
          }
          if (sh.hunger > 0.15) {
            const mouthR = L * 0.05 + 8;
            const mx = nodes[0];
            const my = nodes[1];
            for (const f of this.fish) {
              if (!f.alive) continue;
              if ((f.x - mx) ** 2 + (f.y - my) ** 2 < mouthR * mouthR) {
                f.alive = false;
                f.respawnAt = time + rand(3, 8);
                sh.hunger = Math2.max(0, sh.hunger - 0.16);
                this.events.push({ kind: "eat", x: f.x, y: f.y });
              }
            }
          }
        }
      }
      /**
       * Pick prey in the shark's forward cone, preferring close fish in sparse
       * buckets (stragglers) over fish buried in a dense school.
       */
      findPrey(sh) {
        const range = sh.length * 0.9 + 160;
        const hx = sh.nodes[0];
        const hy = sh.nodes[1];
        const fx = Math2.cos(sh.heading);
        const fy = Math2.sin(sh.heading);
        let best = null;
        let bestScore = Infinity;
        let currentScore = Infinity;
        for (const f of this.fish) {
          if (!f.alive) continue;
          const dx = f.x - hx;
          const dy = f.y - hy;
          const d = Math2.hypot(dx, dy);
          if (d > range || d < 1e-3) continue;
          const cos = (dx * fx + dy * fy) / d;
          if (cos < 0.2) continue;
          const crowd = this.bucketCount[this.bucketOf(f.x, f.y)];
          const score = d * (1 + (1 - cos) * 0.8) * (1 + crowd * 0.07);
          if (score < bestScore) {
            bestScore = score;
            best = f;
          }
          if (f === sh.target) currentScore = score;
        }
        if (sh.target && currentScore < bestScore * 1.3) return sh.target;
        return best;
      }
      respawn() {
        const { time, width: W, height: H } = this;
        const due = [];
        for (const f of this.fish) if (!f.alive && f.respawnAt <= time) due.push(f);
        if (due.length === 0) return;
        if (due.length < 6 && time - this.lastSpawn < 9) return;
        this.lastSpawn = time;
        const side = randInt(0, 3);
        const along = rand(0.15, 0.85);
        const x = side === 0 ? -20 : side === 1 ? W + 20 : along * W;
        const y = side === 2 ? -20 : side === 3 ? H + 20 : along * H;
        const inward = Math2.atan2(H / 2 - y, W / 2 - x) + rand(-0.5, 0.5);
        const species = pickSpecies();
        const sp = SPECIES[species];
        const millDir = Math2.random() < 0.5 ? 1 : -1;
        for (const f of due.slice(0, sp.schoolSize[1])) {
          f.alive = true;
          f.species = species;
          f.alarm = 0;
          f.turn = 0;
          f.millDir = millDir;
          f.x = x + rand(-1, 1) * this.perception;
          f.y = y + rand(-1, 1) * this.perception;
          f.vx = Math2.cos(inward) * sp.cruise * 1.4;
          f.vy = Math2.sin(inward) * sp.cruise * 1.4;
        }
      }
    };
    var ALPHA_LEVELS = 6;
    var FISH_ALPHAS = [0.28, 0.42, 0.58, 0.74, 0.9];
    var DOT_RGB = [
      [48, 52, 235],
      [52, 205, 60],
      [228, 50, 44],
      [190, 212, 255],
      [110, 230, 255]
    ];
    var DOT_BASE_ALPHA = [1, 1, 1, 1, 1];
    var WAKE = DOT_RGB.length - 1;
    var ACCENTS = ["#e0892c", "#e03a32", "#b44ae0", "#33c8cc", "#3cb54a", "#3150e8", "#d9c14a"];
    var SKIN_RAMP = ":;t%SX8#@";
    var FIN_GLYPHS = "%;tS:";
    var RIDGE_GLYPHS = "@8%";
    var EDGE_HEAVY = ":;";
    var EDGE_LIGHT = ".',`";
    var FLAG_BODY = 1;
    var FLAG_EDGE = 2;
    var FLAG_FIN = 3;
    var FLAG_RIDGE = 4;
    var FLAG_EYE = 5;
    var FLAG_MARK = 6;
    var MARK_GLYPHS = "#%@";
    var SUBSAMPLES = [0.25, 0.3, 0.75, 0.3, 0.25, 0.72, 0.75, 0.72];
    function classicHalfWidth(s) {
      if (s < 0.13) return 0.09 * Math2.pow(Math2.sin(s / 0.13 * Math2.PI / 2), 0.95);
      if (s < 0.3) return 0.09 + 0.016 * smoothstep(0.13, 0.3, s);
      if (s < 0.84) return 0.019 + 0.087 * Math2.pow(1 - (s - 0.3) / 0.54, 1.25);
      const k = (s - 0.84) / 0.16;
      return 0.019 * (1 - k) + 0.012 * Math2.sin(k * Math2.PI);
    }
    var SHAPES = {
      classic: {
        halfWidth: classicHalfWidth,
        pectoral: [0.15, 0.43, 0.55, 0.26],
        falcate: true,
        pelvic: [0.57, 0.65, 0.69, 0.085],
        caudal: 0.085,
        dorsal: [0.33, 0.47],
        secondDorsal: [0.71, 0.76],
        eye: [0.1, 0.14],
        gills: [0.19, 0.29],
        tint: [0.92, 0.97, 1.05]
      },
      // Slim neck under a wide, swept-back cephalofoil (drawn in sampleShark),
      // tall first dorsal, long upper tail lobe. Bronze-olive grey.
      hammerhead: {
        halfWidth: (s) => {
          if (s < 0.06) return 0.045;
          if (s < 0.3) return 0.045 + 0.061 * smoothstep(0.06, 0.3, s);
          return classicHalfWidth(s) * 0.92;
        },
        head: { span: 0.17, sweep: 0.035, depth: 0.09, notch: 0 },
        pectoral: [0.17, 0.4, 0.5, 0.22],
        falcate: true,
        pelvic: [0.56, 0.63, 0.67, 0.075],
        caudal: 0.11,
        dorsal: [0.28, 0.44],
        secondDorsal: [0.7, 0.74],
        eye: null,
        gills: [0.16, 0.26],
        tint: [0.96, 0.98, 0.9]
      },
      // Blunt, square snout on a heavy body; barred back. Warm grey-brown.
      tiger: {
        halfWidth: (s) => {
          if (s < 0.13) return 0.1 * Math2.pow(Math2.sin(s / 0.13 * Math2.PI / 2), 0.45);
          if (s < 0.3) return 0.1 + 0.014 * smoothstep(0.13, 0.3, s);
          if (s < 0.84) return 0.019 + 0.095 * Math2.pow(1 - (s - 0.3) / 0.54, 1.2);
          const k = (s - 0.84) / 0.16;
          return 0.019 * (1 - k) + 0.012 * Math2.sin(k * Math2.PI);
        },
        pectoral: [0.15, 0.42, 0.53, 0.25],
        falcate: true,
        pelvic: [0.57, 0.65, 0.69, 0.085],
        caudal: 0.095,
        dorsal: [0.33, 0.46],
        secondDorsal: [0.71, 0.75],
        eye: [0.08, 0.12],
        gills: [0.19, 0.28],
        tint: [1.02, 0.95, 0.84]
      },
      // Short rounded head, body done by half-length, then a long ribbon of a
      // tail fin. Broad rounded pectorals, spotted sandy skin.
      zebra: {
        halfWidth: (s) => {
          if (s < 0.1) return 0.075 * Math2.pow(Math2.sin(s / 0.1 * Math2.PI / 2), 0.7);
          if (s < 0.28) return 0.075 + 0.025 * smoothstep(0.1, 0.28, s);
          if (s < 0.55) return 0.022 + 0.078 * Math2.pow(1 - (s - 0.28) / 0.27, 1.1);
          const k = (s - 0.55) / 0.45;
          return 0.022 * (1 - k * k) + 0.012 * Math2.sin(k * Math2.PI);
        },
        pectoral: [0.12, 0.3, 0.36, 0.19],
        falcate: false,
        pelvic: [0.42, 0.48, 0.51, 0.065],
        caudal: 0,
        dorsal: [0.36, 0.44],
        secondDorsal: [0.49, 0.53],
        eye: [0.06, 0.09],
        gills: [0.13, 0.2],
        tint: [1.08, 0.97, 0.74]
      },
      // Great hammerhead: a broader, nearly straight-edged cephalofoil with a notch at the centre,
      // a towering sickle first dorsal (drawn long and bright from above), and a cooler slate skin.
      greathammer: {
        halfWidth: (s) => {
          if (s < 0.05) return 0.04;
          if (s < 0.3) return 0.04 + 0.07 * smoothstep(0.05, 0.3, s);
          return classicHalfWidth(s) * 0.95;
        },
        head: { span: 0.21, sweep: 6e-3, depth: 0.085, notch: 0.014 },
        pectoral: [0.16, 0.38, 0.49, 0.24],
        falcate: true,
        pelvic: [0.55, 0.62, 0.67, 0.085],
        caudal: 0.13,
        dorsal: [0.24, 0.45],
        secondDorsal: [0.68, 0.74],
        eye: null,
        gills: [0.15, 0.25],
        tint: [0.86, 0.93, 1.02]
      },
      // Shortfin mako: a long conical snout, a torpedo body that narrows hard to the tail stalk,
      // and a tall crescent tail. Metallic indigo back.
      mako: {
        halfWidth: (s) => {
          if (s < 0.17) return 0.088 * Math2.pow(Math2.sin(s / 0.17 * Math2.PI / 2), 1.5);
          if (s < 0.32) return 0.088 + 0.012 * smoothstep(0.17, 0.32, s);
          if (s < 0.86) return 0.014 + 0.086 * Math2.pow(1 - (s - 0.32) / 0.54, 1.45);
          const k = (s - 0.86) / 0.14;
          return 0.014 * (1 - k) + 0.01 * Math2.sin(k * Math2.PI);
        },
        pectoral: [0.18, 0.4, 0.5, 0.21],
        falcate: true,
        pelvic: [0.58, 0.64, 0.68, 0.06],
        caudal: 0.13,
        dorsal: [0.34, 0.45],
        secondDorsal: [0.76, 0.79],
        eye: [0.11, 0.15],
        gills: [0.2, 0.3],
        tint: [0.78, 0.9, 1.2]
      },
      // Thresher: a compact body over the front half, then the upper tail lobe as a long whip
      // that's as long as the shark itself. Big eyes, long sickle pectorals, bronze-violet skin.
      thresher: {
        halfWidth: (s) => {
          if (s < 0.08) return 0.07 * Math2.pow(Math2.sin(s / 0.08 * Math2.PI / 2), 0.75);
          if (s < 0.2) return 0.07 + 0.02 * smoothstep(0.08, 0.2, s);
          if (s < 0.48) return 0.012 + 0.078 * Math2.pow(1 - (s - 0.2) / 0.28, 1.3);
          const k = (s - 0.48) / 0.52;
          return 0.012 * (1 - k) + 6e-3 * Math2.sin(k * Math2.PI * 0.9) + 2e-3;
        },
        pectoral: [0.12, 0.27, 0.36, 0.2],
        falcate: true,
        pelvic: [0.37, 0.41, 0.44, 0.045],
        caudal: 0,
        dorsal: [0.24, 0.32],
        secondDorsal: [0.45, 0.47],
        eye: [0.05, 0.1],
        gills: [0.11, 0.18],
        tint: [1, 0.9, 1.08]
      },
      // Nurse shark: a blunt, broad head, a heavy flattened body with both dorsals set far back,
      // rounded paddle pectorals, and a long low tail with no lower lobe. Tawny brown.
      nurse: {
        halfWidth: (s) => {
          if (s < 0.08) return 0.085 * Math2.pow(Math2.sin(s / 0.08 * Math2.PI / 2), 0.4);
          if (s < 0.3) return 0.085 + 0.02 * smoothstep(0.08, 0.3, s);
          if (s < 0.72) return 0.022 + 0.083 * Math2.pow(1 - (s - 0.3) / 0.42, 1.1);
          const k = (s - 0.72) / 0.28;
          return 0.022 * (1 - k * k) + 0.014 * Math2.sin(k * Math2.PI);
        },
        pectoral: [0.16, 0.34, 0.4, 0.17],
        falcate: false,
        pelvic: [0.45, 0.52, 0.55, 0.075],
        caudal: 0,
        dorsal: [0.5, 0.58],
        secondDorsal: [0.63, 0.69],
        eye: [0.05, 0.075],
        gills: [0.14, 0.22],
        tint: [1.1, 0.96, 0.76]
      }
    };
    var KINDS2 = Object.keys(SHAPES);
    function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
      const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
      const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
      const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
      const neg = d1 < 0 || d2 < 0 || d3 < 0;
      const pos = d1 > 0 || d2 > 0 || d3 > 0;
      return !(neg && pos);
    }
    function paintGrid(g, W, H, cw, ch, dpr) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.strokeStyle = "rgba(255,255,255,0.055)";
      g.lineWidth = 1;
      g.beginPath();
      for (let c = 0; c <= Math2.ceil(W / cw); c++) {
        const x = Math2.round(c * cw * dpr) + 0.5;
        g.moveTo(x, 0);
        g.lineTo(x, H * dpr);
      }
      for (let r = 0; r <= Math2.ceil(H / ch); r++) {
        const y = Math2.round(r * ch * dpr) + 0.5;
        g.moveTo(0, y);
        g.lineTo(W * dpr, y);
      }
      g.stroke();
    }
    var AsciiRenderer = class {
      constructor(canvas) {
        this.canvas = canvas;
        this.dpr = 1;
        this.width = 0;
        this.height = 0;
        this.cw = 12;
        this.ch = 18;
        this.cols = 0;
        this.rows = 0;
        this.fontFamily = "ui-monospace, Menlo, monospace";
        this.dotKind = new Uint8Array(0);
        this.dotPhase = new Float32Array(0);
        this.dotFreq = new Float32Array(0);
        this.energy = new Float32Array(0);
        this.energyTmp = new Float32Array(0);
        this.heat = new Float32Array(0);
        this.bucketOf = new Uint8Array(0);
        this.bucketOrder = new Int32Array(0);
        this.bucketCounts = new Int32Array(DOT_RGB.length * ALPHA_LEVELS + 1);
        this.dotStyles = [];
        this.sharkFlag = new Uint8Array(0);
        this.sharkShade = new Float32Array(0);
        this.sharkKey = new Uint32Array(0);
        this.sharkDepth = new Float32Array(0);
        this.sharkKind = new Uint8Array(0);
        this.sharkShadow = new Uint8Array(0);
        this.spine = new Float32Array(SHARK_NODES * 2);
        this.arc = new Float32Array(SHARK_NODES);
        this.arcTotal = 1;
        this.shape = SHAPES.classic;
        this.sharkId = 0;
        this.finTipLeft = 0;
        this.finTipRight = 0;
        this.hitFlag = 0;
        this.hitShade = 0;
        this.hitS = 0;
        this.hitV = 0;
        this.hitDist = 0;
        this.fishStamp = new Uint32Array(0);
        this.frameId = 0;
        this.fishBuckets = FISH_ALPHAS.map(() => []);
        this.fishStyles = FISH_ALPHAS.map((a) => `rgba(230,238,255,${a})`);
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("2D canvas unavailable");
        this.ctx = ctx;
        this.bg = document.createElement("canvas");
        for (let c = 0; c < DOT_RGB.length; c++) {
          const [r, g, b] = DOT_RGB[c];
          for (let l = 0; l < ALPHA_LEVELS; l++) {
            const a = DOT_BASE_ALPHA[c] * (l + 1) / ALPHA_LEVELS;
            this.dotStyles.push(`rgba(${r},${g},${b},${a.toFixed(3)})`);
          }
        }
      }
      get cellWidth() {
        return this.cw;
      }
      get cellHeight() {
        return this.ch;
      }
      setFontFamily(family) {
        if (family) this.fontFamily = family;
      }
      resize(width, height, dpr) {
        const prevCols = this.cols;
        const prevRows = this.rows;
        this.width = width;
        this.height = height;
        this.dpr = dpr;
        this.cw = clamp2(Math2.round(width / 124), 8, 13);
        this.ch = Math2.round(this.cw * 1.45);
        this.cols = Math2.ceil(width / this.cw);
        this.rows = Math2.ceil(height / this.ch);
        this.canvas.width = Math2.round(width * dpr);
        this.canvas.height = Math2.round(height * dpr);
        this.bg.width = this.canvas.width;
        this.bg.height = this.canvas.height;
        const n = this.cols * this.rows;
        if (this.cols !== prevCols || this.rows !== prevRows) {
          this.dotKind = new Uint8Array(n);
          this.dotPhase = new Float32Array(n);
          this.dotFreq = new Float32Array(n);
          this.energy = new Float32Array(n);
          this.energyTmp = new Float32Array(n);
          this.heat = new Float32Array(n);
          this.bucketOf = new Uint8Array(n);
          this.bucketOrder = new Int32Array(n);
          this.sharkFlag = new Uint8Array(n);
          this.sharkShade = new Float32Array(n);
          this.sharkKey = new Uint32Array(n);
          this.sharkDepth = new Float32Array(n);
          this.sharkKind = new Uint8Array(n);
          this.sharkShadow = new Uint8Array(n);
          this.fishStamp = new Uint32Array(n);
        }
        for (let i = 0; i < n; i++) {
          const col = i % this.cols;
          const row = i / this.cols | 0;
          this.dotKind[i] = 0;
          this.dotPhase[i] = hash3(col, row, 23) * Math2.PI * 2;
          this.dotFreq[i] = 0.3 + hash3(col, row, 37) * 1.1;
        }
        this.paintBackground();
      }
      paintBackground() {
        const g = this.bg.getContext("2d");
        if (!g) return;
        const { width: W, height: H, dpr, cw, ch } = this;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.fillStyle = "#000";
        g.fillRect(0, 0, W, H);
        paintGrid(g, W, H, cw, ch, dpr);
      }
      render(world, dt) {
        const { ctx, dpr, cols, ch } = this;
        if (cols === 0) return;
        const t = world.time;
        this.consumeEvents(world);
        this.rasterizeSharks(world.sharks, t);
        this.depositWake(world);
        this.diffuse(dt);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(this.bg, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.markFish(world);
        this.drawDots(t);
        ctx.font = `600 ${Math2.round(ch * 0.74)}px ${this.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        this.drawHeat();
        this.drawFish();
        this.drawSharks(t);
      }
      // ── simulation → field ──────────────────────────────────────────────
      cellIndex(x, y) {
        const c = Math2.floor(x / this.cw);
        const r = Math2.floor(y / this.ch);
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
        return r * this.cols + c;
      }
      stamp(field, x, y, radius, amount) {
        const c0 = Math2.floor(x / this.cw);
        const r0 = Math2.floor(y / this.ch);
        for (let r = r0 - radius; r <= r0 + radius; r++) {
          for (let c = c0 - radius; c <= c0 + radius; c++) {
            if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
            const d = Math2.hypot(c - c0, (r - r0) * 1.4);
            if (d > radius + 0.5) continue;
            const i = r * this.cols + c;
            field[i] = Math2.min(1.6, field[i] + amount * (1 - d / (radius + 1)));
          }
        }
      }
      consumeEvents(world) {
        for (const e of world.events) {
          if (e.kind === "eat") {
            this.stamp(this.heat, e.x, e.y, 2, 1);
            this.stamp(this.energy, e.x, e.y, 3, 0.9);
          } else {
            this.stamp(this.energy, e.x, e.y, 6, 1.4);
          }
        }
        world.events.length = 0;
      }
      depositWake(world) {
        const { energy } = this;
        for (const f of world.fish) {
          if (!f.alive) continue;
          const i = this.cellIndex(f.x, f.y);
          if (i >= 0) energy[i] = Math2.min(1.6, energy[i] + 0.012 + f.alarm * 0.03);
        }
        for (const sh of world.sharks) {
          for (let k = SHARK_NODES - 6; k < SHARK_NODES; k++) {
            const i = this.cellIndex(sh.nodes[k * 2], sh.nodes[k * 2 + 1]);
            if (i >= 0) energy[i] = Math2.min(1.6, energy[i] + 0.05 + sh.speed * 12e-4);
          }
        }
        if (world.pointer.active) {
          this.stamp(energy, world.pointer.x, world.pointer.y, 1, 0.08);
        }
      }
      /** Blur + decay so wakes spread out like ripples and fade. */
      diffuse(dt) {
        const { cols, rows, energy, energyTmp: tmp, heat } = this;
        const decay = Math2.exp(-dt * 1.5);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const i = r * cols + c;
            const l = c > 0 ? energy[i - 1] : energy[i];
            const rt = c < cols - 1 ? energy[i + 1] : energy[i];
            const u = r > 0 ? energy[i - cols] : energy[i];
            const d = r < rows - 1 ? energy[i + cols] : energy[i];
            tmp[i] = (energy[i] * 4 + l + rt + u + d) * 0.125 * decay;
          }
        }
        this.energy = tmp;
        this.energyTmp = energy;
        const heatDecay = Math2.exp(-dt * 2.2);
        for (let i = 0; i < heat.length; i++) heat[i] *= heatDecay;
      }
      // ── sharks ──────────────────────────────────────────────────────────
      /**
       * Classify one point against the current shark (spine/arc already built).
       * Body coordinates: s along the spine (0 snout → 1 tail), v across it.
       * Writes hit* fields and returns whether the point is on the shark.
       */
      sampleShark(px, py, L) {
        const { spine, arc } = this;
        const N = SHARK_NODES;
        let best = Infinity;
        let bestS = 0;
        let bestSign = 1;
        let bestNx = 0;
        let bestNy = 0;
        for (let k = 0; k < N - 1; k++) {
          const ax = spine[k * 2];
          const ay = spine[k * 2 + 1];
          const sx = spine[(k + 1) * 2] - ax;
          const sy = spine[(k + 1) * 2 + 1] - ay;
          const len2 = sx * sx + sy * sy || 1;
          const u2 = clamp2(((px - ax) * sx + (py - ay) * sy) / len2, 0, 1);
          const qx = ax + sx * u2;
          const qy = ay + sy * u2;
          const d2 = (px - qx) ** 2 + (py - qy) ** 2;
          if (d2 < best) {
            best = d2;
            const len = Math2.sqrt(len2);
            bestS = (arc[k] + u2 * len) / this.arcTotal;
            bestSign = sx * (py - ay) - sy * (px - ax) >= 0 ? 1 : -1;
            bestNx = -sy / len * bestSign;
            bestNy = sx / len * bestSign;
          }
        }
        const a = Math2.sqrt(best);
        const s = bestS;
        const u = s * L;
        const shape = this.shape;
        const w = shape.halfWidth(s) * L;
        this.hitDist = a;
        this.hitS = s;
        this.hitV = a * bestSign;
        const head = this.shape.head;
        if (head && u < L * (head.sweep + head.depth + head.notch)) {
          const span = L * head.span;
          const r = a / span;
          const front = L * head.sweep * r * r + L * head.notch * Math2.max(0, 1 - r / 0.14);
          const depth = L * head.depth * (1 - 0.2 * r * r * r * r);
          if (r <= 1 && u >= front && u <= front + depth) {
            this.hitFlag = r > 0.84 ? FLAG_EYE : FLAG_BODY;
            this.hitShade = r > 0.84 ? 0 : 0.62 - 0.2 * r + (u < front + L * 0.012 ? 0.1 : 0);
            return true;
          }
        }
        if (a <= w) {
          const across = a / (w || 1);
          const facing = (bestNx * -0.6 + bestNy * -0.8) * across;
          let shade = 0.58 - across * across * 0.42 + facing * 0.26;
          let flag = FLAG_BODY;
          if (s > shape.dorsal[0] && s < shape.dorsal[1] && across < 0.3) {
            flag = FLAG_RIDGE;
            shade = 1;
          } else if (s > shape.secondDorsal[0] && s < shape.secondDorsal[1] && across < 0.4) {
            shade = Math2.max(shade, 0.82);
          } else if (shape.eye && s > shape.eye[0] && s < shape.eye[1] && across > 0.6) {
            flag = FLAG_EYE;
            shade = 0;
          } else if (s > shape.gills[0] && s < shape.gills[1] && across > 0.58) {
            if (Math2.floor((s - shape.gills[0]) / (shape.gills[1] - shape.gills[0]) * 5) % 2 === 0) shade *= 0.45;
          } else if (s < 0.05) {
            shade = Math2.max(shade, 0.7);
          } else if (shape === SHAPES.zebra && s > 0.08 && s < 0.55 && (across < 0.1 || Math2.abs(across - 0.6) < 0.08)) {
            shade = Math2.max(shade, 0.8);
          } else if (this.marked(s, a * bestSign, L, across)) {
            flag = FLAG_MARK;
          }
          this.hitFlag = flag;
          this.hitShade = shade;
          return true;
        }
        const tip = bestSign > 0 ? this.finTipRight : this.finTipLeft;
        const [p0, p1, p2] = shape.pectoral;
        if (inTriangle(u, a, L * p0, 0, L * p1, 0, L * p2, tip) && // Falcate (sickle) fins get a concave trailing edge.
        !(shape.falcate && inTriangle(u, a, L * p1, 0, L * (p1 + (p2 - p1) * 0.33), tip * 0.55, L * p2, tip))) {
          this.hitFlag = this.marked(s, a * bestSign, L, 0) ? FLAG_MARK : FLAG_FIN;
          this.hitShade = 0.38 + 0.22 * (1 - clamp2(a / tip, 0, 1));
          return true;
        }
        const [v0, v1, v2, vr] = shape.pelvic;
        if (inTriangle(u, a, L * v0, 0, L * v1, 0, L * v2, L * vr) || // Forked caudal fin.
        shape.caudal > 0 && inTriangle(u, a, L * 0.86, 0, L * 0.95, 0, L, L * shape.caudal)) {
          this.hitFlag = FLAG_FIN;
          this.hitShade = 0.36;
          return true;
        }
        return false;
      }
      /** Whether a body point (s along, v across) falls on a dark marking. */
      marked(s, v, L, across) {
        if (this.shape === SHAPES.tiger) {
          if (s < 0.2 || s > 0.9 || across > 0.85) return false;
          const wobble = 0.35 * Math2.sin(v / L * 25 + s * 5);
          const bar = Math2.sin(s * Math2.PI * 2 * 9 + wobble);
          return bar > 0.65 - 0.5 * smoothstep(0.2, 0.42, s) + 0.4 * smoothstep(0.8, 0.9, s);
        }
        if (this.shape === SHAPES.zebra) {
          if (s < 0.07) return false;
          const gu = s * L / (L * 0.06);
          const gv = v / (L * 0.045);
          const cu = Math2.floor(gu);
          const cv = Math2.floor(gv);
          const jx = hash3(cu, cv, this.sharkId) * 0.5 + 0.25;
          const jy = hash3(cu, cv, this.sharkId + 11) * 0.5 + 0.25;
          return (gu - cu - jx) ** 2 + (gv - cv - jy) ** 2 < 0.08;
        }
        return false;
      }
      /**
       * Build a smooth, undulating render spine from the sim spine, then
       * supersample every cell in the shark's bounding box against the shape.
       * Fully covered cells become solid skin; partial cells become edge glyphs.
       */
      rasterizeSharks(sharks, t) {
        const { sharkFlag, sharkShade, sharkKey, sharkDepth, sharkKind, sharkShadow, spine, arc, cw, ch, cols, rows } = this;
        sharkFlag.fill(0);
        sharkShadow.fill(0);
        for (const sh of sharks) {
          const L = sh.length;
          const N = SHARK_NODES;
          const n = sh.nodes;
          const swim = clamp2(sh.speed / 60, 0.4, 1.4);
          this.shape = SHAPES[sh.kind];
          this.sharkId = sh.id;
          const kindIndex = KINDS2.indexOf(sh.kind);
          for (let k = 0; k < N; k++) {
            const s = k / (N - 1);
            const a = Math2.max(0, k - 1);
            const b = Math2.min(N - 1, k + 1);
            let tx = n[a * 2] - n[b * 2];
            let ty = n[a * 2 + 1] - n[b * 2 + 1];
            const tl = Math2.hypot(tx, ty) || 1;
            tx /= tl;
            ty /= tl;
            const amp = L * 0.05 * (0.1 + 0.9 * Math2.pow(s, 1.8)) * swim;
            const off = amp * Math2.sin(sh.phase - s * 5.2);
            spine[k * 2] = n[k * 2] - ty * off;
            spine[k * 2 + 1] = n[k * 2 + 1] + tx * off;
          }
          arc[0] = 0;
          for (let k = 1; k < N; k++) {
            arc[k] = arc[k - 1] + Math2.hypot(spine[k * 2] - spine[(k - 1) * 2], spine[k * 2 + 1] - spine[(k - 1) * 2 + 1]);
          }
          this.arcTotal = arc[N - 1] || 1;
          const bank = clamp2(sh.turn * 0.45, -0.35, 0.35);
          const flex = 1 + 0.06 * Math2.sin(sh.phase * 0.5);
          const reachFin = this.shape.pectoral[3];
          this.finTipRight = L * reachFin * flex * (1 - bank);
          this.finTipLeft = L * reachFin * flex * (1 + bank);
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (let k = 0; k < N; k++) {
            minX = Math2.min(minX, spine[k * 2]);
            maxX = Math2.max(maxX, spine[k * 2]);
            minY = Math2.min(minY, spine[k * 2 + 1]);
            maxY = Math2.max(maxY, spine[k * 2 + 1]);
          }
          const reach = L * 0.36;
          const c0 = Math2.max(0, Math2.floor((minX - reach) / cw));
          const c1 = Math2.min(cols - 1, Math2.floor((maxX + reach) / cw));
          const r0 = Math2.max(0, Math2.floor((minY - reach) / ch));
          const r1 = Math2.min(rows - 1, Math2.floor((maxY + reach) / ch));
          if (c0 > c1 || r0 > r1) continue;
          const skipBeyond = reach + Math2.hypot(cw, ch);
          const shadowDc = Math2.round(L * 0.035 / cw) + 1;
          const shadowDr = Math2.round(L * 0.02 / ch) + 1;
          for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
              const x = c * cw;
              const y = r * ch;
              const centerHit = this.sampleShark(x + cw / 2, y + ch / 2, L);
              if (!centerHit && this.hitDist > skipBeyond) continue;
              const flag = this.hitFlag;
              const shade = this.hitShade;
              const s = this.hitS;
              const v = this.hitV;
              let hits = centerHit ? 1 : 0;
              for (let k = 0; k < SUBSAMPLES.length; k += 2) {
                if (this.sampleShark(x + SUBSAMPLES[k] * cw, y + SUBSAMPLES[k + 1] * ch, L)) hits++;
              }
              if (hits === 0) continue;
              const coverage = hits / 5;
              const i = r * cols + c;
              const key = hash3(Math2.round(s * 52), Math2.round(v / (cw * 0.9)), sh.id) * 4294967295 >>> 0;
              sharkKey[i] = key;
              sharkDepth[i] = sh.depth;
              sharkKind[i] = kindIndex;
              if (centerHit && coverage >= 0.6) {
                sharkFlag[i] = flag;
                const flicker = (hash3(c, r, Math2.floor(t * 6)) - 0.5) * 0.06;
                sharkShade[i] = clamp2(shade + flicker, 0, 1);
                const sc = c + shadowDc;
                const sr = r + shadowDr;
                if (sc < cols && sr < rows) sharkShadow[sr * cols + sc] = 1;
              } else {
                sharkFlag[i] = FLAG_EDGE;
                sharkShade[i] = coverage;
              }
            }
          }
        }
      }
      drawSharks(t) {
        const { ctx, cols, rows, cw, ch, sharkFlag, sharkShade, sharkKey, sharkDepth, sharkKind } = this;
        const n = cols * rows;
        for (let i = 0; i < n; i++) {
          const flag = sharkFlag[i];
          if (!flag) continue;
          const col = i % cols;
          const row = i / cols | 0;
          const x = col * cw;
          const y = row * ch;
          const key = sharkKey[i];
          const shade = sharkShade[i];
          const dim = 0.7 + 0.3 * sharkDepth[i];
          const [tr, tg, tb] = SHAPES[KINDS2[sharkKind[i]]].tint;
          const tick = Math2.floor(t * 2.4 + key % 997 / 97);
          const roll = hash3(key, tick, 7);
          if (flag === FLAG_EDGE) {
            const set = shade >= 0.5 ? EDGE_HEAVY : EDGE_LIGHT;
            const g = (70 + shade * 80) * dim;
            ctx.fillStyle = roll < 0.07 ? ACCENTS[key % ACCENTS.length] : `rgb(${Math2.round(g * tr)},${Math2.round(g * tg)},${Math2.min(255, Math2.round(g * tb + 6))})`;
            ctx.fillText(set[(key >>> 8) % set.length], x + cw / 2, y + ch / 2 + 1);
            continue;
          }
          let level;
          let glyph;
          if (flag === FLAG_RIDGE) {
            level = 226;
            glyph = RIDGE_GLYPHS[(key >>> 8) % RIDGE_GLYPHS.length];
          } else if (flag === FLAG_EYE) {
            level = 12;
            glyph = "o";
          } else if (flag === FLAG_MARK) {
            level = 24 + shade * 22;
            glyph = MARK_GLYPHS[(key >>> 8) % MARK_GLYPHS.length];
          } else if (flag === FLAG_FIN) {
            level = 40 + shade * 120;
            glyph = FIN_GLYPHS[(key >>> 8) % FIN_GLYPHS.length];
          } else {
            level = 46 + shade * 160;
            const jitter = (key >>> 4) % 3 - 1;
            glyph = SKIN_RAMP[clamp2(Math2.floor((1 - shade) * 8.99) + jitter, 0, SKIN_RAMP.length - 1)];
          }
          level *= dim;
          ctx.fillStyle = `rgb(${Math2.min(255, Math2.round(level * tr))},${Math2.min(255, Math2.round(level * tg))},${Math2.min(255, Math2.round(level * tb + 4))})`;
          ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
          let color;
          if (flag === FLAG_EYE) color = "#9aa0ad";
          else if (flag === FLAG_MARK) color = `rgb(${Math2.round(70 * tr)},${Math2.round(70 * tg)},${Math2.round(70 * tb)})`;
          else if (roll < 0.09) color = ACCENTS[key % ACCENTS.length];
          else if (roll < 0.13) color = "#ffffff";
          else color = shade > 0.55 ? "#0e0f13" : "#1b1d24";
          ctx.fillStyle = color;
          ctx.fillText(glyph, x + cw / 2, y + ch / 2 + 1);
        }
      }
      // ── fish, dots, heat ────────────────────────────────────────────────
      /**
       * Snap each fish to a cell and bucket it by brightness: far fish are dim,
       * near fish brighter, and turning or panicking fish glint. Nearer fish
       * claim a cell first when two land in the same one.
       */
      markFish(world) {
        const { fishStamp, fishBuckets, sharkFlag } = this;
        const frame = ++this.frameId;
        for (const bucket of fishBuckets) bucket.length = 0;
        for (let pass = 0; pass < 2; pass++) {
          for (const f of world.fish) {
            if (!f.alive || (f.depth > 0.78 ? 0 : 1) !== pass) continue;
            const i = this.cellIndex(f.x, f.y);
            if (i < 0 || fishStamp[i] === frame || sharkFlag[i]) continue;
            fishStamp[i] = frame;
            const glint = clamp2(Math2.abs(f.turn) / 3.5, 0, 1);
            const v = 0.3 + 0.4 * (f.depth - 0.55) / 0.45 + 0.3 * Math2.max(glint, f.alarm);
            fishBuckets[clamp2(Math2.floor(v * FISH_ALPHAS.length), 0, FISH_ALPHAS.length - 1)].push(i);
          }
        }
      }
      drawFish() {
        const { ctx, cw, ch, cols, fishBuckets } = this;
        for (let b = 0; b < fishBuckets.length; b++) {
          const bucket = fishBuckets[b];
          if (!bucket.length) continue;
          ctx.fillStyle = this.fishStyles[b];
          for (const i of bucket) {
            ctx.fillText("-", i % cols * cw + cw / 2, (i / cols | 0) * ch + ch / 2 + 1);
          }
        }
      }
      drawHeat() {
        const { ctx, heat, cols, cw, ch } = this;
        for (let i = 0; i < heat.length; i++) {
          const h = heat[i];
          if (h < 0.08) continue;
          const col = i % cols;
          const row = i / cols | 0;
          ctx.fillStyle = h > 0.5 ? `rgba(255,120,60,${h.toFixed(2)})` : `rgba(220,40,40,${(h * 1.6).toFixed(2)})`;
          ctx.fillText(h > 0.6 ? "*" : "\xB7", col * cw + cw / 2, row * ch + ch / 2 + 1);
        }
      }
      /**
       * Every cell's dot twinkles on its own clock, is modulated by slow
       * caustic light bands, and flares cyan where the wake field is strong.
       * Dots are bucketed by colour/alpha so each bucket is one fillStyle.
       */
      drawDots(t) {
        const { ctx, cols, rows, cw, ch, dotKind, dotPhase, dotFreq, energy, sharkFlag, sharkShadow, fishStamp, frameId } = this;
        const { bucketOf, bucketOrder, bucketCounts } = this;
        const n = cols * rows;
        const SKIP = bucketCounts.length - 1;
        bucketCounts.fill(0);
        for (let i = 0; i < n; i++) {
          const e = energy[i];
          const kind = dotKind[i];
          if (sharkFlag[i] || fishStamp[i] === frameId || kind === 0 && e < 0.45) {
            bucketOf[i] = SKIP;
            continue;
          }
          let bucket;
          if (e > 0.45) {
            const level = clamp2(Math2.floor((e - 0.45) * 5), 0, ALPHA_LEVELS - 1);
            bucket = WAKE * ALPHA_LEVELS + level;
          } else {
            const col = i % cols;
            const row = i / cols | 0;
            const twinkle = 0.5 + 0.5 * Math2.sin(t * dotFreq[i] + dotPhase[i]);
            const caustic = 0.85 + 0.15 * Math2.sin(col * 0.11 + t * 0.35) * Math2.sin(row * 0.17 - t * 0.27);
            let v = clamp2((0.55 + 0.45 * twinkle) * caustic + e * 2, 0, 1);
            if (sharkShadow[i]) v *= 0.2;
            bucket = (kind - 1) * ALPHA_LEVELS + clamp2(Math2.floor(v * ALPHA_LEVELS), 0, ALPHA_LEVELS - 1);
          }
          bucketOf[i] = bucket;
          bucketCounts[bucket]++;
        }
        const starts = new Int32Array(bucketCounts.length);
        for (let b = 1; b < bucketCounts.length; b++) starts[b] = starts[b - 1] + bucketCounts[b - 1];
        const cursor = starts.slice();
        for (let i = 0; i < n; i++) {
          const b = bucketOf[i];
          if (b !== SKIP) bucketOrder[cursor[b]++] = i;
        }
        const small = Math2.max(2, Math2.round(cw * 0.19));
        const large = small + 1;
        for (let b = 0; b < SKIP; b++) {
          const count = bucketCounts[b];
          if (!count) continue;
          ctx.fillStyle = this.dotStyles[b];
          const size = b >= WAKE * ALPHA_LEVELS ? large : small;
          const start = starts[b];
          for (let k = start; k < start + count; k++) {
            const i = bucketOrder[k];
            const col = i % cols;
            const row = i / cols | 0;
            ctx.fillRect(Math2.round(col * cw + cw * 0.66 - size / 2), Math2.round(row * ch + ch * 0.64 - size / 2), size, size);
          }
        }
      }
    };
    return __toCommonJS(ascii_sharks_upstream_exports);
  })();
  return AsciiSharksCore;
}
