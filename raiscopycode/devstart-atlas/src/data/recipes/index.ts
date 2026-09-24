import type { Recipe } from "../../types";

export const recipes: Recipe[] = [
  {
    id: "jwt-authentication",
    title: "JWT Authentication",
    category: "authentication",
    description: "Issue and verify JSON Web Tokens for stateless API authentication — Node/Express and ASP.NET Core variants.",
    technologies: ["express", "aspnet-core"],
    tags: ["jwt", "auth", "security", "token"],
    steps: [
      {
        id: "concept",
        title: "How it works",
        description:
          "On login, the server verifies credentials and signs a token containing claims (user id, roles) with a secret. The client sends the token in the Authorization header; the server verifies the signature on every request — no session storage needed.",
        notes: [
          "Keep access tokens short-lived (5–60 min); use refresh tokens for longer sessions.",
          "JWTs are signed, not encrypted — never put secrets in the payload.",
        ],
      },
      {
        id: "node",
        title: "Node.js / Express",
        description: "Install jsonwebtoken and add login + verification middleware.",
        commands: [
          { shell: "bash", code: "npm install jsonwebtoken\nnpm install -D @types/jsonwebtoken", description: "Install the JWT library", provenance: "official" },
        ],
        files: [
          {
            path: "src/auth/jwt.ts",
            language: "typescript",
            content: `import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const SECRET = process.env.JWT_SECRET!;
if (!SECRET) throw new Error("JWT_SECRET is required");

export function issueToken(userId: string, roles: string[]): string {
  return jwt.sign({ sub: userId, roles }, SECRET, { expiresIn: "15m" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing_token" });
  }
  try {
    const payload = jwt.verify(header.slice(7), SECRET);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
}`,
          },
          {
            path: "src/routes/auth.ts",
            language: "typescript",
            content: `import { Router } from "express";
import { issueToken } from "../auth/jwt";
import { verifyCredentials } from "../services/users";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = await verifyCredentials(email, password);
  if (!user) return res.status(401).json({ error: "invalid_credentials" });
  res.json({ accessToken: issueToken(user.id, user.roles) });
});`,
          },
        ],
        warnings: ["Generate JWT_SECRET with at least 32 random bytes (e.g. `openssl rand -base64 32`). Never commit it."],
      },
      {
        id: "dotnet",
        title: "ASP.NET Core",
        description: "Add the JwtBearer package and configure authentication in Program.cs.",
        commands: [
          { shell: "bash", code: "dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer", description: "Official JWT bearer middleware", provenance: "official" },
        ],
        files: [
          {
            path: "Program.cs (excerpt)",
            language: "csharp",
            content: `builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidateAudience = false,
            ValidateLifetime = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:SigningKey"]!)),
        };
    });
builder.Services.AddAuthorization();

// after builder.Build():
app.UseAuthentication();
app.UseAuthorization();

// protect endpoints with [Authorize] or .RequireAuthorization()`,
          },
        ],
      },
    ],
  },
  {
    id: "docker-node",
    title: "Dockerize a Node.js App",
    category: "docker",
    description: "Multi-stage Dockerfile for a production Node.js/TypeScript service — small image, non-root user.",
    technologies: ["docker", "nodejs"],
    tags: ["docker", "container", "node", "deployment"],
    steps: [
      {
        id: "dockerfile",
        title: "Dockerfile",
        description: "Multi-stage build: compile TypeScript in a builder stage, ship only production deps and dist output.",
        files: [
          {
            path: "Dockerfile",
            language: "dockerfile",
            content: `# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime stage ----
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
            path: ".dockerignore",
            language: "text",
            content: `node_modules
dist
.git
.env
*.md`,
          },
        ],
        commands: [
          { shell: "bash", code: "docker build -t my-api .\ndocker run --rm -p 3000:3000 --env-file .env my-api", description: "Build and run locally" },
        ],
        notes: ["`USER node` runs the container as a non-root user — a cheap, important hardening step."],
      },
    ],
  },
  {
    id: "docker-compose-postgres",
    title: "Docker Compose with PostgreSQL",
    category: "docker",
    description: "Local development stack: your app plus PostgreSQL with a persistent volume and health check.",
    technologies: ["docker", "postgresql"],
    tags: ["docker", "compose", "postgres", "development"],
    steps: [
      {
        id: "compose",
        title: "docker-compose.yml",
        description: "App + Postgres. The app waits for the database to be healthy before starting.",
        files: [
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
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
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
        commands: [
          { shell: "bash", code: "docker compose up -d\ndocker compose logs -f api", description: "Start the stack and follow app logs" },
          { shell: "bash", code: "docker compose down", description: "Stop everything (add -v to also delete the database volume)", warning: "`docker compose down -v` deletes the pgdata volume — all local data is lost." },
        ],
        warnings: ["The password above is for local development only. Production credentials come from a secret manager, never compose files."],
      },
    ],
  },
  {
    id: "github-actions-ci",
    title: "CI with GitHub Actions",
    category: "ci-cd",
    description: "Build-and-test workflow that runs on every push and pull request.",
    technologies: ["github-actions"],
    tags: ["ci", "cd", "github", "pipeline"],
    steps: [
      {
        id: "workflow",
        title: "Workflow file",
        description: "Node example — swap the setup/build steps for your stack (dotnet, go, etc.).",
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
          {
            path: ".github/workflows/ci-dotnet.yml (variant)",
            language: "yaml",
            content: `name: CI (.NET)

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: 8.0.x
      - run: dotnet restore
      - run: dotnet build --no-restore -c Release
      - run: dotnet test --no-build -c Release`,
          },
        ],
      },
    ],
  },
  {
    id: "gitlab-ci",
    title: "CI with GitLab CI/CD",
    category: "ci-cd",
    description: "A .gitlab-ci.yml with build, test and docker stages.",
    technologies: ["gitlab-ci", "docker"],
    tags: ["ci", "cd", "gitlab", "pipeline"],
    steps: [
      {
        id: "pipeline",
        title: ".gitlab-ci.yml",
        description: "Node example with a Docker image build on main.",
        files: [
          {
            path: ".gitlab-ci.yml",
            language: "yaml",
            content: `stages: [test, build]

test:
  stage: test
  image: node:22-alpine
  script:
    - npm ci
    - npm run build
    - npm test
  cache:
    key: { files: [package-lock.json] }
    paths: [node_modules/]

docker-image:
  stage: build
  image: docker:27
  services: [docker:27-dind]
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA
  rules:
    - if: $CI_COMMIT_BRANCH == "main"`,
          },
        ],
      },
    ],
  },
  {
    id: "health-checks",
    title: "Health Checks",
    category: "observability",
    description: "Liveness and readiness endpoints so orchestrators and load balancers know your app's state.",
    technologies: ["aspnet-core", "express"],
    tags: ["health", "kubernetes", "monitoring", "readiness", "liveness"],
    steps: [
      {
        id: "concept",
        title: "Liveness vs readiness",
        description:
          "Liveness answers 'is the process alive?' (restart me if not). Readiness answers 'can I take traffic?' (check dependencies like the database). Keep liveness dependency-free — a dead database should fail readiness, not liveness, or you'll restart healthy pods in a loop.",
      },
      {
        id: "express",
        title: "Express",
        description: "Two endpoints; readiness pings the database.",
        files: [
          {
            path: "src/routes/health.ts",
            language: "typescript",
            content: `import { Router } from "express";
import { pool } from "../db/pool";

export const healthRouter = Router();

healthRouter.get("/healthz", (_req, res) => res.json({ status: "ok" }));

healthRouter.get("/readyz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not_ready", reason: "database" });
  }
});`,
          },
        ],
      },
      {
        id: "dotnet",
        title: "ASP.NET Core",
        description: "Built-in health checks with an EF Core database probe.",
        commands: [{ shell: "bash", code: "dotnet add package AspNetCore.HealthChecks.NpgSql", description: "Community Postgres health check (or use AddDbContextCheck)", provenance: "recommended" }],
        files: [
          {
            path: "Program.cs (excerpt)",
            language: "csharp",
            content: `builder.Services.AddHealthChecks()
    .AddNpgSql(builder.Configuration.GetConnectionString("Default")!, tags: ["ready"]);

app.MapHealthChecks("/healthz", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/readyz", new HealthCheckOptions { Predicate = c => c.Tags.Contains("ready") });`,
          },
        ],
      },
    ],
  },
  {
    id: "rate-limiting",
    title: "Rate Limiting",
    category: "security",
    description: "Protect APIs from abuse and accidental overload with request rate limits.",
    technologies: ["express", "aspnet-core"],
    tags: ["rate-limit", "security", "throttle"],
    steps: [
      {
        id: "express",
        title: "Express",
        commands: [{ shell: "bash", code: "npm install express-rate-limit", provenance: "recommended", description: "Standard Express rate limiter" }],
        description: "Apply a global limit plus a stricter one on auth endpoints.",
        files: [
          {
            path: "src/middleware/rateLimit.ts",
            language: "typescript",
            content: `import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 100,                 // 100 requests/min per IP
  standardHeaders: "draft-7", // RateLimit-* headers
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,                  // brute-force protection
  message: { error: "too_many_attempts" },
});

// app.use("/api", apiLimiter);
// app.use("/api/auth/login", loginLimiter);`,
          },
        ],
        notes: ["Behind a proxy/load balancer set `app.set('trust proxy', 1)` so limits key on the real client IP."],
      },
      {
        id: "dotnet",
        title: "ASP.NET Core",
        description: ".NET 8 has rate limiting built in.",
        files: [
          {
            path: "Program.cs (excerpt)",
            language: "csharp",
            content: `builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddFixedWindowLimiter("api", w =>
    {
        w.Window = TimeSpan.FromMinutes(1);
        w.PermitLimit = 100;
    });
});

app.UseRateLimiter();
// app.MapControllers().RequireRateLimiting("api");`,
          },
        ],
      },
    ],
  },
  {
    id: "pagination",
    title: "API Pagination",
    category: "database",
    description: "Offset and cursor pagination — SQL, API shape, and when to use which.",
    technologies: ["postgresql"],
    tags: ["pagination", "api", "sql", "cursor"],
    steps: [
      {
        id: "offset",
        title: "Offset pagination (simple)",
        description: "Easy to implement and lets users jump to page N. Gets slow on deep pages and can skip/duplicate rows when data changes between requests.",
        files: [
          {
            path: "query.sql",
            language: "sql",
            content: `SELECT id, email, created_at
FROM users
ORDER BY created_at DESC, id DESC
LIMIT 20 OFFSET 40;   -- page 3, 20 per page`,
          },
          {
            path: "response.json",
            language: "json",
            content: `{
  "data": [ /* ... */ ],
  "page": 3,
  "pageSize": 20,
  "totalCount": 481,
  "totalPages": 25
}`,
          },
        ],
      },
      {
        id: "cursor",
        title: "Cursor pagination (scalable)",
        description: "Stable under writes and fast at any depth. The cursor encodes the last row's sort key; clients can only walk forward/backward.",
        files: [
          {
            path: "query.sql",
            language: "sql",
            content: `-- cursor = (created_at, id) of the last row from the previous page
SELECT id, email, created_at
FROM users
WHERE (created_at, id) < ($1, $2)
ORDER BY created_at DESC, id DESC
LIMIT 20;`,
          },
          {
            path: "response.json",
            language: "json",
            content: `{
  "data": [ /* ... */ ],
  "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTAyIiwiaWQiOiI0MiJ9"
}`,
          },
        ],
        notes: ["Always include a unique tiebreaker column (id) in the sort — timestamps collide."],
      },
    ],
  },
  {
    id: "structured-logging",
    title: "Structured Logging",
    category: "observability",
    description: "Log JSON events with context instead of printf strings — Node (pino) and .NET (Serilog).",
    technologies: ["nodejs", "dotnet"],
    tags: ["logging", "observability", "serilog", "pino"],
    steps: [
      {
        id: "node",
        title: "Node.js with pino",
        commands: [{ shell: "bash", code: "npm install pino pino-http", provenance: "recommended", description: "Fast structured logger + request logging middleware" }],
        description: "One logger instance, request-scoped child loggers with a request id.",
        files: [
          {
            path: "src/logger.ts",
            language: "typescript",
            content: `import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
});

// usage:
// logger.info({ userId, orderId }, "order created");
// logger.error({ err }, "payment failed");`,
          },
        ],
      },
      {
        id: "dotnet",
        title: ".NET with Serilog",
        commands: [{ shell: "bash", code: "dotnet add package Serilog.AspNetCore", provenance: "recommended", description: "Serilog with ASP.NET Core integration" }],
        files: [
          {
            path: "Program.cs (excerpt)",
            language: "csharp",
            content: `builder.Host.UseSerilog((ctx, cfg) => cfg
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console(new Serilog.Formatting.Compact.CompactJsonFormatter()));

app.UseSerilogRequestLogging();

// usage: _logger.LogInformation("Order {OrderId} created for {UserId}", order.Id, userId);`,
          },
        ],
        warnings: ["Never log passwords, tokens, or full card numbers. Message templates ({OrderId}) — not string interpolation — keep logs queryable."],
      },
    ],
  },
  {
    id: "react-protected-routes",
    title: "React Protected Routes",
    category: "frontend",
    description: "Gate routes behind authentication with React Router — redirect to login and back.",
    technologies: ["react"],
    tags: ["react", "auth", "router", "frontend"],
    steps: [
      {
        id: "guard",
        title: "Auth context + route guard",
        description: "A context holds the session; a wrapper component redirects unauthenticated users to /login, remembering where they came from.",
        files: [
          {
            path: "src/auth/AuthContext.tsx",
            language: "tsx",
            content: `import { createContext, useContext, useState, type ReactNode } from "react";

type Auth = { token: string | null; login: (t: string) => void; logout: () => void };
const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const login = (t: string) => { localStorage.setItem("token", t); setToken(t); };
  const logout = () => { localStorage.removeItem("token"); setToken(null); };
  return <AuthContext.Provider value={{ token, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}`,
          },
          {
            path: "src/auth/RequireAuth.tsx",
            language: "tsx",
            content: `import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

// <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />`,
          },
        ],
        notes: ["Route guards are UX, not security — the API must still verify the token on every request."],
      },
    ],
  },
  {
    id: "api-client-fetch",
    title: "Typed API Client (fetch)",
    category: "frontend",
    description: "A small typed fetch wrapper with base URL, JSON handling, auth header and error normalization.",
    technologies: ["typescript", "react"],
    tags: ["fetch", "api", "client", "frontend"],
    steps: [
      {
        id: "client",
        title: "The client",
        description: "One place for base URL, headers and error handling; every call site stays one line.",
        files: [
          {
            path: "src/lib/api.ts",
            language: "typescript",
            content: `const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(\`API error \${status}\`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(BASE_URL + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};`,
          },
        ],
      },
    ],
  },
  {
    id: "file-upload",
    title: "File Upload",
    category: "api",
    description: "Multipart uploads with validation — Express (multer) server side, plus the browser side.",
    technologies: ["express", "react"],
    tags: ["upload", "multipart", "files"],
    steps: [
      {
        id: "server",
        title: "Express with multer",
        commands: [{ shell: "bash", code: "npm install multer\nnpm install -D @types/multer", provenance: "recommended", description: "Standard Express multipart middleware" }],
        files: [
          {
            path: "src/routes/upload.ts",
            language: "typescript",
            content: `import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";

const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (_req, file, cb) =>
      cb(null, crypto.randomUUID() + path.extname(file.originalname)),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) =>
    cb(null, ["image/png", "image/jpeg", "application/pdf"].includes(file.mimetype)),
});

export const uploadRouter = Router();

uploadRouter.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no_valid_file" });
  res.status(201).json({ filename: req.file.filename, size: req.file.size });
});`,
          },
        ],
        warnings: ["Never trust the client's filename or MIME type for security decisions; store under a server-generated name and validate content where it matters."],
      },
      {
        id: "browser",
        title: "Browser side",
        files: [
          {
            path: "upload.ts",
            language: "typescript",
            content: `async function uploadFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error("upload failed");
  return res.json();
}`,
          },
        ],
      },
    ],
  },
  {
    id: "input-validation",
    title: "Input Validation",
    category: "security",
    description: "Validate every request body at the boundary — zod for Node/TypeScript, DataAnnotations/FluentValidation for .NET.",
    technologies: ["express", "aspnet-core"],
    tags: ["validation", "zod", "security"],
    steps: [
      {
        id: "zod",
        title: "TypeScript with zod",
        commands: [{ shell: "bash", code: "npm install zod", provenance: "recommended", description: "Schema validation with inferred types" }],
        files: [
          {
            path: "src/schemas/user.ts",
            language: "typescript",
            content: `import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(12),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

// In the route:
// const parsed = createUserSchema.safeParse(req.body);
// if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });`,
          },
        ],
      },
      {
        id: "dotnet",
        title: "ASP.NET Core",
        description: "DataAnnotations are built in; FluentValidation for complex rules.",
        files: [
          {
            path: "CreateUserDto.cs",
            language: "csharp",
            content: `public record CreateUserDto(
    [property: Required, EmailAddress] string Email,
    [property: Required, StringLength(100, MinimumLength = 1)] string Name,
    [property: Required, MinLength(12)] string Password);

// [ApiController] returns 400 with problem details automatically when validation fails.`,
          },
        ],
      },
    ],
  },
  {
    id: "db-migrations",
    title: "Database Migrations",
    category: "database",
    description: "Version your schema: EF Core, node-pg-migrate and Flyway approaches.",
    technologies: ["ef-core", "postgresql"],
    tags: ["migrations", "schema", "database"],
    steps: [
      {
        id: "efcore",
        title: "EF Core",
        commands: [
          { shell: "bash", code: "dotnet tool install --global dotnet-ef", description: "Install the EF CLI once per machine", provenance: "official" },
          { shell: "bash", code: 'dotnet ef migrations add InitialCreate\ndotnet ef database update', description: "Create a migration from model changes and apply it", provenance: "official" },
        ],
        notes: ["In Clean Architecture solutions add `--project src/Infrastructure --startup-project src/Api` to both commands."],
      },
      {
        id: "node",
        title: "Node with node-pg-migrate",
        commands: [
          { shell: "bash", code: "npm install node-pg-migrate pg", provenance: "recommended", description: "Migration tool + driver" },
          { shell: "bash", code: 'npx node-pg-migrate create add-users-table\nDATABASE_URL=postgres://app:pass@localhost:5432/app npx node-pg-migrate up', description: "Create and run migrations" },
        ],
        files: [
          {
            path: "migrations/1700000000000_add-users-table.js",
            language: "javascript",
            content: `exports.up = (pgm) => {
  pgm.createTable("users", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    email: { type: "text", notNull: true, unique: true },
    name: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("users");
};`,
          },
        ],
      },
    ],
  },
  {
    id: "cors",
    title: "CORS Configuration",
    category: "security",
    description: "Allow your frontend origin — and only your frontend origin — to call the API.",
    technologies: ["express", "aspnet-core"],
    tags: ["cors", "security", "http"],
    steps: [
      {
        id: "express",
        title: "Express",
        commands: [{ shell: "bash", code: "npm install cors\nnpm install -D @types/cors", provenance: "recommended" }],
        files: [
          {
            path: "src/app.ts (excerpt)",
            language: "typescript",
            content: `import cors from "cors";

const allowed = (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",");

app.use(cors({
  origin: allowed,
  credentials: true,
}));`,
          },
        ],
        warnings: ["`origin: '*'` together with credentials is both insecure and rejected by browsers. List explicit origins."],
      },
      {
        id: "dotnet",
        title: "ASP.NET Core",
        files: [
          {
            path: "Program.cs (excerpt)",
            language: "csharp",
            content: `builder.Services.AddCors(o => o.AddPolicy("frontend", p => p
    .WithOrigins(builder.Configuration["Cors:Origins"]?.Split(',') ?? ["http://localhost:5173"])
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials()));

app.UseCors("frontend");`,
          },
        ],
      },
    ],
  },
];

export const recipeById = new Map(recipes.map((r) => [r.id, r]));
