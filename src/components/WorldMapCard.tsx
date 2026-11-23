import React, { useState } from 'react';
import type { Country } from '../types/journal';

interface WorldMapCardProps {
  countries: Country[];
  onSelectCountry: (countryName: string) => void;
}

export const WorldMapCard: React.FC<WorldMapCardProps> = ({ countries, onSelectCountry }) => {
  const [hoveredCountry, setHoveredCountry] = useState<Country | null>(null);
  const visitedCount = countries.filter((c) => c.flagged === 'visited').length;

  return (
    <div className="bg-[#e9f5ef] rounded-[15px] relative min-h-[240px] p-3 overflow-hidden">
      <svg
        className="w-full h-[215px] block select-none"
        viewBox="0 0 700 300"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="Interactive travel footprint map"
      >
        {/* Continents */}
        <g fill="#b3d8c6" stroke="#a1cbb6" strokeWidth="2">
          {/* North America */}
          <path d="M55 75l40-24 62 10 28 26-18 28-33 7-18 34-30-8-15-31-29-8z" />
          {/* South America */}
          <path d="M155 164l28 14 20 45-14 49-19 18-15-52-16-42z" />
          {/* Europe */}
          <path d="M305 72l35-18 38 10 20 24-17 17-42-5-24 14-21-18z" />
          {/* Africa */}
          <path d="M342 125l49-14 39 25-8 55-30 44-29-19-19-50z" />
          {/* Asia */}
          <path d="M405 69l57-26 94 17 42 35-21 32-62-8-27 25-47-23-38 2-19-26z" />
          {/* Australia */}
          <path d="M538 186l40-8 34 28-13 42-36 9-28-32z" />
          {/* New Zealand */}
          <path d="M633 249l15-6 12 12-11 13-17-6z" />
        </g>

        {/* Flight routes */}
        <path
          d="M545 145 Q555 122 565 108"
          stroke="#ff826e"
          strokeWidth="2"
          strokeDasharray="4 5"
          fill="none"
        />
        <path
          d="M565 108 Q455 62 356 98"
          stroke="#ff826e"
          strokeWidth="2"
          strokeDasharray="5 6"
          fill="none"
        />
        <path
          d="M356 98 Q245 78 138 108"
          stroke="#ff826e"
          strokeWidth="2"
          strokeDasharray="5 6"
          fill="none"
        />

        {/* Continent Labels */}
        <g fill="#27334b" fontFamily="DM Sans, sans-serif" fontSize="10" fontWeight="700" opacity="0.72">
          <text x="342" y="36">EUROPE</text>
          <text x="385" y="265">AFRICA</text>
          <text x="495" y="35">ASIA</text>
          <text x="58" y="35">N. AMERICA</text>
          <text x="145" y="285">S. AMERICA</text>
          <text x="565" y="285">OCEANIA</text>
        </g>

        {/* Country Pins */}
        {countries.map((country) => {
          const isVisited = country.flagged === 'visited';
          const isWishlist = country.flagged === 'wishlist';
          const isHovered = hoveredCountry?.name === country.name;

          return (
            <g
              key={country.name}
              className="cursor-pointer"
              onClick={() => onSelectCountry(country.name)}
              onMouseEnter={() => setHoveredCountry(country)}
              onMouseLeave={() => setHoveredCountry(null)}
            >
              <circle
                cx={country.mapCoords.x}
                cy={country.mapCoords.y}
                r={isHovered ? 10 : isVisited ? 8 : 5.5}
                fill={isVisited ? '#ff826e' : isWishlist ? '#ffd76a' : '#7b8fa1'}
                stroke="#ffffff"
                strokeWidth="2.5"
                style={{ transition: 'r 160ms ease' }}
              />
            </g>
          );
        })}
      </svg>

      {/* Bottom status / hover legend */}
      <div className="flex items-center justify-between gap-3 flex-wrap mt-1">
        <div className="bg-[#fffdf2] border border-[#e6efe9] rounded-[11px] px-3 py-1.5 text-[11px] text-[#27334b] shadow-sm tabular-nums">
          {hoveredCountry ? (
            <span>
              {hoveredCountry.flag} <strong>{hoveredCountry.name}</strong> ·{' '}
              {hoveredCountry.flagged === 'visited'
                ? 'Visited'
                : hoveredCountry.flagged === 'wishlist'
                ? 'Wishlist'
                : 'Explore'}{' '}
              (click to view)
            </span>
          ) : (
            <span>
              <strong>{visitedCount}</strong> {visitedCount === 1 ? 'country' : 'countries'} explored · Click any pin to open passport
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#4b5b63] px-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff826e] border border-white inline-block" />
            Visited
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffd76a] border border-white inline-block" />
            Wishlist
          </span>
        </div>
      </div>
    </div>
  );
};
