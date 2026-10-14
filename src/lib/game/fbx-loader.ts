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
  warrior: "/warrior_texture.png",
  paladin: "/pjs/Characters/fbx/knight_texture.png",
  assassin: "/pjs/Characters/fbx/rogue_texture.png",
  hunter: "/pjs/Characters/fbx/ranger_texture.png",
  mage: "/pjs/Characters/fbx/mage_texture.png",
  warlock: "/pjs/Characters/fbx/mage_texture.png",
};

export const CLASS_WEAPONS: Record<string, string> = {
  warrior: "/Meshy_AI_War_Hammer_Low_Poly_1013042253_texture.fbx",
  paladin: "/pjs/Assets/fbx/sword_1handed.fbx",
  assassin: "/pjs/Assets/fbx/dagger.fbx",
  hunter: "/pjs/Assets/fbx/bow.fbx",
  mage: "/pjs/Assets/fbx/staff.fbx",
  warlock: "/pjs/Assets/fbx/staff.fbx",
};

export const WEAPON_TEXTURES: Record<string, { map: string; normalMap?: string; metalnessMap?: string; roughnessMap?: string }> = {
  warrior: {
    map: "/Meshy_AI_War_Hammer_Low_Poly_1013042253_texture.png",
    normalMap: "/Meshy_AI_War_Hammer_Low_Poly_1013042253_texture_normal.png",
    metalnessMap: "/Meshy_AI_War_Hammer_Low_Poly_1013042253_texture_metallic.png",
    roughnessMap: "/Meshy_AI_War_Hammer_Low_Poly_1013042253_texture_roughness.png",
  },
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
  // Guerrero (Martillo de guerra / Two-handed War Hammer horizontal hacia adelante)
  warrior: {
    hand: "right",
    scale: 0.38,
    position: [0, -0.4, 0.2], // Centro del martillo aproximadamente en la mano
    rotation: [Math.PI / 2, 0, 0.1], // Mango hacia abajo, cabeza hacia adelante (rotación natural de un martillo sostenido)
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
 * Modelos con rig Mixamo usan 'mixamorigRightHand' y 'mixamorigLeftHand'.
 */
function getBoneSlot(character: THREE.Object3D, side: "r" | "l"): THREE.Bone | null {
  const targetNames = side === "r" 
    ? ["handslotr", "handslot.r", "handslot_r", "handslotright", "mixamorigrighthand", "righthand", "handr"]
    : ["handslotl", "handslot.l", "handslot_l", "handslotleft", "mixamoriglefthand", "lefthand", "handl"];

  let bestBone: THREE.Bone | null = null;
  let bestRank = 999;

  character.traverse((child) => {
    if (child instanceof THREE.Bone) {
      const cleanName = child.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanName.endsWith("end")) return;
      const idx = targetNames.findIndex((target) => cleanName === target || cleanName.includes(target));
      if (idx !== -1 && idx < bestRank) {
        bestRank = idx;
        bestBone = child;
      }
    }
  });

  return bestBone;
}

/**
 * Genera una animación de reposo (idle) natural con respiración sutil y postura de combate
 * para evitar que el modelo quede estático en T-pose. Usa la pose actual de los huesos
 * (la pose del modelo al cargar, que es la pose base exportada de Mixamo).
 */
function createWarriorIdleClip(character: THREE.Object3D): THREE.AnimationClip {
  // Usar la pose base del modelo (la pose con la que se cargó el FBX, generalmente
  // la pose de "Stand" o A-pose de Mixamo, que es la mejor aproximación a un reposo natural)
  character.updateMatrixWorld(true);

  const duration = 2.4;
  const times = [0, 1.2, 2.4];
  const tracks: THREE.KeyframeTrack[] = [];

  character.traverse((child) => {
    if (child instanceof THREE.Bone) {
      const p = child.position.clone();
      const q = child.quaternion.clone();
      const s = child.scale.clone();

      // Respiración sutil SOLO en la columna (Spine), no en la cabeza
      // (la cabeza debe permanecer estable para evitar movimientos bruscos)
      let pValues: number[];
      if (child.name.toLowerCase().includes("spine")) {
        pValues = [
          p.x, p.y, p.z,
          p.x, p.y + 0.015, p.z,  // Movimiento vertical muy sutil (1.5cm)
          p.x, p.y, p.z,
        ];
      } else {
        pValues = [p.x, p.y, p.z, p.x, p.y, p.z, p.x, p.y, p.z];
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${child.name}.position`, times, pValues));

      // Rotación sutil de respiración en columna (Spine1 y Spine2)
      let qValues: number[];
      const nameLower = child.name.toLowerCase();
      if (nameLower === "mixamorigspine1" || nameLower === "mixamorigspine2" || nameLower === "spine1" || nameLower === "spine2") {
        const qBreathe = q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.015));
        qValues = [
          q.x, q.y, q.z, q.w,
          qBreathe.x, qBreathe.y, qBreathe.z, qBreathe.w,
          q.x, q.y, q.z, q.w,
        ];
      } else {
        qValues = [q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w, q.x, q.y, q.z, q.w];
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${child.name}.quaternion`, times, qValues));
      tracks.push(new THREE.VectorKeyframeTrack(`${child.name}.scale`, times, [s.x, s.y, s.z, s.x, s.y, s.z, s.x, s.y, s.z]));
    }
  });

  return new THREE.AnimationClip("Warrior_Idle", duration, tracks);
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

  // Normalizar escala y pisada en el suelo para modelos en unidades grandes (ej. Warriorfixed.fbx)
  const initialBox = new THREE.Box3().setFromObject(object);
  const modelHeight = initialBox.max.y - initialBox.min.y;
  if (modelHeight > 10) {
    const targetHeight = 2.54; // Altura estándar equivalente a Knight.fbx
    const normFactor = targetHeight / modelHeight;
    object.scale.setScalar(normFactor);
    object.position.y = -initialBox.min.y * normFactor; // Apoyar pies firmemente en el suelo (y=0)
  }

  // Log all children names for debugging
  object.traverse((child) => {
    console.log(`[FBX Loader] Child: ${child.name}, type: ${child.type}`);
  });

  // 2. Guardar materiales originales
  const originalMaterials = new Map<THREE.Mesh, THREE.Material>();
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      originalMaterials.set(child, child.material.clone());
    }
  });

  // 3. Aplicar textura base del personaje, mapa de normales y Shade Smooth
  if (texturePath) {
    const textureLoader = new THREE.TextureLoader();
    try {
      const texture = await textureLoader.loadAsync(texturePath);
      texture.colorSpace = THREE.SRGBColorSpace;

      let normalTexture: THREE.Texture | null = null;
      if (classId === "warrior") {
        try {
          normalTexture = await textureLoader.loadAsync("/warrior_texture_normal.png");
        } catch (ne) {
          console.warn("Failed to load warrior normal map:", ne);
        }
      }

      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          // Activar "Shade Smooth" (Suavizado de normales) en la geometría
          child.geometry.computeVertexNormals();

          if (classId === "warrior") {
            // Material PBR para guerrero: armadura mate con relieve 3D.
            // Valores equilibrados para que los colores del mapa se respeten
            // y no se oscurezcan por reflejo del ambiente del juego.
            child.material = new THREE.MeshStandardMaterial({
              map: texture,
              normalMap: normalTexture || undefined,
              normalScale: new THREE.Vector2(1.2, 1.2),
              color: new THREE.Color(0xffffff), // Base blanca: respeta el color del mapa de texturas
              roughness: 0.7, // Rugoso: no refleja el ambiente oscuro, mantiene los colores reales
              metalness: 0.15, // Apenas metálico: volumen sutil sin "espejo" que oscurece
              flatShading: false, // Suavizado de sombreado (Shade Smooth)
            });
            child.castShadow = true;
            child.receiveShadow = true;
          } else if (child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat) => {
              if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhongMaterial) {
                mat.map = texture;
                mat.color.setRGB(1, 1, 1);
                mat.flatShading = false;
                mat.needsUpdate = true;
              }
            });
          }
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

      // Activar Shade Smooth en el arma
      weaponFBX.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.computeVertexNormals();
        }
      });

      // Cargar y aplicar texturas PBR y Normal Map al arma
      const texConfig = WEAPON_TEXTURES[classId];
      if (texConfig) {
        try {
          const textureLoader = new THREE.TextureLoader();
          const baseMap = await textureLoader.loadAsync(texConfig.map);
          baseMap.colorSpace = THREE.SRGBColorSpace;
          const normalMap = texConfig.normalMap ? await textureLoader.loadAsync(texConfig.normalMap) : null;
          const metalMap = texConfig.metalnessMap ? await textureLoader.loadAsync(texConfig.metalnessMap) : null;
          const roughMap = texConfig.roughnessMap ? await textureLoader.loadAsync(texConfig.roughnessMap) : null;

          weaponFBX.traverse((c) => {
            if (c instanceof THREE.Mesh) {
              c.material = new THREE.MeshStandardMaterial({
                map: baseMap,
                normalMap: normalMap || undefined,
                normalScale: new THREE.Vector2(1.2, 1.2),
                metalnessMap: metalMap || undefined,
                roughnessMap: roughMap || undefined,
                color: new THREE.Color(0xffffff),
                metalness: metalMap ? 1.0 : 0.65,
                roughness: 0.35, // Rugosidad en 0.35 para reflejos metálicos
                flatShading: false, // Shade Smooth
              });
              c.castShadow = true;
              c.receiveShadow = true;
            }
          });
        } catch (texErr) {
          console.warn(`[FBX Loader] Error loading weapon textures:`, texErr);
        }
      } else {
        weaponFBX.traverse((c) => {
          if (c instanceof THREE.Mesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });
      }

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

  // 6. Aplicar colorización si se proporcionan colores (skip for warrior)
  if ((primaryColor || secondaryColor) && classId !== "warrior") {
    applyColorCustomization(object, primaryColor || "#c79c6e", secondaryColor || "#5a3b22");
  }

  // 7. Animaciones
  const mixer = new THREE.AnimationMixer(object);
  const animations = new Map<string, THREE.AnimationClip>();

  // Check if the model has embedded animations (like Warriorfixed.fbx)
  if (object.animations && object.animations.length > 0) {
    object.animations.forEach((clip) => {
      animations.set(clip.name, clip);
      const parts = clip.name.split("|");
      const shortName = parts[parts.length - 1];
      animations.set(shortName, clip);
      animations.set(shortName.toLowerCase(), clip);

      const lower = clip.name.toLowerCase();
      if (lower.includes("sword_slash") || (lower.includes("slash") && !lower.includes("charged"))) {
        animations.set("attack", clip);
        animations.set("Attack", clip);
        animations.set("Attack_01", clip);
        animations.set("Slash", clip);
      }
      if (lower.includes("charged_slash")) {
        animations.set("charged_attack", clip);
        animations.set("attack_heavy", clip);
      }
      if (lower.includes("spartan_kick") || lower.includes("kick")) {
        animations.set("kick", clip);
      }
      if (lower.includes("skill_01") || lower.includes("skill")) {
        animations.set("skill", clip);
        animations.set("cast", clip);
        animations.set("Cast", clip);
      }
      if (lower.includes("block")) {
        animations.set("block", clip);
        animations.set("channel", clip);
      }
      if (lower.includes("walking")) {
        animations.set("walk", clip);
        animations.set("Walk", clip);
        animations.set("Walking", clip);
        animations.set("Walking_A", clip);
      }
      if (lower.includes("running")) {
        animations.set("run", clip);
        animations.set("Run", clip);
        animations.set("Running", clip);
        animations.set("Running_A", clip);
      }
      if (lower.includes("hit_reaction") || lower.includes("hit")) {
        animations.set("hit", clip);
        animations.set("Hit", clip);
        animations.set("Hit_A", clip);
      }
      if (lower.includes("dead") || lower.includes("death")) {
        animations.set("death", clip);
        animations.set("Death", clip);
        animations.set("Dead", clip);
      }
      // Detectar clip de "idle" embebido (Idle, Idle_A, etc.) — útil para modelos Mixamo
      if (lower === "idle" || lower.startsWith("idle|") || lower === "idle_a" || lower === "stand" || lower === "wait") {
        animations.set("idle", clip);
        animations.set("Idle", clip);
        animations.set("Idle_A", clip);
      }
    });

    // Si el modelo no trae un clip de "idle" embebido, generar uno procedural
    // con respiración sutil para evitar que quede en T-pose
    if (!animations.has("idle") && classId === "warrior") {
      const idleClip = createWarriorIdleClip(object);
      animations.set("idle", idleClip);
      animations.set("Idle", idleClip);
      animations.set("Idle_A", idleClip);
      animations.set("Warrior_Idle", idleClip);
      animations.set("stand", idleClip);
    }

    console.log(`[FBX Loader] Using ${object.animations.length} embedded animations with aliases:`, Array.from(animations.keys()));
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
  // Si el modelo es el guerrero (malla char1 con textura propia 4K), no sobreescribir con tinte plano
  let isWarrior = false;
  model.root.traverse((child) => {
    if (child.name === "char1") isWarrior = true;
  });
  if (isWarrior) return;

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
  const keys = Array.from(model.animations.keys());
  for (const name of possibleNames) {
    const lower = name.toLowerCase();
    const found = keys.find((k) => k.toLowerCase() === lower || k.toLowerCase().includes(lower));
    if (found) return found;
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
      animName = findAnimationName(model, ["Warrior_Idle", "idle", "Idle", "Idle_A", "Stand", "Wait"]) || "Idle_A";
      loop = true;
      speed = 1.0;
      break;
    case "walk":
      animName = findAnimationName(model, ["walk", "Walk", "Walking", "Walking_A", "Forward"]) || "Walking_A";
      loop = true;
      speed = 1.1;
      break;
    case "run":
      animName = findAnimationName(model, ["run", "Run", "Running", "Running_A", "Sprint"]) || "Running_A";
      loop = true;
      speed = 1.25;
      break;
    case "attack":
      animName = findAnimationName(model, ["attack", "Attack", "Right_Hand_Sword_Slash", "Slash", "Attack_01", "Attack_1", "Melee", "Strike"]) || "Attack";
      loop = false;
      speed = 1.8;
      break;
    case "cast":
      animName = findAnimationName(model, ["cast", "Cast", "skill", "Skill_01", "Spell", "Magic", "Charged_Slash"]) || "Cast";
      loop = false;
      speed = 1.6;
      break;
    case "channel":
      animName = findAnimationName(model, ["channel", "block", "Block2", "Channel", "Cast", "Idle", "Idle_A"]) || "Idle_A";
      loop = true;
      speed = 1.0;
      break;
    case "hit":
      animName = findAnimationName(model, ["hit", "Hit", "Hit_Reaction", "Hit_A", "Damage", "TakeDamage"]) || "Hit_A";
      loop = false;
      speed = 1.8;
      break;
    case "death":
      animName = findAnimationName(model, ["death", "Death", "dead", "Dead", "Death_A", "Die", "Fall"]) || "Death_A";
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
      animName = findAnimationName(model, ["idle", "Idle", "Idle_A"]) || "Idle_A";
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
