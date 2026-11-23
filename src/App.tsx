import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { LogIn, LogOut, Plus, Search, UserPlus } from 'lucide-react';
import { AuthModal } from './components/AuthModal';
import { JournalModal } from './components/JournalModal';
import { Sidebar } from './components/Sidebar';
import { AuthLandingPage } from './components/pages/AuthLandingPage';
import { BookingsPage } from './components/pages/BookingsPage';
import { BucketListPage } from './components/pages/BucketListPage';
import { BudgetPage } from './components/pages/BudgetPage';
import { CountryDetailPage } from './components/pages/CountryDetailPage';
import { DashboardPage } from './components/pages/DashboardPage';
import { ExplorePage } from './components/pages/ExplorePage';
import { JournalDetailPage } from './components/pages/JournalDetailPage';
import { JournalPage } from './components/pages/JournalPage';
import { PassportPage } from './components/pages/PassportPage';
import { TransportGuidePage } from './components/pages/TransportGuidePage';
import { TripsPage } from './components/pages/TripsPage';
import { WorldMapPage } from './components/pages/WorldMapPage';
import {
  INITIAL_BOOKINGS,
  INITIAL_BUDGET,
  INITIAL_COUNTRIES,
  INITIAL_EXPENSES,
  INITIAL_JOURNALS,
  INITIAL_TRIPS,
  INITIAL_WISHES,
} from './data/initialData';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from './lib/firebase';
import {
  createBookingDoc,
  createBudgetEstimateDoc,
  createCountryDoc,
  createExpenseDoc,
  createJournalDoc,
  createTransportRouteDoc,
  createTripDoc,
  createWishDoc,
  deleteBookingDoc,
  deleteBudgetEstimateDoc,
  deleteExpenseDoc,
  deleteJournalDoc,
  deleteTransportRouteDoc,
  deleteTripDoc,
  deleteWishDoc,
  ensureUserProfileAndSeed,
  toggleJournalLikeDoc,
  updateBudgetEstimateDoc,
  updateCountryFlagDoc,
  updateCountryPlacesDoc,
  updateExpenseDestinationDoc,
  updateJournalDoc,
  updateTripActivitiesDoc,
  updateTripNotesDoc,
  updateTripPackingListDoc,
  updateTripStatusDoc,
  updateUserBudgetDoc,
  updateWishStatusDoc,
} from './lib/journalSync';
import { sortActivitiesChronologically } from './lib/itinerary';
import type {
  BookingRecord,
  BudgetEstimate,
  BudgetTier,
  ContinentName,
  Country,
  ExpenseRecord,
  JournalEntry,
  ModalContext,
  PackingItem,
  PageId,
  SavedTransportRoute,
  TransportMode,
  Trip,
  TripActivity,
  TripStatus,
  VerificationStatus,
  WishItem,
  WishStatus,
} from './types/journal';

const STORAGE_KEY = 'little-world-journal-v1';

interface StoredState {
  countries: Country[];
  trips: Trip[];
  wishes: WishItem[];
  journals: JournalEntry[];
  bookings: BookingRecord[];
  expenses: ExpenseRecord[];
  budgetEstimates: BudgetEstimate[];
  savedRoutes: SavedTransportRoute[];
  budget: number;
}

function loadGuestState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      return {
        countries:
          Array.isArray(parsed.countries) && parsed.countries.length > 0
            ? parsed.countries
            : INITIAL_COUNTRIES,
        trips: Array.isArray(parsed.trips) ? parsed.trips : INITIAL_TRIPS,
        wishes: Array.isArray(parsed.wishes) ? parsed.wishes : INITIAL_WISHES,
        journals: Array.isArray(parsed.journals) ? parsed.journals : INITIAL_JOURNALS,
        bookings: Array.isArray(parsed.bookings) ? parsed.bookings : INITIAL_BOOKINGS,
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : INITIAL_EXPENSES,
        budgetEstimates: Array.isArray(parsed.budgetEstimates) ? parsed.budgetEstimates : [],
        savedRoutes: Array.isArray(parsed.savedRoutes) ? parsed.savedRoutes : [],
        budget: typeof parsed.budget === 'number' ? parsed.budget : INITIAL_BUDGET,
      };
    }
  } catch {
    // Fallback to defaults if localStorage is unavailable or corrupted
  }
  return {
    countries: INITIAL_COUNTRIES,
    trips: INITIAL_TRIPS,
    wishes: INITIAL_WISHES,
    journals: INITIAL_JOURNALS,
    bookings: INITIAL_BOOKINGS,
    expenses: INITIAL_EXPENSES,
    budgetEstimates: [],
    savedRoutes: [],
    budget: INITIAL_BUDGET,
  };
}

const PAGE_LABELS: Record<PageId, string> = {
  dashboard: 'Dashboard',
  'world-map': 'World Map',
  explore: 'Explore World',
  country: 'Country Profile',
  trips: 'My Trips',
  transport: 'Transport Guide',
  bucket: 'Bucket List',
  journal: 'Travel Journal',
  'journal-detail': 'Journal Story',
  bookings: 'Booking Center',
  budget: 'Budget Tracker',
  passport: 'My Passport',
};

const CONTINENT_COORDS: Record<ContinentName, { x: number; y: number }> = {
  Asia: { x: 500, y: 120 },
  Europe: { x: 350, y: 95 },
  'North America': { x: 130, y: 95 },
  'South America': { x: 195, y: 210 },
  Africa: { x: 380, y: 185 },
  Oceania: { x: 580, y: 225 },
  Antarctica: { x: 350, y: 280 },
};

