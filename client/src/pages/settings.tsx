import { motion } from "framer-motion";
import { useSettings, ACCENT_COLORS } from "@/hooks/use-settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Settings, Eye, RotateCcw, Flame, Coins, Zap,
  Trophy, BarChart2, Sparkles, Sprout, Play, User,
  Palette, Wind, AlignJustify, CheckCircle2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
