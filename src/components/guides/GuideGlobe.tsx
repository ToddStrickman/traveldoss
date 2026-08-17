import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { LAND_DOTS } from "./land-dots";
import type { GuideDef } from "@/content/guides";

type Props = {
  guides: GuideDef[];
  /** Fired when a pin reveals its card (tap) or rotates to the front. */
  onCardOpen: (slug: string, via: "pin" | "rotate") => void;
  /** Fired by the card's primary button. */
  onOpenGuide: (slug: string) => void;
};

function ll2v(lat: number, lon: number, r: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function glowTexture(color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.25, color + "AA");
  g.addColorStop(1, "transparent");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/**
 * The dot-matrix earth from the approved design spec: land points, fresnel
 * atmosphere, starfield and one glowing beacon per guide. Rotation is real
 * OrbitControls (rotate only, damped, auto-rotate that pauses on interaction);
 * whichever beacon rotates to the front reveals its glass card.
 *
 * Lazy-loaded on /guides only — three.js never enters the main bundle. The
 * card grid underneath stays in the DOM, so this is pure enhancement.
 */
export default function GuideGlobe({ guides, onCardOpen, onOpenGuide }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState<GuideDef | null>(null);
  const activeRef = useRef<string | null>(null);
  const openRef = useRef<(slug: string, via: "pin" | "rotate") => void>(onCardOpen);
  openRef.current = onCardOpen;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return; // No WebGL: the card grid below is the experience.
    }

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const size = () => ({ w: host.clientWidth, h: host.clientHeight });
    let { w, h } = size();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.domElement.style.touchAction = "none";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 0, 3.3);

    const globe = new THREE.Group();
    scene.add(globe);
    const scaleGlobe = () => globe.scale.setScalar(w < 768 ? 0.78 : 0.92);
    scaleGlobe();

    globe.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.985, 64, 64),
        new THREE.MeshBasicMaterial({ color: 0x0a101e }),
      ),
    );

    // Land dot-matrix
    const pos = new Float32Array(LAND_DOTS.length * 3);
    LAND_DOTS.forEach((d, i) => {
      const v = ll2v(d[0], d[1], 1);
      pos[i * 3] = v.x;
      pos[i * 3 + 1] = v.y;
      pos[i * 3 + 2] = v.z;
    });
    const landGeo = new THREE.BufferGeometry();
    landGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    globe.add(
      new THREE.Points(
        landGeo,
        new THREE.PointsMaterial({
          color: 0x69d6e8,
          size: 0.0105,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );

    // Atmosphere (fresnel)
    globe.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1.14, 64, 64),
        new THREE.ShaderMaterial({
          vertexShader:
            "varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
          fragmentShader:
            "varying vec3 vN; void main(){ float i=pow(0.62-dot(vN,vec3(0.,0.,1.)),2.2); gl_FragColor=vec4(mix(vec3(.42,.85,.95),vec3(.61,.55,1.),i)*i, i*1.15); }",
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          transparent: true,
        }),
      ),
    );

    // Starfield
    const sp = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const R = 28 + Math.random() * 22;
      sp[i * 3] = s * Math.cos(t) * R;
      sp[i * 3 + 1] = u * R;
      sp[i * 3 + 2] = s * Math.sin(t) * R;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          color: 0x8fa6c0,
          size: 0.055,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        }),
      ),
    );

    // Beacons
    const pins: THREE.Group[] = [];
    guides.forEach((g) => {
      const grp = new THREE.Group();
      grp.position.copy(ll2v(g.lat, g.lon, 1.005));
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.017, 16, 16),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(g.accent) }),
      );
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glowTexture(g.accent),
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      halo.scale.setScalar(0.17);
      grp.add(core, halo);
      grp.userData = { guide: g, halo };
      globe.add(grp);
      pins.push(grp);
    });

    // Rotate-only orbit controls with damping + idle auto-spin.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.55;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.35;
    controls.minPolarAngle = 0.5;
    controls.maxPolarAngle = Math.PI - 0.5;

    let lastInteract = 0;
    let moved = 0;
    let downAt = { x: 0, y: 0 };
    const el = renderer.domElement;
    const onDown = (e: PointerEvent) => {
      controls.autoRotate = false;
      lastInteract = performance.now();
      moved = 0;
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (e.buttons === 0) return;
      moved = Math.abs(e.clientX - downAt.x) + Math.abs(e.clientY - downAt.y);
      lastInteract = performance.now();
    };
    const raycaster = new THREE.Raycaster();
    const onUp = (e: PointerEvent) => {
      lastInteract = performance.now();
      if (moved > 6) return; // a drag, not a tap
      const rect = el.getBoundingClientRect();
      const m = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(m, camera);
      let best: THREE.Group | null = null;
      let bestD = 0.09;
      pins.forEach((p) => {
        const wp = p.getWorldPosition(new THREE.Vector3());
        const d = raycaster.ray.distanceToPoint(wp);
        const facing = wp.clone().normalize().dot(camera.position.clone().normalize());
        if (d < bestD && facing > 0) {
          best = p;
          bestD = d;
        }
      });
      if (best) {
        const guide = (best as THREE.Group).userData.guide as GuideDef;
        activeRef.current = guide.slug;
        setActive(guide);
        openRef.current(guide.slug, "pin");
      }
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);

    const onResize = () => {
      const next = size();
      w = next.w;
      h = next.h;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      scaleGlobe();
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    let frontTimer = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      if (!reduce && now - lastInteract > 2600) controls.autoRotate = true;
      controls.update();
      pins.forEach((p, i) => {
        (p.userData.halo as THREE.Sprite).scale.setScalar(
          0.17 + (reduce ? 0 : 0.035 * Math.sin(now * 0.0024 + i * 1.7)),
        );
      });
      // Rotate-to-front auto reveal
      if (now - frontTimer > 400) {
        frontTimer = now;
        let front: THREE.Group | null = null;
        pins.forEach((p) => {
          const wp = p.getWorldPosition(new THREE.Vector3());
          const facing = wp.clone().normalize().dot(camera.position.clone().normalize());
          const ndc = wp.clone().project(camera);
          if (facing > 0.88 && Math.abs(ndc.x) < 0.24 && Math.abs(ndc.y) < 0.42) front = p;
        });
        if (front) {
          const guide = (front as THREE.Group).userData.guide as GuideDef;
          if (activeRef.current !== guide.slug) {
            activeRef.current = guide.slug;
            setActive(guide);
            openRef.current(guide.slug, "rotate");
          }
        }
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      controls.dispose();
      renderer.dispose();
      host.removeChild(el);
    };
  }, [guides]);

  return (
    <>
      <div ref={hostRef} className="tdg-canvas" aria-hidden="true" />
      <div className="tdg-gcard" data-open={active ? "true" : "false"} aria-hidden={!active}>
        <div className="tdg-gcard-inner">
          <button
            type="button"
            className="tdg-close"
            aria-label="Close destination card"
            onClick={() => {
              activeRef.current = null;
              setActive(null);
            }}
          >
            ✕
          </button>
          <span className="tdg-eyebrow">
            <i style={{ background: active?.accent }} />
            Insider Guide {active?.no ?? ""}
          </span>
          <h3>{active?.displayName ?? ""}</h3>
          <p className="tdg-dek">{active?.dek ?? ""}</p>
          <span className="my-4 flex flex-wrap gap-2">
            {(active?.chips ?? []).map((c) => (
              <span key={c} className="tdg-chip">
                {c}
              </span>
            ))}
          </span>
          <button
            type="button"
            className="tdg-btn"
            tabIndex={active ? 0 : -1}
            onClick={() => active && onOpenGuide(active.slug)}
          >
            Read the guide <span aria-hidden>↗</span>
          </button>
        </div>
      </div>
    </>
  );
}
