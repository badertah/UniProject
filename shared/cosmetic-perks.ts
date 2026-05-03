// Single source of truth for cosmetic gameplay perks.
// Both client (for shop "Why buy?" copy + theme tinting) and server
// (for farm-harvest multiplier + minigame XP boost) import this.
//
// Perks are keyed by the cosmetic's `icon` field (deterministic across
// reseeds), not by uuid — keeps the table portable.

export type CosmeticPerks = {
  xpMult: number;       // multiplier on minigame/level XP awards
  farmMult: number;     // multiplier on /api/farm/harvest coinsAdded
  coinMult: number;     // multiplier on minigame coin awards
  description: string;  // shown on shop card
};

const ZERO: CosmeticPerks = { xpMult: 1, farmMult: 1, coinMult: 1, description: "" };

// Avatars: signature character bonuses (wear ONE)
export const AVATAR_PERKS: Record<string, CosmeticPerks> = {
  wizard:  { xpMult: 1.05, farmMult: 1,    coinMult: 1,    description: "+5% XP from every minigame" },
  robot:   { xpMult: 1,    farmMult: 1,    coinMult: 1.05, description: "+5% coins from minigames" },
  phoenix: { xpMult: 1.10, farmMult: 1,    coinMult: 1,    description: "+10% XP — rise from every defeat" },
  dragon:  { xpMult: 1,    farmMult: 1.10, coinMult: 1,    description: "+10% farm harvest income" },
  knight:  { xpMult: 1.03, farmMult: 1,    coinMult: 1.03, description: "+3% XP and +3% coins" },
  sage:    { xpMult: 1.15, farmMult: 1,    coinMult: 1,    description: "+15% XP from every minigame" },
  tycoon:  { xpMult: 1,    farmMult: 1.20, coinMult: 1,    description: "+20% farm harvest — built for empire" },
};

// Frames: passive yield bonuses on top of avatar
export const FRAME_PERKS: Record<string, CosmeticPerks> = {
  "neon-purple": { xpMult: 1.02, farmMult: 1,    coinMult: 1,    description: "+2% XP — neon focus aura" },
  "neon-blue":   { xpMult: 1,    farmMult: 1,    coinMult: 1.02, description: "+2% coins — electric edge" },
  golden:        { xpMult: 1.05, farmMult: 1.05, coinMult: 1.05, description: "+5% to ALL rewards (XP, coins, farm)" },
  matrix:        { xpMult: 1.04, farmMult: 1,    coinMult: 1,    description: "+4% XP — cascade of insight" },
  sunrise:       { xpMult: 1.06, farmMult: 1,    coinMult: 1,    description: "+6% XP — daybreak focus" },
  aurora:        { xpMult: 1,    farmMult: 1.10, coinMult: 1,    description: "+10% farm income — northern lights blessing" },
};

// Themes: visual only — no stat multiplier, but rewrite the farm sky.
// (Shop still markets the visual change as the buy reason.)
export const THEME_PERKS: Record<string, CosmeticPerks> = {
  cyberpunk:      { ...ZERO, description: "Recolours sky + accents app-wide in neon pink/yellow" },
  space:          { ...ZERO, description: "Deep blue starlit theme across the app + farm sky" },
  "matrix-theme": { ...ZERO, description: "Classic green-on-black hacker aesthetic everywhere" },
  ocean:          { ...ZERO, description: "Cool teal/cyan palette + bioluminescent farm sky" },
  "fire-ice":     { ...ZERO, description: "Dual fire/ice palette + dramatic sky gradient" },
  sunset:         { ...ZERO, description: "Warm gold/magenta sunset palette + golden farm sky" },
  forest:         { ...ZERO, description: "Mossy green forest palette + misty farm air" },
};

// Combine equipped items into a single multiplier (server uses this).
export function combinePerks(avatarIcon?: string | null, frameIcon?: string | null, themeIcon?: string | null): CosmeticPerks {
  const a = (avatarIcon && AVATAR_PERKS[avatarIcon]) || ZERO;
  const f = (frameIcon  && FRAME_PERKS[frameIcon])   || ZERO;
  const t = (themeIcon  && THEME_PERKS[themeIcon])   || ZERO;
  return {
    xpMult:   (a.xpMult   || 1) * (f.xpMult   || 1) * (t.xpMult   || 1),
    farmMult: (a.farmMult || 1) * (f.farmMult || 1) * (t.farmMult || 1),
    coinMult: (a.coinMult || 1) * (f.coinMult || 1) * (t.coinMult || 1),
    description: [a.description, f.description, t.description].filter(Boolean).join(" · "),
  };
}

