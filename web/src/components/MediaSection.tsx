import {ChevronRight} from "lucide-react";
import {Link} from "react-router-dom";
import {MediaCard} from "./MediaCard";
import {paths} from "../routes/paths";
import {MediaSummary} from "../types/media";

const RAIL_MAX_ITEMS = 10;

interface MediaSectionProps {
  title: string;
  items: MediaSummary[];
  layout?: "grid" | "rail";
  listId?: string;
  onSelect: (item: MediaSummary) => void;
}

export const MediaSection = ({title, items, layout = "grid", listId, onSelect}: MediaSectionProps) => {
  const visibleItems = layout === "rail" ? items.slice(0, RAIL_MAX_ITEMS) : items;
  const showMore = layout === "rail" && Boolean(listId) && visibleItems.length > 0;

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
        {showMore && listId && (
          <Link
            className="media-rail-more"
            data-testid={`list-more-${listId}`}
            to={paths.list(listId)}
            aria-label={`More from ${title}`}
          >
            <span>More</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
};
