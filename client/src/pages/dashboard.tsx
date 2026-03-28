import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
import { getTierInfo, getXpToNextLevel, formatXp, getDifficultyConfig, getGameTypeConfig } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Zap, Flame, Coins, Trophy, BookOpen, ChevronRight, Star,
  TrendingUp, Target, Award, Lock, Hash, Link2, Smile
} from "lucide-react";

const TOPIC_ICONS: Record<string, string> = {
  Settings: "⚙",
  Code2: "{ }",
  GitBranch: "⑂",
  Database: "⊡",
  Network: "⬡",
  Layers: "⧉",
};

const TOPIC_GRADIENTS: Record<string, string> = {
  "from-violet-600 to-purple-800": "linear-gradient(135deg, #7c3aed, #6b21a8)",
  "from-blue-600 to-cyan-700": "linear-gradient(135deg, #2563eb, #0e7490)",
  "from-emerald-600 to-teal-700": "linear-gradient(135deg, #059669, #0f766e)",
  "from-amber-600 to-orange-700": "linear-gradient(135deg, #d97706, #c2410c)",
  "from-pink-600 to-rose-700": "linear-gradient(135deg, #db2777, #be123c)",
  "from-indigo-600 to-blue-800": "linear-gradient(135deg, #4f46e5, #1e40af)",
};

