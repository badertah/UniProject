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
import { Coins, Star, X, ArrowUpCircle, ShoppingCart, ChevronLeft, ChevronDown, ChevronUp, Plus, Minus, Maximize2, Lock, Sparkles, CheckCircle2, GraduationCap, Truck, BookOpen, Brain, Move, RotateCcw } from "lucide-react";
import { BuildingSVG, LockedFieldSVG } from "@/components/farm-buildings";
import farmSkyUrl       from "@assets/generated_images/farm_sky.png";
import farmMountainsUrl from "@assets/generated_images/farm_mountains.png";
import farmGroundUrl    from "@assets/generated_images/farm_ground.png";
import imgBarn       from "@/assets/farm/barn.png";
import imgFarmhouse  from "@/assets/farm/farmhouse.png";
import imgWindmill   from "@/assets/farm/windmill.png";
import imgSilo       from "@/assets/farm/silo.png";
import imgCoop       from "@/assets/farm/coop.png";
import imgGreenhouse from "@/assets/farm/greenhouse.png";
import imgWheat      from "@/assets/farm/wheat.png";
import imgVeggies    from "@/assets/farm/veggies.png";
import imgOrchard    from "@/assets/farm/orchard.png";
import imgTractor    from "@/assets/farm/tractor.png";
import {
  useAtmosphere, skyGradient as baseSkyGradient, CelestialBody, Stars, WeatherLayer, SkyBalloon,
  AmbientCreatures, TickProgress, BankMeter, WeatherBadge,
  GoldenCropOverlay, useGoldenCropSpawner, HarvestBurst, LightningFlash,
} from "@/components/farm-extras";
import {
  WORLD_W, WORLD_H,
  WorldGround, Minimap,
} from "@/components/farm-world";

// Map of building id → AI-generated isometric sprite. Buildings without an
// entry fall back to the legacy hand-drawn BuildingSVG (e.g. dairy_cows,
// irrigation). Each sprite is rendered with a contact shadow underneath so
// it visually "lands" on the soil patch instead of floating above it.
const BUILDING_IMAGES: Record<string, string> = {
  barn: imgBarn,
  farmhouse: imgFarmhouse,
  windmill: imgWindmill,
  silo: imgSilo,
  chicken_coop: imgCoop,
  greenhouse: imgGreenhouse,
  wheat_field: imgWheat,
  vegetable_patch: imgVeggies,
  apple_orchard: imgOrchard,
  tractor: imgTractor,
};

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
  // Max number of farmer-employees that can be hired at each level. Hiring
  // up to this number boosts the building's effective income; running
  // understaffed gives only the base 50% income multiplier. This models
  // "actor → process" relationships from a Use Case diagram (the actor
  // here is a farmer, the process is the building's production).
  staffCap: [number, number, number];
  // Coin cost paid every production tick PER hired employee. Wages are
  // deducted from the farm bank automatically, so understaffing might
  // actually be more profitable for low-margin buildings — players have
  // to learn to budget. Wages also feed the Data Flow Diagram (cash
  // flow from Farm Bank → Employees).
  wagePerTick: number;
  // Role label used in the Use Case / Actor diagram. Different roles
  // make the on-board diagrams more diverse and easier to read.
  role: string;
}

const BUILDINGS: BuildingDef[] = [
  { id: "wheat_field",     name: "Wheat Field",      emoji: "🌾", description: "Golden wheat rows — steady income.", category: "crops",     buyCost: 30,  upgradeCost: [60,  120], incomePerTick: [2,  5,  10], tickMultiplier: 1, staffCap: [1, 2, 3], wagePerTick: 1, role: "Field Hand" },
  { id: "vegetable_patch", name: "Vegetable Patch",  emoji: "🥕", description: "Fresh vegetables that grow faster.", category: "crops",     buyCost: 50,  upgradeCost: [100, 200], incomePerTick: [3,  7,  14], tickMultiplier: 1, staffCap: [1, 2, 3], wagePerTick: 1, role: "Gardener" },
  { id: "apple_orchard",   name: "Apple Orchard",    emoji: "🍎", description: "Beautiful orchard trees.", category: "crops",     buyCost: 80,  upgradeCost: [150, 300], incomePerTick: [4,  9,  18], tickMultiplier: 1, staffCap: [1, 2, 3], wagePerTick: 2, role: "Picker" },
  { id: "greenhouse",      name: "Greenhouse",       emoji: "🌿", description: "Year-round glass house.", category: "crops",     buyCost: 120, upgradeCost: [240, 480], incomePerTick: [5,  11, 22], tickMultiplier: 1, staffCap: [1, 2, 3], wagePerTick: 2, role: "Botanist" },
  { id: "chicken_coop",    name: "Chicken Coop",     emoji: "🐔", description: "Free-range hens.", category: "livestock", buyCost: 55,  upgradeCost: [110, 220], incomePerTick: [4,  8,  16], tickMultiplier: 2, staffCap: [1, 2, 2], wagePerTick: 1, role: "Keeper" },
  { id: "dairy_cows",      name: "Dairy Cows",       emoji: "🐄", description: "Happy cows producing milk.", category: "livestock", buyCost: 90,  upgradeCost: [180, 360], incomePerTick: [5,  11, 22], tickMultiplier: 2, staffCap: [1, 2, 3], wagePerTick: 2, role: "Dairy Hand" },
  { id: "farmhouse",       name: "Farmhouse",        emoji: "🏠", description: "Your home base — production hub.", category: "buildings", buyCost: 40,  upgradeCost: [90,  180], incomePerTick: [3,  6,  13], tickMultiplier: 2, staffCap: [1, 2, 3], wagePerTick: 2, role: "Manager" },
  { id: "windmill",        name: "Windmill",         emoji: "⚙️", description: "Harnessing wind power.", category: "buildings", buyCost: 100, upgradeCost: [200, 400], incomePerTick: [6,  12, 24], tickMultiplier: 2, staffCap: [1, 1, 2], wagePerTick: 3, role: "Miller" },
  { id: "barn",            name: "Red Barn",         emoji: "🏚️", description: "Classic red barn.", category: "buildings", buyCost: 70,  upgradeCost: [140, 280], incomePerTick: [5,  10, 20], tickMultiplier: 3, staffCap: [1, 2, 2], wagePerTick: 2, role: "Stocker" },
  { id: "tractor",         name: "Tractor",          emoji: "🚜", description: "Heavy-duty machine.", category: "equipment", buyCost: 150, upgradeCost: [300, 600], incomePerTick: [8,  16, 32], tickMultiplier: 3, staffCap: [1, 1, 2], wagePerTick: 4, role: "Driver" },
  { id: "silo",            name: "Grain Silo",       emoji: "🏗️", description: "Store grain in bulk.", category: "equipment", buyCost: 130, upgradeCost: [260, 520], incomePerTick: [7,  14, 28], tickMultiplier: 3, staffCap: [0, 1, 1], wagePerTick: 3, role: "Operator" },
  { id: "irrigation",      name: "Irrigation",       emoji: "💧", description: "Automated water system.", category: "equipment", buyCost: 110, upgradeCost: [220, 440], incomePerTick: [6,  13, 26], tickMultiplier: 3, staffCap: [0, 1, 1], wagePerTick: 2, role: "Technician" },
];

// Cost to hire one farmer = HIRE_BONUS_MULT × wagePerTick (one-time
// "signing bonus" paid out of EduCoins via the spend endpoint). Firing
// is free — players can re-balance their workforce risk-free.
const HIRE_BONUS_MULT = 8;

// Each building lives at its own world (x,y) — scattered across the 2400x1700
// world rather than stacked on a tiny grid. Positions are picked to:
//   • avoid the ponds, river, dirt paths, mountains, scarecrow, sheep, etc.
//   • cluster thematically (equipment yard north, livestock by pasture)
//   • give the production-chain arrows readable geometry (no major crossings)
const BUILDING_POS: Record<string, { x: number; y: number }> = {
  // North row — equipment yard / mill (clear grass band, no water/paths)
  tractor:         { x: 560,  y: 770 },
  windmill:        { x: 1200, y: 720 },
  silo:            { x: 1840, y: 770 },
  // Center row — utilities + hub. Irrigation moved EAST of the left pond
  // (pond x∈[80,560]) so it stops sitting in the water.
  irrigation:      { x: 700,  y: 880 },
  farmhouse:       { x: 1200, y: 970 },
  barn:            { x: 1900, y: 1000 },
  // South fields — crops. Apple Orchard moved NORTH off the river
  // (river curves through y≈1310-1430) and EAST off the left dirt path
  // so it sits on solid grass between pond and river.
  apple_orchard:   { x: 450,  y: 1200 },
  wheat_field:     { x: 820,  y: 1140 },
  greenhouse:      { x: 1680, y: 1100 },
  vegetable_patch: { x: 2010, y: 1200 },
  // Pasture row — livestock (north of river, clear of paths)
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
// Road visual style. `bank` is the sandy/grass shoulder (matches the
// river's bank colour) so roads embed into the terrain instead of
// floating like sticks. `top` is the lighter wear strip down the
// middle. Optional `dash` paints lane markings on paved level-3 roads.
type RoadStyle = { width: number; bank: string; base: string; top: string; dash: RoadDash | null; truckDur: number };
function roadStyleFor(lv: number): RoadStyle {
  if (lv >= 3) return { width: 30, bank: "#C9B27A", base: "#3A3A3A", top: "#5A5A5A", dash: { color: "#FFEB3B", w: 1.8, array: "14 10", opacity: 0.85 }, truckDur: 5 };
  if (lv === 2) return { width: 24, bank: "#C9B27A", base: "#5E4B2A", top: "#9A7B45", dash: null, truckDur: 7.5 };
  return { width: 18, bank: "#C9B27A", base: "#6B5028", top: "#8E6A36", dash: null, truckDur: 10 };
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
  | { kind: "max_level" }
  // SAD: Use Case / Actor — at least N farmers hired across the farm.
  | { kind: "employees"; count: number }
  // SAD: Cash-flow data flow — total lifetime wages paid >= N coins.
  | { kind: "wages_paid"; amount: number };

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
  {
    id: "hire_actors",
    title: "Identify Actors",
    hint: "Hire your first 3 farmers — every actor performs a use case.",
    sadConcept: "Use Case · Actors",
    reward: 90,
    req: { kind: "employees", count: 3 },
  },
  {
    id: "payroll",
    title: "Run Payroll",
    hint: "Pay 50 coins in total wages — model the cash-flow data flow.",
    sadConcept: "Data Flow · Cash Flow",
    reward: 110,
    req: { kind: "wages_paid", amount: 50 },
  },
];

// === STORYLINE — "Mira's Turnaround" =======================================
// You're brought in as a junior systems analyst to revive the family farm.
// Each chapter unlocks automatically from farm state + SAD mastery and
// re-frames a SAD concept as a farm-business problem you have to solve.
// Chapters are pure-derived: no extra persistence beyond
// `acknowledgedChapters` (which chapter intros has the player dismissed).
type StoryChapter = {
  id: string;
  index: number;       // 1-based, shown to player
  title: string;
  sadConcept: string;  // taught/reinforced concept
  narrator: string;    // 1-2 sentence in-character intro
  objective: string;   // what the player must do to advance
  // `done` is computed from farm state (owned/employees) + SAD mastery
  // count so chapters that require academy work also clear here.
  done: (s: { owned: Record<string, number>; employees: Record<string, number> }, sadMastery: number) => boolean;
};

const PRODUCERS = ["wheat_field","vegetable_patch","apple_orchard","greenhouse","chicken_coop","dairy_cows"];
const totalEmp = (e: Record<string, number>) => Object.values(e || {}).reduce((a, b) => a + b, 0);

const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: "ch1_inheritance", index: 1,
    title: "The Inheritance",
    sadConcept: "System Initialization",
    narrator: "Grandpa Joe left you the family farm. The fields are bare, the bank is empty, and the neighbours are watching. Time to bootstrap.",
    objective: "Build your first plot from the shop.",
    done: (s) => Object.values(s.owned).some(v => v > 0),
  },
  {
    id: "ch2_inputs", index: 2,
    title: "Identify Your Inputs",
    sadConcept: "Requirements · Input Sources",
    narrator: "Every system needs raw inputs. Stop daydreaming about export contracts and stand up the producers that actually feed the chain.",
    objective: "Build a Wheat Field, Chicken Coop, and Dairy Cows.",
    done: (s) => ["wheat_field","chicken_coop","dairy_cows"].every(id => (s.owned[id] || 0) > 0),
  },
  {
    id: "ch3_storage", index: 3,
    title: "Buffer the Flow",
    sadConcept: "DFD · Data Stores",
    narrator: "Production without storage chokes the pipeline. The silo and the barn are your data stores — they let producers and the farmhouse run at different speeds.",
    objective: "Build the Silo and the Barn.",
    done: (s) => (s.owned.silo || 0) > 0 && (s.owned.barn || 0) > 0,
  },
  {
    id: "ch4_output", index: 4,
    title: "Close the Loop",
    sadConcept: "DFD · End-to-End Flow",
    narrator: "A farm only earns when finished goods reach the farmhouse. Map the entire data flow — producer → store → output — or you're just burning wages.",
    objective: "Build the Farmhouse and at least 3 producers.",
    done: (s) => (s.owned.farmhouse || 0) > 0 && PRODUCERS.filter(id => (s.owned[id] || 0) > 0).length >= 3,
  },
  {
    id: "ch5_actors", index: 5,
    title: "Hire the Actors",
    sadConcept: "Use Case · Actors",
    narrator: "Every use case needs an actor. An empty barn is just a building — pay people and the system actually runs.",
    objective: "Hire at least 3 farmers across your buildings.",
    done: (s) => totalEmp(s.employees) >= 3,
  },
  {
    id: "ch6_scale", index: 6,
    title: "Refactor & Scale",
    sadConcept: "Iterative Architecture",
    narrator: "Your v1 prototype is barely keeping up. Refactor a building to v3 and watch throughput climb — that's iterative architecture in action.",
    objective: "Upgrade any building to LV3 ★.",
    done: (s) => Object.values(s.owned).some(v => v >= 3),
  },
  {
    id: "ch7_analyst", index: 7,
    title: "Earn the Title",
    sadConcept: "Theory + Practice",
    narrator: "Running a farm is one thing. UNDERSTANDING the system is another. Pass teach-back on 4 SAD concepts in the academy and you'll be a real systems analyst — and the bank will reward you with permanent income bonuses.",
    objective: "Master 4 SAD concepts in courses (+5% farm income each).",
    done: (_s, mastery) => mastery >= 4,
  },
];

