// Centralised cosmetic visual library + UserAvatar component.
// Used everywhere a user appears (sidebar, dashboard, leaderboard, profile,
// farm HUD) so equipped cosmetics show up GLOBALLY, not just in profile.

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { THEME_CSS_VARS } from "@shared/cosmetic-perks";
// AI-generated avatar portraits — bundled via Vite @assets alias so they
// hash + ship with the build. Replaces the previous emoji-only avatars.
import avatarWizard  from "@assets/generated_images/avatar_wizard.png";
import avatarRobot   from "@assets/generated_images/avatar_robot.png";
import avatarPhoenix from "@assets/generated_images/avatar_phoenix.png";
import avatarDragon  from "@assets/generated_images/avatar_dragon.png";
import avatarKnight  from "@assets/generated_images/avatar_knight.png";
import avatarSage    from "@assets/generated_images/avatar_sage.png";
import avatarTycoon  from "@assets/generated_images/avatar_tycoon.png";
// AI-generated theme key art used by shop previews.
import themeCyberpunk from "@assets/generated_images/theme_cyberpunk.png";
import themeSpace     from "@assets/generated_images/theme_space.png";
import themeMatrix    from "@assets/generated_images/theme_matrix.png";
import themeOcean     from "@assets/generated_images/theme_ocean.png";
import themeFireIce   from "@assets/generated_images/theme_fireice.png";
import themeSunset    from "@assets/generated_images/theme_sunset.png";
import themeForest    from "@assets/generated_images/theme_forest.png";

// --- Visual metadata, mirrored from shop.tsx so anywhere can render the
// equipped cosmetic without re-fetching /api/cosmetics. Keys are the
// cosmetic.icon field — same as the seed.
//
// `image` is the AI portrait used as the primary visual; `emoji` stays
// as a tiny fallback (e.g. for tooltip text or other-player rows on the
// leaderboard where we don't yet load remote avatars).

export const AVATAR_META: Record<string, { emoji: string; gradient: string; aura: string; image: string }> = {
  wizard:  { emoji: "🧙", gradient: "from-violet-600 via-purple-700 to-indigo-900", aura: "shadow-violet-500/40", image: avatarWizard },
  robot:   { emoji: "🤖", gradient: "from-cyan-500 via-blue-600 to-slate-800",      aura: "shadow-cyan-500/40",   image: avatarRobot },
  phoenix: { emoji: "🦅", gradient: "from-orange-500 via-red-600 to-rose-900",      aura: "shadow-orange-500/40", image: avatarPhoenix },
  dragon:  { emoji: "🐲", gradient: "from-emerald-500 via-teal-600 to-green-900",   aura: "shadow-emerald-500/40", image: avatarDragon },
  knight:  { emoji: "⚔️", gradient: "from-slate-400 via-slate-600 to-slate-900",    aura: "shadow-slate-500/30",  image: avatarKnight },
  sage:    { emoji: "📜", gradient: "from-amber-400 via-orange-500 to-red-700",     aura: "shadow-amber-400/40",  image: avatarSage },
  tycoon:  { emoji: "💼", gradient: "from-yellow-500 via-amber-600 to-yellow-900",  aura: "shadow-yellow-400/50", image: avatarTycoon },
};

// Theme key-art images for shop preview cards. Used by ThemePreview in
// shop.tsx — the in-app theming itself still uses CSS vars from
// THEME_CSS_VARS; these are visual previews only.
export const THEME_IMAGE: Record<string, string> = {
  cyberpunk:      themeCyberpunk,
  space:          themeSpace,
  "matrix-theme": themeMatrix,
  ocean:          themeOcean,
  "fire-ice":     themeFireIce,
  sunset:         themeSunset,
  forest:         themeForest,
};

export const FRAME_META: Record<string, { ring: string; glow: string; label: string; preview: string }> = {
  "neon-purple": { ring: "ring-2 ring-violet-400",   glow: "shadow-lg shadow-violet-500/50",  label: "Neon Purple",   preview: "bg-gradient-to-br from-violet-900/60 to-purple-950" },
  "neon-blue":   { ring: "ring-2 ring-blue-400",     glow: "shadow-lg shadow-blue-500/50",    label: "Electric Blue", preview: "bg-gradient-to-br from-blue-900/60 to-cyan-950" },
  golden:        { ring: "ring-2 ring-yellow-400",   glow: "shadow-lg shadow-yellow-500/60",  label: "Golden Legend", preview: "bg-gradient-to-br from-yellow-900/60 to-amber-950" },
  matrix:        { ring: "ring-2 ring-emerald-400",  glow: "shadow-lg shadow-emerald-500/50", label: "Matrix",        preview: "bg-gradient-to-br from-emerald-900/60 to-green-950" },
  sunrise:       { ring: "ring-2 ring-orange-400",   glow: "shadow-lg shadow-orange-500/50",  label: "Sunrise",       preview: "bg-gradient-to-br from-orange-900/60 to-amber-950" },
  aurora:        { ring: "ring-2 ring-cyan-300",     glow: "shadow-lg shadow-cyan-300/60",    label: "Aurora",        preview: "bg-gradient-to-br from-cyan-900/60 to-emerald-950" },
};

