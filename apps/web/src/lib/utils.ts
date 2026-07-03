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

export function formatRoomType(type?: string | null) {
  switch (type) {
    case "single":
      return "Single"
    case "1bhk":
      return "1BHK"
    case "1bk":
      return "1BK"
    case "double":
      return "2BHK"
    case "flat":
      return "3BHK"
    case "studio":
      return "Studio"
    case "shared":
      return "Shared"
    default:
      if (!type) return ""
      return String(type).replace(/^./, (char) => char.toUpperCase())
  }
}

export function getMediaUrl(url?: string | null) {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  if (trimmed.startsWith("/")) {
    return `${base}${trimmed}`;
  }

  return `${base}/${trimmed}`;
}
