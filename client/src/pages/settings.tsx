import { motion } from "framer-motion";
import { useSettings, ACCENT_COLORS } from "@/hooks/use-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Settings, Eye, RotateCcw, Flame, Coins, Zap,
  Trophy, BarChart2, Sparkles, Sprout, Play, User,
  Palette, Wind, AlignJustify, CheckCircle2,
  Shirt, ShoppingBag, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { AVATAR_META, FRAME_META, THEME_META, THEME_IMAGE } from "@/components/cosmetics";

interface SettingToggleProps {
  label: string;
  description: string;
  icon: any;
  settingKey: string;
  value: boolean;
  onChange: (val: boolean) => void;
}

function SettingToggle({ label, description, icon: Icon, value, onChange, settingKey }: SettingToggleProps) {
  return (
    <div className="flex items-center gap-4 py-3" data-testid={`setting-${settingKey}`}>
      <div className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        data-testid={`toggle-${settingKey}`}
      />
    </div>
  );
}

const SETTING_GROUPS = [
  {
    title: "Sidebar Display",
    description: "Control what appears in the navigation sidebar",
    settings: [
      {
        key: "showUserStatsCard" as const,
        label: "User Stats Card",
        description: "Show your level, XP, and tier in the sidebar",
        icon: User,
      },
      {
        key: "showXpBar" as const,
        label: "XP Progress Bar",
        description: "Show the XP bar in the sidebar stats card",
        icon: Zap,
      },
      {
        key: "showStreak" as const,
        label: "Day Streak Counter",
        description: "Show your daily login streak",
        icon: Flame,
      },
      {
        key: "showEduCoins" as const,
        label: "EduCoins Balance",
        description: "Show your EduCoins count",
        icon: Coins,
      },
    ],
  },
  {
    title: "Dashboard Display",
    description: "Control what appears on your dashboard",
    settings: [
      {
        key: "showStatsCards" as const,
        label: "Stats Summary Cards",
        description: "Show XP, streak, coins, and score cards on the dashboard",
        icon: BarChart2,
      },
      {
        key: "showLeaderboardPreview" as const,
        label: "Top Players Preview",
        description: "Show the leaderboard preview on the dashboard",
        icon: Trophy,
      },
      {
        key: "showQuickPlay" as const,
        label: "Quick Play Card",
        description: "Show the 'Ready to Level Up?' quick play card",
        icon: Play,
      },
    ],
  },
  {
    title: "Navigation",
    description: "Toggle which pages appear in the menu",
    settings: [
      {
        key: "showFarmTab" as const,
        label: "Farm Tycoon Tab",
        description: "Show the Farm story game in navigation",
        icon: Sprout,
      },
    ],
  },
];

// === MY COSMETICS PANEL ====================================================
// Shows everything the player has bought from the shop (themes, avatars,
// frames) and lets them equip / unequip without bouncing back to the shop.
// This is what users mean when they go looking in "Settings → Theme
// Customization" for the theme they just bought — themes only really
// became visible on the dashboard / farm before, never here.
type Cosmetic = {
  id: string;
  name: string;
  type: "avatar" | "frame" | "theme";
  icon: string;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  owned?: boolean;
};

const RARITY_RING: Record<string, string> = {
  common:    "ring-slate-400/40",
  rare:      "ring-blue-400/60",
  epic:      "ring-purple-400/70",
  legendary: "ring-yellow-400/80",
};
const RARITY_LABEL: Record<string, string> = {
  common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary",
};

