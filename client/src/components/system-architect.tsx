// =============================================================================
// SYSTEM ARCHITECT — server-infrastructure tower-defense / sim
// =============================================================================
// The player buys components from a sidebar shop, drops them on a grid, and
// wires them together to route incoming user traffic from the Internet to
// the Database. Traffic grows over time; if a component receives more load
// than it can handle, it overheats and crashes. Game Over when no path from
// Internet → Database exists. Score = uptime + reqs processed.
//
// All code is intentionally modular and commented so it's easy to tweak the
// economy or add new component types.
// =============================================================================

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Trophy, Zap, Pause, Play, Trash2, Cable, MousePointer2, Activity, Sparkles, AlertTriangle } from "lucide-react";

// -----------------------------------------------------------------------------
// 1) GAME CONSTANTS — economy & balance live here.
// -----------------------------------------------------------------------------
const GRID_COLS       = 8;          // workspace columns
const GRID_ROWS       = 5;          // workspace rows
const CELL            = 56;         // px per cell
const STARTING_BUDGET = 280;
const STARTING_TRAFFIC= 18;         // req/sec coming out of the Internet
const TRAFFIC_RAMP    = 4;          // +req/sec every TRAFFIC_RAMP_INTERVAL
const TRAFFIC_RAMP_DT = 8;          // sec between traffic surges
const PROCESS_INCOME  = 0.18;       // $ per processed req per sec at the DB
const HEAT_RISE       = 1.4;        // heat per (over-capacity) req per sec
const HEAT_DECAY      = 14;         // heat lost per sec when at-or-below capacity
const SELL_REFUND     = 0.5;        // half-price refund when selling
const TICK_HZ         = 8;          // simulation ticks per second (smoother UI)

type CompType = "internet" | "firewall" | "lb" | "server" | "db";

interface CompSpec {
  cost: number;
  capacity: number;     // req/sec the component can sustain
  label: string;
  short: string;
  emoji: string;
  color: string;        // tailwind text-* color
  ring: string;         // tailwind border color (idle)
  hot: string;          // tailwind border color (overloaded)
  detail: string;
}

const SPECS: Record<CompType, CompSpec> = {
  internet: { cost: 0,   capacity: 99999, label: "Internet",     short: "WWW",  emoji: "🌐", color: "text-emerald-300", ring: "border-emerald-400/60", hot: "border-emerald-300", detail: "Source of all incoming traffic. Pre-placed, can't be moved." },
  firewall: { cost: 60,  capacity: 220,   label: "Firewall",     short: "FW",   emoji: "🛡️", color: "text-orange-300",  ring: "border-orange-400/50",  hot: "border-rose-400",     detail: "First line of defence. Filters incoming traffic, capacity 220 r/s." },
  lb:       { cost: 90,  capacity: 999,   label: "Load Balancer",short: "LB",   emoji: "⚖️", color: "text-violet-300",  ring: "border-violet-400/50",  hot: "border-rose-400",     detail: "Splits incoming traffic equally across all its outputs. No capacity limit." },
  server:   { cost: 70,  capacity: 55,    label: "Web Server",   short: "WEB",  emoji: "🖥️", color: "text-cyan-300",    ring: "border-cyan-400/50",    hot: "border-rose-400",     detail: "Handles user requests. Capacity 55 r/s before overheating." },
  db:       { cost: 130, capacity: 110,   label: "Database",     short: "DB",   emoji: "🗄️", color: "text-amber-300",   ring: "border-amber-400/50",   hot: "border-rose-400",     detail: "Stores data. Capacity 110 r/s. Reaching the DB is what earns money." },
};

const SHOP_ORDER: CompType[] = ["firewall", "lb", "server", "db"];

// -----------------------------------------------------------------------------
// 2) TYPES — game state.
// -----------------------------------------------------------------------------
interface PlacedComponent {
  id: number;
  type: CompType;
  col: number;
  row: number;
  load: number;          // current req/s flowing into it
  heat: number;          // 0..100; reaching 100 = crash
  crashed: boolean;
  totalProcessed: number;
}

