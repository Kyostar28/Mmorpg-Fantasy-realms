// Shared game definitions (races, classes, items, zones, mobs) — used by client & server.

export type RaceId = "human" | "orc" | "elf" | "undead" | "tauren";
export type ClassId = "warrior" | "paladin" | "assassin" | "hunter" | "mage" | "warlock";
export type Slot = "weapon" | "offhand" | "head" | "chest" | "legs" | "feet" | "trinket";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface Stats {
  str?: number;
  agi?: number;
  int?: number;
  sta?: number;
  armor?: number;
  dmg?: number;
}

export interface RaceDef {
  id: RaceId;
  name: string;
  faction: "Alianza" | "Horda";
  lore: string;
  skin: string;
  hair: string;
  scale: number;
  bonus: Stats;
  startZone: number;
}

export interface AbilityDef {
  id: string;
  name: string;
  icon: string;
  kind: "melee" | "projectile" | "aoe" | "heal" | "buff" | "dot";
  cost: number;
  cooldown: number; // seconds
  power: number; // damage / heal multiplier
  range: number;
  color: string;
  desc: string;
  castTime?: number;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  color: string;
  role: string;
  resource: "Ira" | "Maná" | "Energía" | "Foco";
  resourceColor: string;
  primary: "str" | "agi" | "int";
  desc: string;
  armor: string;
  trim: string;
  weapon: "sword" | "hammer" | "daggers" | "bow" | "staff" | "skullstaff";
  attackRange: number;
  abilities: AbilityDef[];
  startItems: string[];
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  type: Slot | "consumable" | "junk";
  rarity: Rarity;
  level: number;
  stats?: Stats;
  value: number;
  effect?: { heal?: number; mana?: number; buff?: "str" | "armor" | "speed"; duration?: number };
  desc?: string;
}

export interface MobDef {
  id: string;
  name: string;
  body: "wolf" | "boar" | "spider" | "scorpion" | "humanoid" | "skeleton" | "golem" | "raptor";
  color: string;
  accent: string;
  level: [number, number];
  hp: number;
  dmg: number;
  scale: number;
  speed: number;
  elite?: boolean;
  loot: { id: string; chance: number }[];
}

export interface ZoneDef {
  id: number;
  name: string;
  subtitle: string;
  levels: string;
  x0: number;
  x1: number;
  spawn: [number, number];
  vendor: [number, number];
  fog: string;
  sky: string;
  sun: string;
  ambient: string;
  sunIntensity: number;
  ground: [string, string, string]; // low, mid, high
  mobs: { id: string; count: number }[];
  vendorItems: string[];
}

export const RACES: RaceDef[] = [
  { id: "human", name: "Humano", faction: "Alianza", lore: "Tenaces y versátiles, los humanos de Ventormenta defienden el reino con acero y fe.", skin: "#e0b48f", hair: "#5a3b22", scale: 1, bonus: { str: 1, int: 1, sta: 1 }, startZone: 1 },
  { id: "elf", name: "Elfo", faction: "Alianza", lore: "Hijos de los bosques eternos, ágiles y en armonía con la magia arcana.", skin: "#f2d2bd", hair: "#d9e7ff", scale: 1.02, bonus: { agi: 2, int: 2 }, startZone: 0 },
  { id: "orc", name: "Orco", faction: "Horda", lore: "Guerreros forjados en la sangre y el honor, de fuerza brutal e indomable.", skin: "#5e8a3a", hair: "#151515", scale: 1.1, bonus: { str: 3, sta: 1 }, startZone: 1 },
  { id: "undead", name: "No-muerto", faction: "Horda", lore: "Renegados que se liberaron del Rey Exánime. La muerte no es el final.", skin: "#9aa39a", hair: "#2b2b33", scale: 0.97, bonus: { int: 2, sta: 2 }, startZone: 0 },
  { id: "tauren", name: "Tauren", faction: "Horda", lore: "Gigantes nobles de las llanuras, guardianes de la Madre Tierra.", skin: "#6e4a2e", hair: "#2a1a10", scale: 1.28, bonus: { str: 2, sta: 3 }, startZone: 2 },
];

