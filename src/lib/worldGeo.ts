import { geoCentroid, geoDistance } from 'd3';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import worldAtlas from 'world-atlas/countries-110m.json';
import type { ContinentName, Country, JournalEntry, Trip } from '../types/journal';

export interface WorldCountryProperties {
  name?: string;
}

export type WorldCountryFeature = Feature<Geometry, WorldCountryProperties>;

const NAME_ALIASES: Record<string, string[]> = {
  'united states': ['united states of america', 'usa', 'us'],
  'united kingdom': ['united kingdom', 'great britain', 'uk'],
  'south korea': ['south korea', 'republic of korea', 'korea, south'],
  'north korea': ['north korea', 'dem. rep. korea'],
  czechia: ['czechia', 'czech republic'],
  'dominican republic': ['dominican rep.', 'dominican republic'],
  'bosnia and herzegovina': ['bosnia and herz.', 'bosnia and herzegovina'],
  'central african republic': ['central african rep.'],
  'democratic republic of the congo': ['dem. rep. congo'],
  'republic of the congo': ['congo'],
  'ivory coast': ["côte d'ivoire", 'cote divoire'],
  eswatini: ['eswatini', 'swaziland'],
  'north macedonia': ['north macedonia', 'macedonia'],
  russia: ['russia', 'russian federation'],
  vietnam: ['vietnam', 'viet nam'],
  laos: ['laos', 'lao pdr'],
  syria: ['syria', 'syrian arab republic'],
  iran: ['iran', 'iran (islamic republic of)'],
  venezuela: ['venezuela', 'venezuela (bolivarian republic of)'],
  bolivia: ['bolivia', 'bolivia (plurinational state of)'],
  tanzania: ['tanzania', 'united republic of tanzania'],
  taiwan: ['taiwan', 'taiwan, province of china'],
  brunei: ['brunei', 'brunei darussalam'],
  moldova: ['moldova', 'republic of moldova'],
};

// Curated [longitude, latitude] coordinates (capital/central anchor) for crisp pin placement
const COUNTRY_ANCHOR_COORDS: Record<string, [number, number]> = {
  japan: [139.6917, 35.6895],
  philippines: [120.9842, 14.5995],
  'south korea': [126.978, 37.5665],
  italy: [12.4964, 41.9028],
  france: [2.3522, 48.8566],
  'united states': [-98.5795, 39.8283],
  canada: [-106.3468, 56.1304],
  brazil: [-47.9292, -15.7801],
  'south africa': [18.4241, -33.9249],
  australia: [151.2093, -33.8688],
  'new zealand': [174.7762, -41.2865],
  thailand: [100.5018, 13.7563],
  'united kingdom': [-0.1276, 51.5072],
  spain: [-3.7038, 40.4168],
  portugal: [-9.1393, 38.7223],
  germany: [13.405, 52.52],
  switzerland: [7.4474, 46.948],
  greece: [23.7275, 37.9838],
  iceland: [-21.9426, 64.1466],
  norway: [10.7522, 59.9139],
  sweden: [18.0686, 59.3293],
  netherlands: [4.9041, 52.3676],
  austria: [16.3738, 48.2082],
  indonesia: [115.1889, -8.4095],
  vietnam: [105.8342, 21.0278],
  singapore: [103.8198, 1.3521],
  malaysia: [101.6869, 3.139],
  india: [77.209, 28.6139],
  china: [116.4074, 39.9042],
  taiwan: [121.5654, 25.033],
  mexico: [-99.1332, 19.4326],
  peru: [-77.0428, -12.0464],
  argentina: [-58.3816, -34.6037],
  chile: [-70.6693, -33.4489],
  colombia: [-74.0721, 4.711],
  morocco: [-7.9811, 31.6295],
  egypt: [31.2357, 30.0444],
  kenya: [36.8219, -1.2921],
  turkey: [28.9784, 41.0082],
  'united arab emirates': [55.2708, 25.2048],
};

const CONTINENT_FALLBACK_COORDS: Record<ContinentName, [number, number]> = {
  Asia: [100.0, 34.0],
  Europe: [12.0, 49.0],
  'North America': [-100.0, 42.0],
  'South America': [-60.0, -15.0],
  Africa: [20.0, 5.0],
  Oceania: [140.0, -25.0],
  Antarctica: [0.0, -78.0],
};

let cachedFeatures: WorldCountryFeature[] | null = null;

