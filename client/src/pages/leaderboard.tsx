import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { getTierInfo, formatXp } from "@/lib/utils";
import { UserAvatar } from "@/components/cosmetics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Flame, Zap, Medal, Crown, Coins, Tractor, Calendar } from "lucide-react";

type Mode = "farm" | "xp";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("farm");

  const { data: xpBoard, isLoading: xpLoading } = useQuery<any[]>({ queryKey: ["/api/leaderboard"] });
  const { data: farmBoard, isLoading: farmLoading } = useQuery<any[]>({ queryKey: ["/api/leaderboard/farm"] });

  const isLoading = mode === "farm" ? farmLoading : xpLoading;
  const leaderboard = mode === "farm" ? farmBoard : xpBoard;
  const currentUserRank = leaderboard?.findIndex(u => u.id === user?.id) ?? -1;

  // Per-mode metric helpers — keeps the row/podium rendering generic.
  const metricValue = (p: any) => mode === "farm" ? (p.farmTotalEarned || 0) : (p.xp || 0);
  const metricFmt   = (p: any) => mode === "farm"
    ? (p.farmTotalEarned || 0).toLocaleString()
    : formatXp(p.xp);
  const metricLabel = mode === "farm" ? "EARNED" : "XP";
  const MetricIcon  = mode === "farm" ? Coins : Zap;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
              LEADER<span className="text-yellow-400">BOARD</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "farm"
                ? "Farm Tycoons — ranked by lifetime farm earnings"
                : "Course rankings — ranked by total XP earned"}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Mode tabs — Farm first because the farm IS the main game. */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mb-6">
        <TabsList className="grid w-full grid-cols-2" data-testid="tabs-leaderboard-mode">
          <TabsTrigger value="farm" data-testid="tab-farm">
            <Tractor className="w-3.5 h-3.5 mr-1.5"/> Farm Tycoons
          </TabsTrigger>
          <TabsTrigger value="xp" data-testid="tab-xp">
            <Zap className="w-3.5 h-3.5 mr-1.5"/> Courses (XP)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="farm" className="mt-2">
          <p className="text-xs text-muted-foreground px-1">
            Total coins your farm has ever banked. Buy and upgrade buildings, master SAD diagrams, and grow your operation to climb the ranks.
          </p>
        </TabsContent>
        <TabsContent value="xp" className="mt-2">
          <p className="text-xs text-muted-foreground px-1">
            XP earned from completing course levels. Course rewards feed your farm — every quiz cleared funds your next building.
          </p>
        </TabsContent>
      </Tabs>

      {/* Top 3 Podium */}
      {!isLoading && leaderboard && leaderboard.length >= 3 && (
        <motion.div
          key={mode}
          className="flex items-end justify-center gap-3 mb-8"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05 }}
        >
          {[leaderboard[1], leaderboard[0], leaderboard[2]].map((player, idx) => {
            const actualRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
            const heights = ["h-28", "h-36", "h-24"];
            const colors = [
              "from-slate-500 to-slate-600",
              "from-yellow-500 to-amber-500",
              "from-amber-600 to-amber-700",
            ];
            const glows = ["", "neon-purple shadow-yellow-500/30", "shadow-amber-600/20"];
            const tierInfo = getTierInfo(player.xp);
            const isMe = player.id === user?.id;

            return (
              <motion.div
                key={player.id + mode}
                className="flex flex-col items-center gap-2"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + idx * 0.08 }}
              >
                {actualRank === 1 && <Crown className="w-6 h-6 text-yellow-400 animate-pulse-glow" />}
                <UserAvatar
                  user={player}
                  size="lg"
                  fallbackBg={`bg-gradient-to-br ${tierInfo.gradient || colors[idx]}`}
                  className={`${glows[idx]} ${isMe ? "ring-2 ring-primary" : ""}`}
                />
                <div className="text-center">
                  <p className="text-xs font-bold truncate max-w-[80px]">{isMe ? "You" : player.username}</p>
                  <p className={`text-xs ${tierInfo.colorClass}`}>{player.tier}</p>
                </div>
                <div
                  className={`${heights[idx]} w-20 rounded-t-lg bg-gradient-to-t ${colors[idx]} flex flex-col items-center justify-center text-white shadow-md`}
                >
                  <span className="text-lg font-black">#{actualRank}</span>
                  <span className="text-xs font-mono opacity-90">{metricFmt(player)}</span>
                  <span className="text-xs opacity-70">{metricLabel}</span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Full List */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono">
            FULL RANKINGS
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-8 h-4 rounded bg-muted" />
                  <div className="w-10 h-10 rounded-lg bg-muted" />
                  <div className="flex-1 h-4 rounded bg-muted" />
                  <div className="w-16 h-4 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : leaderboard && leaderboard.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {mode === "farm" ? "No farms yet" : "No players yet"}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {mode === "farm"
                  ? "Be the first to harvest and claim the top spot!"
                  : "Be the first to earn XP and claim the top spot!"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {leaderboard?.map((player: any, i) => {
                const isMe = player.id === user?.id;
                const tierInfo = getTierInfo(player.xp);
                const isTop3 = i < 3;
                const medalColors = ["text-yellow-400", "text-slate-300", "text-amber-600"];
                const rankBgs = ["bg-yellow-500/10 border-yellow-500/20", "bg-slate-500/10 border-slate-400/20", "bg-amber-600/10 border-amber-600/20"];

                return (
                  <motion.div
                    key={player.id + mode}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${isMe ? "bg-primary/8 border-l-2 border-primary" : "hover:bg-muted/20"}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * Math.min(i, 10) }}
                    data-testid={`row-player-${i}`}
                  >
                    {/* Rank */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isTop3 ? rankBgs[i] + " border" : "bg-muted/30"}`}>
                      {isTop3 ? (
                        <Medal className={`w-4 h-4 ${medalColors[i]}`} />
                      ) : (
                        <span className="text-xs font-bold font-mono text-muted-foreground">#{i + 1}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <UserAvatar user={player} size="md" fallbackBg={tierInfo.bgClass} />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${isMe ? "text-primary" : ""}`}>
                          {player.username}
                        </span>
                        {isMe && <Badge variant="outline" className="text-xs px-1.5">You</Badge>}
                        <span className={`text-xs font-bold ${tierInfo.colorClass}`}>{player.tier}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {mode === "farm" ? (
                          <>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-emerald-400" /> Day {player.farmDay || 1}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Coins className="w-3 h-3 text-yellow-400" /> {(player.farmBank || 0).toLocaleString()} in bank
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Flame className="w-3 h-3 text-orange-400" /> {player.streak}d streak
                            </span>
                            <span className="text-xs text-muted-foreground">Lv.{player.level}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Metric */}
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <MetricIcon className={`w-3 h-3 ${mode === "farm" ? "text-yellow-400" : "text-primary"}`} />
                        <span className={`text-sm font-bold font-mono ${mode === "farm" ? "text-yellow-400" : "text-primary"}`}>
                          {metricFmt(player)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{metricLabel}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Your rank callout */}
      {currentUserRank >= 0 && (
        <motion.div
          className="mt-4 p-4 rounded-xl glass border border-primary/20 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-sm text-muted-foreground">
            Your {mode === "farm" ? "Farm Tycoons" : "XP"} rank: <span className="text-primary font-bold text-base">#{currentUserRank + 1}</span>
            {currentUserRank > 0 && <span className="text-muted-foreground"> — keep {mode === "farm" ? "harvesting" : "playing"} to climb higher!</span>}
            {currentUserRank === 0 && <span className="text-yellow-400"> — You're #1! Amazing!</span>}
          </p>
        </motion.div>
      )}
    </div>
  );
}
