import {useEffect, useState} from "react";
import {subscribeDormantAfterDays} from "../firebase";
import {DORMANT_AFTER_DAYS} from "../lib/continuation";

/** Live dormant threshold from Remote Config, falling back to {@link DORMANT_AFTER_DAYS}. */
export const useDormantAfterDays = (): number => {
  const [dormantAfterDays, setDormantAfterDays] = useState(DORMANT_AFTER_DAYS);

  useEffect(() => subscribeDormantAfterDays(setDormantAfterDays), []);

  return dormantAfterDays;
};
