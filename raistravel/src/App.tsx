import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import { SkeletonCards } from './components/Skeletons'

const Landing = lazy(() => import('./pages/Landing'))
const PlanWizard = lazy(() => import('./pages/PlanWizard'))
const Results = lazy(() => import('./pages/Results'))
const DestinationsPage = lazy(() => import('./pages/DestinationsPage'))
const DestinationDetail = lazy(() => import('./pages/DestinationDetail'))
const RoutesPage = lazy(() => import('./pages/RoutesPage'))
const RouteDetail = lazy(() => import('./pages/RouteDetail'))
const MyTrips = lazy(() => import('./pages/MyTrips'))
const TripDetail = lazy(() => import('./pages/TripDetail'))
const AlertsPage = lazy(() => import('./pages/AlertsPage'))
const ProvidersPage = lazy(() => import('./pages/ProvidersPage'))

function PageLoader() {
  return <div className="container py-5"><SkeletonCards count={3} message="Loading…" /></div>
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Suspense fallback={<PageLoader />}><Landing /></Suspense>} />
        <Route path="/plan" element={<Suspense fallback={<PageLoader />}><PlanWizard /></Suspense>} />
        <Route path="/plan/results" element={<Suspense fallback={<PageLoader />}><Results /></Suspense>} />
        <Route path="/destinations" element={<Suspense fallback={<PageLoader />}><DestinationsPage /></Suspense>} />
        <Route path="/destinations/:slug" element={<Suspense fallback={<PageLoader />}><DestinationDetail /></Suspense>} />
        <Route path="/routes" element={<Suspense fallback={<PageLoader />}><RoutesPage /></Suspense>} />
        <Route path="/routes/:slug" element={<Suspense fallback={<PageLoader />}><RouteDetail /></Suspense>} />
        <Route path="/trips" element={<Suspense fallback={<PageLoader />}><MyTrips /></Suspense>} />
        <Route path="/trips/:id" element={<Suspense fallback={<PageLoader />}><TripDetail /></Suspense>} />
        <Route path="/alerts" element={<Suspense fallback={<PageLoader />}><AlertsPage /></Suspense>} />
        <Route path="/providers" element={<Suspense fallback={<PageLoader />}><ProvidersPage /></Suspense>} />
        <Route path="/compare" element={<Navigate to="/plan/results" replace />} />
        <Route path="*" element={
          <div className="container py-5 text-center">
            <h1 className="display-6">Page not found</h1>
            <p className="rt-muted">The page you're looking for doesn't exist.</p>
          </div>
        } />
      </Route>
    </Routes>
  )
}
