import {type ComponentProps, render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it, vi} from "vitest";
import {SettingsPage} from "../SettingsPage";

const renderSettings = (props: Partial<ComponentProps<typeof SettingsPage>> = {}) =>
  render(
    <MemoryRouter>
      <SettingsPage
        accountDeletionError={null}
        accountDeleting={false}
        autoMarkPreviousEpisodesWatched={false}
        error={null}
        language="en-US"
        loading={false}
        preferredProviderIds={[8]}
        signedIn
        watchRegion="US"
        onAutoMarkPreviousEpisodesWatchedChange={vi.fn()}
        onDeleteAccount={vi.fn().mockResolvedValue(undefined)}
        onLanguageChange={vi.fn()}
        onPreferredProviderIdsChange={vi.fn()}
        onWatchRegionChange={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );

describe("SettingsPage", () => {
  it("updates language and previous-episode preference", async () => {
    const user = userEvent.setup();
    const onLanguageChange = vi.fn();
    const onAutoMarkPreviousEpisodesWatchedChange = vi.fn();

    renderSettings({onAutoMarkPreviousEpisodesWatchedChange, onLanguageChange});

    await user.selectOptions(screen.getByLabelText("App language"), "zh-TW");
    expect(onLanguageChange).toHaveBeenCalledWith("zh-TW");

    await user.click(screen.getByLabelText("Automatically mark earlier episodes watched"));
    expect(onAutoMarkPreviousEpisodesWatchedChange).toHaveBeenCalledWith(true);
  });

  it("renders localized copy plus signed-out, loading, and error states", () => {
    renderSettings({
      autoMarkPreviousEpisodesWatched: true,
      error: "Could not save settings.",
      language: "zh-TW",
      loading: true,
      signedIn: false,
    });

    expect(screen.getByRole("heading", {name: "設定"})).toBeVisible();
    expect(screen.getByText("正在儲存設定...")).toBeVisible();
    expect(screen.getByText("Could not save settings.")).toBeVisible();
    expect(screen.getByText(/登入後可跨工作階段同步這些偏好/)).toBeVisible();
    expect(screen.getByLabelText("應用程式語言")).toBeDisabled();
    expect(screen.getByLabelText("自動將較早集數標記為已觀看")).toBeDisabled();
    expect(screen.getByText("請登入以管理帳戶刪除。")).toBeVisible();
    expect(screen.queryByTestId("delete-account-button")).not.toBeInTheDocument();
  });

  it("requires DELETE confirmation before calling onDeleteAccount", async () => {
    const user = userEvent.setup();
    const onDeleteAccount = vi.fn().mockResolvedValue(undefined);

    renderSettings({onDeleteAccount});

    await user.click(screen.getByTestId("delete-account-button"));
    const confirmButton = screen.getByTestId("confirm-delete-account");
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByTestId("delete-account-confirmation"), "DELETE");
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  });

  it("links to the privacy policy", () => {
    renderSettings();

    expect(screen.getByRole("link", {name: "View privacy policy"})).toHaveAttribute("href", "/privacy");
  });
});
