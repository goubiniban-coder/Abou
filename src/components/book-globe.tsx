import type { CSSProperties } from "react";

// Globe de l'écran de connexion : sphère blanche à motif labyrinthe, réseau de fils, billes
// flottantes et socle lumineux, avec des livres en orbite. SVG et CSS 3D uniquement ;
// le mouvement s'arrête si l'utilisateur préfère moins d'animations.

const BOOK_COLORS = [
  ["#fcd116", "#e2b500"],
  ["#ffffff", "#e2f5d8"],
  ["#4cc471", "#15873b"],
  ["#ffe047", "#fcd116"],
  ["#f1faec", "#c8ecb5"],
  ["#1fa64a", "#136b32"],
];

const rings = [
  { tilt: 72, turn: -22, radius: 41, duration: 20, books: 4 },
  { tilt: 64, turn: 30, radius: 34, duration: 14, books: 3, reverse: true },
];

// Réseau de fils autour de la sphère (coordonnées du SVG, centre 200,200).
const NODES: [number, number][] = [
  [205, 38], [282, 62], [338, 112], [362, 186], [352, 262], [310, 324], [244, 356],
  [168, 352], [104, 318], [62, 254], [52, 176], [84, 104], [140, 56], [250, 120],
  [320, 210], [270, 300], [120, 160], [130, 270],
];
const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 0],
  [0, 13], [1, 13], [2, 13], [2, 14], [3, 14], [4, 14], [4, 15], [5, 15], [6, 15], [13, 14], [14, 15],
  [11, 16], [10, 16], [12, 16], [9, 17], [8, 17], [7, 17], [16, 17], [13, 16], [15, 17],
];

// Billes flottantes : position, rayon, verre ou plâtre, décalage de l'animation.
const BALLS: { x: number; y: number; r: number; glass?: boolean; accent?: boolean; delay: number }[] = [
  { x: 318, y: 74, r: 10, delay: 0 },
  { x: 350, y: 52, r: 18, delay: -1.2 },
  { x: 378, y: 90, r: 14, delay: -2.4 },
  { x: 384, y: 150, r: 9, glass: true, delay: -0.6 },
  { x: 346, y: 236, r: 15, delay: -3 },
  { x: 372, y: 300, r: 20, delay: -1.8 },
  { x: 236, y: 250, r: 15, accent: true, delay: -2.1 },
  { x: 72, y: 300, r: 13, delay: -0.9 },
  { x: 40, y: 220, r: 9, glass: true, delay: -2.7 },
  { x: 120, y: 336, r: 11, glass: true, delay: -1.5 },
  { x: 36, y: 120, r: 7, accent: true, delay: -3.3 },
];

// Motif labyrinthe de la ceinture, une tuile de 32 × 32 qui se répète.
const MAZE =
  "M2 2h12v8h-6v8h10v-12h8v20h-8M30 2v6M2 22h6v8M14 30v-6h8v6M22 14h-6M2 14h4";

