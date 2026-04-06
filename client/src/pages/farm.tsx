import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Lock, ArrowUpCircle, ShoppingCart, Star, Zap, TrendingUp } from "lucide-react";

// ── Building catalogue ───────────────────────────────────────────────
interface Building {
  id: string;
  name: string;
  category: "crops" | "buildings" | "livestock" | "equipment";
  description: string;
  image: string;
  buyCost: number;
  upgradeCost: [number, number]; // cost for level 2 and 3
  xpBonus: [number, number, number]; // XP bonus per level (displayed only)
  income: [number, number, number]; // coin income label per level
  emoji: string;
}

const BUILDINGS: Building[] = [
  {
    id: "wheat_field",
    name: "Wheat Field",
    category: "crops",
    description: "A golden field of wheat that earns steady coins.",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=480&h=280&fit=crop&auto=format",
    buyCost: 30,
    upgradeCost: [60, 120],
    xpBonus: [2, 5, 10],
    income: [5, 12, 25],
    emoji: "🌾",
  },
  {
    id: "vegetable_patch",
    name: "Vegetable Patch",
    category: "crops",
    description: "Fresh vegetables that grow faster every level.",
    image: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=480&h=280&fit=crop&auto=format",
    buyCost: 50,
    upgradeCost: [100, 200],
    xpBonus: [3, 7, 14],
    income: [8, 18, 36],
    emoji: "🥕",
  },
  {
    id: "apple_orchard",
    name: "Apple Orchard",
    category: "crops",
    description: "Beautiful orchard trees that bear fruit every season.",
    image: "https://images.unsplash.com/photo-1444858291040-58f756a3bdd6?w=480&h=280&fit=crop&auto=format",
    buyCost: 80,
    upgradeCost: [150, 300],
    xpBonus: [5, 10, 20],
    income: [12, 26, 55],
    emoji: "🍎",
  },
  {
    id: "farmhouse",
    name: "Farmhouse",
    category: "buildings",
    description: "Your home base — upgrade it to unlock more workers.",
    image: "https://images.unsplash.com/photo-1464226184884-fa280b87919d?w=480&h=280&fit=crop&auto=format",
    buyCost: 40,
    upgradeCost: [90, 180],
    xpBonus: [2, 6, 12],
    income: [4, 10, 20],
    emoji: "🏠",
  },
  {
    id: "barn",
    name: "Red Barn",
    category: "buildings",
    description: "Classic red barn for storing grain and tools.",
    image: "https://images.unsplash.com/photo-1516253593875-bd7ba052fbc5?w=480&h=280&fit=crop&auto=format",
    buyCost: 70,
    upgradeCost: [140, 280],
    xpBonus: [4, 9, 18],
    income: [10, 22, 45],
    emoji: "🏚️",
  },
  {
    id: "greenhouse",
    name: "Greenhouse",
    category: "buildings",
    description: "Year-round growing in a climate-controlled glass house.",
    image: "https://images.unsplash.com/photo-1585832634226-7f8e24f7a46b?w=480&h=280&fit=crop&auto=format",
    buyCost: 120,
    upgradeCost: [240, 480],
    xpBonus: [8, 16, 30],
    income: [18, 38, 80],
    emoji: "🌿",
  },
  {
    id: "windmill",
    name: "Windmill",
    category: "buildings",
    description: "Harnesses wind to power the whole farm.",
    image: "https://images.unsplash.com/photo-1504198317011-373f505e3536?w=480&h=280&fit=crop&auto=format",
    buyCost: 100,
    upgradeCost: [200, 400],
    xpBonus: [6, 13, 25],
    income: [15, 32, 65],
    emoji: "⚙️",
  },
  {
    id: "dairy_cows",
    name: "Dairy Cows",
    category: "livestock",
    description: "Happy cows produce fresh milk and a steady income.",
    image: "https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=480&h=280&fit=crop&auto=format",
    buyCost: 90,
    upgradeCost: [180, 360],
    xpBonus: [5, 12, 22],
    income: [14, 30, 60],
    emoji: "🐄",
  },
  {
    id: "chicken_coop",
    name: "Chicken Coop",
    category: "livestock",
    description: "Free-range hens laying eggs every single morning.",
    image: "https://images.unsplash.com/photo-1472224371620-c8c1e8f80a1b?w=480&h=280&fit=crop&auto=format",
    buyCost: 55,
    upgradeCost: [110, 220],
    xpBonus: [3, 8, 15],
    income: [9, 20, 40],
    emoji: "🐔",
  },
  {
    id: "tractor",
    name: "Tractor",
    category: "equipment",
    description: "Heavy-duty tractor that speeds up all farm operations.",
    image: "https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=480&h=280&fit=crop&auto=format",
    buyCost: 150,
    upgradeCost: [300, 600],
    xpBonus: [10, 20, 40],
    income: [22, 48, 95],
    emoji: "🚜",
  },
  {
    id: "irrigation",
    name: "Irrigation System",
    category: "equipment",
    description: "Automated watering system for the entire farm.",
    image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=480&h=280&fit=crop&auto=format",
    buyCost: 110,
    upgradeCost: [220, 440],
    xpBonus: [7, 15, 28],
    income: [16, 35, 70],
    emoji: "💧",
  },
  {
    id: "silo",
    name: "Grain Silo",
    category: "equipment",
    description: "Store grain in bulk and sell at peak market prices.",
    image: "https://images.unsplash.com/photo-1625246333195-ba84d41f5a45?w=480&h=280&fit=crop&auto=format",
    buyCost: 130,
    upgradeCost: [260, 520],
    xpBonus: [8, 18, 35],
    income: [20, 42, 85],
    emoji: "🏗️",
  },
];

