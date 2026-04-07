import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Coins, Star, Sun, X, ArrowUpCircle, ShoppingCart, Lock } from "lucide-react";
import {
  BuildingSVG, LockedFieldSVG, TreeSVG,
  WheatFieldSVG, VegetablePatchSVG, AppleOrchardSVG, GreenhouseSVG,
  ChickenCoopSVG, DairyCowsSVG, FarmhouseSVG, WindmillSVG,
  BarnSVG, TractorSVG, GrainSiloSVG, IrrigationSVG,
} from "@/components/farm-buildings";

// ── Constants ─────────────────────────────────────────────────────────────────
const TICK_INTERVAL_MS = 30_000;
const MAX_FARM_BANK    = 500;
const MAX_OFFLINE_TICKS = 20;
const FARM_STATE_KEY   = "farm_v2_state";

// ── Building catalogue ────────────────────────────────────────────────────────
interface BuildingDef {
  id: string; name: string; emoji: string; icon: string;
  description: string;
  category: "crops" | "buildings" | "livestock" | "equipment";
  buyCost: number; upgradeCost: [number, number];
  incomePerTick: [number, number, number];
  tickMultiplier: number;
  // position on the farm canvas (px from top-left)
  x: number; y: number; w: number; h: number;
}

const BUILDINGS: BuildingDef[] = [
  // Row 1 — Crops
  { id: "wheat_field",     name: "Wheat Field",     emoji: "🌾", icon: "🌾",
    description: "Golden wheat rows — steady income every 30 seconds.",
    category: "crops",     buyCost: 30,  upgradeCost: [60,  120], incomePerTick: [2,  5,  10], tickMultiplier: 1,
    x: 20,  y: 20,  w: 195, h: 148 },
  { id: "vegetable_patch", name: "Vegetable Patch",  emoji: "🥕", icon: "🥕",
    description: "Fresh vegetables that grow faster every level.",
    category: "crops",     buyCost: 50,  upgradeCost: [100, 200], incomePerTick: [3,  7,  14], tickMultiplier: 1,
    x: 245, y: 20,  w: 195, h: 148 },
  { id: "apple_orchard",   name: "Apple Orchard",   emoji: "🍎", icon: "🍎",
    description: "Beautiful orchard trees heavy with red apples.",
    category: "crops",     buyCost: 80,  upgradeCost: [150, 300], incomePerTick: [4,  9,  18], tickMultiplier: 1,
    x: 470, y: 20,  w: 195, h: 148 },
  { id: "greenhouse",      name: "Greenhouse",       emoji: "🌿", icon: "🪴",
    description: "Year-round glass house for premium crops.",
    category: "crops",     buyCost: 120, upgradeCost: [240, 480], incomePerTick: [5,  11, 22], tickMultiplier: 1,
    x: 695, y: 20,  w: 195, h: 148 },

  // Row 2 — Livestock + Buildings
  { id: "chicken_coop",    name: "Chicken Coop",    emoji: "🐔", icon: "🐔",
    description: "Free-range hens — income every 60 seconds.",
    category: "livestock", buyCost: 55,  upgradeCost: [110, 220], incomePerTick: [4,  8,  16], tickMultiplier: 2,
    x: 20,  y: 198, w: 195, h: 148 },
  { id: "dairy_cows",      name: "Dairy Cows",      emoji: "🐄", icon: "🐄",
    description: "Happy cows producing fresh milk and steady income.",
    category: "livestock", buyCost: 90,  upgradeCost: [180, 360], incomePerTick: [5,  11, 22], tickMultiplier: 2,
    x: 245, y: 198, w: 195, h: 148 },
  { id: "farmhouse",       name: "Farmhouse",        emoji: "🏠", icon: "🏡",
    description: "Your home base — upgrade it to unlock more workers.",
    category: "buildings", buyCost: 40,  upgradeCost: [90,  180], incomePerTick: [3,  6,  13], tickMultiplier: 2,
    x: 470, y: 198, w: 195, h: 148 },
  { id: "windmill",        name: "Windmill",         emoji: "⚙️", icon: "🎡",
    description: "Harnessing wind power to boost the whole farm.",
    category: "buildings", buyCost: 100, upgradeCost: [200, 400], incomePerTick: [6,  12, 24], tickMultiplier: 2,
    x: 695, y: 198, w: 195, h: 148 },

  // Row 3 — Equipment + Storage
  { id: "barn",            name: "Red Barn",         emoji: "🏚️", icon: "🏚️",
    description: "Classic red barn for storing grain and tools.",
    category: "buildings", buyCost: 70,  upgradeCost: [140, 280], incomePerTick: [5,  10, 20], tickMultiplier: 3,
    x: 20,  y: 376, w: 195, h: 148 },
  { id: "tractor",         name: "Tractor",          emoji: "🚜", icon: "🚜",
    description: "Heavy-duty machine that speeds up all operations.",
    category: "equipment", buyCost: 150, upgradeCost: [300, 600], incomePerTick: [8,  16, 32], tickMultiplier: 3,
    x: 245, y: 376, w: 195, h: 148 },
  { id: "silo",            name: "Grain Silo",       emoji: "🏗️", icon: "🏛️",
    description: "Store grain in bulk and sell at peak market prices.",
    category: "equipment", buyCost: 130, upgradeCost: [260, 520], incomePerTick: [7,  14, 28], tickMultiplier: 3,
    x: 470, y: 376, w: 195, h: 148 },
  { id: "irrigation",      name: "Irrigation",       emoji: "💧", icon: "💦",
    description: "Automated water system for the entire farm.",
    category: "equipment", buyCost: 110, upgradeCost: [220, 440], incomePerTick: [6,  13, 26], tickMultiplier: 3,
    x: 695, y: 376, w: 195, h: 148 },
];

