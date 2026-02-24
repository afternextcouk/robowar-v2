import { Router, Request, Response, NextFunction } from "express";
import { body, param, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { ethers } from "ethers";
import crypto from "crypto";
import { query, queryOne } from "../db";
import { getRedis } from "../config/redis";
import { AppError } from "../middleware/errorHandler";
import type { User } from "../models/types";

export const authRouter = Router();

// ─── JWT Secret guards (YPY-48) ───────────────────────────────────────────────
// Note: startup-level guard is in index.ts — these runtime checks ensure no
// fallback secret ever signs a token.
function getJwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET env var is required");
  return s;
}
function getJwtRefreshSecret(): string {
  const s = process.env.JWT_REFRESH_SECRET;
  if (!s) throw new Error("JWT_REFRESH_SECRET env var is required");
  return s;
}

// ─── Nonce prefix for Redis keys ─────────────────────────────────────────────
const NONCE_PREFIX = "metamask:nonce:";
const REFRESH_PREFIX = "auth:refresh:";
const NONCE_TTL = 5 * 60; // 5 minutes
const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

const generateTokens = (user: User) => {
  const refreshId = uuid();
  const access = jwt.sign(
    { sub: user.id, username: user.username },
    getJwtSecret(),
    { expiresIn: "15m" }
  );
  const refresh = jwt.sign(
    { sub: user.id, jti: refreshId },
    getJwtRefreshSecret(),
    { expiresIn: "7d" }
  );
  return { access, refresh, refreshId };
};

// POST /auth/register
authRouter.post(
  "/register",
  [
    body("username").trim().isLength({ min: 3, max: 32 }).isAlphanumeric(),
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError("VALIDATION_ERROR", errors.array()[0].msg, 400);
      }

      const { username, email, password } = req.body as { username: string; email: string; password: string };
      const existing = await queryOne("SELECT id FROM users WHERE email = $1 OR username = $2", [email, username]);
      if (existing) throw new AppError("VALIDATION_ERROR", "Email or username already taken", 409);

      const password_hash = await bcrypt.hash(password, 12);
      const [user] = await query<User>(
        `INSERT INTO users (id, username, email, password_hash, gmo_balance)
         VALUES ($1, $2, $3, $4, 1000) RETURNING *`,
        [uuid(), username, email, password_hash]
      );

      const { access, refresh, refreshId } = generateTokens(user);
      // Store refresh token ID in Redis so we can invalidate it on logout
      await getRedis().setex(`${REFRESH_PREFIX}${refreshId}`, REFRESH_TTL, user.id);
      res.cookie("refresh_token", refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        user: { id: user.id, username: user.username, level: 1, gmo_balance: 1000 },
        access_token: access,
        expires_in: 900,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /auth/login
authRouter.post(
  "/login",
  [body("email").isEmail(), body("password").notEmpty()],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const user = await queryOne<User>("SELECT * FROM users WHERE email = $1", [email]);
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        throw new AppError("UNAUTHORIZED", "Invalid credentials", 401);
      }
      if (user.is_banned) throw new AppError("USER_BANNED", "Account is banned", 403);

      await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

      const { access, refresh, refreshId } = generateTokens(user);
      await getRedis().setex(`${REFRESH_PREFIX}${refreshId}`, REFRESH_TTL, user.id);
      res.cookie("refresh_token", refresh, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 7 * 86_400_000 });

      res.json({
        user: { id: user.id, username: user.username, level: user.level, gmo_balance: user.gmo_balance },
        access_token: access,
        expires_in: 900,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /auth/refresh — YPY-47: validate refresh token from Redis
authRouter.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token;
    if (!token) throw new AppError("UNAUTHORIZED", "No refresh token", 401);

    let payload: { sub: string; jti?: string };
    try {
      payload = jwt.verify(token, getJwtRefreshSecret()) as { sub: string; jti?: string };
    } catch {
      throw new AppError("UNAUTHORIZED", "Invalid or expired refresh token", 401);
    }

    // Validate that the token hasn't been invalidated in Redis
    if (payload.jti) {
      const stored = await getRedis().get(`${REFRESH_PREFIX}${payload.jti}`);
      if (!stored) throw new AppError("UNAUTHORIZED", "Refresh token revoked", 401);
    }

    const user = await queryOne<User>("SELECT * FROM users WHERE id = $1", [payload.sub]);
    if (!user) throw new AppError("UNAUTHORIZED", "User not found", 401);
    if (user.is_banned) throw new AppError("USER_BANNED", "Account is banned", 403);

    // Rotate: invalidate old, issue new
    if (payload.jti) {
      await getRedis().del(`${REFRESH_PREFIX}${payload.jti}`);
    }
    const { access, refresh, refreshId } = generateTokens(user);
    await getRedis().setex(`${REFRESH_PREFIX}${refreshId}`, REFRESH_TTL, user.id);

    res.cookie("refresh_token", refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: REFRESH_TTL * 1000,
    });
    res.json({ access_token: access, expires_in: 900 });
  } catch (err) {
    next(err);
  }
});

