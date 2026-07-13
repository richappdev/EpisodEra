import {FormEvent, useEffect, useState} from "react";
import {useLocation, useNavigate} from "react-router-dom";
import {createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile} from "firebase/auth";
import {LogIn, UserPlus} from "lucide-react";
import {api} from "../api/client";
import {useAuth} from "../auth/AuthContext";
import {auth} from "../firebase";
import {paths} from "../routes/paths";
import {UserProfile} from "../types/profile";

type AuthMode = "signin" | "signup";

interface AuthPageProps {
  initialMode?: AuthMode;
  onDone: () => void;
  onProfileLoaded: (profile: UserProfile) => void;
}

export const AuthPage = ({initialMode = "signin", onDone, onProfileLoaded}: AuthPageProps) => {
  const {configError} = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

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
        const trimmedFirstName = firstName.trim();
        const trimmedLastName = lastName.trim();
        if (!trimmedFirstName || !trimmedLastName) {
          setError("First name and last name are required.");
          return;
        }

        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const displayName = `${trimmedFirstName} ${trimmedLastName}`;
        await updateProfile(credential.user, {displayName});
        const token = await credential.user.getIdToken();
        const profile = await api.updateMeProfile({
          firstName: trimmedFirstName,
          lastName: trimmedLastName,
          displayName,
        }, token);
        onProfileLoaded(profile);
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
          {isSignup && (
            <div className="auth-name-grid">
              <label>
                First name
                <input
                  autoComplete="given-name"
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  type="text"
                  value={firstName}
                />
              </label>
              <label>
                Last name
                <input
                  autoComplete="family-name"
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  type="text"
                  value={lastName}
                />
              </label>
            </div>
          )}
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
            navigate(isSignup ? paths.login : paths.signup, {replace: true, state: location.state});
            setError(null);
            setFirstName("");
            setLastName("");
          }}
        >
          {isSignup ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
      </section>
    </main>
  );
};
