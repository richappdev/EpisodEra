import {MediaCard} from "./MediaCard";
import {MediaSummary} from "../types/media";

interface MediaSectionProps {
  title: string;
  items: MediaSummary[];
  layout?: "grid" | "rail";
  onSelect: (item: MediaSummary) => void;
}

export const MediaSection = ({title, items, layout = "grid", onSelect}: MediaSectionProps) => (
  <section className={`media-section${layout === "rail" ? " media-section--rail" : ""}`}>
    <div className="section-header">
      <h2>{title}</h2>
      <span>{items.length}</span>
    </div>
    <div className={layout === "rail" ? "media-rail" : "media-grid"}>
      {items.map((item) => (
        <MediaCard key={`${item.mediaType}-${item.id}`} item={item} onSelect={onSelect} />
      ))}
    </div>
  </section>
);
