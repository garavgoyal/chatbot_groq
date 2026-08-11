import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

const API_BASE = "http://localhost:8000";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("checking"); // checking | valid | invalid

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setStatus("invalid");
      return;
    }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Invalid session");
        setStatus("valid");
      })
      .catch(() => {
        localStorage.removeItem("token");
        setStatus("invalid");
      });
  }, []);

  if (status === "checking") return <p>Loading...</p>;
  if (status === "invalid") return <Navigate to="/login" replace />;

  return children;
}