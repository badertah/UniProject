import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, XCircle, Lightbulb, Sparkles, ArrowRight,
  Layers, Boxes, Workflow, Database, Activity, ListOrdered,
  Zap, Shield, Target, Timer, Star,
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
    howTo: "Switch lanes to collect Deliverables in the correct phase and dodge Bugs. Arrow keys or tap to move.",
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
    howTo: "Explore the office and click hotspots to discover hidden requirements. Then quickly sort them into the right basket as they fall.",
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
    howTo: "Place Actor towers on the grid to stop incoming System Failures. Each enemy is weak against a specific actor-use-case combo.",
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
    howTo: "Connect buildings with roads of the right width (1 lane = 1:1, 3 lanes = 1:N, highway = N:N). Watch the traffic flow!",
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
    howTo: "Place and rotate pipe pieces on the grid before the data floods in! Connect the Source to the Sink via Processes and Stores.",
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
    howTo: "Hit the falling message arrows in the correct lane as they reach the line. Build the sequence diagram with perfect timing!",
    icon: Timer,
    color: "text-indigo-300",
    gradient: "from-indigo-500 to-blue-700",
    emoji: "🎵",
  },
};

export function isSADGame(type: string) {
  return type in SAD_GAMES;
}

// ============================================================
// Shared mini-components
// ============================================================

function RoundHeader({ index, total, label }: { index: number; total: number; label: string }) {
  return (
    <div className="w-full mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono tracking-widest text-muted-foreground">
          ROUND {index + 1} / {total}
        </span>
        <span className="text-xs font-mono text-muted-foreground">{label}</span>
      </div>
      <Progress value={((index) / total) * 100} className="h-1.5" />
    </div>
  );
}

