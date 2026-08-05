import {createContext, useContext, useMemo, type ReactNode} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import type {SupportedLanguage, UrlLocale} from "../types/settings";
import {
  localPreferredLanguage,
  localizePath,
  parseLocalizedPath,
  replaceLocationLanguage,
} from "./locale";
import {urlLocaleForLanguage} from "../types/settings";

interface LocaleContextValue {
  activeLanguage: SupportedLanguage;
  hasExplicitLocale: boolean;
  localize: (pathname: string) => string;
  navigateToLanguage: (language: SupportedLanguage) => void;
  urlLocale: UrlLocale;
}

const defaultLocaleContext: LocaleContextValue = {
  activeLanguage: "en-US",
  hasExplicitLocale: false,
  localize: (pathname) => localizePath(pathname, "en-us"),
  navigateToLanguage: () => undefined,
  urlLocale: "en-us",
};

const LocaleContext = createContext<LocaleContextValue>(defaultLocaleContext);

export const LocaleProvider = ({children}: {children: ReactNode}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const parsed = parseLocalizedPath(location.pathname);
  const fallbackLanguage = useMemo(localPreferredLanguage, []);
  const activeLanguage = parsed?.language ?? fallbackLanguage;
  const urlLocale = parsed?.urlLocale ?? urlLocaleForLanguage(fallbackLanguage);

  const value = useMemo<LocaleContextValue>(
    () => ({
      activeLanguage,
      hasExplicitLocale: Boolean(parsed),
      localize: (pathname) => localizePath(pathname, urlLocale),
      navigateToLanguage: (language) => {
        navigate(replaceLocationLanguage(location, language), {replace: true, state: location.state});
      },
      urlLocale,
    }),
    [activeLanguage, location, navigate, parsed, urlLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => {
  return useContext(LocaleContext);
};