// Derive the currently-active chapter: the first one whose `done` is false.
// If every chapter is done we return the last one (always-visible epilogue).
function currentChapter(s: { owned: Record<string, number>; employees: Record<string, number> }, sadMastery: number): StoryChapter {
  return STORY_CHAPTERS.find(c => !c.done(s, sadMastery)) ?? STORY_CHAPTERS[STORY_CHAPTERS.length - 1];
}

// === SAD MASTERY → FARM ECONOMY BRIDGE ====================================
// Each SAD concept the player has passed teach-back on grants a permanent
// +5% multiplier on farm income (gross per tick). Capped at the number of
// SAD game types so it can't run away.
const SAD_BONUS_PER_CONCEPT = 0.05;
function sadMasteryCount(scm: unknown): number {
  if (!scm || typeof scm !== "object") return 0;
  return Object.keys(scm as Record<string, unknown>).filter(k => (scm as Record<string, unknown>)[k]).length;
}
function sadBonusMultiplier(masteryCount: number): number {
  return 1 + masteryCount * SAD_BONUS_PER_CONCEPT;
}

function questProgress(q: QuestDef, owned: Record<string, number>, employees: Record<string, number> = {}, wagesPaid = 0): { done: boolean; pct: number; label: string } {
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
    case "employees": {
      const have = Object.values(employees).reduce((a, b) => a + b, 0);
      const need = q.req.count;
      return { done: have >= need, pct: Math.min(1, have / need), label: `${Math.min(have, need)} / ${need}` };
    }
    case "wages_paid": {
      const need = q.req.amount;
      return { done: wagesPaid >= need, pct: Math.min(1, wagesPaid / need), label: `${Math.min(wagesPaid, need)} / ${need}` };
    }
  }
}

type FarmSave = {
  owned: Record<string, number>;
  employees: Record<string, number>;
  wagesPaidTotal: number;
  farmBank: number;
  farmTotalEarned: number;
  lastTickTime: number;
  tickCounters: Record<string, number>;
  day: number;
  completedQuests: string[];
  acknowledgedChapters: string[];
  roads: Record<string, number>;
};

const ROAD_COST = 60;
const ROAD_INCOME_PCT = 0.05;
const roadKey = (from: string, to: string) => `${from}__${to}`;
const builtRoadCount = (roads: Record<string, number> | undefined) =>
  Object.values(roads || {}).filter(v => v > 0).length;
const roadBonusMultiplier = (roads: Record<string, number> | undefined) =>
  1 + builtRoadCount(roads) * ROAD_INCOME_PCT;

function loadState(uid: string): FarmSave {
  try { const raw = localStorage.getItem(farmKey(uid)); if (raw) return { ...defaultState(), ...JSON.parse(raw) }; } catch {} return defaultState();
}
function defaultState(): FarmSave { return { owned: {}, employees: {}, wagesPaidTotal: 0, farmBank: 0, farmTotalEarned: 0, lastTickTime: Date.now(), tickCounters: {}, day: 1, completedQuests: [], acknowledgedChapters: [], roads: {} }; }
function saveState(s: FarmSave, uid: string) { localStorage.setItem(farmKey(uid), JSON.stringify(s)); }

// === Admin layout editor — per-user position overrides ===
// Admins can drag building tiles around in editor mode to fix tiles that
// land on water, paths or each other. Overrides are written into the
// shared BUILDING_POS map at render-time, so every consumer (sortedBuildings,
// production-edge roads, animated trucks, the Build Roads modal, the
// chicken/dairy walkers) automatically follows — no separate code paths.
// Persisted to localStorage per user; never sent to the server.
const layoutKey = (uid: string) => `farm_layout_v1_${uid}`;
function loadLayout(uid: string): Record<string, { x: number; y: number }> {
  try { const raw = localStorage.getItem(layoutKey(uid)); if (raw) return JSON.parse(raw); } catch {} return {};
}
function saveLayout(uid: string, ov: Record<string, { x: number; y: number }>) {
  try { localStorage.setItem(layoutKey(uid), JSON.stringify(ov)); } catch {}
}

type CoinPop = { id: string; bId: string; amount: number };

// One-stop helper for net per-tick income calculation. Encapsulates the
// "staff ratio" curve so the in-game tooltip and the actual processTicks
// math stay in sync (both call this).
//
// Income curve: production = base * (0.5 + 0.5 * effectiveStaffRatio)
//   - 0 hired: 50% of base (a building still works at half pace)
//   - fully staffed: 100% of base
// Wage cost per tick = effectiveStaff * wagePerTick (paid from farmBank).
// Net is what actually lands in the bank that tick.
// `incomeMultiplier` is the SAD mastery bonus from sadBonusMultiplier();
// defaults to 1 so callers that don't care (e.g. raw "is this profitable?"
// checks) still work. Wages are NOT multiplied — only gross output is.
function buildingTickEcon(b: BuildingDef, level: number, hired: number, incomeMultiplier = 1) {
  if (level <= 0) return { gross: 0, wages: 0, net: 0, effectiveStaff: 0, capped: 0 };
  const cap = b.staffCap[level - 1];
  const effectiveStaff = Math.max(0, Math.min(hired, cap));
  const ratio = cap === 0 ? 1 : effectiveStaff / cap;
  const base = b.incomePerTick[level - 1];
  const gross = Math.floor(base * (0.5 + 0.5 * ratio) * incomeMultiplier);
  const wages = effectiveStaff * b.wagePerTick;
  const net = gross - wages;
  return { gross, wages, net, effectiveStaff, capped: cap };
}

