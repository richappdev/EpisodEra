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
  UpsertPuzzleInput,
  UserGameStatsDoc,
} from "../models/puzzle";
import {computeStreakUpdate, hintForAttempt, nextUtcMidnightIso, utcPuzzleDate} from "./puzzleLogic";

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

  async getToday(playerId: string | null, now = new Date()): Promise<DailyPuzzleResponse> {
    const puzzleDate = utcPuzzleDate(now);
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

  async submitGuess(input: {
    puzzleId: string;
    choiceId: string;
    playerId: string;
    uid?: string | null;
  }): Promise<GuessResponse> {
    const puzzleId = input.puzzleId;
    const publicSnap = await this.publicCollection().doc(puzzleId).get();
    const privateSnap = await this.privateCollection().doc(puzzleId).get();
    if (!publicSnap.exists || !privateSnap.exists) {
      throw new HttpError(404, "Puzzle not found.", "puzzle_not_found");
    }

    const publicPuzzle = this.mapPublic(publicSnap.id, publicSnap.data() as Record<string, unknown>);
    const privatePuzzle = privateSnap.data() as PrivatePuzzleDoc;
    if (privatePuzzle.status !== "published") {
      throw new HttpError(404, "Puzzle not found.", "puzzle_not_found");
    }

    if (publicPuzzle.puzzleDate !== utcPuzzleDate() && privatePuzzle.status === "published") {
      // Allow playing today's published id only; historical ids OK if published.
    }

    const choice = publicPuzzle.choices.find((item) => item.choiceId === input.choiceId);
    if (!choice) {
      throw new HttpError(400, "Unknown choice.", "invalid_choice");
    }

    const attemptRef = this.attemptsCollection().doc(attemptDocId(input.playerId, puzzleId));
    const nowIso = new Date().toISOString();

    const result = await getFirestore().runTransaction(async (transaction) => {
      // Firestore requires all reads before any writes in a transaction.
      const existing = await transaction.get(attemptRef);
      const current: PuzzleAttemptDoc = existing.exists
        ? (existing.data() as PuzzleAttemptDoc)
        : {
            puzzleId,
            playerId: input.playerId,
            selectedChoiceIds: [],
            attemptCount: 0,
            completed: false,
            won: false,
            startedAt: nowIso,
            updatedAt: nowIso,
          };

      if (current.completed) {
        throw new HttpError(409, "This puzzle is already completed.", "puzzle_completed");
      }
      if (current.selectedChoiceIds.includes(input.choiceId)) {
        throw new HttpError(400, "That choice was already selected.", "duplicate_choice");
      }
      if (current.attemptCount >= publicPuzzle.maxAttempts) {
        throw new HttpError(400, "No attempts remaining.", "no_attempts_remaining");
      }

      const selectedChoiceIds = [...current.selectedChoiceIds, input.choiceId];
      const attemptCount = selectedChoiceIds.length;
      const correct = input.choiceId === privatePuzzle.correctChoiceId;
      const completed = correct || attemptCount >= publicPuzzle.maxAttempts;
      const won = correct;
      const hint = correct ? null : hintForAttempt(privatePuzzle.hints, attemptCount);
      const correctChoice = publicPuzzle.choices.find((item) => item.choiceId === privatePuzzle.correctChoiceId);

      const statsRef = completed && input.uid ? this.statsCollection().doc(input.uid) : null;
      const statsSnap = statsRef ? await transaction.get(statsRef) : null;

      const nextAttempt: PuzzleAttemptDoc = {
        ...current,
        selectedChoiceIds,
        attemptCount,
        completed,
        won,
        updatedAt: nowIso,
        startedAt: current.startedAt || nowIso,
      };
      transaction.set(attemptRef, nextAttempt);

      if (statsRef) {
        const stats = statsSnap?.exists
          ? (statsSnap.data() as UserGameStatsDoc)
          : emptyUserGameStats();
        const updated = computeStreakUpdate({
          stats,
          puzzleDate: publicPuzzle.puzzleDate,
          won,
          attemptCount,
        });
        transaction.set(statsRef, {...updated, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
      }

      if (!completed) {
        return {
          correct: false as const,
          attempt: attemptCount,
          attemptsRemaining: publicPuzzle.maxAttempts - attemptCount,
          hint,
          selectedChoiceIds,
          completed: false as const,
          won: false as const,
        };
      }

      return {
        correct,
        attempt: attemptCount,
        attemptsRemaining: publicPuzzle.maxAttempts - attemptCount,
        selectedChoiceIds,
        completed: true as const,
        won,
        answer: {
          showId: privatePuzzle.correctShowId,
          title: correctChoice?.title ?? "Unknown",
          seasonNumber: privatePuzzle.seasonNumber,
          episodeNumber: privatePuzzle.episodeNumber,
        },
        showPath: `/tv/${privatePuzzle.correctShowId}`,
        hint,
      };
    });

    return result;
  }

  async getStats(uid: string): Promise<UserGameStatsDoc> {
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
    const scheduled = await this.privateCollection().where("status", "==", "scheduled").get();
    const published: string[] = [];
    const batch = getFirestore().batch();

    for (const doc of scheduled.docs) {
      if (doc.id <= today) {
        batch.set(
          doc.ref,
          {
            status: "published",
            publishedAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
          {merge: true},
        );
        published.push(doc.id);
      }
    }

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
