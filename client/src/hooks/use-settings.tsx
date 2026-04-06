import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface AppSettings {
  showStreak: boolean;
  showEduCoins: boolean;
  showXpBar: boolean;
  showUserStatsCard: boolean;
  showLeaderboardPreview: boolean;
  showStatsCards: boolean;
  showQuickPlay: boolean;
  showFarmTab: boolean;
  accentColor: string;
  reduceMotion: boolean;
  compactMode: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  showStreak: true,
  showEduCoins: true,
  showXpBar: true,
  showUserStatsCard: true,
  showLeaderboardPreview: true,
  showStatsCards: true,
  showQuickPlay: true,
  showFarmTab: true,
  accentColor: "violet",
  reduceMotion: false,
  compactMode: false,
};

export const ACCENT_COLORS: Record<string, { label: string; hsl: string; h: number; s: number; l: number; glow: string }> = {
  violet: { label: "Violet", hsl: "hsl(250,80%,65%)", h: 250, s: 80, l: 65, glow: "#7c3aed" },
  blue:   { label: "Cyber Blue", hsl: "hsl(217,90%,62%)", h: 217, s: 90, l: 62, glow: "#2563eb" },
  cyan:   { label: "Neon Cyan", hsl: "hsl(188,90%,50%)", h: 188, s: 90, l: 50, glow: "#06b6d4" },
  green:  { label: "Matrix Green", hsl: "hsl(152,80%,45%)", h: 152, s: 80, l: 45, glow: "#059669" },
  amber:  { label: "Solar Amber", hsl: "hsl(38,92%,58%)", h: 38, s: 92, l: 58, glow: "#d97706" },
  rose:   { label: "Hot Pink", hsl: "hsl(345,82%,65%)", h: 345, s: 82, l: 65, glow: "#e11d48" },
};

export function applyAccentColor(colorKey: string) {
  const c = ACCENT_COLORS[colorKey] || ACCENT_COLORS.violet;
  const root = document.documentElement;
  const val = `${c.h} ${c.s}% ${c.l}%`;
  root.style.setProperty("--primary", val);
  root.style.setProperty("--sidebar-primary", val);
  root.style.setProperty("--accent", `${c.h} ${Math.max(c.s - 20, 20)}% ${Math.min(c.l + 10, 80)}%`);
  root.style.setProperty("--ring", val);
}

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem("eduquest-settings");
      if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem("eduquest-settings", JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    applyAccentColor(settings.accentColor);
  }, [settings.accentColor]);

  useEffect(() => {
    if (settings.reduceMotion) {
      document.documentElement.style.setProperty("--animation-duration", "0ms");
      document.documentElement.classList.add("reduce-motion");
    } else {
      document.documentElement.style.removeProperty("--animation-duration");
      document.documentElement.classList.remove("reduce-motion");
    }
  }, [settings.reduceMotion]);

  useEffect(() => {
    if (settings.compactMode) {
      document.documentElement.classList.add("compact-mode");
    } else {
      document.documentElement.classList.remove("compact-mode");
    }
  }, [settings.compactMode]);

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS);
    applyAccentColor("violet");
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
