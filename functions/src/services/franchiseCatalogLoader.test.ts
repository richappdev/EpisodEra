import assert from "node:assert/strict";
import test, {afterEach} from "node:test";
import {franchiseCatalogs} from "../data/franchises";
import {FranchiseCatalog} from "../models/franchise";
import {franchiseCatalogLoader} from "./franchiseCatalogLoader";

const minimalCatalogDoc = (slug: string, name: string, sortOrder: number) => ({
  id: slug,
  data: {
    slug,
    name,
    description: `${name} description`,
    published: true,
    sortOrder,
    phases: [{id: "p1", name: "Phase 1"}],
    titles: [
      {
        tmdbId: 1,
        mediaType: "movie",
        title: `${name} Title`,
        phaseId: "p1",
        releaseOrder: 1,
        chronologicalOrder: 1,
        runtimeMinutes: 100,
      },
    ],
  },
});

const minimalCatalog = (slug: string, name: string): FranchiseCatalog => ({
  slug,
  name,
  description: `${name} description`,
  phases: [{id: "p1", name: "Phase 1"}],
  titles: [
    {
      tmdbId: 1,
      mediaType: "movie",
      title: `${name} Title`,
      phaseId: "p1",
      releaseOrder: 1,
      chronologicalOrder: 1,
      runtimeMinutes: 100,
    },
  ],
});

afterEach(() => {
  franchiseCatalogLoader.clearCache();
  franchiseCatalogLoader.setQueryForTests(null);
});

test("franchiseCatalogLoader serves remote docs and caches them", async () => {
  franchiseCatalogLoader.setQueryForTests(async () => [minimalCatalogDoc("remote-one", "Remote One", 2)]);

  const first = await franchiseCatalogLoader.listPublished();
  assert.equal(first.source, "remote");
  assert.equal(first.catalogs.length, 1);
  assert.equal(first.catalogs[0]?.slug, "remote-one");

  const second = await franchiseCatalogLoader.listPublished();
  assert.equal(second.source, "cache");
  assert.equal(second.catalogs[0]?.slug, "remote-one");
});

test("franchiseCatalogLoader falls back to stale cache then bundled on Firestore errors", async () => {
  let calls = 0;
  franchiseCatalogLoader.setQueryForTests(async () => {
    calls += 1;
    if (calls === 1) {
      return [minimalCatalogDoc("cached-one", "Cached One", 1)];
    }
    throw new Error("firestore unavailable");
  });

  const remote = await franchiseCatalogLoader.listPublished();
  assert.equal(remote.source, "remote");

  franchiseCatalogLoader.setCacheForTests(remote.catalogs, -1);

  const stale = await franchiseCatalogLoader.listPublished();
  assert.equal(stale.source, "cache");
  assert.equal(stale.catalogs[0]?.slug, "cached-one");

  franchiseCatalogLoader.clearCache();
  const bundled = await franchiseCatalogLoader.listPublished();
  assert.equal(bundled.source, "bundled");
  assert.deepEqual(
    bundled.catalogs.map((catalog) => catalog.slug),
    franchiseCatalogs.map((catalog) => catalog.slug),
  );
});

test("franchiseCatalogLoader returns empty remote list without bundled fallback", async () => {
  franchiseCatalogLoader.setQueryForTests(async () => []);

  const result = await franchiseCatalogLoader.listPublished();
  assert.equal(result.source, "remote");
  assert.deepEqual(result.catalogs, []);

  const missing = await franchiseCatalogLoader.getBySlug("star-wars");
  assert.equal(missing, null);
});

test("franchiseCatalogLoader getBySlug finds bundled catalogs after read failure", async () => {
  franchiseCatalogLoader.setQueryForTests(async () => {
    throw new Error("offline");
  });

  const found = await franchiseCatalogLoader.getBySlug("spider-man-holland");
  assert.ok(found);
  assert.equal(found.source, "bundled");
  assert.equal(found.catalog.slug, "spider-man-holland");
});

test("setCacheForTests helper stores warm snapshots", async () => {
  franchiseCatalogLoader.setQueryForTests(async () => {
    throw new Error("should not be called");
  });
  franchiseCatalogLoader.setCacheForTests([minimalCatalog("warm", "Warm")]);

  const result = await franchiseCatalogLoader.listPublished();
  assert.equal(result.source, "cache");
  assert.equal(result.catalogs[0]?.slug, "warm");
});
