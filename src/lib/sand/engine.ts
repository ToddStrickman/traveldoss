/**
 * SandEngine — the living excavation behind the Travel Doss hero.
 *
 * Plain Three.js (no fiber): one orthographic scene, two Points clouds
 * (grains + dust), a CPU physics loop over typed arrays, and a coarse
 * "cleanliness" grid that remembers where the visitor has excavated.
 *
 * Design notes:
 * - World units are CSS pixels, origin at canvas center, +y up.
 * - Grains never interact with each other (O(n) per frame). Realism comes
 *   from per-grain variation + shared force fields (wind, cursor, noise).
 * - The buffer is laid out [letters | glyphs | overburden] so the perf
 *   governor can shrink drawRange from the overburden end without ever
 *   dropping a letter grain.
 */

import * as THREE from "three";
import { Simplex2, mulberry32 } from "./noise";
import { rollStory, LIGHTING, type Story, type LightingPreset } from "./story";
import {
  ensureFontLoaded,
  sampleHeadline,
  type HeadlineLine,
  type SampledPoint,
} from "./textSampler";

export interface SandEngineOptions {
  lines: HeadlineLine[];
  fontFamily: string;
  particleCount: number;
  /** Cursor influence radius in px (scales up with pointer speed). */
  cursorRadius: number;
  /** Attraction strength multiplier. */
  attraction: number;
  /** Wind strength multiplier over the story's base wind. */
  windIntensity: number;
  /** 0..1 dust spawn multiplier. */
  dustIntensity: number;
  /** Override the story's reveal duration, seconds. */
  revealDuration?: number;
  /**
   * Extra visible margin past the layout box, as fractions of it. The canvas
   * element must be enlarged by the same fractions (see SandHero). Loose sand
   * feathers into this margin so the field never reads as a rectangle; the
   * inscription itself stays sized and centered to the layout box.
   */
  bleed?: { x?: number; top?: number; bottom?: number };
  lighting?: LightingPreset;
  persist: boolean;
  reducedMotion: boolean;
  seed?: number;
  onStory?: (story: Story) => void;
}

const PERSIST_KEY = "td_sand_v1";
const PERSIST_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

const GRID_COLS = 56;

/**
 * Once the opening reveal has run, cell cleanliness never decays below this.
 * Sand still drifts back over excavated areas (texture, edge softness) but
 * the inscription itself stays legible forever — on every load, after every
 * wow-moment reclaim, and across persisted visits.
 */
const LEGIBILITY_FLOOR = 0.62;

// Layer physics: [surface, mid, deep]
const SPRING = [13, 24, 40] as const;
const WIND_MUL = [1.0, 0.42, 0.13] as const;
const CURSOR_MUL = [1.0, 0.5, 0.18] as const;
const DAMPING = [0.9, 0.92, 0.95] as const;

const DUST_CAP = 1400;

interface Pools {
  px: Float32Array; py: Float32Array;
  vx: Float32Array; vy: Float32Array;
  hx: Float32Array; hy: Float32Array;
  layer: Uint8Array;          // 0 surface / 1 mid / 2 deep
  cell: Int32Array;           // memory-grid cell per grain (-1 = none)
  zone: Float32Array;         // 0..1 regional stiffness (adaptive zones)
  burialGate: Float32Array;   // overburden: cleanliness at which grain lifts
  scattered: Uint8Array;      // overburden: 1 after its lift-off impulse fired
}

export class SandEngine {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.OrthographicCamera;
  private grains!: THREE.Points;
  private dust!: THREE.Points;
  private grainMat!: THREE.ShaderMaterial;
  private dustMat!: THREE.ShaderMaterial;
  private shaft: THREE.Mesh | null = null;

  private opts: SandEngineOptions;
  private story!: Story;
  private noise: Simplex2;
  private rand: () => number;
  private seed: number;

  private n = 0;              // total grains
  private nLetters = 0;
  private nGlyphs = 0;
  private pools!: Pools;
  private posAttr!: THREE.BufferAttribute;
  private revealAttr!: THREE.BufferAttribute;
  private edge!: Float32Array;

  // Memory grid
  private gridRows = 1;
  private clean!: Float32Array;
  private cleanFloor = 0;
  private gridOrigin = { x: 0, y: 0, w: 1, h: 1 };
  private cellBuckets: number[][] = [];

  // Dust pool
  private dpx = new Float32Array(DUST_CAP);
  private dpy = new Float32Array(DUST_CAP);
  private dvx = new Float32Array(DUST_CAP);
  private dvy = new Float32Array(DUST_CAP);
  private dlife = new Float32Array(DUST_CAP);
  private dustHead = 0;
  private dustPosAttr!: THREE.BufferAttribute;
  private dustLifeAttr!: THREE.BufferAttribute;

  // Pointer state (world units). History rings give the trailing pressure wave.
  private ptr = { x: 0, y: 0, vx: 0, vy: 0, speed: 0, active: false, down: false };
  private ptrTrail: { x: number; y: number }[] = [];

  // Timing / lifecycle
  private raf = 0;
  private lastT = 0;
  private time = 0;
  private interactionTime = 0;
  private running = false;
  private disposed = false;
  private width = 0;
  private height = 0;

  // Wind
  private gustEnv = 0;
  private nextGustAt = 3;
  private gustDir = 1;

  // Wow moment
  private glow = 0;
  private wowPhase: "idle" | "rising" | "hold" | "reclaim" = "idle";
  private wowT = 0;
  private wowCooldownUntil = 0;

  // Perf governor
  private frameEMA = 16;
  private quality = 2; // 2 = full, 1 = trimmed, 0 = minimal
  private qualityTimer = 0;

  private avalancheTimer = 0;
  private saveTimer = 0;
  private revealSweep = 0;    // 0..1 progress of the opening wind reveal

  constructor(private canvas: HTMLCanvasElement, opts: SandEngineOptions) {
    this.opts = opts;
    this.seed = opts.seed ?? ((Math.random() * 0xffffffff) >>> 0);
    this.rand = mulberry32(this.seed);
    this.noise = new Simplex2(this.seed ^ 0x9e3779b9);
  }

