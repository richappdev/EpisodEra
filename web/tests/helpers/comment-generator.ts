import type {SelectedMedia} from "./media-selection";

const banned = [
  "smoke test",
  "testing",
  "automated test",
  "qa",
  "playwright",
  "bot",
  "test account",
  "system check",
  "ci",
  "script",
  "production validation",
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const containsBannedLanguage = (value: string) => {
  const padded = ` ${normalize(value)} `;
  return banned.some((term) => padded.includes(` ${normalize(term)} `));
};

export const normalizedComment = normalize;

export const shouldAttemptComment = () => {
  if ((process.env.EPISODERA_ENABLE_COMMENTS ?? "false").toLowerCase() !== "true") {
    return false;
  }

  if ((process.env.EPISODERA_FORCE_COMMENT ?? "false").toLowerCase() === "true") {
    return true;
  }

  const probability = Number(process.env.EPISODERA_COMMENT_PROBABILITY ?? "0.20");
  return Math.random() < Math.min(Math.max(probability, 0), 1);
};

const choose = <T,>(items: T[], seed: string) => {
  const score = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return items[score % items.length];
};

export const buildComment = (media: SelectedMedia, context?: {episodeTitle?: string; alreadyWatching?: boolean}) => {
  const genre = media.genres[0] ?? (media.mediaType === "tv" ? "series" : "movie");
  const typeLabel = media.mediaType === "tv" ? "series" : "movie";
  const title = media.title;
  const overviewHint = media.overview
    .split(/[.!?]/)[0]
    ?.trim()
    .split(/\s+/)
    .slice(0, 12)
    .join(" ");

  const candidates = [
    `The ${genre.toLowerCase()} angle in ${title} makes this ${typeLabel} feel like something I would settle into on a quiet evening.`,
    `${title} caught my attention because the premise sounds character-focused without giving too much away.`,
    `I like the mood suggested by ${title}; the setup feels specific enough to make me curious about where it goes next.`,
    overviewHint
      ? `The premise around "${overviewHint}" makes ${title} sound like a thoughtful pick for my watchlist.`
      : `${title} has the kind of premise that makes me want to give it a real chance.`,
    context?.episodeTitle
      ? `${context.episodeTitle} made this watch feel more personal; I am curious to see how ${title} builds from here.`
      : `The premise makes ${title} feel worth saving, especially when I am in the mood for ${genre.toLowerCase()}.`,
  ];

  const comment = choose(candidates, `${title}-${new Date().toISOString().slice(0, 10)}`);
  const wordCount = comment.split(/\s+/).length;
  if (wordCount < 12 || wordCount > 45) {
    throw new Error(`Generated comment length was outside policy: ${wordCount} words.`);
  }
  if (containsBannedLanguage(comment)) {
    throw new Error("Generated comment contained banned automation language.");
  }

  return comment;
};
