import { useEffect, useState } from "react";
import { motion, useMotionValue, useMotionTemplate, useSpring, useReducedMotion } from "motion/react";

/**
 * Cursor-reveal topographic background.
 * - Base: deep navy theme wash (lives below).
 * - Reveal layer: ivory paper with topo contours, masked to a soft radial
 *   under the cursor — like a flashlight on parchment.
 * - Honors prefers-reduced-motion (static low-opacity reveal, no tracking).
 * - pointer-events: none everywhere; clicks pass through.
 */
export function TopoBackground() {
  const reduceMotion = useReducedMotion();
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [radius, setRadius] = useState(360);
  const [moving, setMoving] = useState(false);

  // Motion values follow the cursor; spring gives a damped, plush trail.
  const initialX = typeof window !== "undefined" ? window.innerWidth / 2 : 0;
  const initialY = typeof window !== "undefined" ? window.innerHeight / 2 : 0;
  const mx = useMotionValue(initialX);
  const my = useMotionValue(initialY);
  // While moving: soft + heavy → long, plush trail.
  // When stopped: stiffer + lighter → calm, quick settle (no overshoot).
  const springConfig = moving
    ? { stiffness: 55, damping: 22, mass: 1.1 }
    : { stiffness: 140, damping: 28, mass: 0.5 };
  const sx = useSpring(mx, springConfig);
  const sy = useSpring(my, springConfig);

  // Cursor-tracked radial mask. Multi-stop falloff (ease-out cubic-ish) so the
  // edge dissolves into the navy with no visible ring. Radius scales with the
  // viewport so the reveal feels proportional on phones, laptops, and 4K.
  const mask = useMotionTemplate`radial-gradient(circle ${radius}px at ${sx}px ${sy}px,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,0.96) 18%,
    rgba(0,0,0,0.82) 34%,
    rgba(0,0,0,0.58) 50%,
    rgba(0,0,0,0.30) 68%,
    rgba(0,0,0,0.10) 84%,
    rgba(0,0,0,0) 100%)`;

  useEffect(() => {
    setCoarsePointer(window.matchMedia("(pointer: coarse)").matches);

    // Radius ~ 26% of the viewport's smaller side, clamped to a plush range.
    const computeRadius = () => {
      const min = Math.min(window.innerWidth, window.innerHeight);
      setRadius(Math.round(Math.max(66, Math.min(156, min * 0.078))));
    };
    computeRadius();
    window.addEventListener("resize", computeRadius);

    if (reduceMotion) return;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const onMove = (e: PointerEvent) => {
      mx.set(e.clientX);
      my.set(e.clientY);
      setMoving(true);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setMoving(false), 140);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", computeRadius);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [mx, my, reduceMotion]);

  const trackingEnabled = !reduceMotion && !coarsePointer;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
    >
      {/* Base: deep navy wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, oklch(0.26 0.05 260) 0%, oklch(0.19 0.04 260) 55%, oklch(0.14 0.035 260) 100%)",
        }}
      />

      {/* Cursor-reveal: light exposes concealed topo lines under the cursor */}
      {trackingEnabled ? (
        <>
          {/* Flashlight hot-spot — warm glow that makes the dark surface feel illuminated */}
          <Flashlight sx={sx} sy={sy} radius={radius} mask={mask} />
          <motion.div
            className="absolute inset-0 will-change-[mask-image]"
            style={{
              backgroundImage: topoMapPattern(),
              backgroundSize: "360px 360px",
              backgroundRepeat: "repeat",
              WebkitMaskImage: mask,
              maskImage: mask,
              opacity: 1,
              contain: "layout paint",
            }}
          />
        </>
      ) : (
        null
      )}

      {/* Subtle vignette to keep edges plush */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </div>
  );
}

/**
 * Bright flashlight hot-spot. Sits above the reveal layer and adds the
 * "very bright wherever the mouse is" lift — warm ivory core fading out
 * gracefully so it never reads as a hard disc.
 */
function Flashlight({
  sx,
  sy,
  radius,
  mask,
}: {
  sx: import("motion/react").MotionValue<number>;
  sy: import("motion/react").MotionValue<number>;
  radius: number;
  mask: import("motion/react").MotionValue<string>;
}) {
  const inner = Math.round(radius * 0.72);
  const bg = useMotionTemplate`radial-gradient(circle ${inner}px at ${sx}px ${sy}px,
    rgba(255,250,226,0.46) 0%,
    rgba(248,234,196,0.26) 26%,
    rgba(174,139,94,0.13) 54%,
    rgba(100,72,48,0.05) 78%,
    rgba(0,0,0,0) 100%)`;
  return (
    <motion.div
      className="absolute inset-0"
      style={{
        background: bg,
        mixBlendMode: "screen",
        WebkitMaskImage: mask,
        maskImage: mask,
        contain: "layout paint",
      }}
    />
  );
}

function topoMapPattern() {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(topoSvg)}")`;
}

/* Dense repeating contour field. Lines are intentionally close enough that any
 * cursor position reveals map detail, while still feeling subtle and concealed. */
const topoSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='360' viewBox='0 0 360 360'>
  <rect width='360' height='360' fill='none'/>
  <g fill='none' stroke='#7A3F2A' stroke-width='1.35' stroke-opacity='0.72' stroke-linecap='round' stroke-linejoin='round'>
    <path d='M-18 38 C38 10 84 20 124 58 C167 100 214 92 267 60 C307 36 346 32 384 54'/>
    <path d='M-22 74 C32 48 82 52 126 86 C174 124 221 116 274 86 C315 62 350 66 386 92'/>
    <path d='M-16 112 C40 86 92 92 136 126 C178 158 226 153 279 121 C318 98 350 104 380 130'/>
    <path d='M-24 151 C32 125 90 130 141 162 C185 189 228 190 282 158 C321 136 352 141 385 168'/>
    <path d='M-18 190 C39 162 92 169 142 199 C190 227 239 222 292 191 C326 171 354 178 384 204'/>
    <path d='M-22 229 C33 202 88 208 139 238 C183 264 233 263 287 232 C324 211 356 216 386 244'/>
    <path d='M-18 268 C36 242 89 246 135 276 C178 304 230 303 282 272 C322 249 353 253 384 282'/>
    <path d='M-20 309 C37 280 91 287 137 318 C183 349 231 344 284 314 C323 292 354 296 382 323'/>
    <path d='M58 46 C88 18 138 22 166 55 C196 90 188 135 150 157 C112 179 68 161 51 122 C39 94 36 67 58 46 Z'/>
    <path d='M78 65 C101 44 135 46 155 70 C178 97 171 124 143 140 C114 157 83 145 70 116 C61 96 61 78 78 65 Z'/>
    <path d='M235 178 C272 148 321 164 335 209 C349 254 319 293 271 289 C228 286 204 247 218 210 C222 197 226 186 235 178 Z'/>
    <path d='M254 195 C278 176 309 187 317 216 C325 244 306 269 276 267 C248 265 233 240 242 216 C245 208 248 200 254 195 Z'/>
    <path d='M-35 16 C12 58 20 109 -5 156 C-29 199 -18 247 28 292 C52 316 62 342 55 382'/>
    <path d='M318 -24 C279 23 272 80 302 128 C333 178 326 230 288 280 C267 308 259 335 265 382'/>
  </g>
  <g fill='none' stroke='#A9D8EA' stroke-width='2.35' stroke-opacity='0.86' stroke-linecap='round' stroke-linejoin='round'>
    <path d='M186 -18 C172 26 181 62 160 99 C140 136 146 173 125 211 C104 249 114 292 90 378'/>
    <path d='M382 88 C342 114 320 145 324 184 C329 231 299 255 286 300 C278 329 281 352 272 382'/>
  </g>
</svg>`;