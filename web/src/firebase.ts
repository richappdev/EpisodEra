import {FirebaseApp, FirebaseOptions, initializeApp} from "firebase/app";
import {Analytics, getAnalytics, isSupported as isAnalyticsSupported, logEvent, setUserId} from "firebase/analytics";
import {AppCheck, getToken, initializeAppCheck, ReCaptchaV3Provider} from "firebase/app-check";
import {connectAuthEmulator, getAuth} from "firebase/auth";
import {FirebasePerformance, getPerformance} from "firebase/performance";
import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
  type RemoteConfig,
} from "firebase/remote-config";
import {
  DORMANT_AFTER_DAYS,
  DORMANT_AFTER_DAYS_REMOTE_KEY,
  resolveDormantAfterDays,
} from "./lib/continuation";

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string | undefined,
};

const requiredConfigKeys = ["apiKey", "authDomain", "projectId", "appId"] as const;
const missingKeys = requiredConfigKeys.filter((key) => !firebaseConfig[key]);

export const firebaseConfigError = missingKeys.length
  ? `Missing Firebase config: ${missingKeys.join(", ")}`
  : null;

const app: FirebaseApp | null = firebaseConfigError ? null : initializeApp(firebaseConfig);

const useFirebaseEmulators = import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";
const authEmulatorHost = (import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST as string | undefined)
  ?? "http://127.0.0.1:9099";
const appCheckSiteKey = (import.meta.env.VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY as string | undefined)?.trim();
const appCheckDebugToken = (import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN as string | undefined)?.trim();

let connectedAuthEmulator = false;
let appCheck: AppCheck | null = null;

export const auth = app ? getAuth(app) : null;

if (auth && useFirebaseEmulators && !connectedAuthEmulator) {
  connectAuthEmulator(auth, authEmulatorHost, {disableWarnings: true});
  connectedAuthEmulator = true;
}

if (app && appCheckSiteKey) {
  if (useFirebaseEmulators && appCheckDebugToken) {
    (globalThis as typeof globalThis & {FIREBASE_APPCHECK_DEBUG_TOKEN?: string}).FIREBASE_APPCHECK_DEBUG_TOKEN =
      appCheckDebugToken;
  }

  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const getAppCheckToken = async (): Promise<string | null> => {
  if (!appCheck) {
    return null;
  }

  try {
    const result = await getToken(appCheck, false);
    return result.token;
  } catch {
    return null;
  }
};

let analyticsPromise: Promise<Analytics | null> | null = null;
let performancePromise: Promise<FirebasePerformance | null> | null = null;

export const initializeAnalytics = () => {
  if (!app || !firebaseConfig.measurementId) {
    return Promise.resolve(null);
  }

  analyticsPromise ??= isAnalyticsSupported().then((supported) => (supported ? getAnalytics(app) : null));
  return analyticsPromise;
};

export const initializePerformance = () => {
  if (!app) {
    return Promise.resolve(null);
  }

  performancePromise ??= Promise.resolve(getPerformance(app));
  return performancePromise;
};

export const trackEvent = (eventName: string, eventParams?: Record<string, string | number | boolean | null>) => {
  void initializeAnalytics().then((analytics) => {
    if (analytics) {
      logEvent(analytics, eventName, eventParams);
    }
  });
};

export const setAnalyticsUserId = (userId: string | null) => {
  void initializeAnalytics().then((analytics) => {
    if (analytics) {
      setUserId(analytics, userId);
    }
  });
};

export const trackException = (description: string, fatal = false) => {
  trackEvent("exception", {
    description,
    fatal,
  });
};

let remoteConfigPromise: Promise<RemoteConfig | null> | null = null;

const readDormantAfterDaysFromConfig = (remoteConfig: RemoteConfig) =>
  resolveDormantAfterDays(getValue(remoteConfig, DORMANT_AFTER_DAYS_REMOTE_KEY).asNumber());

const ensureRemoteConfig = (): Promise<RemoteConfig | null> => {
  if (!app) {
    return Promise.resolve(null);
  }

  remoteConfigPromise ??= (async () => {
    const remoteConfig = getRemoteConfig(app);
    remoteConfig.settings.minimumFetchIntervalMillis = import.meta.env.DEV
      ? 60_000
      : 12 * 60 * 60 * 1000;
    remoteConfig.defaultConfig = {
      [DORMANT_AFTER_DAYS_REMOTE_KEY]: DORMANT_AFTER_DAYS,
    };

    try {
      await fetchAndActivate(remoteConfig);
    } catch {
      // Keep in-app defaults when fetch fails (offline / blocked).
    }

    return remoteConfig;
  })();

  return remoteConfigPromise;
};

/** Fetches Remote Config and returns a validated dormant-day threshold (falls back to local 14). */
export const initializeRemoteConfig = async (): Promise<number> => {
  const remoteConfig = await ensureRemoteConfig();
  if (!remoteConfig) {
    return DORMANT_AFTER_DAYS;
  }
  return readDormantAfterDaysFromConfig(remoteConfig);
};

/**
 * Subscribes to the dormant-after-days threshold from Remote Config.
 * Emits the local default immediately, then the fetched/activated value once available.
 * (Realtime `onConfigUpdate` requires a newer Firebase SDK than this project pins.)
 */
export const subscribeDormantAfterDays = (onChange: (days: number) => void): (() => void) => {
  let cancelled = false;

  onChange(DORMANT_AFTER_DAYS);

  void ensureRemoteConfig().then((remoteConfig) => {
    if (cancelled || !remoteConfig) {
      return;
    }

    onChange(readDormantAfterDaysFromConfig(remoteConfig));
  });

  return () => {
    cancelled = true;
  };
};
