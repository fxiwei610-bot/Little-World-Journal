import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Bookmark,
  Bus,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Plus,
  Ship,
  Sparkles,
  Train,
  Trash2,
  Wallet,
} from 'lucide-react';
import { TRANSPORT_MODE_OPTIONS, fetchTransportGuide } from '../../lib/transport';
import type {
  CityLocalTransportOverview,
  Country,
  SavedTransportRoute,
  TransportMode,
  TransportRouteOption,
  Trip,
} from '../../types/journal';

interface TransportGuidePageProps {
  countries: Country[];
  trips: Trip[];
  savedRoutes: SavedTransportRoute[];
  onSaveRoute: (route: TransportRouteOption) => void;
  onDeleteSavedRoute: (routeId: string) => void;
  onAddRouteToTripAndBudget: (params: {
    route: TransportRouteOption;
    tripId: string;
    day: number;
    addToBudget: boolean;
  }) => void;
  onNotify?: (message: string) => void;
}

const PRESET_CORRIDORS: {
  label: string;
  country: string;
  city: string;
  origin: string;
  destination: string;
}[] = [
  {
    label: 'Tokyo · Narita Airport → Shinjuku',
    country: 'Japan',
    city: 'Tokyo',
    origin: 'Narita International Airport (NRT)',
    destination: 'Shinjuku Station, Tokyo',
  },
  {
    label: 'Tokyo → Kyoto (Shinkansen & Coaches)',
    country: 'Japan',
    city: 'Tokyo / Kyoto',
    origin: 'Tokyo Station',
    destination: 'Kyoto Station',
  },
  {
    label: 'Athens → Santorini (Ferries & Fast Boats)',
    country: 'Greece',
    city: 'Athens / Cyclades',
    origin: 'Piraeus Port, Athens',
    destination: 'Athinios Port, Santorini',
  },
  {
    label: 'Paris · CDG Airport → Montmartre',
    country: 'France',
    city: 'Paris',
    origin: 'Charles de Gaulle Airport (CDG)',
    destination: 'Montmartre / Abbesses, Paris',
  },
  {
    label: 'Bangkok → Koh Tao (Bus + Ferry)',
    country: 'Thailand',
    city: 'Bangkok / Gulf of Thailand',
    origin: 'Khao San Road / Southern Bus Terminal, Bangkok',
    destination: 'Mae Haad Pier, Koh Tao',
  },
];

function getModeIcon(mode: string, className = 'w-4 h-4') {
  const m = mode.toLowerCase();
  if (m.includes('train') || m.includes('rail') || m.includes('metro')) {
    return <Train className={className} />;
  }
  if (m.includes('bus') || m.includes('coach')) {
    return <Bus className={className} />;
  }
  if (m.includes('ferry') || m.includes('boat')) {
    return <Ship className={className} />;
  }
  if (m.includes('taxi') || m.includes('ride')) {
    return <Car className={className} />;
  }
  return <Navigation className={className} />;
}

