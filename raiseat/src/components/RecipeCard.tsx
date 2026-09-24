import { Link } from 'react-router-dom';
import type { ScoredRecipe } from '../types';
import { formatRM, formatMinutes } from '../utils/format';
import { useApp } from '../state/AppContext';

export default function RecipeCard({ scored, showWhy = false }: { scored: ScoredRecipe; showWhy?: boolean }) {
  const { favorites, toggleFavorite } = useApp();
  const { recipe, matchPercent, missing, cost, reasons, warnings, servings } = scored;
  const totalMin = recipe.prepMinutes + recipe.cookMinutes;
  const fav = favorites.includes(recipe.id);

  return (
    <div className="card recipe-card h-100">
      <div className="card-body d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start">
          <div className="recipe-emoji" aria-hidden>{recipe.emoji}</div>
          <button
            className={`btn btn-sm fav-btn ${fav ? 'fav-on' : ''}`}
            onClick={() => toggleFavorite(recipe.id)}
            aria-label={fav ? 'Remove from favorites' : 'Save to favorites'}
          >
            {fav ? '❤️' : '🤍'}
          </button>
        </div>
        <h3 className="h6 mt-2 mb-1">{recipe.title}</h3>
        <div className="small text-muted mb-2">
          ⭐ {recipe.rating.toFixed(1)} · {recipe.cuisine} · {recipe.difficulty}
        </div>
        <div className="d-flex flex-wrap gap-2 small mb-2">
          <span className="badge text-bg-light border">⏱ {formatMinutes(totalMin)}</span>
          <span className="badge text-bg-light border">👥 Serves {servings}</span>
        </div>
        <div className="price-line">
          <span className="fw-semibold">{formatRM(cost.total)}</span>
          <span className="text-muted small"> · {formatRM(cost.perServing)}/person</span>
        </div>

        <div className="mt-2">
          <div className="d-flex justify-content-between small">
            <span className="text-muted">Ingredients you have</span>
            <span className="fw-semibold">{matchPercent}%</span>
          </div>
          <div className="progress match-bar" role="progressbar" aria-label="Ingredient match"
            aria-valuenow={matchPercent} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`progress-bar ${matchPercent >= 80 ? 'bg-success' : matchPercent >= 50 ? 'bg-warning' : 'bg-danger'}`}
              style={{ width: `${matchPercent}%` }}
            />
          </div>
          {missing.length > 0 && (
            <div className="small text-muted mt-1 text-truncate" title={missing.join(', ')}>
              Missing: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` +${missing.length - 3}` : ''}
            </div>
          )}
          {missing.length === 0 && <div className="small text-success mt-1">✓ You have everything</div>}
        </div>

        {showWhy && reasons.length > 0 && (
          <ul className="why-list small mt-2 mb-0">
            {reasons.slice(0, 3).map((r) => <li key={r}>✓ {r}</li>)}
            {warnings.slice(0, 1).map((w) => <li key={w} className="text-warning-emphasis">⚠ {w}</li>)}
          </ul>
        )}

        <div className="mt-auto pt-3 d-flex gap-2">
          <Link to={`/recipes/${recipe.id}?servings=${servings}`} className="btn btn-primary btn-sm flex-grow-1">
            View Recipe
          </Link>
          <Link to={`/cook/${recipe.id}`} className="btn btn-outline-secondary btn-sm">
            Cook Now
          </Link>
        </div>
      </div>
    </div>
  );
}
