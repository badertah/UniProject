import { useId } from "react";

function useSvgId(base: string) {
  const id = useId();
  return (name: string) => `${base}-${name}-${id.replace(/:/g, "")}`;
}

export function LockedFieldSVG({ cost }: { cost: number }) {
  const sid = useSvgId("lock");
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("soil")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B7355"/>
          <stop offset="100%" stopColor="#6B5B45"/>
        </linearGradient>
        <filter id={sid("shadow")}>
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4"/>
        </filter>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("soil")})`} rx="8"/>
      <rect x="4" y="4" width="192" height="142" rx="6" fill="none" stroke="#5a4a3a" strokeWidth="2" strokeDasharray="8 4" opacity="0.6"/>
      {Array.from({ length: 5 }).map((_, i) => (
        <rect key={i} x="12" y={15 + i * 24} width="176" height="16" rx="4" fill="#7a6a55" opacity="0.3"/>
      ))}
      <g filter={`url(#${sid("shadow")})`}>
        <rect x="72" y="48" width="56" height="42" rx="8" fill="#3d3428"/>
        <path d="M85 48 Q85 30 100 30 Q115 30 115 48" fill="none" stroke="#3d3428" strokeWidth="8" strokeLinecap="round"/>
        <circle cx="100" cy="65" r="6" fill="#8B7355"/>
        <rect x="97" y="67" width="6" height="10" rx="2" fill="#8B7355"/>
      </g>
      <rect x="35" y="106" width="130" height="32" rx="16" fill="#2d2418" opacity="0.85"/>
      <text x="100" y="127" textAnchor="middle" fill="#fbbf24" fontSize="14" fontWeight="800" fontFamily="ui-sans-serif,system-ui,sans-serif">
        🪙 {cost} coins
      </text>
    </svg>
  );
}

export function WheatFieldSVG({ level }: { level: number }) {
  const sid = useSvgId("wheat");
  const density = level === 1 ? 12 : level === 2 ? 20 : 30;
  const cols = level === 1 ? 6 : level === 2 ? 8 : 10;
  const rows = Math.ceil(density / cols);
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("soil")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B6914"/>
          <stop offset="60%" stopColor="#6B4F10"/>
          <stop offset="100%" stopColor="#5a3e0d"/>
        </linearGradient>
        <linearGradient id={sid("grain")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={level === 3 ? "#FFD700" : level === 2 ? "#F5B800" : "#D4A017"}/>
          <stop offset="100%" stopColor={level === 3 ? "#F5B800" : level === 2 ? "#C49000" : "#A67C00"}/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("soil")})`} rx="8"/>
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x="6" y={8 + i * 22} width="188" height="14" rx="5" fill="#5a3e0d" opacity="0.4"/>
      ))}
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          if (r * cols + c >= density) return null;
          const x = 14 + c * (172 / (cols - 1));
          const baseY = 18 + r * (110 / rows);
          const sway = Math.sin((c + r) * 0.8) * 3;
          return (
            <g key={`${r}-${c}`}>
              <line x1={x} y1={baseY + 28} x2={x + sway * 0.3} y2={baseY + 8} stroke="#7a6420" strokeWidth="2" strokeLinecap="round"/>
              <line x1={x + sway * 0.3} y1={baseY + 12} x2={x + sway * 0.3 - 5} y2={baseY + 5} stroke="#8a7430" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1={x + sway * 0.3} y1={baseY + 12} x2={x + sway * 0.3 + 5} y2={baseY + 5} stroke="#8a7430" strokeWidth="1.2" strokeLinecap="round"/>
              <ellipse cx={x + sway * 0.5} cy={baseY + 2} rx="4.5" ry="9" fill={`url(#${sid("grain")})`}/>
              <line x1={x + sway * 0.5 - 3} y1={baseY + 2} x2={x + sway * 0.5 + 3} y2={baseY + 2} stroke="#c4a417" strokeWidth="0.5" opacity="0.6"/>
              <line x1={x + sway * 0.5 - 2.5} y1={baseY - 1} x2={x + sway * 0.5 + 2.5} y2={baseY - 1} stroke="#c4a417" strokeWidth="0.5" opacity="0.6"/>
              <line x1={x + sway * 0.5 - 2} y1={baseY + 5} x2={x + sway * 0.5 + 2} y2={baseY + 5} stroke="#c4a417" strokeWidth="0.5" opacity="0.6"/>
              {level === 3 && <ellipse cx={x + sway * 0.5} cy={baseY - 2} rx="2" ry="3" fill="#FFE066" opacity="0.6"/>}
            </g>
          );
        })
      )}
      {level >= 2 && (
        <g opacity="0.5">
          {[30, 90, 150].map((bx, i) => (
            <g key={i}>
              <ellipse cx={bx} cy={132} rx={14} ry={9} fill="#C8A84E"/>
              <ellipse cx={bx} cy={129} rx={12} ry={7} fill="#D4B85E"/>
              <line x1={bx - 8} y1={129} x2={bx + 8} y2={129} stroke="#B89A3E" strokeWidth="0.8"/>
              <line x1={bx - 6} y1={131} x2={bx + 6} y2={131} stroke="#B89A3E" strokeWidth="0.8"/>
            </g>
          ))}
        </g>
      )}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#FFD700" opacity="0.8"/>
    </svg>
  );
}

