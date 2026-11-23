import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  geoGraticule10,
  geoNaturalEarth1,
  geoPath,
  select,
  zoom,
  zoomIdentity,
  type ZoomBehavior,
} from 'd3';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type { Country } from '../types/journal';
import {
  findGeoFeatureForCountry,
  getWorldCountryFeatures,
  type JourneyNode,
  type TravelJourneyGraph,
} from '../lib/worldGeo';

export type MapRouteFilter = 'all' | 'visited' | 'wishlist' | 'pins';

interface D3WorldMapProps {
  countries: Country[];
  journeyGraph: TravelJourneyGraph;
  routeFilter: MapRouteFilter;
  selectedCountryName: string | null;
  onSelectCountryPin: (countryName: string) => void;
}

interface TooltipState {
  node: JourneyNode;
  x: number;
  y: number;
}

const SVG_WIDTH = 980;
const SVG_HEIGHT = 500;

export const D3WorldMap: React.FC<D3WorldMapProps> = ({
  countries,
  journeyGraph,
  routeFilter,
  selectedCountryName,
  onSelectCountryPin,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomLayerRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [hoveredCountryName, setHoveredCountryName] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const worldFeatures = useMemo(() => getWorldCountryFeatures(), []);

  const projection = useMemo(
    () =>
      geoNaturalEarth1()
        .scale(178)
        .translate([SVG_WIDTH / 2 - 10, SVG_HEIGHT / 2 + 18]),
    []
  );

  const pathGenerator = useMemo(() => geoPath(projection), [projection]);
  const graticulePath = useMemo(
    () => pathGenerator(geoGraticule10()) || '',
    [pathGenerator]
  );
  const spherePath = useMemo(
    () => pathGenerator({ type: 'Sphere' }) || '',
    [pathGenerator]
  );

  // Map GeoJSON feature index/id -> user's Country status
  const countryByFeatureId = useMemo(() => {
    const map = new Map<string, Country>();
    for (const c of countries) {
      const feat = findGeoFeatureForCountry(c.name, worldFeatures);
      if (feat) {
        const key = String(feat.id ?? feat.properties?.name ?? c.name);
        map.set(key, c);
      }
    }
    return map;
  }, [countries, worldFeatures]);

  // Attach D3 zoom & pan behavior
  useEffect(() => {
    const svgEl = svgRef.current;
    const layerEl = zoomLayerRef.current;
    if (!svgEl || !layerEl) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 6.5])
      .translateExtent([
        [-60, -40],
        [SVG_WIDTH + 60, SVG_HEIGHT + 40],
      ])
      .on('zoom', (event) => {
        select(layerEl).attr('transform', event.transform.toString());
        setZoomScale(event.transform.k);
      });

    zoomBehaviorRef.current = zoomBehavior;
    const svgSelection = select(svgEl);
    svgSelection.call(zoomBehavior);

    return () => {
      svgSelection.on('.zoom', null);
    };
  }, []);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current)
      .transition()
      .duration(220)
      .call(zoomBehaviorRef.current.scaleBy, 1.45);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current)
      .transition()
      .duration(220)
      .call(zoomBehaviorRef.current.scaleBy, 1 / 1.45);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    select(svgRef.current)
      .transition()
      .duration(280)
      .call(zoomBehaviorRef.current.transform, zoomIdentity);
  };

  // Focus on selected country gently if user clicks from the list
  const focusOnCoords = (coords: [number, number]) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const projected = projection(coords);
    if (!projected) return;
    const k = Math.max(2.1, zoomScale);
    const tx = SVG_WIDTH / 2 - projected[0] * k;
    const ty = SVG_HEIGHT / 2 - projected[1] * k;
    select(svgRef.current)
      .transition()
      .duration(360)
      .call(
        zoomBehaviorRef.current.transform,
        zoomIdentity.translate(tx, ty).scale(k)
      );
  };

  const visibleConnections = useMemo(() => {
    if (routeFilter === 'pins') return [];
    return journeyGraph.connections.filter((conn) => {
      if (routeFilter === 'visited') return conn.kind === 'visited-route';
      if (routeFilter === 'wishlist') return conn.kind === 'wishlist-route';
      return true;
    });
  }, [journeyGraph.connections, routeFilter]);

  const visibleNodes = useMemo(() => {
    if (routeFilter === 'visited') return journeyGraph.visitedNodes;
    if (routeFilter === 'wishlist') return journeyGraph.wishlistNodes;
    return [
      ...journeyGraph.exploreNodes,
      ...journeyGraph.wishlistNodes,
      ...journeyGraph.visitedNodes,
    ];
  }, [journeyGraph, routeFilter]);

  const activeHighlightCountry = hoveredCountryName || selectedCountryName;

  const pinScaleInv = 1 / Math.pow(zoomScale, 0.55);

  return (
    <div className="relative bg-[#eaf4f8] border border-[#dcecf2] rounded-[16px] overflow-hidden">
      {/* Zoom & Pan Controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Zoom in map"
          title="Zoom in"
          className="w-8 h-8 rounded-lg bg-white/95 border border-[#e3ddd2] text-[#27334b] hover:border-[#ff826e] grid place-items-center shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Zoom out map"
          title="Zoom out"
          className="w-8 h-8 rounded-lg bg-white/95 border border-[#e3ddd2] text-[#27334b] hover:border-[#ff826e] grid place-items-center shadow-sm transition-colors"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          aria-label="Reset map view"
          title="Reset view"
          className="w-8 h-8 rounded-lg bg-white/95 border border-[#e3ddd2] text-[#27334b] hover:border-[#ff826e] grid place-items-center shadow-sm transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="w-full h-[360px] sm:h-[460px] lg:h-[510px] block cursor-grab active:cursor-grabbing select-none"
        role="img"
        aria-label="D3 interactive world map of visited and wishlist countries"
      >
        <defs>
          <marker
            id="arrow-visited"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#e86a56" />
          </marker>
          <marker
            id="arrow-wishlist"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#d99b1e" />
          </marker>
        </defs>

        <g ref={zoomLayerRef}>
          {/* Ocean Sphere */}
          <path
            d={spherePath}
            fill="#e4f2f7"
            stroke="#c9dfe8"
            strokeWidth={1.2 / zoomScale}
          />

          {/* Graticule Grid */}
          <path
            d={graticulePath}
            fill="none"
            stroke="#d4e6ee"
            strokeWidth={0.65 / zoomScale}
            strokeDasharray="2 3"
          />

          {/* Country Polygons */}
          <g>
            {worldFeatures.map((feat, idx) => {
              const featKey = String(feat.id ?? feat.properties?.name ?? idx);
              const matched = countryByFeatureId.get(featKey);
              const isSelected =
                matched && selectedCountryName === matched.name;
              const isHovered =
                matched && hoveredCountryName === matched.name;

              let fill = '#f4f1ea';
              if (matched?.flagged === 'visited') {
                fill = isHovered || isSelected ? '#65bb94' : '#8dd1b1';
              } else if (matched?.flagged === 'wishlist') {
                fill = isHovered || isSelected ? '#f6ca52' : '#fce08b';
              } else if (matched) {
                fill = isHovered || isSelected ? '#cbd5e1' : '#e2e8f0';
              }

              const d = pathGenerator(feat) || '';
              return (
                <path
                  key={featKey}
                  d={d}
                  fill={fill}
                  stroke={isSelected ? '#27334b' : '#ffffff'}
                  strokeWidth={(isSelected ? 1.4 : 0.7) / zoomScale}
                  className={matched ? 'cursor-pointer transition-colors duration-150' : ''}
                  onClick={() => {
                    if (matched) {
                      onSelectCountryPin(matched.name);
                    }
                  }}
                />
              );
            })}
          </g>

          {/* Great-Circle Route Connections */}
          <g fill="none" strokeLinecap="round">
            {visibleConnections.map((conn) => {
              const lineFeature: GeoJSON.Feature<GeoJSON.LineString> = {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: [conn.from.coords, conn.to.coords],
                },
              };
              const d = pathGenerator(lineFeature) || '';
              if (!d) return null;

              const isConnectedToActive =
                activeHighlightCountry &&
                (conn.from.country.name === activeHighlightCountry ||
                  conn.to.country.name === activeHighlightCountry);

              const isDimmed =
                Boolean(activeHighlightCountry) && !isConnectedToActive;

              const isVisitedRoute = conn.kind === 'visited-route';

              return (
                <path
                  key={conn.id}
                  d={d}
                  stroke={isVisitedRoute ? '#e86a56' : '#d99b1e'}
                  strokeWidth={
                    (isConnectedToActive ? 2.8 : isVisitedRoute ? 2.1 : 1.7) *
                    pinScaleInv
                  }
                  strokeDasharray={
                    isVisitedRoute
                      ? undefined
                      : `${5 * pinScaleInv} ${5 * pinScaleInv}`
                  }
                  opacity={isDimmed ? 0.22 : isConnectedToActive ? 0.98 : 0.78}
                  markerEnd={
                    isVisitedRoute
                      ? 'url(#arrow-visited)'
                      : 'url(#arrow-wishlist)'
                  }
                  style={{ transition: 'opacity 150ms ease' }}
                />
              );
            })}
          </g>

          {/* Country Pins */}
          <g>
            {visibleNodes.map((node) => {
              const projected = projection(node.coords);
              if (!projected) return null;
              const [cx, cy] = projected;

              const isVisited = node.country.flagged === 'visited';
              const isWishlist = node.country.flagged === 'wishlist';
              const isSelected = selectedCountryName === node.country.name;
              const isHovered = hoveredCountryName === node.country.name;

              const baseR = isVisited ? 7.5 : isWishlist ? 6.5 : 4.5;
              const radius = (isSelected || isHovered ? baseR + 2.2 : baseR) * pinScaleInv;
              const showLabel =
                isSelected ||
                isHovered ||
                ((isVisited || isWishlist) && zoomScale >= 1.35);

              return (
                <g
                  key={node.country.name}
                  transform={`translate(${cx}, ${cy})`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectCountryPin(node.country.name);
                    focusOnCoords(node.coords);
                  }}
                  onMouseEnter={(e) => {
                    setHoveredCountryName(node.country.name);
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        node,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      });
                    }
                  }}
                  onMouseMove={(e) => {
                    const rect = svgRef.current?.getBoundingClientRect();
                    if (rect) {
                      setTooltip({
                        node,
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    setHoveredCountryName(null);
                    setTooltip(null);
                  }}
                >
                  {/* Selection / Active Halo */}
                  {(isSelected || isHovered) && (
                    <circle
                      r={radius + 4 * pinScaleInv}
                      fill={
                        isVisited
                          ? 'rgba(255, 130, 110, 0.28)'
                          : isWishlist
                            ? 'rgba(245, 185, 53, 0.30)'
                            : 'rgba(123, 143, 161, 0.25)'
                      }
                    />
                  )}

                  {/* Main Pin Marker */}
                  {isWishlist ? (
                    // Distinct diamond marker for Wishlist so status isn't signaled by color alone
                    <rect
                      x={-radius * 0.9}
                      y={-radius * 0.9}
                      width={radius * 1.8}
                      height={radius * 1.8}
                      rx={2 * pinScaleInv}
                      transform="rotate(45)"
                      fill="#f5b935"
                      stroke="#ffffff"
                      strokeWidth={2 * pinScaleInv}
                    />
                  ) : (
                    <circle
                      r={radius}
                      fill={isVisited ? '#ff826e' : '#7b8fa1'}
                      stroke="#ffffff"
                      strokeWidth={2 * pinScaleInv}
                    />
                  )}

                  {/* Order Number inside Visited Pin */}
                  {isVisited && (
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#ffffff"
                      fontSize={8 * pinScaleInv}
                      fontWeight={800}
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.orderIndex}
                    </text>
                  )}

                  {/* Label */}
                  {showLabel && (
                    <g transform={`translate(0, ${-radius - 6 * pinScaleInv})`}>
                      <text
                        textAnchor="middle"
                        fill="#27334b"
                        stroke="#ffffff"
                        strokeWidth={3 * pinScaleInv}
                        paintOrder="stroke"
                        fontSize={10.5 * pinScaleInv}
                        fontWeight={800}
                        style={{ pointerEvents: 'none' }}
                      >
                        {node.country.name}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Hover Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 bg-[#27334b] text-white rounded-xl px-3 py-2 text-[11px] shadow-[0_10px_24px_rgba(24,34,53,0.28)] max-w-[230px]"
          style={{
            left: Math.min(tooltip.x + 14, 700),
            top: Math.max(12, tooltip.y - 54),
          }}
        >
          <div className="font-[800] text-[12px] flex items-center gap-1.5">
            <span>{tooltip.node.country.flag}</span>
            <span className="truncate">{tooltip.node.country.name}</span>
          </div>
          <div className="text-white/80 mt-0.5 tabular-nums">
            {tooltip.node.country.flagged === 'visited'
              ? `Visited stop #${tooltip.node.orderIndex}`
              : tooltip.node.country.flagged === 'wishlist'
                ? 'On wishlist'
                : 'In explorer'}
            {tooltip.node.tripCount > 0 && ` · ${tooltip.node.tripCount} trip`}
            {tooltip.node.memoryCount > 0 && ` · ${tooltip.node.memoryCount} memories`}
          </div>
        </div>
      )}

      {/* Map Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#fffdf8] border-t border-[#e6efe9] text-[11px] text-[#4b5b63]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#27334b]">
            <span className="w-3 h-3 rounded-full bg-[#ff826e] border border-white shadow-xs inline-block" />
            Visited pin &amp; path
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#27334b]">
            <span className="w-2.5 h-2.5 rotate-45 bg-[#f5b935] border border-white shadow-xs inline-block" />
            Wishlist pin &amp; route
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#5a6578]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7b8fa1] inline-block" />
            Saved guide
          </span>
        </div>

        <span className="text-[11px] text-[#6c7584]">
          Drag to pan · Scroll or use + / − to zoom · Click any pin to inspect
        </span>
      </div>
    </div>
  );
};
