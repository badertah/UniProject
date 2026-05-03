// ============================================================================
// FARM ATMOSPHERE — day/night cycle, weather, golden crops, ambient critters,
// tick countdown, bank meter, harvest celebration. Every effect is purely
// additive: drop the components into farm.tsx and they layer over the
// existing isometric scene without disturbing it.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Sun, Moon, CloudRain, Cloud as CloudIcon, Timer } from "lucide-react";

// ---------- Color helpers (hex math kept tiny on purpose) ----------
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

// ============================================================================
// useAtmosphere — single source of truth for time of day & weather.
// Game day = 4 real minutes (deliberately short so the player actually sees
// dawn/dusk during a session). Weather flips on a 90-second random bucket.
// ============================================================================
export type Weather = "sun" | "cloud" | "rain";
export interface Atmosphere {
  phase: number;          // 0..1, where 0=midnight, 0.5=noon
  weather: Weather;
  isDay: boolean;
  dayLabel: "Dawn" | "Day" | "Dusk" | "Night";
  cropBoost: number;      // multiplier hint shown in HUD (rain = +20%)
}
const DAY_LENGTH_S = 240;
const WEATHER_BUCKET_MS = 90_000;

export function useAtmosphere(): Atmosphere {
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick(t => (t + 1) % 100000), 1000);
    return () => clearInterval(i);
  }, []);

  const now = Date.now();
  const phase = ((now / 1000) % DAY_LENGTH_S) / DAY_LENGTH_S;

  // Stable PRNG over the bucket index so the same minute always gives the
  // same weather (no flicker on re-render).
  const bucket = Math.floor(now / WEATHER_BUCKET_MS);
  const r = Math.abs(Math.sin(bucket * 9301 + 49297)) % 1;
  const weather: Weather = r < 0.6 ? "sun" : r < 0.85 ? "cloud" : "rain";

  const isDay = phase > 0.22 && phase < 0.78;
  const dayLabel: Atmosphere["dayLabel"] =
    phase < 0.18 ? "Night" :
    phase < 0.30 ? "Dawn" :
    phase < 0.70 ? "Day" :
    phase < 0.82 ? "Dusk" : "Night";
  const cropBoost = weather === "rain" ? 1.2 : 1;

  return { phase, weather, isDay, dayLabel, cropBoost };
}

// ============================================================================
// skyGradient — full-bleed CSS gradient string for the root farm container.
// ============================================================================
const SKY_PRESETS = {
  night: { top: "#0a1430", mid: "#1f2748" },
  dawn:  { top: "#fb923c", mid: "#fcd34d" },
  day:   { top: "#87CEEB", mid: "#B4E4FF" },
  dusk:  { top: "#7c3aed", mid: "#fb7185" },
} as const;

function pickSkyColors(phase: number) {
  // Smoothly interpolate between the four key presets.
  let a, b, t;
  if      (phase < 0.18) { a = SKY_PRESETS.night; b = SKY_PRESETS.night; t = 0; }
  else if (phase < 0.30) { a = SKY_PRESETS.night; b = SKY_PRESETS.dawn;  t = (phase - 0.18) / 0.12; }
  else if (phase < 0.40) { a = SKY_PRESETS.dawn;  b = SKY_PRESETS.day;   t = (phase - 0.30) / 0.10; }
  else if (phase < 0.65) { a = SKY_PRESETS.day;   b = SKY_PRESETS.day;   t = 0; }
  else if (phase < 0.75) { a = SKY_PRESETS.day;   b = SKY_PRESETS.dusk;  t = (phase - 0.65) / 0.10; }
  else if (phase < 0.85) { a = SKY_PRESETS.dusk;  b = SKY_PRESETS.night; t = (phase - 0.75) / 0.10; }
  else                   { a = SKY_PRESETS.night; b = SKY_PRESETS.night; t = 0; }
  return { top: mixHex(a.top, b.top, t), mid: mixHex(a.mid, b.mid, t) };
}