export function VegetablePatchSVG({ level }: { level: number }) {
  const sid = useSvgId("veg");
  const rows = level === 1 ? 3 : level === 2 ? 4 : 5;
  const cols = level === 1 ? 4 : level === 2 ? 5 : 6;
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("soil")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5C3D1F"/>
          <stop offset="100%" stopColor="#3E2915"/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("soil")})`} rx="8"/>
      {Array.from({ length: rows + 1 }).map((_, i) => (
        <rect key={i} x="8" y={6 + i * (130 / (rows + 1))} width="184" height={120 / (rows + 1) - 2} rx="4" fill="#4a2e15" opacity="0.5"/>
      ))}
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const x = 22 + c * (156 / (cols - 1));
          const y = 20 + r * (105 / (rows - 0.3));
          const vegType = (r + c) % 3;
          return (
            <g key={`${r}-${c}`}>
              {vegType === 0 && (
                <>
                  <polygon points={`${x},${y + 6} ${x + 6},${y - 12} ${x - 6},${y - 12}`} fill="#E8730C"/>
                  <polygon points={`${x},${y + 4} ${x + 4},${y - 8} ${x - 4},${y - 8}`} fill="#F59E42" opacity="0.4"/>
                  {[0, -4, 4].map((dx, i) => (
                    <line key={i} x1={x} y1={y - 12} x2={x + dx} y2={y - 20 - Math.abs(dx)} stroke="#22A34A" strokeWidth="2.2" strokeLinecap="round"/>
                  ))}
                  <ellipse cx={x} cy={y - 20} rx="6" ry="3" fill="#16A34A" opacity="0.6"/>
                </>
              )}
              {vegType === 1 && (
                <>
                  <circle cx={x} cy={y - 2} r="8" fill="#DC2626"/>
                  <circle cx={x - 2} cy={y - 5} r="3" fill="#EF4444" opacity="0.5"/>
                  <rect x={x - 1} y={y - 14} width="2" height="8" fill="#16A34A"/>
                  <ellipse cx={x - 3} cy={y - 12} rx="4" ry="3" fill="#22C55E"/>
                  <ellipse cx={x + 3} cy={y - 13} rx="4" ry="2.5" fill="#22C55E"/>
                </>
              )}
              {vegType === 2 && (
                <>
                  <ellipse cx={x} cy={y} rx="7" ry="5" fill="#7C3AED"/>
                  <ellipse cx={x} cy={y - 2} rx="5" ry="3" fill="#8B5CF6" opacity="0.4"/>
                  <line x1={x} y1={y - 5} x2={x} y2={y - 14} stroke="#16A34A" strokeWidth="2" strokeLinecap="round"/>
                  {[-5, 0, 5].map((dx, i) => (
                    <ellipse key={i} cx={x + dx} cy={y - 14} rx="4" ry="3" fill="#4ADE80"/>
                  ))}
                </>
              )}
            </g>
          );
        })
      )}
      {level === 3 && (
        <g opacity="0.6">
          <rect x="8" y="128" width="30" height="16" rx="3" fill="#8B5E3C"/>
          <rect x="9" y="129" width="28" height="6" rx="2" fill="#A0704B"/>
          {[0, 1, 2].map(i => (
            <circle key={i} cx={16 + i * 8} cy={134} r="2.5" fill="#EF4444"/>
          ))}
        </g>
      )}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#F97316" opacity="0.8"/>
    </svg>
  );
}

export function AppleOrchardSVG({ level }: { level: number }) {
  const sid = useSvgId("orchard");
  const numTrees = level === 1 ? 2 : level === 2 ? 3 : 4;
  const treeX = numTrees === 2 ? [60, 140] : numTrees === 3 ? [40, 100, 160] : [30, 72, 128, 170];
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("grass")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5EAD3E"/>
          <stop offset="70%" stopColor="#4A9030"/>
          <stop offset="100%" stopColor="#3D7828"/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("grass")})`} rx="8"/>
      <rect x="0" y="108" width="200" height="42" rx="0" fill="#3D7828" opacity="0.5"/>
      {[15, 45, 85, 115, 155, 185].map((gx, i) => (
        <ellipse key={i} cx={gx} cy={110 + (i % 2) * 10} rx="14" ry="6" fill="#4A9030" opacity="0.4"/>
      ))}
      {treeX.map((tx, i) => (
        <g key={i}>
          <ellipse cx={tx} cy={118} rx={18} ry={5} fill="rgba(0,0,0,0.15)"/>
          <rect x={tx - 6} y={88} width="12" height="28" rx="4" fill="#6B3A1F"/>
          <rect x={tx - 4} y={92} width="4" height="20" rx="2" fill="#8B5A3F" opacity="0.4"/>
          <line x1={tx - 2} y1={82} x2={tx - 14} y2={72} stroke="#6B3A1F" strokeWidth="4" strokeLinecap="round"/>
          <line x1={tx + 2} y1={80} x2={tx + 12} y2={68} stroke="#6B3A1F" strokeWidth="3.5" strokeLinecap="round"/>
          <circle cx={tx} cy={62} r="30" fill="#0F7B33"/>
          <circle cx={tx - 8} cy={55} r="20" fill="#1B9E45"/>
          <circle cx={tx + 10} cy={54} r="18" fill="#16A34A"/>
          <circle cx={tx} cy={48} r="15" fill="#22C55E"/>
          <circle cx={tx - 6} cy={44} r="10" fill="#4ADE80" opacity="0.5"/>
          {level >= 1 && (
            <>
              <circle cx={tx - 12} cy={56} r="5" fill="#DC2626"/>
              <circle cx={tx - 13} cy={54} r="2" fill="#EF4444" opacity="0.6"/>
              <circle cx={tx + 10} cy={50} r="5" fill="#DC2626"/>
              <circle cx={tx + 9} cy={48} r="2" fill="#EF4444" opacity="0.6"/>
              <circle cx={tx + 2} cy={66} r="4.5" fill="#B91C1C"/>
            </>
          )}
          {level >= 2 && (
            <>
              <circle cx={tx - 6} cy={42} r="4.5" fill="#DC2626"/>
              <circle cx={tx + 16} cy={60} r="4" fill="#EF4444"/>
              <circle cx={tx - 18} cy={64} r="3.5" fill="#DC2626"/>
            </>
          )}
          {level === 3 && (
            <>
              <circle cx={tx + 4} cy={38} r="4" fill="#EF4444"/>
              <circle cx={tx - 14} cy={48} r="3.5" fill="#F87171"/>
              <circle cx={tx + 18} cy={68} r="3" fill="#DC2626"/>
              <circle cx={tx + 5} cy={74} r="4" fill="#B91C1C"/>
            </>
          )}
        </g>
      ))}
      {level === 3 && (
        <g>
          <rect x="4" y="122" width="22" height="18" rx="3" fill="#8B5E3C"/>
          {[0, 1, 2].map(i => (
            <circle key={i} cx={10 + i * 5} cy={128} r="3" fill="#DC2626"/>
          ))}
        </g>
      )}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#EF4444" opacity="0.8"/>
    </svg>
  );
}

