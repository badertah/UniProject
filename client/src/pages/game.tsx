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
  XCircle, Lightbulb, Trophy, Hash, Link2, Smile, Timer, Info
} from "lucide-react";
import { Link } from "wouter";
import { getDifficultyConfig, getGameTypeConfig } from "@/lib/utils";

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

// ===================== MAIN GAME PAGE =====================
export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const { data: level, isLoading } = useQuery<any>({ queryKey: ["/api/levels", id] });
  const { data: progress } = useQuery<any[]>({ queryKey: ["/api/progress"] });

  const [gameState, setGameState] = useState<"idle" | "playing" | "complete">("idle");
  const [finalScore, setFinalScore] = useState(0);

  const progressMutation = useMutation({
    mutationFn: (data: { levelId: string; score: number; completed: boolean }) =>
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
        score,
        completed: score > 0,
      });

      if (result.xpGained > 0) {
        toast({
          title: `+${result.xpGained} XP earned!`,
          description: result.isFirstCompletion
            ? `First completion bonus: +${result.coinsGained} EduCoins`
            : `Score: ${score}`,
        });
      }
    } catch (e) {
      // Silently fail progress save
    }
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
          {gameState === "idle" && (
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
              {level.gameType === "wordle" && (
                <WordleGame questions={questions} onComplete={handleGameComplete} />
              )}
              {level.gameType === "matcher" && (
                <MatcherGame questions={questions} onComplete={handleGameComplete} />
              )}
              {level.gameType === "emoji_cipher" && (
                <EmojiCipherGame questions={questions} onComplete={handleGameComplete} />
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