function processTicks(state: FarmSave, n: number, silent = false, incomeMultiplier = 1) {
  let farmBank = state.farmBank;
  let wagesPaidTotal = state.wagesPaidTotal || 0;
  const tickCounters = { ...state.tickCounters };
  const pops: CoinPop[] = [];
  for (let t = 0; t < n; t++) {
    for (const b of BUILDINGS) {
      const lv = state.owned[b.id] || 0;
      if (!lv) continue;
      tickCounters[b.id] = (tickCounters[b.id] || 0) + 1;
      if (tickCounters[b.id] >= b.tickMultiplier) {
        tickCounters[b.id] = 0;
        const hired = state.employees?.[b.id] || 0;
        const econ = buildingTickEcon(b, lv, hired, incomeMultiplier);
        // Wages always attempt to come out, but we only count what was
        // actually deducted from the bank — bank is clamped at 0, so if
        // net would push it negative we cap the wages-paid credit to
        // whatever could really be paid (gross + remaining bank balance).
        const proposedBank = farmBank + econ.net;
        const newBank = Math.max(0, Math.min(proposedBank, MAX_FARM_BANK));
        // Actual deduction = wages we could afford from (farmBank + gross).
        const wagesActual = Math.max(0, Math.min(econ.wages, farmBank + econ.gross));
        wagesPaidTotal += wagesActual;
        // Only show a positive coin-pop for net-positive ticks. Negative
        // or zero net ticks are silently absorbed so the map doesn't
        // render misleading "+-2" pops above unprofitable buildings.
        if (!silent && econ.net > 0) {
          pops.push({ id: `${b.id}-${Date.now()}-${Math.random()}`, bId: b.id, amount: econ.net });
        }
        farmBank = newBank;
      }
    }
  }
  return { state: { ...state, farmBank, tickCounters, wagesPaidTotal }, pops };
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
  // Per-building runtime fallback: if an AI sprite ever fails to load
  // (404, corrupt asset, blocked CDN…), we mark that id as failed so the
  // next render falls through to the legacy hand-drawn BuildingSVG.
  const [failedSprites, setFailedSprites] = useState<Record<string, true>>({});
  const [showDiagrams, setShowDiagrams] = useState(false);
  const [showRoadShop, setShowRoadShop] = useState(false);
  // Roads + trucks are ON by default so the farm reads as a populated
  // working world (per reference art). Players can toggle the FLOW
  // overlay off if they want to study terrain alone.
  const [showRoads, setShowRoads] = useState(true);

  // === Admin layout editor ===
  // editorMode toggles draggable tiles for admins. posOverrides is the
  // per-user map of custom (x,y) coords. We mutate BUILDING_POS during
  // render (via useMemo below) so every position consumer — including
  // production-road routing and the truck animation paths — picks up
  // the new positions on the next paint.
  const [editorMode, setEditorMode] = useState(false);
  const [posOverrides, setPosOverrides] = useState<Record<string, { x: number; y: number }>>({});
  // Apply overrides to BUILDING_POS synchronously during render so that
  // sortedBuildings, edges and trucks all see the same coords this paint.
  useMemo(() => {
    for (const [id, p] of Object.entries(posOverrides)) {
      BUILDING_POS[id] = p;
    }
  }, [posOverrides]);
  // Load any saved layout for this user. We only enable editor mode for
  // admins, but a previously-saved layout is honoured for everyone (so
  // an admin's tweak persists for them across sessions).
  useEffect(() => {
    if (!user) return;
    const ov = loadLayout(user.id);
    if (Object.keys(ov).length) setPosOverrides(ov);
  }, [user?.id]);
  // Persist whenever overrides change.
  useEffect(() => {
    if (!user) return;
    saveLayout(user.id, posOverrides);
  }, [posOverrides, user?.id]);

  // Debounced sync of farm-leaderboard stats to the server. We only
  // surface the rankable summary (bank / day / total earned) — the
  // full save state stays in localStorage. 1.2s debounce keeps the
  // request rate well below the harvest cadence even for spam buys.
  const farmSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user) return;
    if (farmSyncTimerRef.current) clearTimeout(farmSyncTimerRef.current);
    farmSyncTimerRef.current = setTimeout(() => {
      // Only display-only stats are synced. farmTotalEarned is the
      // authoritative leaderboard metric and is bumped server-side
      // by /api/farm/harvest, never trusted from the client.
      apiRequest("POST", "/api/farm/sync", {
        farmBank: farmSave.farmBank,
        farmDay: farmSave.day,
      }).catch(() => { /* sync is best-effort; don't surface errors */ });
    }, 1200);
    return () => { if (farmSyncTimerRef.current) clearTimeout(farmSyncTimerRef.current); };
  }, [user, farmSave.farmBank, farmSave.day]);
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
  // SAD mastery → income multiplier. Held in a ref so the tick interval
  // (which closes over its initial scope) always reads the current value
  // without re-binding the timer when the user picks up a new concept.
  const sadBonusRef = useRef(1);
  const sadMastery = sadMasteryCount(user?.sadConceptMastery);
  const sadBonus = sadBonusMultiplier(sadMastery);
  // econBonusRef = sadBonus × roadBonus. Used by the tick loop so it
  // always reads the current combined multiplier without re-binding.
  const econBonusRef = useRef(1);
  useEffect(() => { sadBonusRef.current = sadBonus; }, [sadBonus]);
  // Combined economy multiplier (SAD mastery × roads). Updated below
  // once farmSave is in scope; kept here so the hook order stays stable.

  useEffect(() => {
    if (!user) return;
    if (loadedForRef.current === user.id) return;
    loadedForRef.current = user.id;
    userIdRef.current = user.id;
    const saved = loadState(user.id);
    const elapsed = Date.now() - saved.lastTickTime;
    const missed = Math.min(Math.floor(elapsed / TICK_INTERVAL_MS), MAX_OFFLINE_TICKS);
    if (missed > 0) {
      const { state: ns } = processTicks(saved, missed, true, sadBonusRef.current * roadBonusMultiplier(saved.roads));
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
        const { state: ns, pops } = processTicks(prev, 1, false, sadBonusRef.current * roadBonusMultiplier(prev.roads));
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
      setFarmSave(prev => {
        const earnedThisRun = Math.max(0, Math.floor(Number(data.coinsAdded) || 0));
        const ns = {
          ...prev,
          farmBank: 0,
          day: prev.day + 1,
          farmTotalEarned: (prev.farmTotalEarned || 0) + earnedThisRun,
        };
        if (user) saveState(ns, user.id);
        return ns;
      });
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
    const prog = questProgress(q, farmSave.owned, farmSave.employees || {}, farmSave.wagesPaidTotal || 0);
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
  }, [user, farmSave.owned, farmSave.employees, farmSave.wagesPaidTotal, farmSave.completedQuests, claimQuestMutation, updateUser, toast]);

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

  const handleHire = useCallback((b: BuildingDef) => {
    if (!user) return;
    const lv = farmSave.owned[b.id] || 0;
    if (!lv) return;
    const cap = b.staffCap[lv - 1];
    const current = farmSave.employees?.[b.id] || 0;
    if (current >= cap) { toast({ title: "Max staff reached" }); return; }
    const cost = b.wagePerTick * HIRE_BONUS_MULT;
    if (user.eduCoins < cost) { toast({ title: "Not enough EduCoins for signing bonus", variant: "destructive" }); return; }
    spendMutation.mutate(cost, {
      onSuccess: () => {
        setFarmSave(prev => {
          const ns = { ...prev, employees: { ...(prev.employees || {}), [b.id]: (prev.employees?.[b.id] || 0) + 1 } };
          if (user) saveState(ns, user.id);
          return ns;
        });
        toast({ title: `👷 Hired a ${b.role} for ${b.name}!`, description: `Wage: ${b.wagePerTick}🪙/tick` });
      },
    });
  }, [user, farmSave.owned, farmSave.employees, spendMutation, toast]);

  const handleFire = useCallback((b: BuildingDef) => {
    if (!user) return;
    const current = farmSave.employees?.[b.id] || 0;
    if (current <= 0) return;
    setFarmSave(prev => {
      const ns = { ...prev, employees: { ...(prev.employees || {}), [b.id]: Math.max(0, (prev.employees?.[b.id] || 0) - 1) } };
      if (user) saveState(ns, user.id);
      return ns;
    });
    toast({ title: `📤 Fired a ${b.role}`, description: "Wage cost reduced." });
  }, [user, farmSave.employees, toast]);

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

  // === Buy a road segment ===
  // Roads are buyable per production-edge. Owning a road adds +5% farm
  // income (stacks with SAD mastery bonus) and renders the segment as a
  // proper paved/dirt road with trucks. Available only when both endpoints
  // are owned (otherwise there's nothing to connect).
  const handleBuyRoad = useCallback((edge: Edge) => {
    if (!user) return;
    const k = roadKey(edge.from, edge.to);
    if ((farmSave.roads || {})[k]) return;
    if ((farmSave.owned[edge.from] || 0) <= 0 || (farmSave.owned[edge.to] || 0) <= 0) {
      toast({ title: "Build both endpoints first", variant: "destructive" });
      return;
    }
    if (user.eduCoins < ROAD_COST) { toast({ title: "Not enough EduCoins", variant: "destructive" }); return; }
    spendMutation.mutate(ROAD_COST, {
      onSuccess: () => {
        setFarmSave(prev => {
          const ns = { ...prev, roads: { ...(prev.roads || {}), [k]: 1 } };
          if (user) saveState(ns, user.id);
          return ns;
        });
        toast({ title: `🛣️ Road built · +${Math.round(ROAD_INCOME_PCT * 100)}% farm income` });
      },
    });
  }, [user, farmSave.roads, farmSave.owned, spendMutation, toast]);

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

  // Combined economy multiplier (SAD mastery × built-roads). Computed
  // once per render and threaded through every income calculation +
  // the tick loop's ref so offline/online ticks both honour roads.
  const roadBonus = roadBonusMultiplier(farmSave.roads);
  const econBonus = sadBonus * roadBonus;
  useEffect(() => { econBonusRef.current = econBonus; }, [econBonus]);

  if (!user) return null;

  const totalOwned = Object.values(farmSave.owned).filter(v => v > 0).length;
  const farmRating = totalOwned === 0 ? "Empty Farm" : totalOwned < 4 ? "Seedling" : totalOwned < 8 ? "Growing" : totalOwned < 12 ? "Thriving" : "Legendary";
  const incomePerMin = BUILDINGS.reduce((s, b) => {
    const lv = farmSave.owned[b.id] || 0;
    if (!lv) return s;
    const econ = buildingTickEcon(b, lv, farmSave.employees?.[b.id] || 0, econBonus);
    return s + (econ.net / b.tickMultiplier) * 2;
  }, 0);
  const totalWagesPerMin = BUILDINGS.reduce((s, b) => {
    const lv = farmSave.owned[b.id] || 0;
    if (!lv) return s;
    const econ = buildingTickEcon(b, lv, farmSave.employees?.[b.id] || 0, econBonus);
    return s + (econ.wages / b.tickMultiplier) * 2;
  }, 0);
  // Active story chapter — pure derived from current state + SAD mastery.
  const storyCh = currentChapter(farmSave, sadMastery);
  const storyAcked = (farmSave.acknowledgedChapters || []).includes(storyCh.id);
  const acknowledgeChapter = (chapterId: string) => {
    setFarmSave(prev => {
      if ((prev.acknowledgedChapters || []).includes(chapterId)) return prev;
      const ns = { ...prev, acknowledgedChapters: [...(prev.acknowledgedChapters || []), chapterId] };
      const uid = userIdRef.current;
      if (uid) saveState(ns, uid);
      return ns;
    });
  };
  const totalEmployees = Object.values(farmSave.employees || {}).reduce((a, b) => a + b, 0);

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

      {/* AI-generated painted sky + distant mountain range, fixed in the
          viewport so they sit behind everything regardless of camera pan. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          backgroundImage: `url(${farmSkyUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          opacity: atm.isDay ? 0.85 : 0.25,
          transition: "opacity 1.5s linear",
        }}
      />
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          zIndex: 1,
          left: 0,
          right: 0,
          bottom: "38%",
          height: "32vh",
          backgroundImage: `url(${farmMountainsUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
          opacity: atm.isDay ? 0.92 : 0.55,
          filter: atm.isDay ? "none" : "brightness(0.55) saturate(0.7)",
          transition: "opacity 1.5s linear, filter 1.5s linear",
        }}
      />

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
          {/* AI-generated grass ground tile, repeated across the world.
              Sits beneath the SVG props (trees, water, paths) drawn by
              WorldGround so the painted terrain shows through the gaps. */}
          <div
            aria-hidden
            className="absolute pointer-events-none"
            style={{
              top: 0,
              left: 0,
              width: WORLD_W,
              height: WORLD_H,
              backgroundImage: `url(${farmGroundUrl})`,
              backgroundSize: "420px 420px",
              backgroundRepeat: "repeat",
              filter: atm.isDay ? "none" : "brightness(0.45) saturate(0.7)",
              transition: "filter 1.5s linear",
            }}
          />

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
            {/* === Defs: feathered patch fills + soft-edge filter ===
                 Solves the "floating disc" problem: instead of a hard-edged
                 ellipse sitting on top of the grass, each patch fades into
                 the terrain via a radial gradient. Three palettes:
                 - tilled (crops):  warm tilled-soil brown
                 - grassy (livestock/buildings): mossy green mound that
                   blends with the world ground
                 - locked: muted grey-brown so unbought slots stay subtle  */}
            <defs>
              <radialGradient id="patch-tilled" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#8A6428" stopOpacity="0.95"/>
                <stop offset="55%"  stopColor="#7A5824" stopOpacity="0.78"/>
                <stop offset="85%"  stopColor="#6B4A1E" stopOpacity="0.30"/>
                <stop offset="100%" stopColor="#6B4A1E" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="patch-grassy" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#6FA64A" stopOpacity="0.85"/>
                <stop offset="55%"  stopColor="#5C8E3F" stopOpacity="0.55"/>
                <stop offset="85%"  stopColor="#4A7A35" stopOpacity="0.20"/>
                <stop offset="100%" stopColor="#4A7A35" stopOpacity="0"/>
              </radialGradient>
              <radialGradient id="patch-locked" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#5C5040" stopOpacity="0.55"/>
                <stop offset="60%"  stopColor="#4D4234" stopOpacity="0.30"/>
                <stop offset="100%" stopColor="#4D4234" stopOpacity="0"/>
              </radialGradient>
              {/* Furrow stripe pattern for tilled crop fields — adds the
                  agricultural-row texture without needing per-tile art. */}
              <pattern id="furrows" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(0)">
                <rect width="14" height="14" fill="transparent"/>
                <line x1="0" y1="6"  x2="14" y2="6"  stroke="#6B4A1E" strokeWidth="1.2" opacity="0.35"/>
                <line x1="0" y1="11" x2="14" y2="11" stroke="#5A3F18" strokeWidth="0.8" opacity="0.25"/>
              </pattern>
            </defs>

            {/* === Per-building land patches ===
                 - Crops:    rectangular tilled-soil plot with furrow rows
                 - Others:   soft round grassy mound (no hard edge)
                 - Locked:   small muted patch with surveyor dashes
                 All patches use feathered gradients so they fade into the
                 world ground instead of sitting on it like a coaster. */}
            {BUILDINGS.map(b => {
              const { x, y } = bldgPos(b.id);
              const owned = (farmSave.owned[b.id] || 0) > 0;
              const isCrop = b.category === "crops";
              if (!owned) {
                // Locked plot — small, faded, doesn't compete visually
                return (
                  <g key={`soil-${b.id}`} opacity={0.7}>
                    <ellipse cx={x} cy={y + 14} rx={78} ry={26} fill="url(#patch-locked)"/>
                    <ellipse cx={x} cy={y + 14} rx={62} ry={18} fill="none" stroke="#5a4a3a" strokeWidth="1" strokeDasharray="6 5" opacity="0.55"/>
                  </g>
                );
              }
              if (isCrop) {
                // Tilled rectangular plot — large, with furrow rows running
                // horizontally. The slight downward skew makes it read as
                // an iso ground plane rather than a flat sticker.
                const w = 170, h = 70;
                const cx = x, cy = y + 14;
                return (
                  <g key={`soil-${b.id}`}>
                    {/* Soft soil-shadow halo blends rectangle into grass */}
                    <ellipse cx={cx} cy={cy + 4} rx={w * 0.62} ry={h * 0.62} fill="url(#patch-tilled)"/>
                    {/* Tilled-soil rectangle (slightly transparent so the
                        feathered halo above peeks through at the edges) */}
                    <rect
                      x={cx - w / 2} y={cy - h / 2}
                      width={w} height={h}
                      rx={6}
                      fill="#7A5824"
                      opacity={0.92}
                    />
                    {/* Furrow rows (pattern fill, blended on top) */}
                    <rect
                      x={cx - w / 2 + 4} y={cy - h / 2 + 4}
                      width={w - 8} height={h - 8}
                      rx={4}
                      fill="url(#furrows)"
                    />
                    {/* Subtle lighter highlight on top edge */}
                    <rect
                      x={cx - w / 2} y={cy - h / 2}
                      width={w} height={6}
                      rx={6}
                      fill="rgba(255,220,140,0.22)"
                    />
                  </g>
                );
              }
              // Buildings/livestock/equipment — soft grassy mound
              return (
                <g key={`soil-${b.id}`}>
                  {/* Wide soft mound that fades into terrain */}
                  <ellipse cx={x} cy={y + 14} rx={120} ry={42} fill="url(#patch-grassy)"/>
                  {/* Small inner darker dirt circle directly under the
                      building foot for a planted feel */}
                  <ellipse cx={x} cy={y + 14} rx={62} ry={20} fill="#5C7A3A" opacity={0.42}/>
                  <ellipse cx={x - 12} cy={y + 8} rx={28} ry={6} fill="rgba(255,255,255,0.06)"/>
                </g>
              );
            })}

            {/* === ALWAYS-ON DECORATIVE RIVER ===
                 Wide blue river meandering across the south of the farm,
                 matching the reference art. Pure cosmetic — sits beneath
                 buildings but above the grass field. */}
            <g>
              {(() => {
                const riverD = `M -40 1480 Q 350 1430, 700 1490 T 1400 1500 T 2100 1485 T 2440 1495`;
                return (
                  <>
                    {/* Soft bank shadow */}
                    <path d={riverD} stroke="rgba(0,0,0,0.28)" strokeWidth={70} fill="none" strokeLinecap="round" opacity={0.55}/>
                    {/* Sandy bank */}
                    <path d={riverD} stroke="#C9B27A" strokeWidth={62} fill="none" strokeLinecap="round" opacity={0.85}/>
                    {/* Deep water */}
                    <path d={riverD} stroke="#1E66B8" strokeWidth={48} fill="none" strokeLinecap="round"/>
                    {/* Surface water */}
                    <path d={riverD} stroke="#3FA0E8" strokeWidth={38} fill="none" strokeLinecap="round" opacity={0.95}/>
                    {/* Light highlight */}
                    <path d={riverD} stroke="#9CD6F5" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.7} strokeDasharray="60 80"/>
                  </>
                );
              })()}
            </g>

            {/* === ROAD NETWORK — physical paths between owned production-
                 chain pairs. A road only appears once BOTH endpoints are
                 unlocked/built — so unlocking a building visibly grows the
                 network. Each road is layered like the river (shadow →
                 sandy bank → dirt base → wear strip → optional centerline)
                 and bends in an organic S-curve so it never reads as a
                 stick. Tier upgrades widen + repave the road. The FLOW
                 toggle still hides the whole network for a clean view. */}
            {showRoads && (() => {
              // Cubic Bezier sample helper — gives roads a real S-curve so
              // they meander like the river instead of reading as straight
              // sticks. Two control points let parallel roads diverge.
              const cubic = (t: number, p0: number, p1: number, p2: number, p3: number) => {
                const u = 1 - t;
                return u*u*u*p0 + 3*u*u*t*p1 + 3*u*t*t*p2 + t*t*t*p3;
              };
              // Distance to keep clear from each endpoint so the road stops
              // at the patch edge instead of intruding under the building.
              const PATCH_CLEAR = 95;
              // World centroid roughly matches the BUILDING_POS bbox center.
              // Roads bow AWAY from this point so the network forms a
              // sweeping ring instead of crossing through the middle.
              const WORLD_CX = 1200;
              const WORLD_CY = 1000;
              const builtMap = farmSave.roads || {};
              const allRoads = PRODUCTION_EDGES.map((e, i) => {
                const fromLv = farmSave.owned[e.from] || 0;
                const toLv = farmSave.owned[e.to] || 0;
                // Need both endpoints owned for a road to exist at all
                // (built or as a buyable preview).
                if (fromLv <= 0 || toLv <= 0) return null;
                const built = (builtMap[roadKey(e.from, e.to)] || 0) > 0;
                const a = bldgPos(e.from);
                const b = bldgPos(e.to);
                const lv = Math.min(fromLv, toLv);
                const style = roadStyleFor(lv);
                const ay = a.y + 14;
                const by = b.y + 14;
                const dx = b.x - a.x;
                const dy = by - ay;
                const len = Math.max(Math.hypot(dx, dy), 1);
                // Perpendicular unit vectors (two choices). Pick the one
                // pointing AWAY from the world centroid so curves fan
                // outward instead of piling up in the middle.
                const px = -dy / len;
                const py =  dx / len;
                const mx = (a.x + b.x) / 2;
                const my = (ay + by) / 2;
                const outX = mx - WORLD_CX;
                const outY = my - WORLD_CY;
                const outward = (px * outX + py * outY) >= 0 ? 1 : -1;
                // Magnitude scales with edge length (long roads bend more,
                // short ones stay tight). Mild ±4 jitter by edge index
                // separates parallel runs without re-creating crossings.
                const baseMag = Math.min(60, len * 0.18) + ((i * 7) % 9);
                const mag = baseMag * outward;
                // SINGLE outward C-bend (not S) — same sign for both control
                // points => simple arc, no inflection, no self-overlap.
                const c1x = a.x + dx * 0.33 + px * mag;
                const c1y = ay  + dy * 0.33 + py * mag;
                const c2x = a.x + dx * 0.66 + px * mag;
                const c2y = ay  + dy * 0.66 + py * mag;
                // Trim ends so the road stops at the patch edge.
                const tCut = Math.min(0.40, PATCH_CLEAR / len);
                const sx = cubic(tCut, a.x, c1x, c2x, b.x);
                const sy = cubic(tCut, ay,  c1y, c2y, by);
                const ex = cubic(1 - tCut, a.x, c1x, c2x, b.x);
                const ey = cubic(1 - tCut, ay,  c1y, c2y, by);
                const d = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`;
                return { i, edge: e, d, style, lv, built };
              }).filter((r): r is { i: number; edge: Edge; d: string; style: RoadStyle; lv: number; built: boolean } => r !== null);
              const roads = allRoads.filter(r => r.built);
              const planned = allRoads.filter(r => !r.built);

              return (
                <>
                  {/* Pass 1 — road surfaces, layered like the river:
                       (1) soft soil shadow under everything
                       (2) sandy/cream bank shoulder so the road embeds
                           into the terrain instead of floating
                       (3) dark dirt base (full width)
                       (4) lighter wear strip down the middle
                       (5) optional yellow dashed centerline on paved roads */}
                  {roads.map(r => (
                    <g key={`road-${r.i}`}>
                      <path d={r.d} stroke="rgba(0,0,0,0.32)" strokeWidth={r.style.width + 10} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.5}/>
                      <path d={r.d} stroke={r.style.bank}    strokeWidth={r.style.width + 6}  fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.85}/>
                      <path d={r.d} stroke={r.style.base}    strokeWidth={r.style.width}      fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d={r.d} stroke={r.style.top}     strokeWidth={Math.max(r.style.width - 7, 8)} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.95}/>
                      {r.style.dash && (
                        <path d={r.d} stroke={r.style.dash.color} strokeWidth={r.style.dash.w} fill="none" strokeDasharray={r.style.dash.array} opacity={r.style.dash.opacity}/>
                      )}
                    </g>
                  ))}

                  {/* Planned-road previews — faint dashed cream lines along
                       the same outward-bow curve. Clicking opens the Roads
                       modal so the player can confirm the buy. */}
                  {planned.map(r => (
                    <g
                      key={`planned-${r.i}`}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => { e.stopPropagation(); setShowRoadShop(true); }}
                      data-testid={`planned-road-${r.edge.from}-${r.edge.to}`}
                    >
                      {/* Wide invisible hit target for easier tapping */}
                      <path d={r.d} stroke="rgba(0,0,0,0)" strokeWidth={28} fill="none" strokeLinecap="round"/>
                      <path d={r.d} stroke="rgba(255,235,180,0.55)" strokeWidth={4} fill="none" strokeLinecap="round" strokeDasharray="10 8"/>
                    </g>
                  ))}

                  {/* Pass 2 — trucks. Every rendered road has both endpoints
                       owned, so every road carries traffic. During the
                       harvest pulse trucks get a gold body + cargo crates
                       and run twice as fast for visible effect. */}
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
                  cursor: editorMode ? "grab" : undefined,
                  outline: editorMode ? "2px dashed rgba(255,215,0,0.85)" : undefined,
                  outlineOffset: editorMode ? "-2px" : undefined,
                }}
                onPointerDown={editorMode ? (e) => {
                  // Drag-to-move handler — only active in admin editor mode.
                  // Translates client-px deltas to world-px via the camera
                  // scale, clamps to world bounds, and updates posOverrides
                  // live as the user drags. After drop, suppresses the
                  // synthetic click so the building modal doesn't pop open.
                  e.stopPropagation();
                  e.preventDefault();
                  const startX = e.clientX, startY = e.clientY;
                  const orig = bldgPos(b.id);
                  const scale = cameraRef.current.scale || 1;
                  let moved = false;
                  const onMove = (ev: PointerEvent) => {
                    const dx = (ev.clientX - startX) / scale;
                    const dy = (ev.clientY - startY) / scale;
                    if (!moved && Math.hypot(dx, dy) > 4) moved = true;
                    if (!moved) return;
                    const nx = Math.max(80, Math.min(WORLD_W - 80, orig.x + dx));
                    const ny = Math.max(80, Math.min(WORLD_H - 80, orig.y + dy));
                    setPosOverrides(p => ({ ...p, [b.id]: { x: Math.round(nx), y: Math.round(ny) } }));
                  };
                  const onUp = () => {
                    window.removeEventListener("pointermove", onMove);
                    window.removeEventListener("pointerup", onUp);
                    if (moved) dragRef.current.suppressClickUntil = Date.now() + 350;
                  };
                  window.addEventListener("pointermove", onMove);
                  window.addEventListener("pointerup", onUp);
                } : undefined}
                onClick={tileClickGuard(() => { if (!editorMode) setSelected(b); })}
                data-testid={`tile-${b.id}`}
              >
                {/* === Ground anchor — TWO layers that together make the
                    building read as planted on the terrain instead of
                    floating:

                    Layer 1 (clearing): a wide, very soft GRASS-darker
                    ellipse painted ON the lawn beneath the building. Same
                    hue family as the surrounding grass (dark green-brown),
                    so it blends in like a worn-down patch / plot the
                    building sits on — it does NOT read as a separate
                    brown object.

                    Layer 2 (cast shadow): a smaller, darker, blurred
                    contact shadow tucked right under the sprite's foot.
                    This is what eliminates the "floating" look — every
                    real object on grass has this shadow.  */}
                <div className="absolute pointer-events-none" style={{
                  left: "50%",
                  bottom: 0,
                  width: "120%",
                  height: 38,
                  transform: "translateX(-50%)",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(ellipse at center, rgba(48,72,22,0.80) 0%, rgba(58,82,30,0.55) 40%, rgba(70,100,35,0.20) 70%, rgba(80,120,40,0) 90%)",
                  filter: "blur(3px)",
                  opacity: isOwned ? 1 : 0.5,
                }}/>
                <div className="absolute pointer-events-none" style={{
                  left: "50%",
                  bottom: 6,
                  width: "82%",
                  height: 18,
                  transform: "translateX(-50%)",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(ellipse at center, rgba(0,0,0,0.70) 0%, rgba(0,0,0,0.40) 50%, rgba(0,0,0,0) 85%)",
                  filter: "blur(2px)",
                  opacity: isOwned ? 1 : 0.5,
                }}/>

                {isOwned ? (
                  BUILDING_IMAGES[b.id] && !failedSprites[b.id] ? (
                    <img
                      src={BUILDING_IMAGES[b.id]}
                      alt={b.name}
                      draggable={false}
                      onError={() => setFailedSprites(s => s[b.id] ? s : { ...s, [b.id]: true })}
                      className="relative w-full h-full"
                      style={{
                        objectFit: "contain",
                        objectPosition: "center bottom",
                        filter: "drop-shadow(0 4px 4px rgba(0,0,0,0.5))",
                        // Subtle level-based scale so upgrades feel bigger.
                        transform: `scale(${0.92 + level * 0.05})`,
                        transformOrigin: "center bottom",
                        imageRendering: "auto",
                      }}
                    />
                  ) : (
                    <div className="relative w-full h-full" style={{ filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.4))" }}>
                      <BuildingSVG buildingId={b.id} level={level}/>
                    </div>
                  )
                ) : (
                  <div className="relative w-full h-full flex items-center justify-center" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>
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
                {/* Tiny farmer figures for each hired employee — visual cue
                    that this building has actors performing its use case. */}
                {isOwned && (farmSave.employees?.[b.id] || 0) > 0 && (
                  <div className="absolute pointer-events-none flex gap-0.5" style={{ left: 6, bottom: -2 }}>
                    {Array.from({ length: Math.min(farmSave.employees?.[b.id] || 0, 3) }).map((_, i) => (
                      <svg key={i} width="14" height="18" viewBox="0 0 14 18" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.5))" }}>
                        <circle cx="7" cy="4" r="3" fill="#F4C28A"/>
                        <rect x="3" y="3" width="8" height="2.5" rx="1" fill="#8B4513"/>
                        <path d="M3 16 L3 9 Q3 7 5 7 L9 7 Q11 7 11 9 L11 16 Z" fill="#1976D2"/>
                        <rect x="5" y="14" width="1.5" height="3.5" fill="#3E2716"/>
                        <rect x="7.5" y="14" width="1.5" height="3.5" fill="#3E2716"/>
                      </svg>
                    ))}
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
            {totalEmployees > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(25,118,210,0.22)", color: "#90CAF9", border: "1px solid rgba(25,118,210,0.35)" }} data-testid="chip-employees">👷 {totalEmployees}</div>
            )}
            {totalWagesPerMin > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: "rgba(198,40,40,0.18)", color: "#FFAB91", border: "1px solid rgba(198,40,40,0.35)" }} data-testid="chip-wages">💸 −{Math.round(totalWagesPerMin)}/min</div>
            )}
            {/* SAD MASTERY income bonus — earned by passing teach-back in
                 the academy. Each concept = +5% on every gross production
                 tick. Shown as a permanent chip so players see WHY the
                 farm pays better after they study. */}
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold"
              style={{
                background: sadMastery > 0 ? "rgba(124,77,255,0.24)" : "rgba(120,120,120,0.18)",
                color: sadMastery > 0 ? "#D0BCFF" : "rgba(200,180,140,0.65)",
                border: sadMastery > 0 ? "1px solid rgba(124,77,255,0.45)" : "1px dashed rgba(200,180,140,0.3)",
              }}
              title={sadMastery > 0
                ? `Each SAD concept you've mastered in the academy gives +5% farm income. You have ${sadMastery}/6.`
                : "Pass teach-back on a SAD game in the academy to earn +5% farm income (per concept)."}
              data-testid="chip-sad-bonus"
            >
              <Brain className="w-3.5 h-3.5"/> {sadMastery}/6 · {sadMastery > 0 ? `+${Math.round((sadBonus - 1) * 100)}%` : "study to boost"}
            </div>
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
        employees={farmSave.employees || {}}
        wagesPaid={farmSave.wagesPaidTotal || 0}
        completed={farmSave.completedQuests}
        onClaim={claimQuest}
        isPending={claimQuestMutation.isPending}
      />

      {/* === STORYLINE PANEL (top-right, collapsible). Shows the active
           chapter narrative + objective + SAD mastery bonus. New chapters
           pulse with a NEW! badge until the player dismisses them. === */}
      <StoryPanel
        chapter={storyCh}
        acked={storyAcked}
        sadMastery={sadMastery}
        sadBonusPct={Math.round((sadBonus - 1) * 100)}
        totalConcepts={6}
        onAck={() => acknowledgeChapter(storyCh.id)}
      />

      {/* === Toolbar cluster (SAD / FLOW / ROADS) ===
           A single horizontal row pinned to the TOP-CENTER, just below the
           HUD. Centering avoids the QuestPanel (top-left) and the
           StoryPanel (top-right) which both float at right:10 / left:10
           and used to render on top of these buttons. */}
      <div
        data-no-pan="true"
        className="absolute z-30 flex flex-row gap-2 flex-wrap justify-center"
        style={{ top: 110, left: "50%", transform: "translateX(-50%)" }}
      >
        <button
          data-no-pan="true"
          onClick={() => setShowDiagrams(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-black text-xs transition-all hover:scale-105 active:scale-95"
          style={{ background: "linear-gradient(135deg, rgba(20,30,15,0.92), rgba(28,40,18,0.88))", color: "#FFD700", border: "1.5px solid rgba(255,215,0,0.4)", backdropFilter: "blur(8px)", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
          data-testid="btn-sad-diagrams"
        >
          <GraduationCap className="w-3.5 h-3.5"/>
          <span>SAD DIAGRAMS</span>
        </button>

        <button
          data-no-pan="true"
          onClick={() => setShowRoads(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-black text-xs transition-all hover:scale-105 active:scale-95"
          style={{
            background: showRoads
              ? "linear-gradient(135deg, rgba(60,40,15,0.95), rgba(80,55,20,0.92))"
              : "linear-gradient(135deg, rgba(20,30,15,0.92), rgba(28,40,18,0.88))",
            color: "#FFD700",
            border: showRoads ? "1.5px solid rgba(255,215,0,0.7)" : "1.5px solid rgba(255,215,0,0.4)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
          data-testid="btn-toggle-roads"
          title={showRoads ? "Hide production roads" : "Show production roads"}
        >
          <Truck className="w-3.5 h-3.5"/>
          <span>{showRoads ? "FLOW: ON" : "FLOW"}</span>
        </button>

        <button
          data-no-pan="true"
          onClick={() => setShowRoadShop(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-black text-xs transition-all hover:scale-105 active:scale-95"
          style={{
            background: "linear-gradient(135deg, rgba(60,40,15,0.95), rgba(80,55,20,0.92))",
            color: "#FFD700",
            border: "1.5px solid rgba(255,215,0,0.55)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
          data-testid="btn-open-roads"
          title="Build roads to boost farm income"
        >
          <span>🛣️</span>
          <span>ROADS · +{Math.round((roadBonus - 1) * 100)}%</span>
        </button>

        {/* === Admin-only layout editor toggle ===
            When ON, every building tile becomes draggable. Roads, trucks
            and the Build Roads modal automatically follow because they
            all read from the same BUILDING_POS the drag updates. */}
        {user?.isAdmin && (
          <>
            <button
              data-no-pan="true"
              onClick={() => {
                setEditorMode(v => !v);
                toast({ title: editorMode ? "Editor mode OFF" : "Editor mode ON · drag any building to move it" });
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-black text-xs transition-all hover:scale-105 active:scale-95"
              style={{
                background: editorMode
                  ? "linear-gradient(135deg, rgba(180,80,20,0.95), rgba(220,120,30,0.92))"
                  : "linear-gradient(135deg, rgba(20,30,15,0.92), rgba(28,40,18,0.88))",
                color: "#FFD700",
                border: editorMode ? "1.5px solid #FFD700" : "1.5px solid rgba(255,215,0,0.4)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
              data-testid="btn-toggle-editor"
              title={editorMode ? "Exit editor mode" : "Admin: drag buildings to reposition"}
            >
              <Move className="w-3.5 h-3.5"/>
              <span>{editorMode ? "EDITING" : "EDITOR"}</span>
            </button>

            {editorMode && (
              <button
                data-no-pan="true"
                onClick={() => {
                  if (!user) return;
                  if (!window.confirm("Reset all building positions to defaults?")) return;
                  // Wipe overrides and reload page so BUILDING_POS module
                  // values (the original defaults) take over cleanly.
                  setPosOverrides({});
                  saveLayout(user.id, {});
                  toast({ title: "Layout reset · reloading" });
                  setTimeout(() => window.location.reload(), 400);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-black text-xs transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "linear-gradient(135deg, rgba(60,15,15,0.95), rgba(90,25,25,0.92))",
                  color: "#FFD700",
                  border: "1.5px solid rgba(255,80,80,0.6)",
                  backdropFilter: "blur(8px)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                }}
                data-testid="btn-reset-layout"
                title="Reset all building positions to defaults"
              >
                <RotateCcw className="w-3.5 h-3.5"/>
                <span>RESET</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Roads modal */}
      <AnimatePresence>
        {showRoadShop && (
          <RoadShopModal
            owned={farmSave.owned}
            roads={farmSave.roads || {}}
            userCoins={user.eduCoins}
            isPending={spendMutation.isPending}
            onBuy={handleBuyRoad}
            onClose={() => setShowRoadShop(false)}
          />
        )}
      </AnimatePresence>

      {/* Building modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelected(null)}/>
            <BuildingModal
              b={selected}
              level={farmSave.owned[selected.id] || 0}
              hired={farmSave.employees?.[selected.id] || 0}
              userCoins={user.eduCoins}
              sadBonus={sadBonus}
              onBuy={() => handleBuy(selected)}
              onUpgrade={() => handleUpgrade(selected)}
              onHire={() => handleHire(selected)}
              onFire={() => handleFire(selected)}
              onClose={() => setSelected(null)}
              isPending={spendMutation.isPending}
            />
          </>
        )}
      </AnimatePresence>

      {/* Harvest burst */}
      <HarvestBurst active={isHarvesting} />

      {/* SAD diagrams modal */}
      <AnimatePresence>
        {showDiagrams && (
          <SADDiagramsModal
            owned={farmSave.owned}
            employees={farmSave.employees || {}}
            wagesPaid={farmSave.wagesPaidTotal || 0}
            farmBank={farmSave.farmBank}
            day={farmSave.day}
            onClose={() => setShowDiagrams(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// === Build Roads modal ===
// Lists every road segment that connects two owned buildings. Each row
// shows from→to, current status (Built / Available / Locked), and a Build
// button. Built roads add +5% farm income each.
function RoadShopModal({ owned, roads, userCoins, isPending, onBuy, onClose }: {
  owned: Record<string, number>;
  roads: Record<string, number>;
  userCoins: number;
  isPending: boolean;
  onBuy: (e: Edge) => void;
  onClose: () => void;
}) {
  const nameOf = (id: string) => BUILDINGS.find(x => x.id === id)?.name || id;
  const emojiOf = (id: string) => BUILDINGS.find(x => x.id === id)?.emoji || "?";
  const built = PRODUCTION_EDGES.filter(e => (roads[roadKey(e.from, e.to)] || 0) > 0);
  const available = PRODUCTION_EDGES.filter(e =>
    (roads[roadKey(e.from, e.to)] || 0) <= 0 &&
    (owned[e.from] || 0) > 0 &&
    (owned[e.to] || 0) > 0
  );
  const locked = PRODUCTION_EDGES.filter(e =>
    (roads[roadKey(e.from, e.to)] || 0) <= 0 &&
    ((owned[e.from] || 0) <= 0 || (owned[e.to] || 0) <= 0)
  );
  const totalBonusPct = built.length * Math.round(ROAD_INCOME_PCT * 100);

  const renderRow = (e: Edge, status: "built" | "available" | "locked") => {
    const k = `${e.from}__${e.to}`;
    const canAfford = userCoins >= ROAD_COST;
    return (
      <div
        key={k}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
        style={{
          background: status === "built" ? "rgba(76,175,80,0.12)" : status === "available" ? "rgba(255,215,0,0.06)" : "rgba(255,255,255,0.03)",
          border: status === "built" ? "1px solid rgba(76,175,80,0.45)" : status === "available" ? "1px solid rgba(255,215,0,0.30)" : "1px dashed rgba(255,255,255,0.10)",
          opacity: status === "locked" ? 0.55 : 1,
        }}
        data-testid={`road-row-${k}`}
      >
        <div className="text-base shrink-0">{emojiOf(e.from)}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs sm:text-sm font-bold text-white truncate">
            {nameOf(e.from)} → {nameOf(e.to)}
          </div>
          <div className="text-[10px] text-amber-200/70 capitalize">{e.kind} road</div>
        </div>
        <div className="text-base shrink-0">{emojiOf(e.to)}</div>
        {status === "built" && (
          <div className="text-[10px] font-black px-2 py-1 rounded-md" style={{ background: "rgba(76,175,80,0.25)", color: "#A5D6A7", border: "1px solid rgba(76,175,80,0.5)" }}>
            BUILT · +{Math.round(ROAD_INCOME_PCT * 100)}%
          </div>
        )}
        {status === "available" && (
          <button
            onClick={() => onBuy(e)}
            disabled={isPending || !canAfford}
            className="text-[11px] font-black px-3 py-1.5 rounded-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: canAfford ? "linear-gradient(135deg, #FFD700, #F5A623)" : "rgba(120,120,120,0.4)", color: canAfford ? "#3E2716" : "#999" }}
            data-testid={`btn-build-road-${k}`}
          >
            Build · {ROAD_COST}🪙
          </button>
        )}
        {status === "locked" && (
          <div className="text-[10px] font-bold text-amber-200/55 italic">
            Build endpoints first
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <motion.div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}/>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pointer-events-none"
        initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex flex-col w-full max-w-md rounded-xl overflow-hidden"
          style={{ background: "linear-gradient(180deg, #1a2410 0%, #0f1a08 100%)", border: "2px solid rgba(255,215,0,0.4)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", maxHeight: "90vh" }}
          data-testid="modal-roads"
        >
          <div className="px-4 py-3 flex items-center justify-between" style={{ background: "linear-gradient(135deg, rgba(60,40,15,0.9), rgba(80,55,20,0.85))", borderBottom: "1px solid rgba(255,215,0,0.3)" }}>
            <div>
              <div className="text-base font-black text-amber-100 flex items-center gap-2">
                <span>🛣️</span> Build Roads
              </div>
              <div className="text-[11px] text-amber-200/80 mt-0.5">
                {built.length}/{PRODUCTION_EDGES.length} built · <span className="text-amber-300 font-bold">+{totalBonusPct}%</span> farm income
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/10" data-testid="btn-close-roads">
              <X className="w-4 h-4 text-amber-200"/>
            </button>
          </div>
          <div className="overflow-y-auto p-3 space-y-3">
            <div className="text-[11px] text-amber-200/70 leading-relaxed px-1">
              Each road connects two of your buildings and pays <span className="text-amber-300 font-bold">+{Math.round(ROAD_INCOME_PCT * 100)}% farm income</span>. Build all {PRODUCTION_EDGES.length} for <span className="text-amber-300 font-bold">+{PRODUCTION_EDGES.length * Math.round(ROAD_INCOME_PCT * 100)}%</span>.
            </div>
            {available.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-black tracking-wider text-amber-300/90 px-1">AVAILABLE TO BUILD ({available.length})</div>
                {available.map(e => renderRow(e, "available"))}
              </div>
            )}
            {built.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-black tracking-wider text-green-300/90 px-1">BUILT ({built.length})</div>
                {built.map(e => renderRow(e, "built"))}
              </div>
            )}
            {locked.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-black tracking-wider text-amber-200/50 px-1">LOCKED ({locked.length})</div>
                {locked.map(e => renderRow(e, "locked"))}
              </div>
            )}
            {available.length === 0 && built.length === 0 && (
              <div className="text-center py-6 text-amber-200/60 text-xs">
                Build at least 2 connected buildings to unlock roads.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

function BuildingModal({ b, level, hired, userCoins, sadBonus, onBuy, onUpgrade, onHire, onFire, onClose, isPending }: {
  b: BuildingDef; level: number; hired: number; userCoins: number; sadBonus: number;
  onBuy: () => void; onUpgrade: () => void; onHire: () => void; onFire: () => void;
  onClose: () => void; isPending: boolean;
}) {
  const action = level === 0 ? { type: "buy" as const, label: "Build", cost: b.buyCost } : level < 3 ? { type: "upgrade" as const, label: `Upgrade → Level ${level + 1}`, cost: b.upgradeCost[level - 1] } : null;
  const canAfford = action ? userCoins >= action.cost : true;
  const cap = level > 0 ? b.staffCap[level - 1] : 0;
  const econ = buildingTickEcon(b, level, hired, sadBonus);
  const hireCost = b.wagePerTick * HIRE_BONUS_MULT;
  const canHire = level > 0 && hired < cap && userCoins >= hireCost && !isPending;

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
          {/* === STAFF / EMPLOYEES SECTION (SAD: Use Case actors) === */}
          {level > 0 && (
            <div className="mb-3 p-3 rounded-xl" style={{ background: "linear-gradient(135deg, rgba(33,150,243,0.06), rgba(21,101,192,0.08))", border: "1.5px solid rgba(33,150,243,0.25)" }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-[11px] font-black tracking-wide" style={{ color: "#1565C0" }}>👷 STAFF · {b.role.toUpperCase()}</div>
                  <div className="text-[10px]" style={{ color: "#5A7A9A" }}>SAD: actors performing the use case</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-black" style={{ color: "#0D47A1" }}>{hired} / {cap}</div>
                  <div className="text-[9px] font-bold" style={{ color: "#5A7A9A" }}>{cap === 0 ? "AUTOMATED" : "HIRED"}</div>
                </div>
              </div>
              {/* Slot dots */}
              {cap > 0 && (
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: cap }).map((_, i) => (
                    <div key={i} className="flex-1 h-2 rounded-full" style={{
                      background: i < hired ? "linear-gradient(90deg, #1976D2, #42A5F5)" : "rgba(0,0,0,0.08)",
                      border: "1px solid rgba(33,150,243,0.3)",
                    }}/>
                  ))}
                </div>
              )}
              {/* Econ readout */}
              <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
                <div className="rounded p-1" style={{ background: "rgba(46,125,50,0.08)" }}>
                  <div className="text-[9px] font-bold" style={{ color: "#5A7A5A" }}>GROSS</div>
                  <div className="text-xs font-black" style={{ color: "#2E7D32" }}>+{econ.gross}🪙</div>
                </div>
                <div className="rounded p-1" style={{ background: "rgba(198,40,40,0.06)" }}>
                  <div className="text-[9px] font-bold" style={{ color: "#9A5A5A" }}>WAGES</div>
                  <div className="text-xs font-black" style={{ color: "#C62828" }}>−{econ.wages}🪙</div>
                </div>
                <div className="rounded p-1" style={{ background: econ.net >= 0 ? "rgba(33,150,243,0.10)" : "rgba(198,40,40,0.10)" }}>
                  <div className="text-[9px] font-bold" style={{ color: "#5A7A9A" }}>NET/TICK</div>
                  <div className="text-xs font-black" style={{ color: econ.net >= 0 ? "#0D47A1" : "#B71C1C" }}>{econ.net >= 0 ? "+" : ""}{econ.net}🪙</div>
                </div>
              </div>
              {cap > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={onFire}
                    disabled={hired <= 0 || isPending}
                    className="flex-1 h-8 text-[11px] font-bold"
                    style={{ background: "rgba(198,40,40,0.85)", color: "white" }}
                    data-testid={`btn-fire-${b.id}`}
                  >
                    📤 Fire
                  </Button>
                  <Button
                    onClick={onHire}
                    disabled={!canHire}
                    className="flex-1 h-8 text-[11px] font-bold text-white"
                    style={{ background: canHire ? "linear-gradient(135deg, #1976D2, #0D47A1)" : "rgba(33,150,243,0.35)" }}
                    data-testid={`btn-hire-${b.id}`}
                  >
                    👷 Hire · {hireCost}🪙
                  </Button>
                </div>
              )}
              {cap === 0 && (
                <p className="text-[10px] text-center font-medium" style={{ color: "#5A7A9A" }}>No staff slots at this level. Upgrade to unlock hires.</p>
              )}
            </div>
          )}

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

// === SAD Diagrams Modal ===
// Auto-generates three Systems Analysis & Design diagrams from current farm
// state so players can SEE the same system three different ways. Each tab
// has a one-line definition + a one-line mapping to what's on screen — that
// way the diagram is the lesson, not just decoration.
function SADDiagramsModal({
  owned, employees, wagesPaid, farmBank, day, onClose,
}: {
  owned: Record<string, number>;
  employees: Record<string, number>;
  wagesPaid: number;
  farmBank: number;
  day: number;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"dfd" | "er" | "uc">("dfd");
  const ownedBuildings = BUILDINGS.filter(b => (owned[b.id] || 0) > 0);
  const totalEmp = Object.values(employees).reduce((a, b) => a + b, 0);
  const activeEdges = PRODUCTION_EDGES.filter(e => (owned[e.from] || 0) > 0 && (owned[e.to] || 0) > 0);

  const tabBtn = (id: typeof tab, label: string) => (
    <button
      onClick={() => setTab(id)}
      className="flex-1 py-2 text-xs font-black tracking-wide transition-all"
      style={{
        background: tab === id ? "linear-gradient(135deg, #FFD700, #F5A623)" : "rgba(255,255,255,0.04)",
        color: tab === id ? "#3E2716" : "#FFD700",
        borderBottom: tab === id ? "2px solid #FFD700" : "2px solid transparent",
      }}
      data-testid={`tab-diagram-${id}`}
    >{label}</button>
  );

  return (
    <>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}/>
      {/* Modal lives in its own flex centered container so it's visually
          centered regardless of viewport height — no more bottom-anchored
          overflow when the inner SVG is tall. The inner content area is
          the only scrollable region. */}
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 pointer-events-none"
        initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto flex flex-col w-full"
          style={{
            maxWidth: 640,
            maxHeight: "calc(100dvh - 24px)",
            background: "linear-gradient(180deg, #1a2410 0%, #0f1908 100%)",
            borderRadius: 16,
            border: "2px solid rgba(255,215,0,0.4)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            overflow: "hidden",
          }}
          data-testid="modal-sad-diagrams"
        >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ background: "rgba(0,0,0,0.35)", borderBottom: "1px solid rgba(255,215,0,0.25)" }}>
          <div className="flex items-center gap-2 min-w-0">
            <GraduationCap className="w-5 h-5 flex-shrink-0" style={{ color: "#FFD700" }}/>
            <div className="min-w-0">
              <h2 className="font-black text-sm sm:text-base tracking-wide truncate" style={{ fontFamily: "Oxanium, sans-serif", color: "#FFD700" }}>SAD DIAGRAMS · DAY {day}</h2>
              <p className="text-[10px] font-semibold truncate" style={{ color: "#A8C8A0" }}>Your farm, drawn three ways · Built from live game state</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,215,0,0.15)" }} data-testid="btn-close-diagrams">
            <X className="w-4 h-4" style={{ color: "#FFD700" }}/>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0" style={{ background: "rgba(0,0,0,0.2)" }}>
          {tabBtn("dfd", "DFD · Data Flow")}
          {tabBtn("er", "ER · Entities")}
          {tabBtn("uc", "UC · Use Case")}
        </div>

        {/* Content — only scrollable region; flex-1 so it grows/shrinks
            within the modal's max-height instead of pushing it offscreen. */}
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {ownedBuildings.length === 0 ? (
            <p className="text-center text-sm py-8" style={{ color: "#A8C8A0" }}>Build at least one structure to see diagrams.</p>
          ) : tab === "dfd" ? (
            <div>
              <div className="mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(33,150,243,0.10)", border: "1px solid rgba(33,150,243,0.30)" }}>
                <p className="text-[11px] font-bold" style={{ color: "#90CAF9" }}>Data Flow Diagram</p>
                <p className="text-[10px]" style={{ color: "#C8DCC0" }}>Shows how <b>data (and coins)</b> move between processes (your buildings) and external entities (Sun, Player, Market). Arrows = flows.</p>
              </div>
              <DFDSvg ownedBuildings={ownedBuildings} edges={activeEdges} farmBank={farmBank} wagesPaid={wagesPaid} totalEmp={totalEmp}/>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <Legend dotColor="#FFC107" label="External entity (Sun, Player, Market)"/>
                <Legend dotColor="#42A5F5" label="Process (a building)"/>
                <Legend dotColor="#66BB6A" label="Data store (Farm Bank)"/>
                <Legend dotColor="#EF5350" label="Cash-flow (wages out)"/>
              </div>
            </div>
          ) : tab === "er" ? (
            <div>
              <div className="mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(156,39,176,0.10)", border: "1px solid rgba(156,39,176,0.30)" }}>
                <p className="text-[11px] font-bold" style={{ color: "#CE93D8" }}>Entity-Relationship Diagram</p>
                <p className="text-[10px]" style={{ color: "#C8DCC0" }}>Shows your <b>data model</b>: which entities exist (Player, Building, Employee) and how they relate (1-to-many, many-to-many).</p>
              </div>
              <ERSvg ownedCount={ownedBuildings.length} totalEmp={totalEmp} farmBank={farmBank} day={day}/>
              <div className="mt-3 text-[10px] space-y-1" style={{ color: "#C8DCC0" }}>
                <div>• <b>Player</b> 1—N <b>Building</b> ({ownedBuildings.length} owned)</div>
                <div>• <b>Building</b> 1—N <b>Employee</b> ({totalEmp} hired across {ownedBuildings.filter(b => (employees[b.id] || 0) > 0).length} buildings)</div>
                <div>• <b>Player</b> 1—1 <b>FarmBank</b> ({farmBank}🪙 stored, {wagesPaid}🪙 paid)</div>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3 px-3 py-2 rounded-lg" style={{ background: "rgba(245,166,35,0.10)", border: "1px solid rgba(245,166,35,0.30)" }}>
                <p className="text-[11px] font-bold" style={{ color: "#FFD700" }}>Use Case Diagram</p>
                <p className="text-[10px]" style={{ color: "#C8DCC0" }}>Shows <b>actors</b> (you, your hired farmers, the Sun) and the <b>use cases</b> they perform (Plant, Harvest, Mill, Pay Wages).</p>
              </div>
              <UCSvg ownedBuildings={ownedBuildings} employees={employees}/>
            </div>
          )}
        </div>
        </div>
      </motion.div>
    </>
  );
}

function Legend({ dotColor, label }: { dotColor: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: dotColor }}/>
      <span style={{ color: "#C8DCC0" }}>{label}</span>
    </div>
  );
}

// DFD: external entities on left/right, processes (buildings) in the middle
// laid out vertically by category, with arrows for production edges + a
// store node (Farm Bank) at the bottom.
function DFDSvg({ ownedBuildings, edges, farmBank, wagesPaid, totalEmp }: {
  ownedBuildings: BuildingDef[]; edges: Edge[]; farmBank: number; wagesPaid: number; totalEmp: number;
}) {
  const W = 580, H = Math.max(280, 60 + ownedBuildings.length * 36);
  const colX = { ext: 50, proc: 280, store: 510 };
  const procY = (i: number) => 40 + i * 36;
  const idxOf = Object.fromEntries(ownedBuildings.map((b, i) => [b.id, i]));
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8 }}>
      <defs>
        <marker id="dfdArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#90CAF9"/>
        </marker>
        <marker id="wageArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#EF5350"/>
        </marker>
      </defs>
      {/* External entities (left column) */}
      <g>
        <rect x={colX.ext - 40} y={40} width={90} height={28} rx={4} fill="rgba(255,193,7,0.18)" stroke="#FFC107" strokeWidth={1.5}/>
        <text x={colX.ext + 5} y={58} fill="#FFC107" fontSize={11} fontWeight={800} textAnchor="middle">☀️ Sun</text>
        <rect x={colX.ext - 40} y={H/2 - 14} width={90} height={28} rx={4} fill="rgba(255,193,7,0.18)" stroke="#FFC107" strokeWidth={1.5}/>
        <text x={colX.ext + 5} y={H/2 + 4} fill="#FFC107" fontSize={11} fontWeight={800} textAnchor="middle">🧑 Player</text>
        <rect x={colX.ext - 40} y={H - 68} width={90} height={28} rx={4} fill="rgba(255,193,7,0.18)" stroke="#FFC107" strokeWidth={1.5}/>
        <text x={colX.ext + 5} y={H - 50} fill="#FFC107" fontSize={11} fontWeight={800} textAnchor="middle">👷 {totalEmp} Workers</text>
      </g>
      {/* Processes (buildings) */}
      {ownedBuildings.map((b, i) => (
        <g key={b.id}>
          <ellipse cx={colX.proc} cy={procY(i) + 12} rx={95} ry={13} fill="rgba(33,150,243,0.18)" stroke="#42A5F5" strokeWidth={1.3}/>
          <text x={colX.proc} y={procY(i) + 16} fill="#90CAF9" fontSize={10} fontWeight={700} textAnchor="middle">{b.emoji} {b.name}</text>
        </g>
      ))}
      {/* Production edges between processes */}
      {edges.map((e, i) => {
        const fy = procY(idxOf[e.from] ?? 0) + 12;
        const ty = procY(idxOf[e.to] ?? 0) + 12;
        return (
          <path key={i} d={`M ${colX.proc + 95} ${fy} Q ${colX.proc + 140} ${(fy+ty)/2} ${colX.proc + 95} ${ty}`}
            fill="none" stroke="#42A5F5" strokeWidth={1.2} strokeDasharray="3 3" opacity={0.55} markerEnd="url(#dfdArrow)"/>
        );
      })}
      {/* External → first process: Sun input */}
      {ownedBuildings.length > 0 && (
        <line x1={colX.ext + 50} y1={54} x2={colX.proc - 95} y2={procY(0) + 12} stroke="#FFC107" strokeWidth={1.3} markerEnd="url(#dfdArrow)" opacity={0.7}/>
      )}
      {/* Player → middle process */}
      {ownedBuildings.length > 0 && (
        <line x1={colX.ext + 50} y1={H/2} x2={colX.proc - 95} y2={procY(Math.floor(ownedBuildings.length/2)) + 12} stroke="#FFC107" strokeWidth={1.3} markerEnd="url(#dfdArrow)" opacity={0.7}/>
      )}
      {/* Wages: bank → workers (red) */}
      {totalEmp > 0 && (
        <line x1={colX.store - 5} y1={H - 50} x2={colX.ext + 50} y2={H - 54} stroke="#EF5350" strokeWidth={1.5} markerEnd="url(#wageArrow)" opacity={0.85}/>
      )}
      {/* Data store — Farm Bank */}
      <g>
        <rect x={colX.store - 50} y={H/2 - 22} width={100} height={44} rx={2} fill="rgba(102,187,106,0.18)" stroke="#66BB6A" strokeWidth={1.5}/>
        <line x1={colX.store - 50} y1={H/2 - 14} x2={colX.store + 50} y2={H/2 - 14} stroke="#66BB6A" strokeWidth={1}/>
        <text x={colX.store} y={H/2 - 4} fill="#A5D6A7" fontSize={10} fontWeight={800} textAnchor="middle">🏦 Farm Bank</text>
        <text x={colX.store} y={H/2 + 10} fill="#A5D6A7" fontSize={10} fontWeight={700} textAnchor="middle">{farmBank}🪙 · {wagesPaid} paid</text>
      </g>
      {/* Processes → store (output flows) */}
      {ownedBuildings.map((b, i) => (
        <line key={`s-${b.id}`} x1={colX.proc + 95} y1={procY(i) + 12} x2={colX.store - 50} y2={H/2} stroke="#66BB6A" strokeWidth={0.9} opacity={0.4} markerEnd="url(#dfdArrow)"/>
      ))}
    </svg>
  );
}

// ER: 4 entities (Player, Building, Employee, FarmBank) with crow's-foot
// style cardinality labels.
function ERSvg({ ownedCount, totalEmp, farmBank, day }: { ownedCount: number; totalEmp: number; farmBank: number; day: number }) {
  return (
    <svg width="100%" viewBox="0 0 580 320" style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8 }}>
      <defs>
        <marker id="one" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><line x1="9" y1="0" x2="9" y2="10" stroke="#CE93D8" strokeWidth="1.5"/></marker>
        <marker id="many" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto"><path d="M0,5 L9,0 M0,5 L9,5 M0,5 L9,10" stroke="#CE93D8" strokeWidth="1.5" fill="none"/></marker>
      </defs>
      {/* Entities */}
      {[
        { x: 290, y: 40, w: 130, h: 60, t: "👤 Player", attrs: [`day=${day}`, "username"] },
        { x: 60, y: 180, w: 140, h: 70, t: "🏗️ Building", attrs: [`count=${ownedCount}`, "level, name"] },
        { x: 380, y: 180, w: 140, h: 70, t: "👷 Employee", attrs: [`count=${totalEmp}`, "wage, role"] },
        { x: 220, y: 250, w: 130, h: 60, t: "🏦 FarmBank", attrs: [`bal=${farmBank}🪙`] },
      ].map((e, i) => (
        <g key={i}>
          <rect x={e.x} y={e.y} width={e.w} height={e.h} rx={6} fill="rgba(156,39,176,0.16)" stroke="#CE93D8" strokeWidth={1.5}/>
          <line x1={e.x} y1={e.y + 22} x2={e.x + e.w} y2={e.y + 22} stroke="#CE93D8" strokeWidth={1}/>
          <text x={e.x + e.w/2} y={e.y + 16} fill="#E1BEE7" fontSize={11} fontWeight={800} textAnchor="middle">{e.t}</text>
          {e.attrs.map((a, j) => (
            <text key={j} x={e.x + 8} y={e.y + 36 + j * 13} fill="#C8B0D8" fontSize={9} fontWeight={600}>· {a}</text>
          ))}
        </g>
      ))}
      {/* Relationships */}
      <line x1={300} y1={100} x2={130} y2={180} stroke="#CE93D8" strokeWidth={1.4} markerStart="url(#one)" markerEnd="url(#many)"/>
      <text x={195} y={135} fill="#E1BEE7" fontSize={9} fontWeight={700}>owns (1:N)</text>
      <line x1={130} y1={250} x2={380} y2={215} stroke="#CE93D8" strokeWidth={1.4} markerStart="url(#one)" markerEnd="url(#many)"/>
      <text x={235} y={245} fill="#E1BEE7" fontSize={9} fontWeight={700}>employs (1:N)</text>
      <line x1={355} y1={100} x2={285} y2={250} stroke="#CE93D8" strokeWidth={1.4} markerStart="url(#one)" markerEnd="url(#one)"/>
      <text x={335} y={185} fill="#E1BEE7" fontSize={9} fontWeight={700}>has (1:1)</text>
      <line x1={420} y1={100} x2={450} y2={180} stroke="#CE93D8" strokeWidth={1.4} markerStart="url(#one)" markerEnd="url(#many)" strokeDasharray="4 3"/>
      <text x={440} y={140} fill="#E1BEE7" fontSize={9} fontWeight={700}>hires</text>
    </svg>
  );
}

// Use Case: stick-figure actors on the left/right linked to use-case ovals.
function UCSvg({ ownedBuildings, employees }: { ownedBuildings: BuildingDef[]; employees: Record<string, number> }) {
  // Distinct verbs: Plant/Harvest (crops), Tend (livestock), Operate (equipment), Manage (buildings)
  const useCases = [
    { label: "Plant & Harvest", visible: ownedBuildings.some(b => b.category === "crops") },
    { label: "Tend Livestock",  visible: ownedBuildings.some(b => b.category === "livestock") },
    { label: "Operate Machines", visible: ownedBuildings.some(b => b.category === "equipment") },
    { label: "Manage Hub",      visible: ownedBuildings.some(b => b.category === "buildings") },
    { label: "Pay Wages",        visible: Object.values(employees).some(v => v > 0) },
    { label: "Daily Harvest",    visible: true },
  ].filter(u => u.visible);

  const W = 580, H = 80 + useCases.length * 50;
  const ucX = W/2, ucY = (i: number) => 60 + i * 50;

  // Stickfigure svg helper
  const Stick = (x: number, y: number, label: string, color: string) => (
    <g>
      <circle cx={x} cy={y} r={7} fill="none" stroke={color} strokeWidth={1.6}/>
      <line x1={x} y1={y + 7} x2={x} y2={y + 25} stroke={color} strokeWidth={1.6}/>
      <line x1={x - 9} y1={y + 14} x2={x + 9} y2={y + 14} stroke={color} strokeWidth={1.6}/>
      <line x1={x} y1={y + 25} x2={x - 8} y2={y + 36} stroke={color} strokeWidth={1.6}/>
      <line x1={x} y1={y + 25} x2={x + 8} y2={y + 36} stroke={color} strokeWidth={1.6}/>
      <text x={x} y={y + 50} fill={color} fontSize={10} fontWeight={800} textAnchor="middle">{label}</text>
    </g>
  );

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8 }}>
      {/* System boundary */}
      <rect x={W/2 - 130} y={20} width={260} height={H - 40} rx={10} fill="none" stroke="rgba(255,215,0,0.35)" strokeWidth={1.2} strokeDasharray="6 4"/>
      <text x={W/2} y={14} fill="#FFD700" fontSize={9} fontWeight={800} textAnchor="middle">— FARM SYSTEM —</text>
      {/* Actors */}
      {Stick(50, 60, "Player", "#FFD700")}
      {Stick(W - 50, 60, "Farmer", "#42A5F5")}
      {Stick(50, H - 80, "Sun ☀️", "#FFC107")}
      {/* Use cases */}
      {useCases.map((u, i) => (
        <g key={i}>
          <ellipse cx={ucX} cy={ucY(i)} rx={100} ry={16} fill="rgba(245,166,35,0.18)" stroke="#FFD700" strokeWidth={1.3}/>
          <text x={ucX} y={ucY(i) + 4} fill="#FFE082" fontSize={11} fontWeight={800} textAnchor="middle">{u.label}</text>
          {/* link from player to first 4, farmer to all hired ones */}
          <line x1={67} y1={70} x2={ucX - 100} y2={ucY(i)} stroke="#FFD700" strokeWidth={0.9} opacity={0.45}/>
          {(u.label === "Tend Livestock" || u.label === "Operate Machines" || u.label === "Plant & Harvest" || u.label === "Manage Hub") && (
            <line x1={W - 67} y1={70} x2={ucX + 100} y2={ucY(i)} stroke="#42A5F5" strokeWidth={0.9} opacity={0.55}/>
          )}
          {u.label === "Plant & Harvest" && (
            <line x1={67} y1={H - 70} x2={ucX - 100} y2={ucY(i)} stroke="#FFC107" strokeWidth={0.9} opacity={0.45} strokeDasharray="3 3"/>
          )}
        </g>
      ))}
    </svg>
  );
}

// === SAD-themed quest panel (collapsible, top-left) ===
// Shows the 6 systems-analysis-themed side quests, their progress, and a
// claim button when complete. Persists "completedQuests" via the parent.
// === STORYLINE PANEL — top-right floating card ============================
// Mirrors QuestPanel's visual language but uses a parchment-scroll palette
// so players read it as the in-character "owner's manual" voice rather
// than a checklist. Collapsed = small icon with NEW! pip if unread.
function StoryPanel({
  chapter, acked, sadMastery, sadBonusPct, totalConcepts, onAck,
}: {
  chapter: StoryChapter;
  acked: boolean;
  sadMastery: number;
  sadBonusPct: number;
  totalConcepts: number;
  onAck: () => void;
}) {
  const [open, setOpen] = useState(true);
  const isNew = !acked;
  return (
    <div
      data-no-pan="true"
      className="absolute"
      style={{
        zIndex: 40,
        right: 10,
        top: 102,
        width: open ? 300 : 64,
        background: "linear-gradient(180deg, rgba(48,28,12,0.94) 0%, rgba(38,22,10,0.92) 100%)",
        border: "1.5px solid rgba(245,166,35,0.55)",
        borderRadius: 12,
        backdropFilter: "blur(8px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        overflow: "hidden",
        transition: "width 0.25s ease",
      }}
      data-testid="story-panel"
    >
      <button
        onClick={() => setOpen(o => !o)}
        data-no-pan="true"
        className="w-full flex items-center gap-2 px-3 py-2 transition-colors hover:bg-white/5"
        style={{ background: "rgba(0,0,0,0.30)", borderBottom: open ? "1px solid rgba(245,166,35,0.3)" : "none" }}
        data-testid="btn-toggle-story"
        aria-label={open ? "Collapse story" : "Expand story"}
      >
        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 relative" style={{ background: "linear-gradient(135deg, #FFD27A, #C97A2A)", boxShadow: "0 1px 4px rgba(201,122,42,0.5)" }}>
          <BookOpen className="w-4 h-4" style={{ color: "#3E2716" }}/>
          {isNew && (
            <motion.span
              animate={{ scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}
              className="absolute -top-1 -right-1 flex items-center justify-center font-black text-[8px] rounded-full"
              style={{ width: 14, height: 14, background: "#FF5252", color: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
            >!</motion.span>
          )}
        </div>
        {open && (
          <>
            <div className="flex-1 text-left min-w-0">
              <div className="text-[10px] font-bold tracking-widest leading-tight" style={{ color: "#C9A76A" }}>STORY · CH {chapter.index}/7</div>
              <div className="text-[12px] font-black leading-tight truncate" style={{ fontFamily: "Oxanium, sans-serif", color: "#FFD27A" }}>
                {chapter.title}
              </div>
            </div>
            <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "#FFD27A" }}/>
          </>
        )}
        {!open && <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "#FFD27A" }}/>}
      </button>

      {open && (
        <div className="p-3 space-y-2.5">
          {/* SAD concept tag */}
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black tracking-wider" style={{ background: "rgba(124,77,255,0.25)", color: "#D0BCFF", border: "1px solid rgba(124,77,255,0.45)" }}>
            <Brain className="w-2.5 h-2.5"/> {chapter.sadConcept.toUpperCase()}
          </div>
          {/* Narrator quote */}
          <p
            className="text-[11px] leading-relaxed italic"
            style={{
              color: "#F0DCB0",
              borderLeft: "2px solid rgba(245,166,35,0.5)",
              paddingLeft: 8,
              fontFamily: "Georgia, serif",
            }}
            data-testid="text-story-narrator"
          >
            "{chapter.narrator}"
          </p>
          {/* Objective */}
          <div className="rounded-md px-2.5 py-2" style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(245,166,35,0.25)" }}>
            <div className="text-[9px] font-black tracking-widest mb-0.5" style={{ color: "#C9A76A" }}>OBJECTIVE</div>
            <div className="text-[11px] font-semibold leading-snug" style={{ color: "#FFE9C4" }} data-testid="text-story-objective">
              {chapter.objective}
            </div>
          </div>
          {/* Live SAD-mastery readout — explicitly ties academy → economy */}
          <div className="rounded-md px-2.5 py-1.5 flex items-center gap-2" style={{ background: "rgba(124,77,255,0.16)", border: "1px solid rgba(124,77,255,0.35)" }}>
            <Brain className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#D0BCFF" }}/>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black tracking-wider" style={{ color: "#D0BCFF" }}>SAD MASTERY · {sadMastery}/{totalConcepts}</div>
              <div className="text-[9px] leading-tight" style={{ color: "#B6A0E8" }}>
                {sadMastery > 0
                  ? `+${sadBonusPct}% farm income from concepts mastered`
                  : "Master concepts in courses → permanent farm income bonus"}
              </div>
            </div>
          </div>
          {isNew && (
            <button
              onClick={onAck}
              data-no-pan="true"
              data-testid="btn-ack-chapter"
              className="w-full px-2.5 py-1.5 rounded-md text-[11px] font-black transition-all hover:scale-[1.02] active:scale-95"
              style={{
                background: "linear-gradient(135deg, #F5A623, #C97A2A)",
                color: "#2E1A06",
                boxShadow: "0 2px 8px rgba(201,122,42,0.45)",
                border: "1px solid rgba(255,215,0,0.5)",
              }}
            >
              Got it — let's get to work
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function QuestPanel({
  owned, employees, wagesPaid, completed, onClaim, isPending,
}: {
  owned: Record<string, number>;
  employees: Record<string, number>;
  wagesPaid: number;
  completed: string[];
  onClaim: (q: QuestDef) => void;
  isPending: boolean;
}) {
  const [open, setOpen] = useState(true);
  const completedCount = completed.length;
  const pendingCount   = QUESTS.filter(q => !completed.includes(q.id) && questProgress(q, owned, employees, wagesPaid).done).length;

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
              const prog = questProgress(q, owned, employees, wagesPaid);
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
