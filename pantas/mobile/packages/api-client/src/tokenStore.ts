import * as SecureStore from "expo-secure-store";

const KEY = "pantas_session_id";

/**
 * Session id storage — SecureStore (Keychain/Keystore-backed), never
 * AsyncStorage, since this is equivalent to a session cookie (CLAUDE.md
 * "Mobile auth").
 */
export async function getStoredSessionId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function setStoredSessionId(sessionId: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, sessionId);
}

export async function clearStoredSessionId(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
