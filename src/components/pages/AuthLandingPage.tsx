import React, { useState } from 'react';
import { LogIn, LogOut, UserPlus } from 'lucide-react';
import type { User } from 'firebase/auth';
import { ScenicArtwork } from '../ScenicArtwork';

interface AuthLandingPageProps {
  unverifiedUser: User | null;
  isAuthenticating: boolean;
  authError: string | null;
  onGoogleAuth: (mode: 'signin' | 'register', explorerName?: string) => void;
  onSignOut: () => void;
}

export const AuthLandingPage: React.FC<AuthLandingPageProps> = ({
  unverifiedUser,
  isAuthenticating,
  authError,
  onGoogleAuth,
  onSignOut,
}) => {
  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [explorerName, setExplorerName] = useState('');

  return (
    <div className="min-h-screen bg-[#fff9ed] text-[#27334b] flex flex-col">
      {/* Top Bar */}
      <header className="w-full max-w-[1200px] mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-10 h-10 rounded-[14px] bg-[#ff826e] grid place-items-center text-[20px] shadow-[0_4px_0_#f2c5b8]">
            🌍
          </div>
          <span className="font-[900] text-[18px] tracking-tight text-[#27334b]">
            The Little World Journal
          </span>
        </div>

        {!unverifiedUser && (
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setTab('signin')}
              className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                tab === 'signin'
                  ? 'bg-white border border-[#f0e9dc] text-[#27334b]'
                  : 'text-[#5b6578] hover:text-[#27334b]'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setTab('register')}
              className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                tab === 'register'
                  ? 'bg-[#ff826e] text-white'
                  : 'bg-[#fff0e9] text-[#d65442] hover:bg-[#ffe4db]'
              }`}
            >
              Register
            </button>
          </div>
        )}
      </header>

      {/* Main Split Content */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-5 sm:px-8 py-6 sm:py-10 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-[1.15fr_0.9fr] gap-8 lg:gap-10 items-stretch">
          {/* Left: Editorial Overview & Destination Postcards */}
          <div className="flex flex-col justify-between gap-6">
            <div>
              <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
                Personal Travel Companion
              </div>
              <h1 className="font-[900] text-[34px] sm:text-[46px] leading-[1.08] tracking-[-0.8px] text-[#27334b] mt-2 mb-4 text-balance max-w-xl">
                Collect every corner of your little world.
              </h1>
              <p className="text-[15px] leading-[1.65] text-[#5b6578] max-w-xl">
                Sign in to open your private travel dashboard—plan upcoming itineraries with
                AI-tailored packing lists, check live destination weather, stamp your digital
                passport, and keep every memory and booking in one calm place.
              </p>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-semibold text-[#6c7584] mt-5">
                <span>Interactive World Map</span>
                <span aria-hidden="true">·</span>
                <span>Smart Packing Lists</span>
                <span aria-hidden="true">·</span>
                <span>Memory Scrapbook</span>
                <span aria-hidden="true">·</span>
                <span>Budget Tracker</span>
              </div>
            </div>

            {/* Postcard Artwork Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="bg-white border border-[#f0e9dc] rounded-[16px] overflow-hidden">
                <div className="h-[118px] relative">
                  <ScenicArtwork scene="japan" alt="Kyoto pagoda and hills" variant="card" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a2438]/60 via-transparent to-transparent" />
                  <span className="absolute bottom-2.5 left-3 text-white font-[800] text-[12px]">
                    Kyoto, Japan
                  </span>
                </div>
              </div>

              <div className="bg-white border border-[#f0e9dc] rounded-[16px] overflow-hidden">
                <div className="h-[118px] relative">
                  <ScenicArtwork
                    scene="philippines"
                    alt="Palawan turquoise lagoon"
                    variant="card"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a2438]/60 via-transparent to-transparent" />
                  <span className="absolute bottom-2.5 left-3 text-white font-[800] text-[12px]">
                    Palawan, Philippines
                  </span>
                </div>
              </div>

              <div className="bg-white border border-[#f0e9dc] rounded-[16px] overflow-hidden">
                <div className="h-[118px] relative">
                  <ScenicArtwork scene="italy" alt="Amalfi cliffside coast" variant="card" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a2438]/60 via-transparent to-transparent" />
                  <span className="absolute bottom-2.5 left-3 text-white font-[800] text-[12px]">
                    Amalfi, Italy
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Sign In / Register Card */}
          <div className="bg-[#fffdf8] border border-[#f0e9dc] rounded-[22px] p-6 sm:p-8 flex flex-col justify-between">
            {unverifiedUser ? (
              <div className="space-y-4 my-auto">
                <h2 className="font-[900] text-[22px] text-[#27334b]">
                  Verify your account email
                </h2>
                <p className="text-[13px] text-[#5b6578] leading-[1.6]">
                  Your account ({unverifiedUser.email || 'current session'}) requires a verified
                  email address before opening your private journal dashboard.
                </p>
                <button
                  type="button"
                  disabled={isAuthenticating}
                  onClick={onSignOut}
                  className="w-full py-3 px-4 rounded-xl bg-[#fff4f0] border border-[#f5d3ca] text-[#c94a3b] text-[13px] font-bold hover:bg-[#ffe8df] transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            ) : (
              <div>
                <h2 className="font-[900] text-[22px] text-[#27334b] mb-1">
                  {tab === 'signin' ? 'Welcome back, explorer' : 'Create your journal account'}
                </h2>
                <p className="text-[13px] text-[#6c7584] mb-5">
                  {tab === 'signin'
                    ? 'Sign in to access your travel dashboard and synced plans.'
                    : 'Register to set up your personal world journal and cloud sync.'}
                </p>

                {/* Segmented Sign in / Register Switch */}
                <div
                  className="grid grid-cols-2 gap-1 p-1 bg-[#f5efe4] rounded-xl mb-5"
                  role="tablist"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === 'signin'}
                    onClick={() => setTab('signin')}
                    className={`py-2.5 rounded-lg text-[12px] font-bold transition-colors inline-flex items-center justify-center gap-1.5 ${
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
                    className={`py-2.5 rounded-lg text-[12px] font-bold transition-colors inline-flex items-center justify-center gap-1.5 ${
                      tab === 'register'
                        ? 'bg-white text-[#27334b] shadow-sm'
                        : 'text-[#6c7584] hover:text-[#27334b]'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Register
                  </button>
                </div>

                {tab === 'register' && (
                  <div className="mb-4">
                    <label
                      htmlFor="landing-explorer-name"
                      className="block text-[11px] font-bold text-[#5a6578] mb-1.5"
                    >
                      Explorer display name (optional)
                    </label>
                    <input
                      id="landing-explorer-name"
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
                  className="w-full py-3.5 px-4 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2.5"
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

            <div className="pt-5 mt-6 border-t border-[#f0e9dc] text-[11px] text-[#6c7584]">
              Your trips, passport stamps, memories, and packing lists are kept private to your
              signed-in account.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
