import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, XCircle, Lightbulb, Sparkles, ArrowRight, GripVertical,
  Layers, Boxes, Workflow, Database, Activity, ListOrdered, User2,
  Server, Box, Circle as CircleIcon, ChevronRight,
} from "lucide-react";

// ============================================================
// META — describes each play-to-learn game (used by intro card)
// ============================================================

export interface SADGameMeta {
  type: string;
  title: string;
  short: string;     // 1-2 sentence definition (always shown)
  detail: string;    // a tiny "did you know" paragraph
  howTo: string;     // tutorial sentence shown on the intro card
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
    howTo: "Drag the shuffled phase cards into the correct order — survive each stage of the project!",
    icon: Layers,
    color: "text-violet-300",
    gradient: "from-violet-500 to-purple-700",
    emoji: "🏃",
  },
  req_sorter: {
    type: "req_sorter",
    title: "Requirement Hunter",
    short: "Requirements describe what a system must do — and how well it must do it.",
    detail: "Functional requirements describe WHAT the system does (login, search, purchase). Non-functional requirements describe HOW WELL it does it (speed, security, usability).",
    howTo: "Hunt down each requirement and classify it — Functional or Non-Functional. Earn points for every correct catch!",
    icon: Boxes,
    color: "text-emerald-300",
    gradient: "from-emerald-500 to-teal-700",
    emoji: "🎯",
  },
  usecase_builder: {
    type: "usecase_builder",
    title: "Use Case Defense",
    short: "Use Case Diagrams show what each ACTOR (a user or external system) can do with the system.",
    detail: "An actor is anyone outside the system that interacts with it. A use case is one task the actor can perform. Lines connect actors to the use cases they own.",
    howTo: "Defend the system! For each use case, tap the correct actor who owns it — wrong answers cost points!",
    icon: Workflow,
    color: "text-cyan-300",
    gradient: "from-cyan-500 to-blue-700",
    emoji: "🛡️",
  },
  erd_doctor: {
    type: "erd_doctor",
    title: "ER City Builder",
    short: "ER Diagrams show database entities (tables) and how they relate to each other.",
    detail: "Cardinality describes how many records on one side relate to how many on the other: 1:1 (one-to-one), 1:N (one-to-many), or N:N (many-to-many).",
    howTo: "Build the city's data map! Fix each broken relationship by choosing the right cardinality to connect the entities.",
    icon: Database,
    color: "text-amber-300",
    gradient: "from-amber-500 to-orange-700",
    emoji: "🏙️",
  },
  dfd_detective: {
    type: "dfd_detective",
    title: "Data Flow Plumber",
    short: "A Data Flow Diagram shows how data moves through a system — between sources, processes, stores and sinks.",
    detail: "Arrows in a DFD always carry data. They flow from a source/store to a process, or from a process to a store/sink. Two stores never connect directly.",
    howTo: "Pipes are leaking! Find the missing data flow and connect the right FROM and TO nodes to fix the system.",
    icon: Activity,
    color: "text-pink-300",
    gradient: "from-pink-500 to-rose-700",
    emoji: "🔧",
  },
  sequence_stacker: {
    type: "sequence_stacker",
    title: "Sequence Rhythm",
    short: "Sequence Diagrams show messages between objects in time order — top to bottom.",
    detail: "Each vertical line is an object. Horizontal arrows are messages between them. Time flows downward, so the earliest message is at the top.",
    howTo: "Feel the rhythm! Stack the messages in the correct time order — top to bottom — to complete the sequence.",
    icon: ListOrdered,
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
        {last ? "Finish" : "Next"} <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </motion.div>
  );
}

interface SADGameProps {
  questions: any[];
  onComplete: (score: number) => void;
}

// ============================================================
// 1. SDLC SORTER — drag phases into order
// ============================================================

