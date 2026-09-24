// ---- Core domain types for raiseat ----

export type Currency = 'MYR' | 'SGD' | 'THB' | 'IDR' | 'BND' | 'USD' | 'EUR';

export type Unit =
  | 'kg' | 'g' | 'mg' | 'L' | 'ml'
  | 'cup' | 'tbsp' | 'tsp' | 'pcs'
  | 'biji' | 'ikat' | 'bungkus' | 'kotak' | 'tin' | 'botol' | 'packet';

export type IngredientCategory =
  | 'protein' | 'vegetable' | 'fruit' | 'grain' | 'noodle' | 'dairy'
  | 'egg' | 'sauce' | 'spice' | 'herb' | 'oil' | 'dry-goods' | 'seafood' | 'other';

export type StorageLocation = 'fridge' | 'freezer' | 'pantry' | 'counter';

export interface Ingredient {
  id: string;
  name: string;
  nameMs?: string; // Malay name
  category: IngredientCategory;
  /** canonical unit prices are stored against */
  unit: Unit;
  /** estimated MYR price per canonical unit (demo/local estimate) */
  pricePerUnit: number;
  /** typical retail pack, for shopping optimization */
  pack?: { qty: number; unit: Unit; price: number; label: string };
  /** typical shelf life in days once bought (for expiry heuristics) */
  shelfLifeDays: number;
  emoji?: string;
}

export interface PantryItem {
  id: string;
  ingredientId: string;
  qty: number;
  unit: Unit;
  location: StorageLocation;
  expiryDate?: string; // ISO date
  price?: number;
  brand?: string;
  notes?: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  qty: number; // for baseServings
  unit: Unit;
  optional?: boolean;
  note?: string;
}

export interface RecipeStep {
  text: string;
  timerMinutes?: number;
}

export interface Nutrition {
  calories: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export type Equipment =
  | 'rice-cooker' | 'stove' | 'oven' | 'air-fryer' | 'pan' | 'pot'
  | 'wok' | 'knife' | 'blender' | 'grill' | 'steamer';

export type Cuisine =
  | 'Malay' | 'Chinese' | 'Indian' | 'Peranakan' | 'Kelantan' | 'Terengganu'
  | 'Sabah' | 'Sarawak' | 'Penang' | 'Johor' | 'Western' | 'Thai' | 'Fusion';

export interface Recipe {
  id: string;
  title: string;
  emoji: string;
  description: string;
  cuisine: Cuisine;
  region?: string;
  difficulty: Difficulty;
  prepMinutes: number;
  cookMinutes: number;
  baseServings: number;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  equipment: Equipment[];
  tags: string[]; // 'one-pot' | 'travel' | 'budget' | 'classic' | 'spicy' ...
  nutritionPerServing: Nutrition;
  rating: number;
  halalFriendly: boolean; // ingredient-level heuristic, NOT certification
  leftoverIdeas?: string[]; // recipe ids or free text
  storageNote?: string;
}

export type Confidence = 'Low' | 'Medium' | 'High';

export interface CostEstimate {
  total: number;
  low: number;
  high: number;
  perServing: number;
  currency: Currency;
  confidence: Confidence;
  breakdown: { ingredientId: string; name: string; qty: number; unit: Unit; cost: number }[];
  source: string;
}

export interface Substitution {
  forIngredientId: string;
  substituteId: string;
  similarity: 1 | 2 | 3 | 4 | 5;
  note: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  ingredientId?: string;
  qty: number;
  unit: Unit;
  category: IngredientCategory;
  checked: boolean;
  owned: boolean;
  estimatedCost?: number;
  fromRecipes: string[]; // recipe titles
  packSuggestion?: string;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlanItem {
  id: string;
  day: number; // 0=Mon
  slot: MealSlot;
  recipeId: string;
  servings: number;
}

export interface RouteStop {
  name: string;
  km: number; // distance from start
  kind: 'meal' | 'snack' | 'fuel' | 'attraction';
  suggestion: string;
  pricePerPerson: [number, number];
}

export interface TravelRoute {
  id: string;
  name: string;
  from: string;
  to: string;
  distanceKm: number;
  driveHours: number;
  stops: RouteStop[];
  specialties: string[];
}

export interface FoodPlace {
  id: string;
  name: string;
  city: string;
  kind: 'restaurant' | 'hawker' | 'kopitiam' | 'food-court' | 'cafe';
  cuisine: Cuisine | 'Mixed';
  pricePerPerson: [number, number];
  rating: number;
  halalClaimed: boolean; // user-reported, not verified certification
  dishes: string[];
}

export interface GroceryStore {
  id: string;
  name: string;
  kind: 'supermarket' | 'wet-market' | 'convenience' | 'online';
  city: string;
  priceLevel: 1 | 2 | 3; // 1 cheap
}

export interface UserPreferences {
  name: string;
  currency: Currency;
  householdAdults: number;
  householdKids: number;
  favoriteCuisines: Cuisine[];
  dietary: string[]; // 'no-pork' | 'halal-preference' | 'vegetarian' | ...
  equipment: Equipment[];
  monthlyBudget: number;
}

export interface FoodPlanningIntent {
  ingredients: string[]; // ingredient ids
  budget?: number;
  servings?: number;
  maxMinutes?: number;
  cuisine?: Cuisine;
  routeQuery?: string;
  expiring?: boolean;
  raw: string;
}

export interface ScoredRecipe {
  recipe: Recipe;
  score: number;
  matchPercent: number;
  have: string[]; // ingredient names user has
  missing: string[]; // ingredient names to buy
  missingIds: string[];
  cost: CostEstimate;
  reasons: string[];
  warnings: string[];
  servings: number;
}
