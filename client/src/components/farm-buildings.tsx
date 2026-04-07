// SVG Building Art Components for Farm Tycoon 2D
// Each building has a locked state + 3 level variants

export function LockedFieldSVG({ cost }: { cost: number }) {
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="farmStripe" patternUnits="userSpaceOnUse" width="24" height="24">
          <rect width="24" height="12" fill="#9ca3af"/>
          <rect y="12" width="24" height="12" fill="#6b7280"/>
        </pattern>
      </defs>
      <rect width="200" height="150" fill="url(#farmStripe)" rx="6"/>
      <rect width="200" height="150" fill="#374151" opacity="0.35" rx="6"/>
      {/* Padlock body */}
      <rect x="81" y="60" width="38" height="30" rx="7" fill="#1f2937" stroke="#374151" strokeWidth="2"/>
      {/* Padlock shackle */}
      <path d="M88 60 Q88 43 100 43 Q112 43 112 60" fill="none" stroke="#1f2937" strokeWidth="7" strokeLinecap="round"/>
      {/* Keyhole */}
      <circle cx="100" cy="73" r="5" fill="#4b5563"/>
      <rect x="98" y="74" width="4" height="8" rx="2" fill="#4b5563"/>
      {/* Cost pill */}
      <rect x="40" y="112" width="120" height="26" rx="13" fill="#111827" opacity="0.92"/>
      <text x="100" y="129" textAnchor="middle" fill="#fbbf24" fontSize="12" fontWeight="700" fontFamily="ui-sans-serif,system-ui,sans-serif">
        {cost} EduCoins
      </text>
    </svg>
  );
}

// ── WHEAT FIELD ──────────────────────────────────────────────────────────────
export function WheatFieldSVG({ level }: { level: number }) {
  const headColor = level === 3 ? "#fde047" : level === 2 ? "#f59e0b" : "#d97706";
  const count = level === 1 ? 18 : level === 2 ? 30 : 42;
  const cols = level === 1 ? 6 : level === 2 ? 8 : 10;
  const rows = Math.ceil(count / cols);
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      {/* Soil */}
      <rect width="200" height="150" fill="#92400e" rx="6"/>
      {/* Tilled rows */}
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x="8" y={10 + i * 19} width="184" height="12" rx="4" fill="#7c3412" opacity="0.6"/>
      ))}
      {/* Wheat stalks */}
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          if (r * cols + c >= count) return null;
          const x = 14 + c * (172 / (cols - 1));
          const y = 22 + r * 19;
          return (
            <g key={`${r}-${c}`}>
              <line x1={x} y1={y + 18} x2={x} y2={y + 5} stroke="#a16207" strokeWidth="1.5"/>
              <ellipse cx={x} cy={y} rx="4" ry="8" fill={headColor}/>
              <line x1={x} y1={y + 6} x2={x + 6} y2={y - 1} stroke={headColor} strokeWidth="1.2"/>
              <line x1={x} y1={y + 6} x2={x - 6} y2={y - 1} stroke={headColor} strokeWidth="1.2"/>
            </g>
          );
        })
      )}
      {/* Level glow at bottom */}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill={headColor} opacity="0.7"/>
    </svg>
  );
}

// ── VEGETABLE PATCH ──────────────────────────────────────────────────────────
export function VegetablePatchSVG({ level }: { level: number }) {
  const rows = level === 1 ? 3 : level === 2 ? 4 : 5;
  const cols = level === 1 ? 4 : level === 2 ? 5 : 6;
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#5c3317" rx="6"/>
      {/* Soil rows */}
      {Array.from({ length: rows + 1 }).map((_, i) => (
        <rect key={i} x="6" y={8 + i * (130 / rows)} width="188" height={130 / rows - 4} rx="3" fill="#4a2810" opacity="0.5"/>
      ))}
      {/* Carrots */}
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const x = 18 + c * (164 / (cols - 1));
          const y = 22 + r * (120 / (rows - 0.5));
          return (
            <g key={`${r}-${c}`}>
              {/* Carrot body */}
              <polygon points={`${x},${y+4} ${x+5},${y-8} ${x-5},${y-8}`} fill="#f97316"/>
              <line x1={x} y1={y - 8} x2={x - 4} y2={y - 16} stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
              <line x1={x} y1={y - 8} x2={x} y2={y - 17} stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
              <line x1={x} y1={y - 8} x2={x + 4} y2={y - 16} stroke="#16a34a" strokeWidth="2" strokeLinecap="round"/>
            </g>
          );
        })
      )}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill="#f97316" opacity="0.8"/>
    </svg>
  );
}

