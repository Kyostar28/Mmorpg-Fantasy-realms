/**
 * ============================================================================
 *                             PJ MODEL (Three.js)
 *             Low-Poly Modular Player Character 3D Model System
 * ============================================================================
 * 
 * Un modelo 3D poligonal completo, modular y listo para producción,
 * diseñado para exportarse e implementarse fácilmente en cualquier proyecto Three.js.
 * 
 * 🎮 CARACTERÍSTICAS INCLUIDAS:
 * - 100% Autónomo: Solo depende de 'three'. Cero librerías externas o assets pesados.
 * - 6 Razas Fantásticas con anatomía, proporciones y rasgos únicos:
 *   • Humano (Equilibrado, atlético)
 *   • Elfo (Alto, esbelto, orejas puntiagudas alargadas)
 *   • Orco (Musculoso, hombros anchos, colmillos inferiores y ceño prominente)
 *   • Enano (Robusto, compacto, barba frondosa trenzada)
 *   • Ogro (Gigante, torso masivo, mandíbula pesada, cuerno frontal)
 *   • Demonio (Cuernos de obsidiana curvados, tonos carmesí y ojos ardientes)
 * - Sistema Visual de Equipamiento (Armas, Cascos, Corazas, Guantes, Pantalones, Botas, Escudos y Capas).
 * - Armas 3D Poligonales:
 *   • Espada de Acero (Hoja biselada, guarda dorada, empuñadura y pomo)
 *   • Hacha de Batalla Doble (Doble filo creciente, mango largo y púa superior)
 *   • Báculo de Escarcha (Cristal de hielo flotante con rotación continua y luz cian)
 *   • Báculo de Fuego (Corona solar giratoria, orbe de fuego pulsante y luz cálida)
 *   • Báculo de Brujo (Cráneo ancestral con orbe de vacío flotante y luz púrpura)
 *   • Escudo de Caballero (Forma de cometa con emblema heráldico)
 *   • Capa de Héroe (Manto ondeante con física de viento)
 * - Motor de Animaciones Integrado:
 *   • Respiración Idle (Subida y bajada rítmica del torso)
 *   • Caminata y Carrera / Sprint (Zancadas alternadas y balanceo de brazos)
 *   • Ataque Físico Melee (Golpe de espada/hacha hacia adelante)
 *   • Canalización Mágica / Cast (Elevación solemne del báculo)
 *   • Reacción de Impacto (Flinch al recibir daño)
 *   • Giro suave hacia cualquier ángulo o coordenada de objetivo
 *   • Anillo de Aura al equipar objetos
 * 
 * ----------------------------------------------------------------------------
 * 🚀 EJEMPLO RÁPIDO DE USO EN OTRO PROYECTO:
 * ----------------------------------------------------------------------------
 * ```typescript
 * import * as THREE from 'three';
 * import { createLowPolyCharacter } from './PJ_MODEL';
 * 
 * // 1. Crear escena y renderer habitual de Three.js
 * const scene = new THREE.Scene();
 * 
 * // 2. Instanciar el personaje
 * const player = createLowPolyCharacter({
 *   race: 'human',
 *   skinColor: '#fed7aa',
 *   hairColor: '#1e293b',
 *   eyeColor: '#3b82f6',
 * });
 * 
 * // 3. Añadir a la escena
 * scene.add(player.group);
 * 
 * // 4. Equipar objetos visuales fácilmente
 * player.equip('weapon', { weaponType: 'sword', visualColor: '#e2e8f0' });
 * player.equip('helmet', { style: 'plate', visualColor: '#64748b' });
 * player.equip('chest', { visualColor: '#475569', secondaryColor: '#f59e0b' });
 * player.equip('cape', { visualColor: '#991b1b' });
 * 
 * // 5. En el bucle de render (requestAnimationFrame):
 * const clock = new THREE.Clock();
 * function animate() {
 *   requestAnimationFrame(animate);
 *   const delta = clock.getDelta();
 * 
 *   // Actualizar animación: update(delta, isMoving, isSprinting, moveVector)
 *   player.update(delta, true, false, { x: 1, z: 0 });
 * 
 *   renderer.render(scene, camera);
 * }
 * animate();
 * 
 * // Lanzar ataques:
 * player.playAttack('melee'); // o 'cast'
 * ```
 * ============================================================================
 */

import * as THREE from 'three';

// ============================================================================
// TIPOS Y DEFINICIONES
// ============================================================================

export type CharacterRace = 'human' | 'elf' | 'orc' | 'dwarf' | 'ogre' | 'demon';

export type WeaponVisualType =
  | 'sword'
  | 'axe'
  | 'frost_staff'
  | 'fire_staff'
  | 'warlock_staff'
  | 'dagger';

export type EquipmentSlot =
  | 'helmet'
  | 'chest'
  | 'pants'
  | 'boots'
  | 'gloves'
  | 'weapon'
  | 'shield'
  | 'cape';

export interface VisualItemConfig {
  id?: string;
  slot: EquipmentSlot;
  weaponType?: WeaponVisualType;
  style?: 'plate' | 'wizard' | 'viking' | 'default';
  visualColor?: string;
  secondaryColor?: string;
  glowColor?: string;
}

export interface CharacterAppearanceOptions {
  race?: CharacterRace;
  skinColor?: string;
  hairColor?: string;
  eyeColor?: string;
  underclothesColor?: string;
}

export interface RaceVisualDefinition {
  id: CharacterRace;
  name: string;
  skinColor: string;
  hairColor: string;
  eyeColor: string;
  hornColor?: string;
  scale: { x: number; y: number; z: number };
  headScale: { x: number; y: number; z: number };
  accentColor: string;
}

