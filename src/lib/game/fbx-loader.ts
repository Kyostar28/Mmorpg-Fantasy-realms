// FBX model loader for character classes with animations and weapon slots
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export interface FBXModel {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  animations: Map<string, THREE.AnimationClip>;
  originalMaterials: Map<THREE.Mesh, THREE.Material>;
  currentAction: THREE.AnimationAction | null;
  currentState: string;
}

const loader = new FBXLoader();

export const CLASS_MODELS: Record<string, string> = {
  warrior: "/Warriorfixed.fbx",
  paladin: "/pjs/Characters/fbx/Knight.fbx",
  assassin: "/pjs/Characters/fbx/Rogue_Hooded.fbx",
  hunter: "/pjs/Characters/fbx/Ranger.fbx",
  mage: "/pjs/Characters/fbx/Mage.fbx",
  warlock: "/pjs/Characters/fbx/Mage.fbx",
};

export const CLASS_TEXTURES: Record<string, string> = {
  warrior: "/pjs/Characters/fbx/knight_texture.png",
  paladin: "/pjs/Characters/fbx/knight_texture.png",
  assassin: "/pjs/Characters/fbx/rogue_texture.png",
  hunter: "/pjs/Characters/fbx/ranger_texture.png",
  mage: "/pjs/Characters/fbx/mage_texture.png",
  warlock: "/pjs/Characters/fbx/mage_texture.png",
};

export const CLASS_WEAPONS: Record<string, string> = {
  warrior: "/pjs/Assets/fbx/sword_1handed.fbx",
  paladin: "/pjs/Assets/fbx/sword_1handed.fbx",
  assassin: "/pjs/Assets/fbx/dagger.fbx",
  hunter: "/pjs/Assets/fbx/bow.fbx",
  mage: "/pjs/Assets/fbx/staff.fbx",
  warlock: "/pjs/Assets/fbx/staff.fbx",
};

export const CLASS_SHIELDS: Record<string, string> = {
  paladin: "/pjs/Assets/fbx/shield_round.fbx",
};

// Configuración precisa de armas para KayKit
export interface WeaponSlotConfig {
  hand: "right" | "left" | "both"; // 'both' para clases como el pícaro / asesino
  scale: number;
  // Offset para que la mano agarre el mango y no el centro de la hoja/vara:
  position: [number, number, number];
  rotation: [number, number, number];
  // Ajuste específico si lleva arma secundaria en la mano izquierda:
  leftHandRotation?: [number, number, number];
  leftHandPosition?: [number, number, number];
  // Configuración de escudo (opcional)
  shield?: {
    scale: number;
    position: [number, number, number];
    rotation: [number, number, number];
  };
}

export const WEAPON_CONFIG: Record<string, WeaponSlotConfig> = {
  // Guerrero (Espada de 1 mano en mano derecha)
  warrior: {
    hand: "right",
    scale: 0.009,
    position: [0, -0.15, 0], // Agarre sobre la empuñadura
    rotation: [0, 0, 0], // Espada orientada hacia adelante en el agarre
  },
  // Paladín (Espada en mano derecha + Escudo en mano izquierda)
  paladin: {
    hand: "right",
    scale: 0.009,
    position: [0, -0.15, 0],
    rotation: [0, 0, 0],
    shield: {
      scale: 0.009,
      position: [0, 0, 0.04],
      rotation: [Math.PI / 2, 0, 0], // Escudo plano cubriendo hacia adelante
    },
  },
  // Asesino (Dagas duales en ambas manos)
  assassin: {
    hand: "both",
    scale: 0.0085,
    position: [0, -0.08, 0],
    rotation: [0, 0, 0],
    leftHandPosition: [0, -0.08, 0],
    leftHandRotation: [0, 0, 0],
  },
  // Cazador (Arco vertical en mano izquierda)
  hunter: {
    hand: "left",
    scale: 0.009,
    position: [0, 0, 0],
    rotation: [0, 0, Math.PI / 2], // Arco vertical en el puño izquierdo
  },
  // Mago (Báculo erguido en mano derecha)
  mage: {
    hand: "right",
    scale: 0.0085,
    position: [0, -0.3, 0], // Sujeción a media altura
    rotation: [Math.PI / 2, 0, 0], // Báculo vertical hacia arriba
  },
  // Brujo (Báculo erguido en mano derecha)
  warlock: {
    hand: "right",
    scale: 0.0085,
    position: [0, -0.3, 0],
    rotation: [Math.PI / 2, 0, 0],
  },
};

