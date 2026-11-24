import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { type Currency, isSameMonth, uid } from '@/lib/format';
import { deviceStorage } from './storage';

export type CategoryId = 'food' | 'transport' | 'shopping' | 'bills' | 'fun' | 'other';

export const CATEGORIES: Record<
  CategoryId,
  { label: string; color: string; icon: 'coffee' | 'navigation' | 'shopping-bag' | 'file-text' | 'film' | 'grid' }
> = {
  food: { label: 'Food', color: '#C96F1C', icon: 'coffee' },
  transport: { label: 'Transport', color: '#3F7C9E', icon: 'navigation' },
  shopping: { label: 'Shopping', color: '#C7475B', icon: 'shopping-bag' },
  bills: { label: 'Bills', color: '#7A5EA8', icon: 'file-text' },
  fun: { label: 'Fun', color: '#4E8A40', icon: 'film' },
  other: { label: 'Other', color: '#7B6A5C', icon: 'grid' },
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  category: CategoryId;
  /** Optional place this expense is tagged with; it draws down that place's budget. */
  placeId?: string;
  createdAt: number;
};

/** A named pot of money inside the monthly budget, e.g. "FreshMart · $300". */
export type Place = {
  id: string;
  name: string;
  amount: number;
  color: string;
  createdAt: number;
};

export const PLACE_COLORS = ['#4A12A6', '#E8672A', '#10B981', '#3B82F6', '#D946EF', '#C2341F', '#0EA5A4'];

type ExpensesState = {
  currency: Currency;
  monthlyBudget: number;
  expenses: Expense[];
  places: Place[];
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => void;
  addPlace: (p: { name: string; amount: number }) => void;
  updatePlace: (id: string, p: { name: string; amount: number }) => void;
  removePlace: (id: string) => void;
  removeExpense: (id: string) => void;
  setBudget: (amount: number) => void;
  setCurrency: (c: Currency) => void;
};

export const useExpenses = create<ExpensesState>()(
  persist(
    (set) => ({
      currency: 'USD',
      monthlyBudget: 0,
      expenses: [],
      places: [],
      addExpense: (e) =>
        set((s) => ({ expenses: [{ ...e, id: uid(), createdAt: Date.now() }, ...s.expenses] })),
      addPlace: ({ name, amount }) =>
        set((s) => ({
          places: [
            ...s.places,
            {
              id: uid(),
              name,
              amount,
              // Prefer a colour no other place is using yet.
              color:
                PLACE_COLORS.find((c) => !s.places.some((p) => p.color === c)) ??
                PLACE_COLORS[s.places.length % PLACE_COLORS.length],
              createdAt: Date.now(),
            },
          ],
        })),
      updatePlace: (id, { name, amount }) =>
        set((s) => ({ places: s.places.map((p) => (p.id === id ? { ...p, name, amount } : p)) })),
      // Removing a place keeps its expenses but un-tags them.
      removePlace: (id) =>
        set((s) => ({
          places: s.places.filter((p) => p.id !== id),
          expenses: s.expenses.map((e) => (e.placeId === id ? { ...e, placeId: undefined } : e)),
        })),
      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) })),
      setBudget: (monthlyBudget) => set({ monthlyBudget }),
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'hani.expenses',
      version: 10,
      storage: deviceStorage,
      // Saved data from before the clean-slate release (version 10) is dropped: the app
      // now starts empty, with no demo content.
      migrate: (persisted, version) => (version < 10 ? {} : persisted),
    },
  ),
);

/** Spent this month per place id. Places reset each month, like the overall budget. */
export function spentByPlace(expenses: Expense[], now = new Date()) {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    if (e.placeId && isSameMonth(e.createdAt, now)) map[e.placeId] = (map[e.placeId] ?? 0) + e.amount;
  }
  return map;
}

/** Woodland dot colour for a place, derived from its colour slot so each place keeps its look. */
const PLACE_FILLS = ['#7A5EA8', '#E08A32', '#5E9A4E', '#3F7C9E', '#C7475B', '#B8542E', '#3F9A8C'];
export function placeFill(place: Place) {
  const i = PLACE_COLORS.indexOf(place.color);
  return PLACE_FILLS[(i < 0 ? 0 : i) % PLACE_FILLS.length];
}