// ── APPLE ORCHARD ────────────────────────────────────────────────────────────
export function AppleOrchardSVG({ level }: { level: number }) {
  const numTrees = level === 1 ? 2 : level === 2 ? 3 : 4;
  const treeX = numTrees === 2 ? [55, 145] : numTrees === 3 ? [38, 100, 162] : [30, 82, 130, 170];
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#4ade80" rx="6"/>
      <rect x="0" y="110" width="200" height="40" rx="6" fill="#22c55e"/>
      {/* Trees */}
      {treeX.map((tx, i) => (
        <g key={i}>
          {/* Trunk */}
          <rect x={tx - 5} y="90" width="10" height="22" rx="3" fill="#7c3412"/>
          {/* Foliage layers */}
          <circle cx={tx} cy="65" r="32" fill="#166534"/>
          <circle cx={tx} cy="58" r="26" fill="#15803d"/>
          <circle cx={tx - 8} cy="54" r="18" fill="#16a34a"/>
          <circle cx={tx + 8} cy="54" r="18" fill="#16a34a"/>
          {/* Apples */}
          {level >= 1 && (
            <>
              <circle cx={tx - 10} cy="58" r="4.5" fill="#ef4444"/>
              <circle cx={tx + 8} cy="53" r="4.5" fill="#ef4444"/>
              <circle cx={tx} cy="68" r="4" fill="#dc2626"/>
              {level >= 2 && <><circle cx={tx - 4} cy="44" r="4" fill="#ef4444"/><circle cx={tx + 14} cy="64" r="3.5" fill="#dc2626"/></>}
              {level === 3 && <><circle cx={tx - 16} cy="66" r="3.5" fill="#ef4444"/><circle cx={tx + 2} cy="78" r="3" fill="#dc2626"/></>}
            </>
          )}
        </g>
      ))}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill="#ef4444" opacity="0.8"/>
    </svg>
  );
}

// ── GREENHOUSE ───────────────────────────────────────────────────────────────
export function GreenhouseSVG({ level }: { level: number }) {
  const plantH = level === 1 ? 18 : level === 2 ? 28 : 38;
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#bef264" rx="6"/>
      {/* Soil bed */}
      <rect x="12" y="95" width="176" height="48" rx="4" fill="#7c3412"/>
      {/* Glass walls */}
      <rect x="10" y="50" width="180" height="50" fill="#bae6fd" opacity="0.6" stroke="#93c5fd" strokeWidth="1.5"/>
      {/* Glass roof */}
      <polygon points="100,8 10,50 190,50" fill="#e0f2fe" opacity="0.8" stroke="#93c5fd" strokeWidth="1.5"/>
      {/* Frame verticals */}
      {[40, 70, 100, 130, 160].map(x => (
        <line key={x} x1={x} y1="50" x2={x} y2="100" stroke="#7dd3fc" strokeWidth="1.5" opacity="0.6"/>
      ))}
      {/* Frame horizontals */}
      <line x1="10" y1="70" x2="190" y2="70" stroke="#7dd3fc" strokeWidth="1.5" opacity="0.6"/>
      {/* Roof ridge */}
      <line x1="100" y1="8" x2="100" y2="50" stroke="#7dd3fc" strokeWidth="2" opacity="0.8"/>
      {/* Plants */}
      {Array.from({ length: level === 1 ? 5 : level === 2 ? 7 : 9 }).map((_, i) => {
        const px = 25 + i * (150 / (level === 1 ? 4 : level === 2 ? 6 : 8));
        return (
          <g key={i}>
            <rect x={px - 3} y={143 - plantH} width="6" height="6" rx="2" fill="#92400e"/>
            <rect x={px - 2} y={105 - plantH} width="4" height={plantH - 10} fill="#a3e635"/>
            <ellipse cx={px} cy={105 - plantH} rx="9" ry="9" fill="#4ade80"/>
            <ellipse cx={px - 5} cy={110 - plantH} rx="7" ry="6" fill="#86efac"/>
            <ellipse cx={px + 5} cy={110 - plantH} rx="7" ry="6" fill="#86efac"/>
          </g>
        );
      })}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill="#a3e635" opacity="0.8"/>
    </svg>
  );
}

