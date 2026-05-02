import { useMemo } from "react";

export const WORLD_W = 2400;
export const WORLD_H = 1700;
export const BOARD_W = 1120;
export const BOARD_H = 600;
export const BOARD_OFFSET_X = (WORLD_W - BOARD_W) / 2;
export const BOARD_OFFSET_Y = 540;

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const BOARD_AVOID = {
  x0: BOARD_OFFSET_X - 60,
  y0: BOARD_OFFSET_Y - 40,
  x1: BOARD_OFFSET_X + BOARD_W + 60,
  y1: BOARD_OFFSET_Y + BOARD_H + 60,
};

function inBoard(x: number, y: number, pad = 0) {
  return x > BOARD_AVOID.x0 - pad && x < BOARD_AVOID.x1 + pad
      && y > BOARD_AVOID.y0 - pad && y < BOARD_AVOID.y1 + pad;
}

export function WorldGround({ phase, isDay }: { phase: number; isDay: boolean }) {
  const props = useMemo(() => {
    const r = seeded(2026);
    const trees: Array<{ x: number; y: number; size: number; tone: number }> = [];
    for (let i = 0; i < 110; i++) {
      const x = 50 + r() * (WORLD_W - 100);
      const y = 380 + r() * (WORLD_H - 430);
      if (inBoard(x, y, 60)) continue;
      trees.push({ x, y, size: 16 + r() * 18, tone: r() });
    }
    const tufts: Array<{ x: number; y: number; size: number }> = [];
    for (let i = 0; i < 240; i++) {
      const x = 30 + r() * (WORLD_W - 60);
      const y = 420 + r() * (WORLD_H - 470);
      if (inBoard(x, y, 30)) continue;
      tufts.push({ x, y, size: 0.7 + r() * 0.6 });
    }
    const flowers: Array<{ x: number; y: number; c: string }> = [];
    const flowerColors = ["#FFD700", "#FF7043", "#E040FB", "#FFC107", "#FF5722", "#FFFFFF", "#F8BBD0"];
    for (let i = 0; i < 90; i++) {
      const x = 30 + r() * (WORLD_W - 60);
      const y = 460 + r() * (WORLD_H - 510);
      if (inBoard(x, y, 30)) continue;
      flowers.push({ x, y, c: flowerColors[Math.floor(r() * flowerColors.length)] });
    }
    const rocks: Array<{ x: number; y: number; size: number }> = [];
    for (let i = 0; i < 28; i++) {
      const x = 30 + r() * (WORLD_W - 60);
      const y = 460 + r() * (WORLD_H - 510);
      if (inBoard(x, y, 30)) continue;
      rocks.push({ x, y, size: 4 + r() * 8 });
    }
    return { trees, tufts, flowers, rocks };
  }, []);

  // Subtle dimming when night for the ground (sky already shifts via skyGradient)
  const nightTint = !isDay ? 0.35 : 0;

  return (
    <svg
      width={WORLD_W}
      height={WORLD_H}
      viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
      className="absolute pointer-events-none"
      style={{ top: 0, left: 0, willChange: "transform" }}
    >
      <defs>
        <radialGradient id="worldGround" cx="50%" cy="55%" r="65%">
          <stop offset="0%" stopColor="#82BC48" />
          <stop offset="55%" stopColor="#6FA236" />
          <stop offset="100%" stopColor="#4F7A22" />
        </radialGradient>
        <linearGradient id="mountainBack" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C8AAA" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#465673" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="mountainFront" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5D7240" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#3D5028" stopOpacity="1" />
        </linearGradient>
        <radialGradient id="pondWater" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#B3E5FC" />
          <stop offset="55%" stopColor="#4FC3F7" />
          <stop offset="100%" stopColor="#0277BD" />
        </radialGradient>
        <linearGradient id="riverFlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#81D4FA" />
          <stop offset="100%" stopColor="#0288D1" />
        </linearGradient>
        <linearGradient id="dirtPath" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D4B070" />
          <stop offset="100%" stopColor="#A07840" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={WORLD_W} height={WORLD_H} fill="url(#worldGround)" />

      {/* Distant mountain range — back */}
      <polygon
        points="0,520 140,290 280,440 430,250 600,460 760,290 940,460 1110,260 1290,460 1460,290 1640,460 1810,260 1990,460 2160,290 2310,440 2400,330 2400,540 0,540"
        fill="url(#mountainBack)"
      />
      {/* Snow caps on far mountains */}
      <polygon
        points="430,250 410,275 450,275 600,460"
        fill="rgba(255,255,255,0.55)"
      />
      <polygon
        points="1110,260 1090,288 1130,288"
        fill="rgba(255,255,255,0.55)"
      />
      <polygon
        points="1810,260 1790,288 1830,288"
        fill="rgba(255,255,255,0.55)"
      />

      {/* Closer rolling hills — front */}
      <polygon
        points="0,620 200,420 380,560 550,400 720,580 900,440 1100,580 1280,420 1460,580 1620,420 1800,580 2000,440 2200,580 2400,440 2400,640 0,640"
        fill="url(#mountainFront)"
        opacity="0.7"
      />

      {/* === Pond (left) === */}
      <g>
        <ellipse cx="320" cy="970" rx="240" ry="135" fill="rgba(0,0,0,0.22)" />
        <ellipse cx="320" cy="960" rx="225" ry="120" fill="url(#pondWater)" />
        <ellipse cx="260" cy="920" rx="60" ry="22" fill="rgba(255,255,255,0.30)" />
        <ellipse cx="380" cy="990" rx="22" ry="9" fill="rgba(255,255,255,0.20)" />
        {/* Lily pads */}
        <ellipse cx="220" cy="990" rx="16" ry="11" fill="#388E3C" />
        <circle cx="216" cy="985" r="3" fill="#FFB3D9" />
        <ellipse cx="410" cy="935" rx="14" ry="10" fill="#388E3C" />
        <ellipse cx="340" cy="1030" rx="16" ry="11" fill="#388E3C" />
        <circle cx="344" cy="1024" r="3" fill="#FFEB3B" />
        {/* Ducks */}
        <g transform="translate(280,945)">
          <ellipse cx="0" cy="0" rx="9" ry="5" fill="#FAFAFA" />
          <circle cx="7" cy="-3" r="3.5" fill="#FAFAFA" />
          <polygon points="9,-4 13,-3 9,-2" fill="#FFA726" />
          <circle cx="8" cy="-4" r="0.8" fill="#1a1a1a" />
        </g>
        <g transform="translate(360,975)">
          <ellipse cx="0" cy="0" rx="8" ry="4.5" fill="#FAFAFA" />
          <circle cx="-6" cy="-3" r="3" fill="#FAFAFA" />
          <polygon points="-9,-4 -12,-3 -9,-2" fill="#FFA726" />
          <circle cx="-7" cy="-4" r="0.7" fill="#1a1a1a" />
        </g>
      </g>

      {/* === Pond (top-right, smaller) === */}
      <g>
        <ellipse cx="2080" cy="780" rx="135" ry="72" fill="rgba(0,0,0,0.20)" />
        <ellipse cx="2080" cy="772" rx="125" ry="65" fill="url(#pondWater)" />
        <ellipse cx="2040" cy="755" rx="32" ry="12" fill="rgba(255,255,255,0.25)" />
        <ellipse cx="2100" cy="785" rx="14" ry="6" fill="#388E3C" />
      </g>

      {/* === River along the bottom === */}
      <path
        d="M-20,1340 Q300,1310 600,1380 T1200,1410 Q1700,1430 2000,1380 T2420,1340"
        stroke="#0277BD"
        strokeWidth="48"
        fill="none"
        opacity="0.95"
        strokeLinecap="round"
      />
      <path
        d="M-20,1340 Q300,1310 600,1380 T1200,1410 Q1700,1430 2000,1380 T2420,1340"
        stroke="url(#riverFlow)"
        strokeWidth="38"
        fill="none"
        opacity="0.95"
        strokeLinecap="round"
      />
      <path
        d="M-20,1340 Q300,1310 600,1380 T1200,1410 Q1700,1430 2000,1380 T2420,1340"
        stroke="#B3E5FC"
        strokeWidth="2"
        fill="none"
        opacity="0.7"
        strokeDasharray="22 18"
      />
      {/* River foam highlights */}
      <path
        d="M250,1330 Q300,1325 350,1340"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M1450,1410 Q1500,1405 1550,1418"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="3"
        fill="none"
      />

      {/* === Dirt path: from board's right edge curving to right side of world === */}
      <path
        d="M1700,820 Q1850,850 2000,940 Q2180,1050 2400,1100"
        stroke="#7E5A2E"
        strokeWidth="56"
        fill="none"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M1700,820 Q1850,850 2000,940 Q2180,1050 2400,1100"
        stroke="url(#dirtPath)"
        strokeWidth="44"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M1700,820 Q1850,850 2000,940 Q2180,1050 2400,1100"
        stroke="#E8C788"
        strokeWidth="2.5"
        fill="none"
        opacity="0.55"
        strokeDasharray="18 14"
      />

      {/* === Dirt path: from board's left edge to bottom-left of world === */}
      <path
        d="M700,920 Q540,990 360,1080 Q180,1170 -20,1240"
        stroke="#7E5A2E"
        strokeWidth="56"
        fill="none"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M700,920 Q540,990 360,1080 Q180,1170 -20,1240"
        stroke="url(#dirtPath)"
        strokeWidth="44"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M700,920 Q540,990 360,1080 Q180,1170 -20,1240"
        stroke="#E8C788"
        strokeWidth="2.5"
        fill="none"
        opacity="0.55"
        strokeDasharray="18 14"
      />

      {/* === Wooden bridge across the river (right path) === */}
      <g transform="translate(2090,1100)">
        <rect x="-50" y="-12" width="100" height="24" fill="#7B5028" rx="2" />
        <rect x="-50" y="-15" width="100" height="6" fill="#A0724E" rx="2" />
        {[-40, -20, 0, 20, 40].map((x) => (
          <rect key={x} x={x - 3} y="-12" width="6" height="24" fill="#5D4037" />
        ))}
        <rect x="-52" y="-22" width="6" height="14" fill="#5D4037" />
        <rect x="46" y="-22" width="6" height="14" fill="#5D4037" />
      </g>

      {/* === Trees scattered across the world === */}
      {props.trees.map((t, i) => {
        const dark = t.tone > 0.55;
        const main = dark ? "#2E7D32" : "#388E3C";
        const high = dark ? "#43A047" : "#66BB6A";
        return (
          <g key={`tree-${i}`}>
            <ellipse cx={t.x} cy={t.y + t.size * 1.25} rx={t.size * 0.85} ry={t.size * 0.27} fill="rgba(0,0,0,0.22)" />
            <rect x={t.x - t.size * 0.18} y={t.y + t.size * 0.4} width={t.size * 0.36} height={t.size * 0.95} fill="#5D4037" rx="2" />
            <circle cx={t.x} cy={t.y + t.size * 0.05} r={t.size * 1.0} fill={main} />
            <circle cx={t.x - t.size * 0.45} cy={t.y - t.size * 0.15} r={t.size * 0.7} fill={dark ? "#1B5E20" : "#43A047"} />
            <circle cx={t.x + t.size * 0.45} cy={t.y - t.size * 0.15} r={t.size * 0.65} fill={high} />
            <circle cx={t.x} cy={t.y - t.size * 0.55} r={t.size * 0.55} fill={high} />
            <circle cx={t.x - t.size * 0.25} cy={t.y - t.size * 0.45} r={t.size * 0.3} fill="rgba(255,255,255,0.2)" />
          </g>
        );
      })}

      {/* === Grass tufts === */}
      {props.tufts.map((g, i) => (
        <g key={`tuft-${i}`} opacity="0.6">
          <line x1={g.x - 3 * g.size} y1={g.y} x2={g.x - 6 * g.size} y2={g.y - 9 * g.size} stroke="#4A8020" strokeWidth={1.5 * g.size} strokeLinecap="round" />
          <line x1={g.x} y1={g.y} x2={g.x} y2={g.y - 11 * g.size} stroke="#5A9028" strokeWidth={1.5 * g.size} strokeLinecap="round" />
          <line x1={g.x + 3 * g.size} y1={g.y} x2={g.x + 6 * g.size} y2={g.y - 8 * g.size} stroke="#4A8020" strokeWidth={1.5 * g.size} strokeLinecap="round" />
        </g>
      ))}

      {/* === Wildflowers === */}
      {props.flowers.map((f, i) => (
        <g key={`flw-${i}`} opacity="0.75">
          <line x1={f.x} y1={f.y} x2={f.x} y2={f.y + 6} stroke="#4A8020" strokeWidth="1" />
          <circle cx={f.x} cy={f.y} r="3" fill={f.c} />
          <circle cx={f.x - 2.5} cy={f.y - 1.5} r="2" fill={f.c} opacity="0.7" />
          <circle cx={f.x + 2.5} cy={f.y - 1.5} r="2" fill={f.c} opacity="0.7" />
          <circle cx={f.x} cy={f.y} r="1.2" fill="#FFEB3B" />
        </g>
      ))}

      {/* === Rocks === */}
      {props.rocks.map((r2, i) => (
        <g key={`rock-${i}`}>
          <ellipse cx={r2.x} cy={r2.y + r2.size * 0.4} rx={r2.size * 1.5} ry={r2.size * 0.5} fill="rgba(0,0,0,0.18)" />
          <ellipse cx={r2.x} cy={r2.y} rx={r2.size * 1.4} ry={r2.size * 0.85} fill="#8C7A65" />
          <ellipse cx={r2.x - r2.size * 0.4} cy={r2.y - r2.size * 0.25} rx={r2.size * 0.6} ry={r2.size * 0.3} fill="#A89A82" />
        </g>
      ))}

      {/* === Haystack pile (bottom-left) === */}
      <g transform="translate(450,1430)">
        <ellipse cx="0" cy="55" rx="60" ry="13" fill="rgba(0,0,0,0.28)" />
        <ellipse cx="0" cy="35" rx="55" ry="38" fill="#C68A38" />
        <ellipse cx="0" cy="28" rx="55" ry="32" fill="#E8B968" />
        <ellipse cx="-12" cy="18" rx="40" ry="22" fill="#F0C77E" />
        <line x1="-32" y1="32" x2="32" y2="42" stroke="#A07832" strokeWidth="1" />
        <line x1="-28" y1="20" x2="28" y2="28" stroke="#A07832" strokeWidth="1" />
        <line x1="-32" y1="50" x2="32" y2="55" stroke="#A07832" strokeWidth="1" />
        <line x1="-26" y1="6" x2="26" y2="14" stroke="#A07832" strokeWidth="1" />
      </g>

      {/* Smaller hay roll next to it */}
      <g transform="translate(560,1465)">
        <ellipse cx="0" cy="22" rx="28" ry="6" fill="rgba(0,0,0,0.25)" />
        <ellipse cx="0" cy="10" rx="26" ry="20" fill="#D4A24C" />
        <ellipse cx="-6" cy="6" rx="22" ry="14" fill="#E8B968" />
        <line x1="-18" y1="12" x2="18" y2="18" stroke="#A07832" strokeWidth="0.8" />
      </g>

      {/* === Old well (right side) === */}
      <g transform="translate(1880,1320)">
        <ellipse cx="0" cy="46" rx="42" ry="12" fill="rgba(0,0,0,0.28)" />
        <rect x="-32" y="0" width="64" height="46" fill="#7B5028" rx="3" />
        <rect x="-32" y="-3" width="64" height="6" fill="#5D4037" />
        <rect x="-28" y="3" width="56" height="40" fill="#A0724E" rx="2" />
        <rect x="-25" y="6" width="2" height="36" fill="#5D4037" opacity="0.5" />
        <rect x="-15" y="6" width="2" height="36" fill="#5D4037" opacity="0.5" />
        <rect x="-5" y="6" width="2" height="36" fill="#5D4037" opacity="0.5" />
        <rect x="5" y="6" width="2" height="36" fill="#5D4037" opacity="0.5" />
        <rect x="15" y="6" width="2" height="36" fill="#5D4037" opacity="0.5" />
        <ellipse cx="0" cy="0" rx="24" ry="8" fill="#3E2723" />
        <ellipse cx="0" cy="-1" rx="20" ry="6" fill="#1A0E08" />
        <rect x="-34" y="-30" width="3" height="28" fill="#5D4037" />
        <rect x="31" y="-30" width="3" height="28" fill="#5D4037" />
        <rect x="-38" y="-34" width="76" height="6" fill="#5D4037" rx="1" />
        <polygon points="-45,-34 0,-58 45,-34" fill="#A52A2A" />
        <polygon points="-45,-34 0,-58 -38,-34" fill="#7C2222" />
        <rect x="-2" y="-30" width="4" height="22" fill="#3E2723" />
        <circle cx="0" cy="-18" r="6" fill="#A0724E" />
        <line x1="-6" y1="-18" x2="-15" y2="-12" stroke="#5D4037" strokeWidth="1.5" />
      </g>

      {/* === Wooden bench === */}
      <g transform="translate(2080,1480)">
        <rect x="-38" y="-2" width="76" height="6" fill="#8B6040" rx="1" />
        <rect x="-38" y="-12" width="76" height="6" fill="#A0724E" rx="1" />
        <rect x="-32" y="4" width="3" height="20" fill="#8B6040" />
        <rect x="29" y="4" width="3" height="20" fill="#8B6040" />
        <rect x="-32" y="-22" width="3" height="14" fill="#8B6040" />
        <rect x="29" y="-22" width="3" height="14" fill="#8B6040" />
      </g>

      {/* === Mailbox (lower-left, near road) === */}
      <g transform="translate(680,1180)">
        <ellipse cx="0" cy="42" rx="14" ry="4" fill="rgba(0,0,0,0.25)" />
        <rect x="-2" y="0" width="4" height="42" fill="#5D4037" />
        <rect x="-16" y="-18" width="32" height="22" rx="4" fill="#1976D2" />
        <rect x="-16" y="-18" width="32" height="5" rx="2" fill="#1565C0" />
        <circle cx="-12" cy="-7" r="2" fill="#FFD700" />
        <rect x="11" y="-15" width="4" height="6" fill="#E53935" />
      </g>

      {/* === Scarecrow (south of board) === */}
      <g transform="translate(1200,1180)">
        <ellipse cx="0" cy="54" rx="22" ry="6" fill="rgba(0,0,0,0.25)" />
        <rect x="-2" y="0" width="4" height="55" fill="#5D4037" />
        <rect x="-25" y="14" width="50" height="3" fill="#5D4037" />
        <circle cx="0" cy="-5" r="11" fill="#F0C77E" />
        <polygon points="-14,-12 0,-25 14,-12" fill="#5D4037" />
        <polygon points="-12,-12 -10,-15 14,-12" fill="#3E2723" />
        <circle cx="-3" cy="-6" r="1.2" fill="#1a1a1a" />
        <circle cx="3" cy="-6" r="1.2" fill="#1a1a1a" />
        <line x1="-3" y1="-2" x2="3" y2="-2" stroke="#1a1a1a" strokeWidth="0.8" />
        <rect x="-16" y="3" width="32" height="22" fill="#C62828" rx="2" />
        <polygon points="-16,3 -16,12 -8,8" fill="#A02020" />
        {/* Crow on shoulder */}
        <ellipse cx="-22" cy="14" rx="5" ry="3" fill="#1a1a1a" />
        <circle cx="-25" cy="12" r="2.5" fill="#1a1a1a" />
        <polygon points="-27,12 -29,11.5 -27,11" fill="#FFC107" />
      </g>

      {/* === Distant farmhouse (top-right) === */}
      <g transform="translate(2200,720)" opacity="0.85">
        <ellipse cx="0" cy="40" rx="40" ry="8" fill="rgba(0,0,0,0.25)" />
        <rect x="-32" y="-22" width="64" height="42" fill="#A0724E" />
        <rect x="-32" y="-22" width="64" height="6" fill="#8B5A2B" />
        <polygon points="-38,-22 0,-55 38,-22" fill="#8B2E2E" />
        <polygon points="-38,-22 0,-55 -30,-22" fill="#6B1F1F" />
        <rect x="-8" y="-8" width="14" height="20" fill="#5D4037" />
        <circle cx="3" cy="2" r="0.8" fill="#FFD700" />
        <rect x="14" y="-15" width="12" height="10" fill="#FFEB3B" opacity="0.85" />
        <line x1="14" y1="-10" x2="26" y2="-10" stroke="#5D4037" strokeWidth="0.5" />
        <line x1="20" y1="-15" x2="20" y2="-5" stroke="#5D4037" strokeWidth="0.5" />
        <rect x="-2" y="-55" width="4" height="20" fill="#5D4037" />
        <ellipse cx="0" cy="-70" rx="8" ry="4" fill="rgba(220,220,220,0.5)" />
      </g>

      {/* === Distant barn (top-left) === */}
      <g transform="translate(220,750)" opacity="0.85">
        <ellipse cx="0" cy="35" rx="38" ry="7" fill="rgba(0,0,0,0.25)" />
        <rect x="-32" y="-15" width="64" height="35" fill="#B8312F" />
        <rect x="-32" y="-15" width="64" height="5" fill="#7C1D1B" />
        <polygon points="-32,-15 0,-42 32,-15" fill="#9A2826" />
        <polygon points="-32,-15 0,-42 -25,-15" fill="#7C1D1B" />
        <rect x="-6" y="0" width="12" height="20" fill="#5D4037" />
        <line x1="0" y1="0" x2="0" y2="20" stroke="#1a1a1a" strokeWidth="0.5" />
        <rect x="14" y="-8" width="10" height="8" fill="#FFEB3B" opacity="0.7" />
      </g>

      {/* === Hot air balloon (drifting, in sky region) === */}
      <g transform="translate(380,260)" opacity="0.92">
        <ellipse cx="0" cy="0" rx="38" ry="46" fill="#E91E63" />
        <path d="M-38,-2 Q-38,-30 0,-46 Q38,-30 38,-2 Z" fill="#F06292" />
        <path d="M-20,-32 Q-15,-44 0,-46 Q15,-44 20,-32" fill="#FFEB3B" opacity="0.7" />
        <ellipse cx="-12" cy="-30" rx="4" ry="8" fill="rgba(255,255,255,0.35)" />
        <line x1="-30" y1="22" x2="-15" y2="48" stroke="#5D4037" strokeWidth="1.5" />
        <line x1="30" y1="22" x2="15" y2="48" stroke="#5D4037" strokeWidth="1.5" />
        <line x1="-15" y1="20" x2="-7" y2="48" stroke="#5D4037" strokeWidth="1.2" />
        <line x1="15" y1="20" x2="7" y2="48" stroke="#5D4037" strokeWidth="1.2" />
        <rect x="-20" y="48" width="40" height="22" fill="#7B5028" rx="3" />
        <rect x="-17" y="51" width="34" height="16" fill="#A0724E" rx="2" />
        <line x1="-12" y1="51" x2="-12" y2="67" stroke="#5D4037" strokeWidth="0.6" />
        <line x1="0" y1="51" x2="0" y2="67" stroke="#5D4037" strokeWidth="0.6" />
        <line x1="12" y1="51" x2="12" y2="67" stroke="#5D4037" strokeWidth="0.6" />
      </g>

      {/* === Dog house (lower-left near board) === */}
      <g transform="translate(770,1380)">
        <ellipse cx="0" cy="22" rx="30" ry="6" fill="rgba(0,0,0,0.25)" />
        <rect x="-22" y="-10" width="44" height="32" fill="#A0724E" />
        <polygon points="-26,-10 0,-32 26,-10" fill="#8B2E2E" />
        <polygon points="-26,-10 0,-32 -20,-10" fill="#6B1F1F" />
        <ellipse cx="0" cy="6" rx="11" ry="15" fill="#3E2723" />
        <rect x="-5" y="-22" width="10" height="3" fill="#5D4037" />
        <rect x="-3" y="-25" width="6" height="6" fill="#FFD700" rx="1" />
      </g>

      {/* === Sheep grazing === */}
      <g transform="translate(1020,1250)">
        <ellipse cx="0" cy="8" rx="14" ry="4" fill="rgba(0,0,0,0.2)" />
        <ellipse cx="0" cy="0" rx="12" ry="8" fill="#FAFAFA" />
        <ellipse cx="-8" cy="-2" rx="6" ry="5" fill="#FAFAFA" />
        <circle cx="-10" cy="-3" r="3.5" fill="#3E2723" />
        <circle cx="-9" cy="-3.5" r="0.6" fill="white" />
        <rect x="-6" y="6" width="2" height="5" fill="#3E2723" />
        <rect x="-2" y="6" width="2" height="5" fill="#3E2723" />
        <rect x="2" y="6" width="2" height="5" fill="#3E2723" />
        <rect x="6" y="6" width="2" height="5" fill="#3E2723" />
      </g>
      <g transform="translate(1380,1240)">
        <ellipse cx="0" cy="8" rx="13" ry="4" fill="rgba(0,0,0,0.2)" />
        <ellipse cx="0" cy="0" rx="11" ry="7" fill="#FAFAFA" />
        <ellipse cx="8" cy="-2" rx="5" ry="4" fill="#FAFAFA" />
        <circle cx="10" cy="-3" r="3" fill="#3E2723" />
        <circle cx="9" cy="-3.5" r="0.5" fill="white" />
        <rect x="-5" y="5" width="2" height="4" fill="#3E2723" />
        <rect x="-1" y="5" width="2" height="4" fill="#3E2723" />
        <rect x="3" y="5" width="2" height="4" fill="#3E2723" />
      </g>

      {/* === Wooden signpost near board entrance === */}
      <g transform="translate(1700,1050)">
        <ellipse cx="0" cy="42" rx="10" ry="3" fill="rgba(0,0,0,0.25)" />
        <rect x="-2" y="0" width="4" height="42" fill="#5D4037" />
        <rect x="-22" y="-6" width="44" height="14" fill="#A0724E" rx="1" />
        <rect x="-22" y="-6" width="44" height="14" fill="none" stroke="#5D4037" strokeWidth="0.8" rx="1" />
        <text x="0" y="3" textAnchor="middle" fontSize="8" fill="#3E2723" fontWeight="bold" fontFamily="Oxanium, sans-serif">FARM</text>
        <polygon points="22,-6 30,1 22,8" fill="#A0724E" stroke="#5D4037" strokeWidth="0.8" />
      </g>

      {/* Night dimming overlay */}
      {nightTint > 0 && (
        <rect x="0" y="0" width={WORLD_W} height={WORLD_H} fill="#0B1626" opacity={nightTint} pointerEvents="none" />
      )}
    </svg>
  );
}

