import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  ExternalLink,
  Heart,
  MapPin,
  Plus,
  RefreshCw,
  Sun,
  Wind,
} from 'lucide-react';
import {
  fetchDestinationWeather,
  type DestinationWeather,
  type WeatherKind,
} from '../../lib/weather';
import type { Country, WishItem } from '../../types/journal';
import { ScenicArtwork } from '../ScenicArtwork';

interface CountryDetailPageProps {
  country: Country;
  wishes: WishItem[];
  onBack: () => void;
  onAddWish: (placeName: string, countryName: string) => void;
  onPlanTripHere: (countryName: string) => void;
  onToggleVisited: (countryName: string) => void;
  onOpenAddDestination: (countryName: string) => void;
}

function renderWeatherIcon(kind: WeatherKind) {
  switch (kind) {
    case 'sun':
      return <Sun className="w-7 h-7 text-[#e89923]" />;
    case 'partly':
      return <CloudSun className="w-7 h-7 text-[#e89923]" />;
    case 'cloud':
      return <Cloud className="w-7 h-7 text-[#6b7a90]" />;
    case 'fog':
      return <CloudFog className="w-7 h-7 text-[#6b7a90]" />;
    case 'rain':
      return <CloudRain className="w-7 h-7 text-[#3f8fc4]" />;
    case 'snow':
      return <CloudSnow className="w-7 h-7 text-[#5b9ec9]" />;
    case 'storm':
      return <CloudLightning className="w-7 h-7 text-[#7b67c9]" />;
  }
}

