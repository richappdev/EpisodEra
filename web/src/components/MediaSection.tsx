import {MediaCard} from "./MediaCard";
import {MediaSummary} from "../types/media";

const RAIL_MAX_ITEMS = 10;

interface MediaSectionProps {
  title: string;
  items: MediaSummary[];
  layout?: "grid" | "rail";
  onSelect: (item: MediaSummary) => void;
}

export const MediaSection = ({title, items, layout = "grid", onSelect}: MediaSectionProps) => {
  const visibleItems = layout === "rail" ? items.slice(0, RAIL_MAX_ITEMS) : items;

  return (
    <section className={`media-section${layout === "rail" ? " media-section--rail" : ""}`}>
      <div className="section-header">
        <h2>{title}</h2>
        <span>{visibleItems.length}</span>
      </div>
      <div className={layout === "rail" ? "media-rail" : "media-grid"}>
        {visibleItems.map((item) => (
          <MediaCard key={`${item.mediaType}-${item.id}`} item={item} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
};
