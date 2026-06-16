import { CheckCircle2 } from "lucide-react";

interface Highlight {
  label: string;
  value?: string;
}

interface HeroHighlightsProps {
  highlights?: Highlight[];
}

export const HeroHighlights: React.FC<HeroHighlightsProps> = ({ highlights }) => {
  if (!highlights?.length) return null;

  return (
    <ul className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
      {highlights.map((highlight) => (
        <li key={`${highlight.label}-${highlight.value}`} className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span>
            <span className="font-semibold text-gray-900">{highlight.label}</span>
            {highlight.value ? ` ${highlight.value}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
};
