import { Badge } from "@/components/ui/badge";

interface HeroBadgesProps {
  badges?: string[];
  variant?: "inline" | "grid";
}

export const HeroBadges: React.FC<HeroBadgesProps> = ({ badges, variant = "inline" }) => {
  if (!badges?.length) return null;

  if (variant === "grid") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {badges.map((badge) => (
          <div
            key={`${badge}-detail`}
            className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800 uppercase tracking-wide"
          >
            {badge}
          </div>
        ))}
      </div>
    );
  }

  // Default inline variant
  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <Badge
          key={badge}
          variant="outline"
          className="uppercase tracking-wider text-xs font-semibold border-gray-300 text-gray-800 bg-white"
        >
          {badge}
        </Badge>
      ))}
    </div>
  );
};
