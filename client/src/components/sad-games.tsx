import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, Lightbulb, Sparkles, ArrowRight, Pause, Play,
  Heart, Database, Activity, Shield, Target, Timer, Zap, X,
  Trophy, Info,
} from "lucide-react";

// ============================================================
// META — describes each play-to-learn game (used by intro card)
// ============================================================

export interface SADGameMeta {
  type: string;
  title: string;
  short: string;
  detail: string;
  howTo: string;
  icon: any;
  color: string;
  gradient: string;
  emoji: string;
}

export const SAD_GAMES: Record<string, SADGameMeta> = {
  sdlc_sorter: {
    type: "sdlc_sorter",
    title: "Phase Runner",
    short: "The Software Development Life Cycle is the order of phases every software project goes through.",
    detail: "Most projects follow: Plan → Analyze → Design → Implement → Test → Maintain. Different methodologies (Waterfall, Iterative, Agile) reorder or repeat these phases.",
    howTo: "Each falling deliverable is tagged with a phase. Switch into the matching lane to catch it. Dodge the bugs!",
    icon: Zap,
    color: "text-violet-300",
    gradient: "from-violet-500 to-purple-700",
    emoji: "🏃",
  },
  req_sorter: {
    type: "req_sorter",
    title: "Spec Highway",
    short: "Requirements describe what a system must do — and how well it must do it.",
    detail: "Functional requirements describe WHAT the system does (login, search, purchase). Non-functional requirements describe HOW WELL it does it (speed, security, usability).",
    howTo: "Requirement cards race toward you down a neon highway. Slam each one into the matching bin — Functional left, Non-Functional right — before it hits.",
    icon: Target,
    color: "text-emerald-300",
    gradient: "from-emerald-500 to-teal-700",
    emoji: "🛣️",
  },
  usecase_builder: {
    type: "usecase_builder",
    title: "Use Case Defense",
    short: "Use Case Diagrams show what each ACTOR (a user or external system) can do with the system.",
    detail: "An actor is anyone outside the system that interacts with it. A use case is one task the actor can perform. Lines connect actors to the use cases they own.",
    howTo: "Each marching enemy is labeled with a use case. Pick the actor who owns it from the toolbar and tap the enemy to defeat it!",
    icon: Shield,
    color: "text-cyan-300",
    gradient: "from-cyan-500 to-blue-700",
    emoji: "🛡️",
  },
  erd_doctor: {
    type: "erd_doctor",
    title: "ER City Builder",
    short: "ER Diagrams show database entities (tables) and how they relate to each other.",
    detail: "Cardinality describes how many records on one side relate to how many on the other: 1:1 (one-to-one), 1:N (one-to-many), or N:N (many-to-many).",
    howTo: "Read the story between two entity buildings. Tap the road to choose the cardinality (1:1 / 1:N / N:N), then watch the traffic prove your answer.",
    icon: Database,
    color: "text-amber-300",
    gradient: "from-amber-500 to-orange-700",
    emoji: "🏗️",
  },
  dfd_detective: {
    type: "dfd_detective",
    title: "Data Flow Plumber",
    short: "A Data Flow Diagram shows how data moves through a system — between sources, processes, stores and sinks.",
    detail: "Arrows in a DFD always carry data. They flow from a source/store to a process, or from a process to a store/sink. Two stores never connect directly.",
    howTo: "One arrow is missing from the diagram. Tap the FROM node, then the TO node, to draw it. Two tries before the answer is revealed.",
    icon: Activity,
    color: "text-pink-300",
    gradient: "from-pink-500 to-rose-700",
    emoji: "🚰",
  },
  sequence_stacker: {
    type: "sequence_stacker",
    title: "Sequence Rhythm",
    short: "Sequence Diagrams show messages between objects in time order — top to bottom.",
    detail: "Each vertical line is an object. Horizontal arrows are messages between them. Time flows downward, so the earliest message is at the top.",
    howTo: "Each message falls toward an actor's lane. Hit the lane key (Q / W / E / R) or tap the lane just as the note crosses the line for combo.",
    icon: Timer,
    color: "text-indigo-300",
    gradient: "from-indigo-500 to-blue-700",
    emoji: "🎵",
  },
};

export function isSADGame(type: string) {
  return type in SAD_GAMES;
}

interface SADGameProps {
  questions: any[];
  onComplete: (score: number) => void;
  /** 0..1 difficulty ramp. 0 = baseline (Stage 1), 1 = max (final stage). */
  difficulty?: number;
  /** 0-based stage index inside the parent level (for HUD labelling). */
  stageIndex?: number;
  /** Total stages in the parent level. */
  totalStages?: number;
}

// ============================================================
// SHARED — hooks
// ============================================================

/**
 * Single rAF loop with stable callback ref. Restarts only when `active` toggles,
 * not when the callback or its closures change.
 */
function useGameLoop(callback: (dtSec: number) => void, active: boolean) {
  const cbRef = useRef(callback);
  useEffect(() => { cbRef.current = callback; }, [callback]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // clamp to avoid huge dt on tab switch
      last = now;
      cbRef.current(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}

/** First-time how-to dismissal, persisted to localStorage per game type. */
function useHowTo(key: string): [boolean, () => void] {
  const storageKey = `eduquest_howto_${key}`;
  const [seen, setSeen] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(storageKey) === "1"; }
    catch { return false; }
  });
  const dismiss = useCallback(() => {
    try { localStorage.setItem(storageKey, "1"); } catch {}
    setSeen(true);
  }, [storageKey]);
  return [seen, dismiss];
}

function usePause(enabled: boolean) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPaused(p => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
  return [paused, setPaused] as const;
}

// ============================================================
// SHARED — UI components
// ============================================================

function HowToOverlay({
  meta, goal, controls, onStart,
}: {
  meta: SADGameMeta;
  goal: string;
  controls: string[];
  onStart: () => void;
}) {
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 backdrop-blur-sm rounded-xl"
      data-testid="overlay-howto"
    >
      <div className="max-w-sm w-[88%] glass-strong border border-border/40 rounded-2xl p-5">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center mb-3`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <p className="text-xs font-mono text-muted-foreground mb-1">HOW TO PLAY</p>
        <h3 className="text-lg font-bold mb-2">{meta.title}</h3>
        <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{goal}</p>
        <div className="space-y-1.5 mb-4">
          {controls.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-primary mt-0.5">▸</span>
              <span className="text-foreground/80">{c}</span>
            </div>
          ))}
        </div>
        <Button className="w-full" onClick={onStart} data-testid="button-start-game">
          Got it — let's play <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}

function PauseOverlay({ onResume, onSkip }: { onResume: () => void; onSkip?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur rounded-xl"
      data-testid="overlay-paused"
    >
      <div className="text-center">
        <Pause className="w-12 h-12 mx-auto text-primary mb-3" />
        <p className="text-lg font-bold mb-4">Paused</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={onResume} data-testid="button-resume">
            <Play className="w-4 h-4 mr-1" /> Resume
          </Button>
          {onSkip && (
            <Button variant="outline" onClick={onSkip} data-testid="button-skip-round">
              Skip round
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 font-mono">Press Esc to resume</p>
      </div>
    </motion.div>
  );
}

function RoundHeader({
  index, total, label, onPause,
}: {
  index: number; total: number; label: string; onPause?: () => void;
}) {
  return (
    <div className="w-full mb-3">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-xs font-mono tracking-widest text-muted-foreground">
          ROUND {index + 1} / {total}
        </span>
        <span className="text-xs font-mono text-muted-foreground truncate flex-1 text-center">{label}</span>
        {onPause && (
          <button
            onClick={onPause}
            aria-label="Pause"
            className="w-7 h-7 rounded-md border border-border/40 bg-card/40 flex items-center justify-center hover:bg-card/80 transition"
            data-testid="button-pause"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <Progress value={(index / total) * 100} className="h-1.5" />
    </div>
  );
}

function RoundSummary({
  correct, headline, explanation, scoreDelta, onNext, isLast,
}: {
  correct: boolean;
  headline?: string;
  explanation: string;
  scoreDelta: number;
  onNext: () => void;
  isLast: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-4 rounded-xl border p-4 ${
        correct ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30"
      }`}
      data-testid="card-round-summary"
    >
      <div className="flex items-start gap-3">
        {correct
          ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          : <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />}
        <div className="flex-1">
          <p className={`text-sm font-semibold mb-1 ${correct ? "text-emerald-300" : "text-amber-300"}`}>
            {headline || (correct ? "Spot on!" : "Close — here's the trick:")}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
          {scoreDelta > 0 && (
            <p className="text-xs text-amber-300 mt-1.5 font-mono">+{scoreDelta} pts</p>
          )}
        </div>
      </div>
      <Button size="sm" className="w-full mt-3 min-h-11" onClick={onNext} data-testid="button-next-round">
        {isLast ? "Finish" : "Next round"} <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </motion.div>
  );
}

/** Tiny particle burst for correct hits. Renders a few divs that fly outward and fade. */
function JuiceBurst({ x, y, color = "#34d399", trigger }: { x: number; y: number; color?: string; trigger: number }) {
  const particles = useMemo(
    () => Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      angle: (i / 8) * Math.PI * 2,
      dist: 18 + Math.random() * 12,
    })),
    [trigger]
  );
  if (trigger === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30" key={trigger}>
      {particles.map(p => (
        <motion.div
          key={`${trigger}-${p.id}`}
          initial={{ x, y, opacity: 1, scale: 1 }}
          animate={{
            x: x + Math.cos(p.angle) * p.dist,
            y: y + Math.sin(p.angle) * p.dist,
            opacity: 0,
            scale: 0.5,
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color, top: 0, left: 0 }}
        />
      ))}
    </div>
  );
}

function ScreenShake({ trigger, children }: { trigger: number; children: React.ReactNode }) {
  return (
    <motion.div
      animate={trigger > 0 ? { x: [0, -4, 4, -3, 3, 0] } : {}}
      transition={{ duration: 0.3 }}
      key={trigger}
    >
      {children}
    </motion.div>
  );
}

// ============================================================
// 1. PHASE RUNNER — lane runner; deliverables tagged by phase
// ============================================================

const LANE_HEIGHT_PX = 56;

interface PRObject {
  id: number;
  lane: number;
  type: "deliverable" | "bug";
  x: number; // 0-100 (% of width)
  phaseLabel?: string;
}

