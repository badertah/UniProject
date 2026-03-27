import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getRarityConfig } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShoppingBag, Coins, CheckCircle2, Lock, Star, Sparkles,
  User, Frame, Palette, ChevronRight
} from "lucide-react";

const COSMETIC_ICONS: Record<string, string> = {
  wizard: "A",
  robot: "R",
  phoenix: "P",
  dragon: "D",
  knight: "K",
  "neon-purple": "NP",
  "neon-blue": "NB",
  golden: "GL",
  matrix: "MT",
  cyberpunk: "CP",
  space: "SP",
  "matrix-theme": "MX",
  ocean: "OC",
  "fire-ice": "FI",
};

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
  cyberpunk: "from-pink-500 to-yellow-500",
  space: "from-indigo-600 to-black",
  "matrix-theme": "from-green-400 to-emerald-800",
  ocean: "from-blue-500 to-indigo-800",
  "fire-ice": "from-orange-500 to-blue-600",
};

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
    },
    onError: (err: any) => {
      toast({ title: "Purchase Failed", description: err.message, variant: "destructive" });
    },
  });

  const equipMutation = useMutation({
    mutationFn: (cosmeticId: string) => apiRequest("POST", `/api/cosmetics/equip/${cosmeticId}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cosmetics"] });
      if (data.user) updateUser(data.user);
      toast({ title: "Equipped!", description: "Item is now active on your profile" });
    },
    onError: (err: any) => {
      toast({ title: "Equip Failed", description: err.message, variant: "destructive" });
    },
  });

  const unequipMutation = useMutation({
    mutationFn: (type: string) => apiRequest("POST", "/api/cosmetics/unequip", { type }),
    onSuccess: (data) => {
      if (data.user) updateUser(data.user);
      toast({ title: "Unequipped", description: "Item removed from your profile" });
    },
  });

  function isEquipped(item: any): boolean {
    if (!user) return false;
    if (item.type === "avatar") return user.equippedAvatar === item.id;
    if (item.type === "frame") return user.equippedFrame === item.id;
    if (item.type === "theme") return user.equippedTheme === item.id;
    return false;
  }

  const filtered = cosmetics?.filter(c =>
    activeTab === "all" ? true :
    activeTab === "avatars" ? c.type === "avatar" :
    activeTab === "frames" ? c.type === "frame" :
    c.type === "theme"
  ) || [];

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
                COSM<span className="text-yellow-400">ETICS</span>
              </h1>
              <p className="text-sm text-muted-foreground">Customize your profile appearance</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="font-bold text-yellow-400 font-mono">{user?.eduCoins || 0}</span>
            <span className="text-xs text-muted-foreground">EduCoins</span>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="bg-card/60 border border-border/40">
          <TabsTrigger value="all" data-testid="tab-all">All Items</TabsTrigger>
          <TabsTrigger value="avatars" data-testid="tab-avatars">
            <User className="w-3 h-3 mr-1" /> Avatars
          </TabsTrigger>
          <TabsTrigger value="frames" data-testid="tab-frames">
            <Frame className="w-3 h-3 mr-1" /> Frames
          </TabsTrigger>
          <TabsTrigger value="themes" data-testid="tab-themes">
            <Palette className="w-3 h-3 mr-1" /> Themes
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-card/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {filtered.map((item: any, i) => {
            const rarityConfig = getRarityConfig(item.rarity);
            const owned = item.owned;
            const equipped = isEquipped(item);
            const gradient = COSMETIC_COLORS[item.icon] || "from-primary to-accent";
            const canAfford = (user?.eduCoins || 0) >= item.price;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <div
                  className={`relative rounded-xl border p-3 cursor-pointer transition-all duration-200 group ${
                    equipped
                      ? "border-primary/50 bg-primary/5"
                      : rarityConfig.glow + " border-border/40 bg-card/80 hover:border-primary/30"
                  }`}
                  onClick={() => setPreviewItem(previewItem?.id === item.id ? null : item)}
                  data-testid={`card-cosmetic-${item.id}`}
                >
                  {equipped && (
                    <div className="absolute top-2 right-2 z-10">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    </div>
                  )}

                  {/* Icon */}
                  <div
                    className={`w-full h-20 rounded-lg mb-2 flex items-center justify-center text-white text-xl font-bold bg-gradient-to-br ${gradient}`}
                  >
                    <span className="font-mono">{COSMETIC_ICONS[item.icon] || item.icon?.charAt(0)}</span>
                  </div>

                  {/* Info */}
                  <div className="space-y-1">
                    <p className="text-xs font-semibold leading-tight">{item.name}</p>
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className={`text-xs font-bold ${rarityConfig.colorClass}`}>
                        {rarityConfig.label}
                      </span>
                      {!owned && (
                        <div className="flex items-center gap-0.5">
                          <Coins className="w-3 h-3 text-yellow-400" />
                          <span className="text-xs font-mono font-bold text-yellow-400">{item.price}</span>
                        </div>
                      )}
                      {owned && (
                        <Badge variant="outline" className="text-xs px-1 py-0 border-emerald-500/40 text-emerald-400">
                          Owned
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Preview Panel */}
      <AnimatePresence>
        {previewItem && (
          <motion.div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewItem(null)}
          >
            <motion.div
              className="glass-strong rounded-2xl p-6 border border-border/40 w-full max-w-sm"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Big icon */}
              <div
                className={`w-full h-32 rounded-xl mb-4 flex items-center justify-center text-white text-4xl font-bold bg-gradient-to-br ${COSMETIC_COLORS[previewItem.icon] || "from-primary to-accent"} shadow-lg`}
              >
                <span className="font-mono">{COSMETIC_ICONS[previewItem.icon] || previewItem.icon?.charAt(0)}</span>
              </div>

              <h3 className="font-bold text-lg mb-1" style={{ fontFamily: "Oxanium, sans-serif" }}>{previewItem.name}</h3>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="capitalize text-xs">{previewItem.type}</Badge>
                <span className={`text-xs font-bold ${getRarityConfig(previewItem.rarity).colorClass}`}>
                  {getRarityConfig(previewItem.rarity).label}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{previewItem.description}</p>

              <div className="flex gap-2">
                {!previewItem.owned ? (
                  <Button
                    className="flex-1"
                    disabled={!(user?.eduCoins || 0 >= previewItem.price) || purchaseMutation.isPending}
                    onClick={() => purchaseMutation.mutate(previewItem.id)}
                    data-testid="button-purchase"
                  >
                    {purchaseMutation.isPending ? (
                      "Purchasing..."
                    ) : (user?.eduCoins || 0) >= previewItem.price ? (
                      <>
                        <Coins className="w-3 h-3 mr-1" /> Buy for {previewItem.price}
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 mr-1" /> Need {previewItem.price - (user?.eduCoins || 0)} more
                      </>
                    )}
                  </Button>
                ) : isEquipped(previewItem) ? (
                  <Button
                    variant="outline"
                    className="flex-1 border-primary/30"
                    onClick={() => {
                      unequipMutation.mutate(previewItem.type);
                      setPreviewItem(null);
                    }}
                    data-testid="button-unequip"
                  >
                    Unequip
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      equipMutation.mutate(previewItem.id);
                      setPreviewItem(null);
                    }}
                    data-testid="button-equip"
                  >
                    <Sparkles className="w-3 h-3 mr-1" /> Equip
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setPreviewItem(null)}>Close</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
