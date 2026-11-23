import React, { useState } from 'react';
import { Check, Heart, Plus, Search } from 'lucide-react';
import { CONTINENTS } from '../../data/initialData';
import type { ContinentName, Country } from '../../types/journal';
import { ScenicArtwork } from '../ScenicArtwork';

interface ExplorePageProps {
  countries: Country[];
  onSelectCountry: (countryName: string) => void;
  onToggleWishCountry: (countryName: string) => void;
  onOpenAddCountry: () => void;
}

export const ExplorePage: React.FC<ExplorePageProps> = ({
  countries,
  onSelectCountry,
  onToggleWishCountry,
  onOpenAddCountry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [continentFilter, setContinentFilter] = useState<'All' | ContinentName>('All');

  const query = searchQuery.trim().toLowerCase();
  const filtered = countries.filter((c) => {
    const matchesContinent = continentFilter === 'All' || c.continent === continentFilter;
    if (!matchesContinent) return false;
    if (!query) return true;
    const haystack = [c.name, c.continent, c.capital, ...c.places, ...c.dest]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });

  return (
    <section aria-label="Explore the world">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
            A big world, little by little
          </div>
          <h2 className="font-[900] text-[26px] sm:text-[30px] tracking-[-0.5px] text-[#27334b] mt-1 mb-0.5 text-balance">
            Explore the world <span aria-hidden="true">🌎</span>
          </h2>
          <p className="text-[#6c7584] text-[13px]">
            Find your next somewhere. Every country has a story.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddCountry}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[13px] font-bold hover:bg-[#fffdf8] transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add country
        </button>
      </div>

      {/* Search & Continent Select */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#7e8795] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search countries, cities or places..."
            aria-label="Search countries, cities or places"
            className="w-full border border-[#f0e9dc] rounded-[11px] bg-white pl-10 pr-3.5 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e] transition-colors"
          />
        </div>
        <select
          value={continentFilter}
          onChange={(e) => setContinentFilter(e.target.value as 'All' | ContinentName)}
          aria-label="Filter by continent"
          className="border border-[#f0e9dc] rounded-[11px] bg-white px-3.5 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e] transition-colors"
        >
          <option value="All">All continents</option>
          {CONTINENTS.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Interactive Continent Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {CONTINENTS.map((cont) => {
          const isSelected = continentFilter === cont.name;
          return (
            <button
              key={cont.name}
              type="button"
              onClick={() => setContinentFilter(isSelected ? 'All' : cont.name)}
              className={`${cont.bgClass} rounded-2xl p-3.5 text-left border transition-all ${
                isSelected
                  ? 'border-[#ff826e] ring-2 ring-[#ff826e]/30 -translate-y-0.5'
                  : 'border-black/5 hover:-translate-y-0.5'
              }`}
            >
              <span className="text-[22px] block" aria-hidden="true">
                {cont.emoji}
              </span>
              <strong className="font-[900] text-[13px] text-[#27334b] block mt-2">
                {cont.name}
              </strong>
              <span className="text-[10px] text-[#5e687a] block mt-0.5 leading-tight">
                {cont.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="font-[800] text-[15px] text-[#27334b]">
          Countries to fall in love with{' '}
          <span className="text-[#6c7584] font-medium text-[13px] tabular-nums">
            ({filtered.length} shown)
          </span>
        </h3>
        {continentFilter !== 'All' && (
          <button
            type="button"
            onClick={() => setContinentFilter('All')}
            className="text-[12px] text-[#d65442] font-bold hover:underline"
          >
            Show all continents
          </button>
        )}
      </div>

      {/* Country Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((country) => (
            <div
              key={country.name}
              role="button"
              tabIndex={0}
              onClick={() => onSelectCountry(country.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectCountry(country.name);
                }
              }}
              className="bg-white border border-[#f0e9dc] rounded-2xl overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_34px_rgba(57,54,45,0.08)] transition-all text-left focus-visible:outline-2 focus-visible:outline-[#ff826e]"
            >
              <div className="h-[125px] relative overflow-hidden">
                <ScenicArtwork
                  scene={country.scene}
                  alt={`${country.name} scenic landscape`}
                  variant="card"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1c2838]/40 via-transparent to-transparent" />
                <span className="absolute bottom-2.5 left-3 text-[24px] drop-shadow" aria-hidden="true">
                  {country.flag}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWishCountry(country.name);
                  }}
                  aria-label={
                    country.flagged === 'visited'
                      ? `${country.name} visited`
                      : country.flagged === 'wishlist'
                      ? `Remove ${country.name} from wishlist`
                      : `Add ${country.name} to wishlist`
                  }
                  className={`absolute right-2.5 top-2.5 w-8 h-8 rounded-full grid place-items-center shadow-sm transition-colors ${
                    country.flagged === 'visited'
                      ? 'bg-[#7bc9a5] text-white'
                      : country.flagged === 'wishlist'
                      ? 'bg-[#ff826e] text-white'
                      : 'bg-white text-[#27334b] hover:bg-[#fff0e9]'
                  }`}
                >
                  {country.flagged === 'visited' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Heart
                      className="w-4 h-4"
                      fill={country.flagged === 'wishlist' ? 'currentColor' : 'none'}
                    />
                  )}
                </button>
              </div>

              <div className="px-4 py-3.5">
                <strong className="font-[900] text-[15px] text-[#27334b] block">
                  {country.name}
                </strong>
                <span className="block text-[#6c7584] text-[12px] mt-0.5">
                  {country.continent} · Capital: {country.capital}
                </span>
                <div className="flex items-center justify-between mt-3 text-[11px] text-[#6c7584] tabular-nums">
                  <span>{country.places.length} regions & cities</span>
                  <span
                    className={`font-semibold ${
                      country.flagged === 'visited'
                        ? 'text-[#458a68]'
                        : country.flagged === 'wishlist'
                        ? 'text-[#d65442]'
                        : 'text-[#6c7584]'
                    }`}
                  >
                    {country.flagged === 'visited'
                      ? 'Visited'
                      : country.flagged === 'wishlist'
                      ? 'On wishlist'
                      : 'Discover'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-[#6c7584] text-[13px] bg-white border border-dashed border-[#e9dfd1] rounded-[15px]">
          No matching countries yet. Try another search or clear the continent filter.
        </div>
      )}
    </section>
  );
};