  async start(width: number, height: number): Promise<void> {
    this.width = width;
    this.height = height;

    this.story = rollStory(this.rand);
    if (this.opts.lighting) this.story.lighting = this.opts.lighting;
    if (this.opts.revealDuration != null) this.story.revealDuration = this.opts.revealDuration;
    this.opts.onStory?.(this.story);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
    this.applyViewport();

    await ensureFontLoaded(this.opts.fontFamily);
    if (this.disposed) return;
    this.buildParticles();
    this.buildDust();
    this.buildLightShaft();
    this.restorePersisted();

    if (this.opts.reducedMotion) {
      // Static, fully-revealed inscription. No loop, no dust, no drama.
      this.clean.fill(1);
      this.syncRevealAttr(true);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.running = true;
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);

    if (import.meta.env.DEV) {
      // Live inspection handle for devtools: window.__sand.
      (window as unknown as { __sand?: unknown }).__sand = this;
    }
  }

  // ── Setup ────────────────────────────────────────────────────────────

  /**
   * Visible world extents: the layout box plus the bleed margins.
   * x is symmetric; top/bottom are each the distance from the world origin
   * (the layout box's center, where the inscription is anchored) to that edge.
   */
  private view(): { vw: number; vh: number; top: number; bottom: number } {
    const b = this.opts.bleed;
    const bx = (b?.x ?? 0) * this.width;
    const bt = (b?.top ?? 0) * this.height;
    const bb = (b?.bottom ?? 0) * this.height;
    return {
      vw: this.width + 2 * bx,
      vh: this.height + bt + bb,
      top: this.height / 2 + bt,
      bottom: this.height / 2 + bb,
    };
  }

