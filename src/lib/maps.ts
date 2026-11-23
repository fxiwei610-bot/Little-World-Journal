import type {
  AiRouteAssistantResponse,
  ComputedGoogleRoute,
  NearbyTransitStation,
  PlaceStopType,
  ResolvedStopLocation,
  RouteStepDetail,
  RouteTravelModeKey,
  TripActivity,
} from '../types/journal';

export function dispatchMapsQuotaExceeded(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

function isQuotaError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err || '');
  return (
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.includes('OVER_QUERY_LIMIT') ||
    raw.includes('OverQuotaMapError') ||
    raw.includes('QuotaExceededError') ||
    /\b429\b/.test(raw)
  );
}

const COUNTRY_REGION_MAP: Record<string, string> = {
  japan: 'jp',
  philippines: 'ph',
  thailand: 'th',
  vietnam: 'vn',
  singapore: 'sg',
  malaysia: 'my',
  indonesia: 'id',
  'south korea': 'kr',
  korea: 'kr',
  taiwan: 'tw',
  china: 'cn',
  india: 'in',
  australia: 'au',
  'new zealand': 'nz',
  france: 'fr',
  italy: 'it',
  spain: 'es',
  portugal: 'pt',
  germany: 'de',
  switzerland: 'ch',
  netherlands: 'nl',
  belgium: 'be',
  austria: 'at',
  greece: 'gr',
  turkey: 'tr',
  'united kingdom': 'gb',
  uk: 'gb',
  england: 'gb',
  ireland: 'ie',
  iceland: 'is',
  norway: 'no',
  sweden: 'se',
  denmark: 'dk',
  finland: 'fi',
  'united states': 'us',
  usa: 'us',
  canada: 'ca',
  mexico: 'mx',
  brazil: 'br',
  argentina: 'ar',
  peru: 'pe',
  chile: 'cl',
  colombia: 'co',
  morocco: 'ma',
  egypt: 'eg',
  'south africa': 'za',
  kenya: 'ke',
  uae: 'ae',
  'united arab emirates': 'ae',
};

export function getCountryRegionCode(countryName?: string): string {
  if (!countryName) return 'us';
  const normalized = countryName.trim().toLowerCase();
  return COUNTRY_REGION_MAP[normalized] || 'us';
}

export function inferPlaceStopType(activity: {
  placeType?: PlaceStopType;
  category?: string;
  title?: string;
}): PlaceStopType {
  if (activity.placeType) return activity.placeType;
  const cat = (activity.category || '').toLowerCase();
  const title = (activity.title || '').toLowerCase();
  if (
    title.includes('hotel') ||
    title.includes('check-in') ||
    title.includes('check in') ||
    title.includes('hostel') ||
    title.includes('ryokan') ||
    title.includes('resort') ||
    title.includes('airbnb')
  ) {
    return 'accommodation';
  }
  if (
    cat.includes('food') ||
    title.includes('lunch') ||
    title.includes('dinner') ||
    title.includes('breakfast') ||
    title.includes('cafe') ||
    title.includes('coffee') ||
    title.includes('restaurant') ||
    title.includes('ramen') ||
    title.includes('market')
  ) {
    return 'restaurant';
  }
  if (
    cat.includes('transit') ||
    title.includes('airport') ||
    title.includes('station') ||
    title.includes('terminal') ||
    title.includes('ferry') ||
    title.includes('train') ||
    title.includes('bus') ||
    title.includes('transfer')
  ) {
    return 'terminal';
  }
  if (
    cat.includes('sight') ||
    cat.includes('culture') ||
    cat.includes('nature') ||
    cat.includes('activity')
  ) {
    return 'attraction';
  }
  return 'stop';
}

export function formatStopTypeLabel(stopType: PlaceStopType): string {
  switch (stopType) {
    case 'accommodation':
      return 'Stay / Hotel';
    case 'restaurant':
      return 'Dining / Cafe';
    case 'terminal':
      return 'Transit Terminal';
    case 'attraction':
      return 'Attraction';
    case 'destination':
      return 'Destination';
    default:
      return 'Itinerary Stop';
  }
}

