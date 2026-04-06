import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Award, Lock, CheckCircle2, Zap, Coins, Star, Filter } from "lucide-react";
import { getRarityConfig } from "@/lib/utils";

const RARITY_ORDER = ["legendary", "epic", "rare", "common"];

const RARITY_STYLES: Record<string, { ring: string; glow: string; bg: string; shimmer: boolean }> = {
  legendary: { ring: "ring-2 ring-yellow-400/60", glow: "shadow-lg shadow-yellow-500/20", bg: "bg-gradient-to-br from-yellow-900/40 to-amber-900/20", shimmer: true },
  epic: { ring: "ring-2 ring-purple-400/50", glow: "shadow-lg shadow-purple-500/20", bg: "bg-gradient-to-br from-purple-900/40 to-violet-900/20", shimmer: false },
  rare: { ring: "ring-1 ring-blue-400/40", glow: "shadow-md shadow-blue-500/10", bg: "bg-gradient-to-br from-blue-900/30 to-cyan-900/20", shimmer: false },
  common: { ring: "ring-1 ring-border/30", glow: "", bg: "bg-card/60", shimmer: false },
};

export default function BadgesPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all");
  const [selectedRarity, setSelectedRarity] = useState<string>("all");

  const { data: badgesData, isLoading } = useQuery<any[]>({ queryKey: ["/api/badges"] });

  const earnedCount = badgesData?.filter(b => b.earned).length || 0;
  const totalCount = badgesData?.length || 0;
  const earnedPct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  const filtered = (badgesData || []).filter(b => {
    if (filter === "earned" && !b.earned) return false;
    if (filter === "locked" && b.earned) return false;
    if (selectedRarity !== "all" && b.rarity !== selectedRarity) return false;
    return true;
  }).sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity);
  });

  const stats = [
    { label: "Earned", value: earnedCount, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Locked", value: totalCount - earnedCount, icon: Lock, color: "text-muted-foreground", bg: "bg-muted/20" },
    { label: "Total", value: totalCount, icon: Award, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div className="mb-6" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
            <Award className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
              BADGE<span className="text-yellow-400">S</span>
            </h1>
            <p className="text-sm text-muted-foreground">Collect achievements by playing and learning</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="p-4 rounded-xl bg-card/60 border border-border/40 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Collection Progress</span>
            <span className="text-sm font-bold text-yellow-400 font-mono">{earnedCount} / {totalCount}</span>
          </div>
          <Progress value={earnedPct} className="h-3" />
          <p className="text-xs text-muted-foreground mt-1.5">{earnedPct}% complete — {totalCount - earnedCount} badges left to unlock</p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg ${bg} border border-border/30`}>
              <Icon className={`w-4 h-4 ${color}`} />
              <div>
                <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border/40 overflow-hidden">
            {(["all", "earned", "locked"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex rounded-lg border border-border/40 overflow-hidden">
            {["all", ...RARITY_ORDER].map(r => (
              <button
                key={r}
                onClick={() => setSelectedRarity(r)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                  selectedRarity === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Badge Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-44 rounded-xl bg-card/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {filtered.map((badge: any, i) => {
            const rarityConfig = getRarityConfig(badge.rarity);
            const styles = RARITY_STYLES[badge.rarity] || RARITY_STYLES.common;

            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.5) }}
                data-testid={`card-badge-${badge.id}`}
              >
                <div
                  className={`relative rounded-xl border p-3 transition-all duration-300 group overflow-hidden ${
                    badge.earned
                      ? `${styles.ring} ${styles.glow} ${styles.bg}`
                      : "border-border/30 bg-card/40 opacity-60 hover:opacity-80"
                  }`}
                >
                  {/* Legendary shimmer */}
                  {badge.earned && styles.shimmer && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent -skew-x-12 animate-[shimmer_2s_ease-in-out_infinite]" />
                  )}

                  {/* Earned checkmark */}
                  {badge.earned && (
                    <div className="absolute top-2 right-2 z-10">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                  )}
                  {!badge.earned && (
                    <div className="absolute top-2 right-2 z-10">
                      <Lock className="w-3 h-3 text-muted-foreground/50" />
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`relative w-full h-16 rounded-lg mb-2.5 flex items-center justify-center text-3xl bg-gradient-to-br ${badge.color} shadow-inner`}>
                    <span className={`${!badge.earned ? "grayscale opacity-50" : ""}`}>{badge.icon}</span>
                  </div>

                  {/* Name */}
                  <p className={`text-xs font-bold leading-tight mb-1 ${badge.earned ? "" : "text-muted-foreground"}`}>
                    {badge.name}
                  </p>

                  {/* Rarity */}
                  <span className={`text-xs font-bold ${rarityConfig.colorClass}`}>
                    {rarityConfig.label}
                  </span>

                  {/* Rewards */}
                  {(badge.xpReward > 0 || badge.coinReward > 0) && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {badge.xpReward > 0 && (
                        <div className="flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 text-primary" />
                          <span className="text-xs font-mono text-muted-foreground">+{badge.xpReward}</span>
                        </div>
                      )}
                      {badge.coinReward > 0 && (
                        <div className="flex items-center gap-0.5">
                          <Coins className="w-2.5 h-2.5 text-yellow-400" />
                          <span className="text-xs font-mono text-muted-foreground">+{badge.coinReward}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tooltip on hover */}
                  <div className="absolute inset-x-0 bottom-0 bg-card/95 border-t border-border/40 p-2 rounded-b-xl translate-y-full group-hover:translate-y-0 transition-transform duration-200 z-20">
                    <p className="text-xs text-muted-foreground leading-tight">{badge.description}</p>
                    {badge.earnedAt && (
                      <p className="text-xs text-emerald-400 mt-0.5 font-mono">
                        {new Date(badge.earnedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-16">
          <Award className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground mb-1">No badges match your filter</p>
          <p className="text-xs text-muted-foreground/60">Try a different filter to see more badges</p>
        </div>
      )}
    </div>
  );
}
