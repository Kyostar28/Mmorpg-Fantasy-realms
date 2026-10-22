// Procedural high-detail character & creature models with skeletal-style procedural animations.
import * as THREE from "three";
import type { ClassDef, MobDef, RaceDef } from "./data";
import { createLowPolyCharacter, type LowPolyCharacter } from "../../../PJ_MODEL";

export interface AnimState {
  speed: number; // 0..1 movement blend
  action: "attack" | "cast" | "channel" | "hit" | "dodge" | null;
  actionT: number; // seconds since action started
  dead: boolean;
  deadT: number;
  airborne?: boolean;
  dodgeDir?: -1 | 1; // -1 left, 1 right
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
function buildWeapon(kind: ClassDef["weapon"], hand: THREE.Object3D, offHand: THREE.Object3D, accent: string) {
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
  trim: string;
  scale: number;
  race: RaceDef["id"] | "skeleton" | "golem";
  weapon?: ClassDef["weapon"];
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
  body.scale.setScalar(o.scale * 1.5);

  const isSkel = o.race === "skeleton";
  const isGolem = o.race === "golem";
  const isTauren = o.race === "tauren";
  const isOrc = o.race === "orc";
  const isUndead = o.race === "undead";
  const isElf = o.race === "elf";

  const skin = isGolem ? mat(o.skin, 0.95, 0.05) : mat(o.skin, isSkel ? 0.7 : 0.6, 0);
  const armor = mat(o.armor, o.pauldrons ? 0.35 : 0.8, o.pauldrons ? 0.75 : 0.05);
  const trim = mat(o.trim, 0.35, 0.8);
  const cloth = mat(o.armor, 0.85, 0);
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
    mesh(cap(0.17 * bulk, 0.12), o.robe ? cloth : armor, hips, 0, 0, 0).rotation.z = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.19 * bulk, 0.035, 8, 24), trim, hips, 0, 0.08, 0).rotation.x = Math.PI / 2;
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
    // chest plate detail
    mesh(new THREE.BoxGeometry(0.34 * bulk, 0.3, 0.04), trim, torso, 0, 0.42, 0.15 * bulk);
    if (isTauren || isOrc) mesh(sph(0.16 * bulk), skin, torso, 0, 0.6, 0.06).scale.set(1.6, 0.6, 0.9);
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
    // eyes
    mesh(sph(0.018), eyeM, head, 0.045, 0.12, hs * 0.92);
    mesh(sph(0.018), eyeM, head, -0.045, 0.12, hs * 0.92);
    // brow
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
      const hairM = mat(o.hair, 0.9);
      mesh(new THREE.SphereGeometry(hs * 1.06, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, head, 0, 0.12, -0.012);
      if (isElf) mesh(cap(0.09, 0.32), hairM, head, 0, -0.05, -0.1).scale.set(1.3, 1, 0.6);
      if (isOrc) mesh(cap(0.03, 0.25), hairM, head, 0, 0.25, -0.05).rotation.x = -1.2;
    }
  }

  // arms
  const shoulderX = (isGolem ? 0.48 : 0.27) * bulk;
  const mkArm = (s: number) => {
    const sh = pivot(torso, s * shoulderX, isGolem ? 0.7 : 0.58, 0);
    if (isGolem) mesh(new THREE.DodecahedronGeometry(0.22, 0), skin, sh, 0, -0.18, 0);
    else mesh(cap(limbR, 0.24), o.robe ? cloth : skin, sh, 0, -0.17, 0);
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
    mesh(sph(isGolem ? 0.18 : limbR * 0.95), skin, hand, 0, 0, 0);
    return { sh, el, hand };
  };
  const armR = mkArm(-1);
  const armL = mkArm(1);

  // legs
  const mkLeg = (s: number) => {
    const hp = pivot(hips, s * 0.11 * bulk * (isGolem ? 1.3 : 1), -0.04, 0);
    if (isGolem) mesh(new THREE.DodecahedronGeometry(0.22, 0), skin, hp, 0, -0.22, 0);
    else mesh(cap(limbR * 1.2, 0.3), o.robe ? cloth : armor, hp, 0, -0.22, 0);
    const kn = pivot(hp, 0, -0.44, 0);
    if (isGolem) mesh(new THREE.DodecahedronGeometry(0.24, 0), skin, kn, 0, -0.2, 0);
    else mesh(cap(limbR, 0.3), o.robe ? cloth : skin, kn, 0, -0.2, 0);
    if (!isSkel && !isGolem) mesh(cap(limbR * 1.25, 0.12), trim, kn, 0, -0.32, 0.01);
    if (isTauren) mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.08, 12), mat("#1a1410"), kn, 0, -0.43, 0.02);
    else mesh(new THREE.BoxGeometry(0.11 * bulk, 0.07, 0.24), isGolem ? skin : mat("#3b2a1c", 0.7), kn, 0, -0.44, 0.05);
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
  const height = 1.95 * o.scale * (isGolem ? 1.15 : 1) * 1.5;

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
    const run = s.speed;
    const cyc = t * 10;
    const swing = Math.sin(cyc) * 0.9 * run;
    const breathe = Math.sin(t * 2) * 0.02;

    legR.hp.rotation.x = swing;
    legL.hp.rotation.x = -swing;
    legR.kn.rotation.x = Math.max(0, -Math.sin(cyc + 1.2)) * 1.2 * run;
    legL.kn.rotation.x = Math.max(0, Math.sin(cyc + 1.2)) * 1.2 * run;
    hips.position.y = hipY + Math.abs(Math.cos(cyc)) * 0.07 * run - 0.03 * run;
    torso.rotation.x = 0.15 * run + breathe;
    torso.rotation.y = Math.sin(cyc) * 0.12 * run;

    armR.sh.rotation.set(-swing * 0.8, 0, -0.12);
    armL.sh.rotation.set(swing * 0.8, 0, 0.12);
    armR.el.rotation.x = -0.4 - 0.5 * run;
    armL.el.rotation.x = -0.4 - 0.5 * run;
    head.rotation.x = -0.1 * run;
    if (s.airborne) {
      legR.kn.rotation.x = 0.9;
      legL.kn.rotation.x = 0.5;
      legR.hp.rotation.x = -0.5;
    }
    if (cape) cape.rotation.x = 0.15 + run * 0.5 + Math.sin(t * 3) * 0.05;

    // combat stance when idle with weapon
    if (run < 0.1 && o.weapon && !s.action) {
      armR.sh.rotation.x = -0.3 + breathe;
      armR.el.rotation.x = -0.9;
      if (isRanged) armL.sh.rotation.set(-0.25, 0, 0.2);
    }

    if (s.action === "attack") {
      const p = Math.min(1, s.actionT / 0.45);
      if (isRanged) {
        const draw = p < 0.7 ? p / 0.7 : 1;
        armL.sh.rotation.set(-1.55, 0, 0.15);
        armL.el.rotation.x = 0;
        armR.sh.rotation.set(-1.5, 0, -0.1 - draw * 0.4);
        armR.el.rotation.x = -draw * 2.0;
        torso.rotation.y = 0.5;
      } else {
        // wind up then slash
        const a = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
        armR.sh.rotation.x = -2.6 * a + (p > 0.35 ? -0.6 * (1 - a) : 0);
        armR.sh.rotation.z = -0.4 * a;
        armR.el.rotation.x = -0.6 * a;
        torso.rotation.y = -0.5 * a + (p > 0.35 ? 0.4 * (1 - a) : 0);
        if (o.weapon === "daggers") {
          armL.sh.rotation.x = -1.8 * (p > 0.4 ? Math.sin((p - 0.4) / 0.6 * Math.PI) : 0);
        }
      }
    } else if (s.action === "cast" || s.action === "channel") {
      const raise = Math.min(1, s.actionT * 4);
      const wob = Math.sin(t * 12) * 0.08;
      armR.sh.rotation.set(-1.3 * raise + wob, 0, -0.3);
      armL.sh.rotation.set(-1.3 * raise - wob, 0, 0.3);
      armR.el.rotation.x = -0.5;
      armL.el.rotation.x = -0.5;
      torso.rotation.x = -0.08;
    }
  };

  return {
    root,
    height,
    radius: 0.6 * o.scale * bulk * 1.5,
    animate,
    weaponTip,
    dispose: () => root.traverse((c) => (c as THREE.Mesh).geometry?.dispose()),
  };
}