export const CLASSES: ClassDef[] = [
  {
    id: "warrior", name: "Guerrero", color: "#c79c6e", role: "Tanque / DPS cuerpo a cuerpo", resource: "Ira", resourceColor: "#c0262d", primary: "str",
    desc: "Maestro del combate cuerpo a cuerpo. Genera ira golpeando y desata ataques devastadores.",
    armor: "#6f6a64", trim: "#b8862b", weapon: "sword", attackRange: 3.4,
    abilities: [
      { id: "heroic", name: "Golpe heroico", icon: "⚔️", kind: "melee", cost: 15, cooldown: 1.5, power: 1.8, range: 3.6, color: "#ffcc66", desc: "Un tajo poderoso que inflige daño elevado." },
      { id: "whirl", name: "Torbellino", icon: "🌀", kind: "aoe", cost: 25, cooldown: 8, power: 1.5, range: 7, color: "#ffffff", desc: "Gira con tu arma golpeando a todos los enemigos cercanos." },
      { id: "charge", name: "Carga", icon: "🐂", kind: "melee", cost: 0, cooldown: 12, power: 1.0, range: 25, color: "#ff8844", desc: "Carga hacia tu objetivo y lo aturde brevemente." },
      { id: "rend", name: "Desgarrar", icon: "🩸", kind: "dot", cost: 10, cooldown: 6, power: 2.2, range: 3.6, color: "#cc2222", desc: "Hiere al objetivo causando sangrado durante 6 s." },
      { id: "shout", name: "Grito de batalla", icon: "📯", kind: "buff", cost: 10, cooldown: 30, power: 1.25, range: 0, color: "#ff5533", desc: "Aumenta tu daño un 25% durante 15 s." },
    ],
    startItems: ["sword_rusty", "chest_recruit", "potion_hp_minor", "potion_hp_minor", "bread"],
  },
  {
    id: "paladin", name: "Paladín", color: "#f58cba", role: "Tanque / Sanador", resource: "Maná", resourceColor: "#2f6fe0", primary: "str",
    desc: "Guerrero sagrado que combina el martillo con la Luz para sanar y castigar.",
    armor: "#c9c3b4", trim: "#e2b43c", weapon: "hammer", attackRange: 3.4,
    abilities: [
      { id: "crusader", name: "Golpe de cruzado", icon: "🔨", kind: "melee", cost: 12, cooldown: 2, power: 1.7, range: 3.6, color: "#ffe680", desc: "Golpe imbuido de Luz sagrada." },
      { id: "holylight", name: "Luz sagrada", icon: "✨", kind: "heal", cost: 25, cooldown: 4, power: 3.2, range: 0, color: "#fff2a8", castTime: 1.2, desc: "Sana una gran cantidad de salud." },
      { id: "consecrate", name: "Consagración", icon: "🌟", kind: "aoe", cost: 30, cooldown: 10, power: 1.6, range: 8, color: "#ffd84a", desc: "Consagra el suelo dañando a los enemigos cercanos." },
      { id: "judgement", name: "Sentencia", icon: "⚖️", kind: "projectile", cost: 15, cooldown: 6, power: 2.0, range: 25, color: "#ffee99", desc: "Lanza un juicio de Luz a distancia." },
      { id: "divine", name: "Escudo divino", icon: "🛡️", kind: "buff", cost: 20, cooldown: 45, power: 0.2, range: 0, color: "#fff6c8", desc: "Reduces el daño recibido un 80% durante 8 s." },
    ],
    startItems: ["hammer_worn", "chest_recruit", "potion_hp_minor", "potion_mana_minor", "bread"],
  },
  {
    id: "assassin", name: "Asesino", color: "#fff569", role: "DPS sigiloso", resource: "Energía", resourceColor: "#e8d32a", primary: "agi",
    desc: "Letal y escurridizo. Ataca desde las sombras con dagas envenenadas.",
    armor: "#2c2a30", trim: "#7d1f2b", weapon: "daggers", attackRange: 3,
    abilities: [
      { id: "sinister", name: "Golpe siniestro", icon: "🗡️", kind: "melee", cost: 20, cooldown: 1, power: 1.6, range: 3.2, color: "#ffffaa", desc: "Ataque rápido y preciso." },
      { id: "eviscerate", name: "Eviscerar", icon: "💀", kind: "melee", cost: 35, cooldown: 5, power: 3.0, range: 3.2, color: "#ff3355", desc: "Un golpe final brutal." },
      { id: "poison", name: "Veneno mortal", icon: "🧪", kind: "dot", cost: 20, cooldown: 6, power: 2.6, range: 3.2, color: "#55ff55", desc: "Envenena al objetivo durante 6 s." },
      { id: "fan", name: "Abanico de cuchillas", icon: "🌪️", kind: "aoe", cost: 35, cooldown: 7, power: 1.3, range: 7, color: "#dddddd", desc: "Lanza dagas a todos los enemigos cercanos." },
      { id: "sprint", name: "Sprint", icon: "💨", kind: "buff", cost: 0, cooldown: 25, power: 1.7, range: 0, color: "#aaffff", desc: "Aumenta tu velocidad un 70% durante 8 s." },
    ],
    startItems: ["daggers_chipped", "chest_leather", "potion_hp_minor", "potion_hp_minor", "bread"],
  },
  {
    id: "hunter", name: "Cazador", color: "#abd473", role: "DPS a distancia", resource: "Foco", resourceColor: "#d8892c", primary: "agi",
    desc: "Rastreador experto que derriba a sus presas desde lejos con su arco.",
    armor: "#4d5b34", trim: "#8a6a3c", weapon: "bow", attackRange: 28,
    abilities: [
      { id: "arcane_shot", name: "Disparo arcano", icon: "🏹", kind: "projectile", cost: 15, cooldown: 2, power: 1.7, range: 32, color: "#c08cff", desc: "Una flecha imbuida de energía arcana." },
      { id: "aimed", name: "Disparo apuntado", icon: "🎯", kind: "projectile", cost: 25, cooldown: 6, power: 3.0, range: 35, color: "#ffffff", castTime: 1.5, desc: "Un disparo preciso y devastador." },
      { id: "multi", name: "Disparo múltiple", icon: "🌧️", kind: "aoe", cost: 30, cooldown: 8, power: 1.3, range: 10, color: "#ffd27a", desc: "Lluvia de flechas en el área del objetivo." },
      { id: "serpent", name: "Picadura de serpiente", icon: "🐍", kind: "dot", cost: 15, cooldown: 5, power: 2.4, range: 32, color: "#66dd44", desc: "Envenena al objetivo durante 6 s." },
      { id: "rapid", name: "Fuego rápido", icon: "⚡", kind: "buff", cost: 0, cooldown: 40, power: 1.4, range: 0, color: "#ffcc33", desc: "Aumenta tu daño un 40% durante 12 s." },
    ],
    startItems: ["bow_simple", "chest_leather", "potion_hp_minor", "potion_hp_minor", "bread"],
  },
  {
    id: "mage", name: "Mago", color: "#69ccf0", role: "DPS mágico", resource: "Maná", resourceColor: "#2f6fe0", primary: "int",
    desc: "Domina el fuego, la escarcha y lo arcano para aniquilar a sus enemigos.",
    armor: "#2f4f8f", trim: "#c9d6ff", weapon: "staff", attackRange: 28,
    abilities: [
      { id: "fireball", name: "Bola de fuego", icon: "🔥", kind: "projectile", cost: 15, cooldown: 0.5, power: 2.0, range: 32, color: "#ff6a1a", castTime: 1.4, desc: "Lanza una bola de fuego abrasadora." },
      { id: "frostbolt", name: "Descarga de escarcha", icon: "❄️", kind: "projectile", cost: 12, cooldown: 1, power: 1.6, range: 32, color: "#7fd8ff", castTime: 1.0, desc: "Proyectil helado que ralentiza al objetivo." },
      { id: "nova", name: "Nova de escarcha", icon: "💠", kind: "aoe", cost: 25, cooldown: 10, power: 1.2, range: 9, color: "#bfefff", desc: "Congela a los enemigos cercanos." },
      { id: "blizzard", name: "Ventisca", icon: "🌨️", kind: "aoe", cost: 40, cooldown: 12, power: 2.2, range: 12, color: "#9fe3ff", desc: "Una tormenta de hielo en el área del objetivo." },
      { id: "barrier", name: "Barrera de hielo", icon: "🧊", kind: "buff", cost: 20, cooldown: 30, power: 0.4, range: 0, color: "#bff3ff", desc: "Reduce el daño recibido un 60% durante 10 s." },
    ],
    startItems: ["staff_apprentice", "robe_apprentice", "potion_mana_minor", "potion_hp_minor", "bread"],
  },
  {
    id: "warlock", name: "Brujo", color: "#9482c9", role: "DPS de sombras", resource: "Maná", resourceColor: "#2f6fe0", primary: "int",
    desc: "Invoca el poder vil y las sombras, consumiendo la vida de sus víctimas.",
    armor: "#2a1838", trim: "#7cff4a", weapon: "skullstaff", attackRange: 28,
    abilities: [
      { id: "shadowbolt", name: "Descarga de sombras", icon: "🟣", kind: "projectile", cost: 15, cooldown: 0.5, power: 2.1, range: 32, color: "#a64dff", castTime: 1.5, desc: "Proyectil de pura energía de las sombras." },
      { id: "corruption", name: "Corrupción", icon: "☠️", kind: "dot", cost: 12, cooldown: 4, power: 2.8, range: 32, color: "#7a3cff", desc: "Corrompe al objetivo durante 6 s." },
      { id: "drain", name: "Drenar vida", icon: "🫀", kind: "projectile", cost: 18, cooldown: 5, power: 1.5, range: 30, color: "#ff3a6e", desc: "Roba vida del objetivo y te sana." },
      { id: "rain", name: "Lluvia de fuego", icon: "☄️", kind: "aoe", cost: 40, cooldown: 12, power: 2.0, range: 12, color: "#66ff33", desc: "Fuego vil cae del cielo en el área." },
      { id: "felarmor", name: "Armadura vil", icon: "👿", kind: "buff", cost: 20, cooldown: 30, power: 1.3, range: 0, color: "#66ff44", desc: "Aumenta tu daño un 30% durante 15 s." },
    ],
    startItems: ["skullstaff_cultist", "robe_apprentice", "potion_mana_minor", "potion_hp_minor", "bread"],
  },
];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#ffffff",
  uncommon: "#1eff00",
  rare: "#0070dd",
  epic: "#a335ee",
  legendary: "#ff8000",
};

