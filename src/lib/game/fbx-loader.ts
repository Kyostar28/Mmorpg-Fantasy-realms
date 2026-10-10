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
  warrior: "/pjs/Characters/fbx/Knight.fbx",
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
}

export const WEAPON_CONFIG: Record<string, WeaponSlotConfig> = {
  // Guerrero / Paladín (Espada en mano derecha)
  warrior: {
    hand: "right",
    scale: 0.01,
    position: [0, -0.15, 0], // Baja el arma para sujetarla por el mango
    rotation: [-Math.PI / 2, 0, 0], // Hoja hacia arriba / frente
  },
  paladin: {
    hand: "right",
    scale: 0.01,
    position: [0, -0.15, 0],
    rotation: [-Math.PI / 2, 0, 0],
  },

  // Pícaro / Asesino (Dagas duales: derecha e izquierda)
  assassin: {
    hand: "both",
    scale: 0.009,
    position: [0, -0.08, 0],
    rotation: [-Math.PI / 2, 0, 0],
    leftHandPosition: [0, -0.08, 0],
    leftHandRotation: [-Math.PI / 2, Math.PI, 0], // Espejada para la mano izquierda
  },

  // Cazador (Arco en mano izquierda para disparar con la derecha)
  hunter: {
    hand: "left",
    scale: 0.011,
    position: [0, 0, 0.05],
    rotation: [0, Math.PI / 2, -Math.PI / 2], // Alineado con el agarre del arco
  },

  // Mago / Brujo (Báculo en mano derecha, sujeto a 1/3 de la vara)
  mage: {
    hand: "right",
    scale: 0.009,
    position: [0, -0.65, 0], // Desplaza el báculo para agarrarlo a la altura cómoda
    rotation: [-Math.PI / 2, 0, 0],
  },
  warlock: {
    hand: "right",
    scale: 0.009,
    position: [0, -0.65, 0],
    rotation: [-Math.PI / 2, 0, 0],
  },
};

export const ANIMATION_FILES = {
  general: "/pjs/Animations/fbx/Rig_Medium/Rig_Medium_General.fbx",
  movement: "/pjs/Animations/fbx/Rig_Medium/Rig_Medium_MovementBasic.fbx",
};

/**
 * Función auxiliar para buscar el hueso correcto del slot de mano.
 */
function getBoneSlot(character: THREE.Object3D, side: "r" | "l"): THREE.Bone | null {
  const targetName = side === "r" ? "handslotr" : "handslotl";
  const fallbackName = side === "r" ? "handr" : "handl";

  let slotBone: THREE.Bone | null = null;
  let fallbackBone: THREE.Bone | null = null;

  character.traverse((child) => {
    if (child instanceof THREE.Bone) {
      const cleanName = child.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanName === targetName) slotBone = child;
      if (cleanName === fallbackName) fallbackBone = child;
    }
  });

  return slotBone || fallbackBone;
}

export async function loadClassModel(
  classId: string,
  primaryColor?: string,
  secondaryColor?: string
): Promise<FBXModel> {
  const modelPath = CLASS_MODELS[classId];
  const texturePath = CLASS_TEXTURES[classId];
  const weaponPath = CLASS_WEAPONS[classId];

  if (!modelPath) {
    throw new Error(`No model found for class: ${classId}`);
  }

  // 1. Cargar el personaje
  const object = await loader.loadAsync(modelPath);
  const root = new THREE.Group();
  root.add(object);

  // 2. Guardar materiales originales
  const originalMaterials = new Map<THREE.Mesh, THREE.Material>();
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      originalMaterials.set(child, child.material.clone());
    }
  });

  // 3. Aplicar textura base del personaje
  if (texturePath) {
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

  // 4. Cargar y acoplar el arma
  if (weaponPath && WEAPON_CONFIG[classId]) {
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

  // 5. Aplicar colorización si se proporcionan colores
  if (primaryColor || secondaryColor) {
    applyColorCustomization(object, primaryColor || "#c79c6e", secondaryColor || "#5a3b22");
  }

  // 6. Animaciones
  const mixer = new THREE.AnimationMixer(object);
  const animations = new Map<string, THREE.AnimationClip>();

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

  console.log(`[FBX Loader] Total animations available for ${classId}:`, Array.from(animations.keys()));

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
      const materials = Array.isArray(child.material) ? child.material : [child.material];

      materials.forEach((mat, index) => {
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (mat.map) {
            if (index === 0) {
              mat.color = primary.clone();
            } else {
              mat.color = secondary.clone();
            }
          } else {
            if (index === 0) {
              mat.color = primary.clone();
            } else {
              mat.color = secondary.clone();
            }
          }
          mat.needsUpdate = true;
        }
      });
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

export function playAnimation(model: FBXModel, name: string, loop = true) {
  const clip = model.animations.get(name);
  if (!clip) {
    console.warn(`Animation not found: ${name}`);
    return null;
  }

  // Si ya está reproduciendo esta animación, no hacer nada
  if (model.currentState === name && model.currentAction && model.currentAction.enabled) {
    return model.currentAction;
  }

  // Detener acción anterior
  if (model.currentAction) {
    model.currentAction.stop();
  }

  const action = model.mixer.clipAction(clip);
  action.reset();
  action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
  action.clampWhenFinished = !loop;
  action.play();

  model.currentAction = action;
  model.currentState = name;

  return action;
}

/**
 * Cambia la animación basándose en el estado del personaje
 * @param model - Modelo FBX
 * @param state - Estado de animación (idle, walk, run, attack, death, etc.)
 * @param speed - Velocidad de movimiento (0-1) para seleccionar entre walk/run
 */
export function setAnimationByState(model: FBXModel, state: string, speed = 0) {
  const animName = getAnimationName(state, speed);
  if (animName) {
    const loop = state !== "death" && state !== "attack" && state !== "hit";
    return playAnimation(model, animName, loop);
  }
  return null;
}

/**
 * Obtiene el nombre de la animación correcto basado en el estado
 */
function getAnimationName(state: string, speed = 0): string | null {
  switch (state) {
    case "idle":
      return "Idle_A";
    case "walk":
      return "Walking_A";
    case "run":
      return "Running_A";
    case "attack":
      // Mientras no tengamos los archivos de combate, usar Throw
      return "Throw";
    case "death":
      return "Death_A";
    case "hit":
      return "Hit_A";
    case "jump_start":
      return "Jump_Start";
    case "jump_idle":
      return "Jump_Idle";
    case "jump_land":
      return "Jump_Land";
    case "interact":
      return "Interact";
    case "pickup":
      return "PickUp";
    case "cast":
      return "Throw"; // Usar Throw temporalmente para hechizos
    case "channel":
      return "Interact"; // Usar Interact temporalmente para canalizar
    default:
      return null;
  }
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
