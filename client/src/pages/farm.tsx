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
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-emerald-300">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white/20 backdrop-blur-md border-b border-white/30 px-4 py-2.5 flex items-center gap-3 flex-wrap shadow-md">
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-yellow-500 fill-yellow-400" />
          <div>
            <h1 className="text-sm font-black tracking-widest text-emerald-900 leading-none"
              style={{ fontFamily: "Oxanium, sans-serif" }}>
              FARM <span className="text-emerald-600">TYCOON</span>
            </h1>
            <p className="text-[10px] text-emerald-800 font-mono">Day {farmSave.day} · {farmRating}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/30 text-emerald-900 text-xs font-mono">
            ⚡ {Math.round(incomePerMin)}/min
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/30 text-emerald-900 text-xs">
            🏗️ {totalOwned}/12
          </div>

          {/* Farm bank */}
          {farmSave.farmBank > 0 && (
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/80 text-white text-sm font-bold shadow-lg"
            >
              🌾 {farmSave.farmBank} ready
            </motion.div>
          )}

          {/* EduCoins */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-yellow-400/80 text-yellow-900 text-sm font-bold shadow">
            <Coins className="w-4 h-4" />
            {user.eduCoins}
          </div>

          {/* Harvest */}
          <Button
            size="sm"
            className={`h-8 px-3 text-xs font-black transition-all border-2 ${
              farmSave.farmBank > 0
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-800 shadow-lg"
                : "bg-white/30 text-emerald-700 border-transparent"
            }`}
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

      {/* ── Farm world scroll area ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="relative mx-auto" style={{ width: CANVAS_W, height: CANVAS_H }}>

          {/* ── Background: grass + paths ──────────────────────────────────── */}
          <svg
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            width={CANVAS_W}
            height={CANVAS_H}
            className="absolute inset-0 rounded-2xl overflow-hidden"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Grass */}
            <rect width={CANVAS_W} height={CANVAS_H} fill="#6abf4b" rx="16"/>
            {/* Grass texture patches */}
            {Array.from({ length: 30 }).map((_, i) => (
              <ellipse key={i}
                cx={(i * 37) % CANVAS_W}
                cy={(i * 53) % CANVAS_H}
                rx="18" ry="10"
                fill="#5aad3e" opacity="0.4"
              />
            ))}
            {/* Horizontal path rows */}
            <rect x="0" y="176" width={CANVAS_W} height="30" fill="#d4b896" rx="0"/>
            <rect x="0" y="354" width={CANVAS_W} height="30" fill="#d4b896" rx="0"/>
            {/* Vertical path cols */}
            <rect x="215" y="0" width="30" height={CANVAS_H} fill="#d4b896"/>
            <rect x="440" y="0" width="30" height={CANVAS_H} fill="#d4b896"/>
            <rect x="665" y="0" width="30" height={CANVAS_H} fill="#d4b896"/>
            {/* Path intersections (slightly darker) */}
            {[176, 354].map(py =>
              [215, 440, 665].map(px => (
                <rect key={`${px}-${py}`} x={px} y={py} width="30" height="30" fill="#c8a882"/>
              ))
            )}
            {/* Path edge lines (kerb) */}
            <line x1="0" y1="176" x2={CANVAS_W} y2="176" stroke="#c8a882" strokeWidth="2"/>
            <line x1="0" y1="206" x2={CANVAS_W} y2="206" stroke="#c8a882" strokeWidth="2"/>
            <line x1="0" y1="354" x2={CANVAS_W} y2="354" stroke="#c8a882" strokeWidth="2"/>
            <line x1="0" y1="384" x2={CANVAS_W} y2="384" stroke="#c8a882" strokeWidth="2"/>
            <line x1="215" y1="0" x2="215" y2={CANVAS_H} stroke="#c8a882" strokeWidth="2"/>
            <line x1="245" y1="0" x2="245" y2={CANVAS_H} stroke="#c8a882" strokeWidth="2"/>
            <line x1="440" y1="0" x2="440" y2={CANVAS_H} stroke="#c8a882" strokeWidth="2"/>
            <line x1="470" y1="0" x2="470" y2={CANVAS_H} stroke="#c8a882" strokeWidth="2"/>
            <line x1="665" y1="0" x2="665" y2={CANVAS_H} stroke="#c8a882" strokeWidth="2"/>
            <line x1="695" y1="0" x2="695" y2={CANVAS_H} stroke="#c8a882" strokeWidth="2"/>
            {/* Decorative small rocks on paths */}
            {[[230, 190],[455, 365],[680, 190],[455, 190],[230, 365]].map(([rx, ry], i) => (
              <ellipse key={i} cx={rx} cy={ry} rx="5" ry="3.5" fill="#a89070" opacity="0.6"/>
            ))}
          </svg>

          {/* ── Decorative trees ────────────────────────────────────────────── */}
          <div className="absolute pointer-events-none" style={{ right: 8, top: 188, zIndex: 5 }}>
            <TreeSVG scale={0.65}/>
          </div>
          <div className="absolute pointer-events-none" style={{ right: 8, top: 362, zIndex: 5 }}>
            <TreeSVG scale={0.6}/>
          </div>
          <div className="absolute pointer-events-none" style={{ left: 8, top: 188, zIndex: 5 }}>
            <TreeSVG scale={0.55}/>
          </div>

          {/* ── Building plots ─────────────────────────────────────────────── */}
          {BUILDINGS.map(b => {
            const level = farmSave.owned[b.id] || 0;
            const isOwned = level > 0;
            const isMaxed = level === 3;

            return (
              <motion.div
                key={b.id}
                className="absolute cursor-pointer"
                style={{ left: b.x, top: b.y, width: b.w, height: b.h, zIndex: 2 }}
                whileHover={{ scale: 1.04, zIndex: 20 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSelected(b)}
                data-testid={`tile-${b.id}`}
              >
                <div
                  className="w-full h-full rounded-xl overflow-hidden shadow-lg"
                  style={{
                    boxShadow: isOwned
                      ? `0 4px 20px rgba(0,0,0,0.25), 0 0 0 3px ${LVL_RING_COLOR[level]}`
                      : "0 2px 10px rgba(0,0,0,0.2)",
                  }}
                >
                  {/* Building SVG art */}
                  {isOwned
                    ? <BuildingSVG buildingId={b.id} level={level}/>
                    : <LockedFieldSVG cost={b.buyCost}/>
                  }
                </div>

                {/* Nameplate */}
                <div className={`
                  absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap
                  px-3 py-0.5 rounded-full text-xs font-bold shadow-lg
                  ${isOwned
                    ? "bg-gray-900/85 text-white"
                    : "bg-gray-800/70 text-gray-300"}
                `}>
                  {b.name}
                  {isOwned && (
                    <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-black ${LVL_BG[level]} text-white`}>
                      {LVL_LABEL[level]}
                    </span>
                  )}
                  {isMaxed && <Star className="inline w-3 h-3 ml-1 text-yellow-400 fill-yellow-300"/>}
                </div>

                {/* Income badge (owned only) */}
                {isOwned && (
                  <div className="absolute bottom-2 right-2 bg-black/60 text-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    +{b.incomePerTick[level - 1]}🪙/{b.tickMultiplier * 30}s
                  </div>
                )}
              </motion.div>
            );
          })}

          {/* ── Coin pop animations ─────────────────────────────────────────── */}
          <AnimatePresence>
            {coinPops.map(pop => (
              <motion.div
                key={pop.id}
                className="absolute pointer-events-none z-40 flex items-center gap-1"
                style={{ left: pop.x, top: pop.y, transform: "translate(-50%, -100%)" }}
                initial={{ opacity: 1, y: 0, scale: 0.8 }}
                animate={{ opacity: 0, y: -50, scale: 1.15 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.3, ease: "easeOut" }}
                onAnimationComplete={() =>
                  setCoinPops(cur => cur.filter(p => p.id !== pop.id))
                }
              >
                <span className="font-black text-yellow-300 text-sm drop-shadow-lg">+{pop.amount}</span>
                <span className="text-base">🪙</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Hint row */}
        <p className="text-center text-xs text-emerald-900/60 mt-3">
          Click any plot to buy or upgrade · Coins generate every 30s · Hit Harvest to collect
        </p>
      </div>

      {/* ── Building detail panel (slide-up) ──────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
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

      {/* Harvest celebration */}
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
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl max-w-lg mx-auto overflow-hidden">
        {/* SVG preview strip */}
        <div className="h-36 w-full overflow-hidden bg-gradient-to-r from-emerald-100 to-sky-100">
          <div className="w-full h-full">
            {level > 0
              ? <BuildingSVG buildingId={b.id} level={level}/>
              : <LockedFieldSVG cost={b.buyCost}/>
            }
          </div>
        </div>

        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-gray-900 text-lg" style={{ fontFamily: "Oxanium, sans-serif" }}>
                  {b.name}
                </h3>
                {level > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white
                    ${level === 1 ? "bg-yellow-500" : level === 2 ? "bg-blue-500" : "bg-purple-600"}`}>
                    {LVL_LABEL[level]}
                  </span>
                )}
              </div>
              <p className={`text-xs font-semibold capitalize ${CAT_COLOR[b.category]}`}>{b.category}</p>
              <p className="text-xs text-gray-500 mt-0.5">{b.description}</p>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center ml-2 flex-shrink-0">
              <X className="w-3.5 h-3.5 text-gray-600"/>
            </button>
          </div>

          {/* Income tiers */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {b.incomePerTick.map((inc, i) => (
              <div key={i} className={`rounded-xl p-2.5 text-center border-2 transition-all ${
                level === i + 1 ? "border-emerald-400 bg-emerald-50"
                : level > i + 1 ? "border-emerald-200 bg-emerald-50/50 opacity-70"
                : "border-gray-200 bg-gray-50 opacity-50"
              }`}>
                <div className="font-black text-emerald-600 text-base">+{inc}🪙</div>
                <div className="text-gray-500 text-[10px] font-medium">Level {i + 1}</div>
                <div className="text-gray-400 text-[9px]">every {b.tickMultiplier * 30}s</div>
                {level === i + 1 && <div className="text-emerald-500 text-[9px] font-bold">✓ ACTIVE</div>}
              </div>
            ))}
          </div>

          {/* Action */}
          {level === 3 ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-50 border-2 border-purple-300">
              <Star className="w-5 h-5 text-purple-500 fill-purple-400"/>
              <span className="font-black text-purple-600">FULLY MAXED OUT</span>
            </div>
          ) : action ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-sm">
                <Coins className="w-4 h-4 text-yellow-500"/>
                <span className="font-bold text-gray-800">{userCoins}</span>
                <span className="text-gray-400 text-xs">available</span>
              </div>
              <Button
                className={`flex-1 font-bold h-11 text-base ${
                  action.type === "buy"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
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
            <p className="text-center text-xs text-red-500 mt-2 font-medium">
              Need {action.cost - userCoins} more EduCoins — complete course levels to earn more!
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
