import {Globe2, ListChecks} from "lucide-react";
import {SupportedLanguage, languageLabels, supportedLanguages, uiCopy} from "../types/settings";

interface SettingsPageProps {
  error: string | null;
  autoMarkPreviousEpisodesWatched: boolean;
  language: SupportedLanguage;
  loading: boolean;
  signedIn: boolean;
  onAutoMarkPreviousEpisodesWatchedChange: (enabled: boolean) => void;
  onLanguageChange: (language: SupportedLanguage) => void;
}

export const SettingsPage = ({
  error,
  autoMarkPreviousEpisodesWatched,
  language,
  loading,
  signedIn,
  onAutoMarkPreviousEpisodesWatchedChange,
  onLanguageChange,
}: SettingsPageProps) => {
  const copy = uiCopy[language].settings;

  return (
    <main className="page-shell">
      <section className="settings-panel">
        <div className="settings-header">
          <Globe2 size={22} aria-hidden="true" />
          <div>
            <span className="media-kind">{copy.eyebrow}</span>
            <h2>{copy.title}</h2>
          </div>
        </div>

        <section className="settings-group" aria-labelledby="language-settings-title">
          <h3 id="language-settings-title">{copy.languageTitle}</h3>
          <label className="settings-field">
            {copy.languageFieldLabel}
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
          <p className="settings-note">{copy.languageNote}</p>
        </section>

        <section className="settings-group" aria-labelledby="progress-settings-title">
          <div className="settings-group-heading">
            <ListChecks size={20} aria-hidden="true" />
            <h3 id="progress-settings-title">{copy.progressTitle}</h3>
          </div>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={autoMarkPreviousEpisodesWatched}
              disabled={loading}
              onChange={(event) => onAutoMarkPreviousEpisodesWatchedChange(event.target.checked)}
            />
            <span>{copy.autoMarkPreviousLabel}</span>
          </label>
          <p className="settings-note">{copy.autoMarkPreviousNote}</p>
        </section>

        {!signedIn && <div className="state-panel">{copy.signedOutNote}</div>}
        {loading && <div className="state-panel">{copy.saving}</div>}
        {error && <div className="state-panel error">{error}</div>}
      </section>
    </main>
  );
};