// ── CHICKEN COOP ─────────────────────────────────────────────────────────────
export function ChickenCoopSVG({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#fef3c7" rx="6"/>
      {/* Fence */}
      {[8, 30, 52, 74, 96, 118, 140, 162, 184].map(x => (
        <rect key={x} x={x} y="110" width="5" height="22" rx="2" fill="#a16207"/>
      ))}
      <rect x="8" y="116" width="184" height="5" rx="2" fill="#a16207"/>
      <rect x="8" y="126" width="184" height="5" rx="2" fill="#a16207"/>
      {/* Ground */}
      <rect x="8" y="115" width="184" height="30" rx="4" fill="#fde68a" opacity="0.5"/>
      {/* Building */}
      <rect x="35" y="55" width="130" height="65" rx="5" fill="#d97706"/>
      {/* Roof */}
      <polygon points="100,15 20,55 180,55" fill="#92400e"/>
      {/* Roof highlight */}
      <polygon points="100,15 100,55 20,55" fill="#78350f" opacity="0.3"/>
      {/* Door */}
      <rect x="80" y="88" width="40" height="32" rx="4" fill="#451a03"/>
      <circle cx="86" cy="104" r="3" fill="#fbbf24"/>
      {/* Window */}
      <rect x="45" y="68" width="30" height="25" rx="3" fill="#fef9c3"/>
      <line x1="60" y1="68" x2="60" y2="93" stroke="#d97706" strokeWidth="2"/>
      <line x1="45" y1="80" x2="75" y2="80" stroke="#d97706" strokeWidth="2"/>
      <rect x="125" y="68" width="30" height="25" rx="3" fill="#fef9c3"/>
      <line x1="140" y1="68" x2="140" y2="93" stroke="#d97706" strokeWidth="2"/>
      <line x1="125" y1="80" x2="155" y2="80" stroke="#d97706" strokeWidth="2"/>
      {/* Chickens */}
      {level >= 1 && (
        <g transform="translate(25 120)">
          <ellipse cx="0" cy="0" rx="8" ry="6" fill="white"/>
          <circle cx="6" cy="-4" r="5" fill="white"/>
          <polygon points="9,-3 13,-5 9,-7" fill="#f97316"/>
          <circle cx="8" cy="-5" r="1.5" fill="#1f2937"/>
        </g>
      )}
      {level >= 2 && (
        <g transform="translate(55 122)">
          <ellipse cx="0" cy="0" rx="8" ry="6" fill="#fef3c7"/>
          <circle cx="6" cy="-4" r="5" fill="#fef3c7"/>
          <polygon points="9,-3 13,-5 9,-7" fill="#f97316"/>
          <circle cx="8" cy="-5" r="1.5" fill="#1f2937"/>
          <polygon points="0,-10 -3,-16 3,-16" fill="#ef4444"/>
        </g>
      )}
      {level === 3 && (
        <>
          <g transform="translate(150 120)">
            <ellipse cx="0" cy="0" rx="8" ry="6" fill="white"/>
            <circle cx="6" cy="-4" r="5" fill="white"/>
            <polygon points="9,-3 13,-5 9,-7" fill="#f97316"/>
            <circle cx="8" cy="-5" r="1.5" fill="#1f2937"/>
          </g>
          <g transform="translate(170 122)">
            <ellipse cx="0" cy="0" rx="7" ry="5" fill="#fef3c7"/>
            <circle cx="5" cy="-4" r="4" fill="#fef3c7"/>
            <polygon points="8,-3 11,-5 8,-7" fill="#f97316"/>
          </g>
        </>
      )}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill="#fbbf24" opacity="0.8"/>
    </svg>
  );
}

