import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getUsers,
  addUser,
  removeUser,
  updateUserRole,
  updateUserStatus,
  updateCurrentUserName,
  type UserEntry,
  type UserRole,
  type UserStatus,
} from "../services/accountService";

export const AccountManagementView: React.FC = () => {
  const { user, role, isAdmin, isEmailUser, changePassword, sendPasswordReset } = useAuth();

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  // Profile name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName || "");
  const [isSavingName, setIsSavingName] = useState(false);

  // Users state (Admin only)
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userFilter, setUserFilter] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Add user form state
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("editor");
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Delete confirmation
  const [emailToDelete, setEmailToDelete] = useState<string | null>(null);

  const loadUsers = async () => {
    if (!isAdmin) return;
    setIsLoadingUsers(true);
    try {
      const list = await getUsers();
      setUsers(list);
    } catch (err: any) {
      console.error("Failed to load users:", err);
      setActionError("Failed to load users from database.");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }

    setPwSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess("Password successfully updated!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwError(err.message || "Failed to update password.");
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setActionError("Please enter a valid email address.");
      return;
    }

    setIsAddingUser(true);
    try {
      await addUser(
        email,
        newRole,
        user?.email || "admin"
      );
      setActionSuccess(`Added user '${email}' with role '${newRole}'.`);
      setNewEmail("");
      setNewRole("editor");
      await loadUsers();
    } catch (err: any) {
      setActionError(err.message || "Failed to add user.");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setIsSavingName(true);
    try {
      await updateCurrentUserName(nameInput.trim());
      setIsEditingName(false);
      setPwSuccess("Display name updated successfully.");
      if (isAdmin) {
        await loadUsers();
      }
    } catch (err: any) {
      setPwError(err.message || "Failed to update display name.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleToggleRole = async (entry: UserEntry) => {
    const targetRole: UserRole = entry.role === "admin" ? "editor" : "admin";
    try {
      await updateUserRole(entry.email, targetRole);
      setActionSuccess(`Updated ${entry.email} role to ${targetRole}.`);
      await loadUsers();
    } catch (err: any) {
      setActionError(err.message || "Failed to update role.");
    }
  };

  const handleToggleStatus = async (entry: UserEntry) => {
    const targetStatus: UserStatus = entry.status === "active" ? "disabled" : "active";
    try {
      await updateUserStatus(entry.email, targetStatus);
      setActionSuccess(`Updated ${entry.email} status to ${targetStatus}.`);
      await loadUsers();
    } catch (err: any) {
      setActionError(err.message || "Failed to update status.");
    }
  };

  const handleRemoveEmail = async (email: string) => {
    try {
      await removeUser(email);
      setActionSuccess(`Removed user ${email}.`);
      setEmailToDelete(null);
      await loadUsers();
    } catch (err: any) {
      setActionError(err.message || "Failed to remove user.");
    }
  };

  const handleSendReset = async (email: string) => {
    try {
      await sendPasswordReset(email);
      setActionSuccess(`Password reset email sent to ${email}.`);
    } catch (err: any) {
      setActionError(err.message || "Failed to send reset email.");
    }
  };

  const filteredUsers = users.filter((item) => {
    const q = userFilter.toLowerCase();
    return (
      item.email.toLowerCase().includes(q) ||
      (item.displayName && item.displayName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <span>👥</span> Account Management
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your personal profile, security credentials, and authorized staff permissions.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-16 h-16 rounded-full border-2 border-purple-500 object-cover shadow"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-purple-900/60 border border-purple-500 text-purple-200 flex items-center justify-center font-bold text-2xl shadow">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
          )}
          <div>
            <div className="text-lg font-bold text-white flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Enter your name"
                    className="px-2.5 py-1 bg-slate-950 border border-purple-500 rounded-lg text-sm text-white focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={isSavingName}
                    className="text-xs px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition"
                  >
                    {isSavingName ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      setNameInput(user?.displayName || "");
                    }}
                    className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>{user?.displayName || user?.email?.split("@")[0]}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNameInput(user?.displayName || "");
                      setIsEditingName(true);
                    }}
                    title="Edit display name"
                    className="text-xs text-slate-400 hover:text-purple-300 transition"
                  >
                    ✏️
                  </button>
                </div>
              )}
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  isAdmin
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                    : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                }`}
              >
                {role === "admin" ? "Administrator" : "Editor"}
              </span>
            </div>
            <div className="text-sm text-slate-400 font-mono mt-0.5">{user?.email}</div>
            <div className="text-xs text-slate-500 mt-1">
              Auth Provider:{" "}
              <span className="text-slate-300">
                {isEmailUser ? "Email / Password" : "Google Account"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end border-t md:border-t-0 border-slate-800 pt-4 md:pt-0">
          <div className="text-right">
            <div className="text-xs text-slate-400">Account Access Level</div>
            <div className="text-sm font-semibold text-emerald-400">
              {isAdmin ? "Full Admin & System Access" : "Content Editor"}
            </div>
          </div>
        </div>
      </div>

      {/* Password Management Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>🔑</span> Password & Security
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Update your account password or review your security provider settings.
          </p>
        </div>

        {isEmailUser ? (
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            {pwSuccess && (
              <div className="p-3 bg-emerald-900/40 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <span>✅</span>
                <span>{pwSuccess}</span>
              </div>
            )}

            {pwError && (
              <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{pwError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPw ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(!showCurrentPw)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  {showCurrentPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                New Password (min. 6 characters)
              </label>
              <div className="relative">
                <input
                  type={showNewPw ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  {showNewPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={pwSubmitting}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition shadow-md"
              >
                {pwSubmitting ? "Updating Password..." : "Change Password"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (user?.email) handleSendReset(user.email);
                }}
                className="text-xs text-slate-400 hover:text-purple-300 transition"
              >
                Send reset link to email instead
              </button>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 flex items-start gap-2">
              <span className="text-purple-400">🛡️</span>
              <span>
                <strong>Zero Plain Password Storage:</strong> Passwords are verified and updated
                exclusively on Google Firebase Authentication over TLS. Plain passwords or hashes are
                never stored in the database.
              </span>
            </div>
          </form>
        ) : (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-white flex items-center gap-2">
              <span>🌐</span> Managed by Google Workspace
            </div>
            <p className="text-slate-400">
              You are signed in via your Google Account (<code>{user?.email}</code>). Password changes,
              two-factor authentication, and security credentials are automatically managed through
              your Google Account security center.
            </p>
          </div>
        )}
      </div>

      {/* User Management (Admin Only) */}
      {isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🛡️</span> Authorized Users & Roles
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage authorized user accounts and assign Administrator or Editor privileges.
                </p>
              </div>

              <button
                type="button"
                onClick={loadUsers}
                disabled={isLoadingUsers}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                <span>🔄</span> Refresh
              </button>
            </div>
          </div>

          {actionSuccess && (
            <div className="p-3 bg-emerald-900/40 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <span>✅</span>
              <span>{actionSuccess}</span>
            </div>
          )}

          {actionError && (
            <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-xl text-red-300 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{actionError}</span>
            </div>
          )}

          {/* Add User Form */}
          <form
            onSubmit={handleAddEmail}
            className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-4"
          >
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Add Authorized User
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Staff Email *</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="editor@cwts.edu"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Role *</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="editor">Editor (Content Management)</option>
                    <option value="admin">Administrator (Full Access & Backup)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-slate-400">
                  Staff can register directly with this email or sign in via Google.
                </p>
                <button
                  type="submit"
                  disabled={isAddingUser}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition shadow-md"
                >
                  {isAddingUser ? "Adding..." : "+ Add User"}
                </button>
              </div>
            </form>

            {/* Filter */}
            <div className="flex items-center justify-between gap-4">
              <input
                type="text"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Search users by name or email..."
                className="w-full max-w-sm px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500"
              />
              <div className="text-xs text-slate-500">
                Total Users: <strong className="text-slate-300">{users.length}</strong>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Staff User / Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Registration</th>
                    <th className="px-4 py-3">Added By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((entry) => (
                      <tr key={entry.email} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3">
                          {entry.displayName ? (
                            <div>
                              <div className="font-semibold text-white text-xs">{entry.displayName}</div>
                              <div className="font-mono text-[11px] text-slate-400">{entry.email}</div>
                            </div>
                          ) : (
                            <div className="font-mono font-medium text-white">{entry.email}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              entry.role === "admin"
                                ? "bg-purple-900/60 text-purple-300 border border-purple-700/50"
                                : "bg-blue-900/60 text-blue-300 border border-blue-700/50"
                            }`}
                          >
                            {entry.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              entry.status === "active"
                                ? "bg-emerald-900/50 text-emerald-300 border border-emerald-700/50"
                                : "bg-red-900/50 text-red-300 border border-red-700/50"
                            }`}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {entry.registered ? (
                            <span className="text-emerald-400 text-xs flex items-center gap-1">
                              <span>✓</span> Registered
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs flex items-center gap-1">
                              <span>⏳</span> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-[11px]">
                          {entry.addedBy || "Seed"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleRole(entry)}
                              title={
                                entry.role === "admin"
                                  ? "Change role to Editor"
                                  : "Promote to Admin"
                              }
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
                            >
                              {entry.role === "admin" ? "Make Editor" : "Make Admin"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleStatus(entry)}
                              title={
                                entry.status === "active"
                                  ? "Disable account access"
                                  : "Enable account access"
                              }
                              className={`px-2 py-1 rounded text-[11px] transition ${
                                entry.status === "active"
                                  ? "bg-amber-900/40 hover:bg-amber-800/60 text-amber-300"
                                  : "bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300"
                              }`}
                            >
                              {entry.status === "active" ? "Disable" : "Enable"}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSendReset(entry.email)}
                              title="Send Password Reset Email"
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] transition"
                            >
                              Reset PW
                            </button>

                            <button
                              type="button"
                              onClick={() => setEmailToDelete(entry.email)}
                              title="Remove user"
                              className="px-2 py-1 bg-red-900/40 hover:bg-red-800/60 text-red-300 rounded text-[11px] transition"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {/* Delete Confirmation Modal */}
      {emailToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Remove User?</h3>
            <p className="text-xs text-slate-300">
              Are you sure you want to remove <code className="text-purple-300">{emailToDelete}</code>?
              This user will no longer be able to log in or register.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEmailToDelete(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRemoveEmail(emailToDelete)}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