export function skyGradient(phase: number, weather: Weather) {
  const c = pickSkyColors(phase);
  // Rain dims sky a touch; cloud washes it slightly.
  const dim = weather === "rain" ? 0.78 : weather === "cloud" ? 0.92 : 1;
  const top = mixHex("#000000", c.top, dim);
  const mid = mixHex("#000000", c.mid, dim);
  // Grass band stays mostly stable, just goes deeper at night.
  const grassTop = mixHex("#5A9A2A", "#2a3a18", phase < 0.20 || phase > 0.85 ? 0.55 : 0);
  const grassMid = mixHex("#7CB342", "#3a5a18", phase < 0.20 || phase > 0.85 ? 0.45 : 0);
  const grassBot = mixHex("#5A9A2A", "#2a3a18", phase < 0.20 || phase > 0.85 ? 0.45 : 0);
  return `linear-gradient(180deg, ${top} 0%, ${mid} 30%, ${grassTop} 48%, ${grassMid} 52%, ${grassBot} 100%)`;
}

// ============================================================================
// CelestialBody — sun by day, moon by night, both arc across the sky.
// ============================================================================
export function CelestialBody({ phase }: { phase: number }) {
  // Rebase phase so the body is "up" between 0.22 and 0.78 (day) AND
  // 0.78–1.22 (night, shown as moon). Single arc parameter from 0..1 inside
  // each half cycle.
  const isDayWindow = phase > 0.22 && phase < 0.78;
  const arcT = isDayWindow ? (phase - 0.22) / 0.56 : ((phase + (phase < 0.22 ? 0.22 : -0.78)) % 1) / 0.44;
  const x = `${arcT * 100}%`;
  // y arc: 0 at edges, peak (small px) at middle.
  const arcY = Math.sin(arcT * Math.PI);
  const top = `${10 + (1 - arcY) * 12}%`;

  if (isDayWindow) {
    // Brighter sun close to noon.
    const intensity = 0.5 + arcY * 0.5;
    return (
      <div className="absolute pointer-events-none" style={{ left: x, top, transform: "translate(-50%, 0)", zIndex: 1 }}>
        <div className="relative" style={{ filter: `drop-shadow(0 0 ${20 + arcY * 30}px rgba(255,210,80,${0.4 + intensity * 0.4}))` }}>
          <svg width={56} height={56} viewBox="0 0 56 56">
            <circle cx={28} cy={28} r={18} fill="#FFD54F"/>
            <circle cx={28} cy={28} r={14} fill="#FFEB3B"/>
            <circle cx={24} cy={24} r={4} fill="#FFF59D" opacity={0.8}/>
          </svg>
        </div>
      </div>
    );
  }
  // Moon at night (phase 0.78..1 and 0..0.22)
  // Larger, brighter crescent with a soft halo + a sprinkle of nearby stars
  // — gives the night sky a clear focal point matching the polished design.
  return (
    <div className="absolute pointer-events-none" style={{ left: x, top, transform: "translate(-50%, 0)", zIndex: 1 }}>
      <div style={{ filter: "drop-shadow(0 0 28px rgba(200,215,255,0.75)) drop-shadow(0 0 12px rgba(255,255,255,0.45))" }}>
        <svg width={84} height={84} viewBox="0 0 84 84">
          {/* Soft outer halo */}
          <circle cx={42} cy={42} r={36} fill="rgba(220,230,255,0.06)"/>
          <circle cx={42} cy={42} r={28} fill="rgba(220,230,255,0.10)"/>
          {/* Crescent: bright disc + offset dark disc carving the bite */}
          <circle cx={42} cy={42} r={22} fill="#F5F7FF"/>
          <circle cx={42} cy={42} r={22} fill="url(#moonShade)"/>
          <circle cx={34} cy={38} r={20} fill="#0a1430"/>
          {/* A couple of subtle craters on the lit edge */}
          <circle cx={56} cy={36} r={1.6} fill="#C5CAE9" opacity={0.55}/>
          <circle cx={52} cy={48} r={1.2} fill="#C5CAE9" opacity={0.45}/>
          <circle cx={58} cy={46} r={0.9} fill="#C5CAE9" opacity={0.45}/>
          <defs>
            <radialGradient id="moonShade" cx="0.7" cy="0.4" r="0.7">
              <stop offset="0%" stopColor="rgba(255,255,255,0.0)"/>
              <stop offset="80%" stopColor="rgba(120,140,200,0.18)"/>
              <stop offset="100%" stopColor="rgba(80,100,160,0.30)"/>
            </radialGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

// ============================================================================
// SkyBalloon — a friendly hot-air balloon drifting across the upper sky.
// Lives in the fixed-viewport sky overlay (NOT the panning world) so it
// stays visible no matter where the camera is. Faintly fades during the day
// when the sun washes out the sky and is fully opaque at night.
// ============================================================================
export function SkyBalloon({ phase }: { phase: number }) {
  // Brighter at night, softer at noon
  const isNightish = phase < 0.28 || phase > 0.72;
  const opacity = isNightish ? 0.95 : 0.7;
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: "6%",
        left: "-12%",
        zIndex: 2,
        animation: "skyBalloonDrift 55s linear infinite",
        opacity,
      }}
    >
      <style>{`
        @keyframes skyBalloonDrift {
          0%   { transform: translate(0vw, 0px); }
          25%  { transform: translate(28vw, -10px); }
          50%  { transform: translate(56vw, 6px); }
          75%  { transform: translate(86vw, -6px); }
          100% { transform: translate(120vw, 4px); }
        }
        @keyframes skyBalloonBob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
      `}</style>
      <div style={{ animation: "skyBalloonBob 4.5s ease-in-out infinite", filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.45))" }}>
        <svg width={68} height={104} viewBox="0 0 68 104">
          {/* Ropes */}
          <line x1={14} y1={62} x2={26} y2={86} stroke="#5D4037" strokeWidth={1.2}/>
          <line x1={54} y1={62} x2={42} y2={86} stroke="#5D4037" strokeWidth={1.2}/>
          <line x1={26} y1={62} x2={30} y2={86} stroke="#5D4037" strokeWidth={1.0}/>
          <line x1={42} y1={62} x2={38} y2={86} stroke="#5D4037" strokeWidth={1.0}/>
          {/* Envelope */}
          <ellipse cx={34} cy={36} rx={26} ry={32} fill="#E91E63"/>
          <path d="M8 38 Q8 8 34 0 Q60 8 60 38 Z" fill="#F06292"/>
          {/* Vertical stripes */}
          <path d="M34 4 Q22 16 22 42 Q22 58 34 66" fill="none" stroke="#FFEB3B" strokeWidth={3} opacity={0.85}/>
          <path d="M34 4 Q46 16 46 42 Q46 58 34 66" fill="none" stroke="#FFEB3B" strokeWidth={3} opacity={0.85}/>
          {/* Sheen */}
          <ellipse cx={22} cy={22} rx={6} ry={12} fill="rgba(255,255,255,0.35)"/>
          {/* Basket */}
          <rect x={22} y={86} width={24} height={14} rx={2} fill="#7B5028"/>
          <rect x={24} y={88} width={20} height={10} rx={1.5} fill="#A0724E"/>
          <line x1={28} y1={88} x2={28} y2={98} stroke="#5D4037" strokeWidth={0.6}/>
          <line x1={34} y1={88} x2={34} y2={98} stroke="#5D4037" strokeWidth={0.6}/>
          <line x1={40} y1={88} x2={40} y2={98} stroke="#5D4037" strokeWidth={0.6}/>
        </svg>
      </div>
    </div>
  );
}

