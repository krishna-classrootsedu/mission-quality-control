import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { QueryCtx } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      validatePasswordRequirements: (password) => {
        if (!password || password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }
      },
      profile: (params) => {
        const flow = String(params.flow ?? "");
        if (flow === "signUp") {
          throw new Error("Self sign-up is disabled. Contact an admin.");
        }
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!email) {
          throw new Error("Email is required");
        }
        return { email };
      },
    }),
  ],
  callbacks: {
    async beforeSessionCreation(ctx, { userId }) {
      const profile = await (ctx.db as QueryCtx["db"])
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();
      if (!profile || !profile.isActive) {
        throw new Error("Your account is not active. Contact an admin.");
      }
    },
  },
});

