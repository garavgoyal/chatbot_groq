import { useState } from "react";
import { useNavigate } from "react-router-dom";
import SignalMark from "../components/SignalMark";
import "../styles/LoginPage.css";

const API_BASE = "http://localhost:8000";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Could not create account");
      }

      localStorage.setItem("token", data.token);
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
          Start a conversation
          <br />
          that keeps up.
        </h1>
        <div className="signal-graphic" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-form-wrap">
          <h2>Create account</h2>
          <p className="auth-subtitle">Takes about a minute.</p>

          <form onSubmit={handleSubmit}>
            <label className="auth-label" htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              placeholder="Jamie Rivera"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

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
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="signin-btn" disabled={loading}>
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>

          <p className="signup-text">
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