export const CountryDetailPage: React.FC<CountryDetailPageProps> = ({
  country,
  wishes,
  onBack,
  onAddWish,
  onPlanTripHere,
  onToggleVisited,
  onOpenAddDestination,
}) => {
  const isCountrySaved = wishes.some(
    (w) => w.name.toLowerCase() === country.name.toLowerCase()
  );
  const isVisited = country.flagged === 'visited';

  // Deduplicated list of selectable destinations within this country
  const destinationOptions = useMemo(() => {
    const primaryCapital = country.capital.split('·')[0].trim();
    const candidates = [primaryCapital, ...country.places, ...country.dest].filter(
      (item) => Boolean(item) && item !== 'Add capital' && item !== 'Capital city'
    );
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const item of candidates) {
      const key = item.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }
    return unique.length > 0 ? unique : [country.name];
  }, [country]);

  const [selectedDestination, setSelectedDestination] = useState<string>(
    destinationOptions[0]
  );
  const [unit, setUnit] = useState<'C' | 'F'>('C');
  const [weather, setWeather] = useState<DestinationWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  // Reset selected destination when switching countries
  useEffect(() => {
    setSelectedDestination(destinationOptions[0]);
  }, [country.name, destinationOptions]);

  const loadWeather = useCallback(
    async (signal?: AbortSignal) => {
      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const result = await fetchDestinationWeather(
          selectedDestination,
          country.name,
          country.capital,
          signal
        );
        if (!signal?.aborted) {
          setWeather(result);
        }
      } catch (err) {
        if (signal?.aborted) return;
        setWeatherError(
          err instanceof Error
            ? err.message
            : 'Unable to fetch current weather right now.'
        );
      } finally {
        if (!signal?.aborted) {
          setWeatherLoading(false);
        }
      }
    },
    [selectedDestination, country.name, country.capital]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadWeather(controller.signal);
    return () => controller.abort();
  }, [loadWeather, refreshTick]);

  const formatTemp = (tempC: number) =>
    unit === 'C' ? `${tempC}°C` : `${Math.round((tempC * 9) / 5 + 32)}°F`;

  return (
    <section aria-label={`${country.name} country profile`}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
            Country passport
          </div>
          <p className="text-[#6c7584] text-[13px] mt-1">
            Explore the little details of this place.
          </p>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[13px] font-bold hover:bg-[#fffdf8] transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to world
        </button>
      </div>

      <div className="bg-white border border-[#f0e9dc] rounded-[19px] overflow-hidden">
        {/* Hero Banner */}
        <div className="h-[220px] relative overflow-hidden">
          <ScenicArtwork
            scene={country.scene}
            alt={`${country.name} scenic panorama`}
            variant="hero"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#141e2b]/75 via-[#141e2b]/20 to-transparent" />
          <div className="absolute bottom-5 left-6 text-white z-10">
            <span className="text-[13px] font-medium opacity-95">
              {country.flag} {country.continent}
            </span>
            <h2 className="font-[900] text-[30px] sm:text-[34px] leading-tight m-0 mt-0.5">
              {country.name}
            </h2>
          </div>
        </div>

        <div className="p-6">
          <p className="text-[14px] leading-[1.7] text-[#4d5768] max-w-3xl">{country.desc}</p>

          {/* Structured Fact Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-5">
            <div className="bg-[#fff8ed] rounded-xl p-3.5">
              <span className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                Capital
              </span>
              <strong className="font-[800] text-[13px] text-[#27334b] block mt-1">
                {country.capital}
              </strong>
            </div>
            <div className="bg-[#fff8ed] rounded-xl p-3.5">
              <span className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                Currency
              </span>
              <strong className="font-[800] text-[13px] text-[#27334b] block mt-1">
                {country.currency}
              </strong>
            </div>
            <div className="bg-[#fff8ed] rounded-xl p-3.5">
              <span className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                Language
              </span>
              <strong className="font-[800] text-[13px] text-[#27334b] block mt-1">
                {country.language}
              </strong>
            </div>
            <div className="bg-[#fff8ed] rounded-xl p-3.5">
              <span className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                Best season
              </span>
              <strong className="font-[800] text-[13px] text-[#27334b] block mt-1">
                {country.season}
              </strong>
            </div>
            <div className="bg-[#fff8ed] rounded-xl p-3.5">
              <span className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                Daily budget guide
              </span>
              <strong className="font-[800] text-[13px] text-[#27334b] block mt-1 tabular-nums">
                {country.budget}
              </strong>
            </div>
            <div className="bg-[#fff8ed] rounded-xl p-3.5">
              <span className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                Recommended stay
              </span>
              <strong className="font-[800] text-[13px] text-[#27334b] block mt-1 tabular-nums">
                {country.duration}
              </strong>
            </div>
            <div className="bg-[#fff8ed] rounded-xl p-3.5">
              <span className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                Time zone
              </span>
              <strong className="font-[800] text-[13px] text-[#27334b] block mt-1">
                {country.timeZone}
              </strong>
            </div>
            <div className="bg-[#fff8ed] rounded-xl p-3.5">
              <span className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                Travel requirements
              </span>
              <a
                href="https://www.iatatravelcentre.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-[800] text-[13px] text-[#d65442] hover:underline mt-1"
              >
                Check IATA
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Live Current Weather Panel */}
          <div
            className="bg-[#f4fafd] border border-[#dcecf5] rounded-2xl p-4 sm:p-5 my-6"
            aria-label="Current destination weather"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-[800] text-[15px] text-[#27334b]">
                  Current destination weather
                </h3>
                <p className="text-[12px] text-[#5b6578]">
                  Live forecast from Open-Meteo for your selected place in {country.name}.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedDestination}
                  onChange={(e) => setSelectedDestination(e.target.value)}
                  aria-label="Select destination for weather"
                  className="border border-[#d8e7f0] rounded-xl bg-white px-3 py-2 text-[12px] font-semibold text-[#27334b] outline-none focus:border-[#ff826e]"
                >
                  {destinationOptions.map((dest) => (
                    <option key={dest} value={dest}>
                      {dest}
                    </option>
                  ))}
                </select>

                <div
                  className="inline-flex bg-white border border-[#d8e7f0] rounded-xl p-0.5"
                  role="group"
                  aria-label="Temperature unit"
                >
                  <button
                    type="button"
                    onClick={() => setUnit('C')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      unit === 'C'
                        ? 'bg-[#27334b] text-white'
                        : 'text-[#5b6578] hover:text-[#27334b]'
                    }`}
                  >
                    °C
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnit('F')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      unit === 'F'
                        ? 'bg-[#27334b] text-white'
                        : 'text-[#5b6578] hover:text-[#27334b]'
                    }`}
                  >
                    °F
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setRefreshTick((t) => t + 1)}
                  disabled={weatherLoading}
                  title="Refresh weather"
                  aria-label="Refresh weather"
                  className="w-9 h-9 rounded-xl bg-white border border-[#d8e7f0] grid place-items-center text-[#27334b] hover:border-[#ff826e] transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${weatherLoading ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
            </div>

            {weatherLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 animate-pulse">
                <div className="h-[68px] rounded-xl bg-white/80 sm:col-span-2" />
                <div className="h-[68px] rounded-xl bg-white/80" />
                <div className="h-[68px] rounded-xl bg-white/80" />
              </div>
            ) : weatherError ? (
              <div className="bg-white border border-[#f5d3ca] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-[12px] text-[#b93f31]">{weatherError}</span>
                <button
                  type="button"
                  onClick={() => setRefreshTick((t) => t + 1)}
                  className="px-3 py-1.5 rounded-lg bg-[#fff4f0] text-[#c94a3b] text-[12px] font-bold hover:bg-[#ffe8df] shrink-0 self-start sm:self-auto"
                >
                  Try again
                </button>
              </div>
            ) : weather ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-stretch">
                <div className="bg-white border border-[#e4eff6] rounded-xl p-3.5 flex items-center gap-3.5 sm:col-span-2">
                  <div className="w-12 h-12 rounded-xl bg-[#f4fafd] grid place-items-center shrink-0">
                    {renderWeatherIcon(weather.kind)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2.5">
                      <strong className="font-[900] text-[24px] leading-none text-[#27334b] tabular-nums">
                        {formatTemp(weather.temperatureC)}
                      </strong>
                      <span className="text-[13px] font-bold text-[#27334b]">
                        {weather.condition}
                      </span>
                    </div>
                    <span className="block text-[11px] text-[#5b6578] mt-1 truncate">
                      {selectedDestination}
                      {weather.locationLabel.toLowerCase() !==
                      selectedDestination.toLowerCase()
                        ? ` (Nearest station: ${weather.locationLabel})`
                        : ''}
                      {' · '}Feels like{' '}
                      <span className="tabular-nums">
                        {formatTemp(weather.apparentTempC)}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-[#e4eff6] rounded-xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#f4fafd] grid place-items-center text-[#3f8fc4] shrink-0">
                    <Droplets className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                      Humidity
                    </span>
                    <strong className="font-[800] text-[15px] text-[#27334b] tabular-nums">
                      {weather.humidity}%
                    </strong>
                  </div>
                </div>

                <div className="bg-white border border-[#e4eff6] rounded-xl p-3.5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#f4fafd] grid place-items-center text-[#458a68] shrink-0">
                    <Wind className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider">
                      Wind speed
                    </span>
                    <strong className="font-[800] text-[15px] text-[#27334b] tabular-nums">
                      {weather.windKmh} km/h
                    </strong>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Regions & Cities */}
          <div className="flex items-center justify-between mb-3 mt-6">
            <h3 className="font-[800] text-[15px] text-[#27334b]">Explore regions & cities 📍</h3>
            <button
              type="button"
              onClick={() => onOpenAddDestination(country.name)}
              className="inline-flex items-center gap-1 bg-[#fff4f0] text-[#c95b4b] hover:bg-[#ffe8df] rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add place
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-[12px] text-[#4d5768] mb-6">
            {country.places.length > 0 ? (
              country.places.map((place) => {
                const isSelected =
                  selectedDestination.toLowerCase() === place.toLowerCase();
                return (
                  <button
                    key={place}
                    type="button"
                    onClick={() => setSelectedDestination(place)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-colors ${
                      isSelected
                        ? 'bg-[#27334b] text-white border-[#27334b]'
                        : 'bg-[#fffdf8] text-[#27334b] border-[#f0e9dc] hover:border-[#ff826e]'
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                    {place}
                  </button>
                );
              })
            ) : (
              <span className="text-[#6c7584]">No regions added yet.</span>
            )}
          </div>

          {/* Little places to discover */}
          <h3 className="font-[800] text-[15px] text-[#27334b] mb-3">
            Little places to discover
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {country.dest.map((destName) => {
              const saved = wishes.some(
                (w) => w.name.toLowerCase() === destName.toLowerCase()
              );
              const isWeatherSelected =
                selectedDestination.toLowerCase() === destName.toLowerCase();
              return (
                <div
                  key={destName}
                  className="border border-[#f0e9dc] rounded-[14px] overflow-hidden bg-white"
                >
                  <div className="h-[105px] overflow-hidden">
                    <ScenicArtwork
                      scene={country.scene}
                      alt={`${destName} in ${country.name}`}
                      variant="card"
                    />
                  </div>
                  <div className="p-3">
                    <strong className="font-[800] text-[13px] text-[#27334b] block">
                      {destName}
                    </strong>
                    <span className="block text-[#6c7584] text-[11px] mt-0.5">
                      {country.name} · Destination idea
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mt-2.5">
                      <button
                        type="button"
                        onClick={() => onAddWish(destName, country.name)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                          saved
                            ? 'bg-[#eef8f3] text-[#458a68]'
                            : 'bg-[#fff4f0] text-[#c95b4b] hover:bg-[#ffe8df]'
                        }`}
                      >
                        <Heart className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} />
                        {saved ? 'Saved in bucket list' : 'Save to wishlist'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedDestination(destName)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                          isWeatherSelected
                            ? 'bg-[#27334b] text-white'
                            : 'bg-[#f4fafd] text-[#2b6a8e] hover:bg-[#e5f3fa]'
                        }`}
                      >
                        <CloudSun className="w-3.5 h-3.5" />
                        {isWeatherSelected ? 'Showing weather' : 'Weather'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-wrap gap-2.5 mt-6 pt-5 border-t border-[#f0e9dc]">
            <button
              type="button"
              onClick={() => onAddWish(country.name, country.name)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all"
            >
              <Heart className="w-4 h-4" fill={isCountrySaved ? 'currentColor' : 'none'} />
              {isCountrySaved ? 'Saved in bucket list' : 'Add to wishlist'}
            </button>

            <button
              type="button"
              onClick={() => onPlanTripHere(country.name)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[13px] font-bold hover:bg-[#fffdf8] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Plan a trip here
            </button>

            <button
              type="button"
              onClick={() => onToggleVisited(country.name)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[13px] font-bold transition-colors ${
                isVisited
                  ? 'bg-[#eef8f3] border-[#a8dfc6] text-[#3a7c5d]'
                  : 'bg-white border-[#f0e9dc] text-[#27334b] hover:bg-[#fffdf8]'
              }`}
            >
              <Check className="w-4 h-4" />
              {isVisited ? 'Visited (in passport)' : 'Mark visited'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
