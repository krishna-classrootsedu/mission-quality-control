"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const ROLES = ["content_creator", "lead_reviewer", "manager", "admin"] as const;
type Role = (typeof ROLES)[number];

export default function UsersPage() {
  const me = useQuery(api.users.me);
  const users = useQuery(api.users.list, me?.role === "admin" ? {} : "skip");
  const createUser = useMutation(api.users.createUser);
  const setRole = useMutation(api.users.setRole);
  const adminGenerateResetToken = useMutation(api.users.adminGenerateResetToken);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRoleValue] = useState<Role>("content_creator");
  const [defaultPassword, setDefaultPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastTempPassword, setLastTempPassword] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<Id<"users"> | null>(null);
  const [resetTokenResult, setResetTokenResult] = useState<{ userId: Id<"users">; token: string } | null>(null);

  async function onCreateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    setLastTempPassword(null);
    try {
      const result = await createUser({
        email,
        name: name.trim() || undefined,
        role,
        defaultPassword: defaultPassword.trim() || undefined,
      });
      setSuccess(`User created: ${result.email}`);
      setLastTempPassword(result.temporaryPassword);
      setEmail("");
      setName("");
      setDefaultPassword("");
      setRoleValue("content_creator");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function onUpdateUser(userId: Id<"users">, nextRole: Role, isActive: boolean) {
    setUpdatingUserId(userId);
    setError(null);
    setSuccess(null);
    try {
      await setRole({ userId, role: nextRole, isActive });
      setSuccess("User updated.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function onGenerateResetToken(userId: Id<"users">) {
    setError(null);
    setSuccess(null);
    setResetTokenResult(null);
    try {
      const result = await adminGenerateResetToken({ userId });
      setResetTokenResult({ userId, token: result.resetToken });
      setSuccess(`Reset token generated (expires in ${result.expiresInMinutes} min)`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate reset token");
    }
  }

  if (me === undefined) {
    return (
      <main className="max-w-[1000px] mx-auto px-6 py-6">
        <p className="text-sm text-stone-400">Loading...</p>
      </main>
    );
  }

  if (me === null) {
    return (
      <main className="max-w-[1000px] mx-auto px-6 py-6">
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h1 className="text-lg font-semibold text-stone-800">Sign in required</h1>
          <p className="text-sm text-stone-500 mt-2">Please sign in to manage users.</p>
        </div>
      </main>
    );
  }

  if (me.role !== "admin") {
    return (
      <main className="max-w-[1000px] mx-auto px-6 py-6">
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h1 className="text-lg font-semibold text-stone-800">Permission denied</h1>
          <p className="text-sm text-stone-500 mt-2">
            Only admins can access user management.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[1000px] mx-auto px-6 py-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-stone-800">User Management</h1>
        <p className="text-xs text-stone-500 mt-1">
          Admin-only access. Create users and manage roles.
        </p>
      </div>

      <section className="bg-white rounded-lg border border-stone-200 p-4">
        <h2 className="text-sm font-medium text-stone-700 mb-3">Create User</h2>
        <form onSubmit={onCreateUser} className="grid grid-cols-2 gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="px-3 py-2 text-sm border border-stone-200 rounded-lg"
          />
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 text-sm border border-stone-200 rounded-lg"
          />
          <select
            value={role}
            onChange={(e) => setRoleValue(e.target.value as Role)}
            className="px-3 py-2 text-sm border border-stone-200 rounded-lg"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Default password (optional)"
            value={defaultPassword}
            onChange={(e) => setDefaultPassword(e.target.value)}
            className="px-3 py-2 text-sm border border-stone-200 rounded-lg"
          />
          <div className="col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-stone-800 text-white hover:bg-stone-700 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        {success && <p className="mt-3 text-xs text-emerald-700">{success}</p>}
        {lastTempPassword && (
          <p className="mt-1 text-xs text-stone-500">
            Temporary password: <span className="font-mono">{lastTempPassword}</span>
          </p>
        )}
      </section>

      <section className="bg-white rounded-lg border border-stone-200 p-4">
        <h2 className="text-sm font-medium text-stone-700 mb-3">Existing Users</h2>
        {users === undefined ? (
          <p className="text-sm text-stone-400">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-stone-400">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Role</th>
                  <th className="text-left py-2">Active</th>
                  <th className="text-left py-2">First Login</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.userId} className="border-b border-stone-100">
                    <td className="py-2 text-stone-700">{u.email ?? "-"}</td>
                    <td className="py-2 text-stone-600">{u.name ?? "-"}</td>
                    <td className="py-2">
                      <select
                        value={u.role}
                        disabled={updatingUserId === u.userId}
                        onChange={(e) =>
                          void onUpdateUser(
                            u.userId,
                            e.target.value as Role,
                            u.isActive
                          )
                        }
                        className="px-2 py-1 text-xs border border-stone-200 rounded"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={u.isActive}
                        disabled={updatingUserId === u.userId}
                        onChange={(e) =>
                          void onUpdateUser(
                            u.userId,
                            u.role as Role,
                            e.target.checked
                          )
                        }
                      />
                    </td>
                    <td className="py-2 text-stone-500">{u.isFirstLogin ? "Yes" : "No"}</td>
                    <td className="py-2">
                      <button
                        onClick={() => void onGenerateResetToken(u.userId)}
                        className="px-2 py-1 text-[11px] border border-stone-200 rounded text-stone-600 hover:bg-stone-50"
                      >
                        Reset Password
                      </button>
                      {resetTokenResult?.userId === u.userId && (
                        <div className="mt-1 text-[11px] text-stone-500 font-mono break-all">
                          {resetTokenResult.token}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
