import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Coins, Star, Sun, X,
  ArrowUpCircle, ShoppingCart, Lock,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────
const TICK_INTERVAL_MS = 30_000; // 30 seconds per income tick
const MAX_FARM_BANK = 500;       // max pending coins
const MAX_OFFLINE_TICKS = 20;    // cap offline income to ~10 mins
const FARM_STATE_KEY = "farm_v2_state";

// ── Types ────────────────────────────────────────────────────────────────────
interface BuildingDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: "crops" | "buildings" | "livestock" | "equipment";
  buyCost: number;
  upgradeCost: [number, number];
  incomePerTick: [number, number, number];
  tickMultiplier: number; // income fires every N ticks
  tileRow: number;
  tileCol: number;
  activeEmoji?: string; // upgraded visual
}

type FarmSave = {
  owned: Record<string, number>;
  farmBank: number;
  lastTickTime: number;
  tickCounters: Record<string, number>;
  day: number;
};

type CoinPop = { id: string; row: number; col: number; amount: number };

// ── Building catalogue ────────────────────────────────────────────────────────
const BUILDINGS: BuildingDef[] = [
  {
    id: "wheat_field", name: "Wheat Field", emoji: "🌾", activeEmoji: "🌾",
    description: "Golden wheat that earns steady coins every 30 seconds.",
    category: "crops", buyCost: 30, upgradeCost: [60, 120],
    incomePerTick: [2, 5, 10], tickMultiplier: 1, tileRow: 0, tileCol: 0,
  },
  {
    id: "vegetable_patch", name: "Vegetable Patch", emoji: "🥕", activeEmoji: "🥦",
    description: "Fresh vegetables — grows faster at higher levels.",
    category: "crops", buyCost: 50, upgradeCost: [100, 200],
    incomePerTick: [3, 7, 14], tickMultiplier: 1, tileRow: 0, tileCol: 2,
  },
  {
    id: "apple_orchard", name: "Apple Orchard", emoji: "🍎", activeEmoji: "🍎",
    description: "Beautiful orchard trees bearing fruit each season.",
    category: "crops", buyCost: 80, upgradeCost: [150, 300],
    incomePerTick: [4, 9, 18], tickMultiplier: 1, tileRow: 0, tileCol: 4,
  },
  {
    id: "greenhouse", name: "Greenhouse", emoji: "🪴", activeEmoji: "🌿",
    description: "Climate-controlled glass house for year-round growing.",
    category: "crops", buyCost: 120, upgradeCost: [240, 480],
    incomePerTick: [5, 11, 22], tickMultiplier: 1, tileRow: 0, tileCol: 6,
  },
  {
    id: "chicken_coop", name: "Chicken Coop", emoji: "🐔", activeEmoji: "🐔",
    description: "Free-range hens laying eggs every morning.",
    category: "livestock", buyCost: 55, upgradeCost: [110, 220],
    incomePerTick: [4, 8, 16], tickMultiplier: 2, tileRow: 2, tileCol: 0,
  },
  {
    id: "dairy_cows", name: "Dairy Cows", emoji: "🐄", activeEmoji: "🐄",
    description: "Happy cows producing fresh milk and steady income.",
    category: "livestock", buyCost: 90, upgradeCost: [180, 360],
    incomePerTick: [5, 11, 22], tickMultiplier: 2, tileRow: 2, tileCol: 2,
  },
  {
    id: "farmhouse", name: "Farmhouse", emoji: "🏠", activeEmoji: "🏡",
    description: "Your home base — upgrade to house more workers.",
    category: "buildings", buyCost: 40, upgradeCost: [90, 180],
    incomePerTick: [3, 6, 13], tickMultiplier: 2, tileRow: 2, tileCol: 4,
  },
  {
    id: "windmill", name: "Windmill", emoji: "🌬️", activeEmoji: "⚙️",
    description: "Harnesses wind power to boost the whole farm.",
    category: "buildings", buyCost: 100, upgradeCost: [200, 400],
    incomePerTick: [6, 12, 24], tickMultiplier: 2, tileRow: 2, tileCol: 6,
  },
  {
    id: "barn", name: "Red Barn", emoji: "🏚️", activeEmoji: "🏚️",
    description: "Classic red barn for storing grain and tools.",
    category: "buildings", buyCost: 70, upgradeCost: [140, 280],
    incomePerTick: [5, 10, 20], tickMultiplier: 3, tileRow: 4, tileCol: 1,
  },
  {
    id: "tractor", name: "Tractor", emoji: "🚜", activeEmoji: "🚜",
    description: "Heavy-duty machine that speeds up all operations.",
    category: "equipment", buyCost: 150, upgradeCost: [300, 600],
    incomePerTick: [8, 16, 32], tickMultiplier: 3, tileRow: 4, tileCol: 3,
  },
  {
    id: "silo", name: "Grain Silo", emoji: "🏗️", activeEmoji: "🏛️",
    description: "Store grain in bulk and sell at peak market prices.",
    category: "equipment", buyCost: 130, upgradeCost: [260, 520],
    incomePerTick: [7, 14, 28], tickMultiplier: 3, tileRow: 4, tileCol: 5,
  },
  {
    id: "irrigation", name: "Irrigation", emoji: "💧", activeEmoji: "💦",
    description: "Automated watering system for the entire farm.",
    category: "equipment", buyCost: 110, upgradeCost: [220, 440],
    incomePerTick: [6, 13, 26], tickMultiplier: 3, tileRow: 4, tileCol: 7,
  },
];

