import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function GlassCard({
  className,
  interactive = false,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-card",
        interactive && "glass-card-interactive",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