export const RARITY_NAME: Record<Rarity, string> = {
  common: "Común",
  uncommon: "Poco común",
  rare: "Raro",
  epic: "Épico",
  legendary: "Legendario",
};

export const SLOT_NAME: Record<string, string> = {
  weapon: "Arma",
  offhand: "Mano izquierda",
  head: "Cabeza",
  chest: "Torso",
  legs: "Piernas",
  feet: "Pies",
  trinket: "Abalorio",
  consumable: "Consumible",
  junk: "Basura",
};

const I = (it: ItemDef) => it;

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [
    // Starter weapons
    I({ id: "sword_rusty", name: "Espada oxidada", icon: "🗡️", type: "weapon", rarity: "common", level: 1, stats: { dmg: 6, str: 1 }, value: 5 }),
    I({ id: "hammer_worn", name: "Martillo desgastado", icon: "🔨", type: "weapon", rarity: "common", level: 1, stats: { dmg: 6, str: 1, sta: 1 }, value: 5 }),
    I({ id: "daggers_chipped", name: "Dagas melladas", icon: "🔪", type: "weapon", rarity: "common", level: 1, stats: { dmg: 5, agi: 2 }, value: 5 }),
    I({ id: "bow_simple", name: "Arco de fresno", icon: "🏹", type: "weapon", rarity: "common", level: 1, stats: { dmg: 6, agi: 1 }, value: 5 }),
    I({ id: "staff_apprentice", name: "Bastón de aprendiz", icon: "🪄", type: "weapon", rarity: "common", level: 1, stats: { dmg: 5, int: 2 }, value: 5 }),
    I({ id: "skullstaff_cultist", name: "Bastón del cultista", icon: "💀", type: "weapon", rarity: "common", level: 1, stats: { dmg: 5, int: 2 }, value: 5 }),
    I({ id: "chest_recruit", name: "Cota de recluta", icon: "🦺", type: "chest", rarity: "common", level: 1, stats: { armor: 8, sta: 1 }, value: 4 }),
    I({ id: "chest_leather", name: "Jubón de cuero", icon: "🧥", type: "chest", rarity: "common", level: 1, stats: { armor: 5, agi: 1 }, value: 4 }),
    I({ id: "robe_apprentice", name: "Túnica de aprendiz", icon: "👘", type: "chest", rarity: "common", level: 1, stats: { armor: 2, int: 2 }, value: 4 }),
    // Drops — zone 0 (Bosque)
    I({ id: "wolf_pelt", name: "Pellejo de lobo", icon: "🐺", type: "junk", rarity: "common", level: 1, value: 3, desc: "Se puede vender a un mercader." }),
    I({ id: "spider_silk", name: "Seda de araña", icon: "🕸️", type: "junk", rarity: "common", level: 1, value: 4, desc: "Se puede vender a un mercader." }),
    I({ id: "moon_blade", name: "Hoja lunar", icon: "🌙", type: "weapon", rarity: "uncommon", level: 3, stats: { dmg: 11, agi: 3, str: 2 }, value: 25 }),
    I({ id: "elven_hood", name: "Capucha élfica", icon: "🎩", type: "head", rarity: "uncommon", level: 3, stats: { armor: 4, int: 3, agi: 2 }, value: 18 }),
    I({ id: "ranger_boots", name: "Botas de forestal", icon: "🥾", type: "feet", rarity: "uncommon", level: 2, stats: { armor: 4, agi: 3 }, value: 15 }),
    I({ id: "verdant_legs", name: "Calzas verdosas", icon: "👖", type: "legs", rarity: "uncommon", level: 3, stats: { armor: 6, sta: 3 }, value: 16 }),
    I({ id: "wisp_staff", name: "Vara de fuego fatuo", icon: "🪄", type: "weapon", rarity: "rare", level: 5, stats: { dmg: 14, int: 7, sta: 3 }, value: 60 }),
    I({ id: "heart_ancient", name: "Corazón del Ancestro", icon: "💚", type: "trinket", rarity: "epic", level: 5, stats: { sta: 8, str: 4, agi: 4, int: 4 }, value: 150 }),
    // Drops — zone 1 (Valle)
    I({ id: "boar_tusk", name: "Colmillo de jabalí", icon: "🦷", type: "junk", rarity: "common", level: 4, value: 6, desc: "Se puede vender a un mercader." }),
    I({ id: "bandit_mask", name: "Máscara de bandido", icon: "🎭", type: "head", rarity: "uncommon", level: 6, stats: { armor: 7, agi: 4, sta: 2 }, value: 30 }),
    I({ id: "knight_plate", name: "Coraza de caballero", icon: "🛡️", type: "chest", rarity: "rare", level: 7, stats: { armor: 22, str: 6, sta: 6 }, value: 80 }),
    I({ id: "lion_shield", name: "Escudo del león", icon: "🛡️", type: "offhand", rarity: "rare", level: 7, stats: { armor: 18, sta: 5 }, value: 70 }),
    I({ id: "war_axe", name: "Hacha de guerra", icon: "🪓", type: "weapon", rarity: "uncommon", level: 6, stats: { dmg: 17, str: 5 }, value: 40 }),
    I({ id: "longbow_valley", name: "Arco largo del valle", icon: "🏹", type: "weapon", rarity: "rare", level: 8, stats: { dmg: 22, agi: 7 }, value: 90 }),
    I({ id: "mystic_tome", name: "Tomo místico", icon: "📘", type: "offhand", rarity: "rare", level: 7, stats: { int: 8, sta: 3 }, value: 70 }),
    I({ id: "gold_ring", name: "Anillo de oro", icon: "💍", type: "trinket", rarity: "uncommon", level: 5, stats: { int: 3, str: 3, agi: 3 }, value: 45 }),
    I({ id: "plated_greaves", name: "Grebas de placas", icon: "🦿", type: "legs", rarity: "uncommon", level: 6, stats: { armor: 12, str: 3, sta: 3 }, value: 28 }),
    // Drops — zone 2 (Tierras Calcinadas)
    I({ id: "scorpion_stinger", name: "Aguijón de escorpión", icon: "🦂", type: "junk", rarity: "common", level: 10, value: 10, desc: "Se puede vender a un mercader." }),
    I({ id: "bone_dust", name: "Polvo de hueso", icon: "🦴", type: "junk", rarity: "common", level: 10, value: 9, desc: "Se puede vender a un mercader." }),
    I({ id: "magma_core", name: "Núcleo de magma", icon: "🔥", type: "trinket", rarity: "rare", level: 11, stats: { int: 9, str: 9, sta: 5 }, value: 120 }),
    I({ id: "obsidian_helm", name: "Yelmo de obsidiana", icon: "⛑️", type: "head", rarity: "rare", level: 12, stats: { armor: 18, str: 8, sta: 8 }, value: 130 }),
    I({ id: "ember_robe", name: "Túnica de ascuas", icon: "👘", type: "chest", rarity: "rare", level: 12, stats: { armor: 10, int: 12, sta: 6 }, value: 130 }),
    I({ id: "ashwalker_boots", name: "Botas del caminante de ceniza", icon: "🥾", type: "feet", rarity: "rare", level: 11, stats: { armor: 10, agi: 8, sta: 5 }, value: 110 }),
    I({ id: "doomblade", name: "Filo del Juicio Final", icon: "⚔️", type: "weapon", rarity: "epic", level: 13, stats: { dmg: 38, str: 12, agi: 10, sta: 8 }, value: 400 }),
    I({ id: "staff_inferno", name: "Bastón del Infierno", icon: "☄️", type: "weapon", rarity: "epic", level: 13, stats: { dmg: 34, int: 18, sta: 8 }, value: 400 }),
    I({ id: "ashbringer", name: "Crematoria", icon: "🌅", type: "weapon", rarity: "legendary", level: 15, stats: { dmg: 60, str: 20, agi: 15, int: 15, sta: 15 }, value: 2000 }),
    // Consumables
    I({ id: "potion_hp_minor", name: "Poción de sanación menor", icon: "🧪", type: "consumable", rarity: "common", level: 1, value: 5, effect: { heal: 80 }, desc: "Restaura 80 de salud." }),
    I({ id: "potion_hp", name: "Poción de sanación", icon: "❤️‍🩹", type: "consumable", rarity: "uncommon", level: 6, value: 15, effect: { heal: 250 }, desc: "Restaura 250 de salud." }),
    I({ id: "potion_mana_minor", name: "Poción de maná menor", icon: "🔵", type: "consumable", rarity: "common", level: 1, value: 5, effect: { mana: 80 }, desc: "Restaura 80 de maná/recurso." }),
    I({ id: "potion_mana", name: "Poción de maná", icon: "💎", type: "consumable", rarity: "uncommon", level: 6, value: 15, effect: { mana: 250 }, desc: "Restaura 250 de maná/recurso." }),
    I({ id: "bread", name: "Pan de molde", icon: "🍞", type: "consumable", rarity: "common", level: 1, value: 2, effect: { heal: 50, mana: 50 }, desc: "Restaura 50 de salud y recurso." }),
    I({ id: "elixir_giant", name: "Elixir del gigante", icon: "🍶", type: "consumable", rarity: "rare", level: 5, value: 30, effect: { buff: "str", duration: 60 }, desc: "+30% daño durante 60 s." }),
    I({ id: "elixir_stone", name: "Elixir de piel de piedra", icon: "🪨", type: "consumable", rarity: "rare", level: 5, value: 30, effect: { buff: "armor", duration: 60 }, desc: "-30% daño recibido durante 60 s." }),
    I({ id: "elixir_swift", name: "Elixir de rapidez", icon: "🍃", type: "consumable", rarity: "uncommon", level: 3, value: 20, effect: { buff: "speed", duration: 45 }, desc: "+40% velocidad durante 45 s." }),
  ].map((i) => [i.id, i])
);

