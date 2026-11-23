import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileDown,
  Loader2,
  Luggage,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import {
  ITINERARY_CATEGORIES,
  ITINERARY_MODE_OPTIONS,
  generateItineraryDay,
  generateItineraryOutline,
  getDayDateLabel,
  getTripDateRangeLabel,
  parseTimeMinutes,
  sortActivitiesChronologically,
} from '../lib/itinerary';
import { generateSmartPackingList, inferTripSeason } from '../lib/packing';
import { fetchTransferSuggestion } from '../lib/transport';
import { exportTripItineraryToPdf } from '../lib/tripPdf';
import type {
  Country,
  DayGenerationInfo,
  DayOutline,
  ItineraryGenerationMode,
  PackingItem,
  TransferSuggestion,
  Trip,
  TripActivity,
} from '../types/journal';

interface TripDetailProps {
  trip: Trip | null;
  trips: Trip[];
  country?: Country;
  onSelectTrip: (tripId: string) => void;
  onUpdateTripNotes: (tripId: string, notes: string) => void;
  onToggleActivity: (tripId: string, activityId: string) => void;
  onDeleteActivity: (tripId: string, activityId: string) => void;
  onSaveItinerary: (
    tripId: string,
    activities: TripActivity[],
    itineraryOverview?: string
  ) => void;
  onMergeItineraryDay?: (
    tripId: string,
    dayNum: number,
    dayActivities: TripActivity[],
    itineraryOverview?: string
  ) => void;
  onUpdatePackingList: (tripId: string, packingList: PackingItem[]) => void;
  onAddTransferExpense?: (params: {
    country: string;
    destination: string;
    title: string;
    amount: number;
    date: string;
  }) => void;
  onNotify?: (message: string) => void;
}

const SEASON_OPTIONS = [
  { value: 'auto', label: 'Auto-detect from trip date & destination' },
  { value: 'Spring', label: 'Spring (mild, breezy, blooming)' },
  { value: 'Summer', label: 'Summer (warm to hot, sunny)' },
  { value: 'Autumn', label: 'Autumn (crisp, layered weather)' },
  { value: 'Winter', label: 'Winter (cold, bundled layers)' },
  { value: 'Dry / Tropical', label: 'Tropical Dry Season (sunny, humid)' },
  { value: 'Wet / Monsoon', label: 'Tropical Wet / Monsoon Season' },
];

interface StopFormState {
  id: string | null;
  day: number;
  timeSlot: string;
  title: string;
  location: string;
  category: string;
  duration: string;
  costEstimate: string;
  details: string;
}

function createEmptyStopForm(defaultDay = 1, defaultLocation = ''): StopFormState {
  return {
    id: null,
    day: defaultDay,
    timeSlot: '09:00 AM',
    title: '',
    location: defaultLocation,
    category: 'Sightseeing',
    duration: '2 hrs',
    costEstimate: '',
    details: '',
  };
}

