// Fantasy Realms — main 3D game engine (rendering, input, combat, AI, loot, persistence hooks).
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import {
  AbilityDef, CLASSES, ClassDef, Equipment, INVENTORY_SIZE, ITEMS, InvSlot, MAX_LEVEL, MOBS, MobDef, PlayerRecord,
  RACES, RaceDef, Slot, ZONES, computeStats, xpForLevel, zoneAt, RARITY_COLOR,
} from "./data";
import { BOSS_SPOTS, LAKES, heightAt, isBlockedForProps, mulberry32, zoneWeights } from "./terrain";
import { AnimState, Model, buildMobModel, buildPlayerModel, buildVendor } from "./models";
import { loadClassModel, setAnimationByState, type FBXModel } from "./fbx-loader";
import { Collider, buildGrass, buildSky, buildTerrain, buildTowns, buildVegetation, buildWater } from "./world";
import { Particles, Rings, makeBeam } from "./fx";

// ---------------------------------------------------------------------------
export interface Objective { key: string; name: string; count: number; need: number; done: boolean; zone: number }
export interface HudSnapshot {
  name: string; raceId: string; classId: string; level: number; xp: number; xpNext: number;
  hp: number; maxHp: number; res: number; maxRes: number; gold: number; kills: number;
  stats: ReturnType<typeof computeStats>;
  target: { name: string; level: number; hp: number; maxHp: number; elite: boolean; dead: boolean } | null;
  cooldowns: { remaining: number; total: number }[];
  gcd: number;
  cast: { name: string; progress: number; color: string } | null;
  buffs: { id: string; name: string; icon: string; remaining: number }[];
  zone: number; pos: [number, number]; facing: number;
  inventory: (InvSlot | null)[]; equipment: Equipment;
  quick: InvSlot[];
  loot: { items: InvSlot[]; gold: number; name: string } | null;
  vendor: number | null;
  dead: boolean; inCombat: boolean;
  interactHint: string | null;
  objectives: Objective[];
}

export interface EngineCallbacks {
  onSnapshot: (s: HudSnapshot) => void;
  onLog: (msg: string, color?: string) => void;
  onZone: (zone: number) => void;
  onSave: (data: Partial<PlayerRecord> & { inventory: string; equipment: string }) => void;
  onReady: () => void;
  onProgress: (msg: string, pct: number) => void;
}

interface Dot { remaining: number; tick: number; dmg: number; color: string }
interface Mob {
  id: number; def: MobDef; level: number; hp: number; maxHp: number; zone: number;
  model: Model | null; obj: THREE.Group;
  pos: THREE.Vector3; spawn: THREE.Vector3; facing: number;
  state: "idle" | "wander" | "chase" | "return" | "dead";
  wander: THREE.Vector3 | null; wanderT: number; attackCd: number;
  anim: AnimState; respawnAt: number;
  loot: { items: InvSlot[]; gold: number } | null;
  slowT: number; rootT: number; stunT: number; dots: Dot[];
  plate: HTMLDivElement | null; sparkle: THREE.Mesh | null;
}
interface Projectile { mesh: THREE.Object3D; target: Mob | "player"; speed: number; color: THREE.Color; onHit: () => void; size: number }
interface Buff { id: string; name: string; icon: string; kind: "dmg" | "dr" | "speed"; mult: number; t: number }

