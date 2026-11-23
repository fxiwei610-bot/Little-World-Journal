import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  BUDGET_PREFERENCE_OPTIONS,
  generateTripBudgetEstimate,
} from '../../lib/budgetEstimate';
import type {
  BudgetEstimate,
  BudgetEstimateBreakdown,
  BudgetTier,
  Country,
  ExpenseRecord,
  Trip,
} from '../../types/journal';

interface BudgetPageProps {
  budget: number;
  expenses: ExpenseRecord[];
  countries: Country[];
  trips: Trip[];
  budgetEstimates: BudgetEstimate[];
  onOpenAddExpense: (defaultCountry?: string) => void;
  onOpenEditBudget: () => void;
  onUpdateBudget: (newBudget: number) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateExpenseDestination: (
    expenseId: string,
    country: string,
    destination?: string
  ) => void;
  onSaveBudgetEstimate: (estimate: BudgetEstimate, isUpdate: boolean) => void;
  onDeleteBudgetEstimate: (id: string) => void;
  onNotify: (msg: string) => void;
}

const BREAKDOWN_CATEGORIES: {
  key: keyof BudgetEstimateBreakdown;
  label: string;
  hint: string;
  barColor: string;
}[] = [
  {
    key: 'transportation',
    label: 'Transportation',
    hint: 'Flights, rail, airport transfers & local transit',
    barColor: 'bg-[#69a6f9]',
  },
  {
    key: 'accommodation',
    label: 'Accommodation',
    hint: 'Hotels, guesthouses & overnight stays',
    barColor: 'bg-[#9b84f0]',
  },
  {
    key: 'food',
    label: 'Food & Dining',
    hint: 'Daily meals, street food, cafes & drinks',
    barColor: 'bg-[#ff826e]',
  },
  {
    key: 'activities',
    label: 'Activities',
    hint: 'Tours, museum tickets, passes & experiences',
    barColor: 'bg-[#7bc9a5]',
  },
  {
    key: 'other',
    label: 'Other & Buffer',
    hint: 'eSIM, travel insurance, tips & contingency',
    barColor: 'bg-[#f4b942]',
  },
];

function sumBreakdown(b: BudgetEstimateBreakdown): number {
  return (
    Number(b.transportation || 0) +
    Number(b.accommodation || 0) +
    Number(b.food || 0) +
    Number(b.activities || 0) +
    Number(b.other || 0)
  );
}