// ---------------------------------------------------------------------------
// Wrapper for PJ_MODEL LowPolyCharacter (used for human paladin)
// ---------------------------------------------------------------------------
function buildLowPolyCharacterWrapper(race: RaceDef, cls: ClassDef): Model {
  const char = createLowPolyCharacter({
    race: race.id as any,
    skinColor: race.skin,
    hairColor: race.hair,
    eyeColor: race.id === "elf" ? "#9ff0ff" : race.id === "undead" ? "#ffd84a" : "#3b82f6",
  });

  // Equip items based on class
  if (cls.id === "paladin") {
    // Equip helmet (plate style)
    char.equip('helmet', {
      slot: 'helmet',
      style: 'plate',
      visualColor: cls.armor,
      secondaryColor: cls.trim,
    });

    // Equip chest armor
    char.equip('chest', {
      slot: 'chest',
      visualColor: cls.armor,
      secondaryColor: cls.trim,
    });

    // Equip cape (paladin specific)
    char.equip('cape', {
      slot: 'cape',
      visualColor: "#7a1424",
      secondaryColor: cls.trim,
    });

    // Equip gloves
    char.equip('gloves', {
      slot: 'gloves',
      visualColor: cls.armor,
    });

    // Equip pants
    char.equip('pants', {
      slot: 'pants',
      visualColor: cls.armor,
    });

    // Equip boots
    char.equip('boots', {
      slot: 'boots',
      visualColor: "#334155",
    });

    // Equip weapon (hammer for paladin)
    char.equip('weapon', {
      slot: 'weapon',
      weaponType: 'sword',
      visualColor: '#cbd5e1',
      secondaryColor: cls.trim,
    });

    // Equip shield (paladin specific)
    char.equip('shield', {
      slot: 'shield',
      visualColor: '#1e3a8a',
      secondaryColor: cls.trim,
    });
  }

  // Scale the character based on race (increased by 50%)
  char.group.scale.setScalar(race.scale * 0.92 * 1.5);

  // Create animation adapter
  let lastActionT = 0;
  let lastAction = "";
  const animate = (dt: number, t: number, s: AnimState) => {
    const isMoving = s.speed > 0.1;
    const isSprinting = s.speed > 0.6;

    // Handle action states - trigger animations only when action starts
    if (s.action !== lastAction || s.actionT < 0.1) {
      if (s.action === "attack" && lastAction !== "attack") {
        char.playAttack('melee');
      } else if (s.action === "cast" && lastAction !== "cast") {
        char.playAttack('cast');
      } else if (s.action === "hit" && lastAction !== "hit") {
        // Randomly choose between hit reaction or block (paladin specific)
        if (cls.id === "paladin" && Math.random() < 0.4) {
          char.playBlock();
        } else {
          char.playHitReaction();
        }
      } else if (s.action === "dodge" && lastAction !== "dodge") {
        // Trigger dodge animation with direction
        const dodgeDir = s.dodgeDir || (Math.random() < 0.5 ? -1 : 1);
        char.playDodge(dodgeDir);
      }
      lastAction = s.action;
    }

    // Update LowPolyCharacter animation
    char.update(dt, isMoving, isSprinting, { x: 0, z: 1 });

    lastActionT = s.actionT;
  };

  return {
    root: char.group,
    height: 1.95 * race.scale * 1.5,
    radius: 0.6 * race.scale * 1.5,
    animate,
    dispose: () => char.destroy(),
  };
}

export function buildPlayerModel(race: RaceDef, cls: ClassDef): Model {
  // Use PJ_MODEL for human paladin
  if (race.id === "human" && cls.id === "paladin") {
    return buildLowPolyCharacterWrapper(race, cls);
  }

  const plate = cls.id === "warrior" || cls.id === "paladin";
  return buildHumanoid({
    skin: race.skin,
    hair: race.hair,
    armor: cls.armor,
    trim: cls.trim,
    scale: race.scale,
    race: race.id,
    weapon: cls.weapon,
    robe: cls.id === "mage" || cls.id === "warlock",
    hood: cls.id === "assassin" || cls.id === "warlock",
    pauldrons: plate,
    cape: cls.id === "paladin" ? "#7a1424" : cls.id === "warrior" ? "#3a3a5a" : cls.id === "hunter" ? "#3b4a22" : undefined,
    glow: cls.id === "warlock" ? "#66ff33" : cls.id === "mage" ? "#5fd3ff" : undefined,
    eyeGlow: race.id === "undead" ? "#ffd84a" : race.id === "elf" ? "#9ff0ff" : undefined,
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
