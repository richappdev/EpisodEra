import {FieldValue, Timestamp, getFirestore} from "firebase-admin/firestore";
import {UserStats, YearRecap} from "../models/stats";
import {AchievementProgress} from "../models/achievement";

const STATS_TTL_MS = 15 * 60 * 1000;
const ACHIEVEMENTS_TTL_MS = 15 * 60 * 1000;

interface DerivedEnvelope<T> {
  payload: T;
  computedAt: Timestamp;
  invalidatedAt?: Timestamp | null;
}

const isFresh = (envelope: DerivedEnvelope<unknown> | null, ttlMs: number) => {
  if (!envelope?.computedAt) {
    return false;
  }
  if (envelope.invalidatedAt && envelope.invalidatedAt.toMillis() >= envelope.computedAt.toMillis()) {
    return false;
  }
  return Date.now() - envelope.computedAt.toMillis() < ttlMs;
};

class DerivedCacheService {
  private doc(userId: string, derivedId: string) {
    return getFirestore().collection("users").doc(userId).collection("derived").doc(derivedId);
  }

  async invalidateUserLibraryCaches(userId: string): Promise<void> {
    const collection = getFirestore().collection("users").doc(userId).collection("derived");
    const snapshot = await collection.get();
    if (!snapshot.empty) {
      const batch = getFirestore().batch();
      for (const doc of snapshot.docs) {
        batch.set(doc.ref, {invalidatedAt: FieldValue.serverTimestamp()}, {merge: true});
      }
      await batch.commit();
    }

    const {shadowWrite} = await import("../migration/shadow");
    const {invalidateDerivedCacheShadow} = await import("../migration/supabaseWriters");
    await shadowWrite({
      domain: "derived",
      operation: "invalidate",
      firebaseUid: userId,
      operationId: `derived:invalidate:${userId}:${Date.now()}`,
      payload: {},
      secondary: () => invalidateDerivedCacheShadow(userId),
    });
  }

  async getStats(userId: string): Promise<UserStats | null> {
    const snapshot = await this.doc(userId, "stats").get();
    if (!snapshot.exists) {
      return null;
    }
    const envelope = snapshot.data() as DerivedEnvelope<UserStats>;
    return isFresh(envelope, STATS_TTL_MS) ? envelope.payload : null;
  }

  async setStats(userId: string, payload: UserStats): Promise<void> {
    await this.doc(userId, "stats").set({
      payload,
      computedAt: FieldValue.serverTimestamp(),
      invalidatedAt: null,
    });
    const {shadowWrite} = await import("../migration/shadow");
    const {upsertDerivedCacheShadow} = await import("../migration/supabaseWriters");
    await shadowWrite({
      domain: "derived",
      operation: "setStats",
      firebaseUid: userId,
      operationId: `derived:stats:${userId}:${Date.now()}`,
      payload: {cacheKey: "stats"},
      secondary: () => upsertDerivedCacheShadow(userId, "stats", payload),
    });
  }

  async getYearRecap(userId: string, year: number): Promise<YearRecap | null> {
    const snapshot = await this.doc(userId, `yearRecap_${year}`).get();
    if (!snapshot.exists) {
      return null;
    }
    const envelope = snapshot.data() as DerivedEnvelope<YearRecap>;
    return isFresh(envelope, STATS_TTL_MS) ? envelope.payload : null;
  }

  async setYearRecap(userId: string, year: number, payload: YearRecap): Promise<void> {
    await this.doc(userId, `yearRecap_${year}`).set({
      payload,
      computedAt: FieldValue.serverTimestamp(),
      invalidatedAt: null,
    });
    const {shadowWrite} = await import("../migration/shadow");
    const {upsertDerivedCacheShadow} = await import("../migration/supabaseWriters");
    await shadowWrite({
      domain: "derived",
      operation: "setYearRecap",
      firebaseUid: userId,
      operationId: `derived:yearRecap:${userId}:${year}:${Date.now()}`,
      payload: {year},
      secondary: () => upsertDerivedCacheShadow(userId, `yearRecap_${year}`, payload),
    });
  }

  async getAchievements(userId: string): Promise<AchievementProgress[] | null> {
    const snapshot = await this.doc(userId, "achievements").get();
    if (!snapshot.exists) {
      return null;
    }
    const envelope = snapshot.data() as DerivedEnvelope<AchievementProgress[]>;
    return isFresh(envelope, ACHIEVEMENTS_TTL_MS) ? envelope.payload : null;
  }

  async setAchievements(userId: string, payload: AchievementProgress[]): Promise<void> {
    await this.doc(userId, "achievements").set({
      payload,
      computedAt: FieldValue.serverTimestamp(),
      invalidatedAt: null,
    });
    const {shadowWrite} = await import("../migration/shadow");
    const {upsertDerivedCacheShadow} = await import("../migration/supabaseWriters");
    await shadowWrite({
      domain: "derived",
      operation: "setAchievements",
      firebaseUid: userId,
      operationId: `derived:achievements:${userId}:${Date.now()}`,
      payload: {cacheKey: "achievements"},
      secondary: () => upsertDerivedCacheShadow(userId, "achievements", payload),
    });
  }
}
export const derivedCacheService = new DerivedCacheService();
