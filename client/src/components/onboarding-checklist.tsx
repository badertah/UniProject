import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Circle, ChevronRight, X, Sparkles, BookOpen,
  Tractor, Award, ShoppingBag, TrendingUp, HelpCircle,
} from "lucide-react";

const DISMISS_LS_KEY = (uid: string) => `iku_onboarding_dismissed_v1_${uid}`;

interface Quest {
  id: string;
  icon: any;
  label: string;
  hint: string;
  href: string;
  cta: string;
  color: string;
  bgColor: string;
  isDone: (ctx: QuestCtx) => boolean;
}

interface QuestCtx {
  user: any;
  progress: any[];
  badgeCount: number;
  cosmeticCount: number;
}

const QUESTS: Quest[] = [
  {
    id: "first_lesson",
    icon: BookOpen,
    label: "Complete your first lesson",
    hint: "Pick any topic in the Courses tab and beat one level — you'll earn XP and EduCoins on the spot.",
    href: "/courses",
    cta: "Browse Courses",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10 border-cyan-500/30",
    isDone: (c) => (c.progress || []).some((p: any) => p.completed),
  },
  {
    id: "first_farm",
    icon: Tractor,
    label: "Plant your first farm building",
    hint: "Visit the Farm to start your idle EduCoin engine. Crops, livestock, and machines unlock automatically.",
    href: "/farm",
    cta: "Open Farm",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/30",
    isDone: (c) => {
      try {
        const raw = localStorage.getItem(`farm_v2_state_${c.user?.id}`);
        if (!raw) return false;
        const s = JSON.parse(raw);
        return Object.values(s?.buildings || {}).some((b: any) => (b?.level ?? 0) > 0);
      } catch {
        return false;
      }
    },
  },
  {
    id: "first_badge",
    icon: Award,
    label: "Earn your first badge",
    hint: "Badges unlock automatically as you hit milestones — XP, streaks, perfect scores, and more.",
    href: "/badges",
    cta: "View Badges",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/30",
    isDone: (c) => c.badgeCount > 0,
  },
  {
    id: "first_cosmetic",
    icon: ShoppingBag,
    label: "Buy your first cosmetic",
    hint: "Spend EduCoins on avatars, frames, and themes. Equip them to flex on the leaderboard.",
    href: "/shop",
    cta: "Visit Shop",
    color: "text-pink-400",
    bgColor: "bg-pink-500/10 border-pink-500/30",
    isDone: (c) => c.cosmeticCount > 0,
  },
  {
    id: "reach_lvl5",
    icon: TrendingUp,
    label: "Reach Level 5",
    hint: "Stack up XP from lessons, mini-games, and IkuFly to hit your first major rank-up.",
    href: "/courses",
    cta: "Earn XP",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/30",
    isDone: (c) => (c.user?.level ?? 0) >= 5,
  },
];

export default function OnboardingChecklist({
  user,
  onReplayTutorial,
}: {
  user: any;
  onReplayTutorial: () => void;
}) {
  // Initialize synchronously from localStorage so the checklist is visible
  // on first paint for any user who hasn't explicitly dismissed it.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined" || !user?.id) return false;
    return localStorage.getItem(DISMISS_LS_KEY(user.id)) === "1";
  });
  const { data: progress } = useQuery<any[]>({ queryKey: ["/api/progress"] });
  const { data: badges } = useQuery<any[]>({ queryKey: ["/api/badges"] });
  const { data: cosmetics } = useQuery<any[]>({ queryKey: ["/api/cosmetics"] });

  // Reconcile if the user changes (e.g. switching accounts in the same tab).
  useEffect(() => {
    if (!user?.id) return;
    const flag = localStorage.getItem(DISMISS_LS_KEY(user.id));
    setDismissed(flag === "1");
  }, [user?.id]);

  if (!user) return null;

  const ctx: QuestCtx = {
    user,
    progress: progress || [],
    badgeCount: (badges || []).filter((b: any) => b.earned).length,
    cosmeticCount: (cosmetics || []).filter((c: any) => c.owned).length,
  };

  const completedCount = QUESTS.filter((q) => q.isDone(ctx)).length;
  const allDone = completedCount === QUESTS.length;
  const pct = Math.round((completedCount / QUESTS.length) * 100);

  // Auto-dismiss when complete (but show a celebration first time it hits 100%).
  if (dismissed) return null;

  function handleDismiss() {
    if (user?.id) localStorage.setItem(DISMISS_LS_KEY(user.id), "1");
    setDismissed(true);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        data-testid="card-onboarding-checklist"
      >
        <Card className="border-purple-500/30 overflow-hidden relative"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(6,182,212,0.05) 100%)",
          }}>
          <CardContent className="p-4 md:p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #06b6d4)" }}>
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-wide text-foreground"
                    style={{ fontFamily: "Oxanium, sans-serif" }}>
                    {allDone ? "Onboarding complete!" : "Your Starter Quests"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {allDone
                      ? "You've earned your wings — the Academy is yours to conquer."
                      : `${completedCount} of ${QUESTS.length} done · keep going to unlock the full IKUGames experience`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onReplayTutorial}
                  className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                  title="Replay welcome tutorial"
                  data-testid="button-replay-tutorial"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDismiss}
                  className="p-1.5 rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                  title="Hide onboarding"
                  data-testid="button-dismiss-onboarding"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #7c3aed, #06b6d4)",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Quest grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {QUESTS.map((quest) => {
                const done = quest.isDone(ctx);
                const Icon = quest.icon;
                return (
                  <div
                    key={quest.id}
                    className={`group relative rounded-lg border p-3 transition-all ${
                      done
                        ? "bg-emerald-500/5 border-emerald-500/30"
                        : `${quest.bgColor} hover:border-white/30`
                    }`}
                    data-testid={`quest-${quest.id}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex-shrink-0 mt-0.5">
                        {done ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Circle className={`w-5 h-5 ${quest.color}`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Icon className={`w-3.5 h-3.5 ${done ? "text-emerald-400" : quest.color}`} />
                          <p className={`text-sm font-bold leading-tight ${done ? "text-emerald-300 line-through" : "text-foreground"}`}>
                            {quest.label}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-snug mb-2">
                          {quest.hint}
                        </p>
                        {!done && (
                          <Link href={quest.href}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`h-7 px-2 text-xs ${quest.color} hover:bg-white/10`}
                              data-testid={`button-quest-${quest.id}`}
                            >
                              {quest.cta}
                              <ChevronRight className="w-3 h-3 ml-0.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {allDone && (
              <div className="mt-4 text-center">
                <Button
                  onClick={handleDismiss}
                  size="sm"
                  className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white"
                  data-testid="button-onboarding-complete"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Close Starter Quests
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
