import React, { useState } from 'react';
import { ArrowUpRight, Heart, Plus, Trash2 } from 'lucide-react';
import type { JournalEntry } from '../../types/journal';
import { ScenicArtwork } from '../ScenicArtwork';

interface JournalPageProps {
  journals: JournalEntry[];
  onOpenNewJournal: () => void;
  onSelectJournal: (id: string) => void;
  onToggleLike: (id: string) => void;
  onDeleteJournal: (id: string) => void;
}

function formatEntryDate(dateStr: string) {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function getPhotoCount(entry: JournalEntry): number {
  const urls = new Set<string>();
  if (entry.photoUrl) urls.add(entry.photoUrl);
  for (const g of entry.gallery || []) {
    if (g.url) urls.add(g.url);
  }
  return urls.size;
}

export const JournalPage: React.FC<JournalPageProps> = ({
  journals,
  onOpenNewJournal,
  onSelectJournal,
  onToggleLike,
  onDeleteJournal,
}) => {
  const [viewMode, setViewMode] = useState<'scrapbook' | 'timeline'>('scrapbook');

  const sortedTimeline = [...journals].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section aria-label="Travel journal">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
            Little moments, big memories
          </div>
          <h2 className="font-[900] text-[26px] sm:text-[30px] tracking-[-0.5px] text-[#27334b] mt-1 mb-0.5 text-balance">
            Travel journal <span aria-hidden="true">📔</span>
          </h2>
          <p className="text-[#6c7584] text-[13px]">
            Click any memory to open its full story, travel highlights, and photo gallery.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenNewJournal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New entry
        </button>
      </div>

      {/* View Switcher */}
      <div className="flex items-center gap-2 mb-5" role="tablist" aria-label="Journal view">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'scrapbook'}
          onClick={() => setViewMode('scrapbook')}
          className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors whitespace-nowrap ${
            viewMode === 'scrapbook'
              ? 'bg-[#27334b] text-white border-[#27334b]'
              : 'bg-white text-[#5b6578] border-[#f0e9dc] hover:border-[#d6cfc3]'
          }`}
        >
          Scrapbook view
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'timeline'}
          onClick={() => setViewMode('timeline')}
          className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border transition-colors whitespace-nowrap ${
            viewMode === 'timeline'
              ? 'bg-[#27334b] text-white border-[#27334b]'
              : 'bg-white text-[#5b6578] border-[#f0e9dc] hover:border-[#d6cfc3]'
          }`}
        >
          Timeline view
        </button>
      </div>

      {journals.length === 0 ? (
        <div className="p-10 text-center text-[#6c7584] text-[13px] bg-white border border-dashed border-[#e9dfd1] rounded-[15px]">
          No memories written down yet. Add your first journal entry!
        </div>
      ) : viewMode === 'scrapbook' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {journals.map((entry) => {
            const photoCount = getPhotoCount(entry);
            return (
              <article
                key={entry.id}
                onClick={() => onSelectJournal(entry.id)}
                className="bg-white border border-[#f0e9dc] rounded-2xl overflow-hidden flex flex-col cursor-pointer hover:border-[#ff826e] transition-colors group"
              >
                <div className="h-[150px] overflow-hidden">
                  <ScenicArtwork
                    scene={entry.scene}
                    photoUrl={entry.photoUrl}
                    alt={entry.title}
                    variant="card"
                    className="transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <span className="text-[11px] font-bold text-[#d66654] tabular-nums">
                    {entry.country} · {formatEntryDate(entry.date)}
                    {photoCount > 0
                      ? ` · ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`
                      : ''}
                  </span>
                  <h3 className="font-[800] text-[15px] text-[#27334b] group-hover:text-[#d65442] transition-colors mt-1.5 mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate">{entry.title}</span>
                    <ArrowUpRight className="w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100" />
                  </h3>
                  <p className="text-[12px] text-[#5b6578] leading-[1.6] flex-1 line-clamp-3">
                    {entry.text}
                  </p>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-[#f4f0e8]">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleLike(entry.id);
                      }}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#d66654] hover:opacity-80 transition-opacity"
                    >
                      <Heart
                        className="w-3.5 h-3.5"
                        fill={entry.liked ? '#ff826e' : 'none'}
                      />
                      {entry.liked ? 'Favorite memory' : 'A memory to keep'}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteJournal(entry.id);
                      }}
                      aria-label={`Delete ${entry.title}`}
                      className="text-[#8c94a3] hover:text-[#c95b4b] p-1 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5 space-y-5">
          {sortedTimeline.map((entry) => {
            const photoCount = getPhotoCount(entry);
            return (
              <article
                key={entry.id}
                onClick={() => onSelectJournal(entry.id)}
                className="flex flex-col sm:flex-row gap-4 pb-5 border-b border-[#f0e9dc] last:border-0 last:pb-0 cursor-pointer group"
              >
                <div className="w-full sm:w-44 h-28 rounded-xl overflow-hidden shrink-0 border border-[#f0e9dc]">
                  <ScenicArtwork
                    scene={entry.scene}
                    photoUrl={entry.photoUrl}
                    alt={entry.title}
                    variant="card"
                    className="transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[#d66654] tabular-nums">
                      {formatEntryDate(entry.date)} · {entry.country}
                      {photoCount > 0
                        ? ` · ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`
                        : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLike(entry.id);
                        }}
                        aria-label={entry.liked ? 'Unfavorite' : 'Favorite'}
                        className="text-[#d66654] p-1"
                      >
                        <Heart
                          className="w-4 h-4"
                          fill={entry.liked ? '#ff826e' : 'none'}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteJournal(entry.id);
                        }}
                        aria-label={`Delete ${entry.title}`}
                        className="text-[#8c94a3] hover:text-[#c95b4b] p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-[800] text-[16px] text-[#27334b] group-hover:text-[#d65442] transition-colors mt-1 flex items-center gap-1.5">
                    <span>{entry.title}</span>
                    <ArrowUpRight className="w-4 h-4 opacity-60 group-hover:opacity-100" />
                  </h3>
                  <p className="text-[13px] text-[#5b6578] leading-[1.6] mt-1 line-clamp-2">
                    {entry.text}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
