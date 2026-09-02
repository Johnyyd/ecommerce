import { useState } from "react"
import { useLocation } from "wouter"
import { useAuthStore } from "@/store/useAuthStore"

export function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [, setLocation] = useLocation()
  const setUser = useAuthStore((state) => state.setUser)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
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
      // Store token (in localstorage or just in memory for the session)
      // Usually, we'd also call /me to get user info
      localStorage.setItem("access_token", data.access_token)

      const meRes = await fetch("/api/v1/auth/me", {
        headers: {
          "Authorization": `Bearer ${data.access_token}`
        }
      })
      if (meRes.ok) {
        const user = await meRes.json()
        setUser(user)
        if (user.role === "admin") {
          setLocation("/admin")
        } else {
          setLocation("/")
        }
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-800 p-8 rounded-2xl border border-zinc-700/50 shadow-2xl">
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-8">Sign in</h1>
        
        {error && (
          <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-electric-blue/50 focus:border-electric-blue transition-colors"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-electric-blue/50 focus:border-electric-blue transition-colors"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-electric-blue hover:bg-electric-blue/90 text-white font-medium py-2.5 rounded-lg transition-colors mt-2"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