interface Connection {
  id: number;
  from: number;          // PlacedComponent.id
  to: number;            // PlacedComponent.id
}

type Tool = "select" | "place" | "connect" | "sell";

interface SystemArchitectProps {
  onComplete: (score: number) => void;
  difficulty?: number;   // 0..1; harder = more starting traffic, faster ramp
}

// -----------------------------------------------------------------------------
// 3) MAIN COMPONENT
// -----------------------------------------------------------------------------
export default function SystemArchitect({ onComplete, difficulty = 0 }: SystemArchitectProps) {
  // Difficulty knobs — clamp 0..1 then scale baselines.
  const _d = Math.max(0, Math.min(1, difficulty));
  const startTraffic = STARTING_TRAFFIC + Math.round(_d * 12);
  const startBudget  = STARTING_BUDGET  - Math.round(_d * 60);

  // Game state
  const [components, setComponents] = useState<PlacedComponent[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [budget, setBudget]   = useState(startBudget);
  const [traffic, setTraffic] = useState(startTraffic);
  const [time, setTime]       = useState(0);
  const [reqsProcessed, setReqsProcessed] = useState(0);
  const [moneyEarned, setMoneyEarned]     = useState(0);
  const [paused, setPaused]   = useState(false);
  const [stage, setStage]     = useState<"playing" | "done">("playing");
  const [showHow, setShowHow] = useState(true);
  const [crashEvents, setCrashEvents] = useState<{ id: number; label: string; trigger: number }[]>([]);
  const [floatTexts, setFloatTexts]   = useState<{ id: number; col: number; row: number; text: string; color: string }[]>([]);

  // Tool state — what the player is currently doing
  const [tool, setTool] = useState<Tool>("select");
  const [placeType, setPlaceType] = useState<CompType | null>(null);
  const [connectFrom, setConnectFrom] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<{ col: number; row: number } | null>(null);

  // ID generator (mutable across renders)
  const nextIdRef = useRef(1);
  const nextId = () => ++nextIdRef.current;

  // Refs for the rAF simulation loop — let it read latest state without
  // re-binding when state changes.
  const componentsRef  = useRef<PlacedComponent[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const trafficRef     = useRef(startTraffic);
  const budgetRef      = useRef(startBudget);
  const reqsRef        = useRef(0);
  const moneyRef       = useRef(0);
  const timeRef        = useRef(0);
  const rampAccRef     = useRef(0);
  const lastTickRef    = useRef<number | null>(null);

  useEffect(() => { componentsRef.current  = components;  }, [components]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
  useEffect(() => { trafficRef.current     = traffic;     }, [traffic]);
  useEffect(() => { budgetRef.current      = budget;      }, [budget]);

  // -------------------------------------------------------------------------
  // 4) INITIALIZE — drop the Internet pre-placed in the leftmost column.
  // -------------------------------------------------------------------------
  useEffect(() => {
    setComponents([{
      id: nextId(),
      type: "internet",
      col: 0,
      row: Math.floor(GRID_ROWS / 2),
      load: 0,
      heat: 0,
      crashed: false,
      totalProcessed: 0,
    }]);
  }, []);

  // -------------------------------------------------------------------------
  // 5) SIMULATION TICK — runs while playing & not paused.
  //
  // Algorithm per tick (dt in seconds):
  //   a) Reset every component's `load` to 0.
  //   b) Inject `traffic` req/s into the Internet node.
  //   c) BFS along connections; for each node distribute its outgoing
  //      throughput equally across its connections.
  //   d) Each component (except internet/lb): if load > capacity → heat
  //      rises proportionally; otherwise heat decays. Crashing flags the
  //      component dead (it stops processing or forwarding).
  //   e) DBs that processed traffic generate income.
  //   f) Game-over: no Internet→DB path through alive components.
  // -------------------------------------------------------------------------
  const simulate = useCallback((dt: number) => {
    const comps = componentsRef.current.map(c => ({ ...c, load: 0 }));
    const byId  = new Map<number, PlacedComponent>(comps.map(c => [c.id, c]));
    const conns = connectionsRef.current;
    const outAdj = new Map<number, Connection[]>();
    for (const c of conns) {
      if (!outAdj.has(c.from)) outAdj.set(c.from, []);
      outAdj.get(c.from)!.push(c);
    }

    // (b) Seed the Internet with traffic.
    const internet = comps.find(c => c.type === "internet");
    if (!internet) return;
    internet.load = trafficRef.current;

    // (c) BFS-style flow propagation. We enqueue each node once; cycles in
    // user wiring are ignored (each node pushes downstream once with the
    // load it has accumulated when popped).
    const queued = new Set<number>([internet.id]);
    const queue: PlacedComponent[]   = [internet];
    while (queue.length) {
      const node = queue.shift()!;
      if (node.crashed) continue;
      const out = outAdj.get(node.id) || [];
      if (out.length === 0) continue;

      // Throughput a node forwards downstream.
      const spec = SPECS[node.type];
      let through = node.load;
      // Capacity-bound nodes (server, firewall, db) only forward what they
      // can actually handle. LB / internet forward everything.
      if (node.type !== "internet" && node.type !== "lb") {
        through = Math.min(node.load, spec.capacity);
      }
      const aliveOut = out.filter(c => {
        const tgt = byId.get(c.to);
        return tgt && !tgt.crashed;
      });
      if (aliveOut.length === 0) continue;
      const perChild = through / aliveOut.length;

      for (const conn of aliveOut) {
        const tgt = byId.get(conn.to)!;
        tgt.load += perChild;
        if (!queued.has(tgt.id)) {
          queued.add(tgt.id);
          queue.push(tgt);
        }
      }
    }

    // (d) + (e) Heat update + income.
    let earnedNow = 0;
    let processedNow = 0;
    let newCrashes: { id: number; label: string }[] = [];
    for (const c of comps) {
      if (c.crashed || c.type === "internet" || c.type === "lb") continue;
      const cap = SPECS[c.type].capacity;
      if (c.load > cap) {
        c.heat = Math.min(100, c.heat + (c.load - cap) * HEAT_RISE * dt);
        if (c.heat >= 100) {
          c.crashed = true;
          newCrashes.push({ id: c.id, label: SPECS[c.type].label });
        }
      } else {
        c.heat = Math.max(0, c.heat - HEAT_DECAY * dt);
        if (c.type === "db") {
          const handled = c.load * dt;
          c.totalProcessed += handled;
          earnedNow   += handled * PROCESS_INCOME;
          processedNow += handled;
        }
      }
    }

    // (f) Game-over check: any path from internet → an alive db?
    let pathExists = false;
    {
      const seen = new Set<number>([internet.id]);
      const q: number[] = [internet.id];
      while (q.length) {
        const id = q.shift()!;
        const node = byId.get(id);
        if (!node || node.crashed) continue;
        if (node.type === "db") { pathExists = true; break; }
        for (const conn of outAdj.get(id) || []) {
          if (!seen.has(conn.to)) {
            seen.add(conn.to);
            q.push(conn.to);
          }
        }
      }
    }
    const anyDB = comps.some(c => c.type === "db");
    const gameOver = anyDB && !pathExists;

    // Commit state in a single batch.
    componentsRef.current = comps;
    setComponents(comps);

    if (earnedNow > 0) {
      moneyRef.current += earnedNow;
      setMoneyEarned(moneyRef.current);
      budgetRef.current += earnedNow;
      setBudget(budgetRef.current);
    }
    if (processedNow > 0) {
      reqsRef.current += processedNow;
      setReqsProcessed(reqsRef.current);
    }
    if (newCrashes.length) {
      setCrashEvents(ev => [
        ...ev,
        ...newCrashes.map(nc => ({ id: nc.id, label: nc.label, trigger: Date.now() + Math.random() })),
      ]);
    }

    // Time + traffic ramp
    timeRef.current += dt;
    setTime(timeRef.current);
    rampAccRef.current += dt;
    if (rampAccRef.current >= TRAFFIC_RAMP_DT) {
      rampAccRef.current = 0;
      trafficRef.current += TRAFFIC_RAMP;
      setTraffic(trafficRef.current);
      setFloatTexts(ft => [...ft, {
        id: Date.now(),
        col: 0,
        row: internet.row,
        text: `+${TRAFFIC_RAMP} TRAFFIC`,
        color: "#fbbf24",
      }]);
    }

    if (gameOver) setStage("done");
  }, []);

  // rAF-driven loop with fixed-step accumulator (deterministic-ish).
  useEffect(() => {
    if (stage !== "playing" || paused || showHow) {
      lastTickRef.current = null;
      return;
    }
    let raf = 0;
    const step = (now: number) => {
      if (lastTickRef.current === null) lastTickRef.current = now;
      const dt = Math.min(0.1, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;
      simulate(dt);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [stage, paused, showHow, simulate]);

  // Auto-clear floating texts after a moment.
  useEffect(() => {
    if (floatTexts.length === 0) return;
    const t = setTimeout(() => setFloatTexts(ft => ft.slice(1)), 900);
    return () => clearTimeout(t);
  }, [floatTexts.length]);
  // Auto-clear crash event banners.
  useEffect(() => {
    if (crashEvents.length === 0) return;
    const t = setTimeout(() => setCrashEvents(ev => ev.slice(1)), 1800);
    return () => clearTimeout(t);
  }, [crashEvents.length]);

  // -------------------------------------------------------------------------
  // 6) PLAYER ACTIONS
  // -------------------------------------------------------------------------
  function pickShopItem(t: CompType) {
    if (stage !== "playing") return;
    setTool("place");
    setPlaceType(t);
    setConnectFrom(null);
  }

  function startConnect() {
    if (stage !== "playing") return;
    setTool("connect");
    setPlaceType(null);
    setConnectFrom(null);
  }

  function startSell() {
    if (stage !== "playing") return;
    setTool("sell");
    setPlaceType(null);
    setConnectFrom(null);
  }

  function clearTool() {
    setTool("select");
    setPlaceType(null);
    setConnectFrom(null);
  }

  // Click on a grid cell while in PLACE mode → buy & drop.
  // Reads from refs (not state) so a click that lands between simulation
  // ticks always sees the freshest budget / component layout.
  function onCellClick(col: number, row: number) {
    if (stage !== "playing") return;
    if (tool !== "place" || !placeType) return;
    const spec = SPECS[placeType];
    if (budgetRef.current < spec.cost) return;
    if (componentsRef.current.some(c => c.col === col && c.row === row)) return;
    const id = nextId();
    const nc: PlacedComponent = {
      id, type: placeType, col, row, load: 0, heat: 0, crashed: false, totalProcessed: 0,
    };
    budgetRef.current = budgetRef.current - spec.cost;
    setBudget(budgetRef.current);
    componentsRef.current = [...componentsRef.current, nc];
    setComponents(componentsRef.current);
    setFloatTexts(ft => [...ft, { id: Date.now(), col, row, text: `-$${spec.cost}`, color: "#fb7185" }]);
    // Stay in place mode for rapid placement; player presses Esc / select to exit.
  }

  // Click on a placed component.
  function onComponentClick(c: PlacedComponent) {
    if (stage !== "playing") return;
    if (tool === "sell") {
      if (c.type === "internet") return;        // can't sell the source
      const refund = Math.round(SPECS[c.type].cost * SELL_REFUND);
      budgetRef.current = budgetRef.current + refund;
      setBudget(budgetRef.current);
      componentsRef.current = componentsRef.current.filter(x => x.id !== c.id);
      setComponents(componentsRef.current);
      connectionsRef.current = connectionsRef.current.filter(x => x.from !== c.id && x.to !== c.id);
      setConnections(connectionsRef.current);
      setFloatTexts(ft => [...ft, { id: Date.now(), col: c.col, row: c.row, text: `+$${refund}`, color: "#34d399" }]);
      return;
    }
    if (tool === "connect") {
      if (connectFrom === null) {
        setConnectFrom(c.id);
      } else if (connectFrom === c.id) {
        setConnectFrom(null);
      } else {
        // Already exists? (read from ref to avoid duplicate insertion races)
        if (!connectionsRef.current.some(co => co.from === connectFrom && co.to === c.id)) {
          const conn: Connection = { id: nextId(), from: connectFrom, to: c.id };
          connectionsRef.current = [...connectionsRef.current, conn];
          setConnections(connectionsRef.current);
        }
        setConnectFrom(null);
      }
      return;
    }
  }

  // Esc cancels the current tool.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearTool();
      if (e.key === " ") { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // -------------------------------------------------------------------------
  // 7) DERIVED VIEW DATA
  // -------------------------------------------------------------------------
  const score = useMemo(() => {
    return Math.round(time * 5 + reqsProcessed * 0.4 + moneyEarned * 0.5);
  }, [time, reqsProcessed, moneyEarned]);

  // Aggregate health = avg (100 - heat) across alive non-internet components.
  const health = useMemo(() => {
    const live = components.filter(c => !c.crashed && c.type !== "internet");
    if (live.length === 0) return 100;
    const avg = live.reduce((a, c) => a + (100 - c.heat), 0) / live.length;
    return Math.max(0, Math.min(100, Math.round(avg)));
  }, [components]);

  // Convert grid coords → board pixel coords (cell center).
  const cellX = (col: number) => col * CELL + CELL / 2;
  const cellY = (row: number) => row * CELL + CELL / 2;

  const boardW = GRID_COLS * CELL;
  const boardH = GRID_ROWS * CELL;

  // -------------------------------------------------------------------------
  // 8) RENDER
  // -------------------------------------------------------------------------
  return (
    <div className="w-full max-w-4xl select-none" data-testid="system-architect">
      {/* ---- TOP HUD ---- */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-base font-mono bg-emerald-500/15 border-emerald-400/40 text-emerald-200" data-testid="hud-budget">
            💰 ${Math.floor(budget)}
          </Badge>
          <Badge variant="outline" className="text-base font-mono bg-amber-500/15 border-amber-400/40 text-amber-200" data-testid="hud-traffic">
            <Activity className="w-3.5 h-3.5 mr-1" />{Math.round(traffic)} r/s
          </Badge>
          <Badge variant="outline" className={`text-base font-mono border-2 ${health > 60 ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200" : health > 30 ? "bg-amber-500/15 border-amber-400/40 text-amber-200" : "bg-rose-500/20 border-rose-400/60 text-rose-200 animate-pulse"}`} data-testid="hud-health">
            <Heart className="w-3.5 h-3.5 mr-1" />{health}%
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono bg-black/40">⏱ {Math.floor(time)}s</Badge>
          <Badge variant="outline" className="font-mono bg-violet-500/15 border-violet-400/40 text-violet-200" data-testid="hud-score">⭐ {score}</Badge>
          <Button size="sm" variant="outline" onClick={() => setPaused(p => !p)} data-testid="button-pause">
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* ---- MAIN ROW: SHOP + WORKSPACE ---- */}
      <div className="flex gap-3">
        {/* SIDEBAR SHOP */}
        <div className="w-40 shrink-0 flex flex-col gap-2" data-testid="sidebar-shop">
          <div className="text-[10px] font-mono text-muted-foreground tracking-widest mb-0.5">SHOP</div>
          {SHOP_ORDER.map(t => {
            const s = SPECS[t];
            const affordable = budget >= s.cost;
            const selected = tool === "place" && placeType === t;
            return (
              <button
                key={t}
                onClick={() => pickShopItem(t)}
                disabled={!affordable}
                className={`text-left px-2 py-2 rounded-lg border-2 transition-all backdrop-blur ${
                  selected
                    ? `${s.ring} bg-violet-500/30 shadow-[0_0_18px_rgba(139,92,246,0.5)] scale-[1.02]`
                    : affordable
                      ? `${s.ring} bg-card/60 hover:bg-card/90 hover:scale-[1.02]`
                      : "border-muted/30 bg-card/30 opacity-50 cursor-not-allowed"
                }`}
                data-testid={`shop-${t}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{s.emoji}</span>
                  <span className="text-[10px] font-mono text-emerald-300">${s.cost}</span>
                </div>
                <div className={`text-[11px] font-bold ${s.color}`}>{s.label}</div>
                <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                  cap {s.capacity === 999 ? "∞" : s.capacity} r/s
                </div>
              </button>
            );
          })}

          <div className="text-[10px] font-mono text-muted-foreground tracking-widest mt-1 mb-0.5">TOOLS</div>
          <button
            onClick={startConnect}
            className={`px-2 py-1.5 rounded-lg border-2 text-[11px] font-bold transition-all ${
              tool === "connect"
                ? "border-cyan-300 bg-cyan-500/30 text-cyan-100 shadow-[0_0_18px_rgba(6,182,212,0.5)]"
                : "border-cyan-400/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20"
            }`}
            data-testid="tool-connect"
          >
            <Cable className="w-3 h-3 inline mr-1" />Wire
          </button>
          <button
            onClick={startSell}
            className={`px-2 py-1.5 rounded-lg border-2 text-[11px] font-bold transition-all ${
              tool === "sell"
                ? "border-rose-300 bg-rose-500/30 text-rose-100 shadow-[0_0_18px_rgba(244,63,94,0.5)]"
                : "border-rose-400/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
            }`}
            data-testid="tool-sell"
          >
            <Trash2 className="w-3 h-3 inline mr-1" />Sell 50%
          </button>
          <button
            onClick={clearTool}
            className={`px-2 py-1.5 rounded-lg border-2 text-[11px] font-bold transition-all ${
              tool === "select"
                ? "border-violet-300 bg-violet-500/30 text-violet-100"
                : "border-muted/40 bg-muted/10 text-muted-foreground hover:bg-muted/20"
            }`}
            data-testid="tool-select"
          >
            <MousePointer2 className="w-3 h-3 inline mr-1" />Select
          </button>

          <div className="text-[9px] text-muted-foreground mt-1 leading-tight px-1">
            {tool === "place"  && placeType && <>Click a grid cell to drop <b className={SPECS[placeType].color}>{SPECS[placeType].label}</b>.</>}
            {tool === "connect" && (connectFrom === null ? <>Click the SOURCE component, then the TARGET.</> : <>Now click the TARGET component.</>)}
            {tool === "sell"   && <>Click any placed component to refund 50%.</>}
            {tool === "select" && <>Pick something from the shop or a tool.</>}
          </div>
        </div>

        {/* WORKSPACE GRID */}
        <div className="relative rounded-xl border-2 border-violet-500/30 bg-gradient-to-br from-[#0a0420] via-[#0e0830] to-[#04020f] overflow-hidden" style={{ width: boardW, height: boardH }} data-testid="workspace">
          {/* Grid cells (placement targets) */}
          {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
            const col = idx % GRID_COLS;
            const row = Math.floor(idx / GRID_COLS);
            const occupied = components.some(c => c.col === col && c.row === row);
            const placeable = tool === "place" && placeType && !occupied && budget >= SPECS[placeType].cost;
            const hovering  = hoverCell?.col === col && hoverCell?.row === row;
            return (
              <div
                key={idx}
                onClick={() => onCellClick(col, row)}
                onMouseEnter={() => setHoverCell({ col, row })}
                onMouseLeave={() => setHoverCell(h => (h?.col === col && h?.row === row ? null : h))}
                className={`absolute border border-white/5 ${
                  placeable
                    ? hovering ? "bg-violet-500/30 cursor-pointer" : "bg-violet-500/10 cursor-pointer"
                    : occupied || tool !== "place" ? "" : "cursor-not-allowed"
                }`}
                style={{ left: col * CELL, top: row * CELL, width: CELL, height: CELL }}
                data-testid={`cell-${col}-${row}`}
              />
            );
          })}

          {/* SVG layer for connection wires (drawn UNDER components) */}
          <svg className="absolute inset-0 pointer-events-none" width={boardW} height={boardH}>
            <defs>
              <marker id="arrow-cyan" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" />
              </marker>
              <marker id="arrow-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#fbbf24" />
              </marker>
            </defs>
            {connections.map(conn => {
              const a = components.find(c => c.id === conn.from);
              const b = components.find(c => c.id === conn.to);
              if (!a || !b) return null;
              const isHot = (a.load > SPECS[a.type].capacity && a.type !== "internet" && a.type !== "lb") || a.crashed;
              const stroke = isHot ? "#fbbf24" : "#22d3ee";
              const marker = isHot ? "url(#arrow-amber)" : "url(#arrow-cyan)";
              return (
                <g key={conn.id}>
                  <line
                    x1={cellX(a.col)} y1={cellY(a.row)}
                    x2={cellX(b.col)} y2={cellY(b.row)}
                    stroke={stroke}
                    strokeWidth={a.crashed ? 1 : 2}
                    strokeDasharray={a.crashed ? "4 4" : "0"}
                    opacity={a.crashed ? 0.3 : 0.85}
                    markerEnd={marker}
                  />
                  {/* Animated traffic dots when there's flow */}
                  {!a.crashed && a.load > 0.5 && (
                    <circle r="3" fill={stroke}>
                      <animateMotion
                        dur={`${Math.max(0.5, 2 - Math.log10(a.load + 1))}s`}
                        repeatCount="indefinite"
                        path={`M ${cellX(a.col)} ${cellY(a.row)} L ${cellX(b.col)} ${cellY(b.row)}`}
                      />
                    </circle>
                  )}
                </g>
              );
            })}
            {/* Preview wire when connecting */}
            {tool === "connect" && connectFrom !== null && hoverCell && (() => {
              const a = components.find(c => c.id === connectFrom);
              if (!a) return null;
              return (
                <line
                  x1={cellX(a.col)} y1={cellY(a.row)}
                  x2={cellX(hoverCell.col)} y2={cellY(hoverCell.row)}
                  stroke="#a78bfa"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  opacity={0.6}
                />
              );
            })()}
          </svg>

          {/* Components */}
          {components.map(c => {
            const s = SPECS[c.type];
            const cap = s.capacity;
            const overload = !c.crashed && c.type !== "internet" && c.type !== "lb" && c.load > cap;
            const isConnectSrc = tool === "connect" && connectFrom === c.id;
            const ringClass = c.crashed
              ? "border-rose-500/80 grayscale"
              : isConnectSrc
                ? "border-violet-300 shadow-[0_0_22px_rgba(167,139,250,0.7)]"
                : overload
                  ? `${s.hot} shadow-[0_0_18px_rgba(244,63,94,0.6)]`
                  : `${s.ring}`;
            return (
              <button
                key={c.id}
                onClick={() => onComponentClick(c)}
                className={`absolute rounded-lg border-2 backdrop-blur transition-all bg-card/80 ${ringClass} ${
                  tool === "sell" && c.type !== "internet" ? "cursor-pointer hover:scale-105" :
                  tool === "connect" ? "cursor-pointer hover:scale-105" : "cursor-default"
                } flex flex-col items-center justify-center p-0.5`}
                style={{ left: c.col * CELL + 3, top: c.row * CELL + 3, width: CELL - 6, height: CELL - 6 }}
                data-testid={`comp-${c.type}-${c.id}`}
              >
                <div className="text-lg leading-none">{s.emoji}</div>
                <div className={`text-[8px] font-mono font-bold ${s.color} leading-none mt-0.5`}>{s.short}</div>
                {/* Heat bar */}
                {c.type !== "internet" && c.type !== "lb" && (
                  <div className="absolute bottom-0.5 left-0.5 right-0.5 h-1 rounded-full bg-black/60 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        c.crashed ? "bg-rose-500" : c.heat > 70 ? "bg-rose-400" : c.heat > 40 ? "bg-amber-400" : "bg-emerald-400"
                      }`}
                      style={{ width: `${c.heat}%` }}
                    />
                  </div>
                )}
                {/* Load number */}
                {c.load > 0.5 && !c.crashed && (
                  <div className="absolute -top-2 -right-1 text-[8px] font-mono bg-black/80 text-white px-1 rounded">
                    {Math.round(c.load)}
                  </div>
                )}
                {c.crashed && (
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">💥</div>
                )}
              </button>
            );
          })}

          {/* Floating texts (drops, refunds, traffic surges) */}
          <AnimatePresence>
            {floatTexts.map(ft => (
              <motion.div
                key={ft.id}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -28 }}
                transition={{ duration: 0.85 }}
                className="absolute pointer-events-none text-[11px] font-bold font-mono"
                style={{ left: ft.col * CELL + CELL / 2 - 16, top: ft.row * CELL + 8, color: ft.color, textShadow: "0 0 4px rgba(0,0,0,0.8)" }}
              >
                {ft.text}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Crash event banner */}
          <AnimatePresence>
            {crashEvents.length > 0 && (
              <motion.div
                key={crashEvents[0].id}
                initial={{ opacity: 0, y: -10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-1 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg border-2 border-rose-400 bg-rose-500/30 backdrop-blur text-rose-100 font-bold text-xs flex items-center gap-1 z-30"
              >
                <AlertTriangle className="w-3 h-3" /> {crashEvents[0].label} CRASHED!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pause overlay */}
          {paused && stage === "playing" && !showHow && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur">
              <div className="text-center">
                <Pause className="w-12 h-12 mx-auto text-violet-400 mb-2" />
                <p className="text-xl font-bold mb-3">Paused</p>
                <Button onClick={() => setPaused(false)} data-testid="button-resume">Resume</Button>
              </div>
            </div>
          )}

          {/* How-to overlay */}
          {showHow && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/95 backdrop-blur p-4 overflow-y-auto">
              <div className="max-w-md text-center">
                <Sparkles className="w-10 h-10 mx-auto text-amber-400 mb-2" />
                <h3 className="text-xl font-bold mb-2">System Architect</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Build a server infrastructure that survives a growing wave of user traffic.
                </p>
                <div className="text-xs text-left space-y-1.5 bg-card/50 rounded-lg p-3 border border-violet-500/30">
                  <div>1. <b className="text-emerald-300">🌐 Internet</b> is pre-placed and pumps traffic into the grid.</div>
                  <div>2. <b className="text-amber-300">🗄️ Buy a Database</b> from the shop and place it on the grid — that's the goal.</div>
                  <div>3. <b className="text-cyan-300">🖥️ Web Servers</b> handle 55 r/s each. <b className="text-violet-300">⚖️ Load Balancers</b> split traffic equally across multiple servers.</div>
                  <div>4. Use the <b className="text-cyan-300">Wire</b> tool to connect components: Internet → Firewall → LB → Servers → DB.</div>
                  <div>5. If a component's load exceeds capacity, it overheats. Hit 100% heat = 💥 crash.</div>
                  <div>6. Traffic ramps up every {TRAFFIC_RAMP_DT}s. Earn ${PROCESS_INCOME.toFixed(2)}/req at the DB. Scale up to survive!</div>
                  <div>7. <b>Game Over</b> when no living path from Internet to a Database remains.</div>
                </div>
                <Button className="mt-3" onClick={() => setShowHow(false)} data-testid="button-start">
                  Start Building <Zap className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Game over overlay */}
          {stage === "done" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur p-4"
            >
              <div className="text-center max-w-sm">
                <Trophy className="w-12 h-12 mx-auto text-amber-400 mb-2" />
                <h3 className="text-2xl font-bold mb-1">System Down</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Your infrastructure ran for {Math.floor(time)}s and processed {Math.round(reqsProcessed)} requests, earning ${Math.floor(moneyEarned)}.
                </p>
                <div className="font-mono text-3xl text-amber-300 mb-4" data-testid="final-score">⭐ {score}</div>
                <Button onClick={() => onComplete(score)} data-testid="button-finish">
                  Finish Run
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-2">
        Shop → click a component → click a grid cell to place. Wire → click source then target. Sell → click to refund 50%. Space = pause · Esc = cancel tool.
      </p>
    </div>
  );
}
