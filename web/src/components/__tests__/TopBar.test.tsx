import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {User} from "firebase/auth";
import {describe, expect, it, vi} from "vitest";
import {TopBar} from "../TopBar";

const user = {email: "viewer@example.com"} as User;

describe("TopBar", () => {
  it("renders signed-in state and dispatches navigation and sign-out", async () => {
    const userEventApi = userEvent.setup();
    const onViewChange = vi.fn();
    const onSignOut = vi.fn();

    render(
      <TopBar
        activeView="trending"
        language="en-US"
        user={user}
        onAuthOpen={vi.fn()}
        onSignOut={onSignOut}
        onViewChange={onViewChange}
      />,
    );

    expect(screen.getByText("viewer@example.com")).toBeVisible();
    await userEventApi.click(screen.getByTestId("nav-search"));
    expect(onViewChange).toHaveBeenCalledWith("search");

    await userEventApi.click(screen.getByTestId("account-button"));
    expect(onSignOut).toHaveBeenCalled();
  });

  it("renders signed-out auth entry and localized nav copy", async () => {
    const userEventApi = userEvent.setup();
    const onAuthOpen = vi.fn();

    render(
      <TopBar
        activeView="settings"
        language="zh-TW"
        user={null}
        onAuthOpen={onAuthOpen}
        onSignOut={vi.fn()}
        onViewChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("nav-search")).toHaveTextContent("搜尋");
    expect(screen.getByTestId("nav-settings")).toHaveClass("active");

    await userEventApi.click(screen.getByTestId("account-button"));
    expect(onAuthOpen).toHaveBeenCalled();
  });
});
