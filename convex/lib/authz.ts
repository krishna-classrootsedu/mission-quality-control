import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";

type Ctx = MutationCtx | QueryCtx;

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  LEAD_REVIEWER: "lead_reviewer",
  CONTENT_CREATOR: "content_creator",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

type AppUser = {
  _id: Id<"users">;
  role: string;
  isFirstLogin: boolean;
  isActive: boolean;
};

export async function requireCurrentUser(
  ctx: Ctx,
  options?: { allowFirstLogin?: boolean }
): Promise<AppUser> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Unauthorized: sign in required");
  }
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
  if (!profile || !profile.isActive) {
    throw new Error("Unauthorized: no active user profile");
  }
  const isFirstLogin = profile.isFirstLogin ?? false;
  if (!options?.allowFirstLogin && isFirstLogin) {
    throw new Error("Password change required");
  }
  return { _id: userId, role: profile.role, isFirstLogin, isActive: profile.isActive };
}

export async function requireAnyRole(ctx: Ctx, allowedRoles: string[]): Promise<AppUser> {
  const user = await requireCurrentUser(ctx);
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden: insufficient role");
  }
  return user;
}

async function hasOverridePermission(ctx: Ctx, moduleId: string, permission: string): Promise<boolean> {
  const user = await requireCurrentUser(ctx);
  const override = await ctx.db
    .query("modulePermissions")
    .withIndex("by_moduleId_userId", (q) => q.eq("moduleId", moduleId).eq("userId", user._id))
    .first();
  if (!override) return false;
  if (override.expiresAt && new Date(override.expiresAt).getTime() < Date.now()) return false;
  return override.permissions.includes(permission);
}

export async function canAccessModule(ctx: Ctx, moduleId: string): Promise<boolean> {
  const user = await requireCurrentUser(ctx);
  if (
    user.role === ROLES.ADMIN ||
    user.role === ROLES.MANAGER ||
    user.role === ROLES.LEAD_REVIEWER ||
    user.role === ROLES.CONTENT_CREATOR
  ) {
    return true;
  }
  return hasOverridePermission(ctx, moduleId, "module:view");
}

export async function canReviewModule(ctx: Ctx, moduleId: string): Promise<boolean> {
  const user = await requireCurrentUser(ctx);
  if (
    user.role === ROLES.ADMIN ||
    user.role === ROLES.MANAGER ||
    user.role === ROLES.LEAD_REVIEWER
  ) {
    return true;
  }
  return hasOverridePermission(ctx, moduleId, "module:review");
}

export async function canDeleteModule(ctx: Ctx, moduleId: string): Promise<boolean> {
  const user = await requireCurrentUser(ctx);
  if (user.role === ROLES.ADMIN || user.role === ROLES.MANAGER) return true;
  return hasOverridePermission(ctx, moduleId, "module:delete");
}