// ============================================================================
// Stars — visible only at night, twinkling softly.
// ============================================================================
const STAR_FIELD = Array.from({ length: 36 }).map((_, i) => ({
  x: (i * 73 + 13) % 100,
  y: ((i * 47) % 28),
  r: 0.6 + ((i * 17) % 10) / 12,
  d: (i % 7) * 0.3,
}));

export function Stars({ phase }: { phase: number }) {
  // Fade in fully at deep night (0..0.18 and 0.82..1).
  const op =
    phase < 0.18 ? Math.max(0, 1 - phase / 0.18) :
    phase > 0.82 ? Math.max(0, (phase - 0.82) / 0.12) : 0;
  if (op < 0.05) return null;
  return (
    <svg className="absolute inset-x-0 top-0 pointer-events-none" width="100%" height="35%" style={{ opacity: op, zIndex: 0 }}>
      {STAR_FIELD.map((s, i) => (
        <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white">
          <animate attributeName="opacity" values="0.3;1;0.3" dur={`${2 + s.d * 2}s`} repeatCount="indefinite" begin={`${s.d}s`}/>
        </circle>
      ))}
    </svg>
  );
}

// ============================================================================
// WeatherLayer — rain particles, drifting clouds, post-rain rainbow.
// ============================================================================
const RAIN_COUNT = 70;
const RAIN_DROPS = Array.from({ length: RAIN_COUNT }).map((_, i) => ({
  left: (i * 13.7) % 100,
  delay: ((i * 0.13) % 1.4),
  dur: 0.7 + ((i * 0.07) % 0.5),
  len: 12 + (i % 3) * 6,
}));

