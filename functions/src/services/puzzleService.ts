import {FieldValue, getFirestore} from "firebase-admin/firestore";
import {HttpError} from "../lib/httpError";
import {
  DailyPuzzleResponse,
  emptyUserGameStats,
  GuessResponse,
  PrivatePuzzleDoc,
  PublicPuzzleDoc,
  PuzzleAttemptDoc,
  PuzzleChoice,
  PuzzleHint,
  UpsertPuzzleInput,
  UserGameStatsDoc,
} from "../models/puzzle";
import {computeStreakUpdate, nextUtcMidnightIso, utcPuzzleDate, applyGuessToAttempt} from "./puzzleLogic";

const attemptDocId = (playerId: string, puzzleId: string) =>
  `${playerId.replace(/[^a-zA-Z0-9_-]/g, "_")}__${puzzleId}`;

class PuzzleService {
  private publicCollection() {
    return getFirestore().collection("puzzlePublic");
  }

  private privateCollection() {
    return getFirestore().collection("puzzlePrivate");
  }

  private attemptsCollection() {
    return getFirestore().collection("puzzleAttempts");
  }

  private statsCollection() {
    return getFirestore().collection("userGameStats");
  }

  private configDoc() {
    return getFirestore().collection("gameConfig").doc("dailyPuzzle");
  }

  resolvePlayerId(input: {uid?: string | null; anonymousPlayerId?: string | null}): string {
    if (input.uid) {
      return `uid:${input.uid}`;
    }
    const anon = (input.anonymousPlayerId ?? "").trim();
    if (!anon || anon.length < 8 || anon.length > 80) {
      throw new HttpError(400, "A valid player id is required when signed out.", "player_id_required");
    }
    return `anon:${anon}`;
  }

  private async getTodayFromSupabase(
    playerId: string | null,
    puzzleDate: string,
  ): Promise<DailyPuzzleResponse | null> {
    const {getSupabaseEnvOrNull, supabaseRest, supabaseRpc} = await import("../db/supabaseClient");
    const env = getSupabaseEnvOrNull();
    if (!env) {
      return null;
    }

    try {
      const publicRows = (await supabaseRest(
        env,
        `puzzles_public?puzzle_id=eq.${encodeURIComponent(puzzleDate)}&select=*&limit=1`,
        {method: "GET", prefer: "return=representation"},
      )) as Array<Record<string, unknown>> | null;
      const publicRow = Array.isArray(publicRows) && publicRows[0] ? publicRows[0] : null;
      if (!publicRow) {
        return null;
      }

      const privateRow = (await supabaseRpc(
        env,
        "get_puzzle_private",
        {p_puzzle_id: puzzleDate},
        "return=representation",
      )) as Record<string, unknown> | null;
      if (!privateRow || privateRow.status !== "published") {
        return null;
      }

      const publicPuzzle = this.mapPublic(
        puzzleDate,
        (publicRow.payload as Record<string, unknown>) ?? {},
      );
      const answer = (privateRow.answer as Record<string, unknown>) ?? {};
      const hints = (privateRow.hints as PuzzleHint[]) ?? [];

      let attempt: DailyPuzzleResponse["attempt"] = null;
      if (playerId) {
        const attemptRows = (await supabaseRest(
          env,
          `puzzle_attempts?player_id=eq.${encodeURIComponent(playerId)}` +
            `&puzzle_id=eq.${encodeURIComponent(puzzleDate)}&select=*&limit=1`,
          {method: "GET", prefer: "return=representation"},
        )) as Array<Record<string, unknown>> | null;
        const attemptRow = Array.isArray(attemptRows) && attemptRows[0] ? attemptRows[0] : null;
        if (attemptRow) {
          const data = (attemptRow.attempt_state as Record<string, unknown>) ?? {};
          const attemptCount = Number(data.attemptCount ?? 0);
          const completed = Boolean(data.completed);
          const won = Boolean(data.won);
          const revealedHints = hints.filter((hint) => hint.revealAfterAttempt <= attemptCount);
          const correctChoice = publicPuzzle.choices.find(
            (choice) => choice.choiceId === answer.correctChoiceId,
          );
          attempt = {
            puzzleId: puzzleDate,
            selectedChoiceIds: Array.isArray(data.selectedChoiceIds) ? (data.selectedChoiceIds as string[]) : [],
            attemptCount,
            completed,
            won,
            hints: completed ? [] : revealedHints.filter((hint) => !won || hint.revealAfterAttempt < attemptCount),
            answer: completed
              ? {
                  showId: Number(answer.correctShowId),
                  title: String(answer.correctTitle ?? correctChoice?.title ?? "Unknown"),
                  seasonNumber: (answer.seasonNumber as number | null) ?? null,
                  episodeNumber: (answer.episodeNumber as number | null) ?? null,
                }
              : null,
          };
          if (!completed) {
            attempt.hints = revealedHints;
          }
        }
      }

      return {
        ...publicPuzzle,
        puzzleId: publicPuzzle.id,
        attempt,
      };
    } catch {
      return null;
    }
  }

