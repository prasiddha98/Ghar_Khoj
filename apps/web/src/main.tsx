import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

// Attach JWT to every protected API request
setAuthTokenGetter(() => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ghar_khoj_jwt");
});

createRoot(document.getElementById("root")!).render(<App />);

