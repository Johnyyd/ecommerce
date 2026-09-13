import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Users, MagnifyingGlass, ShieldCheck, UserSwitch, Info, X } from "@phosphor-icons/react"
import { toast } from "sonner"
import { UserData } from "@/types/admin"
import { adminApi } from "@/services/adminApi"
import { Skeleton } from "@/components/ui/Skeleton"

interface AdminUsersProps {
  users: UserData[]
  isFetching: boolean
  currentUserRole?: string
  onRefresh: () => Promise<void>
}

export function AdminUsers({
  users,
  isFetching,
  currentUserRole = "admin",
  onRefresh
}: AdminUsersProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [roleModalUser, setRoleModalUser] = useState<UserData | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>("customer")
  const [isUpdating, setIsUpdating] = useState(false)

  const isManager = currentUserRole === "manager"

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return users
    return users.filter(
      u =>
        u.username?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
    )
  }, [users, searchTerm])

  const handleToggleStatus = async (user: UserData) => {
    if (isManager) return
    const newStatus = !user.is_active
    try {
      await adminApi.toggleUserStatus(user.id, newStatus)
      toast.success(`User ${user.username} has been ${newStatus ? "activated" : "disabled"}`)
      await onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle status"
      toast.error(msg)
    }
  }

  const handleOpenRoleModal = (user: UserData) => {
    if (isManager) return
    setRoleModalUser(user)
    setSelectedRole(user.role)
  }

  const handleSaveRole = async () => {
    if (!roleModalUser || isManager) return
    setIsUpdating(true)
    try {
      await adminApi.updateUserRole(roleModalUser.id, selectedRole)
      toast.success(`Updated role for ${roleModalUser.username} to ${selectedRole.toUpperCase()}`)
      setRoleModalUser(null)
      await onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update user role"
      toast.error(msg)
    } finally {
      setIsUpdating(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
      case "manager":
        return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
      default:
        return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
    }
  }

  return (
    <div className="space-y-6">
      {/* Read-Only Manager Notice */}
      {isManager && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
          <Info size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" weight="fill" />
          <div>
            <h4 className="font-semibold text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
              Manager Read-Only Access
            </h4>
            <p className="text-amber-800/80 dark:text-amber-300/80 text-xs mt-0.5 leading-relaxed">
              You are logged in as a <strong>Store Manager</strong>. Under strict role governance, only <strong>Super Admins</strong> are permitted to toggle activation status or change user security roles.
            </p>
          </div>
        </div>
      )}

      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">User Accounts</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Access governance, role assignment, and status controls ({users.length} registered)
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <MagnifyingGlass
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search username or email..."
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs rounded-2xl pl-10 pr-4 py-2.5 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-all shadow-xs"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl overflow-hidden shadow-xs">
        {isFetching && users.length === 0 ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center text-zinc-400 dark:text-zinc-500">
            <Users size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No user accounts found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/60 dark:border-zinc-800 font-medium">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    {/* Username & Avatar Initial */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-700 dark:text-zinc-300 text-xs border border-zinc-200 dark:border-zinc-700 uppercase">
                          {u.username?.[0] || "U"}
                        </div>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {u.username}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                      {u.email}
                    </td>

                    {/* Role */}
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getRoleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          u.is_active
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-500 dark:text-rose-400"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {u.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Status Button */}
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isManager}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            isManager
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 opacity-50 cursor-not-allowed"
                              : u.is_active
                              ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 active:scale-[0.97] cursor-pointer"
                              : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 active:scale-[0.97] cursor-pointer"
                          }`}
                        >
                          {u.is_active ? "Disable" : "Activate"}
                        </button>

                        {/* Role Switcher */}
                        <button
                          onClick={() => handleOpenRoleModal(u)}
                          disabled={isManager}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            isManager
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 opacity-50 cursor-not-allowed"
                              : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 active:scale-[0.97] cursor-pointer"
                          }`}
                        >
                          <UserSwitch size={14} />
                          Role
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Assignment Modal */}
      <AnimatePresence>
        {roleModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRoleModalUser(null)}
              className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl max-w-sm w-full p-6 z-10"
            >
              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <ShieldCheck size={18} weight="bold" />
                  </div>
                  <h3 className="font-bold text-zinc-900 dark:text-zinc-50 text-sm">Assign User Role</h3>
                </div>
                <button
                  onClick={() => setRoleModalUser(null)}
                  className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="mb-5 text-xs text-zinc-600 dark:text-zinc-400">
                Configure permission access for <span className="font-semibold text-zinc-900 dark:text-zinc-100">{roleModalUser.username}</span>
              </div>

              {/* Role Radio Select */}
              <div className="space-y-2 mb-6">
                {[
                  { id: "customer", label: "Customer", desc: "Browse, purchase and manage personal orders" },
                  { id: "manager", label: "Manager", desc: "Catalog & order fulfillment management (read-only users)" },
                  { id: "admin", label: "Super Admin", desc: "Full privileges including user security and database backups" }
                ].map(r => (
                  <label
                    key={r.id}
                    onClick={() => setSelectedRole(r.id)}
                    className={`block p-3 rounded-2xl border cursor-pointer transition-all ${
                      selectedRole === r.id
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 shadow-xs"
                        : "border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{r.label}</span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        selectedRole === r.id
                          ? "border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100"
                          : "border-zinc-300 dark:border-zinc-600"
                      }`}>
                        {selectedRole === r.id && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-900" />}
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">{r.desc}</p>
                  </label>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  onClick={() => setRoleModalUser(null)}
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRole}
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isUpdating ? "Saving..." : "Apply Role"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