export function GreenhouseSVG({ level }: { level: number }) {
  const sid = useSvgId("gh");
  const plantCount = level === 1 ? 5 : level === 2 ? 7 : 9;
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("ground")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8D86A"/>
          <stop offset="100%" stopColor="#7CB342"/>
        </linearGradient>
        <linearGradient id={sid("glass")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E0F7FA" stopOpacity="0.7"/>
          <stop offset="50%" stopColor="#B2EBF2" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#80DEEA" stopOpacity="0.3"/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("ground")})`} rx="8"/>
      <rect x="10" y="92" width="180" height="50" rx="4" fill="#5D4037"/>
      <rect x="12" y="94" width="176" height="46" rx="3" fill="#6D4C41" opacity="0.6"/>
      <rect x="14" y="48" width="172" height="48" fill={`url(#${sid("glass")})`} stroke="#4FC3F7" strokeWidth="1.5" rx="2"/>
      <polygon points="100,8 14,48 186,48" fill={`url(#${sid("glass")})`} stroke="#4FC3F7" strokeWidth="1.5"/>
      {[46, 70, 100, 130, 160].map(x => (
        <line key={x} x1={x} y1="48" x2={x} y2="96" stroke="#4FC3F7" strokeWidth="1.2" opacity="0.5"/>
      ))}
      <line x1="14" y1="72" x2="186" y2="72" stroke="#4FC3F7" strokeWidth="1.2" opacity="0.5"/>
      <line x1="100" y1="8" x2="100" y2="48" stroke="#4FC3F7" strokeWidth="2" opacity="0.6"/>
      <polygon points="100,8 14,48 186,48" fill="none" stroke="#29B6F6" strokeWidth="2"/>
      <rect x="14" y="48" width="172" height="48" fill="none" stroke="#29B6F6" strokeWidth="2" rx="2"/>
      {Array.from({ length: plantCount }).map((_, i) => {
        const px = 24 + i * (152 / (plantCount - 1));
        const plantH = 14 + level * 8;
        return (
          <g key={i}>
            <rect x={px - 5} y={130 - 6} width="10" height="12" rx="2" fill="#5D4037"/>
            <rect x={px - 4} y={131 - 6} width="8" height="3" rx="1" fill="#795548" opacity="0.6"/>
            <rect x={px - 1.5} y={130 - 6 - plantH} width="3" height={plantH} fill="#66BB6A"/>
            <ellipse cx={px} cy={130 - 6 - plantH} rx="10" ry="10" fill="#4CAF50"/>
            <ellipse cx={px - 5} cy={130 - 2 - plantH} rx="7" ry="6" fill="#66BB6A" opacity="0.7"/>
            <ellipse cx={px + 5} cy={130 - 2 - plantH} rx="7" ry="6" fill="#66BB6A" opacity="0.7"/>
            {level >= 2 && <circle cx={px + 4} cy={130 - plantH + 2} r="3" fill="#FF7043"/>}
            {level === 3 && (
              <>
                <circle cx={px - 5} cy={130 - plantH + 4} r="2.5" fill="#FFA726"/>
                <circle cx={px} cy={130 - plantH - 4} r="2" fill="#EF5350"/>
              </>
            )}
          </g>
        );
      })}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#66BB6A" opacity="0.8"/>
    </svg>
  );
}

