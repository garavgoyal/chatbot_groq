// Where the user is, for weather questions about "here".
//
// Two tiers, because the precise one isn't always available:
//   - Coordinates from navigator.geolocation. Exact, but needs a permission
//     grant AND a secure context — browsers disable the API entirely on plain
//     http://, which includes opening the dev server on a LAN IP from a phone.
//   - The IANA timezone ("Asia/Kolkata"). Coarse, but free, permission-less
//     and available everywhere, so the backend can at least fall back to a
//     nearby city instead of inventing one.

const CONSENT_KEY = "use_my_location";
const COORDS_KEY = "my_coords";
const COORDS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const geolocationAvailable =
  typeof navigator !== "undefined" && "geolocation" in navigator && window.isSecureContext;

export function locationConsentGiven() {
  return localStorage.getItem(CONSENT_KEY) === "true";
}

function readCoords() {
  try {
    const saved = JSON.parse(localStorage.getItem(COORDS_KEY) || "null");
    if (!saved || Date.now() - saved.savedAt > COORDS_MAX_AGE_MS) return null;
    return saved;
  } catch {
    return null; // corrupt entry — treat as "no coordinates"
  }
}

/** Ask the browser for coordinates and remember them. Resolves to true only
 *  if we actually got a fix, so the caller can report the real outcome. */
export function enableLocation() {
  if (!geolocationAvailable) return Promise.resolve(false);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        localStorage.setItem(CONSENT_KEY, "true");
        localStorage.setItem(
          COORDS_KEY,
          JSON.stringify({
            latitude: Number(coords.latitude.toFixed(3)),   // ~100m; street-level precision
            longitude: Number(coords.longitude.toFixed(3)), // isn't needed for weather
            savedAt: Date.now(),
          }),
        );
        resolve(true);
      },
      () => resolve(false),   // denied, unavailable, or timed out
      { timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

export function disableLocation() {
  localStorage.removeItem(CONSENT_KEY);
  localStorage.removeItem(COORDS_KEY);
}

/** The payload sent with each chat message. The timezone always goes, since
 *  it needs no permission; coordinates only once the user has opted in. */
export function currentLocation() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const coords = locationConsentGiven() ? readCoords() : null;

  return {
    timezone,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  };
}
