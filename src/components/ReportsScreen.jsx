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
  "עולה": { color: T.green, bg: T.green + "22", label: "↑ עולה" },
  "יורד": { color: T.red,   bg: T.red   + "22", label: "↓ יורד" },
  "יציב": { color: T.muted, bg: T.muted + "22", label: "→ יציב" },
};

function TrendBadge({ trend }) {
  const t = TREND[trend] || { color: T.muted, bg: T.muted + "22", label: trend || "—" };
  return (
    <span style={{
      background: t.bg, color: t.color, border: `1px solid ${t.color}44`,
      borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {t.label}
    </span>
  );
}

// Chevron that rotates when open
function Chevron({ open }) {
  return (
    <svg
      width={14} height={14} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{
        flexShrink: 0, color: T.textFaint,
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform .2s",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function TopicRow({ topic, index }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      borderBottom: `1px solid ${T.border}`,
    }}>
      {/* Topic header — always visible */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          padding: "12px 20px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10,
          background: open ? T.card + "80" : "transparent",
          transition: "background .15s",
        }}
      >
        {/* Number bubble */}
        <span style={{
          background: T.accent + "33", color: T.accentHi,
          borderRadius: "50%", width: 22, height: 22, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800,
        }}>
          {index + 1}
        </span>

        {/* Title + trend */}
        <span style={{ color: T.text, fontSize: 13, fontWeight: 700, flex: 1, minWidth: 0 }}>
          {topic.title}
        </span>
        <TrendBadge trend={topic.trend} />
        <Chevron open={open} />
      </div>

      {/* Expanded topic details */}
      {open && (
        <div style={{ padding: "12px 20px 16px 52px", background: T.card + "40" }}>
          {/* Summary */}
          {topic.summary && (
            <p style={{ color: T.textDim, fontSize: 13, lineHeight: 1.65, marginBottom: 12 }}>
              {topic.summary}
            </p>
          )}

          {/* Stats row */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: topic.top_post_url ? 12 : 0 }}>
            {topic.posts_count != null && (
              <div>
                <div style={{ color: T.textFaint, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 2 }}>
                  פוסטים בנושא
                </div>
                <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{topic.posts_count}</div>
              </div>
            )}
            {topic.weekly_posts_count != null && (
              <div>
                <div style={{ color: T.textFaint, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 2 }}>
                  השבוע
                </div>
                <div style={{ color: T.green, fontSize: 14, fontWeight: 700 }}>{topic.weekly_posts_count}</div>
              </div>
            )}
            {topic.avg_views != null && (
              <div>
                <div style={{ color: T.textFaint, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", marginBottom: 2 }}>
                  ממוצע צפיות
                </div>
                <div style={{ color: T.gold, fontSize: 14, fontWeight: 700 }}>
                  {Number(topic.avg_views).toLocaleString("he-IL")}
                </div>
              </div>
            )}
          </div>

          {/* Top post link */}
          {topic.top_post_url && (
            <a
              href={topic.top_post_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                color: T.accentHi, fontSize: 12, fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              פתח פוסט מוביל
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report }) {
  const [open, setOpen] = useState(false);

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
      {/* Collapsed header */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          padding: "16px 20px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, background: open ? T.card + "50" : "transparent",
          transition: "background .15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
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

          {/* total_posts */}
          <span style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 6, padding: "3px 9px", color: T.textDim, fontSize: 12, fontWeight: 600,
          }}>
            {report.total_posts ?? "—"} פוסטים
          </span>

          {/* topics count */}
          <span style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 6, padding: "3px 9px", color: T.textFaint, fontSize: 12,
          }}>
            {topics.length} נושאים
          </span>
        </div>

        <Chevron open={open} />
      </div>

      {/* Topics list */}
      {open && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          {topics.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: T.textDim, fontSize: 13 }}>
              אין נושאים בדוח זה.
            </div>
          ) : (
            topics.map((topic, i) => (
              <TopicRow key={i} topic={topic} index={i} />
            ))
          )}
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
          borderRadius: 14, padding: 48, textAlign: "center", color: T.textDim, fontSize: 14,
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
