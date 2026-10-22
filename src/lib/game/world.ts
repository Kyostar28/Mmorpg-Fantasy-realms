// Builds the open world: terrain, vegetation (chunked instancing), water, lava, sky, towns.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { WORLD, ZONES } from "./data";
import { BOSS_SPOTS, LAKES, fbm, heightAt, isBlockedForProps, mulberry32, noise2, roadFactor, roadZ, zoneWeights } from "./terrain";

// ---------- Procedural textures ----------
function makeDetailTextures(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const hgt = new Float32Array(size * size);
  // tileable noise via torus mapping
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = (x / size) * Math.PI * 2;
      const b = (y / size) * Math.PI * 2;
      const nx = Math.cos(a) * 2, ny = Math.sin(a) * 2, nz = Math.cos(b) * 2, nw = Math.sin(b) * 2;
      let v = 0, amp = 0.5, f = 1;
      for (let o = 0; o < 5; o++) {
        v += amp * noise2(nx * f + nz * f * 0.7 + 11 * o, ny * f + nw * f * 0.7 - 5 * o);
        f *= 2;
        amp *= 0.5;
      }
      // pebbles
      const peb = Math.max(0, noise2(nx * 9 + nz * 9, ny * 9 + nw * 9)) ;
      v = v * 0.7 + peb * 0.6;
      hgt[y * size + x] = v;
    }
  }
  for (let i = 0; i < size * size; i++) {
    const g = Math.max(0, Math.min(255, 205 + hgt[i] * 70 + (Math.random() - 0.5) * 18));
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const color = new THREE.CanvasTexture(c);
  color.wrapS = color.wrapT = THREE.RepeatWrapping;
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 8;

  const nc = document.createElement("canvas");
  nc.width = nc.height = size;
  const nctx = nc.getContext("2d")!;
  const nimg = nctx.createImageData(size, size);
  const at = (x: number, y: number) => hgt[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      nimg.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = (1 / l) * 0.5 * 255 + 127;
      nimg.data[i + 3] = 255;
    }
  }
  nctx.putImageData(nimg, 0, 0);
  const normal = new THREE.CanvasTexture(nc);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.anisotropy = 8;
  return { color, normal };
}

const C = (h: string) => new THREE.Color(h);

function groundColor(x: number, z: number, h: number, slope: number, out: THREE.Color) {
  const w = zoneWeights(x);
  const tmp = new THREE.Color();
  out.setRGB(0, 0, 0);
  const n = fbm(x * 0.02, z * 0.02, 3);
  for (let i = 0; i < 3; i++) {
    if (w[i] < 0.001) continue;
    const [lo, mid, hi] = ZONES[i].ground;
    const t = Math.min(1, Math.max(0, (h - 2) / 40 + n * 0.25));
    tmp.copy(C(lo)).lerp(C(mid), Math.min(1, t * 2)).lerp(C(hi), Math.max(0, t * 2 - 1));
    // rock on steep slopes
    const rock = i === 0 ? C("#55606a") : i === 1 ? C("#7a7468") : C("#2a2220");
    tmp.lerp(rock, Math.min(1, Math.max(0, (slope - 0.45) * 2.2)));
    // snow on high mountains in valley/forest
    if (i < 2 && h > 75) tmp.lerp(C("#e8eef5"), Math.min(1, (h - 75) / 20));
    if (i === 2 && h > 60) tmp.lerp(C("#1a1414"), Math.min(1, (h - 60) / 25));
    out.r += tmp.r * w[i];
    out.g += tmp.g * w[i];
    out.b += tmp.b * w[i];
  }
  // shoreline sand/mud
  if (h < 1.5) out.lerp(w[2] > 0.5 ? C("#3a1a10") : C("#6b5e44"), Math.min(1, (1.5 - h) / 3));
  // road cobblestone
  const r = roadFactor(x, z);
  if (r > 0) out.lerp(w[0] > 0.5 ? C("#4a5560") : w[1] > 0.5 ? C("#8a7a5e") : C("#4a3a32"), r * 0.9);
  // town plazas
  for (const zn of ZONES) {
    const d = Math.hypot(x - zn.spawn[0], z - zn.spawn[1]);
    if (d < 30) out.lerp(w[0] > 0.5 ? C("#56626b") : w[1] > 0.5 ? C("#9a8c72") : C("#55453a"), Math.min(1, (30 - d) / 6) * 0.85);
  }
}