export function WeatherLayer({ weather, phase }: { weather: Weather; phase: number }) {
  // After rain ends, briefly show a rainbow. We can't easily detect "just
  // ended" so use a short window when sky is bright but weather is sun and
  // we're a bit past dawn → soft rainbow band (cosmetic only).
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
      {weather === "cloud" && (
        <>
          <DriftingCloud top="14%" w={170} dur={70} delay={-5} opacity={0.95}/>
          <DriftingCloud top="22%" w={130} dur={90} delay={-30} opacity={0.85}/>
          <DriftingCloud top="9%"  w={210} dur={110} delay={-50} opacity={0.9}/>
        </>
      )}
      {weather === "rain" && (
        <>
          <DriftingCloud top="10%" w={200} dur={60} delay={-10} opacity={1} dark/>
          <DriftingCloud top="18%" w={160} dur={80} delay={-25} opacity={0.95} dark/>
          <DriftingCloud top="6%"  w={240} dur={100} delay={-55} opacity={1} dark/>
          <svg className="absolute inset-x-0 top-0 w-full" height="60%">
            {RAIN_DROPS.map((d, i) => (
              <line key={i} x1={`${d.left}%`} y1="-5%" x2={`${d.left - 3}%`} y2={`${d.len}%`}
                stroke="#bcd8ff" strokeOpacity={0.65} strokeWidth={1.4} strokeLinecap="round">
                <animate attributeName="y1" values="-12%;110%" dur={`${d.dur}s`} begin={`${d.delay}s`} repeatCount="indefinite"/>
                <animate attributeName="y2" values="-2%;120%"  dur={`${d.dur}s`} begin={`${d.delay}s`} repeatCount="indefinite"/>
              </line>
            ))}
          </svg>
          {/* Subtle rain wash overlay */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(70,90,140,0.15) 0%, rgba(70,90,140,0.05) 50%, transparent 100%)" }}/>
        </>
      )}
      {/* Soft static rainbow only deep in the day window when sunny */}
      {weather === "sun" && phase > 0.4 && phase < 0.6 && (
        <svg className="absolute" style={{ left: "5%", top: "8%", opacity: 0.18 }} width="380" height="180" viewBox="0 0 380 180">
          {["#ff5252","#ff9800","#ffeb3b","#4caf50","#2196f3","#673ab7"].map((c, i) => (
            <path key={i} d={`M ${20+i*4} 180 A ${170-i*8} ${130-i*6} 0 0 1 ${360-i*4} 180`} stroke={c} strokeWidth="6" fill="none"/>
          ))}
        </svg>
      )}
    </div>
  );
}

function DriftingCloud({ top, w, dur, delay, opacity, dark }: { top: string; w: number; dur: number; delay: number; opacity: number; dark?: boolean }) {
  return (
    <div className="absolute" style={{
      top, width: w, height: w * 0.35, opacity,
      animation: `cloudDrift ${dur}s linear infinite`,
      animationDelay: `${delay}s`,
    }}>
      <svg viewBox="0 0 200 70" width="100%" height="100%">
        <ellipse cx="100" cy="42" rx="85" ry="22" fill={dark ? "#5a6478" : "white"}/>
        <ellipse cx="62"  cy="34" rx="48" ry="20" fill={dark ? "#6a7488" : "white"}/>
        <ellipse cx="138" cy="34" rx="48" ry="20" fill={dark ? "#6a7488" : "white"}/>
        <ellipse cx="100" cy="28" rx="55" ry="18" fill={dark ? "#7a8498" : "white"}/>
      </svg>
    </div>
  );
}