  async getToday(playerId: string | null, now = new Date()): Promise<DailyPuzzleResponse> {
    const puzzleDate = utcPuzzleDate(now);
    const {isSupabaseReadPuzzles} = await import("../config/env");
    if (isSupabaseReadPuzzles()) {
      const fromSupabase = await this.getTodayFromSupabase(playerId, puzzleDate);
      if (fromSupabase) {
        return fromSupabase;
      }
    }

    const publicSnap = await this.publicCollection().doc(puzzleDate).get();
    if (!publicSnap.exists) {
      throw new HttpError(404, "No puzzle is published for today.", "puzzle_not_found");
    }

    const publicPuzzle = this.mapPublic(publicSnap.id, publicSnap.data() as Record<string, unknown>);
    const privateSnap = await this.privateCollection().doc(puzzleDate).get();
    const privatePuzzle = privateSnap.exists
      ? (privateSnap.data() as PrivatePuzzleDoc)
      : null;

    if (!privatePuzzle || privatePuzzle.status !== "published") {
      throw new HttpError(404, "No puzzle is published for today.", "puzzle_not_found");
    }

    let attempt: DailyPuzzleResponse["attempt"] = null;
    if (playerId) {
      const attemptSnap = await this.attemptsCollection().doc(attemptDocId(playerId, puzzleDate)).get();
      if (attemptSnap.exists) {
        const data = attemptSnap.data() as PuzzleAttemptDoc;
        const revealedHints = privatePuzzle.hints.filter((hint) => hint.revealAfterAttempt <= data.attemptCount);
        const correctChoice = publicPuzzle.choices.find((choice) => choice.choiceId === privatePuzzle.correctChoiceId);
        attempt = {
          puzzleId: data.puzzleId,
          selectedChoiceIds: data.selectedChoiceIds,
          attemptCount: data.attemptCount,
          completed: data.completed,
          won: data.won,
          hints: data.completed ? [] : revealedHints.filter((hint) => !data.won || hint.revealAfterAttempt < data.attemptCount),
          answer: data.completed
            ? {
                showId: privatePuzzle.correctShowId,
                title: correctChoice?.title ?? "Unknown",
                seasonNumber: privatePuzzle.seasonNumber,
                episodeNumber: privatePuzzle.episodeNumber,
              }
            : null,
        };
        if (!data.completed) {
          attempt.hints = revealedHints;
        }
      }
    }

    return {
      ...publicPuzzle,
      puzzleId: publicPuzzle.id,
      attempt,
    };
  }

