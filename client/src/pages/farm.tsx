import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Coins, Star, X, ArrowUpCircle, ShoppingCart, ChevronLeft, Plus, Minus, Maximize2 } from "lucide-react";
import { BuildingSVG, LockedFieldSVG } from "@/components/farm-buildings";
import {
  useAtmosphere, skyGradient, CelestialBody, Stars, WeatherLayer,
  AmbientCreatures, TickProgress, BankMeter, WeatherBadge,
  GoldenCropOverlay, useGoldenCropSpawner, HarvestBurst, LightningFlash,
} from "@/components/farm-extras";
import {
  WORLD_W, WORLD_H, BOARD_W, BOARD_H, BOARD_OFFSET_X, BOARD_OFFSET_Y,
  WorldGround, Minimap,
} from "@/components/farm-world";

const TICK_INTERVAL_MS = 30_000;
const MAX_FARM_BANK    = 500;
const MAX_OFFLINE_TICKS = 20;
const farmKey = (uid: string) => `farm_v2_state_${uid}`;

const ISO_HALF_W = 120;
const ISO_HALF_H = 60;
const CENTER_X = 560;
const START_Y = 80;
const CANVAS_W = BOARD_W;
const CANVAS_H = BOARD_H;

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

type FarmSave = {
  owned: Record<string, number>;
  farmBank: number;
  lastTickTime: number;
  tickCounters: Record<string, number>;
  day: number;
};

function loadState(uid: string): FarmSave {
  try { const raw = localStorage.getItem(farmKey(uid)); if (raw) return { ...defaultState(), ...JSON.parse(raw) }; } catch {} return defaultState();
}
function defaultState(): FarmSave { return { owned: {}, farmBank: 0, lastTickTime: Date.now(), tickCounters: {}, day: 1 }; }
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
const ZOOM_MIN_FACTOR = 0.55;   // multiplier off the fit-scale
const ZOOM_MAX_FACTOR = 1.75;
const PAN_EDGE_PAD    = 0.18;   // keep at least this much of viewport showing the world

type Camera = { x: number; y: number; scale: number };

