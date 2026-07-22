import {render} from "@testing-library/react";
import {describe, expect, it, vi} from "vitest";
import {useDocumentPageTitle} from "../useDocumentPageTitle";

vi.mock("../../lib/documentSeo", () => ({
  applyBrandedDocumentTitle: vi.fn(),
}));

import {applyBrandedDocumentTitle} from "../../lib/documentSeo";

const Harness = ({label}: {label: string | null}) => {
  useDocumentPageTitle(label);
  return null;
};

describe("useDocumentPageTitle", () => {
  it("applies a branded title when a label is provided", () => {
    render(<Harness label="Daily puzzle" />);
    expect(applyBrandedDocumentTitle).toHaveBeenCalledWith("Daily puzzle");
  });

  it("skips empty labels", () => {
    vi.mocked(applyBrandedDocumentTitle).mockClear();
    render(<Harness label={null} />);
    expect(applyBrandedDocumentTitle).not.toHaveBeenCalled();
  });
});
