import {useEffect} from "react";
import {applyBrandedDocumentTitle} from "../lib/documentSeo";

/** Sets the browser tab title to `{pageLabel} · Episodera` once content is known. */
export const useDocumentPageTitle = (pageLabel: string | null | undefined) => {
  useEffect(() => {
    if (!pageLabel) {
      return;
    }

    applyBrandedDocumentTitle(pageLabel);
  }, [pageLabel]);
};
