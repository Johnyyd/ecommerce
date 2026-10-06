import { useState, useEffect, useMemo } from "react"
import { useLocation, Link } from "wouter"
import { motion } from "motion/react"
import { Check, X, ArrowClockwise, Eye, EyeSlash, ShieldCheck } from "@phosphor-icons/react"

export function Register() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [captchaId, setCaptchaId] = useState("")
  const [captchaSvg, setCaptchaSvg] = useState("")
  const [captchaCode, setCaptchaCode] = useState("")
  const [isCaptchaLoading, setIsCaptchaLoading] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [, setLocation] = useLocation()

  // Calculate password criteria
  const passwordCriteria = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasDigit: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>\-_=+~`[\]\\;'/]/.test(password),
    }
  }, [password])

  const strengthScore = useMemo(() => {
    let score = 0
    if (passwordCriteria.minLength) score += 1
    if (passwordCriteria.hasUpper) score += 1
    if (passwordCriteria.hasLower) score += 1
    if (passwordCriteria.hasDigit) score += 1
    if (passwordCriteria.hasSpecial) score += 1
    return score
  }, [passwordCriteria])

  const strengthDetails = useMemo(() => {
    if (password.length === 0) return { label: "", color: "bg-zinc-200", textColor: "text-zinc-400", percent: 0 }
    if (strengthScore <= 2) return { label: "Mật khẩu yếu", color: "bg-rose-500", textColor: "text-rose-500", percent: 25 }
    if (strengthScore <= 3) return { label: "Trung bình", color: "bg-amber-500", textColor: "text-amber-500", percent: 60 }
    if (strengthScore === 4) return { label: "Khá mạnh", color: "bg-blue-500", textColor: "text-blue-500", percent: 80 }
    return { label: "Rất mạnh & An toàn", color: "bg-emerald-500", textColor: "text-emerald-600", percent: 100 }
  }, [password, strengthScore])

  const isPasswordValid = strengthScore === 5

  const fetchCaptcha = async () => {
    setIsCaptchaLoading(true)
    try {
      const res = await fetch("/api/v1/auth/captcha")
      if (res.ok) {
        const data = await res.json()
        setCaptchaId(data.captcha_id)
        setCaptchaSvg(data.captcha_svg)
        setCaptchaCode("")
      } else {
        console.error("Failed to fetch captcha challenge")
      }
    } catch (err) {
      console.error("Error loading captcha:", err)
    } finally {
      setIsCaptchaLoading(false)
    }
  }

  useEffect(() => {
    fetchCaptcha()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!isPasswordValid) {
      setError("Mật khẩu chưa đáp ứng đầy đủ các tiêu chuẩn bảo mật bên dưới.")
      return
    }

    if (!captchaCode.trim()) {
      setError("Vui lòng nhập mã bảo vệ (Captcha).")
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          captcha_id: captchaId,
          captcha_code: captchaCode.trim()
        })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        // Refresh captcha challenge on error
        await fetchCaptcha()
        throw new Error(errorData?.detail || "Đăng ký không thành công")
      }

      // On successful registration, redirect to login
      setLocation("/login")
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-[40%] -right-[10%] w-[70%] h-[70%] rounded-full bg-emerald-100/50 blur-3xl mix-blend-multiply" />
        <div className="absolute -bottom-[40%] -left-[10%] w-[70%] h-[70%] rounded-full bg-blue-100/50 blur-3xl mix-blend-multiply" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white/80 backdrop-blur-xl p-8 sm:p-10 rounded-[2rem] border border-white/60 shadow-2xl shadow-zinc-200/50 z-10"
      >
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block mb-4">
            <div className="w-12 h-12 bg-zinc-900 rounded-full mx-auto flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-xl tracking-tighter">EC</span>
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 tracking-tight mb-2">Tạo tài khoản mới</h1>
          <p className="text-sm text-zinc-500">Đăng ký thành viên với bảo mật đa lớp</p>
        </div>
        
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-rose-50 text-rose-600 p-3.5 rounded-xl text-sm mb-5 border border-rose-100 font-medium flex items-center gap-2"
          >
            <X className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 ml-1 uppercase tracking-wider">Tên người dùng</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-white/70 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-zinc-400 text-sm"
              placeholder="nguyenvana"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-700 ml-1 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/70 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-zinc-400 text-sm"
              placeholder="vana@example.com"
              required
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Mật khẩu</label>
              {password && (
                <span className={`text-xs font-medium ${strengthDetails.textColor}`}>
                  {strengthDetails.label}
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/70 border border-zinc-200 text-zinc-900 rounded-xl pl-4 pr-11 py-2.5 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-zinc-400 text-sm font-mono tracking-wider"
                placeholder="Nhập mật khẩu an toàn..."
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-1"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Password strength bar */}
            {password.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${strengthDetails.color}`}
                    style={{ width: `${strengthDetails.percent}%` }}
                  />
                </div>

                {/* Criteria checklist */}
                <div className="grid grid-cols-2 gap-1.5 text-xs text-zinc-500 pt-1">
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.minLength ? "text-emerald-600 font-medium" : "text-zinc-400"}`}>
                    {passwordCriteria.minLength ? <Check size={13} className="text-emerald-600" /> : <span className="w-3.5 text-center">•</span>}
                    <span>Tối thiểu 8 ký tự</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.hasUpper && passwordCriteria.hasLower ? "text-emerald-600 font-medium" : "text-zinc-400"}`}>
                    {passwordCriteria.hasUpper && passwordCriteria.hasLower ? <Check size={13} className="text-emerald-600" /> : <span className="w-3.5 text-center">•</span>}
                    <span>Chữ hoa & thường</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.hasDigit ? "text-emerald-600 font-medium" : "text-zinc-400"}`}>
                    {passwordCriteria.hasDigit ? <Check size={13} className="text-emerald-600" /> : <span className="w-3.5 text-center">•</span>}
                    <span>Chứa ít nhất 1 chữ số</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.hasSpecial ? "text-emerald-600 font-medium" : "text-zinc-400"}`}>
                    {passwordCriteria.hasSpecial ? <Check size={13} className="text-emerald-600" /> : <span className="w-3.5 text-center">•</span>}
                    <span>Ký tự đặc biệt (!@#$)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Internal Captcha Challenge */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center ml-1">
              <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-blue-600" />
                Mã xác thực bảo vệ (Captcha)
              </label>
              <button
                type="button"
                onClick={fetchCaptcha}
                disabled={isCaptchaLoading}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium transition-colors"
                title="Đổi mã captcha khác"
              >
                <ArrowClockwise size={13} className={isCaptchaLoading ? "animate-spin" : ""} />
                Làm mới
              </button>
            </div>

            <div className="flex gap-2.5 items-center">
              <div 
                className="bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 cursor-pointer shadow-inner flex items-center justify-center min-w-[140px] h-[46px] select-none"
                onClick={fetchCaptcha}
                title="Bấm vào hình để đổi mã khác"
              >
                {captchaSvg ? (
                  <div dangerouslySetInnerHTML={{ __html: captchaSvg }} />
                ) : (
                  <span className="text-xs text-zinc-400">Đang tải mã...</span>
                )}
              </div>
              <input
                type="text"
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                className="flex-1 bg-white/70 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all placeholder:text-zinc-400 text-center font-mono font-bold tracking-widest uppercase text-base"
                placeholder="NHẬP MÃ"
                maxLength={6}
                required
              />
            </div>
            <p className="text-[11px] text-zinc-400 ml-1">Nhập 5 ký tự xuất hiện trong hình trên</p>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || (password.length > 0 && !isPasswordValid)}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-3 rounded-xl transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zinc-900/20 text-sm flex items-center justify-center gap-2"
          >
            {isLoading ? "Đang tạo tài khoản..." : "Đăng ký tài khoản"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-semibold text-zinc-900 hover:underline">
            Đăng nhập ngay
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