// ── DAIRY COWS ───────────────────────────────────────────────────────────────
export function DairyCowsSVG({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#86efac" rx="6"/>
      {/* Field darker grass */}
      <rect x="8" y="95" width="184" height="48" rx="4" fill="#4ade80" opacity="0.5"/>
      {/* Fence posts */}
      {[8, 42, 76, 110, 144, 178].map(x => (
        <g key={x}>
          <rect x={x} y="88" width="7" height="30" rx="2" fill="#92400e"/>
          <rect x={x - 2} y="90" width="11" height="4" rx="1" fill="#a16207"/>
        </g>
      ))}
      <rect x="8" y="96" width="184" height="5" rx="2" fill="#a16207"/>
      <rect x="8" y="108" width="184" height="5" rx="2" fill="#a16207"/>
      {/* Cow 1 */}
      <g transform="translate(45 68)">
        <ellipse cx="0" cy="0" rx="30" ry="18" fill="white"/>
        <rect x="-25" y="12" width="8" height="16" rx="3" fill="white"/>
        <rect x="-10" y="12" width="8" height="16" rx="3" fill="white"/>
        <rect x="8" y="12" width="8" height="16" rx="3" fill="white"/>
        <rect x="22" y="12" width="8" height="16" rx="3" fill="white"/>
        {/* Black patches */}
        <ellipse cx="-8" cy="-5" rx="12" ry="8" fill="#1f2937"/>
        <ellipse cx="12" cy="3" rx="8" ry="6" fill="#1f2937"/>
        {/* Head */}
        <circle cx="30" cy="-8" r="14" fill="white"/>
        <ellipse cx="36" cy="-4" rx="8" ry="5" fill="#fca5a5"/>
        <circle cx="28" cy="-12" r="4" fill="#1f2937"/>
        <circle cx="29" cy="-13" r="1.5" fill="white"/>
        {/* Horns */}
        <line x1="26" y1="-22" x2="22" y2="-30" stroke="#d97706" strokeWidth="3" strokeLinecap="round"/>
        <line x1="32" y1="-22" x2="36" y2="-30" stroke="#d97706" strokeWidth="3" strokeLinecap="round"/>
        {/* Udder */}
        <ellipse cx="0" cy="20" rx="12" ry="6" fill="#fca5a5"/>
        {/* Tail */}
        <path d="M-28 -5 Q-42 -5 -38 12" fill="none" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
      </g>
      {/* Second cow for level 2+ */}
      {level >= 2 && (
        <g transform="translate(140 75) scale(0.75)">
          <ellipse cx="0" cy="0" rx="30" ry="18" fill="white"/>
          <rect x="-25" y="12" width="8" height="16" rx="3" fill="white"/>
          <rect x="-10" y="12" width="8" height="16" rx="3" fill="white"/>
          <rect x="8" y="12" width="8" height="16" rx="3" fill="white"/>
          <rect x="22" y="12" width="8" height="16" rx="3" fill="white"/>
          <ellipse cx="-5" cy="-3" rx="14" ry="9" fill="#1f2937"/>
          <ellipse cx="14" cy="4" rx="7" ry="5" fill="#1f2937"/>
          <circle cx="30" cy="-8" r="14" fill="white"/>
          <ellipse cx="36" cy="-4" rx="8" ry="5" fill="#fca5a5"/>
          <circle cx="28" cy="-12" r="4" fill="#1f2937"/>
          <circle cx="29" cy="-13" r="1.5" fill="white"/>
          <line x1="26" y1="-22" x2="22" y2="-30" stroke="#d97706" strokeWidth="3" strokeLinecap="round"/>
          <line x1="32" y1="-22" x2="36" y2="-30" stroke="#d97706" strokeWidth="3" strokeLinecap="round"/>
          <ellipse cx="0" cy="20" rx="12" ry="6" fill="#fca5a5"/>
        </g>
      )}
      {/* Milk bucket for level 3 */}
      {level === 3 && (
        <g transform="translate(110 108)">
          <rect x="-8" y="-12" width="16" height="16" rx="3" fill="#e5e7eb"/>
          <rect x="-7" y="-12" width="14" height="4" rx="2" fill="#d1d5db"/>
          <line x1="-8" y1="-14" x2="-4" y2="-18" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
          <line x1="8" y1="-14" x2="4" y2="-18" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
          <line x1="-4" y1="-18" x2="4" y2="-18" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"/>
        </g>
      )}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill="#4ade80" opacity="0.8"/>
    </svg>
  );
}