// ============================================================================
// AmbientCreatures — butterflies in day, fireflies at night.
// Pure decoration, fixed positions so it doesn't churn on every re-render.
// ============================================================================
const BUTTERFLY_PATHS = [
  { startX: "10%",  startY: "55%", dx: 200,  dur: 14 },
  { startX: "70%",  startY: "65%", dx: -180, dur: 18 },
  { startX: "40%",  startY: "75%", dx: 240,  dur: 16 },
];
const FIREFLY_POSITIONS = Array.from({ length: 20 }).map((_, i) => ({
  x: 8 + ((i * 11) % 84),
  y: 35 + ((i * 7) % 45),
  delay: (i % 7) * 0.4,
  dur: 2.4 + ((i * 0.13) % 1.2),
}));

export function AmbientCreatures({ isDay }: { isDay: boolean }) {
  if (isDay) {
    return null;
  }
  // Night → fireflies twinkling above the ground band.
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 14 }}>
      {FIREFLY_POSITIONS.map((f, i) => (
        <div key={i} className="absolute" style={{
          left: `${f.x}%`, top: `${f.y}%`, width: 6, height: 6, borderRadius: 9999,
          background: "radial-gradient(circle, #fff7a0 0%, rgba(255,235,80,0.6) 50%, transparent 70%)",
          boxShadow: "0 0 12px rgba(255,235,80,0.7)",
          animation: `fireflyPulse ${f.dur}s ease-in-out infinite`,
          animationDelay: `${f.delay}s`,
        }}/>
      ))}
      <style>{`@keyframes fireflyPulse { 0%,100% { opacity: 0; transform: translateY(0) scale(0.7); } 50% { opacity: 1; transform: translateY(-14px) scale(1.1); } }`}</style>
    </div>
  );
}

// ============================================================================
// TickProgress — slim progress bar showing time until the next income tick.
// Re-renders every 250ms via internal interval (no parent state churn).
// ============================================================================
export function TickProgress({ lastTickTime, intervalMs }: { lastTickTime: number; intervalMs: number }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT(v => (v + 1) % 1000), 250);
    return () => clearInterval(i);
  }, []);
  const elapsed = Math.max(0, Date.now() - lastTickTime);
  const pct = Math.min(100, (elapsed / intervalMs) * 100);
  const remainS = Math.max(0, Math.ceil((intervalMs - elapsed) / 1000));
  return (
    <div className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,215,0,0.25)", minWidth: 130 }}>
      <Timer className="w-3 h-3 flex-shrink-0" style={{ color: "#FFD700" }}/>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full transition-all duration-200" style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg, #43A047, #FFD54F)",
          boxShadow: pct > 90 ? "0 0 8px rgba(255,215,80,0.7)" : "none",
        }}/>
      </div>
      <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: "#FFD700", minWidth: 22, textAlign: "right" }}>{remainS}s</span>
    </div>
  );
}

// ============================================================================
// BankMeter — visual fill for the farm bank toward MAX_FARM_BANK.
// Shows a "Bank Full!" pulse when at cap so the player knows to harvest.
// ============================================================================
export function BankMeter({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const isFull = value >= max;
  return (
    <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "rgba(0,0,0,0.45)", border: `1px solid ${isFull ? "rgba(229,115,115,0.8)" : "rgba(46,125,50,0.5)"}`, minWidth: 130 }}>
      <span className="text-xs">🌾</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <motion.div
          className="h-full"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ background: isFull ? "linear-gradient(90deg, #ef5350, #ff9800)" : "linear-gradient(90deg, #2E7D32, #66BB6A)" }}
        />
      </div>
      <span className={`text-[10px] font-mono font-bold tabular-nums ${isFull ? "animate-pulse" : ""}`} style={{ color: isFull ? "#ffab91" : "#A8D8A8", minWidth: 32, textAlign: "right" }}>{value}/{max}</span>
    </div>
  );
}

