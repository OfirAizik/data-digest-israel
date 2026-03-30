import { useState } from "react";
import { supabase } from "../../lib/supabase";

const T = {
  bg:       "#0a0f1a",
  panel:    "#111827",
  card:     "#1a2236",
  border:   "#1e2d45",
  accent:   "#2563eb",
  accentHi: "#3b82f6",
  text:     "#e2e8f0",
  textDim:  "#94a3b8",
  textFaint:"#4b5563",
  red:      "#ef4444",
};

export default function LoginScreen({ onLogin }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError("נא למלא אימייל וסיסמה"); return; }
    setLoading(true);
    setError("");

    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });

    if (authErr) {
      const map = {
        "Invalid login credentials": "אימייל או סיסמה שגויים",
        "Email not confirmed":        "האימייל לא אומת. בדוק את תיבת הדואר שלך",
        "Too many requests":          "יותר מדי ניסיונות. נסה שוב מאוחר יותר",
      };
      setError(map[authErr.message] || `שגיאת התחברות: ${authErr.message}`);
      setLoading(false);
      return;
    }

    onLogin(data.user, data.session);
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, display: "flex",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
      direction: "rtl",
    }}>
      <div style={{
        background: T.panel, border: `1px solid ${T.border}`,
        borderRadius: 18, padding: "40px 36px", width: 380, maxWidth: "94vw",
        boxShadow: "0 24px 80px rgba(0,0,0,.6)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: T.text, letterSpacing: "-0.5px" }}>
            📡 <span style={{ color: T.accentHi }}>Data</span>Digest<span style={{ color: T.accentHi }}>.</span>IL
          </div>
          <div style={{ fontSize: 12, color: T.textFaint, marginTop: 6, letterSpacing: "0.08em" }}>
            COMMUNITY MONITOR
          </div>
        </div>

        <h2 style={{ color: T.text, fontSize: 18, fontWeight: 700, margin: "0 0 24px", textAlign: "center" }}>
          התחברות למערכת
        </h2>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ color: T.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>כתובת אימייל</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              style={{
                width: "100%", boxSizing: "border-box",
                background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 9, padding: "11px 14px", color: T.text,
                fontSize: 14, outline: "none", direction: "ltr",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ color: T.textDim, fontSize: 12, display: "block", marginBottom: 6 }}>סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                width: "100%", boxSizing: "border-box",
                background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 9, padding: "11px 14px", color: T.text,
                fontSize: 14, outline: "none", direction: "ltr",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "#7f1d1d44", border: `1px solid ${T.red}66`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 18,
              color: "#fca5a5", fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              background: loading ? T.textFaint : `linear-gradient(135deg, ${T.accent}, ${T.accentHi})`,
              border: "none", color: "#fff", borderRadius: 10,
              padding: "12px 0", cursor: loading ? "not-allowed" : "pointer",
              fontSize: 15, fontWeight: 700,
              boxShadow: loading ? "none" : "0 4px 16px rgba(37,99,235,.4)",
              transition: "all .2s",
            }}
          >
            {loading ? "מתחבר..." : "התחבר"}
          </button>
        </form>
      </div>
    </div>
  );
}
