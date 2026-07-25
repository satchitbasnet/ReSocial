import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";

export function PlatformLogos() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
      {PLATFORMS.map((platform) => (
        <div
          key={platform.id}
          className="flex flex-col items-center gap-2 group"
          title={platform.name}
        >
          <div className="flex h-14 w-14 items-center justify-center frame-card group-hover:scale-105 transition-transform duration-200">
            <PlatformIcon platform={platform.id} size={28} />
          </div>
          <span className="hud-label">{platform.name}</span>
        </div>
      ))}
    </div>
  );
}
