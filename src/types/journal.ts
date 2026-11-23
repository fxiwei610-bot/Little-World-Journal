export type PageId =
  | 'dashboard'
  | 'world-map'
  | 'explore'
  | 'country'
  | 'trips'
  | 'transport'
  | 'bucket'
  | 'journal'
  | 'journal-detail'
  | 'bookings'
  | 'budget'
  | 'passport';

export type CountryFlagState = 'visited' | 'wishlist' | 'none';

export type ContinentName =
  | 'Asia'
  | 'Europe'
  | 'North America'
  | 'South America'
  | 'Africa'
  | 'Oceania'
  | 'Antarctica';

export interface Country {
  name: string;
  flag: string;
  continent: ContinentName;
  capital: string;
  currency: string;
  language: string;
  season: string;
  budget: string;
  duration: string;
  timeZone: string;
  scene: string;
  desc: string;
  places: string[];
  dest: string[];
  flagged: CountryFlagState;
  mapCoords: { x: number; y: number };
}

export type TripStatus = 'Planning' | 'Booked' | 'Completed';

export type ItineraryPace = 'Relaxed' | 'Balanced' | 'Packed';

export type ItineraryGenerationMode = 'Quick Plan' | 'Balanced' | 'Detailed';

export interface DayOutline {
  day: number;
  theme: string;
  area: string;
  highlights: string[];
}

export type DayGenerationStatus =
  | 'idle'
  | 'queued'
  | 'generating'
  | 'completed'
  | 'error';

export interface DayGenerationInfo {
  day: number;
  status: DayGenerationStatus;
  outline?: DayOutline;
  error?: string;
  preserved?: boolean;
}

export type PlaceStopType =
  | 'destination'
  | 'attraction'
  | 'accommodation'
  | 'restaurant'
  | 'terminal'
  | 'stop';

export interface NearbyTransitStation {
  placeId: string;
  name: string;
  type:
    | 'subway_station'
    | 'train_station'
    | 'bus_station'
    | 'ferry_terminal'
    | 'transit_station';
  label: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  distanceMeters: number;
}

export interface ResolvedStopLocation {
  activityId: string;
  query: string;
  placeId: string;
  displayName: string;
  formattedAddress: string;
  location: { lat: number; lng: number };
  stopType: PlaceStopType;
  googleMapsUri?: string;
  nearbyStations: NearbyTransitStation[];
}

export type RouteTravelModeKey = 'TRANSIT' | 'DRIVE' | 'WALK';

export interface RouteTransitLineInfo {
  lineName?: string;
  lineShortName?: string;
  vehicleType?: string;
  agencyName?: string;
  departureStop?: string;
  arrivalStop?: string;
  numStops?: number;
  departureTimeText?: string;
  arrivalTimeText?: string;
}

export interface RouteStepDetail {
  stepNumber: number;
  travelMode: string;
  instruction: string;
  distanceText: string;
  durationText: string;
  transit?: RouteTransitLineInfo;
}

export interface ComputedGoogleRoute {
  mode: RouteTravelModeKey;
  durationText: string;
  durationSeconds: number;
  distanceText: string;
  distanceMeters: number;
  encodedPolyline?: string;
  steps: RouteStepDetail[];
  warning?: string;
}

export type NavigationTransportMode =
  | 'Bus'
  | 'Train'
  | 'Subway'
  | 'Taxi'
  | 'Car'
  | 'Ferry'
  | 'Walking';

export interface ModeRouteOption {
  mode: NavigationTransportMode;
  operator: string;
  departurePoint: string;
  arrivalPoint: string;
  duration: string;
  distance: string;
  fareLocal: string;
  estimatedPhpFare: number;
  schedule: string;
  verificationStatus: VerificationStatus;
  verificationNote: string;
  bookingUrl?: string;
  recommended?: boolean;
  steps: TransportStep[];
  sourceLinks: TransportSourceLink[];
}

export interface AiRouteAssistantResponse {
  originLabel: string;
  destinationLabel: string;
  recommendedMode: NavigationTransportMode;
  summary: string;
  nearbyStationsSummary?: string;
  options: ModeRouteOption[];
}

export interface TripActivity {
  id: string;
  title: string;
  done: boolean;
  day?: number;
  timeSlot?: string;
  location?: string;
  category?: string;
  placeType?: PlaceStopType;
  placeId?: string;
  startingPoint?: string;
  travelTime?: string;
  distance?: string;
  duration?: string;
  costEstimate?: string;
  details?: string;
}