export const ANIMATION_FILES = {
  general: "/pjs/Animations/fbx/Rig_Medium/Rig_Medium_General.fbx",
  movement: "/pjs/Animations/fbx/Rig_Medium/Rig_Medium_MovementBasic.fbx",
};

/**
 * Función auxiliar para buscar el hueso correcto del slot de mano.
 * KayKit usa específicamente los huesos 'handslotr' y 'handslotl'.
 */
function getBoneSlot(character: THREE.Object3D, side: "r" | "l"): THREE.Bone | null {
  // Prioridad absoluta a los huesos de slot de agarre de KayKit
  const targetNames = side === "r" 
    ? ["handslotr", "handslot.r", "handslot_r", "handslotright", "righthand", "handr"]
    : ["handslotl", "handslot.l", "handslot_l", "handslotleft", "lefthand", "handl"];

  let bestBone: THREE.Bone | null = null;
  let bestRank = 999;

  character.traverse((child) => {
    if (child instanceof THREE.Bone) {
      const cleanName = child.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const idx = targetNames.findIndex((target) => cleanName === target || cleanName.includes(target));
      if (idx !== -1 && idx < bestRank) {
        bestRank = idx;
        bestBone = child;
      }
    }
  });

  return bestBone;
}

export async function loadClassModel(
  classId: string,
  primaryColor?: string,
  secondaryColor?: string
): Promise<FBXModel> {
  const modelPath = CLASS_MODELS[classId];
  const texturePath = CLASS_TEXTURES[classId];
  const weaponPath = CLASS_WEAPONS[classId];
  const shieldPath = CLASS_SHIELDS[classId];

  console.log(`[FBX Loader] Loading model for class: ${classId}, path: ${modelPath}`);

  if (!modelPath) {
    throw new Error(`No model found for class: ${classId}`);
  }

  // 1. Cargar el personaje
  const object = await loader.loadAsync(modelPath);
  console.log(`[FBX Loader] Model loaded successfully. Object children: ${object.children.length}, Animations: ${object.animations?.length || 0}`);
  const root = new THREE.Group();
  root.add(object);

  // 2. Guardar materiales originales
  const originalMaterials = new Map<THREE.Mesh, THREE.Material>();
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      originalMaterials.set(child, child.material.clone());
    }
  });

  // 3. Aplicar textura base del personaje (skip for warrior as it has embedded textures)
  if (texturePath && classId !== "warrior") {
    const textureLoader = new THREE.TextureLoader();
    try {
      const texture = await textureLoader.loadAsync(texturePath);
      texture.colorSpace = THREE.SRGBColorSpace;

      object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.map = texture;
              mat.needsUpdate = true;
            }
          });
        }
      });
    } catch (e) {
      console.warn(`Failed to load texture ${texturePath}:`, e);
    }
  }

  // 4. Cargar y acoplar el arma (skip for warrior as it has embedded weapons)
  if (weaponPath && WEAPON_CONFIG[classId] && classId !== "warrior") {
    try {
      const config = WEAPON_CONFIG[classId];
      const weaponFBX = await loader.loadAsync(weaponPath);

      // Ajustar materiales del arma si es necesario
      weaponFBX.traverse((c) => {
        if (c instanceof THREE.Mesh) c.castShadow = true;
      });

      // 1. Equipar mano derecha
      if (config.hand === "right" || config.hand === "both") {
        const rightBone = getBoneSlot(object, "r");
        if (rightBone) {
          const rightWeapon = weaponFBX.clone();
          rightWeapon.scale.setScalar(config.scale);
          rightWeapon.position.set(...config.position);
          rightWeapon.rotation.set(...config.rotation);
          rightBone.add(rightWeapon);
          console.log(`[FBX] Arma acoplada a mano derecha (${rightBone.name})`);
        }
      }

      // 2. Equipar mano izquierda (para el pícaro con dos dagas o arquero con arco)
      if (config.hand === "left" || config.hand === "both") {
        const leftBone = getBoneSlot(object, "l");
        if (leftBone) {
          const leftWeapon = weaponFBX.clone();
          leftWeapon.scale.setScalar(config.scale);

          const pos = config.leftHandPosition || config.position;
          const rot = config.leftHandRotation || config.rotation;

          leftWeapon.position.set(...pos);
          leftWeapon.rotation.set(...rot);
          leftBone.add(leftWeapon);
          console.log(`[FBX] Arma acoplada a mano izquierda (${leftBone.name})`);
        }
      }
    } catch (err) {
      console.error(`Error cargando arma ${weaponPath}:`, err);
    }
  }

  // 5. Cargar y acoplar el escudo (si existe, skip for warrior as it has embedded assets)
  if (shieldPath && WEAPON_CONFIG[classId]?.shield && classId !== "warrior") {
    try {
      const config = WEAPON_CONFIG[classId]!;
      const shieldConfig = config.shield!;
      const shieldFBX = await loader.loadAsync(shieldPath);

      // Ajustar materiales del escudo
      shieldFBX.traverse((c) => {
        if (c instanceof THREE.Mesh) c.castShadow = true;
      });

      // Equipar escudo en mano izquierda
      const leftBone = getBoneSlot(object, "l");
      if (leftBone) {
        shieldFBX.scale.setScalar(shieldConfig.scale);
        shieldFBX.position.set(...shieldConfig.position);
        shieldFBX.rotation.set(...shieldConfig.rotation);
        leftBone.add(shieldFBX);
        console.log(`[FBX] Escudo acoplado a mano izquierda (${leftBone.name})`);
      }
    } catch (err) {
      console.error(`Error cargando escudo ${shieldPath}:`, err);
    }
  }

  // 6. Aplicar colorización si se proporcionan colores
  if (primaryColor || secondaryColor) {
    applyColorCustomization(object, primaryColor || "#c79c6e", secondaryColor || "#5a3b22");
  }

  // 7. Animaciones
  const mixer = new THREE.AnimationMixer(object);
  const animations = new Map<string, THREE.AnimationClip>();

  // Check if the model has embedded animations (like Warriorfixed.fbx)
  if (object.animations && object.animations.length > 0) {
    object.animations.forEach((clip) => animations.set(clip.name, clip));
    console.log(`[FBX Loader] Using ${object.animations.length} embedded animations from model:`, object.animations.map(a => a.name));
  } else {
    // Fall back to loading separate animation files
    try {
      const generalAnim = await loader.loadAsync(ANIMATION_FILES.general);
      generalAnim.animations.forEach((clip) => animations.set(clip.name, clip));
      console.log(`[FBX Loader] Loaded ${generalAnim.animations.length} general animations:`, generalAnim.animations.map(a => a.name));
    } catch (e) {
      console.warn("Failed to load general animations:", e);
    }

    try {
      const movementAnim = await loader.loadAsync(ANIMATION_FILES.movement);
      movementAnim.animations.forEach((clip) => animations.set(clip.name, clip));
      console.log(`[FBX Loader] Loaded ${movementAnim.animations.length} movement animations:`, movementAnim.animations.map(a => a.name));
    } catch (e) {
      console.warn("Failed to load movement animations:", e);
    }
  }

  console.log(`[FBX Loader] Total animations available for ${classId}:`, Array.from(animations.keys()));

  // Log model bounds for debugging
  const box = new THREE.Box3().setFromObject(object);
  console.log(`[FBX Loader] Model bounds:`, box);
  console.log(`[FBX Loader] Model size:`, {
    width: box.max.x - box.min.x,
    height: box.max.y - box.min.y,
    depth: box.max.z - box.min.z
  });

  return { root, mixer, animations, originalMaterials, currentAction: null, currentState: "" };
}

