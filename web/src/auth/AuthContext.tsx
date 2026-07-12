import {User, onAuthStateChanged, signOut} from "firebase/auth";
import {ReactNode, createContext, useContext, useEffect, useMemo, useState} from "react";
import {auth, firebaseConfigError} from "../firebase";

interface AuthContextValue {
  configError: string | null;
  getIdToken: () => Promise<string | null>;
  loading: boolean;
  signOutUser: () => Promise<void>;
  user: User | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const useE2eAuth = import.meta.env.MODE === "e2e" && import.meta.env.VITE_E2E_AUTH === "true";

const e2eAuthUser = useE2eAuth ? {
  email: "e2e-user@example.com",
  getIdToken: async () => "e2e-token",
  uid: "e2e-user",
} as User : null;

export const AuthProvider = ({children}: {children: ReactNode}) => {
  const [user, setUser] = useState<User | null>(e2eAuthUser);
  const [loading, setLoading] = useState(Boolean(auth) && !e2eAuthUser);

  useEffect(() => {
    if (e2eAuthUser) {
      return undefined;
    }

    if (!auth) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configError: firebaseConfigError,
      getIdToken: async () => user?.getIdToken() ?? null,
      loading,
      signOutUser: async () => {
        if (e2eAuthUser) {
          setUser(null);
          return;
        }

        if (auth) {
          await signOut(auth);
        }
      },
      user,
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
};
