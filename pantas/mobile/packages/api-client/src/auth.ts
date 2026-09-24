import { api } from "./client";
import { clearStoredSessionId, setStoredSessionId } from "./tokenStore";
import type { AuthResult, Role } from "./types";

export async function login(phone: string, password: string, role?: Role): Promise<AuthResult> {
  const result = await api.post<AuthResult>("/auth/login", { phone, password, role });
  await setStoredSessionId(result.sessionId);
  return result;
}

export interface RegisterInput {
  realName: string;
  phone: string;
  password: string;
  role: "purchaser" | "runner" | "vendor";
  anonymousMode?: boolean;
  consentVersion?: string;
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const result = await api.post<AuthResult>("/auth/register", input);
  await setStoredSessionId(result.sessionId);
  return result;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
  await clearStoredSessionId();
}
