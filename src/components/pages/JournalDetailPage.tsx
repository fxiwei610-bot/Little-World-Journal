import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Edit3,
  FileDown,
  Heart,
  ImagePlus,
  Link2,
  MapPin,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { exportJournalEntryToPdf } from '../../lib/journalPdf';
import { uploadJournalPhoto } from '../../lib/uploads';
import type { Country, JournalEntry, JournalPhoto } from '../../types/journal';
import { ScenicArtwork } from '../ScenicArtwork';

interface JournalDetailPageProps {
  entry: JournalEntry | null;
  countries: Country[];
  initialEditMode?: boolean;
  onBack: () => void;
  onSaveEntry: (entryData: Omit<JournalEntry, 'id'>, existingId?: string) => string;
  onToggleLike: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onNotify?: (message: string) => void;
}

function formatEntryDate(dateStr: string) {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const PhotoPreview: React.FC<{
  url: string;
  alt: string;
  className?: string;
}> = ({ url, alt, className = '' }) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (failed || !url) {
    return (
      <div
        className={`w-full h-full bg-[#f5efe4] grid place-items-center text-center p-3 text-[#6c7584] ${className}`}
      >
        <div>
          <Camera className="w-5 h-5 mx-auto mb-1 opacity-60" />
          <span className="text-[11px] block">Photo unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`w-full h-full object-cover ${className}`}
    />
  );
};

