import React from 'react';
import { Heart, Plus } from 'lucide-react';
import type { Country, JournalEntry, PageId, Trip, WishItem } from '../../types/journal';
import { ScenicArtwork } from '../ScenicArtwork';
import { WorldMapCard } from '../WorldMapCard';

interface DashboardPageProps {
  countries: Country[];
  trips: Trip[];
  wishes: WishItem[];
  journals: JournalEntry[];
  onNavigate: (page: PageId) => void;
  onSelectCountry: (countryName: string) => void;
  onSelectTrip: (tripId: string) => void;
  onSelectJournal: (journalId: string) => void;
  onOpenNewTrip: () => void;
  onToggleJournalLike: (journalId: string) => void;
}

function formatShortDate(dateStr: string) {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { day: '—', month: 'TBD' };
  }
  return {
    day: String(parsed.getDate()).padStart(2, '0'),
    month: parsed.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
  };
}

function formatReadableDate(dateStr: string) {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  countries,
  trips,
  wishes,
  journals,
  onNavigate,
  onSelectCountry,
  onSelectTrip,
  onSelectJournal,
  onOpenNewTrip,
  onToggleJournalLike,
}) => {
  const visitedCount = countries.filter((c) => c.flagged === 'visited').length;
  const countryGoal = 5;
  const destinationsCollected =
    countries
      .filter((c) => c.flagged === 'visited')
      .reduce((acc, c) => acc + c.places.length, 0) + journals.length;
  const destGoal = 20;

  const sortedTrips = [...trips].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const recentJournals = journals.slice(0, 3);

  const getCountryFlag = (countryName: string) =>
    countries.find((c) => c.name === countryName)?.flag || '🌍';

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <section aria-label="Dashboard">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
            {todayFormatted}
          </div>
          <h2 className="font-[900] text-[26px] sm:text-[30px] tracking-[-0.5px] text-[#27334b] mt-1 mb-0.5 text-balance">
            Hello, little explorer! <span aria-hidden="true">🌼</span>
          </h2>
          <p className="text-[#6c7584] text-[13px]">
            Your next great story is just around the corner.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewTrip}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Plan a new trip
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="bg-white border border-[#f0e9dc] rounded-[17px] p-4 relative">
          <div className="w-[34px] h-[34px] rounded-[11px] bg-[#fff0e9] grid place-items-center text-[17px] mb-3">
            🌍
          </div>
          <strong className="block font-[900] text-[26px] leading-tight text-[#27334b] tabular-nums">
            {visitedCount}
          </strong>
          <span className="text-[12px] text-[#6c7584]">Countries visited</span>
          <span className="block text-[11px] text-[#468f6d] font-medium mt-1">
            Stamped in passport
          </span>
        </div>

        <div className="bg-white border border-[#f0e9dc] rounded-[17px] p-4 relative">
          <div className="w-[34px] h-[34px] rounded-[11px] bg-[#f3efff] grid place-items-center text-[17px] mb-3">
            💭
          </div>
          <strong className="block font-[900] text-[26px] leading-tight text-[#27334b] tabular-nums">
            {wishes.length}
          </strong>
          <span className="text-[12px] text-[#6c7584]">Dream destinations</span>
        </div>

        <div className="bg-white border border-[#f0e9dc] rounded-[17px] p-4 relative">
          <div className="w-[34px] h-[34px] rounded-[11px] bg-[#edf8f1] grid place-items-center text-[17px] mb-3">
            ✈️
          </div>
          <strong className="block font-[900] text-[26px] leading-tight text-[#27334b] tabular-nums">
            {trips.length}
          </strong>
          <span className="text-[12px] text-[#6c7584]">Trips planned</span>
        </div>

        <div className="bg-white border border-[#f0e9dc] rounded-[17px] p-4 relative">
          <div className="w-[34px] h-[34px] rounded-[11px] bg-[#fff7dc] grid place-items-center text-[17px] mb-3">
            📸
          </div>
          <strong className="block font-[900] text-[26px] leading-tight text-[#27334b] tabular-nums">
            {journals.length}
          </strong>
          <span className="text-[12px] text-[#6c7584]">Little memories</span>
        </div>
      </div>

      {/* Main Row: Map + Upcoming Trips */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-4 mb-5">
        <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5 min-w-0">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="font-[800] text-[15px] text-[#27334b]">My little world map 🗺️</h3>
            <button
              type="button"
              onClick={() => onNavigate('world-map')}
              className="bg-[#fff4f0] text-[#c95b4b] hover:bg-[#ffe8df] rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors whitespace-nowrap"
            >
              Full world map
            </button>
          </div>
          <WorldMapCard countries={countries} onSelectCountry={onSelectCountry} />
        </div>

        <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5 min-w-0 flex flex-col">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="font-[800] text-[15px] text-[#27334b]">Coming up next ✈️</h3>
            <button
              type="button"
              onClick={() => onNavigate('trips')}
              className="bg-[#fff4f0] text-[#c95b4b] hover:bg-[#ffe8df] rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors whitespace-nowrap"
            >
              See all
            </button>
          </div>

          <div className="flex-1 divide-y divide-[#f4f0e8]">
            {sortedTrips.length > 0 ? (
              sortedTrips.map((trip, idx) => {
                const { day, month } = formatShortDate(trip.date);
                const isBooked = trip.status === 'Booked';
                return (
                  <button
                    key={trip.id}
                    type="button"
                    onClick={() => {
                      onSelectTrip(trip.id);
                      onNavigate('trips');
                    }}
                    className="w-full flex items-center gap-3 py-3 text-left hover:bg-[#fffdf8] rounded-lg transition-colors px-1"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl grid place-items-center text-center shrink-0 ${
                        idx % 2 === 1 || isBooked
                          ? 'bg-[#eef8f3] text-[#458a68]'
                          : 'bg-[#fff0e9] text-[#d66654]'
                      }`}
                    >
                      <div className="leading-none">
                        <strong className="block font-[900] text-[18px] tabular-nums">{day}</strong>
                        <span className="text-[9px] font-bold tracking-wider">{month}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <strong className="block font-[800] text-[13px] text-[#27334b] truncate">
                        {trip.name}
                      </strong>
                      <span className="block text-[11px] text-[#6c7584] truncate">
                        {getCountryFlag(trip.country)} {trip.country} · {trip.days} days · {trip.status}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="py-8 text-center text-[12px] text-[#6c7584]">
                No upcoming trips yet. Click “Plan a new trip” to start one!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Memories + Travel Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
        <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5 min-w-0">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="font-[800] text-[15px] text-[#27334b]">
              Recently collected memories 📔
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('journal')}
              className="bg-[#fff4f0] text-[#c95b4b] hover:bg-[#ffe8df] rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors whitespace-nowrap"
            >
              Open journal
            </button>
          </div>

          <div className="divide-y divide-[#f4f0e8]">
            {recentJournals.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 py-2.5">
                <div className="w-14 h-12 rounded-[11px] overflow-hidden shrink-0 border border-[#f0e9dc]">
                  <ScenicArtwork
                    scene={entry.scene}
                    photoUrl={entry.photoUrl}
                    alt={entry.title}
                    variant="thumb"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectJournal(entry.id)}
                    className="block font-[800] text-[13px] text-[#27334b] hover:text-[#d65442] text-left truncate w-full"
                  >
                    {entry.title}
                  </button>
                  <span className="block text-[11px] text-[#6c7584]">
                    {entry.country} · {formatReadableDate(entry.date)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleJournalLike(entry.id)}
                  aria-label={entry.liked ? 'Unfavorite memory' : 'Favorite memory'}
                  className="w-8 h-8 rounded-full grid place-items-center text-[#d66654] hover:bg-[#fff0e9] transition-colors shrink-0"
                >
                  <Heart
                    className="w-4 h-4"
                    fill={entry.liked ? '#ff826e' : 'none'}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-[800] text-[15px] text-[#27334b]">My travel goals 🎯</h3>
            <span className="text-[11px] text-[#6c7584] font-medium">2026 collection</span>
          </div>

          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-[12px] mb-2">
                <strong className="font-bold text-[#27334b]">Visit {countryGoal} countries</strong>
                <span className="text-[#6c7584] tabular-nums font-medium">
                  {visitedCount} / {countryGoal}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#f1eee8] overflow-hidden">
                <div
                  className="h-full bg-[#ff826e] rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (visitedCount / countryGoal) * 100)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[12px] mb-2">
                <strong className="font-bold text-[#27334b]">
                  Collect {destGoal} places & memories
                </strong>
                <span className="text-[#6c7584] tabular-nums font-medium">
                  {destinationsCollected} / {destGoal}
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#f1eee8] overflow-hidden">
                <div
                  className="h-full bg-[#7bc9a5] rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (destinationsCollected / destGoal) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[#6c7584] mt-5">
            Every little adventure counts. 🌱
          </p>
        </div>
      </div>
    </section>
  );
};