// HSL CSS variables (H S% L%) for each theme — applied at <html> level.
// Themes now retint the WHOLE backdrop (background, card, sidebar, popover,
// muted, border) toward the theme's hue, not just the primary/accent. Each
// palette stays dark enough to keep text readable, but the page is no
// longer the same generic dark blue under every theme.
export const THEME_CSS_VARS: Record<string, Record<string, string>> = {
  cyberpunk: {
    "--primary": "330 100% 55%", "--accent": "50 100% 55%",  "--ring": "330 100% 55%",
    "--background": "300 60% 6%",  "--card": "300 50% 10%",   "--card-border": "320 60% 22%",
    "--sidebar": "300 55% 8%",     "--sidebar-border": "320 60% 18%",
    "--sidebar-accent": "320 60% 16%", "--sidebar-primary": "330 100% 55%", "--sidebar-ring": "330 100% 55%",
    "--popover": "300 55% 9%",     "--popover-border": "320 60% 22%",
    "--secondary": "320 50% 16%",  "--muted": "300 40% 13%",  "--border": "320 50% 22%", "--input": "320 50% 22%",
  },
  space: {
    "--primary": "210 80% 60%",   "--accent": "190 90% 60%",  "--ring": "210 80% 60%",
    "--background": "220 60% 6%", "--card": "220 50% 10%",   "--card-border": "215 50% 24%",
    "--sidebar": "220 55% 8%",    "--sidebar-border": "220 45% 18%",
    "--sidebar-accent": "215 45% 16%", "--sidebar-primary": "210 80% 60%", "--sidebar-ring": "210 80% 60%",
    "--popover": "220 55% 9%",    "--popover-border": "215 50% 24%",
    "--secondary": "215 45% 16%", "--muted": "220 40% 13%",  "--border": "215 45% 22%", "--input": "215 45% 22%",
  },
  "matrix-theme": {
    "--primary": "135 80% 50%",   "--accent": "135 70% 60%",  "--ring": "135 80% 50%",
    "--background": "135 60% 4%", "--card": "135 50% 8%",    "--card-border": "135 60% 22%",
    "--sidebar": "135 55% 6%",    "--sidebar-border": "135 50% 16%",
    "--sidebar-accent": "135 45% 14%", "--sidebar-primary": "135 80% 50%", "--sidebar-ring": "135 80% 50%",
    "--popover": "135 55% 7%",    "--popover-border": "135 60% 22%",
    "--secondary": "135 40% 14%", "--muted": "135 35% 11%",  "--border": "135 50% 20%", "--input": "135 50% 20%",
  },
  ocean: {
    "--primary": "195 85% 50%",   "--accent": "175 80% 55%",  "--ring": "195 85% 50%",
    "--background": "200 70% 6%", "--card": "200 55% 10%",   "--card-border": "195 60% 24%",
    "--sidebar": "200 60% 8%",    "--sidebar-border": "195 55% 18%",
    "--sidebar-accent": "195 50% 16%", "--sidebar-primary": "195 85% 50%", "--sidebar-ring": "195 85% 50%",
    "--popover": "200 60% 9%",    "--popover-border": "195 60% 24%",
    "--secondary": "195 50% 16%", "--muted": "200 45% 13%",  "--border": "195 50% 22%", "--input": "195 50% 22%",
  },
  "fire-ice": {
    "--primary": "10 90% 60%",    "--accent": "200 90% 60%",  "--ring": "10 90% 60%",
    "--background": "260 40% 6%", "--card": "260 35% 10%",   "--card-border": "10 60% 24%",
    "--sidebar": "260 35% 8%",    "--sidebar-border": "10 50% 20%",
    "--sidebar-accent": "10 45% 16%", "--sidebar-primary": "10 90% 60%", "--sidebar-ring": "10 90% 60%",
    "--popover": "260 35% 9%",    "--popover-border": "10 50% 24%",
    "--secondary": "10 40% 16%",  "--muted": "260 30% 13%",  "--border": "10 45% 22%", "--input": "10 45% 22%",
  },
  sunset: {
    "--primary": "25 90% 60%",    "--accent": "330 80% 65%",  "--ring": "25 90% 60%",
    "--background": "20 50% 6%",  "--card": "20 45% 10%",    "--card-border": "25 60% 24%",
    "--sidebar": "20 45% 8%",     "--sidebar-border": "25 55% 18%",
    "--sidebar-accent": "25 50% 16%", "--sidebar-primary": "25 90% 60%", "--sidebar-ring": "25 90% 60%",
    "--popover": "20 45% 9%",     "--popover-border": "25 60% 24%",
    "--secondary": "25 50% 16%",  "--muted": "20 40% 13%",   "--border": "25 50% 22%", "--input": "25 50% 22%",
  },
  forest: {
    "--primary": "140 50% 50%",   "--accent": "85 60% 55%",   "--ring": "140 50% 50%",
    "--background": "140 45% 5%", "--card": "140 40% 9%",    "--card-border": "140 45% 22%",
    "--sidebar": "140 40% 7%",    "--sidebar-border": "140 40% 16%",
    "--sidebar-accent": "140 35% 14%", "--sidebar-primary": "140 50% 50%", "--sidebar-ring": "140 50% 50%",
    "--popover": "140 40% 8%",    "--popover-border": "140 45% 22%",
    "--secondary": "140 35% 14%", "--muted": "140 30% 11%",  "--border": "140 40% 20%", "--input": "140 40% 20%",
  },
};

// Sky-colour overrides for the farm scene per theme (4 stops, 0..1 in time of day)
export const THEME_FARM_SKY_TINT: Record<string, string> = {
  cyberpunk:      "linear-gradient(180deg, #1a0033 0%, #4d0066 40%, #ff006e 100%)",
  space:          "linear-gradient(180deg, #03002e 0%, #0d1b2a 50%, #1b4965 100%)",
  "matrix-theme": "linear-gradient(180deg, #001a00 0%, #003300 50%, #00661f 100%)",
  ocean:          "linear-gradient(180deg, #001a33 0%, #003d66 50%, #00b4d8 100%)",
  "fire-ice":     "linear-gradient(180deg, #1a0500 0%, #ef233c 50%, #4cc9f0 100%)",
  sunset:         "linear-gradient(180deg, #2d0a3a 0%, #ff6b35 50%, #ffd166 100%)",
  forest:         "linear-gradient(180deg, #0d2818 0%, #1f4d2c 50%, #6fa472 100%)",
};
