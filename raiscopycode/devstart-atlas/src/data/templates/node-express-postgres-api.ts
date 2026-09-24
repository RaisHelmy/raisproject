import type { Template } from "../../types";

export const nodeExpressPostgresApi: Template = {
  id: "node-express-postgres-api",
  title: "Node.js Express + PostgreSQL API",
  description:
    "TypeScript REST API with Express and node-postgres: layered routes → services → db structure, migrations, a real users endpoint, tests with Vitest, Docker and CI.",
  technologies: ["typescript", "nodejs", "express", "postgresql", "docker"],
  projectTypes: ["Web API", "REST API"],
  architectures: ["layered", "simple"],
  databases: ["postgresql"],
  difficulty: "beginner",
  productionReady: true,
  prerequisites: ["Node.js 20+ (or 22)", "Docker (for PostgreSQL)"],
  estimatedSetupMinutes: 8,
  versions: [
    { name: "Node.js", version: "22.x" },
    { name: "Express", version: "4.x" },
  ],
  lastReviewed: "2026-09",
  tags: ["node", "express", "typescript", "postgres", "rest", "api"],
  patterns: ["dependency-injection", "result", "pipeline"],
  recipes: ["jwt-authentication", "docker-compose-postgres", "github-actions-ci", "pagination", "input-validation", "cors"],
  relatedTemplates: ["bun-rest-api", "dotnet-clean-architecture", "fastapi-postgres"],
  zeroToRunning: ["01 Create project", "02 Install dependencies", "04 Add the code", "05 Database", "06 Run & test"],
  completeness: [
    { label: "Project creation", done: true },
    { label: "Dependencies", done: true },
    { label: "Folder structure", done: true },
    { label: "Configuration", done: true },
    { label: "Database", done: true },
    { label: "API endpoint", done: true },
    { label: "Testing", done: true },
    { label: "Docker", done: true },
    { label: "CI/CD", done: true },
    { label: "Kubernetes", done: false },
  ],
  nextSteps: [
    { label: "Add JWT authentication", recipeId: "jwt-authentication" },
    { label: "Add input validation with zod", recipeId: "input-validation" },
    { label: "Add CORS for your frontend", recipeId: "cors" },
    { label: "Add rate limiting", recipeId: "rate-limiting" },
    { label: "Add structured logging", recipeId: "structured-logging" },
    { label: "Add health checks", recipeId: "health-checks" },
  ],
  steps: [
    {
      id: "create",
      title: "01 Create project",
      description: "Initialize the project and TypeScript config.",
      commands: [
        {
          shell: "bash",
          provenance: "official",
          code: `mkdir my-api && cd my-api
npm init -y
npm pkg set type=module`,
          description: "Create the project as an ES module package",
        },
      ],
    },
    {
      id: "install",
      title: "02 Install dependencies",
      description: "Express + pg for runtime; TypeScript, tsx and Vitest for development.",
      commands: [
        {
          shell: "bash",
          provenance: "official",
          code: `npm install express pg
npm install -D typescript tsx vitest @types/express @types/pg @types/node`,
          description: "Runtime and dev dependencies",
        },
        {
          shell: "bash",
          code: `npm pkg set scripts.dev="tsx watch src/index.ts"
npm pkg set scripts.build="tsc"
npm pkg set scripts.start="node dist/index.js"
npm pkg set scripts.test="vitest run"`,
          description: "Add the npm scripts",
        },
      ],
    },
    {
      id: "structure",
      title: "03 Folder structure",
      description: "Layered but light: routes handle HTTP, services hold logic, db owns SQL.",
      commands: [
        { shell: "bash", code: "mkdir -p src/routes src/services src/db migrations", description: "Linux/macOS" },
        { shell: "powershell", code: "New-Item -ItemType Directory -Force src/routes, src/services, src/db, migrations", description: "PowerShell" },
      ],
      notes: [
        `my-api/
├── src/
│   ├── routes/        # HTTP layer
│   ├── services/      # business logic
│   ├── db/            # pool + queries
│   └── index.ts       # app entry
├── migrations/
├── tsconfig.json
└── package.json`,
      ],
    },
    {
      id: "code",
      title: "04 Add the code",
      description: "A complete create-and-fetch users flow, plus config that fails fast on missing env vars.",
      files: [
        {
          path: "tsconfig.json",
          language: "json",
          content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}`,
        },
        {
          path: "src/config.ts",
          language: "typescript",
          description: "Fail fast when required configuration is missing.",
          content: `function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(\`Missing required env var: \${name}\`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: requireEnv("DATABASE_URL"),
};`,
        },
        {
          path: "src/db/pool.ts",
          language: "typescript",
          content: `import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({ connectionString: config.databaseUrl });`,
        },
        {
          path: "src/db/users.ts",
          language: "typescript",
          description: "All SQL for the users table lives here.",
          content: `import { pool } from "./pool.js";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  created_at: string;
};

export async function insertUser(email: string, name: string): Promise<UserRow> {
  const { rows } = await pool.query<UserRow>(
    "INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *",
    [email, name],
  );
  return rows[0];
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE email = $1", [email]);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] ?? null;
}`,
        },
        {
          path: "src/services/users.ts",
          language: "typescript",
          description: "Business rules, returned as explicit results — no HTTP concepts here.",
          content: `import { findUserByEmail, findUserById, insertUser, type UserRow } from "../db/users.js";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export async function createUser(email: string, name: string): Promise<Result<UserRow>> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return { ok: false, error: "invalid_email" };
  if (!name.trim()) return { ok: false, error: "name_required" };
  if (await findUserByEmail(normalized)) return { ok: false, error: "email_taken" };

  const user = await insertUser(normalized, name.trim());
  return { ok: true, value: user };
}

export async function getUser(id: string): Promise<UserRow | null> {
  return findUserById(id);
}`,
        },
        {
          path: "src/routes/users.ts",
          language: "typescript",
          description: "Thin HTTP layer: parse, call the service, map to status codes.",
          content: `import { Router } from "express";
import { createUser, getUser } from "../services/users.js";

export const usersRouter = Router();

usersRouter.post("/", async (req, res, next) => {
  try {
    const { email, name } = req.body ?? {};
    const result = await createUser(String(email ?? ""), String(name ?? ""));
    if (!result.ok) {
      const status = result.error === "email_taken" ? 409 : 400;
      return res.status(status).json({ error: result.error });
    }
    res.status(201).json(result.value);
  } catch (err) {
    next(err);
  }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    const user = await getUser(req.params.id);
    if (!user) return res.status(404).json({ error: "not_found" });
    res.json(user);
  } catch (err) {
    next(err);
  }
});`,
        },
        {
          path: "src/index.ts",
          language: "typescript",
          description: "App entry: middleware, routes, error handler.",
          content: `import express from "express";
import { config } from "./config.js";
import { usersRouter } from "./routes/users.js";

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
app.use("/api/users", usersRouter);

// central error handler — no raw stack traces to clients
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(config.port, () => {
  console.log(\`API listening on http://localhost:\${config.port}\`);
});`,
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
        {
          path: ".env.example",
          language: "text",
          description: "Copy to .env and fill in. ⚠ Replace values before running; never commit .env.",
          content: `DATABASE_URL=postgres://app:dev_only_password@localhost:5432/app
PORT=3000`,
        },
        {
          path: "src/services/users.test.ts",
          language: "typescript",
          description: "Service test with the db module mocked — no database needed.",
          content: `import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../db/users.js", () => ({
  findUserByEmail: vi.fn(async () => null),
  findUserById: vi.fn(async () => null),
  insertUser: vi.fn(async (email: string, name: string) => ({
    id: "00000000-0000-0000-0000-000000000001",
    email,
    name,
    created_at: new Date().toISOString(),
  })),
}));

import { createUser } from "./users.js";
import { findUserByEmail } from "../db/users.js";

describe("createUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a user with a normalized email", async () => {
    const result = await createUser("  Ada@Example.com ", "Ada");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe("ada@example.com");
  });

  it("rejects a taken email", async () => {
    vi.mocked(findUserByEmail).mockResolvedValueOnce({
      id: "x", email: "ada@example.com", name: "Ada", created_at: "",
    });
    const result = await createUser("ada@example.com", "Ada");
    expect(result).toEqual({ ok: false, error: "email_taken" });
  });
});`,
        },
      ],
    },
    {
      id: "database",
      title: "05 Database",
      description: "Start PostgreSQL and apply the migration.",
      commands: [
        {
          shell: "bash",
          code: `docker run -d --name my-api-db \\
  -e POSTGRES_USER=app -e POSTGRES_PASSWORD=dev_only_password -e POSTGRES_DB=app \\
  -p 5432:5432 -v my-api-pgdata:/var/lib/postgresql/data \\
  postgres:16-alpine`,
          description: "Start PostgreSQL in Docker",
        },
        {
          shell: "bash",
          code: `docker exec -i my-api-db psql -U app -d app < migrations/001_users.sql`,
          description: "Apply the migration (for real projects, adopt node-pg-migrate — see the migrations recipe)",
        },
      ],
    },
    {
      id: "run",
      title: "06 Run & test",
      description: "Start the dev server and exercise the endpoint.",
      commands: [
        { shell: "bash", code: "cp .env.example .env\nnpm run dev", description: "Configure env and start with hot reload" },
        {
          shell: "bash",
          code: `curl -s -X POST http://localhost:3000/api/users \\
  -H "Content-Type: application/json" \\
  -d '{"email":"ada@example.com","name":"Ada Lovelace"}' | jq`,
          description: "Create a user",
        },
        { shell: "bash", code: "npm test", description: "Run the unit tests" },
      ],
    },
    {
      id: "docker",
      title: "07 Docker",
      description: "Production image and local compose stack.",
      files: [
        {
          path: "Dockerfile",
          language: "dockerfile",
          content: `FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]`,
        },
        {
          path: "docker-compose.yml",
          language: "yaml",
          content: `services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: dev_only_password
      POSTGRES_DB: app
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      retries: 10

  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgres://app:dev_only_password@db:5432/app
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:`,
        },
      ],
    },
    {
      id: "cicd",
      title: "08 CI/CD",
      description: "GitHub Actions: install, build, test.",
      files: [
        {
          path: ".github/workflows/ci.yml",
          language: "yaml",
          content: `name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm test`,
        },
      ],
    },
    {
      id: "production",
      title: "09 Production checklist",
      description: "Before real traffic:",
      notes: [
        "Add auth (JWT recipe), validation (zod recipe), CORS locked to your frontend origin.",
        "Add rate limiting and structured logging with request IDs.",
        "Use a real migration tool (node-pg-migrate) run as a deploy step.",
        "Set pool size deliberately; add graceful shutdown (close server, then pool).",
        "Never log request bodies that may contain passwords.",
      ],
    },
  ],
  files: [],
};
