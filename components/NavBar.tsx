"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";
import ScoreBandBadge from "./ScoreBandBadge";

const BAND_LEGEND = [
  { key: "ship_ready", range: "90–100" },
  { key: "upgradeable", range: "75–89" },
  { key: "rework", range: "50–74" },
  { key: "redesign", range: "0–49" },
];

type NavLink = { href: string; label: string; roles?: string[] };

const NAV_LINKS: NavLink[] = [
  { href: "/board", label: "Board" },
  { href: "/upload", label: "Upload", roles: ["content_creator", "lead_reviewer", "manager", "admin"] },
  { href: "/allocations", label: "Allocations", roles: ["manager", "admin"] },
  { href: "/usage", label: "Usage", roles: ["manager", "admin"] },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const me = useQuery(api.users.me);
  const upsertSelf = useMutation(api.users.upsertSelf);
  const prepareLoginAttempt = useMutation(api.users.prepareLoginAttempt);
  const recordLoginAttempt = useMutation(api.users.recordLoginAttempt);
  const resetPasswordWithToken = useMutation(api.users.resetPasswordWithToken);
  const changeFirstLoginPassword = useMutation(api.users.changeFirstLoginPassword);

  const [showLegend, setShowLegend] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signIn" | "resetWithToken">("signIn");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [firstLoginPassword, setFirstLoginPassword] = useState("");
  const [firstLoginConfirm, setFirstLoginConfirm] = useState("");
  const [firstLoginError, setFirstLoginError] = useState<string | null>(null);
  const [firstLoginLoading, setFirstLoginLoading] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated) {
      document.cookie = "__session_hint=1;path=/;max-age=31536000;SameSite=Lax";
      void upsertSelf({});
      setShowAuthModal(false);
    } else if (!isLoading) {
      document.cookie = "__session_hint=;path=/;max-age=0";
    }
  }, [isAuthenticated, isLoading, upsertSelf]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setShowAuthModal(false);
      }
    }
    if (showAuthModal) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAuthModal]);

  async function handleSignOut() {
    document.cookie = "__session_hint=;path=/;max-age=0";
    setAuthError(null);
    setAuthMessage(null);
    setFirstLoginPassword("");
    setFirstLoginConfirm("");
    setFirstLoginError(null);
    try {
      await signOut();
    } catch {
      // still redirect to sign-in landing
    }
    router.replace("/?signin=1");
    setShowAuthModal(true);
  }

  async function handleAuthSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthError(null);
    setAuthMessage(null);
    setAuthLoading(true);
    let submittedEmail = "";
    try {
      const formData = new FormData(e.currentTarget);
      submittedEmail = String(formData.get("email") ?? "");
      if (authMode === "signIn") {
        await prepareLoginAttempt({ email: submittedEmail });
        formData.set("flow", "signIn");
        await signIn("password", formData);
        await recordLoginAttempt({ email: submittedEmail, success: true });
      } else {
        const token = String(formData.get("token") ?? "");
        const newPassword = String(formData.get("newPassword") ?? "");
        await resetPasswordWithToken({ email: submittedEmail, token, newPassword });
        setAuthMessage("Password updated. Sign in with your new password.");
        setAuthMode("signIn");
      }
    } catch {
      if (authMode === "signIn") {
        if (submittedEmail) {
          try {
            await recordLoginAttempt({ email: submittedEmail, success: false });
          } catch {
            // Avoid surfacing tracking errors to users.
          }
        }
      }
      setAuthError(
        authMode === "signIn"
          ? "Sign in failed. Please check your email/password and try again."
          : "Password update failed. Please check your email/token and try again."
      );
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

  const visibleLinks = [
    ...NAV_LINKS.filter((link) => !link.roles || (me?.role && link.roles.includes(me.role))),
    ...(me?.role === "admin" ? [{ href: "/users", label: "Users" }] : []),
  ];

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
              {visibleLinks.map((link) => {
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
            {/* Score band legend popover */}
            <div className="relative">
              <button
                onClick={() => setShowLegend(!showLegend)}
                className="w-6 h-6 rounded-full border border-stone-200 text-stone-400 text-[11px] font-medium hover:bg-stone-100 hover:text-stone-600 transition-colors flex items-center justify-center"
                title="Score bands"
              >
                ?
              </button>
              {showLegend && (
                <div className="absolute right-0 top-8 bg-white border border-stone-200 rounded-lg shadow-lg p-3 z-30 w-52">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-stone-600">Score Bands</span>
                    <button onClick={() => setShowLegend(false)} className="text-stone-300 hover:text-stone-500 text-xs">&times;</button>
                  </div>
                  <div className="space-y-1.5">
                    {BAND_LEGEND.map((b) => (
                      <div key={b.key} className="flex items-center justify-between">
                        <ScoreBandBadge band={b.key} />
                        <span className="text-[10px] text-stone-400 font-mono">{b.range}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {!isLoading && isAuthenticated && me?.role && (
              <span className="text-[11px] text-stone-500 uppercase tracking-[0.06em]">
                {me.role.replace("_", " ")}
              </span>
            )}
            {!isLoading && !isAuthenticated ? (
              <button
                onClick={() => {
                  setShowAuthModal(true);
                  setAuthMode("signIn");
                  setAuthError(null);
                  setAuthMessage(null);
                }}
                className="px-3 py-1.5 text-xs rounded-md border border-stone-200 text-stone-600 hover:bg-stone-100"
              >
                Sign In
              </button>
            ) : !isLoading ? (
              <button
                onClick={() => void handleSignOut()}
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
              {authMode === "signIn" ? "Sign In" : "Reset Password"}
            </h2>
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              {authMode === "signIn" ? (
                <>
                  <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    required
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    required
                    minLength={8}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                </>
              ) : (
                <>
                  <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    required
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400"
                  />
                  <input
                    name="token"
                    type="text"
                    placeholder="Reset token"
                    required
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
                  : authMode === "signIn"
                  ? "Sign In"
                  : "Update Password"}
              </button>
            </form>
            <div className="mt-3 flex flex-col gap-2">
              {authMode === "signIn" ? (
                <>
                  <p className="w-full text-center text-xs text-stone-500">
                    Forgot password? Contact an admin to generate a reset token.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("resetWithToken");
                      setAuthError(null);
                      setAuthMessage(null);
                    }}
                    className="w-full text-center text-xs text-stone-500 hover:text-stone-700"
                  >
                    I have a reset token
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signIn");
                    setAuthError(null);
                    setAuthMessage(null);
                  }}
                  className="w-full text-center text-xs text-stone-500 hover:text-stone-700"
                >
                  Back to sign in
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
