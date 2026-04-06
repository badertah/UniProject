import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run migrations and seed
  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 1,
        streak INTEGER NOT NULL DEFAULT 0,
        last_login_date TEXT,
        edu_coins INTEGER NOT NULL DEFAULT 100,
        equipped_avatar VARCHAR,
        equipped_frame VARCHAR,
        equipped_theme VARCHAR,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS topics (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'BookOpen',
        color TEXT NOT NULL DEFAULT 'from-blue-500 to-purple-600',
        order_index INTEGER NOT NULL DEFAULT 0
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS levels (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_id VARCHAR NOT NULL REFERENCES topics(id),
        level_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        game_type TEXT NOT NULL,
        xp_reward INTEGER NOT NULL DEFAULT 50,
        coin_reward INTEGER NOT NULL DEFAULT 10,
        difficulty TEXT NOT NULL DEFAULT 'easy'
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        level_id VARCHAR NOT NULL,
        content TEXT NOT NULL,
        answer TEXT NOT NULL,
        options JSONB,
        hint TEXT,
        order_index INTEGER NOT NULL DEFAULT 0
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        level_id VARCHAR NOT NULL REFERENCES levels(id),
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        score INTEGER NOT NULL DEFAULT 0,
        completed_at TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cosmetics (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        price INTEGER NOT NULL,
        icon TEXT NOT NULL,
        description TEXT NOT NULL,
        rarity TEXT NOT NULL DEFAULT 'common'
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_cosmetics (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR NOT NULL REFERENCES users(id),
        cosmetic_id VARCHAR NOT NULL REFERENCES cosmetics(id),
        unlocked_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.end();
    log("Database schema ready", "db");

    const { seedDatabase, seedNewGameTypes } = await import("./seed");
    await seedDatabase();
    await seedNewGameTypes();
  } catch (e) {
    console.error("DB setup error:", e);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