function getTierPosition(xp: number): number {
  const tiers = [0, 500, 1500, 3500, 7000, 10000];
  const clampedXp = Math.min(xp, 10000);
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (clampedXp >= tiers[i]) {
      const next = tiers[i + 1] || 10000;
      const progress = (clampedXp - tiers[i]) / (next - tiers[i]);
      return ((i + progress) / (tiers.length - 1)) * 100;
    }
  }
  return 0;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { data: topics } = useQuery<any[]>({ queryKey: ["/api/topics"] });
  const { data: leaderboard } = useQuery<any[]>({ queryKey: ["/api/leaderboard"] });
  const { data: progress } = useQuery<any[]>({ queryKey: ["/api/progress"] });

  if (!user) return null;

  const tierInfo = getTierInfo(user.xp);
  const xpProgress = getXpToNextLevel(user.xp);
  const completedLevels = progress?.filter(p => p.completed).length || 0;
  const totalScore = progress?.reduce((sum, p) => sum + (p.score || 0), 0) || 0;

  const userRank = leaderboard?.findIndex(u => u.id === user.id) ?? -1;
  const displayRank = userRank >= 0 ? userRank + 1 : "?";

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Hero Section */}
      <motion.div
        className="relative rounded-xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(6,182,212,0.08) 50%, rgba(99,102,241,0.1) 100%)" }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5" />

        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            {/* Avatar + Info */}
            <div className="flex items-center gap-4">
              <motion.div
                className="relative"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold text-white ${tierInfo.bgClass} neon-purple`}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className={`absolute -bottom-1 -right-1 text-xs px-1.5 py-0.5 rounded-md font-bold ${tierInfo.colorClass} bg-card border border-border/60`}>
                  Lv.{user.level}
                </div>
              </motion.div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-wide" style={{ fontFamily: "Oxanium, sans-serif" }}>
                  Welcome back, <span className="text-primary">{user.username}</span>
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm font-bold ${tierInfo.colorClass}`}>{user.tier}</span>
                  <span className="text-muted-foreground text-xs">•</span>
                  <span className="text-muted-foreground text-xs">{formatXp(user.xp)} total XP</span>
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap gap-3 md:ml-auto">
              {[
                { icon: Flame, value: `${user.streak}`, label: "Day Streak", color: "text-orange-400" },
                { icon: Coins, value: `${user.eduCoins}`, label: "EduCoins", color: "text-yellow-400" },
                { icon: Target, value: `${completedLevels}`, label: "Completed", color: "text-emerald-400" },
                { icon: Trophy, value: `#${displayRank}`, label: "Rank", color: "text-primary" },
              ].map(({ icon: Icon, value, label, color }) => (
                <div key={label} className="glass rounded-lg px-4 py-2.5 flex items-center gap-2 min-w-[90px]">
                  <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
                  <div>
                    <div className={`text-base font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* XP Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Level {user.level} Progress</span>
              </div>
              <span className="text-xs text-muted-foreground font-mono">{xpProgress.current} / {xpProgress.required} XP</span>
            </div>
            <div className="relative h-3 bg-muted/50 rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))" }}
                initial={{ width: 0 }}
                animate={{ width: `${xpProgress.percent}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
              />
              <div className="absolute inset-0 animate-shimmer rounded-full" />
            </div>
            {/* Tier milestones */}
            <div className="flex justify-between mt-1">
              {["Rookie", "Scholar", "Expert", "Master", "Legend"].map((tier, i) => (
                <span key={tier} className="text-xs text-muted-foreground/50 font-mono">{tier}</span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      {settings.showStatsCards && (
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-3"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {[
            { icon: Zap, label: "Total XP", value: formatXp(user.xp), sub: `Level ${user.level}`, color: "text-primary", bg: "bg-primary/10" },
            { icon: Flame, label: "Streak", value: `${user.streak} days`, sub: "Keep it up!", color: "text-orange-400", bg: "bg-orange-500/10" },
            { icon: Coins, label: "EduCoins", value: user.eduCoins, sub: "Spend in shop", color: "text-yellow-400", bg: "bg-yellow-500/10" },
            { icon: Award, label: "Score Total", value: totalScore, sub: `${completedLevels} levels done`, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          ].map(({ icon: Icon, label, value, sub, color, bg }) => (
            <motion.div key={label} variants={itemVariants}>
              <Card className="border-border/40">
                <CardContent className="p-4">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className={`text-xl font-bold ${color} font-mono`}>{value}</div>
                  <div className="text-xs font-medium text-foreground mt-0.5">{label}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Course Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-wide flex items-center gap-2" style={{ fontFamily: "Oxanium, sans-serif" }}>
              <BookOpen className="w-5 h-5 text-primary" />
              COURSES
            </h2>
            <Link href="/courses">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                View All <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {topics?.slice(0, 6).map((topic: any, i) => {
              const topicProgress = progress?.filter(p => p.topic?.id === topic.id) || [];
              const completedCount = topicProgress.filter(p => p.completed).length;
              const progressPct = topics ? Math.round((completedCount / 3) * 100) : 0;

              return (
                <motion.div key={topic.id} variants={itemVariants}>
                  <Link href={`/courses/${topic.id}`}>
                    <div
                      className="relative rounded-xl border border-border/40 p-4 cursor-pointer transition-all duration-200 hover:border-primary/30 group overflow-hidden"
                      style={{ background: "hsl(var(--card))" }}
                      data-testid={`card-topic-${topic.id}`}
                    >
                      {/* Background gradient */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
                        style={{ background: `${TOPIC_GRADIENTS[topic.color] || "linear-gradient(135deg, #7c3aed, #6b21a8)"}20` }}
                      />

                      <div className="relative">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-mono text-sm font-bold"
                            style={{ background: TOPIC_GRADIENTS[topic.color] || "linear-gradient(135deg, #7c3aed, #6b21a8)" }}
                          >
                            {TOPIC_ICONS[topic.icon] || topic.icon?.charAt(0)}
                          </div>
                          <Badge variant="outline" className="text-xs border-border/40">
                            3 levels
                          </Badge>
                        </div>
                        <h3 className="font-semibold text-sm leading-tight mb-1 group-hover:text-primary transition-colors">{topic.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{topic.description}</p>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{completedCount}/3 completed</span>
                            <span className="text-muted-foreground">{progressPct}%</span>
                          </div>
                          <Progress value={progressPct} className="h-1" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Leaderboard Preview + Quick Play */}
        {(settings.showLeaderboardPreview || settings.showQuickPlay) && (
          <div className="space-y-4">
            {settings.showLeaderboardPreview && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold tracking-wide flex items-center gap-2" style={{ fontFamily: "Oxanium, sans-serif" }}>
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    TOP PLAYERS
                  </h2>
                  <Link href="/leaderboard">
                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                      Full Board <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>

                <Card className="border-border/40">
                  <CardContent className="p-3 space-y-1">
                    {leaderboard?.slice(0, 8).map((player: any, i) => {
                      const isMe = player.id === user.id;
                      const medal = i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-600" : "text-muted-foreground";
                      const playerTier = getTierInfo(player.xp);

                      return (
                        <div
                          key={player.id}
                          className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors ${isMe ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/30"}`}
                          data-testid={`row-leaderboard-${i}`}
                        >
                          <span className={`text-xs font-bold w-5 text-center font-mono ${medal}`}>
                            {i < 3 ? ["1st", "2nd", "3rd"][i] : `#${i + 1}`}
                          </span>
                          <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold text-white ${playerTier.bgClass} flex-shrink-0`}>
                            {player.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${isMe ? "text-primary" : ""}`}>
                              {player.username} {isMe && "(You)"}
                            </p>
                            <p className={`text-xs ${playerTier.colorClass}`}>{player.tier}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold font-mono text-foreground">{formatXp(player.xp)}</p>
                            <p className="text-xs text-muted-foreground/60">XP</p>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </>
            )}

            {/* Quick Play */}
            {settings.showQuickPlay && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="w-8 h-8 text-primary mx-auto mb-2" />
                  <h3 className="font-bold text-sm mb-1" style={{ fontFamily: "Oxanium, sans-serif" }}>READY TO LEVEL UP?</h3>
                  <p className="text-xs text-muted-foreground mb-3">Play mini-games to earn XP & EduCoins</p>
                  <Link href="/courses">
                    <Button size="sm" className="w-full text-xs">
                      Start Playing <Zap className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
