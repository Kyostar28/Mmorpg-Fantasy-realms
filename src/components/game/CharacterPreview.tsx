"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { CLASSES, RACES, type ClassId, type RaceId } from "@/lib/game/data";
import { buildPlayerModel, type Model } from "@/lib/game/models";

// Live 3D preview of the selected race + class, with idle/attack/cast animations.
export function CharacterPreview({ race, cls }: { race: RaceId; cls: ClassId }) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef<{ scene: THREE.Scene; model: Model | null; holder: THREE.Group } | null>(null);

  useEffect(() => {
    const el = ref.current!;
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
    state.current = { scene, model: null, holder };

    let raf = 0;
    let t = 0;
    let last = performance.now();
    const anim = { speed: 0, action: null as null | "attack" | "cast", actionT: 0, dead: false, deadT: 0 };
    let nextAction = 2;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      holder.rotation.y = Math.sin(t * 0.4) * 0.6 + 0.2;
      nextAction -= dt;
      if (nextAction <= 0) {
        anim.action = Math.random() < 0.5 ? "attack" : "cast";
        anim.actionT = 0;
        nextAction = 3;
      }
      if (anim.action) {
        anim.actionT += dt;
        if (anim.actionT > (anim.action === "cast" ? 1.2 : 0.55)) anim.action = null;
      }
      state.current?.model?.animate(dt, t, anim);
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
    };
  }, []);

  useEffect(() => {
    const s = state.current;
    if (!s) return;
    if (s.model) {
      s.holder.remove(s.model.root);
      s.model.dispose();
    }
    const r = RACES.find((x) => x.id === race)!;
    const c = CLASSES.find((x) => x.id === cls)!;
    const m = buildPlayerModel(r, c);
    s.holder.add(m.root);
    s.model = m;
    const scale = 1 / Math.max(1, r.scale * 0.92);
    s.holder.scale.setScalar(scale);
  }, [race, cls]);

  return <div ref={ref} className="h-full w-full" />;
}
