import React, { useState } from 'react';

interface ScenicArtworkProps {
  scene: string;
  photoUrl?: string;
  alt: string;
  className?: string;
  variant?: 'card' | 'hero' | 'thumb';
}

interface Palette {
  skyTop: string;
  skyBottom: string;
  sun: string;
  farHill: string;
  midHill: string;
  fore: string;
  accent: string;
}

const PALETTES: Record<string, Palette> = {
  japan: {
    skyTop: '#ffd9ce',
    skyBottom: '#fff1df',
    sun: '#ff826e',
    farHill: '#d6bfd8',
    midHill: '#9aa4c2',
    fore: '#374463',
    accent: '#e96556',
  },
  philippines: {
    skyTop: '#a9e2f5',
    skyBottom: '#e5f8f5',
    sun: '#ffd76a',
    farHill: '#7ec9b8',
    midHill: '#4da99c',
    fore: '#2b7a78',
    accent: '#ff9676',
  },
  korea: {
    skyTop: '#f8d8e6',
    skyBottom: '#fff3e9',
    sun: '#ffaf87',
    farHill: '#b8a9d6',
    midHill: '#8a7fb5',
    fore: '#3f4568',
    accent: '#ff826e',
  },
  italy: {
    skyTop: '#fde0b6',
    skyBottom: '#fff6e4',
    sun: '#ffba5a',
    farHill: '#c9b39d',
    midHill: '#85a992',
    fore: '#3b6a6b',
    accent: '#e87a64',
  },
  france: {
    skyTop: '#d7d8f7',
    skyBottom: '#fceae4',
    sun: '#ffd58c',
    farHill: '#b0add6',
    midHill: '#8b8bb5',
    fore: '#454a6b',
    accent: '#ff8e7a',
  },
  usa: {
    skyTop: '#f9caa7',
    skyBottom: '#fff0d8',
    sun: '#ff9c6e',
    farHill: '#d99879',
    midHill: '#ba6c54',
    fore: '#623f42',
    accent: '#ff7058',
  },
  canada: {
    skyTop: '#bce3f7',
    skyBottom: '#eef8fc',
    sun: '#ffe38c',
    farHill: '#8ec0d6',
    midHill: '#4d968d',
    fore: '#2b5e5b',
    accent: '#ff826e',
  },
  brazil: {
    skyTop: '#ffe399',
    skyBottom: '#f2fae4',
    sun: '#ffb94e',
    farHill: '#76c59d',
    midHill: '#45a685',
    fore: '#276d5e',
    accent: '#ff7b66',
  },
  southafrica: {
    skyTop: '#f8cf9f',
    skyBottom: '#fff2dc',
    sun: '#ff9f59',
    farHill: '#c69a87',
    midHill: '#8e6d74',
    fore: '#48495c',
    accent: '#7bc9a5',
  },
  australia: {
    skyTop: '#a9dcf4',
    skyBottom: '#fff3db',
    sun: '#ffd76a',
    farHill: '#72b7d4',
    midHill: '#4998bd',
    fore: '#29668c',
    accent: '#ff826e',
  },
  newzealand: {
    skyTop: '#c4e6f5',
    skyBottom: '#eaf7f0',
    sun: '#fff0b3',
    farHill: '#87b8b3',
    midHill: '#558e88',
    fore: '#2d585a',
    accent: '#ffd76a',
  },
  thailand: {
    skyTop: '#ffd6a5',
    skyBottom: '#fff4df',
    sun: '#ff9e5e',
    farHill: '#7ec4a7',
    midHill: '#499c87',
    fore: '#2b6766',
    accent: '#ffd15c',
  },
  wander: {
    skyTop: '#cde8f6',
    skyBottom: '#fff4e3',
    sun: '#ffd76a',
    farHill: '#a8d3bf',
    midHill: '#73b39c',
    fore: '#375e64',
    accent: '#ff826e',
  },
};