export const JournalDetailPage: React.FC<JournalDetailPageProps> = ({
  entry,
  countries,
  initialEditMode = false,
  onBack,
  onSaveEntry,
  onToggleLike,
  onDeleteEntry,
  onNotify,
}) => {
  const isNew = !entry;
  const [isEditing, setIsEditing] = useState<boolean>(isNew || initialEditMode);

  const todayStr = new Date().toISOString().slice(0, 10);
  const defaultCountry = countries[0]?.name || 'Japan';

  const [title, setTitle] = useState(entry?.title || '');
  const [country, setCountry] = useState(entry?.country || defaultCountry);
  const [location, setLocation] = useState(entry?.location || '');
  const [date, setDate] = useState(entry?.date || todayStr);
  const [companions, setCompanions] = useState(entry?.companions || '');
  const [weather, setWeather] = useState(entry?.weather || '');
  const [text, setText] = useState(entry?.text || '');
  const [photoUrl, setPhotoUrl] = useState(entry?.photoUrl || '');
  const [highlights, setHighlights] = useState<string[]>(entry?.highlights || []);
  const [newHighlight, setNewHighlight] = useState('');
  const [gallery, setGallery] = useState<JournalPhoto[]>(entry?.gallery || []);

  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [photoCaptionInput, setPhotoCaptionInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsEditing(!entry || initialEditMode);
    setTitle(entry?.title || '');
    setCountry(entry?.country || defaultCountry);
    setLocation(entry?.location || '');
    setDate(entry?.date || todayStr);
    setCompanions(entry?.companions || '');
    setWeather(entry?.weather || '');
    setText(entry?.text || '');
    setPhotoUrl(entry?.photoUrl || '');
    setHighlights(entry?.highlights || []);
    setGallery(entry?.gallery || []);
    setNewHighlight('');
    setPhotoUrlInput('');
    setPhotoCaptionInput('');
    setUploadError(null);
    setExportError(null);
    setFormError(null);
    setLightboxIndex(null);
  }, [entry, initialEditMode, defaultCountry, todayStr]);

  const matchedCountry = countries.find(
    (c) => c.name.toLowerCase() === country.toLowerCase()
  );
  const activeScene = matchedCountry?.scene || entry?.scene || 'wander';

  const viewablePhotos: { url: string; caption?: string }[] = (() => {
    const items: { url: string; caption?: string }[] = [];
    const seen = new Set<string>();
    const sourceGallery = isEditing ? gallery : entry?.gallery || [];
    const sourceCover = isEditing ? photoUrl : entry?.photoUrl || '';
    if (sourceCover) {
      seen.add(sourceCover);
      items.push({ url: sourceCover, caption: entry?.title || 'Cover photo' });
    }
    for (const g of sourceGallery) {
      if (g.url && !seen.has(g.url)) {
        seen.add(g.url);
        items.push({ url: g.url, caption: g.caption });
      }
    }
    return items;
  })();

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((i) =>
          i === null ? null : (i + 1) % Math.max(1, viewablePhotos.length)
        );
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((i) =>
          i === null
            ? null
            : (i - 1 + Math.max(1, viewablePhotos.length)) %
              Math.max(1, viewablePhotos.length)
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, viewablePhotos.length]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = Math.max(0, 12 - gallery.length);
    if (remainingSlots === 0) {
      setUploadError('You can attach up to 12 gallery photos per journal entry.');
      e.target.value = '';
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    const filesToUpload = files.slice(0, remainingSlots);

    try {
      const uploaded: JournalPhoto[] = [];
      for (const file of filesToUpload) {
        const url = await uploadJournalPhoto(file);
        const cleanTitle = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
        uploaded.push({
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url,
          caption: cleanTitle.slice(0, 100),
        });
      }

      setGallery((prev) => [...prev, ...uploaded].slice(0, 12));
      if (!photoUrl && uploaded[0]) {
        setPhotoUrl(uploaded[0].url);
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Unable to upload selected photos.'
      );
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleAddPhotoUrl = () => {
    const trimmed = photoUrlInput.trim();
    if (!trimmed) return;
    if (gallery.length >= 12) {
      setUploadError('You can attach up to 12 gallery photos per journal entry.');
      return;
    }
    setUploadError(null);
    const newItem: JournalPhoto = {
      id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url: trimmed,
      caption: photoCaptionInput.trim().slice(0, 140),
    };
    setGallery((prev) => [...prev, newItem]);
    if (!photoUrl) {
      setPhotoUrl(trimmed);
    }
    setPhotoUrlInput('');
    setPhotoCaptionInput('');
  };

  const handleUpdatePhotoCaption = (photoId: string, caption: string) => {
    setGallery((prev) =>
      prev.map((item) => (item.id === photoId ? { ...item, caption } : item))
    );
  };

  const handleRemoveGalleryPhoto = (photoId: string) => {
    setGallery((prev) => {
      const removed = prev.find((p) => p.id === photoId);
      const next = prev.filter((p) => p.id !== photoId);
      if (removed && photoUrl === removed.url) {
        setPhotoUrl(next[0]?.url || '');
      }
      return next;
    });
  };

  const handleAddHighlight = () => {
    const trimmed = newHighlight.trim();
    if (!trimmed || highlights.length >= 15) return;
    setHighlights((prev) => [...prev, trimmed.slice(0, 160)]);
    setNewHighlight('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please give this travel memory a title.');
      return;
    }
    if (!text.trim()) {
      setFormError('Please write about your travel experience.');
      return;
    }
    setFormError(null);

    onSaveEntry(
      {
        title: title.trim(),
        country,
        date: date || todayStr,
        text: text.trim(),
        scene: activeScene,
        photoUrl: photoUrl.trim() || undefined,
        location: location.trim() || undefined,
        companions: companions.trim() || undefined,
        weather: weather.trim() || undefined,
        highlights,
        gallery,
        liked: entry?.liked ?? true,
      },
      entry?.id
    );
    setIsEditing(false);
  };

  const handleExportPdf = async () => {
    if (!entry) return;
    setIsExportingPdf(true);
    setExportError(null);
    try {
      await exportJournalEntryToPdf(entry);
      onNotify?.('Journal entry exported as PDF');
    } catch (err) {
      setExportError(
        err instanceof Error ? err.message : 'Unable to export PDF right now.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const inputCls =
    'w-full border border-[#f0e9dc] rounded-[11px] bg-white px-3.5 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e] transition-colors';
  const labelCls = 'block text-[11px] font-bold text-[#5a6578] mb-1';

  return (
    <section aria-label={entry ? entry.title : 'New travel journal entry'}>
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
            {isNew ? 'New travel story' : 'Travel journal entry'}
          </div>
          <p className="text-[#6c7584] text-[13px] mt-1">
            {isEditing
              ? 'Capture every travel experience, highlight, and photo from this journey.'
              : 'Relive the moments, places, and photos from your trip.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[13px] font-bold hover:bg-[#fffdf8] transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to journal
          </button>

          {entry && !isEditing && (
            <>
              <button
                type="button"
                onClick={() => onToggleLike(entry.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-[13px] font-bold transition-colors whitespace-nowrap ${
                  entry.liked
                    ? 'bg-[#fff4f0] border-[#f5d3ca] text-[#d65442]'
                    : 'bg-white border-[#f0e9dc] text-[#5b6578] hover:text-[#d65442]'
                }`}
              >
                <Heart
                  className="w-4 h-4"
                  fill={entry.liked ? '#ff826e' : 'none'}
                />
                {entry.liked ? 'Favorited' : 'Favorite'}
              </button>

              <button
                type="button"
                disabled={isExportingPdf}
                onClick={handleExportPdf}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[13px] font-bold hover:border-[#ff826e] transition-colors whitespace-nowrap disabled:opacity-60"
              >
                <FileDown className="w-4 h-4" />
                {isExportingPdf ? 'Exporting PDF...' : 'Export PDF'}
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all whitespace-nowrap"
              >
                <Edit3 className="w-4 h-4" />
                Edit story &amp; gallery
              </button>
            </>
          )}
        </div>
      </div>

      {exportError && (
        <div
          role="alert"
          className="mb-4 p-3.5 rounded-xl bg-[#fff4f0] border border-[#f5d3ca] text-[#b93f31] text-[13px] flex items-center justify-between gap-3"
        >
          <span>{exportError}</span>
          <button
            type="button"
            onClick={() => setExportError(null)}
            aria-label="Dismiss error"
            className="p-1 text-[#b93f31]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white border border-[#f0e9dc] rounded-[20px] overflow-hidden">
        {/* Hero Cover */}
        <div
          className={`h-[220px] sm:h-[270px] relative overflow-hidden ${
            !isEditing && (photoUrl || entry?.photoUrl) ? 'cursor-pointer group' : ''
          }`}
          onClick={() => {
            if (!isEditing && viewablePhotos.length > 0) {
              setLightboxIndex(0);
            }
          }}
        >
          <ScenicArtwork
            scene={activeScene}
            photoUrl={isEditing ? photoUrl : entry?.photoUrl}
            alt={title || entry?.title || 'Travel journal cover'}
            variant="hero"
            className="transition-transform duration-300 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141e2b]/80 via-[#141e2b]/25 to-transparent" />
          <div className="absolute bottom-5 left-6 right-6 text-white z-10">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] font-semibold opacity-95">
              <span>
                {matchedCountry?.flag || '🌍'} {country}
              </span>
              {location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{location}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatEntryDate(date)}</span>
            </div>
            <h2 className="font-[900] text-[26px] sm:text-[34px] leading-tight mt-1 text-balance">
              {title || (isNew ? 'Untitled travel memory' : entry?.title)}
            </h2>
          </div>
        </div>

        {isEditing || !entry ? (
          /* Edit / Create Experience Form */
          <form onSubmit={handleSave} className="p-6 sm:p-8 space-y-6">
            {formError && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-[#fff4f0] border border-[#f5d3ca] text-[#b93f31] text-[13px]"
              >
                {formError}
              </div>
            )}

            {/* Core Experience Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelCls}>Experience title *</label>
                <input
                  required
                  maxLength={140}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Golden hour walks through Gion & Arashiyama"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Country *</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={inputCls}
                >
                  {countries.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>City, neighborhood, or landmark</label>
                <input
                  maxLength={120}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Kyoto · Arashiyama Bamboo Grove"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Travel date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Companions</label>
                  <input
                    maxLength={80}
                    value={companions}
                    onChange={(e) => setCompanions(e.target.value)}
                    placeholder="e.g. Solo, Partner, Friends"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Weather &amp; atmosphere</label>
                  <input
                    maxLength={80}
                    value={weather}
                    onChange={(e) => setWeather(e.target.value)}
                    placeholder="e.g. Crisp & sunny 16°C"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* Full Travel Story */}
            <div>
              <label className={labelCls}>Your full travel story &amp; experiences *</label>
              <textarea
                rows={7}
                maxLength={5000}
                required
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write everything you experienced—the sights, street food, hidden cafes, conversations, and moments you want to remember forever..."
                className={inputCls}
              />
              <span className="block text-[11px] text-[#8c94a3] mt-1 tabular-nums text-right">
                {text.length} / 5000 characters
              </span>
            </div>

            {/* Memorable Highlights */}
            <div className="pt-4 border-t border-[#f0e9dc]">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-[800] text-[14px] text-[#27334b] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#d66654]" />
                    Memorable highlights
                  </h3>
                  <p className="text-[11px] text-[#6c7584]">
                    Add favorite spots, dishes, or little discoveries from this trip.
                  </p>
                </div>
                <span className="text-[11px] text-[#6c7584] tabular-nums">
                  {highlights.length}/15
                </span>
              </div>

              {highlights.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {highlights.map((item, idx) => (
                    <li
                      key={`${item}-${idx}`}
                      className="flex items-center justify-between gap-2 bg-[#fffaf2] border border-[#f0e9dc] rounded-xl px-3.5 py-2 text-[12px] text-[#27334b]"
                    >
                      <span className="flex-1 min-w-0">{item}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setHighlights((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label="Remove highlight"
                        className="text-[#8c94a3] hover:text-[#c95b4b] p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={160}
                  value={newHighlight}
                  onChange={(e) => setNewHighlight(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddHighlight();
                    }
                  }}
                  placeholder="e.g. Fresh yuzu ramen in a 6-seat alley shop"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={handleAddHighlight}
                  disabled={!newHighlight.trim() || highlights.length >= 15}
                  className="inline-flex items-center gap-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[12px] font-bold hover:bg-[#fff9ed] transition-colors disabled:opacity-50 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add highlight
                </button>
              </div>
            </div>

            {/* Cover & Photo Gallery Manager */}
            <div className="pt-4 border-t border-[#f0e9dc]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-[800] text-[14px] text-[#27334b] flex items-center gap-1.5">
                    <ImagePlus className="w-4 h-4 text-[#d66654]" />
                    Photos &amp; travel gallery
                  </h3>
                  <p className="text-[11px] text-[#6c7584]">
                    Upload photos from your device or link image URLs (up to 12 photos).
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-[#6c7584] tabular-nums">
                  {gallery.length}/12 photos
                </span>
              </div>

              {/* Cover URL field */}
              <div className="mb-4">
                <label className={labelCls}>Cover photo URL (optional)</label>
                <input
                  maxLength={500}
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="Leave blank to use destination artwork or pick a gallery photo as cover"
                  className={inputCls}
                />
              </div>

              {/* Upload & URL Add Controls */}
              <div className="bg-[#fffaf2] border border-[#f0e9dc] rounded-2xl p-4 mb-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploading || gallery.length >= 12}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#27334b] text-white text-[12px] font-bold hover:bg-[#344361] transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isUploading ? 'Uploading photos...' : 'Upload photos from device'}
                  </button>
                  <span className="text-[11px] text-[#6c7584]">
                    Supports JPEG, PNG, WebP, GIF (multiple selection supported)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_auto] gap-2 pt-2 border-t border-[#efe7d8]">
                  <div className="relative">
                    <Link2 className="w-3.5 h-3.5 text-[#8c94a3] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      maxLength={500}
                      value={photoUrlInput}
                      onChange={(e) => setPhotoUrlInput(e.target.value)}
                      placeholder="Or paste photo URL (https://...)"
                      className="w-full border border-[#f0e9dc] rounded-[11px] bg-white pl-8 pr-3 py-2 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                    />
                  </div>
                  <input
                    type="text"
                    maxLength={140}
                    value={photoCaptionInput}
                    onChange={(e) => setPhotoCaptionInput(e.target.value)}
                    placeholder="Caption (optional)"
                    className="w-full border border-[#f0e9dc] rounded-[11px] bg-white px-3 py-2 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhotoUrl}
                    disabled={!photoUrlInput.trim() || gallery.length >= 12}
                    className="inline-flex items-center justify-center gap-1 px-3.5 py-2 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[12px] font-bold hover:bg-[#fff9ed] transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add URL
                  </button>
                </div>

                {uploadError && (
                  <p className="text-[12px] text-[#b93f31]">{uploadError}</p>
                )}
              </div>

              {/* Editable Gallery Grid */}
              {gallery.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {gallery.map((item) => {
                    const isCover = photoUrl === item.url;
                    return (
                      <div
                        key={item.id}
                        className="border border-[#f0e9dc] rounded-2xl overflow-hidden bg-white flex flex-col"
                      >
                        <div className="h-[140px] overflow-hidden bg-[#f9f4eb]">
                          <PhotoPreview
                            url={item.url}
                            alt={item.caption || 'Gallery photo'}
                          />
                        </div>
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            maxLength={140}
                            value={item.caption || ''}
                            onChange={(e) =>
                              handleUpdatePhotoCaption(item.id, e.target.value)
                            }
                            placeholder="Add a caption..."
                            className="w-full border border-[#f0e9dc] rounded-lg px-2.5 py-1.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                          />
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setPhotoUrl(item.url)}
                              className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                                isCover
                                  ? 'bg-[#eef8f3] text-[#458a68]'
                                  : 'bg-[#fff4f0] text-[#c95b4b] hover:bg-[#ffe8df]'
                              }`}
                            >
                              {isCover ? 'Cover photo' : 'Set as cover'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveGalleryPhoto(item.id)}
                              aria-label="Remove photo"
                              className="text-[#8c94a3] hover:text-[#c95b4b] p-1 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-[#6c7584] text-[12px] bg-[#fffdf8] border border-dashed border-[#e9dfd1] rounded-2xl">
                  No gallery photos added yet. Upload photos from your trip or paste image URLs
                  above.
                </div>
              )}
            </div>

            {/* Form Footer Buttons */}
            <div className="pt-4 border-t border-[#f0e9dc] flex flex-wrap items-center justify-between gap-3">
              {entry ? (
                <button
                  type="button"
                  onClick={() => onDeleteEntry(entry.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#fff4f0] text-[#c94a3b] hover:bg-[#ffe8df] text-[13px] font-bold transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete entry
                </button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (isNew) {
                      onBack();
                    } else {
                      setIsEditing(false);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[13px] font-bold hover:bg-[#fff9ed] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  Save journal entry
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Reading View */
          <div className="p-6 sm:p-8 space-y-7">
            {/* Context Metadata Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#fff8ed] rounded-xl p-3.5">
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                  <Calendar className="w-3 h-3" />
                  Date
                </span>
                <strong className="font-[800] text-[13px] text-[#27334b] block mt-1 tabular-nums">
                  {formatEntryDate(entry.date)}
                </strong>
              </div>

              <div className="bg-[#fff8ed] rounded-xl p-3.5">
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                  <MapPin className="w-3 h-3" />
                  Place
                </span>
                <strong className="font-[800] text-[13px] text-[#27334b] block mt-1 truncate">
                  {entry.location || entry.country}
                </strong>
              </div>

              <div className="bg-[#fff8ed] rounded-xl p-3.5">
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                  <Users className="w-3 h-3" />
                  Companions
                </span>
                <strong className="font-[800] text-[13px] text-[#27334b] block mt-1 truncate">
                  {entry.companions || 'Not specified'}
                </strong>
              </div>

              <div className="bg-[#fff8ed] rounded-xl p-3.5">
                <span className="flex items-center gap-1 text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                  <CloudSun className="w-3 h-3" />
                  Weather
                </span>
                <strong className="font-[800] text-[13px] text-[#27334b] block mt-1 truncate">
                  {entry.weather || 'Not recorded'}
                </strong>
              </div>
            </div>

            {/* Full Travel Experience Narrative */}
            <div>
              <h3 className="font-[800] text-[16px] text-[#27334b] mb-2.5">
                Travel story &amp; experiences
              </h3>
              <p className="text-[15px] leading-[1.8] text-[#3f4a5c] whitespace-pre-line max-w-3xl">
                {entry.text}
              </p>
            </div>

            {/* Highlights */}
            {entry.highlights && entry.highlights.length > 0 && (
              <div className="pt-5 border-t border-[#f0e9dc]">
                <h3 className="font-[800] text-[15px] text-[#27334b] mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#d66654]" />
                  Memorable highlights
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {entry.highlights.map((h, idx) => (
                    <li
                      key={`${h}-${idx}`}
                      className="bg-[#fffaf2] border border-[#f0e9dc] rounded-xl px-4 py-3 text-[13px] text-[#27334b] leading-snug"
                    >
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Photo Gallery */}
            <div className="pt-5 border-t border-[#f0e9dc]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5">
                <div>
                  <h3 className="font-[800] text-[15px] text-[#27334b]">
                    Photo gallery 📸
                  </h3>
                  <p className="text-[12px] text-[#6c7584]">
                    {viewablePhotos.length > 0
                      ? `${viewablePhotos.length} ${
                          viewablePhotos.length === 1 ? 'photo' : 'photos'
                        } collected from this trip`
                      : 'Add photos from this trip to build your visual scrapbook.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#fff4f0] text-[#c95b4b] hover:bg-[#ffe8df] text-[12px] font-bold transition-colors"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Add or manage photos
                </button>
              </div>

              {viewablePhotos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {viewablePhotos.map((photo, idx) => (
                    <button
                      key={`${photo.url}-${idx}`}
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      className="text-left bg-white border border-[#f0e9dc] rounded-2xl overflow-hidden group hover:border-[#ff826e] transition-colors"
                    >
                      <div className="h-[180px] overflow-hidden bg-[#f9f4eb]">
                        <PhotoPreview
                          url={photo.url}
                          alt={photo.caption || `${entry.title} photo ${idx + 1}`}
                          className="transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      </div>
                      {photo.caption && (
                        <div className="px-3.5 py-2.5 text-[12px] font-semibold text-[#27334b] truncate">
                          {photo.caption}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-[#6c7584] text-[13px] bg-[#fffdf8] border border-dashed border-[#e9dfd1] rounded-2xl">
                  No photos uploaded yet. Click &ldquo;Add or manage photos&rdquo; to add
                  memories to this gallery!
                </div>
              )}
            </div>

            {/* Footer Delete Action */}
            <div className="pt-5 border-t border-[#f0e9dc] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => onDeleteEntry(entry.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#fff4f0] text-[#c94a3b] hover:bg-[#ffe8df] text-[12px] font-bold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete entry
              </button>

              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[12px] font-bold hover:bg-[#fff9ed] transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit travel experiences
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && viewablePhotos[lightboxIndex] && (
        <div
          className="fixed inset-0 bg-[#121927]/85 z-50 flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery viewer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxIndex(null);
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close photo viewer"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {viewablePhotos.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setLightboxIndex(
                  (lightboxIndex - 1 + viewablePhotos.length) % viewablePhotos.length
                )
              }
              aria-label="Previous photo"
              className="absolute left-3 sm:left-6 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <div className="max-w-4xl w-full flex flex-col items-center">
            <img
              src={viewablePhotos[lightboxIndex].url}
              alt={viewablePhotos[lightboxIndex].caption || 'Travel memory'}
              referrerPolicy="no-referrer"
              className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <div className="mt-3 text-center text-white">
              {viewablePhotos[lightboxIndex].caption && (
                <p className="text-[14px] font-semibold">
                  {viewablePhotos[lightboxIndex].caption}
                </p>
              )}
              <span className="text-[11px] text-white/70 tabular-nums">
                {lightboxIndex + 1} / {viewablePhotos.length}
              </span>
            </div>
          </div>

          {viewablePhotos.length > 1 && (
            <button
              type="button"
              onClick={() =>
                setLightboxIndex((lightboxIndex + 1) % viewablePhotos.length)
              }
              aria-label="Next photo"
              className="absolute right-3 sm:right-6 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white grid place-items-center transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
};