export const TripDetail: React.FC<TripDetailProps> = ({
  trip,
  trips,
  country,
  onSelectTrip,
  onUpdateTripNotes,
  onToggleActivity,
  onDeleteActivity,
  onSaveItinerary,
  onMergeItineraryDay,
  onUpdatePackingList,
  onAddTransferExpense,
  onNotify,
}) => {
  const detectedSeason = useMemo(
    () => (trip ? inferTripSeason(trip.date, country) : ''),
    [trip, country]
  );

  const [activeTab, setActiveTab] = useState<'itinerary' | 'packing'>('itinerary');

  // Progressive itinerary builder state
  const [generationMode, setGenerationMode] =
    useState<ItineraryGenerationMode>('Balanced');
  const [interests, setInterests] = useState<string>('');
  const [regenStrategy, setRegenStrategy] = useState<'missing' | 'all'>('missing');
  const [isGeneratingItinerary, setIsGeneratingItinerary] = useState<boolean>(false);
  const [generationPhase, setGenerationPhase] = useState<
    'idle' | 'outline' | 'populating' | 'done'
  >('idle');
  const [outlineError, setOutlineError] = useState<string | null>(null);
  const [dayStates, setDayStates] = useState<Record<number, DayGenerationInfo>>({});
  const [targetDaysOrder, setTargetDaysOrder] = useState<number[]>([]);
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');
  const [stopForm, setStopForm] = useState<StopFormState | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // Refs for cancellation & race-free merges
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRunIdRef = useRef<number>(0);
  const tripRef = useRef<Trip | null>(trip);
  tripRef.current = trip;

  // Packing list state
  const [seasonChoice, setSeasonChoice] = useState<string>('auto');
  const [customItemName, setCustomItemName] = useState<string>('');
  const [isGeneratingPacking, setIsGeneratingPacking] = useState<boolean>(false);
  const [packingError, setPackingError] = useState<string | null>(null);
  const [seasonSummaries, setSeasonSummaries] = useState<Record<string, string>>({});

  // Same-day point-to-point transport assistant state
  const [transferSuggestions, setTransferSuggestions] = useState<
    Record<string, TransferSuggestion>
  >({});
  const [transferLoading, setTransferLoading] = useState<Record<string, boolean>>({});
  const [transferErrors, setTransferErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeRunIdRef.current += 1;

    setIsGeneratingItinerary(false);
    setGenerationPhase('idle');
    setOutlineError(null);
    setDayStates({});
    setTargetDaysOrder([]);
    setPackingError(null);
    setSeasonChoice('auto');
    setCustomItemName('');
    setSelectedDayFilter('all');
    setStopForm(null);
    setTransferSuggestions({});
    setTransferLoading({});
    setTransferErrors({});
  }, [trip?.id]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const plannedTotalDays = useMemo(() => {
    if (!trip) return 0;
    return Math.min(14, Math.max(1, trip.days));
  }, [trip]);

  const sortedActivities = useMemo(
    () => (trip ? sortActivitiesChronologically(trip.activities) : []),
    [trip]
  );

  const activitiesByDay = useMemo(() => {
    const map = new Map<number, TripActivity[]>();
    for (const act of sortedActivities) {
      const dayNum = typeof act.day === 'number' && act.day >= 1 ? act.day : 1;
      const list = map.get(dayNum) || [];
      list.push(act);
      map.set(dayNum, list);
    }
    return map;
  }, [sortedActivities]);

  const { existingDayNums, missingDayNums } = useMemo(() => {
    const existing: number[] = [];
    const missing: number[] = [];
    for (let d = 1; d <= plannedTotalDays; d++) {
      if ((activitiesByDay.get(d)?.length || 0) > 0) {
        existing.push(d);
      } else {
        missing.push(d);
      }
    }
    return { existingDayNums: existing, missingDayNums: missing };
  }, [plannedTotalDays, activitiesByDay]);

  // Keep regenStrategy sensible if trip has missing days vs none
  useEffect(() => {
    if (!trip) return;
    if (trip.activities.length === 0) {
      setRegenStrategy('all');
    } else if (missingDayNums.length > 0) {
      setRegenStrategy('missing');
    }
  }, [trip?.id, trip?.activities.length, missingDayNums.length]);

  const dayTabs = useMemo(() => {
    if (!trip) return [];
    const maxActDay = sortedActivities.reduce(
      (max, a) => Math.max(max, typeof a.day === 'number' && a.day >= 1 ? a.day : 1),
      1
    );
    const maxStateDay = Object.keys(dayStates).reduce(
      (max, key) => Math.max(max, Number(key) || 1),
      1
    );
    const total = Math.min(
      21,
      Math.max(1, plannedTotalDays, maxActDay, maxStateDay)
    );
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }, [trip, sortedActivities, dayStates, plannedTotalDays]);

  const visibleDays = useMemo(() => {
    if (selectedDayFilter !== 'all') {
      return [selectedDayFilter];
    }

    const hasGenerationState = Object.keys(dayStates).length > 0;
    if (hasGenerationState) {
      return dayTabs;
    }

    const populatedDays = Array.from(activitiesByDay.keys()).sort((a, b) => a - b);
    return populatedDays;
  }, [selectedDayFilter, dayStates, dayTabs, activitiesByDay]);

  const packingList = trip?.packingList || [];
  const packedCount = packingList.filter((item) => item.packed).length;

  const groupedPacking = useMemo(() => {
    const groups = new Map<string, PackingItem[]>();
    for (const item of packingList) {
      const cat = item.category || 'Essentials';
      const existing = groups.get(cat) || [];
      existing.push(item);
      groups.set(cat, existing);
    }
    return Array.from(groups.entries());
  }, [packingList]);

  // Progress calculation
  const progressMetrics = useMemo(() => {
    const total = targetDaysOrder.length;
    if (total === 0) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        generatingDays: [] as number[],
        percent: 0,
      };
    }
    let completed = 0;
    let failed = 0;
    const generatingDays: number[] = [];
    for (const d of targetDaysOrder) {
      const st = dayStates[d]?.status;
      if (st === 'completed') completed += 1;
      else if (st === 'error') failed += 1;
      else if (st === 'generating') generatingDays.push(d);
    }
    const percent = Math.round(((completed + failed) / total) * 100);
    return { total, completed, failed, generatingDays, percent };
  }, [targetDaysOrder, dayStates]);

  if (!trip) {
    return (
      <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5 min-w-0">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="font-[800] text-[15px] text-[#27334b]">Trip itinerary 📝</h3>
        </div>
        <div className="p-8 text-center text-[#6c7584] text-[13px] bg-white border border-dashed border-[#e9dfd1] rounded-[15px]">
          Create a trip to build your day-by-day itinerary, smart packing list, and PDF export.
        </div>
      </div>
    );
  }

  const effectiveSeason =
    seasonChoice === 'auto' ? detectedSeason : seasonChoice;

  const commitDayStops = (
    targetTripId: string,
    dayNum: number,
    newStops: TripActivity[],
    overview?: string
  ) => {
    if (onMergeItineraryDay) {
      onMergeItineraryDay(targetTripId, dayNum, newStops, overview);
      return;
    }
    const latest = tripRef.current;
    if (!latest || latest.id !== targetTripId) return;
    const otherDays = latest.activities.filter((a) => {
      const d = typeof a.day === 'number' && a.day >= 1 ? a.day : 1;
      return d !== dayNum;
    });
    const merged = sortActivitiesChronologically([...otherDays, ...newStops]).slice(0, 80);
    onSaveItinerary(targetTripId, merged, overview);
  };

  const populateDaysBatch = async (
    runId: number,
    targetTrip: Trip,
    daysToRun: number[],
    outlinesByDay: Map<number, DayOutline>,
    mode: ItineraryGenerationMode,
    controller: AbortController,
    overviewToSave?: string
  ) => {
    const modeMeta =
      ITINERARY_MODE_OPTIONS.find((m) => m.value === mode) ||
      ITINERARY_MODE_OPTIONS[1];
    const concurrency = modeMeta.concurrency;

    let cursor = 0;
    let firstOverviewApplied = false;

    const runWorker = async () => {
      while (cursor < daysToRun.length) {
        if (controller.signal.aborted || activeRunIdRef.current !== runId) return;
        const idx = cursor;
        cursor += 1;
        const dayNum = daysToRun[idx];

        setDayStates((prev) => ({
          ...prev,
          [dayNum]: {
            day: dayNum,
            status: 'generating',
            outline: prev[dayNum]?.outline || outlinesByDay.get(dayNum),
          },
        }));

        const latestActivities = tripRef.current?.activities || targetTrip.activities;
        const avoidTitles = latestActivities
          .filter((a) => (typeof a.day === 'number' ? a.day : 1) !== dayNum)
          .map((a) => a.title)
          .slice(0, 18);

        try {
          const dayResult = await generateItineraryDay(
            {
              tripName: targetTrip.name,
              country: targetTrip.country,
              date: targetTrip.date,
              day: dayNum,
              totalDays: targetTrip.days,
              mode,
              dayOutline: outlinesByDay.get(dayNum),
              season: detectedSeason,
              interests: interests.trim() || undefined,
              notes: targetTrip.notes,
              avoidTitles,
            },
            controller.signal
          );

          if (controller.signal.aborted || activeRunIdRef.current !== runId) return;

          const stamp = Date.now();
          const formattedStops: TripActivity[] = dayResult.items.map((item, stopIdx) => ({
            id: `act-${stamp}-d${dayNum}-${stopIdx}`,
            day: dayNum,
            timeSlot: item.timeSlot,
            title: item.title,
            location: item.location,
            category: item.category,
            duration: item.duration,
            costEstimate: item.costEstimate,
            details: item.details,
            done: false,
          }));

          const overviewArg = !firstOverviewApplied ? overviewToSave : undefined;
          firstOverviewApplied = true;
          commitDayStops(targetTrip.id, dayNum, formattedStops, overviewArg);

          setDayStates((prev) => ({
            ...prev,
            [dayNum]: {
              day: dayNum,
              status: 'completed',
              outline: prev[dayNum]?.outline || outlinesByDay.get(dayNum),
            },
          }));
        } catch (err) {
          if (
            controller.signal.aborted ||
            (err instanceof Error && err.name === 'AbortError')
          ) {
            return;
          }
          const message =
            err instanceof Error
              ? err.message
              : `Could not generate Day ${dayNum}.`;
          setDayStates((prev) => ({
            ...prev,
            [dayNum]: {
              day: dayNum,
              status: 'error',
              outline: prev[dayNum]?.outline || outlinesByDay.get(dayNum),
              error: message,
            },
          }));
        }
      }
    };

    const workerCount = Math.min(concurrency, daysToRun.length);
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  };

  const handleStartProgressiveGeneration = async (forceAll = false) => {
    if (isGeneratingItinerary) return;

    const targetTrip = tripRef.current;
    if (!targetTrip) return;

    const effectiveStrategy = forceAll
      ? 'all'
      : targetTrip.activities.length === 0
        ? 'all'
        : regenStrategy;

    const daysToGenerate =
      effectiveStrategy === 'missing'
        ? missingDayNums
        : Array.from({ length: plannedTotalDays }, (_, i) => i + 1);

    if (daysToGenerate.length === 0) {
      onNotify?.(
        'All days already have itinerary stops. Switch to "Regenerate all days" or refresh an individual day.'
      );
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const runId = activeRunIdRef.current + 1;
    activeRunIdRef.current = runId;

    setIsGeneratingItinerary(true);
    setGenerationPhase('outline');
    setOutlineError(null);
    setSelectedDayFilter('all');
    setTargetDaysOrder(daysToGenerate);

    // Initialize day status map immediately
    const initialStates: Record<number, DayGenerationInfo> = {};
    for (let d = 1; d <= plannedTotalDays; d++) {
      const isTargeted = daysToGenerate.includes(d);
      initialStates[d] = {
        day: d,
        status: isTargeted ? 'queued' : 'completed',
        preserved: !isTargeted,
      };
    }
    setDayStates(initialStates);

    try {
      const existingDaysSummary =
        effectiveStrategy === 'missing'
          ? existingDayNums.map((d) => ({
              day: d,
              titles: (activitiesByDay.get(d) || []).map((a) => a.title).slice(0, 6),
            }))
          : undefined;

      const outlineRes = await generateItineraryOutline(
        {
          tripName: targetTrip.name,
          country: targetTrip.country,
          date: targetTrip.date,
          days: targetTrip.days,
          season: detectedSeason,
          places: country?.places,
          dest: country?.dest,
          mode: generationMode,
          interests: interests.trim() || undefined,
          notes: targetTrip.notes,
          existingDays: existingDaysSummary,
        },
        controller.signal
      );

      if (controller.signal.aborted || activeRunIdRef.current !== runId) return;

      const outlinesByDay = new Map<number, DayOutline>();
      outlineRes.dayOutlines.forEach((o) => outlinesByDay.set(o.day, o));

      setDayStates((prev) => {
        const next = { ...prev };
        for (let d = 1; d <= plannedTotalDays; d++) {
          next[d] = {
            ...(next[d] || { day: d, status: 'queued' }),
            outline: outlinesByDay.get(d),
          };
        }
        return next;
      });

      const overviewToSave =
        effectiveStrategy === 'all' || !targetTrip.itineraryOverview?.trim()
          ? outlineRes.overview
          : targetTrip.itineraryOverview;

      // Save overview immediately while preserving existing activities if strategy is missing
      if (overviewToSave && effectiveStrategy === 'all') {
        onSaveItinerary(targetTrip.id, [], overviewToSave);
      } else if (overviewToSave && !targetTrip.itineraryOverview?.trim()) {
        onSaveItinerary(targetTrip.id, targetTrip.activities, overviewToSave);
      }

      setGenerationPhase('populating');

      await populateDaysBatch(
        runId,
        targetTrip,
        daysToGenerate,
        outlinesByDay,
        generationMode,
        controller,
        overviewToSave
      );

      if (!controller.signal.aborted && activeRunIdRef.current === runId) {
        setGenerationPhase('done');
        onNotify?.(`Itinerary ready for ${targetTrip.name}`);
      }
    } catch (err) {
      if (
        controller.signal.aborted ||
        (err instanceof Error && err.name === 'AbortError')
      ) {
        return;
      }
      setOutlineError(
        err instanceof Error
          ? err.message
          : 'Could not start itinerary generation. Please try again.'
      );
      setGenerationPhase('idle');
    } finally {
      if (activeRunIdRef.current === runId) {
        setIsGeneratingItinerary(false);
      }
    }
  };

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeRunIdRef.current += 1;
    setIsGeneratingItinerary(false);
    setGenerationPhase('done');
    setDayStates((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        const dayNum = Number(key);
        if (next[dayNum].status === 'generating' || next[dayNum].status === 'queued') {
          next[dayNum] = {
            ...next[dayNum],
            status: 'idle',
          };
        }
      }
      return next;
    });
    onNotify?.('Stopped generating remaining days — completed days were kept.');
  };

  const handleRetryOrRefreshSingleDay = async (dayNum: number) => {
    const targetTrip = tripRef.current;
    if (!targetTrip) return;

    const controller = new AbortController();
    const runId = activeRunIdRef.current;

    const existingOutline = dayStates[dayNum]?.outline || {
      day: dayNum,
      theme: `Day ${dayNum} in ${targetTrip.country}`,
      area: country?.places?.[dayNum - 1] || targetTrip.country,
      highlights: [],
    };

    setDayStates((prev) => ({
      ...prev,
      [dayNum]: {
        day: dayNum,
        status: 'generating',
        outline: existingOutline,
      },
    }));

    if (!targetDaysOrder.includes(dayNum)) {
      setTargetDaysOrder((prev) => [...prev, dayNum].sort((a, b) => a - b));
    }

    const avoidTitles = (tripRef.current?.activities || [])
      .filter((a) => (typeof a.day === 'number' ? a.day : 1) !== dayNum)
      .map((a) => a.title)
      .slice(0, 18);

    try {
      const dayResult = await generateItineraryDay(
        {
          tripName: targetTrip.name,
          country: targetTrip.country,
          date: targetTrip.date,
          day: dayNum,
          totalDays: targetTrip.days,
          mode: generationMode,
          dayOutline: existingOutline,
          season: detectedSeason,
          interests: interests.trim() || undefined,
          notes: targetTrip.notes,
          avoidTitles,
        },
        controller.signal
      );

      if (activeRunIdRef.current !== runId && isGeneratingItinerary) return;

      const stamp = Date.now();
      const formattedStops: TripActivity[] = dayResult.items.map((item, idx) => ({
        id: `act-${stamp}-d${dayNum}-${idx}`,
        day: dayNum,
        timeSlot: item.timeSlot,
        title: item.title,
        location: item.location,
        category: item.category,
        duration: item.duration,
        costEstimate: item.costEstimate,
        details: item.details,
        done: false,
      }));

      commitDayStops(targetTrip.id, dayNum, formattedStops);
      setDayStates((prev) => ({
        ...prev,
        [dayNum]: {
          day: dayNum,
          status: 'completed',
          outline: existingOutline,
        },
      }));
      onNotify?.(`Day ${dayNum} updated`);
    } catch (err) {
      setDayStates((prev) => ({
        ...prev,
        [dayNum]: {
          day: dayNum,
          status: 'error',
          outline: existingOutline,
          error:
            err instanceof Error ? err.message : `Failed to generate Day ${dayNum}.`,
        },
      }));
    }
  };

  const handleRetryAllFailedDays = async () => {
    const failedNums = targetDaysOrder.filter(
      (d) => dayStates[d]?.status === 'error'
    );
    if (failedNums.length === 0 || isGeneratingItinerary) return;

    const targetTrip = tripRef.current;
    if (!targetTrip) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const runId = activeRunIdRef.current + 1;
    activeRunIdRef.current = runId;

    setIsGeneratingItinerary(true);
    setGenerationPhase('populating');

    const outlinesMap = new Map<number, DayOutline>();
    for (const d of failedNums) {
      if (dayStates[d]?.outline) {
        outlinesMap.set(d, dayStates[d].outline as DayOutline);
      }
      setDayStates((prev) => ({
        ...prev,
        [d]: {
          ...prev[d],
          day: d,
          status: 'queued',
          error: undefined,
        },
      }));
    }

    await populateDaysBatch(
      runId,
      targetTrip,
      failedNums,
      outlinesMap,
      generationMode,
      controller
    );

    if (!controller.signal.aborted && activeRunIdRef.current === runId) {
      setIsGeneratingItinerary(false);
      setGenerationPhase('done');
    }
  };

  const handleDownloadPdf = () => {
    setIsExportingPdf(true);
    try {
      exportTripItineraryToPdf(trip, country);
      onNotify?.(`Downloaded PDF itinerary for ${trip.name}`);
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : 'Unable to export trip PDF.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleOpenAddStop = (dayNum = 1) => {
    setStopForm(
      createEmptyStopForm(
        dayNum,
        dayStates[dayNum]?.outline?.area ||
          country?.capital ||
          country?.places?.[0] ||
          trip.country
      )
    );
  };

  const handleOpenEditStop = (act: TripActivity) => {
    setStopForm({
      id: act.id,
      day: typeof act.day === 'number' && act.day >= 1 ? act.day : 1,
      timeSlot: act.timeSlot || '09:00 AM',
      title: act.title,
      location: act.location || '',
      category: act.category || 'Sightseeing',
      duration: act.duration || '',
      costEstimate: act.costEstimate || '',
      details: act.details || '',
    });
  };

  const triggerTransferSuggestion = async (
    dayNum: number,
    fromStop: TripActivity,
    toStop: TripActivity
  ) => {
    const targetTrip = tripRef.current;
    if (!targetTrip) return;
    const pairKey = `${fromStop.id}->${toStop.id}`;

    setTransferLoading((prev) => ({ ...prev, [pairKey]: true }));
    setTransferErrors((prev) => {
      const next = { ...prev };
      delete next[pairKey];
      return next;
    });

    try {
      const suggestion = await fetchTransferSuggestion({
        country: targetTrip.country,
        day: dayNum,
        fromActivityId: fromStop.id,
        toActivityId: toStop.id,
        fromTitle: fromStop.title,
        fromLocation: fromStop.location,
        toTitle: toStop.title,
        toLocation: toStop.location,
        date: targetTrip.date,
      });

      if (tripRef.current?.id !== targetTrip.id) return;
      setTransferSuggestions((prev) => ({ ...prev, [pairKey]: suggestion }));
    } catch (err) {
      if (tripRef.current?.id !== targetTrip.id) return;
      setTransferErrors((prev) => ({
        ...prev,
        [pairKey]:
          err instanceof Error ? err.message : 'Unable to estimate transport between stops.',
      }));
    } finally {
      setTransferLoading((prev) => ({ ...prev, [pairKey]: false }));
    }
  };

  const formatMinutesToTimeSlot = (totalMins: number): string => {
    const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMins)));
    const h24 = Math.floor(clamped / 60);
    const m = clamped % 60;
    const meridiem = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${meridiem}`;
  };

  const handleApplyTransferToDayAndBudget = (
    pairKey: string,
    fromStop: TripActivity,
    toStop: TripActivity,
    suggestion: TransferSuggestion
  ) => {
    const latest = tripRef.current;
    if (!latest) return;

    const fromMins = parseTimeMinutes(fromStop.timeSlot);
    const toMins = parseTimeMinutes(toStop.timeSlot);
    const midMins = Math.round((fromMins + toMins) / 2);
    const stepSummary = suggestion.steps
      .slice(0, 3)
      .map((s) => `${s.stepNumber}. ${s.instruction}`)
      .join(' ');

    const transitStop: TripActivity = {
      id: `act-transit-${Date.now()}`,
      day: suggestion.day,
      timeSlot: formatMinutesToTimeSlot(midMins),
      title: `${suggestion.recommendedMode}: ${suggestion.departurePoint} → ${suggestion.arrivalPoint}`,
      location: `${suggestion.operator}`,
      category: 'Transit & Logistics',
      duration: suggestion.duration,
      costEstimate:
        suggestion.estimatedPhpFare > 0
          ? `${suggestion.fareLocal} (~₱${suggestion.estimatedPhpFare.toLocaleString()})`
          : suggestion.fareLocal,
      details: `${suggestion.summary}${stepSummary ? ` Steps: ${stepSummary}` : ''}`.slice(
        0,
        390
      ),
      done: false,
    };

    const nextList = sortActivitiesChronologically([...latest.activities, transitStop]);
    onSaveItinerary(latest.id, nextList);

    if (onAddTransferExpense && suggestion.estimatedPhpFare > 0) {
      onAddTransferExpense({
        country: latest.country,
        destination: toStop.location || fromStop.location || latest.country,
        title: `Transit: ${fromStop.title} → ${toStop.title} (${suggestion.operator})`,
        amount: suggestion.estimatedPhpFare,
        date: latest.date || new Date().toISOString().slice(0, 10),
      });
    }

    setTransferSuggestions((prev) => {
      const next = { ...prev };
      delete next[pairKey];
      return next;
    });
    onNotify?.(
      suggestion.estimatedPhpFare > 0
        ? `Added ${suggestion.recommendedMode} to Day ${suggestion.day} & logged ₱${suggestion.estimatedPhpFare.toLocaleString()} to Budget`
        : `Added ${suggestion.recommendedMode} transfer to Day ${suggestion.day}`
    );
  };

  const handleDismissTransfer = (pairKey: string) => {
    setTransferSuggestions((prev) => {
      const next = { ...prev };
      delete next[pairKey];
      return next;
    });
    setTransferErrors((prev) => {
      const next = { ...prev };
      delete next[pairKey];
      return next;
    });
  };

  const handleSubmitStopForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopForm || !stopForm.title.trim()) return;

    const latest = tripRef.current || trip;
    const isNewStop = !stopForm.id;
    const cleanDay = Math.max(1, Math.min(365, Math.round(Number(stopForm.day) || 1)));
    const payload: TripActivity = {
      id: stopForm.id || `act-${Date.now()}`,
      day: cleanDay,
      timeSlot: stopForm.timeSlot.trim() || undefined,
      title: stopForm.title.trim().slice(0, 140),
      location: stopForm.location.trim() || undefined,
      category: stopForm.category || 'Activity',
      duration: stopForm.duration.trim() || undefined,
      costEstimate: stopForm.costEstimate.trim() || undefined,
      details: stopForm.details.trim() || undefined,
      done: stopForm.id
        ? Boolean(latest.activities.find((a) => a.id === stopForm.id)?.done)
        : false,
    };

    const nextList = stopForm.id
      ? latest.activities.map((a) => (a.id === stopForm.id ? payload : a))
      : [...latest.activities, payload];

    const sortedNext = sortActivitiesChronologically(nextList);
    onSaveItinerary(latest.id, sortedNext);
    setStopForm(null);
    onNotify?.(stopForm.id ? 'Itinerary stop updated' : 'Stop added to itinerary');

    // Auto-suggest how to travel between two destinations added to the same day
    if (isNewStop && payload.category !== 'Transit & Logistics') {
      const sameDayDestinations = sortedNext.filter((a) => {
        const d = typeof a.day === 'number' && a.day >= 1 ? a.day : 1;
        return d === cleanDay && a.category !== 'Transit & Logistics';
      });
      if (sameDayDestinations.length >= 2) {
        const idx = sameDayDestinations.findIndex((a) => a.id === payload.id);
        if (idx > 0) {
          void triggerTransferSuggestion(
            cleanDay,
            sameDayDestinations[idx - 1],
            payload
          );
        } else if (idx === 0 && sameDayDestinations[1]) {
          void triggerTransferSuggestion(
            cleanDay,
            payload,
            sameDayDestinations[1]
          );
        }
      }
    }
  };

  const handleGeneratePackingList = async () => {
    setIsGeneratingPacking(true);
    setPackingError(null);

    try {
      const result = await generateSmartPackingList({
        tripName: trip.name,
        country: trip.country,
        date: trip.date,
        days: trip.days,
        season: effectiveSeason,
        countrySeasonGuide: country?.season,
        activities: trip.activities.map((a) => a.title),
        notes: trip.notes,
      });

      const baseTimestamp = Date.now();
      const generatedItems: PackingItem[] = result.items.map((item, idx) => ({
        id: `pack-${baseTimestamp}-${idx}`,
        name: item.name,
        category: item.category || 'Essentials',
        reason: item.reason,
        packed: false,
      }));

      const existingByName = new Map(
        packingList.map((i) => [i.name.toLowerCase(), i.packed])
      );
      const mergedItems = generatedItems.map((item) => ({
        ...item,
        packed: existingByName.get(item.name.toLowerCase()) ?? false,
      }));

      onUpdatePackingList(trip.id, mergedItems);
      if (result.seasonSummary) {
        setSeasonSummaries((prev) => ({
          ...prev,
          [trip.id]: result.seasonSummary,
        }));
      }
    } catch (err) {
      setPackingError(
        err instanceof Error
          ? err.message
          : 'Failed to generate smart packing suggestions.'
      );
    } finally {
      setIsGeneratingPacking(false);
    }
  };

  const handleTogglePackingItem = (itemId: string) => {
    const next = packingList.map((item) =>
      item.id === itemId ? { ...item, packed: !item.packed } : item
    );
    onUpdatePackingList(trip.id, next);
  };

  const handleDeletePackingItem = (itemId: string) => {
    const next = packingList.filter((item) => item.id !== itemId);
    onUpdatePackingList(trip.id, next);
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customItemName.trim();
    if (!trimmed) return;
    const newItem: PackingItem = {
      id: `pack-${Date.now()}`,
      name: trimmed,
      category: 'Personal Extras',
      reason: 'Added by traveler',
      packed: false,
    };
    onUpdatePackingList(trip.id, [...packingList, newItem]);
    setCustomItemName('');
  };

  const handleClearPackingList = () => {
    onUpdatePackingList(trip.id, []);
    setSeasonSummaries((prev) => {
      const next = { ...prev };
      delete next[trip.id];
      return next;
    });
  };

  const activeSummary = seasonSummaries[trip.id];
  const completedCount = trip.activities.filter((a) => a.done).length;
  const showProgressBanner =
    isGeneratingItinerary ||
    progressMetrics.failed > 0 ||
    (generationPhase === 'done' && progressMetrics.total > 0);

  return (
    <div
      className="bg-white border border-[#f0e9dc] rounded-[18px] p-5 min-w-0"
      aria-label="Trip detail view"
    >
      {/* Top Header + PDF Export */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-[900] text-[18px] text-[#27334b] leading-tight">
              {trip.name}
            </h3>
            <span className="inline-block px-2 py-0.5 rounded-md bg-[#fff4f0] text-[#c95b4b] text-[10px] font-extrabold uppercase tracking-wider">
              {trip.status}
            </span>
          </div>
          <p className="text-[12px] text-[#6c7584] mt-1 tabular-nums">
            {country?.flag || '✈️'} {trip.country} ·{' '}
            {getTripDateRangeLabel(trip.date, trip.days)} · {trip.days}{' '}
            {trip.days === 1 ? 'day' : 'days'} · {detectedSeason}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isExportingPdf}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#27334b] text-white hover:bg-[#1e283c] text-[12px] font-bold transition-colors disabled:opacity-60 shrink-0 whitespace-nowrap"
        >
          <FileDown className="w-3.5 h-3.5" />
          {isExportingPdf ? 'Preparing PDF...' : 'Download PDF'}
        </button>
      </div>

      {/* Trip Switcher */}
      <div className="mb-4">
        <label
          htmlFor="active-trip-select"
          className="block text-[11px] font-bold text-[#5a6578] mb-1"
        >
          Selected trip
        </label>
        <select
          id="active-trip-select"
          value={trip.id}
          onChange={(e) => onSelectTrip(e.target.value)}
          className="w-full border border-[#f0e9dc] rounded-[11px] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#27334b] outline-none focus:border-[#ff826e]"
        >
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.country} · {t.days}d)
            </option>
          ))}
        </select>
      </div>

      {/* Section Tabs */}
      <div className="flex items-center gap-2 border-b border-[#f0e9dc] pb-3 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('itinerary')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-colors whitespace-nowrap ${
            activeTab === 'itinerary'
              ? 'bg-[#ff826e] text-white shadow-[0_2px_0_#efb6a9]'
              : 'bg-[#fff9ed] text-[#5a6578] hover:text-[#27334b] border border-[#f0e9dc]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Detailed Itinerary ({trip.activities.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('packing')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-colors whitespace-nowrap ${
            activeTab === 'packing'
              ? 'bg-[#ff826e] text-white shadow-[0_2px_0_#efb6a9]'
              : 'bg-[#fff9ed] text-[#5a6578] hover:text-[#27334b] border border-[#f0e9dc]'
          }`}
        >
          <Luggage className="w-3.5 h-3.5" />
          Packing &amp; Notes ({packingList.length})
        </button>
      </div>

      {/* TAB 1: PROGRESSIVE DETAILED ITINERARY */}
      {activeTab === 'itinerary' && (
        <div>
          {/* Itinerary Overview Banner */}
          {trip.itineraryOverview && (
            <div className="bg-[#f4fafd] border border-[#dcecf5] rounded-xl px-3.5 py-2.5 mb-3.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#3a6e8f] mb-0.5">
                Route overview
              </div>
              <p className="text-[12px] text-[#27334b] leading-relaxed">
                {trip.itineraryOverview}
              </p>
            </div>
          )}

          {/* Progressive Itinerary Builder */}
          <div className="bg-[#fffaf2] border border-[#f0e9dc] rounded-xl p-3.5 mb-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#d66654]" />
                <h4 className="font-[800] text-[13px] text-[#27334b]">
                  AI progressive itinerary planner
                </h4>
              </div>
              {trip.activities.length > 0 && (
                <span className="text-[11px] font-bold text-[#458a68] tabular-nums">
                  {completedCount}/{trip.activities.length} done
                </span>
              )}
            </div>

            {/* 3 Generation Mode Options */}
            <div>
              <span className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider mb-1.5">
                Generation mode
              </span>
              <div
                className="grid grid-cols-1 sm:grid-cols-3 gap-2"
                role="radiogroup"
                aria-label="Itinerary generation mode"
              >
                {ITINERARY_MODE_OPTIONS.map((opt) => {
                  const selected = generationMode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={isGeneratingItinerary}
                      onClick={() => setGenerationMode(opt.value)}
                      className={`text-left rounded-xl p-2.5 border transition-all disabled:opacity-60 ${
                        selected
                          ? 'bg-white border-[#ff826e] shadow-[0_2px_0_#f7d0c7]'
                          : 'bg-[#fffdf9] border-[#e8dfd0] hover:border-[#d6cfc3]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <strong className="text-[12px] font-[800] text-[#27334b]">
                          {opt.label}
                        </strong>
                        <span
                          className={`text-[10px] font-bold ${
                            selected ? 'text-[#d65442]' : 'text-[#6c7584]'
                          }`}
                        >
                          {opt.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6c7584] mt-0.5 leading-snug">
                        {opt.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interests Input */}
            <div>
              <label
                htmlFor="itinerary-interests-input"
                className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider mb-1"
              >
                Interests or focus (optional)
              </label>
              <input
                id="itinerary-interests-input"
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                disabled={isGeneratingItinerary}
                placeholder="e.g. street food, temples, hidden coffee shops, sunset viewpoints..."
                maxLength={200}
                className="w-full border border-[#e8dfd0] rounded-lg bg-white px-3 py-2 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e] disabled:opacity-60"
              />
            </div>

            {/* Existing Data Preservation Option */}
            {trip.activities.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-[#efe7d8] rounded-lg px-3 py-2">
                <div className="text-[11px] text-[#5a6578]">
                  {missingDayNums.length > 0 ? (
                    <span>
                      <strong className="text-[#27334b]">
                        {existingDayNums.length}
                      </strong>{' '}
                      of {plannedTotalDays} days already have stops ·{' '}
                      <strong className="text-[#d65442]">
                        {missingDayNums.length}
                      </strong>{' '}
                      missing day{missingDayNums.length === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <span>
                      All <strong className="text-[#27334b]">{plannedTotalDays}</strong>{' '}
                      days already have planned stops (preserving existing data).
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-[11px] font-bold">
                  {missingDayNums.length > 0 && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#27334b]">
                      <input
                        type="radio"
                        name="regen-strategy"
                        checked={regenStrategy === 'missing'}
                        disabled={isGeneratingItinerary}
                        onChange={() => setRegenStrategy('missing')}
                        className="text-[#ff826e] focus:ring-[#ff826e]"
                      />
                      Fill missing days
                    </label>
                  )}
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[#5a6578]">
                    <input
                      type="radio"
                      name="regen-strategy"
                      checked={regenStrategy === 'all'}
                      disabled={isGeneratingItinerary}
                      onChange={() => setRegenStrategy('all')}
                      className="text-[#ff826e] focus:ring-[#ff826e]"
                    />
                    Regenerate all days
                  </label>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                {!isGeneratingItinerary ? (
                  <button
                    type="button"
                    onClick={() => void handleStartProgressiveGeneration(false)}
                    disabled={
                      trip.activities.length > 0 &&
                      missingDayNums.length === 0 &&
                      regenStrategy === 'missing'
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ff826e] text-white text-[12px] font-bold shadow-[0_3px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all disabled:opacity-50 whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {trip.activities.length === 0
                      ? `Generate ${generationMode}`
                      : regenStrategy === 'missing' && missingDayNums.length > 0
                        ? `Fill ${missingDayNums.length} missing day${
                            missingDayNums.length === 1 ? '' : 's'
                          }`
                        : `Regenerate all (${generationMode})`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopGeneration}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#27334b] text-white text-[12px] font-bold hover:bg-[#1e283c] transition-colors whitespace-nowrap"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Stop generating
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    handleOpenAddStop(
                      selectedDayFilter === 'all' ? 1 : selectedDayFilter
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-[#e8dfd0] text-[#27334b] hover:border-[#ff826e] text-[12px] font-bold transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create stop
                </button>
              </div>

              {trip.activities.length > 0 &&
                missingDayNums.length === 0 &&
                !isGeneratingItinerary && (
                  <span className="text-[11px] text-[#6c7584]">
                    Tip: refresh individual days below to keep your edits.
                  </span>
                )}
            </div>
          </div>

          {/* Progressive Progress Indicator Banner */}
          {showProgressBanner && (
            <div
              role="status"
              aria-live="polite"
              className="mb-4 rounded-xl border border-[#dcecf5] bg-[#f4fafd] p-3.5 space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isGeneratingItinerary ? (
                    <Loader2 className="w-4 h-4 text-[#3a6e8f] animate-spin shrink-0" />
                  ) : progressMetrics.failed > 0 ? (
                    <AlertCircle className="w-4 h-4 text-[#c94a3b] shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 text-[#3a8d68] shrink-0" />
                  )}
                  <span className="text-[12px] font-bold text-[#27334b]">
                    {generationPhase === 'outline'
                      ? `Sketching route outline for ${plannedTotalDays} travel days...`
                      : isGeneratingItinerary
                        ? `Day ${progressMetrics.completed} of ${progressMetrics.total} populated${
                            progressMetrics.generatingDays.length > 0
                              ? ` · Building Day ${progressMetrics.generatingDays.join(', ')}`
                              : ''
                          } — you can edit completed days now.`
                        : progressMetrics.failed > 0
                          ? `${progressMetrics.completed} of ${progressMetrics.total} days ready · ${progressMetrics.failed} day(s) failed.`
                          : `Completed all ${progressMetrics.total} planned day${
                              progressMetrics.total === 1 ? '' : 's'
                            }!`}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {progressMetrics.failed > 0 && !isGeneratingItinerary && (
                    <button
                      type="button"
                      onClick={() => void handleRetryAllFailedDays()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#fff4f0] border border-[#f5d3ca] text-[#c94a3b] hover:bg-[#ffe8df] text-[11px] font-bold whitespace-nowrap"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry failed days
                    </button>
                  )}
                  <span className="text-[11px] font-extrabold text-[#3a6e8f] tabular-nums">
                    {generationPhase === 'outline'
                      ? 'Phase 1/2'
                      : `${progressMetrics.percent}%`}
                  </span>
                </div>
              </div>

              <div className="h-2 rounded-full bg-[#e1eef6] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    progressMetrics.failed > 0 && !isGeneratingItinerary
                      ? 'bg-[#f4a261]'
                      : 'bg-[#5aa9d6]'
                  }`}
                  style={{
                    width: `${
                      generationPhase === 'outline'
                        ? 12
                        : Math.max(15, progressMetrics.percent)
                    }%`,
                  }}
                />
              </div>

              {/* Compact per-day status strip */}
              {Object.keys(dayStates).length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {dayTabs.slice(0, plannedTotalDays).map((d) => {
                    const info = dayStates[d];
                    const st = info?.status || 'idle';
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setSelectedDayFilter(d)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums border transition-colors ${
                          st === 'completed'
                            ? 'bg-[#edf8f1] border-[#cdebd9] text-[#286e4e]'
                            : st === 'generating'
                              ? 'bg-white border-[#7bbbe0] text-[#2c668a]'
                              : st === 'error'
                                ? 'bg-[#fff4f0] border-[#f5d3ca] text-[#c94a3b]'
                                : 'bg-white border-[#e5edf2] text-[#6c7584]'
                        }`}
                      >
                        {st === 'generating' && (
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        )}
                        {st === 'completed' && <Check className="w-2.5 h-2.5" />}
                        {st === 'error' && <AlertCircle className="w-2.5 h-2.5" />}
                        <span>D{d}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Outline Error Display */}
          {outlineError && (
            <div className="mb-3.5 p-3 rounded-xl bg-[#fff4f0] border border-[#f5d3ca] flex items-center justify-between gap-2">
              <span className="text-[12px] text-[#b93f31]">{outlineError}</span>
              <button
                type="button"
                onClick={() => void handleStartProgressiveGeneration(false)}
                className="px-2.5 py-1 rounded-lg bg-white text-[#c94a3b] text-[11px] font-bold border border-[#f5d3ca] shrink-0 whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          )}

          {/* Inline Create / Edit Stop Form */}
          {stopForm && (
            <form
              onSubmit={handleSubmitStopForm}
              className="mb-4 p-4 rounded-xl bg-[#fffdf8] border border-[#ff826e]/60 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h5 className="font-[800] text-[13px] text-[#27334b]">
                  {stopForm.id ? 'Edit itinerary stop' : 'Create itinerary stop'}
                </h5>
                <button
                  type="button"
                  onClick={() => setStopForm(null)}
                  aria-label="Cancel stop form"
                  className="p-1 rounded-lg text-[#6c7584] hover:text-[#27334b]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-[#6c7584] uppercase mb-1">
                    Day
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(30, trip.days)}
                    value={stopForm.day}
                    onChange={(e) =>
                      setStopForm({
                        ...stopForm,
                        day: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="w-full border border-[#e8dfd0] rounded-lg bg-white px-2.5 py-1.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e] tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6c7584] uppercase mb-1">
                    Time
                  </label>
                  <input
                    type="text"
                    value={stopForm.timeSlot}
                    onChange={(e) =>
                      setStopForm({ ...stopForm, timeSlot: e.target.value })
                    }
                    placeholder="09:00 AM"
                    maxLength={40}
                    className="w-full border border-[#e8dfd0] rounded-lg bg-white px-2.5 py-1.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6c7584] uppercase mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={stopForm.duration}
                    onChange={(e) =>
                      setStopForm({ ...stopForm, duration: e.target.value })
                    }
                    placeholder="2 hrs"
                    maxLength={40}
                    className="w-full border border-[#e8dfd0] rounded-lg bg-white px-2.5 py-1.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6c7584] uppercase mb-1">
                    Est. Cost
                  </label>
                  <input
                    type="text"
                    value={stopForm.costEstimate}
                    onChange={(e) =>
                      setStopForm({ ...stopForm, costEstimate: e.target.value })
                    }
                    placeholder="Free / $25"
                    maxLength={40}
                    className="w-full border border-[#e8dfd0] rounded-lg bg-white px-2.5 py-1.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-[#6c7584] uppercase mb-1">
                    Activity / Stop title *
                  </label>
                  <input
                    type="text"
                    required
                    value={stopForm.title}
                    onChange={(e) =>
                      setStopForm({ ...stopForm, title: e.target.value })
                    }
                    placeholder="e.g. Morning walk at Fushimi Inari"
                    maxLength={140}
                    className="w-full border border-[#e8dfd0] rounded-lg bg-white px-3 py-1.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6c7584] uppercase mb-1">
                    Location / Neighborhood
                  </label>
                  <input
                    type="text"
                    value={stopForm.location}
                    onChange={(e) =>
                      setStopForm({ ...stopForm, location: e.target.value })
                    }
                    placeholder="District or landmark"
                    maxLength={120}
                    className="w-full border border-[#e8dfd0] rounded-lg bg-white px-3 py-1.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#6c7584] uppercase mb-1">
                  Category
                </label>
                <select
                  value={stopForm.category}
                  onChange={(e) =>
                    setStopForm({ ...stopForm, category: e.target.value })
                  }
                  className="w-full border border-[#e8dfd0] rounded-lg bg-white px-3 py-1.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                >
                  {ITINERARY_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#6c7584] uppercase mb-1">
                  Details &amp; Tips
                </label>
                <textarea
                  rows={2}
                  value={stopForm.details}
                  onChange={(e) =>
                    setStopForm({ ...stopForm, details: e.target.value })
                  }
                  placeholder="Reservation notes, what to order, transit tips..."
                  maxLength={400}
                  className="w-full border border-[#e8dfd0] rounded-lg bg-white px-3 py-1.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStopForm(null)}
                  className="px-3 py-1.5 rounded-lg border border-[#e8dfd0] text-[12px] font-bold text-[#5a6578] hover:text-[#27334b]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-[#ff826e] text-white text-[12px] font-bold hover:bg-[#f47561]"
                >
                  {stopForm.id ? 'Save changes' : 'Add to itinerary'}
                </button>
              </div>
            </form>
          )}

          {/* Day Filter Bar */}
          {dayTabs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
              <button
                type="button"
                onClick={() => setSelectedDayFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors border whitespace-nowrap ${
                  selectedDayFilter === 'all'
                    ? 'bg-[#27334b] text-white border-[#27334b]'
                    : 'bg-white text-[#5a6578] border-[#f0e9dc] hover:border-[#d6cfc3]'
                }`}
              >
                All days
              </button>
              {dayTabs.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDayFilter(d)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors border tabular-nums whitespace-nowrap ${
                    selectedDayFilter === d
                      ? 'bg-[#27334b] text-white border-[#27334b]'
                      : 'bg-white text-[#5a6578] border-[#f0e9dc] hover:border-[#d6cfc3]'
                  }`}
                >
                  Day {d}
                </button>
              ))}
            </div>
          )}

          {/* Progressive Day-by-Day Schedule */}
          {visibleDays.length > 0 ? (
            <div className="space-y-4">
              {visibleDays.map((dayNum) => {
                const items = activitiesByDay.get(dayNum) || [];
                const dayInfo = dayStates[dayNum];
                const dayStatus = dayInfo?.status || 'idle';
                const outline = dayInfo?.outline;

                return (
                  <div
                    key={dayNum}
                    className="border border-[#f0e9dc] rounded-xl overflow-hidden bg-[#fffdf9]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#fff4ee] px-3.5 py-2.5 border-b border-[#f0e9dc]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-[900] text-[12px] text-[#c95b4b]">
                            Day {dayNum}
                          </span>
                          <span className="text-[11px] font-semibold text-[#6c7584]">
                            {getDayDateLabel(trip.date, dayNum)}
                          </span>
                          {outline?.theme && (
                            <span className="text-[11px] font-bold text-[#27334b]">
                              · {outline.theme}
                            </span>
                          )}
                        </div>
                        {outline && (outline.area || outline.highlights.length > 0) && (
                          <p className="text-[10.5px] text-[#6c7584] mt-0.5 truncate">
                            {outline.area}
                            {outline.highlights.length > 0
                              ? ` · ${outline.highlights.join(', ')}`
                              : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {dayStatus === 'generating' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3a6e8f]">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Generating...
                          </span>
                        )}
                        {dayStatus === 'queued' && (
                          <span className="text-[11px] font-semibold text-[#6c7584]">
                            Queued...
                          </span>
                        )}
                        {dayStatus !== 'generating' && dayStatus !== 'queued' && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleRetryOrRefreshSingleDay(dayNum)}
                              title={`Refresh Day ${dayNum} with AI`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#5a6578] hover:text-[#27334b] whitespace-nowrap"
                            >
                              <RefreshCw className="w-3 h-3" />
                              {items.length > 0 ? 'Refresh' : 'Generate'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAddStop(dayNum)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#c95b4b] hover:text-[#a84334] whitespace-nowrap"
                            >
                              <Plus className="w-3 h-3" />
                              Add stop
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Per-day Error State */}
                    {dayStatus === 'error' && (
                      <div className="p-3.5 bg-[#fff6f4] border-b border-[#f5d3ca] flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-[12px] text-[#b93f31] min-w-0">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span className="truncate">
                            {dayInfo?.error || `Failed to load Day ${dayNum}.`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleRetryOrRefreshSingleDay(dayNum)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white border border-[#f5d3ca] text-[#c94a3b] text-[11px] font-bold hover:bg-[#fff0eb] shrink-0 whitespace-nowrap"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Retry Day {dayNum}
                        </button>
                      </div>
                    )}

                    {/* Per-day Loading / Queued Skeleton */}
                    {(dayStatus === 'generating' || dayStatus === 'queued') &&
                    items.length === 0 ? (
                      <div className="p-3.5 space-y-2 animate-pulse">
                        <div className="h-10 rounded-lg bg-[#fff5e8]" />
                        <div className="h-10 rounded-lg bg-[#fff5e8]" />
                      </div>
                    ) : items.length > 0 ? (
                      <div className="divide-y divide-[#f2ece1]">
                        {items.map((act, idx) => {
                          const nextAct = items[idx + 1];
                          const isTransferPair =
                            Boolean(nextAct) &&
                            act.category !== 'Transit & Logistics' &&
                            nextAct.category !== 'Transit & Logistics';
                          const pairKey = nextAct ? `${act.id}->${nextAct.id}` : '';
                          const isTransferBusy = Boolean(pairKey && transferLoading[pairKey]);
                          const transferErr = pairKey ? transferErrors[pairKey] : undefined;
                          const suggestion = pairKey
                            ? transferSuggestions[pairKey]
                            : undefined;

                          return (
                            <React.Fragment key={act.id}>
                              <div className="p-3.5 flex items-start gap-3 hover:bg-white transition-colors">
                                <button
                                  type="button"
                                  onClick={() => onToggleActivity(trip.id, act.id)}
                                  aria-label={act.done ? 'Mark incomplete' : 'Mark complete'}
                                  className={`mt-0.5 w-5 h-5 rounded-md border grid place-items-center shrink-0 transition-colors ${
                                    act.done
                                      ? 'bg-[#7bc9a5] border-[#7bc9a5] text-white'
                                      : 'border-[#d6cfc3] bg-white'
                                  }`}
                                >
                                  {act.done && <Check className="w-3.5 h-3.5" />}
                                </button>

                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    {act.timeSlot && (
                                      <span className="text-[11px] font-extrabold text-[#d66654] tabular-nums">
                                        {act.timeSlot}
                                      </span>
                                    )}
                                    {act.category && (
                                      <span className="px-1.5 py-0.5 rounded bg-[#f5eee6] text-[#5a6578] text-[10px] font-bold">
                                        {act.category}
                                      </span>
                                    )}
                                  </div>

                                  <strong
                                    className={`block font-[800] text-[13px] leading-snug ${
                                      act.done
                                        ? 'line-through text-[#8c94a3]'
                                        : 'text-[#27334b]'
                                    }`}
                                  >
                                    {act.title}
                                  </strong>

                                  {(act.location || act.duration || act.costEstimate) && (
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-[#6c7584]">
                                      {act.location && (
                                        <span className="inline-flex items-center gap-1">
                                          <MapPin className="w-3 h-3 text-[#9aa4b2]" />
                                          {act.location}
                                        </span>
                                      )}
                                      {act.duration && (
                                        <span className="inline-flex items-center gap-1 tabular-nums">
                                          <Clock className="w-3 h-3 text-[#9aa4b2]" />
                                          {act.duration}
                                        </span>
                                      )}
                                      {act.costEstimate && (
                                        <span className="inline-flex items-center gap-1 tabular-nums">
                                          <Wallet className="w-3 h-3 text-[#9aa4b2]" />
                                          {act.costEstimate}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {act.details && (
                                    <p className="text-[11.5px] text-[#4d5768] mt-1.5 leading-relaxed">
                                      {act.details}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditStop(act)}
                                    aria-label={`Edit ${act.title}`}
                                    className="text-[#8c94a3] hover:text-[#27334b] p-1 rounded"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteActivity(trip.id, act.id)}
                                    aria-label={`Remove ${act.title}`}
                                    className="text-[#8c94a3] hover:text-[#c95b4b] p-1 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Point-to-Point AI Transport Connector between same-day stops */}
                              {isTransferPair && nextAct && (
                                <div className="px-3.5 py-2 bg-[#faf6ee]/80">
                                  {isTransferBusy ? (
                                    <div className="flex items-center gap-2 text-[11.5px] font-semibold text-[#3a6e8f] py-1">
                                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                      <span>
                                        Finding transport, travel time &amp; cost from{' '}
                                        <strong className="text-[#27334b]">
                                          {act.title}
                                        </strong>{' '}
                                        to{' '}
                                        <strong className="text-[#27334b]">
                                          {nextAct.title}
                                        </strong>
                                        ...
                                      </span>
                                    </div>
                                  ) : transferErr ? (
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#b93f31] py-0.5">
                                      <span>{transferErr}</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void triggerTransferSuggestion(dayNum, act, nextAct)
                                        }
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#f5d3ca] text-[11px] font-bold whitespace-nowrap"
                                      >
                                        <RefreshCw className="w-3 h-3" />
                                        Retry transit suggestion
                                      </button>
                                    </div>
                                  ) : suggestion ? (
                                    <div className="bg-white border border-[#dcecf5] rounded-xl p-3 space-y-2">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f4fafd] text-[#3a6e8f] text-[10px] font-extrabold uppercase tracking-wider">
                                              <Navigation className="w-3 h-3" />
                                              Suggested {suggestion.recommendedMode}
                                            </span>
                                            {suggestion.verificationStatus === 'verified' ? (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#286e4e]">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Verified info
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#9b6511]">
                                                <AlertTriangle className="w-3 h-3" />
                                                Estimated fare/time
                                              </span>
                                            )}
                                          </div>

                                          <div className="text-[12px] font-[800] text-[#27334b]">
                                            {suggestion.operator} · {suggestion.duration} ·{' '}
                                            <span className="text-[#c94a3b]">
                                              {suggestion.fareLocal}
                                            </span>
                                            {suggestion.estimatedPhpFare > 0 && (
                                              <span className="text-[#458a68] font-bold tabular-nums">
                                                {' '}
                                                (~₱
                                                {suggestion.estimatedPhpFare.toLocaleString()}
                                                )
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-[#5a6578] mt-0.5">
                                            {suggestion.departurePoint} →{' '}
                                            {suggestion.arrivalPoint} · {suggestion.schedule}
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              void triggerTransferSuggestion(
                                                dayNum,
                                                act,
                                                nextAct
                                              )
                                            }
                                            title="Refresh transport suggestion"
                                            aria-label="Refresh transport suggestion"
                                            className="p-1 rounded-lg text-[#6c7584] hover:text-[#27334b]"
                                          >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDismissTransfer(pairKey)}
                                            title="Dismiss suggestion"
                                            aria-label="Dismiss transport suggestion"
                                            className="p-1 rounded-lg text-[#6c7584] hover:text-[#c95b4b]"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      {suggestion.summary && (
                                        <p className="text-[11.5px] text-[#27334b] leading-relaxed">
                                          {suggestion.summary}
                                        </p>
                                      )}

                                      {suggestion.steps.length > 0 && (
                                        <ol className="space-y-1 border-t border-[#f2ece1] pt-2 text-[11px] text-[#4d5768]">
                                          {suggestion.steps.map((s) => (
                                            <li key={s.stepNumber} className="leading-snug">
                                              <strong className="text-[#27334b]">
                                                {s.stepNumber}. {s.mode}
                                                {s.terminalOrStation
                                                  ? ` (${s.terminalOrStation})`
                                                  : ''}
                                                :
                                              </strong>{' '}
                                              {s.instruction}
                                              {s.lastMileTip ? (
                                                <span className="text-[#3a6e8f]">
                                                  {' '}
                                                  [Last-mile: {s.lastMileTip}]
                                                </span>
                                              ) : null}
                                            </li>
                                          ))}
                                        </ol>
                                      )}

                                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#f2ece1]">
                                        <div className="flex flex-wrap items-center gap-2 text-[10.5px]">
                                          {suggestion.bookingUrl && (
                                            <a
                                              href={suggestion.bookingUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 font-bold text-[#27334b] underline underline-offset-2"
                                            >
                                              Book
                                              <ExternalLink className="w-2.5 h-2.5" />
                                            </a>
                                          )}
                                          {suggestion.sourceLinks.slice(0, 2).map((src, sIdx) => (
                                            <a
                                              key={sIdx}
                                              href={src.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1 font-semibold text-[#3a6e8f] underline underline-offset-2 max-w-[160px] truncate"
                                            >
                                              <span className="truncate">{src.title}</span>
                                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                            </a>
                                          ))}
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleApplyTransferToDayAndBudget(
                                              pairKey,
                                              act,
                                              nextAct,
                                              suggestion
                                            )
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#ff826e] text-white hover:bg-[#f47561] text-[11px] font-bold transition-colors whitespace-nowrap"
                                        >
                                          <Plus className="w-3 h-3" />
                                          Add to Day {dayNum}
                                          {suggestion.estimatedPhpFare > 0
                                            ? ` & Budget (₱${suggestion.estimatedPhpFare.toLocaleString()})`
                                            : ''}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-[11px] text-[#6c7584] truncate">
                                        Transfer: {act.title} → {nextAct.title}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void triggerTransferSuggestion(dayNum, act, nextAct)
                                        }
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3a6e8f] hover:text-[#214f6c] whitespace-nowrap shrink-0"
                                      >
                                        <Navigation className="w-3 h-3" />
                                        Suggest transit route
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-[12px] text-[#6c7584]">
                        No stops scheduled for Day {dayNum} yet.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-[#6c7584] text-[12px] bg-[#fffdf8] border border-dashed border-[#e9dfd1] rounded-xl">
              No itinerary stops yet. Pick a generation mode above to stream your day-by-day plan progressively, or click &ldquo;Create stop&rdquo; to add your own.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SMART PACKING & NOTES */}
      {activeTab === 'packing' && (
        <div>
          {/* Notes */}
          <div className="mb-5">
            <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
              Packing &amp; itinerary notes
            </label>
            <textarea
              rows={3}
              value={trip.notes || ''}
              onChange={(e) => onUpdateTripNotes(trip.id, e.target.value)}
              placeholder="Jot down flight times, packing reminders, or cafe spots..."
              className="w-full border border-[#f0e9dc] rounded-[11px] bg-[#fffdf8] px-3.5 py-2.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
            />
          </div>

          {/* Smart Packing List Section */}
          <div className="pt-4 border-t border-[#f0e9dc]">
            <div className="flex flex-wrap items-start justify-between gap-2.5 mb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <Luggage className="w-4 h-4 text-[#d66654]" />
                  <h4 className="font-[800] text-[14px] text-[#27334b]">
                    Smart packing list
                  </h4>
                </div>
                <p className="text-[11px] text-[#6c7584] mt-0.5">
                  Tailored to {trip.country}&apos;s {effectiveSeason.toLowerCase()} and{' '}
                  {trip.activities.length > 0
                    ? `${trip.activities.length} planned ${
                        trip.activities.length === 1 ? 'activity' : 'activities'
                      }`
                    : 'general travel'}
                  .
                </p>
              </div>

              {packingList.length > 0 && (
                <span className="text-[11px] font-bold text-[#458a68] tabular-nums">
                  {packedCount}/{packingList.length} packed
                </span>
              )}
            </div>

            <div className="bg-[#fffaf2] border border-[#f0e9dc] rounded-xl p-3 mb-3.5 space-y-2.5">
              <div>
                <label
                  htmlFor="packing-season-select"
                  className="block text-[10px] font-bold text-[#6c7584] uppercase tracking-wider mb-1"
                >
                  Destination season context
                </label>
                <select
                  id="packing-season-select"
                  value={seasonChoice}
                  onChange={(e) => setSeasonChoice(e.target.value)}
                  className="w-full border border-[#e8dfd0] rounded-lg bg-white px-3 py-2 text-[12px] font-medium text-[#27334b] outline-none focus:border-[#ff826e]"
                >
                  {SEASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value === 'auto'
                        ? `Auto: ${detectedSeason}${
                            country?.season ? ` · Guide: ${country.season}` : ''
                          }`
                        : opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGeneratePackingList}
                  disabled={isGeneratingPacking}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#ff826e] text-white text-[12px] font-bold shadow-[0_3px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all disabled:opacity-60 whitespace-nowrap"
                >
                  {isGeneratingPacking ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {isGeneratingPacking
                    ? 'Generating packing list...'
                    : packingList.length > 0
                      ? 'Regenerate smart list'
                      : 'Suggest packing list'}
                </button>

                {packingList.length > 0 && !isGeneratingPacking && (
                  <button
                    type="button"
                    onClick={handleClearPackingList}
                    className="px-3 py-2 rounded-xl bg-white border border-[#e8dfd0] text-[#6c7584] hover:text-[#c95b4b] hover:border-[#f5d3ca] text-[11px] font-bold transition-colors whitespace-nowrap"
                  >
                    Clear list
                  </button>
                )}
              </div>
            </div>

            {packingError && (
              <div className="mb-3.5 p-3 rounded-xl bg-[#fff4f0] border border-[#f5d3ca] flex items-center justify-between gap-2">
                <span className="text-[12px] text-[#b93f31]">{packingError}</span>
                <button
                  type="button"
                  onClick={handleGeneratePackingList}
                  className="px-2.5 py-1 rounded-lg bg-white text-[#c94a3b] text-[11px] font-bold border border-[#f5d3ca] shrink-0 whitespace-nowrap"
                >
                  Retry
                </button>
              </div>
            )}

            {activeSummary && !isGeneratingPacking && (
              <p className="text-[12px] text-[#4d5768] bg-[#f4fafd] border border-[#dcecf5] rounded-xl px-3.5 py-2.5 mb-3.5 leading-relaxed">
                {activeSummary}
              </p>
            )}

            {isGeneratingPacking && (
              <div className="space-y-2 animate-pulse mb-3.5">
                <div className="h-10 rounded-xl bg-[#fff8ed]" />
                <div className="h-10 rounded-xl bg-[#fff8ed]" />
                <div className="h-10 rounded-xl bg-[#fff8ed]" />
              </div>
            )}

            {!isGeneratingPacking && groupedPacking.length > 0 ? (
              <div className="space-y-3.5 mb-3.5">
                {groupedPacking.map(([category, items]) => (
                  <div key={category}>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#6c7584] mb-1.5">
                      {category}
                    </div>
                    <div className="divide-y divide-[#f4efe5] border border-[#f0e9dc] rounded-xl bg-[#fffdf9] px-3">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-start gap-2.5 py-2.5">
                          <button
                            type="button"
                            onClick={() => handleTogglePackingItem(item.id)}
                            aria-label={
                              item.packed
                                ? `Mark ${item.name} unpacked`
                                : `Mark ${item.name} packed`
                            }
                            className={`mt-0.5 w-4 h-4 rounded border grid place-items-center shrink-0 transition-colors ${
                              item.packed
                                ? 'bg-[#7bc9a5] border-[#7bc9a5] text-white'
                                : 'border-[#d6cfc3] bg-white'
                            }`}
                          >
                            {item.packed && <Check className="w-3 h-3" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <span
                              className={`block text-[12px] font-bold leading-snug ${
                                item.packed
                                  ? 'line-through text-[#8c94a3]'
                                  : 'text-[#27334b]'
                              }`}
                            >
                              {item.name}
                            </span>
                            {item.reason && (
                              <span className="block text-[11px] text-[#6c7584] mt-0.5">
                                {item.reason}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeletePackingItem(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="text-[#8c94a3] hover:text-[#c95b4b] p-0.5 rounded shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : !isGeneratingPacking ? (
              <div className="p-4 text-center text-[#6c7584] text-[12px] bg-[#fffdf8] border border-dashed border-[#e9dfd1] rounded-xl mb-3.5">
                Click &ldquo;Suggest packing list&rdquo; to generate personalized essentials for{' '}
                {trip.country}.
              </div>
            ) : null}

            <form onSubmit={handleAddCustomItem} className="flex items-center gap-2">
              <input
                type="text"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                placeholder="Add a custom packing item..."
                maxLength={120}
                className="flex-1 min-w-0 border border-[#f0e9dc] rounded-xl bg-white px-3 py-2 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
              />
              <button
                type="submit"
                disabled={!customItemName.trim()}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] text-[12px] font-bold hover:bg-[#fff9ed] transition-colors disabled:opacity-50 shrink-0 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