export const TransportGuidePage: React.FC<TransportGuidePageProps> = ({
  countries,
  trips,
  savedRoutes,
  onSaveRoute,
  onDeleteSavedRoute,
  onAddRouteToTripAndBudget,
  onNotify,
}) => {
  const defaultCountry = trips[0]?.country || countries[0]?.name || 'Japan';
  const defaultCity =
    countries.find((c) => c.name === defaultCountry)?.capital || 'Tokyo';

  const [countryInput, setCountryInput] = useState<string>(defaultCountry);
  const [cityInput, setCityInput] = useState<string>(defaultCity);
  const [origin, setOrigin] = useState<string>('Narita International Airport (NRT)');
  const [destination, setDestination] = useState<string>('Shinjuku Station, Tokyo');
  const [preferredMode, setPreferredMode] = useState<TransportMode | 'All'>('All');
  const [travelPriority, setTravelPriority] = useState<
    'Balanced' | 'Fastest' | 'Most Affordable'
  >('Balanced');
  const [travelers, setTravelers] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cityGuide, setCityGuide] = useState<CityLocalTransportOverview | null>(null);
  const [routes, setRoutes] = useState<TransportRouteOption[]>([]);
  const [modeFilter, setModeFilter] = useState<string>('All');
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  // Target trip & budget inclusion state
  const [targetTripId, setTargetTripId] = useState<string>(trips[0]?.id || '');
  const [targetDay, setTargetDay] = useState<number>(1);
  const [includeFareInBudget, setIncludeFareInBudget] = useState<boolean>(true);
  const [addedRouteIds, setAddedRouteIds] = useState<Record<string, boolean>>({});

  const selectedTrip = useMemo(
    () => trips.find((t) => t.id === targetTripId) || trips[0] || null,
    [trips, targetTripId]
  );

  const savedFingerprints = useMemo(() => {
    const set = new Set<string>();
    for (const r of savedRoutes) {
      set.add(`${r.origin}::${r.destination}::${r.operator}::${r.mode}`.toLowerCase());
    }
    return set;
  }, [savedRoutes]);

  const filteredRoutes = useMemo(() => {
    if (modeFilter === 'All') return routes;
    return routes.filter((r) => r.mode === modeFilter);
  }, [routes, modeFilter]);

  const availableResultModes = useMemo(() => {
    const set = new Set<string>();
    for (const r of routes) set.add(r.mode);
    return Array.from(set);
  }, [routes]);

  const handleApplyPreset = (preset: (typeof PRESET_CORRIDORS)[number]) => {
    setCountryInput(preset.country);
    setCityInput(preset.city);
    setOrigin(preset.origin);
    setDestination(preset.destination);
  };

  const handleSwapEndpoints = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const handleSearchRoutes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!countryInput.trim() || !origin.trim() || !destination.trim()) {
      setErrorMsg('Please enter a country, origin, and destination.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setModeFilter('All');

    try {
      const result = await fetchTransportGuide({
        country: countryInput.trim(),
        city: cityInput.trim() || undefined,
        origin: origin.trim(),
        destination: destination.trim(),
        preferredMode,
        travelPriority,
        travelers,
        notes: notes.trim() || undefined,
      });

      setCityGuide(result.cityGuide);
      setRoutes(result.routes);
      // Automatically expand step-by-step directions for the first recommended route
      if (result.routes[0]) {
        setExpandedSteps({ [result.routes[0].id]: true });
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to fetch transportation routes right now.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToTrip = (route: TransportRouteOption) => {
    if (!selectedTrip) {
      onNotify?.('Create a trip in My Trips first to attach this route to a day.');
      return;
    }
    const clampedDay = Math.max(
      1,
      Math.min(Math.max(1, selectedTrip.days), Math.round(targetDay) || 1)
    );
    onAddRouteToTripAndBudget({
      route,
      tripId: selectedTrip.id,
      day: clampedDay,
      addToBudget: includeFareInBudget,
    });
    setAddedRouteIds((prev) => ({ ...prev, [route.id]: true }));
  };

  const toggleSteps = (id: string) => {
    setExpandedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderRouteCard = (route: TransportRouteOption, isSavedView = false) => {
    const isExpanded = Boolean(expandedSteps[route.id]);
    const isVerified = route.verificationStatus === 'verified';
    const isBookmarked =
      isSavedView ||
      savedFingerprints.has(
        `${route.origin}::${route.destination}::${route.operator}::${route.mode}`.toLowerCase()
      );
    const isAdded = Boolean(addedRouteIds[route.id]);

    return (
      <article
        key={route.id}
        className="bg-white border border-[#f0e9dc] rounded-[18px] p-5 transition-shadow hover:shadow-[0_6px_22px_rgba(39,51,75,0.06)]"
      >
        {/* Top Row: Mode + Operator + Verification Badge + Actions */}
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-[#f5efe3]">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#fff0e9] text-[#c94a3b] text-[11px] font-extrabold">
                {getModeIcon(route.mode, 'w-3.5 h-3.5')}
                {route.mode}
              </span>

              {isVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#edf8f1] border border-[#cdebd9] text-[#286e4e] text-[11px] font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Verified source info
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#fff7e6] border border-[#f5dfa9] text-[#9b6511] text-[11px] font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Estimated — verify before travel
                </span>
              )}

              <span className="text-[11px] font-semibold text-[#6c7584]">
                {route.country}
                {route.city && route.city !== route.country ? ` · ${route.city}` : ''}
              </span>
            </div>

            <h4 className="font-[900] text-[16px] text-[#27334b] leading-snug">
              {route.operator}
            </h4>
            <p className="text-[12px] text-[#5a6578] mt-0.5">
              {route.origin} → {route.destination}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {route.bookingUrl && (
              <a
                href={route.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#27334b] text-white hover:bg-[#1e283c] text-[12px] font-bold transition-colors whitespace-nowrap"
              >
                Book / Operator
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {isSavedView ? (
              <button
                type="button"
                onClick={() => onDeleteSavedRoute(route.id)}
                aria-label={`Remove saved route ${route.operator}`}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl bg-[#fff4f0] text-[#c94a3b] hover:bg-[#ffe4db] text-[12px] font-bold transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove
              </button>
            ) : (
              <button
                type="button"
                disabled={isBookmarked}
                onClick={() => onSaveRoute(route)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-bold transition-colors whitespace-nowrap ${
                  isBookmarked
                    ? 'bg-[#edf8f1] border-[#cdebd9] text-[#286e4e]'
                    : 'bg-white border-[#e8dfd0] text-[#27334b] hover:border-[#ff826e]'
                }`}
              >
                {isBookmarked ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Saved
                  </>
                ) : (
                  <>
                    <Bookmark className="w-3.5 h-3.5" />
                    Save route
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Key Transit Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 py-3.5">
          <div className="bg-[#fffdf8] border border-[#f2ece1] rounded-xl p-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6c7584] mb-1">
              Departure point
            </div>
            <div className="text-[12.5px] font-bold text-[#27334b] flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#d66654] shrink-0 mt-0.5" />
              <span>{route.departurePoint}</span>
            </div>
          </div>

          <div className="bg-[#fffdf8] border border-[#f2ece1] rounded-xl p-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6c7584] mb-1">
              Arrival point
            </div>
            <div className="text-[12.5px] font-bold text-[#27334b] flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#3a8d68] shrink-0 mt-0.5" />
              <span>{route.arrivalPoint}</span>
            </div>
          </div>

          <div className="bg-[#fffdf8] border border-[#f2ece1] rounded-xl p-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6c7584] mb-1">
              Duration &amp; schedule
            </div>
            <div className="text-[13px] font-[800] text-[#27334b] flex items-center gap-1.5 tabular-nums">
              <Clock className="w-3.5 h-3.5 text-[#5aa9d6] shrink-0" />
              <span>{route.duration}</span>
            </div>
            <p className="text-[11px] text-[#6c7584] mt-1 leading-snug">
              {route.schedule}
            </p>
          </div>

          <div className="bg-[#fffdf8] border border-[#f2ece1] rounded-xl p-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6c7584] mb-1">
              Fare &amp; budget impact
            </div>
            <div className="text-[13px] font-[900] text-[#27334b] flex items-center gap-1.5 tabular-nums">
              <Wallet className="w-3.5 h-3.5 text-[#ff826e] shrink-0" />
              <span>{route.fareLocal}</span>
            </div>
            <p className="text-[11px] text-[#458a68] font-bold mt-1 tabular-nums">
              ~₱{route.estimatedPhpFare.toLocaleString()} PHP
            </p>
          </div>
        </div>

        {/* Verification Note */}
        {route.verificationNote && (
          <p className="text-[11.5px] text-[#5a6578] bg-[#faf7f0] border border-[#f0e9dc] rounded-xl px-3 py-2 mb-3">
            <strong className="text-[#27334b]">
              {isVerified ? 'Source note:' : 'Estimate disclaimer:'}
            </strong>{' '}
            {route.verificationNote}
          </p>
        )}

        {/* Step-by-Step Instructions Toggle & Details */}
        {route.steps.length > 0 && (
          <div className="border border-[#f0e9dc] rounded-xl overflow-hidden mb-3">
            <button
              type="button"
              onClick={() => toggleSteps(route.id)}
              aria-expanded={isExpanded}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#fffaf2] text-left hover:bg-[#fff5e6] transition-colors"
            >
              <span className="text-[12px] font-[800] text-[#27334b]">
                Step-by-step route, transfers &amp; last-mile guide ({route.steps.length} steps)
              </span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-[#6c7584] shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#6c7584] shrink-0" />
              )}
            </button>

            {isExpanded && (
              <ol className="divide-y divide-[#f2ece1] bg-white">
                {route.steps.map((step) => (
                  <li key={`${route.id}-step-${step.stepNumber}`} className="p-3.5 flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-[#fff0e9] text-[#c94a3b] font-[900] text-[11px] grid place-items-center shrink-0 tabular-nums mt-0.5">
                      {step.stepNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-extrabold text-[#27334b]">
                          {step.mode}
                        </span>
                        {step.terminalOrStation && (
                          <span className="text-[11px] font-semibold text-[#5a6578]">
                            · {step.terminalOrStation}
                          </span>
                        )}
                        {step.duration && (
                          <span className="text-[11px] text-[#6c7584] tabular-nums">
                            · {step.duration}
                          </span>
                        )}
                      </div>
                      <p className="text-[12.5px] text-[#27334b] leading-relaxed">
                        {step.instruction}
                      </p>
                      {step.lastMileTip && (
                        <p className="text-[11px] text-[#3a6e8f] bg-[#f4fafd] border border-[#dcecf5] rounded-lg px-2.5 py-1.5 mt-1.5">
                          <strong>Last-mile tip:</strong> {step.lastMileTip}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* Source Links & Itinerary/Budget Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#f5efe3]">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-[11px] font-bold text-[#6c7584]">Confirm via:</span>
            {route.sourceLinks.length > 0 ? (
              route.sourceLinks.slice(0, 4).map((link, idx) => (
                <a
                  key={`${route.id}-src-${idx}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3a6e8f] hover:text-[#214f6c] underline underline-offset-2 max-w-[200px] truncate"
                >
                  <span className="truncate">{link.title}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ))
            ) : (
              <span className="text-[11px] text-[#8c94a3]">
                Check official operator or station desk locally
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!selectedTrip}
            onClick={() => handleAddToTrip(route)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all whitespace-nowrap shrink-0 ${
              isAdded
                ? 'bg-[#edf8f1] border border-[#cdebd9] text-[#286e4e]'
                : 'bg-[#ff826e] text-white shadow-[0_3px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 disabled:opacity-50'
            }`}
          >
            {isAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Added to Day {targetDay}
                {includeFareInBudget && route.estimatedPhpFare > 0 ? ' & Budget' : ''}
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                {selectedTrip
                  ? `Add to Day ${targetDay}${
                      includeFareInBudget && route.estimatedPhpFare > 0 ? ' & Budget' : ''
                    }`
                  : 'Create a trip to add'}
              </>
            )}
          </button>
        </div>
      </article>
    );
  };

  return (
    <section aria-label="Worldwide transportation guide">
      {/* Page Header */}
      <div className="mb-6">
        <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
          Global transit &amp; routes
        </div>
        <h2 className="font-[900] text-[26px] sm:text-[30px] tracking-[-0.5px] text-[#27334b] mt-1 mb-0.5 text-balance">
          Transportation guide <span aria-hidden="true">🚆</span>
        </h2>
        <p className="text-[#6c7584] text-[13px] max-w-3xl">
          Compare trains, buses, ferries, taxis, ride-hailing apps, and metro networks worldwide—with step-by-step transfer guides, source links, and one-click itinerary &amp; budget syncing.
        </p>
      </div>

      {/* Main Layout: Route Finder + Destination Target Control */}
      <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#d66654]" />
            <h3 className="font-[800] text-[15px] text-[#27334b]">
              AI Transportation Assistant
            </h3>
          </div>
          <span className="text-[11px] text-[#6c7584]">
            Worldwide routes · distinguishes verified sources from estimated fares
          </span>
        </div>

        {/* Quick Worldwide Presets */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-[11px] font-bold text-[#6c7584] mr-1">Popular routes:</span>
          {PRESET_CORRIDORS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className="px-2.5 py-1 rounded-lg bg-[#fff9ed] border border-[#f0e9dc] hover:border-[#ff826e] text-[11px] font-semibold text-[#27334b] transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchRoutes} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label
                htmlFor="transport-country-input"
                className="block text-[11px] font-bold text-[#5a6578] mb-1"
              >
                Country *
              </label>
              <input
                id="transport-country-input"
                list="transport-countries-datalist"
                required
                value={countryInput}
                onChange={(e) => setCountryInput(e.target.value)}
                placeholder="Any country worldwide..."
                maxLength={80}
                className="w-full border border-[#f0e9dc] rounded-xl bg-[#fffdf8] px-3 py-2 text-[13px] font-semibold text-[#27334b] outline-none focus:border-[#ff826e]"
              />
              <datalist id="transport-countries-datalist">
                {countries.map((c) => (
                  <option key={c.name} value={c.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label
                htmlFor="transport-city-input"
                className="block text-[11px] font-bold text-[#5a6578] mb-1"
              >
                City or Region (for local transit overview)
              </label>
              <input
                id="transport-city-input"
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder="e.g. Tokyo, Paris, Lisbon, Bali"
                maxLength={100}
                className="w-full border border-[#f0e9dc] rounded-xl bg-[#fffdf8] px-3 py-2 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e]"
              />
            </div>

            <div>
              <label
                htmlFor="transport-priority-select"
                className="block text-[11px] font-bold text-[#5a6578] mb-1"
              >
                Route priority
              </label>
              <select
                id="transport-priority-select"
                value={travelPriority}
                onChange={(e) =>
                  setTravelPriority(
                    e.target.value as 'Balanced' | 'Fastest' | 'Most Affordable'
                  )
                }
                className="w-full border border-[#f0e9dc] rounded-xl bg-[#fffdf8] px-3 py-2 text-[13px] font-semibold text-[#27334b] outline-none focus:border-[#ff826e]"
              >
                <option value="Balanced">Convenient &amp; practical</option>
                <option value="Fastest">Fastest transit time</option>
                <option value="Most Affordable">Most affordable fare</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="transport-travelers-input"
                className="block text-[11px] font-bold text-[#5a6578] mb-1"
              >
                Travelers
              </label>
              <input
                id="transport-travelers-input"
                type="number"
                min={1}
                max={20}
                value={travelers}
                onChange={(e) =>
                  setTravelers(Math.max(1, Math.min(20, Number(e.target.value) || 1)))
                }
                className="w-full border border-[#f0e9dc] rounded-xl bg-[#fffdf8] px-3 py-2 text-[13px] font-semibold text-[#27334b] outline-none focus:border-[#ff826e] tabular-nums"
              />
            </div>
          </div>

          {/* Origin + Swap + Destination */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2.5 items-end">
            <div>
              <label
                htmlFor="transport-origin-input"
                className="block text-[11px] font-bold text-[#5a6578] mb-1"
              >
                Origin / Departure area *
              </label>
              <input
                id="transport-origin-input"
                type="text"
                required
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Station, airport, neighborhood, or landmark"
                maxLength={140}
                className="w-full border border-[#f0e9dc] rounded-xl bg-[#fffdf8] px-3 py-2 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e]"
              />
            </div>

            <button
              type="button"
              onClick={handleSwapEndpoints}
              title="Swap origin and destination"
              aria-label="Swap origin and destination"
              className="h-[38px] px-3 rounded-xl bg-[#fff9ed] border border-[#f0e9dc] text-[#5a6578] hover:text-[#27334b] hover:border-[#ff826e] grid place-items-center transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>

            <div>
              <label
                htmlFor="transport-destination-input"
                className="block text-[11px] font-bold text-[#5a6578] mb-1"
              >
                Destination *
              </label>
              <input
                id="transport-destination-input"
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="City, attraction, port, or hotel area"
                maxLength={140}
                className="w-full border border-[#f0e9dc] rounded-xl bg-[#fffdf8] px-3 py-2 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e]"
              />
            </div>
          </div>

          {/* Mode Focus Chips */}
          <div>
            <span className="block text-[11px] font-bold text-[#5a6578] mb-1.5">
              Transport mode focus
            </span>
            <div className="flex flex-wrap gap-1.5">
              {TRANSPORT_MODE_OPTIONS.map((opt) => {
                const active = preferredMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPreferredMode(opt.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#27334b] text-white border-[#27334b]'
                        : 'bg-[#fffdf8] text-[#5a6578] border-[#f0e9dc] hover:border-[#d6cfc3]'
                    }`}
                  >
                    {opt.value !== 'All' && getModeIcon(opt.value, 'w-3.5 h-3.5')}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes & Submit */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end justify-between pt-1">
            <div className="flex-1 min-w-0">
              <label
                htmlFor="transport-notes-input"
                className="block text-[11px] font-bold text-[#5a6578] mb-1"
              >
                Optional constraints (luggage, late-night arrival, rail pass)
              </label>
              <input
                id="transport-notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Carrying 2 large suitcases, JR Pass holder, arriving at 10 PM..."
                maxLength={160}
                className="w-full border border-[#f0e9dc] rounded-xl bg-[#fffdf8] px-3 py-2 text-[12.5px] text-[#27334b] outline-none focus:border-[#ff826e]"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finding routes &amp; fares...
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4" />
                  Find routes &amp; local guide
                </>
              )}
            </button>
          </div>
        </form>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-xl bg-[#fff4f0] border border-[#f5d3ca] flex items-center justify-between gap-2 text-[12px] text-[#b93f31]">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={(e) => void handleSearchRoutes(e)}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#f5d3ca] font-bold whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Trip & Budget Sync Destination Bar */}
      {trips.length > 0 && (
        <div className="bg-[#fffaf2] border border-[#f0e9dc] rounded-[16px] px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[12px] font-[800] text-[#27334b]">
              Add routes directly to:
            </span>
            <select
              aria-label="Target trip for adding transport routes"
              value={selectedTrip?.id || ''}
              onChange={(e) => {
                setTargetTripId(e.target.value);
                setTargetDay(1);
              }}
              className="border border-[#e8dfd0] rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#27334b] outline-none focus:border-[#ff826e]"
            >
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.country})
                </option>
              ))}
            </select>

            {selectedTrip && (
              <div className="inline-flex items-center gap-1.5">
                <label
                  htmlFor="target-trip-day"
                  className="text-[11px] font-bold text-[#6c7584]"
                >
                  Day
                </label>
                <select
                  id="target-trip-day"
                  value={targetDay}
                  onChange={(e) => setTargetDay(Number(e.target.value) || 1)}
                  className="border border-[#e8dfd0] rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#27334b] outline-none focus:border-[#ff826e] tabular-nums"
                >
                  {Array.from(
                    { length: Math.min(30, Math.max(1, selectedTrip.days)) },
                    (_, i) => i + 1
                  ).map((d) => (
                    <option key={d} value={d}>
                      Day {d}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <label className="inline-flex items-center gap-2 text-[12px] font-bold text-[#27334b] cursor-pointer">
            <input
              type="checkbox"
              checked={includeFareInBudget}
              onChange={(e) => setIncludeFareInBudget(e.target.checked)}
              className="rounded text-[#ff826e] focus:ring-[#ff826e]"
            />
            Automatically add estimated fare to Trip Budget Tracker
          </label>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4 mb-6 animate-pulse">
          <div className="h-44 rounded-[18px] bg-white border border-[#f0e9dc]" />
          <div className="h-52 rounded-[18px] bg-white border border-[#f0e9dc]" />
        </div>
      )}

      {/* AI Results: City Transit Overview + Route Options */}
      {!isLoading && cityGuide && (
        <div className="space-y-6 mb-8">
          {/* Local Transit Overview */}
          <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#3a6e8f]">
                  Local transportation guide
                </div>
                <h3 className="font-[900] text-[18px] text-[#27334b] mt-0.5">
                  Getting around {cityGuide.city}
                  {cityGuide.country && cityGuide.city !== cityGuide.country
                    ? `, ${cityGuide.country}`
                    : ''}
                </h3>
              </div>

              {cityGuide.transitCardOrPass && (
                <div className="px-3 py-1.5 rounded-xl bg-[#f4fafd] border border-[#dcecf5] text-[11.5px] text-[#27334b] font-semibold max-w-md">
                  <strong className="text-[#3a6e8f]">Smart card / Pass:</strong>{' '}
                  {cityGuide.transitCardOrPass}
                </div>
              )}
            </div>

            {cityGuide.summary && (
              <p className="text-[13px] text-[#4d5768] leading-relaxed mb-4">
                {cityGuide.summary}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-[#fffdf8] border border-[#f2ece1] rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-[12px] font-[800] text-[#27334b] mb-1">
                  <Train className="w-4 h-4 text-[#d66654]" />
                  Trains &amp; Metro
                </div>
                <p className="text-[12px] text-[#5a6578] leading-relaxed">
                  {cityGuide.trainsAndMetro}
                </p>
              </div>

              <div className="bg-[#fffdf8] border border-[#f2ece1] rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-[12px] font-[800] text-[#27334b] mb-1">
                  <Bus className="w-4 h-4 text-[#3a8d68]" />
                  Buses &amp; Coaches
                </div>
                <p className="text-[12px] text-[#5a6578] leading-relaxed">
                  {cityGuide.buses}
                </p>
              </div>

              <div className="bg-[#fffdf8] border border-[#f2ece1] rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-[12px] font-[800] text-[#27334b] mb-1">
                  <Ship className="w-4 h-4 text-[#5aa9d6]" />
                  Ferries &amp; Boats
                </div>
                <p className="text-[12px] text-[#5a6578] leading-relaxed">
                  {cityGuide.ferries}
                </p>
              </div>

              <div className="bg-[#fffdf8] border border-[#f2ece1] rounded-xl p-3.5">
                <div className="flex items-center gap-1.5 text-[12px] font-[800] text-[#27334b] mb-1">
                  <Car className="w-4 h-4 text-[#e09f3e]" />
                  Taxis &amp; Ride-Hailing
                </div>
                <p className="text-[12px] text-[#5a6578] leading-relaxed">
                  {cityGuide.taxisAndRideHailing}
                </p>
              </div>
            </div>

            {cityGuide.localTips.length > 0 && (
              <div className="bg-[#fffaf2] border border-[#f0e9dc] rounded-xl p-3.5 mb-3">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#6c7584] mb-1.5">
                  Practical traveler tips
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] text-[#27334b]">
                  {cityGuide.localTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-[#ff826e] font-bold">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cityGuide.sourceLinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 text-[11px]">
                <span className="font-bold text-[#6c7584]">Official transit portals:</span>
                {cityGuide.sourceLinks.slice(0, 5).map((link, idx) => (
                  <a
                    key={`city-src-${idx}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#3a6e8f] hover:text-[#214f6c] underline underline-offset-2"
                  >
                    {link.title}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Route Options Header + Result Filter */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h3 className="font-[900] text-[18px] text-[#27334b]">
                Recommended routes ({filteredRoutes.length})
              </h3>

              {availableResultModes.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setModeFilter('All')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                      modeFilter === 'All'
                        ? 'bg-[#27334b] text-white border-[#27334b]'
                        : 'bg-white text-[#5a6578] border-[#f0e9dc]'
                    }`}
                  >
                    All ({routes.length})
                  </button>
                  {availableResultModes.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModeFilter(m)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                        modeFilter === m
                          ? 'bg-[#27334b] text-white border-[#27334b]'
                          : 'bg-white text-[#5a6578] border-[#f0e9dc]'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {filteredRoutes.map((route) => renderRouteCard(route, false))}
            </div>
          </div>
        </div>
      )}

      {/* Saved Routes Library */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-[900] text-[18px] text-[#27334b]">
            Saved transportation routes ({savedRoutes.length})
          </h3>
        </div>

        {savedRoutes.length > 0 ? (
          <div className="space-y-4">
            {savedRoutes.map((route) => renderRouteCard(route, true))}
          </div>
        ) : (
          <div className="bg-white border border-dashed border-[#e9dfd1] rounded-[18px] p-8 text-center text-[13px] text-[#6c7584]">
            Search any route above and click &ldquo;Save route&rdquo; to keep operators, stations, step-by-step transfers, and fare estimates ready for offline reference.
          </div>
        )}
      </div>
    </section>
  );
};
