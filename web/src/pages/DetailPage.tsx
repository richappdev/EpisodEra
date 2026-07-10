import {ArrowLeft, Clock, ExternalLink, Star} from "lucide-react";
import {MediaDetail} from "../types/media";

interface DetailPageProps {
  detail: MediaDetail;
  onBack: () => void;
}

export const DetailPage = ({detail, onBack}: DetailPageProps) => (
  <main className="detail-page">
    <button className="back-button" type="button" onClick={onBack}>
      <ArrowLeft size={18} aria-hidden="true" />
      Back
    </button>

    <section className="detail-hero">
      {detail.images.backdrop && <img src={detail.images.backdrop} alt="" />}
      <div className="detail-overlay" />
      <div className="detail-content">
        <div className="detail-poster">
          {detail.images.poster ? <img src={detail.images.poster} alt="" /> : <span>No poster</span>}
        </div>
        <div className="detail-copy">
          <span className="media-kind">{detail.mediaType === "movie" ? "Movie" : "TV"}</span>
          <h2>{detail.title}</h2>
          <div className="detail-facts">
            <span>
              <Star size={16} fill="currentColor" aria-hidden="true" />
              {detail.voteAverage.toFixed(1)}
            </span>
            {detail.runtimeMinutes && (
              <span>
                <Clock size={16} aria-hidden="true" />
                {detail.runtimeMinutes} min
              </span>
            )}
            {detail.status && <span>{detail.status}</span>}
          </div>
          <p>{detail.overview || "No overview available."}</p>
          <div className="genre-row">
            {detail.genres.map((genre) => (
              <span key={genre.id}>{genre.name}</span>
            ))}
          </div>
          {detail.homepage && (
            <a href={detail.homepage} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              Official site
            </a>
          )}
        </div>
      </div>
    </section>
  </main>
);
