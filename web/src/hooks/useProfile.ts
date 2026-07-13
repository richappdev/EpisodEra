import {useCallback, useEffect, useState} from "react";
import type {User} from "firebase/auth";
import {api} from "../api/client";
import {UserProfile} from "../types/profile";
import {toErrorMessage} from "./errorMessage";

export const useProfile = (user: User | null) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setProfile(null);
    setLoading(false);
    setError(null);
  }, []);

  const reload = useCallback(async () => {
    if (!user) {
      reset();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.meProfile();
      setProfile(response.profile);
    } catch (reason) {
      setError(toErrorMessage(reason, "Could not load profile."));
    } finally {
      setLoading(false);
    }
  }, [reset, user]);

  useEffect(() => {
    if (!user) {
      reset();
      return;
    }

    void reload();
  }, [reload, reset, user]);

  return {
    profile,
    loading,
    error,
    reload,
    setProfile,
  };
};
