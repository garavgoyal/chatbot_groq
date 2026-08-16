import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseConfigured } from "../supabaseClient";
import "../styles/LoginPage.css";

export default function ResetPasswordPage() {
  // supabase-js reads the recovery token out of the URL on load and turns it
  // into a real (temporary) session automatically — we just wait for that.
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(supabaseConfigured ? "" : "Password reset isn't configured yet.");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabaseConfigured) return;

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });

    // Covers the case where the event already fired before this listener
    // was attached (e.g. fast page load).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError(updateError.message);
      return;
    }

    // Password is updated and this browser already holds a valid Supabase
    // session from the recovery link — reuse it as this app's auth token
    // (the backend accepts any valid Supabase-issued token, see require_auth).
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      localStorage.setItem("token", data.session.access_token);
      localStorage.setItem("refresh_token", data.session.refresh_token);
    }
    setLoading(false);
    navigate("/chat");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🤖</div>
        <h1>Set New Password</h1>
        <p className="login-subtitle">
          {ready ? "Choose a new password for your account." : "Verifying your reset link..."}
        </p>

        {!ready && error && <p className="login-error">{error}</p>}

        {ready && (
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && <p className="login-error">{error}</p>}

            <button type="submit" className="signin-btn" disabled={loading}>
              {loading ? "Saving..." : "Save Password →"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
