/** Browser-safe SHA-256 hex digest for import idempotency fingerprints. */
export const sha256Hex = async (input: ArrayBuffer | string): Promise<string> => {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};
