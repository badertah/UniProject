import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { THEME_FARM_SKY_TINT } from "@shared/cosmetic-perks";
import { UserAvatar } from "@/components/cosmetics";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Coins, Star, X, ArrowUpCircle, ShoppingCart, ChevronLeft, ChevronDown, ChevronUp, Plus, Minus, Maximize2, Lock, Sparkles, CheckCircle2, GraduationCap } from "lucide-react";
import { BuildingSVG, LockedFieldSVG } from "@/components/farm-buildings";
import {
  useAtmosphere, skyGradient as baseSkyGradient, CelestialBody, Stars, WeatherLayer, SkyBalloon,
  AmbientCreatures, TickProgress, BankMeter, WeatherBadge,
  GoldenCropOverlay, useGoldenCropSpawner, HarvestBurst, LightningFlash,
} from "@/components/farm-extras";
import {
  WORLD_W, WORLD_H,
  WorldGround, Minimap,
} from "@/components/farm-world";

const TICK_INTERVAL_MS = 30_000;
const MAX_FARM_BANK    = 500;
const MAX_OFFLINE_TICKS = 20;
const farmKey = (uid: string) => `farm_v2_state_${uid}`;

interface BuildingDef {
  id: string; name: string; emoji: string;
  description: string;
  category: "crops" | "buildings" | "livestock" | "equipment";
  buyCost: number; upgradeCost: [number, number];
  incomePerTick: [number, number, number];
  tickMultiplier: number;
}

const BUILDINGS: BuildingDef[] = [
  { id: "wheat_field",     name: "Wheat Field",      emoji: "🌾", description: "Golden wheat rows — steady income.", category: "crops",     buyCost: 30,  upgradeCost: [60,  120], incomePerTick: [2,  5,  10], tickMultiplier: 1 },
  { id: "vegetable_patch", name: "Vegetable Patch",  emoji: "🥕", description: "Fresh vegetables that grow faster.", category: "crops",     buyCost: 50,  upgradeCost: [100, 200], incomePerTick: [3,  7,  14], tickMultiplier: 1 },
  { id: "apple_orchard",   name: "Apple Orchard",    emoji: "🍎", description: "Beautiful orchard trees.", category: "crops",     buyCost: 80,  upgradeCost: [150, 300], incomePerTick: [4,  9,  18], tickMultiplier: 1 },
  { id: "greenhouse",      name: "Greenhouse",       emoji: "🌿", description: "Year-round glass house.", category: "crops",     buyCost: 120, upgradeCost: [240, 480], incomePerTick: [5,  11, 22], tickMultiplier: 1 },
  { id: "chicken_coop",    name: "Chicken Coop",     emoji: "🐔", description: "Free-range hens.", category: "livestock", buyCost: 55,  upgradeCost: [110, 220], incomePerTick: [4,  8,  16], tickMultiplier: 2 },
  { id: "dairy_cows",      name: "Dairy Cows",       emoji: "🐄", description: "Happy cows producing milk.", category: "livestock", buyCost: 90,  upgradeCost: [180, 360], incomePerTick: [5,  11, 22], tickMultiplier: 2 },
  { id: "farmhouse",       name: "Farmhouse",        emoji: "🏠", description: "Your home base — production hub.", category: "buildings", buyCost: 40,  upgradeCost: [90,  180], incomePerTick: [3,  6,  13], tickMultiplier: 2 },
  { id: "windmill",        name: "Windmill",         emoji: "⚙️", description: "Harnessing wind power.", category: "buildings", buyCost: 100, upgradeCost: [200, 400], incomePerTick: [6,  12, 24], tickMultiplier: 2 },
  { id: "barn",            name: "Red Barn",         emoji: "🏚️", description: "Classic red barn.", category: "buildings", buyCost: 70,  upgradeCost: [140, 280], incomePerTick: [5,  10, 20], tickMultiplier: 3 },
  { id: "tractor",         name: "Tractor",          emoji: "🚜", description: "Heavy-duty machine.", category: "equipment", buyCost: 150, upgradeCost: [300, 600], incomePerTick: [8,  16, 32], tickMultiplier: 3 },
  { id: "silo",            name: "Grain Silo",       emoji: "🏗️", description: "Store grain in bulk.", category: "equipment", buyCost: 130, upgradeCost: [260, 520], incomePerTick: [7,  14, 28], tickMultiplier: 3 },
  { id: "irrigation",      name: "Irrigation",       emoji: "💧", description: "Automated water system.", category: "equipment", buyCost: 110, upgradeCost: [220, 440], incomePerTick: [6,  13, 26], tickMultiplier: 3 },
];

// Each building lives at its own world (x,y) — scattered across the 2400x1700
// world rather than stacked on a tiny grid. Positions are picked to:
//   • avoid the ponds, river, dirt paths, mountains, scarecrow, sheep, etc.
//   • cluster thematically (equipment yard north, livestock by pasture)
//   • give the production-chain arrows readable geometry (no major crossings)
const BUILDING_POS: Record<string, { x: number; y: number }> = {
  // North row — equipment yard / mill
  tractor:         { x: 560,  y: 770 },
  windmill:        { x: 1200, y: 720 },
  silo:            { x: 1840, y: 770 },
  // Center row — utilities + hub
  irrigation:      { x: 470,  y: 970 },
  farmhouse:       { x: 1200, y: 970 },
  barn:            { x: 1900, y: 1000 },
  // South fields — crops
  apple_orchard:   { x: 380,  y: 1200 },
  wheat_field:     { x: 820,  y: 1140 },
  greenhouse:      { x: 1680, y: 1100 },
  vegetable_patch: { x: 2010, y: 1200 },
  // Pasture row — livestock
  chicken_coop:    { x: 1060, y: 1250 },
  dairy_cows:      { x: 1500, y: 1250 },
};

function bldgPos(id: string): { x: number; y: number } {
  return BUILDING_POS[id] ?? { x: 1200, y: 1000 };
}

// === Production / data-flow chain (SAD: data flow diagram-style edges) ===
// Each edge represents a "flow" from a source building to a sink. Visualised
// as an animated dashed arrow ONLY when both endpoints are owned. Players
// see their farm self-organise into a working system as they build.
type Edge = { from: string; to: string; kind: "input" | "store" | "output" | "power" };
const PRODUCTION_EDGES: Edge[] = [
  // Inputs (irrigation → all crops)
  { from: "irrigation", to: "wheat_field",     kind: "input" },
  { from: "irrigation", to: "vegetable_patch", kind: "input" },
  { from: "irrigation", to: "apple_orchard",   kind: "input" },
  { from: "irrigation", to: "greenhouse",      kind: "input" },
  // Tractor plows the open fields
  { from: "tractor",    to: "wheat_field",     kind: "input" },
  { from: "tractor",    to: "vegetable_patch", kind: "input" },
  // Harvest → storage
  { from: "wheat_field", to: "silo",           kind: "store" },
  // Windmill powers the silo (mill the grain)
  { from: "windmill",    to: "silo",           kind: "power" },
  // Storage → barn (packaging)
  { from: "silo",        to: "barn",           kind: "store" },
  // All producers → farmhouse hub (output pipeline)
  { from: "chicken_coop",   to: "farmhouse",   kind: "output" },
  { from: "dairy_cows",     to: "farmhouse",   kind: "output" },
  { from: "apple_orchard",  to: "farmhouse",   kind: "output" },
  { from: "vegetable_patch", to: "farmhouse",  kind: "output" },
];

