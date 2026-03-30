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

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: "16px 20px", flex: 1, minWidth: 140,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || T.accentHi }}>{value}</div>
      <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function LogsScreen() {
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");

  useEffect(() => { fetchLogs(); }, [statusFilter, dateFrom, dateTo]);

  const fetchLogs = async () => {
    setLoading(true);
    setError("");
    let query = supabase
      .from("run_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(200);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (dateFrom) query = query.gte("started_at", dateFrom);
    if (dateTo)   query = query.lte("started_at", dateTo + "T23:59:59");

    const { data, error: err } = await query;
    if (err) { setError(`שגיאה בטעינת לוגים: ${err.message}`); setLoading(false); return; }
    setLogs(data || []);
    setLoading(false);
  };

  const totalRuns      = logs.length;
  const successRuns    = logs.filter(l => l.status === "success").length;
  const totalCost      = logs.reduce((s, l) => s + (l.cost_usd || 0), 0);
  const successPct     = totalRuns ? Math.round((successRuns / totalRuns) * 100) : 0;

  const inputStyle = {
    background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
    padding: "7px 11px", color: T.text, fontSize: 13, outline: "none",
  };

  return (
    <div style={{ direction: "rtl" }}>
      <h3 style={{ color: T.text, fontSize: 16, fontWeight: 700, marginBottom: 20 }}>📋 לוג ריצות</h3>

      {/* Totals */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="סה״כ ריצות"   value={totalRuns}             color={T.accentHi} />
        <StatCard label="עלות כוללת"    value={`$${totalCost.toFixed(4)}`} color={T.gold}  />
        <StatCard label="אחוז הצלחה"    value={`${successPct}%`}      color={T.green}    />
        <StatCard label="ריצות ב-24 שעות" value={logs.filter(l => {
          if (!l.started_at) return false;
          return new Date(l.started_at) > new Date(Date.now() - 86400000);
        }).length} color={T.accentHi} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} style={inputStyle}>
          <option value="all">כל הסטטוסים</option>
          <option value="success">הצלחה בלבד</option>
          <option value="error">שגיאות בלבד</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ ...inputStyle, direction: "ltr" }} placeholder="מתאריך" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ ...inputStyle, direction: "ltr" }} placeholder="עד תאריך" />
        {(statusFilter !== "all" || dateFrom || dateTo) && (
          <button onClick={() => { setStatus("all"); setDateFrom(""); setDateTo(""); }}
            style={{ background: "none", border: `1px solid ${T.border}`, color: T.textDim, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>
            נקה פילטרים
          </button>
        )}
      </div>

      {error && (
        <div style={{ background: "#7f1d1d44", border: `1px solid ${T.red}66`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#fca5a5", fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1.4fr 80px 90px 90px 90px 1.4fr",
          padding: "10px 16px", background: T.card,
          borderBottom: `1px solid ${T.border}`,
        }}>
          {["תאריך/שעה", "משתמש", "סטטוס", "מקורות", "טוקנים", "עלות", "שגיאה"].map(h => (
            <div key={h} style={{ color: T.textFaint, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>{h}</div>
          ))}
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: T.textDim }}>טוען...</div>
        )}
        {!loading && logs.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: T.textDim }}>אין נתונים לתצוגה</div>
        )}
        {!loading && logs.map((log, i) => (
          <div key={log.id} style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1.4fr 80px 90px 90px 90px 1.4fr",
            padding: "11px 16px", alignItems: "center",
            background: i % 2 === 0 ? T.panel : T.card + "80",
            borderBottom: `1px solid ${T.border}`,
          }}>
            <div style={{ color: T.textDim, fontSize: 12 }}>
              {log.started_at ? new Date(log.started_at).toLocaleString("he-IL") : "—"}
            </div>
            <div style={{ color: T.text, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {log.user_email || "—"}
            </div>
            <div style={{ fontSize: 14 }}>
              {log.status === "success" ? "✅" : log.status === "error" ? "❌" : "⏳"}
            </div>
            <div style={{ color: T.textDim, fontSize: 12 }}>{log.sources_scanned ?? "—"}</div>
            <div style={{ color: T.textDim, fontSize: 12 }}>
              {log.total_tokens ? log.total_tokens.toLocaleString() : "—"}
            </div>
            <div style={{ color: T.gold, fontSize: 12 }}>
              {log.cost_usd != null ? `$${Number(log.cost_usd).toFixed(4)}` : "—"}
            </div>
            <div style={{ color: T.red, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={log.error_message || ""}>
              {log.error_message || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