  private applyViewport(): void {
    const v = this.view();
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 2 ? 2 : 1.25);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(v.vw, v.vh, false);
    this.camera.left = -v.vw / 2;
    this.camera.right = v.vw / 2;
    this.camera.top = v.top;
    this.camera.bottom = -v.bottom;
    this.camera.updateProjectionMatrix();
    if (this.grainMat) {
      this.grainMat.uniforms.uPixelRatio.value = dpr;
      (this.grainMat.uniforms.uViewExt.value as THREE.Vector3).set(v.vw / 2, v.top, v.bottom);
    }
    if (this.dustMat) {
      this.dustMat.uniforms.uPixelRatio.value = dpr;
      (this.dustMat.uniforms.uViewExt.value as THREE.Vector3).set(v.vw / 2, v.top, v.bottom);
    }
    if (this.shaft) {
      this.shaft.scale.set(v.vw, v.vh, 1);
      // Keep the quad centered on the camera (not the world origin) so its
      // uv-edge fade still hugs the canvas when the bleed is asymmetric.
      this.shaft.position.y = (v.top - v.bottom) / 2;
    }
  }

  private buildParticles(): void {
    const { particleCount } = this.opts;
    const worldWidth = Math.min(this.width * 0.92, 1150);
    const worldHeight = this.height * 0.94;

    const sampled = sampleHeadline({
      lines: this.opts.lines,
      fontFamily: this.opts.fontFamily,
      worldWidth,
      worldHeight,
      maxPoints: Math.floor(particleCount * 0.62),
      rand: this.rand,
    });
    // Hidden chisel-mark glyphs are retired (owner call, 2026-07-10): even
    // gated behind deep excavation they read as stray broken lines, not
    // ancient carving. textSampler's sampleGlyphs stays available should
    // they ever return.
    const glyphs: SampledPoint[] = [];
    const nOver = Math.floor(particleCount * 0.34);

    this.nLetters = sampled.points.length;
    this.nGlyphs = glyphs.length;
    this.n = this.nLetters + this.nGlyphs + nOver;

    // Memory grid spans the text bounds with margin.
    const gw = sampled.width * 1.12;
    const gh = sampled.height * 1.5;
    this.gridOrigin = { x: -gw / 2, y: -gh / 2, w: gw, h: gh };
    this.gridRows = Math.max(8, Math.round(GRID_COLS * (gh / gw)));
    this.clean = new Float32Array(GRID_COLS * this.gridRows);
    this.cleanFloor = Math.max(0, 1 - this.story.burial);
    this.clean.fill(this.cleanFloor);
    this.cellBuckets = Array.from({ length: GRID_COLS * this.gridRows }, () => []);

    const n = this.n;
    this.pools = {
      px: new Float32Array(n), py: new Float32Array(n),
      vx: new Float32Array(n), vy: new Float32Array(n),
      hx: new Float32Array(n), hy: new Float32Array(n),
      layer: new Uint8Array(n),
      cell: new Int32Array(n),
      zone: new Float32Array(n),
      burialGate: new Float32Array(n),
      scattered: new Uint8Array(n),
    };
    this.edge = new Float32Array(n);

    const pos = new Float32Array(n * 3);
    const aSeed = new Float32Array(n);
    const aSize = new Float32Array(n);
    const aKind = new Float32Array(n);
    const aAccent = new Float32Array(n);
    const aEdge = new Float32Array(n);
    const aReveal = new Float32Array(n);

    const placeLetterLike = (i: number, p: SampledPoint, kind: number) => {
      const P = this.pools;
      P.hx[i] = p.x; P.hy[i] = p.y;
      // Weathering scatters home positions slightly (ancient-ruin look).
      // Kept tight — past ~1.5px the letterforms start reading as fuzzy
      // rather than weathered, which looks unclean instead of ancient.
      const scatter = this.story.weathering * 1.2;
      P.hx[i] += (this.rand() - 0.5) * scatter;
      P.hy[i] += (this.rand() - 0.5) * scatter;
      P.px[i] = P.hx[i]; P.py[i] = P.hy[i];
      const layerRoll = this.rand();
      P.layer[i] = layerRoll < 0.32 ? 0 : layerRoll < 0.78 ? 1 : 2;
      P.zone[i] = 0.5 + 0.5 * this.noise.fbm(P.hx[i] * 0.006, P.hy[i] * 0.006, 2);
      P.cell[i] = this.cellOf(P.hx[i], P.hy[i]);
      this.edge[i] = p.edgeness;

      aSeed[i] = this.rand();
      aSize[i] = 1.7 + this.rand() * 1.1;
      aKind[i] = kind;
      aAccent[i] = p.accent ? 1 : 0;
      aEdge[i] = p.edgeness;
      aReveal[i] = 0;
    };

    sampled.points.forEach((p, i) => placeLetterLike(i, p, 0));
    glyphs.forEach((p, j) => placeLetterLike(this.nLetters + j, p, 2));

    // Overburden: loose sand heaped over the inscription. 70% clusters near
    // letters (sand collects in carvings), the rest drifts across the bounds.
    const base = this.nLetters + this.nGlyphs;
    for (let k = 0; k < nOver; k++) {
      const i = base + k;
      const P = this.pools;
      if (this.rand() < 0.7 && this.nLetters > 0) {
        const src = sampled.points[(this.rand() * this.nLetters) | 0];
        const sigma = sampled.height * 0.16;
        P.hx[i] = src.x + this.gauss() * sigma;
        P.hy[i] = src.y + this.gauss() * sigma * 0.7;
      } else {
        // Uniform across the field — the original look — but a fraction of
        // the drift smears past it on a gaussian tail (heavier below), so
        // the field's boundary feathers into the page instead of cutting.
        P.hx[i] = this.gridOrigin.x + this.rand() * this.gridOrigin.w;
        P.hy[i] = this.gridOrigin.y + this.rand() * this.gridOrigin.h;
        if (this.rand() < 0.5) {
          P.hx[i] += this.gauss() * gw * 0.24;
          P.hy[i] += this.gauss() * gh * 0.1 - Math.abs(this.gauss()) * gh * 0.3;
        }
      }
      P.px[i] = P.hx[i]; P.py[i] = P.hy[i];
      const layerRoll = this.rand();
      P.layer[i] = layerRoll < 0.55 ? 0 : layerRoll < 0.9 ? 1 : 2;
      P.zone[i] = 0.5 + 0.5 * this.noise.fbm(P.hx[i] * 0.006 + 31, P.hy[i] * 0.006, 2);
      // Nearest cell, clamped: spill grains past the field still belong to
      // the excavation at its edge — same dig/lift lifecycle as every other
      // grain, so interaction never exposes the grid's rectangle.
      const cell = this.cellOfClamped(P.hx[i], P.hy[i]);
      P.cell[i] = cell;
      this.cellBuckets[cell].push(i);
      // Each grain lifts at a different cleanliness → granular, uneven digging.
      P.burialGate[i] = 0.15 + this.rand() * 0.7;

      aSeed[i] = this.rand();
      aSize[i] = 2.1 + this.rand() * 1.6;
      aKind[i] = 1;
      aAccent[i] = 0;
      aEdge[i] = 0;
      aReveal[i] = 1; // for overburden, reveal is presence (1 = sitting there)
    }

    for (let i = 0; i < n; i++) {
      pos[i * 3] = this.pools.px[i];
      pos[i * 3 + 1] = this.pools.py[i];
      pos[i * 3 + 2] = 0;
    }

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.revealAttr = new THREE.BufferAttribute(aReveal, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", this.posAttr);
    geo.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
    geo.setAttribute("aSize", new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute("aKind", new THREE.BufferAttribute(aKind, 1));
    geo.setAttribute("aAccent", new THREE.BufferAttribute(aAccent, 1));
    geo.setAttribute("aEdge", new THREE.BufferAttribute(aEdge, 1));
    geo.setAttribute("aReveal", this.revealAttr);

    const light = LIGHTING[this.story.lighting];
    this.grainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uPixelRatio: { value: 1 },
        uTime: { value: 0 },
        uGlow: { value: 0 },
        uTint: { value: new THREE.Vector3(...light.tint) },
        uSunDir: { value: new THREE.Vector2(...light.sunDir).normalize() },
        uAmbient: { value: light.ambient },
        uViewExt: { value: new THREE.Vector3(this.width / 2, this.height / 2, this.height / 2) },
      },
      vertexShader: GRAIN_VERT,
      fragmentShader: GRAIN_FRAG,
    });

    this.grains = new THREE.Points(geo, this.grainMat);
    this.grains.frustumCulled = false;
    this.scene.add(this.grains);
  }

  private buildDust(): void {
    const pos = new Float32Array(DUST_CAP * 3);
    const life = new Float32Array(DUST_CAP);
    const seed = new Float32Array(DUST_CAP);
    for (let i = 0; i < DUST_CAP; i++) seed[i] = this.rand();

    const geo = new THREE.BufferGeometry();
    this.dustPosAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.dustLifeAttr = new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", this.dustPosAttr);
    geo.setAttribute("aLife", this.dustLifeAttr);
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));

    const light = LIGHTING[this.story.lighting];
    this.dustMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPixelRatio: { value: 1 },
        uTint: { value: new THREE.Vector3(...light.tint) },
        uViewExt: { value: new THREE.Vector3(this.width / 2, this.height / 2, this.height / 2) },
      },
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
    });
    this.dust = new THREE.Points(geo, this.dustMat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
    this.applyViewport(); // push pixel ratio into the new materials
  }

  /** One soft angled light shaft; skipped for midday (sun overhead). */
  private buildLightShaft(): void {
    if (this.story.lighting === "midday") return;
    const light = LIGHTING[this.story.lighting];
    // Unit quad scaled to the viewport in applyViewport — its uv doubles as
    // canvas uv, so the shader can fade to zero well before the canvas edge.
    // (An oversized quad hard-clips at the canvas boundary and reads as a
    // bright band that isn't contiguous with the page.)
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uDir: { value: new THREE.Vector2(...light.sunDir).normalize() },
        uTint: { value: new THREE.Vector3(...light.tint) },
        uStrength: { value: this.story.lighting === "moonlight" ? 0.02 : 0.032 },
      },
      vertexShader: SHAFT_VERT,
      fragmentShader: SHAFT_FRAG,
    });
    this.shaft = new THREE.Mesh(geo, mat);
    this.shaft.position.z = -1;
    const v = this.view();
    this.shaft.scale.set(v.vw, v.vh, 1);
    this.shaft.position.y = (v.top - v.bottom) / 2;
    this.scene.add(this.shaft);
  }

  // ── Public API ───────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    if (this.disposed) return;
    this.width = width;
    this.height = height;
    this.applyViewport();
    if (this.opts.reducedMotion) this.renderer.render(this.scene, this.camera);
  }

  /** Full rebuild (text re-sampled at new size). Debounce upstream. */
  async rebuild(width: number, height: number): Promise<void> {
    if (this.disposed) return;
    const wasClean = this.clean;
    const rows = this.gridRows;
    this.scene.remove(this.grains);
    this.grains.geometry.dispose();
    this.grainMat.dispose();
    this.width = width;
    this.height = height;
    this.buildParticles();
    // Carry excavation memory across rebuilds (best effort, same grid dims).
    if (this.clean.length === wasClean.length && rows === this.gridRows) {
      this.clean.set(wasClean);
    } else {
      // Fresh grid — replay the opening wind reveal so the inscription
      // doesn't sit inert at the burial floor.
      this.revealSweep = 0;
      this.time = Math.min(this.time, this.story.revealDelay);
    }
    this.applyViewport();
  }

  pointer(clientX: number, clientY: number, down: boolean): void {
    const rect = this.canvas.getBoundingClientRect();
    // With an asymmetric bleed the world origin is not the canvas center:
    // map through the view extents instead.
    const v = this.view();
    const x = (clientX - rect.left) * (v.vw / rect.width) - v.vw / 2;
    const y = v.top - (clientY - rect.top) * (v.vh / rect.height);
    this.ptr.active = true;
    this.ptr.down = down;
    this.ptr.x = x;
    this.ptr.y = y;
  }

  pointerLeave(): void {
    this.ptr.active = false;
    this.ptr.down = false;
    this.ptr.speed = 0;
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.persist();
    this.grains?.geometry.dispose();
    this.grainMat?.dispose();
    this.dust?.geometry.dispose();
    this.dustMat?.dispose();
    if (this.shaft) {
      this.shaft.geometry.dispose();
      (this.shaft.material as THREE.Material).dispose();
    }
    this.renderer?.dispose();
  }

  // ── Frame loop ───────────────────────────────────────────────────────

  private frame = (now: number): void => {
    if (!this.running || this.disposed) return;
    const rawDt = (now - this.lastT) / 1000;
    this.lastT = now;
    const dt = Math.min(rawDt, 1 / 30); // clamp after tab-switch pauses
    this.time += dt;

    this.frameEMA = this.frameEMA * 0.95 + rawDt * 1000 * 0.05;
    this.governQuality(dt);

    this.updatePointerDynamics(dt);
    this.updateWind(dt);
    this.updateRevealSweep(dt);
    this.updateGrid(dt);
    this.simulate(dt);
    this.updateDust(dt);
    this.updateWow(dt);
    this.updateCamera();
    this.maybeAvalanche(dt);
    this.maybeSave(dt);

    this.grainMat.uniforms.uTime.value = this.time;
    this.grainMat.uniforms.uGlow.value = this.glow;
    if (this.shaft) {
      (this.shaft.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    }
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.frame);
  };

  private updatePointerDynamics(dt: number): void {
    const p = this.ptr;
    if (!p.active) {
      p.speed *= 0.9;
      return;
    }
    // Smoothed velocity from position deltas.
    const last = this.ptrTrail[this.ptrTrail.length - 1];
    if (last) {
      const ivx = (p.x - last.x) / Math.max(dt, 1e-3);
      const ivy = (p.y - last.y) / Math.max(dt, 1e-3);
      p.vx = p.vx * 0.8 + ivx * 0.2;
      p.vy = p.vy * 0.8 + ivy * 0.2;
      p.speed = Math.hypot(p.vx, p.vy);
    }
    this.ptrTrail.push({ x: p.x, y: p.y });
    if (this.ptrTrail.length > 20) this.ptrTrail.shift();
    if (p.speed > 12) this.interactionTime += dt;
  }

  private updateWind(dt: number): void {
    const s = this.story;
    if (this.time >= this.nextGustAt) {
      this.gustEnv = 1;
      this.gustDir = this.rand() < 0.5 ? -1 : 1;
      this.nextGustAt = this.time + 4 + this.rand() * (16 * (1 - s.gustiness));
      // Gusts do a little uncovering of their own.
      const band = (this.rand() * this.gridRows) | 0;
      for (let c = 0; c < GRID_COLS; c++) {
        const idx = band * GRID_COLS + c;
        this.clean[idx] = Math.min(1, this.clean[idx] + 0.04 + this.rand() * 0.05);
      }
    }
    this.gustEnv = Math.max(0, this.gustEnv - dt / 2.4);
  }

  /** The opening cinematic: wind sweeps left→right, lifting the burial. */
  private updateRevealSweep(dt: number): void {
    const s = this.story;
    if (this.revealSweep >= 1) return;
    const t = this.time - s.revealDelay;
    if (t < 0) return;
    this.revealSweep = Math.min(1, t / s.revealDuration);
    // The sweep always lands above the legibility floor — burial only shapes
    // how much richer than the floor the first impression is.
    const target = Math.max(LEGIBILITY_FLOOR + 0.12, 1 - s.burial * 0.5);
    const sweepX = this.revealSweep * 1.25; // overshoot so the far edge finishes
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const fx = c / GRID_COLS;
        if (fx < sweepX) {
          const idx = r * GRID_COLS + c;
          if (this.clean[idx] < target) {
            this.clean[idx] = Math.min(target, this.clean[idx] + dt * 1.5);
          }
        }
      }
    }
    // Reveal finished: from here on, the wordmark can never sink back below
    // legibility — returning sand becomes texture, not erasure.
    if (this.revealSweep >= 1) {
      this.cleanFloor = Math.max(this.cleanFloor, LEGIBILITY_FLOOR);
    }
    if (dt > 0 && this.rand() < 0.3) {
      const wx = this.gridOrigin.x + sweepX * this.gridOrigin.w;
      this.spawnDust(
        Math.min(wx, this.gridOrigin.x + this.gridOrigin.w),
        this.gridOrigin.y + this.rand() * this.gridOrigin.h,
        2, 26,
      );
    }
  }

  private updateGrid(dt: number): void {
    const p = this.ptr;
    // Cursor excavates: deposit cleanliness under the brush.
    if (p.active && p.speed > 4) {
      const brush = this.opts.cursorRadius * (1 + Math.min(p.speed / 900, 1.4));
      const power = (p.down ? 2.2 : 1) * Math.min(p.speed / 500, 1.6);
      this.forEachCellInRadius(p.x, p.y, brush, (idx, fall) => {
        this.clean[idx] = Math.min(1, this.clean[idx] + power * fall * dt * 2.4);
      });
    }
    // Sand slowly returns everywhere (persistent memory, but impermanent).
    const reclaim =
      this.wowPhase === "reclaim" ? 0.05 : 0.006 + this.story.gustiness * 0.004;
    for (let i = 0; i < this.clean.length; i++) {
      if (this.clean[i] > this.cleanFloor) {
        this.clean[i] = Math.max(this.cleanFloor, this.clean[i] - reclaim * dt);
      }
    }
    this.syncRevealAttr(false);
  }

  /** Push grid cleanliness into the aReveal attribute, amortized. */
  private revealCursor = 0;
  private syncRevealAttr(all: boolean): void {
    const arr = this.revealAttr.array as Float32Array;
    const P = this.pools;
    const chunk = all ? this.n : Math.ceil(this.n / 4);
    for (let k = 0; k < chunk; k++) {
      const i = all ? k : (this.revealCursor + k) % this.n;
      const cell = P.cell[i];
      const cl = cell >= 0 ? this.clean[cell] : 1;
      if (i < this.nLetters + this.nGlyphs) {
        arr[i] = cl;
      } else {
        // Overburden presence: 1 until cleanliness passes its gate, then gone.
        const lifted = cl > P.burialGate[i];
        if (lifted && !P.scattered[i]) {
          P.scattered[i] = 1;
          // One-time lift-off impulse: sand doesn't fade, it gets flicked away.
          const a = this.rand() * Math.PI * 2;
          const m = 60 + this.rand() * 160;
          P.vx[i] += Math.cos(a) * m;
          P.vy[i] += Math.abs(Math.sin(a)) * m * 0.8 + 40;
          if (this.rand() < 0.2) this.spawnDust(P.px[i], P.py[i], 1, 40);
        } else if (!lifted && P.scattered[i]) {
          P.scattered[i] = 0; // sand has returned; it settles back
        }
        const gap = cl - P.burialGate[i];
        arr[i] = 1 - Math.min(Math.max(gap * 6, 0), 1);
      }
    }
    if (!all) this.revealCursor = (this.revealCursor + chunk) % this.n;
    this.revealAttr.needsUpdate = true;
  }

  private simulate(dt: number): void {
    const P = this.pools;
    const p = this.ptr;
    const s = this.story;
    const t = this.time;

    // Global wind vector.
    const windAngle = this.noise.fbm(t * 0.045, 3.7, 2) * Math.PI * 0.5;
    const gust = this.gustEnv * this.gustEnv * (34 + s.windBase) * this.gustDir;
    const windMag =
      (s.windBase * (0.55 + 0.45 * this.noise.fbm(t * 0.11, 11.3, 2))) *
        this.opts.windIntensity +
      gust;
    const wx = Math.cos(windAngle * 0.4) * windMag;
    const wy = Math.sin(windAngle) * windMag * 0.22;

    // Cursor force field: present position + two trailing echoes = ripple.
    const trail = this.ptrTrail;
    const echoes: { x: number; y: number; str: number; rad: number }[] = [];
    if (p.active) {
      const speedNorm = Math.min(p.speed / 700, 1.6);
      const baseR = this.opts.cursorRadius * (1 + speedNorm * 0.9);
      const baseS = this.opts.attraction * (240 + speedNorm * 900) * (p.down ? 1.5 : 1);
      echoes.push({ x: p.x, y: p.y, str: baseS, rad: baseR });
      const e1 = trail[trail.length - 8];
      const e2 = trail[trail.length - 16];
      if (e1) echoes.push({ x: e1.x, y: e1.y, str: baseS * 0.35, rad: baseR * 1.7 });
      if (e2) echoes.push({ x: e2.x, y: e2.y, str: baseS * 0.12, rad: baseR * 2.6 });

      // Fast strokes throw dust.
      if (p.speed > 260 && this.rand() < 0.5 * this.opts.dustIntensity) {
        this.spawnDust(p.x, p.y, 1 + ((this.rand() * 3) | 0), p.speed * 0.14);
      }
    }

    const pos = this.posAttr.array as Float32Array;
    const nAll = this.n;
    for (let i = 0; i < nAll; i++) {
      const layer = P.layer[i];
      const zone = P.zone[i];
      const isOver = i >= this.nLetters + this.nGlyphs;

      let fx = 0, fy = 0;

      // Spring home. Overburden springs weakly — it wanders and resettles.
      const k = isOver
        ? 4 * (0.6 + zone * 0.8)
        : SPRING[layer] * (0.7 + zone * 0.6);
      fx += (P.hx[i] - P.px[i]) * k;
      fy += (P.hy[i] - P.py[i]) * k;

      // Wind with spatial turbulence (never uniform).
      const turb =
        0.65 + 0.7 * this.noise.noise(P.px[i] * 0.012 + t * 0.35, P.py[i] * 0.012);
      const wm = WIND_MUL[layer] * turb;
      fx += wx * wm;
      fy += wy * wm;

      // Ambient breathing: microscopic drift so the field never freezes.
      fx += this.noise.noise(P.px[i] * 0.02, t * 0.6 + P.py[i] * 0.02) * 3.2 * WIND_MUL[layer];
      fy += this.noise.noise(t * 0.5 + P.px[i] * 0.02, P.py[i] * 0.02) * 2.1 * WIND_MUL[layer];

      // Cursor field.
      for (let e = 0; e < echoes.length; e++) {
        const E = echoes[e];
        const dx = E.x - P.px[i];
        const dy = E.y - P.py[i];
        const d2 = dx * dx + dy * dy;
        const r2 = E.rad * E.rad;
        if (d2 < r2 && d2 > 1e-4) {
          const d = Math.sqrt(d2);
          const fall = 1 - d / E.rad;
          const cm = CURSOR_MUL[layer] * fall * fall;
          // Attraction toward the buried "force", plus a swirl that turns
          // straight pulls into scoops and sprays.
          const inv = 1 / d;
          fx += dx * inv * E.str * cm;
          fy += dy * inv * E.str * cm;
          fx += -dy * inv * E.str * cm * 0.35;
          fy += dx * inv * E.str * cm * 0.35;
          // Velocity transfer: fast strokes drag sand along the stroke.
          if (e === 0) {
            fx += p.vx * 0.55 * cm;
            fy += p.vy * 0.55 * cm;
          }
        }
      }

      // Integrate with per-layer damping (friction into the stone).
      const damp = DAMPING[layer] - zone * 0.02;
      P.vx[i] = (P.vx[i] + fx * dt) * damp;
      P.vy[i] = (P.vy[i] + fy * dt) * damp;
      P.px[i] += P.vx[i] * dt;
      P.py[i] += P.vy[i] * dt;

      pos[i * 3] = P.px[i];
      pos[i * 3 + 1] = P.py[i];
    }
    this.posAttr.needsUpdate = true;
  }

  private updateDust(dt: number): void {
    const arr = this.dustPosAttr.array as Float32Array;
    const life = this.dustLifeAttr.array as Float32Array;
    for (let i = 0; i < DUST_CAP; i++) {
      if (this.dlife[i] <= 0) {
        life[i] = 0;
        continue;
      }
      this.dlife[i] -= dt;
      this.dvy[i] += 14 * dt; // buoyancy: dust rises
      this.dvx[i] *= 0.985;
      this.dvy[i] *= 0.985;
      this.dpx[i] += this.dvx[i] * dt;
      this.dpy[i] += this.dvy[i] * dt;
      arr[i * 3] = this.dpx[i];
      arr[i * 3 + 1] = this.dpy[i];
      life[i] = Math.max(0, Math.min(1, this.dlife[i] / 2));
    }
    this.dustPosAttr.needsUpdate = true;
    this.dustLifeAttr.needsUpdate = true;
  }

  private spawnDust(x: number, y: number, count: number, energy: number): void {
    if (this.quality === 0) return;
    const cap = this.quality === 2 ? count : Math.ceil(count / 2);
    for (let c = 0; c < cap; c++) {
      const i = this.dustHead;
      this.dustHead = (this.dustHead + 1) % DUST_CAP;
      this.dpx[i] = x + (this.rand() - 0.5) * 14;
      this.dpy[i] = y + (this.rand() - 0.5) * 8;
      const a = this.rand() * Math.PI * 2;
      this.dvx[i] = Math.cos(a) * energy * (0.3 + this.rand() * 0.7);
      this.dvy[i] = Math.abs(Math.sin(a)) * energy * 0.4 + 6;
      this.dlife[i] = 1.2 + this.rand() * 1.6;
    }
  }

  private updateWow(dt: number): void {
    const avg = this.cleanAverage();
    switch (this.wowPhase) {
      case "idle":
        if (
          this.interactionTime > 20 &&
          avg > 0.88 &&
          this.time > this.wowCooldownUntil
        ) {
          this.wowPhase = "rising";
          this.wowT = 0;
        }
        break;
      case "rising":
        this.wowT += dt;
        this.glow = Math.min(1, this.wowT / 1.2) * LIGHTING[this.story.lighting].glowBoost;
        if (this.wowT >= 1.2) { this.wowPhase = "hold"; this.wowT = 0; }
        break;
      case "hold":
        this.wowT += dt;
        if (this.wowT >= 2) { this.wowPhase = "reclaim"; this.wowT = 0; }
        break;
      case "reclaim":
        this.wowT += dt;
        this.glow = Math.max(0, this.glow - dt * 0.5);
        this.gustEnv = Math.max(this.gustEnv, 0.6); // the reclaiming breeze
        if (this.wowT >= 8) {
          this.wowPhase = "idle";
          this.wowCooldownUntil = this.time + 45;
          this.interactionTime = 0;
        }
        break;
    }
    if (this.wowPhase === "idle" && this.glow > 0) {
      this.glow = Math.max(0, this.glow - dt * 0.8);
    }
  }

  private updateCamera(): void {
    // Breathing zoom + micro drift — the "physical space" feel.
    const z = 1 + this.noise.noise(this.time * 0.07, 5.1) * 0.004;
    this.camera.zoom = z;
    this.camera.position.x = this.noise.noise(this.time * 0.05, 9.7) * 3;
    this.camera.position.y = this.noise.noise(11.3, this.time * 0.06) * 2;
    this.camera.rotation.z = this.noise.noise(this.time * 0.03, 17.9) * 0.0015;
    this.camera.updateProjectionMatrix();
  }

  private maybeAvalanche(dt: number): void {
    this.avalancheTimer -= dt;
    if (this.avalancheTimer > 0) return;
    this.avalancheTimer = 0.35 + this.rand() * 0.9;

    // Find a random cell whose lower neighbor is much less excavated —
    // an unstable "cliff edge" of sand. Tumble grains down into it.
    const c = (this.rand() * GRID_COLS) | 0;
    const r = (this.rand() * (this.gridRows - 1)) | 0;
    const hi = this.clean[r * GRID_COLS + c];
    const lo = this.clean[(r + 1) * GRID_COLS + c];
    if (hi - lo < 0.3) return;

    const bucket = this.cellBuckets[(r + 1) * GRID_COLS + c];
    const P = this.pools;
    const takes = Math.min(bucket.length, 4 + ((this.rand() * 8) | 0));
    for (let k = 0; k < takes; k++) {
      const i = bucket[(this.rand() * bucket.length) | 0];
      P.vy[i] -= 25 + this.rand() * 55;
      P.vx[i] += (this.rand() - 0.5) * 40;
    }
    if (takes > 0 && this.rand() < 0.5) {
      const wx = this.gridOrigin.x + ((c + 0.5) / GRID_COLS) * this.gridOrigin.w;
      const wy = this.gridOrigin.y + ((r + 1) / this.gridRows) * this.gridOrigin.h;
      this.spawnDust(wx, wy, 2, 18);
    }
  }

  private governQuality(dt: number): void {
    this.qualityTimer += dt;
    if (this.qualityTimer < 1.5) return;
    this.qualityTimer = 0;
    if (this.frameEMA > 22 && this.quality > 0) {
      this.quality--;
      this.applyQuality();
    } else if (this.frameEMA < 13 && this.quality < 2) {
      this.quality++;
      this.applyQuality();
    }
  }

  private applyQuality(): void {
    // Trim from the overburden end of the buffer — letters are untouchable.
    const geo = this.grains.geometry;
    const overStart = this.nLetters + this.nGlyphs;
    const overCount = this.n - overStart;
    const keep =
      this.quality === 2 ? overCount :
      this.quality === 1 ? Math.floor(overCount * 0.55) :
      Math.floor(overCount * 0.25);
    geo.setDrawRange(0, overStart + keep);
    this.applyViewport(); // re-clamps DPR for the new quality tier
  }

  // ── Persistence ──────────────────────────────────────────────────────

  private maybeSave(dt: number): void {
    if (!this.opts.persist) return;
    this.saveTimer += dt;
    if (this.saveTimer < 10) return;
    this.saveTimer = 0;
    this.persist();
  }

  private persist(): void {
    if (!this.opts.persist || typeof localStorage === "undefined" || !this.clean) return;
    try {
      const bytes = new Uint8Array(this.clean.length);
      for (let i = 0; i < bytes.length; i++) bytes[i] = (this.clean[i] * 255) | 0;
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      localStorage.setItem(PERSIST_KEY, JSON.stringify({
        t: Date.now(),
        rows: this.gridRows,
        grid: btoa(bin),
      }));
    } catch { /* storage full / privacy mode — the desert forgets */ }
  }

  private restorePersisted(): void {
    if (!this.opts.persist || typeof localStorage === "undefined") return;
    try {
      const raw = localStorage.getItem(PERSIST_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { t: number; rows: number; grid: string };
      const age = Date.now() - saved.t;
      if (age > PERSIST_MAX_AGE_MS || saved.rows !== this.gridRows) return;
      const bin = atob(saved.grid);
      if (bin.length !== this.clean.length) return;
      // The wind kept blowing while they were away: decay by elapsed hours.
      const decay = Math.min(1, (age / 3600_000) * 0.15);
      for (let i = 0; i < bin.length; i++) {
        const v = (bin.charCodeAt(i) / 255) * (1 - decay);
        this.clean[i] = Math.max(this.cleanFloor, v);
      }
    } catch { /* corrupted save — start fresh */ }
  }

  // ── Small helpers ────────────────────────────────────────────────────

  private cellOf(x: number, y: number): number {
    const g = this.gridOrigin;
    const cx = Math.floor(((x - g.x) / g.w) * GRID_COLS);
    const cy = Math.floor(((y - g.y) / g.h) * this.gridRows);
    if (cx < 0 || cy < 0 || cx >= GRID_COLS || cy >= this.gridRows) return -1;
    return cy * GRID_COLS + cx;
  }

  /** Nearest cell, clamped into the grid — for grains homed past the field. */
  private cellOfClamped(x: number, y: number): number {
    const g = this.gridOrigin;
    const cx = Math.min(GRID_COLS - 1, Math.max(0, Math.floor(((x - g.x) / g.w) * GRID_COLS)));
    const cy = Math.min(this.gridRows - 1, Math.max(0, Math.floor(((y - g.y) / g.h) * this.gridRows)));
    return cy * GRID_COLS + cx;
  }

  private forEachCellInRadius(
    x: number, y: number, radius: number,
    fn: (idx: number, falloff: number) => void,
  ): void {
    const g = this.gridOrigin;
    const cw = g.w / GRID_COLS;
    const ch = g.h / this.gridRows;
    const c0 = Math.max(0, Math.floor((x - radius - g.x) / cw));
    const c1 = Math.min(GRID_COLS - 1, Math.ceil((x + radius - g.x) / cw));
    const r0 = Math.max(0, Math.floor((y - radius - g.y) / ch));
    const r1 = Math.min(this.gridRows - 1, Math.ceil((y + radius - g.y) / ch));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cx = g.x + (c + 0.5) * cw;
        const cy = g.y + (r + 0.5) * ch;
        const d = Math.hypot(cx - x, cy - y);
        if (d < radius) fn(r * GRID_COLS + c, 1 - d / radius);
      }
    }
  }

  private cleanAverage(): number {
    let s = 0;
    for (let i = 0; i < this.clean.length; i++) s += this.clean[i];
    return s / this.clean.length;
  }

  private gauss(): number {
    // Box–Muller-lite: sum of 3 uniforms, cheap and bell-ish.
    return (this.rand() + this.rand() + this.rand()) / 1.5 - 1;
  }
}

