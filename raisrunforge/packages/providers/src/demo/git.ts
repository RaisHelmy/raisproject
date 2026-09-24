import type { Branch, GitConnection, Repository } from "@runforge/shared";
import type { GitProvider } from "../interfaces";
import type { DemoWorld } from "./world";
import { seededRandom, shortSha } from "../util/random";

const DEMO_REPOS: Repository[] = [
  { id: "1", fullName: "merc999/merc-api", defaultBranch: "main", private: true, url: "https://github.com/merc999/merc-api" },
  { id: "2", fullName: "merc999/merc-worker", defaultBranch: "main", private: true, url: "https://github.com/merc999/merc-worker" },
  { id: "3", fullName: "merc999/merc-web", defaultBranch: "main", private: true, url: "https://github.com/merc999/merc-web" },
  { id: "4", fullName: "merc999/www", defaultBranch: "main", private: false, url: "https://github.com/merc999/www" },
  { id: "5", fullName: "merc999/ops-dashboard", defaultBranch: "main", private: true, url: "https://gitlab.com/merc999/ops-dashboard" },
  { id: "6", fullName: "merc999/infra", defaultBranch: "main", private: true, url: "https://github.com/merc999/infra" },
];

export class DemoGitProvider implements GitProvider {
  readonly kind = "github" as const;
  constructor(private readonly world: DemoWorld) {}

  async listConnections(organizationId: string): Promise<GitConnection[]> {
    return this.world.gitConnections.filter((g) => g.organizationId === organizationId);
  }

  async listRepositories(): Promise<Repository[]> {
    return DEMO_REPOS;
  }

  async listBranches(_organizationId: string, repository: string): Promise<Branch[]> {
    const rand = seededRandom(`branches:${repository}`);
    return ["main", "develop", "release/1.9", "feature/caching"].map((name) => ({ name, commitSha: shortSha(rand) }));
  }

  async getLatestCommit(_organizationId: string, repository: string, branch: string) {
    const rand = seededRandom(`commit:${repository}:${branch}:${Math.floor(this.world.now() / 60_000)}`);
    const messages = [
      "Improve error handling in order pipeline",
      "Bump dependencies",
      "Add index on orders(customer_id)",
      "Refactor auth middleware",
      "Fix flaky integration test",
    ];
    return {
      sha: shortSha(rand),
      message: messages[Math.floor(rand() * messages.length)],
      author: "Aisyah Rahman",
      date: new Date(this.world.now() - Math.floor(rand() * 3_600_000)).toISOString(),
    };
  }
}