// ── Farm state ─────────────────────────────────────────────────────────────────
type FarmSave = {
  owned: Record<string, number>;
  farmBank: number;
  lastTickTime: number;
  tickCounters: Record<string, number>;
  day: number;
};

function loadState(): FarmSave {
  try {
    const raw = localStorage.getItem(FARM_STATE_KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch {}
  return defaultState();
}

function defaultState(): FarmSave {
  return { owned: {}, farmBank: 0, lastTickTime: Date.now(), tickCounters: {}, day: 1 };
}

function saveState(s: FarmSave) {
  localStorage.setItem(FARM_STATE_KEY, JSON.stringify(s));
}

function processTicks(state: FarmSave, n: number, silent = false) {
  let farmBank = state.farmBank;
  const tickCounters = { ...state.tickCounters };
  const pops: Array<{ id: string; x: number; y: number; amount: number }> = [];

  for (let t = 0; t < n; t++) {
    for (const b of BUILDINGS) {
      const lv = state.owned[b.id] || 0;
      if (!lv) continue;
      tickCounters[b.id] = (tickCounters[b.id] || 0) + 1;
      if (tickCounters[b.id] >= b.tickMultiplier) {
        tickCounters[b.id] = 0;
        const income = b.incomePerTick[lv - 1];
        farmBank = Math.min(farmBank + income, MAX_FARM_BANK);
        if (!silent) {
          pops.push({
            id: `${b.id}-${Date.now()}-${Math.random()}`,
            x: b.x + b.w / 2,
            y: b.y,
            amount: income,
          });
        }
      }
    }
  }
  return { state: { ...state, farmBank, tickCounters }, pops };
}

// ── Visual helpers ─────────────────────────────────────────────────────────────
const LVL_RING_COLOR  = ["", "#fbbf24", "#60a5fa", "#c084fc"];
const LVL_BG          = ["", "bg-yellow-500", "bg-blue-500", "bg-purple-600"];
const LVL_LABEL       = ["", "LV1", "LV2", "LV3★"];
const CAT_COLOR: Record<string, string> = {
  crops: "text-emerald-400", buildings: "text-blue-400",
  livestock: "text-amber-400", equipment: "text-violet-400",
};

const CAT_HEX: Record<string, string> = {
  crops: "#43A047", buildings: "#1565C0",
  livestock: "#E8730C", equipment: "#7B1FA2",
};

type CoinPop = { id: string; x: number; y: number; amount: number };

// ── Farm canvas dims ───────────────────────────────────────────────────────────
const CANVAS_W = 910; // 4 cols × 195px + 3 gaps × 30px + 2 × 20px = 910
const CANVAS_H = 544; // 3 rows × 148px + 2 gaps × 30px + 2 × 20px = 544

// Decorative tree positions
const TREES = [
  { x: 50, y: -5, s: 0.55 },  // won't render if negative — skip
  { x: 850, y: 185, s: 0.6 },
  { x: 845, y: 360, s: 0.65 },
  { x: 5, y: 185, s: 0.5 },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FarmPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [farmSave, setFarmSave] = useState<FarmSave>(loadState);
  const [coinPops, setCoinPops] = useState<CoinPop[]>([]);
  const [selected, setSelected] = useState<BuildingDef | null>(null);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  // Process offline ticks on mount
  useEffect(() => {
    const saved = loadState();
    const elapsed = Date.now() - saved.lastTickTime;
    const missed = Math.min(Math.floor(elapsed / TICK_INTERVAL_MS), MAX_OFFLINE_TICKS);
    if (missed > 0) {
      const { state: ns } = processTicks(saved, missed, true);
      ns.lastTickTime = Date.now();
      saveState(ns);
      setFarmSave(ns);
    } else {
      setFarmSave(saved);
    }
  }, []);

  // Live tick loop
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setFarmSave(prev => {
        const { state: ns, pops } = processTicks(prev, 1, false);
        ns.lastTickTime = Date.now();
        saveState(ns);
        if (pops.length) setCoinPops(cur => [...cur, ...pops]);
        return ns;
      });
    }, TICK_INTERVAL_MS);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // Harvest API
  const harvestMutation = useMutation({
    mutationFn: (coins: number) => apiRequest("POST", "/api/farm/harvest", { coins }),
    onSuccess: (data: any) => {
      if (data.user) updateUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: `🌾 Harvest! +${data.coinsAdded} EduCoins`,
        description: `Day ${farmSave.day + 1} begins. Keep farming!`,
      });
      setFarmSave(prev => {
        const ns = { ...prev, farmBank: 0, day: prev.day + 1 };
        saveState(ns);
        return ns;
      });
      setIsHarvesting(false);
    },
    onError: () => { toast({ title: "Harvest failed", variant: "destructive" }); setIsHarvesting(false); },
  });

  const spendMutation = useMutation({
    mutationFn: (amount: number) => apiRequest("POST", "/api/coins/spend", { amount }),
    onSuccess: (data: any) => {
      if (data.user) updateUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const handleBuy = useCallback((b: BuildingDef) => {
    if (!user || user.eduCoins < b.buyCost) {
      toast({ title: "Not enough EduCoins", variant: "destructive" });
      return;
    }
    spendMutation.mutate(b.buyCost, {
      onSuccess: () => {
        setFarmSave(prev => { const ns = { ...prev, owned: { ...prev.owned, [b.id]: 1 } }; saveState(ns); return ns; });
        setSelected(null);
        toast({ title: `${b.emoji} ${b.name} built!`, description: `Earns +${b.incomePerTick[0]} coins every ${b.tickMultiplier * 30}s` });
      },
    });
  }, [user, spendMutation, toast]);

  const handleUpgrade = useCallback((b: BuildingDef) => {
    if (!user) return;
    const lv = farmSave.owned[b.id] || 0;
    if (!lv || lv >= 3) return;
    const cost = b.upgradeCost[lv - 1];
    if (user.eduCoins < cost) {
      toast({ title: "Not enough EduCoins", variant: "destructive" });
      return;
    }
    spendMutation.mutate(cost, {
      onSuccess: () => {
        const nl = lv + 1;
        setFarmSave(prev => { const ns = { ...prev, owned: { ...prev.owned, [b.id]: nl } }; saveState(ns); return ns; });
        setSelected(null);
        toast({ title: `⬆️ ${b.name} → Level ${nl}${nl === 3 ? " ★" : ""}!`, description: `Now earns +${b.incomePerTick[nl - 1]} coins every ${b.tickMultiplier * 30}s` });
      },
    });
  }, [user, farmSave.owned, spendMutation, toast]);

  if (!user) return null;

  const totalOwned = Object.values(farmSave.owned).filter(v => v > 0).length;
  const farmRating = totalOwned === 0 ? "Empty Farm" : totalOwned < 4 ? "Seedling" : totalOwned < 8 ? "Growing" : totalOwned < 12 ? "Thriving" : "Legendary";
  const incomePerMin = BUILDINGS.reduce((s, b) => {
    const lv = farmSave.owned[b.id] || 0;
    return lv ? s + (b.incomePerTick[lv - 1] / b.tickMultiplier) * 2 : s;
  }, 0);

  return (
    <div className="flex flex-col min-h-screen" style={{
      background: "linear-gradient(180deg, #87CEEB 0%, #5FB8E0 25%, #7EC850 45%, #5EAD3E 55%, #4A9030 100%)"
    }}>

      <div className="sticky top-0 z-30 px-3 py-2 flex items-center gap-2 flex-wrap"
        style={{
          background: "linear-gradient(180deg, rgba(62,39,22,0.92) 0%, rgba(90,60,35,0.88) 100%)",
          borderBottom: "3px solid #8B6914",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3), inset 0 -1px 0 rgba(255,200,80,0.2)"
        }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{
            background: "linear-gradient(135deg, #FFD700, #F5A623)",
            boxShadow: "0 2px 8px rgba(245,166,35,0.4)"
          }}>
            <Sun className="w-5 h-5 text-amber-900" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-wider leading-none"
              style={{ fontFamily: "Oxanium, sans-serif", color: "#FFD700", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
              FARM TYCOON
            </h1>
            <p className="text-[10px] font-semibold" style={{ color: "#C8A84E" }}>
              Day {farmSave.day} · {farmRating}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-1 justify-end flex-wrap">
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
            style={{ background: "rgba(255,255,255,0.1)", color: "#A8D8A8", border: "1px solid rgba(168,216,168,0.2)" }}>
            ⚡ {Math.round(incomePerMin)}/min
          </div>
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
            style={{ background: "rgba(255,255,255,0.1)", color: "#90CAF9", border: "1px solid rgba(144,202,249,0.2)" }}>
            🏗️ {totalOwned}/12
          </div>

          {farmSave.farmBank > 0 && (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black"
              style={{
                background: "linear-gradient(135deg, #2E7D32, #43A047)",
                color: "white",
                boxShadow: "0 2px 12px rgba(46,125,50,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.15)"
              }}
            >
              🌾 {farmSave.farmBank}
            </motion.div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black"
            style={{
              background: "linear-gradient(135deg, #F5A623, #FFD700)",
              color: "#5D4037",
              boxShadow: "0 2px 8px rgba(245,166,35,0.4)",
              border: "1px solid rgba(255,255,255,0.3)"
            }}>
            <Coins className="w-4 h-4" />
            {user.eduCoins}
          </div>

          <Button
            size="sm"
            className="h-9 px-4 text-xs font-black transition-all"
            style={{
              background: farmSave.farmBank > 0
                ? "linear-gradient(135deg, #2E7D32, #1B5E20)"
                : "rgba(255,255,255,0.1)",
              color: farmSave.farmBank > 0 ? "white" : "rgba(200,168,78,0.6)",
              border: farmSave.farmBank > 0 ? "2px solid #4CAF50" : "2px solid transparent",
              boxShadow: farmSave.farmBank > 0 ? "0 2px 12px rgba(46,125,50,0.4)" : "none"
            }}
            disabled={farmSave.farmBank === 0 || harvestMutation.isPending}
            onClick={() => { setIsHarvesting(true); harvestMutation.mutate(farmSave.farmBank); }}
            data-testid="button-harvest"
          >
            {harvestMutation.isPending
              ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7 }}>🔄</motion.span>
              : `🌾 HARVEST${farmSave.farmBank > 0 ? ` +${farmSave.farmBank}` : ""}`}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 md:p-6">
        <div className="relative mx-auto" style={{ width: CANVAS_W, height: CANVAS_H }}>

          <svg
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            width={CANVAS_W}
            height={CANVAS_H}
            className="absolute inset-0 overflow-hidden"
            style={{ borderRadius: 16 }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="farmGrass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5EAD3E"/>
                <stop offset="100%" stopColor="#4A8A2F"/>
              </linearGradient>
              <linearGradient id="farmPath" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C8A87A"/>
                <stop offset="50%" stopColor="#B89968"/>
                <stop offset="100%" stopColor="#A88A58"/>
              </linearGradient>
              <filter id="pathShadow">
                <feGaussianBlur stdDeviation="1.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <rect width={CANVAS_W} height={CANVAS_H} fill="url(#farmGrass)" rx="16"/>
            {Array.from({ length: 40 }).map((_, i) => (
              <ellipse key={i}
                cx={(i * 41 + 13) % CANVAS_W}
                cy={(i * 37 + 7) % CANVAS_H}
                rx={12 + (i % 3) * 6} ry={6 + (i % 2) * 4}
                fill={i % 2 === 0 ? "#52A034" : "#68B848"} opacity={0.25 + (i % 3) * 0.1}
              />
            ))}
            {Array.from({ length: 15 }).map((_, i) => {
              const gx = (i * 67 + 20) % CANVAS_W;
              const gy = (i * 43 + 30) % CANVAS_H;
              return (
                <g key={`grass${i}`} opacity="0.3">
                  <line x1={gx} y1={gy} x2={gx - 2} y2={gy - 8} stroke="#3D8A28" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1={gx + 3} y1={gy} x2={gx + 4} y2={gy - 7} stroke="#3D8A28" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1={gx + 6} y1={gy} x2={gx + 5} y2={gy - 6} stroke="#3D8A28" strokeWidth="1.5" strokeLinecap="round"/>
                </g>
              );
            })}
            <rect x="0" y="173" width={CANVAS_W} height="34" fill="url(#farmPath)"/>
            <rect x="0" y="351" width={CANVAS_W} height="34" fill="url(#farmPath)"/>
            <rect x="212" y="0" width="34" height={CANVAS_H} fill="url(#farmPath)"/>
            <rect x="437" y="0" width="34" height={CANVAS_H} fill="url(#farmPath)"/>
            <rect x="662" y="0" width="34" height={CANVAS_H} fill="url(#farmPath)"/>
            {[173, 351].map(py =>
              [212, 437, 662].map(px => (
                <rect key={`int-${px}-${py}`} x={px} y={py} width="34" height="34" fill="#A88A58"/>
              ))
            )}
            {[173, 207, 351, 385].map(y => (
              <line key={`h-${y}`} x1="0" y1={y} x2={CANVAS_W} y2={y} stroke="#9E8050" strokeWidth="1.5" opacity="0.5"/>
            ))}
            {[212, 246, 437, 471, 662, 696].map(x => (
              <line key={`v-${x}`} x1={x} y1="0" x2={x} y2={CANVAS_H} stroke="#9E8050" strokeWidth="1.5" opacity="0.5"/>
            ))}
            {[[228, 188],[228, 366],[454, 188],[454, 366],[680, 188],[680, 366]].map(([rx, ry], i) => (
              <g key={`rock-${i}`}>
                <ellipse cx={rx} cy={ry} rx="4" ry="2.5" fill="#8B7355" opacity="0.5"/>
                <ellipse cx={rx + 8} cy={ry + 3} rx="3" ry="2" fill="#7A6548" opacity="0.4"/>
              </g>
            ))}
            {[[100, 188], [330, 366], [560, 188], [780, 366]].map(([fx, fy], i) => (
              <g key={`flower-${i}`} opacity="0.5">
                <circle cx={fx} cy={fy} r="3" fill="#FFD700"/>
                <circle cx={fx + 12} cy={fy + 4} r="2.5" fill="#FF7043"/>
                <circle cx={fx - 8} cy={fy + 2} r="2" fill="#E040FB"/>
              </g>
            ))}
          </svg>

          {[
            { right: 5, top: 176, s: 0.7 },
            { right: 5, top: 354, s: 0.6 },
            { left: 5, top: 176, s: 0.55 },
            { left: 5, top: 354, s: 0.5 },
          ].map(({ s, ...stylePos }, i) => (
            <div key={`tree-${i}`} className="absolute pointer-events-none" style={{ ...stylePos, zIndex: 5 }}>
              <TreeSVG scale={s}/>
            </div>
          ))}

          {BUILDINGS.map(b => {
            const level = farmSave.owned[b.id] || 0;
            const isOwned = level > 0;
            const isMaxed = level === 3;

            return (
              <motion.div
                key={b.id}
                className="absolute cursor-pointer"
                style={{ left: b.x, top: b.y, width: b.w, height: b.h, zIndex: 2 }}
                whileHover={{ scale: 1.05, zIndex: 20 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setSelected(b)}
                data-testid={`tile-${b.id}`}
              >
                <div
                  className="w-full h-full overflow-hidden"
                  style={{
                    borderRadius: 12,
                    boxShadow: isOwned
                      ? `0 6px 24px rgba(0,0,0,0.3), 0 0 0 3px ${LVL_RING_COLOR[level]}, inset 0 1px 0 rgba(255,255,255,0.1)`
                      : "0 3px 12px rgba(0,0,0,0.25)",
                    border: isOwned ? "none" : "2px dashed rgba(139,107,53,0.4)"
                  }}
                >
                  {isOwned
                    ? <BuildingSVG buildingId={b.id} level={level}/>
                    : <LockedFieldSVG cost={b.buyCost}/>
                  }
                </div>

                <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap"
                  style={{
                    padding: "2px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 800,
                    background: isOwned
                      ? "linear-gradient(135deg, rgba(30,20,10,0.9), rgba(50,35,20,0.9))"
                      : "rgba(60,40,20,0.75)",
                    color: isOwned ? "#FFD700" : "#BDBDBD",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    border: isOwned ? "1px solid rgba(255,215,0,0.3)" : "1px solid rgba(100,80,50,0.3)"
                  }}>
                  {b.emoji} {b.name}
                  {isOwned && (
                    <span style={{
                      marginLeft: 6,
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 10,
                      fontWeight: 900,
                      background: level === 1 ? "#F5A623" : level === 2 ? "#2196F3" : "#9C27B0",
                      color: "white"
                    }}>
                      {LVL_LABEL[level]}
                    </span>
                  )}
                  {isMaxed && <Star className="inline w-3 h-3 ml-1 text-yellow-400 fill-yellow-300"/>}
                </div>

                {isOwned && (
                  <div className="absolute bottom-1.5 right-1.5" style={{
                    background: "linear-gradient(135deg, rgba(0,0,0,0.7), rgba(30,20,10,0.8))",
                    color: "#FFD700",
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,215,0,0.2)"
                  }}>
                    +{b.incomePerTick[level - 1]}🪙/{b.tickMultiplier * 30}s
                  </div>
                )}
              </motion.div>
            );
          })}

          <AnimatePresence>
            {coinPops.map(pop => (
              <motion.div
                key={pop.id}
                className="absolute pointer-events-none z-40 flex items-center gap-1"
                style={{ left: pop.x, top: pop.y, transform: "translate(-50%, -100%)" }}
                initial={{ opacity: 1, y: 0, scale: 0.8 }}
                animate={{ opacity: 0, y: -60, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                onAnimationComplete={() =>
                  setCoinPops(cur => cur.filter(p => p.id !== pop.id))
                }
              >
                <span className="font-black text-sm" style={{ color: "#FFD700", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}>+{pop.amount}</span>
                <span className="text-base">🪙</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs mt-3 font-medium" style={{ color: "rgba(62,39,22,0.5)" }}>
          Tap any plot to build or upgrade · Income generates every 30s · Harvest to collect your earnings
        </p>
      </div>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
            />
            <BuildingModal
              b={selected}
              level={farmSave.owned[selected.id] || 0}
              userCoins={user.eduCoins}
              onBuy={() => handleBuy(selected)}
              onUpgrade={() => handleUpgrade(selected)}
              onClose={() => setSelected(null)}
              isPending={spendMutation.isPending}
            />
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHarvesting && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-8xl"
              animate={{ scale: [0.5, 1.4, 1], rotate: [0, 15, -15, 0] }}
              transition={{ duration: 0.8 }}
            >
              🌾
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Building detail modal ──────────────────────────────────────────────────────
function BuildingModal({
  b, level, userCoins, onBuy, onUpgrade, onClose, isPending,
}: {
  b: BuildingDef; level: number; userCoins: number;
  onBuy: () => void; onUpgrade: () => void; onClose: () => void;
  isPending: boolean;
}) {
  const action = level === 0
    ? { type: "buy" as const,     label: "Build",             cost: b.buyCost }
    : level < 3
    ? { type: "upgrade" as const, label: `Upgrade → Level ${level + 1}`, cost: b.upgradeCost[level - 1] }
    : null;
  const canAfford = action ? userCoins >= action.cost : true;

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-6"
      initial={{ y: 220, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 220, opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 320 }}
    >
      <div className="max-w-lg mx-auto overflow-hidden" style={{
        background: "linear-gradient(180deg, #F5F0DC 0%, #FAFAF5 100%)",
        borderRadius: 20,
        boxShadow: "0 -4px 30px rgba(0,0,0,0.25), 0 0 0 3px rgba(139,105,20,0.3)",
        border: "2px solid rgba(139,105,20,0.2)"
      }}>
        <div className="h-40 w-full overflow-hidden" style={{
          background: "linear-gradient(135deg, #E8E0CC, #D4C8A8)"
        }}>
          <div className="w-full h-full">
            {level > 0
              ? <BuildingSVG buildingId={b.id} level={level}/>
              : <LockedFieldSVG cost={b.buyCost}/>
            }
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{b.emoji}</span>
                <h3 className="font-black text-lg" style={{ fontFamily: "Oxanium, sans-serif", color: "#3E2716" }}>
                  {b.name}
                </h3>
                {level > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: level === 1 ? "#F5A623" : level === 2 ? "#2196F3" : "#9C27B0" }}>
                    {LVL_LABEL[level]}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold capitalize" style={{ color: CAT_HEX[b.category] }}>{b.category}</p>
              <p className="text-xs mt-0.5" style={{ color: "#8B7355" }}>{b.description}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center ml-2 flex-shrink-0"
              style={{ background: "rgba(139,105,20,0.1)" }}>
              <X className="w-4 h-4" style={{ color: "#8B6914" }}/>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {b.incomePerTick.map((inc, i) => (
              <div key={i} className="rounded-xl p-2.5 text-center transition-all" style={{
                border: level === i + 1 ? "2px solid #43A047" : level > i + 1 ? "2px solid #A5D6A7" : "2px solid #E0D8C0",
                background: level === i + 1 ? "rgba(67,160,71,0.08)" : level > i + 1 ? "rgba(67,160,71,0.04)" : "rgba(0,0,0,0.02)",
                opacity: level < i + 1 ? 0.5 : 1
              }}>
                <div className="font-black text-base" style={{ color: "#2E7D32" }}>+{inc}🪙</div>
                <div className="text-[10px] font-medium" style={{ color: "#8B7355" }}>Level {i + 1}</div>
                <div className="text-[9px]" style={{ color: "#A89070" }}>every {b.tickMultiplier * 30}s</div>
                {level === i + 1 && <div className="text-[9px] font-bold" style={{ color: "#43A047" }}>✓ ACTIVE</div>}
              </div>
            ))}
          </div>

          {level === 3 ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl" style={{
              background: "linear-gradient(135deg, rgba(156,39,176,0.08), rgba(156,39,176,0.15))",
              border: "2px solid rgba(156,39,176,0.3)"
            }}>
              <Star className="w-5 h-5" style={{ color: "#9C27B0", fill: "#CE93D8" }}/>
              <span className="font-black" style={{ color: "#7B1FA2" }}>FULLY MAXED OUT</span>
            </div>
          ) : action ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-sm">
                <Coins className="w-4 h-4" style={{ color: "#F5A623" }}/>
                <span className="font-bold" style={{ color: "#3E2716" }}>{userCoins}</span>
                <span className="text-xs" style={{ color: "#A89070" }}>available</span>
              </div>
              <Button
                className="flex-1 font-bold h-11 text-base text-white"
                style={{
                  background: action.type === "buy"
                    ? "linear-gradient(135deg, #2E7D32, #1B5E20)"
                    : "linear-gradient(135deg, #1565C0, #0D47A1)",
                  boxShadow: action.type === "buy"
                    ? "0 3px 12px rgba(46,125,50,0.4)"
                    : "0 3px 12px rgba(21,101,192,0.4)"
                }}
                onClick={action.type === "buy" ? onBuy : onUpgrade}
                disabled={!canAfford || isPending}
                data-testid={`btn-${action.type}-${b.id}`}
              >
                {action.type === "buy"
                  ? <><ShoppingCart className="w-4 h-4 mr-2"/> {action.label} · {action.cost} coins</>
                  : <><ArrowUpCircle className="w-4 h-4 mr-2"/> {action.label} · {action.cost} coins</>
                }
              </Button>
            </div>
          ) : null}

          {action && !canAfford && (
            <p className="text-center text-xs mt-2 font-medium" style={{ color: "#C62828" }}>
              Need {action.cost - userCoins} more EduCoins — complete course levels to earn more!
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