// ── Shaders ────────────────────────────────────────────────────────────

const GRAIN_VERT = /* glsl */ `
attribute float aSeed, aSize, aKind, aAccent, aEdge, aReveal;
uniform float uPixelRatio, uTime, uGlow;
varying float vSeed, vKind, vAccent, vEdge, vReveal, vSparkle;
varying vec2 vWorld;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // A sparse subset of grains sparkles during the wow moment.
  float sparkler = step(0.94, fract(aSeed * 7.31));
  vSparkle = sparkler * uGlow;
  float pulse = 1.0 + vSparkle * 0.5 * (0.5 + 0.5 * sin(uTime * 9.0 + aSeed * 60.0));
  // The seal (the "." after Doss) uses slightly larger grains so it reads
  // as a solid mark, not just more sand.
  gl_PointSize = aSize * pulse * (1.0 + aAccent * 0.35) * uPixelRatio;
  gl_Position = projectionMatrix * mv;
  vSeed = aSeed; vKind = aKind; vAccent = aAccent; vEdge = aEdge; vReveal = aReveal;
  vWorld = position.xy;
}
`;

const GRAIN_FRAG = /* glsl */ `
uniform vec3 uTint;
uniform vec2 uSunDir;
uniform vec3 uViewExt; // x: half width, y: top extent, z: bottom extent
uniform float uAmbient, uGlow, uTime;
varying float vSeed, vKind, vAccent, vEdge, vReveal, vSparkle;
varying vec2 vWorld;

// Sandstone family, ivory → burnt umber, anchored to the champagne seal.
vec3 palette(float t) {
  vec3 a = vec3(0.93, 0.87, 0.76);  // ivory sand
  vec3 b = vec3(0.84, 0.73, 0.55);  // champagne
  vec3 c = vec3(0.72, 0.58, 0.38);  // ochre
  vec3 d = vec3(0.55, 0.42, 0.27);  // umber
  if (t < 0.33) return mix(a, b, t * 3.0);
  if (t < 0.66) return mix(b, c, (t - 0.33) * 3.0);
  return mix(c, d, (t - 0.66) * 3.0);
}

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  // Irregular grain silhouette: nudge the center per-seed so no two match.
  uv += 0.08 * vec2(fract(vSeed * 13.7) - 0.5, fract(vSeed * 27.3) - 0.5);
  float d = length(uv);
  float body = smoothstep(0.5, 0.16, d);
  if (body < 0.01) discard;

  // Fake sun shading: grains lit on the sun side, shadowed opposite.
  float lit = dot(normalize(uv + vec2(1e-4)), normalize(uSunDir));
  float shade = uAmbient + (1.0 - uAmbient) * (0.55 - 0.45 * lit);

  vec3 col = palette(fract(vSeed * 5.13));
  if (vAccent > 0.5) {
    // The seal: molten gold, clearly apart from the sandstone field. It
    // resists the shadow term (stays luminous) and carries a slow shimmer.
    float shimmer = 0.88 + 0.12 * sin(uTime * 1.6 + vSeed * 12.0);
    col = vec3(1.0, 0.80, 0.38) * shimmer;
    shade = mix(shade, 1.0, 0.65);
  }

  float alpha = body;

  if (vKind < 0.5) {
    // Letter grain. Buried: only faint contours. Excavated: full presence,
    // with contour grains (high edgeness) resolving last — finer detail on
    // deeper passes.
    float gate = 0.30 + 0.5 * vEdge;
    float presence = smoothstep(gate - 0.22, gate, vReveal);
    float floorA = mix(0.02, 0.13, vEdge);
    alpha *= max(floorA, presence);
    col *= mix(0.62, 1.0, presence);
    col += vec3(1.0, 0.9, 0.6) * vSparkle * 0.6;
    col += vec3(0.35, 0.28, 0.12) * uGlow * presence * 0.35; // carved letters glow
  } else if (vKind < 1.5) {
    // Overburden: duller, cooler — sand in shadow. vReveal here = presence.
    col = mix(col, vec3(0.35, 0.36, 0.42), 0.38);
    alpha *= vReveal * 0.85;
  } else {
    // Hidden glyphs: only whisper into view after deep excavation. The gate
    // sits above anything the opening reveal or ambient gusts can reach
    // (~0.9 + gusts), so they surface for deliberate diggers only — ambient
    // weather must never scatter "stray marks" across the field.
    float presence = smoothstep(0.965, 0.995, vReveal);
    alpha *= presence * 0.3;
    col = mix(col, vec3(0.92, 0.80, 0.55), 0.5);
  }

  // Dissolve before the canvas boundary so scattered grains never hard-clip
  // against the page — the hero must stay contiguous with the site around it.
  // The vertical extents differ when the bleed is asymmetric.
  float yExt = mix(uViewExt.z, uViewExt.y, step(0.0, vWorld.y));
  alpha *= smoothstep(uViewExt.x, uViewExt.x - 48.0, abs(vWorld.x))
         * smoothstep(yExt, yExt - 32.0, abs(vWorld.y));

  gl_FragColor = vec4(col * shade * uTint, alpha);
}
`;

