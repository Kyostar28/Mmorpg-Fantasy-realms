"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CLASSES, RACES, type ClassId, type RaceId } from "@/lib/game/data";
import { loadClassModel, updateModelColors, playAnimation, disposeModel, type FBXModel } from "@/lib/game/fbx-loader";

// Live 3D preview of the selected race + class, with idle/attack/cast animations.
export function CharacterPreview({ race, cls, primaryColor, secondaryColor }: { race: RaceId; cls: ClassId; primaryColor?: string; secondaryColor?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [rendererReady, setRendererReady] = useState(false);
  const state = useRef<{ scene: THREE.Scene; model: FBXModel | null; holder: THREE.Group; mixer: THREE.AnimationMixer | null } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
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
    state.current = { scene, model: null, holder, mixer: null };
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
      renderer.render(scene, camera);
    };
    loop();
    const onResize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      renderer.domElement.remove();
      setRendererReady(false);
    };
  }, []);

  useEffect(() => {
    const s = state.current;
    if (!s || !rendererReady) return;

    const loadModel = async () => {
      setLoading(true);
      if (s.model) {
        s.holder.remove(s.model.root);
        disposeModel(s.model);
        s.model = null;
      }

      try {
        const primColor = primaryColor || "#c79c6e";
        const secColor = secondaryColor || "#5a3b22";
        console.log("[CharacterPreview] Loading model for class:", cls, "colors:", primColor, secColor);
        const model = await loadClassModel(cls, primColor, secColor);
        s.holder.add(model.root);
        s.model = model;
        s.mixer = model.mixer;

        // Scale the model appropriately
        const r = RACES.find((x) => x.id === race)!;
        const scale = 1 / Math.max(1, r.scale * 0.92);
        s.holder.scale.setScalar(scale);

        // Play idle animation - check available animations first
        console.log("[CharacterPreview] Available animations:", Array.from(model.animations.keys()));
        
        // Try common idle animation names
        const idleNames = ["Idle", "Stand", "Standing", "Idle_01", "Idle_02", "Wait", "Idle_Rest"];
        let played = false;
        for (const name of idleNames) {
          if (model.animations.has(name)) {
            playAnimation(model, name, true);
            console.log("[CharacterPreview] Playing animation:", name);
            played = true;
            break;
          }
        }
        
        // If no specific idle animation found, use the first available
        if (!played) {
          const firstAnim = model.animations.keys().next().value;
          if (firstAnim) {
            playAnimation(model, firstAnim, true);
            console.log("[CharacterPreview] Playing first available animation:", firstAnim);
          }
        }
        console.log("[CharacterPreview] Model loaded successfully");
      } catch (e) {
        console.error("Failed to load FBX model:", e);
      } finally {
        setLoading(false);
      }
    };

    loadModel();
  }, [race, cls, primaryColor, secondaryColor, rendererReady]);

  useEffect(() => {
    const s = state.current;
    if (!s || !s.model || !primaryColor || !secondaryColor) return;
    try {
      updateModelColors(s.model, primaryColor, secondaryColor);
    } catch (e) {
      console.error("Failed to update model colors:", e);
    }
  }, [primaryColor, secondaryColor]);

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
