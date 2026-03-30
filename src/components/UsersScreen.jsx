import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

const T = {
  bg:        "#0a0f1a",
  panel:     "#111827",
  card:      "#1a2236",
  border:    "#1e2d45",
  accent:    "#2563eb",
  accentHi:  "#3b82f6",
  gold:      "#f59e0b",
  green:     "#10b981",
  red:       "#ef4444",
  muted:     "#4b5563",
  text:      "#e2e8f0",
  textDim:   "#94a3b8",
  textFaint: "#4b5563",
};

const Toggle = ({ on, onChange }) => (
  <div onClick={() => onChange(!on)} style={{
    width: 36, height: 20, borderRadius: 10,
    background: on ? T.green : T.muted,
    position: "relative", cursor: "pointer",
    transition: "background .25s", flexShrink: 0,
  }}>
    <div style={{
      width: 14, height: 14, borderRadius: "50%", background: "#fff",
      position: "absolute", top: 3,
      left: on ? 19 : 3,
      transition: "left .25s",
    }}/>
  </div>
);

const PERM_COLS = [
  { key: "can_access_sources",  label: "מקורות" },
  { key: "can_access_settings", label: "הגדרות" },
  { key: "can_access_history",  label: "היסטוריה" },
  { key: "can_access_logs",     label: "לוגים" },
];

export default function UsersScreen() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(null);
  const [error, setError]       = useState("");
  const [toast, setToast]       = useState("");
  const [inviteEmail, setInvite]= useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("user_permissions")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) { setError(`שגיאה: ${err.message}`); setLoading(false); return; }
    setUsers(data || []);
    setLoading(false);
  };

  const updateUser = async (id, patch) => {
    setSaving(id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u));
    const { error: err } = await supabase.from("user_permissions").update(patch).eq("id", id);
    if (err) { setError(`שגיאת שמירה: ${err.message}`); fetchUsers(); }
    else showToast("✅ עודכן בהצלחה");
    setSaving(null);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    // Create a user_permissions row with the email (user_id will be linked when they sign up)
    const { error: err } = await supabase.from("user_permissions").insert({
      email: inviteEmail.trim(),
      role: "viewer",
      can_access_sources: true,
      can_access_settings: false,
      can_access_history: true,
      can_access_logs: false,
      daily_run_limit: 3,
    });
    if (err) setError(`שגיאת הזמנה: ${err.message}`);
    else { showToast(`✅ ${inviteEmail} נוסף למערכת`); setInvite(""); fetchUsers(); }
    setInviting(false);
  };

  return (
    <div style={{ direction: "rtl" }}>
      <h3 style={{ color: T.text, fontSize: 16, fontWeight: 700, marginBottom: 20 }}>👥 ניהול משתמשים</h3>

      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "#14532d", border: `1px solid ${T.green}`,
          color: "#fff", borderRadius: 10, padding: "10px 20px",
          fontSize: 14, fontWeight: 600, zIndex: 2000,
        }}>{toast}</div>
      )}

      {/* Invite */}
      <div style={{
        background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: "16px 20px", marginBottom: 20,
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
      }}>
        <span style={{ color: T.textDim, fontSize: 13, fontWeight: 600 }}>הזמן משתמש:</span>
        <input
          type="email"
          value={inviteEmail}
          onChange={e => setInvite(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleInvite()}
          placeholder="email@example.com"
          style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: "8px 12px", color: T.text, fontSize: 13, outline: "none",
            direction: "ltr", width: 240,
          }}
        />
        <button
          onClick={handleInvite}
          disabled={inviting || !inviteEmail.trim()}
          style={{
            background: T.accent, border: "none", color: "#fff",
            borderRadius: 8, padding: "8px 18px", cursor: "pointer",
            fontSize: 13, fontWeight: 700,
            opacity: (inviting || !inviteEmail.trim()) ? 0.5 : 1,
          }}
        >
          {inviting ? "מוסיף..." : "➕ הוסף"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#7f1d1d44", border: `1px solid ${T.red}66`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#fca5a5", fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.8fr 80px 90px 90px 90px 90px 80px",
          padding: "10px 16px", background: T.card,
          borderBottom: `1px solid ${T.border}`,
        }}>
          {["אימייל", "תפקיד", ...PERM_COLS.map(p => p.label), "מגבלה/יום"].map(h => (
            <div key={h} style={{ color: T.textFaint, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>{h}</div>
          ))}
        </div>

        {loading && <div style={{ padding: 40, textAlign: "center", color: T.textDim }}>טוען...</div>}

        {!loading && users.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: T.textDim }}>אין משתמשים. הזמן את הראשון.</div>
        )}

        {!loading && users.map((u, i) => (
          <div key={u.id} style={{
            display: "grid",
            gridTemplateColumns: "1.8fr 80px 90px 90px 90px 90px 80px",
            padding: "12px 16px", alignItems: "center",
            background: i % 2 === 0 ? T.panel : T.card + "80",
            borderBottom: `1px solid ${T.border}`,
            opacity: saving === u.id ? 0.6 : 1, transition: "opacity .2s",
          }}>
            {/* Email */}
            <div>
              <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{u.email}</div>
              {u.display_name && <div style={{ color: T.textFaint, fontSize: 11 }}>{u.display_name}</div>}
            </div>
            {/* Role */}
            <div>
              <select
                value={u.role || "viewer"}
                onChange={e => updateUser(u.id, { role: e.target.value })}
                style={{
                  background: T.card, border: `1px solid ${T.border}`, borderRadius: 6,
                  padding: "4px 8px", color: u.role === "admin" ? T.gold : T.textDim,
                  fontSize: 12, cursor: "pointer", outline: "none",
                }}
              >
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
              </select>
            </div>
            {/* Permission toggles */}
            {PERM_COLS.map(col => (
              <div key={col.key} style={{ display: "flex", alignItems: "center" }}>
                <Toggle
                  on={!!u[col.key]}
                  onChange={val => updateUser(u.id, { [col.key]: val })}
                />
              </div>
            ))}
            {/* Daily limit */}
            <div>
              <input
                type="number"
                min={0}
                max={50}
                value={u.daily_run_limit ?? 3}
                onChange={e => updateUser(u.id, { daily_run_limit: +e.target.value })}
                style={{
                  background: T.card, border: `1px solid ${T.border}`, borderRadius: 6,
                  padding: "4px 8px", color: T.text, fontSize: 13, outline: "none",
                  width: 56, textAlign: "center",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