export function buildTerrain() {
  const segX = 800, segZ = 270;
  const geo = new THREE.PlaneGeometry(WORLD.width, WORLD.depth, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    groundColor(x, z, pos.getY(i), 1 - nrm.getY(i), col);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const tex = makeDetailTextures();
  tex.color.repeat.set(WORLD.width / 9, WORLD.depth / 9);
  tex.normal.repeat.set(WORLD.width / 9, WORLD.depth / 9);
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: tex.color,
    normalMap: tex.normal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughness: 0.92,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.receiveShadow = true;
  return { mesh, normalTex: tex.normal };
}

// ---------- Prop geometry (merged with vertex colors so each prop is 1 instanced draw) ----------
function part(g: THREE.BufferGeometry, color: string, m: THREE.Matrix4, jitter = 0.06) {
  let geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute("uv");
  geo.applyMatrix4(m);
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  const base = new THREE.Color(color);
  for (let i = 0; i < n; i++) {
    const k = 1 + (Math.random() - 0.5) * jitter * 2;
    c[i * 3] = base.r * k;
    c[i * 3 + 1] = base.g * k;
    c[i * 3 + 2] = base.b * k;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return geo;
}
const M = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function blob(r: number, detail = 2) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const k = 1 + noise2(v.x * 1.7 + 3, v.y * 1.7 + v.z) * 0.22;
    p.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

function elunariaTree() {
  const parts: THREE.BufferGeometry[] = [];
  const bark = "#a9b8c0";
  // twisted trunk built from segments
  let x = 0, z = 0, y = 0;
  for (let i = 0; i < 6; i++) {
    const r0 = 0.9 - i * 0.12, r1 = 0.78 - i * 0.12;
    const nx = x + Math.sin(i * 1.3) * 0.35, nz = z + Math.cos(i * 1.7) * 0.35;
    const seg = new THREE.CylinderGeometry(r1, r0, 2.6, 12, 2);
    const dir = new THREE.Vector3(nx - x, 2.6, nz - z).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    parts.push(part(seg, bark, new THREE.Matrix4().compose(new THREE.Vector3((x + nx) / 2, y + 1.3, (z + nz) / 2), q, new THREE.Vector3(1, 1, 1))));
    x = nx; z = nz; y += 2.5;
  }
  // roots
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(part(new THREE.ConeGeometry(0.35, 2.4, 8), bark, M(Math.cos(a) * 0.9, 0.3, Math.sin(a) * 0.9, 0, -a, Math.PI / 2 - 0.35)));
  }
  // branches + canopy
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    const by = 9 + (i % 3) * 2;
    parts.push(part(new THREE.CylinderGeometry(0.12, 0.3, 5, 8), bark, M(x + Math.cos(a) * 2, by, z + Math.sin(a) * 2, 0, -a, 1.0)));
    parts.push(part(blob(2.6 + (i % 2), 2), i % 2 ? "#2a6b6a" : "#1f5a5e", M(x + Math.cos(a) * 4.2, by + 2.4, z + Math.sin(a) * 4.2)));
  }
  parts.push(part(blob(3.4, 2), "#2b7370", M(x, y + 1.5, z)));
  return mergeGeometries(parts)!;
}

