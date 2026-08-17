import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SignalMark from "../components/SignalMark";
import "../styles/LoginPage.css";

const API_BASE = "http://localhost:8000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.detail || data.message || "Invalid email or password",
        );
      }
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      navigate("/chat");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-eyebrow">
          <SignalMark />
          <span>AI Assistant</span>
        </div>
        <h1 className="auth-headline">
          Pick up right
          <br />
          where you left off.
        </h1>
        <div className="signal-graphic" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-form-wrap">
          <h2>Sign in</h2>
          <p className="auth-subtitle">Welcome back.</p>

          <form onSubmit={handleSubmit}>
            <label className="auth-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="auth-label" htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <a href="/forgot-password" className="forgot-link">
              Forgot password?
            </a>

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="signin-btn" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="divider">
            <span>or</span>
          </div>

          <button className="google-btn" type="button">
            Continue with Google
          </button>

          <p className="signup-text">
            Don't have an account? <a href="/signup">Sign up</a>
          </p>
        </div>
      </div>
    </div>
  );
}