function CosmeticTile({
  item, equipped, onEquip, onUnequip, busy,
}: {
  item: Cosmetic;
  equipped: boolean;
  onEquip: () => void;
  onUnequip: () => void;
  busy: boolean;
}) {
  // Pull a small preview swatch / image based on cosmetic type.
  const preview = (() => {
    if (item.type === "theme") {
      const img = THEME_IMAGE[item.icon];
      const meta = THEME_META[item.icon];
      if (img) return <img src={img} alt={item.name} className="w-full h-full object-cover" />;
      if (meta) return (
        <div className="w-full h-full flex">
          {meta.swatches.map((c, i) => (
            <div key={i} className="flex-1 h-full" style={{ background: c }} />
          ))}
        </div>
      );
    }
    if (item.type === "avatar") {
      const meta = AVATAR_META[item.icon];
      if (meta) return <img src={meta.image} alt={item.name} className="w-full h-full object-cover" />;
    }
    if (item.type === "frame") {
      const meta = FRAME_META[item.icon];
      return (
        <div className={`w-full h-full ${meta?.preview ?? "bg-gradient-to-br from-slate-700 to-slate-900"} flex items-center justify-center`}>
          <div className={`w-12 h-12 rounded-full bg-background ${meta?.ring ?? ""} ${meta?.glow ?? ""}`}/>
        </div>
      );
    }
    return <div className="w-full h-full bg-muted/30"/>;
  })();

  return (
    <div
      data-testid={`cosmetic-tile-${item.id}`}
      className={`group relative rounded-xl border overflow-hidden transition-all ${
        equipped ? "border-primary/60 bg-primary/5 ring-2 ring-primary/30" : "border-border/40 bg-card/60 hover:border-border/70"
      }`}
    >
      {equipped && (
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[9px] font-bold tracking-wider shadow-md">
          <CheckCircle2 className="w-2.5 h-2.5" /> EQUIPPED
        </div>
      )}
      <div className={`absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[8px] font-bold tracking-widest text-white ring-1 ${RARITY_RING[item.rarity]}`}>
        {RARITY_LABEL[item.rarity].toUpperCase()}
      </div>
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted/20">
        {preview}
      </div>
      <div className="p-2.5 space-y-1.5">
        <p className="text-xs font-bold leading-tight truncate" title={item.name}>{item.name}</p>
        <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 min-h-[26px]">{item.description}</p>
        {equipped ? (
          <Button
            variant="outline" size="sm"
            className="w-full h-7 text-[10px] font-bold"
            onClick={onUnequip}
            disabled={busy}
            data-testid={`button-unequip-${item.id}`}
          >
            <X className="w-3 h-3 mr-1" /> Unequip
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full h-7 text-[10px] font-bold"
            onClick={onEquip}
            disabled={busy}
            data-testid={`button-equip-${item.id}`}
          >
            Equip
          </Button>
        )}
      </div>
    </div>
  );
}

