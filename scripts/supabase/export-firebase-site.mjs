/**
 * Export Firebase Auth + Firestore user trees into a portable site dump.
 *
 * Output layout:
 *   docs/supabase/evidence/site-export-<timestamp>/
 *     manifest.json
 *     auth-users.json
 *     franchises.json          (optional catalog)
 *     users/<uid>.json        (profile, settings, watchlist, likes, progress+episodes, history, friends)
 *
 * Usage:
 *   node scripts/supabase/export-firebase-site.mjs
 *   node scripts/supabase/export-firebase-site.mjs --uid <UID>
 *   node scripts/supabase/export-firebase-site.mjs --limit 10 --out docs/supabase/evidence/my-dump
 *
 * Restore later with:
 *   node scripts/supabase/import-supabase-site.mjs --from <dump-dir>
 */
import {createRequire} from "node:module";
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {serializeDoc} from "./lib/firestoreSerialize.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(repoRoot, "functions", "package.json"));
const {initializeApp, getApps} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");

const uidFilter = process.argv.includes("--uid")
  ? process.argv[process.argv.indexOf("--uid") + 1]
  : null;
const limit = process.argv.includes("--limit")
  ? Number(process.argv[process.argv.indexOf("--limit") + 1])
  : null;
const outArg = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : null;
const skipAuth = process.argv.includes("--skip-auth");
const skipCatalogs = process.argv.includes("--skip-catalogs");

if (!getApps().length) {
  initializeApp({
    projectId:
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT ||
      "episodera",
  });
}

const db = getFirestore();
const auth = getAuth();

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.resolve(
  repoRoot,
  outArg ?? path.join("docs/supabase/evidence", `site-export-${stamp}`),
);
const usersDir = path.join(outDir, "users");

async function exportAuthUsers() {
  const users = [];
  let nextPageToken;
  do {
    const page = await auth.listUsers(1000, nextPageToken);
    for (const user of page.users) {
      users.push({
        uid: user.uid,
        email: user.email ?? null,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        displayName: user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        providerData: user.providerData.map((p) => ({
          providerId: p.providerId,
          uid: p.uid,
        })),
        customClaims: user.customClaims ?? null,
        createdAt: user.metadata.creationTime ?? null,
        lastSignInAt: user.metadata.lastSignInTime ?? null,
      });
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);
  return users;
}

async function listUserIds() {
  if (uidFilter) {
    return [uidFilter];
  }
  const ids = [];
  const query = db.collection("users").orderBy("__name__").limit(200);
  let last = null;
  while (true) {
    const page = last ? await query.startAfter(last).get() : await query.get();
    if (page.empty) {
      break;
    }
    ids.push(...page.docs.map((d) => d.id));
    last = page.docs[page.docs.length - 1];
    if (limit != null && ids.length >= limit) {
      return ids.slice(0, limit);
    }
    if (page.size < 200) {
      break;
    }
  }
  return ids;
}

async function exportCollection(ref) {
  const snap = await ref.get();
  return snap.docs.map((doc) => serializeDoc(doc.id, doc.data()));
}

async function exportUser(uid) {
  const userRef = db.collection("users").doc(uid);
  const profileSnap = await userRef.get();
  const [settingsSnap, watchlist, likes, history, friends, progressSnap] = await Promise.all([
    userRef.collection("settings").doc("profile").get(),
    exportCollection(userRef.collection("watchlist")),
    exportCollection(userRef.collection("likes")),
    exportCollection(userRef.collection("history")),
    exportCollection(userRef.collection("friends")),
    userRef.collection("progress").get(),
  ]);

  const progress = [];
  for (const showDoc of progressSnap.docs) {
    const episodes = await exportCollection(showDoc.ref.collection("episodes"));
    progress.push({
      ...serializeDoc(showDoc.id, showDoc.data()),
      episodes,
    });
  }

  return {
    uid,
    profile: profileSnap.exists ? serializeDoc(profileSnap.id, profileSnap.data()) : null,
    settings: settingsSnap.exists ? serializeDoc(settingsSnap.id, settingsSnap.data()) : null,
    watchlist,
    likes,
    history,
    friends,
    progress,
  };
}

await mkdir(usersDir, {recursive: true});

const authUsers = skipAuth ? [] : await exportAuthUsers();
if (!skipAuth) {
  await writeFile(
    path.join(outDir, "auth-users.json"),
    `${JSON.stringify({exportedAt: new Date().toISOString(), users: authUsers}, null, 2)}\n`,
  );
}

let franchises = [];
if (!skipCatalogs) {
  franchises = await exportCollection(db.collection("franchises"));
  await writeFile(
    path.join(outDir, "franchises.json"),
    `${JSON.stringify({exportedAt: new Date().toISOString(), items: franchises}, null, 2)}\n`,
  );
}

const userIds = await listUserIds();
const userSummaries = [];
for (const uid of userIds) {
  const dump = await exportUser(uid);
  await writeFile(path.join(usersDir, `${uid}.json`), `${JSON.stringify(dump, null, 2)}\n`);
  userSummaries.push({
    uid,
    hasProfile: Boolean(dump.profile),
    watchlist: dump.watchlist.length,
    likes: dump.likes.length,
    history: dump.history.length,
    friends: dump.friends.length,
    progressShows: dump.progress.length,
    progressEpisodes: dump.progress.reduce((n, s) => n + (s.episodes?.length ?? 0), 0),
  });
  console.log(
    `exported ${uid} watchlist=${dump.watchlist.length} likes=${dump.likes.length} history=${dump.history.length} progress=${dump.progress.length}`,
  );
}

const manifest = {
  format: "episodera-firebase-site-export",
  version: 1,
  exportedAt: new Date().toISOString(),
  firebaseProjectId:
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT ||
    "episodera",
  counts: {
    authUsers: authUsers.length,
    users: userSummaries.length,
    franchises: franchises.length,
    watchlist: userSummaries.reduce((n, u) => n + u.watchlist, 0),
    likes: userSummaries.reduce((n, u) => n + u.likes, 0),
    history: userSummaries.reduce((n, u) => n + u.history, 0),
    friends: userSummaries.reduce((n, u) => n + u.friends, 0),
    progressShows: userSummaries.reduce((n, u) => n + u.progressShows, 0),
    progressEpisodes: userSummaries.reduce((n, u) => n + u.progressEpisodes, 0),
  },
  users: userSummaries,
  files: {
    authUsers: skipAuth ? null : "auth-users.json",
    franchises: skipCatalogs ? null : "franchises.json",
    usersDir: "users/",
  },
  restore: {
    command: `node scripts/supabase/import-supabase-site.mjs --from ${path.relative(repoRoot, outDir).replace(/\\/g, "/")}`,
    requires: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "supabase migrations applied"],
  },
};

await writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ok: true, outDir, counts: manifest.counts}, null, 2));