const BUFF_DUR: Record<string, number> = { shout: 15, rapid: 12, felarmor: 15, divine: 8, barrier: 10, sprint: 8 };
const tmpV = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class GameEngine {
  private container: HTMLElement;
  private overlay: HTMLElement;
  private cb: EngineCallbacks;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private raf = 0;
  private disposed = false;
  private time = 0;
  private lastFrame = 0;

  // world
  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  private skyU!: ReturnType<typeof buildSky>["uniforms"];
  private sky!: THREE.Mesh;
  private veg!: ReturnType<typeof buildVegetation>;
  private grass!: ReturnType<typeof buildGrass>;
  private water!: ReturnType<typeof buildWater>;
  private towns!: ReturnType<typeof buildTowns>;
  private colliderGrid = new Map<string, Collider[]>();
  private fx!: Particles;
  private rings!: Rings;
  private mapCanvas!: HTMLCanvasElement;
  private minimap: HTMLCanvasElement | null = null;

  // player
  private rec: PlayerRecord;
  private race: RaceDef;
  private cls: ClassDef;
  private model!: Model;
  private fbxModel: FBXModel | null = null;
  private pObj = new THREE.Group();
  private pos = new THREE.Vector3();
  private vy = 0;
  private onGround = true;
  private facing = 0;
  private anim: AnimState = { speed: 0, action: null, actionT: 0, dead: false, deadT: 0 };
  private level = 1;
  private xp = 0;
  private gold = 0;
  private kills = 0;
  private hp = 100;
  private res = 0;
  private stats!: ReturnType<typeof computeStats>;
  private inventory: (InvSlot | null)[] = [];
  private equipment: Equipment = {};
  private cooldowns: number[] = [0, 0, 0, 0, 0];
  private gcd = 0;
  private potionCd = 0;
  private casting: { ab: AbilityDef; idx: number; t: number; total: number; target: Mob | null } | null = null;
  private buffs: Buff[] = [];
  private swingT = 0;
  private autoAttack = false;
  private lastCombat = -100;
  private dead = false;
  private dash: { to: THREE.Vector3; t: number } | null = null;
  private currentZone = -1;
  private objectives: Objective[] = [];
  private beam: { mesh: THREE.Mesh; t: number } | null = null;

  // mobs & npcs
  private mobs: Mob[] = [];
  private target: Mob | null = null;
  private projectiles: Projectile[] = [];
  private vendors: { model: Model; pos: THREE.Vector3; zone: number; coin: THREE.Mesh; plate: HTMLDivElement }[] = [];
  private openLoot: Mob | null = null;
  private openVendor: number | null = null;

  // input / camera
  private keys = new Set<string>();
  private camYaw = 0;
  private camPitch = 0.32;
  private camDist = 11;
  private drag: { x: number; y: number; moved: number; button: number } | null = null;
  private raycaster = new THREE.Raycaster();
  private saveTimer = 15;
  private dirty = false;
  private snapT = 0;
  private playerPlate: HTMLDivElement | null = null;

  constructor(container: HTMLElement, overlay: HTMLElement, rec: PlayerRecord, cb: EngineCallbacks) {
    this.container = container;
    this.overlay = overlay;
    this.rec = rec;
    this.cb = cb;
    this.race = RACES.find((r) => r.id === rec.race) ?? RACES[0];
    this.cls = CLASSES.find((c) => c.id === rec.class_name) ?? CLASSES[0];
  }

  // =========================================================================
  // Init
  // =========================================================================
  async init() {
    const step = async (msg: string, pct: number) => {
      this.cb.onProgress(msg, pct);
      await new Promise((r) => setTimeout(r, 16));
      if (this.disposed) throw new Error("disposed");
    };
    console.log("[Engine] init", this.rec.username, this.race.id, this.cls.id, "graphics:", this.rec.graphics);
    await step("Preparando el renderizador…", 5);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    const graphics = this.rec.graphics ?? "normal";
    const pixelRatio = graphics === "low" ? 0.3 : graphics === "high" ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 1.5);
    this.renderer.setPixelRatio(pixelRatio);
    if (!this.container) throw new Error("Container is null");
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = graphics !== "low";
    this.renderer.shadowMap.type = graphics === "high" ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(58, this.container.clientWidth / this.container.clientHeight, 0.2, 5000);

    this.scene.fog = new THREE.Fog("#0d2a33", 40, 260);
    this.hemi = new THREE.HemisphereLight("#9fd8ff", "#203030", 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight("#ffffff", 2);
    this.sun.castShadow = graphics !== "low";
    const shadowSize = graphics === "high" ? 4096 : graphics === "low" ? 1024 : 2048;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);

    await step("Esculpiendo montañas y valles…", 15);
    const terrain = buildTerrain();
    this.scene.add(terrain.mesh);
    this.buildMapCanvas(terrain.mesh.geometry);

    await step("Llenando lagos y ríos de lava…", 35);
    this.water = buildWater(this.scene, terrain.normalTex);
    const sky = buildSky(this.scene);
    this.skyU = sky.uniforms;
    this.sky = sky.sky;

    await step("Plantando bosques ancestrales…", 45);
    this.veg = buildVegetation(this.scene);
    this.grass = buildGrass(this.scene);

    await step("Levantando aldeas…", 65);
    this.towns = buildTowns(this.scene);
    for (const c of [...this.veg.colliders, ...this.towns.colliders]) {
      const k = `${Math.floor(c.x / 20)},${Math.floor(c.z / 20)}`;
      let arr = this.colliderGrid.get(k);
      if (!arr) this.colliderGrid.set(k, (arr = []));
      arr.push(c);
    }
    this.fx = new Particles(this.scene, 7000);
    this.rings = new Rings(this.scene);

    await step("Despertando a las criaturas…", 78);
    this.spawnMobs();
    this.spawnVendors();

    await step("Forjando a tu héroe…", 90);
    await this.setupPlayer();

    // post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (graphics !== "low") {
      const bloomStrength = graphics === "high" ? 0.7 : 0.55;
      const bloom = new UnrealBloomPass(new THREE.Vector2(this.container.clientWidth / 2, this.container.clientHeight / 2), bloomStrength, 0.5, 0.82);
      this.composer.addPass(bloom);
    }
    this.composer.addPass(new OutputPass());

    this.bindInput();
    await step("¡Bienvenido!", 100);
    this.lastFrame = performance.now();
    this.loop();
    this.cb.onReady();
    console.log("[Engine] ready. Mobs:", this.mobs.length);
  }

  private buildMapCanvas(geo: THREE.BufferGeometry) {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const c = geo.attributes.color as THREE.BufferAttribute;
    const n = geo.attributes.normal as THREE.BufferAttribute;
    const W = 801, H = 271;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d")!;
    const img = ctx.createImageData(W, H);
    const light = new THREE.Vector3(-0.5, 0.8, -0.4).normalize();
    for (let i = 0; i < p.count; i++) {
      const h = p.getY(i);
      const shade = 0.55 + Math.max(0, n.getX(i) * light.x + n.getY(i) * light.y + n.getZ(i) * light.z) * 0.75;
      let r = c.getX(i), g = c.getY(i), b = c.getZ(i);
      const x = p.getX(i), z = p.getZ(i);
      if (h < 0 && x < 420) { r = 0.1; g = 0.25; b = 0.35; }
      for (const l of LAKES) if (l.lava && Math.hypot(x - l.x, z - l.z) < l.r * 1.2 && h < 0.3) { r = 1; g = 0.35; b = 0.05; }
      const o = i * 4;
      img.data[o] = Math.min(255, Math.pow(r, 1 / 2.2) * 255 * shade);
      img.data[o + 1] = Math.min(255, Math.pow(g, 1 / 2.2) * 255 * shade);
      img.data[o + 2] = Math.min(255, Math.pow(b, 1 / 2.2) * 255 * shade);
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.mapCanvas = cv;
  }

  getMapDataURL() {
    return this.mapCanvas?.toDataURL("image/jpeg", 0.85) ?? "";
  }

  setMinimap(c: HTMLCanvasElement | null) {
    this.minimap = c;
  }

  // =========================================================================
  // Player
  // =========================================================================
  private async setupPlayer() {
    this.level = this.rec.level ?? 1;
    this.xp = this.rec.xp ?? 0;
    this.gold = this.rec.gold ?? 0;
    this.kills = this.rec.kills ?? 0;
    let inv: (InvSlot | null)[] = [];
    let eq: Equipment = {};
    try { inv = this.rec.inventory ? JSON.parse(this.rec.inventory) : []; } catch (e) { console.error("[Engine] bad inventory json", e); }
    try { eq = this.rec.equipment ? JSON.parse(this.rec.equipment) : {}; } catch (e) { console.error("[Engine] bad equipment json", e); }
    const fresh = !this.rec.inventory && !this.rec.equipment;
    if (fresh) {
      const items = [...this.cls.startItems];
      for (const id of items) {
        const it = ITEMS[id];
        if (it && it.type !== "consumable" && it.type !== "junk" && !eq[it.type as Slot]) eq[it.type as Slot] = id;
        else this.addToInv(id, 1, inv);
      }
      this.dirty = true;
      this.saveTimer = 2;
    }
    this.inventory = Array.from({ length: INVENTORY_SIZE }, (_, i) => inv[i] ?? null);
    this.equipment = eq;
    this.recalc();
    this.hp = this.stats.maxHp;
    this.res = this.cls.resource === "Ira" ? 0 : this.stats.maxRes;

    // Use saved position if available, otherwise spawn in zone 1 (Valle de Ventormenta)
    const zone = ZONES[1];
    const x = this.rec.pos_x ?? zone.spawn[0];
    const z = this.rec.pos_z ?? zone.spawn[1] + 8;
    this.pos.set(x, heightAt(x, z), z);

    // Load FBX model for player
    try {
      const primaryColor = this.race.skin;
      const secondaryColor = this.cls.armor;
      this.fbxModel = await loadClassModel(this.cls.id, primaryColor, secondaryColor);
      this.pObj.add(this.fbxModel.root);
      
      // Scale the model based on race
      const scale = this.race.scale * 0.92;
      this.fbxModel.root.scale.setScalar(scale);
      
      // Store animation mixer reference
      this.model = {
        root: this.fbxModel.root,
        height: 1.95 * scale,
        radius: 0.6 * scale,
        animate: (dt: number, t: number, s: AnimState) => {
          // Update FBX animation mixer
          if (this.fbxModel) {
            this.fbxModel.mixer.update(dt);

            // Determine animation state
            let animState = "idle";
            if (s.dead) {
              animState = "death";
            } else if (s.action === "hit") {
              animState = "hit";
            } else if (s.action === "attack") {
              animState = "attack";
            } else if (s.action === "cast" || s.action === "channel") {
              animState = "attack"; // Use attack animation for casting until we have magic animations
            } else if (s.speed > 0.1) {
              animState = s.speed > 0.7 ? "run" : "walk";
            }

            // Set animation based on state
            setAnimationByState(this.fbxModel, animState, s.speed);
          }
        },
        dispose: () => {
          if (this.fbxModel) {
            // Don't dispose FBX model here as it's managed by the loader
          }
        },
      };
    } catch (e) {
      console.error("[Engine] Failed to load FBX model, falling back to procedural:", e);
      this.model = buildPlayerModel(this.race, this.cls);
      this.pObj.add(this.model.root);
    }

    this.scene.add(this.pObj);
    this.camYaw = Math.PI; // look toward +z... start facing north-ish
    this.facing = 0;
    this.loadObjectives();
    this.playerPlate = this.makePlate(this.rec.username, "#7fd0ff", false);
  }

  private recalc() {
    this.stats = computeStats(this.race, this.cls, this.level, this.equipment);
    this.hp = Math.min(this.hp, this.stats.maxHp);
    this.res = Math.min(this.res, this.stats.maxRes);
  }

  private addToInv(id: string, qty: number, inv = this.inventory): boolean {
    const it = ITEMS[id];
    if (!it) return false;
    const stackable = it.type === "consumable" || it.type === "junk";
    if (stackable) {
      const s = inv.find((x) => x && x.id === id && x.qty < 20);
      if (s) { s.qty += qty; return true; }
    }
    const size = inv === this.inventory ? INVENTORY_SIZE : INVENTORY_SIZE;
    for (let i = 0; i < size; i++) {
      if (!inv[i]) { inv[i] = { id, qty }; return true; }
    }
    return false;
  }

  private markDirty(soon = false) {
    this.dirty = true;
    if (soon) this.saveTimer = Math.min(this.saveTimer, 1.5);
  }

  saveNow() {
    this.dirty = false;
    this.saveTimer = 15;
    this.cb.onSave({
      level: this.level, xp: Math.round(this.xp), gold: this.gold, kills: this.kills,
      zone: ZONES[Math.max(0, this.currentZone)].name,
      pos_x: Math.round(this.pos.x * 10) / 10, pos_z: Math.round(this.pos.z * 10) / 10,
      inventory: JSON.stringify(this.inventory), equipment: JSON.stringify(this.equipment),
    });
  }

  // =========================================================================
  // Objectives (persisted locally per character)
  // =========================================================================
  private objKey() { return `fr_obj_${this.rec._id}`; }
  private loadObjectives() {
    let saved: Record<string, { count: number; done: boolean }> = {};
    try { saved = JSON.parse(localStorage.getItem(this.objKey()) ?? "{}"); } catch { saved = {}; }
    this.objectives = [];
    ZONES.forEach((z) => {
      for (const m of z.mobs) {
        const def = MOBS[m.id];
        const need = def.elite ? 1 : 8;
        const s = saved[m.id];
        this.objectives.push({ key: m.id, name: def.elite ? `Derrota a ${def.name}` : `Caza: ${def.name}`, count: s?.count ?? 0, need, done: s?.done ?? false, zone: z.id });
      }
    });
  }
  private progressObjective(mobId: string) {
    const o = this.objectives.find((x) => x.key === mobId);
    if (!o || o.done) return;
    o.count = Math.min(o.need, o.count + 1);
    if (o.count >= o.need) {
      o.done = true;
      const xp = Math.round(xpForLevel(this.level) * (MOBS[mobId].elite ? 0.6 : 0.25));
      const gold = (o.zone + 1) * (MOBS[mobId].elite ? 50 : 10);
      this.gold += gold;
      this.cb.onLog(`✔ Objetivo completado: ${o.name} (+${xp} PE, +${gold} oro)`, "#ffd100");
      this.gainXp(xp);
    }
    const data: Record<string, { count: number; done: boolean }> = {};
    for (const x of this.objectives) data[x.key] = { count: x.count, done: x.done };
    localStorage.setItem(this.objKey(), JSON.stringify(data));
  }

  // =========================================================================
  // Mobs / NPCs
  // =========================================================================
  private spawnMobs() {
    const rand = mulberry32(99);
    let id = 0;
    for (const zone of ZONES) {
      for (const m of zone.mobs) {
        const def = MOBS[m.id];
        for (let i = 0; i < m.count; i++) {
          let x = 0, z = 0;
          if (def.elite) [x, z] = BOSS_SPOTS[zone.id];
          else {
            for (let t = 0; t < 40; t++) {
              x = zone.x0 + 50 + rand() * (zone.x1 - zone.x0 - 100);
              z = -330 + rand() * 660;
              const h = heightAt(x, z);
              const town = Math.hypot(x - zone.spawn[0], z - zone.spawn[1]);
              if (town > 85 && !isBlockedForProps(x, z, -6) && h > 0.8 && h < 55) break;
            }
          }
          const dist = Math.hypot(x - zone.spawn[0], z - zone.spawn[1]);
          const lt = Math.min(1, dist / 420);
          const level = Math.round(def.level[0] + (def.level[1] - def.level[0]) * Math.min(1, lt + rand() * 0.3));
          const maxHp = Math.round(def.hp * (1 + (level - def.level[0]) * 0.18));
          const p = new THREE.Vector3(x, heightAt(x, z), z);
          const obj = new THREE.Group();
          obj.position.copy(p);
          obj.userData.mobId = id;
          this.mobs.push({
            id: id++, def, level, hp: maxHp, maxHp, zone: zone.id, model: null, obj, pos: p.clone(), spawn: p.clone(),
            facing: rand() * 6.28, state: "idle", wander: null, wanderT: rand() * 5, attackCd: 0,
            anim: { speed: 0, action: null, actionT: 0, dead: false, deadT: 0 }, respawnAt: 0, loot: null,
            slowT: 0, rootT: 0, stunT: 0, dots: [], plate: null, sparkle: null,
          });
        }
      }
    }
  }

  private spawnVendors() {
    for (const z of ZONES) {
      const model = buildVendor();
      const [x, zz] = z.vendor;
      const pos = new THREE.Vector3(x, heightAt(x, zz), zz);
      model.root.position.copy(pos);
      model.root.rotation.y = Math.atan2(z.spawn[0] - x, z.spawn[1] - zz);
      this.scene.add(model.root);
      // stall
      const stall = new THREE.Group();
      const wood = new THREE.MeshStandardMaterial({ color: "#6a4a2a", roughness: 0.8 });
      const cloth = new THREE.MeshStandardMaterial({ color: ["#2a6a8a", "#a8322a", "#4a2a6a"][z.id], roughness: 0.9, side: THREE.DoubleSide });
      const table = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1, 1.2), wood);
      table.position.set(0, 0.5, 1.2);
      stall.add(table);
      for (const sx of [-1.7, 1.7]) for (const sz of [0.6, 1.8]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3), wood);
        pole.position.set(sx, 1.5, sz);
        stall.add(pole);
      }
      const roof = new THREE.Mesh(new THREE.PlaneGeometry(4, 2, 1, 1), cloth);
      roof.position.set(0, 3, 1.2);
      roof.rotation.x = -Math.PI / 2 + 0.25;
      stall.add(roof);
      stall.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
      stall.position.copy(pos);
      stall.rotation.y = model.root.rotation.y;
      this.scene.add(stall);
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 0.08, 24),
        new THREE.MeshStandardMaterial({ color: "#ffd100", emissive: new THREE.Color("#ffb000"), emissiveIntensity: 1.5, metalness: 0.9, roughness: 0.3 })
      );
      coin.rotation.x = Math.PI / 2;
      coin.position.copy(pos).add(new THREE.Vector3(0, 2.7, 0));
      this.scene.add(coin);
      const plate = this.makePlate("Mercader Aldric", "#ffd100", false, "<Provisiones y equipo>");
      this.vendors.push({ model, pos, zone: z.id, coin, plate });
    }
  }

  private makePlate(name: string, color: string, withBar: boolean, sub?: string) {
    const d = document.createElement("div");
    d.style.cssText = "position:absolute;transform:translate(-50%,-100%);pointer-events:none;text-align:center;white-space:nowrap;font-family:var(--font-heading),serif;font-weight:700;font-size:12px;text-shadow:0 1px 2px #000,0 0 4px #000;display:none;";
    d.innerHTML = `<div class="pl-name" style="color:${color}">${name}</div>${sub ? `<div style="color:#ddd;font-size:10px;font-weight:400">${sub}</div>` : ""}${withBar ? `<div style="width:84px;height:7px;margin:2px auto 0;background:#000a;border:1px solid #000;border-radius:2px;overflow:hidden"><div class="pl-bar" style="height:100%;width:100%;background:linear-gradient(#e33,#901)"></div></div>` : ""}`;
    this.overlay.appendChild(d);
    return d;
  }

  private ensureModel(m: Mob) {
    if (m.model) return;
    m.model = buildMobModel(m.def);
    m.obj.add(m.model.root);
    this.scene.add(m.obj);
    const lvlColor = this.mobColor(m);
    m.plate = this.makePlate(`${m.def.elite ? "☠ " : ""}${m.def.name}`, lvlColor, true);
    const lvl = document.createElement("div");
    lvl.className = "pl-lvl";
    lvl.style.cssText = "font-size:10px;color:#fff;font-weight:400";
    lvl.textContent = `Nivel ${m.level}${m.def.elite ? " · Élite" : ""}`;
    m.plate.insertBefore(lvl, m.plate.firstChild);
  }

  private disposeModel(m: Mob) {
    if (!m.model) return;
    m.obj.remove(m.model.root);
    m.model.dispose();
    m.model = null;
    this.scene.remove(m.obj);
    m.plate?.remove();
    m.plate = null;
    if (m.sparkle) { this.scene.remove(m.sparkle); m.sparkle = null; }
  }

  private mobColor(m: Mob) {
    const d = m.level - this.level;
    if (d >= 5) return "#ff2020";
    if (d >= 3) return "#ff8040";
    if (d >= -2) return "#ffff00";
    if (d >= -4) return "#40ff40";
    return "#9d9d9d";
  }

  // =========================================================================
  // Input
  // =========================================================================
  private onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    const k = e.key.toLowerCase();
    if (k === "tab") { e.preventDefault(); this.tabTarget(); return; }
    if (k === " ") e.preventDefault();
    this.keys.add(k);
    if (k >= "1" && k <= "5") this.useAbility(Number(k) - 1);
    if (k >= "6" && k <= "9") this.useQuick(Number(k) - 6);
    if (k === "f") this.interact();
    if (k === "escape") { this.target = null; this.autoAttack = false; this.openLoot = null; this.openVendor = null; }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private onPointerDown = (e: PointerEvent) => {
    this.drag = { x: e.clientX, y: e.clientY, moved: 0, button: e.button };
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.drag.moved += Math.abs(dx) + Math.abs(dy);
    this.drag.x = e.clientX; this.drag.y = e.clientY;
    this.camYaw -= dx * 0.006;
    this.camPitch = Math.max(-0.15, Math.min(1.3, this.camPitch + dy * 0.005));
    if (this.drag.button === 2) this.facing = this.camYaw + Math.PI;
  };
  private onPointerUp = (e: PointerEvent) => {
    if (this.drag && this.drag.moved < 6 && e.target === this.renderer.domElement) this.clickSelect(e);
    this.drag = null;
  };
  private onWheel = (e: WheelEvent) => {
    this.camDist = Math.max(3.5, Math.min(30, this.camDist + e.deltaY * 0.01));
  };
  private onResize = () => {
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  private onContext = (e: Event) => e.preventDefault();

  private bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("wheel", this.onWheel, { passive: true });
    this.renderer.domElement.addEventListener("contextmenu", this.onContext);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("blur", () => this.keys.clear());
  }

  private clickSelect(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const objs = this.mobs.filter((m) => m.model && m.obj.visible).map((m) => m.obj);
    const vendorObjs = this.vendors.map((v) => v.model.root);
    const hits = this.raycaster.intersectObjects([...objs, ...vendorObjs], true);
    if (!hits.length) return;
    let o: THREE.Object3D | null = hits[0].object;
    while (o && o.userData.mobId === undefined && !vendorObjs.includes(o as THREE.Group)) o = o.parent;
    if (!o) return;
    if (o.userData.mobId !== undefined) {
      const m = this.mobs[o.userData.mobId as number];
      if (m.state === "dead") {
        if (m.loot && m.pos.distanceTo(this.pos) < 7) this.openLoot = m;
        else if (m.loot) this.cb.onLog("Estás demasiado lejos para saquear.", "#ff5050");
        return;
      }
      this.target = m;
      if (e.button === 2) this.autoAttack = true;
    } else {
      const v = this.vendors.find((x) => x.model.root === o);
      if (v && v.pos.distanceTo(this.pos) < 8) this.openVendor = v.zone;
      else if (v) this.cb.onLog("Acércate al mercader para comerciar.", "#ffd100");
    }
  }

  private tabTarget() {
    const cands = this.mobs
      .filter((m) => m.state !== "dead" && m.model && m.pos.distanceTo(this.pos) < 45)
      .sort((a, b) => a.pos.distanceTo(this.pos) - b.pos.distanceTo(this.pos));
    if (!cands.length) return;
    const idx = this.target ? cands.indexOf(this.target) : -1;
    this.target = cands[(idx + 1) % cands.length];
  }

  interact() {
    if (this.dead) return;
    const corpse = this.mobs
      .filter((m) => m.state === "dead" && m.loot && m.pos.distanceTo(this.pos) < 7)
      .sort((a, b) => a.pos.distanceTo(this.pos) - b.pos.distanceTo(this.pos))[0];
    if (corpse) { this.openLoot = corpse; return; }
    const v = this.vendors.find((x) => x.pos.distanceTo(this.pos) < 8);
    if (v) { this.openVendor = v.zone; return; }
  }

  // =========================================================================
  // Combat
  // =========================================================================
  private dmgMult() {
    let m = 1;
    for (const b of this.buffs) if (b.kind === "dmg") m *= b.mult;
    return m;
  }
  private drMult() {
    let m = 1;
    for (const b of this.buffs) if (b.kind === "dr") m *= b.mult;
    return m;
  }
  private speedMult() {
    let m = 1;
    for (const b of this.buffs) if (b.kind === "speed") m *= b.mult;
    return m;
  }

  private headPos(m: Mob) {
    return m.pos.clone().add(new THREE.Vector3(0, (m.model?.height ?? 1.5) * 0.65, 0));
  }
  private pChest() {
    return this.pos.clone().add(new THREE.Vector3(0, 1.3 * this.race.scale, 0));
  }

  private floatText(p: THREE.Vector3, text: string, color: string, size = 18) {
    const v = p.clone().project(this.camera);
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return;
    const d = document.createElement("div");
    d.className = "combat-text";
    d.textContent = text;
    d.style.left = `${(v.x * 0.5 + 0.5) * this.container.clientWidth + (Math.random() - 0.5) * 30}px`;
    d.style.top = `${(-v.y * 0.5 + 0.5) * this.container.clientHeight}px`;
    d.style.color = color;
    d.style.fontSize = `${size}px`;
    this.overlay.appendChild(d);
    setTimeout(() => d.remove(), 1300);
  }

  useAbility(idx: number) {
    const ab = this.cls.abilities[idx];
    if (!ab || this.dead) return;
    if (this.casting) return;
    if (this.cooldowns[idx] > 0) { this.cb.onLog(`${ab.name} aún no está lista.`, "#ff5050"); return; }
    if (this.gcd > 0) return;
    if (this.res < ab.cost) { this.cb.onLog(`No tienes suficiente ${this.cls.resource.toLowerCase()}.`, "#ff5050"); return; }
    const needsTarget = ab.kind === "melee" || ab.kind === "projectile" || ab.kind === "dot" || (ab.kind === "aoe" && ab.range > 9);
    let t = this.target && this.target.state !== "dead" ? this.target : null;
    if (needsTarget && !t) {
      this.tabTarget();
      t = this.target && this.target.state !== "dead" ? this.target : null;
      if (!t) { this.cb.onLog("No tienes objetivo.", "#ff5050"); return; }
    }
    if (needsTarget && t) {
      const d = t.pos.distanceTo(this.pos) - (t.model?.radius ?? 0.8);
      if (d > ab.range) { this.cb.onLog("Fuera de alcance.", "#ff5050"); return; }
      if (ab.id === "charge" && d < 7) { this.cb.onLog("Demasiado cerca para cargar.", "#ff5050"); return; }
      this.autoAttack = true;
    }
    if (ab.castTime) {
      this.casting = { ab, idx, t: 0, total: ab.castTime, target: t };
      this.anim.action = "channel";
      this.anim.actionT = 0;
      this.gcd = 1;
      return;
    }
    this.execAbility(ab, idx, t);
  }

  private execAbility(ab: AbilityDef, idx: number, t: Mob | null) {
    this.res -= ab.cost;
    this.cooldowns[idx] = ab.cooldown;
    this.gcd = Math.max(this.gcd, 1);
    this.lastCombat = needsCombat(ab) ? this.time : this.lastCombat;
    const base = this.stats.attack * this.dmgMult();
    const col = new THREE.Color(ab.color);
    if (t) this.facing = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
    this.anim.action = ab.kind === "melee" ? "attack" : "cast";
    this.anim.actionT = 0;

    switch (ab.kind) {
      case "melee": {
        if (!t) return;
        if (ab.id === "charge") {
          const dir = t.pos.clone().sub(this.pos).setY(0).normalize();
          this.dash = { to: t.pos.clone().sub(dir.multiplyScalar((t.model?.radius ?? 1) + 1.2)), t: 0 };
          t.stunT = 1.5;
          this.res = Math.min(this.stats.maxRes, this.res + 20);
          this.fx.burst(this.pChest(), col, 30, 6, 0.6, 0.6);
        }
        this.hitMob(t, base * ab.power, ab.color);
        this.fx.burst(this.headPos(t), col, 24, 7, 0.5, 0.5, 6);
        break;
      }
      case "projectile": {
        if (!t) return;
        this.launch(t, col, ab.id === "fireball" || ab.id === "shadowbolt" ? 0.35 : 0.25, () => {
          const dmg = this.hitMob(t, base * ab.power, ab.color);
          if (ab.id === "frostbolt") t.slowT = 4;
          if (ab.id === "drain") this.heal(dmg * 0.6);
          this.fx.burst(this.headPos(t), col, 40, 9, 0.7, 0.6, 3);
        }, ab.id === "arcane_shot" || ab.id === "aimed" ? "arrow" : "orb");
        break;
      }
      case "dot": {
        if (!t) return;
        t.dots.push({ remaining: 6, tick: 1, dmg: (base * ab.power) / 6, color: ab.color });
        this.aggro(t);
        this.fx.burst(this.headPos(t), col, 30, 4, 0.5, 0.8);
        this.cb.onLog(`${ab.name} afecta a ${t.def.name}.`, ab.color);
        break;
      }
      case "aoe": {
        const center = ab.range > 9 && t ? t.pos.clone() : this.pos.clone();
        const radius = ab.range > 9 ? 8 : ab.range;
        this.rings.spawn(center, ab.color, radius, 0.6);
        this.rings.spawn(center, "#ffffff", radius * 0.7, 0.4);
        if (ab.range > 9) {
          for (let k = 0; k < 140; k++) {
            const p = center.clone().add(new THREE.Vector3((Math.random() - 0.5) * radius * 2, 12 + Math.random() * 8, (Math.random() - 0.5) * radius * 2));
            this.fx.emit(p, new THREE.Vector3(0, -22 - Math.random() * 10, 0), col, 0.9, 0.7);
          }
        } else {
          for (let k = 0; k < 90; k++) {
            const a = Math.random() * Math.PI * 2;
            this.fx.emit(center.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(Math.cos(a) * radius * 2, Math.random() * 2, Math.sin(a) * radius * 2), col, 0.7, 0.5);
          }
        }
        const delay = ab.range > 9 ? 450 : 0;
        setTimeout(() => {
          if (this.disposed) return;
          for (const m of this.mobs) {
            if (m.state === "dead" || !m.model) continue;
            if (m.pos.distanceTo(center) <= radius + m.model.radius) {
              this.hitMob(m, base * ab.power, ab.color);
              if (ab.id === "nova") m.rootT = 3;
            }
          }
        }, delay);
        break;
      }
      case "heal": {
        const amount = base * ab.power * 1.4;
        this.heal(amount);
        this.rings.spawn(this.pos, ab.color, 4, 0.8);
        for (let k = 0; k < 60; k++) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * 1.2;
          this.fx.emit(this.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.random() * 0.5, Math.sin(a) * r)), new THREE.Vector3(0, 3 + Math.random() * 3, 0), col, 0.6, 1.1);
        }
        break;
      }
      case "buff": {
        const kind: Buff["kind"] = ab.id === "divine" || ab.id === "barrier" ? "dr" : ab.id === "sprint" ? "speed" : "dmg";
        this.buffs = this.buffs.filter((b) => b.id !== ab.id);
        this.buffs.push({ id: ab.id, name: ab.name, icon: ab.icon, kind, mult: ab.power, t: BUFF_DUR[ab.id] ?? 10 });
        this.rings.spawn(this.pos, ab.color, 3, 0.6);
        this.fx.burst(this.pChest(), col, 50, 5, 0.6, 0.9, 0, 0.6);
        this.cb.onLog(`Obtienes ${ab.name}.`, ab.color);
        break;
      }
    }
  }

  private launch(t: Mob, color: THREE.Color, size: number, onHit: () => void, kind: "orb" | "arrow" = "orb") {
    let mesh: THREE.Object3D;
    if (kind === "arrow") {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.1, 6), new THREE.MeshStandardMaterial({ color: "#6b4523" }));
      shaft.rotation.x = Math.PI / 2;
      g.add(shaft);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), new THREE.MeshStandardMaterial({ color: "#ddd", emissive: color, emissiveIntensity: 2 }));
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.6;
      g.add(head);
      mesh = g;
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.5) }));
    }
    const start = this.model.weaponTip ? this.model.weaponTip.getWorldPosition(new THREE.Vector3()) : this.pChest();
    mesh.position.copy(start);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, target: t, speed: kind === "arrow" ? 55 : 32, color, onHit, size });
  }

  private aggro(m: Mob) {
    if (m.state === "dead") return;
    if (m.state !== "chase") {
      m.state = "chase";
      // social aggro: nearby same-type mobs join
      for (const o of this.mobs) if (o !== m && o.state !== "dead" && o.state !== "chase" && o.def.id === m.def.id && o.pos.distanceTo(m.pos) < 10) o.state = "chase";
    }
    this.lastCombat = this.time;
  }

  private hitMob(m: Mob, raw: number, color: string, noCrit = false): number {
    if (m.state === "dead") return 0;
    const crit = !noCrit && Math.random() < 0.08 + (this.stats.agi / 1000);
    let dmg = Math.max(1, Math.round(raw * (0.88 + Math.random() * 0.24) * (crit ? 2 : 1)));
    if (m.state === "return") dmg = 0; // evading
    m.hp -= dmg;
    this.aggro(m);
    if (this.cls.resource === "Ira") this.res = Math.min(this.stats.maxRes, this.res + 6);
    this.floatText(this.headPos(m).add(new THREE.Vector3(0, 0.6, 0)), dmg === 0 ? "Evadir" : crit ? `${dmg}!` : `${dmg}`, crit ? "#ffe14a" : color === "#ffffff" ? "#ffffff" : "#fff6d0", crit ? 30 : 20);
    if (m.hp <= 0) this.killMob(m);
    return dmg;
  }

  private heal(amount: number) {
    const a = Math.round(amount);
    this.hp = Math.min(this.stats.maxHp, this.hp + a);
    this.floatText(this.pChest().add(new THREE.Vector3(0, 1, 0)), `+${a}`, "#3dff6a", 22);
  }

  private killMob(m: Mob) {
    m.hp = 0;
    m.state = "dead";
    m.anim.dead = true;
    m.anim.deadT = 0;
    m.dots = [];
    m.respawnAt = this.time + (m.def.elite ? 240 : 50);
    this.kills++;
    // XP
    const diff = m.level - this.level;
    let xp = (18 + m.level * 11) * (m.def.elite ? 7 : 1);
    xp = diff <= -5 ? 0 : Math.round(xp * Math.max(0.2, Math.min(1.4, 1 + diff * 0.1)));
    if (xp > 0) {
      this.cb.onLog(`${m.def.name} muere. Ganas ${xp} puntos de experiencia.`, "#c080ff");
      this.floatText(this.headPos(m).add(new THREE.Vector3(0, 1.2, 0)), `+${xp} PE`, "#c080ff", 16);
      this.gainXp(xp);
    } else this.cb.onLog(`${m.def.name} muere.`, "#aaaaaa");
    // Loot
    const items: InvSlot[] = [];
    for (const l of m.def.loot) if (Math.random() < l.chance) items.push({ id: l.id, qty: 1 });
    const gold = Math.round((m.level * (1 + Math.random()) + 1) * (m.def.elite ? 15 : 1));
    m.loot = { items, gold };
    const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: "#ffe680" }));
    sp.position.copy(m.pos).add(new THREE.Vector3(0, 1.4, 0));
    this.scene.add(sp);
    m.sparkle = sp;
    if (items.some((i) => ["rare", "epic", "legendary"].includes(ITEMS[i.id]?.rarity))) {
      const best = items.map((i) => ITEMS[i.id]).sort((a, b) => b.value - a.value)[0];
      const beam = makeBeam(RARITY_COLOR[best.rarity], 10, 0.5);
      sp.add(beam);
      beam.position.y = -1.4;
    }
    this.fx.burst(this.headPos(m), m.def.accent, 40, 4, 0.5, 1.2, 2);
    this.progressObjective(m.def.id);
    if (this.target === m) this.autoAttack = false;
    this.markDirty();
  }

  private gainXp(xp: number) {
    if (this.level >= MAX_LEVEL) return;
    this.xp += xp;
    while (this.level < MAX_LEVEL && this.xp >= xpForLevel(this.level)) {
      this.xp -= xpForLevel(this.level);
      this.level++;
      this.recalc();
      this.hp = this.stats.maxHp;
      this.res = this.cls.resource === "Ira" ? this.res : this.stats.maxRes;
      this.cb.onLog(`¡Has alcanzado el nivel ${this.level}!`, "#ffd100");
      this.floatText(this.pChest().add(new THREE.Vector3(0, 1.5, 0)), `¡NIVEL ${this.level}!`, "#ffd100", 34);
      const beam = makeBeam("#ffd76a", 30, 1.6);
      beam.position.copy(this.pos);
      this.scene.add(beam);
      if (this.beam) this.scene.remove(this.beam.mesh);
      this.beam = { mesh: beam, t: 0 };
      this.rings.spawn(this.pos, "#ffd76a", 9, 1.2);
      this.fx.burst(this.pChest(), "#ffe28a", 160, 8, 0.8, 1.6, 0, 0.8);
      console.log("[Engine] level up", this.level);
      for (const m of this.mobs) if (m.plate) (m.plate.querySelector(".pl-name") as HTMLElement).style.color = this.mobColor(m);
    }
    this.markDirty(true);
  }

  private hurtPlayer(m: Mob) {
    if (this.dead) return;
    const raw = m.def.dmg * (1 + (m.level - m.def.level[0]) * 0.12) * (0.85 + Math.random() * 0.3);
    const dodge = Math.random() < 0.05 + this.stats.agi / 1500;
    if (dodge) { this.floatText(this.pChest().add(new THREE.Vector3(0, 0.8, 0)), "Esquivar", "#ffffff", 16); return; }
    const dmg = Math.max(1, Math.round(raw * (1 - this.stats.mitigation) * this.drMult()));
    this.hp -= dmg;
    this.lastCombat = this.time;
    if (this.cls.resource === "Ira") this.res = Math.min(this.stats.maxRes, this.res + 4);
    this.floatText(this.pChest().add(new THREE.Vector3(0, 0.8, 0)), `-${dmg}`, "#ff3b3b", 20);
    this.fx.burst(this.pChest(), "#aa0000", 10, 3, 0.35, 0.5, 8);
    if (this.casting && Math.random() < 0.3) this.casting.t = Math.max(0, this.casting.t - 0.3); // pushback
    // Play hit animation
    this.anim.action = "hit";
    this.anim.actionT = 0;
    if (this.hp <= 0) this.die();
  }

  private die() {
    this.hp = 0;
    this.dead = true;
    this.anim.dead = true;
    this.anim.deadT = 0;
    this.casting = null;
    this.autoAttack = false;
    this.cb.onLog("Has muerto.", "#ff3b3b");
    for (const m of this.mobs) if (m.state === "chase") m.state = "return";
  }

  releaseSpirit() {
    if (!this.dead) return;
    const z = ZONES[Math.max(0, this.currentZone)];
    this.pos.set(z.spawn[0], heightAt(z.spawn[0], z.spawn[1] + 8), z.spawn[1] + 8);
    this.dead = false;
    this.anim.dead = false;
    this.hp = Math.round(this.stats.maxHp * 0.6);
    this.res = this.cls.resource === "Ira" ? 0 : Math.round(this.stats.maxRes * 0.6);
    this.target = null;
    this.rings.spawn(this.pos, "#bfe9ff", 5, 1);
    this.fx.burst(this.pChest(), "#bfe9ff", 80, 5, 0.6, 1.2, 0, 0.5);
    this.cb.onLog("Tu espíritu regresa al cementerio de la aldea.", "#bfe9ff");
    this.markDirty(true);
  }

  // =========================================================================
  // Items
  // =========================================================================
  private quickList(): InvSlot[] {
    const seen = new Map<string, number>();
    for (const s of this.inventory) if (s && ITEMS[s.id]?.type === "consumable") seen.set(s.id, (seen.get(s.id) ?? 0) + s.qty);
    return [...seen.entries()].slice(0, 4).map(([id, qty]) => ({ id, qty }));
  }

  useQuick(n: number) {
    const q = this.quickList()[n];
    if (!q) return;
    const idx = this.inventory.findIndex((s) => s?.id === q.id);
    if (idx >= 0) this.useItem(idx);
  }

  useItem(idx: number) {
    const s = this.inventory[idx];
    if (!s || this.dead) return;
    const it = ITEMS[s.id];
    if (!it) return;
    if (it.type === "junk") { this.cb.onLog(`${it.name}: véndelo a un mercader.`, "#aaaaaa"); return; }
    if (it.type !== "consumable") { this.equip(idx); return; }
    if (this.potionCd > 0) { this.cb.onLog("Aún no puedes usar otro consumible.", "#ff5050"); return; }
    this.potionCd = 1.5;
    const e = it.effect ?? {};
    if (e.heal) this.heal(e.heal * (1 + this.level * 0.05));
    if (e.mana) {
      this.res = Math.min(this.stats.maxRes, this.res + e.mana);
      this.floatText(this.pChest().add(new THREE.Vector3(0, 1, 0)), `+${e.mana}`, "#4aa0ff", 20);
    }
    if (e.buff) {
      const kind = e.buff === "str" ? "dmg" : e.buff === "armor" ? "dr" : "speed";
      const mult = e.buff === "str" ? 1.3 : e.buff === "armor" ? 0.7 : 1.4;
      this.buffs = this.buffs.filter((b) => b.id !== it.id);
      this.buffs.push({ id: it.id, name: it.name, icon: it.icon, kind, mult, t: e.duration ?? 60 });
      this.cb.onLog(`Bebes ${it.name}.`, "#1eff00");
    }
    this.fx.burst(this.pChest(), e.mana && !e.heal ? "#4aa0ff" : "#3dff6a", 30, 3, 0.4, 0.9, 0, 0.6);
    s.qty--;
    if (s.qty <= 0) this.inventory[idx] = null;
    this.markDirty();
  }

  equip(idx: number) {
    const s = this.inventory[idx];
    if (!s) return;
    const it = ITEMS[s.id];
    if (!it || it.type === "consumable" || it.type === "junk") return;
    if (it.level > this.level) { this.cb.onLog(`Necesitas nivel ${it.level} para equipar ${it.name}.`, "#ff5050"); return; }
    const slot = it.type as Slot;
    const prev = this.equipment[slot];
    this.equipment[slot] = it.id;
    this.inventory[idx] = prev ? { id: prev, qty: 1 } : null;
    const hpPct = this.hp / this.stats.maxHp;
    this.recalc();
    this.hp = Math.round(this.stats.maxHp * hpPct);
    this.cb.onLog(`Equipas ${it.name}.`, RARITY_COLOR[it.rarity]);
    this.markDirty(true);
  }

  unequip(slot: Slot) {
    const id = this.equipment[slot];
    if (!id) return;
    if (!this.addToInv(id, 1)) { this.cb.onLog("Tu inventario está lleno.", "#ff5050"); return; }
    delete this.equipment[slot];
    this.recalc();
    this.markDirty(true);
  }

  destroyItem(idx: number) {
    const s = this.inventory[idx];
    if (!s) return;
    this.inventory[idx] = null;
    this.cb.onLog(`Destruyes ${ITEMS[s.id]?.name}.`, "#aaaaaa");
    this.markDirty();
  }

  lootItem(i: number) {
    const m = this.openLoot;
    if (!m?.loot) return;
    const it = m.loot.items[i];
    if (!it) return;
    if (!this.addToInv(it.id, it.qty)) { this.cb.onLog("Tu inventario está lleno.", "#ff5050"); return; }
    const def = ITEMS[it.id];
    this.cb.onLog(`Recibes botín: [${def.name}]`, RARITY_COLOR[def.rarity]);
    m.loot.items.splice(i, 1);
    this.checkLootEmpty(m);
    this.markDirty(true);
  }

  lootAll() {
    const m = this.openLoot;
    if (!m?.loot) return;
    if (m.loot.gold) {
      this.gold += m.loot.gold;
      this.cb.onLog(`Recibes ${m.loot.gold} de oro.`, "#ffd100");
      m.loot.gold = 0;
    }
    while (m.loot && m.loot.items.length) {
      const before = m.loot.items.length;
      this.lootItem(0);
      if (m.loot && m.loot.items.length === before) break;
    }
    this.checkLootEmpty(m);
    this.markDirty(true);
  }

  closeLoot() { this.openLoot = null; }
  closeVendor() { this.openVendor = null; }

  private checkLootEmpty(m: Mob) {
    if (m.loot && m.loot.items.length === 0 && m.loot.gold === 0) {
      m.loot = null;
      if (m.sparkle) { this.scene.remove(m.sparkle); m.sparkle = null; }
      if (this.openLoot === m) this.openLoot = null;
    }
  }

  buy(id: string) {
    const it = ITEMS[id];
    if (!it) return;
    const price = it.value * 4;
    if (this.gold < price) { this.cb.onLog("No tienes suficiente oro.", "#ff5050"); return; }
    if (!this.addToInv(id, 1)) { this.cb.onLog("Tu inventario está lleno.", "#ff5050"); return; }
    this.gold -= price;
    this.cb.onLog(`Compras ${it.name} por ${price} de oro.`, "#ffd100");
    this.markDirty(true);
  }

  sell(idx: number) {
    const s = this.inventory[idx];
    if (!s) return;
    const it = ITEMS[s.id];
    const g = it.value * s.qty;
    this.gold += g;
    this.inventory[idx] = null;
    this.cb.onLog(`Vendes ${it.name}${s.qty > 1 ? ` x${s.qty}` : ""} por ${g} de oro.`, "#ffd100");
    this.markDirty(true);
  }

  sellJunk() {
    let total = 0;
    this.inventory.forEach((s, i) => {
      if (s && ITEMS[s.id]?.type === "junk") { total += ITEMS[s.id].value * s.qty; this.inventory[i] = null; }
    });
    if (total) { this.gold += total; this.cb.onLog(`Vendes la chatarra por ${total} de oro.`, "#ffd100"); this.markDirty(true); }
  }

  isVendorOpen() { return this.openVendor !== null; }

  // =========================================================================
  // Main loop
  // =========================================================================
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dt;
    this.update(dt);
    this.composer.render();
  };

  private collide(x: number, z: number, r = 0.5): [number, number] {
    const cx = Math.floor(x / 20), cz = Math.floor(z / 20);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const arr = this.colliderGrid.get(`${cx + i},${cz + j}`);
      if (!arr) continue;
      for (const c of arr) {
        const dx = x - c.x, dz = z - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + r;
        if (d < min && d > 0.0001) { x = c.x + (dx / d) * min; z = c.z + (dz / d) * min; }
      }
    }
    return [x, z];
  }

  private update(dt: number) {
    const t = this.time;
    // ---- timers
    for (let i = 0; i < this.cooldowns.length; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    this.gcd = Math.max(0, this.gcd - dt);
    this.potionCd = Math.max(0, this.potionCd - dt);
    this.buffs = this.buffs.filter((b) => (b.t -= dt) > 0);
    const inCombat = t - this.lastCombat < 5;

    // ---- regen
    if (!this.dead) {
      if (!inCombat) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.025 * dt);
      const r = this.cls.resource;
      if (r === "Maná") this.res += this.stats.maxRes * (inCombat ? 0.012 : 0.05) * dt;
      else if (r === "Energía") this.res += 14 * dt;
      else if (r === "Foco") this.res += 9 * dt;
      else if (r === "Ira" && !inCombat) this.res -= 3 * dt;
      this.res = Math.max(0, Math.min(this.stats.maxRes, this.res));
    }

    // ---- movement
    let moving = false;
    if (!this.dead) {
      const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
      const right = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
      const dir = new THREE.Vector3();
      const k = this.keys;
      if (k.has("w") || k.has("arrowup")) dir.add(fwd);
      if (k.has("s") || k.has("arrowdown")) dir.sub(fwd);
      if (k.has("a") || k.has("arrowleft")) dir.sub(right);
      if (k.has("d") || k.has("arrowright")) dir.add(right);
      if (this.dash) {
        this.dash.t += dt;
        const step = this.dash.to.clone().sub(this.pos).setY(0);
        const d = step.length();
        if (d < 0.6 || this.dash.t > 0.8) this.dash = null;
        else {
          step.normalize().multiplyScalar(Math.min(d, 45 * dt));
          this.pos.x += step.x; this.pos.z += step.z;
          this.fx.emit(this.pChest(), new THREE.Vector3(0, 0.5, 0), new THREE.Color("#ff8844"), 0.6, 0.4);
        }
      } else if (dir.lengthSq() > 0) {
        moving = true;
        dir.normalize();
        const back = (k.has("s") || k.has("arrowdown")) && !(k.has("w") || k.has("arrowup"));
        const groundH = heightAt(this.pos.x, this.pos.z);
        const swimming = groundH < -1.3;
        const sp = 9.5 * this.speedMult() * (back ? 0.6 : 1) * (swimming ? 0.6 : 1);
        let nx = this.pos.x + dir.x * sp * dt, nz = this.pos.z + dir.z * sp * dt;
        // slope limit
        const nh = heightAt(nx, nz);
        const slope = (nh - groundH) / (sp * dt + 1e-5);
        if (slope > 1.25 && nh > 0) {
          // try sliding along one axis
          const hx = heightAt(nx, this.pos.z), hz = heightAt(this.pos.x, nz);
          if ((hx - groundH) / (sp * dt) < 1.25) nz = this.pos.z;
          else if ((hz - groundH) / (sp * dt) < 1.25) nx = this.pos.x;
          else { nx = this.pos.x; nz = this.pos.z; }
        }
        [nx, nz] = this.collide(nx, nz);
        this.pos.x = Math.max(-1185, Math.min(1185, nx));
        this.pos.z = Math.max(-385, Math.min(385, nz));
        const targetFacing = back ? Math.atan2(-dir.x, -dir.z) : Math.atan2(dir.x, dir.z);
        this.facing = lerpAngle(this.facing, targetFacing, Math.min(1, dt * 12));
        if (this.casting) { this.cb.onLog("Interrumpido.", "#ff5050"); this.casting = null; this.anim.action = null; }
        if (this.openVendor !== null) {
          const v = this.vendors.find((x) => x.zone === this.openVendor);
          if (v && v.pos.distanceTo(this.pos) > 10) this.openVendor = null;
        }
        if (this.openLoot && this.openLoot.pos.distanceTo(this.pos) > 9) this.openLoot = null;
      }
      // jump & gravity
      const gh = Math.max(heightAt(this.pos.x, this.pos.z), -1.3);
      if (this.keys.has(" ") && this.onGround) { this.vy = 9; this.onGround = false; }
      this.vy -= 26 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gh) { this.pos.y = gh; this.vy = 0; this.onGround = true; }
      else if (this.pos.y - gh > 0.3) this.onGround = false;
      // swimming visual sink
      if (heightAt(this.pos.x, this.pos.z) < -1.3) this.pos.y = -1.25;
    }

    // ---- casting
    if (this.casting) {
      this.casting.t += dt;
      if (this.casting.t >= this.casting.total) {
        const c = this.casting;
        this.casting = null;
        if (c.target && c.target.state === "dead") this.cb.onLog("El objetivo ha muerto.", "#ff5050");
        else this.execAbility(c.ab, c.idx, c.target);
      } else if (this.model.weaponTip && Math.random() < 0.7) {
        const p = this.model.weaponTip.getWorldPosition(new THREE.Vector3());
        this.fx.emit(p, new THREE.Vector3((Math.random() - 0.5), Math.random() * 1.5, (Math.random() - 0.5)), new THREE.Color(this.casting.ab.color), 0.45, 0.5);
      }
    }

    // ---- auto attack
    const tg = this.target;
    if (tg && tg.state !== "dead" && this.autoAttack && !this.dead && !this.casting) {
      const d = tg.pos.distanceTo(this.pos) - (tg.model?.radius ?? 0.8);
      const range = this.cls.attackRange;
      this.swingT -= dt;
      if (d <= range && this.swingT <= 0) {
        this.swingT = this.cls.weapon === "daggers" ? 1.3 : range > 5 ? 2.2 : 2.0;
        if (!moving) this.facing = Math.atan2(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z);
        this.anim.action = "attack";
        this.anim.actionT = 0;
        const base = this.stats.attack * this.dmgMult();
        if (range > 5) {
          const caster = this.cls.weapon !== "bow";
          this.launch(tg, new THREE.Color(caster ? (this.cls.id === "warlock" ? "#a64dff" : "#9fe8ff") : "#ffe7b0"), 0.15, () => this.hitMob(tg, base * (caster ? 0.7 : 1), "#ffffff"), caster ? "orb" : "arrow");
          if (this.cls.resource === "Foco") this.res = Math.min(this.stats.maxRes, this.res + 4);
        } else {
          setTimeout(() => { if (!this.disposed && tg.state !== "dead") { this.hitMob(tg, base, "#ffffff"); this.fx.burst(this.headPos(tg), "#ffeecc", 10, 4, 0.3, 0.3, 6); } }, 180);
        }
      }
    }
    if (this.anim.action) {
      this.anim.actionT += dt;
      if (this.anim.action !== "channel" && this.anim.action !== "hit" && this.anim.actionT > 0.55) this.anim.action = null;
      if (this.anim.action === "channel" && !this.casting) this.anim.action = null;
      if (this.anim.action === "hit" && this.anim.actionT > 0.4) this.anim.action = null;
    }
    if (this.anim.dead) this.anim.deadT += dt;

    // ---- player model
    this.anim.speed = THREE.MathUtils.lerp(this.anim.speed, moving ? 1 : 0, Math.min(1, dt * 10));
    this.anim.airborne = !this.onGround;
    this.pObj.position.copy(this.pos);
    this.pObj.rotation.y = this.facing;
    this.model.animate(dt, t, this.anim);
    if (this.beam) {
      this.beam.t += dt;
      this.beam.mesh.position.copy(this.pos);
      (this.beam.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.45 * (1 - this.beam.t / 2.5));
      if (this.beam.t > 2.5) { this.scene.remove(this.beam.mesh); this.beam = null; }
    }

    // ---- zone & atmosphere
    const zn = zoneAt(this.pos.x).id;
    if (zn !== this.currentZone) {
      this.currentZone = zn;
      this.cb.onZone(zn);
      this.markDirty();
    }
    this.updateAtmosphere();

    // ---- mobs
    this.updateMobs(dt, t);

    // ---- projectiles
    this.projectiles = this.projectiles.filter((p) => {
      const goal = p.target === "player" ? this.pChest() : this.headPos(p.target);
      const d = goal.clone().sub(p.mesh.position);
      const len = d.length();
      if (len < 0.7) {
        this.scene.remove(p.mesh);
        p.onHit();
        return false;
      }
      d.normalize();
      p.mesh.position.addScaledVector(d, Math.min(len, p.speed * dt));
      p.mesh.lookAt(goal);
      for (let i = 0; i < 2; i++) this.fx.emit(p.mesh.position, new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6), p.color, p.size * 3.2, 0.35);
      return true;
    });

    // ---- ambient particles
    this.ambientFx(dt);
    this.fx.update(dt);
    this.rings.update(dt);
    this.water.update(t);
    this.veg.update(this.pos.x, this.pos.z, 250);
    this.grass.update(this.pos.x, this.pos.z, t);
    for (const l of this.towns.lights) l.intensity = l.intensity * 0.9 + (l.color.r > 0.9 && l.color.g < 0.7 ? 50 + Math.random() * 25 : l.intensity) * 0.1;

    // ---- vendors
    for (const v of this.vendors) {
      const d = v.pos.distanceTo(this.pos);
      v.coin.rotation.z = t * 2;
      v.coin.position.y = v.pos.y + 2.7 + Math.sin(t * 2) * 0.1;
      if (d < 120) v.model.animate(dt, t, { speed: 0, action: null, actionT: 0, dead: false, deadT: 0 });
      this.placePlate(v.plate, v.pos.clone().add(new THREE.Vector3(0, 3.2, 0)), d < 60);
    }

    // ---- camera
    this.updateCamera(dt);
    this.placePlate(this.playerPlate, this.pos.clone().add(new THREE.Vector3(0, this.model.height + 0.5, 0)), this.camDist > 5);

    // ---- save & HUD
    this.saveTimer -= dt;
    if (this.saveTimer <= 0) {
      if (this.dirty) this.saveNow();
      else this.saveTimer = 15;
    }
    this.snapT -= dt;
    if (this.snapT <= 0) {
      this.snapT = 0.1;
      this.cb.onSnapshot(this.snapshot(inCombat));
      this.drawMinimap();
    }
  }

  private updateMobs(dt: number, t: number) {
    let built = 0;
    for (const m of this.mobs) {
      const dist = m.pos.distanceTo(this.pos);
      // respawn
      if (m.state === "dead" && t > m.respawnAt) {
        m.state = "idle";
        m.hp = m.maxHp;
        m.anim.dead = false;
        m.loot = null;
        if (m.sparkle) { this.scene.remove(m.sparkle); m.sparkle = null; }
        if (this.openLoot === m) this.openLoot = null;
        m.pos.copy(m.spawn);
        if (this.target === m) this.target = null;
      }
      if (dist > 230) {
        if (m.model) this.disposeModel(m);
        if (m.state === "chase") m.state = "return";
        if (m.state === "return") { m.pos.copy(m.spawn); m.state = "idle"; m.hp = m.maxHp; }
        continue;
      }
      if (!m.model) {
        if (dist > 190 || built >= 3) continue;
        this.ensureModel(m);
        built++;
      }
      const mm = m.model!;
      m.stunT = Math.max(0, m.stunT - dt);
      m.rootT = Math.max(0, m.rootT - dt);
      m.slowT = Math.max(0, m.slowT - dt);
      // DoTs
      for (const d of m.dots) {
        d.remaining -= dt;
        d.tick -= dt;
        if (d.tick <= 0) {
          d.tick = 1;
          this.hitMob(m, d.dmg, d.color, true);
          this.fx.burst(this.headPos(m), d.color, 12, 2, 0.4, 0.6);
        }
      }
      m.dots = m.dots.filter((d) => d.remaining > 0 && m.state !== "dead");

      let moveSpeed = 0;
      let goal: THREE.Vector3 | null = null;
      if (m.state === "dead") {
        m.anim.deadT += dt;
        if (m.sparkle) {
          m.sparkle.rotation.y = t * 2;
          m.sparkle.position.y = m.pos.y + 1.4 + Math.sin(t * 3) * 0.15;
          if (Math.random() < 0.3) this.fx.emit(m.sparkle.position, new THREE.Vector3((Math.random() - 0.5), 1 + Math.random(), (Math.random() - 0.5)), new THREE.Color("#ffe680"), 0.35, 0.8);
        }
      } else {
        const aggroR = m.def.elite ? 20 : 14;
        if ((m.state === "idle" || m.state === "wander") && !this.dead && dist < aggroR && m.level >= this.level - 5) this.aggro(m);
        if (m.state === "idle" || m.state === "wander") {
          m.wanderT -= dt;
          if (m.wanderT <= 0) {
            m.wanderT = 4 + Math.random() * 6;
            if (Math.random() < 0.6 && !m.def.elite) {
              const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 12;
              m.wander = m.spawn.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
              m.state = "wander";
            } else { m.wander = null; m.state = "idle"; }
          }
          if (m.state === "wander" && m.wander) {
            goal = m.wander;
            moveSpeed = m.def.speed * 0.3;
            if (m.pos.distanceTo(m.wander) < 1) { m.state = "idle"; m.wander = null; }
          }
        } else if (m.state === "chase") {
          this.lastCombat = t;
          if (this.dead || m.pos.distanceTo(m.spawn) > (m.def.elite ? 60 : 80)) {
            m.state = "return";
          } else {
            const reach = mm.radius + 1.3;
            if (dist > reach) { goal = this.pos; moveSpeed = m.def.speed * (m.slowT > 0 ? 0.5 : 1); }
            else {
              m.facing = lerpAngle(m.facing, Math.atan2(this.pos.x - m.pos.x, this.pos.z - m.pos.z), Math.min(1, dt * 8));
              m.attackCd -= dt;
              if (m.attackCd <= 0 && m.stunT <= 0) {
                m.attackCd = m.def.elite ? 1.8 : 2.0;
                m.anim.action = "attack";
                m.anim.actionT = 0;
                setTimeout(() => {
                  if (!this.disposed && m.state === "chase" && m.pos.distanceTo(this.pos) < reach + 1.5) {
                    this.hurtPlayer(m);
                    if (m.def.elite) {
                      this.rings.spawn(m.pos, m.def.accent, 5, 0.5);
                      this.fx.burst(this.pos.clone().add(new THREE.Vector3(0, 1, 0)), m.def.accent, 25, 6, 0.6, 0.5, 4);
                    }
                  }
                }, 250);
              }
            }
          }
        } else if (m.state === "return") {
          goal = m.spawn;
          moveSpeed = m.def.speed * 1.3;
          m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.5 * dt);
          if (m.pos.distanceTo(m.spawn) < 1.5) { m.state = "idle"; m.hp = m.maxHp; m.dots = []; }
        }
        if (m.stunT > 0 || m.rootT > 0) moveSpeed = 0;
        if (goal && moveSpeed > 0) {
          const d = goal.clone().sub(m.pos).setY(0);
          const len = d.length();
          if (len > 0.05) {
            d.normalize();
            m.pos.addScaledVector(d, Math.min(len, moveSpeed * dt));
            m.facing = lerpAngle(m.facing, Math.atan2(d.x, d.z), Math.min(1, dt * 8));
          }
        }
        m.pos.y = Math.max(heightAt(m.pos.x, m.pos.z), -1.0);
      }
      if (m.anim.action) {
        m.anim.actionT += dt;
        if (m.anim.actionT > 0.5) m.anim.action = null;
      }
      m.anim.speed = THREE.MathUtils.lerp(m.anim.speed, moveSpeed > 0 ? Math.min(1, moveSpeed / 5) : 0, Math.min(1, dt * 8));
      m.obj.position.copy(m.pos);
      m.obj.rotation.y = m.facing;
      const visible = dist < 200;
      m.obj.visible = visible;
      if (visible && dist < 120) mm.animate(dt, t + m.id, m.anim);
      // nameplate
      if (m.plate) {
        const show = m.state !== "dead" && dist < 55;
        this.placePlate(m.plate, m.pos.clone().add(new THREE.Vector3(0, mm.height + 0.6, 0)), show);
        if (show) {
          const bar = m.plate.querySelector(".pl-bar") as HTMLElement;
          bar.style.width = `${(m.hp / m.maxHp) * 100}%`;
          m.plate.style.outline = this.target === m ? "none" : "none";
          (m.plate.querySelector(".pl-name") as HTMLElement).style.textDecoration = this.target === m ? "underline" : "none";
          m.plate.style.transform = `translate(-50%,-100%) scale(${this.target === m ? 1.15 : 1})`;
        }
      }
    }
  }

  private placePlate(el: HTMLDivElement | null, p: THREE.Vector3, show: boolean) {
    if (!el) return;
    if (!show) { if (el.style.display !== "none") el.style.display = "none"; return; }
    const v = p.project(this.camera);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) { el.style.display = "none"; return; }
    el.style.display = "block";
    el.style.left = `${(v.x * 0.5 + 0.5) * this.container.clientWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * this.container.clientHeight}px`;
  }

  private atmos = {
    fog: new THREE.Color(), sky: new THREE.Color(), sun: new THREE.Color(), amb: new THREE.Color(),
  };
  private updateAtmosphere() {
    const w = zoneWeights(this.pos.x);
    const a = this.atmos;
    a.fog.setRGB(0, 0, 0); a.sky.setRGB(0, 0, 0); a.sun.setRGB(0, 0, 0); a.amb.setRGB(0, 0, 0);
    let si = 0;
    const tmp = new THREE.Color();
    ZONES.forEach((z, i) => {
      a.fog.add(tmp.set(z.fog).multiplyScalar(w[i]));
      a.sky.add(tmp.set(z.sky).multiplyScalar(w[i]));
      a.sun.add(tmp.set(z.sun).multiplyScalar(w[i]));
      a.amb.add(tmp.set(z.ambient).multiplyScalar(w[i]));
      si += z.sunIntensity * w[i];
    });
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(a.fog);
    fog.near = 30 + w[1] * 40;
    fog.far = 230 + w[1] * 120;
    this.renderer.setClearColor(a.fog);
    const sunDir = new THREE.Vector3(0.35, 0.75 - w[2] * 0.4, 0.3 + w[2] * 0.3).normalize();
    this.skyU.top.value.copy(a.sky).multiplyScalar(0.6);
    this.skyU.horizon.value.copy(a.fog).lerp(a.sun, 0.12);
    this.skyU.sunDir.value.copy(sunDir);
    this.skyU.sunColor.value.copy(a.sun);
    this.skyU.starAmt.value = w[0];
    this.sky.position.copy(this.camera.position);
    this.sun.color.copy(a.sun);
    this.sun.intensity = si;
    this.sun.position.copy(this.pos).addScaledVector(sunDir, 150);
    this.sun.target.position.copy(this.pos);
    this.hemi.color.copy(a.sky).lerp(new THREE.Color("#ffffff"), 0.2);
    this.hemi.groundColor.copy(a.amb).multiplyScalar(0.5);
    this.hemi.intensity = 1.1;
    this.renderer.toneMappingExposure = 1.05 + w[0] * 0.2;
    this.water.waterMat.color.set(w[0] > 0.5 ? "#16404e" : "#2a5a6a");
  }

  private ambientFx(dt: number) {
    const w = zoneWeights(this.pos.x);
    const n = Math.floor(60 * dt * 10);
    for (let i = 0; i < n; i++) {
      const p = this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 70, Math.random() * 10, (Math.random() - 0.5) * 70));
      const r = Math.random();
      if (r < w[0] * 0.25) this.fx.emit(p.setY(heightAt(p.x, p.z) + 0.5 + Math.random() * 4), new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.3) * 0.5, (Math.random() - 0.5) * 0.8), new THREE.Color(Math.random() < 0.5 ? "#7dff9a" : "#7ff0ff"), 0.35, 4);
      else if (r < w[0] * 0.25 + w[2] * 0.35) this.fx.emit(p.setY(heightAt(p.x, p.z) + Math.random() * 2), new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 1.5), new THREE.Color("#ff7a2a"), 0.25, 3);
      else if (r < w[0] * 0.25 + w[2] * 0.35 + w[1] * 0.08) this.fx.emit(p.setY(heightAt(p.x, p.z) + 1 + Math.random() * 3), new THREE.Vector3(0.6, 0.1, 0.2), new THREE.Color("#fff6d0"), 0.15, 4);
    }
    // campfires
    for (const f of this.towns.fires) {
      if (f.distanceTo(this.pos) > 120) continue;
      for (let i = 0; i < 3; i++) this.fx.emit(f.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0, (Math.random() - 0.5) * 1.2)), new THREE.Vector3((Math.random() - 0.5) * 0.5, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 0.5), new THREE.Color(Math.random() < 0.5 ? "#ff7a1a" : "#ffc04a"), 0.9, 0.7);
    }
    // lava bubbles near the volcano
    if (w[2] > 0.5 && Math.random() < 0.5) {
      for (const l of LAKES.filter((k) => k.lava)) {
        if (Math.hypot(l.x - this.pos.x, l.z - this.pos.z) > 200) continue;
        const a = Math.random() * 6.28, r = Math.random() * l.r;
        this.fx.burst(new THREE.Vector3(l.x + Math.cos(a) * r, 0.5, l.z + Math.sin(a) * r), "#ff6a00", 6, 3, 0.6, 0.8, 6, 1);
      }
    }
  }

  private updateCamera(dt: number) {
    const focus = this.pos.clone().add(new THREE.Vector3(0, 1.7 * this.race.scale, 0));
    const cp = Math.cos(this.camPitch);
    const want = focus.clone().add(new THREE.Vector3(Math.sin(this.camYaw) * cp * this.camDist, Math.sin(this.camPitch) * this.camDist, Math.cos(this.camYaw) * cp * this.camDist));
    const gh = Math.max(heightAt(want.x, want.z), 0) + 0.6;
    if (want.y < gh) want.y = gh;
    this.camera.position.lerp(want, Math.min(1, dt * 14));
    this.camera.lookAt(focus);
  }

  private drawMinimap() {
    const c = this.minimap;
    if (!c || !this.mapCanvas) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const S = c.width;
    const range = 160; // world units radius
    const scale = S / 2 / range; // canvas px per world unit
    const mpx = (this.pos.x + 1200) / 3, mpz = (this.pos.z + 400) / 3; // map px (3 units/px)
    ctx.save();
    ctx.clearRect(0, 0, S, S);
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    const srcR = range / 3;
    ctx.drawImage(this.mapCanvas, mpx - srcR, mpz - srcR, srcR * 2, srcR * 2, 0, 0, S, S);
    const toC = (x: number, z: number) => [S / 2 + (x - this.pos.x) * scale, S / 2 + (z - this.pos.z) * scale];
    for (const m of this.mobs) {
      if (m.state === "dead") continue;
      const d = Math.hypot(m.pos.x - this.pos.x, m.pos.z - this.pos.z);
      if (d > range) continue;
      const [x, y] = toC(m.pos.x, m.pos.z);
      ctx.fillStyle = m === this.target ? "#ffffff" : m.def.elite ? "#ffcc00" : m.state === "chase" ? "#ff3030" : "#d43a3a";
      ctx.beginPath();
      ctx.arc(x, y, m.def.elite ? 4.5 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const v of this.vendors) {
      const [x, y] = toC(v.pos.x, v.pos.z);
      ctx.fillStyle = "#ffd100";
      ctx.font = "bold 12px serif";
      ctx.fillText("$", x - 3, y + 4);
    }
    // player arrow
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-this.facing + Math.PI);
    ctx.fillStyle = "#ffe9a8";
    ctx.strokeStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  private snapshot(inCombat: boolean): HudSnapshot {
    const tg = this.target;
    let hint: string | null = null;
    if (!this.dead) {
      if (this.mobs.some((m) => m.state === "dead" && m.loot && m.pos.distanceTo(this.pos) < 7)) hint = "[F] Saquear cadáver";
      else if (this.vendors.some((v) => v.pos.distanceTo(this.pos) < 8)) hint = "[F] Comerciar con el mercader";
    }
    return {
      name: this.rec.username, raceId: this.race.id, classId: this.cls.id, level: this.level, xp: this.xp, xpNext: xpForLevel(this.level),
      hp: this.hp, maxHp: this.stats.maxHp, res: this.res, maxRes: this.stats.maxRes, gold: this.gold, kills: this.kills,
      stats: this.stats,
      target: tg ? { name: tg.def.name, level: tg.level, hp: Math.max(0, tg.hp), maxHp: tg.maxHp, elite: !!tg.def.elite, dead: tg.state === "dead" } : null,
      cooldowns: this.cls.abilities.map((a, i) => ({ remaining: this.cooldowns[i], total: a.cooldown })),
      gcd: this.gcd,
      cast: this.casting ? { name: this.casting.ab.name, progress: this.casting.t / this.casting.total, color: this.casting.ab.color } : null,
      buffs: this.buffs.map((b) => ({ id: b.id, name: b.name, icon: b.icon, remaining: b.t })),
      zone: Math.max(0, this.currentZone), pos: [this.pos.x, this.pos.z], facing: this.facing,
      inventory: this.inventory.map((s) => (s ? { ...s } : null)), equipment: { ...this.equipment },
      quick: this.quickList(),
      loot: this.openLoot?.loot ? { items: this.openLoot.loot.items.map((i) => ({ ...i })), gold: this.openLoot.loot.gold, name: this.openLoot.def.name } : null,
      vendor: this.openVendor,
      dead: this.dead, inCombat,
      interactHint: hint,
      objectives: this.objectives.map((o) => ({ ...o })),
    };
  }

  teleportToZone(z: number) {
    if (this.dead || (this.time - this.lastCombat) < 5) { this.cb.onLog("No puedes viajar en combate.", "#ff5050"); return; }
    const zone = ZONES[z];
    this.pos.set(zone.spawn[0], heightAt(zone.spawn[0], zone.spawn[1] + 8), zone.spawn[1] + 8);
    this.rings.spawn(this.pos, "#9fe8ff", 6, 1);
    this.fx.burst(this.pChest(), "#9fe8ff", 100, 6, 0.6, 1.2, 0, 0.5);
    this.cb.onLog(`Viajas a ${zone.name}.`, "#9fe8ff");
    this.markDirty(true);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("resize", this.onResize);
    if (this.renderer) {
      this.renderer.domElement.remove();
      this.renderer.dispose();
    }
    this.overlay.innerHTML = "";
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
    // Dispose FBX model if loaded
    if (this.fbxModel) {
      this.fbxModel.mixer.stopAllAction();
      this.fbxModel.root.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
          child.geometry.dispose();
        }
      });
      this.fbxModel.root.clear();
    }
  }
}

function needsCombat(ab: AbilityDef) {
  return ab.kind !== "buff" && ab.kind !== "heal";
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// silence unused helper warnings
void tmpV; void UP;
