import React, { useState, useRef, useEffect } from 'react';
import { Globe, Users, Shield, Settings, ExternalLink, Search } from 'lucide-react';
import { COUNTRIES, Country } from '../data/countries';

interface HeaderProps {
  userCountry: Country;
  targetCountry: Country;
  onSelectTargetCountry: (country: Country) => void;
  onlineCount: number;
  inMatchCount: number;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  onOpenTestWindow: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userCountry,
  targetCountry,
  onSelectTargetCountry,
  onlineCount,
  inMatchCount,
  onOpenSettings,
  onOpenAdmin,
  onOpenTestWindow
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <header className="h-16 bg-slate-900/90 border-b border-slate-800 px-4 md:px-6 flex items-center justify-between z-30 backdrop-blur-md sticky top-0">
      {/* Brand & Live Counter */}
      <div className="flex items-center gap-3 md:gap-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <span className="text-white font-black text-sm tracking-tighter">OL</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5 leading-none">
              OmeLive
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Random Video Chat</p>
          </div>
        </div>

        {/* Live Metrics Pill */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 rounded-full px-3 py-1 text-xs text-slate-300">
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            <strong className="text-white">{onlineCount > 0 ? onlineCount : 1}</strong> Online
          </span>
          {inMatchCount > 0 && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-rose-400 font-medium">{inMatchCount * 2} Talking</span>
            </>
          )}
        </div>
      </div>

      {/* Country Matchmaking Selector & Controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Country Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 border border-slate-700 text-white px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition shadow-sm hover:border-slate-600 cursor-pointer"
            title="Choose target matchmaking country"
          >
            <span className="text-base">{targetCountry.flag}</span>
            <span className="hidden xs:inline max-w-[120px] truncate">{targetCountry.name}</span>
            <span className="text-slate-400 text-[10px]">▼</span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-850 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2 border-b border-slate-800 bg-slate-900/60">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search country..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
                    autoFocus
                  />
                </div>
                <div className="mt-1.5 px-1 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Your detected location:</span>
                  <span className="text-white font-medium">{userCountry.flag} {userCountry.name}</span>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto p-1.5 divide-y divide-slate-800/40">
                {filteredCountries.map(c => (
                  <button
                    key={c.code}
                    onClick={() => {
                      onSelectTargetCountry(c);
                      setDropdownOpen(false);
                      setSearchTerm('');
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition cursor-pointer text-left ${
                      targetCountry.code === c.code
                        ? 'bg-rose-500/20 text-rose-300 font-semibold'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{c.flag}</span>
                      <span>{c.name}</span>
                    </span>
                    {targetCountry.code === c.code && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    )}
                  </button>
                ))}
                {filteredCountries.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No country found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Test Mode / 2nd Window Button */}
        <button
          onClick={onOpenTestWindow}
          className="flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer"
          title="Open a 2nd tab/window to test real P2P video chat matchmaking"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Open 2nd Window</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 rounded-lg transition cursor-pointer"
          title="Audio & Video Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Moderation / Admin button */}
        <button
          onClick={onOpenAdmin}
          className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 rounded-lg transition cursor-pointer"
          title="Moderation & Admin Panel"
        >
          <Shield className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
