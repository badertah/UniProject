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
// Keys: primary, accent, background tweaks.
export const THEME_CSS_VARS: Record<string, Record<string, string>> = {
  cyberpunk:      { "--primary": "330 100% 55%", "--accent": "50 100% 55%", "--ring": "330 100% 55%" },
  space:          { "--primary": "210 80% 60%",  "--accent": "190 90% 60%", "--ring": "210 80% 60%" },
  "matrix-theme": { "--primary": "135 80% 50%",  "--accent": "135 70% 60%", "--ring": "135 80% 50%" },
  ocean:          { "--primary": "195 85% 50%",  "--accent": "175 80% 55%", "--ring": "195 85% 50%" },
  "fire-ice":     { "--primary": "10 90% 60%",   "--accent": "200 90% 60%", "--ring": "10 90% 60%" },
  sunset:         { "--primary": "25 90% 60%",   "--accent": "330 80% 65%", "--ring": "25 90% 60%" },
  forest:         { "--primary": "140 50% 50%",  "--accent": "85 60% 55%",  "--ring": "140 50% 50%" },
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