export const BudgetPage: React.FC<BudgetPageProps> = ({
  budget,
  expenses,
  countries,
  trips,
  budgetEstimates,
  onOpenAddExpense,
  onOpenEditBudget,
  onUpdateBudget,
  onDeleteExpense,
  onUpdateExpenseDestination,
  onSaveBudgetEstimate,
  onDeleteBudgetEstimate,
  onNotify,
}) => {
  const defaultCountry =
    trips[0]?.country || countries[0]?.name || 'Japan';
  const todayStr = new Date().toISOString().slice(0, 10);

  // Destination filter & inline expense assignment state
  const [selectedCountryFilter, setSelectedCountryFilter] = useState<string>('ALL');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingCountry, setEditingCountry] = useState<string>(defaultCountry);
  const [editingDestination, setEditingDestination] = useState<string>('');

  // AI Estimator configuration state
  const [selectedTripId, setSelectedTripId] = useState<string>(trips[0]?.id || '');
  const [estCountry, setEstCountry] = useState<string>(trips[0]?.country || defaultCountry);
  const [estDestination, setEstDestination] = useState<string>(() => {
    const firstCountry = countries.find((c) => c.name === (trips[0]?.country || defaultCountry));
    return firstCountry?.places?.slice(0, 2).join(', ') || '';
  });
  const [estTravelDate, setEstTravelDate] = useState<string>(trips[0]?.date || todayStr);
  const [estDays, setEstDays] = useState<number>(trips[0]?.days || 5);
  const [estTravelers, setEstTravelers] = useState<number>(2);
  const [estPreference, setEstPreference] = useState<BudgetTier>('Mid-range / Balanced');
  const [estNotesInput, setEstNotesInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Draft / Active customized estimate workbench
  const [draftEstimate, setDraftEstimate] = useState<BudgetEstimate | null>(null);
  const [isEditingExistingId, setIsEditingExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!countries.some((c) => c.name === estCountry) && countries[0]) {
      setEstCountry(countries[0].name);
    }
  }, [countries, estCountry]);

  const countryFlagMap = useMemo(() => {
    const map = new Map<string, string>();
    countries.forEach((c) => map.set(c.name, c.flag));
    return map;
  }, [countries]);

  // Expense KPIs
  const totalSpent = useMemo(
    () => expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [expenses]
  );
  const remaining = budget - totalSpent;
  const totalSavedEstimates = useMemo(
    () => budgetEstimates.reduce((sum, item) => sum + sumBreakdown(item.breakdown), 0),
    [budgetEstimates]
  );

  // Available countries for expense filter
  const expenseCountryTabs = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.country?.trim()) set.add(e.country.trim());
    });
    trips.forEach((t) => {
      if (t.country?.trim()) set.add(t.country.trim());
    });
    budgetEstimates.forEach((b) => {
      if (b.country?.trim()) set.add(b.country.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [expenses, trips, budgetEstimates]);

  const hasUnassigned = useMemo(
    () => expenses.some((e) => !e.country?.trim()),
    [expenses]
  );

  const filteredExpenses = useMemo(() => {
    if (selectedCountryFilter === 'ALL') return expenses;
    if (selectedCountryFilter === 'UNASSIGNED') {
      return expenses.filter((e) => !e.country?.trim());
    }
    return expenses.filter((e) => (e.country || '').trim() === selectedCountryFilter);
  }, [expenses, selectedCountryFilter]);

  const filteredSpent = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
    [filteredExpenses]
  );

  // Group filtered expenses by Country
  const groupedExpenses = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        label: string;
        flag: string;
        subtotal: number;
        destinations: Set<string>;
        items: ExpenseRecord[];
      }
    >();

    filteredExpenses.forEach((exp) => {
      const countryKey = exp.country?.trim() || 'Unassigned';
      const existing = groups.get(countryKey);
      if (existing) {
        existing.subtotal += Number(exp.amount || 0);
        if (exp.destination?.trim()) existing.destinations.add(exp.destination.trim());
        existing.items.push(exp);
      } else {
        const destSet = new Set<string>();
        if (exp.destination?.trim()) destSet.add(exp.destination.trim());
        groups.set(countryKey, {
          key: countryKey,
          label: countryKey === 'Unassigned' ? 'Unassigned destination' : countryKey,
          flag: countryKey === 'Unassigned' ? '📍' : countryFlagMap.get(countryKey) || '🌍',
          subtotal: Number(exp.amount || 0),
          destinations: destSet,
          items: [exp],
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.key === 'Unassigned') return 1;
      if (b.key === 'Unassigned') return -1;
      return b.subtotal - a.subtotal;
    });
  }, [filteredExpenses, countryFlagMap]);

  // Estimate totals lookup per country
  const estimateByCountry = useMemo(() => {
    const map = new Map<string, number>();
    budgetEstimates.forEach((est) => {
      const current = map.get(est.country) || 0;
      map.set(est.country, Math.max(current, sumBreakdown(est.breakdown)));
    });
    return map;
  }, [budgetEstimates]);

  // Spending by destination
  const spendingByDestination = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((e) => {
      const label = e.country?.trim() || 'Unassigned';
      totals[label] = (totals[label] || 0) + Number(e.amount || 0);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  // Spending by category (reacts to country filter)
  const sortedCategories = useMemo(() => {
    const totals: Record<string, number> = {};
    filteredExpenses.forEach((e) => {
      totals[e.category] = (totals[e.category] || 0) + Number(e.amount || 0);
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [filteredExpenses]);

  const handleSelectTripPreset = (tripId: string) => {
    setSelectedTripId(tripId);
    const matched = trips.find((t) => t.id === tripId);
    if (!matched) return;
    setEstCountry(matched.country);
    const countryProfile = countries.find((c) => c.name === matched.country);
    setEstDestination(countryProfile?.places?.slice(0, 2).join(', ') || matched.name);
    setEstTravelDate(matched.date || todayStr);
    setEstDays(Math.max(1, matched.days || 5));
  };

  const handleGenerateEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estCountry.trim()) return;

    setGenerateError(null);
    setIsGenerating(true);

    const linkedTrip = trips.find((t) => t.id === selectedTripId);
    const plannedActivities = linkedTrip
      ? linkedTrip.activities.map((a) => a.title).slice(0, 15)
      : [];

    try {
      const result = await generateTripBudgetEstimate({
        country: estCountry,
        destination: estDestination.trim() || estCountry,
        travelDate: estTravelDate || todayStr,
        days: Math.max(1, Number(estDays) || 1),
        travelers: Math.max(1, Number(estTravelers) || 1),
        preference: estPreference,
        currency: 'PHP',
        plannedActivities,
        notes: estNotesInput.trim() || undefined,
      });

      setDraftEstimate({
        id: `est-${Date.now()}`,
        title: result.title,
        country: estCountry,
        destination: estDestination.trim() || estCountry,
        travelDate: estTravelDate || todayStr,
        days: Math.max(1, Number(estDays) || 1),
        travelers: Math.max(1, Number(estTravelers) || 1),
        preference: estPreference,
        currency: 'PHP',
        breakdown: result.breakdown,
        notes: result.notes,
        aiGenerated: true,
      });
      setIsEditingExistingId(null);
      onNotify(`Generated AI budget estimate for ${estCountry}`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to generate AI budget estimate.';
      setGenerateError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateBlankEstimate = () => {
    setGenerateError(null);
    setIsEditingExistingId(null);
    setDraftEstimate({
      id: `est-${Date.now()}`,
      title: `${estDestination.trim() || estCountry} Trip Estimate`,
      country: estCountry,
      destination: estDestination.trim() || estCountry,
      travelDate: estTravelDate || todayStr,
      days: Math.max(1, Number(estDays) || 1),
      travelers: Math.max(1, Number(estTravelers) || 1),
      preference: estPreference,
      currency: 'PHP',
      breakdown: {
        transportation: 12000,
        accommodation: 15000,
        food: 8000,
        activities: 6000,
        other: 3000,
      },
      notes: estNotesInput.trim(),
      aiGenerated: false,
    });
  };

  const handleDraftBreakdownChange = (
    key: keyof BudgetEstimateBreakdown,
    rawVal: string
  ) => {
    if (!draftEstimate) return;
    const numeric = Math.max(0, Math.min(1000000000, Math.round(Number(rawVal) || 0)));
    setDraftEstimate({
      ...draftEstimate,
      breakdown: {
        ...draftEstimate.breakdown,
        [key]: numeric,
      },
    });
  };

  const handleSaveDraftEstimate = () => {
    if (!draftEstimate) return;
    const trimmedTitle =
      draftEstimate.title.trim() || `${draftEstimate.country} Trip Budget`;
    const toSave: BudgetEstimate = {
      ...draftEstimate,
      title: trimmedTitle,
      destination: draftEstimate.destination.trim() || draftEstimate.country,
    };
    const isUpdate = Boolean(isEditingExistingId);
    onSaveBudgetEstimate(toSave, isUpdate);
    setDraftEstimate(null);
    setIsEditingExistingId(null);
  };

  const handleEditSavedEstimate = (item: BudgetEstimate) => {
    setIsEditingExistingId(item.id);
    setDraftEstimate({
      ...item,
      breakdown: { ...item.breakdown },
    });
    setGenerateError(null);
  };

  const draftTotal = draftEstimate ? sumBreakdown(draftEstimate.breakdown) : 0;

  return (
    <section aria-label="Budget tracker" className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="text-[11px] tracking-[1.8px] text-[#d66654] font-extrabold uppercase">
            Mind the money, enjoy the moment
          </div>
          <h2 className="font-[900] text-[26px] sm:text-[30px] tracking-[-0.5px] text-[#27334b] mt-1 mb-0.5 text-balance">
            Budget tracker <span aria-hidden="true">💰</span>
          </h2>
          <p className="text-[#6c7584] text-[13px]">
            Organize expenses by destination and build customizable AI budget plans for every trip.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onOpenAddExpense(
              selectedCountryFilter !== 'ALL' && selectedCountryFilter !== 'UNASSIGNED'
                ? selectedCountryFilter
                : undefined
            )
          }
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] active:translate-y-0.5 transition-all whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add expense
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#f0e9dc] rounded-[17px] p-4 relative">
          <div className="flex items-center justify-between mb-3">
            <div className="w-[34px] h-[34px] rounded-[11px] bg-[#fff0e9] grid place-items-center text-[17px]">
              🎯
            </div>
            <button
              type="button"
              onClick={onOpenEditBudget}
              aria-label="Edit total trip budget"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#d65442] hover:underline whitespace-nowrap"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          </div>
          <strong className="block font-[900] text-[24px] leading-tight text-[#27334b] tabular-nums">
            ₱{budget.toLocaleString()}
          </strong>
          <span className="text-[12px] text-[#6c7584]">Total trip budget</span>
        </div>

        <div className="bg-white border border-[#f0e9dc] rounded-[17px] p-4">
          <div className="w-[34px] h-[34px] rounded-[11px] bg-[#edf8f1] grid place-items-center text-[17px] mb-3">
            🧾
          </div>
          <strong className="block font-[900] text-[24px] leading-tight text-[#27334b] tabular-nums">
            ₱{totalSpent.toLocaleString()}
          </strong>
          <span className="text-[12px] text-[#6c7584]">
            Actual across {Math.max(1, spendingByDestination.length)} destination
            {spendingByDestination.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="bg-white border border-[#f0e9dc] rounded-[17px] p-4">
          <div className="w-[34px] h-[34px] rounded-[11px] bg-[#f3efff] grid place-items-center text-[17px] mb-3">
            🌱
          </div>
          <strong
            className={`block font-[900] text-[24px] leading-tight tabular-nums ${
              remaining < 0 ? 'text-[#c94a3b]' : 'text-[#27334b]'
            }`}
          >
            {remaining < 0
              ? `-₱${Math.abs(remaining).toLocaleString()}`
              : `₱${remaining.toLocaleString()}`}
          </strong>
          <span className="text-[12px] text-[#6c7584]">
            {remaining < 0 ? 'Over budget' : 'Remaining balance'}
          </span>
        </div>

        <div className="bg-white border border-[#f0e9dc] rounded-[17px] p-4">
          <div className="w-[34px] h-[34px] rounded-[11px] bg-[#fff7dc] grid place-items-center text-[17px] mb-3">
            ✨
          </div>
          <strong className="block font-[900] text-[24px] leading-tight text-[#27334b] tabular-nums">
            ₱{totalSavedEstimates.toLocaleString()}
          </strong>
          <span className="text-[12px] text-[#6c7584]">
            {budgetEstimates.length} saved trip estimate
            {budgetEstimates.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Band 1: Expenses Organized by Destination */}
      <div className="space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-[800] text-[17px] text-[#27334b]">
              Expenses by destination
            </h3>
            <p className="text-[12px] text-[#6c7584]">
              Filter by country or planned destination to track local spending.
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5"
            role="tablist"
            aria-label="Filter expenses by destination"
          >
            <button
              type="button"
              onClick={() => setSelectedCountryFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-colors whitespace-nowrap ${
                selectedCountryFilter === 'ALL'
                  ? 'bg-[#27334b] text-white'
                  : 'bg-white border border-[#f0e9dc] text-[#5a6578] hover:border-[#ff826e]'
              }`}
            >
              All destinations
            </button>
            {expenseCountryTabs.map((countryName) => {
              const flag = countryFlagMap.get(countryName) || '🌍';
              const active = selectedCountryFilter === countryName;
              return (
                <button
                  key={countryName}
                  type="button"
                  onClick={() => setSelectedCountryFilter(countryName)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#ff826e] text-white'
                      : 'bg-white border border-[#f0e9dc] text-[#5a6578] hover:border-[#ff826e]'
                  }`}
                >
                  <span aria-hidden="true">{flag}</span>
                  <span>{countryName}</span>
                </button>
              );
            })}
            {hasUnassigned && (
              <button
                type="button"
                onClick={() => setSelectedCountryFilter('UNASSIGNED')}
                className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-colors whitespace-nowrap ${
                  selectedCountryFilter === 'UNASSIGNED'
                    ? 'bg-[#27334b] text-white'
                    : 'bg-white border border-[#f0e9dc] text-[#5a6578] hover:border-[#ff826e]'
                }`}
              >
                Unassigned
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.85fr] gap-4 items-start">
          {/* Grouped Expenses List */}
          <div className="space-y-3.5 min-w-0">
            {groupedExpenses.length > 0 ? (
              groupedExpenses.map((group) => {
                const plannedEst =
                  group.key !== 'Unassigned'
                    ? estimateByCountry.get(group.key)
                    : undefined;
                const estPct =
                  plannedEst && plannedEst > 0
                    ? Math.min(100, Math.round((group.subtotal / plannedEst) * 100))
                    : null;

                return (
                  <div
                    key={group.key}
                    className="bg-white border border-[#f0e9dc] rounded-[18px] p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#f0e9dc]">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[20px]" aria-hidden="true">
                            {group.flag}
                          </span>
                          <h4 className="font-[800] text-[15px] text-[#27334b]">
                            {group.label}
                          </h4>
                          <span className="text-[11px] font-semibold text-[#6c7584] tabular-nums">
                            · {group.items.length} item{group.items.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {group.destinations.size > 0 && (
                          <p className="text-[11px] text-[#6c7584] mt-0.5 truncate">
                            Places: {Array.from(group.destinations).join(' · ')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <strong className="block font-[900] text-[16px] text-[#27334b] tabular-nums">
                            ₱{group.subtotal.toLocaleString()}
                          </strong>
                          {plannedEst !== undefined && (
                            <span className="block text-[11px] text-[#6c7584] tabular-nums">
                              of ₱{plannedEst.toLocaleString()} est.
                            </span>
                          )}
                        </div>
                        {group.key !== 'Unassigned' && (
                          <button
                            type="button"
                            onClick={() => onOpenAddExpense(group.key)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#fff4f0] text-[#c94a3b] hover:bg-[#ffe4db] text-[11px] font-bold transition-colors whitespace-nowrap"
                          >
                            <Plus className="w-3 h-3" />
                            Add
                          </button>
                        )}
                      </div>
                    </div>

                    {estPct !== null && (
                      <div className="mt-3 mb-1">
                        <div className="h-1.5 rounded-full bg-[#f1eee8] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              group.subtotal > (plannedEst || 0)
                                ? 'bg-[#e35d4b]'
                                : 'bg-[#7bc9a5]'
                            }`}
                            style={{ width: `${estPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="divide-y divide-[#f0e9dc] mt-1">
                      {group.items.map((exp) => {
                        const isEditingDest = editingExpenseId === exp.id;
                        return (
                          <div key={exp.id} className="py-3">
                            <div className="flex items-center gap-3">
                              <span className="text-[17px] shrink-0" aria-hidden="true">
                                🧾
                              </span>
                              <div className="flex-1 min-w-0">
                                <strong className="font-[800] text-[13px] text-[#27334b] block truncate">
                                  {exp.name}
                                </strong>
                                <span className="block text-[11px] text-[#6c7584] tabular-nums">
                                  {exp.category}
                                  {exp.destination?.trim() ? ` · ${exp.destination}` : ''} ·{' '}
                                  {exp.date}
                                </span>
                              </div>
                              <strong className="font-[800] text-[14px] text-[#27334b] tabular-nums shrink-0">
                                ₱{Number(exp.amount).toLocaleString()}
                              </strong>
                              <button
                                type="button"
                                onClick={() => {
                                  if (isEditingDest) {
                                    setEditingExpenseId(null);
                                  } else {
                                    setEditingExpenseId(exp.id);
                                    setEditingCountry(
                                      exp.country?.trim() || countries[0]?.name || 'Japan'
                                    );
                                    setEditingDestination(exp.destination || '');
                                  }
                                }}
                                title="Assign or edit destination"
                                aria-label={`Assign destination for ${exp.name}`}
                                className="bg-[#fff9ed] border border-[#f0e9dc] text-[#5a6578] hover:border-[#ff826e] rounded-lg p-1.5 transition-colors shrink-0"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteExpense(exp.id)}
                                aria-label={`Delete ${exp.name}`}
                                className="bg-[#fff4f0] text-[#c95b4b] hover:bg-[#ffe4db] rounded-lg p-1.5 transition-colors shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {isEditingDest && (
                              <div className="mt-2.5 pt-2.5 border-t border-dashed border-[#efe6d6] flex flex-wrap items-center gap-2">
                                <select
                                  value={editingCountry}
                                  onChange={(e) => setEditingCountry(e.target.value)}
                                  className="border border-[#f0e9dc] rounded-lg bg-[#fffdf8] px-2.5 py-1.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                                >
                                  {countries.map((c) => (
                                    <option key={c.name} value={c.name}>
                                      {c.flag} {c.name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={editingDestination}
                                  onChange={(e) => setEditingDestination(e.target.value)}
                                  placeholder="City or area (optional)"
                                  className="flex-1 min-w-[140px] border border-[#f0e9dc] rounded-lg bg-[#fffdf8] px-2.5 py-1.5 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateExpenseDestination(
                                      exp.id,
                                      editingCountry,
                                      editingDestination.trim() || undefined
                                    );
                                    setEditingExpenseId(null);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#ff826e] text-white text-[12px] font-bold hover:bg-[#f47561] transition-colors whitespace-nowrap"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  Save
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white border border-dashed border-[#e9dfd1] rounded-[18px] p-8 text-center">
                <p className="text-[13px] text-[#6c7584] mb-3">
                  No expenses recorded for{' '}
                  {selectedCountryFilter === 'ALL'
                    ? 'any destination yet.'
                    : `${selectedCountryFilter} yet.`}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onOpenAddExpense(
                      selectedCountryFilter !== 'ALL' && selectedCountryFilter !== 'UNASSIGNED'
                        ? selectedCountryFilter
                        : undefined
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#fff4f0] text-[#c94a3b] hover:bg-[#ffe4db] text-[12px] font-bold transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add destination expense
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Destination & Category Breakdowns */}
          <div className="space-y-4 min-w-0">
            <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h4 className="font-[800] text-[15px] text-[#27334b]">
                  Spending by country
                </h4>
                <span className="text-[11px] text-[#6c7584] font-semibold">PHP</span>
              </div>
              {spendingByDestination.length > 0 ? (
                <div className="space-y-3.5">
                  {spendingByDestination.map(([countryName, value]) => {
                    const pct = Math.min(
                      100,
                      Math.round((value / Math.max(totalSpent, 1)) * 100)
                    );
                    const flag =
                      countryName === 'Unassigned'
                        ? '📍'
                        : countryFlagMap.get(countryName) || '🌍';
                    return (
                      <div key={countryName}>
                        <div className="flex justify-between text-[12px] mb-1.5 tabular-nums">
                          <strong className="font-bold text-[#27334b]">
                            {flag} {countryName}
                          </strong>
                          <span className="text-[#5b6578] font-medium">
                            ₱{value.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#f1eee8] overflow-hidden">
                          <div
                            className="h-full bg-[#ff826e] rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-[#6c7584]">
                  Add expenses with a country to see destination totals.
                </p>
              )}
            </div>

            <div className="bg-white border border-[#f0e9dc] rounded-[18px] p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h4 className="font-[800] text-[15px] text-[#27334b]">
                  Category split
                  {selectedCountryFilter !== 'ALL' ? ` · ${selectedCountryFilter}` : ''}
                </h4>
              </div>

              {sortedCategories.length > 0 ? (
                <div className="space-y-3.5">
                  {sortedCategories.map(([category, value]) => {
                    const pct = Math.min(
                      100,
                      Math.round((value / Math.max(filteredSpent, 1)) * 100)
                    );
                    return (
                      <div key={category}>
                        <div className="flex justify-between text-[12px] mb-1.5 tabular-nums">
                          <strong className="font-bold text-[#27334b]">{category}</strong>
                          <span className="text-[#5b6578] font-medium">
                            ₱{value.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#f1eee8] overflow-hidden">
                          <div
                            className="h-full bg-[#7bc9a5] rounded-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-[#6c7584]">
                  No expenses in this view yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Band 2: AI Trip Budget Estimator + Customize & Save */}
      <div className="bg-white border border-[#f0e9dc] rounded-[20px] p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#f0e9dc]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-[13px] bg-[#fff0e9] text-[#d65442] grid place-items-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-[900] text-[18px] text-[#27334b]">
                AI trip budget estimator
              </h3>
              <p className="text-[12px] text-[#6c7584]">
                Generate an estimated budget across transportation, accommodation, food, activities, and other costs—then customize and save it.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateBlankEstimate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#fff9ed] border border-[#f0e9dc] text-[#27334b] hover:border-[#ff826e] text-[12px] font-bold transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <Pencil className="w-3.5 h-3.5" />
            Custom manual estimate
          </button>
        </div>

        {/* Estimator Form */}
        <form onSubmit={handleGenerateEstimate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
                Pre-fill from planned trip (optional)
              </label>
              <select
                value={selectedTripId}
                onChange={(e) => handleSelectTripPreset(e.target.value)}
                className="w-full border border-[#f0e9dc] rounded-[11px] bg-[#fffdf8] px-3 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e]"
              >
                <option value="">Custom destination plan</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.country} · {t.days}d)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
                Country
              </label>
              <select
                value={estCountry}
                onChange={(e) => setEstCountry(e.target.value)}
                className="w-full border border-[#f0e9dc] rounded-[11px] bg-[#fffdf8] px-3 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e]"
              >
                {countries.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
                Cities / destination
              </label>
              <input
                value={estDestination}
                onChange={(e) => setEstDestination(e.target.value)}
                placeholder="e.g. Tokyo, Kyoto & Osaka"
                className="w-full border border-[#f0e9dc] rounded-[11px] bg-[#fffdf8] px-3 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
                Travel start date
              </label>
              <input
                type="date"
                value={estTravelDate}
                onChange={(e) => setEstTravelDate(e.target.value)}
                className="w-full border border-[#f0e9dc] rounded-[11px] bg-[#fffdf8] px-3 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
                Duration (days)
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={estDays}
                onChange={(e) => setEstDays(Math.max(1, Number(e.target.value) || 1))}
                className="w-full border border-[#f0e9dc] rounded-[11px] bg-[#fffdf8] px-3 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e] tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
                Travelers
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={estTravelers}
                onChange={(e) => setEstTravelers(Math.max(1, Number(e.target.value) || 1))}
                className="w-full border border-[#f0e9dc] rounded-[11px] bg-[#fffdf8] px-3 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e] tabular-nums"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
                Budget preference
              </label>
              <select
                value={estPreference}
                onChange={(e) => setEstPreference(e.target.value as BudgetTier)}
                className="w-full border border-[#f0e9dc] rounded-[11px] bg-[#fffdf8] px-3 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e]"
              >
                {BUDGET_PREFERENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
                Budget notes or priorities (optional) —{' '}
                <span className="font-normal">
                  {BUDGET_PREFERENCE_OPTIONS.find((o) => o.value === estPreference)?.hint}
                </span>
              </label>
              <input
                value={estNotesInput}
                onChange={(e) => setEstNotesInput(e.target.value)}
                placeholder="e.g. Include round-trip flights from Manila, 1 ryokan night, and transit pass"
                className="w-full border border-[#f0e9dc] rounded-[11px] bg-[#fffdf8] px-3 py-2.5 text-[13px] text-[#27334b] outline-none focus:border-[#ff826e]"
              />
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561] disabled:opacity-60 transition-all whitespace-nowrap shrink-0"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Estimating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate AI estimate
                </>
              )}
            </button>
          </div>

          {generateError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-[#fff4f0] border border-[#f5d3ca] text-[#c94a3b] text-[12px] font-semibold"
            >
              {generateError}
            </div>
          )}
        </form>

        {/* Editable / Customizable Estimate Workbench */}
        {draftEstimate && (
          <div className="bg-[#fff9ed] border border-[#eddcc5] rounded-[18px] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-[#d65442]">
                  {isEditingExistingId
                    ? 'Editing saved estimate'
                    : draftEstimate.aiGenerated
                      ? 'AI-generated estimate draft · customize before saving'
                      : 'Custom budget draft'}
                </span>
                <div className="text-[12px] text-[#6c7584] mt-0.5 tabular-nums">
                  {countryFlagMap.get(draftEstimate.country) || '🌍'} {draftEstimate.country} ·{' '}
                  {draftEstimate.destination} · {draftEstimate.travelDate} · {draftEstimate.days}{' '}
                  day{draftEstimate.days === 1 ? '' : 's'} · {draftEstimate.travelers} traveler
                  {draftEstimate.travelers === 1 ? '' : 's'} · {draftEstimate.preference}
                </div>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <strong className="block font-[900] text-[22px] text-[#27334b] tabular-nums">
                  ₱{draftTotal.toLocaleString()}
                </strong>
                <span className="text-[11px] text-[#6c7584] tabular-nums">
                  ₱{Math.round(draftTotal / Math.max(1, draftEstimate.days)).toLocaleString()}/day ·
                  ₱{Math.round(draftTotal / Math.max(1, draftEstimate.travelers)).toLocaleString()}{' '}
                  per person
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
                Estimate title
              </label>
              <input
                value={draftEstimate.title}
                onChange={(e) =>
                  setDraftEstimate({ ...draftEstimate, title: e.target.value })
                }
                className="w-full border border-[#f0e9dc] rounded-[11px] bg-white px-3.5 py-2 text-[13px] font-bold text-[#27334b] outline-none focus:border-[#ff826e]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {BREAKDOWN_CATEGORIES.map((cat) => {
                const amount = draftEstimate.breakdown[cat.key];
                const share =
                  draftTotal > 0 ? Math.round((amount / draftTotal) * 100) : 0;
                return (
                  <div
                    key={cat.key}
                    className="bg-white border border-[#f0e9dc] rounded-[14px] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <label className="text-[12px] font-extrabold text-[#27334b]">
                        {cat.label}
                      </label>
                      <span className="text-[11px] font-semibold text-[#6c7584] tabular-nums">
                        {share}%
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6c7584] leading-snug mb-2 min-h-[30px]">
                      {cat.hint}
                    </p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#6c7584]">
                        ₱
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={amount}
                        onChange={(e) =>
                          handleDraftBreakdownChange(cat.key, e.target.value)
                        }
                        className="w-full border border-[#f0e9dc] rounded-lg bg-[#fffdf8] pl-7 pr-2.5 py-1.5 text-[13px] font-bold text-[#27334b] outline-none focus:border-[#ff826e] tabular-nums"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5a6578] mb-1">
                Cost assumptions & notes
              </label>
              <textarea
                rows={2}
                value={draftEstimate.notes}
                onChange={(e) =>
                  setDraftEstimate({ ...draftEstimate, notes: e.target.value })
                }
                placeholder="Add notes on flights, accommodation style, or currency buffer..."
                className="w-full border border-[#f0e9dc] rounded-[11px] bg-white px-3.5 py-2 text-[12px] text-[#27334b] outline-none focus:border-[#ff826e]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraftEstimate}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ff826e] text-white text-[12px] font-bold shadow-[0_3px_0_#efb6a9] hover:bg-[#f47561] transition-all whitespace-nowrap"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isEditingExistingId ? 'Save changes' : 'Save estimate'}
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateBudget(draftTotal)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#f0e9dc] text-[#27334b] hover:border-[#ff826e] text-[12px] font-bold transition-colors whitespace-nowrap"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Apply total to Trip Budget
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDraftEstimate(null);
                  setIsEditingExistingId(null);
                }}
                className="px-3.5 py-2 rounded-xl text-[12px] font-bold text-[#6c7584] hover:text-[#27334b] transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Saved Budget Estimates */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-[800] text-[15px] text-[#27334b]">
              Saved trip budget estimates ({budgetEstimates.length})
            </h4>
          </div>

          {budgetEstimates.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {budgetEstimates.map((item) => {
                const total = sumBreakdown(item.breakdown);
                const flag = countryFlagMap.get(item.country) || '🌍';
                return (
                  <div
                    key={item.id}
                    className="bg-[#fffdf8] border border-[#f0e9dc] rounded-[16px] p-4 flex flex-col justify-between gap-3.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#d65442]">
                            <span aria-hidden="true">{flag}</span>
                            <span>{item.country}</span>
                            {item.destination && item.destination !== item.country && (
                              <span className="text-[#6c7584] font-semibold truncate">
                                · {item.destination}
                              </span>
                            )}
                          </div>
                          <h5 className="font-[900] text-[15px] text-[#27334b] mt-0.5">
                            {item.title}
                          </h5>
                          <p className="text-[11px] text-[#6c7584] mt-0.5 tabular-nums">
                            {item.travelDate} · {item.days} day{item.days === 1 ? '' : 's'} ·{' '}
                            {item.travelers} traveler{item.travelers === 1 ? '' : 's'} ·{' '}
                            {item.preference}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <strong className="block font-[900] text-[18px] text-[#27334b] tabular-nums">
                            ₱{total.toLocaleString()}
                          </strong>
                          <span className="text-[11px] text-[#6c7584] tabular-nums">
                            ₱{Math.round(total / Math.max(1, item.days)).toLocaleString()}/day
                          </span>
                        </div>
                      </div>

                      {/* Stacked proportional bar */}
                      <div className="h-2 rounded-full bg-[#f1eee8] overflow-hidden flex mt-3">
                        {BREAKDOWN_CATEGORIES.map((cat) => {
                          const val = item.breakdown[cat.key];
                          const pct = total > 0 ? (val / total) * 100 : 0;
                          if (pct <= 0) return null;
                          return (
                            <div
                              key={cat.key}
                              title={`${cat.label}: ₱${val.toLocaleString()}`}
                              className={cat.barColor}
                              style={{ width: `${pct}%` }}
                            />
                          );
                        })}
                      </div>

                      {/* 5 Category Mini Breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
                        {BREAKDOWN_CATEGORIES.map((cat) => (
                          <div
                            key={cat.key}
                            className="bg-white border border-[#f0e9dc] rounded-lg px-2.5 py-1.5"
                          >
                            <span className="block text-[10px] text-[#6c7584] truncate">
                              {cat.label}
                            </span>
                            <strong className="block text-[12px] font-[800] text-[#27334b] tabular-nums">
                              ₱{item.breakdown[cat.key].toLocaleString()}
                            </strong>
                          </div>
                        ))}
                      </div>

                      {item.notes && (
                        <p className="text-[12px] text-[#5a6578] leading-relaxed mt-3">
                          {item.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#f0e9dc]">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditSavedEstimate(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-[#f0e9dc] text-[#27334b] hover:border-[#ff826e] text-[12px] font-bold transition-colors whitespace-nowrap"
                        >
                          <Pencil className="w-3 h-3" />
                          Customize
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateBudget(total)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#edf8f1] text-[#236f4d] hover:bg-[#dcf3e5] text-[12px] font-bold transition-colors whitespace-nowrap"
                        >
                          <Wallet className="w-3 h-3" />
                          Apply to Trip Budget
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteBudgetEstimate(item.id)}
                        aria-label={`Delete ${item.title}`}
                        className="bg-[#fff4f0] text-[#c95b4b] hover:bg-[#ffe4db] rounded-lg p-1.5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-[#6c7584] text-[13px] bg-[#fffdf8] border border-dashed border-[#e9dfd1] rounded-[15px]">
              No saved trip estimates yet. Generate one with AI above to plan transportation, accommodation, food, activities, and buffer costs.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