function clampCamera(cam: Camera, vw: number, vh: number, minScale: number, maxScale: number): Camera {
  const scale = Math.max(minScale, Math.min(maxScale, cam.scale));
  const wScale = WORLD_W * scale;
  const hScale = WORLD_H * scale;
  // Allow generous panning but keep at least PAN_EDGE_PAD of viewport showing the world.
  const minX = vw * (1 - PAN_EDGE_PAD) - wScale;
  const maxX = vw * PAN_EDGE_PAD;
  const minY = vh * (1 - PAN_EDGE_PAD) - hScale;
  const maxY = vh * PAN_EDGE_PAD;
  return {
    x: wScale < vw ? (vw - wScale) / 2 : Math.max(minX, Math.min(maxX, cam.x)),
    y: hScale < vh ? (vh - hScale) / 2 : Math.max(minY, Math.min(maxY, cam.y)),
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
      toast({ title: `🌾 Harvest! +${data.coinsAdded} EduCoins`, description: `Day ${farmSave.day + 1} begins!` });
      setFarmSave(prev => { const ns = { ...prev, farmBank: 0, day: prev.day + 1 }; if (user) saveState(ns, user.id); return ns; });
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
  const fitScale = useMemo(() => {
    const widthFit  = (viewSize.w * (isMobile ? 1.0 : 0.92)) / BOARD_W;
    const heightFit = (viewSize.h * (isMobile ? 0.78 : 0.72)) / BOARD_H;
    return Math.max(0.35, Math.min(widthFit, heightFit, 1.05));
  }, [viewSize.w, viewSize.h, isMobile]);
  const minScale = useMemo(() => Math.max(0.32, fitScale * ZOOM_MIN_FACTOR), [fitScale]);
  const maxScale = useMemo(() => Math.min(1.75, fitScale * ZOOM_MAX_FACTOR), [fitScale]);

  const computeDefaultCam = useCallback((vw: number, vh: number, scale: number): Camera => {
    const boardCx = BOARD_OFFSET_X + BOARD_W / 2;
    const boardCy = BOARD_OFFSET_Y + BOARD_H / 2;
    return clampCamera({
      x: vw / 2 - boardCx * scale,
      y: vh * 0.50 - boardCy * scale + (isMobile ? 24 : 18),
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

  const sortedBuildings = [...BUILDINGS].sort((a, b) => (a.col + a.row) - (b.col + b.row));

  // === Atmosphere ===
  const atm = useAtmosphere();
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
  const goldenPos = golden.spawn ? (() => {
    const b = BUILDINGS.find(bb => bb.id === golden.spawn!.bId);
    return b ? isoPos(b.col, b.row) : null;
  })() : null;

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: skyGradient(atm.phase, atm.weather), transition: "background 1.5s linear" }}>
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

          {/* === BOARD CONTAINER === */}
          <div className="absolute" style={{ left: BOARD_OFFSET_X, top: BOARD_OFFSET_Y, width: CANVAS_W, height: CANVAS_H }}>
            <svg className="absolute inset-0" width={CANVAS_W} height={CANVAS_H} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
              <defs>
                <linearGradient id="farmGrassGrad" x1="0.5" y1="0" x2="0.5" y2="1">
                  <stop offset="0%" stopColor="#7DB845" stopOpacity="0.25"/>
                  <stop offset="100%" stopColor="#4A7820" stopOpacity="0.45"/>
                </linearGradient>
                <radialGradient id="farmEdgeFade" cx="50%" cy="50%" r="50%">
                  <stop offset="50%" stopColor="transparent"/>
                  <stop offset="100%" stopColor="rgba(0,0,0,0.18)"/>
                </radialGradient>
              </defs>

              {/* Outer shadow for depth */}
              <polygon points="570,28 1052,268 678,452 196,208" fill="rgba(0,0,0,0.25)" />
              {/* Main farm land base */}
              <polygon points="560,20 1040,260 680,440 200,200" fill="#6B9A36" />
              {/* Lighter grass variation top-left */}
              <polygon points="560,20 800,148 560,200 320,200" fill="#78A83F" opacity="0.6"/>
              {/* Darker soil variation bottom-right */}
              <polygon points="800,260 1040,260 760,380 680,440" fill="#5A8628" opacity="0.5"/>
              <polygon points="560,20 1040,260 680,440 200,200" fill="url(#farmGrassGrad)" />
              <polygon points="560,20 1040,260 680,440 200,200" fill="url(#farmEdgeFade)" opacity="0.5"/>
              {/* Land border highlight */}
              <polygon points="560,20 1040,260 680,440 200,200" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>

              {/* === DIRT ROADS along grid === */}
              {[0,1,2].flatMap(row => [0,1,2].map(col => {
                const a = isoPos(col, row); const nb = isoPos(col+1, row);
                return <line key={`rs-r${row}c${col}`} x1={a.x} y1={a.y+3} x2={nb.x} y2={nb.y+3} stroke="rgba(0,0,0,0.2)" strokeWidth="18" strokeLinecap="round"/>;
              }))}
              {[0,1,2,3].flatMap(col => [0,1].map(row => {
                const a = isoPos(col, row); const nb = isoPos(col, row+1);
                return <line key={`rs-c${col}r${row}`} x1={a.x} y1={a.y+3} x2={nb.x} y2={nb.y+3} stroke="rgba(0,0,0,0.2)" strokeWidth="18" strokeLinecap="round"/>;
              }))}
              {[0,1,2].flatMap(row => [0,1,2].map(col => {
                const a = isoPos(col, row); const nb = isoPos(col+1, row);
                return <line key={`rr${row}c${col}`} x1={a.x} y1={a.y} x2={nb.x} y2={nb.y} stroke="#C49A5A" strokeWidth="14" strokeLinecap="round"/>;
              }))}
              {[0,1,2,3].flatMap(col => [0,1].map(row => {
                const a = isoPos(col, row); const nb = isoPos(col, row+1);
                return <line key={`rc${col}r${row}`} x1={a.x} y1={a.y} x2={nb.x} y2={nb.y} stroke="#C49A5A" strokeWidth="14" strokeLinecap="round"/>;
              }))}
              {[0,1,2].flatMap(row => [0,1,2].map(col => {
                const a = isoPos(col, row); const nb = isoPos(col+1, row);
                const mx = (a.x + nb.x) / 2; const my = (a.y + nb.y) / 2;
                return <line key={`rm-r${row}c${col}`} x1={a.x+(mx-a.x)*0.3} y1={a.y+(my-a.y)*0.3} x2={nb.x-(nb.x-mx)*0.3} y2={nb.y-(nb.y-my)*0.3} stroke="#D4B070" strokeWidth="2" strokeLinecap="round" strokeDasharray="8 6" opacity="0.5"/>;
              }))}
              {[0,1,2,3].flatMap(col => [0,1].map(row => {
                const a = isoPos(col, row); const nb = isoPos(col, row+1);
                const mx = (a.x + nb.x) / 2; const my = (a.y + nb.y) / 2;
                return <line key={`rm-c${col}r${row}`} x1={a.x+(mx-a.x)*0.3} y1={a.y+(my-a.y)*0.3} x2={nb.x-(nb.x-mx)*0.3} y2={nb.y-(nb.y-my)*0.3} stroke="#D4B070" strokeWidth="2" strokeLinecap="round" strokeDasharray="8 6" opacity="0.5"/>;
              }))}
              {[0,1,2,3].flatMap(col => [0,1,2].map(row => {
                const p = isoPos(col, row);
                return <ellipse key={`ri-${col}-${row}`} cx={p.x} cy={p.y} rx={10} ry={6} fill="#B88A48" opacity="0.8"/>;
              }))}

              {/* === Soil patches under each plot === */}
              {BUILDINGS.map(b => {
                const { x, y } = isoPos(b.col, b.row);
                const owned = (farmSave.owned[b.id] || 0) > 0;
                return (
                  <g key={`soil-${b.id}`}>
                    <ellipse cx={x} cy={y+4} rx={76} ry={38} fill="rgba(0,0,0,0.15)"/>
                    <ellipse cx={x} cy={y} rx={74} ry={36} fill={owned ? "#7A5A28" : "#6B5040"} opacity={owned ? 0.65 : 0.5}/>
                    <ellipse cx={x-12} cy={y-6} rx={30} ry={12} fill="rgba(255,255,255,0.07)"/>
                    <ellipse cx={x} cy={y} rx={74} ry={36} fill="none" stroke={owned ? "#9A7838" : "#5a4a3a"} strokeWidth="1.5" opacity="0.6"/>
                    {!owned && (
                      <>
                        <line x1={x-50} y1={y-6} x2={x+50} y2={y-6} stroke="#5a4a3a" strokeWidth="1" opacity="0.25" strokeDasharray="7 5"/>
                        <line x1={x-40} y1={y+8} x2={x+40} y2={y+8} stroke="#5a4a3a" strokeWidth="1" opacity="0.25" strokeDasharray="7 5"/>
                      </>
                    )}
                  </g>
                );
              })}

              {/* === Fence posts around the farm border === */}
              {[
                [560,20],[680,80],[800,140],[920,200],[1040,260],
                [920,320],[800,380],[680,440],
                [560,380],[440,320],[320,260],[200,200],
                [320,140],[440,80],
              ].map(([fx,fy],i) => (
                <g key={`fence-${i}`} opacity="0.75">
                  <rect x={fx-3} y={fy-10} width="6" height="14" rx="1.5" fill="#8B6040"/>
                  <rect x={fx-5} y={fy-12} width="10" height="5" rx="1" fill="#A0724E"/>
                </g>
              ))}
              <polyline points="560,20 680,80 800,140 920,200 1040,260" fill="none" stroke="#8B6040" strokeWidth="2" opacity="0.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="560,20 440,80 320,140 200,200" fill="none" stroke="#8B6040" strokeWidth="2" opacity="0.5" strokeLinecap="round" strokeLinejoin="round"/>

              {/* Grass tufts inside farm */}
              {[
                {x:640,y:55},{x:720,y:105},{x:840,y:165},{x:960,y:225},
                {x:480,y:105},{x:390,y:160},{x:300,y:215},
                {x:770,y:310},{x:630,y:350},{x:500,y:300},{x:420,y:250},
              ].map((g, i) => (
                <g key={`gt-${i}`} opacity={0.45 + (i%3)*0.1}>
                  <line x1={g.x-3} y1={g.y} x2={g.x-7} y2={g.y-11} stroke="#4A8020" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1={g.x} y1={g.y} x2={g.x} y2={g.y-14} stroke="#5A9028" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1={g.x+3} y1={g.y} x2={g.x+6} y2={g.y-10} stroke="#4A8020" strokeWidth="1.8" strokeLinecap="round"/>
                </g>
              ))}

              {/* Wildflowers inside farm */}
              {[
                {x:660,y:62,c:"#FFD700"},{x:830,y:155,c:"#FF7043"},
                {x:460,y:130,c:"#E040FB"},{x:750,y:290,c:"#FFC107"},
                {x:540,y:260,c:"#FF5722"},{x:910,y:220,c:"#FFD700"},
              ].map((f, i) => (
                <g key={`wf-${i}`} opacity="0.7">
                  <line x1={f.x} y1={f.y} x2={f.x} y2={f.y+8} stroke="#4A8020" strokeWidth="1.2"/>
                  <circle cx={f.x} cy={f.y} r="3.5" fill={f.c}/>
                  <circle cx={f.x-3} cy={f.y-2} r="2" fill={f.c} opacity="0.7"/>
                </g>
              ))}
            </svg>

            {/* === BUILDINGS === */}
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
                  data-no-pan="true"
                  style={{
                    left: x - bldgW / 2,
                    top: y - bldgH * 0.7,
                    width: bldgW,
                    height: bldgH,
                    zIndex: 10 + depth * 3,
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

            {/* Chickens & cows */}
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
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #FFD700, #F5A623)", boxShadow: "0 2px 8px rgba(245,166,35,0.4)" }}>
              <svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#F57F17"/><circle cx="12" cy="12" r="6" fill="#FFD54F"/><circle cx="9" cy="9" r="2" fill="#FFF59D" opacity="0.8"/></svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm sm:text-base font-black tracking-widest leading-none truncate" style={{ fontFamily: "Oxanium, sans-serif", color: "#FFD700", textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>FARM TYCOON</h1>
              <p className="text-[10px] font-semibold leading-tight truncate" style={{ color: "#C8A84E" }}>Day {farmSave.day} · {farmRating}</p>
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
              onClick={() => { setIsHarvesting(true); harvestMutation.mutate(farmSave.farmBank); }}
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

      {/* === Footer hint === */}
      <div className="absolute bottom-0 left-0 right-0 z-20 text-center pb-2 pointer-events-none">
        <p className="text-[10px] sm:text-[11px] font-medium px-3 py-1 rounded-full inline-block" style={{ background: "rgba(20,12,4,0.65)", color: "rgba(220,200,160,0.85)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,215,0,0.15)" }}>
          <span className="hidden sm:inline">Drag to pan · Pinch / scroll to zoom · </span>Tap a plot to build · Income every 30s
        </p>
      </div>

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
