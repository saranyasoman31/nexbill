// Top Application Header with Logged User, Role, IP Address, Date and Time
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Clock,
  LogOut,
  Menu,
  ChevronRight,
  Sun,
  Moon,
  RotateCcw,
  Globe,
  User,
  Shield,
} from 'lucide-react';

export default function Header() {
  const {
    db,
    currentUserId,
    setCurrentUserId,
    currentUser,
    resetAllData,
    logoutUser,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    activeTab,
    theme,
    toggleTheme,
  } = useApp();

  // Live real-time clock updating every second
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [ipAddress, setIpAddress] = useState('192.168.1.105');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Terminal IP Address resolution (detects local LAN IP via WebRTC or defaults to terminal IP)
  useEffect(() => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {});
      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        const matched = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(ice.candidate.candidate);
        const candidateIp = matched?.[1];
        if (candidateIp && !candidateIp.startsWith('0.') && !candidateIp.startsWith('127.')) {
          setIpAddress(candidateIp);
          pc.onicecandidate = () => {};
          pc.close();
        }
      };
      setTimeout(() => {
        try {
          pc.close();
        } catch (_) {}
      }, 2500);
    } catch (_) {
      // Fallback terminal IP
    }
  }, []);

  const formattedTabName = activeTab.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  const userRoleObj = db.roles?.find(
    (r) => r.id === (currentUser?.roleId || currentUser?.role) || r.code === currentUser?.role
  );
  const roleDisplayName = userRoleObj?.name || currentUser?.role?.replace(/_/g, ' ') || 'User';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-200 sticky top-0 z-40 shadow-xl">
      <div className="w-full px-4 py-2 flex flex-wrap items-center justify-between gap-3">
        {/* Brand and Breadcrumb */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Toggle Menu Sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 font-black text-white text-base">
            N
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-tight text-sm">NexBill</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {formattedTabName}
            </span>
          </div>
        </div>

        {/* Global Context: Logged User, Role, IP Address, Date & Time, System Controls */}
        <div className="flex items-center flex-wrap gap-2.5 text-xs">
          {/* Logged User & Role Badge with Quick Switcher */}
          <div className="flex items-center bg-slate-950/80 border border-slate-700/80 rounded-xl px-2.5 py-1.5 gap-2 shadow-sm">
            {currentUser?.photo ? (
              <img
                src={currentUser.photo}
                alt={currentUser.name}
                className="w-5 h-5 rounded-full object-cover border border-indigo-400/60 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-indigo-950 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
                <User className="w-3 h-3" />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-xs whitespace-nowrap">
                {currentUser?.name}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase leading-none whitespace-nowrap">
                {roleDisplayName}
              </span>
            </div>

            {/* User Switcher (only shown if multiple staff users exist) */}
            {db.users && db.users.length > 1 && (
              <select
                value={currentUserId}
                onChange={(e) => setCurrentUserId(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 text-indigo-200 text-[11px] rounded-lg px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 cursor-pointer ml-1 font-medium"
                title="Switch Active Operator / Role"
              >
                {db.users.map((u) => (
                  <option key={u.id} value={u.id} className="bg-slate-900 text-slate-100">
                    {u.name} — [{u.role.replace(/_/g, ' ')}]
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* IP Address */}
          <div
            className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 shadow-sm"
            title="Terminal POS IP Address"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">IP:</span>
              <span className="font-mono font-semibold text-cyan-300 text-xs">{ipAddress}</span>
            </div>
          </div>

          {/* Live Date and Time */}
          <div
            className="flex items-center gap-2 bg-slate-950/80 border border-slate-700/80 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 shadow-sm font-mono"
            title="Terminal System Date & Live Time"
          >
            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-bold text-slate-200">
                {currentDateTime.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-300 font-bold">
                {currentDateTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })}
              </span>
            </div>
          </div>

          {/* Theme Toggle Button (Dark / Light) */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode for better daytime visibility' : 'Switch to Dark Mode'}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-300 border border-slate-700 transition flex items-center gap-1.5"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
            <span className="hidden xl:inline text-[11px] font-semibold text-slate-300">
              {theme === 'dark' ? 'Light' : 'Dark'}
            </span>
          </button>

          {/* Quick Demo Reset DB */}
          <button
            onClick={() => {
              if (window.confirm('Reset database to clean default seed state? All transactions will reset.')) {
                resetAllData();
              }
            }}
            title="Reset database to initial baseline data"
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-rose-300 border border-slate-700 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Logout Button */}
          <button
            onClick={() => {
              if (window.confirm('Sign out from this terminal session?')) {
                logoutUser();
              }
            }}
            title="Sign out of ERP terminal"
            className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 flex items-center gap-1.5 transition text-xs font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