  private async getPublishedPuzzleFromSupabase(
    puzzleId: string,
  ): Promise<{publicPuzzle: PublicPuzzleDoc; privatePuzzle: PrivatePuzzleDoc} | null> {
    const {getSupabaseEnvOrNull, supabaseRest, supabaseRpc} = await import("../db/supabaseClient");
    const env = getSupabaseEnvOrNull();
    if (!env) {
      return null;
    }

    try {
      const publicRows = (await supabaseRest(
        env,
        `puzzles_public?puzzle_id=eq.${encodeURIComponent(puzzleId)}&select=*&limit=1`,
        {method: "GET", prefer: "return=representation"},
      )) as Array<Record<string, unknown>> | null;
      const publicRow = Array.isArray(publicRows) && publicRows[0] ? publicRows[0] : null;
      if (!publicRow) {
        return null;
      }

      const privateRow = (await supabaseRpc(
        env,
        "get_puzzle_private",
        {p_puzzle_id: puzzleId},
        "return=representation",
      )) as Record<string, unknown> | null;
      if (!privateRow || privateRow.status !== "published") {
        return null;
      }

      const answer = (privateRow.answer as Record<string, unknown>) ?? {};
      const publicPuzzle = this.mapPublic(puzzleId, (publicRow.payload as Record<string, unknown>) ?? {});
      const privatePuzzle: PrivatePuzzleDoc = {
        puzzleId,
        correctChoiceId: String(answer.correctChoiceId ?? ""),
        correctShowId: Number(answer.correctShowId ?? 0),
        hints: (privateRow.hints as PuzzleHint[]) ?? [],
        status: "published",
        difficulty: "medium",
        seasonNumber: (answer.seasonNumber as number | null) ?? null,
        episodeNumber: (answer.episodeNumber as number | null) ?? null,
        createdAt: String(privateRow.updated_at ?? ""),
        updatedAt: String(privateRow.updated_at ?? ""),
        publishedAt: typeof privateRow.updated_at === "string" ? privateRow.updated_at : null,
      };

      if (!privatePuzzle.correctChoiceId) {
        return null;
      }

      return {publicPuzzle, privatePuzzle};
    } catch {
      return null;
    }
  }

  private async resolvePublishedPuzzle(
    puzzleId: string,
  ): Promise<{publicPuzzle: PublicPuzzleDoc; privatePuzzle: PrivatePuzzleDoc}> {
    const {isSupabaseReadPuzzles} = await import("../config/env");
    if (isSupabaseReadPuzzles()) {
      const fromSupabase = await this.getPublishedPuzzleFromSupabase(puzzleId);
      if (fromSupabase) {
        return fromSupabase;
      }
    }

    const publicSnap = await this.publicCollection().doc(puzzleId).get();
    const privateSnap = await this.privateCollection().doc(puzzleId).get();
    if (publicSnap.exists && privateSnap.exists) {
      const privatePuzzle = privateSnap.data() as PrivatePuzzleDoc;
      if (privatePuzzle.status === "published") {
        return {
          publicPuzzle: this.mapPublic(publicSnap.id, publicSnap.data() as Record<string, unknown>),
          privatePuzzle,
        };
      }
    }

    // Partial cutover: puzzle may exist only in Supabase even when the read flag is off.
    const fromSupabase = await this.getPublishedPuzzleFromSupabase(puzzleId);
    if (fromSupabase) {
      return fromSupabase;
    }

    throw new HttpError(404, "Puzzle not found.", "puzzle_not_found");
  }

