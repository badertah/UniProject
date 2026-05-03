import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getRarityConfig } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShoppingBag, Coins, CheckCircle2, Lock, Sparkles, User, Frame, Palette, X, ShoppingCart, Zap, TrendingUp } from "lucide-react";
import { AVATAR_PERKS, FRAME_PERKS, THEME_PERKS } from "@shared/cosmetic-perks";

// Visual metadata for cosmetics by icon key
const AVATAR_META: Record<string, { emoji: string; gradient: string; aura: string }> = {
  wizard:  { emoji: "🧙", gradient: "from-violet-600 via-purple-700 to-indigo-900", aura: "shadow-violet-500/40" },
  robot:   { emoji: "🤖", gradient: "from-cyan-500 via-blue-600 to-slate-800", aura: "shadow-cyan-500/40" },
  phoenix: { emoji: "🦅", gradient: "from-orange-500 via-red-600 to-rose-900", aura: "shadow-orange-500/40" },
  dragon:  { emoji: "🐲", gradient: "from-emerald-500 via-teal-600 to-green-900", aura: "shadow-emerald-500/40" },
  knight:  { emoji: "⚔️", gradient: "from-slate-400 via-slate-600 to-slate-900", aura: "shadow-slate-500/30" },
  sage:    { emoji: "📜", gradient: "from-amber-400 via-orange-500 to-red-700", aura: "shadow-amber-400/40" },
  tycoon:  { emoji: "💼", gradient: "from-yellow-500 via-amber-600 to-yellow-900", aura: "shadow-yellow-400/50" },
};

const FRAME_META: Record<string, { border: string; glow: string; label: string; preview: string }> = {
  "neon-purple": { border: "border-2 border-violet-400", glow: "shadow-lg shadow-violet-500/50", label: "Neon Purple", preview: "bg-gradient-to-br from-violet-900/60 to-purple-950" },
  "neon-blue":   { border: "border-2 border-blue-400", glow: "shadow-lg shadow-blue-500/50", label: "Electric Blue", preview: "bg-gradient-to-br from-blue-900/60 to-cyan-950" },
  golden:        { border: "border-2 border-yellow-400", glow: "shadow-lg shadow-yellow-500/60", label: "Golden Legend", preview: "bg-gradient-to-br from-yellow-900/60 to-amber-950" },
  matrix:        { border: "border-2 border-emerald-400", glow: "shadow-lg shadow-emerald-500/50", label: "Matrix", preview: "bg-gradient-to-br from-emerald-900/60 to-green-950" },
  sunrise:       { border: "border-2 border-orange-400", glow: "shadow-lg shadow-orange-500/50", label: "Sunrise", preview: "bg-gradient-to-br from-orange-900/60 to-amber-950" },
  aurora:        { border: "border-2 border-cyan-300", glow: "shadow-lg shadow-cyan-300/60", label: "Aurora", preview: "bg-gradient-to-br from-cyan-900/60 to-emerald-950" },
};

const THEME_META: Record<string, { swatches: string[]; label: string }> = {
  cyberpunk:       { swatches: ["#ff006e", "#ffd60a", "#7209b7", "#111111"], label: "Cyberpunk" },
  space:           { swatches: ["#0d1b2a", "#1b4965", "#bee3f8", "#00d4ff"], label: "Deep Space" },
  "matrix-theme":  { swatches: ["#0d0d0d", "#00ff41", "#39d353", "#1a1a1a"], label: "Matrix Green" },
  ocean:           { swatches: ["#0077b6", "#00b4d8", "#90e0ef", "#03045e"], label: "Ocean Depths" },
  "fire-ice":      { swatches: ["#ef233c", "#4cc9f0", "#f72585", "#4361ee"], label: "Fire & Ice" },
  sunset:          { swatches: ["#ff6b35", "#f7c59f", "#efefd0", "#2d0a3a"], label: "Sunset Glow" },
  forest:          { swatches: ["#1f4d2c", "#6fa472", "#a8c3a0", "#0d2818"], label: "Forest Mist" },
};

// Lookup the perk record for the icon based on the cosmetic type
function perksFor(item: any) {
  if (item.type === "avatar") return AVATAR_PERKS[item.icon];
  if (item.type === "frame")  return FRAME_PERKS[item.icon];
  if (item.type === "theme")  return THEME_PERKS[item.icon];
  return null;
}

