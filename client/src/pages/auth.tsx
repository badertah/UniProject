import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, User, Lock, Terminal, ChevronRight, Loader2 } from "lucide-react";

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
          toast({ title: "Streak Bonus!", description: `+${result.streakBonus} XP for your daily login streak!` });
        }
      } else {
        await register(username.trim(), password);
        toast({ title: "Welcome to EduQuest!", description: "Your journey begins now." });
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
    <div className="min-h-screen bg-background cyber-grid relative flex items-center justify-center overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)", top: "10%", left: "10%" }}
          animate={{ x: [-100, 100, -100], y: [-50, 100, -50] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.6) 0%, transparent 70%)", bottom: "10%", right: "10%" }}
          animate={{ x: [100, -100, 100], y: [50, -100, 50] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full blur-2xl opacity-10"
          style={{ background: "radial-gradient(circle, rgba(244,63,94,0.5) 0%, transparent 70%)", top: "50%", right: "20%" }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-48 h-48 border-l-2 border-t-2 border-primary/30 pointer-events-none" />
      <div className="absolute top-0 right-0 w-48 h-48 border-r-2 border-t-2 border-primary/30 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 border-l-2 border-b-2 border-accent/30 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-48 h-48 border-r-2 border-b-2 border-accent/30 pointer-events-none" />

      {/* Scanning line animation */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none"
        animate={{ y: ["-100vh", "100vh"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="relative z-10 w-full max-w-md px-4"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            className="flex items-center justify-center gap-3 mb-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center neon-purple">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold tracking-wider text-foreground" style={{ fontFamily: "Oxanium, sans-serif" }}>
                EDU<span className="text-primary neon-text-purple">QUEST</span>
              </h1>
              <p className="text-xs text-muted-foreground tracking-widest">LEARNING SYSTEM v2.0</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 justify-center mb-1">
              <Terminal className="w-3 h-3 text-accent" />
              <p className="text-accent text-xs tracking-[0.3em] font-mono">SYSTEM LOGIN</p>
              <Terminal className="w-3 h-3 text-accent" />
            </div>
            <p className="text-muted-foreground text-sm">
              {mode === "login" ? "Access your learning profile" : "Initialize new user profile"}
            </p>
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          className="glass-strong rounded-xl p-8 border border-primary/20"
          style={{ boxShadow: "0 0 40px rgba(139,92,246,0.1), 0 20px 60px rgba(0,0,0,0.5)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Mode toggle */}
          <div className="flex rounded-lg bg-muted/50 p-1 mb-8">
            {(["login", "register"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-medium tracking-wide rounded-md transition-all duration-200 ${
                  mode === m
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground"
                }`}
                data-testid={`button-${m}`}
              >
                {m === "login" ? "LOGIN" : "REGISTER"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs tracking-widest text-muted-foreground font-mono">
                USERNAME
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  data-testid="input-username"
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="pl-10 bg-muted/30 border-border/60 text-foreground placeholder:text-muted-foreground/50 font-mono focus:border-primary/60 focus:ring-primary/30"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs tracking-widest text-muted-foreground font-mono">
                PASSWORD
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  data-testid="input-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="pl-10 bg-muted/30 border-border/60 text-foreground placeholder:text-muted-foreground/50 font-mono focus:border-primary/60 focus:ring-primary/30"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>
              {mode === "register" && (
                <p className="text-xs text-muted-foreground font-mono">Min 6 characters</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full font-bold tracking-widest"
              disabled={loading}
              size="lg"
              data-testid="button-submit"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "INITIALIZE SESSION" : "CREATE PROFILE"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              {mode === "login" ? "New to EduQuest?" : "Already have an account?"}{" "}
              <button
                onClick={() => setMode(mode === "login" ? "register" : "login")}
                className="text-primary hover:text-primary/80 font-medium transition-colors"
                data-testid="button-toggle-mode"
              >
                {mode === "login" ? "Create profile" : "Login here"}
              </button>
            </p>
          </div>

          {/* Admin hint */}
          <div className="mt-4 pt-4 border-t border-border/30">
            <p className="text-xs text-muted-foreground/50 text-center font-mono">
              admin / admin123 for admin access
            </p>
          </div>
        </motion.div>

        {/* Footer indicators */}
        <motion.div
          className="flex items-center justify-center gap-6 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {["SECURE", "ENCRYPTED", "ONLINE"].map((label, i) => (
            <div key={label} className="flex items-center gap-1.5">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-accent"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
              />
              <span className="text-xs text-muted-foreground/60 font-mono tracking-widest">{label}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
