"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { CLASSES, DEFAULT_PLAYER_APPEARANCE, RACES, type PlayerAppearance } from "@/lib/game/data";
import { buildPlayerModel } from "@/lib/game/models";

export function CharacterPreview({ appearance, onAvailabilityChange }: { appearance: PlayerAppearance; onAvailabilityChange?: (isLive: boolean) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const availabilityChangeRef = useRef(onAvailabilityChange);
  availabilityChangeRef.current = onAvailabilityChange;
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const holderRef = useRef<THREE.Group | null>(null);
  const modelRef = useRef<ReturnType<typeof buildPlayerModel> | null>(null);
  const readyRef = useRef(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (error) {
      console.warn("[CharacterPreview] WebGL unavailable:", error);
      setWebglUnavailable(true);
      availabilityChangeRef.current?.(false);
      return;
    }

    setWebglUnavailable(false);
    availabilityChangeRef.current?.(true);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const camera = new THREE.PerspectiveCamera(34, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 100);
    camera.position.set(0, 1.1, 5.6);
    camera.lookAt(0, 1.02, 0);
    scene.add(new THREE.HemisphereLight("#dbeaff", "#302316", 1.8));
    const key = new THREE.DirectionalLight("#fff0d0", 3.2);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#82c5ed", 1.8);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.45, 48),
      new THREE.MeshStandardMaterial({ color: "#151b1d", roughness: 0.7, metalness: 0.15 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.42, 1.45, 48), new THREE.MeshBasicMaterial({ color: "#bd9850" }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.01;
    scene.add(ring);
    const holder = new THREE.Group();
    holderRef.current = holder;
    scene.add(holder);
    readyRef.current = true;

    let frame = 0;
    let elapsed = 0;
    let previous = performance.now();
    const render = () => {
      frame = requestAnimationFrame(render);
      const now = performance.now();
      const delta = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      elapsed += delta;
      holder.rotation.y = Math.sin(elapsed * 0.28) * 0.35;
      modelRef.current?.animate(delta, elapsed, { speed: 0, action: null, actionT: 0, dead: false, deadT: 0 });
      renderer.render(scene, camera);
    };
    render();

    const resize = () => {
      if (!container.clientWidth || !container.clientHeight) return;
      renderer.setSize(container.clientWidth, container.clientHeight);
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", resize);
      modelRef.current?.dispose();
      modelRef.current = null;
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      holderRef.current = null;
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!readyRef.current || !holderRef.current) return;
    modelRef.current?.dispose();
    holderRef.current.clear();
    const model = buildPlayerModel(
      RACES.find((race) => race.id === "human") ?? RACES[0],
      CLASSES.find((characterClass) => characterClass.id === "warrior") ?? CLASSES[0],
      { ...DEFAULT_PLAYER_APPEARANCE, ...appearance },
    );
    holderRef.current.add(model.root);
    modelRef.current = model;
  }, [appearance.hairColor, appearance.chestColor, appearance.pantsColor, appearance.bootsColor]);

  return (
    <div className="absolute inset-0" aria-label="Vista previa de la apariencia del personaje" role="img">
      <div ref={containerRef} className="absolute inset-0" />
      {webglUnavailable && (
        <img
          src="/character-reference.png?v=2"
          alt="Referencia del aventurero low-poly con cabello rubio y atuendo de fantasía"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain px-10 py-12 opacity-90"
        />
      )}
    </div>
  );
}
