import type { Template } from "../../types";

export const reactTypescriptApp: Template = {
  id: "react-typescript-app",
  title: "React + TypeScript App",
  description:
    "Vite-powered React 18 + TypeScript SPA with feature-based structure, React Router, a typed API client and Vitest — the sane frontend starting point.",
  technologies: ["typescript", "react", "vite"],
  projectTypes: ["Web Application", "SPA"],
  architectures: ["feature-based"],
  difficulty: "beginner",
  productionReady: true,
  prerequisites: ["Node.js 20+ (or Bun)"],
  estimatedSetupMinutes: 5,
  versions: [
    { name: "React", version: "18.x" },
    { name: "Vite", version: "5.x" },
  ],
  lastReviewed: "2026-09",
  tags: ["react", "typescript", "vite", "spa", "frontend", "router"],
  patterns: [],
  recipes: ["react-protected-routes", "api-client-fetch"],
  relatedTemplates: ["node-express-postgres-api", "expo-mobile-app"],
  zeroToRunning: ["01 Create project", "02 Add router & structure", "03 Add the code", "04 Run"],
  completeness: [
    { label: "Project creation", done: true },
    { label: "Dependencies", done: true },
    { label: "Folder structure", done: true },
    { label: "Routing", done: true },
    { label: "API client", done: true },
    { label: "Testing", done: true },
    { label: "CI/CD", done: true },
    { label: "Authentication", done: false },
    { label: "State management", done: false },
  ],
  nextSteps: [
    { label: "Add protected routes / auth", recipeId: "react-protected-routes" },
    { label: "Wire the typed API client", recipeId: "api-client-fetch" },
  ],
  steps: [
    {
      id: "create",
      title: "01 Create project",
      description: "Official Vite scaffold with the react-ts template.",
      commands: [
        { shell: "bash", provenance: "official", code: "npm create vite@latest my-app -- --template react-ts\ncd my-app\nnpm install", description: "npm" },
        { shell: "bash", provenance: "official", code: "bun create vite my-app --template react-ts\ncd my-app\nbun install", description: "or with Bun" },
      ],
    },
    {
      id: "structure",
      title: "02 Add router & structure",
      description: "React Router plus a feature-based layout: features own their components/hooks/api; shared UI lives in components/.",
      commands: [
        { shell: "bash", provenance: "official", code: "npm install react-router-dom", description: "Router" },
        { shell: "bash", code: "mkdir -p src/features/home src/features/users src/components src/lib src/routes", description: "Feature-based folders (Linux/macOS)" },
        { shell: "powershell", code: "New-Item -ItemType Directory -Force src/features/home, src/features/users, src/components, src/lib, src/routes", description: "PowerShell" },
      ],
      notes: [
        `src/
├── features/
│   ├── home/
│   └── users/        # components, hooks, api per feature
├── components/       # shared UI
├── lib/              # api client, utils
├── routes/           # route definitions
├── App.tsx
└── main.tsx`,
      ],
    },
    {
      id: "code",
      title: "03 Add the code",
      description: "Routing shell, a typed API client, and a users feature that fetches and renders data.",
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

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(BASE_URL + path);
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
  return res.json();
}`,
        },
        {
          path: "src/features/users/api.ts",
          language: "typescript",
          content: `import { apiGet } from "../../lib/api";

export type User = { id: string; email: string; name: string };

export const fetchUsers = () => apiGet<User[]>("/users");`,
        },
        {
          path: "src/features/users/UsersPage.tsx",
          language: "tsx",
          content: `import { useEffect, useState } from "react";
import { fetchUsers, type User } from "./api";

export function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => setError("Couldn't load users."));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!users) return <p>Loading…</p>;
  if (users.length === 0) return <p>No users yet.</p>;

  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>{u.name} — {u.email}</li>
      ))}
    </ul>
  );
}`,
        },
        {
          path: "src/App.tsx",
          language: "tsx",
          content: `import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { UsersPage } from "./features/users/UsersPage";

export default function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">Home</Link> | <Link to="/users">Users</Link>
      </nav>
      <Routes>
        <Route path="/" element={<h1>Home</h1>} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<h1>Not found</h1>} />
      </Routes>
    </BrowserRouter>
  );
}`,
        },
        {
          path: ".env.example",
          language: "text",
          description: "⚠ Vite exposes only VITE_-prefixed vars to the client — never put secrets in frontend env vars; they ship to every browser.",
          content: `VITE_API_URL=http://localhost:3000/api`,
        },
      ],
    },
    {
      id: "run",
      title: "04 Run",
      description: "Dev server with hot module replacement.",
      commands: [
        { shell: "bash", code: "npm run dev", description: "http://localhost:5173" },
        { shell: "bash", code: "npm run build && npm run preview", description: "Production build + local preview" },
      ],
    },
    {
      id: "testing",
      title: "05 Testing",
      description: "Vitest + Testing Library for component tests.",
      commands: [
        { shell: "bash", provenance: "recommended", code: "npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom", description: "Test stack" },
      ],
      files: [
        {
          path: "src/features/users/UsersPage.test.tsx",
          language: "tsx",
          content: `// vitest.config: test: { environment: "jsdom" }
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  fetchUsers: vi.fn(async () => [{ id: "1", email: "ada@example.com", name: "Ada" }]),
}));

import { UsersPage } from "./UsersPage";

describe("UsersPage", () => {
  it("renders fetched users", async () => {
    render(<UsersPage />);
    expect(await screen.findByText(/ada@example.com/)).toBeInTheDocument();
  });
});`,
        },
      ],
    },
    {
      id: "cicd",
      title: "06 CI/CD",
      description: "Build and test on every push.",
      files: [
        {
          path: ".github/workflows/ci.yml",
          language: "yaml",
          content: `name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npx vitest run`,
        },
      ],
    },
  ],
  files: [],
};
