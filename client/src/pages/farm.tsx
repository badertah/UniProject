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

interface BuildingDef {
  id: string; name: string; emoji: string; icon: string;
  description: string;
  category: "crops" | "buildings" | "livestock" | "equipment";
  buyCost: number; upgradeCost: [number, number];
  incomePerTick: [number, number, number];
  tickMultiplier: number;
  col: number; row: number;
}

const BUILDINGS: BuildingDef[] = [
  { id: "wheat_field",     name: "Wheat Field",     emoji: "🌾", icon: "🌾", description: "Golden wheat rows — steady income every 30 seconds.", category: "crops",     buyCost: 30,  upgradeCost: [60,  120], incomePerTick: [2,  5,  10], tickMultiplier: 1, col: 0, row: 0 },
  { id: "vegetable_patch", name: "Vegetable Patch",  emoji: "🥕", icon: "🥕", description: "Fresh vegetables that grow faster every level.", category: "crops",     buyCost: 50,  upgradeCost: [100, 200], incomePerTick: [3,  7,  14], tickMultiplier: 1, col: 1, row: 0 },
  { id: "apple_orchard",   name: "Apple Orchard",   emoji: "🍎", icon: "🍎", description: "Beautiful orchard trees heavy with red apples.", category: "crops",     buyCost: 80,  upgradeCost: [150, 300], incomePerTick: [4,  9,  18], tickMultiplier: 1, col: 2, row: 0 },
  { id: "greenhouse",      name: "Greenhouse",       emoji: "🌿", icon: "🪴", description: "Year-round glass house for premium crops.", category: "crops",     buyCost: 120, upgradeCost: [240, 480], incomePerTick: [5,  11, 22], tickMultiplier: 1, col: 3, row: 0 },
  { id: "chicken_coop",    name: "Chicken Coop",    emoji: "🐔", icon: "🐔", description: "Free-range hens — income every 60 seconds.", category: "livestock", buyCost: 55,  upgradeCost: [110, 220], incomePerTick: [4,  8,  16], tickMultiplier: 2, col: 0, row: 1 },
  { id: "dairy_cows",      name: "Dairy Cows",      emoji: "🐄", icon: "🐄", description: "Happy cows producing fresh milk and steady income.", category: "livestock", buyCost: 90,  upgradeCost: [180, 360], incomePerTick: [5,  11, 22], tickMultiplier: 2, col: 1, row: 1 },
  { id: "farmhouse",       name: "Farmhouse",        emoji: "🏠", icon: "🏡", description: "Your home base — upgrade it to unlock more workers.", category: "buildings", buyCost: 40,  upgradeCost: [90,  180], incomePerTick: [3,  6,  13], tickMultiplier: 2, col: 2, row: 1 },
  { id: "windmill",        name: "Windmill",         emoji: "⚙️", icon: "🎡", description: "Harnessing wind power to boost the whole farm.", category: "buildings", buyCost: 100, upgradeCost: [200, 400], incomePerTick: [6,  12, 24], tickMultiplier: 2, col: 3, row: 1 },
  { id: "barn",            name: "Red Barn",         emoji: "🏚️", icon: "🏚️", description: "Classic red barn for storing grain and tools.", category: "buildings", buyCost: 70,  upgradeCost: [140, 280], incomePerTick: [5,  10, 20], tickMultiplier: 3, col: 0, row: 2 },
  { id: "tractor",         name: "Tractor",          emoji: "🚜", icon: "🚜", description: "Heavy-duty machine that speeds up all operations.", category: "equipment", buyCost: 150, upgradeCost: [300, 600], incomePerTick: [8,  16, 32], tickMultiplier: 3, col: 1, row: 2 },
  { id: "silo",            name: "Grain Silo",       emoji: "🏗️", icon: "🏛️", description: "Store grain in bulk and sell at peak market prices.", category: "equipment", buyCost: 130, upgradeCost: [260, 520], incomePerTick: [7,  14, 28], tickMultiplier: 3, col: 2, row: 2 },
  { id: "irrigation",      name: "Irrigation",       emoji: "💧", icon: "💦", description: "Automated water system for the entire farm.", category: "equipment", buyCost: 110, upgradeCost: [220, 440], incomePerTick: [6,  13, 26], tickMultiplier: 3, col: 3, row: 2 },
];

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