function applyColorCustomization(
  object: THREE.Object3D,
  primaryColor: string,
  secondaryColor: string
) {
  const primary = new THREE.Color(primaryColor);
  const secondary = new THREE.Color(secondaryColor);

  object.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      const name = child.name.toLowerCase();
      const mat = child.material instanceof THREE.MeshStandardMaterial
        ? child.material
        : (Array.isArray(child.material) ? child.material[0] : child.material);

      if (mat instanceof THREE.MeshStandardMaterial) {
        if (/head$/i.test(name)) {
          // El rostro/piel/ojos conserva la textura original limpia (sin teñir la cara de color sólido)
          mat.color.setRGB(1, 1, 1);
        } else if (/cape|helm|visor|hat|mask|quiver|bear/i.test(name)) {
          // Accesorios secundarios: capa, yelmo, visor, capucha, carcaj
          mat.color.copy(secondary);
        } else {
          // Ropa/armadura principal: torso, brazos, piernas
          mat.color.copy(primary);
        }
        mat.needsUpdate = true;
      }
    }
  });
}

export function updateModelColors(
  model: FBXModel,
  primaryColor: string,
  secondaryColor: string
) {
  model.root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const original = model.originalMaterials.get(child);
      if (original) {
        child.material = original.clone();
      }
    }
  });

  applyColorCustomization(model.root, primaryColor, secondaryColor);
}

