import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppError } from "@raisai/shared";
import { api } from "../../lib/api";
import { EmptyState } from "../../components/EmptyState";
import type { Movie } from "./types";

export function MoviesPage() {
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [minutes, setMinutes] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api<{ items: Movie[] }>("/movies").then((r) => setMovies(r.items)).catch(() => setMovies([]));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const movie = await api<Movie>("/movies", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim() || "Untitled movie",
          idea: idea.trim() || undefined,
          targetDurationSeconds: minutes * 60,
        }),
      });
      navigate(`/movies/${movie.id}`);
    } catch (err) {
      setError(err instanceof AppError ? err.message : "The movie could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-page">
      <div className="workspace-page-head"><div><p className="lp-eyebrow mb-2">Cinema studio</p><h1 className="display-6 fw-bold mb-2">Movies</h1><p className="text-secondary mb-0">Describe what you want to make. RaisAI works out the rest.</p></div><span className="badge rounded-pill text-bg-warning align-self-center"><i className="bi bi-layers me-1" />Batch shots · coming soon</span></div>

      <form className="card mb-4" onSubmit={create}>
        <div className="card-body">
          {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
          <div className="mb-3">
            <label className="form-label" htmlFor="movie-title">Title</label>
            <input id="movie-title" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neon Rain" />
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="movie-idea">What is it about?</label>
            <textarea
              id="movie-idea"
              className="form-control"
              rows={3}
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="A 10-minute cyberpunk detective story set in Kuala Lumpur"
            />
          </div>
          <div className="mb-3" style={{ maxWidth: 200 }}>
            <label className="form-label" htmlFor="movie-length">Rough length</label>
            <div className="input-group">
              <input
                id="movie-length"
                type="number"
                className="form-control"
                min={1}
                max={120}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
              <span className="input-group-text">minutes</span>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Start a movie"}
          </button>
        </div>
      </form>

      {movies === null && <p className="text-secondary">Loading…</p>}
      {movies !== null && movies.length === 0 && (
        <EmptyState icon="camera-reels" title="No movies yet." description="Start with an idea above." />
      )}

      <div className="row g-3">
        {movies?.map((movie) => (
          <div className="col-sm-6 col-xl-4" key={movie.id}>
            <Link to={`/movies/${movie.id}`} className="card h-100 text-decoration-none rais-create-card">
              <div className="card-body">
                <h2 className="h6 mb-1">{movie.title}</h2>
                <p className="small text-secondary mb-1">{movie.logline ?? movie.idea ?? "No story yet."}</p>
                <span className="badge text-bg-secondary">{movie.status}</span>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