export const THEME_META: Record<string, { swatches: string[]; label: string }> = {
  cyberpunk:      { swatches: ["#ff006e", "#ffd60a", "#7209b7", "#111111"], label: "Cyberpunk" },
  space:          { swatches: ["#0d1b2a", "#1b4965", "#bee3f8", "#00d4ff"], label: "Deep Space" },
  "matrix-theme": { swatches: ["#0d0d0d", "#00ff41", "#39d353", "#1a1a1a"], label: "Matrix Green" },
  ocean:          { swatches: ["#0077b6", "#00b4d8", "#90e0ef", "#03045e"], label: "Ocean Depths" },
  "fire-ice":     { swatches: ["#ef233c", "#4cc9f0", "#f72585", "#4361ee"], label: "Fire & Ice" },
  sunset:         { swatches: ["#ff6b35", "#f7c59f", "#efefd0", "#2d0a3a"], label: "Sunset Glow" },
  forest:         { swatches: ["#1f4d2c", "#6fa472", "#a8c3a0", "#0d2818"], label: "Forest Mist" },
};

// --- React components ----------------------------------------------------

const SIZE_PX: Record<string, { box: number; emoji: number; ring: number }> = {
  xs: { box: 24, emoji: 14, ring: 1.5 },
  sm: { box: 32, emoji: 18, ring: 2 },
  md: { box: 40, emoji: 22, ring: 2 },
  lg: { box: 56, emoji: 30, ring: 2.5 },
  xl: { box: 80, emoji: 44, ring: 3 },
};

type AvatarUserShape = {
  username: string;
  equippedAvatar?: string | null;
  equippedFrame?: string | null;
};

// Renders a user's equipped avatar (emoji + gradient) wrapped in their
// equipped frame's glowing ring. Falls back to first-letter+tier-bg
// gradient if no avatar is equipped. Works for ANY user (the player or
// other players on the leaderboard) — pass overrides as needed.
export function UserAvatar({
  user, size = "md", fallbackBg, className = "", forceEmoji,
}: {
  user: AvatarUserShape | null | undefined;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  fallbackBg?: string; // tailwind classes for letter avatars (e.g. tier bg)
  className?: string;
  forceEmoji?: string; // used by leaderboard rows for other players (we don't have their cosmetics yet)
}) {
  const dims = SIZE_PX[size];
  const cosmetics = useResolvedCosmetics();
  const avatarItem = user?.equippedAvatar ? cosmetics.byId[user.equippedAvatar] : null;
  const frameItem  = user?.equippedFrame  ? cosmetics.byId[user.equippedFrame]  : null;
  const avatarMeta = avatarItem ? AVATAR_META[avatarItem.icon] : null;
  const frameMeta  = frameItem  ? FRAME_META[frameItem.icon]   : null;

  const showEmoji = forceEmoji || avatarMeta?.emoji;
  const gradientCls = avatarMeta
    ? `bg-gradient-to-br ${avatarMeta.gradient} ${avatarMeta.aura} shadow-lg`
    : (fallbackBg || "bg-gradient-to-br from-primary to-accent");

  const ringCls = frameMeta ? `${frameMeta.ring} ${frameMeta.glow}` : "";

  return (
    <div
      className={`relative rounded-xl overflow-hidden flex items-center justify-center text-white font-bold flex-shrink-0 ${gradientCls} ${ringCls} ${className}`}
      style={{ width: dims.box, height: dims.box, fontSize: dims.emoji }}
      data-testid="user-avatar"
    >
      {/* Prefer the AI portrait when this user has one of OUR avatars
          equipped (we know the icon -> image mapping). Otherwise fall
          back to the emoji (forced from the leaderboard for other
          players) or the username initial. */}
      {avatarMeta?.image && !forceEmoji ? (
        <img
          src={avatarMeta.image}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : showEmoji ? (
        <span style={{ fontSize: Math.round(dims.emoji * 1.2), filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))" }}>
          {showEmoji}
        </span>
      ) : (
        <span>{user?.username?.charAt(0)?.toUpperCase() || "?"}</span>
      )}
      {/* Subtle inner gloss */}
      {avatarMeta && (
        <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.18), transparent 45%)" }} />
      )}
    </div>
  );
}

// --- Theme applier — writes equipped theme's CSS vars onto :root ---------

export function ThemeApplier() {
  const { user } = useAuth();
  const cosmetics = useResolvedCosmetics();
  const themeItem = user?.equippedTheme ? cosmetics.byId[user.equippedTheme] : null;
  const themeIcon = themeItem?.icon as string | undefined;

  useEffect(() => {
    const root = document.documentElement;
    const vars = themeIcon ? THEME_CSS_VARS[themeIcon] : null;
    // Track which keys we set so we can roll them back when the user
    // unequips or switches themes.
    const applied: string[] = [];
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        root.style.setProperty(k, v);
        applied.push(k);
      }
      root.dataset.cosmeticTheme = themeIcon!;
    } else {
      delete root.dataset.cosmeticTheme;
    }
    return () => {
      for (const k of applied) root.style.removeProperty(k);
    };
  }, [themeIcon]);

  return null;
}

// --- Internal: resolve cosmetic ids -> {icon, type} via the existing /api/cosmetics endpoint
// (cached by react-query — same key the shop already populates).
function useResolvedCosmetics() {
  const { user } = useAuth();
  const { data } = useQuery<any[]>({
    queryKey: ["/api/cosmetics"],
    enabled: !!user, // skip on auth page
  });
  const byId: Record<string, { id: string; icon: string; type: string; name: string }> = {};
  for (const c of data || []) byId[c.id] = c;
  return { byId };
}
