import {useAppContext} from "../AppContext";
import {siteBlockedCopy} from "../types/siteBlocked";

/** Full-site block screen shown when Remote Config `site_access_blocked` is true. */
export const SiteBlockedPage = () => {
  const {language} = useAppContext();
  const copy = siteBlockedCopy[language];

  return (
    <main className="page-shell">
      <div className="state-panel" role="status">
        <p className="media-kind">{copy.brand}</p>
        <h1>{copy.title}</h1>
        <p>{copy.support}</p>
      </div>
    </main>
  );
};
