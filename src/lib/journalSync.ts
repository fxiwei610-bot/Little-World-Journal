import type { User } from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import type {
  BookingRecord,
  BudgetEstimate,
  BudgetTier,
  Country,
  CountryFlagState,
  ExpenseRecord,
  JournalEntry,
  JournalPhoto,
  PackingItem,
  SavedTransportRoute,
  TransportMode,
  Trip,
  TripActivity,
  TripStatus,
  VerificationStatus,
  WishItem,
  WishStatus,
} from '../types/journal';
import { OperationType, db, handleFirestoreError } from './firebase';

function clampStr(val: string | undefined | null, maxLen: number, fallback = ''): string {
  const s = (val ?? fallback).toString();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function slugifyId(raw: string, prefix = 'item'): string {
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return slug || `${prefix}-${Date.now()}`;
}

export interface JournalSeedPayload {
  countries: Country[];
  trips: Trip[];
  wishes: WishItem[];
  journals: JournalEntry[];
  bookings: BookingRecord[];
  expenses: ExpenseRecord[];
  budget: number;
}

function buildCountryPayload(c: Country, uid: string) {
  return {
    ownerId: uid,
    name: clampStr(c.name, 80, 'Country'),
    flag: clampStr(c.flag, 16, '🏳️'),
    continent: c.continent,
    capital: clampStr(c.capital, 100),
    currency: clampStr(c.currency, 80),
    language: clampStr(c.language, 80),
    season: clampStr(c.season, 80),
    budget: clampStr(c.budget, 80),
    duration: clampStr(c.duration, 60),
    timeZone: clampStr(c.timeZone, 60),
    scene: clampStr(c.scene, 40, 'wander'),
    desc: clampStr(c.desc, 600),
    places: c.places.slice(0, 30).map((p) => clampStr(p, 80)),
    dest: c.dest.slice(0, 30).map((d) => clampStr(d, 80)),
    flagged: c.flagged,
    mapCoords: {
      x: Math.max(0, Math.min(1000, Number(c.mapCoords?.x) || 350)),
      y: Math.max(0, Math.min(1000, Number(c.mapCoords?.y) || 150)),
    },
  };
}

export async function ensureUserProfileAndSeed(
  user: User,
  seed: JournalSeedPayload,
  preferredDisplayName?: string
): Promise<{ isNewRegistration: boolean }> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const displayName = clampStr(
    preferredDisplayName?.trim() || user.displayName || user.email?.split('@')[0] || 'Little Explorer',
    80,
    'Little Explorer'
  );

  if (!snap.exists()) {
    const profilePayload: Record<string, unknown> = {
      uid: user.uid,
      displayName,
      budget: Math.max(0, Number(seed.budget) || 50000),
      seeded: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (user.email) profilePayload.email = clampStr(user.email, 160);
    if (user.photoURL) profilePayload.photoURL = clampStr(user.photoURL, 500);

    try {
      const batch = writeBatch(db);
      batch.set(userRef, profilePayload);

      seed.countries.forEach((c) => {
        const cid = slugifyId(c.name, 'country');
        batch.set(doc(db, 'users', user.uid, 'countries', cid), {
          ...buildCountryPayload(c, user.uid),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      seed.trips.forEach((t) => {
        const tid = slugifyId(t.id, 'trip');
        batch.set(doc(db, 'users', user.uid, 'trips', tid), {
          ownerId: user.uid,
          name: clampStr(t.name, 120, 'Trip'),
          country: clampStr(t.country, 80, 'Japan'),
          date: clampStr(t.date, 20),
          days: Math.max(1, Math.min(3650, Number(t.days) || 1)),
          status: t.status,
          notes: clampStr(t.notes, 1000),
          itineraryOverview: clampStr(t.itineraryOverview, 1000),
          activities: sanitizeActivities(t.activities),
          packingList: sanitizePackingList(t.packingList),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      seed.wishes.forEach((w) => {
        const wid = slugifyId(w.id, 'wish');
        batch.set(doc(db, 'users', user.uid, 'wishes', wid), {
          ownerId: user.uid,
          name: clampStr(w.name, 120, 'Destination'),
          country: clampStr(w.country, 80, 'Japan'),
          status: w.status,
          priority: w.priority,
          note: clampStr(w.note, 400),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      seed.journals.forEach((j) => {
        const jid = slugifyId(j.id, 'journal');
        batch.set(doc(db, 'users', user.uid, 'journals', jid), {
          ...buildJournalPayload(j, user.uid),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      seed.bookings.forEach((b) => {
        const bid = slugifyId(b.id, 'booking');
        const payload: Record<string, unknown> = {
          ownerId: user.uid,
          name: clampStr(b.name, 140, 'Booking'),
          provider: clampStr(b.provider, 100, 'Provider'),
          ref: clampStr(b.ref, 80),
          date: clampStr(b.date, 20),
          status: b.status,
          amount: Math.max(0, Number(b.amount) || 0),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (b.link) payload.link = clampStr(b.link, 500);
        batch.set(doc(db, 'users', user.uid, 'bookings', bid), payload);
      });

      seed.expenses.forEach((e) => {
        const eid = slugifyId(e.id, 'exp');
        const expensePayload: Record<string, unknown> = {
          ownerId: user.uid,
          name: clampStr(e.name, 140, 'Expense'),
          category: e.category,
          amount: Math.max(0, Math.min(1000000000, Number(e.amount) || 0)),
          date: clampStr(e.date, 20),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (e.country?.trim()) expensePayload.country = clampStr(e.country.trim(), 80);
        if (e.destination?.trim()) expensePayload.destination = clampStr(e.destination.trim(), 120);
        batch.set(doc(db, 'users', user.uid, 'expenses', eid), expensePayload);
      });

      await batch.commit();
      return { isNewRegistration: true };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, userPath);
    }
  }

  // Existing user: sync display name / avatar if requested or changed
  if (preferredDisplayName?.trim()) {
    try {
      const updatePayload: Record<string, unknown> = {
        displayName,
        updatedAt: serverTimestamp(),
      };
      if (user.email) updatePayload.email = clampStr(user.email, 160);
      if (user.photoURL) updatePayload.photoURL = clampStr(user.photoURL, 500);
      await updateDoc(userRef, updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  }

  return { isNewRegistration: false };
}

export async function updateUserBudgetDoc(uid: string, budget: number) {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      budget: Math.max(0, Number(budget) || 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createCountryDoc(uid: string, country: Country) {
  const cid = slugifyId(country.name, 'country');
  const path = `users/${uid}/countries/${cid}`;
  try {
    await setDoc(doc(db, 'users', uid, 'countries', cid), {
      ...buildCountryPayload(country, uid),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateCountryFlagDoc(
  uid: string,
  countryName: string,
  flagged: CountryFlagState
) {
  const cid = slugifyId(countryName, 'country');
  const path = `users/${uid}/countries/${cid}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'countries', cid), {
      flagged,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCountryPlacesDoc(
  uid: string,
  countryName: string,
  places: string[],
  dest: string[]
) {
  const cid = slugifyId(countryName, 'country');
  const path = `users/${uid}/countries/${cid}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'countries', cid), {
      places: places.slice(0, 30).map((p) => clampStr(p, 80)),
      dest: dest.slice(0, 30).map((d) => clampStr(d, 80)),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

const VALID_PLACE_STOP_TYPES = new Set([
  'destination',
  'attraction',
  'accommodation',
  'restaurant',
  'terminal',
  'stop',
]);

function sanitizeActivities(items?: TripActivity[]) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 80).map((item, idx) => {
    const clean: Record<string, unknown> = {
      id: clampStr(item.id, 60, `act-${Date.now()}-${idx}`),
      title: clampStr(item.title, 140, 'Activity'),
      done: Boolean(item.done),
    };
    if (typeof item.day === 'number' && Number.isFinite(item.day) && item.day >= 1) {
      clean.day = Math.min(365, Math.round(item.day));
    }
    if (item.timeSlot?.trim()) clean.timeSlot = clampStr(item.timeSlot.trim(), 40);
    if (item.location?.trim()) clean.location = clampStr(item.location.trim(), 120);
    if (item.category?.trim()) clean.category = clampStr(item.category.trim(), 40);
    if (item.placeType && VALID_PLACE_STOP_TYPES.has(item.placeType)) {
      clean.placeType = item.placeType;
    }
    if (item.placeId?.trim()) clean.placeId = clampStr(item.placeId.trim(), 160);
    if (item.startingPoint?.trim()) {
      clean.startingPoint = clampStr(item.startingPoint.trim(), 160);
    }
    if (item.travelTime?.trim()) clean.travelTime = clampStr(item.travelTime.trim(), 40);
    if (item.distance?.trim()) clean.distance = clampStr(item.distance.trim(), 40);
    if (item.duration?.trim()) clean.duration = clampStr(item.duration.trim(), 40);
    if (item.costEstimate?.trim()) clean.costEstimate = clampStr(item.costEstimate.trim(), 40);
    if (item.details?.trim()) clean.details = clampStr(item.details.trim(), 400);
    return clean;
  });
}

function sanitizePackingList(items?: PackingItem[]) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 60).map((item) => ({
    id: clampStr(item.id, 60, `pack-${Date.now()}`),
    name: clampStr(item.name, 120, 'Item'),
    category: clampStr(item.category, 40, 'Essentials'),
    reason: clampStr(item.reason, 160),
    packed: Boolean(item.packed),
  }));
}

export async function createTripDoc(uid: string, trip: Trip) {
  const tid = slugifyId(trip.id, 'trip');
  const path = `users/${uid}/trips/${tid}`;
  try {
    await setDoc(doc(db, 'users', uid, 'trips', tid), {
      ownerId: uid,
      name: clampStr(trip.name, 120, 'Trip'),
      country: clampStr(trip.country, 80, 'Japan'),
      date: clampStr(trip.date, 20),
      days: Math.max(1, Math.min(3650, Number(trip.days) || 1)),
      status: trip.status,
      notes: clampStr(trip.notes, 1000),
      itineraryOverview: clampStr(trip.itineraryOverview, 1000),
      activities: sanitizeActivities(trip.activities),
      packingList: sanitizePackingList(trip.packingList),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTripStatusDoc(uid: string, tripId: string, status: TripStatus) {
  const tid = slugifyId(tripId, 'trip');
  const path = `users/${uid}/trips/${tid}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'trips', tid), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTripNotesDoc(uid: string, tripId: string, notes: string) {
  const tid = slugifyId(tripId, 'trip');
  const path = `users/${uid}/trips/${tid}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'trips', tid), {
      notes: clampStr(notes, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTripActivitiesDoc(
  uid: string,
  tripId: string,
  activities: TripActivity[],
  itineraryOverview?: string
) {
  const tid = slugifyId(tripId, 'trip');
  const path = `users/${uid}/trips/${tid}`;
  const updatePayload: Record<string, unknown> = {
    activities: sanitizeActivities(activities),
    updatedAt: serverTimestamp(),
  };
  if (typeof itineraryOverview === 'string') {
    updatePayload.itineraryOverview = clampStr(itineraryOverview, 1000);
  }
  try {
    await updateDoc(doc(db, 'users', uid, 'trips', tid), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateTripPackingListDoc(
  uid: string,
  tripId: string,
  packingList: PackingItem[]
) {
  const tid = slugifyId(tripId, 'trip');
  const path = `users/${uid}/trips/${tid}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'trips', tid), {
      packingList: sanitizePackingList(packingList),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTripDoc(uid: string, tripId: string) {
  const tid = slugifyId(tripId, 'trip');
  const path = `users/${uid}/trips/${tid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'trips', tid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createWishDoc(uid: string, wish: WishItem) {
  const wid = slugifyId(wish.id, 'wish');
  const path = `users/${uid}/wishes/${wid}`;
  try {
    await setDoc(doc(db, 'users', uid, 'wishes', wid), {
      ownerId: uid,
      name: clampStr(wish.name, 120, 'Destination'),
      country: clampStr(wish.country, 80, 'Japan'),
      status: wish.status,
      priority: wish.priority,
      note: clampStr(wish.note, 400),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWishStatusDoc(uid: string, wishId: string, status: WishStatus) {
  const wid = slugifyId(wishId, 'wish');
  const path = `users/${uid}/wishes/${wid}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'wishes', wid), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWishDoc(uid: string, wishId: string) {
  const wid = slugifyId(wishId, 'wish');
  const path = `users/${uid}/wishes/${wid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'wishes', wid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

function sanitizeHighlights(highlights?: string[]): string[] {
  if (!Array.isArray(highlights)) return [];
  return highlights
    .map((h) => clampStr(h, 160).trim())
    .filter(Boolean)
    .slice(0, 15);
}

function sanitizeGallery(gallery?: JournalPhoto[]) {
  if (!Array.isArray(gallery)) return [];
  return gallery
    .filter((item) => item && typeof item.url === 'string' && item.url.trim().length > 0)
    .slice(0, 12)
    .map((item, idx) => ({
      id: clampStr(item.id, 60, `photo-${Date.now()}-${idx}`),
      url: clampStr(item.url.trim(), 500),
      caption: clampStr(item.caption, 140),
    }));
}

function buildJournalPayload(entry: JournalEntry, uid: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    ownerId: uid,
    title: clampStr(entry.title, 140, 'Memory'),
    country: clampStr(entry.country, 80, 'Japan'),
    date: clampStr(entry.date, 20),
    text: clampStr(entry.text, 5000, 'A lovely travel moment.'),
    scene: clampStr(entry.scene, 40, 'wander'),
    liked: Boolean(entry.liked),
    highlights: sanitizeHighlights(entry.highlights),
    gallery: sanitizeGallery(entry.gallery),
  };
  if (entry.photoUrl?.trim()) payload.photoUrl = clampStr(entry.photoUrl.trim(), 500);
  if (entry.location?.trim()) payload.location = clampStr(entry.location.trim(), 120);
  if (entry.companions?.trim()) payload.companions = clampStr(entry.companions.trim(), 80);
  if (entry.weather?.trim()) payload.weather = clampStr(entry.weather.trim(), 80);
  return payload;
}

export async function createJournalDoc(uid: string, entry: JournalEntry) {
  const jid = slugifyId(entry.id, 'journal');
  const path = `users/${uid}/journals/${jid}`;
  const payload = {
    ...buildJournalPayload(entry, uid),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid, 'journals', jid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateJournalDoc(uid: string, entry: JournalEntry) {
  const jid = slugifyId(entry.id, 'journal');
  const path = `users/${uid}/journals/${jid}`;
  const updatePayload: Record<string, unknown> = {
    title: clampStr(entry.title, 140, 'Memory'),
    country: clampStr(entry.country, 80, 'Japan'),
    date: clampStr(entry.date, 20),
    text: clampStr(entry.text, 5000, 'A lovely travel moment.'),
    scene: clampStr(entry.scene, 40, 'wander'),
    photoUrl: clampStr(entry.photoUrl?.trim(), 500),
    location: clampStr(entry.location?.trim(), 120),
    companions: clampStr(entry.companions?.trim(), 80),
    weather: clampStr(entry.weather?.trim(), 80),
    highlights: sanitizeHighlights(entry.highlights),
    gallery: sanitizeGallery(entry.gallery),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'users', uid, 'journals', jid), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleJournalLikeDoc(uid: string, journalId: string, liked: boolean) {
  const jid = slugifyId(journalId, 'journal');
  const path = `users/${uid}/journals/${jid}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'journals', jid), {
      liked,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteJournalDoc(uid: string, journalId: string) {
  const jid = slugifyId(journalId, 'journal');
  const path = `users/${uid}/journals/${jid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'journals', jid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createBookingDoc(uid: string, booking: BookingRecord) {
  const bid = slugifyId(booking.id, 'booking');
  const path = `users/${uid}/bookings/${bid}`;
  const payload: Record<string, unknown> = {
    ownerId: uid,
    name: clampStr(booking.name, 140, 'Booking'),
    provider: clampStr(booking.provider, 100, 'Provider'),
    ref: clampStr(booking.ref, 80),
    date: clampStr(booking.date, 20),
    status: booking.status,
    amount: Math.max(0, Number(booking.amount) || 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (booking.link) payload.link = clampStr(booking.link, 500);

  try {
    await setDoc(doc(db, 'users', uid, 'bookings', bid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteBookingDoc(uid: string, bookingId: string) {
  const bid = slugifyId(bookingId, 'booking');
  const path = `users/${uid}/bookings/${bid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'bookings', bid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createExpenseDoc(uid: string, expense: ExpenseRecord) {
  const eid = slugifyId(expense.id, 'exp');
  const path = `users/${uid}/expenses/${eid}`;
  const payload: Record<string, unknown> = {
    ownerId: uid,
    name: clampStr(expense.name, 140, 'Expense'),
    category: expense.category,
    amount: Math.max(0, Math.min(1000000000, Number(expense.amount) || 0)),
    date: clampStr(expense.date, 20),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (expense.country?.trim()) payload.country = clampStr(expense.country.trim(), 80);
  if (expense.destination?.trim()) {
    payload.destination = clampStr(expense.destination.trim(), 120);
  }

  try {
    await setDoc(doc(db, 'users', uid, 'expenses', eid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateExpenseDestinationDoc(
  uid: string,
  expenseId: string,
  country: string,
  destination?: string
) {
  const eid = slugifyId(expenseId, 'exp');
  const path = `users/${uid}/expenses/${eid}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'expenses', eid), {
      country: clampStr(country.trim(), 80),
      destination: clampStr(destination?.trim(), 120),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteExpenseDoc(uid: string, expenseId: string) {
  const eid = slugifyId(expenseId, 'exp');
  const path = `users/${uid}/expenses/${eid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'expenses', eid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

const VALID_BUDGET_TIERS: BudgetTier[] = [
  'Shoestring / Budget',
  'Mid-range / Balanced',
  'Comfort / Luxury',
];

function sanitizeEstimateAmount(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.min(1000000000, Math.round(num));
}

function buildBudgetEstimateFields(estimate: BudgetEstimate) {
  const preference: BudgetTier = VALID_BUDGET_TIERS.includes(estimate.preference)
    ? estimate.preference
    : 'Mid-range / Balanced';

  return {
    title: clampStr(estimate.title.trim(), 140, `${estimate.country || 'Trip'} Budget Estimate`),
    country: clampStr(estimate.country.trim(), 80, 'Japan'),
    destination: clampStr(estimate.destination.trim(), 120),
    travelDate: clampStr(estimate.travelDate.trim(), 20, new Date().toISOString().slice(0, 10)),
    days: Math.max(1, Math.min(3650, Math.round(Number(estimate.days) || 1))),
    travelers: Math.max(1, Math.min(50, Math.round(Number(estimate.travelers) || 1))),
    preference,
    currency: clampStr(estimate.currency.trim(), 16, 'PHP'),
    breakdown: {
      transportation: sanitizeEstimateAmount(estimate.breakdown?.transportation),
      accommodation: sanitizeEstimateAmount(estimate.breakdown?.accommodation),
      food: sanitizeEstimateAmount(estimate.breakdown?.food),
      activities: sanitizeEstimateAmount(estimate.breakdown?.activities),
      other: sanitizeEstimateAmount(estimate.breakdown?.other),
    },
    notes: clampStr(estimate.notes.trim(), 1200),
  };
}

export async function createBudgetEstimateDoc(uid: string, estimate: BudgetEstimate) {
  const bid = slugifyId(estimate.id, 'est');
  const path = `users/${uid}/budgetEstimates/${bid}`;
  try {
    await setDoc(doc(db, 'users', uid, 'budgetEstimates', bid), {
      ownerId: uid,
      ...buildBudgetEstimateFields(estimate),
      aiGenerated: Boolean(estimate.aiGenerated),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBudgetEstimateDoc(uid: string, estimate: BudgetEstimate) {
  const bid = slugifyId(estimate.id, 'est');
  const path = `users/${uid}/budgetEstimates/${bid}`;
  const fields = buildBudgetEstimateFields(estimate);
  try {
    await updateDoc(doc(db, 'users', uid, 'budgetEstimates', bid), {
      title: fields.title,
      country: fields.country,
      destination: fields.destination,
      travelDate: fields.travelDate,
      days: fields.days,
      travelers: fields.travelers,
      preference: fields.preference,
      breakdown: fields.breakdown,
      notes: fields.notes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteBudgetEstimateDoc(uid: string, estimateId: string) {
  const bid = slugifyId(estimateId, 'est');
  const path = `users/${uid}/budgetEstimates/${bid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'budgetEstimates', bid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

const VALID_TRANSPORT_MODES: TransportMode[] = [
  'Train',
  'Bus',
  'Ferry',
  'Taxi',
  'Ride-Hailing',
  'Local Transit',
  'Multi-Modal',
];

export async function createTransportRouteDoc(uid: string, route: SavedTransportRoute) {
  const rid = slugifyId(route.id, 'route');
  const path = `users/${uid}/transportRoutes/${rid}`;
  const mode: TransportMode = VALID_TRANSPORT_MODES.includes(route.mode)
    ? route.mode
    : 'Multi-Modal';
  const verificationStatus: VerificationStatus =
    route.verificationStatus === 'verified' ? 'verified' : 'estimated';

  const steps = Array.isArray(route.steps)
    ? route.steps.slice(0, 12).map((s, idx) => ({
        stepNumber: Math.max(1, Math.round(Number(s.stepNumber) || idx + 1)),
        mode: clampStr(s.mode, 40, mode),
        instruction: clampStr(s.instruction, 280, 'Follow transit signage'),
        ...(s.terminalOrStation?.trim()
          ? { terminalOrStation: clampStr(s.terminalOrStation.trim(), 120) }
          : {}),
        ...(s.duration?.trim() ? { duration: clampStr(s.duration.trim(), 40) } : {}),
        ...(s.lastMileTip?.trim()
          ? { lastMileTip: clampStr(s.lastMileTip.trim(), 200) }
          : {}),
      }))
    : [];

  const sourceLinks = Array.isArray(route.sourceLinks)
    ? route.sourceLinks
        .filter((link) => link && typeof link.url === 'string' && link.url.trim().length > 0)
        .slice(0, 10)
        .map((link) => ({
          title: clampStr(link.title?.trim(), 120, 'Official transit info'),
          url: clampStr(link.url.trim(), 500),
        }))
    : [];

  const payload: Record<string, unknown> = {
    ownerId: uid,
    country: clampStr(route.country?.trim(), 80, 'Japan'),
    origin: clampStr(route.origin?.trim(), 140, 'Origin'),
    destination: clampStr(route.destination?.trim(), 140, 'Destination'),
    mode,
    operator: clampStr(route.operator?.trim(), 120, 'Local Transit'),
    departurePoint: clampStr(route.departurePoint?.trim(), 140),
    arrivalPoint: clampStr(route.arrivalPoint?.trim(), 140),
    duration: clampStr(route.duration?.trim(), 60),
    fareLocal: clampStr(route.fareLocal?.trim(), 80),
    estimatedPhpFare: sanitizeEstimateAmount(route.estimatedPhpFare),
    schedule: clampStr(route.schedule?.trim(), 180),
    verificationStatus,
    steps,
    sourceLinks,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (route.city?.trim()) payload.city = clampStr(route.city.trim(), 100);
  if (route.bookingUrl?.trim()) payload.bookingUrl = clampStr(route.bookingUrl.trim(), 500);
  if (route.verificationNote?.trim()) {
    payload.verificationNote = clampStr(route.verificationNote.trim(), 240);
  }

  try {
    await setDoc(doc(db, 'users', uid, 'transportRoutes', rid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteTransportRouteDoc(uid: string, routeId: string) {
  const rid = slugifyId(routeId, 'route');
  const path = `users/${uid}/transportRoutes/${rid}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'transportRoutes', rid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
