import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {describe, expect, it, vi} from "vitest";
import {SettingsPage} from "../SettingsPage";

describe("SettingsPage", () => {
  it("updates language and previous-episode preference", async () => {
    const user = userEvent.setup();
    const onLanguageChange = vi.fn();
    const onAutoMarkPreviousEpisodesWatchedChange = vi.fn();

    render(
      <SettingsPage
        autoMarkPreviousEpisodesWatched={false}
        error={null}
        language="en-US"
        loading={false}
        signedIn
        onAutoMarkPreviousEpisodesWatchedChange={onAutoMarkPreviousEpisodesWatchedChange}
        onLanguageChange={onLanguageChange}
      />,
    );

    await user.selectOptions(screen.getByLabelText("App language"), "zh-TW");
    expect(onLanguageChange).toHaveBeenCalledWith("zh-TW");

    await user.click(screen.getByLabelText("Automatically mark earlier episodes watched"));
    expect(onAutoMarkPreviousEpisodesWatchedChange).toHaveBeenCalledWith(true);
  });

  it("renders localized copy plus signed-out, loading, and error states", () => {
    render(
      <SettingsPage
        autoMarkPreviousEpisodesWatched
        error="Could not save settings."
        language="zh-TW"
        loading
        signedIn={false}
        onAutoMarkPreviousEpisodesWatchedChange={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", {name: "設定"})).toBeVisible();
    expect(screen.getByText("正在儲存設定...")).toBeVisible();
    expect(screen.getByText("Could not save settings.")).toBeVisible();
    expect(screen.getByText(/登入後可跨工作階段同步這些偏好/)).toBeVisible();
    expect(screen.getByLabelText("應用程式語言")).toBeDisabled();
    expect(screen.getByLabelText("自動將較早集數標記為已觀看")).toBeDisabled();
  });
});
