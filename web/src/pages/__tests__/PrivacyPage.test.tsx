import {render, screen} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {describe, expect, it} from "vitest";
import {PrivacyPage} from "../PrivacyPage";

describe("PrivacyPage", () => {
  it("renders privacy copy and a link back to settings", () => {
    render(
      <MemoryRouter>
        <PrivacyPage language="en-US" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", {level: 2, name: "Privacy Policy"})).toBeInTheDocument();
    expect(screen.getByRole("link", {name: "Back to settings"})).toHaveAttribute("href", "/settings");
  });
});
