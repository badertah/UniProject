import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { X, Zap, Coins, RotateCcw } from "lucide-react";

// ── Game constants ──────────────────────────────────────
const W           = 360;
const H           = 480;
const BIRD_X      = 70;
const BIRD_R      = 16;
const GRAVITY     = 0.28;   // was 0.13 — feels snappy now
const JUMP_VEL    = -6.5;   // was -4.8 — punchy flap
const PIPE_W      = 54;
const PIPE_GAP    = 155;    // was 160 — slightly tighter
const PIPE_SPEED  = 3.2;    // was 1.8 — much faster
const PIPE_INTERVAL = 90;   // frames between spawns (was 130)
const TARGET_FPS  = 60;     // physics designed for this

// Static star positions (pre-computed, never change)
const STARS: [number, number, number][] = [
  [20, 30, 1.2], [80, 60, 0.9], [160, 20, 1.4], [240, 80, 1.0],
  [300, 40, 1.1], [340, 90, 0.8], [50, 120, 1.3], [200, 50, 1.0],
  [120, 90, 0.7], [280, 20, 1.2], [10, 200, 0.9], [330, 160, 1.1],
];

interface Pipe { x: number; topH: number; scored: boolean; }
type Phase = "idle" | "playing" | "dead";

// ── Cached gradient (created once per canvas context) ──
let cachedSkyGrad: CanvasGradient | null = null;
let cachedPipeGrad: CanvasGradient | null = null;

