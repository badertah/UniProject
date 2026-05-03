import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { getTierInfo, getXpToNextLevel, formatXp, getRarityConfig } from "@/lib/utils";
import { UserAvatar, AVATAR_META, THEME_IMAGE } from "@/components/cosmetics";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Zap, Flame, Coins, Trophy, Star, CheckCircle2,
  ShoppingBag, Calendar, Award, Target, TrendingUp
} from "lucide-react";

const COSMETIC_COLORS: Record<string, string> = {
  wizard: "from-violet-600 to-purple-800",
  robot: "from-cyan-600 to-blue-800",
  phoenix: "from-orange-500 to-red-700",
  dragon: "from-emerald-600 to-teal-800",
  knight: "from-slate-500 to-slate-700",
  "neon-purple": "from-purple-500 to-violet-700",
  "neon-blue": "from-blue-500 to-cyan-600",
  golden: "from-yellow-400 to-amber-600",
  matrix: "from-emerald-400 to-green-700",
};

const TIER_REQUIREMENTS = [
  { tier: "Rookie", xp: 0, icon: "R" },
  { tier: "Scholar", xp: 500, icon: "S" },
  { tier: "Expert", xp: 1500, icon: "E" },
  { tier: "Master", xp: 3500, icon: "M" },
  { tier: "Legend", xp: 7000, icon: "L" },
];

