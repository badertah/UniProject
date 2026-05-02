import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { getDifficultyConfig, getGameTypeConfig } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Zap, Coins, Hash, Link2, Smile, Lock, CheckCircle2,
  Star, ChevronRight, ChevronDown, BookOpen, Gamepad2, Sparkles,
  Layers, Boxes, Workflow, Database, Activity, ListOrdered, Play
} from "lucide-react";
import { isSADGame, difficultyLabel } from "@/components/sad-games";

const TOPIC_GRADIENTS: Record<string, string> = {
  "from-violet-600 to-purple-800": "linear-gradient(135deg, #7c3aed, #6b21a8)",
  "from-blue-600 to-cyan-700": "linear-gradient(135deg, #2563eb, #0e7490)",
  "from-emerald-600 to-teal-700": "linear-gradient(135deg, #059669, #0f766e)",
  "from-amber-600 to-orange-700": "linear-gradient(135deg, #d97706, #c2410c)",
  "from-pink-600 to-rose-700": "linear-gradient(135deg, #db2777, #be123c)",
  "from-indigo-600 to-blue-800": "linear-gradient(135deg, #4f46e5, #1e40af)",
};

const GAME_ICONS: Record<string, any> = {
  // New play-to-learn games
  sdlc_sorter: Layers,
  req_sorter: Boxes,
  usecase_builder: Workflow,
  erd_doctor: Database,
  dfd_detective: Activity,
  sequence_stacker: ListOrdered,
  // Legacy
  wordle: Hash,
  matcher: Link2,
  emoji_cipher: Smile,
  speed_blitz: Zap,
  bubble_pop: Gamepad2,
  memory_flip: Sparkles,
};

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: topic, isLoading } = useQuery<any>({ queryKey: ["/api/topics", id] });
  const { data: progress } = useQuery<any[]>({ queryKey: ["/api/progress"] });

  // Which SAD level is currently expanded to reveal its stage chips.
  // Only one level can be open at a time; clicking the same one collapses it.
  const [expandedLevelId, setExpandedLevelId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-48 rounded-xl bg-card/50" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-card/50" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!topic) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Topic not found</p>
      <Link href="/courses">
        <Button className="mt-4">Back to Courses</Button>
      </Link>
    </div>
  );

  const gradient = TOPIC_GRADIENTS[topic.color] || "linear-gradient(135deg, #7c3aed, #6b21a8)";
  const levels = topic.levels || [];

  // Group progress rows by level — each level can now have multiple stage rows.
  const stageRowsByLevel = new Map<string, any[]>();
  (progress || []).forEach((p: any) => {
    const list = stageRowsByLevel.get(p.levelId) || [];
    list.push(p);
    stageRowsByLevel.set(p.levelId, list);
  });

  // A level is fully completed when every one of its question-stages has a completed row.
  // Prefer the server-provided questionCount; fall back to attached questions, then 1.
  function totalStagesFor(level: any): number {
    return Math.max(level.questionCount ?? level.questions?.length ?? 1, 1);
  }
  function isLevelFullyCompleted(level: any): boolean {
    const stageRows = stageRowsByLevel.get(level.id) || [];
    const completedStages = new Set(stageRows.filter((p: any) => p.completed).map((p: any) => p.stageIndex ?? 0));
    return completedStages.size >= totalStagesFor(level);
  }

  const completedCount = levels.filter((l: any) => isLevelFullyCompleted(l)).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Back */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
        <Link href="/courses">
          <Button variant="ghost" size="sm" className="mb-4 text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Courses
          </Button>
        </Link>
      </motion.div>

      {/* Hero Banner */}
      <motion.div
        className="relative rounded-xl overflow-hidden mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="h-32 md:h-44 w-full" style={{ background: gradient }} />
        <div className="absolute inset-0 cyber-grid opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <div className="flex items-end gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: "Oxanium, sans-serif" }}>
                {topic.name}
              </h1>
              <p className="text-white/70 text-sm mt-0.5 max-w-lg">{topic.description}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Progress summary */}
      <motion.div
        className="glass rounded-xl p-4 mb-6 border border-border/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Course Progress</span>
          <span className="text-sm font-mono text-muted-foreground">{completedCount} / {levels.length} levels</span>
        </div>
        <Progress value={(completedCount / Math.max(levels.length, 1)) * 100} className="h-2" />
        <div className="flex gap-4 mt-3">
          {levels.reduce((sum: number, l: any) => sum + l.xpReward, 0) > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="w-3 h-3 text-primary" />
              {levels.reduce((sum: number, l: any) => sum + l.xpReward, 0)} XP total
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Coins className="w-3 h-3 text-yellow-400" />
            {levels.reduce((sum: number, l: any) => sum + l.coinReward, 0)} coins total
          </div>
        </div>
      </motion.div>

      {/* Levels */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-widest text-muted-foreground font-mono mb-4">AVAILABLE LEVELS</h2>

        {levels.map((level: any, index: number) => {
          const stageRows = stageRowsByLevel.get(level.id) || [];
          const isSAD = isSADGame(level.gameType);
          const totalStages = isSAD ? totalStagesFor(level) : 1;
          const completedStages = new Set<number>(
            stageRows.filter((p: any) => p.completed).map((p: any) => p.stageIndex ?? 0)
          );
          const stageScores = new Map<number, number>(
            stageRows.map((p: any) => [p.stageIndex ?? 0, p.score || 0])
          );
          const isFullyCompleted = completedStages.size >= totalStages;
          const stagesDone = completedStages.size;
          const totalScore = stageRows.reduce((s: number, p: any) => s + (p.score || 0), 0);
          const GameIcon = GAME_ICONS[level.gameType] || Hash;
          const diffConfig = getDifficultyConfig(level.difficulty);
          const gameConfig = getGameTypeConfig(level.gameType);

          const cardBody = (
            <div className="flex items-center gap-4">
              {/* Level number + icon */}
              <div className="relative flex-shrink-0">
                <div
                  className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center border transition-all ${
                    isFullyCompleted
                      ? "bg-emerald-500/20 border-emerald-500/40"
                      : "bg-card border-border/40 group-hover:border-primary/30"
                  }`}
                >
                  {isFullyCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <GameIcon className={`w-5 h-5 ${gameConfig.color}`} />
                  )}
                  <span className="text-xs font-mono text-muted-foreground mt-0.5">L{level.levelNumber}</span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className={`font-semibold text-sm ${isFullyCompleted ? "text-emerald-400" : "group-hover:text-primary transition-colors"}`}>
                    {level.name}
                  </h3>
                  <Badge variant="outline" className={`text-xs border ${diffConfig.bg} ${diffConfig.color}`}>
                    {diffConfig.label}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {gameConfig.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{gameConfig.description}</p>

                {/* Stage / score summary */}
                {totalScore > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`text-progress-${level.id}`}>
                    <Star className="w-3 h-3 text-yellow-400" />
                    {isSAD
                      ? `${stagesDone}/${totalStages} stages cleared · ${totalScore} pts`
                      : `Best score: ${totalScore}`}
                  </div>
                )}
              </div>

              {/* Rewards */}
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1 text-xs">
                  <Zap className="w-3 h-3 text-primary" />
                  <span className="text-primary font-bold">{level.xpReward} XP</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <Coins className="w-3 h-3 text-yellow-400" />
                  <span className="text-yellow-400 font-bold">{level.coinReward}</span>
                </div>
                {isSAD ? (
                  <ChevronDown
                    className={`w-4 h-4 text-muted-foreground group-hover:text-primary transition-all duration-300 mt-1 ${
                      expandedLevelId === level.id ? "rotate-180 text-primary" : ""
                    }`}
                  />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                )}
              </div>
            </div>
          );

          const isExpanded = expandedLevelId === level.id;

          return (
            <motion.div
              key={level.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.08 }}
            >
              <div
                className={`relative rounded-xl border p-4 transition-all duration-200 group ${
                  isFullyCompleted
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : isExpanded
                    ? "border-primary/40 bg-card/90 shadow-lg shadow-primary/10"
                    : "border-border/40 bg-card/80 hover:border-primary/30"
                }`}
                data-testid={`card-level-${level.id}`}
              >
                {isSAD ? (
                  // Click the entire SAD card to reveal/hide its stage chips.
                  // Same level click closes; clicking another level swaps focus.
                  <div
                    onClick={() => setExpandedLevelId(prev => prev === level.id ? null : level.id)}
                    className="cursor-pointer select-none"
                    data-testid={`btn-expand-${level.id}`}
                    role="button"
                    aria-expanded={isExpanded}
                  >
                    {cardBody}
                  </div>
                ) : (
                  <Link href={`/game/${level.id}`}>
                    <div className="cursor-pointer">{cardBody}</div>
                  </Link>
                )}

                {/* Stage chips — collapsed by default, only expand for the
                    currently-clicked SAD level. AnimatePresence handles the
                    smooth height + opacity transition both ways. */}
                <AnimatePresence initial={false}>
                  {isSAD && isExpanded && totalStages > 0 && (
                    <motion.div
                      key="stages"
                      initial={{ height: 0, opacity: 0, marginTop: 0, paddingTop: 0 }}
                      animate={{ height: "auto", opacity: 1, marginTop: 12, paddingTop: 12 }}
                      exit={{ height: 0, opacity: 0, marginTop: 0, paddingTop: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      style={{ overflow: "hidden", borderTop: "1px solid hsl(var(--border) / 0.3)" }}
                    >
                      <div className="text-[10px] font-mono tracking-widest text-muted-foreground mb-2">PICK A STAGE</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Array.from({ length: totalStages }).map((_, sIdx) => {
                          const sDone = completedStages.has(sIdx);
                          const sScore = stageScores.get(sIdx) || 0;
                          const sDiff = totalStages > 1 ? sIdx / (totalStages - 1) : 0;
                          const sLabel = difficultyLabel(sDiff);
                          const isNextUp = !sDone && completedStages.size === sIdx;
                          return (
                            <Link key={sIdx} href={`/game/${level.id}?stage=${sIdx}`}>
                              <motion.div
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={(e) => e.stopPropagation()}
                                className={`relative overflow-hidden rounded-lg border p-2 cursor-pointer transition-colors ${
                                  sDone
                                    ? "border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-400/70"
                                    : isNextUp
                                    ? "border-primary/50 bg-primary/10 hover:border-primary"
                                    : "border-border/40 bg-background/40 hover:border-primary/40 hover:bg-primary/5"
                                }`}
                                data-testid={`chip-stage-${level.id}-${sIdx}`}
                              >
                                {/* Shimmer on completed */}
                                {sDone && (
                                  <motion.div
                                    className="absolute inset-0 pointer-events-none"
                                    style={{
                                      background: "linear-gradient(110deg, transparent 30%, rgba(52,211,153,0.18) 50%, transparent 70%)",
                                    }}
                                    initial={{ x: "-100%" }}
                                    animate={{ x: "100%" }}
                                    transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
                                  />
                                )}
                                <div className="relative flex items-center justify-between mb-1">
                                  <span className="text-xs font-bold font-mono">STAGE {sIdx + 1}</span>
                                  {sDone ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Play className="w-3 h-3 text-muted-foreground" />
                                  )}
                                </div>
                                <div className="relative flex items-center justify-between">
                                  <span className={`text-[10px] font-mono tracking-wider font-bold ${sLabel.color}`}>
                                    {sLabel.label}
                                  </span>
                                  {sScore > 0 && (
                                    <span className="text-[10px] text-yellow-400 font-mono">★ {sScore}</span>
                                  )}
                                </div>
                              </motion.div>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
