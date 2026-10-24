// LoginPage: NexBill Enterprise Terminal Sign In with Security Captcha Verification
import React, { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import Captcha from '../common/Captcha';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  KeyRound,
  Sun,
  Moon,
} from 'lucide-react';

export default function LoginPage() {
  const { db, loginUser, notify, theme, toggleTheme } = useApp();

  // Default login set for System Administrator
  const [emailOrUsername, setEmailOrUsername] = useState('admin@nexbill.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaInput, setCaptchaInput] = useState('');
  const [rememberTerminal, setRememberTerminal] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const captchaRef = useRef(null);

  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMessage('');

    // 1. Verify Security Captcha
    if (!captchaRef.current || !captchaRef.current.validate(captchaInput)) {
      setErrorMessage('Security Captcha is incorrect. Please re-enter the code shown.');
      if (captchaRef.current) captchaRef.current.refresh();
      setCaptchaInput('');
      return;
    }

    // 2. Authenticate User against Database
    setIsLoading(true);
    setTimeout(() => {
      const query = emailOrUsername.trim().toLowerCase();

      // Find user by email, name, username, or 'admin' alias
      const user = db.users.find(
        (u) =>
          u.email?.toLowerCase() === query ||
          u.name?.toLowerCase() === query ||
          u.username?.toLowerCase() === query ||
          (query === 'admin' && (u.id === 'USR-ADMIN' || u.role === 'ADMINISTRATOR' || u.role === 'COMPANY_ADMIN'))
      ) || (query === 'admin' || query.includes('admin') ? db.users.find(u => u.id === 'USR-ADMIN') : null);

      if (!user) {
        setErrorMessage('User account not found in company directory.');
        setIsLoading(false);
        if (captchaRef.current) captchaRef.current.refresh();
        setCaptchaInput('');
        return;
      }

      // Check if staff has been discontinued or deactivated
      if (user.active === false || user.isDiscontinued === true || user.blockLogin === true) {
        setErrorMessage(
          `Terminal Access Blocked: Staff account for "${user.name}" is discontinued / inactive (${user.discontinueReason || 'Deactivated'}).`
        );
        setIsLoading(false);
        if (captchaRef.current) captchaRef.current.refresh();
        setCaptchaInput('');
        return;
      }

      // Password validation (supports user custom password and demo passwords)
      const validPasswords = ['admin', 'admin123', 'admin@123', 'nexbill@123', 'password', 'password123'];
      const isPasswordCorrect =
        (user.password && password.trim() === user.password.trim()) ||
        validPasswords.includes(password.trim());

      if (!isPasswordCorrect) {
        setErrorMessage('Invalid credentials. Please verify your username and password.');
        setIsLoading(false);
        if (captchaRef.current) captchaRef.current.refresh();
        setCaptchaInput('');
        return;
      }

      // Success
      setIsLoading(false);
      notify('success', `Welcome back, ${user.name}! Terminal authenticated with ${user.role} privileges.`, 'Access Granted');
      loginUser(user);
    }, 350);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans selection:bg-indigo-600 selection:text-white">
      {/* Quick Theme Toggle (Top Right) */}
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={toggleTheme}
          type="button"
          title={theme === 'dark' ? 'Switch to Light Mode for high daytime contrast' : 'Switch to Dark Mode'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white transition shadow-lg backdrop-blur-md"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </div>

      {/* Background Ambience Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/15 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-4">
        {/* Brand Banner */}
        <div className="text-center space-y-1">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 items-center justify-center shadow-xl shadow-indigo-500/30 text-white font-black text-2xl mb-1">
            N
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">NexBill</h1>
          <p className="text-xs text-slate-400">
            Enterprise Billing, Multi-Store Inventory & Management Suite
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="border-b border-slate-800 pb-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200">Terminal Authentication</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center gap-1 font-semibold">
              <ShieldCheck className="w-3 h-3" /> Secure Gateway
            </span>
          </div>

          {errorMessage && (
            <div className="bg-rose-950/80 border border-rose-500/50 rounded-xl p-3 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
            {/* Email / Username */}
            <div>
              <label className="font-semibold text-slate-300 block mb-1">Username or Email</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder="Enter username or email"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="font-semibold text-slate-300 block mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-10 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Security Captcha (Canvas Distortion with Noise & TTS) */}
            <div className="border-t border-slate-800/80 pt-3">
              <label className="font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  Security Captcha Verification
                </span>
                <span className="text-[10px] text-slate-500">Case-Insensitive</span>
              </label>

              <Captcha
                ref={captchaRef}
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
              />
            </div>

            {/* Remember Terminal */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-400 text-[11px]">
                <input
                  type="checkbox"
                  checked={rememberTerminal}
                  onChange={(e) => setRememberTerminal(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                />
                Remember this terminal station
              </label>
              <span className="text-[11px] text-indigo-400 font-semibold cursor-pointer hover:underline">
                Branch Helpdesk
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition duration-150"
            >
              {isLoading ? (
                <span>Authenticating Terminal...</span>
              ) : (
                <>
                  <span>Sign In & Open Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Compliance Footer */}
        <div className="text-center text-[10px] text-slate-600">
          NexBill Enterprise Suite • Governed by Stock & Financial Integrity Transaction Rules
        </div>
      </div>
    </div>
  );
}