export function decodeEncodedPolyline(
  encoded: string
): Array<{ lat: number; lng: number }> {
  if (!encoded) return [];
  const poly: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && index < len);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return poly;
}

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2 * s2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export function formatDistanceLabel(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatDurationSecondsLabel(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '1 min';
  const mins = Math.max(1, Math.round(sec / 60));
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0
    ? `${hrs} hr ${rem} min${rem === 1 ? '' : 's'}`
    : `${hrs} hr${hrs === 1 ? '' : 's'}`;
}

export function buildGoogleMapsNavUrl(params: {
  origin?: string;
  originCoords?: { lat: number; lng: number };
  destination: string;
  destinationCoords?: { lat: number; lng: number };
  destinationPlaceId?: string;
  travelMode?: RouteTravelModeKey;
}): string {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');

  if (params.originCoords) {
    url.searchParams.set(
      'origin',
      `${params.originCoords.lat},${params.originCoords.lng}`
    );
  } else if (params.origin?.trim()) {
    url.searchParams.set('origin', params.origin.trim());
  }

  if (params.destinationCoords) {
    url.searchParams.set(
      'destination',
      `${params.destinationCoords.lat},${params.destinationCoords.lng}`
    );
  } else {
    url.searchParams.set('destination', params.destination.trim());
  }

  if (params.destinationPlaceId?.trim()) {
    url.searchParams.set('destination_place_id', params.destinationPlaceId.trim());
  }

  const modeMap: Record<RouteTravelModeKey, string> = {
    TRANSIT: 'transit',
    DRIVE: 'driving',
    WALK: 'walking',
  };
  url.searchParams.set('travelmode', modeMap[params.travelMode || 'TRANSIT']);
  return url.toString();
}

export async function fetchMapsConfig(): Promise<{
  configured: boolean;
  apiKey: string;
}> {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (envKey) {
    return { configured: true, apiKey: envKey };
  }
  const resp = await fetch('/api/maps/config');
  if (!resp.ok) {
    return { configured: false, apiKey: '' };
  }
  const data = (await resp.json().catch(() => ({}))) as {
    configured?: boolean;
    apiKey?: string;
  };
  const key = String(data.apiKey || '').trim();
  return { configured: Boolean(key), apiKey: key };
}

function mapClientNearbyType(types: string[] = []): {
  type: NearbyTransitStation['type'];
  label: string;
} {
  if (types.includes('subway_station')) {
    return { type: 'subway_station', label: 'Subway / Metro' };
  }
  if (types.includes('train_station') || types.includes('light_rail_station')) {
    return { type: 'train_station', label: 'Train Station' };
  }
  if (types.includes('ferry_terminal')) {
    return { type: 'ferry_terminal', label: 'Ferry Terminal' };
  }
  if (types.includes('bus_station') || types.includes('bus_stop')) {
    return { type: 'bus_station', label: 'Bus Station' };
  }
  return { type: 'transit_station', label: 'Transit Hub' };
}

async function resolveStopsViaClientSdk(params: {
  country: string;
  regionCode: string;
  stops: TripActivity[];
}): Promise<ResolvedStopLocation[]> {
  if (typeof google === 'undefined' || !google.maps?.importLibrary) {
    return [];
  }

  const { Place, SearchNearbyRankPreference } = (await google.maps.importLibrary(
    'places'
  )) as google.maps.PlacesLibrary;

  const resolved: ResolvedStopLocation[] = [];

  for (const stop of params.stops.slice(0, 12)) {
    const query = [stop.title, stop.location, params.country]
      .filter(Boolean)
      .join(', ');
    if (!query) continue;

    try {
      const { places } = await Place.searchByText({
        textQuery: query,
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'types',
          'googleMapsURI',
        ],
        maxResultCount: 1,
        language: 'en-US',
        region: params.regionCode,
      });

      const match = places?.[0];
      if (!match?.location || !match.id) continue;

      const lat =
        typeof match.location.lat === 'function'
          ? match.location.lat()
          : (match.location as unknown as { lat: number }).lat;
      const lng =
        typeof match.location.lng === 'function'
          ? match.location.lng()
          : (match.location as unknown as { lng: number }).lng;

      let nearbyStations: NearbyTransitStation[] = [];
      try {
        const nearbyRes = await Place.searchNearby({
          fields: ['id', 'displayName', 'formattedAddress', 'location', 'types'],
          locationRestriction: {
            center: { lat, lng },
            radius: 1400,
          },
          includedTypes: [
            'transit_station',
            'subway_station',
            'train_station',
            'bus_station',
            'ferry_terminal',
          ],
          maxResultCount: 4,
          rankPreference: SearchNearbyRankPreference.DISTANCE,
          language: 'en-US',
          region: params.regionCode,
        });
        nearbyStations = (nearbyRes.places || [])
          .filter((np) => Boolean(np.location && np.id))
          .map((np) => {
            const npLat =
              typeof np.location!.lat === 'function'
                ? np.location!.lat()
                : (np.location as unknown as { lat: number }).lat;
            const npLng =
              typeof np.location!.lng === 'function'
                ? np.location!.lng()
                : (np.location as unknown as { lng: number }).lng;
            const mapped = mapClientNearbyType(np.types || []);
            return {
              placeId: np.id,
              name: np.displayName || 'Transit Station',
              type: mapped.type,
              label: mapped.label,
              formattedAddress: np.formattedAddress || '',
              location: { lat: npLat, lng: npLng },
              distanceMeters: haversineMeters({ lat, lng }, { lat: npLat, lng: npLng }),
            };
          });
      } catch (nearbyErr) {
        if (isQuotaError(nearbyErr)) dispatchMapsQuotaExceeded();
      }

      resolved.push({
        activityId: stop.id,
        query,
        placeId: match.id,
        displayName: match.displayName || stop.title,
        formattedAddress: match.formattedAddress || stop.location || params.country,
        location: { lat, lng },
        stopType: inferPlaceStopType({
          placeType: stop.placeType,
          category: stop.category,
          title: stop.title,
        }),
        googleMapsUri: match.googleMapsURI || undefined,
        nearbyStations,
      });
    } catch (err) {
      if (isQuotaError(err)) {
        dispatchMapsQuotaExceeded();
        break;
      }
    }
  }

  return resolved;
}

