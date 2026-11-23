import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Compass,
  Heart,
  MapPin,
  Plus,
  Route,
  Stamp,
} from 'lucide-react';
import { buildTravelJourneyGraph } from '../../lib/worldGeo';
import type { Country, JournalEntry, Trip } from '../../types/journal';
import { D3WorldMap, type MapRouteFilter } from '../D3WorldMap';

interface WorldMapPageProps {
  countries: Country[];
  trips: Trip[];
  journals: JournalEntry[];
  onOpenCountry: (countryName: string) => void;
  onToggleVisited: (countryName: string) => void;
  onToggleWishCountry: (countryName: string) => void;
  onOpenAddCountry: () => void;
  onNavigateExplore: () => void;
}

const FILTER_TABS: { id: MapRouteFilter; label: string }[] = [
  { id: 'all', label: 'All routes & pins' },
  { id: 'visited', label: 'Visited path' },
  { id: 'wishlist', label: 'Wishlist routes' },
  { id: 'pins', label: 'Pins only' },
];

export const WorldMapPage: React.FC<WorldMapPageProps> = ({
  countries,
  trips,
  journals,
  onOpenCountry,
  onToggleVisited,
  onToggleWishCountry,
  onOpenAddCountry,
  onNavigateExplore,
}) => {
  const [routeFilter, setRouteFilter] = useState<MapRouteFilter>('all');
  const [inspectorTab, setInspectorTab] = useState<'visited' | 'wishlist'>('visited');

  const journeyGraph = useMemo(
    () => buildTravelJourneyGraph(countries, trips, journals),
    [countries, trips, journals]
  );

  const [selectedCountryName, setSelectedCountryName] = useState<string | null>(
    () =>
      journeyGraph.visitedNodes[0]?.country.name ||
      journeyGraph.wishlistNodes[0]?.country.name ||
      countries[0]?.name ||
      null
  );

  useEffect(() => {
    if (
      selectedCountryName &&
      !countries.some((c) => c.name === selectedCountryName)
    ) {
      setSelectedCountryName(
        journeyGraph.visitedNodes[0]?.country.name ||
          journeyGraph.wishlistNodes[0]?.country.name ||
          countries[0]?.name ||
          null
      );
    }
  }, [countries, selectedCountryName, journeyGraph]);

  const selectedNode = useMemo(() => {
    if (!selectedCountryName) return null;
    return (
      journeyGraph.visitedNodes.find((n) => n.country.name === selectedCountryName) ||
      journeyGraph.wishlistNodes.find((n) => n.country.name === selectedCountryName) ||
      journeyGraph.exploreNodes.find((n) => n.country.name === selectedCountryName) ||
      null
    );
  }, [journeyGraph, selectedCountryName]);

  const selectedConnections = useMemo(() => {
    if (!selectedCountryName) return [];
    return journeyGraph.connections.filter(
      (c) =>
        c.from.country.name === selectedCountryName ||
        c.to.country.name === selectedCountryName
    );
  }, [journeyGraph.connections, selectedCountryName]);

  const visitedContinentsCount = useMemo(
    () => new Set(journeyGraph.visitedNodes.map((n) => n.country.continent)).size,
    [journeyGraph.visitedNodes]
  );

  return (
    <section aria-label="World map">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
            Global travel footprint
          </div>
          <h2 className="font-[900] text-[26px] sm:text-[30px] tracking-[-0.5px] text-[#27334b] mt-1 mb-0.5 text-balance">
            World map <span aria-hidden="true">🗺️</span>
          </h2>
          <p className="text-[#6c7584] text-[13px]">
            Plot visited stamps, trace dream wishlist routes, and inspect every leg of your journey.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={onNavigateExplore}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] hover:border-[#ff826e] text-[13px] font-bold transition-colors whitespace-nowrap"
          >
            <Compass className="w-4 h-4" />
            Explore guide
          </button>
          <button
            type="button"
            onClick={onOpenAddCountry}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add country
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        <div className="bg-white border border-[#f0e9dc] rounded-[16px] p-4">
          <div className="text-[11px] font-bold text-[#6c7584]">Visited countries</div>
          <strong className="block font-[900] text-[24px] text-[#27334b] mt-1 tabular-nums">
            {journeyGraph.visitedNodes.length}
          </strong>
          <span className="text-[11px] text-[#458a68] font-semibold">
            Stamped in passport
          </span>
        </div>

        <div className="bg-white border border-[#f0e9dc] rounded-[16px] p-4">
          <div className="text-[11px] font-bold text-[#6c7584]">Wishlist destinations</div>
          <strong className="block font-[900] text-[24px] text-[#27334b] mt-1 tabular-nums">
            {journeyGraph.wishlistNodes.length}
          </strong>
          <span className="text-[11px] text-[#b88212] font-semibold">
            Dream horizon
          </span>
        </div>

        <div className="bg-white border border-[#f0e9dc] rounded-[16px] p-4">
          <div className="text-[11px] font-bold text-[#6c7584]">Continents reached</div>
          <strong className="block font-[900] text-[24px] text-[#27334b] mt-1 tabular-nums">
            {visitedContinentsCount} / 7
          </strong>
          <span className="text-[11px] text-[#6c7584]">
            Across visited pins
          </span>
        </div>

        <div className="bg-white border border-[#f0e9dc] rounded-[16px] p-4">
          <div className="text-[11px] font-bold text-[#6c7584]">Visited route span</div>
          <strong className="block font-[900] text-[24px] text-[#27334b] mt-1 tabular-nums">
            {journeyGraph.totalVisitedDistanceKm.toLocaleString()} km
          </strong>
          <span className="text-[11px] text-[#d66654] font-semibold tabular-nums">
            +{journeyGraph.totalWishlistDistanceKm.toLocaleString()} km wishlist span
          </span>
        </div>
      </div>

      {/* Main Map + Journey Inspector Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.85fr_1fr] gap-4 items-start">
        {/* Map Card */}
        <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-4 sm:p-5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
            <div>
              <h3 className="font-[800] text-[15px] text-[#27334b]">
                Interactive journey map
              </h3>
              <p className="text-[11px] text-[#6c7584] mt-0.5 tabular-nums">
                {journeyGraph.connections.length}{' '}
                {journeyGraph.connections.length === 1 ? 'connection' : 'connections'} plotted across{' '}
                {countries.length} countries
              </p>
            </div>

            {/* Segmented Route Filter */}
            <div
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#f7f3eb] rounded-xl"
              role="group"
              aria-label="Filter map routes"
            >
              {FILTER_TABS.map((tab) => {
                const active = routeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRouteFilter(tab.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-[#27334b] shadow-xs'
                        : 'text-[#6c7584] hover:text-[#27334b]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <D3WorldMap
            countries={countries}
            journeyGraph={journeyGraph}
            routeFilter={routeFilter}
            selectedCountryName={selectedCountryName}
            onSelectCountryPin={(name) => setSelectedCountryName(name)}
          />
        </div>

        {/* Right Column: Selected Pin Inspector & Route Breakdown */}
        <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5 min-w-0 space-y-5">
          {/* Selected Country Inspector */}
          {selectedNode ? (
            <div>
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[28px] leading-none shrink-0" aria-hidden="true">
                    {selectedNode.country.flag}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-[900] text-[17px] text-[#27334b] truncate">
                      {selectedNode.country.name}
                    </h3>
                    <div className="text-[11px] text-[#6c7584] truncate">
                      {selectedNode.country.continent} · {selectedNode.country.capital}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-extrabold shrink-0 ${
                    selectedNode.country.flagged === 'visited'
                      ? 'text-[#458a68]'
                      : selectedNode.country.flagged === 'wishlist'
                        ? 'text-[#c48b13]'
                        : 'text-[#6c7584]'
                  }`}
                >
                  {selectedNode.country.flagged === 'visited'
                    ? `Visited #${selectedNode.orderIndex}`
                    : selectedNode.country.flagged === 'wishlist'
                      ? 'Wishlist'
                      : 'Explore'}
                </span>
              </div>

              <div className="mt-3 text-[12px] text-[#4d5768] leading-relaxed">
                {selectedNode.country.desc}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11px] text-[#6c7584] tabular-nums">
                <span>
                  <strong className="text-[#27334b]">{selectedNode.tripCount}</strong>{' '}
                  {selectedNode.tripCount === 1 ? 'trip' : 'trips'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="text-[#27334b]">{selectedNode.memoryCount}</strong>{' '}
                  {selectedNode.memoryCount === 1 ? 'memory' : 'memories'}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {selectedNode.coords[1].toFixed(1)}°, {selectedNode.coords[0].toFixed(1)}°
                </span>
              </div>

              {/* Quick Status Actions */}
              <div className="grid grid-cols-2 gap-2 mt-3.5">
                <button
                  type="button"
                  onClick={() => onToggleVisited(selectedNode.country.name)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-colors whitespace-nowrap ${
                    selectedNode.country.flagged === 'visited'
                      ? 'bg-[#edf8f1] text-[#3f8261] border border-[#b9e1ca]'
                      : 'bg-[#fff9ed] text-[#27334b] border border-[#f0e9dc] hover:border-[#7bc9a5]'
                  }`}
                >
                  <Stamp className="w-3.5 h-3.5 shrink-0" />
                  {selectedNode.country.flagged === 'visited'
                    ? 'Visited'
                    : 'Mark visited'}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleWishCountry(selectedNode.country.name)}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold transition-colors whitespace-nowrap ${
                    selectedNode.country.flagged === 'wishlist'
                      ? 'bg-[#fff6d6] text-[#9b6c06] border border-[#f1d37a]'
                      : 'bg-[#fff9ed] text-[#27334b] border border-[#f0e9dc] hover:border-[#f5b935]'
                  }`}
                >
                  <Heart
                    className="w-3.5 h-3.5 shrink-0"
                    fill={
                      selectedNode.country.flagged === 'wishlist'
                        ? 'currentColor'
                        : 'none'
                    }
                  />
                  {selectedNode.country.flagged === 'wishlist'
                    ? 'On wishlist'
                    : 'Add wishlist'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpenCountry(selectedNode.country.name)}
                className="mt-2.5 w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#27334b] text-white hover:bg-[#1e283c] text-[12px] font-bold transition-colors"
              >
                Open country profile
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {/* Connected Route Legs for Selected Country */}
              {selectedConnections.length > 0 && (
                <div className="mt-4 pt-3.5 border-t border-[#f0e9dc]">
                  <div className="text-[11px] font-extrabold text-[#5a6578] mb-2 flex items-center gap-1.5">
                    <Route className="w-3.5 h-3.5 text-[#d66654]" />
                    Connected route legs
                  </div>
                  <div className="space-y-1.5">
                    {selectedConnections.map((conn) => {
                      const other =
                        conn.from.country.name === selectedNode.country.name
                          ? conn.to
                          : conn.from;
                      return (
                        <button
                          key={conn.id}
                          type="button"
                          onClick={() => setSelectedCountryName(other.country.name)}
                          className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#fffdf8] hover:bg-[#fff6eb] border border-[#f2ece1] text-left transition-colors"
                        >
                          <span className="text-[12px] font-semibold text-[#27334b] truncate">
                            {conn.from.country.flag} {conn.from.country.name}{' '}
                            <span className="text-[#9aa4b2]">→</span>{' '}
                            {conn.to.country.flag} {conn.to.country.name}
                          </span>
                          <span className="text-[11px] font-bold text-[#6c7584] tabular-nums shrink-0">
                            {conn.distanceKm.toLocaleString()} km
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 text-center text-[#6c7584] text-[12px] border border-dashed border-[#e9dfd1] rounded-xl">
              Select any pin on the map to inspect its travel details and route connections.
            </div>
          )}

          {/* Journey Sequence Lists */}
          <div className="pt-4 border-t border-[#f0e9dc]">
            <div className="flex items-center gap-1 p-1 bg-[#f7f3eb] rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setInspectorTab('visited')}
                className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                  inspectorTab === 'visited'
                    ? 'bg-white text-[#27334b] shadow-xs'
                    : 'text-[#6c7584] hover:text-[#27334b]'
                }`}
              >
                Visited sequence ({journeyGraph.visitedNodes.length})
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('wishlist')}
                className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                  inspectorTab === 'wishlist'
                    ? 'bg-white text-[#27334b] shadow-xs'
                    : 'text-[#6c7584] hover:text-[#27334b]'
                }`}
              >
                Wishlist pins ({journeyGraph.wishlistNodes.length})
              </button>
            </div>

            {inspectorTab === 'visited' ? (
              journeyGraph.visitedNodes.length > 0 ? (
                <div className="divide-y divide-[#f2ece1] max-h-[250px] overflow-y-auto pr-1">
                  {journeyGraph.visitedNodes.map((node, idx) => {
                    const isSelected = selectedCountryName === node.country.name;
                    const legToNext = journeyGraph.connections.find(
                      (c) =>
                        c.kind === 'visited-route' &&
                        c.from.country.name === node.country.name
                    );
                    return (
                      <button
                        key={node.country.name}
                        type="button"
                        onClick={() => setSelectedCountryName(node.country.name)}
                        className={`w-full flex items-center justify-between gap-2.5 py-2.5 px-2 rounded-lg text-left transition-colors ${
                          isSelected ? 'bg-[#fff4f0]' : 'hover:bg-[#fffdf8]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-[#ff826e] text-white text-[10px] font-extrabold grid place-items-center shrink-0 tabular-nums">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <strong className="block text-[12px] font-bold text-[#27334b] truncate">
                              {node.country.flag} {node.country.name}
                            </strong>
                            <span className="block text-[10.5px] text-[#6c7584]">
                              {node.country.continent}
                              {node.earliestDate ? ` · Since ${node.earliestDate}` : ''}
                            </span>
                          </div>
                        </div>

                        {legToNext ? (
                          <span className="text-[10.5px] font-semibold text-[#d66654] tabular-nums shrink-0">
                            → {legToNext.distanceKm.toLocaleString()} km
                          </span>
                        ) : (
                          <Check className="w-3.5 h-3.5 text-[#458a68] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-[12px] text-[#6c7584] bg-[#fffdf8] border border-dashed border-[#e9dfd1] rounded-xl">
                  No countries stamped as visited yet. Click any country pin to stamp it!
                </div>
              )
            ) : journeyGraph.wishlistNodes.length > 0 ? (
              <div className="divide-y divide-[#f2ece1] max-h-[250px] overflow-y-auto pr-1">
                {journeyGraph.wishlistNodes.map((node) => {
                  const isSelected = selectedCountryName === node.country.name;
                  const bridge = journeyGraph.connections.find(
                    (c) =>
                      c.kind === 'wishlist-route' &&
                      c.to.country.name === node.country.name
                  );
                  return (
                    <button
                      key={node.country.name}
                      type="button"
                      onClick={() => setSelectedCountryName(node.country.name)}
                      className={`w-full flex items-center justify-between gap-2.5 py-2.5 px-2 rounded-lg text-left transition-colors ${
                        isSelected ? 'bg-[#fff9e3]' : 'hover:bg-[#fffdf8]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-[#f5b935] text-white grid place-items-center shrink-0">
                          <MapPin className="w-3 h-3" />
                        </span>
                        <div className="min-w-0">
                          <strong className="block text-[12px] font-bold text-[#27334b] truncate">
                            {node.country.flag} {node.country.name}
                          </strong>
                          <span className="block text-[10.5px] text-[#6c7584]">
                            {node.country.continent}
                            {bridge ? ` · From ${bridge.from.country.name}` : ''}
                          </span>
                        </div>
                      </div>

                      {bridge && (
                        <span className="text-[10.5px] font-semibold text-[#b88212] tabular-nums shrink-0">
                          {bridge.distanceKm.toLocaleString()} km
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-[12px] text-[#6c7584] bg-[#fffdf8] border border-dashed border-[#e9dfd1] rounded-xl">
                No countries on your wishlist yet. Click any country to add it to your wishlist!
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
