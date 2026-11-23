import React from 'react';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import type { BookingRecord } from '../../types/journal';

interface BookingsPageProps {
  bookings: BookingRecord[];
  onOpenAddBooking: () => void;
  onDeleteBooking: (id: string) => void;
}

const PROVIDERS = [
  {
    icon: '✈️',
    title: 'Flights',
    desc: 'Compare fares and airline options',
    links: [
      { label: 'Google Flights', href: 'https://www.google.com/travel/flights' },
      { label: 'Skyscanner', href: 'https://www.skyscanner.com' },
    ],
  },
  {
    icon: '🛏️',
    title: 'Stays',
    desc: 'Find a place to rest',
    links: [
      { label: 'Agoda', href: 'https://www.agoda.com' },
      { label: 'Booking.com', href: 'https://www.booking.com' },
    ],
  },
  {
    icon: '🎡',
    title: 'Activities',
    desc: 'Experiences and attractions',
    links: [
      { label: 'Klook', href: 'https://www.klook.com' },
      { label: 'GetYourGuide', href: 'https://www.getyourguide.com' },
    ],
  },
  {
    icon: '🚆',
    title: 'Getting around',
    desc: 'Local transport resources',
    links: [
      { label: 'JR East', href: 'https://www.jreast.co.jp/multi/en/' },
      { label: 'Viator', href: 'https://www.viator.com' },
    ],
  },
];

export const BookingsPage: React.FC<BookingsPageProps> = ({
  bookings,
  onOpenAddBooking,
  onDeleteBooking,
}) => {
  return (
    <section aria-label="Booking center">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
            Keep the details together
          </div>
          <h2 className="font-[900] text-[26px] sm:text-[30px] tracking-[-0.5px] text-[#27334b] mt-1 mb-0.5 text-balance">
            Booking center <span aria-hidden="true">🎟️</span>
          </h2>
          <p className="text-[#6c7584] text-[13px]">
            Save your confirmation details and provider links. External links open provider sites directly.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddBooking}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add booking
        </button>
      </div>

      {/* External Provider Directory */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        {PROVIDERS.map((p) => (
          <div
            key={p.title}
            className="bg-white border border-[#f0e9dc] rounded-[14px] p-4 flex flex-col"
          >
            <span className="text-[22px]" aria-hidden="true">
              {p.icon}
            </span>
            <strong className="font-[800] text-[14px] text-[#27334b] mt-2">
              {p.title}
            </strong>
            <span className="text-[11px] text-[#6c7584] mt-0.5 mb-3">{p.desc}</span>
            <div className="mt-auto space-y-1.5">
              {p.links.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[#d65442] text-[12px] font-bold hover:underline"
                >
                  {item.label}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Saved Bookings */}
      <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="font-[800] text-[15px] text-[#27334b]">My saved bookings</h3>
          <span className="text-[11px] text-[#6c7584] font-semibold tabular-nums">
            {bookings.length} {bookings.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {bookings.length > 0 ? (
          <div className="divide-y divide-[#f0e9dc]">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3.5"
              >
                <span className="text-[20px] shrink-0" aria-hidden="true">
                  🎟️
                </span>
                <div className="flex-1 min-w-0">
                  <strong className="font-[800] text-[13px] text-[#27334b] block">
                    {booking.name} · {booking.provider}
                  </strong>
                  <span className="block text-[11px] text-[#6c7584] mt-0.5 tabular-nums">
                    {booking.date} · Ref: {booking.ref || 'Not added'} · {booking.status}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {booking.link && (
                    <a
                      href={booking.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-[#d65442] hover:underline"
                    >
                      Confirmation
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <strong className="font-[800] text-[14px] text-[#27334b] tabular-nums">
                    ₱{booking.amount.toLocaleString()}
                  </strong>
                  <button
                    type="button"
                    onClick={() => onDeleteBooking(booking.id)}
                    aria-label={`Delete ${booking.name}`}
                    className="bg-[#fff4f0] text-[#c95b4b] hover:bg-[#ffe4db] rounded-lg p-2 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-[#6c7584] text-[13px] bg-white border border-dashed border-[#e9dfd1] rounded-[15px]">
            No saved booking records yet. Add a booking after completing it with the provider.
          </div>
        )}
      </div>
    </section>
  );
};