/**
 * Tiny minimap shown bottom-right, indicating the camera position relative
 * to the world. Decorative; helps players orient when zoomed in.
 */
export function Minimap({
  camX,
  camY,
  scale,
  vw,
  vh,
}: {
  camX: number;
  camY: number;
  scale: number;
  vw: number;
  vh: number;
}) {
  const mmW = 110;
  const mmH = (mmW * WORLD_H) / WORLD_W;
  // Convert viewport rect (in screen) into world-coords box visible on minimap
  const visW = (vw / scale) * (mmW / WORLD_W);
  const visH = (vh / scale) * (mmH / WORLD_H);
  const visX = (-camX / scale) * (mmW / WORLD_W);
  const visY = (-camY / scale) * (mmH / WORLD_H);
  // Board outline in minimap coords
  const bx = (BOARD_OFFSET_X * mmW) / WORLD_W;
  const by = (BOARD_OFFSET_Y * mmH) / WORLD_H;
  const bw = (BOARD_W * mmW) / WORLD_W;
  const bh = (BOARD_H * mmH) / WORLD_H;
  return (
    <div
      className="pointer-events-none"
      style={{
        position: "absolute",
        right: 10,
        bottom: 56,
        width: mmW,
        height: mmH,
        background: "rgba(20,30,15,0.7)",
        border: "1.5px solid rgba(255,215,0,0.45)",
        borderRadius: 6,
        backdropFilter: "blur(6px)",
        boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
        overflow: "hidden",
        zIndex: 30,
      }}
    >
      <svg width={mmW} height={mmH}>
        <rect x="0" y="0" width={mmW} height={mmH} fill="#4A7820" opacity="0.6" />
        <rect x={bx} y={by} width={bw} height={bh} fill="#C49A5A" opacity="0.85" rx="1.5" />
        <rect
          x={Math.max(0, Math.min(mmW - 2, visX))}
          y={Math.max(0, Math.min(mmH - 2, visY))}
          width={Math.max(2, Math.min(mmW, visW))}
          height={Math.max(2, Math.min(mmH, visH))}
          fill="none"
          stroke="#FFD700"
          strokeWidth="1.5"
          rx="1"
        />
      </svg>
    </div>
  );
}
