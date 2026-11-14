// Daylight cycle: the sun drifts between morning and late afternoon and back. There is no night.
import * as THREE from '../vendor/three.module.js';
const DAY_SECONDS = 24 * 60, DAY_START = 7.5, DAY_END = 16.8;
const C = (h) => new THREE.Color(h);
const KEY = { // [zenith, horizon, sun colour]
  night: [C(0x04060c), C(0x0a0f18), C(0x6f86b0)], dusk: [C(0x26304a), C(0xb0603a), C(0xff9a5a)], day: [C(0x5f87b0), C(0xb4c2c8), C(0xfff0d8)],
};
export class Sky {
  constructor(scene, renderer, startHour, shadows) {
    this.scene = scene; this.hour = Math.max(DAY_START, Math.min(DAY_END, startHour)); this.dirn = 1; this.daylight = 1;
    this.sun = new THREE.DirectionalLight(0xffffff, 2); this.sun.castShadow = shadows; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 220; this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd0e0, 0x8f8b7c, 1); scene.add(this.hemi);
    scene.fog = new THREE.Fog(0x9aa7ad, 20, 190);
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: C(0) }, hor: { value: C(0) }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: C(0) }, glow: { value: 1 }, time: { value: 0 }, cloud: { value: C(0xffffff) } },
      vertexShader: 'varying vec3 d; void main(){ d = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 cloud; uniform float glow; uniform float time; varying vec3 d; float hs(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); } float ns(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hs(i),hs(i+vec2(1,0)),f.x), mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x), f.y); } float fbm(vec2 p){ float a=0.5, v=0.0; for(int i=0;i<5;i++){ v+=a*ns(p); p=p*2.03+vec2(17.0,9.0); a*=0.5; } return v; } void main(){ float h = clamp(d.y,0.0,1.0); vec3 c = mix(hor, top, pow(h,0.55)); float s = max(dot(normalize(d), sunDir),0.0); c += sunCol * (pow(s,900.0)*3.0 + pow(s,12.0)*0.22*glow); if (d.y > 0.02) { vec2 uv = d.xz / (d.y + 0.12) * 0.9 + vec2(time * 0.006, time * 0.002); float cl = smoothstep(0.5, 0.78, fbm(uv)) * smoothstep(0.02, 0.22, d.y); float shade = 0.72 + 0.28 * smoothstep(0.45, 0.9, fbm(uv + sunDir.xz * 0.25)); c = mix(c, cloud * shade, cl * 0.85); } if(d.y<0.0) c = hor*0.6; gl_FragColor = vec4(c,1.0); }' }));
    this.dome.renderOrder = -10; scene.add(this.dome);
    const sp = []; for (let i = 0; i < 900; i++) { const a = Math.random() * 6.2832, e = Math.asin(Math.random() * 0.98 + 0.02); sp.push(Math.cos(a) * Math.cos(e) * 850, Math.sin(e) * 850, Math.sin(a) * Math.cos(e) * 850); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8e8, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(this.stars);
    this.tmp = C(0); this.update(0, { x: 0, y: 0, z: 0 });
  }
  clockText() { const h = Math.floor(this.hour), m = Math.floor((this.hour % 1) * 60); return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
  update(dt, pos) {
    // Night was removed at the player's request: time swings between DAY_START and DAY_END instead of wrapping.
    this.hour += this.dirn * dt * 24 / DAY_SECONDS; if (this.hour >= DAY_END) { this.hour = DAY_END; this.dirn = -1; } else if (this.hour <= DAY_START) { this.hour = DAY_START; this.dirn = 1; }
    const ang = (this.hour - 6) / 24 * 6.2832, elev = Math.sin(ang);                 // sunrise 06:00, sunset 18:00
    const day = THREE.MathUtils.smoothstep(elev, -0.12, 0.3), dusk = Math.max(0, 1 - Math.abs(elev) / 0.3) * (elev > -0.2 ? 1 : 0);
    this.daylight = day;
    const sunDir = new THREE.Vector3(Math.cos(ang) * 0.85, elev, 0.4).normalize(), moonDir = new THREE.Vector3(-Math.cos(ang) * 0.6, Math.max(0.35, -elev), -0.5).normalize();
    const useSun = elev > -0.06, dir = useSun ? sunDir : moonDir;
    const top = this.dome.material.uniforms.top.value.copy(KEY.night[0]).lerp(KEY.day[0], day).lerp(KEY.dusk[0], dusk * 0.6);
    const hor = this.dome.material.uniforms.hor.value.copy(KEY.night[1]).lerp(KEY.day[1], day).lerp(KEY.dusk[1], dusk * 0.75);
    const sc = this.tmp.copy(KEY.dusk[2]).lerp(KEY.day[2], THREE.MathUtils.smoothstep(elev, 0.05, 0.5));
    this.dome.material.uniforms.sunDir.value.copy(dir); this.dome.material.uniforms.sunCol.value.copy(useSun ? sc : KEY.night[2]).multiplyScalar(useSun ? 1 : 0.5); this.dome.material.uniforms.glow.value = useSun ? 1 : 0.25;
    this.sun.color.copy(useSun ? sc : KEY.night[2]); this.sun.intensity = useSun ? 0.15 + 2.7 * THREE.MathUtils.smoothstep(elev, -0.06, 0.35) : 0.22;
    this.sun.target.position.set(Math.round(pos.x), 0, Math.round(pos.z)); this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 110);
    this.hemi.intensity = 0.2 + 1.9 * day; this.hemi.color.copy(top).lerp(hor, 0.5).multiplyScalar(1.2); this.hemi.groundColor.setHex(0x8f8b7c).multiplyScalar(0.35 + 0.65 * day);
    this.scene.fog.color.copy(hor).multiplyScalar(0.92); this.scene.fog.near = 6 + 24 * day; this.scene.fog.far = 60 + 150 * day;
    this.dome.material.uniforms.time.value += dt; this.dome.material.uniforms.cloud.value.copy(hor).lerp(C(0xffffff), 0.75).multiplyScalar(0.55 + 0.45 * day);
    this.stars.material.opacity = (1 - day) * 0.9; this.dome.position.set(pos.x, 0, pos.z); this.stars.position.set(pos.x, 0, pos.z);
  }
  dispose() { this.scene.remove(this.sun, this.sun.target, this.hemi, this.dome, this.stars); this.scene.fog = null; }
}