export async function resolveDayStopsWithGoogle(params: {
  country: string;
  stops: TripActivity[];
  signal?: AbortSignal;
}): Promise<ResolvedStopLocation[]> {
  if (params.stops.length === 0) return [];
  const regionCode = getCountryRegionCode(params.country);

  const resp = await fetch('/api/maps/resolve-stops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      country: params.country,
      regionCode,
      stops: params.stops.map((s) => ({
        id: s.id,
        title: s.title,
        location: s.location,
        category: s.category,
        placeType: s.placeType,
        placeId: s.placeId,
      })),
    }),
    signal: params.signal,
  });

  const data = (await resp.json().catch(() => ({}))) as {
    resolved?: ResolvedStopLocation[];
    fallbackToClientSdk?: boolean;
    quotaExceeded?: boolean;
    error?: string;
  };

  if (resp.status === 429 || data.quotaExceeded) {
    dispatchMapsQuotaExceeded();
    throw new Error(data.error || 'Google Maps Platform quota reached.');
  }

  if (data.fallbackToClientSdk) {
    return resolveStopsViaClientSdk({
      country: params.country,
      regionCode,
      stops: params.stops,
    });
  }

  if (!resp.ok) {
    throw new Error(data.error || 'Unable to locate itinerary stops on Google Maps.');
  }

  return Array.isArray(data.resolved) ? data.resolved : [];
}

async function resolveTextLocationClientSdk(
  query: string,
  regionCode: string
): Promise<{ lat: number; lng: number } | null> {
  if (typeof google === 'undefined' || !google.maps?.importLibrary) return null;
  const { Place } = (await google.maps.importLibrary(
    'places'
  )) as google.maps.PlacesLibrary;
  const { places } = await Place.searchByText({
    textQuery: query,
    fields: ['location'],
    maxResultCount: 1,
    region: regionCode,
  });
  const loc = places?.[0]?.location;
  if (!loc) return null;
  return {
    lat: typeof loc.lat === 'function' ? loc.lat() : (loc as unknown as { lat: number }).lat,
    lng: typeof loc.lng === 'function' ? loc.lng() : (loc as unknown as { lng: number }).lng,
  };
}

