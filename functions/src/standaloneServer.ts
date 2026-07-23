/**
 * Standalone HTTP entry for Cloud Run / containers.
 * Uses the same Express `app` as Firebase `onRequest`.
 */
import {app} from "./api/app";

const port = Number(process.env.PORT ?? 8080);

app.listen(port, () => {
  console.log(`EpisodEra API listening on ${port}`);
});
