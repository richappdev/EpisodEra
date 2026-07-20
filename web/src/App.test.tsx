import {type ReactNode} from "react";
import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {App} from "./App";
import {useAuth} from "./auth/AuthContext";
import {useSiteAccessBlocked} from "./hooks/useSiteAccessBlocked";

vi.mock("./hooks/useSiteAccessBlocked", () => ({
  useSiteAccessBlocked: vi.fn(),
}));

vi.mock("./auth/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./AppContext", () => ({
  AppProvider: ({children}: {children: ReactNode}) => children,
  useAppContext: () => ({language: "en-US"}),
}));

vi.mock("./routes/AppRoutes", () => ({
  AppRoutes: () => <div data-testid="app-routes">App routes</div>,
}));

vi.mock("./components/TopBar", () => ({
  TopBar: () => <header data-testid="top-bar">Top bar</header>,
}));

describe("App site-access gate", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({loading: false, user: null} as ReturnType<typeof useAuth>);
  });

  it("shows only the blocked page for deep links when access is blocked", () => {
    vi.mocked(useSiteAccessBlocked).mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", {name: "This website is under optimization"})).toBeInTheDocument();
    expect(screen.queryByTestId("top-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-routes")).not.toBeInTheDocument();
    expect(screen.queryByText("Loading account...")).not.toBeInTheDocument();
  });

  it("renders the normal shell when access is open", () => {
    vi.mocked(useSiteAccessBlocked).mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("top-bar")).toBeInTheDocument();
    expect(screen.getByTestId("app-routes")).toBeInTheDocument();
    expect(screen.queryByRole("heading", {name: "This website is under optimization"})).not.toBeInTheDocument();
  });
});