// Proporciones y configuraciones estéticas de cada raza
export const RACE_VISUAL_PRESETS: Record<CharacterRace, RaceVisualDefinition> = {
  human: {
    id: 'human',
    name: 'Humano',
    skinColor: '#fed7aa',
    hairColor: '#1e293b',
    eyeColor: '#3b82f6',
    scale: { x: 1.0, y: 1.0, z: 1.0 },
    headScale: { x: 1.0, y: 1.05, z: 0.95 },
    accentColor: '#f59e0b',
  },
  elf: {
    id: 'elf',
    name: 'Elfo',
    skinColor: '#e0e7ff',
    hairColor: '#e2e8f0', // Cabello plateado
    eyeColor: '#22d3ee', // Ojos cian luminosos
    scale: { x: 0.88, y: 1.08, z: 0.88 }, // Alto y grácil
    headScale: { x: 0.92, y: 1.1, z: 0.9 },
    accentColor: '#06b6d4',
  },
  orc: {
    id: 'orc',
    name: 'Orco',
    skinColor: '#4d7c0f', // Verde oliva orco
    hairColor: '#18181b', // Negro azabache
    eyeColor: '#ea580c', // Ojos ámbar fuego
    scale: { x: 1.22, y: 1.05, z: 1.2 }, // Hombros anchos e imponentes
    headScale: { x: 1.15, y: 1.0, z: 1.05 },
    accentColor: '#84cc16',
  },
  dwarf: {
    id: 'dwarf',
    name: 'Enano',
    skinColor: '#fbcfe8',
    hairColor: '#b45309', // Barba y cabello cobrizo
    eyeColor: '#78350f',
    scale: { x: 1.2, y: 0.78, z: 1.15 }, // Bajo, ancho y muy resistente
    headScale: { x: 1.1, y: 1.0, z: 1.1 },
    accentColor: '#f97316',
  },
  ogre: {
    id: 'ogre',
    name: 'Ogro',
    skinColor: '#0284c7', // Tono azulado de ogro de montaña
    hairColor: '#334155',
    eyeColor: '#facc15', // Ojos amarillos penetrantes
    scale: { x: 1.4, y: 1.35, z: 1.35 }, // Proporciones gigantes
    headScale: { x: 1.25, y: 1.15, z: 1.2 },
    accentColor: '#0284c7',
  },
  demon: {
    id: 'demon',
    name: 'Demonio',
    skinColor: '#b91c1c', // Piel carmesí abisal
    hairColor: '#09090b', // Obsidiana
    eyeColor: '#fbbf24', // Ojos dorados ardientes
    hornColor: '#18181b', // Cuernos de obsidiana
    scale: { x: 1.05, y: 1.12, z: 1.05 },
    headScale: { x: 1.0, y: 1.05, z: 1.0 },
    accentColor: '#dc2626',
  },
};

// ============================================================================
// GESTOR DE MATERIALES POLIGONALES (Flat-Shaded Cache)
// ============================================================================

class MaterialCache {
  private cache = new Map<string, THREE.MeshStandardMaterial>();

  get(
    color: string,
    roughness = 0.45,
    metalness = 0.2,
    emissive = '#000000',
    emissiveIntensity = 1.0
  ): THREE.MeshStandardMaterial {
    const key = `${color}_${roughness}_${metalness}_${emissive}_${emissiveIntensity}`;
    let mat = this.cache.get(key);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness,
        metalness,
        emissive: new THREE.Color(emissive),
        emissiveIntensity,
        flatShading: true,
      });
      this.cache.set(key, mat);
    }
    return mat;
  }

  disposeAll() {
    this.cache.forEach((mat) => mat.dispose());
    this.cache.clear();
  }
}

// Instancia interna compartida
const matCache = new MaterialCache();

// ============================================================================
// CONSTRUCTORES POLIGONALES DE EQUIPAMIENTO
// ============================================================================