// POST /auth/logout — YPY-47: invalidate refresh token in Redis
authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token;
    if (token) {
      try {
        const payload = jwt.verify(token, getJwtRefreshSecret()) as { jti?: string };
        if (payload.jti) {
          await getRedis().del(`${REFRESH_PREFIX}${payload.jti}`);
        }
      } catch {
        // Token already invalid; still clear the cookie
      }
    }
    res.clearCookie("refresh_token");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── MetaMask Wallet Auth (YPY-47) ───────────────────────────────────────────

/**
 * GET /api/auth/nonce/:address
 * Generate a random nonce and store in Redis (TTL 5 min).
 * Returns { nonce, message } for the client to sign.
 */
authRouter.get(
  "/nonce/:address",
  [param("address").matches(/^0x[0-9a-fA-F]{40}$/).withMessage("Invalid Ethereum address")],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError("VALIDATION_ERROR", errors.array()[0].msg, 400);
      }

      const address = req.params.address.toLowerCase();
      const nonce = crypto.randomBytes(16).toString("hex");
      const message = `Sign this message to login to ROBOWAR: ${nonce}`;

      await getRedis().setex(`${NONCE_PREFIX}${address}`, NONCE_TTL, nonce);

      res.json({ nonce, message });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/auth/verify
 * Body: { address, signature }
 * Verifies MetaMask signature, invalidates nonce, issues JWT tokens.
 */
authRouter.post(
  "/verify",
  [
    body("address").matches(/^0x[0-9a-fA-F]{40}$/).withMessage("Invalid Ethereum address"),
    body("signature").notEmpty().withMessage("Signature is required"),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError("VALIDATION_ERROR", errors.array()[0].msg, 400);
      }

      const { address, signature } = req.body as { address: string; signature: string };
      const normalizedAddress = address.toLowerCase();

      // Retrieve nonce from Redis
      const nonce = await getRedis().get(`${NONCE_PREFIX}${normalizedAddress}`);
      if (!nonce) {
        throw new AppError("UNAUTHORIZED", "Nonce expired or not found. Request a new one.", 401);
      }

      const message = `Sign this message to login to ROBOWAR: ${nonce}`;

      // Verify the signature
      let recoveredAddress: string;
      try {
        recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
      } catch {
        throw new AppError("UNAUTHORIZED", "Signature verification failed", 401);
      }

      if (recoveredAddress !== normalizedAddress) {
        throw new AppError("UNAUTHORIZED", "Signature does not match address", 401);
      }

      // Invalidate the nonce immediately (single-use)
      await getRedis().del(`${NONCE_PREFIX}${normalizedAddress}`);

      // Upsert user by wallet address
      let user = await queryOne<User>(
        "SELECT * FROM users WHERE wallet_address = $1",
        [normalizedAddress]
      );

      if (!user) {
        // Auto-register new wallet user
        const newUser = await queryOne<User>(
          `INSERT INTO users (id, username, wallet_address, gmo_balance)
           VALUES ($1, $2, $3, 1000) RETURNING *`,
          [uuid(), `player_${nonce.slice(0, 8)}`, normalizedAddress]
        );
        if (!newUser) throw new AppError("SERVER_ERROR", "Failed to create user", 500);
        user = newUser;
      }

      if (user.is_banned) throw new AppError("USER_BANNED", "Account is banned", 403);

      await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

      // Issue tokens
      const { access, refresh, refreshId } = generateTokens(user);
      await getRedis().setex(`${REFRESH_PREFIX}${refreshId}`, REFRESH_TTL, user.id);

      res.cookie("refresh_token", refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: REFRESH_TTL * 1000,
      });

      res.json({
        user: {
          id: user.id,
          username: user.username,
          wallet_address: normalizedAddress,
          level: user.level ?? 1,
          gmo_balance: user.gmo_balance ?? 1000,
        },
        access_token: access,
        expires_in: 900,
      });
    } catch (err) {
      next(err);
    }
  }
);
