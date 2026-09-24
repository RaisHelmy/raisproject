import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './state/AppContext';
import AppShell from './components/AppShell';
import Home from './pages/Home';

const Discover = lazy(() => import('./pages/Discover'));
const RecipeDetail = lazy(() => import('./pages/RecipeDetail'));
const CookingMode = lazy(() => import('./pages/CookingMode'));
const Pantry = lazy(() => import('./pages/Pantry'));
const Shopping = lazy(() => import('./pages/Shopping'));
const MealPlan = lazy(() => import('./pages/MealPlan'));
const Budget = lazy(() => import('./pages/Budget'));
const Travel = lazy(() => import('./pages/Travel'));
const Compare = lazy(() => import('./pages/Compare'));
const Favorites = lazy(() => import('./pages/Favorites'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const Settings = lazy(() => import('./pages/Settings'));

function Loading() {
  return (
    <div className="container-xl py-5 text-center text-muted" aria-busy="true">
      <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppShell>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/recipes/:id" element={<RecipeDetail />} />
              <Route path="/cook/:id" element={<CookingMode />} />
              <Route path="/pantry" element={<Pantry />} />
              <Route path="/shopping" element={<Shopping />} />
              <Route path="/meal-plan" element={<MealPlan />} />
              <Route path="/budget" element={<Budget />} />
              <Route path="/travel" element={<Travel />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </AppShell>
      </BrowserRouter>
    </AppProvider>
  );
}
