import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ChevronRight, Lock, Sparkles, Gamepad2, Trophy } from "lucide-react";

const TOPIC_GRADIENTS: Record<string, string> = {
  "from-violet-600 to-purple-800": "linear-gradient(135deg, #7c3aed, #6b21a8)",
  "from-blue-600 to-cyan-700": "linear-gradient(135deg, #2563eb, #0e7490)",
  "from-emerald-600 to-teal-700": "linear-gradient(135deg, #059669, #0f766e)",
  "from-amber-600 to-orange-700": "linear-gradient(135deg, #d97706, #c2410c)",
  "from-pink-600 to-rose-700": "linear-gradient(135deg, #db2777, #be123c)",
  "from-indigo-600 to-blue-800": "linear-gradient(135deg, #4f46e5, #1e40af)",
};

export default function CoursesPage() {
  const { user } = useAuth();
  const { data: topics, isLoading } = useQuery<any[]>({ queryKey: ["/api/topics"] });
  const { data: progress } = useQuery<any[]>({ queryKey: ["/api/progress"] });

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.2 } },
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
              COURSE <span className="text-primary">CATALOG</span>
            </h1>
            <p className="text-sm text-muted-foreground">Have fun · Learn · Play</p>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold mb-0.5">Welcome to IKUGAMES — focused mode</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We're focusing on the <strong className="text-foreground">System Analysis &amp; Design</strong> course.
              Every level is a small interactive game — no prior knowledge needed. Just read the quick intro and start playing.
            </p>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 p-6 animate-pulse bg-card/50 h-56" />
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {topics?.map((topic: any, i) => {
            // Build {levelId -> completed stage indexes} for this topic.
            const topicProgress = progress?.filter((p: any) => p.topic?.id === topic.id || p.level?.topicId === topic.id) || [];
            const stagesDoneByLevel = new Map<string, Set<number>>();
            topicProgress.forEach((p: any) => {
              if (!p.completed) return;
              const set = stagesDoneByLevel.get(p.levelId) || new Set<number>();
              set.add(p.stageIndex ?? 0);
              stagesDoneByLevel.set(p.levelId, set);
            });
            const topicLevels: any[] = topic.levels || [];
            const completedCount = topicLevels.filter((l: any) => {
              const need = Math.max(l.questionCount ?? 1, 1);
              const done = stagesDoneByLevel.get(l.id);
              return done ? done.size >= need : false;
            }).length;
            const totalLevels = topic.levelCount || topicLevels.length || 1;
            const progressPct = Math.min(100, Math.round((completedCount / totalLevels) * 100));
            const gradient = TOPIC_GRADIENTS[topic.color] || "linear-gradient(135deg, #7c3aed, #6b21a8)";

            return (
              <motion.div key={topic.id} variants={itemVariants}>
                <Link href={`/courses/${topic.id}`}>
                  <div
                    className="relative rounded-xl border border-border/40 cursor-pointer transition-all duration-300 hover:border-primary/40 group overflow-hidden hover-elevate"
                    style={{ background: "hsl(var(--card))" }}
                    data-testid={`card-course-${topic.id}`}
                  >
                    {/* Header gradient */}
                    <div
                      className="h-2 w-full"
                      style={{ background: gradient }}
                    />

                    {/* Hover glow */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: `${gradient.replace("linear-gradient(135deg, ", "radial-gradient(ellipse at 30% 30%, ").replace(", #", " 0%, #").replace(")", " 60%, transparent 100%)")}15` }}
                    />

                    <div className="relative p-5">
                      {/* Icon + Number */}
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg"
                          style={{ background: gradient }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex items-center gap-2">
                          {completedCount >= totalLevels && (
                            <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              Complete
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {totalLevels} levels
                          </Badge>
                        </div>
                      </div>

                      {/* Content */}
                      <h3 className="font-bold text-base mb-1 group-hover:text-primary transition-colors leading-tight" style={{ fontFamily: "Oxanium, sans-serif" }}>
                        {topic.name}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
                        {topic.description}
                      </p>

                      {/* Progress */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">{completedCount} / {totalLevels} levels done</span>
                          <span className="text-muted-foreground font-mono">{progressPct}%</span>
                        </div>
                        <Progress value={progressPct} className="h-1.5" />
                      </div>

                      {/* Game types preview */}
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/30">
                        <span className="text-xs text-muted-foreground">Games:</span>
                        {Array.from(new Set((topic.levels || []).map((l: any) => {
                          const labels: Record<string, string> = {
                            word_scramble: "Word", term_matcher: "Match", emoji_cipher: "Cipher",
                            speed_blitz: "Blitz", bubble_pop: "Bubble", memory_flip: "Memory",
                            wordle: "Wordle", matcher: "Match",
                            sdlc_sorter: "Runner", req_sorter: "Hunter", usecase_builder: "Defense",
                            erd_doctor: "Builder", dfd_detective: "Plumber", sequence_stacker: "Rhythm",
                          };
                          return labels[l.gameType] || l.gameType;
                        }))).slice(0, 4).map((g: any) => (
                          <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-mono">{g}</span>
                        ))}
                        <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