// ============================================================================
// WeatherBadge — small chip in HUD showing the current weather + crop boost.
// ============================================================================
export function WeatherBadge({ atm }: { atm: Atmosphere }) {
  const Icon = atm.weather === "rain" ? CloudRain : atm.weather === "cloud" ? CloudIcon : atm.isDay ? Sun : Moon;
  const color = atm.weather === "rain" ? "#90CAF9" : atm.weather === "cloud" ? "#CFD8DC" : atm.isDay ? "#FFD54F" : "#B39DDB";
  const bg    = atm.weather === "rain" ? "rgba(33,150,243,0.18)" : atm.weather === "cloud" ? "rgba(120,144,156,0.18)" : atm.isDay ? "rgba(255,193,7,0.2)" : "rgba(149,117,205,0.2)";
  return (
    <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: bg, border: `1px solid ${color}40`, color }}>
      <Icon className="w-3 h-3"/>
      <span>{atm.dayLabel}</span>
      {atm.cropBoost > 1 && (
        <span className="ml-1 px-1 rounded font-mono" style={{ background: "rgba(76,175,80,0.35)", color: "#C8E6C9" }}>+{Math.round((atm.cropBoost - 1) * 100)}%</span>
      )}
    </div>
  );
}

// ============================================================================
// GoldenCropOverlay — render a clickable golden coin floating above the
// given (x, y) plot center for `expiresAt` ms. Dismissed on click → pays out.
// ============================================================================
export function GoldenCropOverlay({ x, y, reward, expiresAt, onCollect }: {
  x: number; y: number; reward: number; expiresAt: number; onCollect: () => void;
}) {
  const [, setT] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setT(v => (v + 1) % 999), 200);
    return () => clearInterval(i);
  }, []);
  const remain = Math.max(0, expiresAt - Date.now());
  if (remain === 0) return null;
  const remainPct = Math.min(1, remain / 9000);
  return (
    <motion.button
      type="button"
      onClick={onCollect}
      initial={{ scale: 0, rotate: -45 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0 }}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      className="absolute z-50 pointer-events-auto cursor-pointer"
      style={{ left: x, top: y - 80, transform: "translate(-50%, -50%)", padding: 0, background: "transparent", border: "none" }}
      data-testid="btn-golden-crop"
    >
      <div className="relative" style={{ filter: "drop-shadow(0 0 16px rgba(255,215,0,0.85))" }}>
        {/* Sparkle ring */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          style={{ width: 56, height: 56, top: -8, left: -8 }}
        >
          {[0, 90, 180, 270].map(a => (
            <div key={a} className="absolute" style={{
              left: "50%", top: "50%",
              width: 4, height: 4, borderRadius: 9999,
              background: "white",
              transform: `rotate(${a}deg) translateY(-26px)`,
              boxShadow: "0 0 6px white",
            }}/>
          ))}
        </motion.div>
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        >
          <svg width={40} height={40} viewBox="0 0 40 40">
            <circle cx={20} cy={20} r={17} fill="#FFD54F" stroke="#F57F17" strokeWidth="2.5"/>
            <circle cx={20} cy={20} r={12} fill="#FFEB3B"/>
            <text x={20} y={26} textAnchor="middle" fontSize="18" fontWeight="900" fill="#5D4037">$</text>
            <circle cx={14} cy={14} r={3} fill="#FFFFFF" opacity={0.7}/>
          </svg>
        </motion.div>
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-1.5 rounded-full text-[9px] font-black whitespace-nowrap" style={{ background: "#5D4037", color: "#FFD700", border: "1px solid #FFD700" }}>+{reward}</div>
        {/* expiry shrink ring */}
        <svg className="absolute" style={{ top: -6, left: -6, pointerEvents: "none" }} width={52} height={52} viewBox="0 0 52 52">
          <circle cx={26} cy={26} r={24} fill="none" stroke="rgba(255,215,0,0.85)" strokeWidth="2"
                  strokeDasharray={`${remainPct * 150.8} 150.8`}
                  transform="rotate(-90 26 26)"/>
        </svg>
      </div>
    </motion.button>
  );
}

