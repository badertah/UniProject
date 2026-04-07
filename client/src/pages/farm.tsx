import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Coins, Star, X, ArrowUpCircle, ShoppingCart } from "lucide-react";
import { BuildingSVG, LockedFieldSVG } from "@/components/farm-buildings";

const TICK_INTERVAL_MS = 30_000;
const MAX_FARM_BANK    = 500;
const MAX_OFFLINE_TICKS = 20;
const FARM_STATE_KEY   = "farm_v2_state";

const ISO_HALF_W = 120;
const ISO_HALF_H = 60;
const CENTER_X = 560;
const START_Y = 80;
const CANVAS_W = 1120;
const CANVAS_H = 600;

interface BuildingDef {
  id: string; name: string; emoji: string;
  description: string;
  category: "crops" | "buildings" | "livestock" | "equipment";
  buyCost: number; upgradeCost: [number, number];
  incomePerTick: [number, number, number];
  tickMultiplier: number;
  col: number; row: number;
}

const BUILDINGS: BuildingDef[] = [
  { id: "wheat_field",     name: "Wheat Field",     emoji: "🌾", description: "Golden wheat rows — steady income.", category: "crops",     buyCost: 30,  upgradeCost: [60,  120], incomePerTick: [2,  5,  10], tickMultiplier: 1, col: 0, row: 0 },
  { id: "vegetable_patch", name: "Vegetable Patch",  emoji: "🥕", description: "Fresh vegetables that grow faster.", category: "crops",     buyCost: 50,  upgradeCost: [100, 200], incomePerTick: [3,  7,  14], tickMultiplier: 1, col: 1, row: 0 },
  { id: "apple_orchard",   name: "Apple Orchard",   emoji: "🍎", description: "Beautiful orchard trees.", category: "crops",     buyCost: 80,  upgradeCost: [150, 300], incomePerTick: [4,  9,  18], tickMultiplier: 1, col: 2, row: 0 },
  { id: "greenhouse",      name: "Greenhouse",       emoji: "🌿", description: "Year-round glass house.", category: "crops",     buyCost: 120, upgradeCost: [240, 480], incomePerTick: [5,  11, 22], tickMultiplier: 1, col: 3, row: 0 },
  { id: "chicken_coop",    name: "Chicken Coop",    emoji: "🐔", description: "Free-range hens.", category: "livestock", buyCost: 55,  upgradeCost: [110, 220], incomePerTick: [4,  8,  16], tickMultiplier: 2, col: 0, row: 1 },
  { id: "dairy_cows",      name: "Dairy Cows",      emoji: "🐄", description: "Happy cows producing milk.", category: "livestock", buyCost: 90,  upgradeCost: [180, 360], incomePerTick: [5,  11, 22], tickMultiplier: 2, col: 1, row: 1 },
  { id: "farmhouse",       name: "Farmhouse",        emoji: "🏠", description: "Your home base.", category: "buildings", buyCost: 40,  upgradeCost: [90,  180], incomePerTick: [3,  6,  13], tickMultiplier: 2, col: 2, row: 1 },
  { id: "windmill",        name: "Windmill",         emoji: "⚙️", description: "Harnessing wind power.", category: "buildings", buyCost: 100, upgradeCost: [200, 400], incomePerTick: [6,  12, 24], tickMultiplier: 2, col: 3, row: 1 },
  { id: "barn",            name: "Red Barn",         emoji: "🏚️", description: "Classic red barn.", category: "buildings", buyCost: 70,  upgradeCost: [140, 280], incomePerTick: [5,  10, 20], tickMultiplier: 3, col: 0, row: 2 },
  { id: "tractor",         name: "Tractor",          emoji: "🚜", description: "Heavy-duty machine.", category: "equipment", buyCost: 150, upgradeCost: [300, 600], incomePerTick: [8,  16, 32], tickMultiplier: 3, col: 1, row: 2 },
  { id: "silo",            name: "Grain Silo",       emoji: "🏗️", description: "Store grain in bulk.", category: "equipment", buyCost: 130, upgradeCost: [260, 520], incomePerTick: [7,  14, 28], tickMultiplier: 3, col: 2, row: 2 },
  { id: "irrigation",      name: "Irrigation",       emoji: "💧", description: "Automated water system.", category: "equipment", buyCost: 110, upgradeCost: [220, 440], incomePerTick: [6,  13, 26], tickMultiplier: 3, col: 3, row: 2 },
];

function isoPos(col: number, row: number) {
  return {
    x: CENTER_X + (col - row) * ISO_HALF_W,
    y: START_Y + (col + row) * ISO_HALF_H,
  };
}

