import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Zap, User, Lock, ChevronRight, Loader2, BookOpen,
  Trophy, Flame, Star, Shield, Gamepad2, GraduationCap, Tractor
} from "lucide-react";

const FEATURES = [
  { icon: Tractor,  title: "Farm Tycoon (Main Game)", desc: "Build, staff, and grow your farm — master SAD diagrams to keep it profitable", color: "text-emerald-400" },
  { icon: Trophy,   title: "Farm Leaderboard",        desc: "Compete with other tycoons — best management wins", color: "text-yellow-400" },
  { icon: BookOpen, title: "Courses & Mini-Games",    desc: "Quick learning modules that earn you coins to fuel your farm", color: "text-cyan-400" },
  { icon: Flame,    title: "Daily Streaks",           desc: "Log in every day to multiply your farm rewards", color: "text-orange-400" },
];

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const result = await login(username.trim(), password);
        if (result.streakBonus && result.streakBonus > 0) {
          toast({ title: "🔥 Streak Bonus!", description: `+${result.streakBonus} XP for your daily login streak!` });
        }
      } else {
        await register(username.trim(), password);
        toast({ title: "Welcome to IKUGAMES!", description: "Your journey begins now." });
      }
      setLocation("/dashboard");
    } catch (err: any) {
      toast({
        title: mode === "login" ? "Login Failed" : "Registration Failed",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-background">
      {/* ── LEFT PANEL ─────────────────────────────── */}
      <div className="hidden md:flex md:w-[55%] relative flex-col justify-between p-12 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f0c29, #1a0533, #24243e)" }}>

        {/* Grid pattern */}
        <div className="absolute inset-0 cyber-grid opacity-20" />

        {/* Glowing orbs */}
        <motion.div className="absolute w-80 h-80 rounded-full blur-3xl opacity-25 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.8) 0%, transparent 70%)", top: "-10%", left: "-10%" }}
          animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 6, repeat: Infinity }} />
        <motion.div className="absolute w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.8) 0%, transparent 70%)", bottom: "5%", right: "5%" }}
          animate={{ scale: [1.1, 1, 1.1] }} transition={{ duration: 8, repeat: Infinity }} />

        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}>
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-widest text-white" style={{ fontFamily: "Oxanium, sans-serif" }}>
                IKU<span className="text-purple-400">GAMES</span>
              </h1>
              <p className="text-xs text-slate-400 tracking-[0.2em] font-mono">LEARN · PLAY · LEVEL UP</p>
            </div>
          </div>
        </motion.div>

        {/* Hero text */}
        <motion.div className="relative z-10 flex-1 flex flex-col justify-center"
          initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
          <h2 className="text-4xl font-black text-white leading-tight mb-4" style={{ fontFamily: "Oxanium, sans-serif" }}>
            Build Your<br />
            <span className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(90deg, #fbbf24, #84cc16)" }}>
              Farm Empire
            </span>
          </h2>
          <p className="text-slate-400 text-base mb-10 leading-relaxed max-w-sm">
            The main game is <span className="text-emerald-300 font-semibold">Farm Tycoon</span> — build, upgrade, and out-manage other players. Courses and mini-games are your study aid: master Systems Analysis &amp; Design diagrams to keep your farm growing.
          </p>

          {/* Feature list */}
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, desc, color }, i) => (
              <motion.div key={title}
                className="flex items-center gap-4 p-3 rounded-xl border border-white/10"
                style={{ background: "rgba(255,255,255,0.04)" }}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.1 }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.07)" }}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">{title}</p>
                  <p className="text-slate-500 text-xs">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Online indicator */}
        <motion.div className="relative z-10 flex items-center justify-end pt-6 border-t border-white/10"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-slate-400 font-mono">ONLINE</span>
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative"
        style={{ background: "hsl(var(--background))" }}>

        {/* Mobile logo */}
        <div className="absolute top-6 left-6 flex items-center gap-2 md:hidden">
          <GraduationCap className="w-5 h-5 text-primary" />
          <span className="text-lg font-black tracking-widest" style={{ fontFamily: "Oxanium, sans-serif" }}>
            IKU<span className="text-primary">GAMES</span>
          </span>
        </div>

        <motion.div className="w-full max-w-sm"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>

          {/* Header */}
          <div className="mb-8">
            <AnimatePresence mode="wait">
              <motion.div key={mode}
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}>
                <h2 className="text-2xl font-black text-foreground mb-1" style={{ fontFamily: "Oxanium, sans-serif" }}>
                  {mode === "login" ? "Welcome back" : "Create account"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {mode === "login"
                    ? "Sign in to continue your learning journey"
                    : "Join your team on IKUGAMES and start learning"}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Toggle tabs */}
          <div className="flex rounded-xl bg-muted/60 p-1 mb-7 border border-border/40">
            {(["login", "register"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  mode === m
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`button-${m}`}>
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium text-foreground">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="username" data-testid="input-username" type="text"
                  value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Your username"
                  className="pl-10 h-11 bg-muted/30 border-border/60 focus:border-primary/70 focus:ring-primary/20"
                  autoComplete="username" />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" data-testid="input-password" type="password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Min. 6 characters" : "Your password"}
                  className="pl-10 h-11 bg-muted/30 border-border/60 focus:border-primary/70 focus:ring-primary/20"
                  autoComplete={mode === "login" ? "current-password" : "new-password"} />
              </div>
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full h-11 font-bold text-sm" disabled={loading}
              data-testid="button-submit">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Switch mode */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="text-primary font-semibold hover:underline transition-colors"
              data-testid="button-toggle-mode">
              {mode === "login" ? "Register here" : "Sign in"}
            </button>
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-xs text-muted-foreground/60 font-mono">or</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          {/* Info badges */}
          <div className="flex items-center justify-center gap-4">
            {[
              { icon: Shield, label: "Secure", color: "text-emerald-400" },
              { icon: Zap, label: "Fast", color: "text-yellow-400" },
              { icon: Star, label: "Free", color: "text-purple-400" },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-muted/50 border border-border/40 flex items-center justify-center">
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {/* Admin hint */}
          <p className="text-center text-xs text-muted-foreground/40 font-mono mt-6">
            admin / admin123 for admin access
          </p>
        </motion.div>
      </div>
    </div>
  );
}
