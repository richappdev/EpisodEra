import {initializeApp} from "firebase-admin/app";
import {onRequest} from "firebase-functions/v2/https";
import {app} from "./api/app";

initializeApp();

export const api = onRequest(
  {
    region: "us-central1",
    secrets: ["TMDB_API_KEY"],
    timeoutSeconds: 60,
  },
  app,
);
