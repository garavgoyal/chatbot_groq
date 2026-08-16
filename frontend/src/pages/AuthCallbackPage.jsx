import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, supabaseConfigured } from "../supabaseClient";
import "../styles/LoginPage.css";

// Landing page for the Google OAuth redirect. supabase-js reads the tokens
// out of the URL on load and turns them into a session automatically; we
// just wait for it, then store the tokens the same way normal login does
// so the rest of the app (which talks to the FastAPI backend, not Supabase
// directly) can't tell the difference.
export default function AuthCallbackPage() {
  const [error, setError] = useState(supabaseConfigured ? "" : "Google sign-in isn't configured yet.");
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabaseConfigured) return;

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError || !data.session) {
        setError(sessionError?.message || "Sign-in failed. Please try again.");
        return;
      }
      localStorage.setItem("token", data.session.access_token);
      localStorage.setItem("refresh_token", data.session.refresh_token);
      navigate("/chat");
    });
  }, []);

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🤖</div>
        <p className="login-subtitle">{error || "Signing you in..."}</p>
        {error && (
          <a href="/login" className="signup-text">
            Back to sign in
          </a>
        )}
      </div>
    </div>
  );
}
