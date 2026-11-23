import React, { useEffect, useState } from 'react';
import { LogIn, LogOut, UserPlus, X } from 'lucide-react';
import type { User } from 'firebase/auth';

interface AuthModalProps {
  open: boolean;
  initialTab?: 'signin' | 'register';
  user: User | null;
  displayName: string;
  isAuthenticating: boolean;
  authError: string | null;
  onClose: () => void;
  onGoogleAuth: (mode: 'signin' | 'register', explorerName?: string) => void;
  onSignOut: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  initialTab = 'signin',
  user,
  displayName,
  isAuthenticating,
  authError,
  onClose,
  onGoogleAuth,
  onSignOut,
}) => {
  const [tab, setTab] = useState<'signin' | 'register'>(initialTab);
  const [explorerName, setExplorerName] = useState('');

  useEffect(() => {
    setTab(initialTab);
    setExplorerName('');
  }, [initialTab, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-[#1d273b]/40 z-50 flex items-center justify-center p-5 backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-[#fffdf8] border border-[#f0e9dc] rounded-[20px] p-6 w-full max-w-[440px] shadow-[0_20px_70px_rgba(24,34,53,0.25)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ff826e] text-white grid place-items-center text-[18px]">
              🌍
            </div>
            <h3 id="auth-modal-title" className="font-[900] text-[18px] text-[#27334b]">
              {user ? 'Explorer Account' : tab === 'signin' ? 'Sign in to your journal' : 'Create your journal account'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-[10px] bg-[#f5eee6] text-[#27334b] grid place-items-center hover:bg-[#eadfd3] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {user ? (
          <div className="space-y-4">
            <div className="bg-white border border-[#f0e9dc] rounded-2xl p-4 flex items-center gap-3.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                  className="w-12 h-12 rounded-full object-cover border border-[#f0e9dc]"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#ffd76a] grid place-items-center font-[900] text-[18px] text-[#27334b]">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <strong className="font-[800] text-[15px] text-[#27334b] block truncate">
                  {displayName}
                </strong>
                <span className="text-[12px] text-[#6c7584] block truncate">
                  {user.email || 'Signed in with Google'}
                </span>
                <span className="text-[11px] font-semibold text-[#458a68] block mt-0.5">
                  Cloud sync active
                </span>
              </div>
            </div>

            <p className="text-[12px] text-[#6c7584] leading-[1.6]">
              Your countries, passport stamps, planned trips, bucket list dreams, journal memories, bookings, and budget are safely synced to your account.
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[13px] font-bold hover:bg-[#fff9ed] transition-colors"
              >
                Keep exploring
              </button>
              <button
                type="button"
                disabled={isAuthenticating}
                onClick={onSignOut}
                className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#fff4f0] border border-[#f5d3ca] text-[#c94a3b] text-[13px] font-bold hover:bg-[#ffe8df] transition-colors disabled:opacity-60"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Sign in / Register Switch */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#f5efe4] rounded-xl mb-4" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'signin'}
                onClick={() => setTab('signin')}
                className={`py-2 rounded-lg text-[12px] font-bold transition-colors inline-flex items-center justify-center gap-1.5 ${
                  tab === 'signin'
                    ? 'bg-white text-[#27334b] shadow-sm'
                    : 'text-[#6c7584] hover:text-[#27334b]'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'register'}
                onClick={() => setTab('register')}
                className={`py-2 rounded-lg text-[12px] font-bold transition-colors inline-flex items-center justify-center gap-1.5 ${
                  tab === 'register'
                    ? 'bg-white text-[#27334b] shadow-sm'
                    : 'text-[#6c7584] hover:text-[#27334b]'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Register
              </button>
            </div>

            <p className="text-[13px] text-[#5b6578] leading-[1.6] mb-4">
              {tab === 'signin'
                ? 'Sign in with your Google account to restore your trips, passport stamps, journal entries, and travel budget.'
                : 'Register your explorer profile with Google to save your current journal entries and access them from any device.'}
            </p>

            {tab === 'register' && (
              <div className="mb-4">
                <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
                  Explorer display name (optional)
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={explorerName}
                  onChange={(e) => setExplorerName(e.target.value)}
                  placeholder="e.g. Little Explorer"
                  className="w-full border border-[#f0e9dc] rounded-[11px] bg-white px-3.5 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e] transition-colors"
                />
              </div>
            )}

            {authError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-[#fff4f0] border border-[#f5d3ca] text-[#b93f31] text-[12px]"
              >
                {authError}
              </div>
            )}

            <button
              type="button"
              disabled={isAuthenticating}
              onClick={() => onGoogleAuth(tab, explorerName)}
              className="w-full py-3 px-4 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#ffffff"
                  d="M21.35 11.1H12v3.2h5.35c-.25 1.45-1.55 4.25-5.35 4.25-3.22 0-5.85-2.66-5.85-5.95S8.78 6.65 12 6.65c1.83 0 3.06.78 3.76 1.45l2.56-2.46C16.68 4.1 14.54 3.2 12 3.2 7.13 3.2 3.2 7.13 3.2 12s3.93 8.8 8.8 8.8c5.08 0 8.45-3.57 8.45-8.6 0-.58-.06-1.02-.1-1.1z"
                />
              </svg>
              {isAuthenticating
                ? 'Connecting...'
                : tab === 'signin'
                ? 'Sign in with Google'
                : 'Register with Google'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