// ── FARMHOUSE ────────────────────────────────────────────────────────────────
export function FarmhouseSVG({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#d1fae5" rx="6"/>
      {/* Garden path */}
      <rect x="85" y="105" width="30" height="40" rx="4" fill="#d4b896"/>
      {/* Flowers */}
      {level >= 2 && [20, 35, 155, 170].map(fx => (
        <g key={fx}>
          <circle cx={fx} cy="125" r="5" fill="#f9a8d4"/>
          <circle cx={fx - 4} cy="118" r="3.5" fill="#f472b6"/>
          <circle cx={fx + 4} cy="118" r="3.5" fill="#fb7185"/>
          <line x1={fx} y1="125" x2={fx} y2="135" stroke="#16a34a" strokeWidth="2"/>
        </g>
      ))}
      {/* House walls */}
      <rect x="20" y="70" width="160" height="75" rx="4" fill="#f5f5f5"/>
      {/* Shadow under roof */}
      <rect x="20" y="70" width="160" height="15" fill="#e5e7eb"/>
      {/* Chimney */}
      <rect x="145" y="28" width="18" height="35" rx="3" fill="#9ca3af"/>
      <rect x="143" y="25" width="22" height="8" rx="3" fill="#6b7280"/>
      {/* Smoke */}
      {level >= 2 && (
        <>
          <ellipse cx="154" cy="18" rx="5" ry="7" fill="#e5e7eb" opacity="0.7"/>
          <ellipse cx="160" cy="10" rx="4" ry="6" fill="#e5e7eb" opacity="0.5"/>
        </>
      )}
      {/* Roof */}
      <polygon points="100,12 10,70 190,70" fill="#ef4444"/>
      <polygon points="100,12 100,70 10,70" fill="#dc2626" opacity="0.25"/>
      {/* Roof trim */}
      <line x1="10" y1="70" x2="190" y2="70" stroke="#b91c1c" strokeWidth="3"/>
      {/* Door */}
      <rect x="82" y="103" width="36" height="42" rx="5" fill="#92400e"/>
      <rect x="84" y="105" width="32" height="30" rx="4" fill="#78350f"/>
      <circle cx="113" cy="122" r="3.5" fill="#fbbf24"/>
      {/* Arch over door */}
      <path d="M82 103 Q100 90 118 103" fill="#7c2d12" strokeWidth="0"/>
      {/* Windows */}
      <rect x="30" y="80" width="40" height="34" rx="4" fill="#bae6fd"/>
      <line x1="50" y1="80" x2="50" y2="114" stroke="white" strokeWidth="2.5"/>
      <line x1="30" y1="97" x2="70" y2="97" stroke="white" strokeWidth="2.5"/>
      <rect x="130" y="80" width="40" height="34" rx="4" fill="#bae6fd"/>
      <line x1="150" y1="80" x2="150" y2="114" stroke="white" strokeWidth="2.5"/>
      <line x1="130" y1="97" x2="170" y2="97" stroke="white" strokeWidth="2.5"/>
      {/* Level indicator */}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill="#ef4444" opacity="0.8"/>
    </svg>
  );
}

// ── WINDMILL ─────────────────────────────────────────────────────────────────
export function WindmillSVG({ level }: { level: number }) {
  const bladeAngle = level * 25;
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#bfdbfe" rx="6"/>
      {/* Ground */}
      <rect x="0" y="118" width="200" height="32" fill="#86efac"/>
      {/* Tower */}
      <polygon points="80,118 92,30 108,30 120,118" fill="#d1d5db"/>
      <polygon points="80,118 92,30 100,30 100,118" fill="#e5e7eb"/>
      {/* Horizontal bands on tower */}
      {[50, 70, 90, 110].map(y => (
        <line key={y} x1="82" y1={y} x2="118" y2={y} stroke="#9ca3af" strokeWidth="1.5" opacity="0.6"/>
      ))}
      {/* Cap */}
      <polygon points="85,30 100,10 115,30" fill="#1e3a5f"/>
      {/* Blades center */}
      <circle cx="100" cy="32" r="8" fill="#374151"/>
      <circle cx="100" cy="32" r="4" fill="#6b7280"/>
      {/* 4 blades */}
      {[0, 90, 180, 270].map(angle => {
        const rad = ((angle + bladeAngle) * Math.PI) / 180;
        const ex = 100 + Math.sin(rad) * 38;
        const ey = 32 - Math.cos(rad) * 38;
        const lx = 100 + Math.sin(rad) * 10;
        const ly = 32 - Math.cos(rad) * 10;
        const perp = ((angle + bladeAngle + 90) * Math.PI) / 180;
        const w = 9;
        const x1 = lx + Math.sin(perp) * w;
        const y1 = ly - Math.cos(perp) * w;
        const x2 = lx - Math.sin(perp) * w;
        const y2 = ly + Math.cos(perp) * w;
        return (
          <polygon key={angle}
            points={`${x1},${y1} ${ex},${ey} ${x2},${y2}`}
            fill="#1d4ed8" opacity="0.9"
          />
        );
      })}
      {/* Door */}
      <rect x="91" y="100" width="18" height="18" rx="9" fill="#7c3412"/>
      {/* Small trees */}
      {level >= 2 && (
        <>
          <circle cx="30" cy="110" r="20" fill="#16a34a"/>
          <rect x="26" y="110" width="8" height="10" rx="2" fill="#92400e"/>
          <circle cx="170" cy="108" r="18" fill="#15803d"/>
          <rect x="166" y="108" width="8" height="10" rx="2" fill="#92400e"/>
        </>
      )}
      {level === 3 && (
        <g transform="translate(155 90) scale(0.75)">
          <circle cx="0" cy="0" r="20" fill="#16a34a"/>
          <rect x="-4" y="0" width="8" height="12" rx="2" fill="#92400e"/>
        </g>
      )}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill="#1d4ed8" opacity="0.8"/>
    </svg>
  );
}