  private async getAttemptFromSupabase(
    playerId: string,
    puzzleId: string,
  ): Promise<PuzzleAttemptDoc | null> {
    const {getSupabaseEnvOrNull, supabaseRest} = await import("../db/supabaseClient");
    const env = getSupabaseEnvOrNull();
    if (!env) {
      return null;
    }

    try {
      const attemptRows = (await supabaseRest(
        env,
        `puzzle_attempts?player_id=eq.${encodeURIComponent(playerId)}` +
          `&puzzle_id=eq.${encodeURIComponent(puzzleId)}&select=*&limit=1`,
        {method: "GET", prefer: "return=representation"},
      )) as Array<Record<string, unknown>> | null;
      const attemptRow = Array.isArray(attemptRows) && attemptRows[0] ? attemptRows[0] : null;
      if (!attemptRow) {
        return null;
      }
      const data = (attemptRow.attempt_state as Record<string, unknown>) ?? {};
      return {
        puzzleId,
        playerId,
        selectedChoiceIds: Array.isArray(data.selectedChoiceIds) ? (data.selectedChoiceIds as string[]) : [],
        attemptCount: Number(data.attemptCount ?? 0),
        completed: Boolean(data.completed),
        won: Boolean(data.won),
        startedAt: String(data.startedAt ?? new Date().toISOString()),
        updatedAt: String(data.updatedAt ?? attemptRow.updated_at ?? new Date().toISOString()),
      };
    } catch {
      return null;
    }
  }

  private emptyAttempt(puzzleId: string, playerId: string, nowIso: string): PuzzleAttemptDoc {
    return {
      puzzleId,
      playerId,
      selectedChoiceIds: [],
      attemptCount: 0,
      completed: false,
      won: false,
      startedAt: nowIso,
      updatedAt: nowIso,
    };
  }