function FeedbackBanner({ correct, explanation, onNext, last }: {
  correct: boolean; explanation: string; onNext: () => void; last: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-4 rounded-xl border p-4 ${
        correct ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30"
      }`}
    >
      <div className="flex items-start gap-3">
        {correct
          ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          : <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />}
        <div className="flex-1">
          <p className={`text-sm font-semibold mb-1 ${correct ? "text-emerald-300" : "text-amber-300"}`}>
            {correct ? "Spot on!" : "Close — here's the trick:"}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
        </div>
      </div>
      <Button size="sm" className="w-full mt-3" onClick={onNext} data-testid="button-next-round">
        {last ? "Finish" : "Next"} <ArrowRight className="w-4 h-4 ml-1" />
      </Button>
    </motion.div>
  );
}

interface SADGameProps {
  questions: any[];
  onComplete: (score: number) => void;
}

// ============================================================
// 1. PHASE RUNNER — lane-switching infinite runner
// ============================================================

const PHASES = ["Planning", "Analysis", "Design", "Implementation", "Testing", "Maintenance"];

function PhaseRunner({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0); // which phase we are in (0-5)
  const [lane, setLane] = useState(0); // 0-5
  const [objects, setObjects] = useState<{id:number; lane:number; type:string; x:number; phaseNeeded?:number}[]>([]);
  const [playing, setPlaying] = useState(true);
  const [roundScore, setRoundScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [submitted, setSubmitted] = useState(false);
  const nextId = useRef(1);
  const frameRef = useRef<number>(0);

  const q = questions[round] || {};
  const opts = (q.options || {}) as { phases?: string[]; explanation?: string; methodology?: string };
  const roundPhases = opts.phases || PHASES;

  // Spawn objects
  useEffect(() => {
    if (!playing || submitted) return;
    const interval = setInterval(() => {
      const typeRoll = Math.random();
      let type = "deliverable";
      if (typeRoll > 0.55) type = "bug";
      else if (typeRoll > 0.45) type = "gate";

      const lane = Math.floor(Math.random() * 6);
      const id = nextId.current++;
      const phaseNeeded = type === "gate" ? Math.floor(Math.random() * roundPhases.length) : undefined;

      setObjects(prev => [...prev, { id, lane, type, x: 100, phaseNeeded }]);
    }, 900);
    return () => clearInterval(interval);
  }, [playing, submitted, roundPhases.length]);

  // Move objects
  useEffect(() => {
    if (!playing || submitted) return;
    const loop = () => {
      setObjects(prev => {
        const updated = prev.map(o => ({ ...o, x: o.x - 1.2 })).filter(o => o.x > -10);
        // Check collisions with player (player is at x=8%, lane=lane)
        const playerX = 8;
        const hitRadius = 6;
        let newScore = roundScore;
        let newLives = lives;
        let hitIds: number[] = [];

        updated.forEach(o => {
          if (o.x > playerX - hitRadius && o.x < playerX + hitRadius && o.lane === lane) {
            hitIds.push(o.id);
            if (o.type === "deliverable") newScore += 10;
            else if (o.type === "bug") newLives -= 1;
            else if (o.type === "gate") {
              if (o.phaseNeeded === phaseIndex) newScore += 25;
              else newLives -= 1;
            }
          }
        });

        if (newLives !== lives) setLives(newLives);
        if (newScore !== roundScore) setRoundScore(newScore);

        // Check game over
        if (newLives <= 0) {
          setPlaying(false);
          setSubmitted(true);
          setScore(s => s + newScore);
        }

        // Check win condition (score >= 150)
        if (newScore >= 150) {
          setPlaying(false);
          setSubmitted(true);
          setScore(s => s + newScore);
        }

        return updated.filter(o => !hitIds.includes(o.id));
      });
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [playing, submitted, lane, phaseIndex, roundScore, lives]);

  // Auto-advance phase every 4 seconds
  useEffect(() => {
    if (!playing || submitted) return;
    const iv = setInterval(() => {
      setPhaseIndex(p => (p + 1) % roundPhases.length);
    }, 4000);
    return () => clearInterval(iv);
  }, [playing, submitted, roundPhases.length]);

  const moveLane = (delta: number) => {
    setLane(l => Math.max(0, Math.min(5, l + delta)));
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") moveLane(-1);
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") moveLane(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else {
      setRound(r => r + 1);
      setLane(0);
      setPhaseIndex(0);
      setObjects([]);
      setPlaying(true);
      setRoundScore(0);
      setLives(3);
      setSubmitted(false);
    }
  }

  return (
    <div className="w-full max-w-xl select-none">
      <RoundHeader index={round} total={rounds} label={opts.methodology || "Phase Runner"} />
      <div className="glass-strong rounded-xl border border-border/40 overflow-hidden relative" style={{ height: 420 }}>
        {/* HUD */}
        <div className="absolute top-3 left-3 right-3 z-20 flex justify-between items-center">
          <Badge variant="outline" className="bg-background/60 backdrop-blur">❤️ {lives}</Badge>
          <Badge variant="outline" className="bg-background/60 backdrop-blur text-amber-300">⭐ {roundScore} / 150</Badge>
          <Badge variant="outline" className="bg-background/60 backdrop-blur text-violet-300">{roundPhases[phaseIndex]}</Badge>
        </div>

        {/* Lanes */}
        <div className="absolute inset-0 grid grid-rows-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`border-b border-border/20 relative ${lane === i ? "bg-primary/10" : ""}`}
              onClick={() => setLane(i)}
            >
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/40">{roundPhases[i] || PHASES[i]}</span>
            </div>
          ))}
        </div>

        {/* Moving grid lines for speed sensation */}
        <motion.div
          animate={{ backgroundPositionX: ["0%", "-20%"] }}
          transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.3) 40px, rgba(255,255,255,0.3) 41px)", backgroundSize: "200% 100%" }}
        />

        {/* Objects */}
        <AnimatePresence>
          {objects.map(o => (
            <motion.div
              key={o.id}
              initial={{ x: "100%" }}
              animate={{ x: `${o.x}%` }}
              exit={{ opacity: 0, scale: 0 }}
              className="absolute z-10 flex items-center justify-center"
              style={{ top: `${(o.lane / 6) * 100 + 6}%`, width: 32, height: 32 }}
            >
              {o.type === "deliverable" && <div className="w-7 h-7 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)] flex items-center justify-center text-xs">📦</div>}
              {o.type === "bug" && <div className="w-7 h-7 rounded bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] flex items-center justify-center text-xs">🐛</div>}
              {o.type === "gate" && (
                <div className={`w-8 h-8 rounded border-2 flex items-center justify-center text-[10px] font-bold ${o.phaseNeeded === phaseIndex ? "border-emerald-400 bg-emerald-500/20 text-emerald-300" : "border-amber-400 bg-amber-500/20 text-amber-300"}`}>
                  {roundPhases[o.phaseNeeded || 0]?.slice(0,3)}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Player */}
        <motion.div
          className="absolute z-10"
          animate={{ top: `${(lane / 6) * 100 + 6}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          style={{ left: "5%", width: 36, height: 36 }}
        >
          <div className="w-9 h-9 rounded-lg bg-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.7)] flex items-center justify-center text-lg">🏃</div>
        </motion.div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mt-3">
        <Button variant="outline" className="flex-1" onClick={() => moveLane(-1)}>⬆️ Up</Button>
        <Button variant="outline" className="flex-1" onClick={() => moveLane(1)}>⬇️ Down</Button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-1">Arrow keys or W/S also work</p>

      {submitted && (
        <FeedbackBanner
          correct={roundScore >= 150}
          explanation={opts.explanation || `You scored ${roundScore}. Collect deliverables in the matching phase and avoid bugs!`}
          onNext={next}
          last={round + 1 >= rounds}
        />
      )}
    </div>
  );
}

// ============================================================
// 2. REQUIREMENT HUNTER — hidden object + falling sort frenzy
// ============================================================

