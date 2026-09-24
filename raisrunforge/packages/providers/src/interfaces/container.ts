import type { Container, ProviderKind } from "@runforge/shared";

export interface ContainerProvider {
  readonly kind: ProviderKind;
  listContainers(organizationId: string, serverId?: string): Promise<Container[]>;
  getContainer(organizationId: string, id: string): Promise<Container | null>;
  startContainer(organizationId: string, id: string): Promise<Container>;
  stopContainer(organizationId: string, id: string): Promise<Container>;
  restartContainer(organizationId: string, id: string): Promise<Container>;
  pauseContainer(organizationId: string, id: string): Promise<Container>;
  removeContainer(organizationId: string, id: string): Promise<void>;
}