// ── BARN ─────────────────────────────────────────────────────────────────────
export function BarnSVG({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#fef3c7" rx="6"/>
      <rect x="0" y="115" width="200" height="35" fill="#d4b896"/>
      {/* Main building */}
      <rect x="18" y="60" width="164" height="70" rx="3" fill="#dc2626"/>
      {/* Roof */}
      <polygon points="100,8 10,60 190,60" fill="#7f1d1d"/>
      <polygon points="100,8 100,60 10,60" fill="#991b1b" opacity="0.3"/>
      {/* Roof gable */}
      <polygon points="100,8 85,30 115,30" fill="#ef4444"/>
      {/* White trim */}
      <line x1="10" y1="60" x2="190" y2="60" stroke="#fee2e2" strokeWidth="4"/>
      <rect x="18" y="58" width="164" height="8" fill="#fee2e2" opacity="0.4"/>
      {/* Big barn doors */}
      <rect x="30" y="85" width="60" height="45" rx="3" fill="#7f1d1d"/>
      <rect x="31" y="86" width="28" height="43" rx="2" fill="#991b1b"/>
      <rect x="61" y="86" width="28" height="43" rx="2" fill="#991b1b"/>
      <line x1="60" y1="86" x2="60" y2="129" stroke="#7f1d1d" strokeWidth="2"/>
      {/* Door X braces */}
      <line x1="31" y1="86" x2="59" y2="129" stroke="#7f1d1d" strokeWidth="2" opacity="0.6"/>
      <line x1="59" y1="86" x2="31" y2="129" stroke="#7f1d1d" strokeWidth="2" opacity="0.6"/>
      <line x1="61" y1="86" x2="89" y2="129" stroke="#7f1d1d" strokeWidth="2" opacity="0.6"/>
      <line x1="89" y1="86" x2="61" y2="129" stroke="#7f1d1d" strokeWidth="2" opacity="0.6"/>
      {/* Window */}
      <rect x="116" y="72" width="52" height="36" rx="4" fill="#fef9c3"/>
      <line x1="142" y1="72" x2="142" y2="108" stroke="#dc2626" strokeWidth="2.5"/>
      <line x1="116" y1="90" x2="168" y2="90" stroke="#dc2626" strokeWidth="2.5"/>
      {/* Hay bales */}
      {level >= 2 && (
        <>
          <ellipse cx="158" cy="122" rx="14" ry="10" fill="#d97706"/>
          <ellipse cx="158" cy="118" rx="12" ry="8" fill="#f59e0b"/>
          <ellipse cx="175" cy="124" rx="12" ry="9" fill="#d97706"/>
          <ellipse cx="175" cy="120" rx="10" ry="7" fill="#f59e0b"/>
        </>
      )}
      {level === 3 && (
        <ellipse cx="145" cy="126" rx="11" ry="8" fill="#f59e0b"/>
      )}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill="#ef4444" opacity="0.8"/>
    </svg>
  );
}

