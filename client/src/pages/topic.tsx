import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { getDifficultyConfig, getGameTypeConfig } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Zap, Coins, Hash, Link2, Smile, Lock, CheckCircle2,
  Star, ChevronRight, BookOpen
} from "lucide-react";

const TOPIC_GRADIENTS: Record<string, string> = {
  "from-violet-600 to-purple-800": "linear-gradient(135deg, #7c3aed, #6b21a8)",
  "from-blue-600 to-cyan-700": "linear-gradient(135deg, #2563eb, #0e7490)",
  "from-emerald-600 to-teal-700": "linear-gradient(135deg, #059669, #0f766e)",
  "from-amber-600 to-orange-700": "linear-gradient(135deg, #d97706, #c2410c)",
  "from-pink-600 to-rose-700": "linear-gradient(135deg, #db2777, #be123c)",
  "from-indigo-600 to-blue-800": "linear-gradient(135deg, #4f46e5, #1e40af)",
};

const GAME_ICONS: Record<string, any> = {
  wordle: Hash,
  matcher: Link2,
  emoji_cipher: Smile,
};

export default function TopicPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: topic, isLoading } = useQuery<any>({ queryKey: ["/api/topics", id] });
  const { data: progress } = useQuery<any[]>({ queryKey: ["/api/progress"] });

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
  const completedLevelIds = new Set(progress?.filter((p: any) => p.completed).map((p: any) => p.levelId));
  const completedCount = levels.filter((l: any) => completedLevelIds.has(l.id)).length;

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
          const isCompleted = completedLevelIds.has(level.id);
          const isLocked = false; // All levels unlocked
          const levelProgress = progress?.find((p: any) => p.levelId === level.id);
          const GameIcon = GAME_ICONS[level.gameType] || Hash;
          const diffConfig = getDifficultyConfig(level.difficulty);
          const gameConfig = getGameTypeConfig(level.gameType);

          return (
            <motion.div
              key={level.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + index * 0.08 }}
            >
              <Link href={`/game/${level.id}`}>
                <div
                  className={`relative rounded-xl border p-4 cursor-pointer transition-all duration-200 group ${
                    isCompleted
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border/40 bg-card/80 hover:border-primary/30"
                  }`}
                  data-testid={`card-level-${level.id}`}
                >
                  {/* Completed glow */}
                  {isCompleted && (
                    <div className="absolute inset-0 rounded-xl bg-emerald-500/5 pointer-events-none" />
                  )}

                  <div className="flex items-center gap-4">
                    {/* Level number + icon */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center border transition-all ${
                          isCompleted
                            ? "bg-emerald-500/20 border-emerald-500/40"
                            : "bg-card border-border/40 group-hover:border-primary/30"
                        }`}
                      >
                        {isCompleted ? (
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
                        <h3 className={`font-semibold text-sm ${isCompleted ? "text-emerald-400" : "group-hover:text-primary transition-colors"}`}>
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

                      {/* Score display */}
                      {levelProgress && levelProgress.score > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Star className="w-3 h-3 text-yellow-400" />
                          Best score: {levelProgress.score}
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
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