export function ChickenCoopSVG({ level }: { level: number }) {
  const sid = useSvgId("coop");
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("ground")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5E6C8"/>
          <stop offset="100%" stopColor="#DCC8A0"/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("ground")})`} rx="8"/>
      <rect x="6" y="110" width="188" height="35" rx="4" fill="#D4B896" opacity="0.6"/>
      {[10, 32, 54, 76, 98, 120, 142, 164, 184].map(x => (
        <rect key={x} x={x} y="105" width="6" height="28" rx="2" fill="#8B6914"/>
      ))}
      <rect x="10" y="112" width="180" height="5" rx="2" fill="#A67C00"/>
      <rect x="10" y="122" width="180" height="5" rx="2" fill="#A67C00"/>
      <rect x="30" y="48" width="140" height="60" rx="5" fill="#D4850A"/>
      <rect x="32" y="50" width="66" height="56" rx="3" fill="#C47808" opacity="0.3"/>
      <polygon points="100,10 18,48 182,48" fill="#6B3A1F"/>
      <polygon points="100,10 100,48 18,48" fill="#5A2E15" opacity="0.4"/>
      <line x1="18" y1="48" x2="182" y2="48" stroke="#8B5A3F" strokeWidth="3"/>
      <rect x="76" y="80" width="48" height="28" rx="5" fill="#3D2415"/>
      <rect x="78" y="82" width="44" height="24" rx="4" fill="#4A2E1A"/>
      <circle cx="84" cy="94" r="3.5" fill="#D4A017"/>
      <rect x="38" y="58" width="32" height="28" rx="4" fill="#FFF8DC"/>
      <line x1="54" y1="58" x2="54" y2="86" stroke="#D4850A" strokeWidth="2.5"/>
      <line x1="38" y1="72" x2="70" y2="72" stroke="#D4850A" strokeWidth="2.5"/>
      <rect x="130" y="58" width="32" height="28" rx="4" fill="#FFF8DC"/>
      <line x1="146" y1="58" x2="146" y2="86" stroke="#D4850A" strokeWidth="2.5"/>
      <line x1="130" y1="72" x2="162" y2="72" stroke="#D4850A" strokeWidth="2.5"/>
      {level >= 1 && (
        <g transform="translate(28 118)">
          <ellipse cx="0" cy="0" rx="9" ry="7" fill="#FAFAFA"/>
          <circle cx="8" cy="-5" r="6" fill="#FAFAFA"/>
          <polygon points="12,-4 17,-6 12,-8" fill="#E8730C"/>
          <circle cx="10" cy="-6.5" r="1.8" fill="#1a1a1a"/>
          <circle cx="10.5" cy="-7" r="0.6" fill="white"/>
          <polygon points="7,-12 5,-17 9,-17" fill="#DC2626"/>
          <ellipse cx="-6" cy="5" rx="3" ry="1.5" fill="#E8730C"/>
          <ellipse cx="2" cy="5" rx="3" ry="1.5" fill="#E8730C"/>
        </g>
      )}
      {level >= 2 && (
        <>
          <g transform="translate(60 120)">
            <ellipse cx="0" cy="0" rx="8" ry="6" fill="#FFF5E0"/>
            <circle cx="7" cy="-4" r="5.5" fill="#FFF5E0"/>
            <polygon points="11,-3.5 15,-5.5 11,-7.5" fill="#E8730C"/>
            <circle cx="9" cy="-6" r="1.6" fill="#1a1a1a"/>
            <polygon points="6,-10 4,-15 8,-15" fill="#DC2626"/>
          </g>
          <ellipse cx="45" cy="130" rx="5" ry="4" fill="#FFF8DC"/>
          <ellipse cx="45" cy="130" rx="3.5" ry="2.5" fill="#FFFBE6"/>
        </>
      )}
      {level === 3 && (
        <>
          <g transform="translate(148 118)">
            <ellipse cx="0" cy="0" rx="9" ry="7" fill="#FAFAFA"/>
            <circle cx="8" cy="-5" r="6" fill="#FAFAFA"/>
            <polygon points="12,-4 17,-6 12,-8" fill="#E8730C"/>
            <circle cx="10" cy="-6.5" r="1.8" fill="#1a1a1a"/>
            <circle cx="10.5" cy="-7" r="0.6" fill="white"/>
          </g>
          <g transform="translate(172 120)">
            <ellipse cx="0" cy="0" rx="7" ry="5.5" fill="#DDD"/>
            <circle cx="6" cy="-4" r="5" fill="#DDD"/>
            <polygon points="10,-3 14,-5 10,-7" fill="#E8730C"/>
            <circle cx="8" cy="-5.5" r="1.5" fill="#1a1a1a"/>
          </g>
          <ellipse cx="140" cy="132" rx="4.5" ry="3.5" fill="#FFF8DC"/>
          <ellipse cx="155" cy="130" rx="4" ry="3" fill="#FFF8DC"/>
        </>
      )}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#FFB300" opacity="0.8"/>
    </svg>
  );
}

export function DairyCowsSVG({ level }: { level: number }) {
  const sid = useSvgId("cow");
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("field")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7CB342"/>
          <stop offset="60%" stopColor="#558B2F"/>
          <stop offset="100%" stopColor="#4A7A25"/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("field")})`} rx="8"/>
      {[12, 50, 95, 140, 180].map((gx, i) => (
        <ellipse key={i} cx={gx} cy={128 + (i % 2) * 4} rx="16" ry="5" fill="#4A7A25" opacity="0.5"/>
      ))}
      {[10, 45, 80, 115, 150, 182].map(x => (
        <g key={x}>
          <rect x={x} y="88" width="8" height="32" rx="2.5" fill="#6B3A1F"/>
          <rect x={x - 2} y="90" width="12" height="5" rx="1.5" fill="#8B5A3F"/>
        </g>
      ))}
      <rect x="10" y="97" width="180" height="5" rx="2" fill="#8B5A3F"/>
      <rect x="10" y="110" width="180" height="5" rx="2" fill="#8B5A3F"/>
      <g transform="translate(55 64)">
        <ellipse cx="0" cy="8" rx="8" ry="4" fill="rgba(0,0,0,0.1)"/>
        <ellipse cx="0" cy="0" rx="28" ry="16" fill="#FAFAFA"/>
        <ellipse cx="-10" cy="-3" rx="13" ry="9" fill="#2D2D2D"/>
        <ellipse cx="12" cy="4" rx="9" ry="7" fill="#2D2D2D"/>
        <rect x="-24" y="10" width="7" height="18" rx="3" fill="#FAFAFA"/>
        <rect x="-12" y="10" width="7" height="18" rx="3" fill="#FAFAFA"/>
        <rect x="6" y="10" width="7" height="18" rx="3" fill="#FAFAFA"/>
        <rect x="18" y="10" width="7" height="18" rx="3" fill="#FAFAFA"/>
        <circle cx="28" cy="-6" r="12" fill="#FAFAFA"/>
        <ellipse cx="34" cy="-2" rx="7" ry="5" fill="#FFB4B4"/>
        <circle cx="26" cy="-10" r="3.5" fill="#2D2D2D"/>
        <circle cx="26.8" cy="-10.8" r="1.2" fill="white"/>
        <line x1="22" y1="-18" x2="18" y2="-26" stroke="#8B7355" strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="30" y1="-18" x2="34" y2="-26" stroke="#8B7355" strokeWidth="3.5" strokeLinecap="round"/>
        <ellipse cx="0" cy="20" rx="10" ry="5" fill="#FFB4B4"/>
        <path d="M-26 -2 Q-38 -4 -35 14" fill="none" stroke="#BDBDBD" strokeWidth="3" strokeLinecap="round"/>
        <ellipse cx="-36" cy="16" rx="3" ry="4" fill="#BDBDBD"/>
      </g>
      {level >= 2 && (
        <g transform="translate(145 72) scale(0.72)">
          <ellipse cx="0" cy="0" rx="28" ry="16" fill="#FAFAFA"/>
          <ellipse cx="-6" cy="-2" rx="15" ry="10" fill="#8B6914" opacity="0.7"/>
          <ellipse cx="14" cy="5" rx="8" ry="6" fill="#8B6914" opacity="0.5"/>
          <rect x="-24" y="10" width="7" height="18" rx="3" fill="#FAFAFA"/>
          <rect x="-12" y="10" width="7" height="18" rx="3" fill="#FAFAFA"/>
          <rect x="6" y="10" width="7" height="18" rx="3" fill="#FAFAFA"/>
          <rect x="18" y="10" width="7" height="18" rx="3" fill="#FAFAFA"/>
          <circle cx="28" cy="-6" r="12" fill="#FAFAFA"/>
          <ellipse cx="34" cy="-2" rx="7" ry="5" fill="#FFB4B4"/>
          <circle cx="26" cy="-10" r="3.5" fill="#2D2D2D"/>
          <circle cx="26.8" cy="-10.8" r="1.2" fill="white"/>
          <ellipse cx="0" cy="20" rx="10" ry="5" fill="#FFB4B4"/>
        </g>
      )}
      {level === 3 && (
        <g transform="translate(115 106)">
          <rect x="-9" y="-14" width="18" height="18" rx="3" fill="#E0E0E0"/>
          <rect x="-8" y="-14" width="16" height="5" rx="2" fill="#BDBDBD"/>
          <ellipse cx="0" cy="-6" rx="6" ry="3" fill="#E3F2FD"/>
          <path d="M-8,-16 Q-5,-22 0,-20 Q5,-22 8,-16" fill="none" stroke="#9E9E9E" strokeWidth="2.5" strokeLinecap="round"/>
        </g>
      )}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#7CB342" opacity="0.8"/>
    </svg>
  );
}

