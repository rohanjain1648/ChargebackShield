import { createClient } from "@base44/sdk";

// After Google OAuth, Base44 redirects back to our from_url with
// ?access_token=… appended. The SDK's getAccessToken() (run during
// createClient below) only reads window.location.search, but because this app
// uses HashRouter the token can instead land inside the hash
// (e.g. /#/app?access_token=…). Hoist any hash-embedded token into the real
// search string first so the SDK picks it up on load either way.
function hoistHashToken() {
  if (typeof window === "undefined") return;
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return;

  const hashQuery = new URLSearchParams(hash.slice(qIndex + 1));
  const token = hashQuery.get("access_token");
  if (!token) return;

  const search = new URLSearchParams(window.location.search);
  search.set("access_token", token);
  hashQuery.delete("access_token");

  const remainingHash = hashQuery.toString()
    ? `${hash.slice(0, qIndex)}?${hashQuery.toString()}`
    : hash.slice(0, qIndex);
  const newUrl = `${window.location.pathname}?${search.toString()}${remainingHash}`;
  window.history.replaceState({}, document.title, newUrl);
}

hoistHashToken();

// Set VITE_BASE44_APP_ID in a .env.local file (or via `base44 link`'s output)
// after running `base44 create` / `base44 link` against your workspace.
// appBaseUrl must point at the deployed app's own domain (not localhost) —
// it's where auth.loginWithProvider()/logout() send the browser for Base44's
// backend auth routes, which redirect back here with the token afterward.
export const base44 = createClient({
  appId: import.meta.env.VITE_BASE44_APP_ID as string,
  appBaseUrl: import.meta.env.VITE_BASE44_APP_BASE_URL as string,
});