function oakTree() {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(part(new THREE.CylinderGeometry(0.45, 0.75, 6, 12, 3), "#5a4030", M(0, 3, 0)));
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    parts.push(part(new THREE.CylinderGeometry(0.15, 0.3, 3.5, 8), "#5a4030", M(Math.cos(a) * 0.9, 5.5, Math.sin(a) * 0.9, 0, -a, 0.8)));
  }
  const greens = ["#3f6b23", "#4d7a2a", "#365e1f", "#5a8a30"];
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    parts.push(part(blob(2.4 + (i % 3) * 0.4, 2), greens[i % 4], M(Math.cos(a) * 2, 7 + (i % 3) * 1.1, Math.sin(a) * 2)));
  }
  parts.push(part(blob(2.9, 2), "#4a7a28", M(0, 9.2, 0)));
  return mergeGeometries(parts)!;
}

function pineTree() {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(part(new THREE.CylinderGeometry(0.25, 0.45, 5, 10), "#4a3426", M(0, 2.5, 0)));
  for (let i = 0; i < 5; i++) {
    const r = 3.2 - i * 0.55;
    const cone = new THREE.ConeGeometry(r, 3.4, 14, 2);
    const p = cone.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) if (p.getY(k) < 0) p.setY(k, p.getY(k) + Math.sin(k * 2.3) * 0.25);
    parts.push(part(cone, i % 2 ? "#24452a" : "#2c5232", M(0, 4 + i * 1.9, 0, 0, i)));
  }
  return mergeGeometries(parts)!;
}

function deadTree() {
  const parts: THREE.BufferGeometry[] = [];
  const bark = "#1e1816";
  parts.push(part(new THREE.CylinderGeometry(0.3, 0.7, 7, 10, 3), bark, M(0, 3.5, 0, 0.05, 0, 0.08)));
  for (let i = 0; i < 5; i++) {
    const a = i * 1.3;
    const l = 3 - (i % 3) * 0.6;
    parts.push(part(new THREE.CylinderGeometry(0.05, 0.22, l, 6), bark, M(Math.cos(a) * 0.8, 4.5 + i * 0.6, Math.sin(a) * 0.8, 0, -a, 0.9 + (i % 2) * 0.3)));
  }
  parts.push(part(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 10), "#ff5a1a", M(0, 0.6, 0.45, Math.PI / 2, 0, 0, 0.5, 1, 1.4), 0.02));
  return mergeGeometries(parts)!;
}

function rock(color: string) {
  return mergeGeometries([part(blob(1.2, 3), color, M(0, 0.3, 0, 0, 0, 0, 1.4, 0.9, 1.1), 0.12), part(blob(0.7, 2), color, M(1.1, 0.1, 0.3), 0.12)])!;
}

function obsidianSpike() {
  return mergeGeometries([
    part(new THREE.ConeGeometry(0.9, 6, 5), "#16121a", M(0, 2.6, 0, 0.1, 0, 0.05)),
    part(new THREE.ConeGeometry(0.6, 4, 5), "#1d1822", M(0.9, 1.6, 0.3, 0, 0.5, -0.25)),
    part(new THREE.ConeGeometry(0.5, 3, 5), "#16121a", M(-0.7, 1.2, -0.3, 0, 1, 0.3)),
  ])!;
}

function mushroom() {
  return mergeGeometries([
    part(new THREE.CylinderGeometry(0.1, 0.14, 0.8, 8), "#d8e8ff", M(0, 0.4, 0)),
    part(new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), "#6dfcff", M(0, 0.75, 0, 0, 0, 0, 1, 0.6, 1)),
  ])!;
}

function bush(color: string) {
  return mergeGeometries([part(blob(0.9, 2), color, M(0, 0.5, 0)), part(blob(0.7, 2), color, M(0.8, 0.4, 0.3)), part(blob(0.6, 2), color, M(-0.6, 0.35, -0.4))])!;
}

interface PropType {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  shadow: boolean;
  colliderR: number;
}

export interface Collider { x: number; z: number; r: number }

