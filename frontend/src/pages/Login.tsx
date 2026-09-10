import { useState } from "react"
import { useLocation, Link } from "wouter"
import { useAuthStore } from "@/store/useAuthStore"
import { motion } from "motion/react"

export function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [, setLocation] = useLocation()
  const setUser = useAuthStore((state) => state.setUser)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      })

      if (!res.ok) {
        throw new Error("Invalid credentials")
      }

      const data = await res.json()
      localStorage.setItem("access_token", data.access_token)

      const meRes = await fetch("/api/v1/auth/me", {
        headers: {
          "Authorization": `Bearer ${data.access_token}`
        }
      })
      if (meRes.ok) {
        const user = await meRes.json()
        setUser(user)
        if (user.role === "admin" || user.role === "manager") {
          setLocation("/admin")
        } else {
          setLocation("/")
        }
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-[40%] -left-[10%] w-[70%] h-[70%] rounded-full bg-blue-100/50 blur-3xl mix-blend-multiply" />
        <div className="absolute -bottom-[40%] -right-[10%] w-[70%] h-[70%] rounded-full bg-purple-100/50 blur-3xl mix-blend-multiply" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-white/70 backdrop-blur-xl p-10 rounded-[2rem] border border-white/50 shadow-2xl shadow-zinc-200/50 z-10"
      >
        <div className="mb-10 text-center">
          <Link href="/" className="inline-block mb-6">
            <div className="w-12 h-12 bg-zinc-900 rounded-full mx-auto flex items-center justify-center">
              <span className="text-white font-bold text-xl tracking-tighter">EC</span>
            </div>
          </Link>
          <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight mb-2">Welcome back</h1>
          <p className="text-zinc-500">Enter your details to sign in.</p>
        </div>
        
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-red-50 text-red-500 p-4 rounded-xl text-sm mb-6 border border-red-100 font-medium"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700 ml-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-zinc-400"
              placeholder="admin"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-zinc-400"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-3.5 rounded-xl transition-all mt-4 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-zinc-900/20"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-zinc-500">
          Don't have an account?{" "}
          <Link href="/register" className="font-medium text-zinc-900 hover:underline">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
