import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const loader = new FBXLoader();

const models = [
  { name: 'Knight', path: join(__dirname, '../public/pjs/Characters/fbx/Knight.fbx') },
  { name: 'Mage', path: join(__dirname, '../public/pjs/Characters/fbx/Mage.fbx') },
  { name: 'Ranger', path: join(__dirname, '../public/pjs/Characters/fbx/Ranger.fbx') },
  { name: 'Rogue_Hooded', path: join(__dirname, '../public/pjs/Characters/fbx/Rogue_Hooded.fbx') },
];

async function inspectModel(model) {
  try {
    const object = await loader.loadAsync(model.path);
    const boneNames = [];
    object.traverse((child) => {
      if (child.name) {
        boneNames.push(child.name);
      }
    });

    const handBones = boneNames.filter(n => n.toLowerCase().includes('hand'));
    const weaponBones = boneNames.filter(n => n.toLowerCase().includes('weapon'));
    const rightBones = boneNames.filter(n => n.toLowerCase().includes('right') || n.includes('R_'));

    console.log(`\n=== ${model.name} ===`);
    console.log('Total bones:', boneNames.length);
    console.log('\nHand-related bones:', handBones);
    console.log('\nWeapon-related bones:', weaponBones);
    console.log('\nRight-related bones:', rightBones);
    console.log('\nALL BONES:');
    boneNames.forEach((name, i) => console.log(`${i}: ${name}`));
  } catch (e) {
    console.error(`Error loading ${model.name}:`, e.message);
  }
}

async function main() {
  for (const model of models) {
    await inspectModel(model);
  }
}

main().catch(console.error);
