import type { Template } from "../../types";

export const expoMobileApp: Template = {
  id: "expo-mobile-app",
  title: "Expo Mobile App (React Native)",
  description:
    "Cross-platform iOS/Android app with Expo and TypeScript: file-based routing with Expo Router, a typed API client, secure token storage and auth-guarded navigation.",
  technologies: ["typescript", "react-native", "expo", "react"],
  projectTypes: ["Mobile App"],
  architectures: ["feature-based"],
  difficulty: "beginner",
  productionReady: false,
  prerequisites: ["Node.js 20+", "Expo Go app on your phone (or an emulator)"],
  estimatedSetupMinutes: 10,
  versions: [{ name: "Expo SDK", version: "51+" }],
  lastReviewed: "2026-09",
  tags: ["expo", "react native", "mobile", "ios", "android", "typescript"],
  patterns: [],
  recipes: ["api-client-fetch", "jwt-authentication"],
  relatedTemplates: ["react-typescript-app", "node-express-postgres-api"],
  zeroToRunning: ["01 Create project", "02 Run on device", "03 Add the code"],
  completeness: [
    { label: "Project creation", done: true },
    { label: "Dependencies", done: true },
    { label: "Navigation", done: true },
    { label: "API client", done: true },
    { label: "Auth & secure storage", done: true },
    { label: "Environment config", done: true },
    { label: "Testing", done: false },
    { label: "Push notifications", done: false },
    { label: "Store builds (EAS)", done: false },
  ],
  nextSteps: [
    { label: "Point the API client at your backend", recipeId: "api-client-fetch" },
    { label: "Build the backend JWT login it talks to", recipeId: "jwt-authentication" },
  ],
  steps: [
    {
      id: "create",
      title: "01 Create project",
      description: "Official Expo scaffold — TypeScript and Expo Router come configured out of the box.",
      commands: [
        { shell: "bash", provenance: "official", code: "npx create-expo-app@latest my-app\ncd my-app", description: "Create the app" },
      ],
    },
    {
      id: "run",
      title: "02 Run on device",
      description: "Start the dev server, scan the QR code with Expo Go — the app runs on your phone in seconds.",
      commands: [
        { shell: "bash", provenance: "official", code: "npx expo start", description: "Start (press a for Android emulator, i for iOS simulator)" },
      ],
    },
    {
      id: "code",
      title: "03 Add the code",
      description:
        "API client, secure token storage, an auth context, and Expo Router screens with a login gate.",
      commands: [
        { shell: "bash", provenance: "official", code: "npx expo install expo-secure-store", description: "Secure (keychain/keystore) storage for tokens" },
      ],
      files: [
        {
          path: "lib/api.ts",
          language: "typescript",
          content: `import * as SecureStore from "expo-secure-store";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await SecureStore.getItemAsync("token");
  const res = await fetch(BASE_URL + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw new Error(\`API \${res.status}\`);
  return res.json();
}`,
        },
        {
          path: "lib/auth.tsx",
          language: "tsx",
          content: `import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Auth = {
  token: string | null;
  loading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync("token").then((t) => {
      setToken(t);
      setLoading(false);
    });
  }, []);

  const signIn = async (t: string) => {
    await SecureStore.setItemAsync("token", t);
    setToken(t);
  };
  const signOut = async () => {
    await SecureStore.deleteItemAsync("token");
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}`,
        },
        {
          path: "app/_layout.tsx",
          language: "tsx",
          description: "Root layout: wraps the app in the auth provider and gates the (app) group behind login.",
          content: `import { Redirect, Slot, usePathname } from "expo-router";
import { AuthProvider, useAuth } from "../lib/auth";

function Gate() {
  const { token, loading } = useAuth();
  const pathname = usePathname();

  if (loading) return null;
  if (!token && pathname !== "/login") return <Redirect href="/login" />;
  if (token && pathname === "/login") return <Redirect href="/" />;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}`,
        },
        {
          path: "app/login.tsx",
          language: "tsx",
          content: `import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      const { accessToken } = await api<{ accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await signIn(accessToken);
    } catch {
      setError("Login failed. Check your credentials.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry
        value={password} onChangeText={setPassword} />
      <Button title="Sign in" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "600", marginBottom: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "#c00" },
});`,
        },
        {
          path: "app/index.tsx",
          language: "tsx",
          content: `import { Button, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../lib/auth";

export default function Home() {
  const { signOut } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>You're in 🎉</Text>
      <Button title="Sign out" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  title: { fontSize: 24, fontWeight: "600" },
});`,
        },
        {
          path: ".env.example",
          language: "text",
          description: "⚠ EXPO_PUBLIC_ vars are bundled into the app — no secrets here. On a physical device, localhost is the phone, not your machine: use your computer's LAN IP.",
          content: `EXPO_PUBLIC_API_URL=http://192.168.1.50:3000/api`,
        },
      ],
    },
    {
      id: "build",
      title: "04 Builds & next steps",
      description: "Ship to devices and stores with EAS.",
      commands: [
        { shell: "bash", provenance: "official", code: "npm install -g eas-cli\neas build --platform all", description: "Cloud builds for iOS/Android (requires an Expo account)" },
      ],
      notes: [
        "Add offline storage with @react-native-async-storage/async-storage for non-sensitive data.",
        "Push notifications: expo-notifications + EAS credentials setup.",
      ],
    },
  ],
  files: [],
};