function Book({ colors }: { colors: string[] }) {
  return (
    <svg viewBox="0 0 40 30" className="h-8 w-11 drop-shadow-[0_8px_10px_rgba(13,63,32,0.35)] md:h-11 md:w-14" aria-hidden>
      <path d="M20 6C14 2 7 2 2 4v22c5-2 12-2 18 2z" fill={colors[0]} />
      <path d="M20 6c6-4 13-4 18-2v22c-5-2-12-2-18 2z" fill={colors[1]} />
      <path d="M20 6v22" stroke="rgba(13,63,32,.35)" strokeWidth="1.2" />
      <path d="M6 10c3-1 7-1 10 1M6 15c3-1 7-1 10 1M24 11c3-2 7-2 10-1M24 16c3-2 7-2 10-1" stroke="rgba(13,63,32,.3)" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function BookGlobe({ className = "" }: { className?: string }) {
  let colorIndex = 0;
  return (
    <div className={`globe-scene relative aspect-[400/470] ${className}`} aria-hidden>
      <svg viewBox="0 0 400 470" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <radialGradient id="g-plaster" cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#eef1ee" />
            <stop offset="100%" stopColor="#bfc9c2" />
          </radialGradient>
          <radialGradient id="g-shade" cx="36%" cy="28%" r="78%">
            <stop offset="0%" stopColor="#fff" stopOpacity=".55" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#0d3f20" stopOpacity=".28" />
          </radialGradient>
          <linearGradient id="g-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c8ecb5" stopOpacity="0" />
            <stop offset="100%" stopColor="#8fd36b" stopOpacity=".55" />
          </linearGradient>
          <radialGradient id="g-ball" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="#c9d3cc" />
          </radialGradient>
          <radialGradient id="g-ball-accent" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#fff6c2" />
            <stop offset="100%" stopColor="#e2b500" />
          </radialGradient>
          <radialGradient id="g-basin" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8fd36b" stopOpacity=".95" />
            <stop offset="100%" stopColor="#e2f5d8" stopOpacity=".5" />
          </radialGradient>
          <pattern id="g-maze" width="32" height="32" patternUnits="userSpaceOnUse">
            <rect width="32" height="32" fill="#f4f6f4" />
            <path d={MAZE} fill="none" stroke="#9aa79f" strokeWidth="3.4" transform="translate(1 1.4)" />
            <path d={MAZE} fill="none" stroke="#ffffff" strokeWidth="3" />
            <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="64 0" dur="9s" repeatCount="indefinite" />
          </pattern>
          <pattern id="g-dots" width="7" height="7" patternUnits="userSpaceOnUse">
            <circle cx="3.5" cy="3.5" r="1.3" fill="#9aa79f" />
          </pattern>
          <clipPath id="g-sphere">
            <circle cx="200" cy="200" r="122" />
          </clipPath>
        </defs>

        {/* Socle */}
        <g className="globe-pedestal">
          <ellipse cx="200" cy="448" rx="118" ry="14" fill="#0d3f20" opacity=".12" />
          <path d="M92 404v26a108 22 0 0 0 216 0v-26z" fill="#eef1ee" />
          <path d="M92 430a108 22 0 0 0 216 0" fill="none" stroke="#c9d3cc" strokeWidth="2" />
          <ellipse cx="200" cy="404" rx="108" ry="22" fill="#ffffff" stroke="#dfe5e0" strokeWidth="2" />
          <ellipse cx="200" cy="404" rx="94" ry="17" fill="url(#g-dots)" />
          <ellipse cx="200" cy="406" rx="70" ry="11" fill="url(#g-basin)" />
          <ellipse cx="200" cy="380" rx="90" ry="40" fill="url(#g-glow)" opacity=".5" />
        </g>

        {/* Réseau de fils, en légère rotation */}
        <g className="globe-network" stroke="#ffffff" strokeOpacity=".75" strokeWidth="1.1" fill="#ffffff">
          {EDGES.map(([a, b]) => (
            <line key={`${a}-${b}`} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
          ))}
          {NODES.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 3.6 : 2.4} stroke="none" />)}
        </g>

        {/* Sphère inclinée : calotte, ceinture labyrinthe, hémisphère bas */}
        <g className="globe-sphere">
          <circle cx="200" cy="200" r="122" fill="url(#g-plaster)" />
          <g clipPath="url(#g-sphere)" transform="rotate(-24 200 200)">
            <path d="M60 182a140 34 0 0 0 280 0v74a140 34 0 0 1-280 0z" fill="url(#g-maze)" />
            <path d="M60 182a140 34 0 0 0 280 0" fill="none" stroke="#9aa79f" strokeWidth="3" />
            <path d="M60 184a140 34 0 0 0 280 0" fill="none" stroke="#ffffff" strokeWidth="2" />
            <path d="M60 256a140 34 0 0 0 280 0" fill="none" stroke="#ffffff" strokeWidth="5" />
            <path d="M60 300a140 34 0 0 0 280 0v40H60z" fill="url(#g-glow)" />
            <g fill="none" stroke="#c9d3cc" strokeWidth="1.6">
              <ellipse cx="200" cy="102" rx="74" ry="16" />
              <ellipse cx="200" cy="99" rx="54" ry="11" />
              <ellipse cx="200" cy="97" rx="34" ry="7" strokeDasharray="1.5 2.5" strokeWidth="4" />
              <ellipse cx="200" cy="96" rx="12" ry="3" fill="#dfe5e0" />
            </g>
            <path d="M200 96v86" stroke="#c9d3cc" strokeWidth="1.4" />
          </g>
          <circle cx="200" cy="200" r="122" fill="url(#g-shade)" />
        </g>

        {/* Billes flottantes */}
        {BALLS.map((b, i) => (
          <circle
            key={i}
            className="globe-ball"
            style={{ animationDelay: `${b.delay}s` } as CSSProperties}
            cx={b.x}
            cy={b.y}
            r={b.r}
            fill={b.glass ? "rgba(255,255,255,.12)" : b.accent ? "url(#g-ball-accent)" : "url(#g-ball)"}
            stroke={b.glass ? "rgba(255,255,255,.8)" : "none"}
            strokeWidth={b.glass ? 1.2 : 0}
          />
        ))}
      </svg>

      {/* Livres en orbite autour de la sphère */}
      <div className="globe-orbits absolute inset-x-0 top-0 aspect-square">
        {rings.map((ring, r) => (
          <div
            key={r}
            className="orbit-plane absolute inset-0"
            style={{ "--tilt": `${ring.tilt}deg`, "--turn": `${ring.turn}deg` } as CSSProperties}
          >
            <div className="absolute rounded-full border border-dashed border-white/40" style={{ inset: `${50 - ring.radius}%` }} />
            <div
              className="orbit-spin absolute inset-0"
              style={{ animationDuration: `${ring.duration}s`, animationDirection: ring.reverse ? "reverse" : "normal" } as CSSProperties}
            >
              {Array.from({ length: ring.books }, (_, i) => {
                const angle = (360 / ring.books) * i;
                const colors = BOOK_COLORS[colorIndex++ % BOOK_COLORS.length];
                return (
                  <div
                    key={i}
                    className="orbit-slot absolute top-1/2 left-1/2"
                    style={{ transform: `rotateZ(${angle}deg) translateX(${ring.radius}cqw) rotateZ(${-angle}deg)` }}
                  >
                    <div
                      className="orbit-face"
                      style={{ animationDuration: `${ring.duration}s`, animationDirection: ring.reverse ? "reverse" : "normal" } as CSSProperties}
                    >
                      <div className="absolute -translate-x-1/2 -translate-y-1/2">
                        <Book colors={colors} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
