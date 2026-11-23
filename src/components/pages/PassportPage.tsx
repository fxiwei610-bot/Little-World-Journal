import React from 'react';
import { Compass } from 'lucide-react';
import type { Country } from '../../types/journal';

interface PassportPageProps {
  countries: Country[];
  onExploreMore: () => void;
  onSelectCountry: (countryName: string) => void;
}

export const PassportPage: React.FC<PassportPageProps> = ({
  countries,
  onExploreMore,
  onSelectCountry,
}) => {
  const visited = countries.filter((c) => c.flagged === 'visited');

  return (
    <section aria-label="My travel passport">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
            A passport full of stories
          </div>
          <h2 className="font-[900] text-[26px] sm:text-[30px] tracking-[-0.5px] text-[#27334b] mt-1 mb-0.5 text-balance">
            My travel passport <span aria-hidden="true">🛂</span>
          </h2>
          <p className="text-[#6c7584] text-[13px]">
            Every stamp is a memory you can keep.
          </p>
        </div>

        <button
          type="button"
          onClick={onExploreMore}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[13px] font-bold hover:bg-[#fffdf8] transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Compass className="w-4 h-4" />
          Explore more countries
        </button>
      </div>

      {/* Passport Cover Banner */}
      <div className="bg-[#fff0e9] border border-[#f5ddd2] rounded-[18px] p-5 mb-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-[44px]" aria-hidden="true">
            📘
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="text-[10px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
              The Little World Journal · Passport
            </div>
            <h3 className="font-[900] text-[20px] text-[#27334b] mt-1 mb-0.5">
              Little Explorer Passport
            </h3>
            <p className="text-[#5b6578] text-[13px]">
              A collection of places, people and precious moments.
            </p>
          </div>
          <div className="text-right">
            <strong className="font-[900] text-[30px] text-[#27334b] leading-none block tabular-nums">
              {visited.length}
            </strong>
            <span className="text-[10px] font-bold tracking-wider text-[#6c7584] uppercase">
              Country stamps
            </span>
          </div>
        </div>
      </div>

      {/* Stamp Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {visited.map((country) => (
          <button
            key={country.name}
            type="button"
            onClick={() => onSelectCountry(country.name)}
            className="border-2 border-dashed border-[#e9a49a] rounded-[14px] p-5 text-center bg-[#fff9f5] hover:-translate-y-0.5 transition-transform focus-visible:outline-2 focus-visible:outline-[#ff826e]"
          >
            <div className="w-[64px] h-[64px] border-2 border-[#ef9a8c] rounded-full grid place-items-center mx-auto mb-2.5 text-[28px] -rotate-6 bg-white/60">
              {country.flag}
            </div>
            <strong className="font-[800] text-[13px] text-[#27334b] block">
              {country.name}
            </strong>
            <span className="text-[10px] font-bold tracking-wider text-[#6c7584] uppercase block mt-0.5">
              Visited · {country.continent}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={onExploreMore}
          className="border-2 border-dashed border-[#ddd5c9] rounded-[14px] p-5 text-center bg-white/60 opacity-80 hover:opacity-100 hover:border-[#ff826e] transition-all"
        >
          <div className="w-[64px] h-[64px] border-2 border-[#d8d0c5] rounded-full grid place-items-center mx-auto mb-2.5 text-[22px] text-[#8c94a3]">
            ✧
          </div>
          <strong className="font-[800] text-[13px] text-[#27334b] block">
            Your next stamp
          </strong>
          <span className="text-[10px] font-bold tracking-wider text-[#6c7584] uppercase block mt-0.5">
            Waiting for an adventure
          </span>
        </button>
      </div>
    </section>
  );
};
