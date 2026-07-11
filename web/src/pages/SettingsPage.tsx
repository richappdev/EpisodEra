import {Globe2} from "lucide-react";
import {SupportedLanguage, languageLabels, supportedLanguages} from "../types/settings";

interface SettingsPageProps {
  error: string | null;
  language: SupportedLanguage;
  loading: boolean;
  signedIn: boolean;
  onLanguageChange: (language: SupportedLanguage) => void;
}

export const SettingsPage = ({
  error,
  language,
  loading,
  signedIn,
  onLanguageChange,
}: SettingsPageProps) => (
  <main className="page-shell">
    <section className="settings-panel">
      <div className="settings-header">
        <Globe2 size={22} aria-hidden="true" />
        <div>
          <span className="media-kind">Settings</span>
          <h2>Language</h2>
        </div>
      </div>

      <label className="settings-field">
        App language
        <select
          value={language}
          disabled={loading}
          onChange={(event) => onLanguageChange(event.target.value as SupportedLanguage)}
        >
          {supportedLanguages.map((supportedLanguage) => (
            <option key={supportedLanguage} value={supportedLanguage}>
              {languageLabels[supportedLanguage]} ({supportedLanguage})
            </option>
          ))}
        </select>
      </label>

      <p className="settings-note">
        Metadata is loaded from TMDb in the selected language where available. Unsupported locales fall back to English.
      </p>

      {!signedIn && (
        <div className="state-panel">Sign in to sync this preference across sessions. This device still uses it now.</div>
      )}
      {loading && <div className="state-panel">Saving language...</div>}
      {error && <div className="state-panel error">{error}</div>}
    </section>
  </main>
);