export function buildPolygonalWeapon(config: VisualItemConfig): THREE.Group {
  const group = new THREE.Group();
  const weaponType = config.weaponType || 'sword';
  const color = config.visualColor || '#cbd5e1';
  const secColor = config.secondaryColor || '#f59e0b';

  if (weaponType === 'sword') {
    // Greatsword/Longsword - estilo de la imagen
    // Hoja larga y recta con fuller (surco central)
    const bladeMat = matCache.get(color, 0.12, 0.9); // Más brillante, metálico

    // Hoja principal
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 1.15, 0.04),
      bladeMat
    );
    blade.position.set(0, 0.55, 0);
    blade.castShadow = true;
    group.add(blade);

    // Fuller (surco central) - detalle de la hoja
    const fuller = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.85, 0.05),
      matCache.get('#8a8a8a', 0.3, 0.7)
    );
    fuller.position.set(0, 0.45, 0.03);
    group.add(fuller);

    // Punta afilada
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.22, 4),
      bladeMat
    );
    tip.position.set(0, 1.15, 0);
    tip.rotation.y = Math.PI / 4;
    group.add(tip);

    // Crossguard recta y simple (como en la imagen)
    const guardMat = matCache.get(secColor, 0.25, 0.85);
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.06, 0.10),
      guardMat
    );
    guard.position.set(0, 0.02, 0);
    group.add(guard);

    // Extremos del crossguard ligeramente curvados hacia abajo
    const guardEndL = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.06, 0.12),
      guardMat
    );
    guardEndL.position.set(0.20, 0.02, 0);
    guardEndL.rotation.z = 0.15;
    group.add(guardEndL);

    const guardEndR = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.06, 0.12),
      guardMat
    );
    guardEndR.position.set(-0.20, 0.02, 0);
    guardEndR.rotation.z = -0.15;
    group.add(guardEndR);

    // Empuñadura larga de dos manos (cuero enrollado)
    const gripMat = matCache.get('#2a1810', 0.8, 0.1);
    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8),
      gripMat
    );
    grip.position.set(0, -0.17, 0);
    group.add(grip);

    // Pomo de rueda/disc (como en la imagen)
    const pommel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12),
      guardMat
    );
    pommel.position.set(0, -0.35, 0);
    group.add(pommel);
  } else if (weaponType === 'axe') {
    // Mango de madera reforzada
    const haftGeo = new THREE.CylinderGeometry(0.035, 0.03, 1.1, 8);
    const haftMat = matCache.get('#78350f', 0.6, 0.1);
    const haft = new THREE.Mesh(haftGeo, haftMat);
    haft.position.set(0, 0.35, 0);
    group.add(haft);

    // Cuchillas dobles de acero
    const bladeMat = matCache.get(color, 0.25, 0.8);
    const goldAccent = matCache.get(secColor, 0.3, 0.5);

    const leftBlade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.035), bladeMat);
    leftBlade.position.set(0.18, 0.72, 0);
    leftBlade.rotation.z = -0.2;
    group.add(leftBlade);

    const rightBlade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.035), bladeMat);
    rightBlade.position.set(-0.18, 0.72, 0);
    rightBlade.rotation.z = 0.2;
    group.add(rightBlade);

    // Anillo central de sujeción
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 8), goldAccent);
    collar.position.set(0, 0.72, 0);
    group.add(collar);

    // Púa superior
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 6), bladeMat);
    spike.position.set(0, 0.95, 0);
    group.add(spike);
  } else if (weaponType === 'frost_staff') {
    // Vara mística de escarcha
    const staffHaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.035, 1.35, 8),
      matCache.get('#1e293b', 0.5, 0.3)
    );
    staffHaft.position.set(0, 0.45, 0);
    group.add(staffHaft);

    // Dientes plateados
    const prongMat = matCache.get('#94a3b8', 0.2, 0.8);
    for (let i = 0; i < 3; i++) {
      const prong = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.025), prongMat);
      const angle = (i * Math.PI * 2) / 3;
      prong.position.set(Math.cos(angle) * 0.09, 1.15, Math.sin(angle) * 0.09);
      prong.rotation.z = Math.cos(angle) * 0.25;
      prong.rotation.x = Math.sin(angle) * 0.25;
      group.add(prong);
    }

    // Cristal flotante giratorio
    const crystalGeo = new THREE.OctahedronGeometry(0.13, 0);
    const crystalMat = matCache.get('#38bdf8', 0.05, 0.9, '#0ea5e9', 1.8);
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0, 1.25, 0);
    crystal.scale.set(1.0, 1.6, 1.0);
    group.add(crystal);

    // Luz cian emitida
    const iceLight = new THREE.PointLight('#38bdf8', 1.2, 3.5);
    iceLight.position.set(0, 1.25, 0);
    group.add(iceLight);

    group.userData.animate = (dt: number) => {
      crystal.rotation.y += dt * 2.5;
      crystal.rotation.x += dt * 1.2;
    };
  } else if (weaponType === 'fire_staff') {
    // Vara de madera dorada
    const staffHaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.035, 1.35, 8),
      matCache.get('#7c2d12', 0.4, 0.2)
    );
    staffHaft.position.set(0, 0.45, 0);
    group.add(staffHaft);

    // Corona solar dorada
    const crownMat = matCache.get('#f59e0b', 0.2, 0.85);
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16), crownMat);
    crown.position.set(0, 1.22, 0);
    group.add(crown);

    // Núcleo ígneo pulsante
    const fireGeo = new THREE.SphereGeometry(0.09, 10, 10);
    const fireMat = matCache.get('#f97316', 0.1, 0.3, '#ea580c', 2.5);
    const fireBall = new THREE.Mesh(fireGeo, fireMat);
    fireBall.position.set(0, 1.22, 0);
    group.add(fireBall);

    // Luz de fuego
    const fireLight = new THREE.PointLight('#ff7700', 1.6, 4.0);
    fireLight.position.set(0, 1.22, 0);
    group.add(fireLight);

    group.userData.animate = (dt: number) => {
      crown.rotation.y += dt * 2.0;
      fireBall.scale.setScalar(0.9 + Math.sin(Date.now() * 0.008) * 0.15);
    };
  } else if (weaponType === 'warlock_staff') {
    // Madera oscura y retorcida
    const staffHaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.038, 1.38, 7),
      matCache.get('#18181b', 0.8, 0.2)
    );
    staffHaft.position.set(0, 0.45, 0);
    group.add(staffHaft);

    // Engaste de calavera
    const skullMat = matCache.get('#e2e8f0', 0.3, 0.4);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), skullMat);
    skull.position.set(0, 1.22, 0);
    group.add(skull);

    // Orbe de vacío púrpura flotante
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      matCache.get('#a855f7', 0.1, 0.2, '#9333ea', 2.4)
    );
    orb.position.set(0, 1.38, 0);
    group.add(orb);

    const darkLight = new THREE.PointLight('#a855f7', 1.5, 3.5);
    darkLight.position.set(0, 1.38, 0);
    group.add(darkLight);

    group.userData.animate = (dt: number) => {
      orb.position.y = 1.38 + Math.sin(Date.now() * 0.006) * 0.04;
      orb.rotation.y += dt * 1.8;
    };
  } else if (weaponType === 'dagger') {
    // Daga corta veloz
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.45, 0.02),
      matCache.get(color, 0.2, 0.85)
    );
    blade.position.set(0, 0.22, 0);
    group.add(blade);

    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.12, 4),
      matCache.get(color, 0.2, 0.85)
    );
    tip.position.set(0, 0.48, 0);
    tip.rotation.y = Math.PI / 4;
    group.add(tip);

    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.03, 0.05),
      matCache.get(secColor, 0.3, 0.7)
    );
    guard.position.set(0, 0.01, 0);
    group.add(guard);

    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6),
      matCache.get('#292524', 0.8, 0.1)
    );
    grip.position.set(0, -0.08, 0);
    group.add(grip);
  }

  return group;
}

export function buildPolygonalShield(config: VisualItemConfig): THREE.Group {
  const group = new THREE.Group();
  const color = config.visualColor || '#1e3a8a';
  const secColor = config.secondaryColor || '#f59e0b';

  // Escudo tipo cometa (Kite Shield)
  const shieldMat = matCache.get(color, 0.35, 0.5);
  const borderMat = matCache.get(secColor, 0.2, 0.8);

  const mainPlate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.65, 0.04), shieldMat);
  mainPlate.position.set(0, 0, 0);
  group.add(mainPlate);

  // Cruz / Emblema frontal
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.05), borderMat);
  crossV.position.set(0, 0, 0.01);
  group.add(crossV);

  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.05), borderMat);
  crossH.position.set(0, 0.1, 0.01);
  group.add(crossH);

  // Asa trasera
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6),
    matCache.get('#451a03', 0.8, 0.1)
  );
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0, 0, -0.04);
  group.add(handle);

  return group;
}

export function buildPolygonalCape(config: VisualItemConfig): THREE.Group {
  const group = new THREE.Group();
  const capeColor = config.visualColor || '#7f1d1d'; // Carmesí oscuro elegante
  const capeMat = matCache.get(capeColor, 0.7, 0.1);

  // Manto superior
  const capeTop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.04), capeMat);
  capeTop.position.set(0, 0.14, -0.15);
  group.add(capeTop);

  // Paño principal ondeante
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.82, 0.025), capeMat);
  cloth.position.set(0, -0.32, -0.16);
  cloth.rotation.x = 0.12; // Ligera caída natural
  group.add(cloth);

  // Broche dorado en hombros
  const brocheMat = matCache.get(config.secondaryColor || '#fbbf24', 0.2, 0.85);
  const brooch = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), brocheMat);
  brooch.position.set(0, 0.16, -0.14);
  group.add(brooch);

  // Animación de ondeado por viento
  group.userData.animate = (dt: number, speedMultiplier = 1.0) => {
    cloth.rotation.x = 0.14 + Math.sin(Date.now() * 0.005 * speedMultiplier) * 0.12 * speedMultiplier;
    cloth.rotation.y = Math.cos(Date.now() * 0.003 * speedMultiplier) * 0.04;
  };

  return group;
}

