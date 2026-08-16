import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup } from "../api/auth";
import { supabase, supabaseConfigured } from "../supabaseClient";
import "../styles/LoginPage.css";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  // Google OAuth creates the account automatically if it doesn't exist yet,
  // so "sign up with Google" and "sign in with Google" are the same call.
  const handleGoogleSignIn = async () => {
    setError("");
    if (!supabaseConfigured) {
      setError("Google sign-in isn't configured yet.");
      return;
    }
    setGoogleLoading(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await signup(email, password);

      // The backend returns access_token/refresh_token (matching /api/auth/login),
      // not `token` — signup used to store nothing and silently bounce back to
      // login on the next page load. access_token is only present once Supabase
      // has an active session (e.g. no email-confirmation step required).
      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
        navigate("/chat");
      } else {
        navigate("/login");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🤖</div>
        <h1>Sign Up</h1>
        <p className="login-subtitle">Create your AI Assistant account</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="signin-btn" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up →"}
          </button>
        </form>

        <div className="divider">
          <span>OR</span>
        </div>

        <button className="google-btn" type="button" onClick={handleGoogleSignIn} disabled={googleLoading}>
          {googleLoading ? "Redirecting..." : "Sign up with Google"}
        </button>

        <p className="signup-text">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </div>
    </div>
  );
}