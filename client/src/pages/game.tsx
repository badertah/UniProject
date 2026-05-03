import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Zap, Coins, RotateCcw, ChevronRight, CheckCircle2,
  XCircle, Lightbulb, Trophy, Hash, Link2, Info, Sparkles
} from "lucide-react";
import { Link } from "wouter";
import { getDifficultyConfig, getGameTypeConfig } from "@/lib/utils";
import { SAD_GAMES, isSADGame, isArcadeSADGame, SADGameRunner, difficultyLabel } from "@/components/sad-games";

// ===================== WORDLE GAME =====================
type LetterState = "correct" | "present" | "absent" | "empty" | "tbd";

interface WordleState {
  targetWord: string;
  guesses: string[][];
  currentGuess: string[];
  currentRow: number;
  gameOver: boolean;
  won: boolean;
  usedLetters: Record<string, LetterState>;
  hint?: string;
}

function WordleGame({ questions, onComplete }: { questions: any[]; onComplete: (score: number) => void }) {
  const questionList = questions.filter(q => q.answer && q.answer.length === 5);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const currentQ = questionList[qIndex];

  function initState(targetWord: string): WordleState {
    return {
      targetWord: targetWord.toUpperCase(),
      guesses: Array(6).fill(null).map(() => Array(5).fill("")),
      currentGuess: Array(5).fill(""),
      currentRow: 0,
      gameOver: false,
      won: false,
      usedLetters: {},
      hint: currentQ?.hint,
    };
  }

  const [state, setState] = useState<WordleState>(() => initState(currentQ?.answer || "SCOPE"));

  useEffect(() => {
    if (currentQ) setState(initState(currentQ.answer));
    setShowHint(false);
  }, [qIndex, currentQ]);

  const handleKey = useCallback((key: string) => {
    if (state.gameOver) return;

    setState(prev => {
      const newState = { ...prev };
      const currentGuess = [...prev.currentGuess];

      if (key === "ENTER") {
        const word = currentGuess.join("").toUpperCase();
        if (word.length < 5) return prev;

        const target = prev.targetWord;
        const newGuesses = prev.guesses.map((row, i) =>
          i === prev.currentRow ? currentGuess : row
        );

        // Calculate used letters
        const newUsedLetters = { ...prev.usedLetters };
        const targetArr = target.split("");
        const wordArr = word.split("");
        const result: LetterState[] = Array(5).fill("absent");

        // First pass: correct
        wordArr.forEach((l, i) => {
          if (l === targetArr[i]) {
            result[i] = "correct";
            targetArr[i] = "#";
          }
        });
        // Second pass: present
        wordArr.forEach((l, i) => {
          if (result[i] === "correct") return;
          const idx = targetArr.indexOf(l);
          if (idx !== -1) {
            result[i] = "present";
            targetArr[idx] = "#";
          }
        });

        wordArr.forEach((l, i) => {
          const prev = newUsedLetters[l];
          const cur = result[i];
          if (!prev || (cur === "correct") || (cur === "present" && prev === "absent")) {
            newUsedLetters[l] = cur;
          }
        });

        const won = word === target;
        const newRow = prev.currentRow + 1;
        const gameOver = won || newRow >= 6;

        return {
          ...newState,
          guesses: newGuesses,
          currentGuess: Array(5).fill(""),
          currentRow: newRow,
          gameOver,
          won,
          usedLetters: newUsedLetters,
        };
      }

      if (key === "BACKSPACE") {
        const lastFilled = currentGuess.slice().reverse().findIndex(l => l !== "");
        if (lastFilled >= 0) {
          currentGuess[4 - lastFilled] = "";
        }
        return { ...newState, currentGuess };
      }

      if (/^[A-Z]$/.test(key)) {
        const emptyIdx = currentGuess.findIndex(l => l === "");
        if (emptyIdx >= 0) {
          currentGuess[emptyIdx] = key;
        }
        return { ...newState, currentGuess };
      }

      return prev;
    });
  }, [state.gameOver]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === "Enter") handleKey("ENTER");
      else if (e.key === "Backspace") handleKey("BACKSPACE");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleKey]);

  useEffect(() => {
    if (state.gameOver) {
      const roundScore = state.won ? Math.max(10, 60 - state.currentRow * 10) : 0;
      setTimeout(() => {
        const newScore = score + roundScore;
        setScore(newScore);
        if (qIndex + 1 >= questionList.length) {
          setTimeout(() => {
            setAllDone(true);
            onComplete(newScore);
          }, 1500);
        } else {
          setTimeout(() => setQIndex(q => q + 1), 1500);
        }
      }, 1000);
    }
  }, [state.gameOver]);

  function getCellState(row: number, col: number): LetterState {
    const letter = state.guesses[row][col];
    if (row >= state.currentRow) return row === state.currentRow ? "tbd" : "empty";
    if (!letter) return "empty";

    const target = state.targetWord;
    const wordArr = state.guesses[row].map(l => l || "");
    const targetArr = target.split("");
    const result: LetterState[] = Array(5).fill("absent");

    wordArr.forEach((l, i) => {
      if (l === targetArr[i]) {
        result[i] = "correct";
        targetArr[i] = "#";
      }
    });
    wordArr.forEach((l, i) => {
      if (result[i] === "correct") return;
      const idx = targetArr.indexOf(l);
      if (idx !== -1) {
        result[i] = "present";
        targetArr[idx] = "#";
      }
    });

    return result[col];
  }

  const KEYBOARD_ROWS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACKSPACE"],
  ];

  const cellClass: Record<LetterState, string> = {
    correct: "wordle-correct border-2",
    present: "wordle-present border-2",
    absent: "wordle-absent border-2",
    tbd: "bg-muted/20 border-2 border-muted-foreground/40",
    empty: "bg-muted/10 border-2 border-border/30",
  };

  const keyClass: Record<LetterState, string> = {
    correct: "bg-emerald-600 border-emerald-500 text-white",
    present: "bg-amber-600 border-amber-500 text-white",
    absent: "bg-muted/60 border-border/40 text-muted-foreground/70",
    tbd: "bg-secondary border-secondary text-secondary-foreground",
    empty: "bg-secondary border-secondary text-secondary-foreground",
  };

  if (allDone) return null;
  if (!currentQ) return <div className="text-center text-muted-foreground">No questions available</div>;

  return (
    <div className="flex flex-col items-center gap-4 max-w-sm mx-auto w-full">
      {/* Question info */}
      <div className="w-full text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Hash className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-muted-foreground">Word {qIndex + 1} of {questionList.length}</span>
        </div>
        <p className="text-sm text-foreground/80">{currentQ.content}</p>
        {showHint && currentQ.hint && (
          <motion.div
            className="mt-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Hint: {currentQ.hint}
          </motion.div>
        )}
      </div>

      {/* Grid */}
      <div className="grid gap-1.5">
        {Array(6).fill(null).map((_, row) => (
          <div key={row} className="flex gap-1.5">
            {Array(5).fill(null).map((_, col) => {
              const st = row < state.currentRow ? getCellState(row, col) : "empty";
              const letter = row === state.currentRow ? state.currentGuess[col] : state.guesses[row][col];
              const isCurrent = row === state.currentRow;

              return (
                <motion.div
                  key={col}
                  className={`w-12 h-12 flex items-center justify-center text-lg font-bold rounded-md transition-colors font-mono ${
                    isCurrent
                      ? letter
                        ? "bg-muted/30 border-2 border-muted-foreground/60 text-foreground"
                        : "bg-muted/10 border-2 border-border/30"
                      : cellClass[st]
                  }`}
                  animate={letter && isCurrent ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.1 }}
                  data-testid={`wordle-cell-${row}-${col}`}
                >
                  {isCurrent ? state.currentGuess[col] : state.guesses[row][col]}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Game result */}
      <AnimatePresence>
        {state.gameOver && (
          <motion.div
            className={`w-full p-3 rounded-lg text-center font-bold ${state.won ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400" : "bg-rose-500/20 border border-rose-500/30 text-rose-400"}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {state.won ? `Correct! The word was ${state.targetWord}` : `The word was: ${state.targetWord}`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keyboard */}
      <div className="space-y-1.5 w-full">
        {KEYBOARD_ROWS.map((row, ri) => (
          <div key={ri} className="flex justify-center gap-1">
            {row.map(key => {
              const st = state.usedLetters[key] || "empty";
              return (
                <button
                  key={key}
                  onClick={() => handleKey(key)}
                  data-testid={`key-${key}`}
                  className={`h-10 rounded-md text-xs font-bold transition-colors border ${keyClass[st]} ${key.length > 1 ? "px-2 text-xs" : "w-8"}`}
                >
                  {key === "BACKSPACE" ? "⌫" : key}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHint(!showHint)}
        className="text-xs text-muted-foreground"
      >
        <Lightbulb className="w-3 h-3 mr-1 text-amber-400" />
        {showHint ? "Hide Hint" : "Show Hint"}
      </Button>
    </div>
  );
}

// ===================== CONCEPT CONNECTOR (replaces Matcher) =====================
// Drag a glowing line from each term-dot on the left to its matching
// definition-dot on the right. Wrong drops shake the target; fewer mistakes =
// higher score. Reuses the same `options.pairs` shape as the legacy matcher,
// so any old "matcher" or new "concept_connector" level can render with this.
function ConceptConnectorGame({ questions, onComplete }: { questions: any[]; onComplete: (score: number) => void }) {
  const pairs = (questions[0]?.options?.pairs || []) as { term: string; definition: string }[];

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const [shuffledRights] = useState<string[]>(() => shuffle(pairs.map(p => p.definition)));
  const [connections, setConnections] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [shakeDef, setShakeDef] = useState<string | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0); // forces SVG re-measure on layout shifts
  const containerRef = useRef<HTMLDivElement | null>(null);
  const leftDots = useRef<Record<string, HTMLDivElement | null>>({});
  const rightDots = useRef<Record<string, HTMLDivElement | null>>({});

  // Re-measure on resize so lines stay anchored.
  useEffect(() => {
    const onResize = () => setTick(t => t + 1);
    window.addEventListener("resize", onResize);
    const id = window.setTimeout(() => setTick(t => t + 1), 50);
    return () => { window.removeEventListener("resize", onResize); clearTimeout(id); };
  }, []);

  function dotCenter(el: HTMLDivElement | null): { x: number; y: number } | null {
    if (!el || !containerRef.current) return null;
    const r = el.getBoundingClientRect();
    const c = containerRef.current.getBoundingClientRect();
    return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
  }

  function startDrag(term: string, e: React.PointerEvent) {
    if (connections[term] || done) return;
    e.preventDefault();
    setDragging(term);
    const c = containerRef.current?.getBoundingClientRect();
    if (c) setPointer({ x: e.clientX - c.left, y: e.clientY - c.top });
  }
  function moveDrag(e: React.PointerEvent) {
    if (!dragging) return;
    const c = containerRef.current?.getBoundingClientRect();
    if (c) setPointer({ x: e.clientX - c.left, y: e.clientY - c.top });
  }
  function dropOnDef(def: string) {
    if (!dragging) return;
    const term = dragging;
    setDragging(null);
    const matchPair = pairs.find(p => p.term === term);
    if (matchPair?.definition === def) {
      setConnections(prev => {
        const next = { ...prev, [term]: def };
        if (Object.keys(next).length === pairs.length) {
          const score = Math.max(20, 100 - wrongCount * 8);
          setTimeout(() => { setDone(true); onComplete(score); }, 600);
        }
        return next;
      });
    } else {
      setShakeDef(def);
      setWrongCount(c => c + 1);
      setTimeout(() => setShakeDef(null), 450);
    }
  }

  if (!pairs.length) return <div className="text-center text-muted-foreground">No connection pairs available</div>;
  if (done) return null;

  // Build the SVG line overlays. `tick` is read so we recompute after layout.
  void tick;
  const greenLines: { from: { x: number; y: number }; to: { x: number; y: number }; key: string }[] = [];
  Object.entries(connections).forEach(([term, def]) => {
    const f = dotCenter(leftDots.current[term]);
    const t = dotCenter(rightDots.current[def]);
    if (f && t) greenLines.push({ from: f, to: t, key: term });
  });
  let dragLine: { from: { x: number; y: number }; to: { x: number; y: number } } | null = null;
  if (dragging) {
    const f = dotCenter(leftDots.current[dragging]);
    if (f) dragLine = { from: f, to: pointer };
  }

  const completed = Object.keys(connections).length;
  return (
    <div
      className="w-full max-w-2xl mx-auto select-none"
      onPointerMove={moveDrag}
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
    >
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">
          <span className="text-emerald-400 font-mono">{completed}</span> / {pairs.length} wired
          {wrongCount > 0 && <span className="ml-3 text-rose-400/80 font-mono">·  {wrongCount} miss{wrongCount === 1 ? "" : "es"}</span>}
        </p>
        <Progress value={(completed / pairs.length) * 100} className="mt-1 h-1.5" />
      </div>

      <div ref={containerRef} className="relative grid grid-cols-[1fr_56px_1fr] gap-0 touch-none">
        {/* SVG line overlay */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: "100%", height: "100%" }}
          aria-hidden
        >
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {greenLines.map(l => (
            <line
              key={l.key}
              x1={l.from.x} y1={l.from.y} x2={l.to.x} y2={l.to.y}
              stroke="#10b981" strokeWidth={3} strokeLinecap="round"
              filter="url(#glow)"
            />
          ))}
          {dragLine && (
            <line
              x1={dragLine.from.x} y1={dragLine.from.y}
              x2={dragLine.to.x} y2={dragLine.to.y}
              stroke="#a78bfa" strokeWidth={3} strokeLinecap="round"
              strokeDasharray="6 5" filter="url(#glow)"
            />
          )}
        </svg>

        {/* LEFT — terms */}
        <div className="space-y-2 relative z-10">
          <p className="text-xs font-bold text-muted-foreground tracking-widest font-mono text-center mb-3">CONCEPT</p>
          {pairs.map(pair => {
            const linked = !!connections[pair.term];
            const isDrag = dragging === pair.term;
            return (
              <div
                key={pair.term}
                className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-medium transition-colors ${
                  linked
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                    : isDrag
                    ? "bg-primary/15 border-primary/50 text-primary"
                    : "bg-secondary/50 border-border/40 text-foreground"
                }`}
                data-testid={`row-term-${pair.term.replace(/\s/g, "-")}`}
              >
                <span className="flex-1 break-words">{pair.term}</span>
                <div
                  ref={el => { leftDots.current[pair.term] = el; }}
                  onPointerDown={(e) => startDrag(pair.term, e)}
                  className={`w-5 h-5 rounded-full border-2 cursor-grab active:cursor-grabbing flex-shrink-0 transition-transform ${
                    linked
                      ? "bg-emerald-400 border-emerald-200"
                      : "bg-primary border-primary/70 hover:scale-125 active:scale-110 shadow-[0_0_10px_rgba(139,92,246,0.6)]"
                  }`}
                  data-testid={`dot-left-${pair.term.replace(/\s/g, "-")}`}
                />
              </div>
            );
          })}
        </div>

        {/* SPACER COLUMN — visual rail in the middle */}
        <div className="relative">
          <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
        </div>

        {/* RIGHT — definitions */}
        <div className="space-y-2 relative z-10">
          <p className="text-xs font-bold text-muted-foreground tracking-widest font-mono text-center mb-3">DEFINITION</p>
          {shuffledRights.map(def => {
            const linkedTerm = Object.entries(connections).find(([, d]) => d === def)?.[0];
            const linked = !!linkedTerm;
            const isShake = shakeDef === def;
            const isTarget = !!dragging && !linked;
            return (
              <motion.div
                key={def}
                animate={isShake ? { x: [0, -8, 8, -6, 6, 0] } : {}}
                transition={{ duration: 0.45 }}
                onPointerUp={() => dropOnDef(def)}
                className={`flex items-center gap-2 p-3 rounded-lg border text-xs leading-relaxed transition-colors ${
                  linked
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                    : isShake
                    ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                    : isTarget
                    ? "bg-accent/10 border-accent/50 text-foreground"
                    : "bg-secondary/50 border-border/40 text-foreground"
                }`}
                data-testid={`row-def-${def.slice(0, 16).replace(/\s/g, "-")}`}
              >
                <div
                  ref={el => { rightDots.current[def] = el; }}
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-transform ${
                    linked
                      ? "bg-emerald-400 border-emerald-200"
                      : isTarget
                      ? "bg-accent border-accent/70 scale-110 shadow-[0_0_10px_rgba(34,211,238,0.6)]"
                      : "bg-accent/70 border-accent/50"
                  }`}
                  data-testid={`dot-right-${def.slice(0, 16).replace(/\s/g, "-")}`}
                />
                <span className="flex-1 break-words">{def}</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="text-center mt-5 text-xs text-muted-foreground">
        Press a left dot, drag across, release on the matching right dot.
      </div>
    </div>
  );
}

// Stub kept so legacy DB rows with game_type="matcher" still route here.
function MatcherGame(props: { questions: any[]; onComplete: (score: number) => void }) {
  return <ConceptConnectorGame {...props} />;
}

// ===================== MEMORY FLIP GAME =====================
interface FlipCard {
  id: string;
  content: string;
  pairId: string;
  type: "term" | "def";
}

function MemoryFlipGame({ questions, onComplete }: { questions: any[]; onComplete: (score: number) => void }) {
  const pairs: { term: string; definition: string }[] = questions[0]?.options?.pairs?.slice(0, 8) || [];

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const [cards] = useState<FlipCard[]>(() => {
    const allCards: FlipCard[] = pairs.flatMap((p, i) => [
      { id: `t-${i}`, content: p.term, pairId: String(i), type: "term" as const },
      { id: `d-${i}`, content: p.definition, pairId: String(i), type: "def" as const },
    ]);
    return shuffle(allCards);
  });

  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<FlipCard[]>([]);
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState(0);
  const [done, setDone] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  function handleFlip(card: FlipCard) {
    if (isChecking || flipped.has(card.id) || matched.has(card.pairId) || selected.find(c => c.id === card.id)) return;

    const newSelected = [...selected, card];
    const newFlipped = new Set(flipped);
    newFlipped.add(card.id);
    setFlipped(newFlipped);

    if (newSelected.length === 1) {
      setSelected(newSelected);
    } else {
      setAttempts(a => a + 1);
      setIsChecking(true);
      const [a, b] = newSelected;
      if (a.pairId === b.pairId && a.type !== b.type) {
        const newMatched = new Set(matched);
        newMatched.add(a.pairId);
        setMatched(newMatched);
        setSelected([]);
        setIsChecking(false);
        if (newMatched.size === pairs.length) {
          const score = Math.max(10, Math.min(100, 100 - (attempts - pairs.length) * 5));
          setTimeout(() => {
            setDone(true);
            onComplete(score);
          }, 600);
        }
      } else {
        setWrong(new Set([a.id, b.id]));
        setTimeout(() => {
          const revert = new Set(flipped);
          revert.delete(a.id);
          revert.delete(b.id);
          setFlipped(revert);
          setWrong(new Set());
          setSelected([]);
          setIsChecking(false);
        }, 900);
      }
    }
  }

  if (done) return null;
  if (!pairs.length) return <div className="text-center text-muted-foreground">No pairs available</div>;

  const totalPairs = pairs.length;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          Matched: <span className="text-purple-400 font-bold">{matched.size}</span>/{totalPairs}
        </div>
        <div className="flex gap-1">
          {Array.from({ length: totalPairs }, (_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${i < matched.size ? "bg-purple-500" : "bg-border/40"}`} />
          ))}
        </div>
        <div className="text-sm text-muted-foreground">
          Tries: <span className="text-foreground font-bold">{attempts}</span>
        </div>
      </div>

      {/* Instruction */}
      <p className="text-xs text-center text-muted-foreground mb-4 font-mono">
        Match each TERM with its DEFINITION — flip two cards at a time
      </p>

      {/* Card grid */}
      <div className="grid grid-cols-4 gap-2.5">
        {cards.map(card => {
          const isFlipped = flipped.has(card.id);
          const isMatched = matched.has(card.pairId);
          const isWrong = wrong.has(card.id);
          const isSelected = !!selected.find(c => c.id === card.id);

          return (
            <motion.div key={card.id}
              onClick={() => handleFlip(card)}
              whileTap={!isFlipped ? { scale: 0.95 } : {}}
              className="cursor-pointer"
              style={{ perspective: 600 }}
            >
              <motion.div
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                style={{ transformStyle: "preserve-3d", position: "relative", height: 90 }}
              >
                {/* Back (face-down) */}
                <div className="absolute inset-0 rounded-xl flex items-center justify-center border"
                  style={{
                    backfaceVisibility: "hidden",
                    background: "linear-gradient(135deg, #2e1065, #1e3a8a)",
                    borderColor: "rgba(139,92,246,0.3)",
                  }}>
                  <Sparkles className="w-6 h-6 text-purple-400/60" />
                </div>

                {/* Front (face-up) */}
                <div className={`absolute inset-0 rounded-xl flex items-center justify-center p-2 border text-center transition-colors
                  ${isMatched ? "border-purple-500/60 bg-purple-500/15" :
                    isWrong ? "border-rose-500/60 bg-rose-500/15" :
                    isSelected ? "border-primary/60 bg-primary/10" :
                    "border-border/40 bg-card"}`}
                  style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                  <p className={`text-[10px] leading-tight font-medium ${isMatched ? "text-purple-300" : isWrong ? "text-rose-300" : "text-foreground"}`}>
                    {card.content}
                  </p>
                  {isMatched && (
                    <div className="absolute bottom-1 right-1">
                      <CheckCircle2 className="w-3 h-3 text-purple-400" />
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ===================== MAIN GAME PAGE =====================
function readStageFromUrl(): number {
  if (typeof window === "undefined") return 0;
  const raw = new URLSearchParams(window.location.search).get("stage");
  const n = parseInt(raw ?? "0", 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const [location, setLocation] = useLocation();
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const { data: level, isLoading } = useQuery<any>({ queryKey: ["/api/levels", id] });
  const { data: progress } = useQuery<any[]>({ queryKey: ["/api/progress"] });

  const [gameState, setGameState] = useState<"idle" | "playing" | "complete">("idle");
  const [finalScore, setFinalScore] = useState(0);
  const [gameSessionId, setGameSessionId] = useState<string | null>(null);

  // Track active stage from URL (?stage=N). Re-read on URL change.
  const [stageIndex, setStageIndex] = useState<number>(() => readStageFromUrl());
  useEffect(() => {
    setStageIndex(readStageFromUrl());
    setGameState("idle");
    setFinalScore(0);
    setGameSessionId(null);
  }, [location]);

  const createSessionMutation = useMutation({
    mutationFn: (data: { levelId: string; stageIndex: number }) =>
      apiRequest("POST", "/api/game-session", data),
  });

  const progressMutation = useMutation({
    mutationFn: (data: { levelId: string; stageIndex: number; score: number; completed: boolean; sessionId?: string | null }) =>
      apiRequest("POST", "/api/progress", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.user) updateUser(data.user);
    },
  });

  async function startGame() {
    const totalQs = level?.questions?.length ?? 0;
    const arcade = isArcadeSADGame(level?.gameType);
    const totalForLevel = !arcade && isSADGame(level?.gameType) ? Math.max(totalQs, 1) : 1;
    const submittedStage = Math.min(Math.max(stageIndex, 0), Math.max(totalForLevel - 1, 0));
    let sessionId: string | null = null;
    try {
      const result = await createSessionMutation.mutateAsync({ levelId: id!, stageIndex: submittedStage });
      sessionId = result?.sessionId ?? null;
    } catch {
      // Proceed without session — server will just not award completion bonus.
    }
    setGameSessionId(sessionId);
    setGameState("playing");
  }

  async function handleGameComplete(score: number) {
    setFinalScore(score);
    setGameState("complete");

    const totalQs = level?.questions?.length ?? 0;
    const arcade = isArcadeSADGame(level?.gameType);
    const totalForLevel = !arcade && isSADGame(level?.gameType) ? Math.max(totalQs, 1) : 1;
    const submittedStage = Math.min(Math.max(stageIndex, 0), Math.max(totalForLevel - 1, 0));

    try {
      const result = await progressMutation.mutateAsync({
        levelId: id!,
        stageIndex: submittedStage,
        score,
        completed: score > 0,
        sessionId: gameSessionId,
      });

      if (result.xpGained > 0) {
        toast({
          title: result.justFinishedLevel
            ? `🏆 LEVEL CLEAR — +${result.xpGained} XP!`
            : `+${result.xpGained} XP earned!`,
          description: result.isFirstStageCompletion
            ? `Stage ${submittedStage + 1} clear · +${result.coinsGained} EduCoins`
            : `Score: ${score}`,
        });
      }
    } catch (e) {
      // Silently fail progress save
    }
  }

  function goToStage(nextStage: number) {
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `/game/${id}?stage=${nextStage}`);
    }
    setStageIndex(nextStage);
    setGameState("idle");
    setFinalScore(0);
    setGameSessionId(null);
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-sm">
          <div className="h-8 rounded bg-card/50 animate-pulse" />
          <div className="h-64 rounded-xl bg-card/50 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!level) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground mb-4">Level not found</p>
      <Link href="/courses">
        <Button>Back to Courses</Button>
      </Link>
    </div>
  );

  const questions = level.questions || [];
  const diffConfig = getDifficultyConfig(level.difficulty);
  const gameConfig = getGameTypeConfig(level.gameType);

  // Stage plumbing — most SAD games are multi-stage (one question per stage).
  // Arcade SAD games (req_sorter, sdlc_sorter) are single-stage and consume the
  // FULL question pool internally; slicing them down to one question per stage
  // would let the player win by repeating the same input forever.
  const isSAD = isSADGame(level.gameType);
  const isArcade = isArcadeSADGame(level.gameType);
  const totalStages = isSAD && !isArcade ? Math.max(questions.length, 1) : 1;
  const safeStageIndex = Math.min(Math.max(stageIndex, 0), Math.max(totalStages - 1, 0));
  const stageQuestions = isSAD && !isArcade
    ? [questions[safeStageIndex]].filter(Boolean)
    : questions;
  const difficulty = totalStages > 1 ? safeStageIndex / (totalStages - 1) : 0;
  const diffPill = difficultyLabel(difficulty);

  // Per-level stage progress map (one row per stage).
  const levelStageRows = (progress || []).filter((p: any) => p.levelId === id);
  const stagesByIdx = new Map<number, any>(
    levelStageRows.map((p: any) => [p.stageIndex ?? 0, p])
  );
  const prevStageProgress = stagesByIdx.get(safeStageIndex);
  const completedStages = new Set<number>(
    levelStageRows.filter((p: any) => p.completed).map((p: any) => p.stageIndex ?? 0)
  );
  const levelFullyCompleted = completedStages.size >= totalStages;
  const nextUnfinishedStage = (() => {
    for (let i = safeStageIndex + 1; i < totalStages; i++) {
      if (!completedStages.has(i)) return i;
    }
    for (let i = 0; i < totalStages; i++) {
      if (!completedStages.has(i)) return i;
    }
    return -1;
  })();
  const hasMoreStagesAfter = isSAD && safeStageIndex + 1 < totalStages;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <motion.div
          className="flex items-center gap-3 mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link href={`/courses/${level.topicId || ""}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold" style={{ fontFamily: "Oxanium, sans-serif" }}>{level.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <Badge variant="outline" className={`text-xs ${diffConfig.color} border ${diffConfig.bg}`}>
                {diffConfig.label}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {gameConfig.label}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-primary">
                <Zap className="w-3 h-3" />
                <span>+{level.xpReward} XP</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-yellow-400">
                <Coins className="w-3 h-3" />
                <span>+{level.coinReward}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Game Container */}
        <AnimatePresence mode="wait">
          {gameState === "idle" && isSADGame(level.gameType) && (() => {
            const meta = SAD_GAMES[level.gameType];
            const Icon = meta.icon;
            return (
              <motion.div
                key="idle-sad"
                className="text-center py-8"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="glass-strong rounded-2xl p-7 border border-primary/20 max-w-lg mx-auto text-left">
                  <div className="flex items-start gap-4 mb-5">
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-mono tracking-widest text-muted-foreground mb-1">
                        PLAY · LEARN · {meta.emoji}
                      </div>
                      <h2 className="text-xl font-bold leading-tight" style={{ fontFamily: "Oxanium, sans-serif" }}>
                        {meta.title}
                      </h2>
                    </div>
                  </div>

                  <div className="rounded-lg bg-card/60 border border-border/40 p-4 mb-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <p className="text-sm leading-relaxed">{meta.short}</p>
                    </div>
                  </div>

                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 mb-3">
                    <p className="text-xs text-primary font-mono tracking-wider mb-1">DID YOU KNOW</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{meta.detail}</p>
                  </div>

                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4 mb-5">
                    <p className="text-xs text-emerald-300 font-mono tracking-wider mb-1">HOW TO PLAY</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{meta.howTo}</p>
                  </div>

                  {/* Stage badge + progress */}
                  {totalStages > 1 && (
                    <div className="rounded-lg bg-background/40 border border-border/40 p-3 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono tracking-widest text-muted-foreground">
                          STAGE {safeStageIndex + 1} / {totalStages}
                        </span>
                        <span className={`text-[11px] font-mono tracking-widest font-bold ${diffPill.color}`} data-testid="text-stage-difficulty">
                          {diffPill.label}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {Array.from({ length: totalStages }).map((_, i) => (
                          <div
                            key={i}
                            className={`flex-1 h-1.5 rounded-full ${
                              completedStages.has(i)
                                ? "bg-emerald-400"
                                : i === safeStageIndex
                                ? "bg-primary"
                                : "bg-muted/30"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {prevStageProgress?.completed && (
                    <div className="flex items-center gap-2 justify-center mb-3 text-sm text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Best score this stage: {prevStageProgress.score} — beat it!
                    </div>
                  )}

                  <Button
                    size="lg"
                    onClick={startGame}
                    className="w-full"
                    data-testid="button-start-game"
                    disabled={createSessionMutation.isPending}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {prevStageProgress?.completed
                      ? `Replay Stage ${safeStageIndex + 1}`
                      : totalStages > 1
                      ? `Start Stage ${safeStageIndex + 1}`
                      : "Start Playing"}
                  </Button>
                </div>
              </motion.div>
            );
          })()}

          {gameState === "idle" && !isSADGame(level.gameType) && (
            <motion.div
              key="idle"
              className="text-center py-12"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="glass-strong rounded-2xl p-8 border border-primary/20 max-w-md mx-auto">
                {level.gameType === "wordle" && <Hash className="w-16 h-16 text-violet-400 mx-auto mb-4 animate-float" />}
                {(level.gameType === "concept_connector" || level.gameType === "matcher") && <Link2 className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-float" />}
                {level.gameType === "memory_flip" && <Sparkles className="w-16 h-16 text-purple-400 mx-auto mb-4 animate-float" />}

                <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "Oxanium, sans-serif" }}>
                  {gameConfig.label}
                </h2>
                <p className="text-muted-foreground text-sm mb-6">{gameConfig.description}</p>

                {level.gameType === "wordle" && (
                  <div className="glass rounded-lg p-3 mb-6 text-xs text-muted-foreground text-left space-y-1">
                    <p className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-emerald-600/50 inline-block flex-shrink-0" /> Correct position</p>
                    <p className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-amber-600/50 inline-block flex-shrink-0" /> In word, wrong position</p>
                    <p className="flex items-center gap-2"><span className="w-4 h-4 rounded bg-slate-600/50 inline-block flex-shrink-0" /> Not in word</p>
                    <p className="mt-1 text-muted-foreground/60">Type letters or click keyboard, press ENTER to submit</p>
                  </div>
                )}

                {(level.gameType === "concept_connector" || level.gameType === "matcher") && (
                  <div className="glass rounded-lg p-3 mb-6 text-xs text-muted-foreground text-left space-y-1">
                    <p>🔗 Press a glowing dot on the left and drag a line to its matching dot on the right.</p>
                    <p>✅ Wire every concept to the right definition to clear the round.</p>
                    <p>💡 Fewer wrong drops = a higher score!</p>
                  </div>
                )}
                {level.gameType === "memory_flip" && (
                  <div className="glass rounded-lg p-3 mb-6 text-xs text-muted-foreground text-left space-y-1">
                    <p>🃏 Flip cards to reveal terms and their definitions.</p>
                    <p>✅ Match every term with its definition to win!</p>
                    <p>💡 Fewer attempts = higher score. Use your memory!</p>
                  </div>
                )}

                {prevStageProgress?.completed && (
                  <div className="flex items-center gap-2 justify-center mb-4 text-sm text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Best score: {prevStageProgress.score} — play again for fun!
                  </div>
                )}

                <Button size="lg" onClick={startGame} className="w-full" data-testid="button-start-game" disabled={createSessionMutation.isPending}>
                  <Zap className="w-4 h-4 mr-2" />
                  {prevStageProgress?.completed ? "Play Again" : "Start Game"}
                </Button>
              </div>
            </motion.div>
          )}

          {gameState === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              {isSADGame(level.gameType) && (
                <SADGameRunner
                  gameType={level.gameType}
                  questions={stageQuestions}
                  onComplete={handleGameComplete}
                  difficulty={difficulty}
                  stageIndex={safeStageIndex}
                  totalStages={totalStages}
                  gameSessionId={gameSessionId}
                  levelId={id!}
                />
              )}
              {level.gameType === "wordle" && (
                <WordleGame questions={questions} onComplete={handleGameComplete} />
              )}
              {level.gameType === "concept_connector" && (
                <ConceptConnectorGame questions={questions} onComplete={handleGameComplete} />
              )}
              {level.gameType === "matcher" && (
                <MatcherGame questions={questions} onComplete={handleGameComplete} />
              )}
              {level.gameType === "memory_flip" && (
                <MemoryFlipGame questions={questions} onComplete={handleGameComplete} />
              )}
            </motion.div>
          )}

          {gameState === "complete" && (() => {
            const justFinishedLevel = !!progressMutation.data?.justFinishedLevel;
            const passed = finalScore > 0;
            const showNextStage = passed && hasMoreStagesAfter && nextUnfinishedStage > safeStageIndex;
            const headline = justFinishedLevel
              ? "🏆 LEVEL CLEAR!"
              : passed && totalStages > 1
              ? `STAGE ${safeStageIndex + 1} CLEAR!`
              : passed
              ? "LEVEL COMPLETE!"
              : "GAME OVER";
            return (
            <motion.div
              key="complete"
              className="text-center py-8 max-w-md mx-auto"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className={`glass-strong rounded-2xl p-8 border ${justFinishedLevel ? "border-yellow-400/50" : "border-primary/20"}`}>
                {/* Confetti burst on level clear */}
                {justFinishedLevel && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const colors = ["#fbbf24", "#34d399", "#a78bfa", "#fb7185", "#22d3ee"];
                      const color = colors[i % colors.length];
                      const angle = (i / 24) * Math.PI * 2;
                      return (
                        <motion.div
                          key={i}
                          className="absolute rounded-sm"
                          style={{ left: "50%", top: "20%", width: 8, height: 14, background: color }}
                          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                          animate={{
                            x: Math.cos(angle) * 220,
                            y: Math.sin(angle) * 220 + 100,
                            opacity: 0,
                            rotate: 720,
                          }}
                          transition={{ duration: 1.4, delay: i * 0.02, ease: "easeOut" }}
                        />
                      );
                    })}
                  </div>
                )}

                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.8 }}
                  className="mb-4 relative z-10"
                >
                  <Trophy className={`w-16 h-16 mx-auto ${justFinishedLevel ? "text-yellow-300" : passed ? "text-yellow-400" : "text-muted-foreground/40"}`} />
                </motion.div>

                <h2 className="text-2xl font-bold mb-2 relative z-10" style={{ fontFamily: "Oxanium, sans-serif" }}>
                  {headline}
                </h2>
                {totalStages > 1 && (
                  <div className="flex items-center justify-center gap-1 mb-3">
                    {Array.from({ length: totalStages }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full ${
                          (passed && i === safeStageIndex) || completedStages.has(i)
                            ? "bg-emerald-400"
                            : "bg-muted/30"
                        }`}
                        style={{ width: 22 }}
                      />
                    ))}
                  </div>
                )}
                <p className="text-muted-foreground mb-6 relative z-10">
                  {justFinishedLevel
                    ? "Every stage cleared. You're a master of this level!"
                    : passed && hasMoreStagesAfter
                    ? "Stage banked. Push on to the next stage when you're ready."
                    : passed
                    ? "Great work! XP and EduCoins added."
                    : "Don't give up! Try again."}
                </p>

                <div className="flex justify-center gap-6 mb-8 relative z-10">
                  <div className="text-center">
                    <div className="text-3xl font-bold font-mono text-primary">{finalScore}</div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                  {progressMutation.data && (
                    <>
                      <div className="text-center">
                        <div className="text-3xl font-bold font-mono text-emerald-400">+{progressMutation.data.xpGained || 0}</div>
                        <div className="text-xs text-muted-foreground">XP</div>
                      </div>
                      <div className="text-center">
                        <div className="text-3xl font-bold font-mono text-yellow-400">+{progressMutation.data.coinsGained || 0}</div>
                        <div className="text-xs text-muted-foreground">Coins</div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-2 relative z-10">
                  {showNextStage && (
                    <Button
                      size="lg"
                      className="w-full bg-gradient-to-r from-primary to-violet-500 text-primary-foreground"
                      onClick={() => goToStage(nextUnfinishedStage)}
                      data-testid="button-next-stage"
                    >
                      Next Stage {nextUnfinishedStage + 1} <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setGameState("idle")}
                      data-testid="button-play-again"
                    >
                      <RotateCcw className="w-4 h-4 mr-1" /> Play Again
                    </Button>
                    <Link href={`/courses/${level.topicId || ""}`} className="flex-1">
                      <Button variant={showNextStage ? "outline" : "default"} className="w-full" data-testid="button-next-level">
                        Back to Level <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}
