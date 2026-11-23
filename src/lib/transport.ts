import type {
  TransportGuideResponse,
  TransportMode,
  TransferSuggestion,
} from '../types/journal';

export const TRANSPORT_MODE_OPTIONS: {
  value: TransportMode | 'All';
  label: string;
  shortDesc: string;
}[] = [
  { value: 'All', label: 'All modes', shortDesc: 'Fastest, cheapest & balanced mix' },
  { value: 'Train', label: 'Trains & Rail', shortDesc: 'High-speed, regional & commuter rail' },
  { value: 'Bus', label: 'Buses & Coaches', shortDesc: 'Intercity coaches & express airport buses' },
  { value: 'Ferry', label: 'Ferries & Boats', shortDesc: 'Island hops, harbor crossings & hydrofoils' },
  { value: 'Local Transit', label: 'Metro & Tram', shortDesc: 'City subway, tramways & IC card passes' },
  { value: 'Taxi', label: 'Licensed Taxis', shortDesc: 'Metered city cabs & official ranks' },
  { value: 'Ride-Hailing', label: 'Ride-Hailing', shortDesc: 'Grab, Uber, Bolt, Gojek & local apps' },
  { value: 'Multi-Modal', label: 'Multi-Modal', shortDesc: 'Rail + bus/ferry + last-mile combinations' },
];

export interface TransportGuideRequest {
  country: string;
  city?: string;
  origin: string;
  destination: string;
  preferredMode?: TransportMode | 'All';
  travelPriority?: 'Balanced' | 'Fastest' | 'Most Affordable';
  travelers?: number;
  notes?: string;
}

export interface TransferSuggestionRequest {
  country: string;
  day: number;
  fromActivityId: string;
  toActivityId: string;
  fromTitle: string;
  fromLocation?: string;
  toTitle: string;
  toLocation?: string;
  date?: string;
}

export async function fetchTransportGuide(
  payload: TransportGuideRequest,
  signal?: AbortSignal
): Promise<TransportGuideResponse> {
  const response = await fetch('/api/transport/guide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let data: Partial<TransportGuideResponse> & { error?: string } = {};
  try {
    data = (await response.json()) as Partial<TransportGuideResponse> & {
      error?: string;
    };
  } catch {
    // Non-JSON response fallback
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Unable to load transportation guide (${response.status}).`
    );
  }

  if (!data.cityGuide || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error('No transportation routes were returned. Please try again.');
  }

  return {
    cityGuide: data.cityGuide,
    routes: data.routes,
  };
}

export async function fetchTransferSuggestion(
  payload: TransferSuggestionRequest,
  signal?: AbortSignal
): Promise<TransferSuggestion> {
  const response = await fetch('/api/transport/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let data: Partial<TransferSuggestion> & { error?: string } = {};
  try {
    data = (await response.json()) as Partial<TransferSuggestion> & {
      error?: string;
    };
  } catch {
    // Non-JSON response fallback
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Unable to suggest transfer (${response.status}).`
    );
  }

  if (!data.recommendedMode || !data.duration) {
    throw new Error('No transfer details were returned. Please try again.');
  }

  return data as TransferSuggestion;
}
