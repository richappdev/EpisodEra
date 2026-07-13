import {FormEvent, useState} from "react";
import {Link} from "react-router-dom";
import {Globe2, ListChecks, ShieldAlert, Trash2} from "lucide-react";
import {legalCopy} from "../types/legal";
import {SupportedLanguage, languageLabels, supportedLanguages, uiCopy} from "../types/settings";
import {paths} from "../routes/paths";

interface SettingsPageProps {
  accountDeletionError: string | null;
  accountDeleting: boolean;
  autoMarkPreviousEpisodesWatched: boolean;
  error: string | null;
  language: SupportedLanguage;
  loading: boolean;
  signedIn: boolean;
  onAutoMarkPreviousEpisodesWatchedChange: (enabled: boolean) => void;
  onDeleteAccount: () => Promise<void>;
  onLanguageChange: (language: SupportedLanguage) => void;
}

export const SettingsPage = ({
  accountDeletionError,
  accountDeleting,
  autoMarkPreviousEpisodesWatched,
  error,
  language,
  loading,
  signedIn,
  onAutoMarkPreviousEpisodesWatchedChange,
  onDeleteAccount,
  onLanguageChange,
}: SettingsPageProps) => {
  const copy = uiCopy[language].settings;
  const legal = legalCopy[language].settings;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  const closeDeleteDialog = () => {
    if (accountDeleting) {
      return;
    }

    setDeleteDialogOpen(false);
    setDeleteConfirmation("");
  };

  const submitDeleteAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (deleteConfirmation !== "DELETE") {
      return;
    }

    try {
      await onDeleteAccount();
      closeDeleteDialog();
    } catch {
      // Keep the dialog open so the user can retry or cancel.
    }
  };

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
              disabled={loading || accountDeleting}
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
              disabled={loading || accountDeleting}
              onChange={(event) => onAutoMarkPreviousEpisodesWatchedChange(event.target.checked)}
            />
            <span>{copy.autoMarkPreviousLabel}</span>
          </label>
          <p className="settings-note">{copy.autoMarkPreviousNote}</p>
        </section>

        <section className="settings-group" aria-labelledby="privacy-settings-title">
          <div className="settings-group-heading">
            <ShieldAlert size={20} aria-hidden="true" />
            <h3 id="privacy-settings-title">{legal.privacyTitle}</h3>
          </div>
          <p className="settings-note">{legal.privacyDescription}</p>
          <Link className="text-button settings-inline-link" to={paths.privacy}>
            {legal.privacyLink}
          </Link>
        </section>

        <section className="settings-group settings-danger-zone" aria-labelledby="account-settings-title">
          <h3 id="account-settings-title">{legal.accountTitle}</h3>
          <p className="settings-note">{legal.accountDescription}</p>
          {signedIn ? (
            <button
              className="danger-button"
              data-testid="delete-account-button"
              disabled={accountDeleting}
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
              {legal.deleteAccount}
            </button>
          ) : (
            <div className="state-panel">{legal.signInRequired}</div>
          )}
        </section>

        {!signedIn && <div className="state-panel">{copy.signedOutNote}</div>}
        {loading && <div className="state-panel">{copy.saving}</div>}
        {error && <div className="state-panel error">{error}</div>}
        {accountDeleting && <div className="state-panel">{legal.deletingAccount}</div>}
        {accountDeletionError && <div className="state-panel error">{accountDeletionError}</div>}
      </section>

      {deleteDialogOpen && (
        <div className="dialog-backdrop" role="presentation" onClick={closeDeleteDialog}>
          <div
            aria-labelledby="delete-account-dialog-title"
            aria-modal="true"
            className="confirm-dialog"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="delete-account-dialog-title">{legal.deleteDialogTitle}</h3>
            <p>{legal.deleteDialogWarning}</p>
            <form className="confirm-dialog-form" onSubmit={submitDeleteAccount}>
              <label className="settings-field">
                {legal.deleteConfirmLabel}
                <input
                  autoComplete="off"
                  data-testid="delete-account-confirmation"
                  disabled={accountDeleting}
                  placeholder={legal.deleteConfirmPlaceholder}
                  type="text"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                />
              </label>
              {accountDeletionError && <div className="state-panel error">{accountDeletionError}</div>}
              <div className="confirm-dialog-actions">
                <button className="text-button" disabled={accountDeleting} type="button" onClick={closeDeleteDialog}>
                  {legal.deleteCancelButton}
                </button>
                <button
                  className="danger-button"
                  data-testid="confirm-delete-account"
                  disabled={accountDeleting || deleteConfirmation !== "DELETE"}
                  type="submit"
                >
                  {legal.deleteConfirmButton}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
