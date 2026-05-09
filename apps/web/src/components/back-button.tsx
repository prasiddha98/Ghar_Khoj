import type { ButtonHTMLAttributes, MouseEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  fallback?: string;
  label?: string;
}

export function BackButton({
  fallback = "/",
  label = "Back",
  className,
  ...props
}: BackButtonProps) {
  const handleBack = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = fallback;
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={cn(
        "flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors",
        className
      )}
      {...props}
    >
      <ArrowLeft size={16} /> {label}
    </button>
  );
}
