import {Link} from "react-router-dom";
import {Shield} from "lucide-react";
import {legalCopy, supportEmail} from "../types/legal";
import {SupportedLanguage} from "../types/settings";
import {paths} from "../routes/paths";

interface PrivacyPageProps {
  language: SupportedLanguage;
}

export const PrivacyPage = ({language}: PrivacyPageProps) => {
  const copy = legalCopy[language].privacy;

  return (
    <main className="page-shell legal-page">
      <section className="legal-panel">
        <div className="legal-header">
          <Shield size={22} aria-hidden="true" />
          <div>
            <span className="media-kind">{copy.eyebrow}</span>
            <h2>{copy.title}</h2>
            <p className="legal-updated">{copy.updated}</p>
          </div>
        </div>

        {copy.sections.map((section) => (
          <section className="legal-section" key={section.title}>
            <h3>{section.title}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}

        <p className="legal-contact">
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>

        <Link className="text-button" to={paths.settings}>
          {language === "zh-TW" ? "返回設定" : "Back to settings"}
        </Link>
      </section>
    </main>
  );
};
