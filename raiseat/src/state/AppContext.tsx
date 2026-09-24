/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  MealPlanItem, PantryItem, ShoppingListItem, UserPreferences,
} from '../types';
import { buildDemoPantry } from '../data/demoPantry';

const STORAGE_PREFIX = 'raiseat:';

function usePersistentState<T>(key: string, initial: () => T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + key);
      if (raw != null) return JSON.parse(raw) as T;
    } catch { /* fall through to initial */ }
    return initial();
  });
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    } catch { /* storage unavailable — stay in-memory */ }
  }, [key, value]);
  return [value, setValue];
}

export interface HistoryEntry {
  id: string;
  kind: 'search' | 'cooked' | 'plan' | 'shopping';
  label: string;
  date: string;
}

interface AppState {
  pantry: PantryItem[];
  setPantry: (v: PantryItem[] | ((p: PantryItem[]) => PantryItem[])) => void;
  shopping: ShoppingListItem[];
  setShopping: (v: ShoppingListItem[] | ((p: ShoppingListItem[]) => ShoppingListItem[])) => void;
  favorites: string[];
  toggleFavorite: (recipeId: string) => void;
  mealPlan: MealPlanItem[];
  setMealPlan: (v: MealPlanItem[] | ((p: MealPlanItem[]) => MealPlanItem[])) => void;
  prefs: UserPreferences;
  setPrefs: (v: UserPreferences | ((p: UserPreferences) => UserPreferences)) => void;
  history: HistoryEntry[];
  addHistory: (kind: HistoryEntry['kind'], label: string) => void;
  ownedIngredientIds: Set<string>;
  resetDemoData: () => void;
}

const DEFAULT_PREFS: UserPreferences = {
  name: '',
  currency: 'MYR',
  householdAdults: 2,
  householdKids: 0,
  favoriteCuisines: ['Malay', 'Kelantan', 'Sabah', 'Sarawak'],
  dietary: [],
  equipment: ['rice-cooker', 'stove', 'pan', 'pot', 'wok', 'knife', 'blender'],
  monthlyBudget: 1500,
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [pantry, setPantry] = usePersistentState<PantryItem[]>('pantry', buildDemoPantry);
  const [shopping, setShopping] = usePersistentState<ShoppingListItem[]>('shopping', () => []);
  const [favorites, setFavorites] = usePersistentState<string[]>('favorites', () => ['nasi-lemak', 'sarawak-laksa']);
  const [mealPlan, setMealPlan] = usePersistentState<MealPlanItem[]>('mealplan', () => []);
  const [prefs, setPrefs] = usePersistentState<UserPreferences>('prefs', () => DEFAULT_PREFS);
  const [history, setHistory] = usePersistentState<HistoryEntry[]>('history', () => []);

  const toggleFavorite = useCallback((recipeId: string) => {
    setFavorites((f) => (f.includes(recipeId) ? f.filter((x) => x !== recipeId) : [...f, recipeId]));
  }, [setFavorites]);

  const addHistory = useCallback((kind: HistoryEntry['kind'], label: string) => {
    setHistory((h) => [
      { id: Math.random().toString(36).slice(2), kind, label, date: new Date().toISOString() },
      ...h,
    ].slice(0, 50));
  }, [setHistory]);

  const ownedIngredientIds = useMemo(
    () => new Set(pantry.filter((p) => p.qty > 0).map((p) => p.ingredientId)),
    [pantry],
  );

  const resetDemoData = useCallback(() => {
    setPantry(buildDemoPantry());
    setShopping([]);
    setMealPlan([]);
    setHistory([]);
  }, [setPantry, setShopping, setMealPlan, setHistory]);

  const value = useMemo<AppState>(() => ({
    pantry, setPantry, shopping, setShopping, favorites, toggleFavorite,
    mealPlan, setMealPlan, prefs, setPrefs, history, addHistory,
    ownedIngredientIds, resetDemoData,
  }), [pantry, setPantry, shopping, setShopping, favorites, toggleFavorite,
    mealPlan, setMealPlan, prefs, setPrefs, history, addHistory,
    ownedIngredientIds, resetDemoData]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