  async submitGuess(input: {
    puzzleId: string;
    choiceId: string;
    playerId: string;
    uid?: string | null;
  }): Promise<GuessResponse> {
    const puzzleId = input.puzzleId;
    const {publicPuzzle, privatePuzzle} = await this.resolvePublishedPuzzle(puzzleId);

    const choice = publicPuzzle.choices.find((item) => item.choiceId === input.choiceId);
    if (!choice) {
      throw new HttpError(400, "Unknown choice.", "invalid_choice");
    }

    const {isSupabaseReadPuzzles, shouldPersistFirestore} = await import("../config/env");
    const nowIso = new Date().toISOString();

    let result: GuessResponse;
    let nextAttempt: PuzzleAttemptDoc;
    let updatedStats: UserGameStatsDoc | null = null;

    if (!shouldPersistFirestore()) {
      const existing =
        (await this.getAttemptFromSupabase(input.playerId, puzzleId)) ??
        this.emptyAttempt(puzzleId, input.playerId, nowIso);
      const applied = applyGuessToAttempt({
        publicPuzzle,
        privatePuzzle,
        current: existing,
        choiceId: input.choiceId,
        nowIso,
      });
      nextAttempt = applied.nextAttempt;
      result = applied.response;

      if (input.uid && result.completed) {
        const stats = await this.getStats(input.uid);
        updatedStats = computeStreakUpdate({
          stats,
          puzzleDate: publicPuzzle.puzzleDate,
          won: result.won,
          attemptCount: result.attempt,
        });
      }
    } else {
      const attemptRef = this.attemptsCollection().doc(attemptDocId(input.playerId, puzzleId));
      const supabaseSeed =
        isSupabaseReadPuzzles() ? await this.getAttemptFromSupabase(input.playerId, puzzleId) : null;

      const applied = await getFirestore().runTransaction(async (transaction) => {
        const existingSnap = await transaction.get(attemptRef);
        const current: PuzzleAttemptDoc = existingSnap.exists
          ? (existingSnap.data() as PuzzleAttemptDoc)
          : (supabaseSeed ?? this.emptyAttempt(puzzleId, input.playerId, nowIso));

        const guess = applyGuessToAttempt({
          publicPuzzle,
          privatePuzzle,
          current,
          choiceId: input.choiceId,
          nowIso,
        });

        const statsRef = guess.nextAttempt.completed && input.uid ? this.statsCollection().doc(input.uid) : null;
        const statsSnap = statsRef ? await transaction.get(statsRef) : null;

        transaction.set(attemptRef, guess.nextAttempt);

        let statsDoc: UserGameStatsDoc | null = null;
        if (statsRef) {
          const stats = statsSnap?.exists
            ? (statsSnap.data() as UserGameStatsDoc)
            : emptyUserGameStats();
          statsDoc = computeStreakUpdate({
            stats,
            puzzleDate: publicPuzzle.puzzleDate,
            won: guess.nextAttempt.won,
            attemptCount: guess.nextAttempt.attemptCount,
          });
          transaction.set(statsRef, {...statsDoc, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
        }

        return {guess, statsDoc};
      });

      nextAttempt = applied.guess.nextAttempt;
      result = applied.guess.response;
      updatedStats = applied.statsDoc;
    }

    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertPuzzleAttemptShadow, upsertUserGameStatsShadow} = await import("../migration/supabaseWriters");

    await writeSupabasePrimaryOrShadow({
      domain: "puzzleAttempts",
      operation: "submitGuess",
      firebaseUid: input.uid ?? input.playerId,
      operationId: `puzzleAttempts:submitGuess:${input.playerId}:${puzzleId}:${Date.now()}`,
      payload: nextAttempt,
      write: () =>
        upsertPuzzleAttemptShadow(input.playerId, puzzleId, nextAttempt as unknown as Record<string, unknown>),
    });

    if (input.uid && result.completed) {
      const stats =
        updatedStats ??
        (shouldPersistFirestore()
          ? ((await this.statsCollection().doc(input.uid).get()).data() as UserGameStatsDoc | undefined) ?? null
          : null);
      if (stats) {
        const uid = input.uid;
        await writeSupabasePrimaryOrShadow({
          domain: "puzzleStats",
          operation: "submitGuess",
          firebaseUid: uid,
          operationId: `puzzleStats:submitGuess:${uid}:${puzzleId}:${Date.now()}`,
          payload: stats,
          write: () =>
            upsertUserGameStatsShadow(uid, {
              currentStreak: stats.currentStreak,
              maxStreak: stats.longestStreak,
              wins: stats.gamesWon,
              plays: stats.gamesPlayed,
              payload: {
                winsByAttempt: stats.winsByAttempt,
                lastPlayedPuzzleDate: stats.lastPlayedPuzzleDate,
              },
            }),
        });
      }
    }

    return result;
  }

  private async getStatsFromSupabase(uid: string): Promise<UserGameStatsDoc | null> {
    const {getSupabaseEnvOrNull, supabaseRest} = await import("../db/supabaseClient");
    const env = getSupabaseEnvOrNull();
    if (!env) {
      return null;
    }

    try {
      const rows = (await supabaseRest(
        env,
        `user_game_stats?firebase_uid=eq.${encodeURIComponent(uid)}&select=*&limit=1`,
        {method: "GET", prefer: "return=representation"},
      )) as Array<Record<string, unknown>> | null;
      const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
      if (!row) {
        return null;
      }

      const payload = (row.payload as Record<string, unknown>) ?? {};
      const winsByAttempt = (payload.winsByAttempt as Record<string, number>) ?? {};
      return {
        gamesPlayed: Number(row.plays ?? 0),
        gamesWon: Number(row.wins ?? 0),
        currentStreak: Number(row.current_streak ?? 0),
        longestStreak: Number(row.max_streak ?? 0),
        winsByAttempt: {
          1: Number(winsByAttempt[1] ?? 0),
          2: Number(winsByAttempt[2] ?? 0),
          3: Number(winsByAttempt[3] ?? 0),
        },
        lastPlayedPuzzleDate:
          typeof payload.lastPlayedPuzzleDate === "string" ? payload.lastPlayedPuzzleDate : null,
      };
    } catch {
      return null;
    }
  }

  async getStats(uid: string): Promise<UserGameStatsDoc> {
    const {isSupabaseReadPuzzles} = await import("../config/env");
    if (isSupabaseReadPuzzles()) {
      const fromSupabase = await this.getStatsFromSupabase(uid);
      if (fromSupabase) {
        return fromSupabase;
      }
    }

    const snap = await this.statsCollection().doc(uid).get();
    if (!snap.exists) {
      return emptyUserGameStats();
    }
    const data = snap.data() as UserGameStatsDoc;
    return {
      gamesPlayed: data.gamesPlayed ?? 0,
      gamesWon: data.gamesWon ?? 0,
      currentStreak: data.currentStreak ?? 0,
      longestStreak: data.longestStreak ?? 0,
      winsByAttempt: {
        1: data.winsByAttempt?.[1] ?? 0,
        2: data.winsByAttempt?.[2] ?? 0,
        3: data.winsByAttempt?.[3] ?? 0,
      },
      lastPlayedPuzzleDate: data.lastPlayedPuzzleDate ?? null,
    };
  }

  async upsertPuzzle(input: UpsertPuzzleInput): Promise<{puzzleId: string}> {
    this.validatePuzzleInput(input);
    const puzzleId = input.puzzleDate;
    const nowIso = new Date().toISOString();
    const existingPrivate = await this.privateCollection().doc(puzzleId).get();
    const existingData = existingPrivate.exists ? (existingPrivate.data() as PrivatePuzzleDoc) : null;
    const createdAt = existingData?.createdAt ?? nowIso;
    const publishedAt = input.status === "published" ? (existingData?.publishedAt ?? nowIso) : null;
    const publicDoc: PublicPuzzleDoc = {
      id: puzzleId,
      puzzleDate: input.puzzleDate,
      imageUrl: input.imageUrl,
      mobileImageUrl: input.mobileImageUrl ?? null,
      choices: input.choices,
      maxAttempts: 3,
      nextPuzzleAt: nextUtcMidnightIso(input.puzzleDate),
      locale: input.locale ?? "en-US",
    };
    const privateDoc: PrivatePuzzleDoc = {
      puzzleId,
      correctChoiceId: input.correctChoiceId,
      correctShowId: input.correctShowId,
      hints: input.hints,
      status: input.status,
      difficulty: input.difficulty,
      seasonNumber: input.seasonNumber,
      episodeNumber: input.episodeNumber,
      createdAt,
      updatedAt: nowIso,
      publishedAt,
    };

    const {shouldPersistFirestore} = await import("../config/env");
    if (shouldPersistFirestore()) {
      const batch = getFirestore().batch();
      batch.set(this.publicCollection().doc(puzzleId), publicDoc, {merge: true});
      batch.set(
        this.privateCollection().doc(puzzleId),
        {
          ...privateDoc,
          correctTitle: input.correctTitle,
          imageAsset: input.imageAsset ?? null,
        },
        {merge: true},
      );
      await batch.commit();
    }

    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertPuzzleShadow} = await import("../migration/supabaseWriters");
    await writeSupabasePrimaryOrShadow({
      domain: "puzzles",
      operation: "upsertPuzzle",
      firebaseUid: "system:puzzle-admin",
      operationId: `puzzles:upsert:${puzzleId}:${Date.now()}`,
      payload: {puzzleId, status: input.status},
      write: () =>
        upsertPuzzleShadow({
          puzzleId,
          puzzleDate: input.puzzleDate,
          publicPayload: publicDoc as unknown as Record<string, unknown>,
          answer: {
            correctChoiceId: input.correctChoiceId,
            correctShowId: input.correctShowId,
            correctTitle: input.correctTitle,
            seasonNumber: input.seasonNumber,
            episodeNumber: input.episodeNumber,
          },
          hints: input.hints,
          status: input.status,
          imageAsset: input.imageAsset ?? null,
          publishedAt,
        }),
    });

    return {puzzleId};
  }