export default function ProfilePage() {
  const { user } = useAuth();
  const { data: progress } = useQuery<any[]>({ queryKey: ["/api/progress"] });
  const { data: cosmetics } = useQuery<any[]>({ queryKey: ["/api/cosmetics"] });
  const { data: leaderboard } = useQuery<any[]>({ queryKey: ["/api/leaderboard"] });

  if (!user) return null;

  const tierInfo = getTierInfo(user.xp);
  const xpProgress = getXpToNextLevel(user.xp);
  const completedLevels = progress?.filter(p => p.completed) || [];
  const ownedCosmetics = cosmetics?.filter(c => c.owned) || [];
  const rank = (leaderboard?.findIndex(u => u.id === user.id) ?? -1) + 1;
  const currentTierIdx = TIER_REQUIREMENTS.findIndex(t => t.tier === user.tier);
  const nextTier = TIER_REQUIREMENTS[currentTierIdx + 1];

  const equippedAvatar = cosmetics?.find(c => c.id === user.equippedAvatar);
  const equippedFrame = cosmetics?.find(c => c.id === user.equippedFrame);
  const equippedTheme = cosmetics?.find(c => c.id === user.equippedTheme);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
          PLAYER <span className="text-primary">PROFILE</span>
        </h1>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <motion.div
          className="lg:col-span-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-border/40">
            <CardContent className="p-6 text-center">
              {/* Avatar */}
              <div className="relative inline-block mb-4">
                <UserAvatar user={user} size="xl" fallbackBg={`${tierInfo.bgClass} shadow-lg`} className="!rounded-2xl mx-auto" />
              </div>

              <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "Oxanium, sans-serif" }}>{user.username}</h2>
              <p className={`text-sm font-bold ${tierInfo.colorClass} mb-1`}>{user.tier}</p>
              <p className="text-xs text-muted-foreground font-mono mb-4">Level {user.level}</p>

              {/* XP Bar */}
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>XP Progress</span>
                  <span className="font-mono">{xpProgress.current}/{xpProgress.required}</span>
                </div>
                <Progress value={xpProgress.percent} className="h-2" />
                {nextTier && (
                  <p className="text-xs text-muted-foreground text-center">
                    {nextTier.xp - user.xp} XP to {nextTier.tier}
                  </p>
                )}
              </div>

              <Separator className="my-4 bg-border/40" />

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Zap, label: "Total XP", value: formatXp(user.xp), color: "text-primary" },
                  { icon: Flame, label: "Streak", value: `${user.streak}d`, color: "text-orange-400" },
                  { icon: Coins, label: "Coins", value: user.eduCoins, color: "text-yellow-400" },
                  { icon: Trophy, label: "Rank", value: rank > 0 ? `#${rank}` : "?", color: "text-primary" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="bg-muted/30 rounded-lg p-2.5 text-center">
                    <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
                    <div className={`text-sm font-bold font-mono ${color}`}>{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>

              {/* Equipped items */}
              {(equippedAvatar || equippedFrame || equippedTheme) && (
                <>
                  <Separator className="my-4 bg-border/40" />
                  <div className="space-y-2">
                    <p className="text-xs font-bold tracking-widest text-muted-foreground font-mono">EQUIPPED</p>
                    {[equippedAvatar, equippedFrame, equippedTheme].filter(Boolean).map((item: any) => {
                      // Prefer the AI portrait / theme key art if we have
                      // one for this icon; fall back to the legacy gradient
                      // chip with the first-letter glyph for unknown icons
                      // (custom future cosmetics).
                      const avatarImg = item.type === "avatar" ? AVATAR_META[item.icon]?.image : null;
                      const themeImg  = item.type === "theme"  ? THEME_IMAGE[item.icon]       : null;
                      const img = avatarImg || themeImg;
                      return (
                        <div key={item.id} className="flex items-center gap-2 text-xs">
                          {img ? (
                            <div className="w-6 h-6 rounded-md overflow-hidden border border-border/40 flex-shrink-0">
                              <img src={img} alt="" className="w-full h-full object-cover" draggable={false} />
                            </div>
                          ) : (
                            <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${COSMETIC_COLORS[item.icon] || "from-primary to-accent"} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                              {item.icon?.charAt(0)?.toUpperCase()}
                            </div>
                          )}
                          <span className="flex-1 text-left truncate">{item.name}</span>
                          <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tier Progression */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> TIER PROGRESSION
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {TIER_REQUIREMENTS.map((tier, i) => {
                    const ti = getTierInfo(tier.xp);
                    const isReached = user.xp >= tier.xp;
                    const isCurrent = user.tier === tier.tier;

                    return (
                      <div key={tier.tier} className={`flex items-center gap-3 p-2.5 rounded-lg ${isCurrent ? "bg-primary/5 border border-primary/20" : ""}`}>
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold ${isReached ? ti.bgClass : "bg-muted"} flex-shrink-0`}>
                          {tier.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isReached ? ti.colorClass : "text-muted-foreground"}`}>{tier.tier}</span>
                            {isCurrent && <Badge variant="outline" className="text-xs px-1.5 border-primary/30 text-primary">Current</Badge>}
                          </div>
                          <span className="text-xs text-muted-foreground font-mono">{tier.xp === 0 ? "Starting tier" : `${formatXp(tier.xp)} XP required`}</span>
                        </div>
                        {isReached ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <div className="text-xs text-muted-foreground font-mono flex-shrink-0">{formatXp(tier.xp - user.xp)} XP</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Achievements */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono flex items-center gap-2">
                  <Award className="w-4 h-4" /> STATS & ACHIEVEMENTS
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Levels Completed", value: completedLevels.length, icon: CheckCircle2, color: "text-emerald-400" },
                    { label: "Cosmetics Owned", value: ownedCosmetics.length, icon: ShoppingBag, color: "text-yellow-400" },
                    { label: "Games Played", value: progress?.length || 0, icon: Target, color: "text-primary" },
                    { label: "Login Streak", value: `${user.streak} days`, icon: Flame, color: "text-orange-400" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div className={`w-8 h-8 rounded-lg bg-card flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                      <div>
                        <div className={`text-base font-bold font-mono ${color}`}>{value}</div>
                        <div className="text-xs text-muted-foreground">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          {completedLevels.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="border-border/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono flex items-center gap-2">
                    <Star className="w-4 h-4" /> COMPLETED LEVELS
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {completedLevels.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.level?.name || "Level"}</p>
                        <p className="text-xs text-muted-foreground">{p.topic?.name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-bold font-mono text-primary">{p.score} pts</div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
