import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

/**
 * Replaces GlassCard. Flat paper surface, hairline ink border, no blur/shadow
 * stack. `interactive` adds a hover state for clickable cards (e.g. a post
 * in a grid) without reintroducing glassmorphism.
 */
export function Card({ className, interactive = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-paper border border-ink/10 rounded-md",
        interactive && "transition-colors hover:border-ink/25 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// Temporary alias so existing imports (`GlassCard`) don't break mid-migration.
// Remove once every usage has been updated to `Card`.
export const GlassCard = Card;