const EDGE_COLOR: Record<Edge["kind"], string> = {
  input:  "#4FC3F7",  // cyan-blue (water/equipment input)
  store:  "#FFB74D",  // amber (raw → stored)
  output: "#81C784",  // green (finished goods → hub)
  power:  "#CE93D8",  // purple (energy)
};

// === Road style by min(level) of its two endpoints ===
// Level 1: dirt path (narrow, brown). Level 2: gravel (wider, lighter).
// Level 3: paved with yellow center-lane markings (widest, dark grey).
// Higher tiers also get faster trucks — players see infrastructure pay off.
type RoadDash = { color: string; w: number; array: string; opacity: number };
type RoadStyle = { width: number; base: string; top: string; dash: RoadDash | null; truckDur: number };
function roadStyleFor(lv: number): RoadStyle {
  if (lv >= 3) return { width: 26, base: "#3A3A3A", top: "#5A5A5A", dash: { color: "#FFEB3B", w: 1.6, array: "12 8", opacity: 0.8 }, truckDur: 5 };
  if (lv === 2) return { width: 20, base: "#5E4B2A", top: "#9A7B45", dash: null, truckDur: 7.5 };
  return { width: 14, base: "#6B5028", top: "#8E6A36", dash: null, truckDur: 10 };
}

// Truck body color by edge kind so players can read the network at a glance.
const TRUCK_COLOR: Record<Edge["kind"], string> = {
  input:  "#1976D2",  // blue tanker (water/equipment in)
  store:  "#F57C00",  // orange box-truck (storage runs)
  output: "#388E3C",  // green delivery (finished goods)
  power:  "#7B1FA2",  // purple service (power/mill)
};

// === SAD-themed side quests ===
// Quests reference Systems Analysis & Design concepts so players learn
// while playing. Each quest is one-time, persisted in completedQuests.
type QuestReq =
  | { kind: "any_owned"; count: number }
  | { kind: "all_owned"; ids: string[] }
  | { kind: "category_coverage"; count: number }
  | { kind: "max_level" };

type QuestDef = {
  id: string;
  title: string;
  hint: string;
  sadConcept: string;
  reward: number;
  req: QuestReq;
};

const QUESTS: QuestDef[] = [
  {
    id: "boot_up",
    title: "Boot Up",
    hint: "Build your first plot to bootstrap the system.",
    sadConcept: "System Initialization",
    reward: 25,
    req: { kind: "any_owned", count: 1 },
  },
  {
    id: "inputs",
    title: "Define Inputs",
    hint: "Build a Wheat Field, Chicken Coop, and Dairy Cows.",
    sadConcept: "Input Sources",
    reward: 80,
    req: { kind: "all_owned", ids: ["wheat_field", "chicken_coop", "dairy_cows"] },
  },
  {
    id: "process_store",
    title: "Process & Store",
    hint: "Add a storage layer: build the Silo and Barn.",
    sadConcept: "Storage Layer (Data Store)",
    reward: 100,
    req: { kind: "all_owned", ids: ["silo", "barn"] },
  },
  {
    id: "output_pipeline",
    title: "Output Pipeline",
    hint: "Build the Farmhouse hub plus 3 producers (any livestock or crop).",
    sadConcept: "Output Subsystem",
    reward: 120,
    req: { kind: "all_owned", ids: ["farmhouse"] }, // also needs ≥3 producers — checked in evaluator
  },
  {
    id: "normalize",
    title: "Normalize Schema",
    hint: "Own at least 1 building from each of the 4 categories.",
    sadConcept: "Schema Normalization",
    reward: 150,
    req: { kind: "category_coverage", count: 4 },
  },
  {
    id: "scale",
    title: "Refactor & Scale",
    hint: "Upgrade any building to LV3 ★.",
    sadConcept: "Iterative Refinement",
    reward: 200,
    req: { kind: "max_level" },
  },
];

function questProgress(q: QuestDef, owned: Record<string, number>): { done: boolean; pct: number; label: string } {
  switch (q.req.kind) {
    case "any_owned": {
      const have = Object.values(owned).filter(v => v > 0).length;
      const need = q.req.count;
      return { done: have >= need, pct: Math.min(1, have / need), label: `${Math.min(have, need)} / ${need}` };
    }
    case "all_owned": {
      const ids = q.req.ids;
      const have = ids.filter(id => (owned[id] || 0) > 0).length;
      // Special case: output_pipeline needs ALSO ≥3 producers besides farmhouse.
      if (q.id === "output_pipeline") {
        const producers = ["wheat_field","vegetable_patch","apple_orchard","greenhouse","chicken_coop","dairy_cows"];
        const owns = producers.filter(id => (owned[id] || 0) > 0).length;
        const farmOk = (owned["farmhouse"] || 0) > 0;
        const total = (farmOk ? 1 : 0) + Math.min(owns, 3);
        return { done: farmOk && owns >= 3, pct: total / 4, label: `${total} / 4` };
      }
      return { done: have >= ids.length, pct: have / ids.length, label: `${have} / ${ids.length}` };
    }
    case "category_coverage": {
      const cats = new Set<string>();
      BUILDINGS.forEach(b => { if ((owned[b.id] || 0) > 0) cats.add(b.category); });
      return { done: cats.size >= q.req.count, pct: Math.min(1, cats.size / q.req.count), label: `${cats.size} / ${q.req.count}` };
    }
    case "max_level": {
      const maxed = Object.values(owned).filter(v => v >= 3).length;
      return { done: maxed >= 1, pct: maxed >= 1 ? 1 : 0, label: maxed >= 1 ? "Done" : "0 / 1" };
    }
  }
}

type FarmSave = {
  owned: Record<string, number>;
  farmBank: number;
  lastTickTime: number;
  tickCounters: Record<string, number>;
  day: number;
  completedQuests: string[];
};

function loadState(uid: string): FarmSave {
  try { const raw = localStorage.getItem(farmKey(uid)); if (raw) return { ...defaultState(), ...JSON.parse(raw) }; } catch {} return defaultState();
}
function defaultState(): FarmSave { return { owned: {}, farmBank: 0, lastTickTime: Date.now(), tickCounters: {}, day: 1, completedQuests: [] }; }
function saveState(s: FarmSave, uid: string) { localStorage.setItem(farmKey(uid), JSON.stringify(s)); }

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

// === Camera config ===
// The farm world is rendered at WORLD_W × WORLD_H. We must NEVER let the
// camera zoom or pan to a state where its rectangular edges are visible —
// that's what makes the scene look like a "framed pic" instead of a
// continuous landscape. Two invariants enforce this:
//   1. minScale is *at least* the scale needed for the world to cover the
//      viewport on both axes (computed per-render from viewport size).
//   2. clampCamera locks pan so the viewport is always entirely inside the
//      world's transformed bounds (no edge can ever scroll into view).
const ZOOM_MAX_FACTOR = 2.2;    // upper-zoom multiplier (allow tighter close-ups)

type Camera = { x: number; y: number; scale: number };

// Smallest scale at which world still fully covers the viewport on both axes.
// Tiny epsilon (0.002 ≈ 0.2%) guards against sub-pixel rounding on some GPUs
// that could otherwise reveal a 1px seam between world edge and page bg.
function viewportCoverScale(vw: number, vh: number) {
  return Math.max(vw / WORLD_W, vh / WORLD_H) + 0.002;
}

