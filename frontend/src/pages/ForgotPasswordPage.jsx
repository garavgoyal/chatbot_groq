import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase, supabaseConfigured } from "../supabaseClient";
import "../styles/LoginPage.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!supabaseConfigured) {
      setError("Password reset isn't configured yet.");
      return;
    }
    setLoading(true);

    // Supabase emails the user a link back to /reset-password with a
    // recovery token in the URL. We don't touch the token ourselves —
    // ResetPasswordPage + supabase-js handle that automatically.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🤖</div>
        <h1>Reset Password</h1>
        <p className="login-subtitle">
          {sent
            ? "Check your inbox for a reset link."
            : "Enter your email and we'll send you a reset link."}
        </p>

        {!sent && (
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="signin-btn" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link →"}
            </button>
          </form>
        )}

        <p className="signup-text">
          <Link to="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
