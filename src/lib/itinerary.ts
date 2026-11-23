import type {
  DayOutline,
  ItineraryGenerationMode,
  ItineraryPace,
  PlaceStopType,
  TripActivity,
} from '../types/journal';

export const ITINERARY_CATEGORIES = [
  'Sightseeing',
  'Food & Dining',
  'Culture & History',
  'Nature & Outdoors',
  'Transit & Logistics',
  'Shopping & Markets',
  'Relaxation',
  'Activity',
] as const;

export const PLACE_STOP_TYPE_OPTIONS: {
  value: PlaceStopType;
  label: string;
}[] = [
  { value: 'attraction', label: 'Attraction / Sight' },
  { value: 'restaurant', label: 'Restaurant / Cafe' },
  { value: 'accommodation', label: 'Hotel / Accommodation' },
  { value: 'terminal', label: 'Station / Airport / Terminal' },
  { value: 'destination', label: 'District / Neighborhood' },
  { value: 'stop', label: 'General Stop' },
];

export const ITINERARY_PACE_OPTIONS: { value: ItineraryPace; label: string; hint: string }[] = [
  { value: 'Relaxed', label: 'Relaxed', hint: '2–3 unhurried stops per day' },
  { value: 'Balanced', label: 'Balanced', hint: '3–4 signature highlights & meals' },
  { value: 'Packed', label: 'Packed', hint: '4–5 full-day exploration stops' },
];

export const ITINERARY_MODE_OPTIONS: {
  value: ItineraryGenerationMode;
  label: string;
  badge: string;
  hint: string;
  concurrency: number;
}[] = [
  {
    value: 'Quick Plan',
    label: 'Quick Plan',
    badge: 'Fastest',
    hint: '2 essential stops/day with concise highlights',
    concurrency: 3,
  },
  {
    value: 'Balanced',
    label: 'Balanced',
    badge: 'Recommended',
    hint: '3–4 signature stops & local dining/day',
    concurrency: 2,
  },
  {
    value: 'Detailed',
    label: 'Detailed',
    badge: 'In-depth',
    hint: '4–5 stops/day with transit & insider tips',
    concurrency: 2,
  },
];

export interface SuggestedItineraryStop {
  day: number;
  timeSlot: string;
  title: string;
  location: string;
  category: string;
  placeType?: PlaceStopType;
  travelTimeFromPrev?: string;
  distanceFromPrev?: string;
  duration: string;
  costEstimate: string;
  details: string;
}

export interface SmartItineraryResponse {
  overview: string;
  items: SuggestedItineraryStop[];
}

export interface GenerateItineraryPayload {
  tripName: string;
  country: string;
  date: string;
  days: number;
  season?: string;
  countrySeasonGuide?: string;
  places?: string[];
  dest?: string[];
  pace: ItineraryPace;
  interests?: string;
  notes?: string;
  existingActivities?: string[];
}

export interface GenerateOutlinePayload {
  tripName: string;
  country: string;
  date: string;
  days: number;
  season?: string;
  places?: string[];
  dest?: string[];
  mode: ItineraryGenerationMode;
  interests?: string;
  notes?: string;
  existingDays?: Array<{ day: number; titles: string[] }>;
}

export interface ItineraryOutlineResponse {
  overview: string;
  dayOutlines: DayOutline[];
}

export interface GenerateDayPayload {
  tripName: string;
  country: string;
  date: string;
  day: number;
  totalDays: number;
  mode: ItineraryGenerationMode;
  dayOutline?: DayOutline;
  season?: string;
  interests?: string;
  notes?: string;
  avoidTitles?: string[];
}

