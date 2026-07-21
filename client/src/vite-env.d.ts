/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full origin of the API in production, e.g. https://sales-mechanic-api.onrender.com */
  readonly VITE_API_URL?: string;
  /** Clerk publishable key. When set, real sign-in is required; when absent, dev mode. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