  async getPuzzleForAdmin(puzzleId: string): Promise<{
    puzzleId: string;
    puzzleDate: string;
    imageUrl: string;
    mobileImageUrl: string | null;
    choices: PuzzleChoice[];
    maxAttempts: number;
    nextPuzzleAt: string;
    locale: string;
    correctChoiceId: string;
    correctShowId: number;
    correctTitle: string;
    hints: PrivatePuzzleDoc["hints"];
    status: PrivatePuzzleDoc["status"];
    difficulty: PrivatePuzzleDoc["difficulty"];
    seasonNumber: number | null;
    episodeNumber: number | null;
  }> {
    const [publicSnap, privateSnap] = await Promise.all([
      this.publicCollection().doc(puzzleId).get(),
      this.privateCollection().doc(puzzleId).get(),
    ]);
    if (!publicSnap.exists || !privateSnap.exists) {
      throw new HttpError(404, "Puzzle not found.", "puzzle_not_found");
    }
    const publicData = this.mapPublic(publicSnap.id, publicSnap.data() as Record<string, unknown>);
    const privateData = privateSnap.data() as PrivatePuzzleDoc & {correctTitle?: string};
    const correctChoice = publicData.choices.find((choice) => choice.choiceId === privateData.correctChoiceId);
    return {
      puzzleId: publicData.id,
      puzzleDate: publicData.puzzleDate,
      imageUrl: publicData.imageUrl,
      mobileImageUrl: publicData.mobileImageUrl,
      choices: publicData.choices,
      maxAttempts: publicData.maxAttempts,
      nextPuzzleAt: publicData.nextPuzzleAt,
      locale: publicData.locale,
      correctChoiceId: privateData.correctChoiceId,
      correctShowId: privateData.correctShowId,
      correctTitle: privateData.correctTitle ?? correctChoice?.title ?? "",
      hints: privateData.hints ?? [],
      status: privateData.status,
      difficulty: privateData.difficulty,
      seasonNumber: privateData.seasonNumber ?? null,
      episodeNumber: privateData.episodeNumber ?? null,
    };
  }