function clampCamera(cam: Camera, vw: number, vh: number, minScale: number, maxScale: number): Camera {
  // Floor minScale to "world covers viewport" so edges can never be revealed.
  const coverFloor = viewportCoverScale(vw, vh);
  const effectiveMin = Math.max(minScale, coverFloor);
  const scale = Math.max(effectiveMin, Math.min(maxScale, cam.scale));
  const wScale = WORLD_W * scale;
  const hScale = WORLD_H * scale;
  // Lock pan: viewport must stay fully inside world bounds (no over-pan).
  // x range: [-(wScale - vw), 0]  (cam.x is the world-origin in viewport px)
  const minX = vw - wScale;
  const maxX = 0;
  const minY = vh - hScale;
  const maxY = 0;
  return {
    x: wScale <= vw ? (vw - wScale) / 2 : Math.max(minX, Math.min(maxX, cam.x)),
    y: hScale <= vh ? (vh - hScale) / 2 : Math.max(minY, Math.min(maxY, cam.y)),
    scale,
  };
}

export default function FarmPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [farmSave, setFarmSave] = useState<FarmSave>(defaultState);
  const [coinPops, setCoinPops] = useState<CoinPop[]>([]);
  const [selected, setSelected] = useState<BuildingDef | null>(null);
  const [isHarvesting, setIsHarvesting] = useState(false);
  // harvestPulse holds true for ~3s after a harvest click so trucks have time
  // to be visibly faster + carry gold cargo even though the API call resolves
  // in <300ms. Decoupled from isHarvesting (which only gates the central flash).
  const [harvestPulse, setHarvestPulse] = useState(false);
  const harvestPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerHarvestPulse = useCallback(() => {
    setHarvestPulse(true);
    if (harvestPulseTimerRef.current) clearTimeout(harvestPulseTimerRef.current);
    harvestPulseTimerRef.current = setTimeout(() => setHarvestPulse(false), 3000);
  }, []);
  useEffect(() => () => { if (harvestPulseTimerRef.current) clearTimeout(harvestPulseTimerRef.current); }, []);
  const tickRef = useRef<NodeJS.Timeout | null>(null);
  const userIdRef = useRef<string | null>(null);
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (loadedForRef.current === user.id) return;
    loadedForRef.current = user.id;
    userIdRef.current = user.id;
    const saved = loadState(user.id);
    const elapsed = Date.now() - saved.lastTickTime;
    const missed = Math.min(Math.floor(elapsed / TICK_INTERVAL_MS), MAX_OFFLINE_TICKS);
    if (missed > 0) {
      const { state: ns } = processTicks(saved, missed, true);
      ns.lastTickTime = Date.now();
      saveState(ns, user.id);
      setFarmSave(ns);
    } else {
      setFarmSave(saved);
    }
  }, [user?.id]);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      const uid = userIdRef.current;
      if (!uid) return;
      setFarmSave(prev => {
        const { state: ns, pops } = processTicks(prev, 1, false);
        ns.lastTickTime = Date.now();
        saveState(ns, uid);
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
      const bonusMsg = data.bonusCoins && data.bonusCoins > 0
        ? ` (+${data.bonusCoins} cosmetic bonus, ×${(data.farmMult || 1).toFixed(2)})`
        : "";
      toast({ title: `🌾 Harvest! +${data.coinsAdded} EduCoins${bonusMsg}`, description: `Day ${farmSave.day + 1} begins!` });
      setFarmSave(prev => { const ns = { ...prev, farmBank: 0, day: prev.day + 1 }; if (user) saveState(ns, user.id); return ns; });
      setIsHarvesting(false);
    },
    onError: () => { toast({ title: "Harvest failed", variant: "destructive" }); setIsHarvesting(false); },
  });

  const spendMutation = useMutation({
    mutationFn: (amount: number) => apiRequest("POST", "/api/coins/spend", { amount }),
    onSuccess: (data: any) => { if (data.user) updateUser(data.user); queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }); },
  });

  // Quest reward = use the existing harvest endpoint (it just adds coins).
  // We mark the quest done locally first (optimistic) and only credit coins
  // on server success — if the request fails we roll back the completion.
  const claimQuestMutation = useMutation({
    mutationFn: (q: QuestDef) => apiRequest("POST", "/api/farm/harvest", { coins: q.reward, skipMult: true }).then(r => r),
  });
  const claimQuest = useCallback((q: QuestDef) => {
    if (!user) return;
    if (farmSave.completedQuests.includes(q.id)) return;
    const prog = questProgress(q, farmSave.owned);
    if (!prog.done) return;
    // Optimistically mark complete so the button can't be double-clicked.
    setFarmSave(prev => {
      const ns = { ...prev, completedQuests: [...prev.completedQuests, q.id] };
      if (user) saveState(ns, user.id);
      return ns;
    });
    claimQuestMutation.mutate(q, {
      onSuccess: (data: any) => {
        if (data.user) updateUser(data.user);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        toast({ title: `🎓 ${q.title} completed!`, description: `+${q.reward} EduCoins · ${q.sadConcept}` });
      },
      onError: () => {
        // Roll back the optimistic completion
        setFarmSave(prev => {
          const ns = { ...prev, completedQuests: prev.completedQuests.filter(id => id !== q.id) };
          if (user) saveState(ns, user.id);
          return ns;
        });
        toast({ title: "Could not claim reward", variant: "destructive" });
      },
    });
  }, [user, farmSave.owned, farmSave.completedQuests, claimQuestMutation, updateUser, toast]);

  const handleBuy = useCallback((b: BuildingDef) => {
    if (!user || user.eduCoins < b.buyCost) { toast({ title: "Not enough EduCoins", variant: "destructive" }); return; }
    spendMutation.mutate(b.buyCost, {
      onSuccess: () => {
        setFarmSave(prev => { const ns = { ...prev, owned: { ...prev.owned, [b.id]: 1 } }; if (user) saveState(ns, user.id); return ns; });
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
        setFarmSave(prev => { const ns = { ...prev, owned: { ...prev.owned, [b.id]: nl } }; if (user) saveState(ns, user.id); return ns; });
        setSelected(null);
        toast({ title: `⬆️ ${b.name} → Level ${nl}!` });
      },
    });
  }, [user, farmSave.owned, spendMutation, toast]);

  const [, setLocation] = useLocation();

  const [viewSize, setViewSize] = useState({ w: typeof window !== "undefined" ? window.innerWidth : 1024, h: typeof window !== "undefined" ? window.innerHeight : 768 });
  useEffect(() => {
    const r = () => setViewSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", r);
    window.addEventListener("orientationchange", r);
    return () => { window.removeEventListener("resize", r); window.removeEventListener("orientationchange", r); };
  }, []);

  // === Camera (pan + zoom) ===
  // Compute the "fit" scale so the board comfortably fills the viewport on
  // first render, then derive min/max zoom around it.
  const isMobile = viewSize.w < 640;
  // Buildings are scattered across roughly this AABB (matches BUILDING_POS extents).
  // We size the fit scale so this whole cluster comfortably fills the viewport on
  // first render, and centre on its centroid.
  const CLUSTER_W = 1700; // x: ~360..2060
  const CLUSTER_H = 620;  // y: ~700..1320
  const CLUSTER_CX = 1200;
  const CLUSTER_CY = 990;
  const fitScale = useMemo(() => {
    const widthFit  = (viewSize.w * (isMobile ? 1.0 : 0.92)) / CLUSTER_W;
    const heightFit = (viewSize.h * (isMobile ? 0.78 : 0.72)) / CLUSTER_H;
    // Floor at viewport-cover scale so the world always fills the screen even
    // at the default fit zoom — no edges, no "framed picture" feel.
    const cover = viewportCoverScale(viewSize.w, viewSize.h);
    return Math.max(cover, Math.min(widthFit, heightFit, 1.6));
  }, [viewSize.w, viewSize.h, isMobile]);
  // minScale = the cover scale (cannot zoom out further). maxScale allows
  // tighter close-ups than fit so users can inspect individual buildings.
  const minScale = useMemo(() => viewportCoverScale(viewSize.w, viewSize.h), [viewSize.w, viewSize.h]);
  const maxScale = useMemo(() => Math.max(fitScale * ZOOM_MAX_FACTOR, 1.6), [fitScale]);

  const computeDefaultCam = useCallback((vw: number, vh: number, scale: number): Camera => {
    return clampCamera({
      x: vw / 2 - CLUSTER_CX * scale,
      y: vh * 0.50 - CLUSTER_CY * scale + (isMobile ? 24 : 18),
      scale,
    }, vw, vh, scale * 0.9, scale * 1.1);
  }, [isMobile]);

  const [camera, setCameraState] = useState<Camera>(() => computeDefaultCam(viewSize.w, viewSize.h, fitScale));
  const cameraRef = useRef(camera);
  const setCamera = useCallback((next: Camera | ((c: Camera) => Camera)) => {
    setCameraState(prev => {
      const v = typeof next === "function" ? next(prev) : next;
      cameraRef.current = v;
      return v;
    });
  }, []);

  // Re-fit camera ONLY on meaningful viewport changes — not on mobile
  // browser-chrome jitter (URL bar collapse changes innerHeight by ~100px).
  // We re-fit when:
  //   • The user has not yet interacted (initial mount / freshly mounted), OR
  //   • Orientation flipped (landscape ↔ portrait), OR
  //   • Width changed by > 80px (real resize, not chrome jitter).
  const userInteractedRef = useRef(false);
  const lastFitRef = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const last = lastFitRef.current;
    if (!last) {
      lastFitRef.current = { w: viewSize.w, h: viewSize.h };
      setCamera(computeDefaultCam(viewSize.w, viewSize.h, fitScale));
      return;
    }
    const orientationFlipped = (last.w > last.h) !== (viewSize.w > viewSize.h);
    const widthChangedSignificantly = Math.abs(viewSize.w - last.w) > 80;
    if (orientationFlipped || widthChangedSignificantly || !userInteractedRef.current) {
      lastFitRef.current = { w: viewSize.w, h: viewSize.h };
      setCamera(computeDefaultCam(viewSize.w, viewSize.h, fitScale));
    }
    // Otherwise (mobile address-bar collapse, tiny height jitter) keep the
    // camera where the user left it. Just re-clamp so it stays in bounds.
    else {
      lastFitRef.current = { w: viewSize.w, h: viewSize.h };
      setCamera(c => clampCamera(c, viewSize.w, viewSize.h, minScale, maxScale));
    }
  }, [viewSize.w, viewSize.h, fitScale, minScale, maxScale, computeDefaultCam, setCamera]);

  const recenter = useCallback(() => {
    userInteractedRef.current = false; // explicit recenter resets the "user moved it" flag
    setCamera(computeDefaultCam(viewSize.w, viewSize.h, fitScale));
  }, [computeDefaultCam, viewSize.w, viewSize.h, fitScale, setCamera]);

  // Smoothly nudge zoom toward the viewport center (used by +/- buttons)
  const nudgeZoom = useCallback((factor: number) => {
    userInteractedRef.current = true;
    setCamera(prev => {
      const ns = Math.max(minScale, Math.min(maxScale, prev.scale * factor));
      const cx = viewSize.w / 2;
      const cy = viewSize.h / 2;
      const wx = (cx - prev.x) / prev.scale;
      const wy = (cy - prev.y) / prev.scale;
      return clampCamera({ x: cx - wx * ns, y: cy - wy * ns, scale: ns }, viewSize.w, viewSize.h, minScale, maxScale);
    });
  }, [minScale, maxScale, viewSize.w, viewSize.h, setCamera]);

  // === Pan / pinch handlers ===
  // `moved` tracks the CURRENT in-progress gesture only and is reset on
  // pointer-end. To still swallow the synthetic click that fires
  // immediately after a drag (browsers fire `click` after `pointerup` on
  // the same target), we set `suppressClickUntil` to a short timestamp and
  // tileClickGuard checks that.
  const dragRef = useRef({
    pointers: new Map<number, { x: number; y: number }>(),
    moved: false,
    startX: 0, startY: 0,
    camX: 0, camY: 0,
    pinchDist: 0,
    pinchScale: 1,
    pinchMidX: 0, pinchMidY: 0,
    pinchCamX: 0, pinchCamY: 0,
    suppressClickUntil: 0,
  });

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    // If the user pressed on an interactive element (tile, button), let it handle the click.
    if (target.closest("[data-no-pan]")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
    dragRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dragRef.current.pointers.size === 1) {
      dragRef.current.moved = false;
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
      dragRef.current.camX = cameraRef.current.x;
      dragRef.current.camY = cameraRef.current.y;
    } else if (dragRef.current.pointers.size === 2) {
      const pts = Array.from(dragRef.current.pointers.values());
      dragRef.current.pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      dragRef.current.pinchScale = cameraRef.current.scale;
      dragRef.current.pinchMidX = (pts[0].x + pts[1].x) / 2;
      dragRef.current.pinchMidY = (pts[0].y + pts[1].y) / 2;
      dragRef.current.pinchCamX = cameraRef.current.x;
      dragRef.current.pinchCamY = cameraRef.current.y;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.pointers.has(e.pointerId)) return;
    dragRef.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dragRef.current.pointers.size === 1) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) + Math.abs(dy) > 6) {
        dragRef.current.moved = true;
        userInteractedRef.current = true;
      }
      if (dragRef.current.moved) {
        setCamera(c => clampCamera({ x: dragRef.current.camX + dx, y: dragRef.current.camY + dy, scale: c.scale }, viewSize.w, viewSize.h, minScale, maxScale));
      }
    } else if (dragRef.current.pointers.size === 2) {
      const pts = Array.from(dragRef.current.pointers.values());
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (dragRef.current.pinchDist > 0) {
        const newScale = Math.max(minScale, Math.min(maxScale, dragRef.current.pinchScale * (d / dragRef.current.pinchDist)));
        const mx = (pts[0].x + pts[1].x) / 2;
        const my = (pts[0].y + pts[1].y) / 2;
        // Anchor zoom around the original pinch midpoint in world coords
        const wx = (dragRef.current.pinchMidX - dragRef.current.pinchCamX) / dragRef.current.pinchScale;
        const wy = (dragRef.current.pinchMidY - dragRef.current.pinchCamY) / dragRef.current.pinchScale;
        const newCamX = mx - wx * newScale;
        const newCamY = my - wy * newScale;
        setCamera(clampCamera({ x: newCamX, y: newCamY, scale: newScale }, viewSize.w, viewSize.h, minScale, maxScale));
        dragRef.current.moved = true;
        userInteractedRef.current = true;
      }
    }
  };

  const endPointer = (e: React.PointerEvent) => {
    dragRef.current.pointers.delete(e.pointerId);
    if (dragRef.current.pointers.size < 2) {
      dragRef.current.pinchDist = 0;
    }
    if (dragRef.current.pointers.size === 0) {
      // If THIS gesture moved, swallow the synthetic click that browsers
      // fire immediately after pointerup on the same target. After the
      // brief window expires, normal taps resume — so single taps that
      // come AFTER a drag still work without requiring a double-tap.
      if (dragRef.current.moved) {
        dragRef.current.suppressClickUntil = Date.now() + 350;
      }
      dragRef.current.moved = false;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    // Zoom toward cursor
    const delta = -e.deltaY * 0.0018;
    const prev = cameraRef.current;
    const ns = Math.max(minScale, Math.min(maxScale, prev.scale * (1 + delta)));
    if (ns === prev.scale) return;
    const wx = (e.clientX - prev.x) / prev.scale;
    const wy = (e.clientY - prev.y) / prev.scale;
    setCamera(clampCamera({ x: e.clientX - wx * ns, y: e.clientY - wy * ns, scale: ns }, viewSize.w, viewSize.h, minScale, maxScale));
    userInteractedRef.current = true;
  };

  // Tile click: only fire if the user just finished a drag gesture.
  // Uses a short timestamp window (set in endPointer) instead of a
  // sticky `moved` flag, so single taps after a drag work normally.
  const tileClickGuard = (cb: () => void) => () => {
    if (Date.now() < dragRef.current.suppressClickUntil) return;
    cb();
  };

  if (!user) return null;

  const totalOwned = Object.values(farmSave.owned).filter(v => v > 0).length;
  const farmRating = totalOwned === 0 ? "Empty Farm" : totalOwned < 4 ? "Seedling" : totalOwned < 8 ? "Growing" : totalOwned < 12 ? "Thriving" : "Legendary";
  const incomePerMin = BUILDINGS.reduce((s, b) => { const lv = farmSave.owned[b.id] || 0; return lv ? s + (b.incomePerTick[lv - 1] / b.tickMultiplier) * 2 : s; }, 0);

  const hasChickens = (farmSave.owned["chicken_coop"] || 0) > 0;
  const hasCows = (farmSave.owned["dairy_cows"] || 0) > 0;

  // Sort by world y so further-down buildings render on top (isometric depth).
  const sortedBuildings = [...BUILDINGS].sort((a, b) => bldgPos(a.id).y - bldgPos(b.id).y);

  // === Atmosphere ===
  const atm = useAtmosphere();
  // Cosmetic theme override for the farm sky — when the player has a
  // theme equipped, use its dramatic gradient instead of the default
  // time-of-day sky. Looked up by icon via the shared THEME_FARM_SKY_TINT.
  const { data: cosmeticsList } = useQuery<any[]>({ queryKey: ["/api/cosmetics"] });
  const equippedThemeIcon = useMemo(() => {
    if (!user.equippedTheme || !cosmeticsList) return null;
    return cosmeticsList.find((c: any) => c.id === user.equippedTheme)?.icon as string | undefined;
  }, [user.equippedTheme, cosmeticsList]);
  const themedSky = equippedThemeIcon && THEME_FARM_SKY_TINT[equippedThemeIcon]
    ? THEME_FARM_SKY_TINT[equippedThemeIcon]
    : baseSkyGradient(atm.phase, atm.weather);
  const ownedIds = BUILDINGS.filter(b => (farmSave.owned[b.id] || 0) > 0).map(b => b.id);
  const golden = useGoldenCropSpawner(ownedIds, totalOwned > 0);
  const collectGolden = () => {
    const spawn = golden.spawn;
    if (!spawn) return;
    golden.collect((amount) => {
      setFarmSave(prev => {
        const next = { ...prev, farmBank: prev.farmBank + amount };
        if (user) saveState(next, user.id);
        return next;
      });
      setCoinPops(cur => [...cur, { id: `gold-${Date.now()}`, bId: spawn.bId, amount }]);
      toast({ title: "🌟 Golden Harvest!", description: `+${amount} coins added to the bank.` });
    });
  };
  const goldenPos = golden.spawn ? bldgPos(golden.spawn.bId) : null;

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: themedSky, transition: "background 1.5s linear" }}>
      <style>{`
        @keyframes cloudDrift { 0% { transform: translateX(-200px); } 100% { transform: translateX(calc(100vw + 200px)); } }
        @keyframes cloudDrift2 { 0% { transform: translateX(calc(100vw + 200px)); } 100% { transform: translateX(-200px); } }
        @keyframes windmillSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes chickenWalk { 0% { transform: translateX(0) scaleX(1); } 45% { transform: translateX(60px) scaleX(1); } 50% { transform: translateX(60px) scaleX(-1); } 95% { transform: translateX(0) scaleX(-1); } 100% { transform: translateX(0) scaleX(1); } }
        @keyframes cowGraze { 0% { transform: translateX(0); } 40% { transform: translateX(40px); } 60% { transform: translateX(40px); } 100% { transform: translateX(0); } }
        @keyframes tractorDrive { 0% { transform: translateX(-30px) scaleX(1); } 50% { transform: translateX(30px) scaleX(1); } 51% { transform: translateX(30px) scaleX(-1); } 99% { transform: translateX(-30px) scaleX(-1); } 100% { transform: translateX(-30px) scaleX(1); } }
        @keyframes birdFly { 0% { transform: translateX(-80px) translateY(0); } 50% { transform: translateX(50vw) translateY(-12px); } 100% { transform: translateX(100vw) translateY(5px); } }
        @keyframes balloonDrift { 0% { transform: translate(0, 0); } 50% { transform: translate(30px, -8px); } 100% { transform: translate(0, 0); } }
        .iso-tile { cursor: pointer; transition: transform 0.15s ease, filter 0.15s ease; }
        .iso-tile:hover { transform: translateY(-6px) scale(1.03); filter: brightness(1.1); z-index: 100 !important; }
        .iso-tile:active { transform: translateY(-2px) scale(0.98); }
        .farm-pan-stage { cursor: grab; touch-action: none; }
        .farm-pan-stage.is-dragging { cursor: grabbing; }
      `}</style>

      {/* === SKY ATMOSPHERE — fixed in viewport, behind the world === */}
      <Stars phase={atm.phase} />
      <CelestialBody phase={atm.phase} />
      <SkyBalloon phase={atm.phase} />
      <WeatherLayer weather={atm.weather} phase={atm.phase} />
      <LightningFlash weather={atm.weather} />

      {/* Birds only fly during the day window */}
      {atm.isDay && [0,1].map(i => (
        <svg key={`bird-${i}`} className="absolute" width="14" height="8" style={{ top: `${5+i*6}%`, animation: `birdFly ${16+i*8}s linear infinite`, animationDelay: `${-i*6}s`, zIndex: 3 }}>
          <path d="M0 4 L4 1 M8 4 L4 1" stroke="#37474F" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      ))}

      <AmbientCreatures isDay={atm.isDay} />

      {/* === PANNABLE WORLD STAGE === */}
      <div
        className={`farm-pan-stage absolute inset-0 ${dragRef.current.moved ? "is-dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        onWheel={onWheel}
        style={{ zIndex: 5 }}
        data-testid="farm-stage"
      >
        <div
          className="absolute"
          style={{
            top: 0,
            left: 0,
            width: WORLD_W,
            height: WORLD_H,
            transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          {/* World ground: terrain, mountains, water, paths, props */}
          <WorldGround phase={atm.phase} isDay={atm.isDay} />

          {/* === Per-building dirt patches + Production-chain (DFD-style) lines ===
               Drawn at WORLD scale, BENEATH the building tiles.            */}
          <svg
            className="absolute pointer-events-none"
            width={WORLD_W}
            height={WORLD_H}
            viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
            style={{ left: 0, top: 0, zIndex: 1 }}
          >
            {/* Dirt patch under every plot (owned = warm brown, locked = grey-brown). */}
            {BUILDINGS.map(b => {
              const { x, y } = bldgPos(b.id);
              const owned = (farmSave.owned[b.id] || 0) > 0;
              return (
                <g key={`soil-${b.id}`}>
                  <ellipse cx={x} cy={y + 12} rx={92} ry={28} fill="rgba(0,0,0,0.22)"/>
                  <ellipse cx={x} cy={y + 8}  rx={88} ry={24} fill={owned ? "#7A5A28" : "#6B5040"} opacity={owned ? 0.78 : 0.55}/>
                  <ellipse cx={x - 14} cy={y + 4} rx={36} ry={9} fill="rgba(255,255,255,0.08)"/>
                  <ellipse cx={x} cy={y + 8}  rx={88} ry={24} fill="none" stroke={owned ? "#9A7838" : "#5a4a3a"} strokeWidth="1.5" opacity="0.7"/>
                  {!owned && (
                    <>
                      <line x1={x - 60} y1={y + 2} x2={x + 60} y2={y + 2} stroke="#5a4a3a" strokeWidth="1" opacity="0.3" strokeDasharray="7 5"/>
                      <line x1={x - 50} y1={y + 14} x2={x + 50} y2={y + 14} stroke="#5a4a3a" strokeWidth="1" opacity="0.3" strokeDasharray="7 5"/>
                    </>
                  )}
                </g>
              );
            })}

            {/* === ROAD NETWORK — physical paths between owned production-chain
                 endpoints. Roads are drawn as ground-level curves and visually
                 upgrade with the lower-level endpoint (dirt → gravel → paved).
                 Replaces the abstract DFD arrows with concrete infrastructure. */}
            {(() => {
              const roads = PRODUCTION_EDGES.map((e, i) => {
                const fromLv = farmSave.owned[e.from] || 0;
                const toLv = farmSave.owned[e.to] || 0;
                if (!fromLv || !toLv) return null;
                const a = bldgPos(e.from);
                const b = bldgPos(e.to);
                const lv = Math.min(fromLv, toLv);
                const style = roadStyleFor(lv);
                // Slight pseudo-random midpoint offset so parallel roads don't
                // overlap perfectly — gives the network an organic feel.
                const offset = ((i * 31) % 28) - 14;
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2 + offset + 6;
                const ay = a.y + 6;
                const by = b.y + 6;
                const d = `M ${a.x} ${ay} Q ${mx} ${my} ${b.x} ${by}`;
                return { i, edge: e, d, style, lv };
              }).filter((r): r is { i: number; edge: Edge; d: string; style: RoadStyle; lv: number } => r !== null);

              return (
                <>
                  {/* Pass 1 — road surfaces (ground level, beneath buildings). */}
                  {roads.map(r => (
                    <g key={`road-${r.i}`}>
                      {/* Soft soil shadow embeds the road into the ground */}
                      <path d={r.d} stroke="rgba(0,0,0,0.32)" strokeWidth={r.style.width + 6} fill="none" strokeLinecap="round" opacity={0.55}/>
                      {/* Road base (darker outer edge) */}
                      <path d={r.d} stroke={r.style.base} strokeWidth={r.style.width} fill="none" strokeLinecap="round"/>
                      {/* Road top wear (lighter inner) */}
                      <path d={r.d} stroke={r.style.top} strokeWidth={Math.max(r.style.width - 6, 8)} fill="none" strokeLinecap="round" opacity={0.95}/>
                      {/* Lane markings — paved roads only (level 3) */}
                      {r.style.dash && (
                        <path d={r.d} stroke={r.style.dash.color} strokeWidth={r.style.dash.w} fill="none" strokeDasharray={r.style.dash.array} opacity={r.style.dash.opacity}/>
                      )}
                    </g>
                  ))}

                  {/* Pass 2 — trucks driving along each road. Always-on ambient
                       loop. During the harvest pulse they get a gold body +
                       cargo crates and run twice as fast for visible effect. */}
                  {roads.map(r => {
                    const baseColor = TRUCK_COLOR[r.edge.kind];
                    const color = harvestPulse ? "#FFD700" : baseColor;
                    const dur = (harvestPulse ? r.style.truckDur * 0.5 : r.style.truckDur).toFixed(2) + "s";
                    // During harvest pulse, every truck dispatches immediately
                    // so the player sees an instant convoy reaction. Otherwise
                    // stagger ambient trucks so they don't all bunch at start.
                    const beginDelay = harvestPulse ? "0s" : (((r.i * 0.43) % 3.0)).toFixed(2) + "s";
                    return (
                      <g key={`truck-${r.i}-${harvestPulse ? "h" : "a"}`}>
                        <g>
                          {/* Truck body, top-down view, centered at (0,0) */}
                          <ellipse cx={0} cy={4} rx={14} ry={2.8} fill="rgba(0,0,0,0.4)"/>
                          <rect x={-13} y={-7} width={22} height={14} rx={2} fill={color} stroke="rgba(0,0,0,0.45)" strokeWidth={0.6}/>
                          {/* Cab at the right end (front of vehicle) */}
                          <rect x={5} y={-6} width={8} height={12} rx={1.5} fill="#37474F"/>
                          <rect x={6.5} y={-4.5} width={5} height={3} fill="#90CAF9" opacity={0.9}/>
                          {/* Side stripe accent */}
                          <rect x={-12} y={-1.5} width={17} height={3} fill="rgba(255,255,255,0.18)"/>
                          {/* Wheels (top-down — visible on both sides) */}
                          <rect x={-9} y={-9}  width={4} height={2.5} rx={0.4} fill="#1a1a1a"/>
                          <rect x={-9} y={6.5} width={4} height={2.5} rx={0.4} fill="#1a1a1a"/>
                          <rect x={1}  y={-9}  width={4} height={2.5} rx={0.4} fill="#1a1a1a"/>
                          <rect x={1}  y={6.5} width={4} height={2.5} rx={0.4} fill="#1a1a1a"/>
                          {/* Cargo crates during harvest pulse */}
                          {harvestPulse && (
                            <g>
                              <rect x={-11} y={-4} width={6} height={8} rx={0.6} fill="#A0724E" stroke="#5D4037" strokeWidth={0.5}/>
                              <rect x={-4}  y={-4} width={6} height={8} rx={0.6} fill="#A0724E" stroke="#5D4037" strokeWidth={0.5}/>
                              <text x={-8} y={1.5} fontSize={5.5} textAnchor="middle" fill="#FFEB3B" fontWeight="bold">★</text>
                              <text x={-1} y={1.5} fontSize={5.5} textAnchor="middle" fill="#FFEB3B" fontWeight="bold">★</text>
                            </g>
                          )}
                          <animateMotion dur={dur} begin={beginDelay} repeatCount="indefinite" rotate="auto" path={r.d}/>
                        </g>
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </svg>

          {/* === BUILDINGS — scattered across the world === */}
          {sortedBuildings.map(b => {
            const level = farmSave.owned[b.id] || 0;
            const isOwned = level > 0;
            const isMaxed = level === 3;
            const { x, y } = bldgPos(b.id);
            const bldgW = 170;
            const bldgH = 130;

            return (
              <div
                key={b.id}
                className="absolute iso-tile"
                data-no-pan="true"
                style={{
                  left: x - bldgW / 2,
                  top: y - bldgH * 0.92,
                  width: bldgW,
                  height: bldgH,
                  // z-index by world-y so further-down buildings render in front
                  zIndex: 100 + Math.round(y),
                }}
                onClick={tileClickGuard(() => setSelected(b))}
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

          {/* === Ambient chickens (around chicken_coop) === */}
          {hasChickens && [0,1,2].map(i => {
            const cp = bldgPos("chicken_coop");
            return (
              <div key={`ck-${i}`} className="absolute pointer-events-none" style={{ left: cp.x - 40 + i * 22, top: cp.y + 24 + i * 4, zIndex: 99 + Math.round(cp.y), animation: `chickenWalk ${7+i*2}s linear infinite`, animationDelay: `${-i*2}s` }}>
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

          {/* === Ambient cows (around dairy_cows) === */}
          {hasCows && [0,1].map(i => {
            const cp = bldgPos("dairy_cows");
            return (
              <div key={`cow-${i}`} className="absolute pointer-events-none" style={{ left: cp.x - 50 + i * 60, top: cp.y + 22 + i * 6, zIndex: 99 + Math.round(cp.y), animation: `cowGraze ${12+i*4}s ease-in-out infinite`, animationDelay: `${-i*3}s` }}>
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

          {/* Golden crop bonus event */}
          {golden.spawn && goldenPos && (
            <GoldenCropOverlay
              x={goldenPos.x}
              y={goldenPos.y}
              reward={golden.spawn.reward}
              expiresAt={golden.spawn.expiresAt}
              onCollect={collectGolden}
            />
          )}

          <AnimatePresence>
            {coinPops.map(pop => {
              const { x, y } = bldgPos(pop.bId);
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

      {/* === HUD: TOP BAR === */}
      <div
        data-no-pan="true"
        className="absolute top-0 left-0 right-0 z-30"
        style={{ background: "linear-gradient(180deg, rgba(20,12,4,0.92) 0%, rgba(40,28,16,0.65) 65%, transparent 100%)", paddingBottom: 14 }}
      >
        {/* Row 1: navigation + brand + coins + harvest */}
        <div className="px-3 pt-2 pb-1 flex items-center gap-2">
          <button
            onClick={() => setLocation("/")}
            data-no-pan="true"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all hover:scale-105 active:scale-95 flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.12)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.35)", backdropFilter: "blur(6px)" }}
            data-testid="btn-back-to-menu"
          >
            <ChevronLeft className="w-3.5 h-3.5"/> <span className="hidden xs:inline">Menu</span>
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <UserAvatar user={user} size="sm" fallbackBg="bg-gradient-to-br from-yellow-400 to-amber-600" className="!rounded-lg shadow-md" />
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-black tracking-widest leading-none truncate" style={{ fontFamily: "Oxanium, sans-serif", color: "#FFD700", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>FARM TYCOON</h1>
              <p className="text-[10px] font-semibold leading-tight truncate" style={{ color: "#C8A84E" }}>{user.username} · Day {farmSave.day} · {farmRating}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl text-xs sm:text-sm font-black" style={{ background: "linear-gradient(135deg, #F5A623, #FFD700)", color: "#5D4037", boxShadow: "0 2px 8px rgba(245,166,35,0.4)" }}>
              <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4"/>{user.eduCoins}
            </div>
            <Button
              size="sm"
              data-no-pan="true"
              className="h-8 px-2.5 sm:px-4 text-xs font-black"
              style={{
                background: farmSave.farmBank > 0 ? "linear-gradient(135deg, #2E7D32, #1B5E20)" : "rgba(255,255,255,0.1)",
                color: farmSave.farmBank > 0 ? "white" : "rgba(200,168,78,0.5)",
                border: farmSave.farmBank > 0 ? "2px solid #4CAF50" : "2px solid transparent",
                boxShadow: farmSave.farmBank > 0 ? "0 2px 12px rgba(46,125,50,0.4)" : "none",
              }}
              disabled={farmSave.farmBank === 0 || harvestMutation.isPending}
              onClick={() => { setIsHarvesting(true); triggerHarvestPulse(); harvestMutation.mutate(farmSave.farmBank); }}
              data-testid="button-harvest"
            >
              {harvestMutation.isPending
                ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7 }}>🔄</motion.span>
                : <span className="whitespace-nowrap">🌾 <span className="hidden xs:inline">HARVEST</span>{farmSave.farmBank > 0 ? ` +${farmSave.farmBank}` : ""}</span>}
            </Button>
          </div>
        </div>

        {/* Row 2: stat chips, scrollable on mobile */}
        <div className="px-3 pb-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <style>{`.farm-statrow::-webkit-scrollbar { display: none; }`}</style>
          <div className="farm-statrow flex items-center gap-1.5 w-max">
            <WeatherBadge atm={atm} />
            <TickProgress lastTickTime={farmSave.lastTickTime} intervalMs={TICK_INTERVAL_MS} />
            <BankMeter value={farmSave.farmBank} max={MAX_FARM_BANK} />
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(76,175,80,0.2)", color: "#A8D8A8", border: "1px solid rgba(76,175,80,0.3)" }}>⚡ {Math.round(incomePerMin * atm.cropBoost)}/min</div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(33,150,243,0.2)", color: "#90CAF9", border: "1px solid rgba(33,150,243,0.3)" }}>🏗️ {totalOwned}/12</div>
            {farmSave.farmBank > 0 && (
              <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black" style={{ background: "linear-gradient(135deg, rgba(46,125,50,0.85), rgba(67,160,71,0.85))", color: "white", boxShadow: "0 2px 8px rgba(46,125,50,0.4)", border: "1px solid rgba(255,255,255,0.2)" }}>🌾 {farmSave.farmBank}</motion.div>
            )}
          </div>
        </div>
      </div>

      {/* === ZOOM CONTROLS (bottom-right) === */}
      <div
        data-no-pan="true"
        className="absolute z-30 flex flex-col gap-1.5"
        style={{ right: 10, bottom: 96 }}
      >
        <button
          onClick={() => nudgeZoom(1.18)}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{ background: "rgba(20,30,15,0.78)", border: "1.5px solid rgba(255,215,0,0.4)", color: "#FFD700", backdropFilter: "blur(6px)", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
          aria-label="Zoom in"
          data-testid="btn-zoom-in"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          onClick={() => nudgeZoom(0.85)}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{ background: "rgba(20,30,15,0.78)", border: "1.5px solid rgba(255,215,0,0.4)", color: "#FFD700", backdropFilter: "blur(6px)", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
          aria-label="Zoom out"
          data-testid="btn-zoom-out"
        >
          <Minus className="w-5 h-5" />
        </button>
        <button
          onClick={recenter}
          className="w-10 h-10 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style={{ background: "rgba(20,30,15,0.78)", border: "1.5px solid rgba(255,215,0,0.4)", color: "#FFD700", backdropFilter: "blur(6px)", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}
          aria-label="Recenter on farm"
          data-testid="btn-recenter"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* === MINIMAP (bottom-right corner, above zoom controls) === */}
      <Minimap camX={camera.x} camY={camera.y} scale={camera.scale} vw={viewSize.w} vh={viewSize.h} />

      {/* === SAD-themed quest panel (top-left, collapsible) === */}
      <QuestPanel
        owned={farmSave.owned}
        completed={farmSave.completedQuests}
        onClaim={claimQuest}
        isPending={claimQuestMutation.isPending}
      />

      {/* Building modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}/>
            <BuildingModal b={selected} level={farmSave.owned[selected.id] || 0} userCoins={user.eduCoins} onBuy={() => handleBuy(selected)} onUpgrade={() => handleUpgrade(selected)} onClose={() => setSelected(null)} isPending={spendMutation.isPending}/>
          </>
        )}
      </AnimatePresence>

      {/* Harvest burst */}
      <HarvestBurst active={isHarvesting} />
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

// === SAD-themed quest panel (collapsible, top-left) ===
// Shows the 6 systems-analysis-themed side quests, their progress, and a
// claim button when complete. Persists "completedQuests" via the parent.
function QuestPanel({
  owned, completed, onClaim, isPending,
}: {
  owned: Record<string, number>;
  completed: string[];
  onClaim: (q: QuestDef) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(true);
  const completedCount = completed.length;
  const pendingCount   = QUESTS.filter(q => !completed.includes(q.id) && questProgress(q, owned).done).length;

  return (
    <div
      data-no-pan="true"
      className="absolute"
      style={{
        zIndex: 40,
        left: 10,
        top: 102,
        width: open ? 280 : 64,
        maxHeight: "calc(100vh - 200px)",
        background: "linear-gradient(180deg, rgba(20,30,15,0.92) 0%, rgba(28,40,18,0.88) 100%)",
        border: "1.5px solid rgba(255,215,0,0.4)",
        borderRadius: 12,
        backdropFilter: "blur(8px)",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        overflow: "hidden",
        transition: "width 0.25s ease",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        data-no-pan="true"
        className="w-full flex items-center gap-2 px-3 py-2 transition-colors hover:bg-white/5"
        style={{ background: "rgba(0,0,0,0.25)", borderBottom: open ? "1px solid rgba(255,215,0,0.2)" : "none" }}
        data-testid="btn-toggle-quests"
        aria-label={open ? "Collapse quests" : "Expand quests"}
      >
        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #FFD700, #F5A623)", boxShadow: "0 1px 4px rgba(245,166,35,0.4)" }}>
          <GraduationCap className="w-4 h-4" style={{ color: "#3E2716" }}/>
        </div>
        {open && (
          <>
            <div className="flex-1 text-left min-w-0">
              <div className="text-[11px] font-black tracking-wider truncate" style={{ fontFamily: "Oxanium, sans-serif", color: "#FFD700" }}>SAD QUESTS</div>
              <div className="text-[9px] font-semibold leading-tight truncate" style={{ color: "#A8C8A0" }}>
                {completedCount} / {QUESTS.length} done{pendingCount > 0 ? ` · ${pendingCount} ready!` : ""}
              </div>
            </div>
            {pendingCount > 0 && (
              <span className="flex items-center justify-center font-black text-[10px] rounded-full flex-shrink-0" style={{ width: 18, height: 18, background: "#F5A623", color: "#3E2716" }}>
                {pendingCount}
              </span>
            )}
            <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "#FFD700" }}/>
          </>
        )}
        {!open && (
          <>
            {pendingCount > 0 && (
              <span className="absolute flex items-center justify-center font-black text-[10px] rounded-full" style={{ width: 18, height: 18, background: "#F5A623", color: "#3E2716", top: 4, right: 4 }}>
                {pendingCount}
              </span>
            )}
            <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "#FFD700" }}/>
          </>
        )}
      </button>

      {/* Quest list */}
      {open && (
        <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 260px)", scrollbarWidth: "thin" }}>
          <ul className="p-2 space-y-2">
            {QUESTS.map(q => {
              const isDone = completed.includes(q.id);
              const prog = questProgress(q, owned);
              const ready = !isDone && prog.done;
              return (
                <li key={q.id} data-testid={`quest-${q.id}`}
                  className="rounded-lg px-2.5 py-2"
                  style={{
                    background: isDone
                      ? "linear-gradient(135deg, rgba(46,125,50,0.25), rgba(27,94,32,0.18))"
                      : ready
                        ? "linear-gradient(135deg, rgba(245,166,35,0.22), rgba(255,215,0,0.10))"
                        : "rgba(0,0,0,0.25)",
                    border: isDone
                      ? "1px solid rgba(76,175,80,0.45)"
                      : ready
                        ? "1px solid rgba(245,166,35,0.55)"
                        : "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5 flex-shrink-0">
                      {isDone
                        ? <CheckCircle2 className="w-4 h-4" style={{ color: "#A8E6A8" }}/>
                        : ready
                          ? <Sparkles className="w-4 h-4" style={{ color: "#FFD700" }}/>
                          : <Lock className="w-4 h-4" style={{ color: "rgba(200,180,140,0.55)" }}/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-black text-[11px] leading-tight" style={{ color: isDone ? "#A8E6A8" : ready ? "#FFD700" : "#E8DCC0" }}>
                          {q.title}
                        </span>
                        <span className="font-bold text-[8px] px-1 py-px rounded" style={{ background: "rgba(33,150,243,0.25)", color: "#90CAF9", border: "1px solid rgba(33,150,243,0.35)" }}>
                          {q.sadConcept}
                        </span>
                      </div>
                      <p className="text-[10px] mt-0.5 leading-snug" style={{ color: "rgba(200,180,140,0.85)" }}>{q.hint}</p>
                      {/* Progress bar */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.4)" }}>
                          <div className="h-full transition-all" style={{
                            width: `${Math.round(prog.pct * 100)}%`,
                            background: isDone ? "linear-gradient(90deg, #43A047, #66BB6A)" : ready ? "linear-gradient(90deg, #F5A623, #FFD700)" : "linear-gradient(90deg, #6B7E54, #8FA770)",
                          }}/>
                        </div>
                        <span className="text-[9px] font-bold tabular-nums" style={{ color: "rgba(200,180,140,0.7)" }}>{prog.label}</span>
                      </div>
                      {/* Reward / claim */}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 text-[10px] font-black" style={{ color: "#FFD700" }}>
                          <Coins className="w-3 h-3"/> +{q.reward}
                        </span>
                        {isDone ? (
                          <span className="text-[9px] font-black" style={{ color: "#A8E6A8" }}>✓ Claimed</span>
                        ) : ready ? (
                          <button
                            onClick={() => onClaim(q)}
                            disabled={isPending}
                            data-testid={`btn-claim-${q.id}`}
                            className="px-2 py-0.5 rounded-md font-black text-[10px] transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
                            style={{ background: "linear-gradient(135deg, #F5A623, #FFD700)", color: "#3E2716", boxShadow: "0 1px 4px rgba(245,166,35,0.5)" }}
                          >
                            CLAIM
                          </button>
                        ) : (
                          <span className="text-[9px] font-semibold" style={{ color: "rgba(200,180,140,0.5)" }}>Locked</span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