type TycoonState = Record<string, number>; // buildingId -> level (0 = not bought)

const LEVEL_COLORS = ["", "border-yellow-500/60", "border-blue-500/60", "border-purple-500/60"];
const LEVEL_LABELS = ["", "Level 1", "Level 2", "Level 3 ★"];
const LEVEL_BADGE = ["", "bg-yellow-500/20 text-yellow-400", "bg-blue-500/20 text-blue-400", "bg-purple-500/20 text-purple-400"];

export default function FarmPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [state, setState] = useState<TycoonState>(() => {
    try { return JSON.parse(localStorage.getItem("tycoon_state") || "{}"); } catch { return {}; }
  });
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<Building | null>(null);

  useEffect(() => {
    localStorage.setItem("tycoon_state", JSON.stringify(state));
  }, [state]);

  const spendMutation = useMutation({
    mutationFn: (amount: number) => apiRequest("POST", "/api/coins/spend", { amount }),
    onSuccess: (data: any) => {
      if (data.user) updateUser(data.user);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  if (!user) return null;

  const totalOwned = Object.values(state).filter(v => v > 0).length;
  const totalIncome = BUILDINGS.reduce((sum, b) => {
    const lv = state[b.id] || 0;
    return lv > 0 ? sum + b.income[lv - 1] : sum;
  }, 0);

  function getAction(b: Building) {
    const lv = state[b.id] || 0;
    if (lv === 0) return { label: "Buy", cost: b.buyCost, type: "buy" as const };
    if (lv < 3) return { label: "Upgrade", cost: b.upgradeCost[lv - 1], type: "upgrade" as const };
    return null;
  }

  function handleAction(b: Building) {
    const action = getAction(b);
    if (!action) return;
    if ((user.eduCoins) < action.cost) {
      toast({ title: "Not enough EduCoins", description: `You need ${action.cost} coins`, variant: "destructive" });
      return;
    }
    spendMutation.mutate(action.cost, {
      onSuccess: () => {
        const newLv = (state[b.id] || 0) + 1;
        setState(prev => ({ ...prev, [b.id]: newLv }));
        toast({
          title: action.type === "buy" ? `${b.emoji} ${b.name} purchased!` : `${b.emoji} ${b.name} upgraded to Level ${newLv}!`,
          description: action.type === "buy"
            ? `Now earning ${b.income[0]} coins/cycle`
            : `Now earning ${b.income[newLv - 1]} coins/cycle`,
        });
      },
    });
  }

  const filtered = tab === "all" ? BUILDINGS : BUILDINGS.filter(b => b.category === tab);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div className="mb-6" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
              FARM <span className="text-emerald-400">TYCOON</span>
            </h1>
            <p className="text-sm text-muted-foreground">Buy and upgrade buildings to grow your empire</p>
          </div>
          {/* Stats bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="font-bold text-yellow-400 text-sm">{user.eduCoins} coins</span>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-emerald-400 text-sm">{totalOwned} owned</span>
            </div>
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-xl px-3 py-2">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span className="font-bold text-blue-400 text-sm">{totalIncome}/cycle</span>
            </div>
          </div>
        </div>

        {/* Progress toward next milestone */}
        <div className="mt-4 bg-card border border-border/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground font-medium">Farm Progress</span>
            <span className="text-xs font-mono text-muted-foreground">{totalOwned} / {BUILDINGS.length} buildings</span>
          </div>
          <Progress value={(totalOwned / BUILDINGS.length) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1.5">
            {totalOwned === 0 && "Buy your first building to start your empire!"}
            {totalOwned > 0 && totalOwned < 6 && "Good start! Keep expanding your farm."}
            {totalOwned >= 6 && totalOwned < 12 && "Looking great! Almost a full farm."}
            {totalOwned === 12 && "🏆 Full farm achieved! Max out all levels to become a legend."}
          </p>
        </div>
      </motion.div>

      {/* Category tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mb-5">
        <TabsList className="bg-muted/50 border border-border/40">
          {[
            { value: "all", label: "All" },
            { value: "crops", label: "🌾 Crops" },
            { value: "buildings", label: "🏠 Buildings" },
            { value: "livestock", label: "🐄 Livestock" },
            { value: "equipment", label: "🚜 Equipment" },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Building grid */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        initial="hidden" animate="show"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }}>

        {filtered.map(b => {
          const lv = state[b.id] || 0;
          const action = getAction(b);
          const canAfford = action ? user.eduCoins >= action.cost : true;
          const isMaxed = lv === 3;

          return (
            <motion.div key={b.id}
              variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
              className={`relative rounded-xl border-2 overflow-hidden transition-all duration-200 cursor-pointer
                ${lv > 0 ? LEVEL_COLORS[lv] : "border-border/40"}
                ${selected?.id === b.id ? "ring-2 ring-primary/50" : ""}
                hover:border-primary/40 hover:shadow-lg`}
              onClick={() => setSelected(selected?.id === b.id ? null : b)}
              data-testid={`building-${b.id}`}>

              {/* Image */}
              <div className="relative w-full h-40 overflow-hidden bg-muted">
                <img src={b.image} alt={b.name}
                  className={`w-full h-full object-cover transition-all duration-300 ${lv === 0 ? "grayscale opacity-50" : ""}`}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                {lv === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Lock className="w-8 h-8 text-white/50" />
                  </div>
                )}
                {/* Level badge */}
                {lv > 0 && (
                  <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold ${LEVEL_BADGE[lv]}`}>
                    {LEVEL_LABELS[lv]}
                  </div>
                )}
                {isMaxed && (
                  <div className="absolute top-2 left-2">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  </div>
                )}
                {/* Emoji overlay */}
                <div className="absolute bottom-2 left-2 text-2xl">{b.emoji}</div>
              </div>

              {/* Info */}
              <div className="p-3 bg-card">
                <h3 className="font-bold text-sm text-foreground mb-0.5">{b.name}</h3>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{b.description}</p>

                {/* Income display */}
                {lv > 0 && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <TrendingUp className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs text-emerald-400 font-medium">{b.income[lv - 1]} coins/cycle</span>
                  </div>
                )}

                {/* Action button */}
                {isMaxed ? (
                  <div className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <Star className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-bold text-purple-400">MAXED OUT</span>
                  </div>
                ) : action ? (
                  <Button
                    size="sm"
                    className={`w-full text-xs h-8 ${action.type === "buy"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-blue-600 hover:bg-blue-500 text-white"}`}
                    onClick={e => { e.stopPropagation(); handleAction(b); }}
                    disabled={!canAfford || spendMutation.isPending}
                    data-testid={`btn-${action.type}-${b.id}`}>
                    {action.type === "buy" ? (
                      <><ShoppingCart className="w-3 h-3 mr-1" />{action.cost} coins</>
                    ) : (
                      <><ArrowUpCircle className="w-3 h-3 mr-1" />{action.cost} coins</>
                    )}
                  </Button>
                ) : null}

                {action && !canAfford && (
                  <p className="text-xs text-red-400 text-center mt-1">Need {action.cost - user.eduCoins} more coins</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Detail panel when selected */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-lg px-4"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}>
            <div className="bg-card border border-primary/30 rounded-2xl p-4 shadow-2xl"
              style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                  <img src={selected.image} alt={selected.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-foreground">{selected.emoji} {selected.name}</h3>
                    {(state[selected.id] || 0) > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${LEVEL_BADGE[state[selected.id]]}`}>
                        {LEVEL_LABELS[state[selected.id]]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{selected.description}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {selected.income.map((inc, i) => (
                      <div key={i} className={`rounded-lg p-1.5 text-center border
                        ${(state[selected.id] || 0) === i + 1
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-border/30 bg-muted/30"}`}>
                        <div className="font-bold text-emerald-400">{inc}/cycle</div>
                        <div className="text-muted-foreground">Lv {i + 1}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0">✕</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How to earn coins hint */}
      <div className="mt-6 p-4 rounded-xl border border-border/30 bg-muted/20">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold">How to earn EduCoins</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Complete course levels (+EduCoins per level), maintain daily login streaks (+bonus coins), play IKUFLY minigame (+1 coin per 5 points), and purchase items from the shop.
        </p>
      </div>
    </div>
  );
}