  async publishScheduledPuzzles(now = new Date()): Promise<{published: string[]}> {
    const today = utcPuzzleDate(now);
    const {shouldPersistFirestore} = await import("../config/env");
    const scheduled = await this.privateCollection().where("status", "==", "scheduled").get();
    const published: string[] = [];
    const publishedAtIso = now.toISOString();
    const privateByPuzzleId = new Map<string, PrivatePuzzleDoc & {correctTitle?: string; imageAsset?: unknown}>();
    const batch = getFirestore().batch();

    for (const doc of scheduled.docs) {
      if (doc.id <= today) {
        batch.set(
          doc.ref,
          {
            status: "published",
            publishedAt: publishedAtIso,
            updatedAt: publishedAtIso,
          },
          {merge: true},
        );
        published.push(doc.id);
        privateByPuzzleId.set(
          doc.id,
          doc.data() as PrivatePuzzleDoc & {correctTitle?: string; imageAsset?: unknown},
        );
      }
    }

    if (shouldPersistFirestore()) {
      if (published.length > 0) {
        await batch.commit();
      }
      await this.configDoc().set(
        {
          lastPublishCheckAt: FieldValue.serverTimestamp(),
          lastPublishedIds: published,
        },
        {merge: true},
      );
    }

    const {writeSupabasePrimaryOrShadow} = await import("../migration/shadow");
    const {upsertPuzzleShadow, upsertGameConfigShadow} = await import("../migration/supabaseWriters");

    for (const puzzleId of published) {
      const privateData = privateByPuzzleId.get(puzzleId);
      const publicSnap = await this.publicCollection().doc(puzzleId).get();
      const publicPuzzle = publicSnap.exists
        ? this.mapPublic(publicSnap.id, publicSnap.data() as Record<string, unknown>)
        : null;
      await writeSupabasePrimaryOrShadow({
        domain: "puzzles",
        operation: "publish",
        firebaseUid: "system:puzzle-scheduler",
        operationId: `puzzles:publish:${puzzleId}:${Date.now()}`,
        payload: {puzzleId, status: "published", publishedAt: publishedAtIso},
        write: () =>
          upsertPuzzleShadow({
            puzzleId,
            puzzleDate: publicPuzzle?.puzzleDate ?? puzzleId,
            publicPayload: publicPuzzle ? (publicPuzzle as unknown as Record<string, unknown>) : {},
            answer: {
              correctChoiceId: privateData?.correctChoiceId ?? null,
              correctShowId: privateData?.correctShowId ?? null,
              correctTitle: privateData?.correctTitle ?? null,
              seasonNumber: privateData?.seasonNumber ?? null,
              episodeNumber: privateData?.episodeNumber ?? null,
            },
            hints: privateData?.hints ?? [],
            status: "published",
            imageAsset: privateData?.imageAsset ?? null,
            publishedAt: publishedAtIso,
          }),
      });
    }

    await writeSupabasePrimaryOrShadow({
      domain: "gameConfig",
      operation: "publishScheduledPuzzles",
      firebaseUid: "system:puzzle-scheduler",
      operationId: `gameConfig:dailyPuzzle:${Date.now()}`,
      payload: {lastPublishCheckAt: publishedAtIso, lastPublishedIds: published},
      write: () =>
        upsertGameConfigShadow("dailyPuzzle", {
          lastPublishCheckAt: publishedAtIso,
          lastPublishedIds: published,
        }),
    });

    return {published};
  }

