/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_E2E_AUTH?: string;
  readonly VITE_USE_FIREBASE_EMULATORS?: string;
  readonly VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY?: string;
  readonly VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
