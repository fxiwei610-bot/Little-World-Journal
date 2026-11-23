import React from 'react';
import type { User } from 'firebase/auth';
import {
  BookOpen,
  Compass,
  Globe,
  Heart,
  Home,
  LogIn,
  LogOut,
  Plane,
  Stamp,
  Ticket,
  Train,
  Wallet,
} from 'lucide-react';
import type { PageId } from '../types/journal';

interface SidebarProps {
  activePage: PageId;
  user: User | null;
  displayName: string;
  onNavigate: (page: PageId) => void;
  onOpenAuth: (tab: 'signin' | 'register') => void;
  onSignOut: () => void;
}

const NAV_ITEMS: { id: PageId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home className="w-[17px] h-[17px]" /> },
  { id: 'world-map', label: 'World Map', icon: <Globe className="w-[17px] h-[17px]" /> },
  { id: 'explore', label: 'Explore World', icon: <Compass className="w-[17px] h-[17px]" /> },
  { id: 'trips', label: 'My Trips', icon: <Plane className="w-[17px] h-[17px]" /> },
  { id: 'transport', label: 'Transport Guide', icon: <Train className="w-[17px] h-[17px]" /> },
  { id: 'bucket', label: 'Bucket List', icon: <Heart className="w-[17px] h-[17px]" /> },
  { id: 'journal', label: 'Travel Journal', icon: <BookOpen className="w-[17px] h-[17px]" /> },
  { id: 'bookings', label: 'Booking Center', icon: <Ticket className="w-[17px] h-[17px]" /> },
  { id: 'budget', label: 'Budget Tracker', icon: <Wallet className="w-[17px] h-[17px]" /> },
  { id: 'passport', label: 'My Passport', icon: <Stamp className="w-[17px] h-[17px]" /> },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  user,
  displayName,
  onNavigate,
  onOpenAuth,
  onSignOut,
}) => {
  const effectiveActive =
    activePage === 'country'
      ? 'explore'
      : activePage === 'journal-detail'
        ? 'journal'
        : activePage;

  return (
    <aside className="w-[72px] md:w-[248px] bg-[#fffdf8] border-r border-[#f0e9dc] px-2.5 md:px-[17px] py-5 md:py-[27px] fixed inset-y-0 left-0 z-20 flex flex-col">
      {/* Brand */}
      <button
        type="button"
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-[11px] px-1 md:px-[10px] pb-6 md:pb-[28px] text-left focus-visible:outline-2 focus-visible:outline-[#ff826e] rounded-xl"
      >
        <div className="w-[43px] h-[43px] shrink-0 rounded-[15px] bg-[#ff826e] grid place-items-center text-[22px] shadow-[0_5px_0_#f2c5b8]">
          🌍
        </div>
        <div className="hidden md:block">
          <h1 className="font-[900] text-[17px] leading-[1.08] text-[#27334b] m-0">
            The Little
            <br />
            World Journal
          </h1>
          <span className="block text-[10px] text-[#7e8795] tracking-[1.2px] mt-0.5">
            COLLECT · CREATE · EXPLORE
          </span>
        </div>
      </button>

      <div className="hidden md:block text-[10px] tracking-[1.5px] text-[#8d929c] font-bold px-3 pt-2 pb-2">
        YOUR LITTLE WORLD
      </div>

      <nav className="grid gap-1" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = effectiveActive === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              title={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full text-left px-2 md:px-3 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center md:justify-start gap-3 transition-colors duration-150 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#ff826e] ${
                isActive
                  ? 'bg-[#fff0e9] text-[#d65442]'
                  : 'text-[#5b6578] hover:bg-[#fff0e9]/70 hover:text-[#d65442]'
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="hidden md:inline truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom account & reminder section */}
      <div className="mt-auto space-y-3 pt-4">
        <div className="hidden md:block bg-[#f5f0ff] rounded-2xl p-[15px]">
          <strong className="font-[800] text-[13px] text-[#27334b] block">
            Little travel reminder
          </strong>
          <p className="text-[11px] leading-[1.55] text-[#66637a] mt-1.5 mb-2.5">
            “The world is full of tiny moments waiting to become memories.”
          </p>
          <div className="text-[16px] tracking-wider" aria-hidden="true">
            🌷 ✈️ ☁️
          </div>
        </div>

        {/* Account Card */}
        {user ? (
          <div className="bg-white border border-[#f0e9dc] rounded-2xl p-2 md:p-3">
            <div className="hidden md:flex items-center gap-2.5 mb-2.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-[#f0e9dc] shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#ffd76a] grid place-items-center font-[900] text-[13px] text-[#27334b] shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <strong className="font-[800] text-[12px] text-[#27334b] block truncate">
                  {displayName}
                </strong>
                <span className="text-[10px] text-[#6c7584] block truncate">
                  {user.email || 'Signed in'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              title="Sign out"
              className="w-full py-2 px-2 md:px-3 rounded-xl bg-[#fff4f0] text-[#c94a3b] hover:bg-[#ffe8df] text-[12px] font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#f0e9dc] rounded-2xl p-2 md:p-3">
            <p className="hidden md:block text-[11px] text-[#6c7584] mb-2 leading-snug">
              Sign in or register to save your journal to the cloud.
            </p>
            <button
              type="button"
              onClick={() => onOpenAuth('signin')}
              title="Sign in or register"
              className="w-full py-2 px-2 md:px-3 rounded-xl bg-[#ff826e] text-white hover:bg-[#f47561] text-[12px] font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Sign in / Register</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
