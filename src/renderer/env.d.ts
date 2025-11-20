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
    electronAPI?: {
      readMigrationFile: (migrationName: string) => Promise<any>;
      print: (options?: {
        pageSize?: string | { width: number; height: number };
        printBackground?: boolean;
        color?: boolean;
        margins?: {
          marginType?: string;
        };
        landscape?: boolean;
      }) => Promise<{ success: boolean; error?: string }>;
      printToPDF: (options?: {
        pageSize?: string;
        printBackground?: boolean;
        landscape?: boolean;
        margins?: {
          top?: number;
          bottom?: number;
          left?: number;
          right?: number;
        };
      }) => Promise<{ success: boolean; pdfPath?: string; error?: string }>;
    };
  }
}

export {};
export {};