export function playAnimation(model: FBXModel, name: string, loop = true, speed = 1.0) {
  const clip = model.animations.get(name);
  if (!clip) {
    console.warn(`[FBXLoader] Animación no encontrada: ${name}`);
    return null;
  }

  // Si ya está reproduciendo esta animación, ajustar velocidad si varía
  if (model.currentState === name && model.currentAction && model.currentAction.isRunning()) {
    model.currentAction.timeScale = speed;
    return model.currentAction;
  }

  const prevAction = model.currentAction;
  const action = model.mixer.clipAction(clip);
  action.reset();
  action.timeScale = speed;
  action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
  action.clampWhenFinished = !loop;

  // Transición suave entre estados para evitar cortes bruscos
  if (prevAction && prevAction !== action) {
    prevAction.fadeOut(0.12);
  }
  action.fadeIn(0.12);
  action.play();

  model.currentAction = action;
  model.currentState = name;

  return action;
}

/**
 * Helper function to find the best matching animation name from a list of possibilities
 */
function findAnimationName(model: FBXModel, possibleNames: string[]): string | null {
  for (const name of possibleNames) {
    if (model.animations.has(name)) {
      return name;
    }
  }
  return null;
}

/**
 * Cambia la animación basándose en el estado del personaje con transiciones y velocidades óptimas
 */
export function setAnimationByState(model: FBXModel, state: string, moveSpeed = 0, isRunning = false) {
  let animName = "Idle_A";
  let loop = true;
  let speed = 1.0;

  switch (state) {
    case "idle":
      animName = findAnimationName(model, ["Idle", "Idle_A", "Stand", "Wait"]) || "Idle_A";
      loop = true;
      speed = 1.0;
      break;
    case "walk":
      animName = findAnimationName(model, ["Walk", "Walking", "Walking_A", "Forward"]) || "Walking_A";
      loop = true;
      speed = 1.1;
      break;
    case "run":
      animName = findAnimationName(model, ["Run", "Running", "Running_A", "Sprint"]) || "Running_A";
      loop = true;
      speed = 1.25;
      break;
    case "attack":
      // Try multiple attack animation names
      animName = findAnimationName(model, ["Attack", "Attack_01", "Attack_1", "Melee", "Slash", "Strike", "Use_Item", "Throw"]) || "Attack";
      loop = false;
      speed = 2.4;
      break;
    case "cast":
      animName = findAnimationName(model, ["Cast", "Spell", "Magic", "Interact", "Throw"]) || "Cast";
      loop = false;
      speed = 2.0;
      break;
    case "channel":
      animName = findAnimationName(model, ["Channel", "Cast", "Idle", "Idle_A"]) || "Idle_A";
      loop = true;
      speed = 1.0;
      break;
    case "hit":
      animName = findAnimationName(model, ["Hit", "Hit_A", "Damage", "TakeDamage"]) || "Hit_A";
      loop = false;
      speed = 1.8;
      break;
    case "death":
      animName = findAnimationName(model, ["Death", "Death_A", "Die", "Fall"]) || "Death_A";
      loop = false;
      speed = 1.0;
      break;
    case "jump_start":
      animName = findAnimationName(model, ["Jump_Start", "JumpUp", "Jump"]) || "Jump_Start";
      loop = false;
      speed = 1.2;
      break;
    case "jump_idle":
      animName = findAnimationName(model, ["Jump_Idle", "JumpLoop", "JumpAir"]) || "Jump_Idle";
      loop = true;
      speed = 1.0;
      break;
    case "jump_land":
      animName = findAnimationName(model, ["Jump_Land", "JumpDown", "Land"]) || "Jump_Land";
      loop = false;
      speed = 1.4;
      break;
    default:
      animName = findAnimationName(model, ["Idle", "Idle_A"]) || "Idle_A";
      break;
  }

  return playAnimation(model, animName, loop, speed);
}

export function disposeModel(model: FBXModel) {
  model.mixer.stopAllAction();
  model.root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (Array.isArray(child.material)) {
        child.material.forEach((mat) => mat.dispose());
      } else {
        child.material.dispose();
      }
      child.geometry.dispose();
    }
  });
  model.root.clear();
}
