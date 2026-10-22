"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CLASSES, RACES, type ClassId, type RaceId } from "@/lib/game/data";
import { loadClassModel, updateModelColors, setAnimationByState, disposeModel, type FBXModel } from "@/lib/game/fbx-loader";
import { createLowPolyCharacter, type LowPolyCharacter } from "../../../PJ_MODEL";

// Live 3D preview of the selected race + class, with idle/attack/cast animations.
export function CharacterPreview({ race, cls, primaryColor, secondaryColor }: { race: RaceId; cls: ClassId; primaryColor?: string; secondaryColor?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [rendererReady, setRendererReady] = useState(false);
  const state = useRef<{ scene: THREE.Scene; model: FBXModel | null; holder: THREE.Group; mixer: THREE.AnimationMixer | null; pjChar: LowPolyCharacter | null } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      el.appendChild(renderer.domElement);
    } catch (err) {
      console.warn("[CharacterPreview] WebGL unavailable:", err);
      setLoading(false);
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, el.clientWidth / el.clientHeight, 0.1, 100);
    camera.position.set(0, 1.6, 6.2);
    camera.lookAt(0, 1.05, 0);
    scene.add(new THREE.HemisphereLight("#cfe6ff", "#2a1a10", 1.2));
    const key = new THREE.DirectionalLight("#fff1d6", 3);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#6fb8ff", 2.5);
    rim.position.set(-4, 3, -4);
    scene.add(rim);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.MeshStandardMaterial({ color: "#1a1410", roughness: 0.6, metalness: 0.3 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.65, 64), new THREE.MeshBasicMaterial({ color: "#d4a640" }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    scene.add(ring);
    const holder = new THREE.Group();
    scene.add(holder);
    state.current = { scene, model: null, holder, mixer: null, pjChar: null };
    setRendererReady(true);

    let raf = 0;
    let t = 0;
    let last = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      holder.rotation.y = Math.sin(t * 0.4) * 0.6 + 0.2;
      state.current?.mixer?.update(dt);

      // Update PJ character if exists
      if (state.current?.pjChar) {
        state.current.pjChar.update(dt, false, false);
      }

      try {
        renderer.render(scene, camera);
      } catch {}
    };
    loop();
    const onResize = () => {
      if (!el) return;
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      try {
        renderer.dispose();
        renderer.domElement.remove();
      } catch {}
      setRendererReady(false);
    };
  }, []);

  useEffect(() => {
    const s = state.current;
    if (!s || !rendererReady) return;

    const loadModel = async () => {
      setLoading(true);
      if (s.model) {
        // Stop all animations
        s.model.mixer.stopAllAction();
        // Remove model from holder
        s.holder.remove(s.model.root);
        // Dispose the model completely
        disposeModel(s.model);
        s.model = null;
        s.mixer = null;
      }

      // Clear PJ character if exists
      if (s.pjChar) {
        s.holder.remove(s.pjChar.group);
        s.pjChar.destroy();
        s.pjChar = null;
      }

      // Clear all children from holder to ensure no leftover models
      while (s.holder.children.length > 0) {
        const child = s.holder.children[0];
        s.holder.remove(child);
      }

      try {
        const primColor = primaryColor || "#c79c6e";
        const secColor = secondaryColor || "#5a3b22";
        const r = RACES.find((x) => x.id === race)!;
        const c = CLASSES.find((x) => x.id === cls)!;

        console.log("[CharacterPreview] Loading model for class:", cls, "race:", race, "colors:", primColor, secColor);

        // Use PJ_MODEL for human paladin (same as ingame)
        if (race === "human" && cls === "paladin") {
          console.log("[CharacterPreview] Using PJ_MODEL for human paladin");
          const pjChar = createLowPolyCharacter({
            race: "human",
            skinColor: r.skin,
            hairColor: r.hair,
            eyeColor: "#3b82f6",
          });

          // Equip paladin gear
          pjChar.equip('helmet', {
            slot: 'helmet',
            style: 'plate',
            visualColor: c.armor,
            secondaryColor: c.trim,
          });

          pjChar.equip('chest', {
            slot: 'chest',
            visualColor: c.armor,
            secondaryColor: c.trim,
          });

          pjChar.equip('cape', {
            slot: 'cape',
            visualColor: "#7a1424",
            secondaryColor: c.trim,
          });

          pjChar.equip('gloves', {
            slot: 'gloves',
            visualColor: c.armor,
          });

          pjChar.equip('pants', {
            slot: 'pants',
            visualColor: c.armor,
          });

          pjChar.equip('boots', {
            slot: 'boots',
            visualColor: "#334155",
          });

          pjChar.equip('weapon', {
            slot: 'weapon',
            weaponType: 'sword',
            visualColor: '#cbd5e1',
            secondaryColor: c.trim,
          });

          pjChar.equip('shield', {
            slot: 'shield',
            visualColor: '#1e3a8a',
            secondaryColor: c.trim,
          });

          // Scale appropriately (increased by 50%)
          const scale = (1 / Math.max(1, r.scale * 0.92)) * 1.5;
          pjChar.group.scale.setScalar(scale);

          s.holder.add(pjChar.group);
          s.pjChar = pjChar;
          console.log("[CharacterPreview] PJ_MODEL loaded successfully");
        } else {
          // Use FBX for other classes
          const model = await loadClassModel(cls, primColor, secColor);
          s.holder.add(model.root);
          s.model = model;
          s.mixer = model.mixer;

          // Scale the model appropriately (increased by 50%)
          const scale = (1 / Math.max(1, r.scale * 0.92)) * 1.5;
          s.holder.scale.setScalar(scale);

          // Play idle animation using the new state-based system
          setAnimationByState(model, "idle");
          console.log("[CharacterPreview] Playing idle animation");
          console.log("[CharacterPreview] FBX Model loaded successfully");
        }
      } catch (e) {
        console.error("Failed to load model:", e);
      } finally {
        setLoading(false);
      }
    };

    loadModel();
  }, [race, cls, rendererReady]);

  useEffect(() => {
    const s = state.current;
    if (!s || !primaryColor || !secondaryColor || cls === "warrior") return;

    // Update FBX model colors
    if (s.model) {
      try {
        updateModelColors(s.model, primaryColor, secondaryColor);
      } catch (e) {
        console.error("Failed to update model colors:", e);
      }
    }

    // Update PJ character appearance (if human paladin)
    if (s.pjChar && race === "human" && cls === "paladin") {
      try {
        const c = CLASSES.find((x) => x.id === cls)!;
        // Re-equip items with new colors
        s.pjChar.equip('helmet', {
          slot: 'helmet',
          style: 'plate',
          visualColor: primaryColor,
          secondaryColor: secondaryColor,
        });

        s.pjChar.equip('chest', {
          slot: 'chest',
          visualColor: primaryColor,
          secondaryColor: secondaryColor,
        });

        s.pjChar.equip('cape', {
          slot: 'cape',
          visualColor: "#7a1424",
          secondaryColor: secondaryColor,
        });

        s.pjChar.equip('gloves', {
          slot: 'gloves',
          visualColor: primaryColor,
        });

        s.pjChar.equip('pants', {
          slot: 'pants',
          visualColor: primaryColor,
        });

        s.pjChar.equip('weapon', {
          slot: 'weapon',
          weaponType: 'sword',
          visualColor: '#cbd5e1',
          secondaryColor: secondaryColor,
        });

        s.pjChar.equip('shield', {
          slot: 'shield',
          visualColor: '#1e3a8a',
          secondaryColor: secondaryColor,
        });
      } catch (e) {
        console.error("Failed to update PJ character colors:", e);
      }
    }
  }, [cls, primaryColor, secondaryColor, race]);

  return (
    <div ref={ref} className="h-full w-full relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#06080b]/80 z-10">
          <div className="text-center">
            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <p className="text-xs text-stone-400">Cargando modelo...</p>
          </div>
        </div>
      )}
    </div>
  );
}
