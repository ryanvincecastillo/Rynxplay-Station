import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, AlertCircle, Loader2 } from 'lucide-react'
import { signIn } from '@/lib/supabase'
import { useAppStore } from '@/stores/appStore'

export function LoginPage() {
  const navigate = useNavigate()
  const { initialize, addToast } = useAppStore()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError('Please enter both email and password')
      return
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      const { error } = await signIn(email, password)
      
      if (error) {
        setError(error.message || 'Failed to sign in')
        setIsLoading(false)
        return
      }
      
      // Re-initialize the app after successful login
      await initialize()
      
      addToast({
        type: 'success',
        message: 'Welcome back!'
      })
      
      navigate('/')
    } catch (err) {
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-rynx-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>
      
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-rynx-400 to-rynx-600 mb-4 shadow-lg shadow-rynx-500/25">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">RYNXPLAY STATION</h1>
          <p className="text-slate-400">Admin Dashboard</p>
        </div>
        
        {/* Login Card */}
        <div className="card p-8">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            Sign in to your account
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Alert */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
            
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                autoComplete="email"
                className="input"
              />
            </div>
            
            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="input pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            
            {/* Remember Me / Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-rynx-500 focus:ring-rynx-500 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-400">Remember me</span>
              </label>
              
              <button
                type="button"
                className="text-sm text-rynx-400 hover:text-rynx-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
          
          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-sm text-slate-500">or</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>
          
          {/* Demo Login */}
          <button
            type="button"
            onClick={() => {
              setEmail('demo@rynxplay.com')
              setPassword('demo123')
            }}
            className="btn-secondary w-full justify-center"
          >
            Use Demo Credentials
          </button>
        </div>
        
        {/* Footer */}
        <p className="text-center text-sm text-slate-600 mt-6">
          &copy; {new Date().getFullYear()} RYNXPLAY STATION. All rights reserved.
        </p>
      </div>
    </div>
  )
}
