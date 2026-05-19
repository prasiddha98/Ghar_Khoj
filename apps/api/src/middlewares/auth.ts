import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: number;
  role: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const JWT_ALG = (process.env.JWT_ALG ?? "HS256") as jwt.Algorithm;
const JWT_SECRET = process.env.JWT_SECRET;

function getSecretOrThrow(): string {
  if (!JWT_SECRET) {
    throw new Error(
      "JWT_SECRET environment variable is required for auth."
    );
  }
  return JWT_SECRET;
}

export function signAccessToken(user: AuthUser): string {
  const secret = getSecretOrThrow();
  const payload = { sub: String(user.id), role: user.role };

  const ttlSeconds = Number(process.env.JWT_TTL_SECONDS ?? 60 * 60 * 24); // default 24h

  return jwt.sign(payload, secret, {
    algorithm: JWT_ALG,
    expiresIn: ttlSeconds,
  });
}

export function authRequired(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "unauthorized", message: "Missing bearer token" });
      return;
    }

    const token = header.slice("Bearer ".length).trim();
    const secret = getSecretOrThrow();

    const decoded = jwt.verify(token, secret, { algorithms: [JWT_ALG] }) as {
      sub?: string;
      role?: string;
    };

    const id = decoded.sub ? Number(decoded.sub) : NaN;
    const role = decoded.role;

    if (!id || Number.isNaN(id) || !role) {
      res.status(401).json({ error: "unauthorized", message: "Invalid token" });
      return;
    }

    req.user = { id, role };
    next();
  } catch (_err) {
    res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized", message: "Missing auth" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "forbidden", message: "Insufficient role" });
      return;
    }
    next();
  };
}

export function requireSelfParam(paramName: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "unauthorized", message: "Missing auth" });
      return;
    }

    const raw = req.params[paramName];
    const id = Number(raw);
    if (!raw || Number.isNaN(id)) {
      res.status(400).json({ error: "validation_error", message: `Invalid ${paramName}` });
      return;
    }

    // allow admins to access other users' data
    if (id !== req.user.id && req.user.role !== "admin") {
      res.status(403).json({ error: "forbidden", message: "Cannot access other user's data" });
      return;
    }

    next();
  };
}

