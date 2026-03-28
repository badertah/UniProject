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
};

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

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS);
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