// ── Drawing helpers ─────────────────────────────────────
function drawBird(ctx: CanvasRenderingContext2D, y: number, vel: number) {
  const tilt = Math.max(-30, Math.min(65, vel * 4));
  ctx.save();
  ctx.translate(BIRD_X, y);
  ctx.rotate((tilt * Math.PI) / 180);

  // Wing shadow
  ctx.fillStyle = "#5b21b6";
  ctx.beginPath();
  ctx.ellipse(-4, 6, 10, 5.5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = "#7c3aed";
  ctx.beginPath();
  ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2);
  ctx.fill();

  // Wing
  ctx.fillStyle = "#6d28d9";
  ctx.beginPath();
  ctx.ellipse(-4, 4, 10, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Eye white
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(7, -4, 5, 0, Math.PI * 2);
  ctx.fill();
  // Pupil
  ctx.fillStyle = "#1e1b4b";
  ctx.beginPath();
  ctx.arc(8, -4, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Eye shine
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(9, -5.5, 1, 0, Math.PI * 2);
  ctx.fill();

  // Graduation cap board
  ctx.fillStyle = "#f59e0b";
  ctx.fillRect(-10, -BIRD_R - 4, 20, 4);
  // Cap top
  ctx.fillStyle = "#d97706";
  ctx.beginPath();
  ctx.arc(0, -BIRD_R - 2, 7, 0, Math.PI * 2);
  ctx.fill();
  // Tassel
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(7, -BIRD_R - 2);
  ctx.lineTo(10, -BIRD_R + 8);
  ctx.stroke();

  ctx.restore();
}

function drawPipe(ctx: CanvasRenderingContext2D, pipe: Pipe) {
  const bottomY = pipe.topH + PIPE_GAP;

  // Shadows
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(pipe.x + 4, 0, PIPE_W, pipe.topH);
  ctx.fillRect(pipe.x + 4, bottomY, PIPE_W, H - bottomY);

  // Use cached gradient (reuse across all pipes — gradient is 0→PIPE_W wide, translated by ctx)
  if (!cachedPipeGrad) {
    cachedPipeGrad = ctx.createLinearGradient(0, 0, PIPE_W, 0);
    cachedPipeGrad.addColorStop(0,   "#1e40af");
    cachedPipeGrad.addColorStop(0.5, "#3b82f6");
    cachedPipeGrad.addColorStop(1,   "#1e40af");
  }

  ctx.save();
  ctx.translate(pipe.x, 0);

  // Body
  ctx.fillStyle = cachedPipeGrad;
  ctx.fillRect(0, 0, PIPE_W, pipe.topH);
  ctx.fillRect(0, bottomY, PIPE_W, H - bottomY);

  // Highlight stripe
  ctx.fillStyle = "rgba(255,255,255,0.13)";
  ctx.fillRect(6, 0, 7, pipe.topH);
  ctx.fillRect(6, bottomY, 7, H - bottomY);

  // Caps
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(-4, pipe.topH - 14, PIPE_W + 8, 14);
  ctx.fillRect(-4, bottomY, PIPE_W + 8, 14);

  // Cap highlight
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(-4, pipe.topH - 14, PIPE_W + 8, 4);
  ctx.fillRect(-4, bottomY, PIPE_W + 8, 4);

  // Book decoration (simple geometry, no emoji)
  if (pipe.topH > 60) {
    const bx = 8, by = pipe.topH / 2 - 12;
    ctx.fillStyle = "#60a5fa";
    ctx.fillRect(bx, by, 28, 22);
    ctx.fillStyle = "#93c5fd";
    ctx.fillRect(bx, by, 4, 22);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(bx, by + 6,  28, 1.5);
    ctx.fillRect(bx, by + 12, 28, 1.5);
    ctx.fillRect(bx, by + 18, 28, 1.5);
  }

  ctx.restore();
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  offset: number,
) {
  // Sky — cached gradient
  if (!cachedSkyGrad) {
    cachedSkyGrad = ctx.createLinearGradient(0, 0, 0, H);
    cachedSkyGrad.addColorStop(0, "#0f0c29");
    cachedSkyGrad.addColorStop(1, "#1a0533");
  }
  ctx.fillStyle = cachedSkyGrad;
  ctx.fillRect(0, 0, W, H);

  // Stars — simple squares (much faster than arc)
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (const [sx, sy, r] of STARS) {
    const px = ((sx + offset * 0.18) % W + W) % W;
    const s2 = r * 1.8;
    ctx.fillRect(px - s2 / 2, sy - s2 / 2, s2, s2);
  }

  // Ground
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(0, H - 40, W, 40);
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(0, H - 40, W, 3);

  // Moving ground pattern
  ctx.fillStyle = "rgba(37,99,235,0.4)";
  for (let gx = ((-offset * 1.6) % 60 + 60) % 60; gx < W; gx += 60) {
    ctx.fillRect(gx, H - 38, 40, 2);
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, score: number) {
  ctx.save();
  ctx.font = "bold 30px 'Oxanium', sans-serif";
  ctx.textAlign = "center";
  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillText(String(score), W / 2 + 2, 52);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(String(score), W / 2, 50);
  ctx.restore();
}

// ── Main component ──────────────────────────────────────
export default function IkuflyGame({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { updateUser } = useAuth();

  const stateRef = useRef({
    phase: "idle" as Phase,
    birdY: H / 2,
    birdVel: 0,
    pipes: [] as Pipe[],
    score: 0,
    frame: 0,           // accumulates in dt units
    bgOffset: 0,
    animId: 0,
    lastTime: 0,        // for delta-time
  });

  const [displayPhase, setDisplayPhase]   = useState<Phase>("idle");
  const [displayScore, setDisplayScore]   = useState(0);
  const [bestScore, setBestScore]         = useState(() => Number(localStorage.getItem("ikufly_best") || 0));
  const [reward, setReward]               = useState<{ xp: number; coins: number } | null>(null);

  const rewardMutation = useMutation({
    mutationFn: (score: number) => apiRequest("POST", "/api/minigame/reward", { score }),
    onSuccess: (data: any) => {
      if (data.user) updateUser(data.user);
      setReward({ xp: data.xpReward, coins: data.coinsReward });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const checkCollision = useCallback((birdY: number, pipes: Pipe[]) => {
    if (birdY + BIRD_R >= H - 40 || birdY - BIRD_R <= 0) return true;
    for (const p of pipes) {
      if (BIRD_X + BIRD_R > p.x + 4 && BIRD_X - BIRD_R < p.x + PIPE_W - 4) {
        if (birdY - BIRD_R < p.topH || birdY + BIRD_R > p.topH + PIPE_GAP) return true;
      }
    }
    return false;
  }, []);

  const jump = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "idle") {
      s.phase = "playing";
      s.birdVel = JUMP_VEL;
      s.lastTime = 0; // reset dt tracking on start
      setDisplayPhase("playing");
    } else if (s.phase === "playing") {
      s.birdVel = JUMP_VEL;
    }
  }, []);

  const reset = useCallback(() => {
    const s = stateRef.current;
    s.phase = "idle";
    s.birdY = H / 2;
    s.birdVel = 0;
    s.pipes = [];
    s.score = 0;
    s.frame = 0;
    s.lastTime = 0;
    // Reset cached gradients so they're recreated on the current context
    cachedSkyGrad = null;
    cachedPipeGrad = null;
    setDisplayPhase("idle");
    setDisplayScore(0);
    setReward(null);
  }, []);

  // ── Game loop ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false })!; // alpha:false = faster compositing
    const s = stateRef.current;

    // Invalidate cached gradients so they're bound to this context
    cachedSkyGrad  = null;
    cachedPipeGrad = null;

    function loop(timestamp: number) {
      s.animId = requestAnimationFrame(loop);

      // ── Delta time: scale physics to be frame-rate independent ──
      // dt=1 means one 60fps frame worth of physics
      let dt = 1;
      if (s.lastTime > 0) {
        dt = Math.min((timestamp - s.lastTime) / (1000 / TARGET_FPS), 3);
      }
      s.lastTime = timestamp;

      const { phase } = s;

      // Advance world
      if (phase === "playing") {
        s.bgOffset += dt;
        s.frame    += dt;

        // Physics — all scaled by dt
        s.birdVel  += GRAVITY * dt;
        s.birdY    += s.birdVel * dt;

        // Spawn pipes (frame counter is dt-accumulated)
        if (Math.floor(s.frame) % PIPE_INTERVAL < dt + 0.5 && s.frame > PIPE_INTERVAL / 2) {
          // Check we haven't already spawned this interval
          const interval = Math.floor(s.frame / PIPE_INTERVAL);
          const prevInterval = Math.floor((s.frame - dt) / PIPE_INTERVAL);
          if (interval !== prevInterval) {
            const topH = 60 + Math.random() * (H - PIPE_GAP - 100 - 40);
            s.pipes.push({ x: W + 10, topH, scored: false });
          }
        }

        // Move pipes
        for (const p of s.pipes) {
          p.x -= PIPE_SPEED * dt;
          if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) {
            p.scored = true;
            s.score++;
            setDisplayScore(s.score);
          }
        }
        s.pipes = s.pipes.filter(p => p.x + PIPE_W > -10);

        // Collision
        if (checkCollision(s.birdY, s.pipes)) {
          s.phase = "dead";
          setDisplayPhase("dead");
          setDisplayScore(s.score);
          const best = Number(localStorage.getItem("ikufly_best") || 0);
          if (s.score > best) {
            localStorage.setItem("ikufly_best", String(s.score));
            setBestScore(s.score);
          }
          rewardMutation.mutate(s.score);
        }
      } else if (phase === "idle") {
        s.birdY = H / 2 + Math.sin(timestamp / 400) * 10;
      } else {
        // Dead — keep background scrolling slowly
        s.bgOffset += dt * 0.3;
      }

      // ── Draw ────────────────────────────────────────────
      drawBackground(ctx, s.bgOffset);
      for (const p of s.pipes) drawPipe(ctx, p);
      drawBird(ctx, s.birdY, s.birdVel);
      if (phase === "playing") drawHUD(ctx, s.score);
    }

    s.animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(s.animId);
      cachedSkyGrad  = null;
      cachedPipeGrad = null;
    };
  }, [checkCollision]); // eslint-disable-line

  // ── Input ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") { e.preventDefault(); jump(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="relative rounded-2xl overflow-hidden border border-purple-500/40"
        style={{ boxShadow: "0 0 60px rgba(124,58,237,0.3)" }}
        initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", damping: 18 }}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#0f0c29] border-b border-purple-500/20">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎓</span>
            <span className="text-white font-black text-sm tracking-widest" style={{ fontFamily: "Oxanium, sans-serif" }}>
              IKU<span className="text-purple-400">FLY</span>
            </span>
            <span className="text-xs text-slate-500 font-mono ml-2">Best: {bestScore}</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            data-testid="button-ikufly-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas */}
        <div className="relative" style={{ width: W, height: H }}>
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onClick={jump}
            className="block cursor-pointer select-none"
            style={{ touchAction: "none", imageRendering: "auto" }}
            onTouchStart={e => { e.preventDefault(); jump(); }}
            data-testid="canvas-ikufly"
          />

          {/* IDLE overlay */}
          <AnimatePresence>
            {displayPhase === "idle" && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <div className="text-center px-8">
                  <p className="text-white text-3xl mb-2">🎓</p>
                  <p className="text-white font-black text-xl mb-1" style={{ fontFamily: "Oxanium, sans-serif" }}>IKUFLY</p>
                  <p className="text-slate-400 text-xs mb-4">Tap or press Space to start</p>
                  <div className="bg-white/10 rounded-lg px-4 py-2 text-xs text-slate-300 border border-white/10">
                    Dodge the lecture slides and fly through!<br/>
                    <span className="text-purple-300">+2 XP</span> per point · max <span className="text-yellow-300">20 XP</span> per game
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* DEAD overlay */}
          <AnimatePresence>
            {displayPhase === "dead" && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              >
                <motion.div
                  className="text-center bg-[#0f0c29] border border-purple-500/30 rounded-2xl p-6 mx-6 pointer-events-auto"
                  initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }}
                  transition={{ type: "spring", damping: 18 }}
                >
                  <p className="text-white font-black text-lg mb-1" style={{ fontFamily: "Oxanium, sans-serif" }}>GAME OVER</p>
                  <p className="text-4xl font-black text-purple-400 mb-1" style={{ fontFamily: "Oxanium, sans-serif" }}>{displayScore}</p>
                  <p className="text-slate-400 text-xs mb-4">Best: {bestScore}</p>

                  {reward && (
                    <div className="flex items-center justify-center gap-4 mb-4 bg-white/5 rounded-xl p-3 border border-white/10">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-purple-400" />
                        <span className="text-white font-bold text-sm">+{reward.xp} XP</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-4 h-4 text-yellow-400" />
                        <span className="text-white font-bold text-sm">+{reward.coins} coins</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={reset}
                    className="flex items-center gap-2 mx-auto bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm px-5 py-2 rounded-xl transition-colors"
                    data-testid="button-ikufly-restart"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Play Again
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom hint */}
        <div className="bg-[#0f0c29] px-4 py-2 text-center text-xs text-slate-500 font-mono border-t border-purple-500/20">
          {displayPhase === "playing"
            ? "Tap canvas or Space to flap"
            : displayPhase === "dead"
            ? "Click Play Again to restart"
            : "Click the canvas or press Space to fly"}
        </div>
      </motion.div>
    </motion.div>
  );
}
