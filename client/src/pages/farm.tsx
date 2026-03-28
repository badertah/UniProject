import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sprout, Home, Warehouse, Users, Droplets, ShoppingCart,
  TreePine, Beef, FlaskConical, Crown, Star, Zap, BookOpen,
  ChevronRight, Lock, CheckCircle2, Sparkles
} from "lucide-react";

interface FarmMilestone {
  xp: number;
  title: string;
  story: string;
  icon: any;
  improvement: string;
  color: string;
  emoji: string;
}

const FARM_MILESTONES: FarmMilestone[] = [
  {
    xp: 0,
    title: "The Abandoned Homestead",
    story: "You inherit a run-down farm from your grandfather. The fields are overgrown with weeds, the old barn is falling apart, and the farmhouse roof has several holes. It looks hopeless — but you decide to make it work.",
    icon: Home,
    improvement: "Broken farmhouse standing on cracked earth",
    color: "from-stone-600 to-stone-800",
    emoji: "🏚️",
  },
  {
    xp: 100,
    title: "First Seeds Planted",
    story: "After clearing the weeds, you plant your first row of vegetables. It's just a small patch, but as you press each seed into the soil, you feel a flicker of hope. Your grandfather used to say: 'Every harvest begins with a single seed.'",
    icon: Sprout,
    improvement: "Small vegetable patch planted",
    color: "from-lime-700 to-green-800",
    emoji: "🌱",
  },
  {
    xp: 250,
    title: "The Farmhouse Repairs",
    story: "With some coin saved from selling your first vegetables at the roadside, you patch the farmhouse roof and fix the front door. That night, for the first time, rain doesn't drip into your bedroom. You sleep soundly.",
    icon: Home,
    improvement: "Repaired farmhouse with fresh coat of paint",
    color: "from-amber-700 to-orange-800",
    emoji: "🏠",
  },
  {
    xp: 500,
    title: "A Scholar Tends the Land",
    story: "Word spreads that you're serious about farming. Old Marta, a retired agricultural expert, knocks on your door. 'You've been studying,' she says with a smile. 'I can see it in how you tend the crops. I'll help you.' Your first farmhand has arrived.",
    icon: Users,
    improvement: "Farmhand cottage built, crops growing steadily",
    color: "from-blue-700 to-cyan-800",
    emoji: "👩‍🌾",
  },
  {
    xp: 800,
    title: "The Irrigation Channels",
    story: "The summer was dry, and your crops nearly wilted. You spend three weeks digging irrigation channels from the nearby stream. The work is backbreaking, but when the water finally flows through the fields, even Old Marta wipes a tear from her eye.",
    icon: Droplets,
    improvement: "Irrigation system installed, fields lush and green",
    color: "from-sky-700 to-blue-800",
    emoji: "💧",
  },
  {
    xp: 1200,
    title: "The Market Stall",
    story: "You load up the wagon every Saturday morning now. At the village market, people recognize you — 'The young farmer with the best carrots!' they say. A merchant from the city offers to buy your entire weekly harvest. You politely decline. You're building something bigger.",
    icon: ShoppingCart,
    improvement: "Market stall established, regular income flowing",
    color: "from-yellow-700 to-amber-800",
    emoji: "🛒",
  },
  {
    xp: 1500,
    title: "The Expert Farmer",
    story: "You've learned crop rotation, soil enrichment, and seasonal planting schedules. The experts in town say your yields rival farms three times your size. You acquire the eastern field and plant your first orchard — apple, pear, and cherry trees that will feed people for generations.",
    icon: TreePine,
    improvement: "Farm expanded with a thriving orchard",
    color: "from-emerald-700 to-teal-800",
    emoji: "🌳",
  },
  {
    xp: 2200,
    title: "Livestock Arrives",
    story: "A traveling farmer sells you two dairy cows and a dozen chickens at a fair price — 'Because I can see you'll treat them right,' he says. The farm is alive with mooing and clucking now. Fresh eggs and milk appear on the village doorsteps each morning.",
    icon: Beef,
    improvement: "Barn with dairy cows and chicken coops",
    color: "from-rose-700 to-pink-800",
    emoji: "🐄",
  },
  {
    xp: 3000,
    title: "The Greenhouse",
    story: "You build a glass greenhouse with your own hands over an entire winter. When spring comes, you're growing tomatoes and herbs while your neighbors are still waiting for the frost to clear. The merchant from the city comes back — this time, you negotiate.",
    icon: FlaskConical,
    improvement: "Glass greenhouse gleaming in the sunlight",
    color: "from-violet-700 to-purple-800",
    emoji: "🌿",
  },
  {
    xp: 3500,
    title: "A Master of the Land",
    story: "You purchase the northern hill land at auction, outbidding the large agricultural company that wanted to turn it into a concrete warehouse. As you sign the deed, Old Marta squeezes your shoulder. 'Your grandfather would be proud,' she says quietly.",
    icon: Warehouse,
    improvement: "Second plot with processing barn acquired",
    color: "from-indigo-700 to-blue-900",
    emoji: "🏗️",
  },
  {
    xp: 5000,
    title: "Champion of the Farmers Market",
    story: "The Regional Harvest Festival names your farm the Champion Producer three years in a row. You donate a portion of every harvest to the village food bank. Children from the school visit on field trips. You teach them what you learned — that knowledge, like seeds, grows when shared.",
    icon: Star,
    improvement: "Trophy garden and festival pavilion built",
    color: "from-yellow-600 to-amber-700",
    emoji: "🏆",
  },
  {
    xp: 7000,
    title: "The Legendary Estate Farm",
    story: "What began as a ruined homestead is now a legendary estate. People travel from distant cities to visit. You've hired 12 workers and trained them all yourself. The farmhouse your grandfather built is now the heart of a thriving community. In the evening, you sit on the porch and watch the sun set over fields of gold — and you know: every lesson learned, every challenge overcome, built this.",
    icon: Crown,
    improvement: "Grand estate with all farm buildings complete",
    color: "from-rose-600 to-red-800",
    emoji: "👑",
  },
];

