import { useEffect, useRef } from "react";

/**
 * Plush, navy topographic background with a mouse-following spotlight.
 * - Fixed, sits behind all content (z-0). Page content should be z-10+.
 * - Ignores pointer events so clicks pass through to UI.
 * - The spotlight dims when hovering over clickable elements
 *   (a, button, [role="button"], [data-clickable]) so interactives stay crisp.
 */
export function TopoBackground() {
  const spotRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef(false);

  useEffect(() => {
    const el = spotRef.current;
    if (!el) return;

    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      const t = e.target as Element | null;
      dimRef.current = !!t?.closest(
        'a, button, [role="button"], [data-clickable], input, textarea, select, label'
      );
    };

    const tick = () => {
      cx += (tx - cx) * 0.04;
      cy += (ty - cy) * 0.04;
      const opacity = dimRef.current ? 0.35 : 1;
      el.style.transform = `translate3d(${cx - 360}px, ${cy - 360}px, 0)`;
      el.style.opacity = String(opacity);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Deep navy wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, oklch(0.26 0.05 260) 0%, oklch(0.19 0.04 260) 55%, oklch(0.14 0.035 260) 100%)",
        }}
      />

      {/* Topographic contour lines — repeated SVG, ivory on navy */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
            topoSvg
          )}")`,
          backgroundSize: "900px 900px",
          backgroundRepeat: "repeat",
          mixBlendMode: "screen",
        }}
      />

      {/* Mouse spotlight — illuminates the topo beneath the cursor */}
      <div
        ref={spotRef}
        className="absolute left-0 top-0 h-[720px] w-[720px] will-change-transform transition-opacity duration-300"
        style={{
          background:
            "radial-gradient(circle at center, rgba(247,243,237,0.22) 0%, rgba(214,194,156,0.10) 28%, rgba(247,243,237,0.04) 55%, transparent 72%)",
          filter: "blur(2px)",
          mixBlendMode: "screen",
        }}
      />

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

/* Hand-drawn-feeling concentric topographic loops. Ivory strokes, navy-transparent fills. */
const topoSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900' viewBox='0 0 900 900'>
  <g fill='none' stroke='%23F7F3ED' stroke-width='1' stroke-opacity='0.55'>
    <path d='M120,300 C220,180 380,160 500,230 C640,310 720,470 640,600 C560,720 380,740 260,660 C140,580 60,420 120,300 Z'/>
    <path d='M150,320 C240,210 380,195 490,260 C620,335 690,470 620,580 C550,685 390,705 280,635 C170,565 100,425 150,320 Z'/>
    <path d='M180,340 C260,240 380,225 480,285 C600,355 660,465 600,560 C540,655 395,675 295,615 C200,560 130,430 180,340 Z'/>
    <path d='M210,360 C285,270 380,260 470,310 C580,375 630,460 580,540 C530,625 395,645 305,595 C220,545 160,440 210,360 Z'/>
    <path d='M240,380 C310,300 380,290 460,335 C560,395 600,455 560,525 C520,595 395,615 320,575 C245,535 195,450 240,380 Z'/>
    <path d='M270,400 C330,330 385,320 450,360 C540,415 575,455 540,510 C505,565 395,585 330,555 C270,525 230,460 270,400 Z'/>
    <path d='M300,420 C355,365 385,355 440,385 C520,430 545,455 515,495 C485,540 395,555 345,535 C295,515 270,470 300,420 Z'/>
    <path d='M330,445 C375,400 390,395 430,415 C490,445 510,460 490,490 C465,525 395,535 360,520 C325,505 305,480 330,445 Z'/>
    <path d='M360,470 C390,440 395,435 420,450 C460,470 475,480 465,500 C450,520 395,525 375,515 C355,505 345,490 360,470 Z'/>
    <path d='M385,490 C400,475 405,475 415,485 C435,500 445,505 440,515 C430,525 400,530 390,520 C380,510 380,500 385,490 Z'/>

    <path d='M730,90 C800,140 840,220 810,300 C780,375 690,400 620,355 C555,310 540,210 595,140 C645,75 690,60 730,90 Z' stroke-opacity='0.45'/>
    <path d='M750,110 C810,155 840,225 815,290 C790,355 695,380 635,340 C575,300 565,215 615,155 C655,100 710,80 750,110 Z' stroke-opacity='0.45'/>
    <path d='M770,130 C820,170 835,225 815,280 C795,335 700,360 655,325 C605,290 590,220 630,170 C670,120 730,105 770,130 Z' stroke-opacity='0.4'/>

    <path d='M120,760 C200,700 320,705 380,755 C435,805 410,860 320,860 C220,860 80,820 120,760 Z' stroke-opacity='0.4'/>
    <path d='M150,775 C220,725 315,725 365,765 C415,810 395,850 320,850 C235,850 100,820 150,775 Z' stroke-opacity='0.4'/>
  </g>
</svg>`;