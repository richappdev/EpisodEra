import {FirebaseApp, FirebaseOptions, initializeApp} from "firebase/app";
import {Analytics, getAnalytics, isSupported as isAnalyticsSupported, logEvent, setUserId} from "firebase/analytics";
import {connectAuthEmulator, getAuth} from "firebase/auth";
import {FirebasePerformance, getPerformance} from "firebase/performance";

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

let connectedAuthEmulator = false;

export const auth = app ? getAuth(app) : null;

if (auth && useFirebaseEmulators && !connectedAuthEmulator) {
  connectAuthEmulator(auth, authEmulatorHost, {disableWarnings: true});
  connectedAuthEmulator = true;
}

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