// Pre-index buildings by tile position
const BLDG_BY_TILE = new Map<string, BuildingDef>();
BUILDINGS.forEach(b => BLDG_BY_TILE.set(`${b.tileRow},${b.tileCol}`, b));

// ── Tile map ─────────────────────────────────────────────────────────────────
// 10 cols × 6 rows
// B:id = building slot | G = grass | P = path | T = tree | W = water | F = flower | N = fence
const RAW_MAP = [
  ["B:wheat_field",  "G", "B:vegetable_patch", "G", "B:apple_orchard", "G", "B:greenhouse", "G", "T", "T"],
  ["N",              "N", "N",                 "N", "N",               "N", "N",            "N", "N", "T"],
  ["B:chicken_coop", "G", "B:dairy_cows",      "G", "B:farmhouse",     "G", "B:windmill",   "G", "F", "W"],
  ["P",              "P", "P",                 "P", "P",               "P", "P",            "P", "P", "P"],
  ["G",              "B:barn", "G",            "B:tractor", "G",       "B:silo", "G",       "B:irrigation", "G", "G"],
  ["F",              "G", "T",                 "F", "F",               "T", "F",            "G", "T", "F"],
];

// ── State helpers ─────────────────────────────────────────────────────────────
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

// Process N offline ticks, returns updated state + new coin pops (empty for offline)
function processTicks(state: FarmSave, nTicks: number, silent = false): {
  state: FarmSave; pops: Array<{ row: number; col: number; amount: number }>;
} {
  const owned = state.owned;
  let farmBank = state.farmBank;
  const tickCounters = { ...state.tickCounters };
  const pops: Array<{ row: number; col: number; amount: number }> = [];

  for (let t = 0; t < nTicks; t++) {
    for (const bldg of BUILDINGS) {
      const level = owned[bldg.id] || 0;
      if (level === 0) continue;
      tickCounters[bldg.id] = (tickCounters[bldg.id] || 0) + 1;
      if (tickCounters[bldg.id] >= bldg.tickMultiplier) {
        tickCounters[bldg.id] = 0;
        const income = bldg.incomePerTick[level - 1];
        farmBank = Math.min(farmBank + income, MAX_FARM_BANK);
        if (!silent) pops.push({ row: bldg.tileRow, col: bldg.tileCol, amount: income });
      }
    }
  }

  return {
    state: { ...state, farmBank, tickCounters, lastTickTime: state.lastTickTime + nTicks * TICK_INTERVAL_MS },
    pops,
  };
}

// ── Level visual helpers ──────────────────────────────────────────────────────
const LVL_RING = ["", "ring-1 ring-yellow-400/60", "ring-2 ring-blue-400/60", "ring-2 ring-purple-400/80"];
const LVL_BADGE = ["", "bg-yellow-500 text-white", "bg-blue-500 text-white", "bg-purple-600 text-white"];
const LVL_LABEL = ["", "L1", "L2", "L3★"];