export const MOBS: Record<string, MobDef> = {
  shadow_wolf: { id: "shadow_wolf", name: "Lobo sombrío", body: "wolf", color: "#3a3f4a", accent: "#7fe3ff", level: [1, 3], hp: 70, dmg: 6, scale: 1, speed: 7, loot: [{ id: "wolf_pelt", chance: 0.7 }, { id: "ranger_boots", chance: 0.06 }, { id: "potion_hp_minor", chance: 0.2 }] },
  mist_spider: { id: "mist_spider", name: "Araña de bruma", body: "spider", color: "#2a2438", accent: "#b38cff", level: [2, 4], hp: 85, dmg: 7, scale: 1, speed: 6, loot: [{ id: "spider_silk", chance: 0.75 }, { id: "elven_hood", chance: 0.06 }, { id: "verdant_legs", chance: 0.06 }, { id: "potion_mana_minor", chance: 0.2 }] },
  wisp_ghoul: { id: "wisp_ghoul", name: "Necrófago errante", body: "skeleton", color: "#9fb7a8", accent: "#69ff9a", level: [3, 5], hp: 110, dmg: 9, scale: 1, speed: 4.5, loot: [{ id: "bone_dust", chance: 0.5 }, { id: "moon_blade", chance: 0.08 }, { id: "wisp_staff", chance: 0.04 }, { id: "elixir_swift", chance: 0.1 }] },
  ancient_treant: { id: "ancient_treant", name: "Ancestro Corrompido", body: "golem", color: "#4b3a2a", accent: "#7dff6a", level: [6, 6], hp: 900, dmg: 22, scale: 2.4, speed: 4, elite: true, loot: [{ id: "heart_ancient", chance: 0.6 }, { id: "wisp_staff", chance: 0.5 }, { id: "elixir_giant", chance: 0.8 }] },

  wild_boar: { id: "wild_boar", name: "Jabalí salvaje", body: "boar", color: "#5b3d2a", accent: "#e8d9b5", level: [5, 7], hp: 160, dmg: 12, scale: 1.1, speed: 6.5, loot: [{ id: "boar_tusk", chance: 0.7 }, { id: "plated_greaves", chance: 0.06 }, { id: "potion_hp", chance: 0.15 }] },
  bandit: { id: "bandit", name: "Bandido Defias", body: "humanoid", color: "#7a1f1f", accent: "#2b2b2b", level: [6, 8], hp: 190, dmg: 15, scale: 1, speed: 5.5, loot: [{ id: "bandit_mask", chance: 0.12 }, { id: "war_axe", chance: 0.08 }, { id: "gold_ring", chance: 0.06 }, { id: "potion_hp", chance: 0.2 }, { id: "bread", chance: 0.3 }] },
  raptor: { id: "raptor", name: "Raptor de las colinas", body: "raptor", color: "#4f6b2a", accent: "#e0b84a", level: [7, 9], hp: 210, dmg: 17, scale: 1.1, speed: 8, loot: [{ id: "longbow_valley", chance: 0.06 }, { id: "mystic_tome", chance: 0.06 }, { id: "potion_mana", chance: 0.2 }] },
  hogger: { id: "hogger", name: "Hogger el Implacable", body: "humanoid", color: "#5a4a2a", accent: "#c98b2a", level: [10, 10], hp: 2200, dmg: 38, scale: 2.1, speed: 5, elite: true, loot: [{ id: "knight_plate", chance: 0.6 }, { id: "lion_shield", chance: 0.5 }, { id: "elixir_stone", chance: 0.8 }] },

  scorpid: { id: "scorpid", name: "Escórpido de ceniza", body: "scorpion", color: "#8a3a1a", accent: "#ffb347", level: [10, 12], hp: 320, dmg: 24, scale: 1.4, speed: 6, loot: [{ id: "scorpion_stinger", chance: 0.75 }, { id: "ashwalker_boots", chance: 0.06 }, { id: "potion_hp", chance: 0.25 }] },
  skeleton_knight: { id: "skeleton_knight", name: "Caballero esquelético", body: "skeleton", color: "#d8d0bc", accent: "#ff4a1a", level: [11, 13], hp: 380, dmg: 28, scale: 1.1, speed: 5, loot: [{ id: "bone_dust", chance: 0.7 }, { id: "obsidian_helm", chance: 0.06 }, { id: "ember_robe", chance: 0.06 }, { id: "potion_mana", chance: 0.25 }] },
  magma_golem: { id: "magma_golem", name: "Gólem de magma", body: "golem", color: "#2a2020", accent: "#ff5a00", level: [12, 14], hp: 520, dmg: 34, scale: 1.4, speed: 4, loot: [{ id: "magma_core", chance: 0.1 }, { id: "doomblade", chance: 0.02 }, { id: "staff_inferno", chance: 0.02 }, { id: "elixir_giant", chance: 0.15 }] },
  ragnaros: { id: "ragnaros", name: "Ignaros, Señor del Fuego", body: "golem", color: "#3a1a10", accent: "#ff7a00", level: [16, 16], hp: 6000, dmg: 70, scale: 3.4, speed: 3.5, elite: true, loot: [{ id: "ashbringer", chance: 0.35 }, { id: "doomblade", chance: 0.5 }, { id: "staff_inferno", chance: 0.5 }, { id: "magma_core", chance: 0.6 }] },
};

