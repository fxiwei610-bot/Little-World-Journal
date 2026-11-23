import type { Country } from '../types/journal';

export interface SuggestedPackingItem {
  name: string;
  category: string;
  reason: string;
}

export interface SmartPackingResponse {
  seasonSummary: string;
  items: SuggestedPackingItem[];
}

export interface GeneratePackingPayload {
  tripName: string;
  country: string;
  date: string;
  days: number;
  season: string;
  countrySeasonGuide?: string;
  activities: string[];
  notes?: string;
}

const TROPICAL_COUNTRIES = new Set([
  'philippines',
  'thailand',
  'indonesia',
  'vietnam',
  'malaysia',
  'singapore',
  'cambodia',
  'sri lanka',
  'maldives',
  'costa rica',
]);

const SOUTHERN_COUNTRIES = new Set([
  'australia',
  'new zealand',
  'south africa',
  'argentina',
  'chile',
  'brazil',
  'peru',
  'uruguay',
]);

export function inferTripSeason(tripDate: string, country?: Country): string {
  const parsed = tripDate ? new Date(`${tripDate}T00:00:00`) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return country?.season ? `Best season (${country.season})` : 'Mild / Year-round';
  }

  const monthIdx = parsed.getMonth(); // 0 = Jan
  const monthName = parsed.toLocaleString('en-US', { month: 'long' });
  const countryLower = (country?.name || '').toLowerCase();

  if (TROPICAL_COUNTRIES.has(countryLower)) {
    const isDry = monthIdx === 11 || monthIdx <= 4; // Dec - May
    return `${isDry ? 'Dry / Warm Season' : 'Wet / Monsoon Season'} (${monthName})`;
  }

  const isSouthern =
    SOUTHERN_COUNTRIES.has(countryLower) ||
    country?.continent === 'Oceania' ||
    country?.continent === 'South America';

  let seasonName: string;
  if (monthIdx === 11 || monthIdx <= 1) {
    seasonName = isSouthern ? 'Summer' : 'Winter';
  } else if (monthIdx >= 2 && monthIdx <= 4) {
    seasonName = isSouthern ? 'Autumn' : 'Spring';
  } else if (monthIdx >= 5 && monthIdx <= 7) {
    seasonName = isSouthern ? 'Winter' : 'Summer';
  } else {
    seasonName = isSouthern ? 'Spring' : 'Autumn';
  }

  return `${seasonName} (${monthName})`;
}

export async function generateSmartPackingList(
  payload: GeneratePackingPayload,
  signal?: AbortSignal
): Promise<SmartPackingResponse> {
  const response = await fetch('/api/packing-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let data: Partial<SmartPackingResponse> & { error?: string } = {};
  try {
    data = (await response.json()) as Partial<SmartPackingResponse> & { error?: string };
  } catch {
    // Non-JSON response fallback
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Unable to generate packing suggestions (${response.status}).`
    );
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('No packing items were returned. Please try again.');
  }

  return {
    seasonSummary: data.seasonSummary || '',
    items: data.items,
  };
}