export function buildVegetation(scene: THREE.Scene) {
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const glowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: new THREE.Color("#2fb8c8"), emissiveIntensity: 1.4 });
  const types: Record<string, PropType> = {
    elunaria: { geo: elunariaTree(), mat: vc, shadow: true, colliderR: 1.3 },
    oak: { geo: oakTree(), mat: vc, shadow: true, colliderR: 0.9 },
    pine: { geo: pineTree(), mat: vc, shadow: true, colliderR: 0.6 },
    dead: { geo: deadTree(), mat: vc, shadow: true, colliderR: 0.8 },
    rockF: { geo: rock("#5a666e"), mat: vc, shadow: true, colliderR: 1.4 },
    rockV: { geo: rock("#8a8478"), mat: vc, shadow: true, colliderR: 1.4 },
    rockA: { geo: rock("#2e2624"), mat: vc, shadow: true, colliderR: 1.4 },
    spike: { geo: obsidianSpike(), mat: vc, shadow: true, colliderR: 1.0 },
    shroom: { geo: mushroom(), mat: glowMat, shadow: false, colliderR: 0 },
    bushF: { geo: bush("#1f4a4a"), mat: vc, shadow: false, colliderR: 0 },
    bushV: { geo: bush("#3f6a22"), mat: vc, shadow: false, colliderR: 0 },
  };
  const rand = mulberry32(42);
  const CH = 100;
  const chunks = new Map<string, Record<string, THREE.Matrix4[]>>();
  const colliders: Collider[] = [];
  const add = (type: string, x: number, z: number, s: number) => {
    const h = heightAt(x, z);
    const key = `${Math.floor((x - WORLD.minX) / CH)},${Math.floor((z - WORLD.minZ) / CH)}`;
    let c = chunks.get(key);
    if (!c) chunks.set(key, (c = {}));
    (c[type] ??= []).push(M(x, h - 0.2, z, (rand() - 0.5) * 0.08, rand() * Math.PI * 2, 0, s, s * (0.85 + rand() * 0.3), s));
    if (types[type].colliderR > 0) colliders.push({ x, z, r: types[type].colliderR * s });
  };
  const scatter = (zone: number, type: string, count: number, smin: number, smax: number, clusterFreq = 0) => {
    const z0 = ZONES[zone];
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 8) {
      tries++;
      const x = z0.x0 + 30 + rand() * (z0.x1 - z0.x0 - 60);
      const z = WORLD.minZ + 40 + rand() * (WORLD.depth - 80);
      if (isBlockedForProps(x, z, 2)) continue;
      const h = heightAt(x, z);
      if (h < 0.8 || h > 70) continue;
      if (clusterFreq && noise2(x * clusterFreq, z * clusterFreq) < -0.1) continue;
      add(type, x, z, smin + rand() * (smax - smin));
      placed++;
    }
  };
  scatter(0, "elunaria", 1300, 0.8, 1.5, 0.01);
  scatter(0, "rockF", 350, 0.6, 2.2);
  scatter(0, "shroom", 1100, 0.6, 2.2, 0.03);
  scatter(0, "bushF", 900, 0.7, 1.4);
  scatter(1, "oak", 650, 0.8, 1.3, 0.008);
  scatter(1, "pine", 750, 0.8, 1.6, 0.012);
  scatter(1, "rockV", 300, 0.6, 2.5);
  scatter(1, "bushV", 900, 0.7, 1.4);
  scatter(2, "dead", 550, 0.8, 1.4);
  scatter(2, "rockA", 650, 0.7, 3.0);
  scatter(2, "spike", 350, 0.7, 2.0);

  const chunkGroups: { group: THREE.Group; cx: number; cz: number }[] = [];
  for (const [key, recs] of chunks) {
    const [ix, iz] = key.split(",").map(Number);
    const g = new THREE.Group();
    for (const [type, mats] of Object.entries(recs)) {
      const t = types[type];
      const im = new THREE.InstancedMesh(t.geo, t.mat, mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = t.shadow;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      g.add(im);
    }
    scene.add(g);
    chunkGroups.push({ group: g, cx: WORLD.minX + (ix + 0.5) * CH, cz: WORLD.minZ + (iz + 0.5) * CH });
  }
  const update = (px: number, pz: number, far: number) => {
    for (const c of chunkGroups) c.group.visible = Math.hypot(c.cx - px, c.cz - pz) < far + CH * 0.72;
  };
  return { update, colliders };
}

