import {Star} from "lucide-react";
import {MediaSummary} from "../types/media";

interface MediaCardProps {
  item: MediaSummary;
  onSelect: (item: MediaSummary) => void;
}

export const MediaCard = ({item, onSelect}: MediaCardProps) => {
  const year = item.releaseDate ? new Date(item.releaseDate).getFullYear() : "TBA";

  return (
    <button className="media-card" type="button" onClick={() => onSelect(item)}>
      <div className="poster-frame">
        {item.images.poster ? (
          <img src={item.images.poster} alt="" loading="lazy" />
        ) : (
          <span>{item.mediaType.toUpperCase()}</span>
        )}
      </div>
      <span className="media-kind">{item.mediaType === "movie" ? "Movie" : "TV"}</span>
      <strong>{item.title || "Untitled"}</strong>
      <span className="media-meta">
        {year}
        <span>
          <Star size={14} fill="currentColor" aria-hidden="true" />
          {item.voteAverage.toFixed(1)}
        </span>
      </span>
    </button>
  );
};
