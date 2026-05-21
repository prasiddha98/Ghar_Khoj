import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

// Set base URL for API requests
// The generated API URLs already include "/api", so set base to just the server
export const API_BASE = import.meta.env.VITE_API_URL;

if (!API_BASE) {
  throw new Error("VITE_API_URL must be configured for the frontend.");
}

setBaseUrl(API_BASE);

// Attach JWT to every protected API request
console.log("[main.tsx] Setting up auth token getter...");
setAuthTokenGetter(() => {
  try {
    if (typeof window === "undefined") {
      console.log("[setAuthTokenGetter] Not in browser, returning null");
      return null;
    }
    const token = localStorage.getItem("ghar_khoj_jwt");
    if (token) {
      console.log("[setAuthTokenGetter] ✓ Token found in localStorage:", token.substring(0, 30) + "...");
    } else {
      console.warn("[setAuthTokenGetter] ⚠️  No token in localStorage");
    }
    return token;
  } catch (err) {
    console.error("[setAuthTokenGetter] Error:", err);
    return null;
  }
});
console.log("[main.tsx] Auth token getter configured");

createRoot(document.getElementById("root")!).render(<App />);

