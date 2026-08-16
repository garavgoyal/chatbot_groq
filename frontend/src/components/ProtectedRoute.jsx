import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch } from "../api/client";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("checking"); // checking | valid | invalid

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setStatus("invalid");
      return;
    }

    apiFetch("/api/auth/me")
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