const RARITY_CARD_STYLES: Record<string, { outer: string; shimmer: boolean }> = {
  legendary: { outer: "ring-2 ring-yellow-400/50 shadow-xl shadow-yellow-500/20", shimmer: true },
  epic:      { outer: "ring-2 ring-purple-400/40 shadow-lg shadow-purple-500/15", shimmer: false },
  rare:      { outer: "ring-1 ring-blue-400/30 shadow-md shadow-blue-500/10", shimmer: false },
  common:    { outer: "ring-1 ring-border/30", shimmer: false },
};

function AvatarPreview({ icon, gradient, aura, size = "h-24" }: { icon: string; gradient: string; aura: string; size?: string }) {
  const meta = AVATAR_META[icon];
  return (
    <div className={`w-full ${size} rounded-xl flex items-center justify-center relative overflow-hidden bg-gradient-to-br ${meta?.gradient || gradient} shadow-xl ${meta?.aura || ""}`}>
      <div className="absolute inset-0 bg-black/20" />
      <span className="relative text-5xl drop-shadow-xl">{meta?.emoji || icon?.charAt(0)}</span>
    </div>
  );
}

function FramePreview({ icon, size = "h-24" }: { icon: string; size?: string }) {
  const meta = FRAME_META[icon];
  return (
    <div className={`w-full ${size} rounded-xl flex items-center justify-center relative overflow-hidden ${meta?.preview || "bg-muted/20"}`}>
      <div className={`w-14 h-14 rounded-lg flex items-center justify-center text-xl ${meta?.border || "border border-border"} ${meta?.glow || ""} bg-card`}>
        <User className="w-6 h-6 text-muted-foreground" />
      </div>
      {/* Animated corner accents */}
      <div className={`absolute top-2 left-2 w-4 h-4 rounded-tl-md border-t-2 border-l-2 ${meta?.border?.replace("border-2 ", "border-") || "border-border"} opacity-60`} />
      <div className={`absolute top-2 right-2 w-4 h-4 rounded-tr-md border-t-2 border-r-2 ${meta?.border?.replace("border-2 ", "border-") || "border-border"} opacity-60`} />
      <div className={`absolute bottom-2 left-2 w-4 h-4 rounded-bl-md border-b-2 border-l-2 ${meta?.border?.replace("border-2 ", "border-") || "border-border"} opacity-60`} />
      <div className={`absolute bottom-2 right-2 w-4 h-4 rounded-br-md border-b-2 border-r-2 ${meta?.border?.replace("border-2 ", "border-") || "border-border"} opacity-60`} />
    </div>
  );
}

