import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const iconSizes = {
  sm: 32,
  md: 36,
  lg: 40,
} as const;

interface LogoProps {
  size?: keyof typeof iconSizes;
  variant?: "default" | "light";
  showWordmark?: boolean;
  href?: string | null;
  className?: string;
}

export function Logo({
  size = "md",
  variant = "default",
  showWordmark = true,
  href = "/",
  className,
}: LogoProps) {
  const px = iconSizes[size];
  const textSize =
    size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";

  const content = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/logo.png"
        alt="ReSocial"
        width={px}
        height={px}
        className="rounded-xl shrink-0 shadow-[0_2px_8px_rgba(14,165,255,0.25),0_1px_3px_rgba(0,0,0,0.08)]"
        priority
      />
      {showWordmark && (
        <span className={cn("font-display font-bold leading-none tracking-tight", textSize)}>
          <span className="gradient-text-re">Re</span>
          <span
            className={variant === "light" ? "text-white" : "text-gray-900"}
          >
            Social
          </span>
        </span>
      )}
    </span>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
