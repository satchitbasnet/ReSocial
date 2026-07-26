import Link from "next/link";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  href?: string;
}

const variants = {
  // Default action — ink, like a shutter button. Not the loud choice.
  primary: "bg-ink text-paper hover:bg-charcoal",
  // Reserved for the ONE emphasized action per screen (Publish, Upgrade, Start).
  accent: "bg-tally text-paper hover:bg-tally/90",
  secondary: "bg-paper text-ink border border-ink/15 hover:bg-ink/[0.04]",
  outline: "border-2 border-ink text-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink/60 hover:text-ink hover:bg-ink/[0.06]",
  danger: "bg-paper text-tally border border-tally/40 hover:bg-tally hover:text-paper",
};

const sizes = {
  sm: "px-3.5 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm font-medium",
  lg: "px-7 py-3.5 text-base font-semibold",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  href,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center rounded-md transition-colors duration-150",
    variants[variant],
    sizes[size],
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
