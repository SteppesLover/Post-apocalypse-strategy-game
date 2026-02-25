import React, { useState } from "react";

const API = import.meta.env.VITE_API_BASE || "http://localhost:3000";

export default function Login({ t, onAuthed }) {
  const [mode, setMode] = useState("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      password1: form.get("password1"),
    };
    try {
      const url =
        mode === "login" ? `${API}/sessions/logon` : `${API}/sessions/register`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Auth failed");
      const me =
        data.user ||
        (await fetch(`${API}/me`, {
          credentials: "include",
        }).then((r) => (r.ok ? r.json() : null)));
      if (me?.email) onAuthed({ ...me, token: data?.token || "" });
      else throw new Error("No user returned");
    } catch (e) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="tabs">
        <button
          className={mode === "login" ? "tab active" : "tab"}
          onClick={() => setMode("login")}
        >
          {t.login}
        </button>
        <button
          className={mode === "register" ? "tab active" : "tab"}
          onClick={() => setMode("register")}
        >
          {t.register}
        </button>
      </div>
      <form className="card" onSubmit={handleSubmit}>
        <h2>{mode === "login" ? t.login : t.register}</h2>
        <label>
          {t.name}
          <input name="name" required={mode === "register"} />
        </label>
        <label>
          {t.email}
          <input name="email" type="email" required />
        </label>
        <label>
          {t.password}
          <input name="password" type="password" required />
        </label>
        {mode === "register" && (
          <label>
            {t.repeatPass}
            <input name="password1" type="password" required />
          </label>
        )}
        {error && <div className="flash error">{error}</div>}
        <button type="submit" disabled={pending}>
          {pending ? "..." : mode === "login" ? t.submitLogin : t.submitRegister}
        </button>
      </form>
    </>
  );
}
