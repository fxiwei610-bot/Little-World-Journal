import React from 'react';
import { FileDown, Plus, Trash2 } from 'lucide-react';
import { exportTripItineraryToPdf } from '../../lib/tripPdf';
import type {
  Country,
  PackingItem,
  Trip,
  TripActivity,
  TripStatus,
} from '../../types/journal';
import { TripDetail } from '../TripDetail';

interface TripsPageProps {
  trips: Trip[];
  countries: Country[];
  selectedTripId: string;
  onSelectTrip: (tripId: string) => void;
  onOpenNewTrip: () => void;
  onUpdateTripStatus: (tripId: string, status: TripStatus) => void;
  onUpdateTripNotes: (tripId: string, notes: string) => void;
  onToggleActivity: (tripId: string, activityId: string) => void;
  onDeleteActivity: (tripId: string, activityId: string) => void;
  onSaveItinerary: (
    tripId: string,
    activities: TripActivity[],
    itineraryOverview?: string
  ) => void;
  onMergeItineraryDay?: (
    tripId: string,
    dayNum: number,
    dayActivities: TripActivity[],
    itineraryOverview?: string
  ) => void;
  onUpdatePackingList: (tripId: string, packingList: PackingItem[]) => void;
  onDeleteTrip: (tripId: string) => void;
  onAddTransferExpense?: (params: {
    country: string;
    destination: string;
    title: string;
    amount: number;
    date: string;
  }) => void;
  onNotify?: (message: string) => void;
}

function getDateParts(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { day: '—', month: 'TBD' };
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
  };
}

export const TripsPage: React.FC<TripsPageProps> = ({
  trips,
  countries,
  selectedTripId,
  onSelectTrip,
  onOpenNewTrip,
  onUpdateTripStatus,
  onUpdateTripNotes,
  onToggleActivity,
  onDeleteActivity,
  onSaveItinerary,
  onMergeItineraryDay,
  onUpdatePackingList,
  onDeleteTrip,
  onAddTransferExpense,
  onNotify,
}) => {
  const activeTrip = trips.find((t) => t.id === selectedTripId) || trips[0] || null;
  const activeCountry = activeTrip
    ? countries.find((c) => c.name.toLowerCase() === activeTrip.country.toLowerCase())
    : undefined;
  const getFlag = (countryName: string) =>
    countries.find((c) => c.name === countryName)?.flag || '✈️';

  return (
    <section aria-label="My trips">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
            Make room for adventure
          </div>
          <h2 className="font-[900] text-[26px] sm:text-[30px] tracking-[-0.5px] text-[#27334b] mt-1 mb-0.5 text-balance">
            My trips <span aria-hidden="true">✈️</span>
          </h2>
          <p className="text-[#6c7584] text-[13px]">
            Plan day-by-day itineraries, generate AI suggestions, and export to PDF.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewTrip}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create trip
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.45fr] gap-4 items-start">
        {/* Trip Collection */}
        <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5 min-w-0">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="font-[800] text-[15px] text-[#27334b]">Trip collection</h3>
            <span className="text-[11px] text-[#6c7584] font-semibold tabular-nums">
              {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
            </span>
          </div>

          {trips.length > 0 ? (
            <div className="divide-y divide-[#f0e9dc]">
              {trips.map((trip) => {
                const { day, month } = getDateParts(trip.date);
                const isSelected = activeTrip?.id === trip.id;
                const matchedCountry = countries.find(
                  (c) => c.name.toLowerCase() === trip.country.toLowerCase()
                );
                return (
                  <div
                    key={trip.id}
                    className={`flex flex-wrap sm:flex-nowrap items-center gap-3 py-3.5 px-2.5 rounded-xl transition-colors ${
                      isSelected ? 'bg-[#fff9ed]' : 'hover:bg-[#fffdf8]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectTrip(trip.id)}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#fff0e9] text-[#d66654] grid place-items-center text-center shrink-0">
                        <div className="leading-none">
                          <strong className="block font-[900] text-[18px] tabular-nums">
                            {day}
                          </strong>
                          <span className="text-[9px] font-bold">{month}</span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <strong className="font-[800] text-[13px] text-[#27334b] block truncate">
                          {trip.name}
                        </strong>
                        <span className="block text-[11px] text-[#6c7584] mt-0.5 tabular-nums">
                          {getFlag(trip.country)} {trip.country} · {trip.days} days ·{' '}
                          {trip.activities.length}{' '}
                          {trip.activities.length === 1 ? 'stop' : 'stops'}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={trip.status}
                        aria-label={`Status for ${trip.name}`}
                        onChange={(e) =>
                          onUpdateTripStatus(trip.id, e.target.value as TripStatus)
                        }
                        className="border border-[#f0e9dc] rounded-lg bg-white px-2 py-1.5 text-[11px] font-semibold text-[#27334b] outline-none focus:border-[#ff826e]"
                      >
                        <option value="Planning">Planning</option>
                        <option value="Booked">Booked</option>
                        <option value="Completed">Completed</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          exportTripItineraryToPdf(trip, matchedCountry);
                          onNotify?.(`Downloaded PDF itinerary for ${trip.name}`);
                        }}
                        title={`Download ${trip.name} itinerary PDF`}
                        aria-label={`Download ${trip.name} itinerary PDF`}
                        className="bg-[#f4f6fa] text-[#27334b] hover:bg-[#e7ecf4] rounded-lg p-2 transition-colors"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteTrip(trip.id)}
                        aria-label={`Delete ${trip.name}`}
                        className="bg-[#fff4f0] text-[#c95b4b] hover:bg-[#ffe4db] rounded-lg p-2 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-[#6c7584] text-[13px] bg-white border border-dashed border-[#e9dfd1] rounded-[15px]">
              No trips yet. Start planning your next adventure!
            </div>
          )}
        </div>

        {/* Detailed Trip & Itinerary View */}
        <TripDetail
          trip={activeTrip}
          trips={trips}
          country={activeCountry}
          onSelectTrip={onSelectTrip}
          onUpdateTripNotes={onUpdateTripNotes}
          onToggleActivity={onToggleActivity}
          onDeleteActivity={onDeleteActivity}
          onSaveItinerary={onSaveItinerary}
          onMergeItineraryDay={onMergeItineraryDay}
          onUpdatePackingList={onUpdatePackingList}
          onAddTransferExpense={onAddTransferExpense}
          onNotify={onNotify}
        />
      </div>
    </section>
  );
};