export function buildPolygonalHelmet(config: VisualItemConfig): THREE.Group {
  const group = new THREE.Group();
  const color = config.visualColor || '#2a2a2a'; // Dark metallic like the image
  const secColor = config.secondaryColor || '#3a3a3a';
  const style = config.style || (config.id?.includes('wizard') ? 'wizard' : config.id?.includes('viking') ? 'viking' : 'plate');

  if (style === 'plate') {
    // Dark plate armor helmet with red plume (like the image)
    const helmMat = matCache.get(color, 0.4, 0.8); // Darker, more metallic
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.7),
      helmMat
    );
    dome.position.set(0, 0.04, 0);
    group.add(dome);

    // Visor frontal más detallado - estilo gótico
    const visorMat = matCache.get(secColor, 0.3, 0.85);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.18), visorMat);
    visor.position.set(0, 0.02, 0.15);
    group.add(visor);

    // Ranura de visión horizontal más larga
    const slit = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.02, 0.06),
      matCache.get('#0a0a0a', 0.95, 0.1)
    );
    slit.position.set(0, 0.02, 0.24);
    group.add(slit);

    // Penacho de plumas rojas (como en la imagen)
    const plumeMat = matCache.get('#b91c1c', 0.6, 0.1); // Dark red feathers
    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.35, 8),
      plumeMat
    );
    plume.position.set(0, 0.32, 0);
    plume.rotation.z = 0.1;
    group.add(plume);

    // Plumas adicionales para más volumen
    const plume2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.28, 8),
      plumeMat
    );
    plume2.position.set(0.04, 0.30, 0);
    plume2.rotation.z = 0.15;
    plume2.rotation.x = 0.1;
    group.add(plume2);

    const plume3 = new THREE.Mesh(
      new THREE.ConeGeometry(0.05, 0.28, 8),
      plumeMat
    );
    plume3.position.set(-0.04, 0.30, 0);
    plume3.rotation.z = -0.15;
    plume3.rotation.x = 0.1;
    group.add(plume3);
  } else if (style === 'wizard') {
    // Sombrero Cónico de Mago con Ala Ancha
    const hatMat = matCache.get(color, 0.6, 0.1);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 16), hatMat);
    brim.position.set(0, 0.06, 0);
    group.add(brim);

    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 12), hatMat);
    cone.position.set(0, 0.34, -0.04);
    cone.rotation.x = -0.15;
    group.add(cone);

    const bandMat = matCache.get(secColor, 0.2, 0.7, secColor, 0.5);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 14), bandMat);
    band.position.set(0, 0.1, 0);
    group.add(band);
  } else {
    // Casco Nórdico con Cuernos
    const helmMat = matCache.get(color, 0.3, 0.8);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
      helmMat
    );
    dome.position.set(0, 0.04, 0);
    group.add(dome);

    const hornMat = matCache.get('#fef08a', 0.4, 0.1);
    const leftHorn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 6), hornMat);
    leftHorn.position.set(0.22, 0.18, 0);
    leftHorn.rotation.z = -Math.PI / 3;
    leftHorn.rotation.x = 0.2;
    group.add(leftHorn);

    const rightHorn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.24, 6), hornMat);
    rightHorn.position.set(-0.22, 0.18, 0);
    rightHorn.rotation.z = Math.PI / 3;
    rightHorn.rotation.x = 0.2;
    group.add(rightHorn);
  }

  return group;
}

export function buildPolygonalChest(config: VisualItemConfig): THREE.Group {
  const group = new THREE.Group();
  const color = config.visualColor || '#2a2a2a'; // Dark plate armor
  const secColor = config.secondaryColor || '#3a3a3a';

  const chestMat = matCache.get(color, 0.35, 0.8); // Dark metallic
  const trimMat = matCache.get(secColor, 0.25, 0.85);

  // Coraza principal de placas oscuras
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.30), chestMat);
  plate.position.set(0, 0, 0.01);
  plate.castShadow = true;
  group.add(plate);

  // Detalle de crestas/flautas en el pecho (como en la imagen)
  const ridgeLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.04), trimMat);
  ridgeLeft.position.set(-0.12, 0, 0.05);
  group.add(ridgeLeft);

  const ridgeRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.04), trimMat);
  ridgeRight.position.set(0.12, 0, 0.05);
  group.add(ridgeRight);

  // Cinturón de cuero en la cintura
  const beltMat = matCache.get('#451a03', 0.7, 0.1);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.32), beltMat);
  belt.position.set(0, -0.22, 0.02);
  group.add(belt);

  // Hebilla del cinturón
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.06), trimMat);
  buckle.position.set(0, -0.22, 0.18);
  group.add(buckle);

  // Hombrera izquierda (Pauldron) - placas superpuestas
  const leftPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), trimMat);
  leftPauldron.scale.set(1.3, 0.85, 1.3);
  leftPauldron.position.set(0.28, 0.20, 0);
  group.add(leftPauldron);

  // Placa adicional en la hombrera izquierda
  const leftPauldron2 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), trimMat);
  leftPauldron2.scale.set(1.2, 0.8, 1.2);
  leftPauldron2.position.set(0.28, 0.08, 0.02);
  group.add(leftPauldron2);

  // Hombrera derecha (Pauldron) - placas superpuestas
  const rightPauldron = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), trimMat);
  rightPauldron.scale.set(1.3, 0.85, 1.3);
  rightPauldron.position.set(-0.28, 0.20, 0);
  group.add(rightPauldron);

  // Placa adicional en la hombrera derecha
  const rightPauldron2 = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), trimMat);
  rightPauldron2.scale.set(1.2, 0.8, 1.2);
  rightPauldron2.position.set(-0.28, 0.08, 0.02);
  group.add(rightPauldron2);

  return group;
}

export function buildPolygonalGlove(config: VisualItemConfig): THREE.Group {
  const group = new THREE.Group();
  const mat = matCache.get(config.visualColor || '#475569', 0.3, 0.7);
  const gauntlet = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.18, 8), mat);
  gauntlet.position.set(0, 0, 0);
  group.add(gauntlet);
  return group;
}

export function buildPolygonalPants(config: VisualItemConfig): THREE.Group {
  const group = new THREE.Group();
  const mat = matCache.get(config.visualColor || '#475569', 0.4, 0.5);
  const greave = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.32, 0.17), mat);
  greave.position.set(0, 0, 0);
  group.add(greave);
  return group;
}

export function buildPolygonalBoot(config: VisualItemConfig): THREE.Group {
  const group = new THREE.Group();
  const mat = matCache.get(config.visualColor || '#334155', 0.3, 0.6);
  const bootCover = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.25), mat);
  bootCover.position.set(0, -0.05, 0.02);
  group.add(bootCover);
  return group;
}

