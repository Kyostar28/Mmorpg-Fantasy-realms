// FBX model loader for character classes with animations and weapon slots
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export interface FBXModel {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  animations: Map<string, THREE.AnimationClip>;
  originalMaterials: Map<THREE.Mesh, THREE.Material>;
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

// Configuración calibrada para KayKit Rig_Medium
export const WEAPON_CONFIG: Record<
  string,
  {
    targetLength: number; // Largo deseado en unidades (1.0 = ~1 metro)
    position: [number, number, number];
    rotation: [number, number, number];
    hand: "r" | "l";
  }
> = {
  warrior: {
    targetLength: 1.1, // Espada de una mano
    position: [0, 0, 0],
    rotation: [0, 0, -Math.PI / 2],
    hand: "r",
  },
  paladin: {
    targetLength: 1.1,
    position: [0, 0, 0],
    rotation: [0, 0, -Math.PI / 2],
    hand: "r",
  },
  assassin: {
    targetLength: 0.6, // Daga
    position: [0, 0, 0],
    rotation: [0, 0, -Math.PI / 2],
    hand: "r",
  },
  hunter: {
    targetLength: 1.3, // Arco (va en mano izquierda o derecha según tu animación)
    position: [0, 0, 0],
    rotation: [0, Math.PI / 2, -Math.PI / 2],
    hand: "r",
  },
  mage: {
    targetLength: 1.7, // Báculo de mago
    position: [0, -0.2, 0],
    rotation: [0, 0, -Math.PI / 2],
    hand: "r",
  },
  warlock: {
    targetLength: 1.7,
    position: [0, -0.2, 0],
    rotation: [0, 0, -Math.PI / 2],
    hand: "r",
  },
};

export const ANIMATION_FILES = {
  general: "/pjs/Animations/fbx/Rig_Medium/Rig_Medium_General.fbx",
  movement: "/pjs/Animations/fbx/Rig_Medium/Rig_Medium_MovementBasic.fbx",
};

/**
 * Busca específicamente el hueso del slot de la mano en el esqueleto.
 * Three.js remueve puntos/símbolos, por lo que busca 'handslotr' o 'handr'.
 */
function findHandSlotBone(object: THREE.Object3D, side: "r" | "l"): THREE.Object3D | null {
  const targetSlot = `handslot${side}`;
  const targetHand = `hand${side}`;

  let slotBone: THREE.Object3D | null = null;
  let handFallback: THREE.Object3D | null = null;

  object.traverse((child) => {
    // Solo nos interesan los huesos (evita SkinnedMesh como Knight_ArmRight)
    if ((child as any).isBone || child.type === "Bone") {
      const cleanName = child.name.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (cleanName === targetSlot && !slotBone) {
        slotBone = child;
      } else if (cleanName === targetHand && !handFallback) {
        handFallback = child;
      }
    }
  });

  return slotBone || handFallback;
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
  if (weaponPath) {
    try {
      const weaponObject = await loader.loadAsync(weaponPath);
      const config = WEAPON_CONFIG[classId] || {
        targetLength: 1.0,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        hand: "r",
      };

      // Auto-escalado según las dimensiones reales del archivo FBX del arma
      const box = new THREE.Box3().setFromObject(weaponObject);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDimension = Math.max(size.x, size.y, size.z);

      if (maxDimension > 0) {
        const finalScale = config.targetLength / maxDimension;
        weaponObject.scale.setScalar(finalScale);
      }

      // Buscar el hueso exacto de la mano
      const handBone = findHandSlotBone(object, config.hand);

      if (handBone) {
        handBone.add(weaponObject);
        weaponObject.position.set(...config.position);
        weaponObject.rotation.set(...config.rotation);
        console.log(`[FBX] Arma acoplada exitosamente a ${handBone.name}`);
      } else {
        console.error(`[FBX] No se encontró el hueso handslot para ${classId}`);
      }
    } catch (e) {
      console.error(`Failed to load weapon ${weaponPath}:`, e);
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

  return { root, mixer, animations, originalMaterials };
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

  const action = model.mixer.clipAction(clip);
  action.reset();
  action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
  action.clampWhenFinished = !loop;
  action.play();
  return action;
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
