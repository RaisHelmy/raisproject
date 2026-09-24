import type { Branch, GitConnection, Repository } from "@runforge/shared";

export interface GitProvider {
  readonly kind: GitConnection["provider"];
  listConnections(organizationId: string): Promise<GitConnection[]>;
  listRepositories(organizationId: string, connectionId?: string): Promise<Repository[]>;
  listBranches(organizationId: string, repository: string): Promise<Branch[]>;
  getLatestCommit(
    organizationId: string,
    repository: string,
    branch: string,
  ): Promise<{ sha: string; message: string; author: string; date: string }>;
}