function getBuildingPos(b: BuildingDef) {
  const TILE_W = 180;
  const TILE_H = 140;
  const GAP_X = 24;
  const GAP_Y = 20;
  const GRID_W = 4 * TILE_W + 3 * GAP_X;
  const START_X = -GRID_W / 2;
  const START_Y = 0;
  const x = START_X + b.col * (TILE_W + GAP_X);
  const y = START_Y + b.row * (TILE_H + GAP_Y);
  return { x, y, w: TILE_W, h: TILE_H };
}

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
        if (!silent) {
          pops.push({ id: `${b.id}-${Date.now()}-${Math.random()}`, bId: b.id, amount: income });
        }
      }
    }
  }
  return { state: { ...state, farmBank, tickCounters }, pops };
}

const LVL_RING_COLOR = ["", "#fbbf24", "#60a5fa", "#c084fc"];
const LVL_LABEL      = ["", "LV1", "LV2", "LV3★"];
const CAT_HEX: Record<string, string> = {
  crops: "#43A047", buildings: "#1565C0", livestock: "#E8730C", equipment: "#7B1FA2",
};

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
    if (missed > 0) {
      const { state: ns } = processTicks(saved, missed, true);
      ns.lastTickTime = Date.now();
      saveState(ns);
      setFarmSave(ns);
    } else {
      setFarmSave(saved);
    }
  }, []);

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

  const harvestMutation = useMutation({
    mutationFn: (coins: number) => apiRequest("POST", "/api/farm/harvest", { coins }),
    onSuccess: (data: any) => {
      if (data.user) updateUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: `🌾 Harvest! +${data.coinsAdded} EduCoins`, description: `Day ${farmSave.day + 1} begins. Keep farming!` });
      setFarmSave(prev => { const ns = { ...prev, farmBank: 0, day: prev.day + 1 }; saveState(ns); return ns; });
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
    if (!user || user.eduCoins < b.buyCost) { toast({ title: "Not enough EduCoins", variant: "destructive" }); return; }
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
    if (user.eduCoins < cost) { toast({ title: "Not enough EduCoins", variant: "destructive" }); return; }
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

  const hasChickens = (farmSave.owned["chicken_coop"] || 0) > 0;
  const hasCows = (farmSave.owned["dairy_cows"] || 0) > 0;
  const hasWindmill = (farmSave.owned["windmill"] || 0) > 0;
  const hasTractor = (farmSave.owned["tractor"] || 0) > 0;
  const hasIrrigation = (farmSave.owned["irrigation"] || 0) > 0;

  const [viewSize, setViewSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setViewSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const BOARD_W = 820;
  const BOARD_H = 520;
  const scaleX = Math.min(1, (viewSize.w - 20) / BOARD_W);
  const scaleY = Math.min(1, (viewSize.h - 100) / (BOARD_H + 80));
  const boardScale = Math.min(scaleX, scaleY);

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: "#1a1a2e" }}>
      <style>{`
        @keyframes cloudDrift {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(120vw); }
        }
        @keyframes cloudDrift2 {
          0% { transform: translateX(120vw); }
          100% { transform: translateX(-120%); }
        }
        @keyframes birdFly {
          0% { transform: translateX(-50px) translateY(0); }
          25% { transform: translateX(25vw) translateY(-15px); }
          50% { transform: translateX(50vw) translateY(5px); }
          75% { transform: translateX(75vw) translateY(-10px); }
          100% { transform: translateX(105vw) translateY(0); }
        }
        @keyframes chickenWalk {
          0% { transform: translateX(0) scaleX(1); }
          45% { transform: translateX(80px) scaleX(1); }
          50% { transform: translateX(80px) scaleX(-1); }
          95% { transform: translateX(0) scaleX(-1); }
          100% { transform: translateX(0) scaleX(1); }
        }
        @keyframes chickenPeck {
          0%, 85%, 100% { transform: rotate(0deg); }
          88% { transform: rotate(25deg); }
          91% { transform: rotate(0deg); }
          94% { transform: rotate(25deg); }
        }
        @keyframes cowGraze {
          0% { transform: translateX(0) scaleX(1); }
          40% { transform: translateX(50px) scaleX(1); }
          50% { transform: translateX(50px) scaleX(-1); }
          90% { transform: translateX(0) scaleX(-1); }
          100% { transform: translateX(0) scaleX(1); }
        }
        @keyframes cowHead {
          0%, 70%, 100% { transform: rotate(0deg) translateY(0); }
          75% { transform: rotate(15deg) translateY(3px); }
          80% { transform: rotate(0deg) translateY(0); }
          85% { transform: rotate(15deg) translateY(3px); }
        }
        @keyframes windmillSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes tractorDrive {
          0% { transform: translateX(-40px); }
          50% { transform: translateX(40px); }
          100% { transform: translateX(-40px); }
        }
        @keyframes tractorBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes waterDrop {
          0% { transform: translateY(0) scale(1); opacity: 0.8; }
          100% { transform: translateY(20px) scale(0.3); opacity: 0; }
        }
        @keyframes leafFloat {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.7; }
          100% { transform: translate(60px, 120px) rotate(360deg); opacity: 0; }
        }
        @keyframes sunPulse {
          0%, 100% { filter: drop-shadow(0 0 20px rgba(255,200,50,0.4)); }
          50% { filter: drop-shadow(0 0 40px rgba(255,200,50,0.7)); }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes incomePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,215,0,0.4); }
          50% { box-shadow: 0 0 12px 4px rgba(255,215,0,0.2); }
        }
        @keyframes butterflyPath {
          0% { transform: translate(0, 0); }
          25% { transform: translate(30px, -20px); }
          50% { transform: translate(60px, 0); }
          75% { transform: translate(30px, 20px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes butterflyWing {
          0%, 100% { transform: scaleX(1); }
          50% { transform: scaleX(0.3); }
        }
        .farm-tile:hover { transform: scale(1.06) translateY(-4px); z-index: 30 !important; }
        .farm-tile { transition: transform 0.2s ease, z-index 0s; }
        .farm-tile:active { transform: scale(0.97); }
      `}</style>

      <div className="absolute inset-0" style={{
        background: "linear-gradient(180deg, #87CEEB 0%, #B4E4FF 15%, #DCEDC8 40%, #8BC34A 50%, #689F38 60%, #558B2F 100%)"
      }}/>

      <div className="absolute top-0 left-0 right-0" style={{ height: "40%" }}>
        <svg className="absolute" style={{ top: "8%", left: "10%", animation: "sunPulse 4s ease-in-out infinite" }}
          width="60" height="60" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="18" fill="#FFD54F"/>
          <circle cx="30" cy="30" r="14" fill="#FFEB3B"/>
          {[0,45,90,135,180,225,270,315].map(a => {
            const rad = a * Math.PI / 180;
            return <line key={a} x1={30+Math.cos(rad)*22} y1={30+Math.sin(rad)*22}
              x2={30+Math.cos(rad)*28} y2={30+Math.sin(rad)*28} stroke="#FFD54F" strokeWidth="3" strokeLinecap="round"/>;
          })}
        </svg>

        {[
          { w: 120, h: 36, top: "12%", dur: "45s", delay: "0s", opacity: 0.9 },
          { w: 90, h: 28, top: "8%", dur: "55s", delay: "-15s", opacity: 0.7 },
          { w: 140, h: 40, top: "18%", dur: "65s", delay: "-30s", opacity: 0.8 },
          { w: 80, h: 24, top: "6%", dur: "50s", delay: "-40s", opacity: 0.6 },
          { w: 100, h: 30, top: "22%", dur: "70s", delay: "-10s", opacity: 0.75 },
        ].map((c, i) => (
          <div key={`cloud-${i}`} className="absolute" style={{
            top: c.top, width: c.w, height: c.h, opacity: c.opacity,
            animation: `${i % 2 === 0 ? 'cloudDrift' : 'cloudDrift2'} ${c.dur} linear infinite`,
            animationDelay: c.delay,
          }}>
            <svg viewBox="0 0 140 50" width="100%" height="100%">
              <ellipse cx="70" cy="30" rx="60" ry="18" fill="white"/>
              <ellipse cx="45" cy="25" rx="35" ry="16" fill="white"/>
              <ellipse cx="95" cy="25" rx="35" ry="16" fill="white"/>
              <ellipse cx="70" cy="20" rx="40" ry="15" fill="white"/>
              <ellipse cx="55" cy="18" rx="25" ry="12" fill="rgba(255,255,255,0.8)"/>
            </svg>
          </div>
        ))}

        {[0, 1, 2].map(i => (
          <svg key={`bird-${i}`} className="absolute" width="16" height="10"
            style={{
              top: `${6 + i * 8}%`,
              animation: `birdFly ${18 + i * 7}s linear infinite`,
              animationDelay: `${-i * 5}s`,
            }}>
            <path d="M0 5 L5 1 M10 5 L5 1" stroke="#37474F" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
          </svg>
        ))}
      </div>

      <div className="absolute left-0 right-0 bottom-0" style={{
        top: "28%",
        background: "linear-gradient(180deg, #8BC34A 0%, #7CB342 20%, #689F38 50%, #558B2F 80%, #33691E 100%)",
        borderTop: "3px solid #9CCC65",
      }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={`grass-tuft-${i}`} className="absolute" style={{
            left: `${(i * 5.3 + 2) % 100}%`,
            top: `${(i * 7.1 + 1) % 40}%`,
            opacity: 0.3,
          }}>
            <svg width="12" height="16" viewBox="0 0 12 16">
              <line x1="3" y1="16" x2="1" y2="4" stroke="#4CAF50" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="6" y1="16" x2="6" y2="2" stroke="#388E3C" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="9" y1="16" x2="11" y2="5" stroke="#4CAF50" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        ))}

        {[
          { left: "2%", top: "15%", s: 0.7 },
          { left: "95%", top: "10%", s: 0.8 },
          { left: "1%", top: "55%", s: 0.6 },
          { left: "96%", top: "50%", s: 0.65 },
          { left: "5%", top: "35%", s: 0.5 },
          { left: "92%", top: "30%", s: 0.55 },
        ].map((t, i) => (
          <div key={`tree-${i}`} className="absolute pointer-events-none" style={{
            left: t.left, top: t.top, transform: `scale(${t.s})`, transformOrigin: "bottom center",
          }}>
            <svg width="60" height="90" viewBox="0 0 60 90">
              <ellipse cx="30" cy="85" rx="20" ry="5" fill="rgba(0,0,0,0.15)"/>
              <rect x="24" y="55" width="12" height="30" rx="4" fill="#5D4037"/>
              <rect x="26" y="58" width="5" height="24" rx="2" fill="#795548" opacity="0.4"/>
              <circle cx="30" cy="48" r="24" fill="#2E7D32"/>
              <circle cx="22" cy="40" r="16" fill="#388E3C"/>
              <circle cx="38" cy="40" r="16" fill="#388E3C"/>
              <circle cx="30" cy="32" r="14" fill="#43A047"/>
              <circle cx="26" cy="28" r="8" fill="#66BB6A" opacity="0.5"/>
            </svg>
          </div>
        ))}

        {[1,2].map(i => (
          <div key={`butterfly-${i}`} className="absolute pointer-events-none" style={{
            left: `${20 + i * 40}%`, top: `${10 + i * 15}%`,
            animation: `butterflyPath ${6 + i * 2}s ease-in-out infinite`,
          }}>
            <svg width="14" height="10" viewBox="0 0 14 10">
              <g style={{ animation: "butterflyWing 0.3s ease-in-out infinite" }}>
                <ellipse cx="4" cy="5" rx="4" ry="3" fill={i === 1 ? "#FF9800" : "#E040FB"} opacity="0.8"/>
                <ellipse cx="10" cy="5" rx="4" ry="3" fill={i === 1 ? "#FFB74D" : "#CE93D8"} opacity="0.8"/>
                <rect x="6" y="3" width="2" height="5" rx="1" fill="#333"/>
              </g>
            </svg>
          </div>
        ))}
      </div>

      <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: "6vh" }}>
        <div className="relative" style={{ width: BOARD_W, height: BOARD_H, transform: `scale(${boardScale})`, transformOrigin: "center center" }}>

          <svg className="absolute" width={BOARD_W} height={BOARD_H} viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} style={{ top: 0, left: 0, zIndex: 0 }}>
            <defs>
              <linearGradient id="pathG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C8A87A"/>
                <stop offset="100%" stopColor="#A88A58"/>
              </linearGradient>
              <pattern id="dirtPat" width="8" height="8" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.8" fill="#B89968" opacity="0.3"/>
                <circle cx="6" cy="6" r="0.6" fill="#9E8050" opacity="0.3"/>
              </pattern>
            </defs>

            <rect x="0" y="165" width="820" height="28" fill="url(#pathG)" rx="4"/>
            <rect x="0" y="165" width="820" height="28" fill="url(#dirtPat)"/>
            <rect x="0" y="325" width="820" height="28" fill="url(#pathG)" rx="4"/>
            <rect x="0" y="325" width="820" height="28" fill="url(#dirtPat)"/>

            <rect x="195" y="0" width="28" height="520" fill="url(#pathG)" rx="4"/>
            <rect x="195" y="0" width="28" height="520" fill="url(#dirtPat)"/>
            <rect x="399" y="0" width="28" height="520" fill="url(#pathG)" rx="4"/>
            <rect x="399" y="0" width="28" height="520" fill="url(#dirtPat)"/>
            <rect x="603" y="0" width="28" height="520" fill="url(#pathG)" rx="4"/>
            <rect x="603" y="0" width="28" height="520" fill="url(#dirtPat)"/>

            {[165, 325].map(py => [195, 399, 603].map(px => (
              <g key={`int-${px}-${py}`}>
                <rect x={px} y={py} width="28" height="28" fill="#B89968" rx="3"/>
                <circle cx={px+14} cy={py+14} r="2" fill="#A88A58" opacity="0.5"/>
              </g>
            )))}

            {[
              [50, 172, 8], [120, 340, 6], [300, 172, 7], [500, 340, 9],
              [700, 172, 5], [750, 340, 7], [400, 172, 6],
            ].map(([fx, fy, r], i) => (
              <g key={`deco-${i}`} opacity="0.5">
                <ellipse cx={fx as number} cy={fy as number} rx={r as number} ry={(r as number) * 0.5} fill="#B89968"/>
              </g>
            ))}

            {[
              [80, 178], [280, 336], [520, 178], [680, 336], [180, 178],
            ].map(([fx, fy], i) => (
              <g key={`flower-p-${i}`} opacity="0.6">
                <circle cx={fx as number} cy={fy as number} r="2.5" fill={["#FFD700","#FF7043","#E040FB","#FF5722","#FFC107"][i]}/>
                <circle cx={(fx as number) + 8} cy={(fy as number) + 2} r="2" fill={["#FF7043","#E040FB","#FFD700","#FFC107","#FF5722"][i]}/>
              </g>
            ))}
          </svg>

          {hasChickens && (
            <>
              {[0, 1, 2].map(i => (
                <div key={`chicken-${i}`} className="absolute pointer-events-none" style={{
                  left: 10 + i * 25, top: 300 + i * 8, zIndex: 10,
                  animation: `chickenWalk ${8 + i * 3}s linear infinite`,
                  animationDelay: `${-i * 2}s`,
                }}>
                  <svg width="18" height="16" viewBox="0 0 18 16" style={{ animation: `chickenPeck ${4 + i}s ease-in-out infinite` }}>
                    <ellipse cx="9" cy="10" rx="7" ry="5" fill={i === 0 ? "#FAFAFA" : i === 1 ? "#FFF5E0" : "#DDD"}/>
                    <circle cx="14" cy="6" r="4.5" fill={i === 0 ? "#FAFAFA" : i === 1 ? "#FFF5E0" : "#DDD"}/>
                    <polygon points="17,5 20,4 17,3" fill="#E8730C"/>
                    <circle cx="15" cy="5" r="1.2" fill="#1a1a1a"/>
                    <polygon points="13,2 12,0 14,0" fill="#DC2626"/>
                    <line x1="7" y1="14" x2="6" y2="16" stroke="#E8730C" strokeWidth="1.2"/>
                    <line x1="11" y1="14" x2="12" y2="16" stroke="#E8730C" strokeWidth="1.2"/>
                  </svg>
                </div>
              ))}
            </>
          )}

          {hasCows && (
            <>
              {[0, 1].map(i => (
                <div key={`cow-${i}`} className="absolute pointer-events-none" style={{
                  left: 240 + i * 55, top: 290 + i * 15, zIndex: 10,
                  animation: `cowGraze ${14 + i * 5}s linear infinite`,
                  animationDelay: `${-i * 4}s`,
                }}>
                  <svg width="36" height="28" viewBox="0 0 36 28">
                    <g style={{ animation: "cowHead 6s ease-in-out infinite" }}>
                      <ellipse cx="18" cy="16" rx="14" ry="8" fill="#FAFAFA"/>
                      <ellipse cx="10" cy="14" rx="6" ry="5" fill={i === 0 ? "#2D2D2D" : "#8B6914"} opacity="0.7"/>
                      <ellipse cx="24" cy="17" rx="4" ry="3.5" fill={i === 0 ? "#2D2D2D" : "#8B6914"} opacity="0.5"/>
                      <rect x="6" y="20" width="4" height="8" rx="2" fill="#FAFAFA"/>
                      <rect x="12" y="20" width="4" height="8" rx="2" fill="#FAFAFA"/>
                      <rect x="20" y="20" width="4" height="8" rx="2" fill="#FAFAFA"/>
                      <rect x="26" y="20" width="4" height="8" rx="2" fill="#FAFAFA"/>
                      <circle cx="32" cy="10" r="5.5" fill="#FAFAFA"/>
                      <ellipse cx="35" cy="12" rx="3" ry="2.5" fill="#FFB4B4"/>
                      <circle cx="31" cy="8" r="1.5" fill="#2D2D2D"/>
                      <line x1="28" y1="4" x2="26" y2="0" stroke="#8B7355" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="34" y1="4" x2="36" y2="0" stroke="#8B7355" strokeWidth="2" strokeLinecap="round"/>
                    </g>
                  </svg>
                </div>
              ))}
            </>
          )}

          {hasWindmill && (
            <div className="absolute pointer-events-none" style={{ left: 735, top: 188, zIndex: 11 }}>
              <svg width="40" height="40" viewBox="0 0 40 40">
                <g style={{ transformOrigin: "20px 20px", animation: "windmillSpin 4s linear infinite" }}>
                  {[0, 90, 180, 270].map(a => {
                    const rad = a * Math.PI / 180;
                    const tx = 20 + Math.sin(rad) * 16;
                    const ty = 20 - Math.cos(rad) * 16;
                    return <line key={a} x1="20" y1="20" x2={tx} y2={ty} stroke="#1565C0" strokeWidth="3.5" strokeLinecap="round"/>;
                  })}
                </g>
                <circle cx="20" cy="20" r="4" fill="#37474F"/>
                <circle cx="20" cy="20" r="2" fill="#78909C"/>
              </svg>
            </div>
          )}

          {hasTractor && (
            <div className="absolute pointer-events-none" style={{
              left: 280, top: 495, zIndex: 10,
              animation: "tractorDrive 12s ease-in-out infinite",
            }}>
              <svg width="32" height="22" viewBox="0 0 32 22" style={{ animation: "tractorBounce 0.5s ease-in-out infinite" }}>
                <rect x="8" y="2" width="18" height="12" rx="3" fill="#43A047"/>
                <rect x="6" y="0" width="12" height="8" rx="2" fill="#388E3C"/>
                <rect x="7" y="1" width="5" height="4" rx="1" fill="#BBDEFB"/>
                <circle cx="8" cy="16" r="6" fill="#212121"/>
                <circle cx="8" cy="16" r="4" fill="#333"/>
                <circle cx="8" cy="16" r="1.5" fill="#616161"/>
                <circle cx="24" cy="17" r="4.5" fill="#212121"/>
                <circle cx="24" cy="17" r="3" fill="#333"/>
                <rect x="18" y="4" width="2" height="8" rx="1" fill="#616161"/>
              </svg>
            </div>
          )}

          {hasIrrigation && (
            <div className="absolute pointer-events-none" style={{ left: 720, top: 400, zIndex: 10 }}>
              {[0,1,2,3,4].map(i => (
                <div key={`drop-${i}`} className="absolute" style={{
                  left: i * 15, top: 0,
                  animation: `waterDrop 2s ease-in infinite`,
                  animationDelay: `${i * 0.4}s`,
                }}>
                  <svg width="6" height="10" viewBox="0 0 6 10">
                    <path d="M3 0 Q0 5 3 10 Q6 5 3 0Z" fill="#29B6F6" opacity="0.7"/>
                  </svg>
                </div>
              ))}
            </div>
          )}

          {[0,1,2,3].map(i => (
            <div key={`leaf-${i}`} className="absolute pointer-events-none" style={{
              left: `${10 + i * 25}%`, top: `${5 + i * 15}%`, zIndex: 12,
              animation: `leafFloat ${8 + i * 3}s ease-in-out infinite`,
              animationDelay: `${-i * 2}s`,
            }}>
              <svg width="10" height="10" viewBox="0 0 10 10">
                <ellipse cx="5" cy="5" rx="4" ry="2" fill="#66BB6A" opacity="0.6"/>
              </svg>
            </div>
          ))}

          {totalOwned > 0 && [0,1,2].map(i => (
            <div key={`sparkle-${i}`} className="absolute pointer-events-none" style={{
              left: `${30 + i * 20}%`, top: `${20 + i * 25}%`, zIndex: 12,
              animation: `sparkle ${3 + i}s ease-in-out infinite`,
              animationDelay: `${i * 1.2}s`,
            }}>
              <svg width="8" height="8" viewBox="0 0 8 8">
                <path d="M4 0 L4.5 3.5 L8 4 L4.5 4.5 L4 8 L3.5 4.5 L0 4 L3.5 3.5Z" fill="#FFD700" opacity="0.8"/>
              </svg>
            </div>
          ))}

          {BUILDINGS.map(b => {
            const level = farmSave.owned[b.id] || 0;
            const isOwned = level > 0;
            const isMaxed = level === 3;
            const pos = getBuildingPos(b);

            return (
              <div
                key={b.id}
                className="absolute farm-tile cursor-pointer"
                style={{
                  left: pos.x + 820 / 2,
                  top: pos.y + 30,
                  width: pos.w,
                  height: pos.h,
                  zIndex: 5 + b.row,
                }}
                onClick={() => setSelected(b)}
                data-testid={`tile-${b.id}`}
              >
                <div className="absolute -inset-1 rounded-2xl" style={{
                  background: "rgba(0,0,0,0.12)",
                  filter: "blur(6px)",
                  transform: "translateY(4px)",
                  zIndex: -1,
                }}/>

                <div className="w-full h-full overflow-hidden" style={{
                  borderRadius: 14,
                  boxShadow: isOwned
                    ? `0 8px 28px rgba(0,0,0,0.3), 0 0 0 3px ${LVL_RING_COLOR[level]}`
                    : "0 4px 16px rgba(0,0,0,0.2)",
                  border: isOwned ? "none" : "2px dashed rgba(139,107,53,0.5)",
                  animation: isOwned && level === 3 ? "incomePulse 3s ease-in-out infinite" : "none",
                }}>
                  {isOwned
                    ? <BuildingSVG buildingId={b.id} level={level}/>
                    : <LockedFieldSVG cost={b.buyCost}/>
                  }
                </div>

                <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap flex items-center gap-1" style={{
                  padding: "2px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 800,
                  background: isOwned
                    ? "linear-gradient(135deg, rgba(30,20,10,0.92), rgba(50,35,20,0.92))"
                    : "rgba(60,40,20,0.8)",
                  color: isOwned ? "#FFD700" : "#BDBDBD",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
                  border: isOwned ? "1px solid rgba(255,215,0,0.3)" : "1px solid rgba(100,80,50,0.3)",
                  backdropFilter: "blur(4px)",
                }}>
                  {b.emoji} {b.name}
                  {isOwned && (
                    <span style={{
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 10,
                      fontWeight: 900,
                      background: level === 1 ? "#F5A623" : level === 2 ? "#2196F3" : "#9C27B0",
                      color: "white",
                    }}>
                      {LVL_LABEL[level]}
                    </span>
                  )}
                  {isMaxed && <Star className="w-3 h-3 text-yellow-400 fill-yellow-300"/>}
                </div>

                {isOwned && (
                  <div className="absolute bottom-1.5 right-1.5" style={{
                    background: "linear-gradient(135deg, rgba(0,0,0,0.75), rgba(30,20,10,0.85))",
                    color: "#FFD700",
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,215,0,0.2)",
                    backdropFilter: "blur(4px)",
                  }}>
                    +{b.incomePerTick[level - 1]}🪙/{b.tickMultiplier * 30}s
                  </div>
                )}
              </div>
            );
          })}

          <AnimatePresence>
            {coinPops.map(pop => {
              const b = BUILDINGS.find(bb => bb.id === pop.bId);
              if (!b) return null;
              const pos = getBuildingPos(b);
              return (
                <motion.div
                  key={pop.id}
                  className="absolute pointer-events-none z-40 flex items-center gap-1"
                  style={{
                    left: pos.x + 820 / 2 + pos.w / 2,
                    top: pos.y + 30,
                    transform: "translate(-50%, -100%)",
                  }}
                  initial={{ opacity: 1, y: 0, scale: 0.8 }}
                  animate={{ opacity: 0, y: -60, scale: 1.3 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  onAnimationComplete={() => setCoinPops(cur => cur.filter(p => p.id !== pop.id))}
                >
                  <span className="font-black text-base" style={{ color: "#FFD700", textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}>+{pop.amount}</span>
                  <span className="text-lg">🪙</span>
                </motion.div>
              );
            })}
          </AnimatePresence>

        </div>
      </div>

      <div className="absolute top-0 left-0 right-0 z-30 px-3 py-2 flex items-center gap-2 flex-wrap" style={{
        background: "linear-gradient(180deg, rgba(30,20,10,0.85) 0%, rgba(50,35,20,0.7) 80%, transparent 100%)",
        paddingBottom: 16,
      }}>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
            background: "linear-gradient(135deg, #FFD700, #F5A623)",
            boxShadow: "0 3px 12px rgba(245,166,35,0.5)",
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22">
              <circle cx="11" cy="11" r="9" fill="#F57F17"/>
              <circle cx="11" cy="11" r="6" fill="#FFD54F"/>
              {[0,60,120,180,240,300].map(a => {
                const r = a * Math.PI / 180;
                return <line key={a} x1={11+Math.cos(r)*7} y1={11+Math.sin(r)*7} x2={11+Math.cos(r)*9.5} y2={11+Math.sin(r)*9.5} stroke="#F57F17" strokeWidth="2" strokeLinecap="round"/>;
              })}
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-widest leading-none" style={{ fontFamily: "Oxanium, sans-serif", color: "#FFD700", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
              FARM TYCOON
            </h1>
            <p className="text-[10px] font-semibold" style={{ color: "#C8A84E" }}>Day {farmSave.day} · {farmRating}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-1 justify-end flex-wrap">
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold" style={{
            background: "rgba(76,175,80,0.2)", color: "#A8D8A8", border: "1px solid rgba(76,175,80,0.3)", backdropFilter: "blur(8px)",
          }}>
            ⚡ {Math.round(incomePerMin)}/min
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold" style={{
            background: "rgba(33,150,243,0.2)", color: "#90CAF9", border: "1px solid rgba(33,150,243,0.3)", backdropFilter: "blur(8px)",
          }}>
            🏗️ {totalOwned}/12
          </div>

          {farmSave.farmBank > 0 && (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black"
              style={{
                background: "linear-gradient(135deg, rgba(46,125,50,0.9), rgba(67,160,71,0.9))",
                color: "white",
                boxShadow: "0 2px 16px rgba(46,125,50,0.6)",
                border: "1px solid rgba(255,255,255,0.2)",
                backdropFilter: "blur(8px)",
              }}
            >
              🌾 {farmSave.farmBank}
            </motion.div>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-black" style={{
            background: "linear-gradient(135deg, rgba(245,166,35,0.9), rgba(255,215,0,0.9))",
            color: "#5D4037",
            boxShadow: "0 2px 12px rgba(245,166,35,0.5)",
            border: "1px solid rgba(255,255,255,0.3)",
          }}>
            <Coins className="w-4 h-4"/>
            {user.eduCoins}
          </div>

          <Button
            size="sm"
            className="h-9 px-5 text-xs font-black transition-all"
            style={{
              background: farmSave.farmBank > 0
                ? "linear-gradient(135deg, #2E7D32, #1B5E20)"
                : "rgba(255,255,255,0.1)",
              color: farmSave.farmBank > 0 ? "white" : "rgba(200,168,78,0.5)",
              border: farmSave.farmBank > 0 ? "2px solid #4CAF50" : "2px solid transparent",
              boxShadow: farmSave.farmBank > 0 ? "0 3px 16px rgba(46,125,50,0.5)" : "none",
              backdropFilter: "blur(8px)",
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

      <div className="absolute bottom-0 left-0 right-0 z-20 text-center pb-2">
        <p className="text-[11px] font-medium px-4 py-1 rounded-full inline-block" style={{
          background: "rgba(30,20,10,0.6)", color: "rgba(200,180,140,0.8)", backdropFilter: "blur(8px)",
        }}>
          Tap any plot to build or upgrade · Income generates every 30s · Harvest to collect
        </p>
      </div>

      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
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

function BuildingModal({
  b, level, userCoins, onBuy, onUpgrade, onClose, isPending,
}: {
  b: BuildingDef; level: number; userCoins: number;
  onBuy: () => void; onUpgrade: () => void; onClose: () => void;
  isPending: boolean;
}) {
  const action = level === 0
    ? { type: "buy" as const, label: "Build", cost: b.buyCost }
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
        boxShadow: "0 -4px 40px rgba(0,0,0,0.3), 0 0 0 3px rgba(139,105,20,0.3)",
        border: "2px solid rgba(139,105,20,0.2)",
      }}>
        <div className="h-40 w-full overflow-hidden" style={{ background: "linear-gradient(135deg, #E8E0CC, #D4C8A8)" }}>
          <div className="w-full h-full">
            {level > 0 ? <BuildingSVG buildingId={b.id} level={level}/> : <LockedFieldSVG cost={b.buyCost}/>}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">{b.emoji}</span>
                <h3 className="font-black text-lg" style={{ fontFamily: "Oxanium, sans-serif", color: "#3E2716" }}>{b.name}</h3>
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
                opacity: level < i + 1 ? 0.5 : 1,
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
              border: "2px solid rgba(156,39,176,0.3)",
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
                    : "0 3px 12px rgba(21,101,192,0.4)",
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
