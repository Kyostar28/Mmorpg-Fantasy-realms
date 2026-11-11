// Procedural high-detail character & creature models with skeletal-style procedural animations.
import * as THREE from "three";
import type { ClassDef, MobDef, PlayerAppearance, RaceDef } from "./data";

export type WeaponModelKind = "sword" | "axe" | "hammer" | "daggers" | "bow" | "staff" | "skullstaff" | "orb";

export interface AnimState {
  speed: number;
  action: "attack" | "cast" | "channel" | "hit" | null;
  actionT: number;
  dead: boolean;
  deadT: number;
  airborne?: boolean;
  running?: boolean;
  weaponKind?: WeaponModelKind;
  attackSide?: "left" | "right";
}

export interface Model {
  root: THREE.Group;
  height: number;
  radius: number;
  animate: (dt: number, t: number, s: AnimState) => void;
  weaponTip?: THREE.Object3D;
  dispose: () => void;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, rough = 0.75, metal = 0, emissive?: string, ei = 1) {
  const key = `${color}|${rough}|${metal}|${emissive}|${ei}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = ei;
    }
    matCache.set(key, m);
  }
  return m;
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  me.receiveShadow = true;
  parent.add(me);
  return me;
}

function pivot(parent: THREE.Object3D, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 8, 16);
const sph = (r: number, w = 24, h = 18) => new THREE.SphereGeometry(r, w, h);

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------
function buildWeapon(kind: WeaponModelKind, hand: THREE.Object3D, offHand: THREE.Object3D, accent: string) {
  const steel = mat("#c8ccd2", 0.25, 0.95);
  const dark = mat("#3a2a1c", 0.8, 0.1);
  const gold = mat("#d8a740", 0.3, 0.9);
  let tip: THREE.Object3D = hand;
  if (kind === "sword") {
    const g = pivot(hand, 0, -0.05, 0);
    g.rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.28, 10), dark, g, 0, 0, 0);
    mesh(new THREE.BoxGeometry(0.34, 0.05, 0.08), gold, g, 0, 0.16, 0);
    const blade = new THREE.BoxGeometry(0.09, 1.15, 0.025, 1, 6, 1);
    mesh(blade, steel, g, 0, 0.75, 0);
    mesh(new THREE.ConeGeometry(0.064, 0.16, 4), steel, g, 0, 1.4, 0).rotation.y = Math.PI / 4;
    mesh(sph(0.05), gold, g, 0, -0.16, 0);
    tip = pivot(g, 0, 1.4, 0);
  } else if (kind === "axe") {
    const g = pivot(hand, 0, -0.05, 0);
    g.rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.08, 8), dark, g, 0, 0.36, 0);
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.06, 0.54);
    bladeShape.lineTo(0.1, 0.82);
    bladeShape.lineTo(0.34, 0.92);
    bladeShape.lineTo(0.42, 0.66);
    bladeShape.lineTo(0.35, 0.38);
    bladeShape.lineTo(0.12, 0.45);
    bladeShape.lineTo(-0.06, 0.54);
    const blade = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.055, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.018, bevelThickness: 0.015 });
    mesh(blade, steel, g, 0, 0, -0.03);
    mesh(new THREE.BoxGeometry(0.12, 0.07, 0.09), gold, g, 0, 0.53, 0);
    tip = pivot(g, 0.36, 0.87, 0);
  } else if (kind === "hammer") {
    const g = pivot(hand, 0, -0.05, 0);
    g.rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.1, 10), dark, g, 0, 0.35, 0);
    const head = new THREE.BoxGeometry(0.42, 0.28, 0.28, 2, 2, 2);
    mesh(head, steel, g, 0, 0.92, 0);
    mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), gold, g, 0.22, 0.92, 0).rotation.z = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), gold, g, -0.22, 0.92, 0).rotation.z = Math.PI / 2;
    // shield
    const sh = pivot(offHand, 0.08, -0.05, 0);
    sh.rotation.y = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 32), mat("#e9e2cf", 0.4, 0.6), sh, 0, 0, 0).rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.42, 0.04, 8, 32), gold, sh, 0, 0, 0.02);
    mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 16), gold, sh, 0, 0, 0.04).rotation.x = Math.PI / 2;
    tip = pivot(g, 0, 0.95, 0);
  } else if (kind === "daggers") {
    for (const h of [hand, offHand]) {
      const g = pivot(h, 0, -0.05, 0);
      g.rotation.x = Math.PI / 2;
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), dark, g, 0, 0, 0);
      mesh(new THREE.BoxGeometry(0.16, 0.03, 0.05), mat(accent, 0.4, 0.6), g, 0, 0.09, 0);
      mesh(new THREE.ConeGeometry(0.05, 0.5, 4), steel, g, 0, 0.36, 0).scale.set(1, 1, 0.3);
    }
    tip = hand;
  } else if (kind === "bow") {
    const g = pivot(offHand, 0, 0, 0.02);
    const arc = new THREE.TorusGeometry(0.75, 0.03, 8, 32, Math.PI * 0.9);
    const m = mesh(arc, mat("#6b4523", 0.6), g, 0, 0, 0);
    m.rotation.z = Math.PI / 2 + Math.PI * 0.05;
    m.rotation.y = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.48, 4), mat("#ddd"), g, 0, 0, -0.18);
    tip = g;
  } else if (kind === "orb") {
    const g = pivot(hand, 0, -0.02, 0);
    const orb = mesh(new THREE.IcosahedronGeometry(0.14, 2), mat("#8ddcff", 0.1, 0.2, accent, 2.5), g, 0, 0.18, 0);
    orb.rotation.set(0.35, 0.25, -0.2);
    const halo = mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24), gold, g, 0, 0.18, 0);
    halo.rotation.x = Math.PI / 2;
    tip = pivot(g, 0, 0.18, 0);
  } else if (kind === "staff" || kind === "skullstaff") {
    const g = pivot(hand, 0, -0.05, 0);
    mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.0, 10), mat(kind === "staff" ? "#5b3a1e" : "#2a1a2a", 0.7), g, 0, 0.25, 0);
    if (kind === "staff") {
      mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 24), gold, g, 0, 1.3, 0);
      mesh(new THREE.OctahedronGeometry(0.14, 1), mat("#9fe8ff", 0.1, 0.2, accent, 2.4), g, 0, 1.32, 0);
    } else {
      mesh(sph(0.16), mat("#e8e0cc", 0.6), g, 0, 1.36, 0).scale.set(1, 1.05, 1.1);
      mesh(sph(0.035), mat("#000", 1, 0, "#66ff33", 4), g, 0.06, 1.38, 0.13);
      mesh(sph(0.035), mat("#000", 1, 0, "#66ff33", 4), g, -0.06, 1.38, 0.13);
      for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.04, 0.3, 8), mat("#1a1010"), g, s * 0.12, 1.5, 0).rotation.z = -s * 0.5;
    }
    tip = pivot(g, 0, 1.34, 0);
  }
  return tip;
}

// ---------------------------------------------------------------------------
// Humanoid (players, bandits, skeletons, golems)
// ---------------------------------------------------------------------------
export interface HumanoidOpts {
  skin: string;
  hair: string;
  armor: string;
  pants?: string;
  boots?: string;
  trim: string;
  scale: number;
  lowPoly?: boolean;
  race: RaceDef["id"] | "skeleton" | "golem";
  weapon?: WeaponModelKind;
  playerStyle?: boolean;
  robe?: boolean;
  hood?: boolean;
  pauldrons?: boolean;
  cape?: string;
  glow?: string;
  eyeGlow?: string;
}

export function buildHumanoid(o: HumanoidOpts): Model {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  body.scale.setScalar(o.scale);

  const isSkel = o.race === "skeleton";
  const isGolem = o.race === "golem";
  const isTauren = o.race === "tauren";
  const isOrc = o.race === "orc";
  const isUndead = o.race === "undead";
  const isElf = o.race === "elf";

  const ownedMaterials = new Set<THREE.Material>();
  const characterMaterial = (color: string, roughness = 0.78) => {
    if (!o.lowPoly) return mat(color, roughness);
    const material = new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
    ownedMaterials.add(material);
    return material;
  };
  const skin = isGolem ? mat(o.skin, 0.95, 0.05) : characterMaterial(o.skin, isSkel ? 0.7 : 0.7);
  const armor = characterMaterial(o.armor, 0.84);
  const pants = characterMaterial(o.pants ?? o.armor, 0.9);
  const boots = characterMaterial(o.boots ?? "#3b2a1c", 0.9);
  const trim = characterMaterial(o.trim, 0.55);
  const cloth = characterMaterial(o.armor, 0.9);
  const vest = o.playerStyle ? characterMaterial("#393424", 0.92) : armor;
  const belt = o.playerStyle ? characterMaterial("#50511a", 0.9) : trim;
  const greave = o.playerStyle ? characterMaterial("#8d846d", 0.95) : boots;
  const glowMat = o.glow ? mat(o.glow, 0.4, 0, o.glow, 3) : null;

  const bulk = isTauren ? 1.25 : isOrc ? 1.15 : isUndead || isSkel ? 0.82 : isGolem ? 1.4 : 1;
  const limbR = (isSkel ? 0.045 : 0.085) * bulk;
  const hipY = 0.95;

  // hips + torso
  const hips = pivot(body, 0, hipY, 0);
  if (isGolem) {
    mesh(new THREE.DodecahedronGeometry(0.32, 1), skin, hips, 0, 0, 0).scale.set(1.2, 0.8, 1);
  } else if (isSkel) {
    mesh(new THREE.TorusGeometry(0.14, 0.04, 8, 16), skin, hips, 0, 0, 0).rotation.x = Math.PI / 2;
  } else {
    mesh(cap(0.17 * bulk, 0.12), o.playerStyle ? pants : o.robe ? cloth : armor, hips, 0, 0, 0).rotation.z = Math.PI / 2;
    if (o.playerStyle) {
      mesh(new THREE.BoxGeometry(0.4, 0.12, 0.29), belt, hips, 0, 0.03, 0.02);
      mesh(new THREE.BoxGeometry(0.09, 0.09, 0.035), characterMaterial("#84794b", 0.55), hips, 0, 0.03, 0.177);
      mesh(new THREE.BoxGeometry(0.035, 0.05, 0.04), characterMaterial("#342f20", 0.7), hips, 0, 0.03, 0.198);
    } else {
      mesh(new THREE.TorusGeometry(0.19 * bulk, 0.035, 8, 24), trim, hips, 0, 0.08, 0).rotation.x = Math.PI / 2;
    }
  }

  const torso = pivot(hips, 0, 0.1, 0);
  if (isGolem) {
    mesh(new THREE.DodecahedronGeometry(0.42, 1), skin, torso, 0, 0.42, 0).scale.set(1.35, 1.1, 1);
    if (glowMat) {
      mesh(new THREE.IcosahedronGeometry(0.14, 1), glowMat, torso, 0, 0.45, 0.33);
      for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), glowMat, torso, (Math.random() - 0.5) * 0.7, 0.3 + Math.random() * 0.4, 0.32).rotation.z = Math.random() * 2;
    }
  } else if (isSkel) {
    mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), skin, torso, 0, 0.27, 0);
    for (let i = 0; i < 5; i++) {
      const r = mesh(new THREE.TorusGeometry(0.15 - i * 0.012, 0.018, 6, 20, Math.PI * 1.6), skin, torso, 0, 0.22 + i * 0.07, 0.02);
      r.rotation.x = Math.PI / 2;
      r.rotation.z = Math.PI * 0.7;
    }
    if (o.pauldrons) mesh(cap(0.2, 0.25), armor, torso, 0, 0.4, 0).scale.set(1.2, 1, 0.8);
  } else {
    const chest = mesh(cap(0.2 * bulk, 0.32), o.robe ? cloth : armor, torso, 0, 0.36, 0);
    chest.scale.set(1.25, 1, 0.78);
    if (o.playerStyle) {
      mesh(new THREE.BoxGeometry(0.12, 0.49, 0.045), vest, torso, -0.12, 0.38, 0.155);
      mesh(new THREE.BoxGeometry(0.12, 0.49, 0.045), vest, torso, 0.12, 0.38, 0.155);
      mesh(new THREE.BoxGeometry(0.09, 0.49, 0.025), armor, torso, 0, 0.38, 0.183);
      mesh(new THREE.BoxGeometry(0.34, 0.1, 0.05), vest, torso, 0, 0.59, 0.14);
      for (const side of [-1, 1]) {
        const strap = mesh(new THREE.BoxGeometry(0.07, 0.21, 0.045), vest, torso, side * 0.145, 0.58, 0.12);
        strap.rotation.z = -side * 0.35;
      }
    } else {
      mesh(new THREE.BoxGeometry(0.34 * bulk, 0.3, 0.04), trim, torso, 0, 0.42, 0.15 * bulk);
      if (isTauren || isOrc) mesh(sph(0.16 * bulk), skin, torso, 0, 0.6, 0.06).scale.set(1.6, 0.6, 0.9);
    }
  }

  // neck/head
  const neck = pivot(torso, 0, isGolem ? 0.8 : 0.7, 0);
  const head = pivot(neck, 0, 0.12, isTauren ? 0.06 : 0);
  if (!isGolem) mesh(new THREE.CylinderGeometry(0.055 * bulk, 0.065 * bulk, 0.14, 12), skin, neck, 0, 0.02, 0);
  const eyeM = o.eyeGlow ? mat("#000", 1, 0, o.eyeGlow, 4) : mat("#1a1a1a", 0.2);
  if (isGolem) {
    mesh(new THREE.DodecahedronGeometry(0.2, 1), skin, head, 0, 0.05, 0.05);
    mesh(sph(0.04), eyeM, head, 0.08, 0.08, 0.2);
    mesh(sph(0.04), eyeM, head, -0.08, 0.08, 0.2);
  } else if (isSkel) {
    mesh(sph(0.13), skin, head, 0, 0.1, 0).scale.set(0.95, 1.05, 1.05);
    mesh(new THREE.BoxGeometry(0.15, 0.06, 0.12), skin, head, 0, -0.02, 0.04);
    mesh(sph(0.035), eyeM, head, 0.045, 0.12, 0.11);
    mesh(sph(0.035), eyeM, head, -0.045, 0.12, 0.11);
    if (o.pauldrons) mesh(new THREE.ConeGeometry(0.16, 0.28, 16), armor, head, 0, 0.25, 0);
  } else {
    const hs = isTauren ? 0.16 : 0.13;
    const skull = mesh(sph(hs), skin, head, 0, 0.1, 0);
    skull.scale.set(0.92, 1.08, 1);
    // jaw / face
    if (isTauren) {
      mesh(cap(0.09, 0.12), skin, head, 0, 0.02, 0.15).rotation.x = Math.PI / 2;
      mesh(sph(0.05), mat("#1b120c"), head, 0, 0.02, 0.27);
      // horns
      for (const s of [-1, 1]) {
        const horn = mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16, Math.PI * 0.7), mat("#e6dcc4", 0.5), head, s * 0.16, 0.2, 0);
        horn.rotation.set(0, s > 0 ? 0 : Math.PI, Math.PI * 0.05);
        mesh(new THREE.ConeGeometry(0.06, 0.1, 8), skin, head, s * 0.15, 0.12, 0).rotation.z = s * 1.3;
      }
    } else {
      mesh(sph(0.1), skin, head, 0, 0.03, 0.035).scale.set(0.85, 0.75, 1);
      mesh(new THREE.ConeGeometry(0.022, 0.06, 8), skin, head, 0, 0.08, hs + 0.01).rotation.x = Math.PI / 2;
    }
    if (o.playerStyle) {
      for (const side of [-1, 1]) {
        const eyeShape = new THREE.Shape();
        eyeShape.moveTo(-0.025, -0.018);
        eyeShape.lineTo(0.027, -0.006);
        eyeShape.lineTo(0.004, 0.025);
        eyeShape.closePath();
        const eye = mesh(new THREE.ShapeGeometry(eyeShape), eyeM, head, side * 0.047, 0.12, hs * 0.95);
        eye.scale.x = side;
      }
    } else {
      mesh(sph(0.018), eyeM, head, 0.045, 0.12, hs * 0.92);
      mesh(sph(0.018), eyeM, head, -0.045, 0.12, hs * 0.92);
    }
    if (!o.playerStyle) mesh(new THREE.ConeGeometry(0.022, 0.06, 8), skin, head, 0, 0.08, hs + 0.01).rotation.x = Math.PI / 2;
    if (isOrc) mesh(new THREE.BoxGeometry(0.2, 0.035, 0.05), skin, head, 0, 0.16, hs * 0.85);
    // ears
    for (const s of [-1, 1]) {
      if (isElf) {
        const e = mesh(new THREE.ConeGeometry(0.03, 0.28, 8), skin, head, s * 0.14, 0.14, -0.01);
        e.rotation.z = -s * 1.15;
        e.rotation.x = -0.3;
      } else if (!isTauren) {
        mesh(sph(0.03), skin, head, s * 0.12, 0.1, 0).scale.set(0.5, 1, 0.8);
      }
    }
    if (isOrc) for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.018, 0.08, 8), mat("#f2ead6", 0.4), head, s * 0.05, 0.02, hs * 0.85);
    if (isUndead) mesh(new THREE.BoxGeometry(0.1, 0.03, 0.04), mat("#3a1a1a"), head, 0, 0.0, hs * 0.85);
    // hair / hood
    if (o.hood) {
      mesh(sph(hs * 1.18, 24, 18), cloth, head, 0, 0.13, -0.02).scale.set(1, 1.08, 1.05);
      mesh(new THREE.ConeGeometry(hs * 0.9, 0.2, 16), cloth, head, 0, 0.29, -0.06).rotation.x = -0.4;
    } else if (!isTauren) {
      const hairM = characterMaterial(o.hair, 0.88);
      mesh(new THREE.SphereGeometry(hs * 1.06, o.lowPoly ? 7 : 24, o.lowPoly ? 5 : 18, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, head, 0, 0.12, -0.012);
      if (o.lowPoly) {
        for (const side of [-1, 1]) {
          const lock = mesh(new THREE.ConeGeometry(0.075, 0.34, 5), hairM, head, side * 0.095, -0.005, 0.018);
          lock.rotation.z = side * -0.12;
          lock.rotation.x = -0.08;
        }
      }
      if (o.playerStyle) {
        for (const side of [-1, 1]) {
          const sideLock = mesh(new THREE.ConeGeometry(0.05, 0.38, 5), hairM, head, side * 0.115, -0.07, 0.015);
          sideLock.rotation.set(Math.PI, 0, side * -0.13);
          const bang = mesh(new THREE.ConeGeometry(0.045, 0.2, 4), hairM, head, side * 0.035, 0.19, 0.095);
          bang.rotation.set(Math.PI, 0, side * 0.18);
        }
        const ponytail = mesh(new THREE.ConeGeometry(0.085, 0.38, 5), hairM, head, 0, -0.06, -0.16);
        ponytail.rotation.x = -Math.PI / 2;
      }
      if (isElf) mesh(cap(0.09, 0.32), hairM, head, 0, -0.05, -0.1).scale.set(1.3, 1, 0.6);
      if (isOrc) mesh(cap(0.03, 0.25), hairM, head, 0, 0.25, -0.05).rotation.x = -1.2;
    }
  }

  // arms
  const shoulderX = (isGolem ? 0.48 : 0.27) * bulk;
  const mkArm = (s: number) => {
    const sh = pivot(torso, s * shoulderX, isGolem ? 0.7 : 0.58, 0);
    if (isGolem) mesh(new THREE.DodecahedronGeometry(0.22, 0), skin, sh, 0, -0.18, 0);
    else {
      mesh(cap(limbR, 0.24), o.robe ? cloth : skin, sh, 0, -0.17, 0);
      if (o.playerStyle) mesh(cap(limbR * 1.55, 0.18), cloth, sh, 0, -0.1, 0);
    }
    if (o.pauldrons && !isSkel) {
      mesh(new THREE.SphereGeometry(0.14 * bulk, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), armor, sh, s * 0.02, 0.02, 0).scale.set(1.15, 0.9, 1.1);
      mesh(new THREE.ConeGeometry(0.04, 0.14, 8), trim, sh, s * 0.05, 0.12, 0);
    }
    const el = pivot(sh, 0, isGolem ? -0.42 : -0.34, 0);
    if (isGolem) mesh(new THREE.DodecahedronGeometry(0.26, 0), skin, el, 0, -0.22, 0);
    else {
      mesh(cap(limbR * 0.92, 0.22), o.robe ? cloth : skin, el, 0, -0.15, 0);
      if (!isSkel) mesh(new THREE.CylinderGeometry(limbR * 1.25, limbR * 1.15, 0.14, 12), trim, el, 0, -0.2, 0);
    }
    const hand = pivot(el, 0, isGolem ? -0.5 : -0.34, 0);
    const handGeometry = o.playerStyle ? new THREE.DodecahedronGeometry(limbR * 1.05, 0) : sph(isGolem ? 0.18 : limbR * 0.95);
    mesh(handGeometry, skin, hand, 0, 0, 0);
    return { sh, el, hand };
  };
  const armR = mkArm(-1);
  const armL = mkArm(1);

  // legs
  const mkLeg = (s: number) => {
    const hp = pivot(hips, s * 0.11 * bulk * (isGolem ? 1.3 : 1), -0.04, 0);
    if (isGolem) mesh(new THREE.DodecahedronGeometry(0.22, 0), skin, hp, 0, -0.22, 0);
    else mesh(cap(limbR * 1.2, 0.3), o.robe ? cloth : pants, hp, 0, -0.22, 0);
    const kn = pivot(hp, 0, -0.44, 0);
    if (isGolem) mesh(new THREE.DodecahedronGeometry(0.24, 0), skin, kn, 0, -0.2, 0);
    else mesh(cap(limbR, 0.3), o.playerStyle ? pants : o.robe ? cloth : skin, kn, 0, -0.2, 0);
    if (o.playerStyle) {
      mesh(new THREE.BoxGeometry(0.14, 0.3, 0.045), greave, kn, 0, -0.2, 0.088);
      mesh(new THREE.BoxGeometry(0.16, 0.035, 0.05), belt, kn, 0, -0.08, 0.108);
      mesh(new THREE.BoxGeometry(0.16, 0.035, 0.05), belt, kn, 0, -0.31, 0.108);
    } else if (!isSkel && !isGolem) mesh(cap(limbR * 1.25, 0.12), trim, kn, 0, -0.32, 0.01);
    if (isTauren) mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 12), mat("#1a1410"), kn, 0, -0.43, 0.02);
    else mesh(new THREE.BoxGeometry(o.playerStyle ? 0.16 : 0.13 * bulk, 0.16, o.playerStyle ? 0.34 : 0.3), isGolem ? skin : boots, kn, 0, -0.44, 0.06);
    return { hp, kn };
  };
  const legR = mkLeg(-1);
  const legL = mkLeg(1);

  if (o.robe) {
    const skirt = mesh(new THREE.CylinderGeometry(0.2 * bulk, 0.36 * bulk, 0.7, 24, 3, true), cloth, hips, 0, -0.35, 0);
    (skirt.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    mesh(new THREE.CylinderGeometry(0.205 * bulk, 0.21 * bulk, 0.05, 24), trim, hips, 0, -0.02, 0);
  }

  // cape
  let cape: THREE.Object3D | null = null;
  if (o.cape) {
    cape = pivot(torso, 0, 0.66, -0.17 * bulk);
    const cm = mat(o.cape, 0.9);
    const cg = new THREE.PlaneGeometry(0.5 * bulk, 1.1, 4, 8);
    const c = mesh(cg, cm, cape, 0, -0.55, 0);
    cm.side = THREE.DoubleSide;
    c.castShadow = true;
  }

  let weaponTip: THREE.Object3D | undefined;
  if (o.weapon) weaponTip = buildWeapon(o.weapon, armR.hand, armL.hand, o.glow ?? "#7fd8ff");

  const isRanged = o.weapon === "bow";
  const height = 1.95 * o.scale * (isGolem ? 1.15 : 1);

  let gaitPhase = 0;
  const animate = (dt: number, t: number, s: AnimState) => {
    if (s.dead) {
      const k = Math.min(1, s.deadT * 2.2);
      body.rotation.x = -k * Math.PI / 2 * 0.98;
      body.position.y = k * 0.15 * o.scale;
      armR.sh.rotation.x = -k * 2.4;
      armL.sh.rotation.x = -k * 2.2;
      return;
    }

    body.rotation.x = 0;
    body.position.y = 0;
    const run = THREE.MathUtils.clamp(s.speed, 0, 1);
    const gaitRate = s.running ? 13 : 8.5;
    if (run > 0.001) gaitPhase += dt * gaitRate * Math.max(0.65, run);
    const stride = (s.running ? 0.78 : 0.48) * run;
    const step = Math.sin(gaitPhase);
    const oppositeStep = Math.sin(gaitPhase + Math.PI);
    const breathe = Math.sin(t * 2.1) * 0.018;

    legR.hp.rotation.x = -step * stride;
    legL.hp.rotation.x = -oppositeStep * stride;
    legR.kn.rotation.x = Math.max(0, oppositeStep) * (s.running ? 1.05 : 0.68) * run;
    legL.kn.rotation.x = Math.max(0, step) * (s.running ? 1.05 : 0.68) * run;
    hips.position.y = hipY + Math.abs(Math.sin(gaitPhase * 2)) * (s.running ? 0.045 : 0.025) * run;
    torso.rotation.x = (s.running ? 0.14 : 0.055) * run + breathe;
    torso.rotation.y = Math.sin(gaitPhase) * 0.075 * run;

    armR.sh.rotation.set(step * stride * 0.55, 0, -0.1);
    armL.sh.rotation.set(oppositeStep * stride * 0.55, 0, 0.1);
    armR.el.rotation.x = -0.25 - 0.35 * run;
    armL.el.rotation.x = -0.25 - 0.35 * run;
    head.rotation.x = -0.035 * run + Math.sin(t * 1.5) * 0.012;

    if (s.airborne) {
      legR.kn.rotation.x = 0.78;
      legL.kn.rotation.x = 0.56;
      legR.hp.rotation.x = -0.38;
      legL.hp.rotation.x = 0.12;
      armR.sh.rotation.x = -0.5;
      armL.sh.rotation.x = -0.5;
    }
    if (cape) cape.rotation.x = 0.15 + run * 0.35 + Math.sin(t * 3) * 0.05;

    const weaponKind = s.weaponKind ?? o.weapon;
    const isMagicWeapon = weaponKind === "staff" || weaponKind === "skullstaff" || weaponKind === "orb";
    if (run < 0.1 && !s.action && weaponKind) {
      armR.sh.rotation.x = -0.22 + breathe;
      armR.el.rotation.x = -0.62;
      if (isRanged) armL.sh.rotation.set(-0.22, 0, 0.18);
    }

    if (s.action === "attack") {
      const duration = weaponKind === "axe" ? 0.78 : weaponKind === "sword" || weaponKind === "hammer" ? 0.58 : 0.5;
      const p = Math.min(1, s.actionT / duration);
      const windup = 1 - Math.min(1, p / 0.24);
      const drive = p < 0.24 ? 0 : p < 0.58 ? Math.sin(((p - 0.24) / 0.34) * Math.PI * 0.5) : Math.max(0, 1 - (p - 0.58) / 0.42);
      legR.hp.rotation.x *= 0.2;
      legL.hp.rotation.x *= 0.2;
      torso.rotation.x = 0.04 + breathe;

      if (weaponKind === "bow") {
        const draw = p < 0.7 ? p / 0.7 : Math.max(0, 1 - (p - 0.7) / 0.3);
        armL.sh.rotation.set(-1.45, 0, 0.18);
        armL.el.rotation.x = -0.08;
        armR.sh.rotation.set(-1.3, 0, -0.08 - 0.4 * draw);
        armR.el.rotation.x = -1.25 * draw;
        torso.rotation.y = 0.42;
      } else if (isMagicWeapon) {
        const raise = Math.min(1, p * 3.5);
        const pulse = Math.sin(t * 12) * 0.035;
        armR.sh.rotation.set(-1.05 * raise + pulse, 0, -0.22);
        armL.sh.rotation.set(-0.78 * raise - pulse, 0, 0.24);
        armR.el.rotation.x = -0.42;
        armL.el.rotation.x = -0.52;
        torso.rotation.y = 0.08;
      } else if (weaponKind === "axe") {
        armR.sh.rotation.set(-0.3 - 1.45 * windup - 0.42 * drive, 0, -0.32 - 0.16 * windup);
        armR.el.rotation.x = -1.1 - 0.52 * windup + 0.9 * drive;
        armL.sh.rotation.set(-0.35 - 0.7 * windup - 0.36 * drive, 0, 0.24);
        armL.el.rotation.x = -0.95 + 0.72 * drive;
        torso.rotation.y = -0.3 * windup + 0.45 * drive;
      } else if (!weaponKind) {
        const rightSide = s.attackSide !== "left";
        const striking = rightSide ? armR : armL;
        const guard = rightSide ? armL : armR;
        const side = rightSide ? 1 : -1;
        striking.sh.rotation.set(-0.22 - 0.68 * windup - 0.92 * drive, 0, -side * 0.12);
        striking.el.rotation.x = -1.05 + 0.94 * drive;
        guard.sh.rotation.set(-0.58 - 0.12 * drive, 0, side * 0.28);
        guard.el.rotation.x = -0.95;
        torso.rotation.y = side * (0.12 * windup - 0.22 * drive);
      } else {
        armR.sh.rotation.set(-0.24 - 0.95 * windup - 0.8 * drive, 0, -0.1 - 0.32 * windup);
        armR.el.rotation.x = -0.92 - 0.2 * windup + 0.68 * drive;
        armL.sh.rotation.set(-0.36 - 0.22 * drive, 0, 0.22);
        armL.el.rotation.x = -0.88;
        torso.rotation.y = -0.28 * windup + 0.3 * drive;
      }
    } else if (s.action === "hit") {
      const flinch = Math.max(0, 1 - s.actionT / 0.4);
      torso.rotation.x = -0.12 * flinch;
      torso.rotation.y = 0.12 * flinch;
      armR.sh.rotation.x = -0.55 * flinch;
      armL.sh.rotation.x = -0.35 * flinch;
      head.rotation.x = 0.16 * flinch;
    } else if (s.action === "cast" || s.action === "channel") {
      const raise = Math.min(1, s.actionT * 3.2);
      const pulse = Math.sin(t * 10) * 0.045;
      armR.sh.rotation.set(-1.12 * raise + pulse, 0, -0.24);
      armL.sh.rotation.set(-0.88 * raise - pulse, 0, 0.26);
      armR.el.rotation.x = -0.42;
      armL.el.rotation.x = -0.5;
      torso.rotation.x = -0.045;
    }
  };

  return {
    root,
    height,
    radius: 0.6 * o.scale * bulk,
    animate,
    weaponTip,
    dispose: () => {
      root.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      ownedMaterials.forEach((material) => material.dispose());
      ownedMaterials.clear();
    },
  };
}

export function buildPlayerModel(race: RaceDef, cls: ClassDef, appearance?: PlayerAppearance, weapon?: WeaponModelKind): Model {
  const colors = appearance ?? {
    hairColor: race.hair,
    chestColor: cls.armor,
    pantsColor: "#292832",
    bootsColor: "#5b3b2e",
  };
  return buildHumanoid({
    skin: race.skin,
    hair: colors.hairColor,
    armor: colors.chestColor,
    pants: colors.pantsColor,
    boots: colors.bootsColor,
    trim: "#786439",
    scale: 1,
    race: "human",
    lowPoly: true,
    playerStyle: true,
    weapon,
    robe: false,
    hood: false,
    pauldrons: false,
  });
}

// ---------------------------------------------------------------------------
// Creatures
// ---------------------------------------------------------------------------
function buildQuadruped(def: MobDef, kind: "wolf" | "boar"): Model {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  body.scale.setScalar(def.scale);
  const fur = mat(def.color, 0.95);
  const dark = mat(new THREE.Color(def.color).multiplyScalar(0.6).getStyle(), 0.95);
  const eye = mat("#000", 1, 0, def.accent, 4);
  const isBoar = kind === "boar";
  const legH = isBoar ? 0.45 : 0.62;
  const torso = pivot(body, 0, legH + 0.2, 0);
  const t = mesh(cap(isBoar ? 0.36 : 0.27, isBoar ? 0.55 : 0.75), fur, torso, 0, 0, 0);
  t.rotation.x = Math.PI / 2;
  t.scale.set(1, 1, isBoar ? 1.05 : 0.95);
  mesh(sph(isBoar ? 0.33 : 0.28), dark, torso, 0, 0.08, 0.3).scale.set(1, 1.05, 1); // shoulders/mane
  if (isBoar) for (let i = 0; i < 6; i++) mesh(new THREE.ConeGeometry(0.04, 0.22, 6), dark, torso, 0, 0.33, 0.35 - i * 0.12).rotation.x = -0.3;
  const neck = pivot(torso, 0, 0.12, isBoar ? 0.5 : 0.55);
  const head = pivot(neck, 0, 0.05, 0.1);
  mesh(sph(isBoar ? 0.24 : 0.19), fur, head, 0, 0, 0).scale.set(1, 0.95, 1.1);
  const snout = mesh(cap(isBoar ? 0.13 : 0.09, isBoar ? 0.18 : 0.22), fur, head, 0, -0.05, isBoar ? 0.25 : 0.24);
  snout.rotation.x = Math.PI / 2;
  mesh(sph(0.045), mat("#111"), head, 0, -0.03, isBoar ? 0.45 : 0.42);
  mesh(sph(0.035), eye, head, 0.09, 0.07, 0.15);
  mesh(sph(0.035), eye, head, -0.09, 0.07, 0.15);
  const jaw = pivot(head, 0, -0.1, 0.1);
  mesh(new THREE.BoxGeometry(0.12, 0.04, 0.25), dark, jaw, 0, 0, 0.1);
  for (const s of [-1, 1]) {
    if (isBoar) {
      const tusk = mesh(new THREE.ConeGeometry(0.035, 0.22, 8), mat(def.accent, 0.4), head, s * 0.12, -0.06, 0.32);
      tusk.rotation.set(-0.8, 0, s * 0.4);
    } else {
      mesh(new THREE.ConeGeometry(0.06, 0.18, 8), fur, head, s * 0.1, 0.2, -0.02).rotation.z = -s * 0.2;
    }
  }
  const legs: { hp: THREE.Group; kn: THREE.Group; phase: number }[] = [];
  for (const [x, z, ph] of [[0.17, 0.42, 0], [-0.17, 0.42, Math.PI], [0.17, -0.38, Math.PI], [-0.17, -0.38, 0]] as const) {
    const hp = pivot(torso, x, -0.1, z);
    mesh(cap(0.08, legH * 0.42), fur, hp, 0, -legH * 0.25, 0);
    const kn = pivot(hp, 0, -legH * 0.5, 0);
    mesh(cap(0.05, legH * 0.4), dark, kn, 0, -legH * 0.22, 0);
    mesh(sph(0.07), dark, kn, 0, -legH * 0.48, 0.03).scale.set(1, 0.6, 1.3);
    legs.push({ hp, kn, phase: ph });
  }
  const tail = pivot(torso, 0, 0.1, -0.55);
  mesh(cap(isBoar ? 0.03 : 0.07, isBoar ? 0.15 : 0.45), dark, tail, 0, 0, -0.2).rotation.x = Math.PI / 2 + 0.6;

  const animate = (_dt: number, tm: number, s: AnimState) => {
    if (s.dead) {
      const k = Math.min(1, s.deadT * 2.5);
      body.rotation.z = k * Math.PI / 2;
      body.position.y = k * 0.2;
      return;
    }
    body.rotation.z = 0;
    const cyc = tm * (8 + s.speed * 6);
    for (const l of legs) {
      l.hp.rotation.x = Math.sin(cyc + l.phase) * 0.7 * s.speed;
      l.kn.rotation.x = Math.max(0, Math.sin(cyc + l.phase + 1)) * 0.6 * s.speed;
    }
    torso.position.y = legH + 0.2 + Math.abs(Math.sin(cyc)) * 0.05 * s.speed;
    tail.rotation.y = Math.sin(tm * 6) * 0.4;
    head.rotation.x = Math.sin(tm * 1.5) * 0.05;
    jaw.rotation.x = 0;
    if (s.action === "attack") {
      const p = Math.min(1, s.actionT / 0.4);
      const a = Math.sin(p * Math.PI);
      neck.rotation.x = 0.4 * a;
      jaw.rotation.x = 0.6 * a;
      torso.position.z = a * 0.25;
    } else {
      neck.rotation.x = 0;
      torso.position.z = 0;
    }
  };
  return { root, height: (legH + 0.7) * def.scale, radius: 0.8 * def.scale, animate, dispose: () => root.traverse((c) => (c as THREE.Mesh).geometry?.dispose()) };
}

function buildArachnid(def: MobDef, scorpion: boolean): Model {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  body.scale.setScalar(def.scale);
  const shell = mat(def.color, 0.45, 0.2);
  const accent = mat(def.accent, 0.5, 0, def.accent, scorpion ? 0.4 : 1.5);
  const core = pivot(body, 0, 0.45, 0);
  mesh(sph(0.26), shell, core, 0, 0, 0.15).scale.set(1, 0.7, 1.1);
  if (!scorpion) {
    mesh(sph(0.4), shell, core, 0, 0.12, -0.42).scale.set(1, 0.85, 1.15);
    mesh(sph(0.12), accent, core, 0, 0.32, -0.4).scale.set(1.6, 0.3, 2);
  } else {
    for (let i = 0; i < 3; i++) mesh(sph(0.26 - i * 0.03), shell, core, 0, 0, -0.2 - i * 0.22).scale.set(1.1, 0.6, 0.9);
  }
  for (let i = 0; i < (scorpion ? 2 : 4); i++) mesh(sph(0.028), mat("#000", 1, 0, def.accent, 4), core, (i % 2 ? -1 : 1) * (0.06 + (i > 1 ? 0.04 : 0)), 0.1 + (i > 1 ? 0.05 : 0), 0.4);
  const legs: { hp: THREE.Group; kn: THREE.Group; phase: number; side: number }[] = [];
  const n = scorpion ? 3 : 4;
  for (let i = 0; i < n; i++) {
    for (const s of [-1, 1]) {
      const hp = pivot(core, s * 0.2, 0, 0.2 - i * 0.16);
      hp.rotation.y = s * (Math.PI / 2) + (i - 1.5) * 0.35 * -s;
      const upper = mesh(cap(0.035, 0.42), shell, hp, 0, 0.12, 0.2);
      upper.rotation.x = Math.PI / 2 - 0.7;
      const kn = pivot(hp, 0, 0.28, 0.38);
      const lower = mesh(cap(0.03, 0.55), shell, kn, 0, -0.3, 0.12);
      lower.rotation.x = 0.35;
      legs.push({ hp, kn, phase: (i % 2) * Math.PI + (s > 0 ? Math.PI : 0), side: s });
    }
  }
  let tail: THREE.Group | null = null;
  const claws: THREE.Group[] = [];
  if (scorpion) {
    tail = pivot(core, 0, 0.05, -0.8);
    let p: THREE.Group = tail;
    for (let i = 0; i < 5; i++) {
      const seg = pivot(p, 0, 0.12, -0.05);
      seg.rotation.x = -0.55;
      mesh(sph(0.11 - i * 0.012), shell, seg, 0, 0.06, 0).scale.set(1, 1.3, 1);
      p = seg;
    }
    mesh(new THREE.ConeGeometry(0.06, 0.28, 10), accent, p, 0, 0.22, 0.05).rotation.x = 0.8;
    for (const s of [-1, 1]) {
      const arm = pivot(core, s * 0.22, 0, 0.35);
      arm.rotation.y = s * 0.4;
      mesh(cap(0.05, 0.35), shell, arm, 0, 0, 0.2).rotation.x = Math.PI / 2;
      const claw = pivot(arm, 0, 0, 0.45);
      mesh(sph(0.12), shell, claw, 0, 0, 0.08).scale.set(0.8, 0.6, 1.4);
      mesh(new THREE.ConeGeometry(0.04, 0.25, 8), accent, claw, s * 0.04, 0, 0.28).rotation.x = Math.PI / 2;
      claws.push(arm);
    }
  }
  const animate = (_dt: number, tm: number, s: AnimState) => {
    if (s.dead) {
      const k = Math.min(1, s.deadT * 3);
      body.rotation.z = k * Math.PI;
      body.position.y = k * 0.7 * def.scale;
      return;
    }
    body.rotation.z = 0;
    body.position.y = 0;
    const cyc = tm * (10 + s.speed * 8);
    for (const l of legs) {
      l.hp.rotation.z = Math.sin(cyc + l.phase) * 0.25 * s.speed;
      l.kn.rotation.x = Math.sin(cyc + l.phase + 0.8) * 0.25 * s.speed;
    }
    core.position.y = 0.45 + Math.sin(cyc * 2) * 0.02 * s.speed;
    if (tail) tail.rotation.x = Math.sin(tm * 2) * 0.1;
    if (s.action === "attack") {
      const a = Math.sin(Math.min(1, s.actionT / 0.4) * Math.PI);
      core.rotation.x = -0.25 * a;
      if (tail) tail.rotation.x = 0.9 * a;
      for (const c of claws) c.rotation.x = -0.4 * a;
    } else core.rotation.x = 0;
  };
  return { root, height: 1.0 * def.scale, radius: 0.9 * def.scale, animate, dispose: () => root.traverse((c) => (c as THREE.Mesh).geometry?.dispose()) };
}

function buildRaptor(def: MobDef): Model {
  const root = new THREE.Group();
  const body = pivot(root, 0, 0, 0);
  body.scale.setScalar(def.scale);
  const skin = mat(def.color, 0.7);
  const stripe = mat(def.accent, 0.7);
  const torso = pivot(body, 0, 1.0, 0);
  const t = mesh(cap(0.25, 0.6), skin, torso, 0, 0, 0);
  t.rotation.x = Math.PI / 2 - 0.25;
  for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.05, 0.08, 0.15), stripe, torso, 0, 0.24 - i * 0.02, 0.2 - i * 0.18);
  const neck = pivot(torso, 0, 0.2, 0.4);
  mesh(cap(0.11, 0.3), skin, neck, 0, 0.15, 0.08).rotation.x = 0.5;
  const head = pivot(neck, 0, 0.38, 0.18);
  mesh(cap(0.12, 0.3), skin, head, 0, 0, 0.12).rotation.x = Math.PI / 2;
  const jaw = pivot(head, 0, -0.06, 0.05);
  mesh(new THREE.BoxGeometry(0.14, 0.05, 0.36), skin, jaw, 0, -0.03, 0.15);
  mesh(sph(0.035), mat("#000", 1, 0, "#ffcc00", 3), head, 0.09, 0.06, 0.1);
  mesh(sph(0.035), mat("#000", 1, 0, "#ffcc00", 3), head, -0.09, 0.06, 0.1);
  for (let i = 0; i < 4; i++) mesh(new THREE.ConeGeometry(0.03, 0.15, 6), stripe, head, 0, 0.12, -0.05 - i * 0.07).rotation.x = -0.5;
  const tail = pivot(torso, 0, 0.05, -0.4);
  mesh(new THREE.ConeGeometry(0.2, 1.1, 12), skin, tail, 0, 0, -0.5).rotation.x = -Math.PI / 2 - 0.1;
  const legs: { hp: THREE.Group; kn: THREE.Group; s: number }[] = [];
  for (const s of [-1, 1]) {
    const hp = pivot(torso, s * 0.18, -0.05, -0.05);
    mesh(cap(0.12, 0.3), skin, hp, 0, -0.2, 0.05);
    const kn = pivot(hp, 0, -0.45, 0.1);
    mesh(cap(0.06, 0.4), skin, kn, 0, -0.22, -0.08).rotation.x = -0.35;
    mesh(new THREE.ConeGeometry(0.03, 0.15, 6), mat("#222"), kn, 0, -0.48, 0.0).rotation.x = Math.PI / 2;
    legs.push({ hp, kn, s });
    const arm = pivot(torso, s * 0.15, 0.0, 0.45);
    mesh(cap(0.03, 0.15), skin, arm, 0, -0.1, 0.03).rotation.x = 0.6;
  }
  const animate = (_dt: number, tm: number, s: AnimState) => {
    if (s.dead) {
      const k = Math.min(1, s.deadT * 2.5);
      body.rotation.z = k * Math.PI / 2;
      body.position.y = k * 0.3;
      return;
    }
    body.rotation.z = 0;
    body.position.y = 0;
    const cyc = tm * (9 + s.speed * 5);
    for (const l of legs) {
      l.hp.rotation.x = Math.sin(cyc + (l.s > 0 ? 0 : Math.PI)) * 0.8 * s.speed;
      l.kn.rotation.x = Math.max(0, Math.sin(cyc + (l.s > 0 ? 1 : 1 + Math.PI))) * 0.8 * s.speed;
    }
    torso.position.y = 1.0 + Math.abs(Math.sin(cyc)) * 0.08 * s.speed;
    tail.rotation.y = Math.sin(tm * 3) * 0.2;
    if (s.action === "attack") {
      const a = Math.sin(Math.min(1, s.actionT / 0.4) * Math.PI);
      neck.rotation.x = 0.7 * a;
      jaw.rotation.x = 0.6 * a;
    } else {
      neck.rotation.x = Math.sin(tm * 1.3) * 0.05;
      jaw.rotation.x = 0;
    }
  };
  return { root, height: 1.9 * def.scale, radius: 0.8 * def.scale, animate, dispose: () => root.traverse((c) => (c as THREE.Mesh).geometry?.dispose()) };
}

export function buildMobModel(def: MobDef): Model {
  switch (def.body) {
    case "wolf":
    case "boar":
      return buildQuadruped(def, def.body);
    case "spider":
      return buildArachnid(def, false);
    case "scorpion":
      return buildArachnid(def, true);
    case "raptor":
      return buildRaptor(def);
    case "skeleton":
      return buildHumanoid({ skin: def.color, hair: "#000", armor: "#3a3a40", trim: "#6a5a40", scale: def.scale, race: "skeleton", weapon: "sword", pauldrons: def.id === "skeleton_knight", eyeGlow: def.accent });
    case "golem":
      return buildHumanoid({ skin: def.color, hair: "#000", armor: def.color, trim: def.accent, scale: def.scale, race: "golem", glow: def.accent, eyeGlow: def.accent });
    case "humanoid":
    default:
      return buildHumanoid({ skin: def.elite ? "#7b8a4a" : "#d8a983", hair: "#2a1a10", armor: def.color, trim: def.accent, scale: def.scale, race: def.elite ? "orc" : "human", weapon: def.elite ? "hammer" : "sword", hood: !def.elite, cape: def.elite ? "#4a2a10" : undefined });
  }
}

export function buildVendor(): Model {
  return buildHumanoid({ skin: "#d8a983", hair: "#8a6a4a", armor: "#6a4a8a", trim: "#d8a740", scale: 1, race: "human", robe: true });
}
