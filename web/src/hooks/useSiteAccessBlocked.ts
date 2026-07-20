import {useEffect, useState} from "react";
import {SITE_ACCESS_BLOCKED_DEFAULT, subscribeSiteAccessBlocked} from "../firebase";

/** Live site-access gate from Remote Config; defaults to open ({@link SITE_ACCESS_BLOCKED_DEFAULT}). */
export const useSiteAccessBlocked = (): boolean => {
  const [blocked, setBlocked] = useState(SITE_ACCESS_BLOCKED_DEFAULT);

  useEffect(() => subscribeSiteAccessBlocked(setBlocked), []);

  return blocked;
};