function MyCosmeticsSection() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const { data: cosmetics, isLoading } = useQuery<Cosmetic[]>({ queryKey: ["/api/cosmetics"] });

  const equipMutation = useMutation({
    mutationFn: (cosmeticId: string) => apiRequest("POST", `/api/cosmetics/equip/${cosmeticId}`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cosmetics"] });
      if (data?.user) updateUser(data.user);
      toast({ title: "Equipped!", description: "Your look has been updated." });
    },
    onError: () => toast({ title: "Could not equip", variant: "destructive" }),
  });
  const unequipMutation = useMutation({
    mutationFn: (type: string) => apiRequest("POST", "/api/cosmetics/unequip", { type }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cosmetics"] });
      if (data?.user) updateUser(data.user);
      toast({ title: "Unequipped", description: "Removed from your profile." });
    },
    onError: () => toast({ title: "Could not unequip", variant: "destructive" }),
  });
  const busy = equipMutation.isPending || unequipMutation.isPending;

  const owned = (cosmetics ?? []).filter(c => c.owned);
  const ownedThemes  = owned.filter(c => c.type === "theme");
  const ownedAvatars = owned.filter(c => c.type === "avatar");
  const ownedFrames  = owned.filter(c => c.type === "frame");

  const isEquipped = (item: Cosmetic) => {
    if (!user) return false;
    if (item.type === "avatar") return user.equippedAvatar === item.id;
    if (item.type === "frame")  return user.equippedFrame  === item.id;
    if (item.type === "theme")  return user.equippedTheme  === item.id;
    return false;
  };

  // Tiny local renderer so each subgroup has identical empty / loading UX.
  const renderGroup = (
    label: string, icon: any, items: Cosmetic[], emptyHint: string, testid: string,
  ) => {
    const Icon = icon;
    return (
      <div className="py-3" data-testid={`group-${testid}`}>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-sm font-medium flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            {label}
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
              {items.length}
            </span>
          </p>
        </div>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/40 bg-muted/10 px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground mb-2">{emptyHint}</p>
            <Link href="/shop">
              <Button variant="outline" size="sm" className="text-[10px] h-7" data-testid={`button-shop-${testid}`}>
                <ShoppingBag className="w-3 h-3 mr-1" /> Browse Shop
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {items.map(item => (
              <CosmeticTile
                key={item.id}
                item={item}
                equipped={isEquipped(item)}
                onEquip={() => equipMutation.mutate(item.id)}
                onUnequip={() => unequipMutation.mutate(item.type)}
                busy={busy}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono flex items-center gap-2">
          <Shirt className="w-4 h-4" /> MY COSMETICS
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Equip the themes, avatars, and frames you've collected from the shop.
        </p>
      </CardHeader>
      <CardContent className="pt-0 divide-y divide-border/30">
        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">Loading your collection…</div>
        ) : (
          <>
            {renderGroup("Themes", Palette, ownedThemes,  "No themes yet — themes repaint the whole app and farm.", "themes")}
            {renderGroup("Avatars", User, ownedAvatars, "No avatars yet — show off who you are.",          "avatars")}
            {renderGroup("Frames", Sparkles, ownedFrames, "No frames yet — frames glow around your avatar.", "frames")}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { toast } = useToast();

  function handleReset() {
    resetSettings();
    toast({
      title: "Settings reset",
      description: "All display settings have been restored to defaults.",
    });
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider" style={{ fontFamily: "Oxanium, sans-serif" }}>
              DISPLAY <span className="text-primary">SETTINGS</span>
            </h1>
            <p className="text-sm text-muted-foreground">Customize your experience across the platform</p>
          </div>
        </div>
      </motion.div>

      <div className="space-y-4">

        {/* ── MY COSMETICS (themes/avatars/frames bought from shop) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
        >
          <MyCosmeticsSection />
        </motion.div>

        {/* ── THEME CUSTOMIZATION ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono flex items-center gap-2">
                <Palette className="w-4 h-4" /> THEME CUSTOMIZATION
              </CardTitle>
              <p className="text-xs text-muted-foreground">Choose your accent color to personalize the interface</p>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Accent color swatches */}
              <div className="py-3">
                <p className="text-sm font-medium mb-3">Accent Color</p>
                <div className="grid grid-cols-3 gap-2.5" data-testid="accent-color-picker">
                  {Object.entries(ACCENT_COLORS).map(([key, color]) => {
                    const isActive = settings.accentColor === key;
                    return (
                      <button
                        key={key}
                        onClick={() => updateSetting("accentColor", key)}
                        data-testid={`color-${key}`}
                        className={`relative flex items-center gap-2.5 p-3 rounded-xl border text-sm font-medium transition-all ${
                          isActive
                            ? "border-white/40 bg-white/10"
                            : "border-border/40 bg-muted/20 hover:border-border/70 hover:bg-muted/40"
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-offset-2 ring-offset-background"
                          style={{
                            background: color.hsl,
                            boxShadow: isActive ? `0 0 12px ${color.glow}88` : undefined,
                            "--tw-ring-color": isActive ? color.glow : "transparent",
                          } as React.CSSProperties}
                        />
                        <span className="text-xs leading-tight">{color.label}</span>
                        {isActive && (
                          <CheckCircle2
                            className="w-3.5 h-3.5 absolute top-1.5 right-1.5"
                            style={{ color: color.glow }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator className="my-1 bg-border/30" />

              {/* Reduce Motion */}
              <SettingToggle
                label="Reduce Motion"
                description="Minimize animations and transitions throughout the app"
                icon={Wind}
                settingKey="reduceMotion"
                value={settings.reduceMotion}
                onChange={(val) => updateSetting("reduceMotion", val)}
              />

              <Separator className="my-0 bg-border/30" />

              {/* Compact Mode */}
              <SettingToggle
                label="Compact Mode"
                description="Tighter spacing and smaller padding throughout the interface"
                icon={AlignJustify}
                settingKey="compactMode"
                value={settings.compactMode}
                onChange={(val) => updateSetting("compactMode", val)}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* ── EXISTING DISPLAY GROUPS ── */}
        {SETTING_GROUPS.map((group, gi) => (
          <motion.div
            key={group.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + gi * 0.08 }}
          >
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold tracking-widest text-muted-foreground font-mono flex items-center gap-2">
                  <Eye className="w-4 h-4" /> {group.title.toUpperCase()}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{group.description}</p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-border/30">
                  {group.settings.map((setting, si) => (
                    <SettingToggle
                      key={setting.key}
                      label={setting.label}
                      description={setting.description}
                      icon={setting.icon}
                      settingKey={setting.key}
                      value={settings[setting.key]}
                      onChange={(val) => updateSetting(setting.key, val)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Reset */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + SETTING_GROUPS.length * 0.08 }}
        >
          <Card className="border-border/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Reset All Settings</p>
                  <p className="text-xs text-muted-foreground">Restore all display options and theme to defaults</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="text-xs"
                  data-testid="button-reset-settings"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
