import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { MagnifyingGlass, Plus, PencilSimple, Trash, X, Globe, Buildings } from "@phosphor-icons/react"
import { toast } from "sonner"
import { BrandItem, BrandFormData } from "@/types/admin"
import { adminApi } from "@/services/adminApi"
import { Skeleton } from "@/components/ui/Skeleton"

interface AdminBrandsProps {
  brands: BrandItem[]
  isFetching: boolean
  onRefresh: () => Promise<void>
}

export function AdminBrands({
  brands,
  isFetching,
  onRefresh
}: AdminBrandsProps) {
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<BrandItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState<BrandFormData>({
    name: "",
    slug: "",
    logo_url: "",
    description: "",
    website: ""
  })

  const filteredBrands = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return brands
    return brands.filter(b => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q))
  }, [brands, search])

  const handleOpenAdd = () => {
    setEditingBrand(null)
    setForm({ name: "", slug: "", logo_url: "", description: "", website: "" })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (b: BrandItem) => {
    setEditingBrand(b)
    setForm({
      name: b.name,
      slug: b.slug,
      logo_url: b.logo_url || "",
      description: b.description || "",
      website: b.website || ""
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Brand name is required")
      return
    }

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || form.name.toLowerCase().replace(/\s+/g, "-"),
      logo_url: form.logo_url.trim() || null,
      description: form.description.trim() || null,
      website: form.website.trim() || null
    }

    setIsSubmitting(true)
    try {
      if (editingBrand) {
        await adminApi.updateBrand(editingBrand.id, payload)
        toast.success("Brand updated successfully")
      } else {
        await adminApi.createBrand(payload)
        toast.success("Brand created successfully")
      }
      setIsModalOpen(false)
      await onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving brand"
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete brand "${name}"?`)) return
    try {
      await adminApi.deleteBrand(id)
      toast.success("Brand deleted successfully")
      await onRefresh()
    } catch {
      toast.error("Failed to delete brand")
    }
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-80">
          <MagnifyingGlass
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            placeholder="Search brands by name or slug..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl text-sm placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
          />
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-xs"
        >
          <Plus size={18} weight="bold" />
          Add Brand
        </button>
      </div>

      {/* Brand cards */}
      {isFetching && brands.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredBrands.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-16 text-center text-zinc-400 dark:text-zinc-500">
          <Buildings size={36} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium">No brands found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {filteredBrands.map(b => (
            <div
              key={b.id}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {b.logo_url ? (
                    <img
                      src={b.logo_url}
                      alt={b.name}
                      className="w-12 h-12 rounded-xl object-contain bg-zinc-50 dark:bg-zinc-800 p-1 border border-zinc-100 dark:border-zinc-700"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                      <Buildings size={24} />
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-base text-zinc-900 dark:text-zinc-50">{b.name}</h4>
                    <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">/{b.slug}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(b)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Edit brand"
                  >
                    <PencilSimple size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(b.id, b.name)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                    title="Delete brand"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>

              {b.description && (
                <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  {b.description}
                </p>
              )}

              {b.website && (
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-1.5 text-xs text-electric-blue">
                  <Globe size={14} />
                  <a href={b.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                    {b.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal Add / Edit Brand */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 w-full max-w-md shadow-xl"
            >
              <div className="flex justify-between items-center pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">
                  {editingBrand ? "Edit Brand" : "Add Brand"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Custom Slug
                  </label>
                  <input
                    type="text"
                    placeholder="auto-generated-if-empty"
                    value={form.slug}
                    onChange={e => setForm({ ...form, slug: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Logo Image URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={form.logo_url}
                    onChange={e => setForm({ ...form, logo_url: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://brand.com"
                    value={form.website}
                    onChange={e => setForm({ ...form, website: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? "Saving..." : editingBrand ? "Update Brand" : "Create Brand"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