const DUST_VERT = /* glsl */ `
attribute float aLife, aSeed;
uniform float uPixelRatio;
varying float vLife, vSeed;
varying vec2 vWorld;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (2.0 + aSeed * 5.0) * (0.6 + (1.0 - aLife) * 1.8) * uPixelRatio;
  gl_Position = projectionMatrix * mv;
  vLife = aLife; vSeed = aSeed;
  vWorld = position.xy;
}
`;

const DUST_FRAG = /* glsl */ `
uniform vec3 uTint;
uniform vec3 uViewExt; // x: half width, y: top extent, z: bottom extent
varying float vLife, vSeed;
varying vec2 vWorld;
void main() {
  if (vLife <= 0.0) discard;
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d) * vLife * 0.16;
  float yExt = mix(uViewExt.z, uViewExt.y, step(0.0, vWorld.y));
  a *= smoothstep(uViewExt.x, uViewExt.x - 48.0, abs(vWorld.x))
     * smoothstep(yExt, yExt - 32.0, abs(vWorld.y));
  vec3 col = mix(vec3(0.85, 0.76, 0.58), vec3(0.95, 0.9, 0.8), vSeed);
  gl_FragColor = vec4(col * uTint, a);
}
`;

const SHAFT_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SHAFT_FRAG = /* glsl */ `
uniform float uTime, uStrength;
uniform vec2 uDir;
uniform vec3 uTint;
varying vec2 vUv;
void main() {
  // Soft parallel bands aligned with the sun direction, drifting slowly.
  vec2 p = vUv - 0.5;
  float along = dot(p, normalize(vec2(-uDir.y, uDir.x)));
  float bands = sin(along * 4.5 + uTime * 0.1) * 0.5 + 0.5;
  float envelope = smoothstep(0.62, 0.1, length(p));
  // The quad IS the canvas now — force alpha to zero before every edge so
  // the glow can never paint a visible rectangle against the page.
  float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x)
             * smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.78, vUv.y);
  float a = bands * bands * envelope * edge * uStrength;
  gl_FragColor = vec4(uTint, a);
}
`;
