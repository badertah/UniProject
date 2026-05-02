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
    title: "Requirement Hunter",
    short: "Requirements describe what a system must do — and how well it must do it.",
    detail: "Functional requirements describe WHAT the system does (login, search, purchase). Non-functional requirements describe HOW WELL it does it (speed, security, usability).",
    howTo: "Click office hotspots to discover hidden requirements. Then tap each card to send it to the Functional or Non-Functional bucket.",
    icon: Target,
    color: "text-emerald-300",
    gradient: "from-emerald-500 to-teal-700",
    emoji: "🔎",
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
    howTo: "Each message falls toward an actor's lane. Hit the lane key (D / F / J / K) or tap the lane just as the note crosses the line for combo.",
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
  const PR_HEARTS = Math.max(1, 3 - Math.floor(_d * 2)); // 3, 3, 2, 1

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
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0); // sweeps through phases as round progresses
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
  const phaseIdxRef = useRef(0);
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
    setCurrentPhaseIdx(0);
    objectsRef.current = [];
    timeLeftRef.current = ROUND_DURATION_SEC;
    phaseIdxRef.current = 0;
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

    // 2) Compute the swept target phase index.
    const segmentDur = ROUND_DURATION_SEC / laneCount;
    const newIdx = Math.min(laneCount - 1, Math.floor(elapsedNow / segmentDur));
    const phaseChanged = newIdx !== phaseIdxRef.current;
    phaseIdxRef.current = newIdx;

    // 3) Decide whether to spawn this frame.
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
        // 70% of deliverables target the CURRENT phase (teaches order); 30% random for variety.
        const targetLane = Math.random() < 0.7 ? newIdx : Math.floor(Math.random() * laneCount);
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
        if (o.type === "deliverable") missedDelta++;
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
    if (phaseChanged) setCurrentPhaseIdx(newIdx);
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
    if (timeJustHitZero) setRoundOver(true);
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
              {Array.from({ length: 3 }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-3 h-3 ${i < hearts ? "text-rose-400 fill-rose-400" : "text-muted/40"} ${i > 0 ? "ml-0.5" : ""}`}
                />
              ))}
            </Badge>
            <Badge variant="outline" className="bg-violet-500/30 backdrop-blur text-violet-100 border-violet-400/60 font-bold" data-testid="badge-current-phase">
              ➤ Phase {currentPhaseIdx + 1}/{laneCount}: {phases[currentPhaseIdx]}
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
              const isTarget = i === currentPhaseIdx;
              const isPlayerHere = lane === i;
              return (
                <button
                  key={i}
                  className={`relative border-b border-border/20 transition-all text-left ${
                    isTarget ? "bg-violet-500/15 ring-1 ring-inset ring-violet-400/40" : ""
                  } ${isPlayerHere ? "bg-violet-500/20" : "hover:bg-violet-500/5"}`}
                  onClick={() => setLane(i)}
                  aria-label={`Switch to ${phaseLabel} lane`}
                  data-testid={`lane-${i}`}
                >
                  <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono pointer-events-none ${
                    isPlayerHere ? "text-violet-100 font-bold" :
                    isTarget ? "text-violet-200 font-semibold" :
                    "text-muted-foreground/50"
                  }`}>
                    {isTarget && "▸ "}{phaseLabel}
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
                "The HUD shows the current phase — most deliverables come from there.",
                "Lanes are arranged top-to-bottom in the canonical phase order.",
                "3 hearts. Bugs cost 1. Catch ≥ 80% to win. Esc to pause.",
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
// 2. REQUIREMENT HUNTER — hunt then sort. Uses real seeded reqs.
// ============================================================

const HOTSPOTS = [
  { id: "desk",       icon: "💻", label: "Dev desk" },
  { id: "whiteboard", icon: "📝", label: "Whiteboard" },
  { id: "coffee",     icon: "☕", label: "Coffee corner" },
  { id: "boss",       icon: "👔", label: "Manager office" },
  { id: "server",     icon: "🖥️", label: "Server rack" },
  { id: "window",     icon: "🪟", label: "Bulletin board" },
];

function RequirementHunter({ questions, onComplete }: SADGameProps) {
  const meta = SAD_GAMES.req_sorter;
  const [howSeen, dismissHow] = useHowTo("req_sorter");
  const [showHow, setShowHow] = useState(!howSeen);

  // Treat the entire question set as ONE game (10 cards).
  // Map each question to a hotspot.
  const cards = useMemo(() => {
    return questions.map((q, i) => ({
      id: `c${i}`,
      hotspotId: HOTSPOTS[i % HOTSPOTS.length].id,
      content: q.content,
      answer: q.answer as "functional" | "non_functional",
      explanation: q.options?.explanation || "",
    }));
  }, [questions]);

  const cardsByHotspot = useMemo(() => {
    const m: Record<string, typeof cards> = {};
    HOTSPOTS.forEach(h => { m[h.id] = []; });
    cards.forEach(c => m[c.hotspotId].push(c));
    return m;
  }, [cards]);

  const [revealed, setRevealed] = useState<string[]>([]); // card ids
  const [stage, setStage] = useState<"hunt" | "sort" | "done">("hunt");
  const [pendingId, setPendingId] = useState<string | null>(null); // currently shown card
  const [results, setResults] = useState<Record<string, "correct" | "wrong" | "retry">>({});
  const [retries, setRetries] = useState<Set<string>>(new Set());
  const [shake, setShake] = useState(0);
  const [burst, setBurst] = useState({ trigger: 0, x: 0, y: 0 });
  const [score, setScore] = useState(0);
  const [paused, setPaused] = usePause(stage !== "done" && !showHow);

  const totalRounds = 1; // single combined round of all cards
  const huntComplete = revealed.length >= cards.length;

  function clickHotspot(id: string) {
    const list = cardsByHotspot[id];
    const next = list.find(c => !revealed.includes(c.id));
    if (!next) return;
    setRevealed(r => [...r, next.id]);
    setBurst({ trigger: Date.now(), x: 0, y: 0 });
  }

  function startSort() {
    setStage("sort");
    setPendingId(cards[0]?.id || null);
  }

  function sortInto(bucket: "functional" | "non_functional") {
    if (!pendingId) return;
    const card = cards.find(c => c.id === pendingId);
    if (!card) return;
    const correct = card.answer === bucket;
    if (correct) {
      const wasRetry = retries.has(card.id);
      const delta = wasRetry ? 5 : 15;
      setScore(s => s + delta);
      setResults(r => ({ ...r, [card.id]: wasRetry ? "retry" : "correct" }));
      setBurst({ trigger: Date.now(), x: bucket === "functional" ? 80 : 240, y: 380 });
      // Move to next pending
      const remaining = cards.filter(c => !results[c.id] && c.id !== card.id);
      const nextCard = remaining[0];
      if (nextCard) {
        setTimeout(() => setPendingId(nextCard.id), 300);
      } else {
        setTimeout(() => {
          setStage("done");
        }, 350);
      }
    } else {
      // Wrong
      setShake(Date.now());
      if (!retries.has(card.id)) {
        setRetries(s => new Set([...Array.from(s), card.id]));
        // Card stays for retry
      } else {
        // Already retried once → mark wrong and move on
        setResults(r => ({ ...r, [card.id]: "wrong" }));
        const remaining = cards.filter(c => !results[c.id] && c.id !== card.id);
        const nextCard = remaining[0];
        setTimeout(() => {
          if (nextCard) setPendingId(nextCard.id);
          else setStage("done");
        }, 600);
      }
    }
  }

  const correctCount = Object.values(results).filter(r => r === "correct" || r === "retry").length;
  const won = correctCount >= Math.ceil(cards.length * 0.7);
  const pendingCard = cards.find(c => c.id === pendingId);
  const isRetry = pendingCard ? retries.has(pendingCard.id) : false;
  const sortedCount = Object.keys(results).length;

  const explanation = useMemo(() => {
    // Show the explanation of the most recent wrong card, or a generic one
    const wrongIds = Object.entries(results).filter(([, v]) => v === "wrong").map(([k]) => k);
    if (wrongIds.length > 0) {
      const c = cards.find(cd => cd.id === wrongIds[wrongIds.length - 1]);
      if (c?.explanation) return c.explanation;
    }
    return "Functional requirements describe WHAT the system does. Non-functional requirements describe HOW WELL it does it (speed, security, accessibility).";
  }, [results, cards]);

  return (
    <div className="w-full max-w-xl select-none">
      <RoundHeader
        index={0}
        total={totalRounds}
        label={stage === "hunt" ? "Step 1: Hunt for requirements" : stage === "sort" ? "Step 2: Sort the cards" : "Done"}
        onPause={() => setPaused(p => !p)}
      />

      <ScreenShake trigger={shake}>
        <div className="glass-strong rounded-xl border border-border/40 overflow-hidden relative" style={{ minHeight: 440 }}>
          {/* HUD */}
          <div className="absolute top-2 left-2 right-2 z-20 flex justify-between items-center pointer-events-none">
            <Badge variant="outline" className="bg-background/70 backdrop-blur text-emerald-300" data-testid="badge-found">
              📓 {revealed.length}/{cards.length} found
            </Badge>
            <Badge variant="outline" className="bg-background/70 backdrop-blur text-amber-300">
              ⭐ {score}
            </Badge>
          </div>

          {/* HUNT */}
          {stage === "hunt" && (
            <div className="p-4 pt-10">
              <p className="text-xs text-muted-foreground mb-3 font-mono text-center">
                CLICK A HOTSPOT TO REVEAL A REQUIREMENT
              </p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {HOTSPOTS.map(h => {
                  const remaining = cardsByHotspot[h.id].filter(c => !revealed.includes(c.id)).length;
                  const exhausted = remaining === 0;
                  return (
                    <motion.button
                      key={h.id}
                      whileHover={!exhausted ? { scale: 1.04 } : {}}
                      whileTap={!exhausted ? { scale: 0.96 } : {}}
                      onClick={() => clickHotspot(h.id)}
                      disabled={exhausted}
                      className={`min-h-20 rounded-xl border p-3 flex flex-col items-center justify-center gap-1 transition-all ${
                        exhausted
                          ? "bg-emerald-500/10 border-emerald-500/40 opacity-50"
                          : "bg-card/60 border-border/40 hover:border-emerald-400/60 hover:bg-emerald-500/10"
                      }`}
                      data-testid={`hotspot-${h.id}`}
                    >
                      <span className="text-2xl">{h.icon}</span>
                      <span className="text-[10px] font-semibold leading-tight text-center">{h.label}</span>
                      {!exhausted && remaining > 0 && (
                        <span className="text-[9px] text-emerald-300 font-mono">{remaining} left</span>
                      )}
                      {exhausted && <span className="text-[9px] text-emerald-300">✓ done</span>}
                    </motion.button>
                  );
                })}
              </div>

              {/* Notebook */}
              <div className="rounded-lg border border-border/40 bg-card/40 p-2 max-h-32 overflow-y-auto">
                <p className="text-[10px] font-mono text-muted-foreground mb-1.5">📓 NOTEBOOK</p>
                {revealed.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No requirements yet — click a hotspot to start.</p>
                ) : (
                  <ul className="space-y-1">
                    <AnimatePresence>
                      {revealed.map(id => {
                        const c = cards.find(c => c.id === id)!;
                        return (
                          <motion.li
                            key={id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="text-[11px] leading-snug text-foreground/90 border-l-2 border-emerald-500/50 pl-2"
                          >
                            {c.content}
                          </motion.li>
                        );
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </div>

              {huntComplete && (
                <Button className="w-full mt-3 min-h-11" onClick={startSort} data-testid="button-start-sort">
                  All found — Start sorting <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}

          {/* SORT */}
          {stage === "sort" && pendingCard && (
            <div className="p-4 pt-10 flex flex-col h-full" style={{ minHeight: 440 }}>
              <p className="text-xs text-muted-foreground mb-2 font-mono text-center">
                {sortedCount + 1} / {cards.length} • Tap the right bucket
              </p>

              {/* The card */}
              <div className="flex-1 flex items-center justify-center">
                <motion.div
                  key={pendingCard.id + (isRetry ? "r" : "")}
                  initial={{ scale: 0.85, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  className={`max-w-xs w-full rounded-xl p-4 border-2 shadow-xl ${
                    isRetry ? "bg-amber-500/10 border-amber-400/60" : "bg-card border-border/60"
                  }`}
                  data-testid="card-pending"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-mono text-muted-foreground tracking-wider">REQUIREMENT</span>
                    {isRetry && <Badge variant="outline" className="text-[9px] text-amber-300 ml-auto">RETRY</Badge>}
                  </div>
                  <p className="text-sm leading-relaxed">{pendingCard.content}</p>
                </motion.div>
              </div>

              {/* Buckets */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  className="min-h-20 rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 transition-all p-3 text-center"
                  onClick={() => sortInto("functional")}
                  data-testid="bucket-functional"
                >
                  <div className="text-2xl">⚙️</div>
                  <div className="text-xs font-bold text-emerald-300 mt-1">Functional</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">what it DOES</div>
                </button>
                <button
                  className="min-h-20 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 transition-all p-3 text-center"
                  onClick={() => sortInto("non_functional")}
                  data-testid="bucket-non-functional"
                >
                  <div className="text-2xl">📊</div>
                  <div className="text-xs font-bold text-amber-300 mt-1">Non-Functional</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">how WELL it does it</div>
                </button>
              </div>
              <Progress value={(sortedCount / cards.length) * 100} className="h-1 mt-3" />
            </div>
          )}

          {/* DONE */}
          {stage === "done" && (
            <div className="p-6 pt-12 flex flex-col items-center justify-center text-center" style={{ minHeight: 440 }}>
              {won ? <Trophy className="w-12 h-12 text-amber-400 mb-2" /> : <Lightbulb className="w-12 h-12 text-amber-400 mb-2" />}
              <p className="text-xl font-bold mb-1">{won ? "Inspector graduated!" : "Keep practicing"}</p>
              <p className="text-sm text-muted-foreground mb-3">
                {correctCount} / {cards.length} sorted correctly
              </p>
            </div>
          )}

          {showHow && (
            <HowToOverlay
              meta={meta}
              goal="Click office hotspots to discover hidden requirements, then send each one to the correct bucket."
              controls={[
                "Hotspots reveal requirement cards into your notebook.",
                "After all are found, sort each one: Functional or Non-Functional.",
                "+15 first try, +5 on retry. Wrong twice in a row = move on.",
                "Win at 70% correct.",
              ]}
              onStart={() => { dismissHow(); setShowHow(false); }}
            />
          )}
          {paused && !showHow && stage !== "done" && (
            <PauseOverlay onResume={() => setPaused(false)} />
          )}

          {/* Burst feedback */}
          {burst.trigger > 0 && (
            <motion.div
              key={burst.trigger}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2.4, opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute pointer-events-none w-12 h-12 rounded-full bg-emerald-400/40 border-2 border-emerald-300"
              style={{ left: `${burst.x || 50}%`, top: burst.y || 60, marginLeft: -24 }}
            />
          )}
        </div>
      </ScreenShake>

      {stage === "done" && (
        <RoundSummary
          correct={won}
          headline={won ? `+${score} pts — clean sort!` : `+${score} pts — review the misses`}
          explanation={explanation}
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
    let spawnedEnemy: UCDEnemy | null = null;
    if (spawned < waveOrder.current.length) {
      spawnAcc.current += dt;
      if (spawnAcc.current >= UCD_SPAWN_GAP_SEC) {
        spawnAcc.current = 0;
        const uc = waveOrder.current[spawned];
        const lane = Math.floor(Math.random() * UCD_LANES);
        const id = nextEnemyId.current++;
        spawnedEnemy = {
          id, label: uc.label, actorId: uc.actorId, lane,
          x: 100, hp: 1, defeated: false,
        };
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
                      <div className={`px-2 py-1 rounded-lg border-2 backdrop-blur shadow-lg flex items-center gap-1 transition-colors ${
                        e.defeated
                          ? "bg-emerald-500/40 border-emerald-300"
                          : "bg-rose-500/30 border-rose-400/70 hover:bg-rose-500/50"
                      }`}>
                        <span className="text-base">{e.defeated ? "💥" : "👾"}</span>
                        <span className="text-[10px] font-bold text-rose-100 leading-tight max-w-20 truncate">
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

function DataFlowPlumber({ questions, onComplete, difficulty = 0 }: SADGameProps) {
  const totalRounds = questions.length || 1;
  const meta = SAD_GAMES.dfd_detective;
  const _d = Math.max(0, Math.min(1, difficulty));
  const DFD_MAX_ATTEMPTS = Math.max(1, 2 - Math.floor(_d * 0.6)); // 2,2,2,1
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

            {attempts > 0 && !submission?.correct && attempts < 2 && (
              <p className="text-[11px] text-rose-300 text-center mt-2">
                ✗ Wrong direction. {2 - attempts} {2 - attempts === 1 ? "try" : "tries"} left.
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

      {(submission?.correct || attempts >= 2) && (
        <RoundSummary
          correct={!!submission?.correct}
          headline={submission?.correct
            ? (attempts === 1 ? "Pipe routed perfectly! +35 pts" : "Got it on the second try +15 pts")
            : `Answer: ${nodeMap.get(correctFrom)?.label} → ${nodeMap.get(correctTo)?.label}`}
          explanation={opts.explanation || "Arrows in a DFD always carry data between source/store and process, or process to store/sink."}
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

const HIT_LINE_PCT = 86;
const SEQ_KEYS = ["d", "f", "j", "k"];

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
  })), [steps, objects]);

  const [stage, setStage] = useState<"idle" | "playing" | "done">("idle");
  const [notes, setNotes] = useState<SeqNote[]>([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [perfects, setPerfects] = useState(0);
  const [misses, setMisses] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<{ kind: "perfect" | "good" | "miss"; lane: number; trigger: number } | null>(null);
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

    // 1) Spawn any due notes into a local list.
    const justSpawned: SeqNote[] = [];
    while (spawnedCount.current < noteSpec.length && noteSpec[spawnedCount.current].spawnAt <= elapsedRef.current) {
      const spec = noteSpec[spawnedCount.current];
      const id = nextId.current++;
      justSpawned.push({ id, lane: spec.lane, y: 0, text: spec.text, state: "alive" });
      spawnedCount.current++;
    }

    // 2) Move notes + count misses.
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
    // Find closest alive note in this lane near the hit line.
    const current = notesRef.current;
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
    if (bestIdx === -1) return;

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

  // Keyboard
  useEffect(() => {
    if (stage !== "playing") return;
    const handler = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const idx = SEQ_KEYS.indexOf(k);
      if (idx >= 0 && idx < objects.length) {
        e.preventDefault();
        hitLane(idx);
      }
      // Also support arrow keys
      if (e.key === "ArrowLeft" && objects.length >= 1) hitLane(0);
      else if (e.key === "ArrowDown" && objects.length >= 2) hitLane(1);
      else if (e.key === "ArrowUp" && objects.length >= 3) hitLane(2);
      else if (e.key === "ArrowRight" && objects.length >= 4) hitLane(3);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stage, objects.length, hitLane]);

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

        {/* Lanes */}
        <div className="absolute inset-0 grid pt-9" style={{ gridTemplateColumns: `repeat(${objects.length}, 1fr)` }}>
          {objects.map((obj, i) => (
            <button
              key={i}
              className="border-r border-border/20 last:border-r-0 relative cursor-pointer active:bg-indigo-500/20"
              onClick={() => hitLane(i)}
              data-testid={`lane-${i}`}
            >
              <div className="absolute bottom-0 left-0 right-0 pb-1 px-1 text-center">
                <kbd className="px-1.5 py-0.5 rounded bg-muted/60 text-[10px] font-mono mr-1">{SEQ_KEYS[i]?.toUpperCase()}</kbd>
                <div className="text-[9px] font-mono text-muted-foreground mt-0.5 truncate">{obj}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Hit line */}
        <div
          className="absolute left-0 right-0 z-10 border-t-2 border-indigo-400/60 shadow-[0_0_8px_rgba(129,140,248,0.5)]"
          style={{ top: `${HIT_LINE_PCT}%` }}
        />

        {/* Notes */}
        <div className="absolute inset-0 pt-9" style={{ pointerEvents: "none" }}>
          <AnimatePresence>
            {notes.map(n => {
              const laneW = 100 / objects.length;
              const left = n.lane * laneW + laneW / 2;
              const colorByLane = ["#a78bfa", "#22d3ee", "#fbbf24", "#f472b6"][n.lane % 4];
              return (
                <motion.div
                  key={n.id}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{
                    scale: n.state === "perfect" ? 1.3 : n.state === "good" ? 1.15 : 1,
                    opacity: n.state === "alive" ? 1 : 0,
                  }}
                  exit={{ opacity: 0 }}
                  className="absolute flex items-center justify-center px-1"
                  style={{
                    top: `${n.y}%`,
                    left: `${left}%`,
                    width: `${laneW * 0.92}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div
                    className="rounded-md px-2 py-1.5 border-2 shadow-lg backdrop-blur w-full text-center"
                    style={{
                      backgroundColor: n.state === "perfect" ? "#34d39988" : n.state === "good" ? "#fbbf2488" : `${colorByLane}40`,
                      borderColor: n.state === "perfect" ? "#10b981" : n.state === "good" ? "#f59e0b" : colorByLane,
                    }}
                  >
                    <p className="text-[10px] font-bold leading-tight text-white line-clamp-2">{n.text}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Lane flash on hit */}
        {feedback && feedback.lane >= 0 && (
          <motion.div
            key={feedback.trigger}
            initial={{ opacity: 0.55 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className={`absolute z-20 pointer-events-none ${feedback.kind === "perfect" ? "bg-emerald-400/40" : "bg-amber-400/30"}`}
            style={{
              top: `${HIT_LINE_PCT - 10}%`,
              bottom: 0,
              left: `${(feedback.lane / objects.length) * 100}%`,
              width: `${100 / objects.length}%`,
            }}
          />
        )}

        {/* Idle screen */}
        {stage === "idle" && !showHow && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/85 backdrop-blur">
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
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/85 backdrop-blur p-4"
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
              "Perfect inside the line: +30. Good window: +15. Combo doubles bonus.",
              "Win at 70% notes hit. Esc to pause.",
              "Notes appear in the order written in the seed — that's the sequence.",
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

  // Re-mount the game whenever the active stage changes so its internal
  // round/score/refs are reset cleanly without each game having to re-handle
  // a `stageIndex` prop change on its own.
  const k = `${gameType}-s${stageIndex}`;
  const props = { questions, onComplete, difficulty, stageIndex, totalStages };

  switch (gameType) {
    case "sdlc_sorter":      return <PhaseRunner       key={k} {...props} />;
    case "req_sorter":       return <RequirementHunter key={k} {...props} />;
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