export const WORLD = { width: 2400, depth: 800, minX: -1200, maxX: 1200, minZ: -400, maxZ: 400 };

export const ZONES: ZoneDef[] = [
  {
    id: 0, name: "Bosque de Elunaria", subtitle: "Un bosque eterno bañado por la luz de la luna", levels: "1-6",
    x0: -1200, x1: -400, spawn: [-800, 40], vendor: [-790, 20],
    fog: "#0d2a33", sky: "#123844", sun: "#9fd8ff", ambient: "#2e5a6a", sunIntensity: 1.4,
    ground: ["#1d3b33", "#2c5048", "#4b5f63"],
    mobs: [{ id: "shadow_wolf", count: 26 }, { id: "mist_spider", count: 22 }, { id: "wisp_ghoul", count: 18 }, { id: "ancient_treant", count: 1 }],
    vendorItems: ["potion_hp_minor", "potion_mana_minor", "bread", "elixir_swift", "ranger_boots"],
  },
  {
    id: 1, name: "Valle de Ventormenta", subtitle: "Praderas doradas, granjas y bandidos", levels: "5-10",
    x0: -400, x1: 400, spawn: [0, 30], vendor: [12, 18],
    fog: "#b9cfe0", sky: "#86b6e6", sun: "#fff1d0", ambient: "#8aa6c2", sunIntensity: 2.6,
    ground: ["#4d6b2a", "#6f8a38", "#8a8466"],
    mobs: [{ id: "wild_boar", count: 26 }, { id: "bandit", count: 22 }, { id: "raptor", count: 18 }, { id: "hogger", count: 1 }],
    vendorItems: ["potion_hp", "potion_mana", "bread", "elixir_stone", "elixir_giant", "plated_greaves"],
  },
  {
    id: 2, name: "Tierras Calcinadas", subtitle: "Un páramo volcánico de ceniza y fuego", levels: "10-16",
    x0: 400, x1: 1200, spawn: [800, 20], vendor: [812, 5],
    fog: "#5a2a18", sky: "#7a3a20", sun: "#ffb27a", ambient: "#6a3a2a", sunIntensity: 2.0,
    ground: ["#2e2522", "#4a3a30", "#6b4a35"],
    mobs: [{ id: "scorpid", count: 24 }, { id: "skeleton_knight", count: 22 }, { id: "magma_golem", count: 18 }, { id: "ragnaros", count: 1 }],
    vendorItems: ["potion_hp", "potion_mana", "elixir_giant", "elixir_stone", "elixir_swift"],
  },
];