export function FarmhouseSVG({ level }: { level: number }) {
  const sid = useSvgId("house");
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("ground")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A5D6A7"/>
          <stop offset="100%" stopColor="#81C784"/>
        </linearGradient>
        <linearGradient id={sid("wall")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF8E1"/>
          <stop offset="100%" stopColor="#F5F0DC"/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("ground")})`} rx="8"/>
      <rect x="82" y="100" width="36" height="42" rx="4" fill="#BCAAA4"/>
      <rect x="85" y="103" width="30" height="38" fill="#D7CCC8" opacity="0.4"/>
      {level >= 2 && [22, 38, 156, 172].map(fx => (
        <g key={fx}>
          <line x1={fx} y1="120" x2={fx} y2="136" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round"/>
          <circle cx={fx} cy="116" r="5" fill="#E91E63" opacity="0.8"/>
          <circle cx={fx - 3} cy="112" r="3.5" fill="#F06292"/>
          <circle cx={fx + 3} cy="112" r="3.5" fill="#EC407A"/>
          <circle cx={fx} cy="109" r="3" fill="#F48FB1"/>
        </g>
      ))}
      <rect x="18" y="62" width="164" height="80" rx="4" fill={`url(#${sid("wall")})`}/>
      <rect x="18" y="62" width="164" height="10" fill="#E8E0CC"/>
      <rect x="148" y="22" width="20" height="38" rx="3" fill="#9E9E9E"/>
      <rect x="146" y="18" width="24" height="10" rx="3" fill="#757575"/>
      {level >= 2 && (
        <>
          <ellipse cx="158" cy="14" rx="6" ry="8" fill="#E0E0E0" opacity="0.6"/>
          <ellipse cx="164" cy="8" rx="5" ry="6" fill="#E0E0E0" opacity="0.4"/>
          {level === 3 && <ellipse cx="160" cy="2" rx="4" ry="5" fill="#E0E0E0" opacity="0.3"/>}
        </>
      )}
      <polygon points="100,8 8,62 192,62" fill="#C62828"/>
      <polygon points="100,8 100,62 8,62" fill="#B71C1C" opacity="0.3"/>
      <line x1="8" y1="62" x2="192" y2="62" stroke="#8E1616" strokeWidth="3"/>
      <rect x="78" y="96" width="44" height="46" rx="6" fill="#5D4037"/>
      <rect x="80" y="98" width="40" height="34" rx="5" fill="#4E342E"/>
      <path d="M78 96 Q100 85 122 96" fill="#4E342E"/>
      <circle cx="118" cy="116" r="4" fill="#FFD54F"/>
      <rect x="28" y="74" width="42" height="36" rx="4" fill="#BBDEFB"/>
      <line x1="49" y1="74" x2="49" y2="110" stroke="#FAFAFA" strokeWidth="2.5"/>
      <line x1="28" y1="92" x2="70" y2="92" stroke="#FAFAFA" strokeWidth="2.5"/>
      <rect x="130" y="74" width="42" height="36" rx="4" fill="#BBDEFB"/>
      <line x1="151" y1="74" x2="151" y2="110" stroke="#FAFAFA" strokeWidth="2.5"/>
      <line x1="130" y1="92" x2="172" y2="92" stroke="#FAFAFA" strokeWidth="2.5"/>
      {level === 3 && (
        <>
          <rect x="8" y="130" width="16" height="12" rx="2" fill="#8D6E63"/>
          <rect x="10" y="126" width="12" height="6" rx="2" fill="#A1887F"/>
          <circle cx="16" cy="130" r="1.5" fill="#FFCC80"/>
        </>
      )}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#C62828" opacity="0.8"/>
    </svg>
  );
}

