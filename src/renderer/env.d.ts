/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 

declare global {
  interface Window {
    appVersion?: { get: () => Promise<string> };
    logger?: {
      log: (event: {
        action: string;
        actor?: string;
        entity?: string;
        entityId?: string;
        details?: any;
      }) => Promise<unknown>;
    };
  }
}

export {};
export {};