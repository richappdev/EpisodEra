import {FormEvent, useCallback, useEffect, useState} from "react";
import {Loader2, Users} from "lucide-react";
import {api} from "../api/client";
import {SectionError} from "../components/SectionError";
import {
  ActivityFeedItem,
  ChallengeProgress,
  CompatibilityResult,
  FriendsResponse,
} from "../types/social";

interface SocialPageProps {
  signedIn: boolean;
}

export const SocialPage = ({signedIn}: SocialPageProps) => {
  const [friends, setFriends] = useState<FriendsResponse | null>(null);
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [challenges, setChallenges] = useState<ChallengeProgress[]>([]);
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null>(null);
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [friendsResponse, feedResponse, challengesResponse] = await Promise.all([
        api.meFriends(),
        api.meFeed(),
        api.meChallenges(),
      ]);
      setFriends(friendsResponse);
      setFeed(feedResponse.items);
      setChallenges(challengesResponse.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load social data.");
    } finally {
      setLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!signedIn) {
    return (
      <main className="page-shell">
        <div className="state-panel">Sign in to manage friends, challenges, and your activity feed.</div>
      </main>
    );
  }

  const acceptFriend = async (friendUserId: string) => {
    setFriends(await api.updateFriendStatus(friendUserId, "accepted"));
  };

  const removeFriend = async (friendUserId: string) => {
    setFriends(await api.updateFriendStatus(friendUserId, "removed"));
    if (selectedFriendId === friendUserId) {
      setSelectedFriendId(null);
      setCompatibility(null);
    }
  };

  const submitFriendCode = async (event: FormEvent) => {
    event.preventDefault();
    setFriends(await api.requestFriend(friendCodeInput.trim().toUpperCase()));
    setFriendCodeInput("");
  };

  const compareFriend = async (friendUserId: string) => {
    setSelectedFriendId(friendUserId);
    const [compat, sharedChallenges] = await Promise.all([
      api.meCompatibility(friendUserId),
      api.meChallenges(friendUserId),
    ]);
    setCompatibility(compat);
    setChallenges(sharedChallenges.items);
  };

  return (
    <main className="page-shell">
      <section className="profile-header">
        <div>
          <span className="media-kind">Social</span>
          <h2>Friends and challenges</h2>
          <p>Connect with a friend code, compare taste, and keep spoilers locked until you watch.</p>
        </div>
        <Users size={28} aria-hidden="true" />
      </section>

      {loading && (
        <div className="state-panel inline-state">
          <Loader2 size={18} aria-hidden="true" />
          Loading social...
        </div>
      )}
      {error && !loading && <SectionError message={error} onRetry={() => void load()} />}

      {!loading && !error && friends && (
        <>
          <section className="settings-group" data-testid="friend-code-panel">
            <h3>Your friend code</h3>
            <p className="muted-copy" data-testid="friend-code-value">
              {friends.friendCode}
            </p>
            <form className="search-form" onSubmit={(event) => void submitFriendCode(event)}>
              <input
                aria-label="Friend code"
                data-testid="friend-code-input"
                maxLength={6}
                placeholder="Enter friend code"
                value={friendCodeInput}
                onChange={(event) => setFriendCodeInput(event.target.value.toUpperCase())}
              />
              <button data-testid="friend-code-submit" type="submit">
                Add friend
              </button>
            </form>
          </section>

          <section className="stats-breakdown" data-testid="friends-list">
            <div>
              <h3>Friends</h3>
              {friends.items.length === 0 ? (
                <p className="muted-copy">No friends yet. Share your code to connect.</p>
              ) : (
                <ol>
                  {friends.items.map((friend) => (
                    <li key={friend.userId}>
                      <span>
                        {friend.displayName} · {friend.status.replace("_", " ")}
                      </span>
                      <span className="social-inline-actions">
                        {friend.status === "pending_incoming" && (
                          <button className="text-button" type="button" onClick={() => void acceptFriend(friend.userId)}>
                            Accept
                          </button>
                        )}
                        {friend.status === "accepted" && (
                          <button className="text-button" type="button" onClick={() => void compareFriend(friend.userId)}>
                            Compare
                          </button>
                        )}
                        <button className="text-button" type="button" onClick={() => void removeFriend(friend.userId)}>
                          Remove
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          {compatibility && (
            <section className="franchise-next" data-testid="compatibility-card">
              <div>
                <span className="media-kind">Taste compatibility</span>
                <h3>
                  {compatibility.friendDisplayName}: {compatibility.score}%
                </h3>
                <p>Shared genres: {compatibility.sharedGenres.join(", ") || "None yet"}</p>
              </div>
            </section>
          )}

          <section className="stats-breakdown" data-testid="challenges-list">
            <div>
              <h3>Shared challenges</h3>
              <ol>
                {challenges.map((challenge) => (
                  <li key={challenge.id}>
                    <span>
                      {challenge.title} · {challenge.current}/{challenge.target} {challenge.unit}
                      {challenge.friendCurrent != null
                        ? ` · friend ${challenge.friendCurrent}/${challenge.target}`
                        : ""}
                    </span>
                    <strong>{challenge.progressPercent}%</strong>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="history-panel" data-testid="friends-feed">
            <div className="section-header">
              <h2>Friends activity</h2>
              <span>{feed.length} items</span>
            </div>
            {feed.length === 0 ? (
              <div className="state-panel">No shared activity yet. Friends must enable activity sharing.</div>
            ) : (
              <div className="history-list">
                {feed.map((item) => (
                  <article className="history-row" key={item.feedId}>
                    <div>
                      <strong>{item.friendDisplayName}</strong>
                      <span>
                        {item.title}
                        {item.spoilerHidden
                          ? " · Spoiler hidden until you watch"
                          : item.mediaType === "tv" && item.seasonNumber != null
                            ? ` · S${item.seasonNumber} E${item.episodeNumber}`
                            : " · Movie"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
};
