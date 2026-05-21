import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getMediaUrl(url?: string | null) {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const apiBase = (import.meta.env.VITE_API_URL ?? import.meta.env.BASE_URL).replace(/\/$/, "");

  if (trimmed.startsWith("/api/storage/objects/")) {
    return `${apiBase}${trimmed}`;
  }

  if (trimmed.startsWith("/storage/objects/")) {
    return `${apiBase}/api${trimmed}`;
  }

  if (trimmed.startsWith("/objects/")) {
    return `${apiBase}/api/storage${trimmed}`;
  }

  if (trimmed.startsWith("storage/objects/")) {
    return `${apiBase}/api/${trimmed}`;
  }

  if (trimmed.startsWith("objects/")) {
    return `${apiBase}/api/storage/${trimmed}`;
  }

  if (trimmed.startsWith("/")) {
    return `${base}${trimmed}`;
  }

  return `${base}/${trimmed}`;
}
