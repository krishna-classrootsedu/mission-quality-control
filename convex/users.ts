import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireAnyRole, requireCurrentUser, ROLES } from "./lib/authz";
import {
  createAccount,
  getAuthUserId,
  invalidateSessions,
  modifyAccountCredentials,
} from "@convex-dev/auth/server";

const ROLE_VALIDATOR = v.union(
  v.literal(ROLES.CONTENT_CREATOR),
  v.literal(ROLES.LEAD_REVIEWER),
  v.literal(ROLES.MANAGER),
  v.literal(ROLES.ADMIN)
);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken() {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  return Array.from(random, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function getNormalizedEmailForUser(
  ctx: any,
  userId: Id<"users">
) {
  const user = await ctx.db.get(userId);
  if (user?.email) {
    return normalizeEmail(user.email);
  }

  const passwordAccount = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q: any) => q.eq("userId", userId).eq("provider", "password"))
    .first();
  const providerEmail = passwordAccount?.providerAccountId
    ? normalizeEmail(passwordAccount.providerAccountId)
    : null;

  if (providerEmail && !user?.email) {
    await ctx.db.patch(userId, { email: providerEmail });
  }

  return providerEmail;
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile || !profile.isActive) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      role: profile.role,
      isFirstLogin: profile.isFirstLogin ?? false,
      isActive: profile.isActive,
    };
  },
});

export const upsertSelf = mutation({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const now = new Date().toISOString();
    const userPatch: { email?: string; name?: string } = {};
    if (args.email !== undefined) {
      userPatch.email = normalizeEmail(args.email);
    }
    if (args.name !== undefined) {
      userPatch.name = args.name;
    }
    if (Object.keys(userPatch).length > 0) {
      await ctx.db.patch(userId, userPatch);
    }
    const existingProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, { updatedAt: now });
      return { action: "updated", userId };
    }
    await ctx.db.insert("userProfiles", {
      userId,
      role: ROLES.CONTENT_CREATOR,
      isFirstLogin: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return { action: "created", userId };
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAnyRole(ctx, [ROLES.ADMIN]);
    const profiles = await ctx.db.query("userProfiles").collect();
    const users = await Promise.all(profiles.map((p) => ctx.db.get(p.userId)));
    return profiles.map((p, idx) => ({
      userId: p.userId,
      role: p.role,
      isFirstLogin: p.isFirstLogin ?? false,
      isActive: p.isActive,
      name: users[idx]?.name ?? null,
      email: users[idx]?.email ?? null,
    }));
  },
});

export const createUser = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    role: ROLE_VALIDATOR,
    defaultPassword: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAnyRole(ctx, [ROLES.ADMIN]);
    const now = new Date().toISOString();
    const email = normalizeEmail(args.email);
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (existing) {
      throw new Error("User with this email already exists");
    }

    const temporaryPassword = args.defaultPassword ?? `LaunchSpace-${crypto.randomUUID().slice(0, 8)}`;
    const { user } = await createAccount(ctx as unknown as Parameters<typeof createAccount>[0], {
      provider: "password",
      account: { id: email, secret: temporaryPassword },
      profile: args.name ? { email, name: args.name } : { email },
      shouldLinkViaEmail: false,
      shouldLinkViaPhone: false,
    });

    await ctx.db.insert("userProfiles", {
      userId: user._id,
      role: args.role,
      isFirstLogin: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.insert("auditAuthEvents", {
      actorUserId: actor._id,
      targetUserId: user._id,
      action: "user_created",
      metadata: { email, role: args.role, isFirstLogin: true },
      createdAt: now,
    });

    return {
      success: true,
      userId: user._id,
      email,
      temporaryPassword,
      isFirstLogin: true,
    };
  },
});

export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: ROLE_VALIDATOR,
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAnyRole(ctx, [ROLES.ADMIN]);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    const now = new Date().toISOString();
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (profile) {
      await ctx.db.patch(profile._id, {
        role: args.role,
        isActive: args.isActive ?? profile.isActive,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId: args.userId,
        role: args.role,
        isFirstLogin: false,
        isActive: args.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("auditAuthEvents", {
      actorUserId: actor._id,
      targetUserId: target._id,
      action: "role_changed",
      metadata: { role: args.role, isActive: args.isActive ?? profile?.isActive ?? true },
      createdAt: now,
    });

    return { success: true };
  },
});

export const changeFirstLoginPassword = mutation({
  args: {
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const current = await requireCurrentUser(ctx, { allowFirstLogin: true });
    if (!current.isFirstLogin) {
      throw new Error("Password change is only required during first login");
    }
    const email = await getNormalizedEmailForUser(ctx as any, current._id);
    if (!email) throw new Error("Account email is missing");

    await modifyAccountCredentials(ctx as unknown as Parameters<typeof modifyAccountCredentials>[0], {
      provider: "password",
      account: { id: normalizeEmail(email), secret: args.newPassword },
    });

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", current._id))
      .first();
    if (profile) {
      await ctx.db.patch(profile._id, {
        isFirstLogin: false,
        updatedAt: new Date().toISOString(),
      });
    }

    await invalidateSessions(ctx as unknown as Parameters<typeof invalidateSessions>[0], { userId: current._id });
    return { success: true, mustSignInAgain: true };
  },
});

