import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {ExportDataPanel} from "../ExportDataPanel";
import {EXPORT_SCHEMA_VERSION} from "../../types/export";

const meExport = vi.fn();
const triggerBrowserDownload = vi.fn();

vi.mock("../../api/client", () => ({
  api: {
    meExport: (...args: unknown[]) => meExport(...args),
  },
}));

vi.mock("../../lib/exportZip", async () => {
  const actual = await vi.importActual<typeof import("../../lib/exportZip")>("../../lib/exportZip");
  return {
    ...actual,
    triggerBrowserDownload: (...args: unknown[]) => triggerBrowserDownload(...args),
  };
});

describe("ExportDataPanel", () => {
  beforeEach(() => {
    meExport.mockReset();
    triggerBrowserDownload.mockReset();
  });

  it("shows signed-out copy without a download button", () => {
    render(<ExportDataPanel language="en-US" signedIn={false} />);

    expect(screen.getByText(/Sign in to export/)).toBeVisible();
    expect(screen.queryByTestId("export-data-start")).not.toBeInTheDocument();
  });

  it("downloads a zip after a successful export", async () => {
    meExport.mockResolvedValue({
      manifest: {
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: "2026-07-17T12:00:00.000Z",
        userId: "user-1",
        counts: {
          history: 2,
          progressShows: 1,
          progressEpisodes: 3,
          watchlist: 4,
        },
      },
      history: [],
      progress: [],
      watchlist: [],
    });

    render(<ExportDataPanel language="en-US" signedIn />);

    fireEvent.click(screen.getByTestId("export-data-start"));

    await waitFor(() => {
      expect(meExport).toHaveBeenCalledTimes(1);
      expect(triggerBrowserDownload).toHaveBeenCalledTimes(1);
    });

    expect(triggerBrowserDownload.mock.calls[0]?.[1]).toBe("episodera-export-2026-07-17.zip");
    expect(screen.getByTestId("export-data-success")).toHaveTextContent(
      "Exported 2 history entries, 1 shows, and 4 watchlist items.",
    );
  });

  it("shows an error when export fails", async () => {
    meExport.mockRejectedValue(new Error("boom"));

    render(<ExportDataPanel language="en-US" signedIn />);

    fireEvent.click(screen.getByTestId("export-data-start"));

    await waitFor(() => {
      expect(screen.getByTestId("export-data-error")).toBeVisible();
    });

    expect(triggerBrowserDownload).not.toHaveBeenCalled();
  });
});