export function getWorldCountryFeatures(): WorldCountryFeature[] {
  if (cachedFeatures) return cachedFeatures;
  const topology = worldAtlas as unknown as Topology<{
    countries: GeometryCollection<WorldCountryProperties>;
  }>;
  const geo = feature(topology, topology.objects.countries) as unknown as FeatureCollection<
    Geometry,
    WorldCountryProperties
  >;
  // Exclude Antarctica polygon if desired or keep subtle; keeping all standard features except Antarctica helps framing NaturalEarth1 cleanly
  cachedFeatures = geo.features.filter(
    (f) => (f.properties?.name || '').toLowerCase() !== 'antarctica'
  );
  return cachedFeatures;
}

export function normalizeCountryKey(name: string): string {
  return name.trim().toLowerCase();
}

export function findGeoFeatureForCountry(
  countryName: string,
  features: WorldCountryFeature[]
): WorldCountryFeature | undefined {
  const key = normalizeCountryKey(countryName);
  const aliases = NAME_ALIASES[key] || [key];

  return features.find((f) => {
    const fname = normalizeCountryKey(f.properties?.name || '');
    if (!fname) return false;
    if (fname === key || aliases.includes(fname)) return true;
    return false;
  });
}

export function getCountryLonLat(
  country: Country,
  features: WorldCountryFeature[]
): [number, number] {
  const key = normalizeCountryKey(country.name);
  if (COUNTRY_ANCHOR_COORDS[key]) {
    return COUNTRY_ANCHOR_COORDS[key];
  }

  const matched = findGeoFeatureForCountry(country.name, features);
  if (matched) {
    const centroid = geoCentroid(matched);
    if (
      Array.isArray(centroid) &&
      Number.isFinite(centroid[0]) &&
      Number.isFinite(centroid[1])
    ) {
      return [centroid[0], centroid[1]];
    }
  }

  return CONTINENT_FALLBACK_COORDS[country.continent] || [0, 20];
}

export interface JourneyNode {
  country: Country;
  coords: [number, number];
  orderIndex: number;
  earliestDate?: string;
  memoryCount: number;
  tripCount: number;
}

export interface JourneyConnection {
  id: string;
  from: JourneyNode;
  to: JourneyNode;
  kind: 'visited-route' | 'wishlist-route';
  distanceKm: number;
}

export interface TravelJourneyGraph {
  visitedNodes: JourneyNode[];
  wishlistNodes: JourneyNode[];
  exploreNodes: JourneyNode[];
  connections: JourneyConnection[];
  totalVisitedDistanceKm: number;
  totalWishlistDistanceKm: number;
}

export function computeGreatCircleKm(a: [number, number], b: [number, number]): number {
  const radians = geoDistance(a, b);
  return Math.round(radians * 6371);
}

