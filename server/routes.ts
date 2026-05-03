import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { insertUserSchema } from "@shared/schema";
import {
  TEACH_BACK_BANK,
  SAD_GAME_TYPES,
  isSadGameType,
  type SadGameType,
} from "@shared/teach-back";

// Minimum milliseconds between farm harvests (2 minutes — enforced in DB).
const HARVEST_COOLDOWN_MS = 120_000;

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: SESSION_SECRET environment variable is not set. Refusing to start in production without a secure JWT secret.");
    process.exit(1);
  } else {
    console.warn("WARNING: SESSION_SECRET is not set. Using an insecure default secret for development only.");
  }
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || "eduquest-secret-2024-dev-only";

interface TeachBackEntry {
  prompt: string;
  options: string[];
  correctIndex: number;
  why?: string;
}

function isTeachBackQ(value: unknown): value is TeachBackEntry {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.prompt === "string" &&
    Array.isArray(v.options) &&
    v.options.every((o) => typeof o === "string") &&
    typeof v.correctIndex === "number"
  );
}

interface AuthRequest extends Request {
  userId?: string;
}

function generateToken(userId: string) {
  return jwt.sign({ userId }, EFFECTIVE_JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const user = await storage.getUser(req.userId);
  if (!user?.isAdmin) return res.status(403).json({ error: "Admin access required" });
  next();
}

function calculateLevel(xp: number): number {
  return Math.floor(xp / 150) + 1;
}

function getTier(xp: number): string {
  if (xp >= 7000) return "Legend";
  if (xp >= 3500) return "Master";
  if (xp >= 1500) return "Expert";
  if (xp >= 500) return "Scholar";
  return "Rookie";
}

async function checkAndAwardBadges(userId: string): Promise<any[]> {
  try {
    const [user, allBadges, userBadgesList, completedCount] = await Promise.all([
      storage.getUser(userId),
      storage.getAllBadges(),
      storage.getUserBadges(userId),
      storage.getCompletedLevelsCount(userId),
    ]);
    if (!user) return [];

    const userBadgeIds = new Set(userBadgesList.map(ub => ub.badgeId));
    const newlyAwarded: { id: string; name: string; description: string; requirementType: string; }[] = [];

    const userProgress = await storage.getUserProgress(userId);
    const gameTypesCompleted = new Set(
      userProgress.filter(p => p.completed).map(p => p.level.gameType)
    );

    const sadMastery = (user.sadConceptMastery ?? {}) as Record<string, boolean>;
    const sadConceptCount = SAD_GAME_TYPES.filter((gt) => sadMastery[gt] === true).length;

    for (const badge of allBadges) {
      if (userBadgeIds.has(badge.id)) continue;

      let earned = false;
      switch (badge.requirementType) {
        case "xp_milestone":
          earned = user.xp >= badge.requirementValue;
          break;
        case "streak":
          earned = user.streak >= badge.requirementValue;
          break;
        case "levels_complete":
          earned = completedCount >= badge.requirementValue;
          break;
        case "game_type_memory_flip":
          earned = gameTypesCompleted.has("memory_flip");
          break;
        case "game_type_wordle":
          earned = gameTypesCompleted.has("wordle");
          break;
        case "game_type_concept_connector":
          earned = gameTypesCompleted.has("concept_connector") || gameTypesCompleted.has("matcher") || gameTypesCompleted.has("term_matcher");
          break;
        case "concept_master_sad":
          earned = sadConceptCount >= SAD_GAME_TYPES.length;
          break;
      }

      if (earned) {
        // awardBadge returns undefined if a concurrent caller already
        // inserted the row (unique index on (user_id, badge_id)). Only
        // grant XP/coin rewards when WE actually inserted the row, so a
        // race can never double-pay.
        const inserted = await storage.awardBadge(userId, badge.id);
        if (!inserted) {
          userBadgeIds.add(badge.id);
          continue;
        }
        if (badge.xpReward > 0 || badge.coinReward > 0) {
          const currentUser = await storage.getUser(userId);
          if (currentUser) {
            const newXp = currentUser.xp + badge.xpReward;
            await storage.updateUser(userId, {
              xp: newXp,
              level: calculateLevel(newXp),
              eduCoins: currentUser.eduCoins + badge.coinReward,
            });
          }
        }
        newlyAwarded.push(badge);
        userBadgeIds.add(badge.id);
      }
    }

    return newlyAwarded;
  } catch (e) {
    console.error("Badge check error:", e);
    return [];
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ============ AUTH ============
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      const { username, password } = parsed.data;
      const existing = await storage.getUserByUsername(username);
      if (existing) return res.status(409).json({ error: "Username already taken" });
      const hashed = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hashed });
      const token = generateToken(user.id);
      const { password: _, ...safeUser } = user;
      res.json({ token, user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch (e) {
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ error: "Invalid credentials" });

      const today = new Date().toISOString().split("T")[0];
      let newStreak = user.streak;
      let streakBonus = 0;

      if (user.lastLoginDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        if (user.lastLoginDate === yesterday) {
          newStreak = user.streak + 1;
        } else if (user.lastLoginDate !== today) {
          newStreak = 1;
        }
        streakBonus = Math.min(newStreak * 5, 50);
        const newXp = user.xp + streakBonus;
        const streakCoins = Math.floor(streakBonus / 2);
        await storage.updateUser(user.id, {
          streak: newStreak,
          lastLoginDate: today,
          xp: newXp,
          level: calculateLevel(newXp),
          eduCoins: user.eduCoins + streakCoins,
        });
      }

      const updatedUser = await storage.getUser(user.id);
      const newBadges = await checkAndAwardBadges(user.id);
      const finalUser = await storage.getUser(user.id);
      const token = generateToken(user.id);
      const { password: _, ...safeUser } = finalUser!;
      res.json({ token, user: { ...safeUser, tier: getTier(safeUser.xp) }, streakBonus, newBadges });
    } catch (e) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });
      const { password: _, ...safeUser } = user;
      res.json({ ...safeUser, tier: getTier(safeUser.xp) });
    } catch {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // ============ TOPICS ============
  // For now we focus the platform on the System Analysis & Design course only.
  // Other topics remain in the DB but are filtered out of the public API.
  function isSADTopic(name: string) {
    return /system\s*analysis/i.test(name);
  }

  // Allowlist of game types that are visible inside the SAD topic. The 6 new
  // play-to-learn games + two legacy classics the user likes (memory_flip and
  // wordle). Other legacy types (bubble_pop, speed_blitz, matcher, …) stay in
  // the DB but are hidden from the SAD topic listing.
  const SAD_VISIBLE_GAMES = new Set([
    "sdlc_sorter", "req_sorter", "usecase_builder",
    "erd_doctor",  "dfd_detective", "sequence_stacker",
    "memory_flip", "wordle",
  ]);

  app.get("/api/topics", async (req, res) => {
    try {
      const allTopics = await storage.getAllTopics();
      const visible = allTopics.filter(t => isSADTopic(t.name));
      const topicsWithCount = await Promise.all(
        visible.map(async (topic) => {
          const lvls = (await storage.getLevelsByTopic(topic.id))
            .filter(l => SAD_VISIBLE_GAMES.has(l.gameType));
          const lvlsWithCount = await Promise.all(lvls.map(async (lvl) => {
            const qs = await storage.getQuestionsByLevel(lvl.id);
            return { ...lvl, questionCount: Math.max(qs.length, 1) };
          }));
          return { ...topic, levelCount: lvls.length, levels: lvlsWithCount };
        })
      );
      res.json(topicsWithCount);
    } catch {
      res.status(500).json({ error: "Failed to fetch topics" });
    }
  });

  app.get("/api/topics/:id", async (req, res) => {
    try {
      const topic = await storage.getTopic(req.params.id);
      if (!topic) return res.status(404).json({ error: "Topic not found" });
      if (!isSADTopic(topic.name)) {
        return res.status(404).json({ error: "Topic not available" });
      }
      const topicLevels = (await storage.getLevelsByTopic(topic.id))
        .filter(l => SAD_VISIBLE_GAMES.has(l.gameType));
      const levelsWithCount = await Promise.all(topicLevels.map(async (lvl) => {
        const qs = await storage.getQuestionsByLevel(lvl.id);
        return { ...lvl, questionCount: Math.max(qs.length, 1) };
      }));
      res.json({ ...topic, levels: levelsWithCount });
    } catch {
      res.status(500).json({ error: "Failed to fetch topic" });
    }
  });

  app.post("/api/topics", authMiddleware, adminMiddleware as RequestHandler, async (req: AuthRequest, res) => {
    try {
      const topic = await storage.createTopic(req.body);
      res.json(topic);
    } catch {
      res.status(500).json({ error: "Failed to create topic" });
    }
  });

  // ============ LEVELS ============
  app.get("/api/levels/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const level = await storage.getLevel(String(req.params.id));
      if (!level) return res.status(404).json({ error: "Level not found" });
      const qs = await storage.getQuestionsByLevel(level.id);
      res.json({ ...level, questions: qs });
    } catch {
      res.status(500).json({ error: "Failed to fetch level" });
    }
  });

  app.get("/api/levels/:id/questions", authMiddleware, adminMiddleware as RequestHandler, async (req: AuthRequest, res) => {
    try {
      const qs = await storage.getQuestionsByLevel(String(req.params.id));
      res.json(qs);
    } catch {
      res.status(500).json({ error: "Failed to fetch questions" });
    }
  });

  app.post("/api/levels", authMiddleware, adminMiddleware as RequestHandler, async (req: AuthRequest, res) => {
    try {
      const level = await storage.createLevel(req.body);
      res.json(level);
    } catch {
      res.status(500).json({ error: "Failed to create level" });
    }
  });

  app.put("/api/levels/:id", authMiddleware, adminMiddleware as RequestHandler, async (req: AuthRequest, res) => {
    try {
      const level = await storage.updateLevel(String(req.params.id), req.body);
      res.json(level);
    } catch {
      res.status(500).json({ error: "Failed to update level" });
    }
  });

  app.delete("/api/levels/:id", authMiddleware, adminMiddleware as RequestHandler, async (req: AuthRequest, res) => {
    try {
      await storage.deleteLevel(String(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete level" });
    }
  });

  // ============ QUESTIONS ============
  app.post("/api/questions", authMiddleware, adminMiddleware as RequestHandler, async (req: AuthRequest, res) => {
    try {
      const question = await storage.createQuestion(req.body);
      res.json(question);
    } catch {
      res.status(500).json({ error: "Failed to create question" });
    }
  });

  app.put("/api/questions/:id", authMiddleware, adminMiddleware as RequestHandler, async (req: AuthRequest, res) => {
    try {
      const question = await storage.updateQuestion(String(req.params.id), req.body);
      res.json(question);
    } catch {
      res.status(500).json({ error: "Failed to update question" });
    }
  });

  app.delete("/api/questions/:id", authMiddleware, adminMiddleware as RequestHandler, async (req: AuthRequest, res) => {
    try {
      await storage.deleteQuestion(String(req.params.id));
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete question" });
    }
  });

  // ============ PROGRESS ============
  app.post("/api/progress", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { levelId, stageIndex: rawStageIndex } = req.body;
      if (!levelId) return res.status(400).json({ error: "levelId required" });

      const rawScore = Number(req.body?.score);
      if (!Number.isFinite(rawScore) || rawScore < 0 || !Number.isInteger(rawScore)) {
        return res.status(400).json({ error: "score must be a non-negative integer" });
      }
      const score = Math.min(rawScore, 100);

      const clientCompleted = req.body?.completed === true || req.body?.completed === "true";
      const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;

      const rawStageForClaim = Number.isFinite(Number(rawStageIndex)) ? Math.floor(Number(rawStageIndex)) : 0;

      const [level, allQuestions] = await Promise.all([
        storage.getLevel(levelId),
        storage.getQuestionsByLevel(levelId),
      ]);
      if (!level) return res.status(404).json({ error: "Level not found" });

      const totalStages = Math.max(allQuestions.length, 1);

      // Completion requires a valid session AND a real question at that stage index.
      // For SAD games the session must also have teachback_passed=true — set only by
      // the server-graded /api/sad/teachback route — so no client flag controls reward.
      let completed = false;
      if (clientCompleted && score > 0 && sessionId) {
        const stageQuestion = allQuestions
          .sort((a, b) => a.orderIndex - b.orderIndex)
          [rawStageForClaim] ?? null;
        if (stageQuestion) {
          const requireTeachback = isSadGameType(level.gameType);
          const claimed = await storage.claimGameSession(sessionId, req.userId!, levelId, rawStageForClaim, requireTeachback);
          completed = claimed;
        }
      }

      const requested = Number.isFinite(Number(rawStageIndex)) ? Math.floor(Number(rawStageIndex)) : 0;
      const stageIndex = Math.min(Math.max(requested, 0), totalStages - 1);

      const rewardOutcome = await storage.runWithProgressLock(req.userId!, levelId, async () => {
        const prevStage = await storage.getStageProgress(req.userId!, levelId, stageIndex);
        const prevStages = await storage.getLevelStages(req.userId!, levelId);
        const prevCompletedStages = new Set(prevStages.filter(p => p.completed).map(p => p.stageIndex));
        const wasLevelFullyCompleted = prevCompletedStages.size >= totalStages;

        const isFirstStageCompletion = !prevStage?.completed && completed;

        const saved = await storage.saveProgress(req.userId!, levelId, stageIndex, score, completed);

        if (completed) prevCompletedStages.add(stageIndex);
        const isLevelFullyCompleted = prevCompletedStages.size >= totalStages;
        const justFinishedLevel = isLevelFullyCompleted && !wasLevelFullyCompleted;

        const stageXp = Math.max(1, Math.ceil(level.xpReward / totalStages));
        const stageCoins = Math.max(1, Math.ceil(level.coinReward / totalStages));

        let xpGained = 0;
        let coinsGained = 0;

        if (isFirstStageCompletion) {
          xpGained += stageXp;
          coinsGained += stageCoins;
        } else if (completed) {
          xpGained += Math.floor(stageXp * 0.25);
          coinsGained += Math.floor(stageCoins * 0.25);
        }

        if (justFinishedLevel) {
          xpGained += Math.max(5, Math.floor(level.xpReward * 0.25));
          coinsGained += Math.max(1, Math.floor(level.coinReward * 0.25));
        }

        if (xpGained > 0 || coinsGained > 0) {
          const user = await storage.getUser(req.userId!);
          if (user) {
            const newXp = user.xp + xpGained;
            const newLevel = calculateLevel(newXp);
            await storage.updateUser(req.userId!, {
              xp: newXp,
              level: newLevel,
              eduCoins: user.eduCoins + coinsGained,
            });
          }
        }

        return { progress: saved, xpGained, coinsGained, isFirstStageCompletion, isLevelFullyCompleted, justFinishedLevel };
      });

      const { progress, xpGained, coinsGained, isFirstStageCompletion, isLevelFullyCompleted, justFinishedLevel } = rewardOutcome;

      const newBadges = completed ? await checkAndAwardBadges(req.userId!) : [];
      const updatedUser = await storage.getUser(req.userId!);
      const { password: _, ...safeUser } = updatedUser!;

      res.json({
        progress,
        xpGained,
        coinsGained,
        stageIndex,
        totalStages,
        isFirstStageCompletion,
        isLevelFullyCompleted,
        justFinishedLevel,
        user: { ...safeUser, tier: getTier(safeUser.xp) },
        newBadges,
      });
    } catch (e) {
      console.error("Progress error:", e);
      res.status(500).json({ error: "Failed to save progress" });
    }
  });

  app.get("/api/progress", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const progress = await storage.getUserProgress(req.userId!);
      res.json(progress);
    } catch {
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  });

  // ============ LEADERBOARD ============
  app.get("/api/leaderboard", async (req, res) => {
    try {
      // Pull a wider window then filter admins out so the admin/staff
      // accounts never appear on the public leaderboard, no matter how
      // much XP they have.
      const leaders = await storage.getLeaderboard(50);
      const safe = leaders
        .filter(u => !u.isAdmin)
        .slice(0, 20)
        .map(({ password: _, ...u }) => ({ ...u, tier: getTier(u.xp) }));
      res.json(safe);
    } catch {
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Farm Tycoon leaderboard — ranks by farmTotalEarned (lifetime coins
  // earned from farm production). The farm IS the main game; the XP
  // leaderboard tracks course completions, this one tracks management.
  app.get("/api/leaderboard/farm", async (req, res) => {
    try {
      // Validate sort param against the union the storage layer accepts.
      // Anything unknown silently falls back to "earned" so the client
      // can't 500 us by sending a typo.
      const allowed = new Set(["earned", "days", "efficiency", "recent"]);
      const raw = String(req.query.sort || "earned");
      const sort = (allowed.has(raw) ? raw : "earned") as "earned" | "days" | "efficiency" | "recent";
      const leaders = await storage.getFarmLeaderboard(50, sort);
      const safe = leaders
        .filter(u => !u.isAdmin)
        .slice(0, 20)
        .map(({ password: _, ...u }) => ({ ...u, tier: getTier(u.xp) }));
      res.json(safe);
    } catch {
      res.status(500).json({ error: "Failed to fetch farm leaderboard" });
    }
  });

  // Sync the local farm state's DISPLAY-ONLY stats to the user record.
  // Called from the farm page (debounced) on every save. We only
  // accept farmBank (current bank balance, capped at 500 — same cap
  // as the harvest route) and farmDay (current day, monotonic so a
  // tampered client cannot rewind). farmTotalEarned is NOT accepted
  // here — it's the authoritative leaderboard metric and is bumped
  // server-side in /api/farm/harvest only.
  app.post("/api/farm/sync", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { farmBank, farmDay } = req.body || {};
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });
      const nextBank = Math.max(0, Math.min(Math.floor(Number(farmBank) || 0), 500));
      const reqDay   = Math.max(1, Math.min(Math.floor(Number(farmDay) || 1), 1_000_000));
      // Day is monotonic too — only allow forward motion.
      const nextDay  = Math.max(user.farmDay || 1, reqDay);
      const updated = await storage.updateUser(req.userId!, {
        farmBank: nextBank,
        farmDay: nextDay,
      });
      const { password: _, ...safeUser } = updated;
      res.json({ user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch (err) {
      console.error("Farm sync error:", err);
      res.status(500).json({ error: "Farm sync failed" });
    }
  });

  // ============ BADGES ============
  app.get("/api/badges", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const all = await storage.getAllBadges();
      const userBadgesList = await storage.getUserBadges(req.userId!);
      const earnedIds = new Set(userBadgesList.map(ub => ub.badgeId));
      const badgesWithStatus = all.map(b => ({
        ...b,
        earned: earnedIds.has(b.id),
        earnedAt: userBadgesList.find(ub => ub.badgeId === b.id)?.earnedAt || null,
      }));
      res.json(badgesWithStatus);
    } catch {
      res.status(500).json({ error: "Failed to fetch badges" });
    }
  });

  app.get("/api/badges/user/:userId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userBadgesList = await storage.getUserBadges(String(req.params.userId));
      res.json(userBadgesList.map(ub => ub.badge));
    } catch {
      res.status(500).json({ error: "Failed to fetch user badges" });
    }
  });

  // Records that the user passed the teach-back quick check for a SAD game.
  // The client sends { gameType, prompt, pickedIndex }; the server resolves
  // the question from its OWN bank (shared/teach-back.ts plus per-level
  // overrides from questions.options.teachBack) and ONLY records mastery
  // when the picked index matches the bank's correctIndex. Without this
  // check, a malicious client could grant itself the badge by POSTing six
  // times — never trust a "passed" flag from the client.
  app.post("/api/sad/teachback", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const body = (req.body ?? {}) as {
        gameType?: unknown;
        prompt?: unknown;
        pickedIndex?: unknown;
        gameSessionId?: unknown;
        levelId?: unknown;
        stageIndex?: unknown;
      };
      const gameType = typeof body.gameType === "string" ? body.gameType : "";
      const prompt = typeof body.prompt === "string" ? body.prompt : "";
      const pickedIndex = typeof body.pickedIndex === "number" ? body.pickedIndex : -1;
      const gameSessionId = typeof body.gameSessionId === "string" ? body.gameSessionId : null;
      const levelId = typeof body.levelId === "string" ? body.levelId : null;
      const rawStageIndex = typeof body.stageIndex === "number" ? Math.floor(body.stageIndex) : null;

      if (!isSadGameType(gameType)) {
        return res.status(400).json({ error: "Invalid SAD gameType" });
      }
      if (!prompt) {
        return res.status(400).json({ error: "Missing teach-back prompt" });
      }

      const overrides = await storage.getSadTeachBackOverrides(gameType);
      const pool = [
        ...TEACH_BACK_BANK[gameType as SadGameType],
        ...overrides.filter(isTeachBackQ),
      ];
      const match = pool.find((q) => q.prompt === prompt);
      if (!match) {
        return res.status(400).json({ error: "Unknown teach-back question" });
      }
      const passed = pickedIndex === match.correctIndex;

      // When the player passes, mark their game session so the progress endpoint
      // can grant completion without trusting any client-controlled flag.
      if (passed && gameSessionId && levelId && rawStageIndex !== null) {
        await storage.markSessionTeachbackPassed(gameSessionId, req.userId!, levelId, rawStageIndex);
      }

      const userBefore = await storage.getUser(req.userId!);
      const mastery = passed
        ? await storage.recordSadConceptMastery(req.userId!, gameType)
        : ((userBefore?.sadConceptMastery ?? {}) as Record<string, boolean>);
      const newBadges = passed ? await checkAndAwardBadges(req.userId!) : [];
      const masteredCount = SAD_GAME_TYPES.filter((gt) => mastery[gt] === true).length;
      res.json({ passed, mastery, masteredCount, total: SAD_GAME_TYPES.length, newBadges });
    } catch (e) {
      console.error("Teach-back record error:", e);
      res.status(500).json({ error: "Failed to record teach-back result" });
    }
  });

  app.post("/api/badges/check", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const newBadges = await checkAndAwardBadges(req.userId!);
      res.json({ newBadges });
    } catch {
      res.status(500).json({ error: "Badge check failed" });
    }
  });

  // ============ USERS (Admin) ============
  app.get("/api/admin/users", authMiddleware, adminMiddleware as RequestHandler, async (req: AuthRequest, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const safe = allUsers.map(({ password: _, ...u }) => ({ ...u, tier: getTier(u.xp) }));
      res.json(safe);
    } catch {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:id", authMiddleware, adminMiddleware as RequestHandler, async (req: AuthRequest, res) => {
    try {
      const { xp, eduCoins, isAdmin } = req.body;
      const updateData: Record<string, unknown> = {};
      if (xp !== undefined) { updateData.xp = xp; updateData.level = calculateLevel(xp); }
      if (eduCoins !== undefined) updateData.eduCoins = eduCoins;
      if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
      const updated = await storage.updateUser(String(req.params.id), updateData);
      const { password: _, ...safe } = updated;
      res.json({ ...safe, tier: getTier(safe.xp) });
    } catch {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ============ COSMETICS ============
  app.get("/api/cosmetics", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const all = await storage.getAllCosmetics();
      const owned = await storage.getUserCosmetics(req.userId!);
      const ownedIds = new Set(owned.map(uc => uc.cosmeticId));
      res.json(all.map(c => ({ ...c, owned: ownedIds.has(c.id) })));
    } catch {
      res.status(500).json({ error: "Failed to fetch cosmetics" });
    }
  });

  app.post("/api/cosmetics/purchase/:cosmeticId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const cosmeticId = String(req.params.cosmeticId);
      await storage.purchaseCosmetic(req.userId!, cosmeticId);
      const updated = await storage.getUser(req.userId!);
      if (!updated) return res.status(404).json({ error: "User not found" });
      const { password: _, ...safeUser } = updated;
      res.json({ success: true, user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : "");
      if (msg === "Already owned") return res.status(409).json({ error: "Already owned" });
      if (msg === "Insufficient EduCoins") return res.status(400).json({ error: "Insufficient EduCoins" });
      if (msg === "Cosmetic not found") return res.status(404).json({ error: "Cosmetic not found" });
      if (msg === "User not found") return res.status(404).json({ error: "User not found" });
      res.status(500).json({ error: "Purchase failed" });
    }
  });

  app.post("/api/cosmetics/equip/:cosmeticId", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const cosmeticId = String(req.params.cosmeticId);
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });

      const cosmetic = (await storage.getAllCosmetics()).find(c => c.id === cosmeticId);
      if (!cosmetic) return res.status(404).json({ error: "Cosmetic not found" });

      const owned = await storage.hasCosmetic(req.userId!, cosmeticId);
      if (!owned) return res.status(403).json({ error: "You don't own this cosmetic" });

      const updateData: Record<string, string | null> = {};
      if (cosmetic.type === "avatar") updateData.equippedAvatar = cosmeticId;
      if (cosmetic.type === "frame") updateData.equippedFrame = cosmeticId;
      if (cosmetic.type === "theme") updateData.equippedTheme = cosmeticId;

      const updated = await storage.updateUser(req.userId!, updateData);
      const { password: _, ...safeUser } = updated;
      res.json({ user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch {
      res.status(500).json({ error: "Equip failed" });
    }
  });

  app.post("/api/cosmetics/unequip", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const { type } = req.body;
      const updateData: Record<string, string | null> = {};
      if (type === "avatar") updateData.equippedAvatar = null;
      if (type === "frame") updateData.equippedFrame = null;
      if (type === "theme") updateData.equippedTheme = null;
      const updated = await storage.updateUser(req.userId!, updateData);
      const { password: _, ...safeUser } = updated;
      res.json({ user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch {
      res.status(500).json({ error: "Unequip failed" });
    }
  });

  // ============ MINIGAME SESSION + REWARD ============
  app.post("/api/minigame/start", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const session = await storage.createMinigameSession(req.userId!);
      if (!session) {
        return res.status(429).json({ error: "Please wait before starting another game", retryAfter: 30 });
      }
      res.json({ sessionId: session.id });
    } catch {
      res.status(500).json({ error: "Failed to start minigame session" });
    }
  });

  app.post("/api/minigame/reward", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : null;
      if (!sessionId) {
        return res.status(400).json({ error: "sessionId required" });
      }

      const DAILY_MINIGAME_CAP = 5;
      const dailyClaims = await storage.countDailyMinigameClaims(userId);
      if (dailyClaims >= DAILY_MINIGAME_CAP) {
        return res.status(429).json({ error: "Daily minigame reward limit reached. Come back tomorrow!" });
      }

      const claimed = await storage.claimMinigameSession(sessionId, userId);
      if (!claimed) {
        return res.status(409).json({ error: "Invalid or already-used game session" });
      }

      // Fixed server-determined rewards. The client-submitted score affects
      // the displayed result but not the economy — this eliminates fake-score attacks.
      const xpReward = 5;
      const coinsReward = 1;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      const newXp = user.xp + xpReward;
      const newLevel = calculateLevel(newXp);
      const updated = await storage.updateUser(userId, {
        xp: newXp,
        level: newLevel,
        eduCoins: user.eduCoins + coinsReward,
      });

      const { password: _, ...safeUser } = updated;
      res.json({ user: { ...safeUser, tier: getTier(safeUser.xp) }, xpReward, coinsReward });
    } catch {
      res.status(500).json({ error: "Reward failed" });
    }
  });

  // ============ FARM HARVEST ============
  app.post("/api/farm/harvest", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const now = Date.now();
      if (user.lastHarvestAt) {
        const elapsed = now - user.lastHarvestAt.getTime();
        if (elapsed < HARVEST_COOLDOWN_MS) {
          const retryAfter = Math.ceil((HARVEST_COOLDOWN_MS - elapsed) / 1000);
          return res.status(429).json({ error: "Harvest is on cooldown. Please wait.", retryAfter });
        }
      }

      const MAX_FARM_BANK = 500;
      const elapsedMs = user.lastHarvestAt ? now - user.lastHarvestAt.getTime() : HARVEST_COOLDOWN_MS;
      const baseCoins = Math.min(MAX_FARM_BANK, Math.ceil(elapsedMs / HARVEST_COOLDOWN_MS * MAX_FARM_BANK));

      const { skipMult } = req.body;

      let perks = { xpMult: 1, farmMult: 1, coinMult: 1 } as { xpMult: number; farmMult: number; coinMult: number };
      if (!skipMult) {
        const { combinePerks } = await import("@shared/cosmetic-perks");
        const all = await storage.getAllCosmetics();
        const byId = new Map(all.map(c => [c.id, c]));
        const aIcon = user.equippedAvatar ? byId.get(user.equippedAvatar)?.icon : null;
        const fIcon = user.equippedFrame  ? byId.get(user.equippedFrame)?.icon  : null;
        const tIcon = user.equippedTheme  ? byId.get(user.equippedTheme)?.icon  : null;
        perks = combinePerks(aIcon, fIcon, tIcon);
      }
      const coinsToAdd = Math.floor(baseCoins * perks.farmMult);
      const bonusCoins = coinsToAdd - baseCoins;

      const updated = await storage.updateUser(userId, {
        eduCoins: user.eduCoins + coinsToAdd,
        farmTotalEarned: (user.farmTotalEarned || 0) + coinsToAdd,
        farmDay: (user.farmDay || 1) + 1,
        farmBank: 0,
        lastHarvestAt: new Date(now),
      });

      const { password: _, ...safeUser } = updated;
      res.json({
        user: { ...safeUser, tier: getTier(safeUser.xp) },
        coinsAdded: coinsToAdd,
        bonusCoins,
        farmMult: perks.farmMult,
      });
    } catch (err) {
      console.error("Farm harvest error:", err);
      res.status(500).json({ error: "Harvest failed" });
    }
  });

  // ============ GAME SESSION ============
  app.post("/api/game-session", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const levelId = typeof req.body?.levelId === "string" ? req.body.levelId : null;
      const stageIndex = Number(req.body?.stageIndex ?? 0);
      if (!levelId) return res.status(400).json({ error: "levelId required" });
      if (!Number.isFinite(stageIndex) || stageIndex < 0) return res.status(400).json({ error: "Invalid stageIndex" });

      const [level, levelQuestions] = await Promise.all([
        storage.getLevel(levelId),
        storage.getQuestionsByLevel(levelId),
      ]);
      if (!level) return res.status(404).json({ error: "Level not found" });

      const totalStages = Math.max(levelQuestions.length, 1);
      const flooredIndex = Math.floor(stageIndex);
      if (flooredIndex >= totalStages) {
        return res.status(400).json({ error: "stageIndex out of range for this level" });
      }

      const session = await storage.createGameSession(req.userId!, levelId, flooredIndex);
      res.json({ sessionId: session.id });
    } catch {
      res.status(500).json({ error: "Failed to create game session" });
    }
  });

  // ============ SPEND COINS ============
  app.post("/api/coins/spend", authMiddleware, async (req: AuthRequest, res) => {
    try {
      const amount = Number(req.body?.amount);
      // Reject non-finite, zero, or negative amounts to prevent coin minting.
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
        return res.status(400).json({ error: "Amount must be a positive integer" });
      }
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.eduCoins < amount) return res.status(400).json({ error: "Not enough EduCoins" });
      const updated = await storage.updateUser(req.userId!, { eduCoins: user.eduCoins - amount });
      const { password: _, ...safeUser } = updated;
      res.json({ user: { ...safeUser, tier: getTier(safeUser.xp) } });
    } catch {
      res.status(500).json({ error: "Spend failed" });
    }
  });

  return httpServer;
}
