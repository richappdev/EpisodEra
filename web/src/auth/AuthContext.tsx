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

export const AuthProvider = ({children}: {children: ReactNode}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));

  useEffect(() => {
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