export function buildTravelJourneyGraph(
  countries: Country[],
  trips: Trip[],
  journals: JournalEntry[]
): TravelJourneyGraph {
  const features = getWorldCountryFeatures();

  const statsByCountry = new Map<
    string,
    { earliestDate?: string; memoryCount: number; tripCount: number }
  >();

  for (const j of journals) {
    const key = normalizeCountryKey(j.country);
    const curr = statsByCountry.get(key) || { memoryCount: 0, tripCount: 0 };
    curr.memoryCount += 1;
    if (j.date && (!curr.earliestDate || j.date < curr.earliestDate)) {
      curr.earliestDate = j.date;
    }
    statsByCountry.set(key, curr);
  }

  for (const t of trips) {
    const key = normalizeCountryKey(t.country);
    const curr = statsByCountry.get(key) || { memoryCount: 0, tripCount: 0 };
    curr.tripCount += 1;
    if (t.date && (!curr.earliestDate || t.date < curr.earliestDate)) {
      curr.earliestDate = t.date;
    }
    statsByCountry.set(key, curr);
  }

  const visitedRaw = countries.filter((c) => c.flagged === 'visited');
  const wishlistRaw = countries.filter((c) => c.flagged === 'wishlist');
  const exploreRaw = countries.filter((c) => c.flagged === 'none');

  // Sort visited countries chronologically by earliest memory/trip date when available
  visitedRaw.sort((a, b) => {
    const dateA = statsByCountry.get(normalizeCountryKey(a.name))?.earliestDate || '9999-99-99';
    const dateB = statsByCountry.get(normalizeCountryKey(b.name))?.earliestDate || '9999-99-99';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return a.name.localeCompare(b.name);
  });

  // Sort wishlist countries by whether a trip is already planned there, then longitude west-to-east for clean visual arc flow
  wishlistRaw.sort((a, b) => {
    const tripA = statsByCountry.get(normalizeCountryKey(a.name))?.tripCount || 0;
    const tripB = statsByCountry.get(normalizeCountryKey(b.name))?.tripCount || 0;
    if (tripA !== tripB) return tripB - tripA;
    const lonA = getCountryLonLat(a, features)[0];
    const lonB = getCountryLonLat(b, features)[0];
    return lonA - lonB;
  });

  const visitedNodes: JourneyNode[] = visitedRaw.map((c, idx) => {
    const stats = statsByCountry.get(normalizeCountryKey(c.name));
    return {
      country: c,
      coords: getCountryLonLat(c, features),
      orderIndex: idx + 1,
      earliestDate: stats?.earliestDate,
      memoryCount: stats?.memoryCount || 0,
      tripCount: stats?.tripCount || 0,
    };
  });

  const wishlistNodes: JourneyNode[] = wishlistRaw.map((c, idx) => {
    const stats = statsByCountry.get(normalizeCountryKey(c.name));
    return {
      country: c,
      coords: getCountryLonLat(c, features),
      orderIndex: idx + 1,
      earliestDate: stats?.earliestDate,
      memoryCount: stats?.memoryCount || 0,
      tripCount: stats?.tripCount || 0,
    };
  });

  const exploreNodes: JourneyNode[] = exploreRaw.map((c, idx) => {
    const stats = statsByCountry.get(normalizeCountryKey(c.name));
    return {
      country: c,
      coords: getCountryLonLat(c, features),
      orderIndex: idx + 1,
      earliestDate: stats?.earliestDate,
      memoryCount: stats?.memoryCount || 0,
      tripCount: stats?.tripCount || 0,
    };
  });

  const connections: JourneyConnection[] = [];
  let totalVisitedDistanceKm = 0;
  let totalWishlistDistanceKm = 0;

  // Connect Visited countries sequentially as the completed travel route
  for (let i = 0; i < visitedNodes.length - 1; i += 1) {
    const from = visitedNodes[i];
    const to = visitedNodes[i + 1];
    const distanceKm = computeGreatCircleKm(from.coords, to.coords);
    totalVisitedDistanceKm += distanceKm;
    connections.push({
      id: `visited-${from.country.name}-${to.country.name}`,
      from,
      to,
      kind: 'visited-route',
      distanceKm,
    });
  }

  // Connect Wishlist countries: link from the nearest visited anchor (if any) to the first wishlist stop, or chain wishlist pins cleanly
  if (wishlistNodes.length > 0) {
    if (visitedNodes.length > 0) {
      // Connect each wishlist node from its nearest visited node so the bridge between visited & wishlist is crystal clear
      for (const wishNode of wishlistNodes) {
        let nearestVisited = visitedNodes[0];
        let minDist = computeGreatCircleKm(nearestVisited.coords, wishNode.coords);
        for (let i = 1; i < visitedNodes.length; i += 1) {
          const d = computeGreatCircleKm(visitedNodes[i].coords, wishNode.coords);
          if (d < minDist) {
            minDist = d;
            nearestVisited = visitedNodes[i];
          }
        }
        totalWishlistDistanceKm += minDist;
        connections.push({
          id: `wish-${nearestVisited.country.name}-${wishNode.country.name}`,
          from: nearestVisited,
          to: wishNode,
          kind: 'wishlist-route',
          distanceKm: minDist,
        });
      }
    } else if (wishlistNodes.length > 1) {
      for (let i = 0; i < wishlistNodes.length - 1; i += 1) {
        const from = wishlistNodes[i];
        const to = wishlistNodes[i + 1];
        const distanceKm = computeGreatCircleKm(from.coords, to.coords);
        totalWishlistDistanceKm += distanceKm;
        connections.push({
          id: `wish-${from.country.name}-${to.country.name}`,
          from,
          to,
          kind: 'wishlist-route',
          distanceKm,
        });
      }
    }
  }

  return {
    visitedNodes,
    wishlistNodes,
    exploreNodes,
    connections,
    totalVisitedDistanceKm,
    totalWishlistDistanceKm,
  };
}