// ── TRACTOR ──────────────────────────────────────────────────────────────────
export function TractorSVG({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#d1fae5" rx="6"/>
      <rect x="0" y="112" width="200" height="38" fill="#86efac"/>
      {/* Tire tracks */}
      {[-1, 0, 1, 2, 3, 4].map(i => (
        <line key={i} x1={30 + i * 25} y1="112" x2={30 + i * 25} y2="135" stroke="#4b5563" strokeWidth="3" opacity="0.2"/>
      ))}
      {/* Rear big wheel */}
      <circle cx="65" cy="105" r="35" fill="#1f2937"/>
      <circle cx="65" cy="105" r="28" fill="#374151"/>
      <circle cx="65" cy="105" r="18" fill="#4b5563"/>
      <circle cx="65" cy="105" r="8" fill="#6b7280"/>
      {/* Wheel treads */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
        const rad = (a * Math.PI) / 180;
        const x1 = 65 + Math.cos(rad) * 22;
        const y1 = 105 + Math.sin(rad) * 22;
        const x2 = 65 + Math.cos(rad) * 32;
        const y2 = 105 + Math.sin(rad) * 32;
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1f2937" strokeWidth="4"/>;
      })}
      {/* Body */}
      <polygon points="95,58 170,58 175,90 95,90" fill="#16a34a"/>
      {/* Hood */}
      <rect x="95" y="70" width="55" height="22" rx="3" fill="#15803d"/>
      {/* Cabin */}
      <rect x="96" y="35" width="68" height="55" rx="6" fill="#22c55e"/>
      <rect x="96" y="35" width="68" height="18" rx="6" fill="#16a34a"/>
      {/* Cabin windows */}
      <rect x="102" y="40" width="28" height="26" rx="3" fill="#bae6fd"/>
      <rect x="135" y="40" width="24" height="26" rx="3" fill="#bae6fd"/>
      {/* Exhaust pipe */}
      <rect x="145" y="18" width="8" height="42" rx="4" fill="#6b7280"/>
      <rect x="143" y="15" width="12" height="8" rx="3" fill="#4b5563"/>
      {/* Smoke */}
      {level >= 2 && (
        <>
          <ellipse cx="149" cy="10" rx="5" ry="6" fill="#d1d5db" opacity="0.7"/>
          <ellipse cx="155" cy="4" rx="4" ry="5" fill="#d1d5db" opacity="0.5"/>
        </>
      )}
      {/* Front small wheel */}
      <circle cx="160" cy="108" r="22" fill="#1f2937"/>
      <circle cx="160" cy="108" r="16" fill="#374151"/>
      <circle cx="160" cy="108" r="7" fill="#6b7280"/>
      {/* Steering */}
      <rect x="115" y="56" width="4" height="14" rx="2" fill="#4b5563"/>
      <ellipse cx="117" cy="55" rx="9" ry="4" fill="#6b7280"/>
      {level === 3 && (
        <>
          {/* Front loader arm */}
          <rect x="84" y="60" width="15" height="50" rx="4" fill="#15803d"/>
          <rect x="70" y="108" width="30" height="8" rx="3" fill="#166534"/>
        </>
      )}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill="#16a34a" opacity="0.8"/>
    </svg>
  );
}

// ── GRAIN SILO ───────────────────────────────────────────────────────────────
export function GrainSiloSVG({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#fef9c3" rx="6"/>
      <rect x="0" y="120" width="200" height="30" fill="#fde68a"/>
      {/* Main silo cylinder */}
      <rect x="55" y="25" width="90" height="100" rx="8" fill="#d1d5db"/>
      <rect x="55" y="25" width="45" height="100" fill="#e5e7eb"/>
      {/* Horizontal rings */}
      {[35, 50, 65, 80, 95, 110].map(y => (
        <rect key={y} x="55" y={y} width="90" height="4" rx="2" fill="#9ca3af" opacity="0.6"/>
      ))}
      {/* Dome top */}
      <ellipse cx="100" cy="25" rx="45" ry="20" fill="#6b7280"/>
      <ellipse cx="100" cy="20" rx="40" ry="15" fill="#9ca3af"/>
      <ellipse cx="100" cy="18" rx="30" ry="10" fill="#d1d5db"/>
      {/* Dome cap */}
      <circle cx="100" cy="10" r="8" fill="#4b5563"/>
      {/* Ladder */}
      <rect x="138" y="30" width="5" height="90" rx="2" fill="#6b7280"/>
      <rect x="145" y="30" width="5" height="90" rx="2" fill="#6b7280"/>
      {[40, 55, 70, 85, 100, 115].map(y => (
        <rect key={y} x="138" y={y} width="12" height="3" rx="1.5" fill="#9ca3af"/>
      ))}
      {/* Base */}
      <rect x="50" y="120" width="100" height="10" rx="4" fill="#9ca3af"/>
      {/* Small building/conveyor */}
      {level >= 2 && (
        <>
          <rect x="20" y="85" width="38" height="40" rx="3" fill="#d97706"/>
          <polygon points="39,62 12,85 66,85" fill="#92400e"/>
          <rect x="32" y="105" width="14" height="20" rx="2" fill="#7c3412"/>
          {/* Conveyor */}
          <rect x="55" y="98" width="20" height="6" rx="3" fill="#4b5563" transform="rotate(-20 55 98)"/>
        </>
      )}
      {level === 3 && (
        <>
          <rect x="142" y="75" width="40" height="50" rx="3" fill="#d97706"/>
          <polygon points="162,55 142,75 182,75" fill="#92400e"/>
          {/* Pipe connecting silos */}
          <rect x="144" y="85" width="6" height="30" rx="3" fill="#6b7280" opacity="0.7"/>
        </>
      )}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill="#9ca3af" opacity="0.8"/>
    </svg>
  );
}

