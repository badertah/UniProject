import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { getTierInfo, formatXp } from "@/lib/utils";
import { UserAvatar } from "@/components/cosmetics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Trophy, Flame, Zap, Medal, Crown, Coins, Tractor, Calendar,
  TrendingUp, Clock, ArrowUp, ArrowDown, Minus,
} from "lucide-react";

type Mode = "farm" | "xp";
type FarmSort = "earned" | "days" | "efficiency" | "recent";

// Farm-specific tier — separate from the XP tier so the farm leaderboard
// has its own visible class system that scales with lifetime earnings.
function farmTier(earned: number): { name: string; color: string } {
  if (earned >= 50_000) return { name: "Legend",   color: "#FFD700" };
  if (earned >= 20_000) return { name: "Tycoon",   color: "#D0BCFF" };
  if (earned >= 5_000)  return { name: "Grower",   color: "#A8D8A8" };
  if (earned >= 500)    return { name: "Farmer",   color: "#90CAF9" };
  return                       { name: "Sprout",   color: "#C8A84E" };
}

// Coins-per-day efficiency. Floors farmDay at 1 to mirror server math
// and avoid div-by-zero from any data oddity.
const efficiency = (p: any) => Math.round((p.farmTotalEarned || 0) / Math.max(1, p.farmDay || 1));

// "X minutes / hours / days ago" — pure & cheap, no date library needed.
function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never harvested";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

