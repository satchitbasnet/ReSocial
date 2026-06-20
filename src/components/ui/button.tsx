import Link from "next/link";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  href?: string;
}

const variants = {
  primary:
    "bg-gradient-to-br from-brand-600 via-brand-indigo to-accent text-white hover:opacity-90 shadow-lg shadow-brand-500/25",
  secondary: "bg-gray-900 text-white hover:bg-gray-800",
  outline: "border-2 border-brand-600 text-brand-600 hover:bg-brand-50",
  ghost: "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-2.5 text-sm font-medium",
  lg: "px-8 py-3.5 text-base font-semibold",
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
    "inline-flex items-center justify-center rounded-full transition-all duration-200",
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
