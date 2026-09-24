import type { Template } from "../../types";

export const goRestApi: Template = {
  id: "go-rest-api",
  title: "Go REST API + PostgreSQL",
  description:
    "REST API in Go using the standard library's net/http (1.22+ routing) and pgx for PostgreSQL — no framework needed. Handlers → service → store, tests, Docker.",
  technologies: ["go", "postgresql", "docker"],
  projectTypes: ["Web API", "REST API"],
  architectures: ["layered", "simple"],
  databases: ["postgresql"],
  difficulty: "intermediate",
  productionReady: true,
  prerequisites: ["Go 1.22+", "Docker (for PostgreSQL)"],
  estimatedSetupMinutes: 8,
  versions: [{ name: "Go", version: "1.22+" }],
  lastReviewed: "2026-09",
  tags: ["go", "golang", "rest", "api", "postgres", "pgx", "stdlib"],
  patterns: ["dependency-injection", "repository"],
  recipes: ["docker-compose-postgres", "github-actions-ci", "health-checks"],
  relatedTemplates: ["rust-axum-api", "node-express-postgres-api"],
  zeroToRunning: ["01 Create module", "02 Add the code", "03 Database", "04 Run & test"],
  completeness: [
    { label: "Project creation", done: true },
    { label: "Dependencies", done: true },
    { label: "Folder structure", done: true },
    { label: "Configuration", done: true },
    { label: "Database", done: true },
    { label: "API endpoint", done: true },
    { label: "Testing", done: true },
    { label: "Docker", done: true },
    { label: "CI/CD", done: false },
  ],
  nextSteps: [
    { label: "Add health checks", recipeId: "health-checks" },
    { label: "Add CI", recipeId: "github-actions-ci" },
    { label: "Add pagination", recipeId: "pagination" },
  ],
  steps: [
    {
      id: "create",
      title: "01 Create module",
      description: "Initialize the module and get the pgx driver. Gin/Fiber/Echo are fine too — but Go 1.22's stdlib router handles method+path routing natively, so start without a framework.",
      commands: [
        {
          shell: "bash",
          provenance: "official",
          code: `mkdir my-api && cd my-api
go mod init github.com/you/my-api
go get github.com/jackc/pgx/v5/pgxpool`,
          description: "Module + PostgreSQL driver",
        },
        { shell: "bash", code: "mkdir -p internal/user cmd/api", description: "Standard Go layout: cmd/ for binaries, internal/ for packages" },
      ],
    },
    {
      id: "code",
      title: "02 Add the code",
      description: "Store (SQL) → service (rules) → handler (HTTP), wired in main.",
      files: [
        {
          path: "internal/user/user.go",
          language: "go",
          content: `package user

import "time"

type User struct {
	ID        string    \`json:"id"\`
	Email     string    \`json:"email"\`
	Name      string    \`json:"name"\`
	CreatedAt time.Time \`json:"createdAt"\`
}`,
        },
        {
          path: "internal/user/store.go",
          language: "go",
          content: `package user

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ db *pgxpool.Pool }

func NewStore(db *pgxpool.Pool) *Store { return &Store{db: db} }

func (s *Store) Insert(ctx context.Context, email, name string) (User, error) {
	var u User
	err := s.db.QueryRow(ctx,
		"INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id, email, name, created_at",
		email, name,
	).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
	return u, err
}

func (s *Store) GetByID(ctx context.Context, id string) (User, error) {
	var u User
	err := s.db.QueryRow(ctx,
		"SELECT id, email, name, created_at FROM users WHERE id = $1", id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	return u, err
}

func (s *Store) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx,
		"SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)", email,
	).Scan(&exists)
	return exists, err
}`,
        },
        {
          path: "internal/user/service.go",
          language: "go",
          description: "Service depends on a small interface so tests can fake the store.",
          content: `package user

import (
	"context"
	"errors"
	"strings"
)

var (
	ErrNotFound     = errors.New("not_found")
	ErrEmailTaken   = errors.New("email_taken")
	ErrInvalidInput = errors.New("invalid_input")
)

type Repository interface {
	Insert(ctx context.Context, email, name string) (User, error)
	GetByID(ctx context.Context, id string) (User, error)
	ExistsByEmail(ctx context.Context, email string) (bool, error)
}

type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }

func (s *Service) Create(ctx context.Context, email, name string) (User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	name = strings.TrimSpace(name)
	if !strings.Contains(email, "@") || name == "" {
		return User{}, ErrInvalidInput
	}
	taken, err := s.repo.ExistsByEmail(ctx, email)
	if err != nil {
		return User{}, err
	}
	if taken {
		return User{}, ErrEmailTaken
	}
	return s.repo.Insert(ctx, email, name)
}

func (s *Service) Get(ctx context.Context, id string) (User, error) {
	return s.repo.GetByID(ctx, id)
}`,
        },
        {
          path: "internal/user/handler.go",
          language: "go",
          content: `package user

import (
	"encoding/json"
	"errors"
	"net/http"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/users", h.create)
	mux.HandleFunc("GET /api/users/{id}", h.get)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var body struct{ Email, Name string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json")
		return
	}
	u, err := h.svc.Create(r.Context(), body.Email, body.Name)
	switch {
	case errors.Is(err, ErrInvalidInput):
		writeError(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, ErrEmailTaken):
		writeError(w, http.StatusConflict, err.Error())
	case err != nil:
		writeError(w, http.StatusInternalServerError, "internal_error")
	default:
		writeJSON(w, http.StatusCreated, u)
	}
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	u, err := h.svc.Get(r.Context(), r.PathValue("id"))
	switch {
	case errors.Is(err, ErrNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case err != nil:
		writeError(w, http.StatusInternalServerError, "internal_error")
	default:
		writeJSON(w, http.StatusOK, u)
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code string) {
	writeJSON(w, status, map[string]string{"error": code})
}`,
        },
        {
          path: "cmd/api/main.go",
          language: "go",
          content: `package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/you/my-api/internal/user"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	pool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte("ok"))
	})

	svc := user.NewService(user.NewStore(pool))
	user.NewHandler(svc).Register(mux)

	addr := ":" + cmp(os.Getenv("PORT"), "3000")
	log.Printf("listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func cmp(v, fallback string) string {
	if v == "" {
		return fallback
	}
	return v
}`,
        },
        {
          path: "internal/user/service_test.go",
          language: "go",
          description: "Table test with an in-memory fake repository.",
          content: `package user

import (
	"context"
	"errors"
	"testing"
)

type fakeRepo struct{ users map[string]User }

func (f *fakeRepo) Insert(_ context.Context, email, name string) (User, error) {
	u := User{ID: "1", Email: email, Name: name}
	f.users[email] = u
	return u, nil
}
func (f *fakeRepo) GetByID(_ context.Context, id string) (User, error) { return User{}, ErrNotFound }
func (f *fakeRepo) ExistsByEmail(_ context.Context, email string) (bool, error) {
	_, ok := f.users[email]
	return ok, nil
}

func TestCreate(t *testing.T) {
	svc := NewService(&fakeRepo{users: map[string]User{}})

	u, err := svc.Create(context.Background(), " Ada@Example.com ", "Ada")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if u.Email != "ada@example.com" {
		t.Errorf("email not normalized: %q", u.Email)
	}

	_, err = svc.Create(context.Background(), "ada@example.com", "Other")
	if !errors.Is(err, ErrEmailTaken) {
		t.Errorf("expected ErrEmailTaken, got %v", err)
	}
}`,
        },
        {
          path: "migrations/001_users.sql",
          language: "sql",
          content: `CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);`,
        },
      ],
    },
    {
      id: "database",
      title: "03 Database",
      description: "Start PostgreSQL and apply the migration.",
      commands: [
        {
          shell: "bash",
          code: `docker run -d --name my-api-db \\
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=dev_only_password -e POSTGRES_DB=app \\
  -p 5432:5432 postgres:16-alpine

docker exec -i my-api-db psql -U app -d app < migrations/001_users.sql`,
          description: "Database + schema",
        },
      ],
    },
    {
      id: "run",
      title: "04 Run & test",
      description: "Run, hit the endpoint, run tests.",
      commands: [
        {
          shell: "bash",
          code: `export DATABASE_URL=postgres://app:dev_only_password@localhost:5432/app
go run ./cmd/api`,
          description: "Start the API",
        },
        {
          shell: "bash",
          code: `curl -s -X POST http://localhost:3000/api/users \\
  -H "Content-Type: application/json" \\
  -d '{"email":"ada@example.com","name":"Ada Lovelace"}' | jq`,
          description: "Create a user",
        },
        { shell: "bash", provenance: "official", code: "go test ./...", description: "Run tests" },
      ],
    },
    {
      id: "docker",
      title: "05 Docker",
      description: "Tiny static binary in a distroless-style image.",
      files: [
        {
          path: "Dockerfile",
          language: "dockerfile",
          content: `FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /bin/api ./cmd/api

FROM gcr.io/distroless/static-debian12
COPY --from=build /bin/api /api
EXPOSE 3000
ENTRYPOINT ["/api"]`,
        },
      ],
    },
  ],
  files: [],
};