  async listPuzzles(limit = 30): Promise<Array<PublicPuzzleDoc & {puzzleId: string; status: string; difficulty: string}>> {
    const privateSnap = await this.privateCollection().limit(200).get();
    const results = [];
    for (const doc of privateSnap.docs) {
      const privateData = doc.data() as PrivatePuzzleDoc;
      const publicSnap = await this.publicCollection().doc(doc.id).get();
      if (!publicSnap.exists) {
        continue;
      }
      const publicData = this.mapPublic(publicSnap.id, publicSnap.data() as Record<string, unknown>);
      results.push({
        ...publicData,
        puzzleId: publicData.id,
        status: privateData.status,
        difficulty: privateData.difficulty,
      });
    }
    return results
      .sort((left, right) => right.puzzleDate.localeCompare(left.puzzleDate))
      .slice(0, limit);
  }

  private validatePuzzleInput(input: UpsertPuzzleInput) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.puzzleDate)) {
      throw new HttpError(400, "puzzleDate must be YYYY-MM-DD.", "invalid_puzzle_date");
    }
    if (!Array.isArray(input.choices) || input.choices.length !== 4) {
      throw new HttpError(400, "Exactly four choices are required.", "invalid_choices");
    }
    const ids = new Set(input.choices.map((choice) => choice.choiceId));
    if (ids.size !== 4) {
      throw new HttpError(400, "Choice ids must be unique.", "invalid_choices");
    }
    if (!ids.has(input.correctChoiceId)) {
      throw new HttpError(400, "correctChoiceId must match a choice.", "invalid_correct_choice");
    }
    if (!input.imageUrl) {
      throw new HttpError(400, "imageUrl is required.", "invalid_image");
    }
  }

  private mapPublic(id: string, data: Record<string, unknown>): PublicPuzzleDoc {
    return {
      id,
      puzzleDate: String(data.puzzleDate ?? id),
      imageUrl: String(data.imageUrl ?? ""),
      mobileImageUrl: (data.mobileImageUrl as string | null | undefined) ?? null,
      choices: (data.choices as PuzzleChoice[]) ?? [],
      maxAttempts: Number(data.maxAttempts ?? 3),
      nextPuzzleAt: String(data.nextPuzzleAt ?? nextUtcMidnightIso(String(data.puzzleDate ?? id))),
      locale: String(data.locale ?? "en-US"),
    };
  }
}

export const puzzleService = new PuzzleService();