// ── IRRIGATION ───────────────────────────────────────────────────────────────
export function IrrigationSVG({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="150" fill="#cffafe" rx="6"/>
      {/* Irrigated green plots */}
      <rect x="8" y="60" width="88" height="78" rx="4" fill="#4ade80" opacity="0.7"/>
      <rect x="104" y="60" width="88" height="78" rx="4" fill="#4ade80" opacity="0.7"/>
      {/* Crop rows on plots */}
      {Array.from({ length: 4 }).map((_, r) => (
        <g key={r}>
          {Array.from({ length: 5 }).map((_, c) => (
            <g key={c}>
              <ellipse cx={20 + c * 18} cy={75 + r * 16} rx="5" ry="7" fill="#16a34a"/>
              <ellipse cx={116 + c * 18} cy={75 + r * 16} rx="5" ry="7" fill="#16a34a"/>
            </g>
          ))}
        </g>
      ))}
      {/* Central water channel */}
      <rect x="90" y="15" width="20" height="130" rx="5" fill="#38bdf8"/>
      <rect x="91" y="15" width="10" height="130" fill="#7dd3fc" opacity="0.5"/>
      {/* Sprinkler arm (main pivot) */}
      <rect x="12" y="34" width="176" height="12" rx="6" fill="#64748b"/>
      {/* Sprinkler pivot center */}
      <circle cx="100" cy="40" r="16" fill="#475569"/>
      <circle cx="100" cy="40" r="10" fill="#64748b"/>
      {/* Water droplets */}
      {level >= 1 && Array.from({ length: 8 }).map((_, i) => {
        const x = 20 + i * 22;
        const y = 46 + (i % 2) * 8;
        return <ellipse key={i} cx={x} cy={y} rx="2.5" ry="4" fill="#38bdf8" opacity="0.8"/>;
      })}
      {level >= 2 && Array.from({ length: 8 }).map((_, i) => {
        const x = 20 + i * 22;
        const y = 56 + (i % 2) * 8;
        return <ellipse key={i + 8} cx={x} cy={y} rx="2" ry="3.5" fill="#7dd3fc" opacity="0.6"/>;
      })}
      {/* Support poles */}
      {[30, 75, 125, 170].map(x => (
        <rect key={x} x={x} y="40" width="4" height="55" rx="2" fill="#475569" opacity="0.7"/>
      ))}
      {/* Pump house */}
      {level >= 2 && (
        <rect x="86" y="115" width="28" height="22" rx="4" fill="#475569"/>
      )}
      <rect x="8" y="138" width={(level / 3) * 184} height="6" rx="3" fill="#38bdf8" opacity="0.8"/>
    </svg>
  );
}

// ── Main selector ─────────────────────────────────────────────────────────────
export function BuildingSVG({ buildingId, level }: { buildingId: string; level: number }) {
  if (level === 0) return null;
  switch (buildingId) {
    case "wheat_field":      return <WheatFieldSVG level={level}/>;
    case "vegetable_patch":  return <VegetablePatchSVG level={level}/>;
    case "apple_orchard":    return <AppleOrchardSVG level={level}/>;
    case "greenhouse":       return <GreenhouseSVG level={level}/>;
    case "chicken_coop":     return <ChickenCoopSVG level={level}/>;
    case "dairy_cows":       return <DairyCowsSVG level={level}/>;
    case "farmhouse":        return <FarmhouseSVG level={level}/>;
    case "windmill":         return <WindmillSVG level={level}/>;
    case "barn":             return <BarnSVG level={level}/>;
    case "tractor":          return <TractorSVG level={level}/>;
    case "silo":             return <GrainSiloSVG level={level}/>;
    case "irrigation":       return <IrrigationSVG level={level}/>;
    default:                 return null;
  }
}

// Decorative tree
export function TreeSVG({ scale = 1 }: { scale?: number }) {
  return (
    <svg viewBox="0 0 60 80" width={60 * scale} height={80 * scale} xmlns="http://www.w3.org/2000/svg">
      <rect x="22" y="52" width="16" height="28" rx="4" fill="#92400e"/>
      <circle cx="30" cy="45" r="28" fill="#166534"/>
      <circle cx="30" cy="38" r="22" fill="#15803d"/>
      <circle cx="20" cy="35" r="16" fill="#16a34a"/>
      <circle cx="40" cy="35" r="16" fill="#16a34a"/>
      <circle cx="30" cy="26" r="14" fill="#4ade80"/>
    </svg>
  );
}
