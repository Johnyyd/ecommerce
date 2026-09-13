import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Database, FloppyDisk, ArrowCounterClockwise, ShieldWarning, Clock, HardDrives, X, WarningCircle } from "@phosphor-icons/react"
import { toast } from "sonner"
import { BackupFile } from "@/types/admin"
import { adminApi } from "@/services/adminApi"
import { Skeleton } from "@/components/ui/Skeleton"

interface AdminBackupsProps {
  backups: BackupFile[]
  isFetching: boolean
  currentUserRole?: string
  onRefresh: () => Promise<void>
}

export function AdminBackups({
  backups,
  isFetching,
  currentUserRole = "admin",
  onRefresh
}: AdminBackupsProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null)
  const [isRestoring, setIsRestoring] = useState(false)

  const isAdmin = currentUserRole === "admin"

  const handleCreateBackup = async () => {
    if (!isAdmin) return
    setIsCreating(true)
    try {
      await adminApi.createBackup()
      toast.success("Database backup snapshot created successfully")
      await onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate database backup"
      toast.error(msg)
    } finally {
      setIsCreating(false)
    }
  }

  const handleConfirmRestore = async () => {
    if (!restoreTarget || !isAdmin) return
    setIsRestoring(true)
    try {
      await adminApi.restoreBackup(restoreTarget)
      toast.success(`Database restored to snapshot: ${restoreTarget}`)
      setRestoreTarget(null)
      await onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to restore database"
      toast.error(msg)
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Super Admin Access Guard */}
      {!isAdmin && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3">
          <ShieldWarning size={20} className="text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" weight="fill" />
          <div>
            <h4 className="font-semibold text-rose-900 dark:text-rose-200 text-xs sm:text-sm">
              Super Admin Access Required
            </h4>
            <p className="text-rose-800/80 dark:text-rose-300/80 text-xs mt-0.5 leading-relaxed">
              Database snapshot creation and system-wide recovery are restricted to <strong>Super Admin</strong> accounts. Store Managers do not hold clearance for database mutation operations.
            </p>
          </div>
        </div>
      )}

      {/* Top Header & Trigger Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">Database Backup & Recovery</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Kubernetes automated daily snapshots (02:00 UTC) and on-demand recovery
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleCreateBackup}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs sm:text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <FloppyDisk size={18} weight="bold" />
            {isCreating ? "Generating Snapshot..." : "Backup Database Now"}
          </button>
        )}
      </div>

      {/* Operational Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-2 shadow-xs">
          <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Clock size={16} className="text-blue-500" weight="bold" />
            <span>Kubernetes Scheduled CronJob</span>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-[11px] sm:text-xs">
            Automated binary PostgreSQL dump runs every night at <strong>02:00 AM UTC</strong> against the primary StatefulSet container, safely mounted to persistent storage volume (<code className="font-mono text-[11px] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">postgres-backups-pvc</code>).
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 text-xs space-y-2 shadow-xs">
          <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <HardDrives size={16} className="text-emerald-500" weight="bold" />
            <span>Retention & Integrity Strategy</span>
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-[11px] sm:text-xs">
            Snapshots older than 7 days are automatically pruned by the cleanup routine. Disaster recovery executes <code className="font-mono text-[11px] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">pg_restore --clean</code> with transaction atomicity.
          </p>
        </div>
      </div>

      {/* Backups Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl overflow-hidden shadow-xs">
        {isFetching && backups.length === 0 ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : backups.length === 0 ? (
          <div className="p-16 text-center text-zinc-400 dark:text-zinc-500">
            <Database size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">
              {isAdmin
                ? "No backup snapshots found. Click 'Backup Database Now' to generate one."
                : "Database backups are managed by Super Admins."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/60 dark:border-zinc-800 font-medium">
                <tr>
                  <th className="px-6 py-4">Snapshot Name</th>
                  <th className="px-6 py-4">Size</th>
                  <th className="px-6 py-4">Created Timestamp</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {backups.map(b => (
                  <tr key={b.filename} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    {/* Filename */}
                    <td className="px-6 py-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {b.filename}
                    </td>

                    {/* Size */}
                    <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 font-semibold">
                      {b.size_human}
                    </td>

                    {/* Timestamp */}
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400">
                      {new Date(b.created_at).toLocaleString()}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      {isAdmin && (
                        <button
                          onClick={() => setRestoreTarget(b.filename)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 font-semibold rounded-xl text-xs active:scale-[0.97] transition-all cursor-pointer"
                        >
                          <ArrowCounterClockwise size={14} weight="bold" />
                          Restore
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Restore Confirmation Modal */}
      <AnimatePresence>
        {restoreTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRestoreTarget(null)}
              className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl max-w-md w-full p-6 sm:p-8 z-10"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <WarningCircle size={22} weight="fill" />
                </div>
                <button
                  onClick={() => setRestoreTarget(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                Restore Database Snapshot?
              </h3>

              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
                You are about to restore snapshot <strong className="font-mono text-zinc-900 dark:text-zinc-200">{restoreTarget}</strong>. Current database state will be replaced with this point-in-time image. This operation cannot be undone.
              </p>

              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 text-[11px] text-rose-800 dark:text-rose-300 mb-6">
                Active connections will remain active through connection pooling, but recent uncommitted transactions may be lost.
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  onClick={() => setRestoreTarget(null)}
                  disabled={isRestoring}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRestore}
                  disabled={isRestoring}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isRestoring ? "Restoring..." : "Yes, Restore Database"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
