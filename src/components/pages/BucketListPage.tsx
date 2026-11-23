import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Country, WishItem, WishStatus } from '../../types/journal';

interface BucketListPageProps {
  wishes: WishItem[];
  countries: Country[];
  onOpenAddWish: () => void;
  onUpdateWishStatus: (id: string, status: WishStatus) => void;
  onDeleteWish: (id: string) => void;
}

const FILTER_OPTIONS: ('All' | WishStatus)[] = [
  'All',
  'Dream destination',
  'Planning',
  'Booked',
  'Completed',
];

const STATUS_OPTIONS: WishStatus[] = [
  'Dream destination',
  'Planning',
  'Preparing',
  'Booked',
  'Travelling',
  'Completed',
];

export const BucketListPage: React.FC<BucketListPageProps> = ({
  wishes,
  countries,
  onOpenAddWish,
  onUpdateWishStatus,
  onDeleteWish,
}) => {
  const [filter, setFilter] = useState<'All' | WishStatus>('All');

  const filtered = wishes.filter((w) => filter === 'All' || w.status === filter);
  const getFlag = (countryName: string) =>
    countries.find((c) => c.name === countryName)?.flag || '📍';

  return (
    <section aria-label="My bucket list">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
            Someday starts somewhere
          </div>
          <h2 className="font-[900] text-[26px] sm:text-[30px] tracking-[-0.5px] text-[#27334b] mt-1 mb-0.5 text-balance">
            My bucket list <span aria-hidden="true">♡</span>
          </h2>
          <p className="text-[#6c7584] text-[13px]">
            Save the places your heart wants to see.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddWish}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add destination
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="Filter bucket list">
        {FILTER_OPTIONS.map((opt) => {
          const isActive = filter === opt;
          return (
            <button
              key={opt}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setFilter(opt)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-[#27334b] text-white border-[#27334b]'
                  : 'bg-white text-[#5b6578] border-[#f0e9dc] hover:border-[#d6cfc3]'
              }`}
            >
              {opt === 'All' ? 'All dreams' : opt}
            </button>
          );
        })}
      </div>

      {/* Wish List */}
      <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5">
        {filtered.length > 0 ? (
          <div className="divide-y divide-[#f0e9dc]">
            {filtered.map((wish) => (
              <div
                key={wish.id}
                className="flex flex-wrap sm:flex-nowrap items-center gap-3 py-3.5"
              >
                <div className="text-[22px] w-8 text-center shrink-0" aria-hidden="true">
                  {wish.status === 'Completed' ? '🌟' : getFlag(wish.country)}
                </div>

                <div className="flex-1 min-w-0">
                  <strong className="font-[800] text-[14px] text-[#27334b] block">
                    {wish.name}
                  </strong>
                  <span className="block text-[12px] text-[#6c7584] mt-0.5">
                    {wish.country} · {wish.priority} priority
                    {wish.note ? ` · ${wish.note}` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={wish.status}
                    aria-label={`Status for ${wish.name}`}
                    onChange={(e) =>
                      onUpdateWishStatus(wish.id, e.target.value as WishStatus)
                    }
                    className="border border-[#f0e9dc] rounded-lg bg-[#fffdf8] px-2.5 py-1.5 text-[11px] font-semibold text-[#27334b] outline-none focus:border-[#ff826e]"
                  >
                    {STATUS_OPTIONS.map((statusOpt) => (
                      <option key={statusOpt} value={statusOpt}>
                        {statusOpt}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => onDeleteWish(wish.id)}
                    aria-label={`Remove ${wish.name}`}
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
            Your list is waiting for a new little dream.
          </div>
        )}
      </div>
    </section>
  );
};
