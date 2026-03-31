import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { MutationCtx, QueryCtx } from "./_generated/server";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function enforceLoginAttemptLimit(db: MutationCtx["db"], email: string) {
  const key = `login-attempt:${normalizeEmail(email)}`;
  const nowIso = new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();
  const existing = await db
    .query("passwordResetRateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (!existing || nowMs - new Date(existing.windowStart).getTime() >= LOGIN_WINDOW_MS) {
    if (existing) {
      await db.patch(existing._id, {
        count: 1,
        windowStart: nowIso,
        updatedAt: nowIso,
      });
    } else {
      await db.insert("passwordResetRateLimits", {
        key,
        count: 1,
        windowStart: nowIso,
        updatedAt: nowIso,
      });
    }
    return;
  }

  if (existing.count >= LOGIN_MAX_ATTEMPTS) {
    throw new Error("Too many login attempts. Please try again in a few minutes.");
  }

  await db.patch(existing._id, {
    count: existing.count + 1,
    updatedAt: nowIso,
  });
}

async function clearLoginAttemptLimit(db: MutationCtx["db"], email: string) {
  const key = `login-attempt:${normalizeEmail(email)}`;
  const existing = await db
    .query("passwordResetRateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  if (existing) {
    await db.delete(existing._id);
  }
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      validatePasswordRequirements: (password) => {
        if (!password || password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }
      },
      profile: async (params, ctx) => {
        const flow = String(params.flow ?? "");
        if (flow === "signUp") {
          throw new Error("Self sign-up is disabled. Contact an admin.");
        }
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!email) {
          throw new Error("Email is required");
        }
        if (flow === "signIn") {
          await enforceLoginAttemptLimit(ctx.db as MutationCtx["db"], email);
        }
        return { email };
      },
    }),
  ],
  callbacks: {
    async beforeSessionCreation(ctx, { userId }) {
      const db = ctx.db as MutationCtx["db"];
      const profile = await (db as QueryCtx["db"])
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!profile || !profile.isActive) {
        throw new Error("Your account is not active. Contact an admin.");
      }
      const user = await db.get(userId);
      if (user?.email) {
        await clearLoginAttemptLimit(db, user.email);
      }
    },
  },
});