export function zoneAt(x: number): ZoneDef {
  return ZONES.find((z) => x >= z.x0 && x < z.x1) ?? (x < 0 ? ZONES[0] : ZONES[2]);
}

export function xpForLevel(level: number) {
  return Math.round(100 * Math.pow(level, 1.6));
}

export const MAX_LEVEL = 20;

export interface InvSlot {
  id: string;
  qty: number;
}

export type Equipment = Partial<Record<Slot, string>>;

export interface PlayerRecord {
  _id: string;
  username: string;
  race?: RaceId;
  class_name?: ClassId;
  level?: number;
  xp?: number;
  gold?: number;
  zone?: string;
  pos_x?: number;
  pos_z?: number;
  inventory?: string;
  equipment?: string;
  kills?: number;
  graphics?: "low" | "normal" | "high";
  last_login?: string;
}

export const INVENTORY_SIZE = 32;

export function computeStats(race: RaceDef, cls: ClassDef, level: number, equipment: Equipment) {
  const s = { str: 5, agi: 5, int: 5, sta: 6, armor: 0, dmg: 3 };
  s[cls.primary] += 4;
  for (const k of Object.keys(race.bonus) as (keyof Stats)[]) s[k] += race.bonus[k] ?? 0;
  s.str += level * (cls.primary === "str" ? 2 : 1);
  s.agi += level * (cls.primary === "agi" ? 2 : 1);
  s.int += level * (cls.primary === "int" ? 2 : 1);
  s.sta += level * 2;
  for (const id of Object.values(equipment)) {
    const it = id ? ITEMS[id] : undefined;
    if (!it?.stats) continue;
    for (const k of Object.keys(it.stats) as (keyof Stats)[]) s[k] += it.stats[k] ?? 0;
  }
  const maxHp = 60 + s.sta * 12;
  const maxRes = cls.resource === "Maná" ? 60 + s.int * 10 : 100;
  const attack = s.dmg + s[cls.primary] * 0.8;
  const mitigation = Math.min(0.75, s.armor / (s.armor + 60 + level * 8));
  return { ...s, maxHp, maxRes, attack, mitigation };
}