// Hook that owns the golden-crop spawn state. Returns the active spawn (if
// any) plus a `collect()` callback. Pass in the list of owned building IDs.
export function useGoldenCropSpawner(ownedIds: string[], enabled: boolean) {
  const [spawn, setSpawn] = useState<{ bId: string; expiresAt: number; reward: number } | null>(null);
  const ownedRef = useRef(ownedIds);
  useEffect(() => { ownedRef.current = ownedIds; }, [ownedIds]);

  // Try to spawn one every 22s; ~45% chance.
  useEffect(() => {
    if (!enabled) return;
    const i = setInterval(() => {
      setSpawn(prev => {
        if (prev) return prev; // already one active
        const owned = ownedRef.current;
        if (owned.length === 0) return null;
        if (Math.random() < 0.45) {
          const bId = owned[Math.floor(Math.random() * owned.length)];
          const reward = 25 + Math.floor(Math.random() * 50);
          return { bId, expiresAt: Date.now() + 9000, reward };
        }
        return null;
      });
    }, 22_000);
    return () => clearInterval(i);
  }, [enabled]);

  // Auto-expire when expiresAt passes.
  useEffect(() => {
    if (!spawn) return;
    const ms = spawn.expiresAt - Date.now();
    const t = setTimeout(() => setSpawn(null), Math.max(0, ms));
    return () => clearTimeout(t);
  }, [spawn]);

  const collect = (onPay: (amount: number) => void) => {
    if (!spawn) return;
    onPay(spawn.reward);
    setSpawn(null);
  };
  return { spawn, collect, dismiss: () => setSpawn(null) };
}

// ============================================================================
// HarvestBurst — full-screen golden coin shower fired during the harvest
// celebration. Driven by `active` boolean; auto-cleans on completion.
// ============================================================================
const COIN_COUNT = 22;
export function HarvestBurst({ active }: { active: boolean }) {
  // Stable random vectors so each render isn't a new fountain.
  const coins = useMemo(() => Array.from({ length: COIN_COUNT }).map((_, i) => ({
    angle: (i / COIN_COUNT) * Math.PI * 2 + Math.random() * 0.3,
    dist: 180 + Math.random() * 220,
    delay: Math.random() * 0.15,
    size: 16 + Math.random() * 14,
    spin: (Math.random() < 0.5 ? -1 : 1) * (300 + Math.random() * 600),
  })), []);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          {coins.map((c, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
              animate={{
                x: Math.cos(c.angle) * c.dist,
                y: Math.sin(c.angle) * c.dist,
                opacity: [1, 1, 0],
                scale: [0, 1, 0.8],
                rotate: c.spin,
              }}
              transition={{ duration: 1.2, delay: c.delay, ease: [0.22, 1, 0.36, 1] }}
            >
              <Coins className="text-yellow-400" style={{ width: c.size, height: c.size, filter: "drop-shadow(0 0 8px rgba(255,215,0,0.8))" }}/>
            </motion.div>
          ))}
          <motion.div
            className="text-7xl"
            initial={{ scale: 0.3, rotate: -25 }}
            animate={{ scale: [0.3, 1.5, 1.1], rotate: [-25, 18, -8, 0] }}
            transition={{ duration: 1, ease: "easeOut" }}
          >🌾</motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// LightningFlash — tiny screen-flash overlay used during heavy rain.
// ============================================================================
export function LightningFlash({ weather }: { weather: Weather }) {
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (weather !== "rain") return;
    let t1: NodeJS.Timeout, t2: NodeJS.Timeout;
    const i = setInterval(() => {
      // 30% chance every 12s during rain.
      if (Math.random() < 0.3) {
        setFlashing(true);
        t1 = setTimeout(() => setFlashing(false), 90);
        t2 = setTimeout(() => { setFlashing(true); setTimeout(() => setFlashing(false), 60); }, 220);
      }
    }, 12_000);
    return () => { clearInterval(i); clearTimeout(t1); clearTimeout(t2); };
  }, [weather]);
  return (
    <div className="fixed inset-0 pointer-events-none z-30 transition-opacity duration-100" style={{
      background: "white", opacity: flashing ? 0.35 : 0,
    }}/>
  );
}
