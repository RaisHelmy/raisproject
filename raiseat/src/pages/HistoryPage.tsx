import { Link } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import EmptyState from '../components/EmptyState';

const ICONS = { search: '🔍', cooked: '🍳', plan: '📅', shopping: '🛒' } as const;

export default function HistoryPage() {
  const { history } = useApp();

  return (
    <div className="container-xl py-3">
      <h1 className="h3">🕘 History</h1>
      {history.length === 0 ? (
        <EmptyState icon="🕘" title="Nothing here yet">
          Searches, cooked meals, plans and shopping lists will show up here.
          <div className="mt-2"><Link to="/" className="btn btn-primary btn-sm">Start cooking</Link></div>
        </EmptyState>
      ) : (
        <div className="card mt-3">
          <ul className="list-group list-group-flush">
            {history.map((h) => (
              <li key={h.id} className="list-group-item d-flex justify-content-between align-items-center">
                <span>{ICONS[h.kind]} {h.label}</span>
                <span className="small text-muted">{new Date(h.date).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