function getFarmStage(xp: number): number {
  let stage = 0;
  for (let i = 0; i < FARM_MILESTONES.length; i++) {
    if (xp >= FARM_MILESTONES[i].xp) stage = i;
    else break;
  }
  return stage;
}

function getProgressToNext(xp: number): { current: number; required: number; percent: number } | null {
  const stage = getFarmStage(xp);
  const nextMilestone = FARM_MILESTONES[stage + 1];
  if (!nextMilestone) return null;
  const prevXp = FARM_MILESTONES[stage].xp;
  const current = xp - prevXp;
  const required = nextMilestone.xp - prevXp;
  const percent = Math.min(100, Math.round((current / required) * 100));
  return { current, required, percent };
}

function FarmVisual({ stage }: { stage: number }) {
  const milestone = FARM_MILESTONES[stage];
  const gradient = milestone.color;

  const buildings = [
    { stage: 0, emoji: "🏚️", label: "Homestead", x: 40, y: 55 },
    { stage: 2, emoji: "🏠", label: "Farmhouse", x: 40, y: 55 },
    { stage: 3, emoji: "🏡", label: "Cottage", x: 68, y: 60 },
    { stage: 7, emoji: "🐄", label: "Barn", x: 20, y: 60 },
    { stage: 8, emoji: "🌿", label: "Greenhouse", x: 75, y: 45 },
    { stage: 9, emoji: "🏗️", label: "Warehouse", x: 55, y: 35 },
    { stage: 10, emoji: "⛲", label: "Pavilion", x: 30, y: 35 },
    { stage: 11, emoji: "🏰", label: "Estate", x: 45, y: 30 },
  ];

  const crops = [
    { stage: 1, emoji: "🌱", x: 20, y: 75 },
    { stage: 1, emoji: "🌱", x: 28, y: 75 },
    { stage: 1, emoji: "🌱", x: 36, y: 75 },
    { stage: 4, emoji: "🌾", x: 20, y: 75 },
    { stage: 4, emoji: "🌾", x: 28, y: 75 },
    { stage: 4, emoji: "🌾", x: 36, y: 75 },
    { stage: 6, emoji: "🌳", x: 60, y: 65 },
    { stage: 6, emoji: "🌳", x: 68, y: 70 },
    { stage: 6, emoji: "🍎", x: 60, y: 75 },
    { stage: 8, emoji: "🍅", x: 75, y: 55 },
  ];

  const animals = [
    { stage: 7, emoji: "🐄", x: 15, y: 72 },
    { stage: 7, emoji: "🐔", x: 22, y: 78 },
    { stage: 7, emoji: "🐔", x: 26, y: 80 },
  ];

  const extras = [
    { stage: 4, emoji: "💧", x: 50, y: 80 },
    { stage: 5, emoji: "🛒", x: 82, y: 75 },
    { stage: 10, emoji: "🏆", x: 50, y: 45 },
  ];

  const allElements = [
    ...buildings.filter(b => stage >= b.stage),
    ...crops.filter(c => stage >= c.stage),
    ...animals.filter(a => stage >= a.stage),
    ...extras.filter(e => stage >= e.stage),
  ];

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden border border-border/30`}
      style={{ height: 220, background: "linear-gradient(180deg, #87CEEB 0%, #98FB98 60%, #8B6914 100%)" }}
    >
      {/* Sky */}
      <div className="absolute top-2 left-4 text-2xl">☀️</div>
      <div className="absolute top-3 left-16 text-xs">☁️</div>
      <div className="absolute top-2 right-8 text-sm">☁️</div>

      {/* Ground line */}
      <div className="absolute bottom-0 left-0 right-0 h-16 rounded-b-xl" style={{ background: "linear-gradient(180deg, #6B8E23 0%, #8B6914 100%)" }} />

      {/* Elements */}
      <AnimatePresence>
        {allElements.map((el, i) => (
          <motion.div
            key={`${el.emoji}-${el.x}-${el.y}`}
            className="absolute text-2xl cursor-default select-none"
            style={{ left: `${el.x}%`, top: `${el.y}%`, transform: "translate(-50%, -50%)" }}
            initial={{ opacity: 0, scale: 0, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
          >
            {el.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Stage label */}
      <div className="absolute bottom-2 right-3">
        <Badge className="text-xs bg-black/40 text-white border-white/20 backdrop-blur-sm">
          Stage {stage + 1} of {FARM_MILESTONES.length}
        </Badge>
      </div>
    </div>
  );
}

export default function FarmPage() {
  const { user } = useAuth();
  const [selectedMilestone, setSelectedMilestone] = useState<number | null>(null);

  if (!user) return null;

  const currentStage = getFarmStage(user.xp);
  const nextProgress = getProgressToNext(user.xp);
  const currentMilestone = FARM_MILESTONES[currentStage];
  const nextMilestone = FARM_MILESTONES[currentStage + 1];
  const Icon = currentMilestone.icon;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <Sprout className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
              FARM <span className="text-emerald-400">TYCOON</span>
            </h1>
            <p className="text-sm text-muted-foreground">Your farm grows as your knowledge grows</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Farm view + current chapter */}
        <div className="lg:col-span-2 space-y-4">
          {/* Farm Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <FarmVisual stage={currentStage} />
          </motion.div>

          {/* Current Chapter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl bg-gradient-to-br ${currentMilestone.color}`}
                  >
                    {currentMilestone.emoji}
                  </div>
                  <div>
                    <Badge variant="outline" className="text-xs mb-1 text-emerald-400 border-emerald-500/30">
                      Current Chapter
                    </Badge>
                    <CardTitle className="text-base" style={{ fontFamily: "Oxanium, sans-serif" }}>
                      {currentMilestone.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed italic">
                  "{currentMilestone.story}"
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Sprout className="w-3 h-3 text-emerald-400" />
                  <span>{currentMilestone.improvement}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* XP to next chapter */}
          {nextProgress && nextMilestone && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium">Next: {nextMilestone.title}</span>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {nextProgress.current} / {nextProgress.required} XP
                    </span>
                  </div>
                  <Progress value={nextProgress.percent} className="h-2" />
                  <div className="flex items-center gap-1.5 mt-2">
                    <BookOpen className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Earn {nextMilestone.xp - user.xp} more XP from courses to unlock the next chapter
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStage === FARM_MILESTONES.length - 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-4 text-center">
                  <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-yellow-400" style={{ fontFamily: "Oxanium, sans-serif" }}>
                    LEGENDARY FARMER ACHIEVED
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You have unlocked the full story of the Estate Farm. Remarkable!
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* Right: Story timeline */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold tracking-widest text-muted-foreground font-mono flex items-center gap-2">
            <Zap className="w-4 h-4" /> FARM STORY
          </h2>

          <ScrollArea className="h-[500px] pr-1">
            <div className="space-y-2 pr-1">
              {FARM_MILESTONES.map((milestone, index) => {
                const isUnlocked = user.xp >= milestone.xp;
                const isCurrent = index === currentStage;
                const MilestoneIcon = milestone.icon;

                return (
                  <motion.button
                    key={milestone.xp}
                    onClick={() => isUnlocked ? setSelectedMilestone(selectedMilestone === index ? null : index) : null}
                    className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                      isCurrent
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : isUnlocked
                        ? "border-border/40 bg-card/60 hover:border-emerald-500/30 cursor-pointer"
                        : "border-border/20 bg-muted/10 opacity-50 cursor-default"
                    }`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    data-testid={`farm-milestone-${index}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 bg-gradient-to-br ${milestone.color}`}>
                        {isUnlocked ? milestone.emoji : "🔒"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${isCurrent ? "text-emerald-400" : isUnlocked ? "text-foreground" : "text-muted-foreground"}`}>
                          {milestone.title}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {milestone.xp === 0 ? "Start" : `${milestone.xp} XP`}
                        </p>
                      </div>
                      {isCurrent && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                      {isUnlocked && !isCurrent && <CheckCircle2 className="w-3 h-3 text-emerald-500/60 flex-shrink-0" />}
                      {!isUnlocked && <Lock className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />}
                    </div>

                    {/* Expanded story */}
                    <AnimatePresence>
                      {selectedMilestone === index && isUnlocked && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <p className="text-xs text-muted-foreground leading-relaxed mt-2 pt-2 border-t border-border/30 italic">
                            "{milestone.story}"
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </ScrollArea>

          {/* XP info */}
          <Card className="border-border/40">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold">Your Progress</span>
              </div>
              <div className="text-2xl font-bold font-mono text-primary">{user.xp} XP</div>
              <p className="text-xs text-muted-foreground mt-1">
                Earned from courses and mini-games
              </p>
              <div className="mt-2 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                {currentStage + 1} of {FARM_MILESTONES.length} chapters unlocked
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