// ============================================================================
// CLASE PRINCIPAL: LowPolyCharacter
// ============================================================================

export class LowPolyCharacter {
  /** Grupo raíz para añadir a cualquier Scene de Three.js */
  public readonly group: THREE.Group;

  /** Grupo de cuerpo escalado según proporciones raciales */
  public readonly bodyRoot: THREE.Group;

  // Pivotes y nodos corporales
  public readonly hips: THREE.Mesh;
  public readonly torsoGroup: THREE.Group;
  public readonly headGroup: THREE.Group;
  public readonly headMesh: THREE.Mesh;
  public readonly hairMesh: THREE.Mesh;
  public readonly eyeMeshes: THREE.Mesh[] = [];
  public readonly racialFeaturesGroup: THREE.Group;

  public readonly leftArmPivot: THREE.Group;
  public readonly leftArmMesh: THREE.Mesh;
  public readonly rightArmPivot: THREE.Group;
  public readonly rightArmMesh: THREE.Mesh;

  public readonly leftLegPivot: THREE.Group;
  public readonly rightLegPivot: THREE.Group;

  // Contenedores de equipamiento visual
  public readonly containers: Record<EquipmentSlot, THREE.Group | { left: THREE.Group; right: THREE.Group }>;

  // Efectos visuales de suelo
  public readonly shadowMesh: THREE.Mesh;
  public readonly equipAuraRing: THREE.Mesh;
  private readonly auraMat: THREE.MeshBasicMaterial;

  // Estado interno de animación
  private currentRace: CharacterRace = 'human';
  private walkTimer = 0;
  private idleTimer = 0;
  private auraAnimTimer = 0;
  private isAttacking = false;
  private attackProgress = 0;
  private attackType: 'melee' | 'cast' = 'melee';
  private isHitReacting = false;
  private hitReactTimer = 0;
  private isBlocking = false;
  private blockTimer = 0;
  private isDodging = false;
  private dodgeTimer = 0;
  private dodgeDirection = 0; // -1 left, 1 right

  // Orientación y suavizado
  private currentAngle = 0;
  private targetAngle = 0;

  // Equipamiento activo registrado
  private equippedSlots: Partial<Record<EquipmentSlot, VisualItemConfig | null>> = {};