const TILE_STYLES: Record<string, string> = {
  G: "bg-gradient-to-br from-emerald-800/80 to-emerald-900/60",
  P: "bg-gradient-to-r from-amber-900/80 to-stone-800/70",
  T: "bg-gradient-to-br from-emerald-800/80 to-emerald-900/60",
  W: "bg-gradient-to-br from-blue-700/80 to-cyan-900/70",
  F: "bg-gradient-to-br from-emerald-800/80 to-emerald-900/60",
  N: "bg-amber-900/50",
};

const TILE_DECOR: Record<string, string> = {
  T: "🌲",
  F: "🌸",
  W: "🌊",
  N: "🪵",
  G: "",
  P: "·",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function FarmTile({
  cell, row, col, owned, onClick, hasPop,
}: {
  cell: string; row: number; col: number;
  owned: Record<string, number>;
  onClick: (b: BuildingDef | null, r: number, c: number) => void;
  hasPop: boolean;
}) {
  const isBuilding = cell.startsWith("B:");
  const bldgId = isBuilding ? cell.slice(2) : null;
  const bldg = bldgId ? (BLDG_BY_TILE.get(`${row},${col}`) ?? null) : null;
  const level = bldg ? (owned[bldg.id] || 0) : 0;
  const isOwned = level > 0;
  const isMaxed = level === 3;
  const type = isBuilding ? "B" : cell;
  const baseStyle = TILE_STYLES[type] || TILE_STYLES.G;

  const tileContent = () => {
    if (!isBuilding) {
      return (
        <span className="text-2xl select-none opacity-90">
          {TILE_DECOR[cell] || ""}
        </span>
      );
    }
    if (!bldg) return null;
    if (!isOwned) {
      return (
        <div className="flex flex-col items-center gap-0.5 opacity-40">
          <span className="text-3xl grayscale">{bldg.emoji}</span>
          <Lock className="w-3 h-3 text-white/50" />
        </div>
      );
    }
    return (
      <div className="relative flex flex-col items-center">
        <motion.span
          className="text-4xl select-none drop-shadow-lg"
          animate={hasPop ? { scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          {level >= 2 ? (bldg.activeEmoji || bldg.emoji) : bldg.emoji}
        </motion.span>
        {/* Level badge */}
        <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-black px-1 py-0 rounded-full leading-4 ${LVL_BADGE[level]}`}>
          {LVL_LABEL[level]}
        </span>
        {/* Maxed star */}
        {isMaxed && (
          <Star className="absolute -top-1.5 -left-1.5 w-3 h-3 text-yellow-300 fill-yellow-300" />
        )}
      </div>
    );
  };

  const clickable = isBuilding;

  return (
    <motion.div
      onClick={clickable ? () => onClick(bldg, row, col) : undefined}
      whileHover={clickable ? { scale: 1.06, zIndex: 10 } : {}}
      whileTap={clickable ? { scale: 0.94 } : {}}
      className={`
        relative flex items-center justify-center rounded-md border
        transition-all duration-200 select-none overflow-visible
        ${baseStyle}
        ${isBuilding ? "cursor-pointer" : ""}
        ${isOwned ? `${LVL_RING[level]} shadow-md` : "border-black/20"}
        ${isBuilding && !isOwned ? "opacity-70 hover:opacity-100 border-dashed border-white/20" : "border-black/20"}
        ${isBuilding && isOwned ? "shadow-lg" : ""}
      `}
      style={{ width: "100%", height: "100%", position: "relative" }}
      data-testid={bldg ? `tile-${bldg.id}` : undefined}
    >
      {tileContent()}
    </motion.div>
  );
}

function CoinPopAnimation({ pop, onDone }: { pop: CoinPop; onDone: () => void }) {
  return (
    <motion.div
      key={pop.id}
      className="absolute pointer-events-none z-50 flex items-center gap-0.5"
      style={{ left: "50%", top: "10%", transform: "translateX(-50%)" }}
      initial={{ opacity: 1, y: 0, scale: 0.8 }}
      animate={{ opacity: 0, y: -44, scale: 1.1 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      onAnimationComplete={onDone}
    >
      <span className="text-yellow-300 font-black text-xs drop-shadow-lg">+{pop.amount}</span>
      <span className="text-xs">🪙</span>
    </motion.div>
  );
}

function BuildingPanel({
  bldg, level, userCoins, onBuy, onUpgrade, onClose, isPending,
}: {
  bldg: BuildingDef; level: number; userCoins: number;
  onBuy: () => void; onUpgrade: () => void; onClose: () => void;
  isPending: boolean;
}) {
  const action = level === 0
    ? { type: "buy" as const, cost: bldg.buyCost, label: "Build" }
    : level < 3
    ? { type: "upgrade" as const, cost: bldg.upgradeCost[level - 1], label: `Upgrade to L${level + 1}` }
    : null;

  const canAfford = action ? userCoins >= action.cost : true;
  const CATEGORY_COLORS: Record<string, string> = {
    crops: "text-emerald-400", buildings: "text-blue-400",
    livestock: "text-amber-400", equipment: "text-violet-400",
  };

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-safe-bottom pb-4"
      initial={{ y: 200, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 200, opacity: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
    >
      <div className="bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl p-4 shadow-2xl max-w-lg mx-auto">
        <div className="flex items-start gap-3 mb-4">
          {/* Emoji display */}
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-4xl flex-shrink-0
            ${level > 0 ? "bg-emerald-900/50 border border-emerald-500/30" : "bg-muted/40 border border-border/30"}`}>
            {level > 0 ? (bldg.activeEmoji || bldg.emoji) : bldg.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-black text-base tracking-wide" style={{ fontFamily: "Oxanium, sans-serif" }}>
                {bldg.name}
              </h3>
              {level > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${LVL_BADGE[level]}`}>
                  {LVL_LABEL[level]}
                </span>
              )}
            </div>
            <p className={`text-xs font-medium capitalize ${CATEGORY_COLORS[bldg.category] || ""}`}>
              {bldg.category}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{bldg.description}</p>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Income tiers */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {bldg.incomePerTick.map((inc, i) => (
            <div
              key={i}
              className={`rounded-lg p-2 text-center border transition-all ${
                level === i + 1
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : level > i + 1
                  ? "border-emerald-800/40 bg-emerald-900/20"
                  : "border-border/30 bg-muted/20 opacity-60"
              }`}
            >
              <div className="font-bold text-emerald-400 text-sm">+{inc} 🪙</div>
              <div className="text-muted-foreground text-xs">
                Level {i + 1} {level === i + 1 ? "✓" : ""}
              </div>
              <div className="text-muted-foreground/50 text-[9px]">
                per {bldg.tickMultiplier * 30}s
              </div>
            </div>
          ))}
        </div>

        {/* Action */}
        {level === 3 ? (
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
            <Star className="w-4 h-4 text-purple-400 fill-purple-400" />
            <span className="font-bold text-purple-400 text-sm">FULLY MAXED OUT</span>
          </div>
        ) : action ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="font-bold text-yellow-400 font-mono">{userCoins}</span>
              <span className="text-muted-foreground text-xs">available</span>
            </div>
            <Button
              className={`flex-1 font-bold ${
                action.type === "buy"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
              onClick={action.type === "buy" ? onBuy : onUpgrade}
              disabled={!canAfford || isPending}
              data-testid={`btn-${action.type}-${bldg.id}`}
            >
              {action.type === "buy"
                ? <><ShoppingCart className="w-4 h-4 mr-1.5" /> {action.label} • {action.cost} 🪙</>
                : <><ArrowUpCircle className="w-4 h-4 mr-1.5" /> {action.label} • {action.cost} 🪙</>
              }
            </Button>
          </div>
        ) : null}

        {action && !canAfford && (
          <p className="text-center text-xs text-red-400 mt-2">
            Need {action.cost - userCoins} more EduCoins — complete course levels to earn more!
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FarmPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [farmSave, setFarmSave] = useState<FarmSave>(loadState);
  const [coinPops, setCoinPops] = useState<CoinPop[]>([]);
  const [selectedTile, setSelectedTile] = useState<{ bldg: BuildingDef | null; row: number; col: number } | null>(null);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const popIdRef = useRef(0);

  // ── Harvest API call ─────────────────────────────────────────────────────
  const harvestMutation = useMutation({
    mutationFn: (coins: number) => apiRequest("POST", "/api/farm/harvest", { coins }),
    onSuccess: (data: any) => {
      if (data.user) updateUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: `🌾 Harvest Complete! +${data.coinsAdded} EduCoins`,
        description: `Farm Day ${farmSave.day + 1} begins. Keep growing!`,
      });
      setFarmSave(prev => {
        const next = { ...prev, farmBank: 0, day: prev.day + 1 };
        saveState(next);
        return next;
      });
      setIsHarvesting(false);
    },
    onError: () => {
      toast({ title: "Harvest failed", variant: "destructive" });
      setIsHarvesting(false);
    },
  });

  const spendMutation = useMutation({
    mutationFn: (amount: number) => apiRequest("POST", "/api/coins/spend", { amount }),
    onSuccess: (data: any) => {
      if (data.user) updateUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  // ── Process offline ticks on mount ──────────────────────────────────────
  useEffect(() => {
    const saved = loadState();
    const now = Date.now();
    const elapsed = now - saved.lastTickTime;
    const missedTicks = Math.min(Math.floor(elapsed / TICK_INTERVAL_MS), MAX_OFFLINE_TICKS);
    if (missedTicks > 0) {
      const { state: newState } = processTicks(saved, missedTicks, true);
      newState.lastTickTime = now;
      saveState(newState);
      setFarmSave(newState);
    } else {
      setFarmSave(saved);
    }
  }, []);

  // ── Live tick loop ───────────────────────────────────────────────────────
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setFarmSave(prev => {
        const { state: newState, pops } = processTicks(prev, 1, false);
        newState.lastTickTime = Date.now();
        saveState(newState);

        // Trigger coin pop animations
        if (pops.length > 0) {
          const newPops = pops.map(p => ({
            ...p,
            id: `pop-${Date.now()}-${++popIdRef.current}`,
          }));
          setCoinPops(cur => [...cur, ...newPops]);
        }

        return newState;
      });
    }, TICK_INTERVAL_MS);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // ── Buy / Upgrade handlers ───────────────────────────────────────────────
  const handleBuy = useCallback((bldg: BuildingDef) => {
    if (!user || user.eduCoins < bldg.buyCost) {
      toast({ title: "Not enough EduCoins", description: `You need ${bldg.buyCost} coins`, variant: "destructive" });
      return;
    }
    spendMutation.mutate(bldg.buyCost, {
      onSuccess: () => {
        setFarmSave(prev => {
          const next = { ...prev, owned: { ...prev.owned, [bldg.id]: 1 } };
          saveState(next);
          return next;
        });
        setSelectedTile(null);
        toast({ title: `${bldg.emoji} ${bldg.name} built!`, description: `Now generating +${bldg.incomePerTick[0]} coins every ${bldg.tickMultiplier * 30}s` });
      },
    });
  }, [user, spendMutation, toast]);

  const handleUpgrade = useCallback((bldg: BuildingDef) => {
    if (!user) return;
    const currentLevel = farmSave.owned[bldg.id] || 0;
    if (currentLevel === 0 || currentLevel >= 3) return;
    const cost = bldg.upgradeCost[currentLevel - 1];
    if (user.eduCoins < cost) {
      toast({ title: "Not enough EduCoins", description: `You need ${cost} coins`, variant: "destructive" });
      return;
    }
    spendMutation.mutate(cost, {
      onSuccess: () => {
        const newLevel = currentLevel + 1;
        setFarmSave(prev => {
          const next = { ...prev, owned: { ...prev.owned, [bldg.id]: newLevel } };
          saveState(next);
          return next;
        });
        setSelectedTile(null);
        toast({
          title: `⬆️ ${bldg.name} upgraded to Level ${newLevel}${newLevel === 3 ? " ★" : ""}!`,
          description: `Now generating +${bldg.incomePerTick[newLevel - 1]} coins every ${bldg.tickMultiplier * 30}s`,
        });
      },
    });
  }, [user, farmSave.owned, spendMutation, toast]);

  const handleHarvest = useCallback(() => {
    if (farmSave.farmBank <= 0) return;
    setIsHarvesting(true);
    harvestMutation.mutate(farmSave.farmBank);
  }, [farmSave.farmBank, harvestMutation]);

  if (!user) return null;

  // ── Derived values ───────────────────────────────────────────────────────
  const totalOwned = Object.values(farmSave.owned).filter(v => v > 0).length;
  const totalMaxed = Object.values(farmSave.owned).filter(v => v === 3).length;
  const totalIncomePer30s = BUILDINGS.reduce((sum, b) => {
    const lv = farmSave.owned[b.id] || 0;
    return lv > 0 ? sum + (lv > 0 ? b.incomePerTick[lv - 1] : 0) / b.tickMultiplier : sum;
  }, 0);

  const farmRating = totalOwned === 0 ? "Barren" : totalOwned < 4 ? "Seedling" : totalOwned < 8 ? "Growing" : totalOwned < 12 ? "Thriving" : "Legendary";
  const farmRatingEmoji = { Barren: "🪨", Seedling: "🌱", Growing: "🌿", Thriving: "🌾", Legendary: "🏆" }[farmRating];

  // Build a map of which tiles have pending pops
  const popTileSet = new Set(coinPops.map(p => `${p.row},${p.col}`));

  return (
    <div className="flex flex-col h-full min-h-screen bg-gradient-to-b from-sky-950 via-slate-900 to-emerald-950">
      {/* ── Top Header Bar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur border-b border-border/30 px-4 py-2.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xl">{farmRatingEmoji}</span>
          <div>
            <h1 className="text-sm font-black tracking-widest leading-none" style={{ fontFamily: "Oxanium, sans-serif" }}>
              FARM <span className="text-emerald-400">TYCOON</span>
            </h1>
            <p className="text-[10px] text-muted-foreground font-mono">Day {farmSave.day} · {farmRating} Farm</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
          {/* Farm bank display */}
          {farmSave.farmBank > 0 && (
            <motion.div
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40"
            >
              <span className="text-xs">🌾</span>
              <span className="font-bold text-emerald-400 text-sm font-mono">{farmSave.farmBank}</span>
              <span className="text-xs text-muted-foreground">ready</span>
            </motion.div>
          )}

          {/* EduCoins */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Coins className="w-3.5 h-3.5 text-yellow-400" />
            <span className="font-bold text-yellow-400 text-sm font-mono">{user.eduCoins}</span>
          </div>

          {/* Harvest button */}
          <Button
            size="sm"
            className={`h-8 px-3 text-xs font-bold transition-all ${
              farmSave.farmBank > 0
                ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                : "bg-muted/30 text-muted-foreground cursor-not-allowed"
            }`}
            disabled={farmSave.farmBank === 0 || harvestMutation.isPending}
            onClick={handleHarvest}
            data-testid="button-harvest"
          >
            {harvestMutation.isPending ? (
              <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8 }}>🌀</motion.span>
            ) : (
              <>🌾 Harvest {farmSave.farmBank > 0 ? `+${farmSave.farmBank}` : ""}</>
            )}
          </Button>
        </div>
      </div>

      {/* ── 2D Farm Grid ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
        {/* Sky + decorations */}
        <div className="w-full max-w-4xl">
          {/* Sky bar */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-1.5">
              <Sun className="w-5 h-5 text-yellow-300 fill-yellow-200" />
              <span className="text-xs text-sky-200/60 font-mono">Day {farmSave.day}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-sky-200/50 font-mono">
              <span>📊 {totalOwned}/12 buildings</span>
              {totalMaxed > 0 && <span>⭐ {totalMaxed} maxed</span>}
              <span>⚡ ~{Math.round(totalIncomePer30s * 2)}/min</span>
            </div>
          </div>

          {/* The grid */}
          <div
            className="relative w-full rounded-2xl overflow-hidden border border-black/40 shadow-2xl"
            style={{ aspectRatio: "10/6" }}
          >
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(10, 1fr)`,
                gridTemplateRows: `repeat(6, 1fr)`,
                gap: "2px",
                padding: "2px",
                background: "linear-gradient(to bottom, #14532d 0%, #15803d 40%, #166534 100%)",
              }}
            >
              {RAW_MAP.map((rowArr, rowIdx) =>
                rowArr.map((cell, colIdx) => {
                  const key = `${rowIdx}-${colIdx}`;
                  const hasPop = popTileSet.has(`${rowIdx},${colIdx}`);
                  const cellPops = coinPops.filter(p => p.row === rowIdx && p.col === colIdx);

                  return (
                    <div key={key} className="relative" style={{ minHeight: 0, minWidth: 0 }}>
                      <FarmTile
                        cell={cell}
                        row={rowIdx}
                        col={colIdx}
                        owned={farmSave.owned}
                        hasPop={hasPop}
                        onClick={(bldg, r, c) => setSelectedTile({ bldg, row: r, col: c })}
                      />
                      {/* Coin pop animations anchored to this tile */}
                      <AnimatePresence>
                        {cellPops.map(pop => (
                          <CoinPopAnimation
                            key={pop.id}
                            pop={pop}
                            onDone={() => setCoinPops(cur => cur.filter(p => p.id !== pop.id))}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 px-1 flex-wrap">
            <span className="text-xs text-muted-foreground/50">Click any 🔒 tile to buy a building</span>
            <span className="text-xs text-muted-foreground/50">·</span>
            <span className="text-xs text-muted-foreground/50">Coins appear every 30s, Harvest to collect</span>
          </div>
        </div>
      </div>

      {/* ── Shop Bar ──────────────────────────────────────────────────────── */}
      <div className="border-t border-border/30 bg-slate-900/80 backdrop-blur">
        <div className="px-3 pt-2 pb-1 flex items-center justify-between">
          <span className="text-xs font-bold tracking-widest text-muted-foreground font-mono">BUILDINGS</span>
          <span className="text-xs text-muted-foreground">{totalOwned}/12 owned</span>
        </div>
        <div className="flex gap-2 overflow-x-auto px-3 pb-3 no-scrollbar">
          {BUILDINGS.map(b => {
            const level = farmSave.owned[b.id] || 0;
            const isOwned = level > 0;
            const isMaxed = level === 3;
            const nextCost = level === 0 ? b.buyCost : level < 3 ? b.upgradeCost[level - 1] : null;
            const canAfford = nextCost !== null && user.eduCoins >= nextCost;

            return (
              <motion.button
                key={b.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedTile({ bldg: b, row: b.tileRow, col: b.tileCol })}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all ${
                  isMaxed
                    ? "border-purple-500/40 bg-purple-500/10"
                    : isOwned
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : canAfford
                    ? "border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/60"
                    : "border-border/30 bg-card/30 opacity-60"
                }`}
                data-testid={`shop-btn-${b.id}`}
              >
                <span className="text-xl">{isOwned ? (b.activeEmoji || b.emoji) : b.emoji}</span>
                <span className="text-[9px] font-medium leading-tight text-center whitespace-nowrap max-w-[60px] truncate">
                  {b.name.split(" ")[0]}
                </span>
                {isMaxed ? (
                  <Star className="w-2.5 h-2.5 text-purple-400 fill-purple-400" />
                ) : (
                  <span className={`text-[9px] font-mono font-bold ${canAfford ? "text-yellow-400" : "text-muted-foreground/50"}`}>
                    {nextCost}🪙
                  </span>
                )}
                {isOwned && !isMaxed && (
                  <span className={`text-[9px] px-1 rounded font-bold ${LVL_BADGE[level]}`}>{LVL_LABEL[level]}</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Building detail panel ─────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedTile?.bldg && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTile(null)}
            />
            <BuildingPanel
              bldg={selectedTile.bldg}
              level={farmSave.owned[selectedTile.bldg.id] || 0}
              userCoins={user.eduCoins}
              onBuy={() => selectedTile.bldg && handleBuy(selectedTile.bldg)}
              onUpgrade={() => selectedTile.bldg && handleUpgrade(selectedTile.bldg)}
              onClose={() => setSelectedTile(null)}
              isPending={spendMutation.isPending}
            />
          </>
        )}
      </AnimatePresence>

      {/* Harvest celebration overlay */}
      <AnimatePresence>
        {isHarvesting && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-6xl"
              animate={{ y: [0, -30, 0], scale: [1, 1.3, 1] }}
              transition={{ repeat: 2, duration: 0.5 }}
            >
              🌾
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