// ---------- Dynamic grass around the player ----------
export function buildGrass(scene: THREE.Scene) {
  const COUNT = 26000, R = 70;
  const blade = new THREE.PlaneGeometry(0.12, 0.9, 1, 3);
  blade.translate(0, 0.45, 0);
  const p = blade.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 0.9;
    p.setX(i, p.getX(i) * (1 - y));
    p.setZ(i, y * y * 0.15);
  }
  const g2 = blade.clone().rotateY(Math.PI / 3);
  const g3 = blade.clone().rotateY(-Math.PI / 3);
  const geo = mergeGeometries([blade, g2, g3])!;
  const colors = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const y = geo.attributes.position.getY(i) / 0.9;
    const k = 0.35 + y * 0.75;
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = k;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const uniforms = { uTime: { value: 0 } };
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uniforms.uTime;
    sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
       vec4 wp = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
       float sway = sin(uTime*1.8 + wp.x*0.15 + wp.z*0.12) * 0.25 + sin(uTime*3.1 + wp.x*0.5)*0.06;
       transformed.x += sway * position.y * position.y;
       transformed.z += sway * 0.5 * position.y * position.y;`
    );
  };
  const im = new THREE.InstancedMesh(geo, m, COUNT);
  im.receiveShadow = true;
  im.frustumCulled = false;
  scene.add(im);
  const rand = mulberry32(7);
  const offsets = Array.from({ length: COUNT }, () => {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * R;
    return [Math.cos(a) * r, Math.sin(a) * r, rand(), rand()] as const;
  });
  let lastX = 1e9, lastZ = 1e9;
  const mtx = new THREE.Matrix4();
  const col = new THREE.Color();
  const zoneGrass = [C("#2f7a78"), C("#6a9a32"), C("#4a3a2a")];
  const update = (px: number, pz: number, t: number) => {
    uniforms.uTime.value = t;
    if (Math.hypot(px - lastX, pz - lastZ) < 6) return;
    lastX = px; lastZ = pz;
    const sx = Math.round(px / 4) * 4, sz = Math.round(pz / 4) * 4;
    for (let i = 0; i < COUNT; i++) {
      const [ox, oz, r1, r2] = offsets[i];
      const x = sx + ox, z = sz + oz;
      const h = heightAt(x, z);
      const w = zoneWeights(x);
      let s = 0.7 + r1 * 0.9;
      const dens = noise2(x * 0.05, z * 0.05);
      if (h < 0.3 || roadFactor(x, z) > 0.3 || dens < -0.35 || (w[2] > 0.5 && r2 > 0.12) || h > 70) s = 0;
      mtx.compose(new THREE.Vector3(x, h - 0.05, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r2 * 6.28), new THREE.Vector3(s, s * (0.8 + r2 * 0.6), s));
      im.setMatrixAt(i, mtx);
      col.setRGB(0, 0, 0);
      for (let k = 0; k < 3; k++) col.add(zoneGrass[k].clone().multiplyScalar(w[k]));
      col.multiplyScalar(0.85 + r1 * 0.3);
      im.setColorAt(i, col);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  };
  return { update };
}

// ---------- Water / lava ----------
export function buildWater(scene: THREE.Scene, normalTex: THREE.Texture) {
  const wn = normalTex.clone();
  wn.wrapS = wn.wrapT = THREE.RepeatWrapping;
  wn.repeat.set(200, 70);
  wn.needsUpdate = true;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(1640, WORLD.depth, 1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: "#1d4a5a", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82, normalMap: wn, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.1 })
  );
  water.position.set(WORLD.minX + 820, 0, 0);
  scene.add(water);
  const lavaTex = normalTex.clone();
  lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping;
  lavaTex.repeat.set(6, 6);
  lavaTex.needsUpdate = true;
  const lavaMat = new THREE.MeshStandardMaterial({ color: "#ff4a00", emissive: new THREE.Color("#ff3a00"), emissiveIntensity: 2.2, emissiveMap: lavaTex, roughness: 0.6 });
  for (const l of LAKES.filter((k) => k.lava)) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(l.r * 1.25, 48).rotateX(-Math.PI / 2), lavaMat);
    m.position.set(l.x, 0.3, l.z);
    scene.add(m);
  }
  // volcano crater lava
  const crater = new THREE.Mesh(new THREE.CircleGeometry(26, 32).rotateX(-Math.PI / 2), lavaMat);
  crater.position.set(1030, heightAt(1030, -210) + 4, -210);
  scene.add(crater);
  const update = (t: number) => {
    wn.offset.set(t * 0.01, t * 0.006);
    lavaTex.offset.set(t * 0.02, Math.sin(t * 0.3) * 0.05);
    lavaMat.emissiveIntensity = 2 + Math.sin(t * 1.5) * 0.4;
  };
  return { update, waterMat: water.material as THREE.MeshPhysicalMaterial };
}

// ---------- Sky dome ----------
export function buildSky(scene: THREE.Scene) {
  const uniforms = {
    top: { value: new THREE.Color("#123844") },
    horizon: { value: new THREE.Color("#0d2a33") },
    sunDir: { value: new THREE.Vector3(0.3, 0.5, 0.2).normalize() },
    sunColor: { value: new THREE.Color("#ffffff") },
    starAmt: { value: 1 },
  };
  const m = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float starAmt; varying vec3 vDir;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(horizon, top, pow(h, 0.6));
        float s = max(dot(vDir, sunDir), 0.0);
        col += sunColor * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.35);
        vec3 q = floor(vDir * 420.0);
        float st = step(0.9975, hash(q)) * h * starAmt;
        col += vec3(st);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), m);
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);
  return { sky, uniforms };
}

// ---------- Towns, boss arenas, lamps ----------
export function buildTowns(scene: THREE.Scene) {
  const lights: THREE.PointLight[] = [];
  const fires: THREE.Vector3[] = [];
  const colliders: Collider[] = [];
  const stone = new THREE.MeshStandardMaterial({ color: "#8d8577", roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: "#5a3e2a", roughness: 0.85 });
  const roofs = [new THREE.MeshStandardMaterial({ color: "#2d5a6b", roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: "#8a2a1f", roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: "#2a1a1a", roughness: 0.7 })];
  const plaster = [new THREE.MeshStandardMaterial({ color: "#c9d6dc", roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: "#e0d2b0", roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: "#5a4a40", roughness: 0.9 })];
  const lampGlow = [new THREE.MeshStandardMaterial({ color: "#bff", emissive: new THREE.Color("#7ff0ff"), emissiveIntensity: 4 }), new THREE.MeshStandardMaterial({ color: "#ffd", emissive: new THREE.Color("#ffb347"), emissiveIntensity: 4 }), new THREE.MeshStandardMaterial({ color: "#fdb", emissive: new THREE.Color("#ff5a1a"), emissiveIntensity: 4 })];

  const add = (o: THREE.Object3D) => {
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    scene.add(o);
  };

  ZONES.forEach((zn, zi) => {
    const [sx, sz] = zn.spawn;
    // houses in a ring
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = sx + Math.cos(a) * 42, z = sz + Math.sin(a) * 42;
      if (Math.abs(z - roadZ(x)) < 10) continue;
      const h = heightAt(x, z);
      const house = new THREE.Group();
      const w = 9 + (i % 2) * 3, d = 7;
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), plaster[zi]);
      walls.position.y = 2.5;
      house.add(walls);
      const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 1, d + 0.4), stone);
      base.position.y = 0.3;
      house.add(base);
      for (const bx of [-w / 2, w / 2]) for (const bz of [-d / 2, d / 2]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5.2, 0.4), wood);
        beam.position.set(bx, 2.6, bz);
        house.add(beam);
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 4.5, 4), roofs[zi]);
      roof.position.y = 7.2;
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(1, 1, d / w);
      house.add(roof);
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.8, 0.2), wood);
      door.position.set(0, 1.4, d / 2 + 0.05);
      house.add(door);
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 0.1), lampGlow[zi]);
      win.position.set(w / 3, 3, d / 2 + 0.05);
      house.add(win);
      const chim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 3, 0.9), stone);
      chim.position.set(-w / 3, 8, 0);
      house.add(chim);
      house.position.set(x, h, z);
      house.lookAt(sx, h, sz);
      add(house);
      colliders.push({ x, z, r: Math.max(w, d) * 0.62 });
    }
    // campfire / brazier at center
    const fire = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 0), stone);
      s.position.set(Math.cos(i / 8 * 6.28) * 1.4, 0.2, Math.sin(i / 8 * 6.28) * 1.4);
      fire.add(s);
    }
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 2, 6), wood);
      l.rotation.set(Math.PI / 2 - 0.4, i * 0.8, 0);
      l.position.y = 0.4;
      fire.add(l);
    }
    const fx = sx - 8, fz = sz + 10;
    fire.position.set(fx, heightAt(fx, fz), fz);
    add(fire);
    fires.push(new THREE.Vector3(fx, heightAt(fx, fz) + 0.6, fz));
    colliders.push({ x: fx, z: fz, r: 1.8 });
    const fl = new THREE.PointLight("#ff9a3c", 60, 30, 2);
    fl.position.set(fx, heightAt(fx, fz) + 2, fz);
    scene.add(fl);
    lights.push(fl);

    // lamp posts along the road
    for (let i = -6; i <= 6; i++) {
      if (i === 0) continue;
      const x = sx + i * 34;
      for (const side of [-1, 1]) {
        if ((i + side) % 2 !== 0) continue;
        const z = roadZ(x) + side * 8;
        const y = heightAt(x, z);
        const lamp = new THREE.Group();
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 4.2, 8), zi === 0 ? new THREE.MeshStandardMaterial({ color: "#b8c4c8", roughness: 0.5 }) : wood);
        pole.position.y = 2.1;
        lamp.add(pole);
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 16, Math.PI * 1.2), pole.material);
        hook.position.set(0.3, 4.2, 0);
        lamp.add(hook);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), lampGlow[zi]);
        bulb.position.set(0.8, 3.75, 0);
        lamp.add(bulb);
        lamp.position.set(x, y, z);
        lamp.rotation.y = side > 0 ? Math.PI : 0;
        add(lamp);
      }
    }
    // a few lamp lights near town only (performance)
    for (const i of [-1, 1]) {
      const x = sx + i * 34;
      const z = roadZ(x) + (i > 0 ? 8 : -8);
      const pl = new THREE.PointLight(zi === 0 ? "#7ff0ff" : zi === 1 ? "#ffcc77" : "#ff6a2a", 25, 22, 2);
      pl.position.set(x, heightAt(x, z) + 3.8, z);
      scene.add(pl);
      lights.push(pl);
    }

    // boss arena: ring of standing stones
    const [bx, bz] = BOSS_SPOTS[zi];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = bx + Math.cos(a) * 22, z = bz + Math.sin(a) * 22;
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7 + (i % 3), 1.2, 2, 4, 2), zi === 2 ? new THREE.MeshStandardMaterial({ color: "#1a1416", roughness: 0.6 }) : stone);
      s.position.set(x, heightAt(x, z) + 3, z);
      s.rotation.set((Math.random() - 0.5) * 0.15, -a, (Math.random() - 0.5) * 0.15);
      add(s);
      colliders.push({ x, z, r: 1.2 });
      if (i % 2 === 0) {
        const rune = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.2, 0.1), lampGlow[zi]);
        rune.position.set(x - Math.cos(a) * 0.62, heightAt(x, z) + 4, z - Math.sin(a) * 0.62);
        rune.rotation.y = -a + Math.PI / 2;
        scene.add(rune);
      }
    }
  });
  return { lights, fires, colliders };
}