function SDLCSorter({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [correct, setCorrect] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as { phases?: string[]; explanation?: string; methodology?: string };
  const correctOrder: string[] = opts.phases || [];

  const initialShuffled = useMemo(() => {
    const arr = [...correctOrder];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (arr.length > 1 && arr.every((v, i) => v === correctOrder[i])) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr;
  }, [round, correctOrder.join("|")]);

  const [items, setItems] = useState<string[]>(initialShuffled);

  useEffect(() => {
    setItems(initialShuffled);
    setSubmitted(false);
    setCorrect(false);
  }, [round, initialShuffled.join("|")]);

  function check() {
    const ok = items.every((v, i) => v === correctOrder[i]);
    setCorrect(ok);
    setSubmitted(true);
    if (ok) setScore(s => s + 100);
  }

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else setRound(r => r + 1);
  }

  return (
    <div className="w-full max-w-xl">
      <RoundHeader index={round} total={rounds} label={opts.methodology || "Order the phases"} />
      <div className="glass-strong rounded-xl p-5 border border-border/40">
        <p className="text-sm text-muted-foreground mb-1">Scenario</p>
        <p className="text-base font-semibold mb-4">{q.content}</p>

        <Reorder.Group
          axis="y"
          values={items}
          onReorder={(v) => !submitted && setItems(v)}
          className="space-y-2"
        >
          {items.map((phase, i) => {
            const isRight = submitted && phase === correctOrder[i];
            const isWrong = submitted && phase !== correctOrder[i];
            return (
              <Reorder.Item key={phase} value={phase} dragListener={!submitted}>
                <div
                  className={`flex items-center gap-3 rounded-lg border p-3 select-none ${
                    isRight ? "bg-emerald-500/10 border-emerald-500/40"
                    : isWrong ? "bg-rose-500/10 border-rose-500/40"
                    : "bg-card/80 border-border/40 cursor-grab active:cursor-grabbing"
                  }`}
                  data-testid={`drag-phase-${phase.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span className="w-7 h-7 rounded-md bg-primary/20 text-primary font-mono text-xs flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium">{phase}</span>
                  {!submitted && <GripVertical className="w-4 h-4 text-muted-foreground" />}
                  {isRight && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {isWrong && <XCircle className="w-4 h-4 text-rose-400" />}
                </div>
              </Reorder.Item>
            );
          })}
        </Reorder.Group>

        {!submitted ? (
          <Button className="w-full mt-4" onClick={check} data-testid="button-check-order">
            Check Order
          </Button>
        ) : (
          <FeedbackBanner
            correct={correct}
            explanation={opts.explanation || `Correct order: ${correctOrder.join(" → ")}`}
            onNext={next}
            last={round + 1 >= rounds}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// 2. REQUIREMENTS SORTER — tap bucket
// ============================================================

function RequirementsSorter({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as { explanation?: string };
  const correctAnswer = (q.answer || "").toLowerCase().trim();

  function choose(bucket: "functional" | "non_functional") {
    if (submitted) return;
    setPick(bucket);
    setSubmitted(true);
    if (bucket === correctAnswer) setScore(s => s + 100);
  }

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else {
      setRound(r => r + 1);
      setPick(null);
      setSubmitted(false);
    }
  }

  const correct = pick === correctAnswer;

  return (
    <div className="w-full max-w-xl">
      <RoundHeader index={round} total={rounds} label="Sort the requirement" />
      <motion.div
        key={round}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-xl p-5 border border-border/40"
      >
        <p className="text-xs text-muted-foreground mb-2 font-mono">REQUIREMENT</p>
        <div className="rounded-lg bg-card/60 border border-border/40 p-4 mb-5">
          <p className="text-sm leading-relaxed">"{q.content}"</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(["functional", "non_functional"] as const).map((b) => {
            const isPicked = pick === b;
            const isCorrect = submitted && b === correctAnswer;
            const isWrong = submitted && isPicked && b !== correctAnswer;
            return (
              <button
                key={b}
                onClick={() => choose(b)}
                disabled={submitted}
                data-testid={`bucket-${b}`}
                className={`rounded-xl border p-5 text-center transition-all ${
                  isCorrect ? "bg-emerald-500/15 border-emerald-500/50"
                  : isWrong ? "bg-rose-500/15 border-rose-500/50"
                  : isPicked ? "bg-primary/15 border-primary/50"
                  : "bg-card/60 border-border/40 hover:border-primary/40 hover:bg-card"
                }`}
              >
                <div className="text-3xl mb-2">{b === "functional" ? "⚙️" : "📊"}</div>
                <div className="text-sm font-bold">
                  {b === "functional" ? "Functional" : "Non-Functional"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {b === "functional" ? "What it does" : "How well it does it"}
                </div>
              </button>
            );
          })}
        </div>

        {submitted && (
          <FeedbackBanner
            correct={correct}
            explanation={opts.explanation || `This is a ${correctAnswer.replace("_", "-")} requirement.`}
            onNext={next}
            last={round + 1 >= rounds}
          />
        )}
      </motion.div>
    </div>
  );
}

// ============================================================
// 3. USE CASE CONNECTOR — assign use cases to actors
// ============================================================

function UseCaseConnector({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [picks, setPicks] = useState<Record<string, string>>({}); // useCase -> actorId
  const [submitted, setSubmitted] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as {
    actors?: { id: string; label: string; emoji?: string }[];
    useCases?: { label: string; actorId: string }[];
    explanation?: string;
  };
  const actors = opts.actors || [];
  const useCases = opts.useCases || [];

  function assign(useCase: string, actorId: string) {
    if (submitted) return;
    setPicks(p => ({ ...p, [useCase]: actorId }));
  }

  function check() {
    const correctCount = useCases.filter(uc => picks[uc.label] === uc.actorId).length;
    const allRight = correctCount === useCases.length;
    setSubmitted(true);
    setScore(s => s + Math.floor((correctCount / Math.max(useCases.length, 1)) * 100));
  }

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else {
      setRound(r => r + 1);
      setPicks({});
      setSubmitted(false);
    }
  }

  const allAssigned = useCases.every(uc => picks[uc.label]);
  const correctCount = useCases.filter(uc => picks[uc.label] === uc.actorId).length;
  const allRight = correctCount === useCases.length;

  return (
    <div className="w-full max-w-2xl">
      <RoundHeader index={round} total={rounds} label="Match use cases to actors" />
      <div className="glass-strong rounded-xl p-5 border border-border/40">
        <p className="text-xs text-muted-foreground mb-1 font-mono">SCENARIO</p>
        <p className="text-sm font-semibold mb-4">{q.content}</p>

        {/* Actor swatches */}
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {actors.map(a => (
            <Badge key={a.id} variant="outline" className="text-xs px-3 py-1.5 bg-card/60">
              <span className="mr-1.5">{a.emoji || "👤"}</span>
              {a.label}
            </Badge>
          ))}
        </div>

        <div className="space-y-2">
          {useCases.map((uc) => {
            const picked = picks[uc.label];
            const isCorrect = submitted && picked === uc.actorId;
            const isWrong = submitted && picked && picked !== uc.actorId;
            return (
              <div
                key={uc.label}
                className={`rounded-lg border p-3 ${
                  isCorrect ? "bg-emerald-500/10 border-emerald-500/40"
                  : isWrong ? "bg-rose-500/10 border-rose-500/40"
                  : "bg-card/60 border-border/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <CircleIcon className="w-3 h-3 text-primary" />
                    {uc.label}
                  </span>
                  {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {isWrong && <XCircle className="w-4 h-4 text-rose-400" />}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {actors.map(a => {
                    const isPicked = picked === a.id;
                    return (
                      <button
                        key={a.id}
                        onClick={() => assign(uc.label, a.id)}
                        disabled={submitted}
                        data-testid={`pick-${uc.label.replace(/\s+/g, "-")}-${a.id}`}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-all ${
                          isPicked
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "bg-card/80 border-border/40 text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        {a.emoji} {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {!submitted ? (
          <Button
            className="w-full mt-4"
            onClick={check}
            disabled={!allAssigned}
            data-testid="button-check-usecases"
          >
            Check Connections
          </Button>
        ) : (
          <FeedbackBanner
            correct={allRight}
            explanation={
              (allRight ? "" : `You got ${correctCount} of ${useCases.length} correct. `) +
              (opts.explanation || "")
            }
            onNext={next}
            last={round + 1 >= rounds}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// 4. ERD DOCTOR — pick correct cardinality
// ============================================================

function ERDDoctor({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as { left?: string; right?: string; explanation?: string };
  const choices = ["1:1", "1:N", "N:N"];

  function choose(c: string) {
    if (submitted) return;
    setPick(c);
    setSubmitted(true);
    if (c === q.answer) setScore(s => s + 100);
  }

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else {
      setRound(r => r + 1);
      setPick(null);
      setSubmitted(false);
    }
  }

  const correct = pick === q.answer;

  return (
    <div className="w-full max-w-xl">
      <RoundHeader index={round} total={rounds} label="Diagnose the relationship" />
      <div className="glass-strong rounded-xl p-5 border border-border/40">
        <p className="text-xs text-muted-foreground mb-2 font-mono">CASE FILE</p>
        <p className="text-sm leading-relaxed mb-5">{q.content}</p>

        {/* Mini ERD visual */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-5">
          <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-lg px-4 py-3 min-w-[90px] text-center">
            <Database className="w-4 h-4 text-amber-300 mx-auto mb-1" />
            <div className="text-sm font-bold">{opts.left || "Entity A"}</div>
          </div>
          <div className="flex flex-col items-center min-w-[60px]">
            <div className="text-xs font-mono text-muted-foreground mb-1">cardinality?</div>
            <div className="h-px w-12 sm:w-16 bg-gradient-to-r from-amber-500 to-orange-500" />
            <div className={`mt-1 text-base font-bold font-mono ${submitted ? (correct ? "text-emerald-400" : "text-rose-400") : "text-muted-foreground"}`}>
              {pick || "?:?"}
            </div>
          </div>
          <div className="bg-orange-500/10 border-2 border-orange-500/40 rounded-lg px-4 py-3 min-w-[90px] text-center">
            <Database className="w-4 h-4 text-orange-300 mx-auto mb-1" />
            <div className="text-sm font-bold">{opts.right || "Entity B"}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {choices.map(c => {
            const isPicked = pick === c;
            const isCorrect = submitted && c === q.answer;
            const isWrong = submitted && isPicked && c !== q.answer;
            return (
              <button
                key={c}
                onClick={() => choose(c)}
                disabled={submitted}
                data-testid={`erd-choice-${c}`}
                className={`rounded-lg border p-3 font-mono text-base font-bold transition-all ${
                  isCorrect ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                  : isWrong ? "bg-rose-500/15 border-rose-500/50 text-rose-300"
                  : "bg-card/60 border-border/40 hover:border-primary/40 hover:bg-card"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>

        {submitted && (
          <FeedbackBanner
            correct={correct}
            explanation={opts.explanation || `The correct cardinality is ${q.answer}.`}
            onNext={next}
            last={round + 1 >= rounds}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// 5. DATA FLOW DETECTIVE — pick from + to nodes
// ============================================================

function DFDDetective({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as {
    nodes?: { id: string; label: string; type: "source" | "process" | "store" | "sink" }[];
    existingFlows?: { from: string; to: string; label: string }[];
    missingLabel?: string;
    correctFrom?: string;
    correctTo?: string;
    explanation?: string;
  };
  const nodes = opts.nodes || [];

  function check() {
    const ok = from === opts.correctFrom && to === opts.correctTo;
    setSubmitted(true);
    if (ok) setScore(s => s + 100);
  }

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else {
      setRound(r => r + 1);
      setFrom(null);
      setTo(null);
      setSubmitted(false);
    }
  }

  const correct = from === opts.correctFrom && to === opts.correctTo;

  const NODE_STYLES: Record<string, { bg: string; icon: any; label: string }> = {
    source:  { bg: "bg-emerald-500/15 border-emerald-500/40 text-emerald-200", icon: User2,  label: "Source" },
    process: { bg: "bg-cyan-500/15 border-cyan-500/40 text-cyan-200",          icon: Workflow, label: "Process" },
    store:   { bg: "bg-amber-500/15 border-amber-500/40 text-amber-200",       icon: Database, label: "Store" },
    sink:    { bg: "bg-rose-500/15 border-rose-500/40 text-rose-200",          icon: Server,   label: "Sink" },
  };

  return (
    <div className="w-full max-w-2xl">
      <RoundHeader index={round} total={rounds} label="Repair the data flow" />
      <div className="glass-strong rounded-xl p-5 border border-border/40">
        <p className="text-xs text-muted-foreground mb-2 font-mono">SYSTEM</p>
        <p className="text-sm font-semibold mb-1">{q.content}</p>
        <p className="text-xs text-pink-300 mb-4">
          Missing flow: <span className="font-mono">"{opts.missingLabel}"</span>
        </p>

        {/* Node grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {nodes.map(n => {
            const s = NODE_STYLES[n.type];
            const Icon = s.icon;
            return (
              <div
                key={n.id}
                className={`rounded-lg border-2 ${s.bg} p-2.5 text-center`}
              >
                <Icon className="w-4 h-4 mx-auto mb-1" />
                <div className="text-xs font-bold leading-tight">{n.label}</div>
                <div className="text-[10px] opacity-60 font-mono mt-0.5">{s.label}</div>
              </div>
            );
          })}
        </div>

        {/* Existing flows */}
        {(opts.existingFlows || []).length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-1.5 font-mono">EXISTING FLOWS</p>
            <div className="space-y-1">
              {opts.existingFlows!.map((f, i) => (
                <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="font-mono">{nodes.find(n => n.id === f.from)?.label}</span>
                  <ArrowRight className="w-3 h-3" />
                  <span className="font-mono">{nodes.find(n => n.id === f.to)?.label}</span>
                  <span className="text-[10px] opacity-60">({f.label})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* From / To selectors */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-mono">FROM</p>
            <div className="space-y-1">
              {nodes.map(n => (
                <button
                  key={n.id}
                  onClick={() => !submitted && setFrom(n.id)}
                  disabled={submitted}
                  data-testid={`from-${n.id}`}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded border transition-all ${
                    from === n.id
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "bg-card/60 border-border/40 hover:border-primary/30"
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1.5 font-mono">TO</p>
            <div className="space-y-1">
              {nodes.map(n => (
                <button
                  key={n.id}
                  onClick={() => !submitted && setTo(n.id)}
                  disabled={submitted}
                  data-testid={`to-${n.id}`}
                  className={`w-full text-left text-xs px-2.5 py-1.5 rounded border transition-all ${
                    to === n.id
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "bg-card/60 border-border/40 hover:border-primary/30"
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {!submitted ? (
          <Button
            className="w-full mt-2"
            onClick={check}
            disabled={!from || !to}
            data-testid="button-check-flow"
          >
            Connect Flow
          </Button>
        ) : (
          <FeedbackBanner
            correct={correct}
            explanation={opts.explanation || `Correct flow: ${nodes.find(n => n.id === opts.correctFrom)?.label} → ${nodes.find(n => n.id === opts.correctTo)?.label}`}
            onNext={next}
            last={round + 1 >= rounds}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// 6. SEQUENCE STACKER — drag steps into time order
// ============================================================

function SequenceStacker({ questions, onComplete }: SADGameProps) {
  const rounds = questions.length || 1;
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const q = questions[round] || {};
  const opts = (q.options || {}) as { steps?: string[]; explanation?: string; objects?: string[] };
  const correctSteps = opts.steps || [];

  const initialShuffled = useMemo(() => {
    const arr = [...correctSteps];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (arr.length > 1 && arr.every((v, i) => v === correctSteps[i])) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr;
  }, [round, correctSteps.join("|")]);

  const [items, setItems] = useState<string[]>(initialShuffled);

  useEffect(() => {
    setItems(initialShuffled);
    setSubmitted(false);
  }, [round, initialShuffled.join("|")]);

  function check() {
    const correctCount = items.filter((v, i) => v === correctSteps[i]).length;
    setSubmitted(true);
    setScore(s => s + Math.floor((correctCount / Math.max(correctSteps.length, 1)) * 100));
  }

  function next() {
    if (round + 1 >= rounds) onComplete(score);
    else setRound(r => r + 1);
  }

  const allRight = items.every((v, i) => v === correctSteps[i]);

  return (
    <div className="w-full max-w-xl">
      <RoundHeader index={round} total={rounds} label="Order top to bottom" />
      <div className="glass-strong rounded-xl p-5 border border-border/40">
        <p className="text-xs text-muted-foreground mb-1 font-mono">SCENARIO</p>
        <p className="text-sm font-semibold mb-2">{q.content}</p>
        {opts.objects && opts.objects.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {opts.objects.map(o => (
              <Badge key={o} variant="outline" className="text-[10px] font-mono bg-indigo-500/10">
                {o}
              </Badge>
            ))}
          </div>
        )}

        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-indigo-500/60 via-indigo-500/40 to-transparent" />
          <Reorder.Group
            axis="y"
            values={items}
            onReorder={(v) => !submitted && setItems(v)}
            className="space-y-2"
          >
            {items.map((step, i) => {
              const isRight = submitted && step === correctSteps[i];
              const isWrong = submitted && step !== correctSteps[i];
              return (
                <Reorder.Item key={step} value={step} dragListener={!submitted}>
                  <div
                    className={`relative flex items-center gap-3 rounded-lg border p-3 select-none ${
                      isRight ? "bg-emerald-500/10 border-emerald-500/40"
                      : isWrong ? "bg-rose-500/10 border-rose-500/40"
                      : "bg-card/80 border-border/40 cursor-grab active:cursor-grabbing"
                    }`}
                    data-testid={`seq-step-${i}`}
                  >
                    <div className="absolute -left-[18px] w-3 h-3 rounded-full bg-indigo-500 border-2 border-background" />
                    <span className="w-6 h-6 rounded bg-indigo-500/20 text-indigo-300 font-mono text-xs flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm">{step}</span>
                    {!submitted && <GripVertical className="w-4 h-4 text-muted-foreground" />}
                    {isRight && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {isWrong && <XCircle className="w-4 h-4 text-rose-400" />}
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </div>

        {!submitted ? (
          <Button className="w-full mt-4" onClick={check} data-testid="button-check-sequence">
            Check Sequence
          </Button>
        ) : (
          <FeedbackBanner
            correct={allRight}
            explanation={opts.explanation || `Correct order: ${correctSteps.map((s, i) => `${i + 1}. ${s}`).join(" → ")}`}
            onNext={next}
            last={round + 1 >= rounds}
          />
        )}
      </div>
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
    case "sdlc_sorter":      return <SDLCSorter questions={questions} onComplete={onComplete} />;
    case "req_sorter":       return <RequirementsSorter questions={questions} onComplete={onComplete} />;
    case "usecase_builder":  return <UseCaseConnector questions={questions} onComplete={onComplete} />;
    case "erd_doctor":       return <ERDDoctor questions={questions} onComplete={onComplete} />;
    case "dfd_detective":    return <DFDDetective questions={questions} onComplete={onComplete} />;
    case "sequence_stacker": return <SequenceStacker questions={questions} onComplete={onComplete} />;
    default:
      return (
        <div className="text-center text-muted-foreground">
          Unknown SAD game type: {gameType}
        </div>
      );
  }
}
