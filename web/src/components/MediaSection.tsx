import {MediaCard} from "./MediaCard";
import {MediaSummary} from "../types/media";

interface MediaSectionProps {
  title: string;
  items: MediaSummary[];
  onSelect: (item: MediaSummary) => void;
}

export const MediaSection = ({title, items, onSelect}: MediaSectionProps) => (
  <section className="media-section">
    <div className="section-header">
      <h2>{title}</h2>
      <span>{items.length}</span>
    </div>
    <div className="media-grid">
      {items.map((item) => (
        <MediaCard key={`${item.mediaType}-${item.id}`} item={item} onSelect={onSelect} />
      ))}
    </div>
  </section>
);
