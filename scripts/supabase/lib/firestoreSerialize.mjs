/** Serialize Firestore values (Timestamp, GeoPoint-ish) into JSON-safe data. */

export function serializeFirestoreValue(value) {
  if (value == null) {
    return value;
  }
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => serializeFirestoreValue(entry));
  }
  if (typeof value === "object") {
    // Detect Firestore Timestamp-shaped plain objects after JSON roundtrip is N/A;
    // Admin SDK Timestamp has toDate.
    if (typeof value.latitude === "number" && typeof value.longitude === "number" && Object.keys(value).length <= 4) {
      return {latitude: value.latitude, longitude: value.longitude};
    }
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = serializeFirestoreValue(entry);
    }
    return out;
  }
  return value;
}

export function serializeDoc(id, data) {
  return {
    id,
    data: serializeFirestoreValue(data ?? {}),
  };
}
