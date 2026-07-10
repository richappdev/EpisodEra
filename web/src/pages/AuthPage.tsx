import {FormEvent, useState} from "react";
import {createUserWithEmailAndPassword, signInWithEmailAndPassword} from "firebase/auth";
import {LogIn, UserPlus} from "lucide-react";
import {useAuth} from "../auth/AuthContext";
import {auth} from "../firebase";

type AuthMode = "signin" | "signup";

interface AuthPageProps {
  onDone: () => void;
}

export const AuthPage = ({onDone}: AuthPageProps) => {
  const {configError} = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!auth) {
      setError(configError ?? "Firebase Auth is not configured.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const isSignup = mode === "signup";

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div>
          <span className="media-kind">Account</span>
          <h2>{isSignup ? "Create your Episodera account" : "Sign in to Episodera"}</h2>
          <p>Use an account to unlock watchlist, progress tracking, and profile stats.</p>
        </div>

        {configError && <div className="state-panel error">{configError}</div>}

        <form className="auth-form" onSubmit={submit}>
          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error && <div className="state-panel error">{error}</div>}

          <button disabled={submitting || Boolean(configError)} type="submit">
            {isSignup ? <UserPlus size={18} aria-hidden="true" /> : <LogIn size={18} aria-hidden="true" />}
            {submitting ? "Working..." : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          className="text-button"
          type="button"
          onClick={() => {
            setMode(isSignup ? "signin" : "signup");
            setError(null);
          }}
        >
          {isSignup ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </section>
    </main>
  );
};
