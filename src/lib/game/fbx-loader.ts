// FBX model loader for character classes with animations and color customization
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export interface FBXModel {
  root: THREE.Group;
  mixer: THREE.AnimationMixer;
  animations: Map<string, THREE.AnimationClip>;
  originalMaterials: Map<THREE.Mesh, THREE.Material>;
}

const loader = new FBXLoader();
const modelCache = new Map<string, FBXModel>();

export const CLASS_MODELS: Record<string, string> = {
  warrior: "/pjs/Characters/fbx/Knight.fbx",
  paladin: "/pjs/Characters/fbx/Knight.fbx",
  assassin: "/pjs/Characters/fbx/Rogue_Hooded.fbx",
  hunter: "/pjs/Characters/fbx/Ranger.fbx",
  mage: "/pjs/Characters/fbx/Mage.fbx",
  warlock: "/pjs/Characters/fbx/Mage.fbx", // Temporal hasta tener el modelo
};

export const CLASS_TEXTURES: Record<string, string> = {
  warrior: "/pjs/Characters/fbx/knight_texture.png",
  paladin: "/pjs/Characters/fbx/knight_texture.png",
  assassin: "/pjs/Characters/fbx/rogue_texture.png",
  hunter: "/pjs/Characters/fbx/ranger_texture.png",
  mage: "/pjs/Characters/fbx/mage_texture.png",
  warlock: "/pjs/Characters/fbx/mage_texture.png",
};

export const ANIMATION_FILES = {
  general: "/pjs/Animations/fbx/Rig_Medium/Rig_Medium_General.fbx",
  movement: "/pjs/Animations/fbx/Rig_Medium/Rig_Medium_MovementBasic.fbx",
};

export async function loadClassModel(
  classId: string,
  primaryColor: string,
  secondaryColor: string
): Promise<FBXModel> {
  const cacheKey = `${classId}_${primaryColor}_${secondaryColor}`;
  if (modelCache.has(cacheKey)) {
    return modelCache.get(cacheKey)!;
  }

  const modelPath = CLASS_MODELS[classId];
  const texturePath = CLASS_TEXTURES[classId];

  if (!modelPath) {
    throw new Error(`No model found for class: ${classId}`);
  }

  // Load the model
  const object = await loader.loadAsync(modelPath);
  const root = new THREE.Group();
  root.add(object);

  // Store original materials
  const originalMaterials = new Map<THREE.Mesh, THREE.Material>();
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      originalMaterials.set(child, child.material.clone());
    }
  });

  // Load and apply texture
  if (texturePath) {
    const textureLoader = new THREE.TextureLoader();
    try {
      const texture = await textureLoader.loadAsync(texturePath);
      texture.colorSpace = THREE.SRGBColorSpace;
      
      object.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if (mat instanceof THREE.MeshStandardMaterial) {
                mat.map = texture;
                mat.needsUpdate = true;
              }
            });
          } else if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.map = texture;
            child.material.needsUpdate = true;
          }
        }
      });
    } catch (e) {
      console.warn(`Failed to load texture ${texturePath}:`, e);
    }
  }

  // Apply color customization
  applyColorCustomization(object, primaryColor, secondaryColor);

  // Create animation mixer
  const mixer = new THREE.AnimationMixer(object);
  const animations = new Map<string, THREE.AnimationClip>();

  // Load animations
  try {
    const generalAnim = await loader.loadAsync(ANIMATION_FILES.general);
    console.log("[FBX Loader] General animations:", generalAnim.animations.map(a => a.name));
    generalAnim.animations.forEach((clip) => {
      animations.set(clip.name, clip);
    });
  } catch (e) {
    console.warn("Failed to load general animations:", e);
  }

  try {
    const movementAnim = await loader.loadAsync(ANIMATION_FILES.movement);
    console.log("[FBX Loader] Movement animations:", movementAnim.animations.map(a => a.name));
    movementAnim.animations.forEach((clip) => {
      animations.set(clip.name, clip);
    });
  } catch (e) {
    console.warn("Failed to load movement animations:", e);
  }

  console.log("[FBX Loader] All available animations:", Array.from(animations.keys()));

  const model: FBXModel = {
    root,
    mixer,
    animations,
    originalMaterials,
  };

  modelCache.set(cacheKey, model);
  return model;
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
          // Apply primary color to first material, secondary to others
          if (index === 0) {
            mat.color = primary.clone();
          } else {
            mat.color = secondary.clone();
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
  // Restore original materials first
  model.root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const original = model.originalMaterials.get(child);
      if (original) {
        child.material = original.clone();
      }
    }
  });

  // Apply new colors
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
  if (loop) {
    action.loop = THREE.LoopRepeat;
  } else {
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
  }
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