function renderLandmark(key: string, p: Palette) {
  switch (key) {
    case 'japan':
      return (
        <>
          <polygon points="180,150 250,76 320,150" fill={p.midHill} />
          <polygon points="231,96 250,76 269,96 258,101 250,94 242,101" fill="#fffdf8" />
          <path d="M0 148 Q110 132 220 146 T400 142 L400 200 L0 200 Z" fill={p.fore} />
          {/* Torii gate */}
          <rect x="88" y="108" width="6" height="44" fill={p.accent} rx="1" />
          <rect x="134" y="108" width="6" height="44" fill={p.accent} rx="1" />
          <path d="M76 108 Q114 100 152 108 L150 114 Q114 108 78 114 Z" fill={p.accent} />
          <rect x="84" y="121" width="60" height="5" fill={p.accent} rx="1" />
          {/* Sakura petals */}
          <circle cx="48" cy="54" r="3" fill="#fff5f3" opacity="0.85" />
          <circle cx="64" cy="44" r="2.5" fill="#fff5f3" opacity="0.85" />
          <circle cx="332" cy="56" r="3" fill="#fff5f3" opacity="0.85" />
        </>
      );
    case 'philippines':
      return (
        <>
          <path d="M22 146 L52 84 L82 114 L106 72 L138 146 Z" fill={p.farHill} />
          <path d="M250 146 L282 78 L316 112 L346 86 L380 146 Z" fill={p.midHill} />
          <rect x="0" y="140" width="400" height="60" fill={p.fore} />
          <path d="M35 156 Q95 150 155 156" stroke="#c8f2eb" strokeWidth="2.5" fill="none" opacity="0.6" />
          <path d="M210 168 Q275 162 340 168" stroke="#c8f2eb" strokeWidth="2.5" fill="none" opacity="0.6" />
          {/* Outrigger boat */}
          <path d="M168 146 Q200 154 232 146 L224 139 L176 139 Z" fill="#fffdf8" />
          <path d="M200 139 L200 112 L222 134 Z" fill={p.accent} />
        </>
      );
    case 'korea':
      return (
        <>
          <path d="M0 152 Q95 102 198 134 Q295 92 400 144 L400 200 L0 200 Z" fill={p.midHill} />
          {/* N Seoul Tower */}
          <rect x="278" y="64" width="6" height="58" fill="#fffdf8" rx="2" />
          <rect x="268" y="80" width="26" height="9" fill={p.accent} rx="3" />
          <line x1="281" y1="45" x2="281" y2="64" stroke="#fffdf8" strokeWidth="2.5" />
          <path d="M0 154 L400 154 L400 200 L0 200 Z" fill={p.fore} />
          {/* Hanok roof silhouette */}
          <path d="M62 140 Q106 125 150 140 L142 154 L70 154 Z" fill="#27334b" />
        </>
      );
    case 'italy':
      return (
        <>
          <path d="M0 120 Q85 95 156 146 L0 160 Z" fill={p.midHill} />
          <rect x="0" y="146" width="400" height="54" fill={p.fore} />
          {/* Cliffside village houses */}
          <rect x="42" y="110" width="22" height="24" fill="#ffe0b5" rx="2" />
          <rect x="68" y="102" width="24" height="32" fill="#ff9f89" rx="2" />
          <rect x="96" y="114" width="20" height="22" fill="#fff3dc" rx="2" />
          <rect x="52" y="128" width="26" height="20" fill="#ffd76a" rx="2" />
          {/* Sailboat */}
          <path d="M258 158 L286 158 L279 166 L264 166 Z" fill="#fffdf8" />
          <path d="M272 156 L272 124 L290 150 Z" fill={p.accent} />
        </>
      );
    case 'france':
      return (
        <>
          <path d="M0 150 Q140 132 280 148 T400 142 L400 200 L0 200 Z" fill={p.midHill} />
          {/* Eiffel silhouette */}
          <path d="M188 152 L198 62 L202 62 L212 152 L204 152 Q200 132 196 152 Z" fill={p.fore} />
          <rect x="192" y="114" width="16" height="4" fill={p.fore} />
          <rect x="195" y="92" width="10" height="3" fill={p.fore} />
          <rect x="0" y="152" width="400" height="48" fill={p.fore} />
        </>
      );
    case 'usa':
      return (
        <>
          <path d="M0 148 L56 96 L112 96 L146 148 Z" fill={p.midHill} />
          <rect x="0" y="148" width="400" height="52" fill={p.fore} />
          {/* Golden Gate bridge towers */}
          <rect x="186" y="88" width="7" height="60" fill={p.accent} />
          <rect x="292" y="96" width="7" height="52" fill={p.accent} />
          <path d="M120 124 Q189 92 239 124 Q295 100 360 126" stroke={p.accent} strokeWidth="3" fill="none" />
          <line x1="120" y1="126" x2="365" y2="126" stroke={p.accent} strokeWidth="4" />
        </>
      );
    case 'canada':
      return (
        <>
          <polygon points="24,150 96,74 166,150" fill={p.farHill} />
          <polygon points="126,150 212,62 296,150" fill={p.midHill} />
          <polygon points="187,88 212,62 237,88 222,94 212,84 202,94" fill="#fffdf8" />
          <polygon points="244,150 320,82 392,150" fill={p.farHill} />
          <rect x="0" y="146" width="400" height="54" fill={p.fore} />
          {/* Pine trees */}
          <polygon points="48,150 58,118 68,150" fill="#1e4443" />
          <polygon points="70,150 82,110 94,150" fill="#1e4443" />
          <polygon points="330,150 340,120 350,150" fill="#1e4443" />
        </>
      );
    case 'brazil':
      return (
        <>
          <path d="M40 152 Q105 70 155 152 Z" fill={p.midHill} />
          <path d="M170 152 Q235 95 310 152 Z" fill={p.farHill} />
          <rect x="0" y="146" width="400" height="54" fill={p.fore} />
          <path d="M42 158 Q145 150 248 158" stroke="#c3f0de" strokeWidth="2.5" fill="none" opacity="0.6" />
          {/* Palm silhouettes */}
          <path d="M324 148 Q330 116 342 98" stroke="#1e4f45" strokeWidth="4" fill="none" />
          <path d="M342 98 Q364 96 372 110" stroke="#1e4f45" strokeWidth="3" fill="none" />
          <path d="M342 98 Q322 92 312 106" stroke="#1e4f45" strokeWidth="3" fill="none" />
        </>
      );
    case 'southafrica':
      return (
        <>
          {/* Table Mountain flat plateau */}
          <path d="M52 150 L96 86 L282 86 L326 150 Z" fill={p.midHill} />
          <path d="M0 150 L400 150 L400 200 L0 200 Z" fill={p.fore} />
          <path d="M115 162 Q195 155 275 162" stroke="#ffe7cb" strokeWidth="2.5" fill="none" opacity="0.55" />
        </>
      );
    case 'australia':
      return (
        <>
          <rect x="0" y="146" width="400" height="54" fill={p.fore} />
          {/* Opera House sails */}
          <path d="M116 146 Q132 96 170 146 Z" fill="#fffdf8" />
          <path d="M158 146 Q178 86 218 146 Z" fill="#fff7e8" />
          <path d="M204 146 Q220 106 250 146 Z" fill="#fffdf8" />
          <path d="M72 164 Q195 156 320 164" stroke="#b9e8fb" strokeWidth="2.5" fill="none" opacity="0.6" />
        </>
      );
    case 'newzealand':
      return (
        <>
          <polygon points="0,152 84,74 176,152" fill={p.midHill} />
          <polygon points="154,152 248,66 348,152" fill={p.farHill} />
          <polygon points="222,90 248,66 274,90 258,95 248,86 238,95" fill="#fffdf8" />
          <rect x="0" y="146" width="400" height="54" fill={p.fore} />
        </>
      );
    case 'thailand':
      return (
        <>
          <path d="M24 148 Q64 78 104 148 Z" fill={p.farHill} />
          <path d="M294 148 Q336 86 378 148 Z" fill={p.midHill} />
          {/* Temple chedi */}
          <polygon points="186,148 200,78 214,148" fill={p.accent} />
          <polygon points="164,148 174,102 184,148" fill="#ffc247" />
          <rect x="0" y="146" width="400" height="54" fill={p.fore} />
        </>
      );
    default:
      return (
        <>
          <path d="M0 150 Q100 94 205 138 Q305 88 400 142 L400 200 L0 200 Z" fill={p.midHill} />
          <rect x="0" y="148" width="400" height="52" fill={p.fore} />
        </>
      );
  }
}

export const ScenicArtwork: React.FC<ScenicArtworkProps> = ({
  scene,
  photoUrl,
  alt,
  className = '',
  variant = 'card',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (photoUrl && !imgFailed) {
    return (
      <img
        src={photoUrl}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  const p = PALETTES[scene] || PALETTES.wander;
  const gradId = `sky-${scene}-${variant}`;

  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={alt}
      className={`w-full h-full block ${className}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.skyTop} />
          <stop offset="100%" stopColor={p.skyBottom} />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${gradId})`} />
      {/* Sun / Moon */}
      <circle cx="312" cy="54" r="24" fill={p.sun} opacity="0.9" />
      {/* Soft clouds */}
      <ellipse cx="98" cy="48" rx="34" ry="11" fill="#ffffff" opacity="0.55" />
      <ellipse cx="122" cy="44" rx="22" ry="9" fill="#ffffff" opacity="0.55" />
      <ellipse cx="264" cy="36" rx="28" ry="9" fill="#ffffff" opacity="0.45" />
      {renderLandmark(scene, p)}
    </svg>
  );
};
