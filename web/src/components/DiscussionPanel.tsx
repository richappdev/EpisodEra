import {FormEvent, useEffect, useState} from "react";
import {api} from "../api/client";
import {DiscussionComment} from "../types/social";
import {MediaType} from "../types/media";

interface DiscussionPanelProps {
  mediaType: MediaType;
  tmdbId: number;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  signedIn: boolean;
}

export const DiscussionPanel = ({
  mediaType,
  tmdbId,
  seasonNumber = null,
  episodeNumber = null,
  signedIn,
}: DiscussionPanelProps) => {
  const [items, setItems] = useState<DiscussionComment[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void api
      .listDiscussions(mediaType, tmdbId)
      .then((response) => setItems(response.items))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Could not load discussions.");
      })
      .finally(() => setLoading(false));
  }, [mediaType, tmdbId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!signedIn) {
      return;
    }

    try {
      const created = await api.createDiscussion(mediaType, tmdbId, {
        body,
        seasonNumber,
        episodeNumber,
      });
      setItems((current) => [created, ...current]);
      setBody("");
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not post comment.");
    }
  };

  return (
    <section className="discussion-panel" data-testid="discussion-panel">
      <div className="section-header">
        <div>
          <span className="media-kind">Discussion</span>
          <h3>Spoiler-safe comments</h3>
          <p className="muted-copy">Comments stay hidden until you have watched the same movie or episode.</p>
        </div>
      </div>

      {loading && <div className="state-panel inline-state">Loading discussion...</div>}
      {error && <div className="state-panel error">{error}</div>}

      {signedIn ? (
        <form className="search-form" onSubmit={(event) => void submit(event)}>
          <input
            aria-label="Discussion comment"
            data-testid="discussion-input"
            placeholder="Share a spoiler-safe thought"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <button data-testid="discussion-submit" type="submit">
            Post
          </button>
        </form>
      ) : (
        <div className="state-panel">Sign in to join the discussion.</div>
      )}

      <div className="history-list">
        {items.map((item) => (
          <article className="history-row" data-testid={`discussion-${item.commentId}`} key={item.commentId}>
            <div>
              <strong>{item.displayName}</strong>
              <span>
                {item.spoilerHidden
                  ? "Hidden until you watch this title"
                  : item.body ?? "Hidden until you watch this title"}
              </span>
            </div>
          </article>
        ))}
        {!loading && items.length === 0 && <div className="state-panel">No comments yet.</div>}
      </div>
    </section>
  );
};