export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    // Return a generic response regardless of user existence.
    if (!user) {
      return { success: true };
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!profile || !profile.isActive) {
      return { success: true };
    }

    const now = new Date();
    const token = generateToken();
    const tokenHash = await hashToken(token);

    const existing = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.insert("passwordResetTokens", {
      userId: user._id,
      tokenHash,
      expiresAt: new Date(now.getTime() + 1000 * 60 * 15).toISOString(),
      createdAt: now.toISOString(),
    });

    await ctx.db.insert("auditAuthEvents", {
      targetUserId: user._id,
      action: "password_reset_requested",
      createdAt: now.toISOString(),
    });

    return {
      success: true,
      // For internal tooling flows, the UI can display or deliver this token.
      resetToken: process.env.NODE_ENV === "production" ? undefined : token,
    };
  },
});

export const resetPasswordWithToken = mutation({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const tokenHash = await hashToken(args.token);
    const reset = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (!reset || reset.usedAt) {
      throw new Error("Invalid or already used reset token");
    }
    if (new Date(reset.expiresAt).getTime() < Date.now()) {
      throw new Error("Reset token has expired");
    }

    const user = await ctx.db.get(reset.userId);
    const email = await getNormalizedEmailForUser(ctx as any, reset.userId);
    if (!user || !email) {
      throw new Error("Associated user not found");
    }

    await modifyAccountCredentials(ctx as unknown as Parameters<typeof modifyAccountCredentials>[0], {
      provider: "password",
      account: { id: normalizeEmail(email), secret: args.newPassword },
    });

    await ctx.db.patch(reset._id, { usedAt: now });

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (profile) {
      await ctx.db.patch(profile._id, { isFirstLogin: false, updatedAt: now });
    }

    await invalidateSessions(ctx as unknown as Parameters<typeof invalidateSessions>[0], { userId: user._id });
    await ctx.db.insert("auditAuthEvents", {
      targetUserId: user._id,
      action: "password_reset_completed",
      createdAt: now,
    });

    return { success: true, mustSignInAgain: true };
  },
});

// Operational utility for direct role updates from Convex CLI.
export const setUserRoleByEmailInternal = internalMutation({
  args: {
    email: v.string(),
    role: ROLE_VALIDATOR,
    isFirstLogin: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    createIfMissing: v.optional(v.boolean()),
    defaultPassword: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const email = normalizeEmail(args.email);
    let user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();

    if (!user) {
      const existingPasswordAccount = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", email)
        )
        .first();
      if (existingPasswordAccount) {
        user = await ctx.db.get(existingPasswordAccount.userId);
        if (user && user.email !== email) {
          await ctx.db.patch(user._id, { email });
          user = await ctx.db.get(user._id);
        }
      }
    }

    if (!user && args.createIfMissing) {
      const temporaryPassword =
        args.defaultPassword ?? `LaunchSpace-${crypto.randomUUID().slice(0, 8)}`;
      const created = await createAccount(
        ctx as unknown as Parameters<typeof createAccount>[0],
        {
          provider: "password",
          account: { id: email, secret: temporaryPassword },
          profile: args.name ? { email, name: args.name } : { email },
          shouldLinkViaEmail: false,
          shouldLinkViaPhone: false,
        }
      );
      user = created.user;
    }

    if (!user) {
      throw new Error(
        `User not found for email: ${email}. Set createIfMissing=true to create it.`
      );
    }

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();

    if (profile) {
      await ctx.db.patch(profile._id, {
        role: args.role,
        isFirstLogin: args.isFirstLogin ?? profile.isFirstLogin ?? false,
        isActive: args.isActive ?? profile.isActive,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userProfiles", {
        userId: user._id,
        role: args.role,
        isFirstLogin: args.isFirstLogin ?? false,
        isActive: args.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("auditAuthEvents", {
      targetUserId: user._id,
      action: "internal_role_changed",
      metadata: {
        email,
        role: args.role,
        isFirstLogin: args.isFirstLogin,
        isActive: args.isActive,
      },
      createdAt: now,
    });

    return {
      success: true,
      userId: user._id,
      email,
      role: args.role,
      isFirstLogin: args.isFirstLogin ?? profile?.isFirstLogin ?? false,
      isActive: args.isActive ?? profile?.isActive ?? true,
      createdUser: Boolean(args.createIfMissing && !profile && args.defaultPassword),
    };
  },
});

export const grantModulePermissions = mutation({
  args: {
    moduleId: v.string(),
    userId: v.id("users"),
    permissions: v.array(v.string()),
    grantSource: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAnyRole(ctx, [ROLES.ADMIN, ROLES.MANAGER]);
    const now = new Date().toISOString();
    const existing = await ctx.db
      .query("modulePermissions")
      .withIndex("by_moduleId_userId", (q) => q.eq("moduleId", args.moduleId).eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        permissions: args.permissions,
        grantSource: args.grantSource,
        expiresAt: args.expiresAt,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("modulePermissions", {
        moduleId: args.moduleId,
        userId: args.userId,
        permissions: args.permissions,
        grantSource: args.grantSource,
        expiresAt: args.expiresAt,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("auditAuthEvents", {
      actorUserId: actor._id,
      targetUserId: args.userId,
      moduleId: args.moduleId,
      action: "permission_granted",
      metadata: { permissions: args.permissions, expiresAt: args.expiresAt },
      createdAt: now,
    });
    return { success: true };
  },
});

export const revokeModulePermissions = mutation({
  args: {
    moduleId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await requireAnyRole(ctx, [ROLES.ADMIN, ROLES.MANAGER]);
    const existing = await ctx.db
      .query("modulePermissions")
      .withIndex("by_moduleId_userId", (q) => q.eq("moduleId", args.moduleId).eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    await ctx.db.insert("auditAuthEvents", {
      actorUserId: actor._id,
      targetUserId: args.userId,
      moduleId: args.moduleId,
      action: "permission_revoked",
      createdAt: new Date().toISOString(),
    });
    return { success: true };
  },
});