export function WindmillSVG({ level }: { level: number }) {
  const sid = useSvgId("mill");
  const bladeAngle = level * 30;
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("sky")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#64B5F6"/>
          <stop offset="60%" stopColor="#90CAF9"/>
          <stop offset="100%" stopColor="#66BB6A"/>
        </linearGradient>
        <linearGradient id={sid("tower")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#E0E0E0"/>
          <stop offset="40%" stopColor="#F5F5F5"/>
          <stop offset="100%" stopColor="#BDBDBD"/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("sky")})`} rx="8"/>
      <rect x="0" y="112" width="200" height="38" fill="#4CAF50" rx="0"/>
      <ellipse cx="40" cy="115" rx="20" ry="6" fill="#43A047" opacity="0.5"/>
      <ellipse cx="160" cy="118" rx="25" ry="5" fill="#43A047" opacity="0.5"/>
      <ellipse cx="100" cy="120" rx="22" ry="4" fill="rgba(0,0,0,0.1)"/>
      <polygon points="78,118 90,26 110,26 122,118" fill={`url(#${sid("tower")})`}/>
      <polygon points="78,118 90,26 100,26 100,118" fill="#E8E8E8" opacity="0.5"/>
      {[44, 58, 72, 86, 100].map(y => (
        <line key={y} x1={80 + (118 - y) * 0.2} y1={y} x2={120 - (118 - y) * 0.2} y2={y} stroke="#BDBDBD" strokeWidth="1.5" opacity="0.5"/>
      ))}
      <polygon points="83,26 100,6 117,26" fill="#1565C0"/>
      <polygon points="83,26 100,6 100,26" fill="#1976D2" opacity="0.4"/>
      <circle cx="100" cy="28" r="9" fill="#37474F"/>
      <circle cx="100" cy="28" r="5" fill="#546E7A"/>
      <circle cx="100" cy="28" r="2.5" fill="#78909C"/>
      {[0, 90, 180, 270].map(angle => {
        const rad = ((angle + bladeAngle) * Math.PI) / 180;
        const tipX = 100 + Math.sin(rad) * 42;
        const tipY = 28 - Math.cos(rad) * 42;
        const innerX = 100 + Math.sin(rad) * 12;
        const innerY = 28 - Math.cos(rad) * 12;
        const perp = ((angle + bladeAngle + 90) * Math.PI) / 180;
        const w = 10;
        const x1 = innerX + Math.sin(perp) * w;
        const y1 = innerY - Math.cos(perp) * w;
        const x2 = innerX - Math.sin(perp) * w;
        const y2 = innerY + Math.cos(perp) * w;
        return (
          <g key={angle}>
            <polygon points={`${x1},${y1} ${tipX},${tipY} ${x2},${y2}`} fill="#1565C0" opacity="0.85"/>
            <line x1={(x1 + tipX) / 2} y1={(y1 + tipY) / 2} x2={(x2 + tipX) / 2} y2={(y2 + tipY) / 2} stroke="#0D47A1" strokeWidth="1" opacity="0.3"/>
          </g>
        );
      })}
      <rect x="90" y="98" width="20" height="20" rx="10" fill="#5D4037"/>
      <rect x="92" y="100" width="16" height="16" rx="8" fill="#4E342E"/>
      {level >= 2 && (
        <>
          <g>
            <rect x="22" y="108" width="10" height="14" rx="3" fill="#5D4037"/>
            <circle cx="27" cy="102" r="14" fill="#2E7D32"/>
            <circle cx="27" cy="96" r="10" fill="#388E3C"/>
            <circle cx="22" cy="94" r="7" fill="#43A047"/>
          </g>
          <g>
            <rect x="164" y="106" width="10" height="14" rx="3" fill="#5D4037"/>
            <circle cx="169" cy="100" r="12" fill="#1B5E20"/>
            <circle cx="169" cy="95" r="8" fill="#2E7D32"/>
          </g>
        </>
      )}
      {level === 3 && (
        <g>
          <rect x="146" y="108" width="8" height="12" rx="2" fill="#5D4037"/>
          <circle cx="150" cy="102" r="10" fill="#2E7D32"/>
          <circle cx="150" cy="97" r="7" fill="#388E3C"/>
        </g>
      )}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#1565C0" opacity="0.8"/>
    </svg>
  );
}

export function BarnSVG({ level }: { level: number }) {
  const sid = useSvgId("barn");
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("ground")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5E6C8"/>
          <stop offset="100%" stopColor="#DCC8A0"/>
        </linearGradient>
        <linearGradient id={sid("wall")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C62828"/>
          <stop offset="40%" stopColor="#E53935"/>
          <stop offset="100%" stopColor="#B71C1C"/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("ground")})`} rx="8"/>
      <rect x="0" y="112" width="200" height="38" fill="#BCAAA4" opacity="0.5"/>
      <rect x="16" y="52" width="168" height="72" rx="4" fill={`url(#${sid("wall")})`}/>
      <polygon points="100,4 6,52 194,52" fill="#4E342E"/>
      <polygon points="100,4 100,52 6,52" fill="#3E2723" opacity="0.35"/>
      <polygon points="100,4 88,28 112,28" fill="#E53935"/>
      <line x1="6" y1="52" x2="194" y2="52" stroke="#FFCDD2" strokeWidth="4"/>
      <rect x="16" y="50" width="168" height="8" fill="#FFCDD2" opacity="0.35"/>
      <rect x="28" y="78" width="64" height="46" rx="4" fill="#3E2723"/>
      <rect x="30" y="80" width="29" height="42" rx="2" fill="#4E342E"/>
      <rect x="61" y="80" width="29" height="42" rx="2" fill="#4E342E"/>
      <line x1="60" y1="80" x2="60" y2="122" stroke="#3E2723" strokeWidth="2.5"/>
      <line x1="30" y1="80" x2="59" y2="122" stroke="#3E2723" strokeWidth="1.5" opacity="0.5"/>
      <line x1="59" y1="80" x2="30" y2="122" stroke="#3E2723" strokeWidth="1.5" opacity="0.5"/>
      <line x1="61" y1="80" x2="90" y2="122" stroke="#3E2723" strokeWidth="1.5" opacity="0.5"/>
      <line x1="90" y1="80" x2="61" y2="122" stroke="#3E2723" strokeWidth="1.5" opacity="0.5"/>
      <rect x="114" y="64" width="55" height="38" rx="4" fill="#FFF8DC"/>
      <line x1="141.5" y1="64" x2="141.5" y2="102" stroke="#C62828" strokeWidth="2.5"/>
      <line x1="114" y1="83" x2="169" y2="83" stroke="#C62828" strokeWidth="2.5"/>
      {level >= 2 && (
        <>
          <g>
            <ellipse cx="150" cy="118" rx="16" ry="11" fill="#C49000"/>
            <ellipse cx="150" cy="114" rx="14" ry="8" fill="#D4A017"/>
            <ellipse cx="150" cy="113" rx="10" ry="5" fill="#E8B830" opacity="0.5"/>
            <line x1="140" y1="114" x2="160" y2="114" stroke="#B89A3E" strokeWidth="0.8"/>
            <line x1="142" y1="116" x2="158" y2="116" stroke="#B89A3E" strokeWidth="0.8"/>
          </g>
          <g>
            <ellipse cx="172" cy="120" rx="13" ry="10" fill="#C49000"/>
            <ellipse cx="172" cy="116" rx="11" ry="7" fill="#D4A017"/>
            <ellipse cx="172" cy="115" rx="8" ry="4" fill="#E8B830" opacity="0.5"/>
          </g>
        </>
      )}
      {level === 3 && (
        <>
          <ellipse cx="135" cy="122" rx="12" ry="9" fill="#C49000"/>
          <ellipse cx="135" cy="119" rx="10" ry="6" fill="#D4A017"/>
          <g>
            <rect x="8" y="116" width="16" height="18" rx="2" fill="#8D6E63"/>
            <rect x="10" y="112" width="12" height="6" rx="2" fill="#A1887F"/>
          </g>
        </>
      )}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#E53935" opacity="0.8"/>
    </svg>
  );
}

