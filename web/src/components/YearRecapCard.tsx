import {useState} from "react";
import {Copy, Share2} from "lucide-react";
import {formatWatchTime} from "../lib/seasonProgress";
import {YearRecap} from "../types/stats";

interface YearRecapCardProps {
  recap: YearRecap;
  onYearChange: (year: number) => void;
}

const monthLabel = (value: string | null) => {
  if (!value) {
    return "—";
  }

  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(undefined, {month: "long", year: "numeric", timeZone: "UTC"}).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
};

export const buildRecapShareText = (recap: YearRecap) =>
  [
    `Episodera ${recap.year} Year in Review`,
    `Episodes: ${recap.totalWatchedEpisodes}`,
    `Movies: ${recap.totalWatchedMovies}`,
    `Watch time: ${formatWatchTime(recap.totalWatchTimeMinutes)}`,
    `Longest streak: ${recap.longestStreakDays} day${recap.longestStreakDays === 1 ? "" : "s"}`,
    `Most active month: ${monthLabel(recap.mostActiveMonth)}`,
    `Top show: ${recap.topShow?.title ?? "—"}`,
    `Top movie: ${recap.topMovie?.title ?? "—"}`,
    `Top genre: ${recap.topGenre?.name ?? "—"}`,
    `Newly discovered: ${
      recap.newlyDiscovered.length > 0 ? recap.newlyDiscovered.map((item) => item.title).join(", ") : "—"
    }`,
  ].join("\n");

export const YearRecapCard = ({recap, onYearChange}: YearRecapCardProps) => {
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const currentYear = new Date().getUTCFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const copyRecap = async () => {
    const text = buildRecapShareText(recap);
    try {
      await navigator.clipboard.writeText(text);
      setShareMessage("Recap copied");
    } catch {
      setShareMessage("Could not copy recap");
    }
  };

  const shareRecap = async () => {
    const text = buildRecapShareText(recap);
    if (navigator.share) {
      try {
        await navigator.share({title: `Episodera ${recap.year} Year in Review`, text});
        setShareMessage("Recap shared");
        return;
      } catch {
        // Fall through to clipboard when share is cancelled or unsupported mid-flight.
      }
    }

    await copyRecap();
  };

  return (
    <section className="year-recap-card" data-testid="year-recap-card">
      <div className="section-header">
        <div>
          <span className="media-kind">Year in Review</span>
          <h2>{recap.year} Recap</h2>
        </div>
        <select
          aria-label="Recap year"
          data-testid="recap-year"
          value={recap.year}
          onChange={(event) => onYearChange(Number(event.target.value))}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <div className="recap-share-card" data-testid="recap-share-surface">
        <p>
          {recap.totalWatchedEpisodes} episodes · {recap.totalWatchedMovies} movies ·{" "}
          {formatWatchTime(recap.totalWatchTimeMinutes)}
        </p>
        <dl className="recap-grid">
          <div>
            <dt>Longest streak</dt>
            <dd data-testid="recap-streak">
              {recap.longestStreakDays} day{recap.longestStreakDays === 1 ? "" : "s"}
            </dd>
          </div>
          <div>
            <dt>Most active month</dt>
            <dd data-testid="recap-month">{monthLabel(recap.mostActiveMonth)}</dd>
          </div>
          <div>
            <dt>Top show</dt>
            <dd data-testid="recap-top-show">{recap.topShow?.title ?? "—"}</dd>
          </div>
          <div>
            <dt>Top movie</dt>
            <dd data-testid="recap-top-movie">{recap.topMovie?.title ?? "—"}</dd>
          </div>
          <div>
            <dt>Top genre</dt>
            <dd data-testid="recap-top-genre">{recap.topGenre?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Newly discovered</dt>
            <dd data-testid="recap-new">
              {recap.newlyDiscovered.length > 0
                ? recap.newlyDiscovered.map((item) => item.title).join(", ")
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="recap-actions">
        <button className="text-button" data-testid="recap-copy" type="button" onClick={() => void copyRecap()}>
          <Copy size={16} aria-hidden="true" />
          Copy recap
        </button>
        <button className="text-button" data-testid="recap-share" type="button" onClick={() => void shareRecap()}>
          <Share2 size={16} aria-hidden="true" />
          Share
        </button>
        {shareMessage && <span data-testid="recap-share-status">{shareMessage}</span>}
      </div>
    </section>
  );
};
