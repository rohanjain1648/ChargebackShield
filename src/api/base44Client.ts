import { createClient } from "@base44/sdk";

// Set VITE_BASE44_APP_ID in a .env.local file (or via `base44 link`'s output)
// after running `base44 create` / `base44 link` against your workspace.
export const base44 = createClient({
  appId: import.meta.env.VITE_BASE44_APP_ID as string,
});
