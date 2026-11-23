import type { BudgetEstimateBreakdown, BudgetTier } from '../types/journal';

export const BUDGET_PREFERENCE_OPTIONS: {
  value: BudgetTier;
  label: string;
  hint: string;
}[] = [
  {
    value: 'Shoestring / Budget',
    label: 'Shoestring / Budget',
    hint: 'Hostels, public transit, street food & free sights',
  },
  {
    value: 'Mid-range / Balanced',
    label: 'Mid-range / Balanced',
    hint: '3-star stays, casual dining, key attractions & rail',
  },
  {
    value: 'Comfort / Luxury',
    label: 'Comfort / Luxury',
    hint: 'Boutique hotels, private transfers, signature dining',
  },
];

export interface GenerateBudgetEstimatePayload {
  country: string;
  destination: string;
  travelDate: string;
  days: number;
  travelers: number;
  preference: BudgetTier;
  currency: string;
  plannedActivities?: string[];
  notes?: string;
}

export interface GeneratedBudgetEstimateResponse {
  title: string;
  breakdown: BudgetEstimateBreakdown;
  notes: string;
}

export async function generateTripBudgetEstimate(
  payload: GenerateBudgetEstimatePayload,
  signal?: AbortSignal
): Promise<GeneratedBudgetEstimateResponse> {
  const response = await fetch('/api/budget-estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let data: Partial<GeneratedBudgetEstimateResponse> & { error?: string } = {};
  try {
    data = (await response.json()) as Partial<GeneratedBudgetEstimateResponse> & {
      error?: string;
    };
  } catch {
    // Non-JSON response fallback
  }

  if (!response.ok) {
    throw new Error(
      data.error || `Unable to generate budget estimate (${response.status}).`
    );
  }

  if (!data.breakdown) {
    throw new Error('No budget breakdown was returned. Please try again.');
  }

  return {
    title: data.title || `${payload.country} Trip Budget`,
    breakdown: {
      transportation: Math.max(0, Math.round(Number(data.breakdown.transportation) || 0)),
      accommodation: Math.max(0, Math.round(Number(data.breakdown.accommodation) || 0)),
      food: Math.max(0, Math.round(Number(data.breakdown.food) || 0)),
      activities: Math.max(0, Math.round(Number(data.breakdown.activities) || 0)),
      other: Math.max(0, Math.round(Number(data.breakdown.other) || 0)),
    },
    notes: data.notes || '',
  };
}
