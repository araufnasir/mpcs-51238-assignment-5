// Minimal shape of the Clerk browser global used by the tests.
declare global {
  interface Window {
    Clerk?: {
      session?: { getToken(): Promise<string | null> } | null;
      user?: { id: string } | null;
    };
  }
}

export {};
