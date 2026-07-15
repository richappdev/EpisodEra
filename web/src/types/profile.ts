export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  bio: string | null;
  country: string | null;
  timezone: string | null;
  friendCode: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ProfileResponse {
  profile: UserProfile | null;
}

export type UpdateUserProfileInput = Partial<Pick<
  UserProfile,
  "firstName" | "lastName" | "displayName" | "photoURL" | "bio" | "country" | "timezone"
>>;
