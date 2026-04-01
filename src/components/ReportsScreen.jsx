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

const TREND = {
  "עולה":  { color: T.green,   bg: T.green  + "22", label: "↑ עולה"  },
  "יורד":  { color: T.red,     bg: T.red    + "22", label: "↓ יורד"  },
  "יציב":  { color: T.muted,   bg: T.muted  + "22", label: "→ יציב"  },
};

function TrendBadge({ trend }) {
  const t = TREND[trend] || { color: T.muted, bg: T.muted + "22", label: trend || "—" };
  return (
    <span style={{
      background: t.bg, color: t.color,
      border: `1px solid ${t.color}44`,
      borderRadius: 6, padding: "2px 8px",
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {t.label}
    </span>
  );
}

function ReportCard({ report }) {
  const [open, setOpen] = useState(false);

  // topics may come back as a parsed array (JSONB) or as a JSON string
  let topics = report.topics;
  if (typeof topics === "string") {
    try { topics = JSON.parse(topics); } catch { topics = []; }
  }
  if (!Array.isArray(topics)) topics = [];

  const dateLabel = report.report_date
    ? new Date(report.report_date).toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const createdLabel = report.created_at
    ? new Date(report.created_at).toLocaleString("he-IL")
    : "";

  return (
    <div style={{
      background: T.panel, border: `1px solid ${T.border}`,
      borderRadius: 14, overflow: "hidden", marginBottom: 14,
    }}>
      {/* Card header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          padding: "16px 20px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {/* Date */}
          <div>
            <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{dateLabel}</div>
            {createdLabel && (
              <div style={{ color: T.textFaint, fontSize: 11, marginTop: 2 }}>נוצר: {createdLabel}</div>
            )}
          </div>

          {/* Source */}
          <span style={{
            background: T.accentHi + "18", color: T.accentHi,
            border: `1px solid ${T.accentHi}33`,
            borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600,
          }}>
            📡 {report.source || "—"}
          </span>

          {/* Total posts */}
          <span style={{ color: T.textDim, fontSize: 12 }}>
            {report.total_posts ?? "—"} פוסטים
          </span>

          {/* Topic count */}
          <span style={{ color: T.textFaint, fontSize: 12 }}>
            {topics.length} נושאים
          </span>
        </div>

        {/* Expand arrow */}
        <div style={{
          color: T.textFaint, fontSize: 16, flexShrink: 0,
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform .2s",
        }}>
          ▾
        </div>
      </div>

      {/* Topics list */}
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          {topics.length === 0 && (
            <div style={{ padding: "20px", color: T.textDim, fontSize: 13, textAlign: "center" }}>
              אין נושאים בדוח זה.
            </div>
          )}
          {topics.map((topic, i) => (
            <div key={i} style={{
              padding: "14px 20px",
              borderBottom: i < topics.length - 1 ? `1px solid ${T.border}` : "none",
              background: i % 2 === 0 ? "transparent" : T.card + "60",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                {/* Topic number */}
                <span style={{
                  background: T.accent + "33", color: T.accentHi,
                  borderRadius: "50%", width: 22, height: 22, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, marginTop: 1,
                }}>
                  {i + 1}
                </span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ color: T.text, fontSize: 13, fontWeight: 700 }}>{topic.title}</span>
                    <TrendBadge trend={topic.trend} />
                    {topic.posts_count != null && (
                      <span style={{ color: T.textFaint, fontSize: 11 }}>
                        {topic.posts_count} פוסטים
                      </span>
                    )}
                  </div>

                  {/* Summary */}
                  {topic.summary && (
                    <div style={{ color: T.textDim, fontSize: 13, lineHeight: 1.6 }}>
                      {topic.summary}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportsScreen() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => { fetchReports(); }, []);

  const fetchReports = async () => {
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("digest_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) { setError(`שגיאה בטעינת דוחות: ${err.message}`); setLoading(false); return; }
    setReports(data || []);
    setLoading(false);
  };

  return (
    <div style={{ direction: "rtl" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>📊 דוחות</h3>
        {!loading && (
          <span style={{ color: T.textFaint, fontSize: 13 }}>{reports.length} דוחות</span>
        )}
      </div>

      {error && (
        <div style={{
          background: "#7f1d1d44", border: `1px solid ${T.red}66`,
          borderRadius: 8, padding: "10px 14px", marginBottom: 16,
          color: "#fca5a5", fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div style={{
          background: T.panel, border: `1px solid ${T.border}`,
          borderRadius: 14, padding: 48, textAlign: "center", color: T.textDim,
        }}>
          טוען דוחות...
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div style={{
          background: T.panel, border: `1px solid ${T.border}`,
          borderRadius: 14, padding: 60, textAlign: "center",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginBottom: 8 }}>אין דוחות עדיין</div>
          <div style={{ color: T.textDim, fontSize: 13 }}>הרץ את הסקרייפר כדי ליצור את הדוח הראשון.</div>
        </div>
      )}

      {!loading && reports.map(report => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}