  constructor(options?: CharacterAppearanceOptions) {
    this.group = new THREE.Group();
    this.bodyRoot = new THREE.Group();
    this.group.add(this.bodyRoot);

    // 1. Sombra poligonal en suelo
    const shadowGeo = new THREE.PlaneGeometry(1.0, 0.8);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadowMesh.rotation.x = -Math.PI / 2;
    this.shadowMesh.position.set(0, 0.02, 0);
    this.group.add(this.shadowMesh);

    // 2. Anillo de Aura de Equipar
    const auraGeo = new THREE.RingGeometry(0.2, 0.35, 24);
    this.auraMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.equipAuraRing = new THREE.Mesh(auraGeo, this.auraMat);
    this.equipAuraRing.rotation.x = -Math.PI / 2;
    this.equipAuraRing.position.set(0, 0.04, 0);
    this.group.add(this.equipAuraRing);

    // 3. Configuración inicial de raza y color
    this.currentRace = options?.race || 'human';
    const raceDef = RACE_VISUAL_PRESETS[this.currentRace] || RACE_VISUAL_PRESETS.human;

    const skinColor = options?.skinColor || raceDef.skinColor;
    const hairColor = options?.hairColor || raceDef.hairColor;
    const eyeColor = options?.eyeColor || raceDef.eyeColor;
    const underclothesColor = options?.underclothesColor || '#1e293b';

    const skinMat = matCache.get(skinColor, 0.6, 0.05);
    const hairMat = matCache.get(hairColor, 0.7, 0.1);
    const eyeMat = matCache.get(eyeColor, 0.1, 0.5);
    const underclothesMat = matCache.get(underclothesColor, 0.5, 0.1);

    // Aplicar escala de la raza
    this.bodyRoot.scale.set(raceDef.scale.x, raceDef.scale.y, raceDef.scale.z);

    // 4. Cadera / Caderas
    this.hips = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.24), underclothesMat);
    this.hips.position.set(0, 0.72, 0);
    this.hips.castShadow = true;
    this.bodyRoot.add(this.hips);

    // 5. Torso
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.98, 0);
    this.bodyRoot.add(this.torsoGroup);

    const baseShirt = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.25), underclothesMat);
    baseShirt.castShadow = true;
    this.torsoGroup.add(baseShirt);

    // 6. Cabeza
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.34, 0);
    this.bodyRoot.add(this.headGroup);

    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 10), skinMat);
    this.headMesh.scale.set(raceDef.headScale.x, raceDef.headScale.y, raceDef.headScale.z);
    this.headMesh.castShadow = true;
    this.headGroup.add(this.headMesh);

    // Ojos
    [-0.08, 0.08].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.05), eyeMat);
      eye.position.set(x, 0.02, 0.201);
      this.headGroup.add(eye);
      this.eyeMeshes.push(eye);
    });

    // Pelo
    this.hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.26), hairMat);
    this.hairMesh.position.set(0, 0.12, -0.02);
    this.headGroup.add(this.hairMesh);

    // Rasgos Raciales
    this.racialFeaturesGroup = new THREE.Group();
    this.headGroup.add(this.racialFeaturesGroup);
    this.rebuildRacialFeatures(this.currentRace);

    // 7. Brazos
    // Brazo Izquierdo (Mano defensiva / Escudo)
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(0.26, 1.15, 0);
    this.bodyRoot.add(this.leftArmPivot);

    this.leftArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.34, 8), skinMat);
    this.leftArmMesh.position.set(0.02, -0.17, 0);
    this.leftArmPivot.add(this.leftArmMesh);

    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), skinMat);
    leftHand.position.set(0.02, -0.34, 0);
    this.leftArmPivot.add(leftHand);

    // Brazo Derecho (Mano de Armas)
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(-0.26, 1.15, 0);
    this.bodyRoot.add(this.rightArmPivot);

    this.rightArmMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.34, 8), skinMat);
    this.rightArmMesh.position.set(-0.02, -0.17, 0);
    this.rightArmPivot.add(this.rightArmMesh);

    const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), skinMat);
    rightHand.position.set(-0.02, -0.34, 0);
    this.rightArmPivot.add(rightHand);

    // 8. Piernas
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(0.11, 0.65, 0);
    this.bodyRoot.add(this.leftLegPivot);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.15), underclothesMat);
    leftLeg.position.set(0, -0.18, 0);
    leftLeg.castShadow = true;
    this.leftLegPivot.add(leftLeg);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(-0.11, 0.65, 0);
    this.bodyRoot.add(this.rightLegPivot);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.36, 0.15), underclothesMat);
    rightLeg.position.set(0, -0.18, 0);
    rightLeg.castShadow = true;
    this.rightLegPivot.add(rightLeg);

    // 9. Contenedores de ranuras de equipamiento
    const helmetContainer = new THREE.Group();
    this.headGroup.add(helmetContainer);

    const chestContainer = new THREE.Group();
    this.torsoGroup.add(chestContainer);

    const capeContainer = new THREE.Group();
    this.torsoGroup.add(capeContainer);

    const leftGlove = new THREE.Group();
    leftGlove.position.set(0.02, -0.26, 0);
    this.leftArmPivot.add(leftGlove);

    const rightGlove = new THREE.Group();
    rightGlove.position.set(-0.02, -0.26, 0);
    this.rightArmPivot.add(rightGlove);

    const leftPants = new THREE.Group();
    leftPants.position.set(0, -0.18, 0);
    this.leftLegPivot.add(leftPants);

    const rightPants = new THREE.Group();
    rightPants.position.set(0, -0.18, 0);
    this.rightLegPivot.add(rightPants);

    const leftBoot = new THREE.Group();
    leftBoot.position.set(0, -0.36, 0);
    this.leftLegPivot.add(leftBoot);

    const rightBoot = new THREE.Group();
    rightBoot.position.set(0, -0.36, 0);
    this.rightLegPivot.add(rightBoot);

    const weaponContainer = new THREE.Group();
    weaponContainer.position.set(-0.02, -0.36, 0.05);
    weaponContainer.rotation.x = Math.PI / 2.2;
    this.rightArmPivot.add(weaponContainer);

    const shieldContainer = new THREE.Group();
    shieldContainer.position.set(0.08, -0.22, 0.06);
    shieldContainer.rotation.y = -Math.PI / 2;
    this.leftArmPivot.add(shieldContainer);

    this.containers = {
      helmet: helmetContainer,
      chest: chestContainer,
      cape: capeContainer,
      gloves: { left: leftGlove, right: rightGlove },
      pants: { left: leftPants, right: rightPants },
      boots: { left: leftBoot, right: rightBoot },
      weapon: weaponContainer,
      shield: shieldContainer,
    };
  }

  // ==========================================================================
  // CONFIGURACIÓN DE RAZAS Y ANATOMÍA
  // ==========================================================================

  public setRace(newRace: CharacterRace) {
    this.currentRace = newRace;
    const raceDef = RACE_VISUAL_PRESETS[newRace] || RACE_VISUAL_PRESETS.human;

    // Escala general y de cabeza
    this.bodyRoot.scale.set(raceDef.scale.x, raceDef.scale.y, raceDef.scale.z);
    this.headMesh.scale.set(raceDef.headScale.x, raceDef.headScale.y, raceDef.headScale.z);

    // Actualizar colores
    const newSkinMat = matCache.get(raceDef.skinColor, 0.6, 0.05);
    const newHairMat = matCache.get(raceDef.hairColor, 0.7, 0.1);
    const newEyeMat = matCache.get(raceDef.eyeColor, 0.1, 0.5);

    this.headMesh.material = newSkinMat;
    this.leftArmMesh.material = newSkinMat;
    this.rightArmMesh.material = newSkinMat;
    this.hairMesh.material = newHairMat;

    this.eyeMeshes.forEach((em) => {
      em.material = newEyeMat;
    });

    this.rebuildRacialFeatures(newRace);
    this.triggerEquipAura();
  }

  public setAppearance(appearance: Partial<CharacterAppearanceOptions>) {
    if (appearance.race) {
      this.setRace(appearance.race);
    }
    if (appearance.skinColor) {
      const mat = matCache.get(appearance.skinColor, 0.6, 0.05);
      this.headMesh.material = mat;
      this.leftArmMesh.material = mat;
      this.rightArmMesh.material = mat;
    }
    if (appearance.hairColor) {
      this.hairMesh.material = matCache.get(appearance.hairColor, 0.7, 0.1);
    }
    if (appearance.eyeColor) {
      const eyeMat = matCache.get(appearance.eyeColor, 0.1, 0.5);
      this.eyeMeshes.forEach((em) => (em.material = eyeMat));
    }
    if (appearance.underclothesColor) {
      const uMat = matCache.get(appearance.underclothesColor, 0.5, 0.1);
      this.hips.material = uMat;
    }
  }

  private rebuildRacialFeatures(race: CharacterRace) {
    while (this.racialFeaturesGroup.children.length > 0) {
      this.racialFeaturesGroup.remove(this.racialFeaturesGroup.children[0]);
    }

    const rDef = RACE_VISUAL_PRESETS[race] || RACE_VISUAL_PRESETS.human;
    const rSkinMat = matCache.get(rDef.skinColor, 0.6, 0.05);

    if (race === 'elf') {
      // Orejas puntiagudas alargadas élficas
      [-0.2, 0.2].forEach((x) => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), rSkinMat);
        ear.position.set(x, 0.04, -0.03);
        ear.rotation.z = x > 0 ? -Math.PI / 3.2 : Math.PI / 3.2;
        ear.rotation.x = -0.2;
        this.racialFeaturesGroup.add(ear);
      });
    } else if (race === 'demon') {
      // Cuernos curvados de obsidiana
      const hornMat = matCache.get(rDef.hornColor || '#18181b', 0.2, 0.8);
      [-0.13, 0.13].forEach((x) => {
        const hornBase = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.28, 6), hornMat);
        hornBase.position.set(x, 0.22, 0.04);
        hornBase.rotation.z = x > 0 ? -0.45 : 0.45;
        hornBase.rotation.x = -0.55;
        this.racialFeaturesGroup.add(hornBase);

        const hornTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), hornMat);
        hornTip.position.set(x > 0 ? x + 0.06 : x - 0.06, 0.36, -0.06);
        hornTip.rotation.z = x > 0 ? -0.25 : 0.25;
        hornTip.rotation.x = -0.8;
        this.racialFeaturesGroup.add(hornTip);
      });
    } else if (race === 'orc') {
      // Colmillos prominentes blancos que sobresalen de mandíbula
      const tuskMat = matCache.get('#fef08a', 0.3, 0.2);
      [-0.07, 0.07].forEach((x) => {
        const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 5), tuskMat);
        tusk.position.set(x, -0.08, 0.19);
        tusk.rotation.x = -Math.PI / 3.5;
        tusk.rotation.z = x > 0 ? -0.15 : 0.15;
        this.racialFeaturesGroup.add(tusk);
      });

      // Ceño fruncido pesado
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.08), rSkinMat);
      brow.position.set(0, 0.08, 0.18);
      this.racialFeaturesGroup.add(brow);
    } else if (race === 'dwarf') {
      // Barba frondosa enana
      const beardMat = matCache.get(rDef.hairColor, 0.7, 0.1);
      const beard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.18), beardMat);
      beard.position.set(0, -0.14, 0.12);
      this.racialFeaturesGroup.add(beard);

      // Trenza inferior
      const beardTip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 5), beardMat);
      beardTip.position.set(0, -0.28, 0.12);
      beardTip.rotation.x = Math.PI;
      this.racialFeaturesGroup.add(beardTip);
    } else if (race === 'ogre') {
      // Mandíbula pesada y cresta frontal
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.18), rSkinMat);
      jaw.position.set(0, -0.1, 0.14);
      this.racialFeaturesGroup.add(jaw);

      const browRidge = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.08, 0.12),
        matCache.get('#0369a1', 0.6, 0.1)
      );
      browRidge.position.set(0, 0.1, 0.18);
      this.racialFeaturesGroup.add(browRidge);
    }
  }

  // ==========================================================================
  // SISTEMA DE EQUIPAMIENTO
  // ==========================================================================

  public equip(slot: EquipmentSlot, item: VisualItemConfig | null, triggerEffect = true) {
    this.equippedSlots[slot] = item;
    const target = this.containers[slot];

    // Limpiar contenedor(es)
    if ('left' in target && 'right' in target) {
      while (target.left.children.length > 0) target.left.remove(target.left.children[0]);
      while (target.right.children.length > 0) target.right.remove(target.right.children[0]);
    } else {
      const singleContainer = target as THREE.Group;
      while (singleContainer.children.length > 0) {
        singleContainer.remove(singleContainer.children[0]);
      }
    }

    if (item) {
      switch (slot) {
        case 'helmet':
          (target as THREE.Group).add(buildPolygonalHelmet(item));
          break;
        case 'chest':
          (target as THREE.Group).add(buildPolygonalChest(item));
          break;
        case 'cape':
          (target as THREE.Group).add(buildPolygonalCape(item));
          break;
        case 'weapon':
          (target as THREE.Group).add(buildPolygonalWeapon(item));
          break;
        case 'shield':
          (target as THREE.Group).add(buildPolygonalShield(item));
          break;
        case 'gloves':
          if ('left' in target && 'right' in target) {
            target.left.add(buildPolygonalGlove(item));
            target.right.add(buildPolygonalGlove(item));
          }
          break;
        case 'pants':
          if ('left' in target && 'right' in target) {
            target.left.add(buildPolygonalPants(item));
            target.right.add(buildPolygonalPants(item));
          }
          break;
        case 'boots':
          if ('left' in target && 'right' in target) {
            target.left.add(buildPolygonalBoot(item));
            target.right.add(buildPolygonalBoot(item));
          }
          break;
      }
    }

    if (triggerEffect) {
      this.triggerEquipAura();
    }
  }

  public unequip(slot: EquipmentSlot) {
    this.equip(slot, null, false);
  }

  public triggerEquipAura() {
    this.auraAnimTimer = 1.0;
  }

  // ==========================================================================
  // ANIMACIONES Y COMBATE
  // ==========================================================================

  public playAttack(type: 'melee' | 'cast' = 'melee') {
    this.isAttacking = true;
    this.attackProgress = 0;
    this.attackType = type;
  }

  public playHitReaction() {
    this.isHitReacting = true;
    this.hitReactTimer = 0;
  }

  public playBlock() {
    this.isBlocking = true;
    this.blockTimer = 0;
  }

  public playDodge(direction: -1 | 1) {
    this.isDodging = true;
    this.dodgeTimer = 0;
    this.dodgeDirection = direction;
  }

  public faceDirection(angleRad: number) {
    this.targetAngle = angleRad;
    this.currentAngle = angleRad;
    this.group.rotation.y = angleRad;
  }

  public faceTarget(targetPos: { x: number; z: number } | THREE.Vector3) {
    const dx = targetPos.x - this.group.position.x;
    const dz = targetPos.z - this.group.position.z;
    if (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001) {
      this.targetAngle = Math.atan2(dx, dz);
    }
  }

  /**
   * Bucle principal de actualización de animación.
   * Llamar en cada fotograma dentro de requestAnimationFrame con delta time.
   */
  public update(
    dt: number,
    isMoving = false,
    isSprinting = false,
    moveDirVec?: { x: number; z: number }
  ) {
    // 1. Efecto Anillo de Aura al equipar
    if (this.auraAnimTimer > 0) {
      this.auraAnimTimer -= dt * 1.5;
      const progress = 1.0 - Math.max(0, this.auraAnimTimer);
      this.equipAuraRing.scale.setScalar(0.8 + progress * 2.2);
      this.auraMat.opacity = Math.max(0, this.auraAnimTimer * 0.85);
    } else {
      this.auraMat.opacity = 0;
    }

    // 2. Animaciones de Armas (Giro de cristales, fuego pulsante, etc.)
    const weaponContainer = this.containers.weapon as THREE.Group;
    if (weaponContainer.children[0]?.userData?.animate) {
      weaponContainer.children[0].userData.animate(dt);
    }

    // Animación de la capa al viento
    const capeContainer = this.containers.cape as THREE.Group;
    if (capeContainer.children[0]?.userData?.animate) {
      capeContainer.children[0].userData.animate(dt, isSprinting ? 2.0 : isMoving ? 1.4 : 0.6);
    }

    // 3. Suavizado de Giro hacia targetAngle
    if (moveDirVec && (Math.abs(moveDirVec.x) > 0.01 || Math.abs(moveDirVec.z) > 0.01)) {
      this.targetAngle = Math.atan2(moveDirVec.x, moveDirVec.z);
    }

    let diff = this.targetAngle - this.currentAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.currentAngle += diff * Math.min(1, dt * 18);
    this.group.rotation.y = this.currentAngle;

    // 4. Reacción de Golpe (Flinch)
    if (this.isHitReacting) {
      this.hitReactTimer += dt * 8.0;
      if (this.hitReactTimer >= 1.0) {
        this.isHitReacting = false;
        this.hitReactTimer = 0;
      } else {
        const flinch = Math.sin(this.hitReactTimer * Math.PI);
        this.bodyRoot.position.z = -0.15 * flinch;
        this.torsoGroup.rotation.x = -0.2 * flinch;
      }
    }

    // 4.5 Animación de Bloqueo con Escudo
    if (this.isBlocking) {
      this.blockTimer += dt * 6.0;
      if (this.blockTimer >= 1.0) {
        this.isBlocking = false;
        this.blockTimer = 0;
      } else {
        const blockPose = Math.sin(this.blockTimer * Math.PI);
        // Levantar escudo hacia adelante
        this.leftArmPivot.rotation.x = -Math.PI * 0.7 * blockPose;
        this.leftArmPivot.rotation.y = 0.4 * blockPose;
        this.torsoGroup.rotation.y = -0.3 * blockPose;
        // Ligeramente inclinado hacia atrás para resistir el impacto
        this.bodyRoot.rotation.x = 0.1 * blockPose;
      }
    }

    // 4.6 Animación de Esquive (Dodge)
    if (this.isDodging) {
      this.dodgeTimer += dt * 5.0;
      if (this.dodgeTimer >= 1.0) {
        this.isDodging = false;
        this.dodgeTimer = 0;
      } else {
        const dodgePhase = Math.sin(this.dodgeTimer * Math.PI);
        const dir = this.dodgeDirection;

        // Movimiento lateral rápido
        this.bodyRoot.position.x = dir * 0.8 * dodgePhase;

        // Inclinación del cuerpo en dirección del movimiento
        this.bodyRoot.rotation.z = -dir * 0.4 * dodgePhase;

        // Brazos en posición de equilibrio
        this.leftArmPivot.rotation.x = -Math.PI * 0.3 * dodgePhase;
        this.rightArmPivot.rotation.x = -Math.PI * 0.3 * dodgePhase;

        // Torso inclinado
        this.torsoGroup.rotation.y = dir * 0.2 * dodgePhase;
      }
    }

    // 5. Animación de Ataque
    if (this.isAttacking) {
      this.attackProgress += dt * 4.2;
      if (this.attackProgress >= 1.0) {
        this.isAttacking = false;
        this.attackProgress = 0;
      } else {
        if (this.attackType === 'melee') {
          // Mejorado: Slash más natural y pronunciado con espada
          // Wind-up (preparación) -> Strike (golpe) -> Follow-through (recuperación)
          const p = this.attackProgress;
          let swing: number;
          let torsoRot: number;
          let rightArmX: number;
          let rightArmY: number;
          let leftArmX: number;

          if (p < 0.3) {
            // Wind-up: preparar el golpe hacia atrás
            const windup = p / 0.3;
            swing = Math.sin(windup * Math.PI * 0.5);
            rightArmX = -Math.PI * 0.8 * swing; // Brazo derecho hacia atrás
            rightArmY = -0.6 * swing;
            torsoRot = -0.4 * swing; // Torso gira en sentido contrario
            leftArmX = -Math.PI * 0.2 * swing; // Escudo levantado
          } else if (p < 0.7) {
            // Strike: golpe rápido hacia adelante
            const strike = (p - 0.3) / 0.4;
            swing = Math.sin(strike * Math.PI);
            rightArmX = -Math.PI * 0.8 * (1 - swing) + Math.PI * 1.2 * swing; // Brazo hacia adelante violento
            rightArmY = -0.6 * (1 - swing) + 0.8 * swing;
            torsoRot = -0.4 * (1 - swing) + 0.5 * swing; // Torso rotación agresiva
            leftArmX = -Math.PI * 0.2 * (1 - swing) - Math.PI * 0.4 * swing; // Escudo bloqueando
          } else {
            // Follow-through: recuperación
            const recover = (p - 0.7) / 0.3;
            swing = Math.sin(recover * Math.PI * 0.5);
            rightArmX = Math.PI * 1.2 * (1 - swing) - Math.PI * 0.1 * swing;
            rightArmY = 0.8 * (1 - swing) - 0.1 * swing;
            torsoRot = 0.5 * (1 - swing) - 0.05 * swing;
            leftArmX = -Math.PI * 0.4 * (1 - swing) - Math.PI * 0.1 * swing;
          }

          this.rightArmPivot.rotation.x = rightArmX;
          this.rightArmPivot.rotation.y = rightArmY;
          this.torsoGroup.rotation.y = torsoRot;
          this.leftArmPivot.rotation.x = leftArmX;

          // Ligero balanceo del cuerpo para más impacto
          this.bodyRoot.position.z = -0.05 * Math.sin(p * Math.PI);
        } else {
          // Elevación majestuosa de báculo con ambas manos
          const castPose = Math.sin(this.attackProgress * Math.PI);
          this.rightArmPivot.rotation.x = -Math.PI * 0.85 * castPose;
          this.leftArmPivot.rotation.x = -Math.PI * 0.45 * castPose;
          this.torsoGroup.position.y = 0.98 + 0.05 * castPose;
        }
      }
    }

    // 6. Locomoción: Caminar / Correr / Idle
    if (isMoving) {
      this.idleTimer = 0;
      const freq = isSprinting ? 14 : 9;
      this.walkTimer += dt * freq;

      if (!this.isAttacking) {
        this.leftArmPivot.rotation.x = Math.sin(this.walkTimer) * 0.6;
        this.rightArmPivot.rotation.x = -Math.sin(this.walkTimer) * 0.6;
      }

      this.leftLegPivot.rotation.x = -Math.sin(this.walkTimer) * 0.65;
      this.rightLegPivot.rotation.x = Math.sin(this.walkTimer) * 0.65;

      // Rebote vertical al caminar
      this.bodyRoot.position.y = Math.abs(Math.sin(this.walkTimer)) * 0.05;
    } else {
      const damp = Math.exp(-dt * 12);
      if (!this.isAttacking) {
        this.rightArmPivot.rotation.x *= damp;
        this.rightArmPivot.rotation.y *= damp;
        this.torsoGroup.rotation.y *= damp;
      }
      this.leftArmPivot.rotation.x *= damp;
      this.leftLegPivot.rotation.x *= damp;
      this.rightLegPivot.rotation.x *= damp;

      // Respiración Idle sutil
      this.idleTimer += dt;
      this.bodyRoot.position.y = Math.sin(this.idleTimer * 2.2) * 0.02;
    }
  }

  /**
   * Limpieza de recursos y memoria Three.js
   */
  public destroy() {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
      }
    });
  }
}

// ============================================================================
// FACTORY HELPER (Función de creación rápida)
// ============================================================================

export function createLowPolyCharacter(options?: CharacterAppearanceOptions): LowPolyCharacter {
  return new LowPolyCharacter(options);
}

// Exportación por defecto
export default createLowPolyCharacter;
