// Deterministic procedural terrain shared by renderer, physics, props and minimap.
import { WORLD, ZONES } from "./data";

// ---------- Seeded random ----------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 2D simplex noise ----------
const perm = new Uint8Array(512);
(() => {
  const r = mulberry32(1337);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
})();
const G = [
  [1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export function noise2(xin: number, yin: number) {
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;
  let n = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    const g = G[perm[ii + perm[jj]] & 7];
    t0 *= t0;
    n += t0 * t0 * (g[0] * x0 + g[1] * y0);
  }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    const g = G[perm[ii + i1 + perm[jj + j1]] & 7];
    t1 *= t1;
    n += t1 * t1 * (g[0] * x1 + g[1] * y1);
  }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    const g = G[perm[ii + 1 + perm[jj + 1]] & 7];
    t2 *= t2;
    n += t2 * t2 * (g[0] * x2 + g[1] * y2);
  }
  return 70 * n; // ~[-1,1]
}

export function fbm(x: number, y: number, oct = 5) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f, y * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}

export function ridged(x: number, y: number, oct = 4) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(noise2(x * f, y * f));
    s += a * n * n;
    f *= 2.1;
    a *= 0.5;
  }
  return s;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------- World features ----------
export const roadZ = (x: number) => 26 * Math.sin(x * 0.005) + 8 * Math.sin(x * 0.017);

export const LAKES = [
  { x: -980, z: -190, r: 95, lava: false },
  { x: -620, z: 250, r: 55, lava: false },
  { x: -170, z: 230, r: 75, lava: false },
  { x: 190, z: -250, r: 50, lava: false },
  { x: 1000, z: 230, r: 80, lava: true },
  { x: 640, z: -260, r: 45, lava: true },
];

export const VOLCANO = { x: 1030, z: -210, r: 150, h: 95 };

export const BOSS_SPOTS: Record<number, [number, number]> = {
  0: [-1060, 250],
  1: [260, 220],
  2: [930, -120],
};

/** Zone weights [forest, valley, ashlands] smoothly blended at the borders. */
export function zoneWeights(x: number): [number, number, number] {
  const a = smooth(-460, -340, x);
  const b = smooth(340, 460, x);
  return [1 - a, a * (1 - b), b];
}

export function heightAt(x: number, z: number): number {
  const [w0, w1, w2] = zoneWeights(x);
  const nx = x * 0.0045, nz = z * 0.0045;

  // Zone landscapes
  const forest = 6 + fbm(nx, nz) * 22 + fbm(nx * 4, nz * 4, 3) * 3;
  const valley = 5 + fbm(nx * 0.7, nz * 0.7) * 14 + Math.max(0, fbm(nx * 0.5 + 9, nz * 0.5)) * 25;
  const ash = Math.max(1.2, 4 + ridged(nx * 1.2, nz * 1.2) * 34 - 8 + fbm(nx * 5, nz * 5, 3) * 3);
  let h = forest * w0 + valley * w1 + ash * w2;

  // Volcano
  const vd = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  if (vd < VOLCANO.r) {
    const t = 1 - vd / VOLCANO.r;
    let cone = Math.pow(t, 1.6) * VOLCANO.h;
    if (vd < 28) cone -= (1 - vd / 28) * 40; // crater
    h += cone;
  }

  // Mountain ridges between zones (with a pass along the road)
  for (const bx of [-400, 400]) {
    const dx = (x - bx) / 45;
    const ridge = Math.exp(-dx * dx);
    if (ridge > 0.01) {
      const pass = smooth(22, 55, Math.abs(z - roadZ(x)));
      h += ridge * pass * (70 + ridged(x * 0.02, z * 0.02) * 40);
    }
  }

  // World border mountains
  const edge = Math.min(x - WORLD.minX, WORLD.maxX - x, z - WORLD.minZ, WORLD.maxZ - z);
  if (edge < 90) h += Math.pow(1 - edge / 90, 2) * (130 + ridged(x * 0.015, z * 0.015) * 40);

  // Lakes
  for (const l of LAKES) {
    const d = Math.hypot(x - l.x, z - l.z) / l.r;
    if (d < 1.4) h = h * smooth(0.55, 1.4, d) + (-6) * (1 - smooth(0.55, 1.4, d));
  }

  // Road: smooth & slightly flatten
  const rd = Math.abs(z - roadZ(x));
  if (rd < 14) {
    const t = 1 - smooth(4, 14, rd);
    const target = 4 + fbm(x * 0.003, 3.3, 2) * 6;
    h = h * (1 - t * 0.7) + Math.max(target, h * 0.6) * t * 0.7;
  }

  // Towns: flatten around zone spawn points
  for (const zn of ZONES) {
    const d = Math.hypot(x - zn.spawn[0], z - zn.spawn[1]);
    if (d < 75) {
      const t = 1 - smooth(35, 75, d);
      h = h * (1 - t) + 5 * t;
    }
  }
  return h;
}

export function roadFactor(x: number, z: number) {
  const rd = Math.abs(z - roadZ(x));
  return 1 - smooth(3, 8, rd);
}

export function isBlockedForProps(x: number, z: number, margin = 0) {
  if (Math.abs(z - roadZ(x)) < 10 + margin) return true;
  for (const l of LAKES) if (Math.hypot(x - l.x, z - l.z) < l.r * 1.05 + margin) return true;
  for (const zn of ZONES) if (Math.hypot(x - zn.spawn[0], z - zn.spawn[1]) < 55 + margin) return true;
  if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < 35) return true;
  return false;
}

export function lakeAt(x: number, z: number) {
  return LAKES.find((l) => Math.hypot(x - l.x, z - l.z) < l.r * 0.9);
}
