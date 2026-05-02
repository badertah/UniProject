import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, Sparkles, BookOpen, Tractor, ShoppingBag, Trophy,
  ChevronRight, ChevronLeft, X, Zap, Coins, Award, Flame, Play,
} from "lucide-react";

export const TUTORIAL_LS_KEY = (uid: string) => `iku_tutorial_seen_v1_${uid}`;

interface Slide {
  badge: string;
  title: string;
  body: string;
  highlights?: { icon: any; label: string; color: string }[];
  art: () => JSX.Element;
}

const SLIDES: Slide[] = [
  {
    badge: "Chapter 01",
    title: "Welcome to IKU Academy",
    body:
      "You just enrolled in the most prestigious System Analysis & Design program in the realm. Your mission: rise from a curious Rookie to a legendary Architect by mastering the craft of building software systems.",
    highlights: [
      { icon: GraduationCap, label: "Learn", color: "text-cyan-400" },
      { icon: Play, label: "Play", color: "text-purple-400" },
      { icon: Trophy, label: "Level Up", color: "text-yellow-400" },
    ],
    art: () => (
      <div className="relative w-full h-44 flex items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(139,92,246,0.35) 0%, transparent 65%)",
          }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
        <motion.div
          className="relative w-24 h-24 rounded-2xl flex items-center justify-center text-4xl text-white"
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)",
            boxShadow:
              "0 0 60px rgba(124,58,237,0.55), inset 0 1px 0 rgba(255,255,255,0.4)",
          }}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        >
          <GraduationCap className="w-12 h-12" />
        </motion.div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-purple-300"
            style={{
              left: `${50 + Math.cos((i * Math.PI * 2) / 6) * 38}%`,
              top: `${50 + Math.sin((i * Math.PI * 2) / 6) * 38}%`,
            }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.4, 0.8] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </div>
    ),
  },
  {
    badge: "Chapter 02",
    title: "Take on Quests in Mini-Games",
    body:
      "Every concept is a quest. Sort SDLC phases, chase falling rhythm tiles, defend use cases, build ER cities, and route data through plumbers — six unique mini-games turn dry theory into instinct.",
    highlights: [
      { icon: Zap, label: "+ XP", color: "text-primary" },
      { icon: Coins, label: "+ EduCoins", color: "text-yellow-400" },
      { icon: Award, label: "Badges", color: "text-emerald-400" },
    ],
    art: () => (
      <div className="relative w-full h-44 grid grid-cols-3 gap-2 px-4">
        {[
          { c: "#a78bfa", e: "🧩" },
          { c: "#22d3ee", e: "🎵" },
          { c: "#fbbf24", e: "🛡️" },
          { c: "#f472b6", e: "🏙️" },
          { c: "#34d399", e: "💧" },
          { c: "#60a5fa", e: "📊" },
        ].map((tile, i) => (
          <motion.div
            key={i}
            className="rounded-lg flex items-center justify-center text-2xl border-2"
            style={{
              background: `linear-gradient(180deg, ${tile.c}DD 0%, ${tile.c}AA 100%)`,
              borderColor: tile.c,
              boxShadow: `0 4px 14px ${tile.c}66, inset 0 1px 0 rgba(255,255,255,0.35)`,
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
          >
            {tile.e}
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    badge: "Chapter 03",
    title: "Grow your Knowledge Farm",
    body:
      "Every great architect needs a workshop. Plant Wheat Fields, raise Chickens, run Tractors, and build Mills — your farm is a living Data Flow Diagram that earns EduCoins while you study.",
    highlights: [
      { icon: Tractor, label: "Auto-Earn", color: "text-amber-400" },
      { icon: Coins, label: "Idle Coins", color: "text-yellow-400" },
      { icon: Sparkles, label: "Visual DFD", color: "text-cyan-400" },
    ],
    art: () => (
      <div className="relative w-full h-44 rounded-xl overflow-hidden border border-emerald-500/30"
        style={{ background: "linear-gradient(180deg, #1a3a2a 0%, #0f2a1f 100%)" }}>
        <div className="absolute inset-0 grid grid-cols-4 gap-3 p-4">
          {["🌾", "🐔", "🚜", "🌽"].map((e, i) => (
            <motion.div
              key={i}
              className="rounded-lg flex items-center justify-center text-3xl bg-emerald-900/50 border border-emerald-500/30"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
            >
              {e}
            </motion.div>
          ))}
        </div>
        <motion.div
          className="absolute bottom-2 left-0 text-2xl"
          animate={{ x: ["-10%", "110%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          🚛
        </motion.div>
      </div>
    ),
  },
  {
    badge: "Chapter 04",
    title: "Customize, Collect, Compete",
    body:
      "Spend your EduCoins in the Shop on rare avatars, frames, and themes. Unlock badges as you climb the ranks. Then bring your name to the Leaderboard and claim your throne.",
    highlights: [
      { icon: ShoppingBag, label: "Shop", color: "text-pink-400" },
      { icon: Award, label: "Badges", color: "text-emerald-400" },
      { icon: Trophy, label: "Leaderboard", color: "text-yellow-400" },
    ],
    art: () => (
      <div className="relative w-full h-44 flex items-center justify-center gap-3">
        {[
          { c: "from-amber-500 to-yellow-600", e: "👑", l: "Legend" },
          { c: "from-violet-500 to-purple-700", e: "🛡️", l: "Master" },
          { c: "from-cyan-500 to-blue-700", e: "⚔️", l: "Expert" },
        ].map((tier, i) => (
          <motion.div
            key={i}
            className="flex flex-col items-center"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.15 }}
          >
            <div
              className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tier.c} flex items-center justify-center text-3xl`}
              style={{ boxShadow: "0 6px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)" }}
            >
              {tier.e}
            </div>
            <span className="text-xs text-white/80 font-bold mt-2">{tier.l}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    badge: "Chapter 05",
    title: "Your first mission awaits",
    body:
      "The Academy gates are open. Start with the Courses tab — pick a topic, beat your first level, and watch the XP roll in. You can replay this intro anytime from the dashboard.",
    highlights: [
      { icon: BookOpen, label: "Step 1: Courses", color: "text-cyan-400" },
      { icon: Tractor, label: "Step 2: Farm", color: "text-emerald-400" },
      { icon: Trophy, label: "Step 3: Climb", color: "text-yellow-400" },
    ],
    art: () => (
      <div className="relative w-full h-44 flex items-center justify-center">
        <motion.div
          className="absolute w-40 h-40 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, #a855f7, #06b6d4, #fbbf24, #ec4899, #a855f7)",
            filter: "blur(24px)",
            opacity: 0.45,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="relative text-6xl"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 2.2, repeat: Infinity }}
        >
          🚀
        </motion.div>
      </div>
    ),
  },
];

export default function WelcomeTutorial({
  onClose,
}: {
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && idx < SLIDES.length - 1) setIdx(idx + 1);
      else if (e.key === "ArrowLeft" && idx > 0) setIdx(idx - 1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(5, 5, 15, 0.85)", backdropFilter: "blur(8px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tutorial-title"
      data-testid="overlay-welcome-tutorial"
    >
      <motion.div
        className="relative w-full max-w-lg rounded-2xl border border-purple-500/30 overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, rgba(15,12,41,0.95) 0%, rgba(26,5,51,0.95) 50%, rgba(36,36,62,0.95) 100%)",
          boxShadow:
            "0 20px 60px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 22, stiffness: 200 }}
      >
        {/* Skip button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          aria-label="Skip tutorial"
          data-testid="button-tutorial-skip"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="absolute inset-0 cyber-grid opacity-15 pointer-events-none" />

        <div className="relative p-6 md:p-8">
          {/* Chapter badge */}
          <div className="flex items-center gap-2 mb-3">
            <div className="px-2 py-1 rounded-md bg-purple-500/20 border border-purple-400/40 text-purple-300 text-[10px] font-mono font-bold tracking-widest">
              {slide.badge}
            </div>
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
          </div>

          {/* Animated chapter content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {/* Art */}
              <div className="mb-4">{slide.art()}</div>

              {/* Title + body */}
              <h2
                id="welcome-tutorial-title"
                className="text-2xl md:text-3xl font-black text-white tracking-wide mb-2"
                style={{ fontFamily: "Oxanium, sans-serif" }}
                data-testid="text-tutorial-title"
              >
                {slide.title}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                {slide.body}
              </p>

              {/* Highlights row */}
              {slide.highlights && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {slide.highlights.map(({ icon: Icon, label, color }) => (
                    <div
                      key={label}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10"
                    >
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                      <span className="text-xs font-semibold text-white/85">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Footer: dots + nav */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx
                      ? "w-6 bg-purple-400"
                      : "w-1.5 bg-white/25 hover:bg-white/40"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                  data-testid={`button-tutorial-dot-${i}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {idx > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIdx(idx - 1)}
                  className="text-white/70 hover:text-white"
                  data-testid="button-tutorial-back"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              )}
              {!isLast ? (
                <Button
                  size="sm"
                  onClick={() => setIdx(idx + 1)}
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                  data-testid="button-tutorial-next"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Link href="/courses">
                  <Button
                    size="sm"
                    onClick={onClose}
                    className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold"
                    data-testid="button-tutorial-begin"
                  >
                    Begin Journey
                    <Play className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <p className="text-[10px] text-white/35 text-center mt-4 font-mono">
            ← → arrow keys to navigate · Esc to skip
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
