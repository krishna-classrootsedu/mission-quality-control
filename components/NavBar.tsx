"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

const NAV_LINKS = [
  { href: "/board", label: "Board" },
  { href: "/upload", label: "Upload" },
  { href: "/usage", label: "Usage" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const me = useQuery(api.users.me);
  const upsertSelf = useMutation(api.users.upsertSelf);
  const requestPasswordReset = useMutation(api.users.requestPasswordReset);
  const resetPasswordWithToken = useMutation(api.users.resetPasswordWithToken);
  const changeFirstLoginPassword = useMutation(api.users.changeFirstLoginPassword);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authFlow, setAuthFlow] = useState<"signIn" | "resetRequest" | "resetVerify">("signIn");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [firstLoginPassword, setFirstLoginPassword] = useState("");
  const [firstLoginConfirm, setFirstLoginConfirm] = useState("");
  const [firstLoginError, setFirstLoginError] = useState<string | null>(null);
  const [firstLoginLoading, setFirstLoginLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      void upsertSelf({});
      setShowAuthModal(false);
    }
  }, [isAuthenticated, upsertSelf]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setShowAuthModal(false);
      }
    }
    if (showAuthModal) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAuthModal]);

  async function handleAuthSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthError(null);
    setAuthMessage(null);
    setAuthLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      if (authFlow === "signIn") {
        formData.set("flow", "signIn");
        await signIn("password", formData);
      } else if (authFlow === "resetRequest") {
        const email = String(formData.get("email") ?? "");
        const result = await requestPasswordReset({ email });
        setResetToken(result.resetToken ?? null);
        setAuthMessage(
          result.resetToken
            ? `Reset token generated: ${result.resetToken}`
            : "If the email exists, a reset token has been issued."
        );
        setAuthFlow("resetVerify");
      } else {
        const token = String(formData.get("token") ?? "");
        const newPassword = String(formData.get("newPassword") ?? "");
        await resetPasswordWithToken({ token, newPassword });
        setAuthMessage("Password updated. Sign in with your new password.");
        setAuthFlow("signIn");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleFirstLoginPasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFirstLoginError(null);
    if (firstLoginPassword.length < 8) {
      setFirstLoginError("Password must be at least 8 characters.");
      return;
    }
    if (firstLoginPassword !== firstLoginConfirm) {
      setFirstLoginError("Passwords do not match.");
      return;
    }
    setFirstLoginLoading(true);
    try {
      await changeFirstLoginPassword({ newPassword: firstLoginPassword });
      await signOut();
      setShowAuthModal(true);
      setAuthFlow("signIn");
      setAuthMessage("Password changed. Please sign in again.");
      setFirstLoginPassword("");
      setFirstLoginConfirm("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not update password";
      setFirstLoginError(msg);
    } finally {
      setFirstLoginLoading(false);
    }
  }

  return (
    <>
      <nav className="bg-stone-50/90 backdrop-blur-xl border-b border-stone-200/60 h-12 sticky top-0 z-20">
        <div className="h-full max-w-[1400px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/board" className="text-sm font-semibold text-stone-800 tracking-tight">
              Mission QC
            </Link>
            <div className="w-px h-5 bg-stone-200 mx-4" />
            <div className="flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "text-stone-900"
                        : "text-stone-400 hover:text-stone-600"
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-stone-800 rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isLoading && isAuthenticated && me?.role && (
              <span className="text-[11px] text-stone-500 uppercase tracking-[0.06em]">
                {me.role.replace("_", " ")}
              </span>
            )}
            {!isLoading && !isAuthenticated ? (
              <button
                onClick={() => {
                  setShowAuthModal(true);
                  setAuthFlow("signIn");
                  setAuthError(null);
                  setAuthMessage(null);
                }}
                className="px-3 py-1.5 text-xs rounded-md border border-stone-200 text-stone-600 hover:bg-stone-100"
              >
                Sign In
              </button>
            ) : !isLoading ? (
              <button
                onClick={() => void signOut()}
                className="px-3 py-1.5 text-xs rounded-md border border-stone-200 text-stone-600 hover:bg-stone-100"
              >
                Sign Out
              </button>
            ) : null}
          </div>
        </div>
      </nav>

      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div ref={modalRef} className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 mx-4">
            <h2 className="text-lg font-semibold text-stone-800 mb-4">
              {authFlow === "signIn"
                ? "Sign In"
                : authFlow === "resetRequest"
                ? "Reset Password"
                : "Set New Password"}
            </h2>
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <input
                name="email"
                type="email"
                placeholder="Email"
                required
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
              {authFlow === "signIn" && (
                <input
                  name="password"
                  type="password"
                  placeholder="Password"
                  required
                  minLength={8}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
                />
              )}
              {authFlow === "resetVerify" && (
                <>
                  <input
                    name="token"
                    type="text"
                    placeholder="Reset token"
                    required
                    defaultValue={resetToken ?? ""}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  <input
                    name="newPassword"
                    type="password"
                    placeholder="New password"
                    required
                    minLength={8}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                </>
              )}
              {authError && (
                <p className="text-xs text-red-600">{authError}</p>
              )}
              {authMessage && (
                <p className="text-xs text-emerald-700">{authMessage}</p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2 text-sm font-medium rounded-lg bg-stone-800 text-white hover:bg-stone-700 disabled:opacity-50"
              >
                {authLoading
                  ? "Please wait..."
                  : authFlow === "signIn"
                  ? "Sign In"
                  : authFlow === "resetRequest"
                  ? "Generate Reset Token"
                  : "Update Password"}
              </button>
            </form>
            <div className="mt-3 flex flex-col gap-2">
              {authFlow !== "signIn" && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthFlow("signIn");
                    setAuthError(null);
                    setAuthMessage(null);
                  }}
                  className="w-full text-center text-xs text-stone-500 hover:text-stone-700"
                >
                  Back to sign in
                </button>
              )}
              {authFlow === "signIn" && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthFlow("resetRequest");
                    setAuthError(null);
                    setAuthMessage(null);
                  }}
                  className="w-full text-center text-xs text-stone-500 hover:text-stone-700"
                >
                  Forgot password?
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!isLoading && isAuthenticated && me?.isFirstLogin && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 mx-4">
            <h2 className="text-lg font-semibold text-stone-800 mb-1">Change your password</h2>
            <p className="text-xs text-stone-500 mb-4">
              This is your first login. You must set a new password before using the app.
            </p>
            <form onSubmit={handleFirstLoginPasswordChange} className="space-y-3">
              <input
                type="password"
                placeholder="New password"
                value={firstLoginPassword}
                onChange={(e) => setFirstLoginPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={firstLoginConfirm}
                onChange={(e) => setFirstLoginConfirm(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
              />
              {firstLoginError && <p className="text-xs text-red-600">{firstLoginError}</p>}
              <button
                type="submit"
                disabled={firstLoginLoading}
                className="w-full py-2 text-sm font-medium rounded-lg bg-stone-800 text-white hover:bg-stone-700 disabled:opacity-50"
              >
                {firstLoginLoading ? "Saving..." : "Update password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
