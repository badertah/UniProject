import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface TierInfo {
  name: string;
  colorClass: string;
  bgClass: string;
  minXp: number;
  maxXp: number;
  gradient: string;
}

const TIERS: TierInfo[] = [
  { name: "Rookie", colorClass: "tier-rookie", bgClass: "tier-bg-rookie", minXp: 0, maxXp: 499, gradient: "from-slate-500 to-slate-600" },
  { name: "Scholar", colorClass: "tier-scholar", bgClass: "tier-bg-scholar", minXp: 500, maxXp: 1499, gradient: "from-blue-600 to-blue-700" },
  { name: "Expert", colorClass: "tier-expert", bgClass: "tier-bg-expert", minXp: 1500, maxXp: 3499, gradient: "from-violet-600 to-purple-700" },
  { name: "Master", colorClass: "tier-master", bgClass: "tier-bg-master", minXp: 3500, maxXp: 6999, gradient: "from-amber-600 to-yellow-600" },
  { name: "Legend", colorClass: "tier-legend", bgClass: "tier-bg-legend", minXp: 7000, maxXp: Infinity, gradient: "from-rose-600 to-red-700" },
];

export function getTierInfo(xp: number): TierInfo {
  return TIERS.slice().reverse().find(t => xp >= t.minXp) || TIERS[0];
}

export function getXpToNextLevel(xp: number) {
  const level = Math.floor(xp / 150) + 1;
  const levelXp = (level - 1) * 150;
  const nextLevelXp = level * 150;
  const current = xp - levelXp;
  const required = nextLevelXp - levelXp;
  const percent = Math.min(100, Math.round((current / required) * 100));
  return { current, required, percent, level };
}

export function formatXp(xp: number): string {
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}k`;
  return xp.toString();
}

const DIFFICULTY_CONFIG = {
  easy: { label: "Easy", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  medium: { label: "Medium", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  hard: { label: "Hard", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
};

export function getDifficultyConfig(difficulty: string) {
  return DIFFICULTY_CONFIG[difficulty as keyof typeof DIFFICULTY_CONFIG] || DIFFICULTY_CONFIG.easy;
}

const GAME_TYPE_CONFIG = {
  // New play-to-learn SAD games
  sdlc_sorter:      { label: "Phase Runner",         icon: "Zap",        color: "text-violet-300",  description: "Run through SDLC phases — collect deliverables, dodge bugs!" },
  req_sorter:       { label: "Requirement Hunter",   icon: "Target",     color: "text-emerald-300", description: "Find hidden requirements, then sort them in a falling frenzy" },
  usecase_builder:  { label: "Use Case Defense",     icon: "Shield",     color: "text-cyan-300",    description: "Place actor towers to stop system failures" },
  erd_doctor:       { label: "ER City Builder",      icon: "Database",   color: "text-amber-300",   description: "Build roads between entities — watch the traffic flow" },
  dfd_detective:    { label: "Data Flow Plumber",    icon: "Activity",   color: "text-pink-300",    description: "Connect pipes so data flows from source to sink" },
  sequence_stacker: { label: "Sequence Rhythm",      icon: "Timer",      color: "text-indigo-300",  description: "Hit falling message arrows in time — build the sequence diagram" },
  // Legacy quiz games (kept for back-compat with any old levels)
  wordle: { label: "Word Guesser", icon: "Hash", color: "text-violet-400", description: "Guess the 5-letter keyword" },
  matcher: { label: "Definition Matcher", icon: "Link2", color: "text-cyan-400", description: "Match terms to definitions" },
  emoji_cipher: { label: "Emoji Cipher", icon: "Smile", color: "text-amber-400", description: "Decode concept from clues" },
  speed_blitz: { label: "Speed Blitz", icon: "Zap", color: "text-rose-400", description: "Answer fast — beat the clock!" },
  bubble_pop: { label: "Bubble Pop", icon: "Gamepad2", color: "text-cyan-400", description: "Pop the right bubble before it escapes!" },
  memory_flip: { label: "Memory Flip", icon: "Star", color: "text-purple-400", description: "Flip cards and match every pair!" },
};

export function getGameTypeConfig(gameType: string) {
  return GAME_TYPE_CONFIG[gameType as keyof typeof GAME_TYPE_CONFIG] || GAME_TYPE_CONFIG.wordle;
}

const ICON_MAP: Record<string, string> = {
  wizard: "A",
  robot: "R",
  phoenix: "P",
  dragon: "D",
  knight: "K",
};

export function getAvatarDisplay(icon: string): string {
  return ICON_MAP[icon] || icon.charAt(0).toUpperCase();
}

const RARITY_CONFIG = {
  common: { label: "Common", colorClass: "rarity-common", bg: "bg-slate-500/10 border-slate-500/20", glow: "" },
  rare: { label: "Rare", colorClass: "rarity-rare", bg: "bg-blue-500/10 border-blue-500/20", glow: "shadow-[0_0_15px_rgba(96,165,250,0.2)]" },
  epic: { label: "Epic", colorClass: "rarity-epic", bg: "bg-violet-500/10 border-violet-500/20", glow: "shadow-[0_0_15px_rgba(167,139,250,0.3)]" },
  legendary: { label: "Legendary", colorClass: "rarity-legendary", bg: "bg-amber-500/10 border-amber-500/20", glow: "shadow-[0_0_20px_rgba(245,158,11,0.3)]" },
};

export function getRarityConfig(rarity: string) {
  return RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG] || RARITY_CONFIG.common;
}
