import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { RECIPE_MAP } from '../data/recipes';
import { scoreRecipe } from '../services/recommend';
import RecipeCard from '../components/RecipeCard';
import EmptyState from '../components/EmptyState';

export default function Favorites() {
  const { favorites, ownedIngredientIds, prefs } = useApp();

  const scored = useMemo(() => favorites
    .map((id) => RECIPE_MAP[id])
    .filter(Boolean)
    .map((r) => scoreRecipe(r, {
      ownedIds: ownedIngredientIds,
      servings: prefs.householdAdults + prefs.householdKids || 4,
      favoriteCuisines: prefs.favoriteCuisines,
    })), [favorites, ownedIngredientIds, prefs]);

  return (
    <div className="container-xl py-3">
      <h1 className="h3">❤️ Favorites</h1>
      {scored.length === 0 ? (
        <EmptyState icon="🤍" title="No favorites yet">
          Tap the heart on any recipe to save it here.
          <div className="mt-2"><Link to="/discover" className="btn btn-primary btn-sm">Discover recipes</Link></div>
        </EmptyState>
      ) : (
        <div className="row g-3 mt-1">
          {scored.map((s) => (
            <div className="col-12 col-md-6 col-xl-3" key={s.recipe.id}><RecipeCard scored={s} /></div>
          ))}
        </div>
      )}
    </div>
  );
}