async function computeRoutesViaClientSdk(params: {
  originQuery?: string;
  originLocation?: { lat: number; lng: number };
  destinationQuery?: string;
  destinationLocation?: { lat: number; lng: number };
  country: string;
  travelModes: RouteTravelModeKey[];
}): Promise<Partial<Record<RouteTravelModeKey, ComputedGoogleRoute | null>>> {
  if (typeof google === 'undefined' || !google.maps?.importLibrary) {
    return {};
  }
  const regionCode = getCountryRegionCode(params.country);
  const origin =
    params.originLocation ||
    (params.originQuery
      ? await resolveTextLocationClientSdk(params.originQuery, regionCode)
      : null);
  const destination =
    params.destinationLocation ||
    (params.destinationQuery
      ? await resolveTextLocationClientSdk(params.destinationQuery, regionCode)
      : null);

  if (!origin || !destination) return {};

  const routesLib = (await google.maps.importLibrary(
    'routes'
  )) as google.maps.RoutesLibrary;
  const out: Partial<Record<RouteTravelModeKey, ComputedGoogleRoute | null>> = {};

  for (const mode of params.travelModes) {
    try {
      const sdkMode =
        mode === 'TRANSIT'
          ? routesLib.TravelMode.TRANSIT
          : mode === 'WALK'
            ? routesLib.TravelMode.WALKING
            : routesLib.TravelMode.DRIVING;

      const req: google.maps.routes.ComputeRoutesRequest = {
        origin,
        destination,
        travelMode: sdkMode,
        fields: ['durationMillis', 'distanceMeters', 'path', 'legs'],
      };

      const { routes } = await routesLib.Route.computeRoutes(req);
      const r = routes?.[0] as unknown as {
        durationMillis?: number;
        distanceMeters?: number;
        polyline?: { encodedPolyline?: string };
        legs?: Array<{
          steps?: Array<{
            travelMode?: string;
            distanceMeters?: number;
            durationMillis?: number;
            instructions?: string;
          }>;
        }>;
      };
      if (!r) {
        out[mode] = null;
        continue;
      }
      const durationSeconds = Math.round((Number(r.durationMillis) || 0) / 1000);
      const distanceMeters = Number(r.distanceMeters) || 0;
      const steps: RouteStepDetail[] = (r.legs?.[0]?.steps || []).map((s, idx) => ({
        stepNumber: idx + 1,
        travelMode: String(s.travelMode || mode),
        instruction: s.instructions || 'Follow route',
        distanceText: formatDistanceLabel(Number(s.distanceMeters) || 0),
        durationText: formatDurationSecondsLabel(
          Math.round((Number(s.durationMillis) || 0) / 1000)
        ),
      }));

      out[mode] = {
        mode,
        durationText: formatDurationSecondsLabel(durationSeconds),
        durationSeconds,
        distanceText: formatDistanceLabel(distanceMeters),
        distanceMeters,
        encodedPolyline: r.polyline?.encodedPolyline,
        steps,
        ...(mode === 'WALK'
          ? {
              warning:
                'Walking routes are in beta and might sometimes be missing clear sidewalks or pedestrian paths.',
            }
          : {}),
      };
    } catch (err) {
      if (isQuotaError(err)) {
        dispatchMapsQuotaExceeded();
        break;
      }
      out[mode] = null;
    }
  }

  return out;
}

export async function computeRoutesWithGoogle(params: {
  country: string;
  originQuery?: string;
  originLocation?: { lat: number; lng: number };
  destinationQuery?: string;
  destinationLocation?: { lat: number; lng: number };
  travelModes?: RouteTravelModeKey[];
  signal?: AbortSignal;
}): Promise<Partial<Record<RouteTravelModeKey, ComputedGoogleRoute | null>>> {
  const travelModes: RouteTravelModeKey[] =
    params.travelModes && params.travelModes.length > 0
      ? params.travelModes
      : ['TRANSIT', 'DRIVE', 'WALK'];

  const resp = await fetch('/api/maps/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      originQuery: params.originQuery,
      originLocation: params.originLocation,
      destinationQuery: params.destinationQuery,
      destinationLocation: params.destinationLocation,
      travelModes,
    }),
    signal: params.signal,
  });

  const data = (await resp.json().catch(() => ({}))) as {
    routes?: Partial<Record<RouteTravelModeKey, ComputedGoogleRoute | null>>;
    fallbackToClientSdk?: boolean;
    quotaExceeded?: boolean;
    error?: string;
  };

  if (resp.status === 429 || data.quotaExceeded) {
    dispatchMapsQuotaExceeded();
    throw new Error(data.error || 'Google Maps Platform quota reached.');
  }

  if (data.fallbackToClientSdk) {
    return computeRoutesViaClientSdk({
      originQuery: params.originQuery,
      originLocation: params.originLocation,
      destinationQuery: params.destinationQuery,
      destinationLocation: params.destinationLocation,
      country: params.country,
      travelModes,
    });
  }

  if (!resp.ok) {
    throw new Error(data.error || 'Unable to compute route directions.');
  }

  return data.routes || {};
}

export async function fetchAiRouteAssistant(params: {
  country: string;
  originLabel: string;
  destinationLabel: string;
  distanceHint?: string;
  nearbyStations?: string[];
  preferredPriority?: string;
  signal?: AbortSignal;
}): Promise<AiRouteAssistantResponse> {
  const resp = await fetch('/api/maps/ai-route-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: params.signal,
  });

  const data = (await resp.json().catch(() => ({}))) as Partial<AiRouteAssistantResponse> & {
    error?: string;
  };

  if (!resp.ok) {
    throw new Error(data.error || 'Unable to generate route comparison.');
  }

  return {
    originLabel: data.originLabel || params.originLabel,
    destinationLabel: data.destinationLabel || params.destinationLabel,
    recommendedMode: data.recommendedMode || 'Subway',
    summary: data.summary || '',
    nearbyStationsSummary: data.nearbyStationsSummary,
    options: Array.isArray(data.options) ? data.options : [],
  };
}
