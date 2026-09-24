import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { RECIPE_MAP } from '../data/recipes';
import { INGREDIENT_MAP } from '../data/ingredients';
import { formatQty } from '../utils/format';
import { useApp } from '../state/AppContext';
import EmptyState from '../components/EmptyState';

export default function CookingMode() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const recipe = id ? RECIPE_MAP[id] : undefined;
  const { addHistory } = useApp();

  const [step, setStep] = useState(0);
  const [checklist, setChecklist] = useState<Set<number>>(new Set());
  const [showChecklist, setShowChecklist] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() => {
    const t = recipe?.steps[0]?.timerMinutes;
    return t ? t * 60 : null;
  });
  const [running, setRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneRef = useRef(false);

  const servings = Number(params.get('servings')) || recipe?.baseServings || 4;
  const factor = recipe ? servings / recipe.baseServings : 1;

  const current = recipe?.steps[step];

  const goToStep = (next: number) => {
    setStep(next);
    setRunning(false);
    const t = recipe?.steps[next]?.timerMinutes;
    setSecondsLeft(t ? t * 60 : null);
  };

  useEffect(() => {
    if (running && secondsLeft !== null && secondsLeft > 0) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s === null) return s;
          if (s <= 1) setRunning(false);
          return s - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
    return undefined;
  }, [running, secondsLeft]);

  // keep screen awake where supported
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => { /* unsupported */ });
    return () => { lock?.release().catch(() => { /* noop */ }); };
  }, []);

  const totalSteps = recipe?.steps.length ?? 0;
  const isDone = step >= totalSteps;

  useEffect(() => {
    if (isDone && recipe && !doneRef.current) {
      doneRef.current = true;
      addHistory('cooked', recipe.title);
    }
  }, [isDone, recipe, addHistory]);

  const requiredList = useMemo(() => recipe?.ingredients ?? [], [recipe]);

  if (!recipe) {
    return (
      <div className="container-xl py-4">
        <EmptyState icon="🍳" title="Recipe not found"><Link to="/discover">Browse recipes</Link></EmptyState>
      </div>
    );
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="cooking-mode container-lg py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link to={`/recipes/${recipe.id}?servings=${servings}`} className="btn btn-sm btn-outline-secondary">✕ Exit</Link>
        <div className="fw-semibold">{recipe.emoji} {recipe.title} <span className="text-muted">· {servings} servings</span></div>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowChecklist((v) => !v)}>
          {showChecklist ? 'Hide' : 'Show'} ingredients
        </button>
      </div>

      {showChecklist && !isDone && (
        <div className="card mb-3"><div className="card-body py-2">
          <div className="d-flex flex-wrap gap-2">
            {requiredList.map((ri, i) => {
              const ing = INGREDIENT_MAP[ri.ingredientId];
              const on = checklist.has(i);
              return (
                <button
                  key={ri.ingredientId}
                  className={`btn btn-sm ${on ? 'btn-success' : 'btn-outline-secondary'}`}
                  onClick={() => setChecklist((c) => {
                    const n = new Set(c);
                    if (n.has(i)) n.delete(i); else n.add(i);
                    return n;
                  })}
                  aria-pressed={on}
                >
                  {on ? '✓ ' : ''}{ing?.name} · {formatQty(ri.qty * factor, ri.unit)}
                </button>
              );
            })}
          </div>
        </div></div>
      )}

      <div className="progress mb-3" style={{ height: 6 }} role="progressbar"
        aria-label="Cooking progress" aria-valuenow={Math.min(step, totalSteps)} aria-valuemin={0} aria-valuemax={totalSteps}>
        <div className="progress-bar bg-success" style={{ width: `${(Math.min(step, totalSteps) / totalSteps) * 100}%` }} />
      </div>

      {!isDone && current ? (
        <div className="card cook-card text-center">
          <div className="card-body p-5">
            <div className="text-muted mb-3">STEP {step + 1} / {totalSteps}</div>
            <p className="cook-step-text">{current.text}</p>

            {current.timerMinutes && secondsLeft !== null && (
              <div className="my-4">
                <div className={`cook-timer ${secondsLeft === 0 ? 'text-success' : ''}`} aria-live="polite">
                  {secondsLeft === 0 ? '✓ Done!' : fmtTime(secondsLeft)}
                </div>
                <div className="d-flex gap-2 justify-content-center mt-2">
                  <button className="btn btn-outline-primary" onClick={() => setRunning((r) => !r)} disabled={secondsLeft === 0}>
                    {running ? '⏸ Pause' : `▶ Start ${current.timerMinutes} min`}
                  </button>
                  <button className="btn btn-outline-secondary" onClick={() => { setRunning(false); setSecondsLeft(current.timerMinutes! * 60); }}>
                    ↺ Reset
                  </button>
                </div>
              </div>
            )}

            <div className="d-flex gap-3 justify-content-center mt-4">
              <button className="btn btn-lg btn-outline-secondary px-4" onClick={() => goToStep(Math.max(0, step - 1))} disabled={step === 0}>
                ← Previous
              </button>
              <button className="btn btn-lg btn-primary px-5" onClick={() => goToStep(step + 1)}>
                {step === totalSteps - 1 ? 'Finish ✓' : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="card cook-card text-center">
          <div className="card-body p-5">
            <div className="display-3">🎉</div>
            <h2 className="h3 mt-3">Selamat menjamu selera!</h2>
            <p className="text-muted">You finished {recipe.title} for {servings} people.</p>
            {recipe.leftoverIdeas?.length ? (
              <div className="alert alert-light border text-start">
                ♻️ <b>Got leftovers?</b>
                <ul className="mb-0 mt-1">{recipe.leftoverIdeas.map((l) => <li key={l}>{l}</li>)}</ul>
              </div>
            ) : null}
            <div className="d-flex gap-2 justify-content-center mt-3">
              <Link to="/" className="btn btn-primary">Back home</Link>
              <button className="btn btn-outline-secondary" onClick={() => { goToStep(0); doneRef.current = false; }}>Cook again</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
