import {MarkEpisodesInput, ProgressAggregateRecord, ProgressRepository} from "../types";

/**
 * Calls private.mark_episodes_watched via service-role when wired.
 * Next-episode coordinates remain Express/TMDb-owned (parity with Firestore).
 */
export class SupabaseProgressRepository implements ProgressRepository {
  constructor(private readonly enabled: boolean) {}

  private ensureEnabled(): void {
    if (!this.enabled) {
      throw new Error("SupabaseProgressRepository is not enabled");
    }
  }

  async get(_firebaseUid: string, _showTmdbId: number): Promise<ProgressAggregateRecord | null> {
    this.ensureEnabled();
    throw new Error("SupabaseProgressRepository.get not wired — add @supabase/supabase-js client");
  }

  async markEpisodes(
    _firebaseUid: string,
    _showTmdbId: number,
    _input: MarkEpisodesInput,
  ): Promise<ProgressAggregateRecord> {
    this.ensureEnabled();
    throw new Error(
      "SupabaseProgressRepository.markEpisodes not wired — RPC private.mark_episodes_watched",
    );
  }
}