function diamondPoints(cx: number, cy: number, hw = ISO_HALF_W, hh = ISO_HALF_H) {
  return `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
}

type FarmSave = {
  owned: Record<string, number>;
  farmBank: number;
  lastTickTime: number;
  tickCounters: Record<string, number>;
  day: number;
};

function loadState(): FarmSave {
  try { const raw = localStorage.getItem(FARM_STATE_KEY); if (raw) return { ...defaultState(), ...JSON.parse(raw) }; } catch {} return defaultState();
}
function defaultState(): FarmSave { return { owned: {}, farmBank: 0, lastTickTime: Date.now(), tickCounters: {}, day: 1 }; }
function saveState(s: FarmSave) { localStorage.setItem(FARM_STATE_KEY, JSON.stringify(s)); }

type CoinPop = { id: string; bId: string; amount: number };

function processTicks(state: FarmSave, n: number, silent = false) {
  let farmBank = state.farmBank;
  const tickCounters = { ...state.tickCounters };
  const pops: CoinPop[] = [];
  for (let t = 0; t < n; t++) {
    for (const b of BUILDINGS) {
      const lv = state.owned[b.id] || 0;
      if (!lv) continue;
      tickCounters[b.id] = (tickCounters[b.id] || 0) + 1;
      if (tickCounters[b.id] >= b.tickMultiplier) {
        tickCounters[b.id] = 0;
        const income = b.incomePerTick[lv - 1];
        farmBank = Math.min(farmBank + income, MAX_FARM_BANK);
        if (!silent) pops.push({ id: `${b.id}-${Date.now()}-${Math.random()}`, bId: b.id, amount: income });
      }
    }
  }
  return { state: { ...state, farmBank, tickCounters }, pops };
}

const LVL_LABEL = ["", "LV1", "LV2", "LV3★"];
const CAT_HEX: Record<string, string> = { crops: "#43A047", buildings: "#1565C0", livestock: "#E8730C", equipment: "#7B1FA2" };
const PLOT_COLORS: Record<string, { fill: string; stroke: string; locked: string }> = {
  crops:     { fill: "#8B6914", stroke: "#6B4F10", locked: "#7a6a55" },
  livestock: { fill: "#7CB342", stroke: "#558B2F", locked: "#6a7a55" },
  buildings: { fill: "#9E9E9E", stroke: "#757575", locked: "#8a8a7a" },
  equipment: { fill: "#78909C", stroke: "#546E7A", locked: "#7a8080" },
};
const CAT_PLOT_ID: Record<string, string> = { crops: "plotCrops", livestock: "plotLive", buildings: "plotBuild", equipment: "plotEquip" };

export default function FarmPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [farmSave, setFarmSave] = useState<FarmSave>(loadState);
  const [coinPops, setCoinPops] = useState<CoinPop[]>([]);
  const [selected, setSelected] = useState<BuildingDef | null>(null);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = loadState();
    const elapsed = Date.now() - saved.lastTickTime;
    const missed = Math.min(Math.floor(elapsed / TICK_INTERVAL_MS), MAX_OFFLINE_TICKS);
    if (missed > 0) { const { state: ns } = processTicks(saved, missed, true); ns.lastTickTime = Date.now(); saveState(ns); setFarmSave(ns); } else { setFarmSave(saved); }
  }, []);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      setFarmSave(prev => {
        const { state: ns, pops } = processTicks(prev, 1, false);
        ns.lastTickTime = Date.now(); saveState(ns);
        if (pops.length) setCoinPops(cur => [...cur, ...pops]);
        return ns;
      });
    }, TICK_INTERVAL_MS);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const harvestMutation = useMutation({
    mutationFn: (coins: number) => apiRequest("POST", "/api/farm/harvest", { coins }),
    onSuccess: (data: any) => {
      if (data.user) updateUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: `🌾 Harvest! +${data.coinsAdded} EduCoins`, description: `Day ${farmSave.day + 1} begins!` });
      setFarmSave(prev => { const ns = { ...prev, farmBank: 0, day: prev.day + 1 }; saveState(ns); return ns; });
      setIsHarvesting(false);
    },
    onError: () => { toast({ title: "Harvest failed", variant: "destructive" }); setIsHarvesting(false); },
  });

  const spendMutation = useMutation({
    mutationFn: (amount: number) => apiRequest("POST", "/api/coins/spend", { amount }),
    onSuccess: (data: any) => { if (data.user) updateUser(data.user); queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }); },
  });

  const handleBuy = useCallback((b: BuildingDef) => {
    if (!user || user.eduCoins < b.buyCost) { toast({ title: "Not enough EduCoins", variant: "destructive" }); return; }
    spendMutation.mutate(b.buyCost, {
      onSuccess: () => {
        setFarmSave(prev => { const ns = { ...prev, owned: { ...prev.owned, [b.id]: 1 } }; saveState(ns); return ns; });
        setSelected(null);
        toast({ title: `${b.emoji} ${b.name} built!` });
      },
    });
  }, [user, spendMutation, toast]);

  const handleUpgrade = useCallback((b: BuildingDef) => {
    if (!user) return;
    const lv = farmSave.owned[b.id] || 0;
    if (!lv || lv >= 3) return;
    const cost = b.upgradeCost[lv - 1];
    if (user.eduCoins < cost) { toast({ title: "Not enough EduCoins", variant: "destructive" }); return; }
    spendMutation.mutate(cost, {
      onSuccess: () => {
        const nl = lv + 1;
        setFarmSave(prev => { const ns = { ...prev, owned: { ...prev.owned, [b.id]: nl } }; saveState(ns); return ns; });
        setSelected(null);
        toast({ title: `⬆️ ${b.name} → Level ${nl}!` });
      },
    });
  }, [user, farmSave.owned, spendMutation, toast]);

  const [viewSize, setViewSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => { const r = () => setViewSize({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener("resize", r); return () => window.removeEventListener("resize", r); }, []);

  if (!user) return null;

  const totalOwned = Object.values(farmSave.owned).filter(v => v > 0).length;
  const farmRating = totalOwned === 0 ? "Empty Farm" : totalOwned < 4 ? "Seedling" : totalOwned < 8 ? "Growing" : totalOwned < 12 ? "Thriving" : "Legendary";
  const incomePerMin = BUILDINGS.reduce((s, b) => { const lv = farmSave.owned[b.id] || 0; return lv ? s + (b.incomePerTick[lv - 1] / b.tickMultiplier) * 2 : s; }, 0);
  const sx = Math.min(1.1, (viewSize.w - 10) / CANVAS_W);
  const sy = Math.min(1.1, (viewSize.h - 70) / CANVAS_H);
  const boardScale = Math.min(sx, sy);

  const hasChickens = (farmSave.owned["chicken_coop"] || 0) > 0;
  const hasCows = (farmSave.owned["dairy_cows"] || 0) > 0;

  const sortedBuildings = [...BUILDINGS].sort((a, b) => (a.col + a.row) - (b.col + b.row));

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: "linear-gradient(180deg, #87CEEB 0%, #B4E4FF 30%, #9DC654 48%, #7CB342 52%, #5A9A2A 100%)" }}>
      <style>{`
        @keyframes cloudDrift { 0% { transform: translateX(-200px); } 100% { transform: translateX(calc(100vw + 200px)); } }
        @keyframes cloudDrift2 { 0% { transform: translateX(calc(100vw + 200px)); } 100% { transform: translateX(-200px); } }
        @keyframes windmillSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes chickenWalk { 0% { transform: translateX(0) scaleX(1); } 45% { transform: translateX(60px) scaleX(1); } 50% { transform: translateX(60px) scaleX(-1); } 95% { transform: translateX(0) scaleX(-1); } 100% { transform: translateX(0) scaleX(1); } }
        @keyframes cowGraze { 0% { transform: translateX(0); } 40% { transform: translateX(40px); } 60% { transform: translateX(40px); } 100% { transform: translateX(0); } }
        @keyframes tractorDrive { 0% { transform: translateX(-30px) scaleX(1); } 50% { transform: translateX(30px) scaleX(1); } 51% { transform: translateX(30px) scaleX(-1); } 99% { transform: translateX(-30px) scaleX(-1); } 100% { transform: translateX(-30px) scaleX(1); } }
        @keyframes birdFly { 0% { transform: translateX(-80px) translateY(0); } 50% { transform: translateX(50vw) translateY(-12px); } 100% { transform: translateX(100vw) translateY(5px); } }
        @keyframes sunPulse { 0%,100% { filter: drop-shadow(0 0 15px rgba(255,200,50,0.5)); } 50% { filter: drop-shadow(0 0 30px rgba(255,200,50,0.8)); } }
        .iso-tile { cursor: pointer; transition: transform 0.15s ease, filter 0.15s ease; }
        .iso-tile:hover { transform: translateY(-6px) scale(1.03); filter: brightness(1.1); z-index: 100 !important; }
        .iso-tile:active { transform: translateY(-2px) scale(0.98); }
      `}</style>

      {[
        { w: 130, h: 40, top: "6%", dur: "50s", del: "0s", op: 0.9 },
        { w: 95, h: 30, top: "3%", dur: "60s", del: "-20s", op: 0.7 },
        { w: 150, h: 45, top: "12%", dur: "70s", del: "-35s", op: 0.8 },
        { w: 80, h: 25, top: "9%", dur: "55s", del: "-10s", op: 0.65 },
      ].map((c, i) => (
        <div key={`cloud-${i}`} className="absolute" style={{ top: c.top, width: c.w, height: c.h, opacity: c.op, animation: `${i % 2 === 0 ? 'cloudDrift' : 'cloudDrift2'} ${c.dur} linear infinite`, animationDelay: c.del }}>
          <svg viewBox="0 0 140 50" width="100%" height="100%">
            <ellipse cx="70" cy="30" rx="60" ry="18" fill="white"/><ellipse cx="45" cy="25" rx="35" ry="16" fill="white"/><ellipse cx="95" cy="25" rx="35" ry="16" fill="white"/><ellipse cx="70" cy="20" rx="40" ry="15" fill="white"/>
          </svg>
        </div>
      ))}

      <svg className="absolute" style={{ top: "3%", left: "8%", animation: "sunPulse 4s ease-in-out infinite" }} width="50" height="50" viewBox="0 0 50 50">
        <circle cx="25" cy="25" r="15" fill="#FFD54F"/><circle cx="25" cy="25" r="11" fill="#FFEB3B"/>
        {[0,45,90,135,180,225,270,315].map(a => { const r = a * Math.PI / 180; return <line key={a} x1={25+Math.cos(r)*18} y1={25+Math.sin(r)*18} x2={25+Math.cos(r)*23} y2={25+Math.sin(r)*23} stroke="#FFD54F" strokeWidth="2.5" strokeLinecap="round"/>; })}
      </svg>

      {[0,1].map(i => (
        <svg key={`bird-${i}`} className="absolute" width="14" height="8" style={{ top: `${5+i*6}%`, animation: `birdFly ${16+i*8}s linear infinite`, animationDelay: `${-i*6}s` }}>
          <path d="M0 4 L4 1 M8 4 L4 1" stroke="#37474F" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      ))}

      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: 50 }}>
        <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${boardScale})`, transformOrigin: "top center" }}>

          <svg className="absolute inset-0" width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
            <defs>
              <linearGradient id="plotCrops" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#A67C00"/><stop offset="100%" stopColor="#8B6914"/></linearGradient>
              <linearGradient id="plotLive" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7CB342"/><stop offset="100%" stopColor="#558B2F"/></linearGradient>
              <linearGradient id="plotBuild" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#BDBDBD"/><stop offset="100%" stopColor="#9E9E9E"/></linearGradient>
              <linearGradient id="plotEquip" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#90A4AE"/><stop offset="100%" stopColor="#607D8B"/></linearGradient>
              <linearGradient id="plotLocked" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B7355"/><stop offset="100%" stopColor="#6B5B45"/></linearGradient>
              <linearGradient id="roadG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#C8A87A"/><stop offset="100%" stopColor="#A88A58"/></linearGradient>
            </defs>

            {BUILDINGS.map(b => {
              const { x, y } = isoPos(b.col, b.row);
              const innerHW = ISO_HALF_W - 6;
              const innerHH = ISO_HALF_H - 3;
              return (
                <g key={`road-${b.id}`}>
                  {b.col < 3 && (() => {
                    const next = isoPos(b.col + 1, b.row);
                    const mx = (x + next.x) / 2;
                    const my = (y + next.y) / 2;
                    return <polygon points={`${x + innerHW * 0.5},${y} ${next.x - innerHW * 0.5},${next.y} ${next.x - innerHW * 0.3},${next.y + 8} ${x + innerHW * 0.3},${y + 8}`} fill="url(#roadG)" opacity="0.6"/>;
                  })()}
                  {b.row < 2 && (() => {
                    const next = isoPos(b.col, b.row + 1);
                    return <polygon points={`${x},${y + innerHH * 0.5} ${next.x},${next.y - innerHH * 0.5} ${next.x - 8},${next.y - innerHH * 0.3} ${x - 8},${y + innerHH * 0.3}`} fill="url(#roadG)" opacity="0.6"/>;
                  })()}
                </g>
              );
            })}

            {BUILDINGS.map(b => {
              const { x, y } = isoPos(b.col, b.row);
              const owned = (farmSave.owned[b.id] || 0) > 0;
              const level = farmSave.owned[b.id] || 0;
              const plotId = owned ? CAT_PLOT_ID[b.category] : "plotLocked";
              const outerHW = ISO_HALF_W - 2;
              const outerHH = ISO_HALF_H - 1;
              return (
                <g key={`plot-${b.id}`}>
                  <polygon points={diamondPoints(x, y, outerHW + 4, outerHH + 2)} fill="rgba(0,0,0,0.08)"/>
                  <polygon points={diamondPoints(x, y, outerHW, outerHH)} fill={`url(#${plotId})`} stroke={owned ? PLOT_COLORS[b.category].stroke : "#5a4a3a"} strokeWidth="2"/>
                  <polygon points={diamondPoints(x, y, outerHW, outerHH)} fill="rgba(255,255,255,0.06)"/>
                  {!owned && (
                    <>
                      <line x1={x - outerHW * 0.6} y1={y - outerHH * 0.1} x2={x + outerHW * 0.6} y2={y - outerHH * 0.1} stroke="#5a4a3a" strokeWidth="1" opacity="0.3" strokeDasharray="6 4"/>
                      <line x1={x - outerHW * 0.4} y1={y + outerHH * 0.3} x2={x + outerHW * 0.4} y2={y + outerHH * 0.3} stroke="#5a4a3a" strokeWidth="1" opacity="0.3" strokeDasharray="6 4"/>
                    </>
                  )}
                </g>
              );
            })}

            {[
              { x: 60, y: 200 }, { x: 1060, y: 180 }, { x: 80, y: 400 },
              { x: 1040, y: 380 }, { x: 160, y: 100 }, { x: 960, y: 90 },
              { x: 50, y: 320 }, { x: 1070, y: 300 },
            ].map((t, i) => (
              <g key={`tree-${i}`} opacity="0.85">
                <ellipse cx={t.x} cy={t.y + 35} rx={12} ry={4} fill="rgba(0,0,0,0.1)"/>
                <rect x={t.x - 4} y={t.y + 10} width="8" height="22" rx="3" fill="#5D4037"/>
                <circle cx={t.x} cy={t.y + 5} r="18" fill="#2E7D32"/>
                <circle cx={t.x - 5} cy={t.y} r="12" fill="#388E3C"/>
                <circle cx={t.x + 5} cy={t.y} r="12" fill="#388E3C"/>
                <circle cx={t.x} cy={t.y - 6} r="10" fill="#43A047"/>
                <circle cx={t.x - 3} cy={t.y - 9} r="5" fill="#66BB6A" opacity="0.5"/>
              </g>
            ))}

            {[
              { x: 180, y: 520 }, { x: 380, y: 510 }, { x: 600, y: 530 },
              { x: 800, y: 515 }, { x: 950, y: 525 },
            ].map((b, i) => (
              <g key={`bush-${i}`} opacity="0.6">
                <ellipse cx={b.x} cy={b.y} rx={14 + (i % 3) * 4} ry={8 + (i % 2) * 3} fill="#388E3C"/>
                <ellipse cx={b.x - 6} cy={b.y - 3} rx={8} ry={5} fill="#43A047"/>
                <ellipse cx={b.x + 6} cy={b.y - 2} rx={9} ry={5} fill="#43A047"/>
              </g>
            ))}

            {[
              [250, 165], [420, 320], [700, 165], [550, 80], [850, 320],
            ].map(([fx, fy], i) => (
              <g key={`flw-${i}`} opacity="0.6">
                <circle cx={fx} cy={fy} r="2.5" fill={["#FFD700","#FF7043","#E040FB","#FFC107","#FF5722"][i]}/>
                <circle cx={fx + 6} cy={fy + 2} r="2" fill={["#FF7043","#E040FB","#FFD700","#FF5722","#FFC107"][i]}/>
              </g>
            ))}
          </svg>

          {sortedBuildings.map(b => {
            const level = farmSave.owned[b.id] || 0;
            const isOwned = level > 0;
            const isMaxed = level === 3;
            const { x, y } = isoPos(b.col, b.row);
            const bldgW = 170;
            const bldgH = 130;
            const depth = b.col + b.row;

            return (
              <div
                key={b.id}
                className="absolute iso-tile"
                style={{
                  left: x - bldgW / 2,
                  top: y - bldgH * 0.7,
                  width: bldgW,
                  height: bldgH,
                  zIndex: 10 + depth * 3,
                }}
                onClick={() => setSelected(b)}
                data-testid={`tile-${b.id}`}
              >
                {isOwned ? (
                  <div className="w-full h-full" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))" }}>
                    <BuildingSVG buildingId={b.id} level={level}/>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}>
                    <div className="flex flex-col items-center gap-1 py-3 px-4 rounded-xl" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(200,180,140,0.7)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <span style={{ color: "#FFD700", fontSize: 12, fontWeight: 800 }}>🪙 {b.buyCost}</span>
                    </div>
                  </div>
                )}

                <div className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1" style={{
                  top: -20,
                  padding: "2px 8px",
                  borderRadius: 12,
                  fontSize: 10,
                  fontWeight: 800,
                  background: "rgba(0,0,0,0.7)",
                  color: isOwned ? "#FFD700" : "#bbb",
                  backdropFilter: "blur(4px)",
                  border: isOwned ? "1px solid rgba(255,215,0,0.3)" : "1px solid rgba(255,255,255,0.1)",
                }}>
                  {b.name}
                  {isOwned && level > 0 && (
                    <span style={{ fontSize: 8, padding: "0 4px", borderRadius: 6, fontWeight: 900, background: level === 1 ? "#F5A623" : level === 2 ? "#2196F3" : "#9C27B0", color: "white" }}>
                      {LVL_LABEL[level]}
                    </span>
                  )}
                  {isMaxed && <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-300"/>}
                </div>

                {isOwned && (
                  <div className="absolute left-1/2 -translate-x-1/2" style={{
                    bottom: -4,
                    background: "rgba(0,0,0,0.7)",
                    color: "#FFD700",
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "1px 6px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,215,0,0.2)",
                    backdropFilter: "blur(4px)",
                    whiteSpace: "nowrap",
                  }}>
                    +{b.incomePerTick[level - 1]}🪙/{b.tickMultiplier * 30}s
                  </div>
                )}
              </div>
            );
          })}

          {hasChickens && [0,1,2].map(i => {
            const cp = isoPos(0, 1);
            return (
              <div key={`ck-${i}`} className="absolute pointer-events-none" style={{ left: cp.x - 50 + i * 20, top: cp.y + 20 + i * 5, zIndex: 20 + i, animation: `chickenWalk ${7+i*2}s linear infinite`, animationDelay: `${-i*2}s` }}>
                <svg width="14" height="12" viewBox="0 0 14 12">
                  <ellipse cx="7" cy="7" rx="5" ry="4" fill={i===0?"#FFF":i===1?"#FFF5E0":"#DDD"}/>
                  <circle cx="11" cy="4" r="3.5" fill={i===0?"#FFF":"#FFF5E0"}/>
                  <polygon points="13,3.5 16,2.5 13,1.5" fill="#E8730C"/>
                  <circle cx="11.5" cy="3.2" r="1" fill="#1a1a1a"/>
                  <polygon points="10,1 9,-1 11,-1" fill="#DC2626"/>
                </svg>
              </div>
            );
          })}

          {hasCows && [0,1].map(i => {
            const cp = isoPos(1, 1);
            return (
              <div key={`cow-${i}`} className="absolute pointer-events-none" style={{ left: cp.x - 20 + i * 40, top: cp.y + 15 + i * 8, zIndex: 22, animation: `cowGraze ${12+i*4}s ease-in-out infinite`, animationDelay: `${-i*3}s` }}>
                <svg width="30" height="20" viewBox="0 0 30 20">
                  <ellipse cx="15" cy="10" rx="12" ry="7" fill="#FAFAFA"/>
                  <ellipse cx="9" cy="9" rx="5" ry="4" fill={i===0?"#333":"#8B6914"} opacity="0.6"/>
                  <rect x="4" y="14" width="4" height="6" rx="2" fill="#FAFAFA"/>
                  <rect x="10" y="14" width="4" height="6" rx="2" fill="#FAFAFA"/>
                  <rect x="16" y="14" width="4" height="6" rx="2" fill="#FAFAFA"/>
                  <rect x="22" y="14" width="4" height="6" rx="2" fill="#FAFAFA"/>
                  <circle cx="26" cy="5" r="5" fill="#FAFAFA"/>
                  <ellipse cx="28.5" cy="7" rx="2.5" ry="2" fill="#FFB4B4"/>
                  <circle cx="25" cy="3.5" r="1.3" fill="#333"/>
                </svg>
              </div>
            );
          })}


          <AnimatePresence>
            {coinPops.map(pop => {
              const b = BUILDINGS.find(bb => bb.id === pop.bId);
              if (!b) return null;
              const { x, y } = isoPos(b.col, b.row);
              return (
                <motion.div key={pop.id} className="absolute pointer-events-none z-50 flex items-center gap-1" style={{ left: x, top: y - 80, transform: "translate(-50%, 0)" }}
                  initial={{ opacity: 1, y: 0, scale: 0.8 }} animate={{ opacity: 0, y: -50, scale: 1.3 }} exit={{ opacity: 0 }} transition={{ duration: 1.5, ease: "easeOut" }}
                  onAnimationComplete={() => setCoinPops(cur => cur.filter(p => p.id !== pop.id))}
                >
                  <span className="font-black text-sm" style={{ color: "#FFD700", textShadow: "0 2px 6px rgba(0,0,0,0.7)" }}>+{pop.amount}</span>
                  <span className="text-base">🪙</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 z-30 px-3 py-2 flex items-center gap-2 flex-wrap" style={{ background: "linear-gradient(180deg, rgba(30,20,10,0.8) 0%, rgba(50,35,20,0.6) 70%, transparent 100%)", paddingBottom: 14 }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FFD700, #F5A623)", boxShadow: "0 2px 8px rgba(245,166,35,0.4)" }}>
            <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="#F57F17"/><circle cx="9" cy="9" r="5" fill="#FFD54F"/></svg>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest leading-none" style={{ fontFamily: "Oxanium, sans-serif", color: "#FFD700", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>FARM TYCOON</h1>
            <p className="text-[10px] font-semibold" style={{ color: "#C8A84E" }}>Day {farmSave.day} · {farmRating}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-1 justify-end flex-wrap">
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(76,175,80,0.2)", color: "#A8D8A8", border: "1px solid rgba(76,175,80,0.3)" }}>⚡ {Math.round(incomePerMin)}/min</div>
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(33,150,243,0.2)", color: "#90CAF9", border: "1px solid rgba(33,150,243,0.3)" }}>🏗️ {totalOwned}/12</div>
          {farmSave.farmBank > 0 && (
            <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="flex items-center gap-1 px-3 py-1 rounded-xl text-sm font-black" style={{ background: "linear-gradient(135deg, rgba(46,125,50,0.9), rgba(67,160,71,0.9))", color: "white", boxShadow: "0 2px 12px rgba(46,125,50,0.5)", border: "1px solid rgba(255,255,255,0.2)" }}>🌾 {farmSave.farmBank}</motion.div>
          )}
          <div className="flex items-center gap-1 px-3 py-1 rounded-xl text-sm font-black" style={{ background: "linear-gradient(135deg, #F5A623, #FFD700)", color: "#5D4037", boxShadow: "0 2px 8px rgba(245,166,35,0.4)" }}><Coins className="w-4 h-4"/>{user.eduCoins}</div>
          <Button size="sm" className="h-8 px-4 text-xs font-black" style={{ background: farmSave.farmBank > 0 ? "linear-gradient(135deg, #2E7D32, #1B5E20)" : "rgba(255,255,255,0.1)", color: farmSave.farmBank > 0 ? "white" : "rgba(200,168,78,0.5)", border: farmSave.farmBank > 0 ? "2px solid #4CAF50" : "2px solid transparent", boxShadow: farmSave.farmBank > 0 ? "0 2px 12px rgba(46,125,50,0.4)" : "none" }}
            disabled={farmSave.farmBank === 0 || harvestMutation.isPending}
            onClick={() => { setIsHarvesting(true); harvestMutation.mutate(farmSave.farmBank); }}
            data-testid="button-harvest"
          >
            {harvestMutation.isPending ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7 }}>🔄</motion.span> : `🌾 HARVEST${farmSave.farmBank > 0 ? ` +${farmSave.farmBank}` : ""}`}
          </Button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 text-center pb-2">
        <p className="text-[11px] font-medium px-4 py-1 rounded-full inline-block" style={{ background: "rgba(30,20,10,0.5)", color: "rgba(200,180,140,0.7)", backdropFilter: "blur(6px)" }}>
          Tap any plot to build or upgrade · Income every 30s · Harvest to collect
        </p>
      </div>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}/>
            <BuildingModal b={selected} level={farmSave.owned[selected.id] || 0} userCoins={user.eduCoins} onBuy={() => handleBuy(selected)} onUpgrade={() => handleUpgrade(selected)} onClose={() => setSelected(null)} isPending={spendMutation.isPending}/>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHarvesting && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="text-8xl" animate={{ scale: [0.5, 1.4, 1], rotate: [0, 15, -15, 0] }} transition={{ duration: 0.8 }}>🌾</motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BuildingModal({ b, level, userCoins, onBuy, onUpgrade, onClose, isPending }: {
  b: BuildingDef; level: number; userCoins: number; onBuy: () => void; onUpgrade: () => void; onClose: () => void; isPending: boolean;
}) {
  const action = level === 0 ? { type: "buy" as const, label: "Build", cost: b.buyCost } : level < 3 ? { type: "upgrade" as const, label: `Upgrade → Level ${level + 1}`, cost: b.upgradeCost[level - 1] } : null;
  const canAfford = action ? userCoins >= action.cost : true;

  return (
    <motion.div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-6" initial={{ y: 220, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 220, opacity: 0 }} transition={{ type: "spring", damping: 28, stiffness: 320 }}>
      <div className="max-w-lg mx-auto overflow-hidden" style={{ background: "linear-gradient(180deg, #F5F0DC 0%, #FAFAF5 100%)", borderRadius: 20, boxShadow: "0 -4px 40px rgba(0,0,0,0.3), 0 0 0 3px rgba(139,105,20,0.3)", border: "2px solid rgba(139,105,20,0.2)" }}>
        <div className="h-40 w-full overflow-hidden" style={{ background: "linear-gradient(135deg, #E8E0CC, #D4C8A8)" }}>
          <div className="w-full h-full">{level > 0 ? <BuildingSVG buildingId={b.id} level={level}/> : <LockedFieldSVG cost={b.buyCost}/>}</div>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{b.emoji}</span>
                <h3 className="font-black text-lg" style={{ fontFamily: "Oxanium, sans-serif", color: "#3E2716" }}>{b.name}</h3>
                {level > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: level === 1 ? "#F5A623" : level === 2 ? "#2196F3" : "#9C27B0" }}>{LVL_LABEL[level]}</span>}
              </div>
              <p className="text-xs font-semibold capitalize" style={{ color: CAT_HEX[b.category] }}>{b.category}</p>
              <p className="text-xs mt-0.5" style={{ color: "#8B7355" }}>{b.description}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center ml-2 flex-shrink-0" style={{ background: "rgba(139,105,20,0.1)" }}><X className="w-4 h-4" style={{ color: "#8B6914" }}/></button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {b.incomePerTick.map((inc, i) => (
              <div key={i} className="rounded-xl p-2.5 text-center" style={{ border: level === i + 1 ? "2px solid #43A047" : "2px solid #E0D8C0", background: level === i + 1 ? "rgba(67,160,71,0.08)" : "rgba(0,0,0,0.02)", opacity: level < i + 1 ? 0.5 : 1 }}>
                <div className="font-black text-base" style={{ color: "#2E7D32" }}>+{inc}🪙</div>
                <div className="text-[10px] font-medium" style={{ color: "#8B7355" }}>Level {i + 1}</div>
                <div className="text-[9px]" style={{ color: "#A89070" }}>every {b.tickMultiplier * 30}s</div>
                {level === i + 1 && <div className="text-[9px] font-bold" style={{ color: "#43A047" }}>✓ ACTIVE</div>}
              </div>
            ))}
          </div>
          {level === 3 ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(156,39,176,0.08), rgba(156,39,176,0.15))", border: "2px solid rgba(156,39,176,0.3)" }}>
              <Star className="w-5 h-5" style={{ color: "#9C27B0", fill: "#CE93D8" }}/><span className="font-black" style={{ color: "#7B1FA2" }}>FULLY MAXED OUT</span>
            </div>
          ) : action ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-sm"><Coins className="w-4 h-4" style={{ color: "#F5A623" }}/><span className="font-bold" style={{ color: "#3E2716" }}>{userCoins}</span><span className="text-xs" style={{ color: "#A89070" }}>available</span></div>
              <Button className="flex-1 font-bold h-11 text-base text-white" style={{ background: action.type === "buy" ? "linear-gradient(135deg, #2E7D32, #1B5E20)" : "linear-gradient(135deg, #1565C0, #0D47A1)", boxShadow: action.type === "buy" ? "0 3px 12px rgba(46,125,50,0.4)" : "0 3px 12px rgba(21,101,192,0.4)" }}
                onClick={action.type === "buy" ? onBuy : onUpgrade} disabled={!canAfford || isPending} data-testid={`btn-${action.type}-${b.id}`}>
                {action.type === "buy" ? <><ShoppingCart className="w-4 h-4 mr-2"/> {action.label} · {action.cost} coins</> : <><ArrowUpCircle className="w-4 h-4 mr-2"/> {action.label} · {action.cost} coins</>}
              </Button>
            </div>
          ) : null}
          {action && !canAfford && <p className="text-center text-xs mt-2 font-medium" style={{ color: "#C62828" }}>Need {action.cost - userCoins} more EduCoins</p>}
        </div>
      </div>
    </motion.div>
  );
}