export function getDayDateLabel(startDate: string, dayNumber: number): string {
  const base = startDate ? new Date(`${startDate}T00:00:00`) : null;
  if (!base || Number.isNaN(base.getTime())) {
    return `Day ${dayNumber}`;
  }
  const target = new Date(base);
  target.setDate(base.getDate() + Math.max(0, dayNumber - 1));
  return target.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function getTripDateRangeLabel(startDate: string, days: number): string {
  const base = startDate ? new Date(`${startDate}T00:00:00`) : null;
  if (!base || Number.isNaN(base.getTime())) {
    return startDate || 'Dates TBD';
  }
  const end = new Date(base);
  end.setDate(base.getDate() + Math.max(0, days - 1));
  const startLabel = base.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (days <= 1) return startLabel;
  const sameYear = base.getFullYear() === end.getFullYear();
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${base.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endLabel}, ${end.getFullYear()}`;
}

export function parseTimeMinutes(timeSlot?: string): number {
  if (!timeSlot) return 12 * 60;
  const trimmed = timeSlot.trim().toLowerCase();
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/.exec(trimmed);
  if (match) {
    let hours = Number(match[1]);
    const mins = Number(match[2] || 0);
    const meridiem = match[3];
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    return hours * 60 + mins;
  }
  if (trimmed.includes('morning') || trimmed.includes('sunrise')) return 9 * 60;
  if (trimmed.includes('noon') || trimmed.includes('lunch')) return 12 * 60;
  if (trimmed.includes('afternoon')) return 15 * 60;
  if (trimmed.includes('sunset') || trimmed.includes('evening')) return 18 * 60;
  if (trimmed.includes('night') || trimmed.includes('dinner')) return 20 * 60;
  return 23 * 60;
}

export function sortActivitiesChronologically(activities: TripActivity[]): TripActivity[] {
  return [...activities].sort((a, b) => {
    const dayA = typeof a.day === 'number' && a.day >= 1 ? a.day : 1;
    const dayB = typeof b.day === 'number' && b.day >= 1 ? b.day : 1;
    if (dayA !== dayB) return dayA - dayB;
    return parseTimeMinutes(a.timeSlot) - parseTimeMinutes(b.timeSlot);
  });
}

export async function generateDetailedItinerary(
  payload: GenerateItineraryPayload,
  signal?: AbortSignal
): Promise<SmartItineraryResponse> {
  const response = await fetch('/api/itinerary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let data: Partial<SmartItineraryResponse> & { error?: string } = {};
  try {
    data = (await response.json()) as Partial<SmartItineraryResponse> & { error?: string };
  } catch {
    // Non-JSON response fallback
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Unable to generate itinerary (${response.status}).`
    );
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error('No itinerary stops were returned. Please try again.');
  }

  return {
    overview: data.overview || '',
    items: data.items,
  };
}

export async function generateItineraryOutline(
  payload: GenerateOutlinePayload,
  signal?: AbortSignal
): Promise<ItineraryOutlineResponse> {
  const response = await fetch('/api/itinerary/outline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let data: Partial<ItineraryOutlineResponse> & { error?: string } = {};
  try {
    data = (await response.json()) as Partial<ItineraryOutlineResponse> & { error?: string };
  } catch {
    // Non-JSON response fallback
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Unable to create itinerary outline (${response.status}).`
    );
  }

  if (!Array.isArray(data.dayOutlines) || data.dayOutlines.length === 0) {
    throw new Error('No day outlines were returned. Please try again.');
  }

  return {
    overview: data.overview || '',
    dayOutlines: data.dayOutlines,
  };
}

export async function generateItineraryDay(
  payload: GenerateDayPayload,
  signal?: AbortSignal
): Promise<{ day: number; items: SuggestedItineraryStop[] }> {
  const response = await fetch('/api/itinerary/day', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let data: { day?: number; items?: SuggestedItineraryStop[]; error?: string } = {};
  try {
    data = (await response.json()) as {
      day?: number;
      items?: SuggestedItineraryStop[];
      error?: string;
    };
  } catch {
    // Non-JSON response fallback
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Unable to generate Day ${payload.day} (${response.status}).`
    );
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    throw new Error(`No activities returned for Day ${payload.day}.`);
  }

  return {
    day: data.day ?? payload.day,
    items: data.items,
  };
}