function PhaseRunner({ questions, onComplete, difficulty = 0 }: SADGameProps) {
  const totalRounds = questions.length || 1;
  const meta = SAD_GAMES.sdlc_sorter;
  const [howSeen, dismissHow] = useHowTo("sdlc_sorter");
  const [showHowOverlay, setShowHowOverlay] = useState(!howSeen);

  // Difficulty-scaled knobs (component remounts per stage so these stay constant per game).
  const _d = Math.max(0, Math.min(1, difficulty));
  const ROUND_DURATION_SEC = Math.round(48 - _d * 14); // 48 → 34s
  const SPAWN_EVERY_SEC = 0.85 - _d * 0.40;            // 0.85 → 0.45s
  const OBJECT_SPEED = 32 + _d * 22;                   // 32 → 54 %/s
  // Bumped to 5 because missing a deliverable now also costs a heart (was bug-only).
  const PR_HEARTS = Math.max(2, 5 - Math.floor(_d * 2)); // 5, 5, 4, 3

  const [round, setRound] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as { phases?: string[]; explanation?: string; methodology?: string };
  // Bind to q.answer (pipe-joined canonical order) — falls back to options.phases or defaults.
  const phases = useMemo<string[]>(() => {
    if (typeof q.answer === "string" && q.answer.includes("|")) {
      const fromAnswer: string[] = q.answer.split("|").map((s: string) => s.trim()).filter((s: string) => Boolean(s));
      if (fromAnswer.length > 0) return fromAnswer.slice(0, 6);
    }
    const p: string[] = opts.phases && opts.phases.length > 0 ? opts.phases : ["Plan", "Build", "Test", "Ship"];
    return p.slice(0, 6);
  }, [q.answer, opts.phases]);
  const laneCount = phases.length;

  const [lane, setLane] = useState(0);
  const [objects, setObjects] = useState<PRObject[]>([]);
  const [hearts, setHearts] = useState(PR_HEARTS);
  const [collected, setCollected] = useState(0);
  const [missed, setMissed] = useState(0);
  const [target, setTarget] = useState(0); // total deliverables expected
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION_SEC);
  const [roundOver, setRoundOver] = useState(false);
  const [paused, setPaused] = usePause(!showHowOverlay && !roundOver);

  // Juice
  const [burst, setBurst] = useState({ x: 0, y: 0, color: "#34d399", trigger: 0 });
  const [shake, setShake] = useState(0);

  // Refs (shared across rAF without re-subscribing the loop)
  const laneRef = useRef(lane);
  useEffect(() => { laneRef.current = lane; }, [lane]);
  const heartsRef = useRef(hearts);
  useEffect(() => { heartsRef.current = hearts; }, [hearts]);
  // Authoritative copies kept in refs so the rAF tick can run as a pure
  // function with all setStates applied at top-level (no nested setState
  // inside updater functions).
  const objectsRef = useRef<PRObject[]>([]);
  const timeLeftRef = useRef(ROUND_DURATION_SEC);
  const nextId = useRef(1);
  const spawnAcc = useRef(0);

  const active = !showHowOverlay && !paused && !roundOver;

  // Reset on round change
  useEffect(() => {
    setLane(0);
    setObjects([]);
    setHearts(PR_HEARTS);
    setCollected(0);
    setMissed(0);
    setTarget(0);
    setTimeLeft(ROUND_DURATION_SEC);
    setRoundOver(false);
    objectsRef.current = [];
    timeLeftRef.current = ROUND_DURATION_SEC;
    spawnAcc.current = 0;
    nextId.current = 1;
  }, [round]);

  // Game loop — sweeps through phases in q.answer order, biases spawns toward current phase.
  // The tick is structured as a PURE computation that reads from refs and applies all
  // setStates at the top level, so no setState ever runs inside another updater function.
  useGameLoop((dt) => {
    // 1) Tick the timer (ref first, then setState).
    const newTime = Math.max(0, timeLeftRef.current - dt);
    const elapsedNow = ROUND_DURATION_SEC - newTime;
    const timeJustHitZero = newTime === 0 && timeLeftRef.current > 0;
    timeLeftRef.current = newTime;

    // 2) Decide whether to spawn this frame. (No more "current phase" sweep —
    //    that auto-telegraphed the answer. The deliverable's own phase label
    //    IS the question, and the player must read it and switch into the
    //    correct lane themselves.)
    spawnAcc.current += dt;
    let spawnedObj: PRObject | null = null;
    let targetDelta = 0;
    if (spawnAcc.current >= SPAWN_EVERY_SEC) {
      spawnAcc.current = 0;
      const isBug = Math.random() < 0.32;
      const id = nextId.current++;
      if (isBug) {
        const bugLane = Math.floor(Math.random() * laneCount);
        spawnedObj = { id, lane: bugLane, type: "bug", x: 102 };
      } else {
        // Uniformly random target phase — the player must READ the deliverable
        // label and choose the matching lane. No more sweep bias to cheese.
        const targetLane = Math.floor(Math.random() * laneCount);
        spawnedObj = { id, lane: targetLane, type: "deliverable", x: 102, phaseLabel: phases[targetLane] };
        targetDelta = 1;
      }
    }

    // 4) Move + collide — fold deltas into locals.
    const PLAYER_X = 12;
    const HIT_W = 7;
    const next: PRObject[] = [];
    let collectedDelta = 0;
    let missedDelta = 0;
    let heartLoss = 0;
    let burstY = 0;
    let burstFired = false;
    for (const o of objectsRef.current) {
      const nx = o.x - OBJECT_SPEED * dt;
      if (nx < -8) {
        // A deliverable that escapes left = missed. The user wants missing a
        // delivery to also cost a heart (parity with hitting a bug).
        if (o.type === "deliverable") {
          missedDelta++;
          heartLoss++;
        }
        continue;
      }
      const inHitX = nx > PLAYER_X - HIT_W && nx < PLAYER_X + HIT_W;
      if (inHitX && o.lane === laneRef.current) {
        if (o.type === "deliverable") {
          collectedDelta++;
          burstY = o.lane * LANE_HEIGHT_PX + LANE_HEIGHT_PX / 2;
          burstFired = true;
        } else {
          heartLoss++;
        }
        continue; // consumed
      }
      next.push({ ...o, x: nx });
    }
    if (spawnedObj) next.push(spawnedObj);
    objectsRef.current = next;

    // 5) Apply all setStates at the top level (none nested inside an updater).
    setTimeLeft(newTime);
    setObjects(next);
    if (targetDelta) setTarget(t => t + targetDelta);
    if (collectedDelta) setCollected(c => c + collectedDelta);
    if (missedDelta) setMissed(m => m + missedDelta);
    if (burstFired) setBurst({ x: 60, y: burstY, color: "#34d399", trigger: Date.now() });
    if (heartLoss) {
      const newHearts = Math.max(0, heartsRef.current - heartLoss);
      heartsRef.current = newHearts;
      setHearts(newHearts);
      setShake(Date.now());
      if (newHearts === 0) setRoundOver(true);
    }
    if (timeJustHitZero) {
      // Deliverables still on-screen at timer end shouldn't count as "missed"
      // — the player never had a fair chance to reach them. Subtract them
      // from the target so the win-ratio reflects only resolved deliveries.
      const stillFlying = next.filter(o => o.type === "deliverable").length;
      if (stillFlying > 0) setTarget(t => Math.max(0, t - stillFlying));
      setRoundOver(true);
    }
  }, active);

  // Controls
  const moveLane = useCallback((delta: number) => {
    if (!active) return;
    setLane(l => Math.max(0, Math.min(laneCount - 1, l + delta)));
  }, [active, laneCount]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { e.preventDefault(); moveLane(-1); }
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { e.preventDefault(); moveLane(1); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [moveLane]);

  // Round result — task spec requires ≥80% collection to win.
  const ratio = target > 0 ? collected / target : 0;
  const won = !roundOver
    ? false
    : hearts > 0 && ratio >= 0.8;
  const roundDelta = roundOver
    ? collected * 10 + (won ? 30 : 0) + hearts * 5
    : 0;

  function next() {
    const newTotal = totalScore + roundDelta;
    setTotalScore(newTotal);
    if (round + 1 >= totalRounds) {
      setDone(true);
      onComplete(newTotal);
    } else {
      setRound(r => r + 1);
    }
  }

  if (done) return null;

  const playHeight = laneCount * LANE_HEIGHT_PX;

  return (
    <div className="w-full max-w-xl select-none">
      <RoundHeader
        index={round}
        total={totalRounds}
        label={opts.methodology || "Phase Runner"}
        onPause={() => setPaused(p => !p)}
      />

      <ScreenShake trigger={shake}>
        <div
          className="glass-strong rounded-xl border border-border/40 overflow-hidden relative"
          style={{ height: playHeight + 20 }}
        >
          {/* HUD */}
          <div className="absolute top-2 left-2 right-2 z-20 flex justify-between items-center pointer-events-none flex-wrap gap-1">
            <Badge variant="outline" className="bg-background/70 backdrop-blur" data-testid="badge-hearts">
              {Array.from({ length: PR_HEARTS }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-3 h-3 ${i < hearts ? "text-rose-400 fill-rose-400" : "text-muted/40"} ${i > 0 ? "ml-0.5" : ""}`}
                />
              ))}
            </Badge>
            <Badge variant="outline" className="bg-background/70 backdrop-blur text-amber-300" data-testid="badge-progress">
              📦 {collected}/{target || "?"}
            </Badge>
            <Badge variant="outline" className="bg-background/70 backdrop-blur text-violet-300" data-testid="badge-timer">
              ⏱ {Math.ceil(timeLeft)}s
            </Badge>
          </div>

          {/* Lanes (clickable for tap-to-jump) — current target phase glows */}
          <div className="absolute inset-0 grid mt-9" style={{ gridTemplateRows: `repeat(${laneCount}, 1fr)` }}>
            {phases.map((phaseLabel, i) => {
              const isPlayerHere = lane === i;
              return (
                <button
                  key={i}
                  className={`relative border-b border-border/20 transition-all text-left ${
                    isPlayerHere ? "bg-violet-500/20" : "hover:bg-violet-500/5"
                  }`}
                  onClick={() => setLane(i)}
                  aria-label={`Switch to ${phaseLabel} lane`}
                  data-testid={`lane-${i}`}
                >
                  <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono pointer-events-none ${
                    isPlayerHere ? "text-violet-100 font-bold" : "text-muted-foreground/60"
                  }`}>
                    {phaseLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Speed lines */}
          <motion.div
            animate={{ backgroundPositionX: ["0%", "-100%"] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
            className="absolute inset-0 opacity-10 pointer-events-none mt-9"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(255,255,255,0.4) 30px, rgba(255,255,255,0.4) 31px)",
              backgroundSize: "120% 100%",
            }}
          />

          {/* Objects */}
          <AnimatePresence>
            {objects.map(o => (
              <motion.div
                key={o.id}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute z-10 flex items-center justify-center pointer-events-none"
                style={{
                  left: `${o.x}%`,
                  top: 36 + o.lane * LANE_HEIGHT_PX + LANE_HEIGHT_PX / 2 - 18,
                  width: 100,
                  marginLeft: -50,
                }}
              >
                {o.type === "deliverable" ? (
                  <div className="px-2 py-1 rounded-lg bg-emerald-500/30 border border-emerald-400/60 backdrop-blur flex items-center gap-1 shadow-[0_0_10px_rgba(52,211,153,0.4)]">
                    <span className="text-base">📦</span>
                    <span className="text-[10px] font-bold text-emerald-100 truncate max-w-20">{o.phaseLabel}</span>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded bg-rose-500/80 border-2 border-rose-300 flex items-center justify-center text-base shadow-[0_0_10px_rgba(244,63,94,0.6)]">
                    🐛
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Player */}
          <motion.div
            className="absolute z-10 pointer-events-none"
            animate={{ top: 36 + lane * LANE_HEIGHT_PX + LANE_HEIGHT_PX / 2 - 18 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            style={{ left: `8%`, width: 36, height: 36 }}
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-400 to-purple-600 shadow-[0_0_14px_rgba(139,92,246,0.7)] flex items-center justify-center text-lg">
              🏃
            </div>
          </motion.div>

          {/* Juice */}
          <JuiceBurst x={burst.x} y={burst.y + 28} color={burst.color} trigger={burst.trigger} />

          {/* Overlays */}
          {showHowOverlay && (
            <HowToOverlay
              meta={meta}
              goal={`${opts.methodology ? `Methodology: ${opts.methodology}. ` : ""}The team marches through the SDLC in order. Catch deliverables in the matching phase lane.`}
              controls={[
                "↑ / ↓ or W / S to switch lane (or tap a lane).",
                "READ each deliverable's phase label and switch to the matching lane to catch it.",
                "Lanes are arranged top-to-bottom in the canonical phase order.",
                `${PR_HEARTS} hearts. Bugs AND missed deliverables cost 1 each. Catch ≥ 80% to win. Esc to pause.`,
              ]}
              onStart={() => { dismissHow(); setShowHowOverlay(false); }}
            />
          )}
          {paused && !showHowOverlay && !roundOver && (
            <PauseOverlay
              onResume={() => setPaused(false)}
              onSkip={() => { setPaused(false); setRoundOver(true); }}
            />
          )}
          {roundOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur"
            >
              <div className="text-center">
                {won ? <Trophy className="w-12 h-12 mx-auto text-amber-400 mb-2" /> : <X className="w-12 h-12 mx-auto text-rose-400 mb-2" />}
                <p className="text-xl font-bold">{won ? "Wave cleared!" : hearts === 0 ? "Out of hearts" : "Time's up!"}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {collected} / {target} caught • +{roundDelta} pts
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </ScreenShake>

      {/* Mobile controls */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button variant="outline" className="min-h-12" onClick={() => moveLane(-1)} data-testid="button-lane-up">
          ⬆ Up
        </Button>
        <Button variant="outline" className="min-h-12" onClick={() => moveLane(1)} data-testid="button-lane-down">
          ⬇ Down
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-1">Arrow keys / W / S also work</p>

      {roundOver && (
        <RoundSummary
          correct={won}
          headline={won ? `Phase mastered (+${roundDelta} pts)` : `Try again (+${roundDelta} pts)`}
          explanation={opts.explanation || "Each deliverable belongs to a specific SDLC phase. Switch into the matching lane to catch it."}
          scoreDelta={roundDelta}
          onNext={next}
          isLast={round + 1 >= totalRounds}
        />
      )}
    </div>
  );
}

// ============================================================
// 2. SPEC HIGHWAY — 3D-perspective neon highway. Cards race toward
//    the camera; player slams each into the matching bin (←/→).
// ============================================================

// A single requirement card on the conveyor.
interface RHCard {
  uid: number;                                // unique per spawn
  qid: number;                                // index into questions[]
  content: string;
  answer: "functional" | "non_functional";
  explanation: string;
  y: number;                                  // 0 = top of board, BOARD_H = floor
  speed: number;                              // px/sec
  decided?: boolean;
  decidedSide?: "left" | "right";
  result?: "correct" | "wrong" | "missed";
  flyT?: number;                              // 0..1 fly-off animation progress after decision
  perfect?: boolean;                          // sorted in sweet zone
}

interface RHParticle {
  id: number;
  x: number;                                  // 0..1 fraction of board WIDTH (so it renders correctly inside the game container, not relative to window)
  y: number;                                  // px from board top
  vx: number;                                 // fraction of board width per sec
  vy: number;                                 // px per sec
  life: number;                               // sec remaining
  color: string;
  text?: string;
}

const RH_BOARD_H        = 480;                // total board height
const RH_FLOOR_Y        = 410;                // y at which an undecided card = miss
const RH_SWEET_TOP      = 320;                // sweet-spot starts here
const RH_SWEET_BOT      = 400;                // sweet-spot ends here (just above floor)
const RH_CARD_W         = 280;
const RH_CARD_H         = 88;
const RH_MAX_HEARTS     = 5;
const RH_WAVE_SIZE      = 8;                  // successful sorts per wave

function RequirementHighway({ questions, onComplete, difficulty = 0 }: SADGameProps) {
  const meta = SAD_GAMES.req_sorter;
  const [howSeen, dismissHow] = useHowTo("req_sorter");
  const [showHow, setShowHow] = useState(!howSeen);

  // Difficulty seeds the starting tempo; the wave system ramps it from there.
  const _d = Math.max(0, Math.min(1, difficulty));
  const startFallSec     = 6.5 - _d * 1.5;    // 6.5s → 5.0s top-to-floor
  const startSpawnGap    = 2.0 - _d * 0.4;    // 2.0s → 1.6s between cards

  // Wave state — every successful sort bumps progress; clear a wave to ramp tempo.
  const [wave, setWave] = useState(1);
  const [waveProgress, setWaveProgress] = useState(0);
  const [waveBanner, setWaveBanner] = useState<{ n: number; trigger: number } | null>(null);

  // Tempo derived from wave (gets faster every wave).
  const fallSec   = Math.max(2.6, startFallSec - (wave - 1) * 0.45);
  const spawnGap  = Math.max(0.85, startSpawnGap - (wave - 1) * 0.18);
  const fallSpeed = (RH_FLOOR_Y + RH_CARD_H) / fallSec;   // px/sec

  // Build a question pool (we'll cycle infinitely).
  const pool = useMemo(() => questions.map((q, i) => ({
    qid: i,
    content: q.content as string,
    answer: (q.answer === "functional" ? "functional" : "non_functional") as "functional" | "non_functional",
    explanation: ((q.options as any)?.explanation || "") as string,
  })), [questions]);

  // Game state
  const [cards, setCards]       = useState<RHCard[]>([]);
  const [score, setScore]       = useState(0);
  const [hearts, setHearts]     = useState(RH_MAX_HEARTS);
  const [combo, setCombo]       = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [sortedTotal, setSortedTotal] = useState(0);
  const [stage, setStage]       = useState<"playing" | "done">("playing");
  const [shake, setShake]       = useState(0);
  const [flash, setFlash]       = useState<{ side: "left" | "right" | null; ok: boolean; trigger: number }>({ side: null, ok: false, trigger: 0 });
  const [particles, setParticles] = useState<RHParticle[]>([]);
  const [paused, setPaused]     = usePause(stage === "playing" && !showHow);
  const [floatText, setFloatText] = useState<{ text: string; color: string; trigger: number } | null>(null);

  // Refs — driving the rAF loop without re-subscribing per render.
  const cardsRef     = useRef<RHCard[]>([]);
  const heartsRef    = useRef(RH_MAX_HEARTS);
  const comboRef     = useRef(0);
  const maxComboRef  = useRef(0);
  const sortedRef    = useRef(0);
  const waveRef      = useRef(1);
  const waveProgRef  = useRef(0);
  const spawnAccRef  = useRef(0);
  const spawnIdxRef  = useRef(0);                    // pulls from `pool` in order
  const uidRef       = useRef(0);
  const particlesRef = useRef<RHParticle[]>([]);
  const partIdRef    = useRef(0);

  useEffect(() => { cardsRef.current = cards; }, [cards]);
  useEffect(() => { heartsRef.current = hearts; }, [hearts]);
  useEffect(() => { waveRef.current = wave; }, [wave]);
  useEffect(() => { particlesRef.current = particles; }, [particles]);

  // Auto-clear bin flash so the highlighted side returns to idle.
  useEffect(() => {
    if (flash.side === null) return;
    const t = setTimeout(() => setFlash(f => ({ ...f, side: null })), 280);
    return () => clearTimeout(t);
  }, [flash.trigger, flash.side]);
  // Auto-clear wave banner.
  useEffect(() => {
    if (!waveBanner) return;
    const t = setTimeout(() => setWaveBanner(null), 1400);
    return () => clearTimeout(t);
  }, [waveBanner?.trigger]);
  // Auto-clear floating text.
  useEffect(() => {
    if (!floatText) return;
    const t = setTimeout(() => setFloatText(null), 700);
    return () => clearTimeout(t);
  }, [floatText?.trigger]);

  const loopActive = stage === "playing" && !showHow && !paused;

  // cx is a 0..1 fraction of board width; cy is px from board top.
  function spawnParticles(cx: number, cy: number, color: string, count: number, label?: string) {
    const additions: RHParticle[] = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 140;       // px/sec for y, scaled to fraction for x
      additions.push({
        id: ++partIdRef.current,
        x: cx,
        y: cy,
        vx: (Math.cos(a) * sp) / 540,            // approx board width → fraction/sec
        vy: Math.sin(a) * sp - 30,
        life: 0.6 + Math.random() * 0.3,
        color,
      });
    }
    if (label) {
      additions.push({
        id: ++partIdRef.current,
        x: cx,
        y: cy,
        vx: 0,
        vy: -40,
        life: 0.9,
        color,
        text: label,
      });
    }
    particlesRef.current = [...particlesRef.current, ...additions];
    setParticles(particlesRef.current);
  }

  useGameLoop((dt) => {
    // 1) Spawn next card
    spawnAccRef.current += dt;
    let toAdd: RHCard | null = null;
    if (spawnAccRef.current >= spawnGap && cardsRef.current.filter(c => !c.decided).length < 4) {
      spawnAccRef.current = 0;
      const p = pool[spawnIdxRef.current % pool.length];
      spawnIdxRef.current++;
      toAdd = {
        uid: ++uidRef.current,
        qid: p.qid,
        content: p.content,
        answer: p.answer,
        explanation: p.explanation,
        y: -RH_CARD_H,
        speed: fallSpeed * (0.92 + Math.random() * 0.18),  // slight per-card variation
      };
    }

    // 2) Advance every card
    let lostHeart = 0;
    const next: RHCard[] = [];
    for (const c of cardsRef.current) {
      if (c.decided) {
        // Animate fly-off then despawn after ~0.45s.
        const ft = (c.flyT || 0) + dt / 0.45;
        if (ft >= 1) continue;
        next.push({ ...c, flyT: ft });
      } else {
        const ny = c.y + c.speed * dt;
        if (ny >= RH_FLOOR_Y) {
          // Card hit the floor undecided = MISS.
          lostHeart++;
          spawnParticles(0.5, RH_FLOOR_Y - 20, "#f43f5e", 8, "MISSED");
          continue;
        }
        next.push({ ...c, y: ny });
      }
    }
    if (toAdd) next.push(toAdd);
    cardsRef.current = next;
    setCards(next);

    // 3) Particles physics
    if (particlesRef.current.length > 0) {
      const np: RHParticle[] = [];
      for (const p of particlesRef.current) {
        const nl = p.life - dt;
        if (nl <= 0) continue;
        np.push({
          ...p,
          x: p.x + p.vx * dt,
          y: p.y + p.vy * dt,
          vy: p.vy + 220 * dt,         // gravity
          life: nl,
        });
      }
      particlesRef.current = np;
      setParticles(np);
    }

    // 4) Apply heart loss from misses
    if (lostHeart > 0) {
      const newHearts = Math.max(0, heartsRef.current - lostHeart);
      heartsRef.current = newHearts;
      setHearts(newHearts);
      setShake(Date.now());
      comboRef.current = 0;
      setCombo(0);
      if (newHearts === 0) setStage("done");
    }
  }, loopActive);

  function decide(side: "left" | "right") {
    if (stage !== "playing") return;
    // Pick the lowest (closest-to-floor) un-decided card.
    const target = cardsRef.current
      .filter(c => !c.decided)
      .sort((a, b) => b.y - a.y)[0];
    if (!target) return;

    const wantSide = target.answer === "functional" ? "left" : "right";
    const ok = side === wantSide;
    const inSweet = target.y >= RH_SWEET_TOP && target.y <= RH_SWEET_BOT;

    if (ok) {
      const newCombo = comboRef.current + 1;
      const baseDelta = inSweet ? 30 : 15;
      const comboBonus = Math.floor(newCombo / 3) * 5;
      const delta = baseDelta + comboBonus;
      setScore(s => s + delta);
      comboRef.current = newCombo;
      setCombo(newCombo);
      if (newCombo > maxComboRef.current) {
        maxComboRef.current = newCombo;
        setMaxCombo(newCombo);
      }
      // Heart heal every 5-combo (capped at max).
      if (newCombo > 0 && newCombo % 5 === 0 && heartsRef.current < RH_MAX_HEARTS) {
        const nh = Math.min(RH_MAX_HEARTS, heartsRef.current + 1);
        heartsRef.current = nh;
        setHearts(nh);
        setFloatText({ text: "+1 ❤", color: "#fb7185", trigger: Date.now() });
      }

      // Bump wave progress; clear wave on threshold.
      const nextProg = waveProgRef.current + 1;
      if (nextProg >= RH_WAVE_SIZE) {
        waveProgRef.current = 0;
        const nextWave = waveRef.current + 1;
        waveRef.current = nextWave;
        setWave(nextWave);
        setWaveProgress(0);
        setWaveBanner({ n: nextWave, trigger: Date.now() });
        setScore(s => s + 50);                           // wave clear bonus
      } else {
        waveProgRef.current = nextProg;
        setWaveProgress(nextProg);
      }

      sortedRef.current += 1;
      setSortedTotal(sortedRef.current);

      // Particle burst on the bin (cx as a 0..1 fraction of board width).
      const cx = side === "left" ? 0.17 : 0.83;
      const cy = RH_FLOOR_Y - 30;
      spawnParticles(cx, cy, inSweet ? "#fbbf24" : "#34d399", inSweet ? 14 : 8,
        inSweet ? `PERFECT! +${delta}` : `+${delta}`);
    } else {
      const newHearts = Math.max(0, heartsRef.current - 1);
      heartsRef.current = newHearts;
      setHearts(newHearts);
      comboRef.current = 0;
      setCombo(0);
      setShake(Date.now());
      const cx = side === "left" ? 0.17 : 0.83;
      spawnParticles(cx, RH_FLOOR_Y - 30, "#f43f5e", 10, "WRONG!");
      if (newHearts === 0) setStage("done");
    }

    setFlash({ side, ok, trigger: Date.now() });
    // Mark the target as decided so the spawn loop animates it off.
    cardsRef.current = cardsRef.current.map(c =>
      c.uid === target.uid
        ? { ...c, decided: true, decidedSide: side, result: ok ? "correct" : "wrong", flyT: 0, perfect: ok && inSweet }
        : c
    );
    setCards(cardsRef.current);
  }

  // Stable handler ref — keydown listener doesn't churn.
  const decideRef = useRef(decide);
  useEffect(() => { decideRef.current = decide; });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault(); decideRef.current("left");
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault(); decideRef.current("right");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const won = false; // endless — we end when hearts = 0; a "win" framing isn't meaningful.

  return (
    <div className="w-full max-w-xl select-none">
      <RoundHeader
        index={0}
        total={1}
        label={`Spec Sort · Wave ${wave}`}
        onPause={() => setPaused(p => !p)}
      />

      <ScreenShake trigger={shake}>
        <div
          className="rounded-xl border border-violet-500/30 overflow-hidden relative bg-gradient-to-b from-[#0a0420] via-[#0e0830] to-[#04020f]"
          style={{ height: RH_BOARD_H }}
          data-testid="rh-stage"
        >
          {/* Animated parallax dots */}
          <div className="absolute inset-0 pointer-events-none opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(1px 1px at 25% 30%, rgba(255,255,255,0.6) 50%, transparent 51%), radial-gradient(1px 1px at 70% 20%, rgba(255,255,255,0.5) 50%, transparent 51%), radial-gradient(1px 1px at 80% 60%, rgba(168,85,247,0.7) 50%, transparent 51%), radial-gradient(1px 1px at 15% 75%, rgba(99,102,241,0.6) 50%, transparent 51%), radial-gradient(1px 1px at 50% 10%, rgba(255,255,255,0.4) 50%, transparent 51%)",
            }}
          />

          {/* Sweet-spot zone bands */}
          <div
            className="absolute left-0 right-0 pointer-events-none border-y border-amber-400/30 bg-amber-500/5"
            style={{ top: RH_SWEET_TOP, height: RH_SWEET_BOT - RH_SWEET_TOP }}
          >
            <div className="absolute right-2 top-1 text-[9px] font-mono text-amber-300/70 tracking-widest">SWEET ZONE · 2× POINTS</div>
          </div>
          {/* Floor line */}
          <div
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-rose-400/70 to-transparent pointer-events-none"
            style={{ top: RH_FLOOR_Y }}
          />

          {/* HUD */}
          <div className="absolute top-2 left-2 right-2 z-30 flex flex-wrap justify-between items-center gap-1 pointer-events-none">
            <Badge variant="outline" className="bg-black/60 backdrop-blur" data-testid="rh-hearts">
              {Array.from({ length: RH_MAX_HEARTS }).map((_, i) => (
                <Heart key={i} className={`w-3 h-3 ${i < hearts ? "text-rose-400 fill-rose-400" : "text-muted/30"} ${i > 0 ? "ml-0.5" : ""}`} />
              ))}
            </Badge>
            <Badge variant="outline" className="bg-violet-500/30 backdrop-blur text-violet-100 border-violet-400/60 font-mono text-[10px]" data-testid="rh-wave">
              WAVE {wave} · {waveProgress}/{RH_WAVE_SIZE}
            </Badge>
            {combo >= 3 && (
              <Badge variant="outline" className="bg-amber-500/30 backdrop-blur text-amber-100 border-amber-400/60 font-bold animate-pulse" data-testid="rh-combo">
                🔥 {combo}× COMBO
              </Badge>
            )}
            <Badge variant="outline" className="bg-black/60 backdrop-blur text-amber-300" data-testid="rh-score">
              ⭐ {score}
            </Badge>
          </div>

          {/* Bins */}
          <div className="absolute bottom-0 left-0 w-[34%] z-[8] pointer-events-none flex items-end justify-center pb-2">
            <div className={`w-full mx-1 px-2 py-2 rounded-lg border-2 backdrop-blur transition-all duration-200 ${
              flash.side === "left"
                ? flash.ok ? "border-emerald-300 bg-emerald-500/60 shadow-[0_0_36px_rgba(52,211,153,0.85)] scale-105"
                          : "border-rose-300 bg-rose-500/60 shadow-[0_0_36px_rgba(244,63,94,0.85)] scale-95"
                : "border-emerald-500/60 bg-emerald-500/15 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
            }`}>
              <div className="text-2xl text-center">⚙️</div>
              <div className="text-[11px] font-mono font-bold text-emerald-300 mt-0.5 text-center tracking-wider">FUNCTIONAL</div>
              <div className="text-[9px] text-emerald-200/70 mt-0.5 text-center">← / A · tap left</div>
            </div>
          </div>
          <div className="absolute bottom-0 right-0 w-[34%] z-[8] pointer-events-none flex items-end justify-center pb-2">
            <div className={`w-full mx-1 px-2 py-2 rounded-lg border-2 backdrop-blur transition-all duration-200 ${
              flash.side === "right"
                ? flash.ok ? "border-emerald-300 bg-emerald-500/60 shadow-[0_0_36px_rgba(52,211,153,0.85)] scale-105"
                          : "border-rose-300 bg-rose-500/60 shadow-[0_0_36px_rgba(244,63,94,0.85)] scale-95"
                : "border-amber-500/60 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.35)]"
            }`}>
              <div className="text-2xl text-center">📊</div>
              <div className="text-[11px] font-mono font-bold text-amber-300 mt-0.5 text-center tracking-wider">NON-FUNCTIONAL</div>
              <div className="text-[9px] text-amber-200/70 mt-0.5 text-center">→ / D · tap right</div>
            </div>
          </div>

          {/* Cards */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            {cards.map(c => {
              const inSweet = c.y >= RH_SWEET_TOP && c.y <= RH_SWEET_BOT && !c.decided;
              const isLowest = !c.decided && c.uid === [...cards].filter(x => !x.decided).sort((a, b) => b.y - a.y)[0]?.uid;
              // Decided cards fly off to their bin then up.
              const ft = c.flyT || 0;
              const xOffset = c.decided
                ? (c.decidedSide === "left" ? -1 : 1) * ft * 240
                : 0;
              const yOffset = c.decided ? -ft * 80 : 0;
              const opacity = c.decided ? Math.max(0, 1 - ft) : 1;
              const ring = c.result === "correct"
                ? c.perfect
                  ? "border-amber-300 shadow-[0_0_36px_rgba(251,191,36,0.85)]"
                  : "border-emerald-300 shadow-[0_0_28px_rgba(52,211,153,0.7)]"
                : c.result === "wrong"
                  ? "border-rose-300 shadow-[0_0_28px_rgba(244,63,94,0.7)]"
                  : inSweet
                    ? "border-amber-300 shadow-[0_0_22px_rgba(251,191,36,0.55)] animate-pulse"
                    : isLowest
                      ? "border-violet-300 shadow-[0_0_22px_rgba(139,92,246,0.55)]"
                      : "border-violet-500/50 shadow-[0_0_14px_rgba(139,92,246,0.35)]";
              return (
                <div
                  key={c.uid}
                  className="absolute left-1/2"
                  style={{
                    top: c.y + yOffset,
                    transform: `translate(calc(-50% + ${xOffset}px), 0) scale(${c.decided ? 1 - ft * 0.3 : 1})`,
                    width: RH_CARD_W,
                    opacity,
                  }}
                  data-testid={`rh-card-${c.uid}`}
                >
                  <div className={`rounded-xl border-2 px-3 py-2 bg-card/95 backdrop-blur transition-shadow ${ring}`} style={{ minHeight: RH_CARD_H }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span className="text-[9px] font-mono text-muted-foreground tracking-widest">REQ #{c.qid + 1}</span>
                      </div>
                      {isLowest && (
                        <span className="text-[8px] font-mono text-violet-300/80 tracking-wider">▶ NEXT</span>
                      )}
                    </div>
                    <p className="text-[13px] leading-snug text-foreground font-medium">{c.content}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Particles */}
          <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
            {particles.map(p => p.text ? (
              <div
                key={p.id}
                className="absolute font-bold text-xs whitespace-nowrap"
                style={{ left: `${p.x * 100}%`, top: p.y, color: p.color, opacity: Math.min(1, p.life * 1.4), transform: "translate(-50%, -50%)" }}
              >
                {p.text}
              </div>
            ) : (
              <div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  left: `${p.x * 100}%`, top: p.y,
                  width: 6, height: 6,
                  background: p.color,
                  opacity: Math.min(1, p.life * 1.4),
                  boxShadow: `0 0 8px ${p.color}`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))}
          </div>

          {/* Wave banner */}
          {waveBanner && (
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              className="absolute inset-0 z-25 flex items-center justify-center pointer-events-none"
            >
              <div className="px-6 py-3 rounded-xl border-2 border-amber-400 bg-amber-500/30 backdrop-blur">
                <div className="text-3xl font-bold text-amber-200 text-center">WAVE {waveBanner.n}!</div>
                <div className="text-xs font-mono text-amber-200/80 text-center mt-1">+50 BONUS · TEMPO RISING</div>
              </div>
            </motion.div>
          )}

          {/* Floating text (combo heals etc) */}
          {floatText && (
            <motion.div
              initial={{ y: 0, opacity: 1 }}
              animate={{ y: -40, opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute left-1/2 top-1/3 -translate-x-1/2 z-25 pointer-events-none font-bold text-lg"
              style={{ color: floatText.color }}
            >
              {floatText.text}
            </motion.div>
          )}

          {/* Tap hit-zones */}
          <button
            className="absolute inset-y-0 left-0 w-1/2 z-[20] bg-transparent active:bg-emerald-500/10 focus:outline-none"
            onClick={() => decide("left")}
            aria-label="Sort as Functional"
            data-testid="rh-tap-left"
          />
          <button
            className="absolute inset-y-0 right-0 w-1/2 z-[20] bg-transparent active:bg-amber-500/10 focus:outline-none"
            onClick={() => decide("right")}
            aria-label="Sort as Non-Functional"
            data-testid="rh-tap-right"
          />

          {/* Overlays */}
          {showHow && (
            <HowToOverlay
              meta={meta}
              goal="Requirements drop down a vertical conveyor. Sort each one into the matching bin BEFORE it hits the floor — Functional ⚙️ left, Non-Functional 📊 right. Survive as many waves as you can!"
              controls={[
                "← / A → Functional · → / D → Non-Functional",
                "Or tap the LEFT / RIGHT side of the screen.",
                "The card with the ▶ NEXT marker is the one that will be sorted.",
                "Cards in the SWEET ZONE (yellow band) are worth 2×.",
                `${RH_MAX_HEARTS} hearts. Wrong sort OR a card that hits the floor = -1 heart.`,
                "3-combo = +5 bonus per sort · 5-combo = +1 ❤ heal · clear a wave = +50 + faster tempo.",
              ]}
              onStart={() => { dismissHow(); setShowHow(false); }}
            />
          )}
          {paused && !showHow && stage === "playing" && (
            <PauseOverlay
              onResume={() => setPaused(false)}
              onSkip={() => { setPaused(false); setStage("done"); }}
            />
          )}
          {stage === "done" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 backdrop-blur"
            >
              <div className="text-center px-6">
                <Trophy className="w-12 h-12 mx-auto text-amber-400 mb-2" />
                <p className="text-xl font-bold mb-1" data-testid="rh-headline">Run Complete</p>
                <p className="text-sm text-muted-foreground">
                  Wave {wave} reached · {sortedTotal} sorted · {score} pts
                </p>
                {maxCombo >= 3 && (
                  <p className="text-xs text-amber-300 font-mono mt-1">Best combo: {maxCombo}×</p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </ScreenShake>

      {/* Mobile control bar */}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button
          variant="outline"
          className="min-h-12 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/15 active:scale-95"
          onClick={() => decide("left")}
          data-testid="rh-button-left"
        >
          ⚙️ Functional ←
        </Button>
        <Button
          variant="outline"
          className="min-h-12 border-amber-500/40 text-amber-300 hover:bg-amber-500/15 active:scale-95"
          onClick={() => decide("right")}
          data-testid="rh-button-right"
        >
          → Non-Func 📊
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-1">
        Arrow keys / A / D · or tap left / right side of the conveyor · Esc to pause
      </p>

      {stage === "done" && (
        <RoundSummary
          correct={score >= 100}
          headline={`Wave ${wave} · ${score} pts`}
          explanation={`Sorted ${sortedTotal} requirements${maxCombo >= 3 ? ` · best combo ${maxCombo}×` : ""}. Functional = WHAT the system does (login, search, payment). Non-Functional = HOW WELL it does it (speed, security, accessibility, scalability).`}
          scoreDelta={score}
          onNext={() => onComplete(score)}
          isLast={true}
        />
      )}
    </div>
  );
}

// ============================================================
// 3. USE CASE DEFENSE — finite wave; each enemy is a use case
// ============================================================

interface UCDEnemy {
  id: number;
  label: string;
  actorId: string;
  lane: number;
  x: number; // 0-100 (% from right). Marches LEFT → x decreases.
  hp: number;
  defeated: boolean;
}

const UCD_LANES = 3;

function UseCaseDefense({ questions, onComplete, difficulty = 0 }: SADGameProps) {
  const totalRounds = questions.length || 1;
  const meta = SAD_GAMES.usecase_builder;

  // Difficulty-scaled knobs.
  const _d = Math.max(0, Math.min(1, difficulty));
  const UCD_SPEED = 5 + _d * 4;                       // 5 → 9 %/s
  const UCD_SPAWN_GAP_SEC = 1.6 - _d * 0.65;          // 1.6 → 0.95 s
  const UCD_BASE_HP = Math.max(1, 2 - Math.floor(_d)); // 2, 2, 1, 1
  const [howSeen, dismissHow] = useHowTo("usecase_builder");
  const [showHow, setShowHow] = useState(!howSeen);

  const [round, setRound] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as {
    actors?: { id: string; label: string; emoji?: string }[];
    useCases?: { label: string; actorId: string }[];
    explanation?: string;
  };
  const actors = useMemo(() => opts.actors || [
    { id: "user", label: "User", emoji: "👤" },
    { id: "admin", label: "Admin", emoji: "🛠️" },
  ], [opts.actors]);
  const useCases = useMemo(() => opts.useCases || [], [opts.useCases]);

  const [stage, setStage] = useState<"lineup" | "wave" | "result">("lineup");
  const [enemies, setEnemies] = useState<UCDEnemy[]>([]);
  const [spawned, setSpawned] = useState(0);
  const [defeated, setDefeated] = useState(0);
  const [reachedBase, setReachedBase] = useState(0);
  const [selectedActor, setSelectedActor] = useState<string | null>(actors[0]?.id || null);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [shake, setShake] = useState(0);
  const [hitFx, setHitFx] = useState<{ id: number; lane: number; x: number; correct: boolean; trigger: number } | null>(null);
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [paused, setPaused] = usePause(stage === "wave" && !showHow);

  const nextEnemyId = useRef(1);
  const spawnAcc = useRef(0);
  const waveOrder = useRef<typeof useCases>([]);
  // Authoritative copies — game loop reads these and applies all setStates
  // at the top level, so we never call setState inside another updater fn.
  const enemiesRef = useRef<UCDEnemy[]>([]);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const baseHp = UCD_BASE_HP; // enemies allowed to reach base (scales with difficulty)
  const lostBase = reachedBase >= baseHp;
  const allCleared = spawned >= useCases.length && enemies.length === 0;
  const waveOver = stage === "wave" && (lostBase || allCleared);

  // Reset round
  useEffect(() => {
    setStage("lineup");
    setEnemies([]);
    setSpawned(0);
    setDefeated(0);
    setReachedBase(0);
    setCombo(0);
    setMaxCombo(0);
    setSelectedActor(actors[0]?.id || null);
    enemiesRef.current = [];
    comboRef.current = 0;
    maxComboRef.current = 0;
    spawnAcc.current = 0;
    nextEnemyId.current = 1;
    // Shuffle the wave order
    const ucs = [...useCases];
    for (let i = ucs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ucs[i], ucs[j]] = [ucs[j], ucs[i]];
    }
    waveOrder.current = ucs;
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect end-of-wave (scoring is committed in nextRound to keep skip path consistent).
  useEffect(() => {
    if (waveOver && stage === "wave") {
      setStage("result");
    }
  }, [waveOver, stage]);

  // Game loop: spawn + march. Pure tick — reads refs, applies setStates at top level.
  useGameLoop((dt) => {
    if (stage !== "wave" || paused) return;

    // 1) Spawn next enemy if any left.
    //    To prevent labels overlapping (each pill is ~100px wide), pick the
    //    lane whose trailing enemy is FURTHEST from the spawn edge — i.e. the
    //    lane with the most headroom. If every lane still has an enemy too
    //    close to the spawn point, hold the spawn this tick instead of forcing
    //    a visual collision.
    let spawnedEnemy: UCDEnemy | null = null;
    if (spawned < waveOrder.current.length) {
      spawnAcc.current += dt;
      if (spawnAcc.current >= UCD_SPAWN_GAP_SEC) {
        // Find the smallest x (closest to base) among ALIVE enemies in each lane.
        // The lane whose nearest-to-spawn enemy is FURTHEST left (smallest x)
        // has the most headroom near x=100.
        const minXByLane: number[] = Array(UCD_LANES).fill(Infinity);
        for (const e of enemiesRef.current) {
          if (e.defeated) continue;
          // We care about how close each lane's TRAILING (right-most) enemy is
          // to the spawn edge. So track MAX x per lane, then pick the lane with
          // the lowest max — that lane has its trailing enemy furthest left.
          if (e.x > (minXByLane[e.lane] === Infinity ? -1 : minXByLane[e.lane])) {
            minXByLane[e.lane] = e.x;
          }
        }
        // Empty lanes (Infinity) become best candidates (no trailing enemy at all).
        let bestLane = 0;
        let bestX = Infinity;
        for (let i = 0; i < UCD_LANES; i++) {
          // Empty lane → headroom is "infinite". Treat as -Infinity so it wins.
          const trailX = minXByLane[i] === Infinity ? -Infinity : minXByLane[i];
          if (trailX < bestX) { bestX = trailX; bestLane = i; }
        }
        // Need at least ~22% gap between spawn (x=100) and the trailing enemy
        // so the new pill doesn't visually butt against the previous one.
        const MIN_GAP = 22;
        const canSpawn = bestX === -Infinity || (100 - bestX) >= MIN_GAP;
        if (canSpawn) {
          spawnAcc.current = 0;
          const uc = waveOrder.current[spawned];
          const id = nextEnemyId.current++;
          spawnedEnemy = {
            id, label: uc.label, actorId: uc.actorId, lane: bestLane,
            x: 100, hp: 1, defeated: false,
          };
        }
        // else: leave spawnAcc above the threshold so we re-try next tick.
      }
    }

    // 2) March left + count breaches.
    const next: UCDEnemy[] = [];
    let breached = 0;
    for (const e of enemiesRef.current) {
      if (e.defeated) continue;
      const nx = e.x - UCD_SPEED * dt;
      if (nx <= 0) {
        breached++;
        continue;
      }
      next.push({ ...e, x: nx });
    }
    if (spawnedEnemy) next.push(spawnedEnemy);
    enemiesRef.current = next;

    // 3) Apply all setStates at top level.
    setEnemies(next);
    if (spawnedEnemy) setSpawned(s => s + 1);
    if (breached > 0) {
      setReachedBase(b => b + breached);
      setShake(Date.now());
      comboRef.current = 0;
      setCombo(0);
    }
  }, stage === "wave" && !paused);

  function tryDefeat(enemy: UCDEnemy) {
    if (!selectedActor || enemy.defeated) return;
    if (selectedActor === enemy.actorId) {
      // Correct — mark defeated and remove. Combo/maxCombo via refs (no nested updater setState).
      setDefeated(d => d + 1);
      const markedDefeated = enemiesRef.current.map(e =>
        e.id === enemy.id ? { ...e, defeated: true } : e,
      );
      enemiesRef.current = markedDefeated;
      setEnemies(markedDefeated);
      // Remove after a brief explosion.
      setTimeout(() => {
        const filtered = enemiesRef.current.filter(e => e.id !== enemy.id);
        enemiesRef.current = filtered;
        setEnemies(filtered);
      }, 350);
      const newCombo = comboRef.current + 1;
      comboRef.current = newCombo;
      setCombo(newCombo);
      if (newCombo > maxComboRef.current) {
        maxComboRef.current = newCombo;
        setMaxCombo(newCombo);
      }
      setHitFx({ id: enemy.id, lane: enemy.lane, x: enemy.x, correct: true, trigger: Date.now() });
      const actorLabel = actors.find(a => a.id === enemy.actorId)?.label || "Actor";
      setToast({ text: `✓ ${actorLabel} → ${enemy.label}`, key: Date.now() });
    } else {
      // Wrong actor
      setShake(Date.now());
      comboRef.current = 0;
      setCombo(0);
      setHitFx({ id: enemy.id, lane: enemy.lane, x: enemy.x, correct: false, trigger: Date.now() });
      const expectedActor = actors.find(a => a.id === enemy.actorId)?.label || "?";
      setToast({ text: `✗ Not the right actor — try ${expectedActor}`, key: Date.now() });
    }
  }

  const won = stage === "result" && !lostBase;
  const roundDelta = stage === "result" ? defeated * 20 + (won ? 30 : 0) + maxCombo * 5 : 0;

  function nextRound() {
    const newTotal = totalScore + roundDelta;
    setTotalScore(newTotal);
    if (round + 1 >= totalRounds) {
      setDone(true);
      onComplete(newTotal);
    } else {
      setRound(r => r + 1);
    }
  }

  if (done) return null;

  return (
    <div className="w-full max-w-xl select-none">
      <RoundHeader
        index={round}
        total={totalRounds}
        label={stage === "lineup" ? "Pre-game lineup" : stage === "wave" ? "Wave" : "Result"}
        onPause={stage === "wave" ? () => setPaused(p => !p) : undefined}
      />

      <ScreenShake trigger={shake}>
        <div className="glass-strong rounded-xl border border-border/40 overflow-hidden relative" style={{ minHeight: 440 }}>
          {/* HUD */}
          {stage !== "lineup" && (
            <div className="absolute top-2 left-2 right-2 z-20 flex justify-between items-center pointer-events-none">
              <Badge variant="outline" className="bg-background/70 backdrop-blur" data-testid="badge-base-hp">
                {Array.from({ length: baseHp }).map((_, i) => (
                  <span key={i} className={i < (baseHp - reachedBase) ? "text-cyan-300" : "text-muted/40"}>🛡️</span>
                ))}
              </Badge>
              <Badge variant="outline" className="bg-background/70 backdrop-blur text-cyan-300" data-testid="badge-wave">
                ⚔️ {defeated}/{useCases.length}
              </Badge>
              <Badge variant="outline" className="bg-background/70 backdrop-blur text-pink-300">
                🔥 {combo}×
              </Badge>
            </div>
          )}

          {/* LINEUP */}
          {stage === "lineup" && (
            <div className="p-4 pt-8 flex flex-col h-full" style={{ minHeight: 440 }}>
              <p className="text-xs text-muted-foreground text-center mb-2 font-mono">YOUR ACTOR LINEUP</p>
              <p className="text-sm text-center mb-4 px-3">{q.content}</p>
              <div className="space-y-2 flex-1 overflow-y-auto">
                {actors.map(a => {
                  const ownedCases = useCases.filter(uc => uc.actorId === a.id);
                  return (
                    <div key={a.id} className="rounded-lg border border-border/40 bg-card/60 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{a.emoji || "👤"}</span>
                        <span className="font-bold text-sm">{a.label}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">handles {ownedCases.length}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground space-y-0.5 pl-7">
                        {ownedCases.map(uc => <div key={uc.label}>• {uc.label}</div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button className="w-full mt-3 min-h-11" onClick={() => setStage("wave")} data-testid="button-start-wave">
                Start defense wave <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* WAVE */}
          {stage === "wave" && (
            <>
              {/* Lanes background */}
              <div className="absolute inset-0 mt-9 mb-20 grid" style={{ gridTemplateRows: `repeat(${UCD_LANES}, 1fr)` }}>
                {Array.from({ length: UCD_LANES }).map((_, i) => (
                  <div key={i} className="border-b border-border/15 relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-12 bg-gradient-to-r from-cyan-500/40 to-transparent" />
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-cyan-500/30" />
                  </div>
                ))}
              </div>

              {/* Base on left edge */}
              <div className="absolute left-1 top-9 bottom-20 z-10 flex items-center justify-center pointer-events-none">
                <div className="text-3xl">🏰</div>
              </div>

              {/* Enemies */}
              <AnimatePresence>
                {enemies.map(e => {
                  const laneTop = 36 + e.lane * ((440 - 36 - 80) / UCD_LANES) + ((440 - 36 - 80) / UCD_LANES) / 2 - 24;
                  return (
                    <motion.button
                      key={e.id}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: e.defeated ? 1.5 : 1, opacity: e.defeated ? 0 : 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      onClick={() => tryDefeat(e)}
                      className="absolute z-10 flex items-center justify-center"
                      style={{ left: `${e.x}%`, top: laneTop, width: 100, marginLeft: -50, height: 48 }}
                      data-testid={`enemy-${e.id}`}
                    >
                      <div className={`px-2 py-1 rounded-lg border-2 backdrop-blur shadow-lg flex items-center gap-1 transition-colors whitespace-nowrap ${
                        e.defeated
                          ? "bg-emerald-500/50 border-emerald-300"
                          : "bg-rose-600/70 border-rose-300 hover:bg-rose-500/80"
                      }`}
                      style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.4)" }}
                      >
                        <span className="text-base">{e.defeated ? "💥" : "👾"}</span>
                        <span className="text-[10px] font-bold text-white leading-tight max-w-20 truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
                          {e.label}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>

              {/* Hit FX */}
              {hitFx && (
                <motion.div
                  key={hitFx.trigger}
                  initial={{ scale: 0, opacity: 1 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className={`absolute pointer-events-none w-12 h-12 rounded-full ${hitFx.correct ? "bg-emerald-400/50" : "bg-rose-400/50"} border-2 ${hitFx.correct ? "border-emerald-300" : "border-rose-300"}`}
                  style={{
                    left: `${hitFx.x}%`,
                    top: 36 + hitFx.lane * ((440 - 36 - 80) / UCD_LANES) + ((440 - 36 - 80) / UCD_LANES) / 2 - 24,
                    marginLeft: -24,
                  }}
                />
              )}

              {/* Toast */}
              <AnimatePresence>
                {toast && (
                  <motion.div
                    key={toast.key}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-lg bg-background/90 border border-border/60 text-xs font-medium pointer-events-none"
                    onAnimationComplete={() => {
                      setTimeout(() => setToast(null), 700);
                    }}
                  >
                    {toast.text}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actor toolbar */}
              <div className="absolute bottom-2 left-2 right-2 z-20 grid gap-2" style={{ gridTemplateColumns: `repeat(${actors.length}, 1fr)` }}>
                {actors.map(a => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedActor(a.id)}
                    className={`min-h-12 rounded-lg border-2 px-2 py-1 transition-all flex flex-col items-center justify-center ${
                      selectedActor === a.id
                        ? "bg-cyan-500/30 border-cyan-300 ring-2 ring-cyan-300/40"
                        : "bg-card/70 border-border/40 hover:border-cyan-400/40"
                    }`}
                    data-testid={`actor-${a.id}`}
                  >
                    <span className="text-base leading-none">{a.emoji || "👤"}</span>
                    <span className="text-[10px] font-bold mt-0.5 leading-tight">{a.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* RESULT */}
          {stage === "result" && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center bg-background/80 backdrop-blur p-6">
              {won ? <Trophy className="w-12 h-12 text-amber-400 mb-2" /> : <X className="w-12 h-12 text-rose-400 mb-2" />}
              <p className="text-xl font-bold">{won ? "Wave defended!" : "Base breached"}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {defeated} / {useCases.length} defeated • Best combo {maxCombo}× • +{roundDelta} pts
              </p>
            </div>
          )}

          {showHow && (
            <HowToOverlay
              meta={meta}
              goal="Each enemy is a system task. Pick the actor who handles that task and tap the enemy to defeat it."
              controls={[
                "Tap an actor in the bottom toolbar to select them.",
                "Tap an enemy to defeat it — only the right actor works.",
                "Wrong actor breaks your combo. 2 enemies through = base falls.",
                "Esc to pause.",
              ]}
              onStart={() => { dismissHow(); setShowHow(false); }}
            />
          )}
          {paused && !showHow && stage === "wave" && (
            <PauseOverlay onResume={() => setPaused(false)} onSkip={() => { setPaused(false); setStage("result"); }} />
          )}
        </div>
      </ScreenShake>

      {stage === "result" && (
        <RoundSummary
          correct={won}
          headline={won ? `Defense held (+${roundDelta} pts)` : `Base fell (+${roundDelta} pts)`}
          explanation={opts.explanation || "Each use case belongs to one actor. Match the actor to defeat the enemy."}
          scoreDelta={roundDelta}
          onNext={nextRound}
          isLast={round + 1 >= totalRounds}
        />
      )}
    </div>
  );
}

// ============================================================
// 4. ER CITY BUILDER — pick the cardinality, prove with traffic
// ============================================================

const CARDINALITIES = ["1:1", "1:N", "N:N"] as const;
type Cardinality = typeof CARDINALITIES[number];

function ERCityBuilder({ questions, onComplete, difficulty = 0 }: SADGameProps) {
  const totalRounds = questions.length || 1;
  const meta = SAD_GAMES.erd_doctor;
  const _d = Math.max(0, Math.min(1, difficulty));
  // Harder stages: bigger first-try bonus, smaller second-try consolation.
  const ER_FIRST = Math.round(30 + _d * 10);  // 30 → 40
  const ER_SECOND = Math.max(0, Math.round(15 - _d * 10)); // 15 → 5
  const [howSeen, dismissHow] = useHowTo("erd_doctor");
  const [showHow, setShowHow] = useState(!howSeen);

  const [round, setRound] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as { left?: string; right?: string; explanation?: string };
  const correctAnswer = (q.answer || "1:N") as Cardinality;
  const left = opts.left || "Entity A";
  const right = opts.right || "Entity B";

  const [picked, setPicked] = useState<Cardinality | null>(null);
  const [submitted, setSubmitted] = useState<null | { correct: boolean; pickedAtSubmit: Cardinality }>(null);
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake] = useState(0);

  // Reset on round change
  useEffect(() => {
    setPicked(null);
    setSubmitted(null);
    setAttempts(0);
  }, [round]);

  function submit() {
    if (!picked) return;
    const correct = picked === correctAnswer;
    setSubmitted({ correct, pickedAtSubmit: picked });
    setAttempts(a => a + 1);
    if (!correct) setShake(Date.now());
  }

  function nextRound() {
    const correct = submitted?.correct ?? false;
    const delta = correct ? (attempts === 1 ? ER_FIRST : ER_SECOND) : 0;
    const newTotal = totalScore + delta;
    setTotalScore(newTotal);
    if (round + 1 >= totalRounds) {
      setDone(true);
      onComplete(newTotal);
    } else {
      setRound(r => r + 1);
    }
  }

  if (done) return null;

  // Traffic preview is shown live as you cycle the picker, then "locked" on submit.
  const showCard = picked || "1:N";
  const carCountLeft = showCard === "N:N" ? 4 : 0;
  const carCountRight = showCard === "1:1" ? 1 : showCard === "1:N" ? 4 : 4;

  return (
    <div className="w-full max-w-xl select-none">
      <RoundHeader index={round} total={totalRounds} label="ER City Builder" />

      <ScreenShake trigger={shake}>
        <div className="glass-strong rounded-xl border border-border/40 overflow-hidden relative" style={{ minHeight: 420 }}>
          {/* HUD */}
          <div className="absolute top-2 left-2 right-2 z-20 flex justify-between items-center">
            <Badge variant="outline" className="bg-background/70">Round {round + 1}/{totalRounds}</Badge>
            <Badge variant="outline" className="bg-background/70 text-amber-300">⭐ {totalScore}</Badge>
          </div>

          <div className="p-4 pt-12">
            <p className="text-sm text-foreground/90 leading-relaxed mb-4 text-center" data-testid="text-story">{q.content}</p>

            {/* The two buildings + road */}
            <div className="relative h-40 mb-4 flex items-center justify-between px-2">
              {/* Left building */}
              <motion.div
                animate={submitted?.correct ? { scale: [1, 1.06, 1] } : {}}
                transition={{ duration: 0.6, repeat: submitted?.correct ? 1 : 0 }}
                className="rounded-xl border-2 border-amber-400/60 bg-amber-500/10 p-3 flex flex-col items-center w-28 z-10"
              >
                <span className="text-3xl">🏢</span>
                <span className="text-xs font-bold mt-1 text-amber-200 text-center">{left}</span>
              </motion.div>

              {/* The road */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 px-32 pointer-events-none">
                <div className={`h-12 rounded-md border-y-2 ${
                  submitted ? (submitted.correct ? "border-emerald-400 bg-emerald-500/10" : "border-rose-400 bg-rose-500/10") : "border-border/40 bg-card/30"
                } relative overflow-hidden`}>
                  {/* Lane markings depend on cardinality */}
                  {showCard === "1:1" && (
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full h-px border-t border-dashed border-foreground/30" />
                    </div>
                  )}
                  {showCard === "1:N" && (
                    <>
                      <div className="absolute inset-0 flex flex-col justify-around">
                        <div className="w-full h-px border-t border-dashed border-foreground/30" />
                        <div className="w-full h-px border-t border-dashed border-foreground/30" />
                      </div>
                    </>
                  )}
                  {showCard === "N:N" && (
                    <>
                      <div className="absolute inset-0 flex flex-col justify-around">
                        <div className="w-full h-px border-t-2 border-amber-400/40" />
                        <div className="w-full h-px border-t border-dashed border-foreground/30" />
                        <div className="w-full h-px border-t-2 border-amber-400/40" />
                      </div>
                    </>
                  )}

                  {/* Cars (only when submitted correct) */}
                  {submitted?.correct && (
                    <>
                      {Array.from({ length: carCountRight }).map((_, i) => (
                        <motion.div
                          key={`r${i}`}
                          className="absolute top-1 w-3 h-2 rounded-sm bg-emerald-400 shadow"
                          initial={{ left: "0%" }}
                          animate={{ left: "100%" }}
                          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.3, ease: "linear" }}
                        />
                      ))}
                      {Array.from({ length: carCountLeft }).map((_, i) => (
                        <motion.div
                          key={`l${i}`}
                          className="absolute bottom-1 w-3 h-2 rounded-sm bg-cyan-400 shadow"
                          initial={{ left: "100%" }}
                          animate={{ left: "0%" }}
                          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.3, ease: "linear" }}
                        />
                      ))}
                    </>
                  )}

                  {/* Cardinality label */}
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2">
                    <Badge variant="outline" className={`text-xs font-mono font-bold ${submitted?.correct ? "bg-emerald-500/20 text-emerald-200" : "bg-background/80"}`}>
                      {showCard}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Right building */}
              <motion.div
                animate={submitted?.correct ? { scale: [1, 1.06, 1] } : {}}
                transition={{ duration: 0.6, repeat: submitted?.correct ? 1 : 0 }}
                className="rounded-xl border-2 border-amber-400/60 bg-amber-500/10 p-3 flex flex-col items-center w-28 z-10"
              >
                <span className="text-3xl">🏭</span>
                <span className="text-xs font-bold mt-1 text-amber-200 text-center">{right}</span>
              </motion.div>
            </div>

            {/* Cardinality picker */}
            <p className="text-xs text-muted-foreground text-center mb-2 font-mono">PICK THE CARDINALITY</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {CARDINALITIES.map(c => {
                const isPicked = picked === c;
                const isCorrect = submitted && c === correctAnswer;
                const isWrongPick = submitted && submitted.pickedAtSubmit === c && !submitted.correct;
                return (
                  <button
                    key={c}
                    onClick={() => !submitted && setPicked(c)}
                    disabled={!!submitted}
                    className={`min-h-14 rounded-lg border-2 font-mono font-bold text-base transition-all ${
                      isCorrect ? "border-emerald-400 bg-emerald-500/20 text-emerald-200" :
                      isWrongPick ? "border-rose-400 bg-rose-500/20 text-rose-200" :
                      isPicked ? "border-amber-400 bg-amber-500/20 text-amber-200" :
                      "border-border/40 bg-card/40 hover:border-amber-400/40"
                    }`}
                    data-testid={`pick-${c}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mb-2">
              1:1 = each side has exactly one. 1:N = one to many. N:N = many on both sides.
            </p>

            {!submitted ? (
              <Button className="w-full min-h-11" onClick={submit} disabled={!picked} data-testid="button-submit-cardinality">
                Connect ▶
              </Button>
            ) : submitted.correct ? null : attempts < 2 ? (
              <Button className="w-full min-h-11" variant="outline" onClick={() => { setSubmitted(null); }} data-testid="button-retry">
                Try again
              </Button>
            ) : null}
          </div>

          {showHow && (
            <HowToOverlay
              meta={meta}
              goal="Read the relationship story between two entities and pick the right cardinality."
              controls={[
                "Tap one of: 1:1 / 1:N / N:N.",
                "Tap Connect to submit. Cars on the road show the cardinality.",
                "First-try correct: +30. Retry correct: +15.",
                "Two wrong attempts reveals the answer.",
              ]}
              onStart={() => { dismissHow(); setShowHow(false); }}
            />
          )}
        </div>
      </ScreenShake>

      {submitted && (submitted.correct || attempts >= 2) && (
        <RoundSummary
          correct={submitted.correct}
          headline={submitted.correct
            ? (attempts === 1 ? "Perfect read! +30 pts" : "Got it on retry +15 pts")
            : `Answer: ${correctAnswer}`}
          explanation={opts.explanation || "Cardinality describes how many records on each side relate to the other."}
          scoreDelta={submitted.correct ? (attempts === 1 ? 30 : 15) : 0}
          onNext={nextRound}
          isLast={round + 1 >= totalRounds}
        />
      )}
    </div>
  );
}

// ============================================================
// 5. DATA FLOW PLUMBER — connect the missing flow
// ============================================================

interface DFDNode {
  id: string;
  label: string;
  type: "source" | "process" | "store" | "sink";
  col: number;
  row: number;
}

const NODE_STYLES: Record<DFDNode["type"], { bg: string; border: string; icon: string; emoji: string; col: number }> = {
  source:  { bg: "bg-pink-500/15",   border: "border-pink-400/60",   icon: "text-pink-200",   emoji: "👤", col: 0 },
  process: { bg: "bg-cyan-500/15",   border: "border-cyan-400/60",   icon: "text-cyan-200",   emoji: "⚙️", col: 1 },
  store:   { bg: "bg-amber-500/15",  border: "border-amber-400/60",  icon: "text-amber-200",  emoji: "🗄️", col: 2 },
  sink:    { bg: "bg-violet-500/15", border: "border-violet-400/60", icon: "text-violet-200", emoji: "📨", col: 3 },
};

function layoutNodes(rawNodes: { id: string; label: string; type: DFDNode["type"] }[]): DFDNode[] {
  // Group by column (type), assign row within column
  const cols: Record<number, { id: string; label: string; type: DFDNode["type"] }[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const n of rawNodes) {
    const c = NODE_STYLES[n.type].col;
    cols[c].push(n);
  }
  const out: DFDNode[] = [];
  for (let c = 0; c < 4; c++) {
    cols[c].forEach((n, r) => {
      out.push({ ...n, col: c, row: r });
    });
  }
  return out;
}

// DFD rule-specific violation messages — surfaces *why* a wrong answer is
// wrong instead of a generic "Wrong direction".
function dfdViolation(
  fromType: string | undefined,
  toType: string | undefined,
  correctFrom: string,
  correctTo: string,
  fromId: string,
  toId: string,
): string {
  if (fromType === "store" && toType === "store") {
    return "Two data stores can't connect directly — a process must read from one and write to the other.";
  }
  if (fromType === "source" && toType === "store") {
    return "An external entity can't write straight to a data store — a process owns the write.";
  }
  if (fromType === "store" && toType === "sink") {
    return "A data store can't push directly to an external entity — a process must read it first.";
  }
  if (fromType === "source" && toType === "sink") {
    return "Two external entities can't exchange data inside the system — a process has to handle it.";
  }
  if (fromType === "sink") {
    return "Sinks only receive data — they can't be the source of an arrow.";
  }
  if (toType === "source") {
    return "Sources only emit data — they can't be the destination of an arrow.";
  }
  if (fromId === correctTo && toId === correctFrom) {
    return "Right two nodes — but the arrow flows the other way. Data moves the opposite direction here.";
  }
  return "Those two nodes don't carry this data flow. Re-read the missing-arrow label and pick a different pair.";
}

function DataFlowPlumber({ questions, onComplete, difficulty = 0 }: SADGameProps) {
  const totalRounds = questions.length || 1;
  const meta = SAD_GAMES.dfd_detective;
  const _d = Math.max(0, Math.min(1, difficulty));
  // One retry: original try + 1 retry, then the answer is revealed.
  const DFD_MAX_ATTEMPTS = 2;
  const [howSeen, dismissHow] = useHowTo("dfd_detective");
  const [showHow, setShowHow] = useState(!howSeen);

  const [round, setRound] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as {
    nodes?: { id: string; label: string; type: "source" | "process" | "store" | "sink" }[];
    existingFlows?: { from: string; to: string; label: string }[];
    correctFrom?: string;
    correctTo?: string;
    missingLabel?: string;
    explanation?: string;
  };

  const nodes = useMemo(() => layoutNodes(opts.nodes || []), [opts.nodes]);
  const existingFlows = opts.existingFlows || [];
  const correctFrom = opts.correctFrom || "";
  const correctTo = opts.correctTo || "";
  const missingLabel = opts.missingLabel || "Missing arrow";

  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const [submission, setSubmission] = useState<null | { from: string; to: string; correct: boolean }>(null);
  const [attempts, setAttempts] = useState(0);
  const [shake, setShake] = useState(0);

  // Reset round
  useEffect(() => {
    setSelectedFrom(null);
    setSubmission(null);
    setAttempts(0);
  }, [round]);

  function clickNode(id: string) {
    if (submission?.correct) return;
    if (attempts >= DFD_MAX_ATTEMPTS) return;
    if (!selectedFrom) {
      setSelectedFrom(id);
      return;
    }
    if (selectedFrom === id) {
      setSelectedFrom(null);
      return;
    }
    // Submit
    const correct = selectedFrom === correctFrom && id === correctTo;
    setSubmission({ from: selectedFrom, to: id, correct });
    setAttempts(a => a + 1);
    if (!correct) {
      setShake(Date.now());
      setTimeout(() => setSelectedFrom(null), 700);
    }
  }

  function nextRound() {
    const correct = submission?.correct ?? false;
    const delta = correct ? (attempts === 1 ? 35 : 15) : 0;
    const newTotal = totalScore + delta;
    setTotalScore(newTotal);
    if (round + 1 >= totalRounds) {
      setDone(true);
      onComplete(newTotal);
    } else {
      setRound(r => r + 1);
    }
  }

  if (done) return null;

  // Compute pixel positions for nodes
  const PLAY_W = 480, PLAY_H = 280;
  const COL_W = PLAY_W / 4;
  function nodePos(n: DFDNode) {
    const colItems = nodes.filter(x => x.col === n.col);
    const rowH = PLAY_H / Math.max(1, colItems.length);
    return {
      x: n.col * COL_W + COL_W / 2,
      y: n.row * rowH + rowH / 2,
    };
  }
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  function arrowFor(fromId: string, toId: string) {
    const f = nodeMap.get(fromId);
    const t = nodeMap.get(toId);
    if (!f || !t) return null;
    const fp = nodePos(f);
    const tp = nodePos(t);
    return { fp, tp };
  }

  const submittedArrow = submission ? arrowFor(submission.from, submission.to) : null;
  const correctArrow = (attempts >= DFD_MAX_ATTEMPTS || submission?.correct) ? arrowFor(correctFrom, correctTo) : null;

  return (
    <div className="w-full max-w-xl select-none">
      <RoundHeader index={round} total={totalRounds} label="Data Flow Plumber" />

      <ScreenShake trigger={shake}>
        <div className="glass-strong rounded-xl border border-border/40 overflow-hidden relative" style={{ minHeight: 460 }}>
          <div className="p-3 pt-3">
            <p className="text-xs text-muted-foreground text-center font-mono mb-1">CONNECT THE MISSING FLOW</p>
            <p className="text-sm text-foreground/90 leading-snug text-center mb-2 px-2">{q.content}</p>

            <div className="rounded-xl border border-border/40 bg-card/40 p-2 relative" style={{ height: PLAY_H + 20 }}>
              {/* SVG arrows layer */}
              <svg width="100%" height="100%" viewBox={`0 0 ${PLAY_W} ${PLAY_H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 pointer-events-none">
                <defs>
                  <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148,163,184,0.7)" />
                  </marker>
                  <marker id="arrow-good" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#34d399" />
                  </marker>
                  <marker id="arrow-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#f87171" />
                  </marker>
                </defs>
                {/* Existing flows */}
                {existingFlows.map((f, i) => {
                  const a = arrowFor(f.from, f.to);
                  if (!a) return null;
                  return (
                    <g key={i}>
                      <line
                        x1={a.fp.x} y1={a.fp.y} x2={a.tp.x} y2={a.tp.y}
                        stroke="rgba(148,163,184,0.6)" strokeWidth={2}
                        markerEnd="url(#arrow-gray)"
                      />
                      <text
                        x={(a.fp.x + a.tp.x) / 2} y={(a.fp.y + a.tp.y) / 2 - 6}
                        fontSize="10" fill="rgba(148,163,184,0.95)" textAnchor="middle"
                        style={{ paintOrder: "stroke", stroke: "rgba(15,23,42,0.7)", strokeWidth: 3 }}
                      >
                        {f.label}
                      </text>
                    </g>
                  );
                })}

                {/* Submitted arrow */}
                {submittedArrow && (
                  <line
                    x1={submittedArrow.fp.x} y1={submittedArrow.fp.y}
                    x2={submittedArrow.tp.x} y2={submittedArrow.tp.y}
                    stroke={submission!.correct ? "#34d399" : "#f87171"}
                    strokeWidth={3}
                    strokeDasharray={submission!.correct ? "" : "6 4"}
                    markerEnd={submission!.correct ? "url(#arrow-good)" : "url(#arrow-bad)"}
                  />
                )}

                {/* Correct answer reveal (after 2 attempts and not solved) */}
                {correctArrow && !submission?.correct && (
                  <line
                    x1={correctArrow.fp.x} y1={correctArrow.fp.y}
                    x2={correctArrow.tp.x} y2={correctArrow.tp.y}
                    stroke="#34d399"
                    strokeWidth={3}
                    strokeDasharray="4 3"
                    markerEnd="url(#arrow-good)"
                    opacity={0.7}
                  />
                )}
              </svg>

              {/* Nodes */}
              {nodes.map(n => {
                const style = NODE_STYLES[n.type];
                const pos = nodePos(n);
                const isSelected = selectedFrom === n.id;
                const isCorrectFrom = (submission?.correct || attempts >= 2) && n.id === correctFrom;
                const isCorrectTo = (submission?.correct || attempts >= 2) && n.id === correctTo;
                return (
                  <button
                    key={n.id}
                    onClick={() => clickNode(n.id)}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 backdrop-blur transition-all px-2 py-1.5 flex flex-col items-center gap-0.5 min-w-16 ${style.bg} ${style.border} ${
                      isSelected ? "ring-2 ring-cyan-300 scale-110" :
                      (isCorrectFrom || isCorrectTo) ? "ring-2 ring-emerald-400" :
                      "hover:scale-105"
                    }`}
                    style={{
                      left: `${(pos.x / PLAY_W) * 100}%`,
                      top: pos.y,
                      width: COL_W - 16,
                    }}
                    data-testid={`node-${n.id}`}
                  >
                    <span className={`text-base ${style.icon}`}>{style.emoji}</span>
                    <span className="text-[10px] font-bold leading-tight text-center text-foreground">{n.label}</span>
                    <span className="text-[8px] uppercase font-mono text-muted-foreground">{n.type}</span>
                  </button>
                );
              })}
            </div>

            {/* Missing arrow indicator + status */}
            <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
              <div className="flex items-center gap-2">
                <span className="text-amber-300">❓</span>
                <span className="text-xs font-bold text-amber-200">Missing arrow:</span>
                <span className="text-xs text-amber-100 font-mono">{missingLabel}</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {selectedFrom
                  ? <>From: <span className="text-cyan-300 font-bold">{nodeMap.get(selectedFrom)?.label}</span> → tap the destination node</>
                  : "Tap the source node first, then the destination node."}
              </p>
            </div>

            {attempts > 0 && !submission?.correct && attempts < DFD_MAX_ATTEMPTS && submission && (
              <p className="text-[11px] text-rose-300 text-center mt-2 px-2 leading-snug" data-testid="text-dfd-violation">
                ✗ {dfdViolation(
                  nodeMap.get(submission.from)?.type,
                  nodeMap.get(submission.to)?.type,
                  correctFrom, correctTo,
                  submission.from, submission.to,
                )} {DFD_MAX_ATTEMPTS - attempts} {DFD_MAX_ATTEMPTS - attempts === 1 ? "try" : "tries"} left.
              </p>
            )}
          </div>

          {showHow && (
            <HowToOverlay
              meta={meta}
              goal="Find where the missing data arrow belongs in the diagram."
              controls={[
                "Tap the FROM node, then tap the TO node.",
                "Tap the same node twice to deselect.",
                "First-try correct: +35. Second try: +15.",
                "Hint: stores never connect to other stores directly.",
              ]}
              onStart={() => { dismissHow(); setShowHow(false); }}
            />
          )}
        </div>
      </ScreenShake>

      {(submission?.correct || attempts >= DFD_MAX_ATTEMPTS) && (
        <RoundSummary
          correct={!!submission?.correct}
          headline={submission?.correct
            ? (attempts === 1 ? "Pipe routed perfectly! +35 pts" : "Got it on the second try +15 pts")
            : `Answer: ${nodeMap.get(correctFrom)?.label} → ${nodeMap.get(correctTo)?.label}`}
          explanation={
            !submission?.correct && submission
              ? `${dfdViolation(
                  nodeMap.get(submission.from)?.type,
                  nodeMap.get(submission.to)?.type,
                  correctFrom, correctTo,
                  submission.from, submission.to,
                )} ${opts.explanation || ""}`.trim()
              : (opts.explanation || "Arrows in a DFD always carry data between source/store and process, or process to store/sink.")
          }
          scoreDelta={submission?.correct ? (attempts === 1 ? 35 : 15) : 0}
          onNext={nextRound}
          isLast={round + 1 >= totalRounds}
        />
      )}
    </div>
  );
}

// ============================================================
// 6. SEQUENCE RHYTHM — notes routed to actor lanes by step text
// ============================================================

// Hit line is the top of the chunky key pad (Magic Tiles feel — tiles
// "land" on a clearly visible piano-key strip at the bottom of each lane).
const HIT_LINE_PCT = 78;
const SEQ_KEYS = ["q", "w", "e", "r"];
const LANE_COLORS = ["#a78bfa", "#22d3ee", "#fbbf24", "#f472b6"];

interface SeqNote {
  id: number;
  lane: number;
  y: number; // 0-100
  text: string;
  state: "alive" | "perfect" | "good" | "miss";
}

/** Find the receiver actor for a step text. Returns the LAST mentioned actor name (case-insensitive), with word boundaries. */
function parseReceiverLane(stepText: string, objects: string[]): number {
  let bestPos = -1;
  let bestIdx = 0;
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const escaped = obj.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Use word boundary on letter sides; spaces in obj are literal
    const re = new RegExp(`(^|\\s|[\\.,;:'"\\(])(${escaped})(\\s|[\\.,;:'"\\)]|$)`, "i");
    const m = stepText.match(re);
    if (m && m.index !== undefined) {
      // Prefer the LAST mention (rightmost)
      const pos = m.index + (m[1]?.length || 0);
      if (pos >= bestPos) {
        bestPos = pos;
        bestIdx = i;
      }
    }
  }
  return bestIdx;
}

function SequenceRhythm({ questions, onComplete, difficulty = 0 }: SADGameProps) {
  const totalRounds = questions.length || 1;
  const meta = SAD_GAMES.sequence_stacker;
  const [howSeen, dismissHow] = useHowTo("sequence_stacker");
  const [showHow, setShowHow] = useState(!howSeen);

  // Difficulty-scaled knobs.
  const _d = Math.max(0, Math.min(1, difficulty));
  const NOTE_FALL_SPEED = 38 + _d * 22;        // 38 → 60 %/s
  const NOTE_SPAWN_GAP_SEC = 1.45 - _d * 0.55; // 1.45 → 0.9 s
  const HIT_WINDOW = 18 - _d * 6;              // 18 → 12
  const PERFECT_WINDOW = 6 - _d * 3;           // 6 → 3

  const [round, setRound] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as { steps?: string[]; explanation?: string; objects?: string[] };
  const objects = useMemo(() => (opts.objects && opts.objects.length > 0 ? opts.objects : ["User", "System"]).slice(0, 4), [opts.objects]);
  const steps = useMemo(() => opts.steps || [], [opts.steps]);

  const noteSpec = useMemo(() => steps.map((text, i) => ({
    text,
    lane: parseReceiverLane(text, objects),
    spawnAt: i * NOTE_SPAWN_GAP_SEC,
  })), [steps, objects, NOTE_SPAWN_GAP_SEC]);

  const [stage, setStage] = useState<"idle" | "playing" | "done">("idle");
  const [notes, setNotes] = useState<SeqNote[]>([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [perfects, setPerfects] = useState(0);
  const [misses, setMisses] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<{ kind: "perfect" | "good" | "miss"; lane: number; trigger: number } | null>(null);
  // Visual press flash on the key pad — fires for EVERY tap (even if it
  // doesn't connect with a note) so the player gets instant tactile feedback.
  const [pressedLane, setPressedLane] = useState<number | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressLane = useCallback((lane: number) => {
    setPressedLane(lane);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => setPressedLane(null), 140);
  }, []);
  useEffect(() => () => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current); }, []);
  const [paused, setPaused] = usePause(stage === "playing" && !showHow);

  const elapsedRef = useRef(0);
  const spawnedCount = useRef(0);
  const nextId = useRef(1);
  // Authoritative copies for the rAF loop — keeps all setStates at top level.
  const notesRef = useRef<SeqNote[]>([]);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);

  // Reset on round
  useEffect(() => {
    setStage("idle");
    setNotes([]);
    setCombo(0);
    setMaxCombo(0);
    setHits(0);
    setPerfects(0);
    setMisses(0);
    setScore(0);
    elapsedRef.current = 0;
    spawnedCount.current = 0;
    nextId.current = 1;
    notesRef.current = [];
    comboRef.current = 0;
    maxComboRef.current = 0;
  }, [round]);

  // Game loop — pure tick. Reads notesRef, applies all setStates at top level.
  useGameLoop((dt) => {
    if (stage !== "playing" || paused) return;
    elapsedRef.current += dt;

    // 1) Spawn any due notes into a local list. Notes carry the receiver
    //    lane internally for hit-detection, but render on the center rail
    //    so the player must INFER the lane from the message text itself.
    const justSpawned: SeqNote[] = [];
    while (spawnedCount.current < noteSpec.length && noteSpec[spawnedCount.current].spawnAt <= elapsedRef.current) {
      const spec = noteSpec[spawnedCount.current];
      const id = nextId.current++;
      justSpawned.push({ id, lane: spec.lane, y: 0, text: spec.text, state: "alive" });
      spawnedCount.current++;
    }

    // 2) Move notes + count misses. Missed notes flip to "miss" state so
    //    they keep falling for ~half a second showing the correct lane —
    //    teaching moment instead of just disappearing.
    const next: SeqNote[] = [];
    let missed = 0;
    for (const n of notesRef.current) {
      if (n.state !== "alive") {
        const ny = n.y + NOTE_FALL_SPEED * dt;
        if (ny < 110) next.push({ ...n, y: ny });
        continue;
      }
      const ny = n.y + NOTE_FALL_SPEED * dt;
      if (ny > HIT_LINE_PCT + HIT_WINDOW) {
        missed++;
        next.push({ ...n, y: ny, state: "miss" });
        continue;
      }
      next.push({ ...n, y: ny });
    }
    for (const n of justSpawned) next.push(n);
    notesRef.current = next;

    // 3) Apply setStates at the top level.
    setNotes(next);
    if (missed > 0) {
      setMisses(m => m + missed);
      comboRef.current = 0;
      setCombo(0);
      setFeedback({ kind: "miss", lane: -1, trigger: Date.now() });
    }

    // 4) End condition. Guard against empty noteSpec (would yield NaN and never end).
    if (noteSpec.length === 0) {
      setStage("done");
      return;
    }
    if (spawnedCount.current >= noteSpec.length) {
      const aliveLeft = next.some(n => n.state === "alive");
      const lastSpawn = noteSpec[noteSpec.length - 1].spawnAt;
      if (!aliveLeft && elapsedRef.current > lastSpawn + 3) {
        setStage("done");
      }
    }
  }, stage === "playing" && !paused);

  const hitLane = useCallback((lane: number) => {
    if (stage !== "playing" || paused) return;
    const current = notesRef.current;

    // First, look for a CORRECT-lane note in the hit window.
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < current.length; i++) {
      const n = current[i];
      if (n.state !== "alive" || n.lane !== lane) continue;
      const d = Math.abs(n.y - HIT_LINE_PCT);
      if (d < HIT_WINDOW && d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    // If no correct-lane note is in range, check whether ANY note is in the
    // hit window. If so, this is a wrong-lane press — burn the closest such
    // note as a MISS so players can't spam keys to find the right lane. The
    // tile then slides to its true receiver lane to teach.
    if (bestIdx === -1) {
      let wrongIdx = -1;
      let wrongDist = Infinity;
      for (let i = 0; i < current.length; i++) {
        const n = current[i];
        if (n.state !== "alive") continue;
        const d = Math.abs(n.y - HIT_LINE_PCT);
        if (d < HIT_WINDOW && d < wrongDist) {
          wrongDist = d;
          wrongIdx = i;
        }
      }
      if (wrongIdx !== -1) {
        const n = current[wrongIdx];
        const updated = [...current];
        updated[wrongIdx] = { ...n, state: "miss" };
        notesRef.current = updated;
        setNotes(updated);
        setMisses(m => m + 1);
        comboRef.current = 0;
        setCombo(0);
        setFeedback({ kind: "miss", lane: n.lane, trigger: Date.now() });
      }
      return;
    }

    const n = current[bestIdx];
    const isPerfect = bestDist < PERFECT_WINDOW;
    const points = isPerfect ? 30 : 15;
    const previousCombo = comboRef.current;
    const comboBonus = previousCombo * 2;
    const updated = [...current];
    updated[bestIdx] = { ...n, state: isPerfect ? "perfect" : "good" };
    notesRef.current = updated;

    // Apply all setStates at the top level — none nested in another updater.
    setNotes(updated);
    setScore(s => s + points + comboBonus);
    setHits(h => h + 1);
    if (isPerfect) setPerfects(p => p + 1);
    const newCombo = previousCombo + 1;
    comboRef.current = newCombo;
    setCombo(newCombo);
    if (newCombo > maxComboRef.current) {
      maxComboRef.current = newCombo;
      setMaxCombo(newCombo);
    }
    setFeedback({ kind: isPerfect ? "perfect" : "good", lane, trigger: Date.now() });
  }, [stage, paused]);

  // Keyboard — every press also triggers the visual press flash so the
  // player sees the lane react even on a mistimed key.
  useEffect(() => {
    if (stage !== "playing") return;
    const tap = (lane: number) => { pressLane(lane); hitLane(lane); };
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const idx = SEQ_KEYS.indexOf(k);
      if (idx >= 0 && idx < objects.length) {
        e.preventDefault();
        tap(idx);
        return;
      }
      // Also support arrow keys
      if (e.key === "ArrowLeft" && objects.length >= 1) tap(0);
      else if (e.key === "ArrowDown" && objects.length >= 2) tap(1);
      else if (e.key === "ArrowUp" && objects.length >= 3) tap(2);
      else if (e.key === "ArrowRight" && objects.length >= 4) tap(3);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stage, objects.length, hitLane, pressLane]);

  function nextRound() {
    const newTotal = totalScore + score;
    setTotalScore(newTotal);
    if (round + 1 >= totalRounds) {
      setDone(true);
      onComplete(newTotal);
    } else {
      setRound(r => r + 1);
    }
  }

  if (done) return null;

  const totalNotes = noteSpec.length;
  // Task spec requires ≥70% notes hit to win.
  const won = stage === "done" && hits >= Math.ceil(totalNotes * 0.7);
  const accuracy = totalNotes > 0 ? Math.round((hits / totalNotes) * 100) : 0;
  const PLAY_H = 440;

  return (
    <div className="w-full max-w-xl select-none">
      <RoundHeader
        index={round}
        total={totalRounds}
        label={q.content || "Sequence Rhythm"}
        onPause={stage === "playing" ? () => setPaused(p => !p) : undefined}
      />

      <div className="glass-strong rounded-xl border border-border/40 overflow-hidden relative" style={{ height: PLAY_H }}>
        {/* HUD */}
        <div className="absolute top-2 left-2 right-2 z-30 flex justify-between items-center pointer-events-none">
          <Badge variant="outline" className="bg-background/70 backdrop-blur text-pink-300">
            🔥 {combo}× <span className="text-muted-foreground ml-1 text-[10px]">best {maxCombo}</span>
          </Badge>
          <Badge variant="outline" className="bg-background/70 backdrop-blur text-indigo-300">
            ⭐ {score}
          </Badge>
          <Badge variant="outline" className="bg-background/70 backdrop-blur text-emerald-300">
            ✓ {hits}/{totalNotes}
          </Badge>
        </div>

        {/* Lane tap surfaces — full-height invisible buttons that grab every
            tap or click (anywhere in the lane counts). pointerdown for instant
            response on touch devices (no 300ms click delay). Each lane has a
            faint vertical color tint so the player can clearly see which key
            owns which column. */}
        <div className="absolute inset-0 grid pt-9 z-0" style={{ gridTemplateColumns: `repeat(${objects.length}, 1fr)` }}>
          {objects.map((obj, i) => {
            const color = LANE_COLORS[i % 4];
            return (
              <button
                key={i}
                type="button"
                className="relative cursor-pointer touch-none focus:outline-none"
                style={{
                  background: `linear-gradient(180deg, ${color}10 0%, ${color}05 50%, ${color}15 100%)`,
                }}
                onPointerDown={(e) => { e.preventDefault(); pressLane(i); hitLane(i); }}
                data-testid={`lane-${i}`}
                aria-label={`Lane ${i + 1}: ${obj}`}
              />
            );
          })}
        </div>

        {/* Bold vertical lane dividers spanning the whole play area — makes
            it instantly obvious which column belongs to which key. */}
        <div className="absolute inset-0 pt-9 z-10 pointer-events-none">
          {Array.from({ length: objects.length - 1 }).map((_, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: `${((i + 1) / objects.length) * 100}%`,
                background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.04) 100%)",
                boxShadow: "0 0 4px rgba(255,255,255,0.08)",
              }}
            />
          ))}
        </div>

        {/* Visible HIT ZONE BAND — translucent gradient outer (good window)
            + brighter inner band (perfect window). Players can SEE exactly
            when a tile is in range. */}
        <div
          className="absolute left-0 right-0 z-10 pointer-events-none overflow-hidden"
          style={{
            top: `${HIT_LINE_PCT - HIT_WINDOW}%`,
            height: `${HIT_WINDOW * 2}%`,
          }}
        >
          {/* Outer good-window gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-400/0 via-indigo-400/20 to-indigo-400/0" />
          {/* Inner perfect band — glowing emerald stripe */}
          <div
            className="absolute left-0 right-0 bg-emerald-400/25 border-y border-emerald-300/50"
            style={{
              top: `${((HIT_WINDOW - PERFECT_WINDOW) / (HIT_WINDOW * 2)) * 100}%`,
              height: `${(PERFECT_WINDOW * 2 / (HIT_WINDOW * 2)) * 100}%`,
              boxShadow: "0 0 18px rgba(52,211,153,0.5) inset",
            }}
          />
        </div>

        {/* The HIT LINE itself — bright white bar that doubles as the top
            edge of the key pad (so tiles visibly land ON the keys). */}
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{
            top: `${HIT_LINE_PCT}%`,
            borderTop: "3px solid rgba(255,255,255,0.95)",
            boxShadow: "0 0 18px rgba(255,255,255,0.55)",
          }}
        />

        {/* Falling messages — all spawn on the CENTER RAIL regardless of
            their receiver lane. The player must read each message and
            infer which object lane to press. Tiles only reveal which lane
            they belonged to AFTER hit/miss (via color flash). */}
        <div className="absolute inset-0 pt-9 z-10" style={{ pointerEvents: "none" }}>
          <AnimatePresence>
            {notes.map(n => {
              const isPerfect = n.state === "perfect";
              const isGood = n.state === "good";
              const isMiss = n.state === "miss";
              const settled = isPerfect || isGood || isMiss;
              // Until the message is hit, render on the center rail. After
              // hit/miss, slide it toward its true receiver lane to TEACH
              // the player which lane the answer was.
              const laneW = 100 / objects.length;
              const trueLeft = n.lane * laneW + laneW / 2;
              const left = settled ? trueLeft : 50;
              const colorByLane = LANE_COLORS[n.lane % 4];
              const tileBg = isPerfect
                ? "linear-gradient(180deg, #34d399 0%, #10b981 100%)"
                : isGood
                ? "linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)"
                : isMiss
                ? "linear-gradient(180deg, #f87171 0%, #dc2626 100%)"
                : "linear-gradient(180deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.95) 100%)";
              const tileBorder = isPerfect ? "#10b981" : isGood ? "#f59e0b" : isMiss ? "#dc2626" : "rgba(255,255,255,0.35)";
              return (
                <motion.div
                  key={n.id}
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{
                    scale: isPerfect ? 1.18 : isGood ? 1.1 : 1,
                    opacity: n.state === "alive" || settled ? 1 : 0,
                    left: `${left}%`,
                  }}
                  exit={{ opacity: 0, scale: 1.4 }}
                  transition={{ duration: settled ? 0.35 : 0.18 }}
                  className="absolute flex items-center justify-center"
                  style={{
                    top: `${n.y}%`,
                    width: `${Math.min(60, laneW * 0.96)}%`,
                    height: 60,
                    transform: "translate(-50%, -50%)",
                    willChange: "transform, top, left",
                  }}
                >
                  <div
                    className="rounded-lg w-full h-full flex items-center justify-center px-2 text-center"
                    style={{
                      background: tileBg,
                      border: `2px solid ${tileBorder}`,
                      boxShadow: `0 4px 12px rgba(0,0,0,0.45), 0 0 ${isPerfect ? 24 : isGood ? 18 : isMiss ? 14 : 6}px ${settled ? colorByLane + "88" : "rgba(148,163,184,0.4)"}, inset 0 1px 0 rgba(255,255,255,0.25)`,
                    }}
                  >
                    <p className="text-[11px] font-extrabold leading-tight text-white line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                      {n.text}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Center rail visual — a faint vertical guide showing where new
            messages spawn before the player routes them to a lane. */}
        <div
          className="absolute pointer-events-none z-[5]"
          style={{
            top: "9%",
            bottom: `${100 - HIT_LINE_PCT}%`,
            left: "50%",
            width: 2,
            background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.04) 100%)",
            transform: "translateX(-50%)",
          }}
        />

        {/* KEY PAD — chunky piano-key strip at the bottom of the play area.
            Pointer-events-none: the lane buttons underneath still receive
            taps. Pressed lanes flash bright + scale up briefly. */}
        <div
          className="absolute left-0 right-0 z-30 pointer-events-none grid"
          style={{
            top: `${HIT_LINE_PCT}%`,
            bottom: 0,
            gridTemplateColumns: `repeat(${objects.length}, 1fr)`,
          }}
        >
          {objects.map((obj, i) => {
            const isPressed = pressedLane === i;
            const color = LANE_COLORS[i % 4];
            return (
              <div
                key={i}
                className="border-r border-white/10 last:border-r-0 flex flex-col items-center justify-center transition-all duration-100 px-1"
                style={{
                  background: isPressed
                    ? `linear-gradient(180deg, ${color}66 0%, ${color}33 60%, transparent 100%)`
                    : "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.75) 100%)",
                  borderTop: `3px solid ${color}`,
                  boxShadow: isPressed ? `inset 0 8px 20px ${color}88, 0 -2px 16px ${color}66` : "inset 0 1px 0 rgba(255,255,255,0.08)",
                  transform: isPressed ? "scaleY(0.96)" : "scaleY(1)",
                  transformOrigin: "top",
                }}
              >
                <kbd
                  className="text-lg font-mono font-bold text-white rounded-md px-2.5 py-1 mb-1 border"
                  style={{
                    background: isPressed ? `${color}AA` : "rgba(255,255,255,0.12)",
                    borderColor: isPressed ? color : "rgba(255,255,255,0.25)",
                    boxShadow: isPressed ? `0 0 12px ${color}` : "none",
                  }}
                >
                  {SEQ_KEYS[i]?.toUpperCase()}
                </kbd>
                <div className="text-[10px] text-white/85 truncate max-w-full text-center font-medium">
                  {obj}
                </div>
              </div>
            );
          })}
        </div>

        {/* Big floating PERFECT! / GOOD / MISS popup over the hit line. */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              key={feedback.trigger}
              initial={{ opacity: 1, y: 0, scale: 0.7 }}
              animate={{ opacity: 0, y: -50, scale: 1.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="absolute z-40 pointer-events-none font-extrabold tracking-wide"
              style={{
                top: `${HIT_LINE_PCT - 6}%`,
                left: feedback.lane >= 0
                  ? `${(feedback.lane + 0.5) * (100 / objects.length)}%`
                  : "50%",
                transform: "translate(-50%, -50%)",
                fontSize: feedback.kind === "perfect" ? "1.5rem" : "1.15rem",
                color: feedback.kind === "perfect" ? "#34d399" : feedback.kind === "good" ? "#fbbf24" : "#f87171",
                textShadow: "0 2px 14px rgba(0,0,0,0.85), 0 0 18px currentColor",
              }}
            >
              {feedback.kind === "perfect" ? "PERFECT!" : feedback.kind === "good" ? "GOOD" : "MISS"}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Idle screen */}
        {stage === "idle" && !showHow && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur">
            <Timer className="w-10 h-10 text-indigo-400 mb-2" />
            <p className="text-base font-bold mb-1">{q.content || "Ready?"}</p>
            <p className="text-xs text-muted-foreground mb-3 max-w-xs text-center px-4">
              Hit the lane key (or tap the lane) when each message reaches the line.
            </p>
            <div className="flex gap-2 mb-4">
              {objects.map((o, i) => (
                <div key={i} className="text-center">
                  <kbd className="px-2 py-1 rounded bg-muted text-xs font-mono block">{SEQ_KEYS[i]?.toUpperCase()}</kbd>
                  <div className="text-[10px] text-muted-foreground mt-1 max-w-16 truncate">{o}</div>
                </div>
              ))}
            </div>
            <Button onClick={() => setStage("playing")} data-testid="button-start-rhythm" className="min-h-11">
              <Play className="w-4 h-4 mr-1" /> Start
            </Button>
          </div>
        )}

        {/* Done */}
        {stage === "done" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/85 backdrop-blur p-4"
          >
            {won ? <Trophy className="w-12 h-12 text-amber-400 mb-2" /> : <Lightbulb className="w-12 h-12 text-amber-400 mb-2" />}
            <p className="text-xl font-bold">{won ? "Perfect tempo!" : "Keep the beat"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {hits} / {totalNotes} hit ({accuracy}%) • {perfects} perfect • combo {maxCombo}× • +{score} pts
            </p>
          </motion.div>
        )}

        {showHow && (
          <HowToOverlay
            meta={meta}
            goal="Each message in a sequence diagram targets an actor. Hit the right lane as the message reaches the line."
            controls={[
              `Lane keys: ${SEQ_KEYS.slice(0, objects.length).map(k => k.toUpperCase()).join(" / ")} (or tap lanes).`,
              "READ each message — it falls down the CENTER. You must hit the lane of the receiving object.",
              "Perfect inside the line: +30. Good window: +15. Combo doubles bonus.",
              "Win at 70% notes hit. Esc to pause.",
            ]}
            onStart={() => { dismissHow(); setShowHow(false); }}
          />
        )}
        {paused && stage === "playing" && !showHow && (
          <PauseOverlay onResume={() => setPaused(false)} onSkip={() => { setPaused(false); setStage("done"); }} />
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-1">
        Keys: {SEQ_KEYS.slice(0, objects.length).map(k => k.toUpperCase()).join(" / ")} • Arrow keys also work • Tap lanes on mobile
      </p>

      {stage === "done" && (
        <RoundSummary
          correct={won}
          headline={won ? `+${score} pts • ${accuracy}% accuracy` : `+${score} pts • try again for ${Math.ceil(totalNotes * 0.7)}+ hits`}
          explanation={opts.explanation || "Each message targets the actor that receives it. Time flows top to bottom in a sequence diagram."}
          scoreDelta={score}
          onNext={nextRound}
          isLast={round + 1 >= totalRounds}
        />
      )}
    </div>
  );
}

// ============================================================
// CONCEPT CONTENT — what each game is *actually* teaching, plus the
// teach-back questions used to verify the learning landed.
// Lives in code (not DB) so we don't touch the schema; falls back
// gracefully if a game type is missing.
// ============================================================

interface TeachBackQ {
  prompt: string;
  options: string[];
  correctIndex: number;
  why: string;
}

interface ConceptContent {
  conceptName: string;
  bigIdea: string;
  keyTerms: { term: string; def: string }[];
  workedExample: string;
  teachBack: TeachBackQ[];
}

const CONCEPT_CONTENT: Record<string, ConceptContent> = {
  sdlc_sorter: {
    conceptName: "Software Development Life Cycle",
    bigIdea: "Every software project moves through ordered PHASES. You can't test what you haven't built; you can't build what you haven't designed. Order matters because each phase produces what the next one needs.",
    keyTerms: [
      { term: "Phase", def: "A distinct stage of work with its own deliverables (diagrams, code, test reports…)." },
      { term: "Deliverable", def: "A concrete artifact a phase produces and hands to the next phase." },
      { term: "Methodology", def: "How phases are sequenced — Waterfall (once, in order) vs Agile (small, repeated cycles)." },
    ],
    workedExample: "A team writes a use-case diagram. That's an ANALYSIS deliverable — it captures what users need before any code exists. So it belongs in the Analysis lane, not Implementation.",
    teachBack: [
      {
        prompt: "Your team just wrote a unit test that verifies the login function rejects empty passwords. Which phase did this come from?",
        options: ["Planning", "Design", "Testing", "Maintenance"],
        correctIndex: 2,
        why: "Writing tests that VERIFY existing code is the Testing phase. Designing what the login should do would be Design.",
      },
      {
        prompt: "What's the LAST thing a phase produces before handing off to the next?",
        options: ["A meeting", "A deliverable", "A bug report", "An idea"],
        correctIndex: 1,
        why: "Each phase outputs concrete deliverables (a spec, a diagram, code, a test report) that feed the next phase.",
      },
    ],
  },
  req_sorter: {
    conceptName: "Functional vs Non-Functional Requirements",
    bigIdea: "FUNCTIONAL = WHAT the system does (a feature, an action). NON-FUNCTIONAL = HOW WELL it does it (speed, security, reliability — quality attributes).",
    keyTerms: [
      { term: "Functional", def: "A behavior or feature: 'Users can reset their password.' Verbs of action." },
      { term: "Non-functional", def: "A quality the system must hold to: 'Pages load in under 2s.' Often measurable, but not a feature." },
      { term: "Tip", def: "Words like 'within X seconds', '99.9% uptime', 'must support N users' usually signal non-functional." },
    ],
    workedExample: "'The site must support 1000 simultaneous users' — that's not a feature, it's a scalability quality. Non-functional. Compare: 'The site must let users post comments' — that IS a feature. Functional.",
    teachBack: [
      {
        prompt: "'All passwords must be hashed with bcrypt before being saved.' — what kind of requirement?",
        options: ["Functional — saving is an action", "Non-functional — security/encryption is a quality"],
        correctIndex: 1,
        why: "Encryption is a security QUALITY of how data is stored, not a user-facing feature. Non-functional.",
      },
      {
        prompt: "'Customers can filter products by price range.' — what kind?",
        options: ["Functional — it's a feature the user invokes", "Non-functional — it's about the UI"],
        correctIndex: 0,
        why: "Filtering is a concrete user-facing action. Functional. (UI accessibility would be non-functional.)",
      },
    ],
  },
  usecase_builder: {
    conceptName: "Actors and Use Cases",
    bigIdea: "An ACTOR is anyone OUTSIDE the system that interacts with it. A USE CASE is one task the actor performs. The diagram answers: 'who can do what?'",
    keyTerms: [
      { term: "Actor", def: "External role — a person or another system. Drawn as a stick figure." },
      { term: "Use Case", def: "A goal the actor wants to achieve with the system. Drawn as an oval." },
      { term: "Ownership", def: "A use case connects to the actor(s) who can trigger it. Different actors usually have different use cases." },
    ],
    workedExample: "In a library, only a Librarian can 'Add a New Book' — Readers don't have that power. So 'Add Book' connects to Librarian, not Reader.",
    teachBack: [
      {
        prompt: "In an online shop, who is the actor for 'Process Refund Manually'?",
        options: ["Customer", "Admin / Support staff", "Shopping cart"],
        correctIndex: 1,
        why: "Customers REQUEST refunds, but PROCESSING them is an admin/support task. The shopping cart is part of the system, not an actor.",
      },
      {
        prompt: "Which of these is NOT a valid actor in a use case diagram?",
        options: ["A delivery driver", "A bank's payment API", "The 'orders' database table"],
        correctIndex: 2,
        why: "Database tables are INSIDE the system. Actors are external. Drivers and external APIs are external = actors.",
      },
    ],
  },
  erd_doctor: {
    conceptName: "Cardinality (1:1, 1:N, N:N)",
    bigIdea: "Cardinality answers TWO questions per relationship: 'How many on the LEFT for one on the RIGHT?' and vice versa. 1:1 means one-to-one. 1:N is one-to-many. N:N is many-to-many — and needs a junction table.",
    keyTerms: [
      { term: "1:1", def: "Each side has exactly one of the other. Rare. Example: Person ↔ Passport." },
      { term: "1:N", def: "One side has many on the other. Most common. Example: Customer → Orders." },
      { term: "N:N", def: "Both sides have many. Needs a join table. Example: Students ↔ Courses (via Enrolments)." },
    ],
    workedExample: "A Doctor sees many Patients; a Patient is seen by many Doctors over time. Both sides → many. That's N:N — model it with an Appointments table linking the two.",
    teachBack: [
      {
        prompt: "An Author can write many Books. Each Book has exactly one Author. What's the cardinality?",
        options: ["1:1", "1:N", "N:N"],
        correctIndex: 1,
        why: "One author → many books, but each book → one author. Classic 1-to-many.",
      },
      {
        prompt: "Books can be borrowed by many readers over time. Each reader can borrow many books. How would you model the relationship?",
        options: ["1:1 between Book and Reader", "1:N from Book to Reader", "N:N — needs a junction table (Loans)"],
        correctIndex: 2,
        why: "Both sides have many → N:N. You can't store this in either table directly; you need a Loans table linking them.",
      },
    ],
  },
  dfd_detective: {
    conceptName: "Data Flow Diagram Rules",
    bigIdea: "A DFD shows DATA moving through a system. Arrows always carry data. Two unbreakable rules: (1) A store NEVER connects directly to another store — a process must sit between. (2) Sources and sinks (external) connect via processes, not directly to stores.",
    keyTerms: [
      { term: "Process", def: "A circle / oval — transforms incoming data into outgoing data." },
      { term: "Store", def: "An open box — passively holds data. Cannot transform it." },
      { term: "Source / Sink", def: "A box — external entity that data comes from or goes to." },
      { term: "Flow", def: "An arrow — labeled with the data it carries." },
    ],
    workedExample: "Customer → 'Save Order' → Orders DB ✓ (source → process → store).  Orders DB → Invoices DB ✗ — that's store-to-store. Insert a 'Generate Invoice' process between them.",
    teachBack: [
      {
        prompt: "Which connection is INVALID in a DFD?",
        options: ["Customer → Process Order", "Users DB → Sessions DB", "Login Process → Users DB"],
        correctIndex: 1,
        why: "Users DB → Sessions DB is store-to-store. A process (e.g. 'Create Session') must sit between them.",
      },
      {
        prompt: "Why must arrows in a DFD be LABELED?",
        options: ["So they look pretty", "Because the label IS the data being moved", "It's optional"],
        correctIndex: 1,
        why: "Every arrow carries some specific data (an order, a credit-card #, a session token). The label names that data.",
      },
    ],
  },
  sequence_stacker: {
    conceptName: "Sequence Diagrams — Time Flows Down",
    bigIdea: "Each vertical line is one OBJECT. Horizontal arrows are MESSAGES between objects. Time flows TOP→BOTTOM. A message can only be sent AFTER everything it depends on has happened.",
    keyTerms: [
      { term: "Lifeline", def: "The vertical dashed line under each object — represents that object across time." },
      { term: "Message", def: "An arrow from sender to receiver. THE RECEIVER decides which lane the message lands in." },
      { term: "Causality", def: "A reply can't come before the request. Use this to put steps in order." },
    ],
    workedExample: "'AuthService asks Database for user' → the message GOES TO Database, so it lands in the Database lane. The Database can only REPLY in a later step, never before being asked.",
    teachBack: [
      {
        prompt: "In a flow with [User, LoginPage, AuthService, Database], the message 'AuthService verifies the password hash' lands in which lane?",
        options: ["User", "LoginPage", "AuthService — it's doing the work on itself", "Database"],
        correctIndex: 2,
        why: "When an object does work on ITSELF (a self-message), it lands in its OWN lane. AuthService is verifying — it stays in AuthService's lane.",
      },
      {
        prompt: "Why can't 'Database returns user record' come BEFORE 'AuthService asks Database for user'?",
        options: ["It's just style", "Causality — you can't reply to a question that hasn't been asked", "Random ordering is fine"],
        correctIndex: 1,
        why: "Sequence diagrams enforce causality. A reply must come after the request that triggers it. Always.",
      },
    ],
  },
};

// Pool teach-back questions for a game: per-question overrides from
// q.options.teachBack take precedence; falls back to the hardcoded set.
function pickTeachBack(gameType: string, override?: TeachBackQ[] | null): TeachBackQ | null {
  const pool = override && override.length > 0
    ? override
    : (CONCEPT_CONTENT[gameType]?.teachBack ?? []);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Merge a partial concept-card override (from q.options.conceptCard) onto
// the hardcoded fallback so seeds can customize per level without losing
// any required field.
function resolveConceptContent(
  gameType: string,
  override?: Partial<ConceptContent> | null,
): ConceptContent | null {
  const base = CONCEPT_CONTENT[gameType];
  if (!base && !override) return null;
  if (!override) return base;
  return {
    conceptName: override.conceptName ?? base?.conceptName ?? "",
    bigIdea: override.bigIdea ?? base?.bigIdea ?? "",
    keyTerms: override.keyTerms ?? base?.keyTerms ?? [],
    workedExample: override.workedExample ?? base?.workedExample ?? "",
    teachBack: override.teachBack ?? base?.teachBack ?? [],
  };
}

// LocalStorage helper — tracks per-(game type, stage) MASTERY, defined as
// "the player passed the teach-back quiz at least once for this level."
// Until mastered, the concept card replays on every attempt — tapping
// "Got it" alone never grants the skip. After mastery, the card auto-skips
// and the player goes straight into play.
function useConceptMastered(gameType: string, stageIndex: number): [boolean, () => void] {
  const key = `eduquest_mastered_${gameType}_s${stageIndex}`;
  const read = () => {
    try { return typeof window !== "undefined" && localStorage.getItem(key) === "1"; }
    catch { return false; }
  };
  const [mastered, setMastered] = useState(read);
  // Re-read when the level/game changes so the right flag is reflected.
  useEffect(() => { setMastered(read()); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const mark = useCallback(() => {
    try { localStorage.setItem(key, "1"); } catch {}
    setMastered(true);
  }, [key]);
  return [mastered, mark];
}

function ConceptCard({
  gameType, onContinue, override,
}: {
  gameType: string;
  onContinue: () => void;
  override?: Partial<ConceptContent> | null;
}) {
  const c = resolveConceptContent(gameType, override);
  const meta = SAD_GAMES[gameType];
  // Effect-based fallback so we never call setState in a parent during render.
  useEffect(() => {
    if (!c || !meta) onContinue();
  }, [c, meta, onContinue]);
  // Keyboard dismissal — Enter / Space advances past the card.
  useEffect(() => {
    if (!c || !meta) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onContinue();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c, meta, onContinue]);
  if (!c || !meta) return null;
  const Icon = meta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-xl"
      data-testid="card-concept"
    >
      <div className="glass-strong rounded-2xl border border-border/40 overflow-hidden">
        <div className={`bg-gradient-to-br ${meta.gradient} p-4 flex items-center gap-3`}>
          <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-white/70 tracking-widest">CONCEPT — {meta.title.toUpperCase()}</p>
            <h2 className="text-lg font-bold text-white truncate">{c.conceptName}</h2>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground tracking-widest mb-1">THE BIG IDEA</p>
            <p className="text-sm text-foreground/95 leading-relaxed">{c.bigIdea}</p>
          </div>

          <div>
            <p className="text-[10px] font-mono text-muted-foreground tracking-widest mb-1.5">KEY TERMS</p>
            <div className="space-y-1.5">
              {c.keyTerms.map((t, i) => (
                <div key={i} className="rounded-lg border border-border/30 bg-card/40 px-3 py-2">
                  <span className="text-xs font-bold text-primary">{t.term}</span>
                  <span className="text-xs text-muted-foreground"> — {t.def}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-mono text-amber-300/80 tracking-widest mb-1">WORKED EXAMPLE</p>
                <p className="text-xs text-foreground/90 leading-relaxed">{c.workedExample}</p>
              </div>
            </div>
          </div>

          <Button className="w-full min-h-11" onClick={onContinue} data-testid="button-concept-continue">
            Got it — let me try it <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            (You'll see this concept card once per game. The quick check at the end runs every play.)
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function TeachBackQuiz({
  gameType, alreadyMastered, onDone, override,
}: {
  gameType: string;
  alreadyMastered: boolean;
  onDone: (passed: boolean) => void;
  override?: TeachBackQ[] | null;
}) {
  // Pick once per mount so re-renders don't shuffle.
  const question = useMemo(() => pickTeachBack(gameType, override), [gameType, override]);
  const meta = SAD_GAMES[gameType];
  const [picked, setPicked] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Hooks must run unconditionally — gate the side-effect on missing content
  // INSIDE the effect rather than around an early return.
  useEffect(() => {
    if (!question || !meta) onDone(true);
  }, [question, meta, onDone]);

  if (!question || !meta) return null;

  const passed = submitted && picked === question.correctIndex;
  const newMastery = passed && !alreadyMastered;
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-xl"
      data-testid="card-teachback"
    >
      <div className="glass-strong rounded-2xl border border-border/40 overflow-hidden">
        <div className={`bg-gradient-to-br ${meta.gradient} p-4 flex items-center gap-3`}>
          <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-mono text-white/70 tracking-widest">QUICK CHECK — {meta.title.toUpperCase()}</p>
            <h2 className="text-base font-bold text-white">Did the concept land?</h2>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-foreground/95 leading-relaxed" data-testid="text-teachback-prompt">
            {question.prompt}
          </p>

          <div className="space-y-2">
            {question.options.map((opt, i) => {
              const isPicked = picked === i;
              const isCorrect = submitted && i === question.correctIndex;
              const isWrongPick = submitted && isPicked && i !== question.correctIndex;
              return (
                <button
                  key={i}
                  onClick={() => !submitted && setPicked(i)}
                  disabled={submitted}
                  className={`w-full text-left rounded-lg border-2 px-3 py-2.5 transition-all min-h-12 ${
                    isCorrect ? "border-emerald-400 bg-emerald-500/15 text-emerald-100" :
                    isWrongPick ? "border-rose-400 bg-rose-500/15 text-rose-100" :
                    isPicked ? "border-primary bg-primary/15" :
                    "border-border/40 bg-card/40 hover:border-primary/50"
                  }`}
                  data-testid={`option-teachback-${i}`}
                >
                  <span className="text-sm font-medium">{opt}</span>
                </button>
              );
            })}
          </div>

          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-lg border p-3 ${passed ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}
            >
              <div className="flex items-start gap-2">
                {passed
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  : <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className={`text-xs font-bold ${passed ? "text-emerald-300" : "text-amber-300"}`}>
                    {passed ? "Concept confirmed!" : "Not quite — here's why:"}
                  </p>
                  <p className="text-xs text-foreground/85 mt-1 leading-relaxed">{question.why}</p>
                  {newMastery && (
                    <p className="text-xs text-emerald-300 mt-1.5 font-mono" data-testid="text-mastery-unlocked">
                      ★ Concept mastered — this level's intro card is unlocked.
                    </p>
                  )}
                  {passed && !newMastery && (
                    <p className="text-xs text-emerald-300/80 mt-1.5 font-mono">Already mastered — nicely done.</p>
                  )}
                  {!passed && (
                    <p className="text-xs text-amber-200/90 mt-1.5">Your level score is safe — give the concept another try next round.</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {!submitted ? (
            <Button
              className="w-full min-h-11"
              onClick={() => setSubmitted(true)}
              disabled={picked === null}
              data-testid="button-teachback-submit"
            >
              Submit answer
            </Button>
          ) : (
            <Button
              className="w-full min-h-11"
              onClick={() => onDone(passed)}
              data-testid="button-teachback-finish"
            >
              Continue <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// MAIN DISPATCHER
// ============================================================

export function SADGameRunner({
  gameType, questions, onComplete,
  difficulty = 0, stageIndex = 0, totalStages = 1,
}: {
  gameType: string;
  questions: any[];
  onComplete: (score: number) => void;
  difficulty?: number;
  stageIndex?: number;
  totalStages?: number;
}) {
  // 3-phase wrapper: concept (until mastered) → play → teach-back quiz.
  // Mastery is set only when the teach-back is passed; "Got it" alone never
  // grants the skip. Wrong teach-back answers never reduce the base score.
  const [mastered, markMastered] = useConceptMastered(gameType, stageIndex);
  const [phase, setPhase] = useState<"concept" | "play" | "quiz">(
    mastered ? "play" : "concept"
  );
  const [gameScore, setGameScore] = useState(0);

  // Per-question overrides from the JSONB options column. Take the first
  // question's overrides as the level-level concept content (concept is per
  // level, not per round).
  const conceptOverride = (questions?.[0]?.options?.conceptCard ?? null) as Partial<ConceptContent> | null;
  const teachBackOverride = (questions?.[0]?.options?.teachBack ?? null) as TeachBackQ[] | null;

  // Reset whenever the user switches game/stage; depend on `mastered` so the
  // LS lookup catching up correctly transitions the phase.
  useEffect(() => {
    setPhase(mastered ? "play" : "concept");
    setGameScore(0);
  }, [gameType, stageIndex, mastered]);

  // If the question pool is empty, just show the friendly empty-state.
  if (!questions || questions.length === 0) {
    return (
      <div className="glass-strong rounded-xl p-6 border border-amber-500/30 text-center max-w-md">
        <Sparkles className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          This game has no rounds yet. Tell your professor to add some!
        </p>
        <Button className="mt-4" onClick={() => onComplete(0)}>Back</Button>
      </div>
    );
  }

  if (phase === "concept") {
    return (
      <ConceptCard
        gameType={gameType}
        override={conceptOverride}
        onContinue={() => setPhase("play")}
      />
    );
  }

  if (phase === "quiz") {
    return (
      <TeachBackQuiz
        gameType={gameType}
        alreadyMastered={mastered}
        override={teachBackOverride}
        onDone={(passed) => {
          if (passed) markMastered();
          onComplete(gameScore);
        }}
      />
    );
  }

  // Re-mount the game whenever the active stage changes so its internal
  // round/score/refs are reset cleanly. The wrapped onComplete diverts to
  // the teach-back quiz before propagating the final score.
  const k = `${gameType}-s${stageIndex}`;
  const handleGameComplete = (s: number) => {
    setGameScore(s);
    setPhase("quiz");
  };
  const props = {
    questions,
    onComplete: handleGameComplete,
    difficulty,
    stageIndex,
    totalStages,
  };

  switch (gameType) {
    case "sdlc_sorter":      return <PhaseRunner        key={k} {...props} />;
    case "req_sorter":       return <RequirementHighway key={k} {...props} />;
    case "usecase_builder":  return <UseCaseDefense    key={k} {...props} />;
    case "erd_doctor":       return <ERCityBuilder     key={k} {...props} />;
    case "dfd_detective":    return <DataFlowPlumber   key={k} {...props} />;
    case "sequence_stacker": return <SequenceRhythm    key={k} {...props} />;
    default:
      return (
        <div className="text-center text-muted-foreground p-6">
          <Info className="w-8 h-8 mx-auto mb-2" />
          <p>Unknown SAD game type: <code className="font-mono">{gameType}</code></p>
        </div>
      );
  }
}

// ============================================================
// Difficulty helpers — exported so game.tsx + topic.tsx can show labels.
// ============================================================

export function difficultyLabel(d: number): { label: string; color: string } {
  if (d < 0.01) return { label: "EASY",   color: "text-emerald-300" };
  if (d < 0.5)  return { label: "NORMAL", color: "text-cyan-300" };
  if (d < 0.85) return { label: "HARD",   color: "text-amber-300" };
  return                 { label: "EXPERT", color: "text-rose-300" };
}