export function TractorSVG({ level }: { level: number }) {
  const sid = useSvgId("tractor");
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("field")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A5D6A7"/>
          <stop offset="100%" stopColor="#81C784"/>
        </linearGradient>
        <linearGradient id={sid("body")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#43A047"/>
          <stop offset="100%" stopColor="#2E7D32"/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("field")})`} rx="8"/>
      <rect x="0" y="108" width="200" height="42" fill="#66BB6A" opacity="0.6"/>
      {[20, 50, 80, 110, 140, 170].map(x => (
        <line key={x} x1={x} y1="108" x2={x + 3} y2="140" stroke="#4CAF50" strokeWidth="4" opacity="0.2"/>
      ))}
      <ellipse cx="68" cy="115" rx="38" ry="6" fill="rgba(0,0,0,0.1)"/>
      <circle cx="68" cy="100" r="38" fill="#212121"/>
      <circle cx="68" cy="100" r="32" fill="#333"/>
      <circle cx="68" cy="100" r="22" fill="#424242"/>
      <circle cx="68" cy="100" r="10" fill="#616161"/>
      <circle cx="68" cy="100" r="4" fill="#757575"/>
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
        const rad = (a * Math.PI) / 180;
        return (
          <line key={a}
            x1={68 + Math.cos(rad) * 24} y1={100 + Math.sin(rad) * 24}
            x2={68 + Math.cos(rad) * 35} y2={100 + Math.sin(rad) * 35}
            stroke="#212121" strokeWidth="5" strokeLinecap="round"/>
        );
      })}
      <polygon points="95,52 172,52 178,88 95,88" fill={`url(#${sid("body")})`}/>
      <rect x="95" y="68" width="58" height="22" rx="3" fill="#2E7D32"/>
      <rect x="96" y="30" width="72" height="56" rx="6" fill="#43A047"/>
      <rect x="96" y="30" width="72" height="16" rx="6" fill="#388E3C"/>
      <rect x="102" y="36" width="30" height="28" rx="4" fill="#BBDEFB"/>
      <rect x="103" y="37" width="28" height="12" rx="3" fill="#E3F2FD" opacity="0.4"/>
      <rect x="137" y="36" width="26" height="28" rx="4" fill="#BBDEFB"/>
      <rect x="138" y="37" width="24" height="12" rx="3" fill="#E3F2FD" opacity="0.4"/>
      <rect x="147" y="12" width="10" height="44" rx="5" fill="#616161"/>
      <rect x="145" y="8" width="14" height="10" rx="4" fill="#424242"/>
      {level >= 2 && (
        <>
          <ellipse cx="152" cy="3" rx="6" ry="7" fill="#BDBDBD" opacity="0.6"/>
          <ellipse cx="158" cy="-2" rx="5" ry="6" fill="#BDBDBD" opacity="0.4"/>
        </>
      )}
      <ellipse cx="162" cy="115" rx="26" ry="5" fill="rgba(0,0,0,0.1)"/>
      <circle cx="162" cy="104" r="24" fill="#212121"/>
      <circle cx="162" cy="104" r="18" fill="#333"/>
      <circle cx="162" cy="104" r="9" fill="#616161"/>
      <rect x="116" y="52" width="5" height="16" rx="2" fill="#424242"/>
      <ellipse cx="118.5" cy="50" rx="10" ry="5" fill="#616161"/>
      {level === 3 && (
        <>
          <rect x="80" y="55" width="18" height="52" rx="5" fill="#2E7D32"/>
          <rect x="65" y="105" width="34" height="10" rx="4" fill="#1B5E20"/>
          <rect x="63" y="103" width="38" height="5" rx="2" fill="#388E3C"/>
        </>
      )}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#43A047" opacity="0.8"/>
    </svg>
  );
}

export function GrainSiloSVG({ level }: { level: number }) {
  const sid = useSvgId("silo");
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("ground")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF8E1"/>
          <stop offset="100%" stopColor="#FFECB3"/>
        </linearGradient>
        <linearGradient id={sid("metal")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#BDBDBD"/>
          <stop offset="30%" stopColor="#E0E0E0"/>
          <stop offset="60%" stopColor="#F5F5F5"/>
          <stop offset="100%" stopColor="#9E9E9E"/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("ground")})`} rx="8"/>
      <rect x="0" y="118" width="200" height="32" fill="#FFE082" opacity="0.5"/>
      <ellipse cx="100" cy="122" rx="48" ry="6" fill="rgba(0,0,0,0.08)"/>
      <rect x="52" y="22" width="96" height="100" rx="10" fill={`url(#${sid("metal")})`}/>
      {[34, 48, 62, 76, 90, 104].map(y => (
        <rect key={y} x="52" y={y} width="96" height="4" rx="2" fill="#9E9E9E" opacity="0.4"/>
      ))}
      <rect x="54" y="24" width="40" height="96" rx="8" fill="#E8E8E8" opacity="0.3"/>
      <ellipse cx="100" cy="22" rx="48" ry="18" fill="#757575"/>
      <ellipse cx="100" cy="18" rx="42" ry="14" fill="#9E9E9E"/>
      <ellipse cx="100" cy="16" rx="32" ry="10" fill="#BDBDBD"/>
      <ellipse cx="100" cy="14" rx="20" ry="6" fill="#E0E0E0"/>
      <circle cx="100" cy="8" r="8" fill="#616161"/>
      <circle cx="100" cy="8" r="4" fill="#757575"/>
      <rect x="140" y="28" width="5" height="92" rx="2" fill="#757575"/>
      <rect x="147" y="28" width="5" height="92" rx="2" fill="#757575"/>
      {[38, 52, 66, 80, 94, 108].map(y => (
        <rect key={y} x="140" y={y} width="12" height="3" rx="1.5" fill="#9E9E9E"/>
      ))}
      <rect x="48" y="118" width="104" height="12" rx="5" fill="#9E9E9E"/>
      {level >= 2 && (
        <g>
          <rect x="16" y="82" width="40" height="42" rx="4" fill="#E8730C"/>
          <polygon points="36,58 8,82 64,82" fill="#8B4513"/>
          <polygon points="36,58 36,82 8,82" fill="#6B3A1F" opacity="0.3"/>
          <rect x="28" y="104" width="16" height="20" rx="3" fill="#5D4037"/>
          <rect x="48" y="96" width="24" height="7" rx="3" fill="#616161" transform="rotate(-22 48 96)"/>
        </g>
      )}
      {level === 3 && (
        <g>
          <rect x="144" y="72" width="42" height="50" rx="4" fill="#E8730C"/>
          <polygon points="165,52 144,72 186,72" fill="#8B4513"/>
          <rect x="146" y="82" width="8" height="32" rx="3" fill="#757575" opacity="0.6"/>
        </g>
      )}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#9E9E9E" opacity="0.8"/>
    </svg>
  );
}

