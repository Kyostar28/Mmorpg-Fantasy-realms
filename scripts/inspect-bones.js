// Script to inspect FBX model bone names
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const loader = new FBXLoader();

const models = [
  { name: 'Knight', path: '../public/pjs/Characters/fbx/Knight.fbx' },
  { name: 'Mage', path: '../public/pjs/Characters/fbx/Mage.fbx' },
  { name: 'Ranger', path: '../public/pjs/Characters/fbx/Ranger.fbx' },
  { name: 'Rogue_Hooded', path: '../public/pjs/Characters/fbx/Rogue_Hooded.fbx' },
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
    console.log(`\n=== ${model.name} ===`);
    console.log('All bones:', boneNames);
    console.log('Hand-related bones:', boneNames.filter(n => n.toLowerCase().includes('hand')));
    console.log('Weapon-related bones:', boneNames.filter(n => n.toLowerCase().includes('weapon')));
    console.log('Right-related bones:', boneNames.filter(n => n.toLowerCase().includes('right') || n.toLowerCase().includes('r_')));
  } catch (e) {
    console.error(`Error loading ${model.name}:`, e);
  }
}

async function main() {
  for (const model of models) {
    await inspectModel(model);
  }
}

main();
