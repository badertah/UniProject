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
  XCircle, Lightbulb, Trophy, Hash, Link2, Smile, Timer, Info,
  Gamepad2, Sparkles
} from "lucide-react";
import { Link } from "wouter";
import { getDifficultyConfig, getGameTypeConfig } from "@/lib/utils";
import { SAD_GAMES, isSADGame, SADGameRunner, difficultyLabel } from "@/components/sad-games";

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

// ===================== MATCHER GAME =====================
interface MatcherState {
  pairs: { term: string; definition: string }[];
  selectedTerm: string | null;
  selectedDef: string | null;
  matched: Set<string>;
  wrong: Set<string>;
  score: number;
  attempts: number;
}

function MatcherGame({ questions, onComplete }: { questions: any[]; onComplete: (score: number) => void }) {
  const pairs = questions[0]?.options?.pairs || [];

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const [shuffledDefs, setShuffledDefs] = useState<string[]>(() => shuffle(pairs.map((p: any) => p.definition)));
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [selectedDef, setSelectedDef] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [attempts, setAttempts] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (selectedTerm && selectedDef) {
      const matchPair = pairs.find((p: any) => p.term === selectedTerm);
      const isCorrect = matchPair?.definition === selectedDef;

      setAttempts(a => a + 1);

      if (isCorrect) {
        const newMatched = new Set(matched);
        newMatched.add(selectedTerm);
        setMatched(newMatched);
        setSelectedTerm(null);
        setSelectedDef(null);

        if (newMatched.size === pairs.length) {
          const score = Math.max(0, 100 - (attempts) * 5);
          setTimeout(() => {
            setDone(true);
            onComplete(score);
          }, 800);
        }
      } else {
        setWrong(new Set([selectedTerm, selectedDef]));
        setTimeout(() => {
          setWrong(new Set());
          setSelectedTerm(null);
          setSelectedDef(null);
        }, 800);
      }
    }
  }, [selectedTerm, selectedDef]);

  if (!pairs.length) return <div className="text-center text-muted-foreground">No matching pairs found</div>;
  if (done) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-4">
        <p className="text-sm text-muted-foreground">{matched.size} / {pairs.length} matched</p>
        <Progress value={(matched.size / pairs.length) * 100} className="mt-1 h-1.5" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Terms */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground tracking-widest font-mono text-center mb-3">TERMS</p>
          {pairs.map((pair: any) => {
            const isMatched = matched.has(pair.term);
            const isSelected = selectedTerm === pair.term;
            const isWrong = wrong.has(pair.term);

            return (
              <motion.button
                key={pair.term}
                onClick={() => !isMatched && setSelectedTerm(isSelected ? null : pair.term)}
                className={`w-full p-3 rounded-lg text-sm text-left transition-all border font-medium ${
                  isMatched
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 cursor-default"
                    : isWrong
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                    : isSelected
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-secondary/50 border-border/40 text-foreground hover:border-primary/30"
                }`}
                whileTap={!isMatched ? { scale: 0.97 } : {}}
                data-testid={`term-${pair.term.replace(/\s/g, "-")}`}
              >
                {isMatched ? <CheckCircle2 className="w-4 h-4 inline mr-2 text-emerald-400" /> : null}
                {pair.term}
              </motion.button>
            );
          })}
        </div>

        {/* Definitions */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted-foreground tracking-widest font-mono text-center mb-3">DEFINITIONS</p>
          {shuffledDefs.map((def) => {
            const matchTerm = pairs.find((p: any) => p.definition === def)?.term;
            const isMatched = matchTerm ? matched.has(matchTerm) : false;
            const isSelected = selectedDef === def;
            const isWrong = wrong.has(def);

            return (
              <motion.button
                key={def}
                onClick={() => !isMatched && setSelectedDef(isSelected ? null : def)}
                className={`w-full p-3 rounded-lg text-xs text-left transition-all border leading-relaxed ${
                  isMatched
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 cursor-default"
                    : isWrong
                    ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                    : isSelected
                    ? "bg-accent/20 border-accent/50 text-accent"
                    : "bg-secondary/50 border-border/40 text-foreground hover:border-accent/30"
                }`}
                whileTap={!isMatched ? { scale: 0.97 } : {}}
                data-testid={`def-${def.slice(0, 20).replace(/\s/g, "-")}`}
              >
                {def}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="text-center mt-4 text-xs text-muted-foreground">
        Click a term, then click its matching definition
      </div>
    </div>
  );
}

// ===================== EMOJI CIPHER GAME =====================
function EmojiCipherGame({ questions, onComplete }: { questions: any[]; onComplete: (score: number) => void }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const question = questions[currentQ];
  if (!question) return <div className="text-center text-muted-foreground">No questions available</div>;

  const choices: string[] = question.options?.choices || [];

  function handleSelect(choice: string) {
    if (answered) return;
    setSelected(choice);
    setAnswered(true);
    const correct = choice === question.answer;
    if (correct) setScore(s => s + 20);

    setTimeout(() => {
      if (currentQ + 1 >= questions.length) {
        onComplete(score + (correct ? 20 : 0));
      } else {
        setCurrentQ(q => q + 1);
        setSelected(null);
        setAnswered(false);
        setShowHint(false);
      }
    }, 1200);
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i < currentQ ? "bg-emerald-500" : i === currentQ ? "bg-primary" : "bg-border/40"
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Smile className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono text-muted-foreground">
            Question {currentQ + 1} / {questions.length}
          </span>
        </div>

        {/* Cipher display */}
        <div className="glass rounded-xl p-6 border border-border/40 mb-4">
          <div className="text-lg font-medium text-foreground leading-relaxed">
            {question.content}
          </div>
          <div className="mt-3 text-sm text-muted-foreground">What concept does this describe?</div>
        </div>

        {showHint && question.hint && (
          <motion.div
            className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            Hint: {question.hint}
          </motion.div>
        )}
      </div>

      {/* Choices */}
      <div className="grid grid-cols-1 gap-2">
        {choices.map((choice) => {
          const isSelected = selected === choice;
          const isCorrect = answered && choice === question.answer;
          const isWrong = answered && isSelected && choice !== question.answer;

          return (
            <motion.button
              key={choice}
              onClick={() => handleSelect(choice)}
              disabled={answered}
              className={`w-full p-3.5 rounded-xl text-sm text-left transition-all border font-medium ${
                isCorrect
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                  : isWrong
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                  : answered
                  ? "opacity-50 bg-muted/20 border-border/30 text-muted-foreground cursor-not-allowed"
                  : "bg-secondary/50 border-border/40 text-foreground hover:border-primary/40 hover:bg-primary/5"
              }`}
              whileTap={!answered ? { scale: 0.98 } : {}}
              data-testid={`choice-${choice.replace(/\s/g, "-")}`}
            >
              <span className="flex items-center gap-2">
                {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                {isWrong && <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                {choice}
              </span>
            </motion.button>
          );
        })}
      </div>

      <div className="text-center mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHint(!showHint)}
          className="text-xs text-muted-foreground"
        >
          <Lightbulb className="w-3 h-3 mr-1 text-amber-400" />
          {showHint ? "Hide Hint" : "Need a hint?"}
        </Button>
      </div>
    </div>
  );
}

// ===================== SPEED BLITZ GAME =====================
const BLITZ_COLORS = [
  "from-blue-600 to-blue-800 border-blue-500/40",
  "from-emerald-600 to-emerald-800 border-emerald-500/40",
  "from-amber-600 to-amber-800 border-amber-500/40",
  "from-purple-600 to-purple-800 border-purple-500/40",
];

function SpeedBlitzGame({ questions, onComplete }: { questions: any[]; onComplete: (score: number) => void }) {
  const TIME_PER_Q = 9;
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [selected, setSelected] = useState<string | null>(null);
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const timerRef = useRef<number | null>(null);

  const q = questions[qIndex];
  const choices: string[] = q?.options?.choices || [];
  const total = questions.length;

  function nextQuestion(addScore: number) {
    const ns = score + addScore;
    setScore(ns);
    if (qIndex + 1 >= total) {
      setTimeout(() => onComplete(ns), 700);
    } else {
      setTimeout(() => {
        setQIndex(i => i + 1);
        setSelected(null);
        setFlash(null);
        setTimeLeft(TIME_PER_Q);
      }, 700);
    }
  }

  function handleAnswer(choice: string) {
    if (selected || flash) return;
    setSelected(choice);
    const correct = choice === q.answer;
    setFlash(correct ? "correct" : "wrong");
    const bonus = correct ? Math.max(5, Math.round(timeLeft * 10)) : 0;
    if (timerRef.current) clearInterval(timerRef.current);
    nextQuestion(bonus);
  }

  useEffect(() => {
    setTimeLeft(TIME_PER_Q);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setFlash("wrong");
          nextQuestion(0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [qIndex]);

  if (!q) return null;

  const pct = (timeLeft / TIME_PER_Q) * 100;
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);
  const timerColor = timeLeft > 5 ? "#10b981" : timeLeft > 2 ? "#f59e0b" : "#ef4444";

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Progress dots */}
      <div className="flex gap-1.5 mb-4 justify-center">
        {questions.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full flex-1 max-w-[40px] transition-colors duration-300 ${i < qIndex ? "bg-emerald-500" : i === qIndex ? "bg-rose-500" : "bg-border/40"}`} />
        ))}
      </div>

      {/* Timer + Question */}
      <div className={`relative rounded-2xl border p-6 mb-5 text-center transition-colors duration-300 ${
        flash === "correct" ? "bg-emerald-500/20 border-emerald-500/40" :
        flash === "wrong" ? "bg-rose-500/20 border-rose-500/40" :
        "glass border-border/40"
      }`}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-mono text-muted-foreground">Q {qIndex + 1}/{total}</div>
          <div className="relative flex items-center justify-center">
            <svg width="88" height="88" className="-rotate-90">
              <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle cx="44" cy="44" r={r} fill="none" stroke={timerColor} strokeWidth="6"
                strokeDasharray={circ} strokeDashoffset={dash}
                strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }} />
            </svg>
            <div className="absolute text-2xl font-black" style={{ color: timerColor, fontFamily: "Oxanium, sans-serif" }}>
              {timeLeft}
            </div>
          </div>
          <div className="text-xs font-mono text-yellow-400">{score} pts</div>
        </div>
        <p className="text-base font-semibold leading-snug">{q.content}</p>
        {flash === "correct" && <div className="mt-2 text-emerald-400 font-bold text-sm">+{Math.max(5, Math.round(timeLeft * 10))} pts!</div>}
        {flash === "wrong" && <div className="mt-2 text-rose-400 font-bold text-sm">The answer was: {q.answer}</div>}
      </div>

      {/* Choices */}
      <div className="grid grid-cols-2 gap-3">
        {choices.map((choice, ci) => {
          const isSelected = selected === choice;
          const isCorrect = flash && choice === q.answer;
          const isWrong = flash && isSelected && choice !== q.answer;
          return (
            <motion.button key={choice} onClick={() => handleAnswer(choice)} disabled={!!flash}
              whileTap={!flash ? { scale: 0.96 } : {}}
              className={`relative p-4 rounded-xl border text-sm font-bold text-left transition-all duration-200 bg-gradient-to-br text-white overflow-hidden
                ${isCorrect ? "from-emerald-500 to-emerald-700 border-emerald-400/60 scale-105" :
                  isWrong ? "from-rose-500 to-rose-700 border-rose-400/60" :
                  flash ? `${BLITZ_COLORS[ci % 4]} opacity-40` :
                  `${BLITZ_COLORS[ci % 4]} hover:scale-[1.02] hover:brightness-110`}`}
              data-testid={`blitz-choice-${ci}`}>
              <span className="absolute top-2 right-2 text-lg font-black opacity-20">
                {["A", "B", "C", "D"][ci]}
              </span>
              {isCorrect && <CheckCircle2 className="w-4 h-4 mb-1 text-white" />}
              {isWrong && <XCircle className="w-4 h-4 mb-1 text-white" />}
              {choice}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ===================== BUBBLE POP GAME =====================
const BUBBLE_COLORS = [
  { bg: "#7c3aed", border: "#a855f7" },
  { bg: "#0891b2", border: "#22d3ee" },
  { bg: "#047857", border: "#34d399" },
  { bg: "#b45309", border: "#fbbf24" },
  { bg: "#9f1239", border: "#fb7185" },
];

interface Bubble {
  id: string;
  term: string;
  x: number;
  isCorrect: boolean;
  color: { bg: string; border: string };
  duration: number;
  delay: number;
  wobbleOffset: number;
}

function BubblePopGame({ questions, onComplete }: { questions: any[]; onComplete: (score: number) => void }) {
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [popped, setPopped] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [roundDone, setRoundDone] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; correct: boolean } | null>(null);

  const q = questions[qIndex];
  const total = questions.length;

  function buildBubbles(q: any): Bubble[] {
    const choices: string[] = q?.options?.choices || [];
    const shuffled = [...choices].sort(() => Math.random() - 0.5);
    return shuffled.map((term, i) => ({
      id: `${qIndex}-${i}`,
      term,
      x: 8 + (i / (shuffled.length - 1)) * 76,
      isCorrect: term === q.answer,
      color: BUBBLE_COLORS[i % BUBBLE_COLORS.length],
      duration: 4.5 + Math.random() * 2.5,
      delay: i * 0.3,
      wobbleOffset: (Math.random() - 0.5) * 60,
    }));
  }

  useEffect(() => {
    if (!q) return;
    setBubbles(buildBubbles(q));
    setPopped(new Set());
    setWrong(new Set());
    setRoundDone(false);
    setFeedback(null);
  }, [qIndex]);

  function handlePop(bubble: Bubble) {
    if (popped.has(bubble.id) || roundDone) return;
    if (bubble.isCorrect) {
      const newPopped = new Set(popped);
      newPopped.add(bubble.id);
      setPopped(newPopped);
      setRoundDone(true);
      setFeedback({ text: "🎉 Correct! +20 pts", correct: true });
      const ns = score + 20;
      setScore(ns);
      setTimeout(() => {
        if (qIndex + 1 >= total) onComplete(ns);
        else { setQIndex(i => i + 1); }
      }, 1200);
    } else {
      const newWrong = new Set(wrong);
      newWrong.add(bubble.id);
      setWrong(newWrong);
      setFeedback({ text: "❌ Wrong! Try again", correct: false });
      setTimeout(() => {
        setWrong(new Set());
        setFeedback(null);
      }, 700);
    }
  }

  if (!q) return null;

  return (
    <div className="w-full max-w-lg mx-auto select-none">
      {/* Progress */}
      <div className="flex gap-1.5 mb-4 justify-center">
        {questions.map((_, i) => (
          <div key={i} className={`h-1.5 rounded-full flex-1 max-w-[50px] transition-colors ${i < qIndex ? "bg-cyan-500" : i === qIndex ? "bg-cyan-400" : "bg-border/40"}`} />
        ))}
      </div>

      {/* Definition card */}
      <div className="glass rounded-2xl border border-cyan-500/30 p-5 mb-2 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ background: "radial-gradient(circle at 50% 0%, #22d3ee, transparent 70%)" }} />
        <p className="text-xs font-mono text-cyan-400 mb-2 tracking-widest">POP THE RIGHT BUBBLE!</p>
        <p className="text-base font-semibold text-foreground leading-snug">{q.content}</p>
        <AnimatePresence>
          {feedback && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mt-2 text-sm font-bold ${feedback.correct ? "text-emerald-400" : "text-rose-400"}`}>
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-2 text-xs text-muted-foreground font-mono">{score} pts • Round {qIndex + 1}/{total}</div>
      </div>

      {/* Bubble arena */}
      <div className="relative rounded-2xl border border-border/30 overflow-hidden"
        style={{ height: 340, background: "linear-gradient(180deg, #0f0c29 0%, #1a0533 100%)" }}>
        {/* Stars */}
        {[10,20,35,50,65,80,90].map((x, i) => (
          <div key={i} className="absolute w-0.5 h-0.5 rounded-full bg-white/40"
            style={{ left: `${x}%`, top: `${(i * 37) % 60 + 5}%` }} />
        ))}

        <AnimatePresence>
          {bubbles.map(bubble => {
            const isPop = popped.has(bubble.id);
            const isWrong = wrong.has(bubble.id);

            return (
              <motion.div key={bubble.id}
                initial={{ y: 380, x: 0, scale: 1, opacity: 1 }}
                animate={isPop
                  ? { scale: [1, 1.5, 0], opacity: [1, 1, 0] }
                  : isWrong
                  ? { x: [0, -12, 12, -8, 8, 0] }
                  : { y: -120, x: [0, bubble.wobbleOffset, -bubble.wobbleOffset / 2, bubble.wobbleOffset / 3, 0] }
                }
                transition={isPop
                  ? { duration: 0.4 }
                  : isWrong
                  ? { duration: 0.5 }
                  : { duration: bubble.duration, delay: bubble.delay, ease: "easeOut", x: { duration: bubble.duration, repeat: Infinity } }
                }
                exit={{ scale: 0, opacity: 0 }}
                style={{ position: "absolute", left: `${bubble.x}%`, bottom: 10, transform: "translateX(-50%)" }}
                onClick={() => handlePop(bubble)}
                className="cursor-pointer"
              >
                <div className="relative flex items-center justify-center rounded-full text-xs font-bold text-white text-center"
                  style={{
                    width: 80, height: 80,
                    background: `radial-gradient(circle at 35% 35%, ${bubble.color.border}, ${bubble.color.bg})`,
                    border: `2px solid ${bubble.color.border}`,
                    boxShadow: `0 0 16px ${bubble.color.bg}88, inset 0 -4px 8px rgba(0,0,0,0.3)`,
                    padding: "8px",
                    lineHeight: "1.2",
                  }}>
                  {/* Shine */}
                  <div className="absolute top-2 left-2.5 w-4 h-4 rounded-full bg-white/30 blur-[1px]" />
                  <span style={{ fontSize: 9, lineHeight: 1.2 }}>{bubble.term}</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <div className="absolute bottom-2 right-3 text-xs text-white/30 font-mono">Tap the bubble!</div>
      </div>
    </div>
  );
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

  // Track active stage from URL (?stage=N). Re-read on URL change.
  const [stageIndex, setStageIndex] = useState<number>(() => readStageFromUrl());
  useEffect(() => {
    setStageIndex(readStageFromUrl());
    setGameState("idle");
    setFinalScore(0);
  }, [location]);

  const progressMutation = useMutation({
    mutationFn: (data: { levelId: string; stageIndex: number; score: number; completed: boolean }) =>
      apiRequest("POST", "/api/progress", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.user) updateUser(data.user);
    },
  });

  async function handleGameComplete(score: number) {
    setFinalScore(score);
    setGameState("complete");

    try {
      const result = await progressMutation.mutateAsync({
        levelId: id!,
        stageIndex,
        score,
        completed: score > 0,
      });

      if (result.xpGained > 0) {
        toast({
          title: result.justFinishedLevel
            ? `🏆 LEVEL CLEAR — +${result.xpGained} XP!`
            : `+${result.xpGained} XP earned!`,
          description: result.isFirstStageCompletion
            ? `Stage ${stageIndex + 1} clear · +${result.coinsGained} EduCoins`
            : `Score: ${score}`,
        });
      }
    } catch (e) {
      // Silently fail progress save
    }
  }

  function goToStage(nextStage: number) {
    setLocation(`/game/${id}?stage=${nextStage}`);
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
  const prevProgress = progress?.find((p: any) => p.levelId === id);

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

                  {prevProgress?.completed && (
                    <div className="flex items-center gap-2 justify-center mb-3 text-sm text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Best score: {prevProgress.score} — play again for fun!
                    </div>
                  )}

                  <Button
                    size="lg"
                    onClick={() => setGameState("playing")}
                    className="w-full"
                    data-testid="button-start-game"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {prevProgress?.completed ? "Play Again" : "Start Playing"}
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
                {level.gameType === "matcher" && <Link2 className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-float" />}
                {level.gameType === "emoji_cipher" && <Smile className="w-16 h-16 text-amber-400 mx-auto mb-4 animate-float" />}
                {level.gameType === "speed_blitz" && <Zap className="w-16 h-16 text-rose-400 mx-auto mb-4 animate-float" />}
                {level.gameType === "bubble_pop" && <Gamepad2 className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-float" />}
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

                {level.gameType === "matcher" && (
                  <div className="glass rounded-lg p-3 mb-6 text-xs text-muted-foreground text-left">
                    <p>Click a term on the left, then click its matching definition on the right. Fewer mistakes = higher score!</p>
                  </div>
                )}

                {level.gameType === "emoji_cipher" && (
                  <div className="glass rounded-lg p-3 mb-6 text-xs text-muted-foreground text-left">
                    <p>Read the clue description and pick the correct concept from the 4 choices. Use hints if needed!</p>
                  </div>
                )}
                {level.gameType === "speed_blitz" && (
                  <div className="glass rounded-lg p-3 mb-6 text-xs text-muted-foreground text-left space-y-1">
                    <p>⚡ Answer each question before the 9-second timer runs out!</p>
                    <p>🎯 Answer faster to earn more points — max 90 pts per question.</p>
                    <p>❌ Letting the timer expire counts as a wrong answer.</p>
                  </div>
                )}
                {level.gameType === "bubble_pop" && (
                  <div className="glass rounded-lg p-3 mb-6 text-xs text-muted-foreground text-left space-y-1">
                    <p>🫧 Read the definition at the top — then pop the correct term bubble!</p>
                    <p>🚀 Bubbles float up and escape — click fast before they're gone!</p>
                    <p>❌ Wrong bubbles will shake. Keep trying!</p>
                  </div>
                )}
                {level.gameType === "memory_flip" && (
                  <div className="glass rounded-lg p-3 mb-6 text-xs text-muted-foreground text-left space-y-1">
                    <p>🃏 Flip cards to reveal terms and their definitions.</p>
                    <p>✅ Match every term with its definition to win!</p>
                    <p>💡 Fewer attempts = higher score. Use your memory!</p>
                  </div>
                )}

                {prevProgress?.completed && (
                  <div className="flex items-center gap-2 justify-center mb-4 text-sm text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Best score: {prevProgress.score} — play again for fun!
                  </div>
                )}

                <Button size="lg" onClick={() => setGameState("playing")} className="w-full" data-testid="button-start-game">
                  <Zap className="w-4 h-4 mr-2" />
                  {prevProgress?.completed ? "Play Again" : "Start Game"}
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
                  questions={questions}
                  onComplete={handleGameComplete}
                />
              )}
              {level.gameType === "wordle" && (
                <WordleGame questions={questions} onComplete={handleGameComplete} />
              )}
              {level.gameType === "matcher" && (
                <MatcherGame questions={questions} onComplete={handleGameComplete} />
              )}
              {level.gameType === "emoji_cipher" && (
                <EmojiCipherGame questions={questions} onComplete={handleGameComplete} />
              )}
              {level.gameType === "speed_blitz" && (
                <SpeedBlitzGame questions={questions} onComplete={handleGameComplete} />
              )}
              {level.gameType === "bubble_pop" && (
                <BubblePopGame questions={questions} onComplete={handleGameComplete} />
              )}
              {level.gameType === "memory_flip" && (
                <MemoryFlipGame questions={questions} onComplete={handleGameComplete} />
              )}
            </motion.div>
          )}

          {gameState === "complete" && (
            <motion.div
              key="complete"
              className="text-center py-8 max-w-md mx-auto"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="glass-strong rounded-2xl p-8 border border-primary/20">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.8 }}
                  className="mb-4"
                >
                  <Trophy className="w-16 h-16 text-yellow-400 mx-auto" />
                </motion.div>

                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Oxanium, sans-serif" }}>
                  {finalScore > 0 ? "LEVEL COMPLETE!" : "GAME OVER"}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {finalScore > 0 ? "Great work! XP and EduCoins added." : "Don't give up! Try again."}
                </p>

                <div className="flex justify-center gap-6 mb-8">
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

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setGameState("idle")}
                    data-testid="button-play-again"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" /> Play Again
                  </Button>
                  <Link href="/courses" className="flex-1">
                    <Button className="w-full" data-testid="button-next-level">
                      More Courses <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