function RequirementHunter({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [stage, setStage] = useState<"explore" | "frenzy" | "done">("explore");
  const [found, setFound] = useState<string[]>([]);
  const [falling, setFalling] = useState<{id:number; text:string; answer:string; y:number; x:number}[]>([]);
  const [roundScore, setRoundScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const nextId = useRef(1);
  const frameRef = useRef<number>(0);

  const q = questions[round] || {};
  const opts = (q.options || {}) as { explanation?: string };

  // Generate hotspots based on round content
  const hotspots = useMemo(() => {
    const base = [
      { id: "desk", icon: "💻", label: "Dev Desk", req: "The user must be able to log in with their email and password." },
      { id: "whiteboard", icon: "📝", label: "Whiteboard", req: "Users can search for a product by its name or barcode." },
      { id: "coffee", icon: "☕", label: "Coffee Machine", req: "The system must respond to every page request in under 2 seconds." },
      { id: "boss", icon: "👔", label: "Boss Office", req: "All passwords must be encrypted using bcrypt before storage." },
      { id: "server", icon: "🖥️", label: "Server Rack", req: "The website must be available 99.9% of the time." },
      { id: "window", icon: "🪟", label: "Window", req: "Customers can add items to a shopping cart and check out." },
    ];
    // Shuffle for variety per round
    const shuffled = [...base].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4 + round);
  }, [round]);

  function clickSpot(spot: typeof hotspots[0]) {
    if (found.includes(spot.id)) return;
    const next = [...found, spot.id];
    setFound(next);
    if (next.length >= hotspots.length) {
      // Start frenzy after brief delay
      setTimeout(() => setStage("frenzy"), 800);
    }
  }

  // Frenzy: spawn falling requirements
  useEffect(() => {
    if (stage !== "frenzy" || submitted) return;

    const spawn = setInterval(() => {
      const isFunc = Math.random() > 0.5;
      const funcTexts = [
        "User can log in",
        "User can search products",
        "Admin can ban users",
        "Customer can checkout",
        "User can reset password",
      ];
      const nonFuncTexts = [
        "System responds in <2s",
        "Passwords encrypted",
        "99.9% uptime",
        "WCAG accessible",
        "Supports 10k users",
      ];
      const text = isFunc ? funcTexts[Math.floor(Math.random() * funcTexts.length)] : nonFuncTexts[Math.floor(Math.random() * nonFuncTexts.length)];
      const id = nextId.current++;
      setFalling(prev => [...prev, { id, text, answer: isFunc ? "functional" : "non_functional", y: -5, x: 10 + Math.random() * 80 }]);
    }, 1200);

    // Move falling items
    const loop = () => {
      setFalling(prev => {
        const updated = prev.map(p => ({ ...p, y: p.y + 0.6 })).filter(p => p.y < 105);
        return updated;
      });
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);

    // End frenzy after 20 seconds
    const end = setTimeout(() => {
      cancelAnimationFrame(frameRef.current);
      clearInterval(spawn);
      setSubmitted(true);
      setScore(s => s + roundScore);
      setStage("done");
    }, 20000);

    return () => {
      clearInterval(spawn);
      clearTimeout(end);
      cancelAnimationFrame(frameRef.current);
    };
  }, [stage, submitted, roundScore]);

  function catchReq(id: number, bucket: "functional" | "non_functional") {
    setFalling(prev => {
      const item = prev.find(p => p.id === id);
      if (!item) return prev;
      const correct = item.answer === bucket;
      if (correct) setRoundScore(s => s + 15);
      else setRoundScore(s => Math.max(0, s - 5));
      return prev.filter(p => p.id !== id);
    });
  }

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else {
      setRound(r => r + 1);
      setFound([]);
      setFalling([]);
      setStage("explore");
      setRoundScore(0);
      setSubmitted(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <RoundHeader index={round} total={rounds} label="Requirement Hunter" />
      <div className="glass-strong rounded-xl border border-border/40 overflow-hidden relative" style={{ height: 400 }}>
        {stage === "explore" && (
          <div className="absolute inset-0 p-4">
            <p className="text-xs text-muted-foreground mb-3 font-mono">EXPLORE THE OFFICE — CLICK TO FIND REQUIREMENTS</p>
            <div className="grid grid-cols-2 gap-3 h-full pb-8">
              {hotspots.map((spot) => {
                const discovered = found.includes(spot.id);
                return (
                  <motion.button
                    key={spot.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => clickSpot(spot)}
                    className={`rounded-xl border p-4 flex flex-col items-center justify-center gap-2 transition-all ${
                      discovered ? "bg-emerald-500/10 border-emerald-500/40" : "bg-card/60 border-border/40 hover:border-primary/40"
                    }`}
                  >
                    <span className="text-3xl">{spot.icon}</span>
                    <span className="text-xs font-semibold">{spot.label}</span>
                    {discovered && (
                      <motion.span initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-emerald-300 text-center leading-tight">
                        Found!
                      </motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <Badge variant="outline" className="bg-background/60">Found {found.length} / {hotspots.length}</Badge>
            </div>
          </div>
        )}

        {stage === "frenzy" && (
          <div className="absolute inset-0">
            <p className="absolute top-2 left-2 right-2 text-center text-xs font-mono text-amber-300 z-20">SORT THE FALLING REQUIREMENTS!</p>
            {/* Falling items */}
            <AnimatePresence>
              {falling.map(item => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute z-10 rounded-lg border bg-card/90 px-3 py-2 text-xs font-medium shadow-lg"
                  style={{ left: `${item.x}%`, top: `${item.y}%`, transform: "translateX(-50%)" }}
                  onClick={() => {}}
                >
                  {item.text}
                </motion.button>
              ))}
            </AnimatePresence>

            {/* Buckets */}
            <div className="absolute bottom-0 left-0 right-0 grid grid-cols-2 gap-2 p-2 z-20">
              <button
                className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 p-3 text-center hover:bg-emerald-500/20 active:scale-95 transition-all"
                onClick={() => {
                  // Catch the lowest functional item
                  const target = falling.filter(f => f.answer === "functional").sort((a,b) => b.y - a.y)[0];
                  if (target) catchReq(target.id, "functional");
                }}
              >
                <div className="text-lg">⚙️</div>
                <div className="text-xs font-bold text-emerald-300">Functional</div>
              </button>
              <button
                className="rounded-lg border-2 border-amber-500/40 bg-amber-500/10 p-3 text-center hover:bg-amber-500/20 active:scale-95 transition-all"
                onClick={() => {
                  const target = falling.filter(f => f.answer === "non_functional").sort((a,b) => b.y - a.y)[0];
                  if (target) catchReq(target.id, "non_functional");
                }}
              >
                <div className="text-lg">📊</div>
                <div className="text-xs font-bold text-amber-300">Non-Functional</div>
              </button>
            </div>

            <div className="absolute top-2 right-2 z-20">
              <Badge variant="outline" className="bg-background/60 text-amber-300">⭐ {roundScore}</Badge>
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
            <Sparkles className="w-10 h-10 text-amber-400 mb-3" />
            <p className="text-lg font-bold mb-1">Round Complete!</p>
            <p className="text-sm text-muted-foreground mb-4">Score: {roundScore}</p>
            <Button onClick={next} data-testid="button-next-round">
              {round + 1 >= rounds ? "Finish" : "Next Round"}
            </Button>
          </div>
        )}
      </div>

      {submitted && stage !== "done" && (
        <FeedbackBanner
          correct={roundScore >= 60}
          explanation={opts.explanation || "Functional = what the system DOES. Non-functional = how WELL it does it."}
          onNext={next}
          last={round + 1 >= rounds}
        />
      )}
    </div>
  );
}

// ============================================================
// 3. USE CASE DEFENSE — tower defense
// ============================================================

function UseCaseDefense({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [enemies, setEnemies] = useState<{id:number; x:number; y:number; hp:number; maxHp:number; type:string; weakness:string; label:string}[]>([]);
  const [towers, setTowers] = useState<{id:number; col:number; row:number; actorId:string; label:string; emoji:string; range:number; cooldown:number}[]>([]);
  const [selectedActor, setSelectedActor] = useState<string | null>(null);
  const [roundScore, setRoundScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [waveActive, setWaveActive] = useState(false);
  const nextId = useRef(1);
  const frameRef = useRef<number>(0);

  const q = questions[round] || {};
  const opts = (q.options || {}) as {
    actors?: { id: string; label: string; emoji?: string }[];
    useCases?: { label: string; actorId: string }[];
    explanation?: string;
  };
  const actors = opts.actors || [
    { id: "reader", label: "Reader", emoji: "📖" },
    { id: "librarian", label: "Librarian", emoji: "🧑‍💼" },
  ];

  const GRID_COLS = 6;
  const GRID_ROWS = 4;

  // Wave spawning
  useEffect(() => {
    if (!waveActive || submitted) return;
    const spawnInterval = setInterval(() => {
      const types = ["Login Failure", "Payment Crash", "Data Break", "Search Timeout", "Bug Report"];
      const type = types[Math.floor(Math.random() * types.length)];
      const weakness = actors[Math.floor(Math.random() * actors.length)].id;
      const id = nextId.current++;
      setEnemies(prev => [...prev, { id, x: GRID_COLS - 1, y: Math.floor(Math.random() * GRID_ROWS), hp: 3, maxHp: 3, type, weakness, label: type }]);
    }, 2000);
    return () => clearInterval(spawnInterval);
  }, [waveActive, submitted, actors]);

  // Game loop: move enemies, tower attacks
  useEffect(() => {
    if (!waveActive || submitted) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      setEnemies(prevEnemies => {
        let updated = prevEnemies.map(e => ({ ...e, x: e.x - 0.3 * dt * 2 }));
        // Tower attacks
        setTowers(prevTowers => {
          const newTowers = prevTowers.map(t => {
            const newCd = Math.max(0, t.cooldown - dt);
            if (newCd <= 0) {
              // Find enemy in range
              const target = updated.find(e => {
                const dist = Math.abs(e.x - t.col) + Math.abs(e.y - t.row);
                return dist <= t.range && e.weakness === t.actorId;
              });
              if (target) {
                updated = updated.map(e => e.id === target.id ? { ...e, hp: e.hp - 1 } : e);
                return { ...t, cooldown: 1.2 };
              }
            }
            return { ...t, cooldown: newCd };
          });
          return newTowers;
        });

        updated = updated.filter(e => e.hp > 0 && e.x > -0.5);

        // Score for kills
        const killed = prevEnemies.length - updated.length;
        if (killed > 0) setRoundScore(s => s + killed * 20);

        // Win condition
        if (updated.length === 0 && prevEnemies.length > 0) {
          setWaveActive(false);
          setSubmitted(true);
          setScore(s => s + roundScore + 50);
        }

        // Lose condition: enemy reaches left
        if (updated.some(e => e.x <= 0)) {
          setWaveActive(false);
          setSubmitted(true);
          setScore(s => s + roundScore);
        }

        return updated;
      });

      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [waveActive, submitted, roundScore]);

  function placeTower(col: number, row: number) {
    if (!selectedActor || submitted || waveActive) return;
    const actor = actors.find(a => a.id === selectedActor);
    if (!actor) return;
    // Check if occupied
    if (towers.some(t => t.col === col && t.row === row)) return;
    const id = nextId.current++;
    setTowers(prev => [...prev, { id, col, row, actorId: actor.id, label: actor.label, emoji: actor.emoji || "👤", range: 2, cooldown: 0 }]);
  }

  function startWave() {
    setWaveActive(true);
  }

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else {
      setRound(r => r + 1);
      setEnemies([]);
      setTowers([]);
      setSelectedActor(null);
      setRoundScore(0);
      setSubmitted(false);
      setWaveActive(false);
    }
  }

  const allPlaced = towers.length >= 3;

  return (
    <div className="w-full max-w-xl">
      <RoundHeader index={round} total={rounds} label="Use Case Defense" />
      <div className="glass-strong rounded-xl border border-border/40 overflow-hidden p-3">
        <p className="text-xs text-muted-foreground mb-2 font-mono">PLACE ACTOR TOWERS, THEN START WAVE</p>

        {/* Actor selector */}
        <div className="flex gap-2 mb-3 flex-wrap">
          {actors.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedActor(a.id)}
              className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                selectedActor === a.id ? "bg-primary/20 border-primary/50" : "bg-card/60 border-border/40 hover:border-primary/30"
              }`}
            >
              <span className="mr-1">{a.emoji || "👤"}</span>
              {a.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-6 gap-1 mb-3">
          {Array.from({ length: GRID_COLS * GRID_ROWS }).map((_, idx) => {
            const col = idx % GRID_COLS;
            const row = Math.floor(idx / GRID_COLS);
            const tower = towers.find(t => t.col === col && t.row === row);
            const enemyHere = enemies.filter(e => Math.abs(e.x - col) < 0.5 && Math.abs(e.y - row) < 0.5);
            return (
              <button
                key={idx}
                onClick={() => placeTower(col, row)}
                className={`relative rounded-md border aspect-square flex items-center justify-center text-lg transition-all ${
                  tower ? "bg-cyan-500/15 border-cyan-500/40" : "bg-card/40 border-border/30 hover:bg-primary/5"
                }`}
              >
                {tower && <span title={tower.label}>{tower.emoji}</span>}
                {enemyHere.map(e => (
                  <motion.div
                    key={e.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${e.hp < e.maxHp ? "bg-rose-500/80" : "bg-rose-500"}`}>👾</div>
                  </motion.div>
                ))}
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <div className="flex justify-between items-center">
          <Badge variant="outline" className="bg-background/60">🎯 {roundScore}</Badge>
          <Badge variant="outline" className="bg-background/60">👾 {enemies.length}</Badge>
          {!waveActive && !submitted && (
            <Button size="sm" onClick={startWave} disabled={!allPlaced}>
              Start Wave
            </Button>
          )}
        </div>
      </div>

      {submitted && (
        <FeedbackBanner
          correct={roundScore >= 50}
          explanation={opts.explanation || "Each enemy is weak against a specific actor. Place the right actor towers to cover the grid!"}
          onNext={next}
          last={round + 1 >= rounds}
        />
      )}
    </div>
  );
}

// ============================================================
// 4. ER CITY BUILDER — connect buildings with roads
// ============================================================

function ERCityBuilder({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [connections, setConnections] = useState<{from:number; to:number; type:string}[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const [roundScore, setRoundScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [trafficStarted, setTrafficStarted] = useState(false);
  const [cars, setCars] = useState<{id:number; from:number; to:number; progress:number; type:string}[]>([]);
  const nextId = useRef(1);

  const q = questions[round] || {};
  const opts = (q.options || {}) as { left?: string; right?: string; explanation?: string };

  // Buildings for the round
  const buildings = useMemo(() => {
    const names = [opts.left || "Customer", opts.right || "Order", "Product", "Warehouse", "Payment"];
    return names.slice(0, 2 + round).map((name, i) => ({ id: i, name, emoji: ["🏢", "🏭", "🏪", "🏗️", "🏦"][i % 5] }));
  }, [round, opts.left, opts.right]);

  function connect(from: number, to: number, type: string) {
    if (submitted) return;
    // Remove existing connection between same pair
    setConnections(prev => {
      const filtered = prev.filter(c => !(c.from === from && c.to === to) && !(c.from === to && c.to === from));
      return [...filtered, { from, to, type }];
    });
  }

  function startTraffic() {
    setTrafficStarted(true);
    // Spawn cars based on connections
    const newCars: typeof cars = [];
    connections.forEach((conn, i) => {
      const count = conn.type === "1:1" ? 1 : conn.type === "1:N" ? 3 : 5;
      for (let j = 0; j < count; j++) {
        newCars.push({
          id: nextId.current++,
          from: conn.from,
          to: conn.to,
          progress: 0,
          type: conn.type,
        });
      }
    });
    setCars(newCars);
  }

  // Animate cars
  useEffect(() => {
    if (!trafficStarted || submitted) return;
    const iv = setInterval(() => {
      setCars(prev => {
        const updated = prev.map(c => ({ ...c, progress: c.progress + 3 })).filter(c => c.progress < 100);
        if (updated.length === 0 && prev.length > 0) {
          // Traffic done — score
          setSubmitted(true);
          // Score: each connection gets points if both buildings exist
          const earned = connections.length * 30;
          setRoundScore(earned);
          setScore(s => s + earned);
        }
        return updated;
      });
    }, 50);
    return () => clearInterval(iv);
  }, [trafficStarted, submitted, connections.length]);

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else {
      setRound(r => r + 1);
      setConnections([]);
      setSelectedBuilding(null);
      setRoundScore(0);
      setSubmitted(false);
      setTrafficStarted(false);
      setCars([]);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <RoundHeader index={round} total={rounds} label="ER City Builder" />
      <div className="glass-strong rounded-xl border border-border/40 p-4">
        <p className="text-xs text-muted-foreground mb-2 font-mono">SELECT A BUILDING, THEN ANOTHER TO CONNECT</p>
        <p className="text-sm mb-3">{q.content}</p>

        {/* Connection type toolbar */}
        <div className="flex gap-2 mb-3">
          {["1:1", "1:N", "N:N"].map(t => (
            <Badge key={t} variant="outline" className="text-xs font-mono cursor-default">
              {t === "1:1" ? "🌉 1:1" : t === "1:N" ? "🛣️ 1:N" : "🛣️🛣️ N:N"}
            </Badge>
          ))}
        </div>

        {/* Buildings */}
        <div className="flex flex-wrap gap-3 mb-4 justify-center">
          {buildings.map(b => (
            <button
              key={b.id}
              onClick={() => {
                if (selectedBuilding === null) {
                  setSelectedBuilding(b.id);
                } else if (selectedBuilding === b.id) {
                  setSelectedBuilding(null);
                } else {
                  // Connect with default 1:N for simplicity, or cycle types
                  const existing = connections.find(c => (c.from === selectedBuilding && c.to === b.id) || (c.from === b.id && c.to === selectedBuilding));
                  const nextType = existing ? (existing.type === "1:1" ? "1:N" : existing.type === "1:N" ? "N:N" : "1:1") : "1:N";
                  connect(selectedBuilding, b.id, nextType);
                  setSelectedBuilding(null);
                }
              }}
              className={`rounded-xl border-2 p-3 flex flex-col items-center gap-1 transition-all ${
                selectedBuilding === b.id ? "border-violet-400 bg-violet-500/20" : "border-border/40 bg-card/60 hover:border-primary/30"
              }`}
            >
              <span className="text-2xl">{b.emoji}</span>
              <span className="text-xs font-bold">{b.name}</span>
            </button>
          ))}
        </div>

        {/* Connections list */}
        <div className="space-y-1 mb-3">
          {connections.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span>{buildings.find(b => b.id === c.from)?.name}</span>
              <span className="font-mono text-amber-300">{c.type}</span>
              <span>{buildings.find(b => b.id === c.to)?.name}</span>
              {trafficStarted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </div>
          ))}
        </div>

        {!trafficStarted && !submitted && (
          <Button className="w-full" onClick={startTraffic} disabled={connections.length === 0}>
            Start Traffic ▶️
          </Button>
        )}

        {/* Animated cars */}
        <div className="relative h-2 mt-3 bg-muted/30 rounded-full overflow-hidden">
          {cars.map(car => (
            <motion.div
              key={car.id}
              className="absolute top-0 w-3 h-2 rounded-full"
              style={{
                left: `${car.progress}%`,
                backgroundColor: car.type === "1:1" ? "#34d399" : car.type === "1:N" ? "#fbbf24" : "#f472b6",
              }}
            />
          ))}
        </div>
      </div>

      {submitted && (
        <FeedbackBanner
          correct={roundScore >= 30}
          explanation={opts.explanation || "1:1 = single lane, 1:N = multi-lane one way, N:N = highway both ways. Watch the traffic volume!"}
          onNext={next}
          last={round + 1 >= rounds}
        />
      )}
    </div>
  );
}

// ============================================================
// 5. DATA FLOW PLUMBER — Pipe Dream puzzle
// ============================================================

const PIPE_PIECES = [" straight", "corner", "t-junction", "cross"] as const;
type PipeType = typeof PIPE_PIECES[number];

function DataFlowPlumber({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [grid, setGrid] = useState<(PipeType | null)[][]>([]);
  const [roundScore, setRoundScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [flowing, setFlowing] = useState(false);
  const [flowProgress, setFlowProgress] = useState(0);
  const [leaked, setLeaked] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as {
    nodes?: { id: string; label: string; type: "source" | "process" | "store" | "sink" }[];
    correctFrom?: string;
    correctTo?: string;
    explanation?: string;
  };

  const ROWS = 5;
  const COLS = 6;

  // Initialize grid with some fixed pieces and empty cells
  useEffect(() => {
    const newGrid: (PipeType | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    // Place fixed source and sink
    newGrid[2][0] = " straight";
    newGrid[2][COLS - 1] = " straight";
    setGrid(newGrid);
    setFlowing(false);
    setFlowProgress(0);
    setLeaked(false);
  }, [round]);

  function rotatePiece(r: number, c: number) {
    if (submitted || flowing) return;
    setGrid(prev => {
      const copy = prev.map(row => [...row]);
      const idx = PIPE_PIECES.indexOf(copy[r][c] || " straight");
      copy[r][c] = PIPE_PIECES[(idx + 1) % PIPE_PIECES.length];
      return copy;
    });
  }

  function placePiece(r: number, c: number) {
    if (submitted || flowing) return;
    if (c === 0 || c === COLS - 1) return; // fixed source/sink columns
    setGrid(prev => {
      const copy = prev.map(row => [...row]);
      copy[r][c] = copy[r][c] ? PIPE_PIECES[(PIPE_PIECES.indexOf(copy[r][c]!) + 1) % PIPE_PIECES.length] : " straight";
      return copy;
    });
  }

  function startFlow() {
    setFlowing(true);
    let prog = 0;
    const iv = setInterval(() => {
      prog += 2;
      setFlowProgress(prog);
      if (prog >= 100) {
        clearInterval(iv);
        // Check if there are empty cells in the path (simplified: just check if enough pipes placed)
        const placed = grid.flat().filter(Boolean).length;
        const needed = ROWS * COLS * 0.5;
        const success = placed >= needed;
        setLeaked(!success);
        setSubmitted(true);
        const earned = success ? 100 : Math.floor((placed / needed) * 60);
        setRoundScore(earned);
        setScore(s => s + earned);
      }
    }, 60);
  }

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else {
      setRound(r => r + 1);
      setRoundScore(0);
      setSubmitted(false);
      setFlowing(false);
      setFlowProgress(0);
      setLeaked(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <RoundHeader index={round} total={rounds} label="Data Flow Plumber" />
      <div className="glass-strong rounded-xl border border-border/40 p-4">
        <p className="text-xs text-muted-foreground mb-2 font-mono">PLACE AND ROTATE PIPES TO CONNECT SOURCE → SINK</p>
        <p className="text-sm mb-3">{q.content}</p>

        {/* Pipe legend */}
        <div className="flex gap-3 mb-3 text-[10px] text-muted-foreground">
          <span>🟦 Source</span>
          <span>⬜ Empty</span>
          <span>🟩 Pipe</span>
          <span>🟥 Sink</span>
        </div>

        {/* Grid */}
        <div className="grid gap-1 mb-3" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
          {Array.from({ length: ROWS * COLS }).map((_, idx) => {
            const r = Math.floor(idx / COLS);
            const c = idx % COLS;
            const piece = grid[r]?.[c];
            const isSource = c === 0 && r === 2;
            const isSink = c === COLS - 1 && r === 2;
            const isFlowing = flowing && c * (100 / COLS) < flowProgress;

            return (
              <button
                key={idx}
                onClick={() => placePiece(r, c)}
                className={`aspect-square rounded border flex items-center justify-center text-xs transition-all ${
                  isSource ? "bg-emerald-500/20 border-emerald-500/50" :
                  isSink ? "bg-rose-500/20 border-rose-500/50" :
                  piece ? (isFlowing ? "bg-cyan-400/40 border-cyan-400" : "bg-cyan-500/10 border-cyan-500/30") :
                  "bg-card/40 border-border/30 hover:bg-primary/5"
                }`}
              >
                {isSource && "📥"}
                {isSink && "📤"}
                {piece && !isSource && !isSink && (
                  <span className={isFlowing ? "text-cyan-900 font-bold" : "text-cyan-300/60"}>
                    {piece === " straight" ? "═" : piece === "corner" ? "└" : piece === "t-junction" ? "┴" : "┼"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex justify-between items-center">
          <Badge variant="outline" className="bg-background/60">Pipes: {grid.flat().filter(Boolean).length}</Badge>
          {!flowing && !submitted && (
            <Button size="sm" onClick={startFlow}>
              ▶️ Start Flow
            </Button>
          )}
          {flowing && !submitted && (
            <Badge variant="outline" className="bg-cyan-500/20 text-cyan-300 animate-pulse">
              Flowing...
            </Badge>
          )}
        </div>
      </div>

      {submitted && (
        <FeedbackBanner
          correct={!leaked}
          explanation={opts.explanation || "Connect the source to the sink through processes and stores. Avoid leaks!"}
          onNext={next}
          last={round + 1 >= rounds}
        />
      )}
    </div>
  );
}

// ============================================================
// 6. SEQUENCE RHYTHM — falling arrows rhythm game
// ============================================================

function SequenceRhythm({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState<{id:number; lane:number; y:number; text:string; hit:boolean}[]>([]);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [roundScore, setRoundScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [started, setStarted] = useState(false);
  const nextId = useRef(1);
  const frameRef = useRef<number>(0);

  const q = questions[round] || {};
  const opts = (q.options || {}) as { steps?: string[]; explanation?: string; objects?: string[] };
  const objects = opts.objects || ["User", "UI", "Server", "DB"];
  const steps = opts.steps || ["Step 1", "Step 2", "Step 3"];

  // Spawn notes based on steps
  useEffect(() => {
    if (!started || submitted) return;
    let spawned = 0;
    const interval = setInterval(() => {
      if (spawned >= steps.length * 2) {
        clearInterval(interval);
        // End after all notes pass
        setTimeout(() => {
          setSubmitted(true);
          setScore(s => s + roundScore);
        }, 4000);
        return;
      }
      const stepIdx = spawned % steps.length;
      const lane = stepIdx % objects.length;
      const id = nextId.current++;
      setNotes(prev => [...prev, { id, lane, y: -10, text: steps[stepIdx], hit: false }]);
      spawned++;
    }, 1400);
    return () => clearInterval(interval);
  }, [started, submitted, steps, objects.length, roundScore]);

  // Move notes
  useEffect(() => {
    if (!started || submitted) return;
    const loop = () => {
      setNotes(prev => prev.map(n => ({ ...n, y: n.y + 1.2 })).filter(n => n.y < 110));
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameRef.current);
  }, [started, submitted]);

  const HIT_LINE = 88;

  function hitLane(lane: number) {
    if (!started || submitted) return;
    setNotes(prev => {
      const target = prev.find(n => n.lane === lane && Math.abs(n.y - HIT_LINE) < 14 && !n.hit);
      if (target) {
        const accuracy = Math.abs(target.y - HIT_LINE);
        const points = accuracy < 5 ? 30 : 15;
        setCombo(c => {
          const newCombo = c + 1;
          setMaxCombo(m => Math.max(m, newCombo));
          return newCombo;
        });
        setRoundScore(s => s + points + combo * 2);
        return prev.map(n => n.id === target.id ? { ...n, hit: true } : n);
      } else {
        setCombo(0);
        return prev;
      }
    });
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const keyMap: Record<string, number> = { "d": 0, "f": 1, "j": 2, "k": 3, "ArrowLeft": 0, "ArrowRight": 1, "ArrowUp": 2, "ArrowDown": 3 };
      if (keyMap[e.key] !== undefined) hitLane(keyMap[e.key] % objects.length);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [started, submitted, objects.length, combo]);

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else {
      setRound(r => r + 1);
      setNotes([]);
      setCombo(0);
      setMaxCombo(0);
      setRoundScore(0);
      setSubmitted(false);
      setStarted(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      <RoundHeader index={round} total={rounds} label="Sequence Rhythm" />
      <div className="glass-strong rounded-xl border border-border/40 overflow-hidden relative select-none" style={{ height: 420 }}>
        {!started && !submitted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-background/80 backdrop-blur">
            <p className="text-sm text-muted-foreground mb-3">Press keys as arrows hit the line</p>
            <div className="flex gap-2 mb-4">
              {objects.map((o, i) => (
                <div key={i} className="text-center">
                  <kbd className="px-2 py-1 rounded bg-muted text-xs font-mono">{"DFJK"[i]}</kbd>
                  <div className="text-[10px] text-muted-foreground mt-1">{o}</div>
                </div>
              ))}
            </div>
            <Button onClick={() => setStarted(true)}>Start</Button>
          </div>
        )}

        {/* HUD */}
        <div className="absolute top-2 left-2 right-2 z-20 flex justify-between items-center">
          <Badge variant="outline" className="bg-background/60 text-pink-300">🔥 {combo}x</Badge>
          <Badge variant="outline" className="bg-background/60 text-indigo-300">⭐ {roundScore}</Badge>
        </div>

        {/* Lanes */}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${objects.length}, 1fr)` }}>
          {objects.map((obj, i) => (
            <div
              key={i}
              className="border-r border-border/20 relative"
              onClick={() => hitLane(i)}
            >
              <div className="absolute bottom-0 left-0 right-0 text-center pb-1 text-[10px] font-mono text-muted-foreground">{obj}</div>
            </div>
          ))}
        </div>

        {/* Hit line */}
        <div className="absolute left-0 right-0 z-10 border-t-2 border-indigo-400/60" style={{ top: `${HIT_LINE}%` }} />

        {/* Notes */}
        <AnimatePresence>
          {notes.map(n => (
            <motion.div
              key={n.id}
              className={`absolute left-0 right-0 flex justify-center ${n.hit ? "opacity-0" : ""}`}
              style={{ top: `${n.y}%` }}
            >
              <div
                className="w-12 h-8 rounded-md flex items-center justify-center text-[9px] font-bold border shadow-lg"
                style={{
                  backgroundColor: n.hit ? "#10b981" : `hsl(${(n.lane * 60 + 240) % 360}, 70%, 60%)`,
                  borderColor: n.hit ? "#10b981" : `hsl(${(n.lane * 60 + 240) % 360}, 70%, 40%)`,
                }}
              >
                {n.hit ? "✓" : n.text.slice(0, 12)}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Lane flash on hit */}
        <AnimatePresence>
          {notes.filter(n => n.hit).map(n => (
            <motion.div
              key={`flash-${n.id}`}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 top-0 bg-indigo-400/20"
              style={{ left: `${(n.lane / objects.length) * 100}%`, width: `${100 / objects.length}%` }}
            />
          ))}
        </AnimatePresence>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-1">Keys: D F J K (or tap lanes)</p>

      {submitted && (
        <FeedbackBanner
          correct={roundScore >= 80}
          explanation={opts.explanation || `Max combo: ${maxCombo}. Each arrow is a message between objects in time order.`}
          onNext={next}
          last={round + 1 >= rounds}
        />
      )}
    </div>
  );
}

// ============================================================
// MAIN DISPATCHER
// ============================================================

export function SADGameRunner({ gameType, questions, onComplete }: {
  gameType: string; questions: any[]; onComplete: (score: number) => void;
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

  switch (gameType) {
    case "sdlc_sorter":      return <PhaseRunner questions={questions} onComplete={onComplete} />;
    case "req_sorter":       return <RequirementHunter questions={questions} onComplete={onComplete} />;
    case "usecase_builder":  return <UseCaseDefense questions={questions} onComplete={onComplete} />;
    case "erd_doctor":       return <ERCityBuilder questions={questions} onComplete={onComplete} />;
    case "dfd_detective":    return <DataFlowPlumber questions={questions} onComplete={onComplete} />;
    case "sequence_stacker": return <SequenceRhythm questions={questions} onComplete={onComplete} />;
    default:
      return (
        <div className="text-center text-muted-foreground">
          Unknown SAD game type: {gameType}
        </div>
      );
  }
}
