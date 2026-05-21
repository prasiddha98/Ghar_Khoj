const API_BASE = import.meta.env.VITE_API_URL;

if (!API_BASE) {
  throw new Error("VITE_API_URL must be set in the frontend environment.");
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function getApiUrl(path: string) {
  return `${API_BASE}${normalizePath(path)}`;
}

export async function customFetch<T = unknown>(path: string, options?: RequestInit) {
  const url = getApiUrl(path);

  const headers = new Headers(options?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  // 🔥 SAFE READ (IMPORTANT FIX)
  const text = await res.text();

  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("❌ Invalid JSON response:", text);
      throw new Error("Backend returned invalid JSON");
    }
  }

  if (!res.ok) {
    throw new Error(
      data?.message ||
      `Request failed: ${res.status} ${res.statusText}`
    );
  }

  return data as T;
}

export async function customFetchRaw(path: string, options?: RequestInit) {
  const url = getApiUrl(path);

  const headers = new Headers(options?.headers ?? {});
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...options,
    headers,
  });
}