export function IrrigationSVG({ level }: { level: number }) {
  const sid = useSvgId("irrig");
  return (
    <svg viewBox="0 0 200 150" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={sid("ground")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E0F7FA"/>
          <stop offset="40%" stopColor="#B2EBF2"/>
          <stop offset="100%" stopColor="#80CBC4"/>
        </linearGradient>
        <linearGradient id={sid("water")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#039BE5"/>
          <stop offset="100%" stopColor="#0277BD"/>
        </linearGradient>
      </defs>
      <rect width="200" height="150" fill={`url(#${sid("ground")})`} rx="8"/>
      <rect x="6" y="56" width="88" height="82" rx="5" fill="#4CAF50" opacity="0.6"/>
      <rect x="106" y="56" width="88" height="82" rx="5" fill="#4CAF50" opacity="0.6"/>
      {Array.from({ length: 4 }).map((_, r) => (
        <g key={r}>
          {Array.from({ length: 5 }).map((_, c) => (
            <g key={c}>
              <ellipse cx={18 + c * 18} cy={70 + r * 17} rx="6" ry="8" fill="#2E7D32"/>
              <ellipse cx={18 + c * 18} cy={68 + r * 17} rx="4" ry="5" fill="#43A047" opacity="0.5"/>
              <ellipse cx={118 + c * 18} cy={70 + r * 17} rx="6" ry="8" fill="#2E7D32"/>
              <ellipse cx={118 + c * 18} cy={68 + r * 17} rx="4" ry="5" fill="#43A047" opacity="0.5"/>
            </g>
          ))}
        </g>
      ))}
      <rect x="88" y="10" width="24" height="132" rx="6" fill={`url(#${sid("water")})`}/>
      <rect x="90" y="10" width="10" height="132" fill="#29B6F6" opacity="0.4"/>
      {[20, 45, 70, 95, 120].map(y => (
        <ellipse key={y} cx="100" cy={y} rx="10" ry="3" fill="#4FC3F7" opacity="0.3"/>
      ))}
      <rect x="8" y="30" width="184" height="14" rx="7" fill="#546E7A"/>
      <rect x="10" y="32" width="180" height="4" rx="2" fill="#78909C" opacity="0.5"/>
      <circle cx="100" cy="37" r="18" fill="#37474F"/>
      <circle cx="100" cy="37" r="12" fill="#546E7A"/>
      <circle cx="100" cy="37" r="6" fill="#78909C"/>
      <circle cx="100" cy="37" r="3" fill="#90A4AE"/>
      {level >= 1 && Array.from({ length: 10 }).map((_, i) => {
        const x = 14 + i * 18;
        const y = 44 + (i % 3) * 6;
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx="2.5" ry="4.5" fill="#29B6F6" opacity="0.7"/>
            {level >= 2 && <ellipse cx={x + 3} cy={y + 8} rx="2" ry="3.5" fill="#4FC3F7" opacity="0.5"/>}
          </g>
        );
      })}
      {[28, 72, 128, 172].map(x => (
        <rect key={x} x={x} y="37" width="5" height="58" rx="2" fill="#455A64" opacity="0.6"/>
      ))}
      {level >= 2 && (
        <rect x="84" y="112" width="32" height="24" rx="5" fill="#37474F"/>
      )}
      {level === 3 && (
        <>
          <rect x="86" y="114" width="28" height="20" rx="4" fill="#455A64"/>
          <circle cx="100" cy="124" r="5" fill="#78909C"/>
          <circle cx="100" cy="124" r="2.5" fill="#90A4AE"/>
        </>
      )}
      <rect x="6" y="140" width={(level / 3) * 188} height="5" rx="2.5" fill="#29B6F6" opacity="0.8"/>
    </svg>
  );
}

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

export function TreeSVG({ scale = 1 }: { scale?: number }) {
  return (
    <svg viewBox="0 0 60 80" width={60 * scale} height={80 * scale} xmlns="http://www.w3.org/2000/svg">
      <rect x="22" y="52" width="16" height="28" rx="5" fill="#5D4037"/>
      <rect x="24" y="54" width="6" height="22" rx="3" fill="#795548" opacity="0.4"/>
      <circle cx="30" cy="46" r="26" fill="#1B5E20"/>
      <circle cx="30" cy="40" r="20" fill="#2E7D32"/>
      <circle cx="22" cy="36" r="14" fill="#388E3C"/>
      <circle cx="38" cy="36" r="14" fill="#388E3C"/>
      <circle cx="30" cy="28" r="12" fill="#43A047"/>
      <circle cx="26" cy="24" r="6" fill="#66BB6A" opacity="0.5"/>
    </svg>
  );
}
