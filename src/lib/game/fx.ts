// GPU-friendly particle system + spell visual effects.
import * as THREE from "three";

export class Particles {
  private max: number;
  private geo: THREE.BufferGeometry;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private grav: Float32Array;
  private baseSize: Float32Array;
  private cursor = 0;
  points: THREE.Points;

  constructor(scene: THREE.Scene, max = 6000) {
    this.max = max;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("size", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("alpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * (420.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); if (r > 0.5) discard; float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(vC * (0.6 + a*1.4), a * a * vA); }`,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(p: THREE.Vector3, v: THREE.Vector3, color: THREE.Color, size: number, life: number, gravity = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.baseSize[i] = size;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = gravity;
    this.alpha[i] = 1;
  }

  burst(p: THREE.Vector3, color: string | THREE.Color, n: number, speed: number, size: number, life: number, gravity = 0, up = 0) {
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    const v = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      v.set(Math.random() - 0.5, Math.random() - 0.5 + up, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
      this.emit(p, v, c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), gravity);
    }
  }

  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        if (this.alpha[i] !== 0) this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.min(1, k * 2.2);
      this.size[i] = this.baseSize[i] * (0.4 + k * 0.6);
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.size as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.alpha as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** Expanding glowing ring on the ground (AoE / level up / impacts). */
export class Rings {
  private items: { mesh: THREE.Mesh; t: number; dur: number; r: number }[] = [];
  constructor(private scene: THREE.Scene) {}
  spawn(p: THREE.Vector3, color: string, radius: number, dur = 0.7) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    m.position.copy(p).add(new THREE.Vector3(0, 0.25, 0));
    this.scene.add(m);
    this.items.push({ mesh: m, t: 0, dur, r: radius });
  }
  update(dt: number) {
    this.items = this.items.filter((it) => {
      it.t += dt;
      const k = it.t / it.dur;
      it.mesh.scale.setScalar(0.2 + k * it.r);
      (it.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k);
      if (k >= 1) {
        this.scene.remove(it.mesh);
        it.mesh.geometry.dispose();
        (it.mesh.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });
  }
}

/** Glowing column of light (level up, loot beam). */
export function makeBeam(color: string, h = 12, r = 1.2) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 24, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  m.geometry.translate(0, h / 2, 0);
  return m;
}