const FARM_SORTS: { key: FarmSort; label: string; short: string; Icon: any; help: string }[] = [
  { key: "earned",     label: "Lifetime Earned", short: "Earned",     Icon: Coins,      help: "Total coins ever banked from harvests." },
  { key: "days",       label: "Days Survived",   short: "Days",       Icon: Calendar,   help: "Most in-game days survived without bankruptcy." },
  { key: "efficiency", label: "Coins / Day",     short: "Efficiency", Icon: TrendingUp, help: "Earned ÷ days — rewards skill over grind." },
  { key: "recent",     label: "Most Recent",     short: "Active",     Icon: Clock,      help: "Most recently harvested farms." },
];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("farm");
  const [farmSort, setFarmSort] = useState<FarmSort>("earned");

  const { data: xpBoard, isLoading: xpLoading } = useQuery<any[]>({ queryKey: ["/api/leaderboard"] });
  // Custom queryFn — the default fetcher does `queryKey.join("/")` which
  // would request /api/leaderboard/farm/earned (404). We need the sort
  // as a ?query param, so build the URL ourselves.
  const { data: farmBoard, isLoading: farmLoading } = useQuery<any[]>({
    queryKey: ["/api/leaderboard/farm", farmSort],
    queryFn: async () => {
      const token = localStorage.getItem("eduquest_token");
      const res = await fetch(`/api/leaderboard/farm?sort=${farmSort}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to load farm leaderboard");
      return res.json();
    },
  });

  const isLoading = mode === "farm" ? farmLoading : xpLoading;
  const leaderboard = mode === "farm" ? farmBoard : xpBoard;
  const currentUserRank = leaderboard?.findIndex(u => u.id === user?.id) ?? -1;

  // Per-mode + per-sort metric helpers — drives podium + row formatting.
  const metric = useMemo(() => {
    if (mode === "xp") {
      return {
        value: (p: any) => p.xp || 0,
        fmt: (p: any) => formatXp(p.xp || 0),
        label: "XP",
        Icon: Zap,
        unit: "",
      };
    }
    switch (farmSort) {
      case "days":
        return { value: (p: any) => p.farmDay || 0, fmt: (p: any) => `Day ${p.farmDay || 1}`, label: "DAYS", Icon: Calendar, unit: "" };
      case "efficiency":
        return { value: efficiency, fmt: (p: any) => efficiency(p).toLocaleString(), label: "COINS/DAY", Icon: TrendingUp, unit: "/day" };
      case "recent":
        return { value: (p: any) => (p.lastHarvestAt ? new Date(p.lastHarvestAt).getTime() : 0), fmt: (p: any) => timeAgo(p.lastHarvestAt), label: "LAST RUN", Icon: Clock, unit: "" };
      case "earned":
      default:
        return { value: (p: any) => p.farmTotalEarned || 0, fmt: (p: any) => (p.farmTotalEarned || 0).toLocaleString(), label: "EARNED", Icon: Coins, unit: "" };
    }
  }, [mode, farmSort]);

  // Comparison snapshot for the "you vs the field" panel — gap to next
  // rank up, lead over next rank down, plus a quick % vs the leader.
  const comparison = useMemo(() => {
    if (!leaderboard || currentUserRank < 0) return null;
    const me = leaderboard[currentUserRank];
    const above = currentUserRank > 0 ? leaderboard[currentUserRank - 1] : null;
    const below = currentUserRank < leaderboard.length - 1 ? leaderboard[currentUserRank + 1] : null;
    const top = leaderboard[0];
    const myV = metric.value(me);
    const topV = metric.value(top);
    const pctOfTop = topV > 0 ? Math.round((myV / topV) * 100) : 100;
    return {
      me, above, below, top, myV, topV, pctOfTop,
      gapUp: above ? Math.max(0, metric.value(above) - myV) : 0,
      leadDown: below ? Math.max(0, myV - metric.value(below)) : 0,
    };
  }, [leaderboard, currentUserRank, metric]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <motion.div className="mb-6" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
              LEADER<span className="text-yellow-400">BOARD</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "farm" ? "Farm Tycoons — compare your operation against every player" : "Course rankings — ranked by total XP earned"}
            </p>
          </div>
        </div>
      </motion.div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="mb-3">
        <TabsList className="grid w-full grid-cols-2" data-testid="tabs-leaderboard-mode">
          <TabsTrigger value="farm" data-testid="tab-farm">
            <Tractor className="w-3.5 h-3.5 mr-1.5"/> Farm Tycoons
          </TabsTrigger>
          <TabsTrigger value="xp" data-testid="tab-xp">
            <Zap className="w-3.5 h-3.5 mr-1.5"/> Courses (XP)
          </TabsTrigger>
        </TabsList>
        <TabsContent value="farm" className="mt-2">
          {/* === Farm sort selector — four head-to-head metrics ===
               Each pill re-fetches the leaderboard with a different
               server-side ORDER BY so players can compare on whatever
               dimension matters to them. Lifetime earned (default)
               favours grind; Coins/Day rewards skill; Days favours
               survivors; Active surfaces who's playing right now. */}
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }} data-testid="farm-sort-tabs">
            {FARM_SORTS.map(s => {
              const active = farmSort === s.key;
              const SIcon = s.Icon;
              return (
                <button
                  key={s.key}
                  onClick={() => setFarmSort(s.key)}
                  data-testid={`btn-farm-sort-${s.key}`}
                  title={s.help}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all hover:scale-105 active:scale-95 ${active ? "ring-1 ring-yellow-400/60" : ""}`}
                  style={{
                    background: active ? "linear-gradient(135deg, #FFD700, #F5A623)" : "rgba(255,255,255,0.06)",
                    color: active ? "#5D4037" : "var(--foreground)",
                    border: active ? "1px solid #FFD700" : "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  <SIcon className="w-3.5 h-3.5"/> {s.short}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground px-1 mt-2">
            {FARM_SORTS.find(s => s.key === farmSort)?.help}
          </p>
        </TabsContent>
        <TabsContent value="xp" className="mt-2">
          <p className="text-xs text-muted-foreground px-1">
            XP earned from completing course levels. Course rewards feed your farm — every quiz cleared funds your next building.
          </p>
        </TabsContent>
      </Tabs>

      {/* === You-vs-field comparison card ===
           A single glance shows where the user stands: rank, % of #1,
           gap to climb, lead to defend. Only renders once we know the
           user's rank — keeps the page calm for non-ranked players. */}
      {comparison && (
        <motion.div
          className="mb-5 p-3 rounded-xl border"
          style={{
            background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(124,77,255,0.06))",
            borderColor: "rgba(255,215,0,0.25)",
          }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          data-testid="card-comparison"
        >
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400"/>
              <span className="text-sm font-bold">Your rank: <span className="text-yellow-400" data-testid="text-my-rank">#{currentUserRank + 1}</span></span>
              <span className="text-xs text-muted-foreground">of {leaderboard?.length || 0}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="font-mono font-bold text-yellow-400" data-testid="text-pct-of-leader">{comparison.pctOfTop}%</span> of #1
            </div>
          </div>
          {/* Visual bar: how close are you to #1 on this metric */}
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.08)" }}>
            <motion.div
              className="h-full"
              style={{ background: "linear-gradient(90deg, #FFD700, #F5A623)" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, comparison.pctOfTop)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.05)" }} data-testid="stat-gap-up">
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <ArrowUp className="w-3 h-3 text-emerald-400"/> CLIMB
              </div>
              <div className="text-sm font-black text-emerald-400">
                {comparison.above ? `+${comparison.gapUp.toLocaleString()}` : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {comparison.above ? `to beat ${comparison.above.username}` : "you're #1!"}
              </div>
            </div>
            <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.05)" }} data-testid="stat-vs-leader">
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <Crown className="w-3 h-3 text-yellow-400"/> #1
              </div>
              <div className="text-sm font-black text-yellow-400 truncate" title={comparison.top.username}>
                {comparison.top.id === user?.id ? "You!" : comparison.top.username}
              </div>
              <div className="text-[10px] text-muted-foreground">{metric.fmt(comparison.top)}</div>
            </div>
            <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.05)" }} data-testid="stat-lead-down">
              <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mb-0.5">
                <ArrowDown className="w-3 h-3 text-blue-400"/> LEAD
              </div>
              <div className="text-sm font-black text-blue-400">
                {comparison.below ? `+${comparison.leadDown.toLocaleString()}` : "—"}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {comparison.below ? `over ${comparison.below.username}` : "no one below"}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Top 3 Podium — shows the active sort metric */}
      {!isLoading && leaderboard && leaderboard.length >= 3 && (
        <motion.div
          key={mode + farmSort}
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
              <motion.div key={player.id + mode + farmSort} className="flex flex-col items-center gap-2" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + idx * 0.08 }}>
                {actualRank === 1 && <Crown className="w-6 h-6 text-yellow-400 animate-pulse-glow" />}
                <UserAvatar user={player} size="lg" fallbackBg={`bg-gradient-to-br ${tierInfo.gradient || colors[idx]}`} className={`${glows[idx]} ${isMe ? "ring-2 ring-primary" : ""}`}/>
                <div className="text-center">
                  <p className="text-xs font-bold truncate max-w-[80px]">{isMe ? "You" : player.username}</p>
                  <p className={`text-xs ${tierInfo.colorClass}`}>{player.tier}</p>
                </div>
                <div className={`${heights[idx]} w-20 rounded-t-lg bg-gradient-to-t ${colors[idx]} flex flex-col items-center justify-center text-white shadow-md`}>
                  <span className="text-lg font-black">#{actualRank}</span>
                  <span className="text-xs font-mono opacity-90 px-1 truncate max-w-full">{metric.fmt(player)}</span>
                  <span className="text-[10px] opacity-70">{metric.label}</span>
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
            FULL RANKINGS · sorted by {FARM_SORTS.find(s => s.key === farmSort)?.label || (mode === "xp" ? "XP" : "earned")}
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
                {mode === "farm" ? "Be the first to harvest and claim the top spot!" : "Be the first to earn XP and claim the top spot!"}
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
                const ft = farmTier(player.farmTotalEarned || 0);
                const eff = efficiency(player);
                // Delta vs the user — colored arrow tells the player at a
                // glance whether each rival is ahead or behind them on the
                // active metric. Skips itself + when there is no user.
                const myV = user && comparison ? comparison.myV : null;
                const playerV = metric.value(player);
                const delta = myV !== null && !isMe ? playerV - myV : 0;
                return (
                  <motion.div
                    key={player.id + mode + farmSort}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors ${isMe ? "bg-primary/8 border-l-2 border-primary" : "hover:bg-muted/20"}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * Math.min(i, 10) }}
                    data-testid={`row-player-${i}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isTop3 ? rankBgs[i] + " border" : "bg-muted/30"}`}>
                      {isTop3 ? <Medal className={`w-4 h-4 ${medalColors[i]}`} /> : <span className="text-xs font-bold font-mono text-muted-foreground">#{i + 1}</span>}
                    </div>
                    <UserAvatar user={player} size="md" fallbackBg={tierInfo.bgClass} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${isMe ? "text-primary" : ""}`}>{player.username}</span>
                        {isMe && <Badge variant="outline" className="text-xs px-1.5">You</Badge>}
                        {mode === "farm" ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: ft.color, background: `${ft.color}1f`, border: `1px solid ${ft.color}55` }} data-testid={`tier-farm-${i}`}>
                            {ft.name}
                          </span>
                        ) : (
                          <span className={`text-xs font-bold ${tierInfo.colorClass}`}>{player.tier}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {mode === "farm" ? (
                          <>
                            <span className="text-xs text-muted-foreground flex items-center gap-1" title="In-game days survived">
                              <Calendar className="w-3 h-3 text-emerald-400" /> Day {player.farmDay || 1}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1" title="Lifetime coins earned">
                              <Coins className="w-3 h-3 text-yellow-400" /> {(player.farmTotalEarned || 0).toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1" title="Coins per day — efficiency">
                              <TrendingUp className="w-3 h-3 text-purple-400" /> {eff.toLocaleString()}/d
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1" title="Last harvest">
                              <Clock className="w-3 h-3 text-blue-400" /> {timeAgo(player.lastHarvestAt)}
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
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <metric.Icon className={`w-3 h-3 ${mode === "farm" ? "text-yellow-400" : "text-primary"}`} />
                        <span className={`text-sm font-bold font-mono ${mode === "farm" ? "text-yellow-400" : "text-primary"}`}>
                          {metric.fmt(player)}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{metric.label}{metric.unit}</span>
                      {/* Delta vs you — only meaningful for the active metric */}
                      {!isMe && myV !== null && farmSort !== "recent" && mode === "farm" && (
                        <div className="flex items-center justify-end gap-0.5 mt-0.5 text-[10px] font-mono" data-testid={`delta-${i}`}>
                          {delta > 0 ? (
                            <><ArrowUp className="w-2.5 h-2.5 text-emerald-400"/><span className="text-emerald-400">+{delta.toLocaleString()}</span></>
                          ) : delta < 0 ? (
                            <><ArrowDown className="w-2.5 h-2.5 text-rose-400"/><span className="text-rose-400">{delta.toLocaleString()}</span></>
                          ) : (
                            <><Minus className="w-2.5 h-2.5 text-muted-foreground"/><span className="text-muted-foreground">tied</span></>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Empty-rank callout for users that aren't on the leaderboard yet */}
      {!isLoading && leaderboard && currentUserRank < 0 && user && (
        <motion.div className="mt-4 p-4 rounded-xl glass border border-yellow-500/20 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <p className="text-sm text-muted-foreground">
            {mode === "farm"
              ? <>You're not ranked yet — <span className="text-yellow-400 font-bold">harvest at least once</span> to join the Farm Tycoons board.</>
              : <>You're not ranked yet — complete a level to start earning XP.</>}
          </p>
        </motion.div>
      )}
    </div>
  );
}
