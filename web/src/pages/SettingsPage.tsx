import {Globe2} from "lucide-react";
import {SupportedLanguage, languageLabels, supportedLanguages, uiCopy} from "../types/settings";

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

        <label className="settings-field">
          {copy.fieldLabel}
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

        <p className="settings-note">{copy.note}</p>

        {!signedIn && <div className="state-panel">{copy.signedOutNote}</div>}
        {loading && <div className="state-panel">{copy.saving}</div>}
        {error && <div className="state-panel error">{error}</div>}
      </section>
    </main>
  );
};
