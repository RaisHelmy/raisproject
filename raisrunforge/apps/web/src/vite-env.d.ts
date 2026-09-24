/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin (no trailing slash). Unset in dev → relative `/api` via the Vite proxy. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