export default function App() {
  const [initial] = useState<StoredState>(loadGuestState);
  const [countries, setCountries] = useState<Country[]>(initial.countries);
  const [trips, setTrips] = useState<Trip[]>(initial.trips);
  const [wishes, setWishes] = useState<WishItem[]>(initial.wishes);
  const [journals, setJournals] = useState<JournalEntry[]>(initial.journals);
  const [bookings, setBookings] = useState<BookingRecord[]>(initial.bookings);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(initial.expenses);
  const [budgetEstimates, setBudgetEstimates] = useState<BudgetEstimate[]>(
    initial.budgetEstimates
  );
  const [savedRoutes, setSavedRoutes] = useState<SavedTransportRoute[]>(
    initial.savedRoutes
  );
  const [budget, setBudget] = useState<number>(initial.budget);

  // Auth & Cloud Sync state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState<string>('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'register'>('signin');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [selectedCountryName, setSelectedCountryName] = useState<string>('Japan');
  const [selectedTripId, setSelectedTripId] = useState<string>(initial.trips[0]?.id || '');
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [journalStartEditing, setJournalStartEditing] = useState<boolean>(false);
  const [modal, setModal] = useState<ModalContext>({ type: null });
  const [toastMsg, setToastMsg] = useState<string>('');
  const [toastVisible, setToastVisible] = useState(false);

  const preferredRegisterNameRef = useRef<string | undefined>(undefined);
  const latestGuestStateRef = useRef<StoredState>(initial);
  const tripsRef = useRef<Trip[]>(trips);
  tripsRef.current = trips;

  useEffect(() => {
    if (!user) {
      latestGuestStateRef.current = {
        countries,
        trips,
        wishes,
        journals,
        bookings,
        expenses,
        budgetEstimates,
        savedRoutes,
        budget,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latestGuestStateRef.current));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [
    user,
    countries,
    trips,
    wishes,
    journals,
    bookings,
    expenses,
    budgetEstimates,
    savedRoutes,
    budget,
  ]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
  }, []);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = window.setTimeout(() => setToastVisible(false), 2600);
    return () => window.clearTimeout(timer);
  }, [toastVisible, toastMsg]);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        try {
          const customName = preferredRegisterNameRef.current;
          preferredRegisterNameRef.current = undefined;
          const { isNewRegistration } = await ensureUserProfileAndSeed(
            nextUser,
            latestGuestStateRef.current,
            customName
          );
          if (isNewRegistration) {
            showToast('Welcome! Your explorer account has been registered.');
          }
        } catch (err) {
          console.error('Error initializing user profile:', err);
        }
      } else {
        setProfileDisplayName('');
        const guest = loadGuestState();
        setCountries(guest.countries);
        setTrips(guest.trips);
        setWishes(guest.wishes);
        setJournals(guest.journals);
        setBookings(guest.bookings);
        setExpenses(guest.expenses);
        setBudgetEstimates(guest.budgetEstimates);
        setSavedRoutes(guest.savedRoutes);
        setBudget(guest.budget);
        setSelectedTripId(guest.trips[0]?.id || '');
      }
    });

    return () => unsubscribe();
  }, [showToast]);

  // Attach Firestore real-time listeners only when auth is ready and user is authenticated & verified
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    const uid = user.uid;
    const userDocPath = `users/${uid}`;
    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.displayName === 'string') {
            setProfileDisplayName(data.displayName);
          }
          if (typeof data.budget === 'number') {
            setBudget(data.budget);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, userDocPath);
      }
    );

    const countriesPath = `users/${uid}/countries`;
    const unsubCountries = onSnapshot(
      query(collection(db, 'users', uid, 'countries'), where('ownerId', '==', uid)),
      (snapshot) => {
        if (snapshot.empty) return;
        const list: Country[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            name: String(data.name || ''),
            flag: String(data.flag || '🏳️'),
            continent: data.continent as ContinentName,
            capital: String(data.capital || ''),
            currency: String(data.currency || ''),
            language: String(data.language || ''),
            season: String(data.season || ''),
            budget: String(data.budget || ''),
            duration: String(data.duration || ''),
            timeZone: String(data.timeZone || ''),
            scene: String(data.scene || 'wander'),
            desc: String(data.desc || ''),
            places: Array.isArray(data.places) ? data.places.map(String) : [],
            dest: Array.isArray(data.dest) ? data.dest.map(String) : [],
            flagged: (data.flagged as Country['flagged']) || 'none',
            mapCoords: data.mapCoords || { x: 350, y: 150 },
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setCountries(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, countriesPath);
      }
    );

    const tripsPath = `users/${uid}/trips`;
    const unsubTrips = onSnapshot(
      query(collection(db, 'users', uid, 'trips'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: Trip[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || ''),
            country: String(data.country || ''),
            date: String(data.date || ''),
            days: Number(data.days || 1),
            status: (data.status as TripStatus) || 'Planning',
            notes: String(data.notes || ''),
            itineraryOverview:
              typeof data.itineraryOverview === 'string'
                ? data.itineraryOverview
                : '',
            activities: Array.isArray(data.activities) ? data.activities : [],
            packingList: Array.isArray(data.packingList) ? data.packingList : [],
          };
        });
        list.sort((a, b) => a.date.localeCompare(b.date));
        setTrips(list);
        setSelectedTripId((curr) =>
          list.some((t) => t.id === curr) ? curr : list[0]?.id || ''
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, tripsPath);
      }
    );

    const wishesPath = `users/${uid}/wishes`;
    const unsubWishes = onSnapshot(
      query(collection(db, 'users', uid, 'wishes'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: WishItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || ''),
            country: String(data.country || ''),
            status: (data.status as WishStatus) || 'Dream destination',
            priority: (data.priority as WishItem['priority']) || 'Medium',
            note: String(data.note || ''),
          };
        });
        setWishes(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, wishesPath);
      }
    );

    const journalsPath = `users/${uid}/journals`;
    const unsubJournals = onSnapshot(
      query(collection(db, 'users', uid, 'journals'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: JournalEntry[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title || ''),
            country: String(data.country || ''),
            date: String(data.date || ''),
            text: String(data.text || ''),
            scene: String(data.scene || 'wander'),
            photoUrl: typeof data.photoUrl === 'string' && data.photoUrl ? data.photoUrl : undefined,
            location: typeof data.location === 'string' && data.location ? data.location : undefined,
            companions: typeof data.companions === 'string' && data.companions ? data.companions : undefined,
            weather: typeof data.weather === 'string' && data.weather ? data.weather : undefined,
            highlights: Array.isArray(data.highlights) ? data.highlights.map(String) : [],
            gallery: Array.isArray(data.gallery) ? data.gallery : [],
            liked: Boolean(data.liked),
          };
        });
        list.sort((a, b) => b.date.localeCompare(a.date));
        setJournals(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, journalsPath);
      }
    );

    const bookingsPath = `users/${uid}/bookings`;
    const unsubBookings = onSnapshot(
      query(collection(db, 'users', uid, 'bookings'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: BookingRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || ''),
            provider: String(data.provider || ''),
            ref: String(data.ref || ''),
            date: String(data.date || ''),
            status: (data.status as BookingRecord['status']) || 'Paid',
            amount: Number(data.amount || 0),
            link: typeof data.link === 'string' ? data.link : undefined,
          };
        });
        setBookings(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, bookingsPath);
      }
    );

    const expensesPath = `users/${uid}/expenses`;
    const unsubExpenses = onSnapshot(
      query(collection(db, 'users', uid, 'expenses'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: ExpenseRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: String(data.name || ''),
            country: typeof data.country === 'string' && data.country ? data.country : undefined,
            destination:
              typeof data.destination === 'string' && data.destination
                ? data.destination
                : undefined,
            category: data.category as ExpenseRecord['category'],
            amount: Number(data.amount || 0),
            date: String(data.date || ''),
          };
        });
        list.sort((a, b) => b.date.localeCompare(a.date));
        setExpenses(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, expensesPath);
      }
    );

    const estimatesPath = `users/${uid}/budgetEstimates`;
    const unsubEstimates = onSnapshot(
      query(collection(db, 'users', uid, 'budgetEstimates'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: BudgetEstimate[] = snapshot.docs.map((d) => {
          const data = d.data();
          const b = (data.breakdown || {}) as Record<string, unknown>;
          return {
            id: d.id,
            title: String(data.title || ''),
            country: String(data.country || 'Japan'),
            destination: String(data.destination || ''),
            travelDate: String(data.travelDate || ''),
            days: Number(data.days || 1),
            travelers: Number(data.travelers || 1),
            preference: (data.preference as BudgetTier) || 'Mid-range / Balanced',
            currency: String(data.currency || 'PHP'),
            breakdown: {
              transportation: Number(b.transportation || 0),
              accommodation: Number(b.accommodation || 0),
              food: Number(b.food || 0),
              activities: Number(b.activities || 0),
              other: Number(b.other || 0),
            },
            notes: String(data.notes || ''),
            aiGenerated: Boolean(data.aiGenerated),
          };
        });
        list.sort((a, b) => a.travelDate.localeCompare(b.travelDate));
        setBudgetEstimates(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, estimatesPath);
      }
    );

    const transportPath = `users/${uid}/transportRoutes`;
    const unsubTransport = onSnapshot(
      query(collection(db, 'users', uid, 'transportRoutes'), where('ownerId', '==', uid)),
      (snapshot) => {
        const list: SavedTransportRoute[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            country: String(data.country || ''),
            city: typeof data.city === 'string' && data.city ? data.city : undefined,
            origin: String(data.origin || ''),
            destination: String(data.destination || ''),
            mode: (data.mode as TransportMode) || 'Multi-Modal',
            operator: String(data.operator || ''),
            departurePoint: String(data.departurePoint || ''),
            arrivalPoint: String(data.arrivalPoint || ''),
            duration: String(data.duration || ''),
            fareLocal: String(data.fareLocal || ''),
            estimatedPhpFare: Number(data.estimatedPhpFare || 0),
            schedule: String(data.schedule || ''),
            bookingUrl:
              typeof data.bookingUrl === 'string' && data.bookingUrl
                ? data.bookingUrl
                : undefined,
            verificationStatus:
              (data.verificationStatus as VerificationStatus) || 'estimated',
            verificationNote:
              typeof data.verificationNote === 'string' && data.verificationNote
                ? data.verificationNote
                : undefined,
            steps: Array.isArray(data.steps) ? data.steps : [],
            sourceLinks: Array.isArray(data.sourceLinks) ? data.sourceLinks : [],
          };
        });
        setSavedRoutes(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, transportPath);
      }
    );

    return () => {
      unsubProfile();
      unsubCountries();
      unsubTrips();
      unsubWishes();
      unsubJournals();
      unsubBookings();
      unsubExpenses();
      unsubEstimates();
      unsubTransport();
    };
  }, [authReady, user]);

  const handleOpenAuth = useCallback((tab: 'signin' | 'register') => {
    setAuthError(null);
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  }, []);

  const handleGoogleAuth = useCallback(
    async (mode: 'signin' | 'register', explorerName?: string) => {
      setAuthError(null);
      setIsAuthenticating(true);
      if (mode === 'register' && explorerName?.trim()) {
        preferredRegisterNameRef.current = explorerName.trim();
      } else {
        preferredRegisterNameRef.current = undefined;
      }

      try {
        const cred = await signInWithPopup(auth, googleProvider);
        setAuthModalOpen(false);
        const nameLabel =
          explorerName?.trim() || cred.user.displayName || cred.user.email || 'Explorer';
        showToast(
          mode === 'register'
            ? `Registered & signed in as ${nameLabel}`
            : `Signed in as ${nameLabel}`
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to complete Google sign-in.';
        if (message.includes('popup-closed-by-user')) {
          setAuthError('Sign-in popup was closed before completing.');
        } else {
          setAuthError(message);
        }
      } finally {
        setIsAuthenticating(false);
      }
    },
    [showToast]
  );

  const handleSignOut = useCallback(async () => {
    setIsAuthenticating(true);
    try {
      await signOut(auth);
      setAuthModalOpen(false);
      setModal({ type: null });
      setActivePage('dashboard');
      showToast('Signed out of your journal');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out.';
      showToast(message);
    } finally {
      setIsAuthenticating(false);
    }
  }, [showToast]);

  const navigateTo = useCallback((page: PageId) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openCountryDetail = useCallback(
    (countryName: string) => {
      setSelectedCountryName(countryName);
      navigateTo('country');
    },
    [navigateTo]
  );

  const openJournalDetail = useCallback(
    (journalId: string | null, startEditing = false) => {
      setSelectedJournalId(journalId);
      setJournalStartEditing(startEditing);
      navigateTo('journal-detail');
    },
    [navigateTo]
  );

  const handleToggleWishCountry = useCallback(
    (countryName: string) => {
      const target = countries.find((c) => c.name === countryName);
      if (!target) return;
      if (target.flagged === 'visited') {
        showToast(`${target.name} is already stamped as visited in your passport`);
        return;
      }
      const next: Country['flagged'] = target.flagged === 'wishlist' ? 'none' : 'wishlist';
      setCountries((prev) =>
        prev.map((c) => (c.name === countryName ? { ...c, flagged: next } : c))
      );
      showToast(
        next === 'wishlist'
          ? `Added ${target.name} to your wishlist`
          : `Removed ${target.name} from wishlist`
      );
      if (user) {
        void updateCountryFlagDoc(user.uid, countryName, next);
      }
    },
    [countries, showToast, user]
  );

  const handleToggleVisited = useCallback(
    (countryName: string) => {
      const target = countries.find((c) => c.name === countryName);
      if (!target) return;
      const next: Country['flagged'] = target.flagged === 'visited' ? 'wishlist' : 'visited';
      setCountries((prev) =>
        prev.map((c) => (c.name === countryName ? { ...c, flagged: next } : c))
      );
      showToast(
        next === 'visited'
          ? `${target.name} stamped in your passport!`
          : `${target.name} moved back to wishlist`
      );
      if (user) {
        void updateCountryFlagDoc(user.uid, countryName, next);
      }
    },
    [countries, showToast, user]
  );

  const handleAddWish = useCallback(
    (placeName: string, countryName: string) => {
      if (wishes.some((w) => w.name.toLowerCase() === placeName.toLowerCase())) {
        showToast(`${placeName} is already in your bucket list`);
        return;
      }
      const newWish: WishItem = {
        id: `wish-${Date.now()}`,
        name: placeName,
        country: countryName,
        status: 'Dream destination',
        priority: 'Medium',
        note: '',
      };
      setWishes((prev) => [newWish, ...prev]);
      showToast(`Added ${placeName} to your bucket list`);
      if (user) {
        void createWishDoc(user.uid, newWish);
      }
    },
    [showToast, user, wishes]
  );

  const activeCountry =
    countries.find((c) => c.name === selectedCountryName) || countries[0];

  const effectiveDisplayName =
    profileDisplayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Little Explorer';

  const toastNode = (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-6 bottom-6 bg-[#27334b] text-white px-4 py-3 rounded-xl text-[13px] font-medium shadow-[0_12px_34px_rgba(39,51,75,0.25)] transition-all duration-200 z-50 pointer-events-none ${
        toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2.5'
      }`}
    >
      {toastMsg}
    </div>
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#fff9ed] text-[#27334b] grid place-items-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-[16px] bg-[#ff826e] grid place-items-center text-[24px] shadow-[0_5px_0_#f2c5b8] mx-auto mb-3">
            🌍
          </div>
          <p className="font-[800] text-[15px] text-[#27334b]">
            The Little World Journal
          </p>
          <p className="text-[12px] text-[#6c7584] mt-1">
            Opening your travel journal...
          </p>
        </div>
      </div>
    );
  }

  if (!user || !user.emailVerified) {
    return (
      <>
        <AuthLandingPage
          unverifiedUser={user && !user.emailVerified ? user : null}
          isAuthenticating={isAuthenticating}
          authError={authError}
          onGoogleAuth={handleGoogleAuth}
          onSignOut={handleSignOut}
        />
        {toastNode}
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#fff9ed] text-[#27334b]">
      <Sidebar
        activePage={activePage}
        user={user}
        displayName={effectiveDisplayName}
        onNavigate={navigateTo}
        onOpenAuth={handleOpenAuth}
        onSignOut={handleSignOut}
      />

      <div className="ml-[72px] md:ml-[248px] w-[calc(100%-72px)] md:w-[calc(100%-248px)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-7 lg:px-10 pt-6 pb-16">
          {/* Top Bar */}
          <header className="flex items-center justify-between gap-4 mb-7">
            <div className="text-[12px] text-[#6c7584] truncate">
              <span className="uppercase tracking-wider">My Space</span>
              <span className="mx-2" aria-hidden="true">/</span>
              <strong className="text-[#27334b] font-bold">
                {activePage === 'country' && activeCountry
                  ? activeCountry.name
                  : activePage === 'journal-detail'
                    ? journals.find((j) => j.id === selectedJournalId)?.title ||
                      'New Journal Story'
                    : PAGE_LABELS[activePage]}
              </strong>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => navigateTo('explore')}
                title="Explore countries"
                aria-label="Explore countries"
                className="w-9 h-9 rounded-xl bg-white border border-[#f0e9dc] grid place-items-center text-[#27334b] hover:border-[#ff826e] transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setModal({ type: 'trip' })}
                title="Plan a new trip"
                aria-label="Plan a new trip"
                className="w-9 h-9 rounded-xl bg-white border border-[#f0e9dc] grid place-items-center text-[#27334b] hover:border-[#ff826e] transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>

              {user ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenAuth('signin')}
                    title={`${effectiveDisplayName} (${user.email || 'Signed in'})`}
                    className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white border border-[#f0e9dc] hover:border-[#ff826e] transition-colors whitespace-nowrap"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={effectiveDisplayName}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <span className="w-7 h-7 rounded-full bg-[#ffd76a] grid place-items-center font-[900] text-[12px] text-[#27334b]">
                        {effectiveDisplayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="hidden sm:inline text-[12px] font-bold text-[#27334b] max-w-[120px] truncate">
                      {effectiveDisplayName}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isAuthenticating}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#fff4f0] border border-[#f5d3ca] text-[#c94a3b] hover:bg-[#ffe8df] text-[12px] font-bold transition-colors whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenAuth('signin')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] hover:border-[#ff826e] text-[12px] font-bold transition-colors whitespace-nowrap shrink-0"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAuth('register')}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#ff826e] text-white hover:bg-[#f47561] text-[12px] font-bold transition-colors whitespace-nowrap shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Register
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Page Views */}
          <main>
            {activePage === 'dashboard' && (
              <DashboardPage
                countries={countries}
                trips={trips}
                wishes={wishes}
                journals={journals}
                onNavigate={navigateTo}
                onSelectCountry={openCountryDetail}
                onSelectTrip={(id) => setSelectedTripId(id)}
                onSelectJournal={(id) => openJournalDetail(id, false)}
                onOpenNewTrip={() => setModal({ type: 'trip' })}
                onToggleJournalLike={(id) => {
                  const target = journals.find((j) => j.id === id);
                  if (!target) return;
                  const nextLiked = !target.liked;
                  setJournals((prev) =>
                    prev.map((j) => (j.id === id ? { ...j, liked: nextLiked } : j))
                  );
                  if (user) {
                    void toggleJournalLikeDoc(user.uid, id, nextLiked);
                  }
                }}
              />
            )}

            {activePage === 'world-map' && (
              <WorldMapPage
                countries={countries}
                trips={trips}
                journals={journals}
                onOpenCountry={openCountryDetail}
                onToggleVisited={handleToggleVisited}
                onToggleWishCountry={handleToggleWishCountry}
                onOpenAddCountry={() => setModal({ type: 'country' })}
                onNavigateExplore={() => navigateTo('explore')}
              />
            )}

            {activePage === 'explore' && (
              <ExplorePage
                countries={countries}
                onSelectCountry={openCountryDetail}
                onToggleWishCountry={handleToggleWishCountry}
                onOpenAddCountry={() => setModal({ type: 'country' })}
              />
            )}

            {activePage === 'country' && activeCountry && (
              <CountryDetailPage
                country={activeCountry}
                wishes={wishes}
                onBack={() => navigateTo('explore')}
                onAddWish={handleAddWish}
                onPlanTripHere={(countryName) =>
                  setModal({ type: 'trip', countryName })
                }
                onToggleVisited={handleToggleVisited}
                onOpenAddDestination={(countryName) =>
                  setModal({ type: 'destination', countryName })
                }
              />
            )}

            {activePage === 'trips' && (
              <TripsPage
                trips={trips}
                countries={countries}
                selectedTripId={selectedTripId}
                onSelectTrip={setSelectedTripId}
                onOpenNewTrip={() => setModal({ type: 'trip' })}
                onUpdateTripStatus={(tripId, status: TripStatus) => {
                  setTrips((prev) =>
                    prev.map((t) => (t.id === tripId ? { ...t, status } : t))
                  );
                  showToast(`Trip status updated to ${status}`);
                  if (user) {
                    void updateTripStatusDoc(user.uid, tripId, status);
                  }
                }}
                onUpdateTripNotes={(tripId, notes) => {
                  setTrips((prev) =>
                    prev.map((t) => (t.id === tripId ? { ...t, notes } : t))
                  );
                  if (user) {
                    void updateTripNotesDoc(user.uid, tripId, notes);
                  }
                }}
                onToggleActivity={(tripId, activityId) => {
                  const target = tripsRef.current.find((t) => t.id === tripId);
                  if (!target) return;
                  const nextActivities = target.activities.map((a) =>
                    a.id === activityId ? { ...a, done: !a.done } : a
                  );
                  const nextTrips = tripsRef.current.map((t) =>
                    t.id === tripId ? { ...t, activities: nextActivities } : t
                  );
                  tripsRef.current = nextTrips;
                  setTrips(nextTrips);
                  if (user) {
                    void updateTripActivitiesDoc(user.uid, tripId, nextActivities);
                  }
                }}
                onDeleteActivity={(tripId, activityId) => {
                  const target = tripsRef.current.find((t) => t.id === tripId);
                  if (!target) return;
                  const nextActivities = target.activities.filter(
                    (a) => a.id !== activityId
                  );
                  const nextTrips = tripsRef.current.map((t) =>
                    t.id === tripId ? { ...t, activities: nextActivities } : t
                  );
                  tripsRef.current = nextTrips;
                  setTrips(nextTrips);
                  if (user) {
                    void updateTripActivitiesDoc(user.uid, tripId, nextActivities);
                  }
                }}
                onSaveItinerary={(tripId, nextActivities: TripActivity[], itineraryOverview?: string) => {
                  const nextTrips = tripsRef.current.map((t) =>
                    t.id === tripId
                      ? {
                          ...t,
                          activities: nextActivities,
                          ...(typeof itineraryOverview === 'string'
                            ? { itineraryOverview }
                            : {}),
                        }
                      : t
                  );
                  tripsRef.current = nextTrips;
                  setTrips(nextTrips);
                  if (user) {
                    void updateTripActivitiesDoc(
                      user.uid,
                      tripId,
                      nextActivities,
                      itineraryOverview
                    );
                  }
                }}
                onMergeItineraryDay={(
                  tripId,
                  dayNum: number,
                  dayActivities: TripActivity[],
                  itineraryOverview?: string
                ) => {
                  const target = tripsRef.current.find((t) => t.id === tripId);
                  if (!target) return;
                  const otherDays = target.activities.filter((a) => {
                    const d = typeof a.day === 'number' && a.day >= 1 ? a.day : 1;
                    return d !== dayNum;
                  });
                  const merged = sortActivitiesChronologically([
                    ...otherDays,
                    ...dayActivities,
                  ]).slice(0, 80);
                  const nextTrips = tripsRef.current.map((t) =>
                    t.id === tripId
                      ? {
                          ...t,
                          activities: merged,
                          ...(typeof itineraryOverview === 'string'
                            ? { itineraryOverview }
                            : {}),
                        }
                      : t
                  );
                  tripsRef.current = nextTrips;
                  setTrips(nextTrips);
                  if (user) {
                    void updateTripActivitiesDoc(
                      user.uid,
                      tripId,
                      merged,
                      itineraryOverview
                    );
                  }
                }}
                onUpdatePackingList={(tripId, packingList: PackingItem[]) => {
                  setTrips((prev) =>
                    prev.map((t) => (t.id === tripId ? { ...t, packingList } : t))
                  );
                  if (user) {
                    void updateTripPackingListDoc(user.uid, tripId, packingList);
                  }
                }}
                onDeleteTrip={(tripId) => {
                  setTrips((prev) => {
                    const next = prev.filter((t) => t.id !== tripId);
                    if (selectedTripId === tripId) {
                      setSelectedTripId(next[0]?.id || '');
                    }
                    return next;
                  });
                  showToast('Trip removed');
                  if (user) {
                    void deleteTripDoc(user.uid, tripId);
                  }
                }}
                onAddTransferExpense={({ country, destination, title, amount, date }) => {
                  if (amount <= 0) return;
                  const newExpense: ExpenseRecord = {
                    id: `exp-transit-${Date.now()}`,
                    name: title.slice(0, 140),
                    country: country.slice(0, 80),
                    destination: destination.slice(0, 120),
                    category: 'Transportation',
                    amount: Math.round(amount),
                    date: date || new Date().toISOString().slice(0, 10),
                  };
                  setExpenses((prev) => [newExpense, ...prev]);
                  if (user) {
                    void createExpenseDoc(user.uid, newExpense);
                  }
                }}
                onNotify={showToast}
              />
            )}

            {activePage === 'transport' && (
              <TransportGuidePage
                countries={countries}
                trips={trips}
                savedRoutes={savedRoutes}
                onSaveRoute={(route) => {
                  const cleanRoute: SavedTransportRoute = {
                    ...route,
                    id: route.id || `route-${Date.now()}`,
                  };
                  setSavedRoutes((prev) => [cleanRoute, ...prev]);
                  showToast(`Saved ${cleanRoute.operator} route`);
                  if (user) {
                    void createTransportRouteDoc(user.uid, cleanRoute);
                  }
                }}
                onDeleteSavedRoute={(routeId) => {
                  setSavedRoutes((prev) => prev.filter((r) => r.id !== routeId));
                  showToast('Saved transport route removed');
                  if (user) {
                    void deleteTransportRouteDoc(user.uid, routeId);
                  }
                }}
                onAddRouteToTripAndBudget={({ route, tripId, day, addToBudget }) => {
                  const targetTrip = tripsRef.current.find((t) => t.id === tripId);
                  if (!targetTrip) return;

                  const stepSummary = route.steps
                    .slice(0, 3)
                    .map((s) => `${s.stepNumber}. ${s.instruction}`)
                    .join(' ');
                  const transitActivity: TripActivity = {
                    id: `act-route-${Date.now()}`,
                    day,
                    timeSlot: '10:00 AM',
                    title: `${route.mode}: ${route.departurePoint} → ${route.arrivalPoint}`,
                    location: `${route.operator}`,
                    category: 'Transit & Logistics',
                    duration: route.duration,
                    costEstimate:
                      route.estimatedPhpFare > 0
                        ? `${route.fareLocal} (~₱${route.estimatedPhpFare.toLocaleString()})`
                        : route.fareLocal,
                    details: `Schedule: ${route.schedule}. ${stepSummary}`.slice(0, 390),
                    done: false,
                  };

                  const nextActivities = sortActivitiesChronologically([
                    ...targetTrip.activities,
                    transitActivity,
                  ]).slice(0, 80);

                  const nextTrips = tripsRef.current.map((t) =>
                    t.id === tripId ? { ...t, activities: nextActivities } : t
                  );
                  tripsRef.current = nextTrips;
                  setTrips(nextTrips);
                  if (user) {
                    void updateTripActivitiesDoc(user.uid, tripId, nextActivities);
                  }

                  if (addToBudget && route.estimatedPhpFare > 0) {
                    const expense: ExpenseRecord = {
                      id: `exp-route-${Date.now()}`,
                      name: `${route.mode}: ${route.origin} → ${route.destination} (${route.operator})`.slice(
                        0,
                        140
                      ),
                      country: route.country.slice(0, 80),
                      destination: (route.city || route.destination).slice(0, 120),
                      category: 'Transportation',
                      amount: Math.round(route.estimatedPhpFare),
                      date: targetTrip.date || new Date().toISOString().slice(0, 10),
                    };
                    setExpenses((prev) => [expense, ...prev]);
                    if (user) {
                      void createExpenseDoc(user.uid, expense);
                    }
                    showToast(
                      `Added route to Day ${day} & logged ₱${expense.amount.toLocaleString()} to Budget`
                    );
                  } else {
                    showToast(`Added ${route.mode} route to ${targetTrip.name} (Day ${day})`);
                  }
                }}
                onNotify={showToast}
              />
            )}

            {activePage === 'bucket' && (
              <BucketListPage
                wishes={wishes}
                countries={countries}
                onOpenAddWish={() => setModal({ type: 'wish' })}
                onUpdateWishStatus={(id, status: WishStatus) => {
                  setWishes((prev) =>
                    prev.map((w) => (w.id === id ? { ...w, status } : w))
                  );
                  showToast(`Updated status to ${status}`);
                  if (user) {
                    void updateWishStatusDoc(user.uid, id, status);
                  }
                }}
                onDeleteWish={(id) => {
                  setWishes((prev) => prev.filter((w) => w.id !== id));
                  showToast('Removed from bucket list');
                  if (user) {
                    void deleteWishDoc(user.uid, id);
                  }
                }}
              />
            )}

            {activePage === 'journal' && (
              <JournalPage
                journals={journals}
                onOpenNewJournal={() => openJournalDetail(null, true)}
                onSelectJournal={(id) => openJournalDetail(id, false)}
                onToggleLike={(id) => {
                  const target = journals.find((j) => j.id === id);
                  if (!target) return;
                  const nextLiked = !target.liked;
                  setJournals((prev) =>
                    prev.map((j) => (j.id === id ? { ...j, liked: nextLiked } : j))
                  );
                  if (user) {
                    void toggleJournalLikeDoc(user.uid, id, nextLiked);
                  }
                }}
                onDeleteJournal={(id) => {
                  setJournals((prev) => prev.filter((j) => j.id !== id));
                  showToast('Journal entry deleted');
                  if (user) {
                    void deleteJournalDoc(user.uid, id);
                  }
                }}
              />
            )}

            {activePage === 'journal-detail' && (
              <JournalDetailPage
                entry={journals.find((j) => j.id === selectedJournalId) || null}
                countries={countries}
                initialEditMode={journalStartEditing}
                onBack={() => navigateTo('journal')}
                onSaveEntry={(entryData, existingId) => {
                  if (existingId) {
                    const updated: JournalEntry = {
                      ...entryData,
                      id: existingId,
                    };
                    setJournals((prev) =>
                      prev.map((j) => (j.id === existingId ? updated : j))
                    );
                    showToast('Journal story & gallery saved');
                    if (user) {
                      void updateJournalDoc(user.uid, updated);
                    }
                    return existingId;
                  }
                  const newId = `journal-${Date.now()}`;
                  const created: JournalEntry = {
                    ...entryData,
                    id: newId,
                  };
                  setJournals((prev) => [created, ...prev]);
                  setSelectedJournalId(newId);
                  setJournalStartEditing(false);
                  showToast('A new memory tucked away');
                  if (user) {
                    void createJournalDoc(user.uid, created);
                  }
                  return newId;
                }}
                onToggleLike={(id) => {
                  const target = journals.find((j) => j.id === id);
                  if (!target) return;
                  const nextLiked = !target.liked;
                  setJournals((prev) =>
                    prev.map((j) => (j.id === id ? { ...j, liked: nextLiked } : j))
                  );
                  if (user) {
                    void toggleJournalLikeDoc(user.uid, id, nextLiked);
                  }
                }}
                onDeleteEntry={(id) => {
                  setJournals((prev) => prev.filter((j) => j.id !== id));
                  showToast('Journal entry deleted');
                  if (user) {
                    void deleteJournalDoc(user.uid, id);
                  }
                  navigateTo('journal');
                }}
                onNotify={showToast}
              />
            )}

            {activePage === 'bookings' && (
              <BookingsPage
                bookings={bookings}
                onOpenAddBooking={() => setModal({ type: 'booking' })}
                onDeleteBooking={(id) => {
                  setBookings((prev) => prev.filter((b) => b.id !== id));
                  showToast('Booking record deleted');
                  if (user) {
                    void deleteBookingDoc(user.uid, id);
                  }
                }}
              />
            )}

            {activePage === 'budget' && (
              <BudgetPage
                budget={budget}
                expenses={expenses}
                countries={countries}
                trips={trips}
                budgetEstimates={budgetEstimates}
                onOpenAddExpense={(defaultCountry) =>
                  setModal({ type: 'expense', countryName: defaultCountry })
                }
                onOpenEditBudget={() => setModal({ type: 'budget' })}
                onUpdateBudget={(newBudget) => {
                  setBudget(newBudget);
                  showToast('Trip budget updated');
                  if (user) {
                    void updateUserBudgetDoc(user.uid, newBudget);
                  }
                }}
                onDeleteExpense={(id) => {
                  setExpenses((prev) => prev.filter((e) => e.id !== id));
                  showToast('Expense removed');
                  if (user) {
                    void deleteExpenseDoc(user.uid, id);
                  }
                }}
                onUpdateExpenseDestination={(expenseId, country, destination) => {
                  setExpenses((prev) =>
                    prev.map((e) =>
                      e.id === expenseId ? { ...e, country, destination } : e
                    )
                  );
                  showToast(`Assigned expense to ${country}`);
                  if (user) {
                    void updateExpenseDestinationDoc(
                      user.uid,
                      expenseId,
                      country,
                      destination
                    );
                  }
                }}
                onSaveBudgetEstimate={(estimate, isUpdate) => {
                  setBudgetEstimates((prev) =>
                    isUpdate
                      ? prev.map((item) => (item.id === estimate.id ? estimate : item))
                      : [estimate, ...prev]
                  );
                  showToast(
                    isUpdate
                      ? 'Budget estimate updated'
                      : 'Budget estimate saved'
                  );
                  if (user) {
                    if (isUpdate) {
                      void updateBudgetEstimateDoc(user.uid, estimate);
                    } else {
                      void createBudgetEstimateDoc(user.uid, estimate);
                    }
                  }
                }}
                onDeleteBudgetEstimate={(id) => {
                  setBudgetEstimates((prev) => prev.filter((item) => item.id !== id));
                  showToast('Saved budget estimate deleted');
                  if (user) {
                    void deleteBudgetEstimateDoc(user.uid, id);
                  }
                }}
                onNotify={showToast}
              />
            )}

            {activePage === 'passport' && (
              <PassportPage
                countries={countries}
                onExploreMore={() => navigateTo('explore')}
                onSelectCountry={openCountryDetail}
              />
            )}
          </main>
        </div>
      </div>

      {/* Journal Creation Modal */}
      <JournalModal
        modal={modal}
        countries={countries}
        trips={trips}
        currentBudget={budget}
        onClose={() => setModal({ type: null })}
        onSaveTrip={(data) => {
          const newTrip: Trip = {
            id: `trip-${Date.now()}`,
            name: data.name,
            country: data.country,
            date: data.date,
            days: data.days,
            status: 'Planning',
            notes: '',
            itineraryOverview: '',
            activities: [],
            packingList: [],
          };
          setTrips((prev) => [...prev, newTrip]);
          setSelectedTripId(newTrip.id);
          showToast('Your new trip is on the map!');
          if (user) {
            void createTripDoc(user.uid, newTrip);
          }
        }}
        onSaveActivity={({ tripId, title }) => {
          const target = trips.find((t) => t.id === tripId);
          if (!target) return;
          const nextActivities = [
            ...target.activities,
            { id: `act-${Date.now()}`, day: 1, title, done: false },
          ];
          setTrips((prev) =>
            prev.map((t) =>
              t.id === tripId ? { ...t, activities: nextActivities } : t
            )
          );
          showToast('Activity added to your itinerary');
          if (user) {
            void updateTripActivitiesDoc(user.uid, tripId, nextActivities);
          }
        }}
        onSaveWish={(data) => {
          const newWish: WishItem = {
            id: `wish-${Date.now()}`,
            ...data,
          };
          setWishes((prev) => [newWish, ...prev]);
          showToast('Dream destination saved');
          if (user) {
            void createWishDoc(user.uid, newWish);
          }
        }}
        onSaveJournal={(data) => {
          const matched = countries.find((c) => c.name === data.country);
          const newEntry: JournalEntry = {
            id: `journal-${Date.now()}`,
            title: data.title,
            country: data.country,
            date: data.date,
            text: data.text,
            scene: matched?.scene || 'wander',
            photoUrl: data.photoUrl,
            liked: true,
          };
          setJournals((prev) => [newEntry, ...prev]);
          showToast('A new memory tucked away');
          if (user) {
            void createJournalDoc(user.uid, newEntry);
          }
        }}
        onSaveBooking={(data) => {
          const newBooking: BookingRecord = {
            id: `booking-${Date.now()}`,
            ...data,
          };
          setBookings((prev) => [newBooking, ...prev]);
          showToast('Booking details saved');
          if (user) {
            void createBookingDoc(user.uid, newBooking);
          }
        }}
        onSaveExpense={(data) => {
          const newExpense: ExpenseRecord = {
            id: `exp-${Date.now()}`,
            ...data,
          };
          setExpenses((prev) => [newExpense, ...prev]);
          showToast(`Expense added to ${data.country}`);
          if (user) {
            void createExpenseDoc(user.uid, newExpense);
          }
        }}
        onSaveBudget={(newBudget) => {
          setBudget(newBudget);
          showToast('Trip budget updated');
          if (user) {
            void updateUserBudgetDoc(user.uid, newBudget);
          }
        }}
        onSaveCountry={(data) => {
          if (
            countries.some((c) => c.name.toLowerCase() === data.name.toLowerCase())
          ) {
            showToast(`${data.name} is already in your explorer`);
            return;
          }
          const newCountry: Country = {
            name: data.name,
            flag: data.flag,
            continent: data.continent,
            capital: data.capital,
            currency: 'Local currency',
            language: 'Local language',
            season: 'Year-round',
            budget: 'Custom budget',
            duration: '7–10 days',
            timeZone: 'Check destination',
            scene: 'wander',
            desc: `Personal travel guide and notes for ${data.name}.`,
            places: [data.capital],
            dest: [`Explore ${data.capital}`],
            flagged: 'wishlist',
            mapCoords: CONTINENT_COORDS[data.continent] || { x: 350, y: 150 },
          };
          setCountries((prev) => [...prev, newCountry]);
          showToast(`${data.name} added to your explorer`);
          if (user) {
            void createCountryDoc(user.uid, newCountry);
          }
        }}
        onSaveDestination={({ name, country, kind }) => {
          const target = countries.find(
            (c) => c.name.toLowerCase() === country.toLowerCase()
          );
          if (!target) return;
          const nextPlaces = target.places.includes(name)
            ? target.places
            : [...target.places, name];
          const nextDest = target.dest.includes(name)
            ? target.dest
            : [...target.dest, name];
          setCountries((prev) =>
            prev.map((c) =>
              c.name === target.name
                ? { ...c, places: nextPlaces, dest: nextDest }
                : c
            )
          );
          showToast(`${name} (${kind}) added to ${country}`);
          if (user) {
            void updateCountryPlacesDoc(user.uid, target.name, nextPlaces, nextDest);
          }
        }}
      />

      {/* Sign in / Register / Account Modal */}
      <AuthModal
        open={authModalOpen}
        initialTab={authModalTab}
        user={user}
        displayName={effectiveDisplayName}
        isAuthenticating={isAuthenticating}
        authError={authError}
        onClose={() => setAuthModalOpen(false)}
        onGoogleAuth={handleGoogleAuth}
        onSignOut={handleSignOut}
      />

      {/* Toast Notification */}
      {toastNode}
    </div>
  );
}