function ThemePreview({ icon, size = "h-24" }: { icon: string; size?: string }) {
  const meta = THEME_META[icon];
  const swatches = meta?.swatches || ["#7c3aed", "#6d28d9", "#4c1d95", "#1e1b4b"];
  return (
    <div className={`w-full ${size} rounded-xl overflow-hidden flex flex-col`}>
      <div className="flex flex-1">
        {swatches.slice(0, 2).map((color, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>
      <div className="flex flex-1">
        {swatches.slice(2, 4).map((color, i) => (
          <div key={i} className="flex-1" style={{ backgroundColor: color }} />
        ))}
      </div>
    </div>
  );
}

function ItemCard({ item, equipped, onSelect }: { item: any; equipped: boolean; onSelect: () => void }) {
  const rarityConfig = getRarityConfig(item.rarity);
  const styles = RARITY_CARD_STYLES[item.rarity] || RARITY_CARD_STYLES.common;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={`relative rounded-xl border border-border/30 overflow-hidden cursor-pointer group transition-all ${styles.outer} ${equipped ? "border-primary/50 bg-primary/5" : "bg-card/80 hover:border-primary/30"}`}
      onClick={onSelect}
      data-testid={`card-cosmetic-${item.id}`}
    >
      {styles.shimmer && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-300/8 to-transparent -skew-x-12 animate-[shimmer_3s_ease-in-out_infinite] pointer-events-none z-10" />
      )}

      {equipped && (
        <div className="absolute top-2 right-2 z-20 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
          <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
        </div>
      )}

      {/* Preview */}
      {item.type === "avatar" && <AvatarPreview icon={item.icon} gradient="" aura="" />}
      {item.type === "frame" && <FramePreview icon={item.icon} />}
      {item.type === "theme" && <ThemePreview icon={item.icon} />}

      {/* Info */}
      <div className="p-2.5">
        <p className="text-xs font-bold leading-tight mb-1 line-clamp-1">{item.name}</p>
        {(() => {
          const p = perksFor(item);
          if (!p || !p.description) return null;
          const hasStat = (p.xpMult > 1) || (p.farmMult > 1) || (p.coinMult > 1);
          if (!hasStat) return null;
          return (
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 mb-1 truncate" data-testid={`perk-${item.id}`}>
              <Zap className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="truncate">{p.description}</span>
            </div>
          );
        })()}
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold ${rarityConfig.colorClass}`}>{rarityConfig.label}</span>
          {item.owned ? (
            <Badge variant="outline" className="text-xs px-1.5 py-0 border-emerald-500/40 text-emerald-400 h-4">
              Owned
            </Badge>
          ) : (
            <div className="flex items-center gap-0.5">
              <Coins className="w-3 h-3 text-yellow-400" />
              <span className="text-xs font-mono font-bold text-yellow-400">{item.price}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ShopPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [previewItem, setPreviewItem] = useState<any>(null);

  const { data: cosmetics, isLoading } = useQuery<any[]>({ queryKey: ["/api/cosmetics"] });

  const purchaseMutation = useMutation({
    mutationFn: (cosmeticId: string) => apiRequest("POST", `/api/cosmetics/purchase/${cosmeticId}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cosmetics"] });
      if (data.user) updateUser(data.user);
      toast({ title: "Purchase Successful!", description: "Item added to your collection" });
      if (previewItem) setPreviewItem({ ...previewItem, owned: true });
    },
    onError: (err: any) => toast({ title: "Purchase Failed", description: err.message, variant: "destructive" }),
  });

  const equipMutation = useMutation({
    mutationFn: (cosmeticId: string) => apiRequest("POST", `/api/cosmetics/equip/${cosmeticId}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cosmetics"] });
      if (data.user) updateUser(data.user);
      toast({ title: "Equipped!", description: "Item is now active on your profile" });
      setPreviewItem(null);
    },
    onError: (err: any) => toast({ title: "Equip Failed", description: err.message, variant: "destructive" }),
  });

  const unequipMutation = useMutation({
    mutationFn: (type: string) => apiRequest("POST", "/api/cosmetics/unequip", { type }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cosmetics"] });
      if (data.user) updateUser(data.user);
      toast({ title: "Unequipped", description: "Item removed from your profile" });
      setPreviewItem(null);
    },
  });

  function isEquipped(item: any): boolean {
    if (!user) return false;
    if (item.type === "avatar") return user.equippedAvatar === item.id;
    if (item.type === "frame") return user.equippedFrame === item.id;
    if (item.type === "theme") return user.equippedTheme === item.id;
    return false;
  }

  const filtered = (cosmetics || []).filter(c => {
    if (activeTab === "avatars") return c.type === "avatar";
    if (activeTab === "frames") return c.type === "frame";
    if (activeTab === "themes") return c.type === "theme";
    return true;
  }).sort((a, b) => {
    const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
    return (order[a.rarity as keyof typeof order] || 3) - (order[b.rarity as keyof typeof order] || 3);
  });

  const ownedCount = (cosmetics || []).filter(c => c.owned).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div className="mb-6" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
                COSM<span className="text-yellow-400">ETICS</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                {ownedCount} / {cosmetics?.length || 0} items collected
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="font-bold text-yellow-400 font-mono text-lg">{user?.eduCoins || 0}</span>
            <span className="text-xs text-muted-foreground">EduCoins</span>
          </div>
        </div>

        {/* How to earn coins hint */}
        <div className="p-3 rounded-lg bg-card/40 border border-border/30 mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Earn coins by completing levels, maintaining streaks, and playing IKUFLY. Legendary items have animated effects!
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-5">
        <TabsList className="bg-card/60 border border-border/40 h-9">
          <TabsTrigger value="all" className="text-xs" data-testid="tab-all">
            All ({cosmetics?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="avatars" className="text-xs" data-testid="tab-avatars">
            <User className="w-3 h-3 mr-1" /> Avatars
          </TabsTrigger>
          <TabsTrigger value="frames" className="text-xs" data-testid="tab-frames">
            <Frame className="w-3 h-3 mr-1" /> Frames
          </TabsTrigger>
          <TabsTrigger value="themes" className="text-xs" data-testid="tab-themes">
            <Palette className="w-3 h-3 mr-1" /> Themes
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => <div key={i} className="h-44 rounded-xl bg-card/50 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map((item: any) => (
            <ItemCard
              key={item.id}
              item={item}
              equipped={isEquipped(item)}
              onSelect={() => setPreviewItem(item)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {previewItem && (
          <motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewItem(null)}
          >
            <motion.div
              className="bg-card border border-border/40 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
              initial={{ y: 60, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Large preview */}
              <div className="relative p-4 pb-0">
                <button
                  onClick={() => setPreviewItem(null)}
                  className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {previewItem.type === "avatar" && <AvatarPreview icon={previewItem.icon} gradient="" aura="" size="h-40" />}
                {previewItem.type === "frame" && <FramePreview icon={previewItem.icon} size="h-40" />}
                {previewItem.type === "theme" && <ThemePreview icon={previewItem.icon} size="h-40" />}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-bold text-base" style={{ fontFamily: "Oxanium, sans-serif" }}>{previewItem.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs capitalize h-5">{previewItem.type}</Badge>
                      <span className={`text-xs font-bold ${getRarityConfig(previewItem.rarity).colorClass}`}>
                        {getRarityConfig(previewItem.rarity).label}
                      </span>
                    </div>
                  </div>
                  {!previewItem.owned && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <Coins className="w-3.5 h-3.5 text-yellow-400" />
                      <span className="font-bold text-yellow-400 font-mono">{previewItem.price}</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground mb-3">{previewItem.description}</p>

                {(() => {
                  const p = perksFor(previewItem);
                  if (!p) return null;
                  const stats: string[] = [];
                  if (p.xpMult > 1)   stats.push(`+${Math.round((p.xpMult - 1) * 100)}% XP`);
                  if (p.farmMult > 1) stats.push(`+${Math.round((p.farmMult - 1) * 100)}% Farm coins`);
                  if (p.coinMult > 1) stats.push(`+${Math.round((p.coinMult - 1) * 100)}% Game coins`);
                  if (stats.length === 0) return null;
                  return (
                    <div className="mb-4 p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-bold tracking-wider text-emerald-400 font-mono">GAMEPLAY PERK</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5" data-testid="preview-perks">
                        {stats.map(s => (
                          <Badge key={s} variant="outline" className="text-xs border-emerald-500/40 text-emerald-300 bg-emerald-500/10 font-mono">
                            {s}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5">Stacks with other equipped items.</p>
                    </div>
                  );
                })()}

                {/* Action buttons */}
                <div className="flex gap-2">
                  {!previewItem.owned ? (
                    <Button
                      className="flex-1"
                      disabled={(user?.eduCoins || 0) < previewItem.price || purchaseMutation.isPending}
                      onClick={() => purchaseMutation.mutate(previewItem.id)}
                      data-testid="button-purchase"
                    >
                      {purchaseMutation.isPending ? (
                        "Purchasing..."
                      ) : (user?.eduCoins || 0) >= previewItem.price ? (
                        <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Buy for {previewItem.price}</>
                      ) : (
                        <><Lock className="w-3.5 h-3.5 mr-1.5" /> Need {previewItem.price - (user?.eduCoins || 0)} more</>
                      )}
                    </Button>
                  ) : isEquipped(previewItem) ? (
                    <Button
                      variant="outline"
                      className="flex-1 border-primary/30 text-primary"
                      onClick={() => unequipMutation.mutate(previewItem.type)}
                      data-testid="button-unequip"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Equipped — Remove
                    </Button>
                  ) : (
                    <Button
                      className="flex-1"
                      onClick={() => equipMutation.mutate(previewItem.id)}
                      data-testid="button-equip"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Equip Now
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