export interface PackingItem {
  id: string;
  name: string;
  category: string;
  reason?: string;
  packed: boolean;
}

export interface Trip {
  id: string;
  name: string;
  country: string;
  date: string;
  days: number;
  status: TripStatus;
  notes?: string;
  itineraryOverview?: string;
  activities: TripActivity[];
  packingList?: PackingItem[];
}

export type WishStatus =
  | 'Dream destination'
  | 'Planning'
  | 'Preparing'
  | 'Booked'
  | 'Travelling'
  | 'Completed';

export type WishPriority = 'High' | 'Medium' | 'Low';

export interface WishItem {
  id: string;
  name: string;
  country: string;
  status: WishStatus;
  priority: WishPriority;
  note: string;
}

export interface JournalPhoto {
  id: string;
  url: string;
  caption?: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  country: string;
  date: string;
  text: string;
  scene: string;
  photoUrl?: string;
  location?: string;
  companions?: string;
  weather?: string;
  highlights?: string[];
  gallery?: JournalPhoto[];
  liked?: boolean;
}

export type BookingPaymentStatus = 'Paid' | 'Partially paid' | 'Pending' | 'Refunded';

export interface BookingRecord {
  id: string;
  name: string;
  provider: string;
  ref: string;
  date: string;
  status: BookingPaymentStatus;
  amount: number;
  link?: string;
}

export type ExpenseCategory =
  | 'Flights'
  | 'Accommodation'
  | 'Food'
  | 'Transportation'
  | 'Activities'
  | 'Shopping'
  | 'Insurance'
  | 'Other';

export interface ExpenseRecord {
  id: string;
  name: string;
  country?: string;
  destination?: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
}

export type BudgetTier =
  | 'Shoestring / Budget'
  | 'Mid-range / Balanced'
  | 'Comfort / Luxury';

export interface BudgetEstimateBreakdown {
  transportation: number;
  accommodation: number;
  food: number;
  activities: number;
  other: number;
}

export interface BudgetEstimate {
  id: string;
  title: string;
  country: string;
  destination: string;
  travelDate: string;
  days: number;
  travelers: number;
  preference: BudgetTier;
  currency: string;
  breakdown: BudgetEstimateBreakdown;
  notes: string;
  aiGenerated: boolean;
}

export type ModalType =
  | 'trip'
  | 'activity'
  | 'wish'
  | 'journal'
  | 'booking'
  | 'expense'
  | 'budget'
  | 'country'
  | 'destination'
  | null;

export interface ModalContext {
  type: ModalType;
  countryName?: string;
  tripId?: string;
}

export type TransportMode =
  | 'Train'
  | 'Bus'
  | 'Ferry'
  | 'Taxi'
  | 'Ride-Hailing'
  | 'Local Transit'
  | 'Multi-Modal';

export type VerificationStatus = 'verified' | 'estimated';

export interface TransportSourceLink {
  title: string;
  url: string;
}

export interface TransportStep {
  stepNumber: number;
  mode: string;
  instruction: string;
  terminalOrStation?: string;
  duration?: string;
  lastMileTip?: string;
}

export interface TransportRouteOption {
  id: string;
  country: string;
  city?: string;
  origin: string;
  destination: string;
  mode: TransportMode;
  operator: string;
  departurePoint: string;
  arrivalPoint: string;
  duration: string;
  fareLocal: string;
  estimatedPhpFare: number;
  schedule: string;
  bookingUrl?: string;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  steps: TransportStep[];
  sourceLinks: TransportSourceLink[];
}

export interface CityLocalTransportOverview {
  city: string;
  country: string;
  summary: string;
  transitCardOrPass: string;
  buses: string;
  trainsAndMetro: string;
  ferries: string;
  taxisAndRideHailing: string;
  localTips: string[];
  sourceLinks: TransportSourceLink[];
}

export interface TransportGuideResponse {
  cityGuide: CityLocalTransportOverview;
  routes: TransportRouteOption[];
}

export interface SavedTransportRoute extends TransportRouteOption {
  id: string;
}

export interface TransferSuggestion {
  day: number;
  fromActivityId: string;
  toActivityId: string;
  fromLabel: string;
  toLabel: string;
  recommendedMode: TransportMode;
  operator: string;
  departurePoint: string;
  arrivalPoint: string;
  duration: string;
  fareLocal: string;
  estimatedPhpFare: number;
  schedule: string;
  bookingUrl?: string;
  verificationStatus: VerificationStatus;
  verificationNote?: string;
  steps: TransportStep[];
  sourceLinks: TransportSourceLink[];
  summary: string;
}
