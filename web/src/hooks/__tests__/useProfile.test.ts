import {act, renderHook, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {api} from "../../api/client";
import {now} from "../../test/fixtures";
import {UserProfile} from "../../types/profile";
import {useProfile} from "../useProfile";
import {mockUser} from "./helpers";

vi.mock("../../api/client", () => ({
  api: {
    meProfile: vi.fn(),
  },
}));

const profile: UserProfile = {
  firstName: "Casey",
  lastName: "Viewer",
  email: "casey@example.com",
  displayName: "Casey Viewer",
  photoURL: null,
  bio: null,
  country: null,
  timezone: null,
  createdAt: now,
  updatedAt: now,
};

describe("useProfile", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads profile data for a signed-in user", async () => {
    vi.mocked(api.meProfile).mockResolvedValue({profile});

    const {result} = renderHook(() => useProfile(mockUser));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.profile).toEqual(profile);
    expect(result.current.error).toBeNull();
  });

  it("resets when signed out and surfaces load errors", async () => {
    vi.mocked(api.meProfile).mockRejectedValue(new Error("Profile unavailable"));

    const {result, rerender} = renderHook(({user}) => useProfile(user), {
      initialProps: {user: mockUser},
    });

    await waitFor(() => expect(result.current.error).toBe("Profile unavailable"));

    rerender({user: null});

    expect(result.current.profile).toBeNull();
    expect(result.current.error).toBeNull();

    vi.mocked(api.meProfile).mockResolvedValue({profile});

    rerender({user: mockUser});

    await waitFor(() => expect(result.current.profile).toEqual(profile));

    await act(async () => {
      result.current.setProfile({...profile, displayName: "Updated Viewer"});
    });

    expect(result.current.profile?.displayName).toBe("Updated Viewer");
  });
});
