import type { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

export function securityMiddleware() {
  // Keep config conservative for production.
  return [
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    // Minimal request logging / error shaping is already handled by pino-http.
    (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      next();
    },
  ];
}

