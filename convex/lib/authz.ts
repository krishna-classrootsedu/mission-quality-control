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

export async function requireAnyRole(
  ctx: Ctx,
  allowedRoles: string[],
  options?: { allowFirstLogin?: boolean }
): Promise<AppUser> {
  const user = await requireCurrentUser(ctx, options);
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden: insufficient role");
  }
  return user;
}

async function hasOverridePermission(
  ctx: Ctx,
  moduleId: string,
  permission: string,
  userId: Id<"users">
): Promise<boolean> {
  const override = await ctx.db
    .query("modulePermissions")
    .withIndex("by_moduleId_userId", (q) => q.eq("moduleId", moduleId).eq("userId", userId))
    .first();
  if (!override) return false;
  if (override.expiresAt && new Date(override.expiresAt).getTime() < Date.now()) return false;
  return override.permissions.includes(permission);
}

export async function canAccessModule(ctx: Ctx, moduleId: string): Promise<boolean> {
  const user = await requireCurrentUser(ctx, { allowFirstLogin: true });
  if (user.role === ROLES.ADMIN || user.role === ROLES.MANAGER) return true;

  if (user.role === ROLES.LEAD_REVIEWER) {
    const perm = await ctx.db
      .query("modulePermissions")
      .withIndex("by_moduleId_userId", (q) => q.eq("moduleId", moduleId).eq("userId", user._id))
      .first();
    if (perm && (!perm.expiresAt || new Date(perm.expiresAt).getTime() >= Date.now())) return true;
    return false;
  }

  if (user.role === ROLES.CONTENT_CREATOR) {
    const mod = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .first();
    return mod?.submittedByUserId === user._id;
  }

  return hasOverridePermission(ctx, moduleId, "module:view", user._id);
}

/**
 * Returns module docs filtered by the user's role:
 * - admin/manager: all non-deleted modules
 * - lead_reviewer: only modules allocated via modulePermissions
 * - content_creator: only modules they submitted
 */
export async function getModulesForUser(ctx: Ctx): Promise<{ user: AppUser; modules: any[] }> {
  const user = await requireCurrentUser(ctx, { allowFirstLogin: true });
  const all = await ctx.db.query("modules").order("desc").take(500);
  const active = all.filter((m) => !m.deleted);

  if (user.role === ROLES.ADMIN || user.role === ROLES.MANAGER) {
    return { user, modules: active };
  }

  if (user.role === ROLES.LEAD_REVIEWER) {
    const perms = await ctx.db
      .query("modulePermissions")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const now = Date.now();
    const allocatedModuleIds = new Set(
      perms
        .filter((p) => !p.expiresAt || new Date(p.expiresAt).getTime() >= now)
        .map((p) => p.moduleId)
    );
    return { user, modules: active.filter((m) => allocatedModuleIds.has(m.moduleId)) };
  }

  if (user.role === ROLES.CONTENT_CREATOR) {
    return { user, modules: active.filter((m) => m.submittedByUserId === user._id) };
  }

  return { user, modules: [] };
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
  return hasOverridePermission(ctx, moduleId, "module:review", user._id);
}

export async function canDeleteModule(ctx: Ctx, moduleId: string): Promise<boolean> {
  const user = await requireCurrentUser(ctx);
  if (user.role === ROLES.ADMIN || user.role === ROLES.MANAGER) return true;
  return hasOverridePermission(ctx, moduleId, "module:delete", user._id);
}

