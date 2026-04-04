"use client";

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

function Chevron({ open }) {
  return (
    <svg
      width={14} height={14} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{
        flexShrink: 0, color: T.textFaint,
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform .2s",
        pointerEvents: "none",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      color: T.textFaint, fontSize: 10, fontWeight: 700,
      letterSpacing: "0.08em", textTransform: "uppercase",
      marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

// Three-level topic row:
//   Level 1 (isOpen=false):            header only
//   Level 2 (isOpen=true, isDeep=false): summary + stats + "הצג עומק" button
//   Level 3 (isOpen=true, isDeep=true):  + discussion points + key reactions + top post link
function TopicRow({ topic, index, isOpen, isDeep, onToggle, onToggleDeep }) {
  const hasDiscussion = Array.isArray(topic.discussion_points) && topic.discussion_points.length > 0;
  const hasReactions  = Array.isArray(topic.key_reactions)    && topic.key_reactions.length > 0;
  const topPostUrl    = topic.top_post_url && topic.top_post_url !== "null" ? topic.top_post_url : null;

  return (
    <div style={{ borderBottom: `1px solid ${T.border}` }}>
      {/* ── Level 1: header (always visible) ── */}
      <div
        onClick={onToggle}
        style={{
          padding: "12px 20px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10,
          background: isOpen ? T.card + "80" : "transparent",
          transition: "background .15s",
          userSelect: "none",
        }}
      >
        <span style={{
          background: T.accent + "33", color: T.accentHi,
          borderRadius: "50%", width: 22, height: 22, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800, pointerEvents: "none",
        }}>
          {index + 1}
        </span>
        <span style={{
          color: T.text, fontSize: 13, fontWeight: 700,
          flex: 1, minWidth: 0, pointerEvents: "none",
        }}>
          {topic.title}
        </span>
        {topic.source_channel && (
          <span style={{
            background: T.muted + "22", color: T.textDim,
            border: `1px solid ${T.muted}44`,
            borderRadius: 5, padding: "1px 7px",
            fontSize: 11, fontFamily: "monospace", fontWeight: 600,
            pointerEvents: "none", flexShrink: 0,
          }}>
            @{topic.source_channel}
          </span>
        )}
        <TrendBadge trend={topic.trend} />
        <Chevron open={isOpen} />
      </div>

      {/* ── Level 2: summary + stats ── */}
      {isOpen && (
        <div style={{ padding: "14px 20px 16px 52px", background: T.card + "40" }}>
          {/* Summary */}
          {topic.summary && (
            <>
              <SectionLabel>סיכום</SectionLabel>
              <p style={{ color: T.textDim, fontSize: 13, lineHeight: 1.65, marginBottom: 14 }}>
                {topic.summary}
              </p>
            </>
          )}

          {/* Stats row */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 14 }}>
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

          {/* "הצג עומק" toggle button — always shown at level 2 */}
          <button
              onClick={(e) => { e.stopPropagation(); onToggleDeep(); }}
              style={{
                background: isDeep ? T.card : T.accent + "22",
                border: `1px solid ${isDeep ? T.border : T.accentHi + "55"}`,
                color: isDeep ? T.textDim : T.accentHi,
                borderRadius: 7, padding: "5px 12px",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                transition: "all .15s",
              }}
            >
              {isDeep ? "▲ הסתר עומק" : "▼ הצג עומק"}
          </button>

          {/* ── Level 3: deep analysis ── */}
          {isDeep && (
            <div style={{
              marginTop: 16,
              borderTop: `1px solid ${T.border}`,
              paddingTop: 16,
              display: "flex", flexDirection: "column", gap: 16,
            }}>
              {/* Source channel */}
              {topic.source_channel && (
                <div>
                  <SectionLabel>ערוץ מקור</SectionLabel>
                  <span style={{
                    background: T.muted + "22", color: T.textDim,
                    border: `1px solid ${T.muted}44`,
                    borderRadius: 5, padding: "2px 9px",
                    fontSize: 12, fontFamily: "monospace", fontWeight: 600,
                  }}>
                    @{topic.source_channel}
                  </span>
                </div>
              )}

              {/* Fallback for old reports without deep data */}
              {!hasDiscussion && !hasReactions && !topPostUrl && (
                <div style={{
                  color: T.textFaint, fontSize: 12, fontStyle: "italic",
                  padding: "8px 12px",
                  background: T.card, borderRadius: 8,
                  border: `1px solid ${T.border}`,
                }}>
                  הרץ דוח חדש כדי לראות ניתוח מעמיק
                </div>
              )}

              {/* Discussion points */}
              {hasDiscussion && (
                <div>
                  <SectionLabel>נקודות דיון מרכזיות</SectionLabel>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {topic.discussion_points.map((pt, i) => (
                      <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: T.accentHi, fontSize: 12, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>•</span>
                        <span style={{ color: T.textDim, fontSize: 13, lineHeight: 1.6 }}>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Key reactions */}
              {hasReactions && (
                <div>
                  <SectionLabel>תגובות בולטות</SectionLabel>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                    {topic.key_reactions.map((r, i) => (
                      <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                        <span style={{ color: T.gold, fontSize: 12, fontWeight: 700, marginTop: 1, flexShrink: 0 }}>◆</span>
                        <span style={{ color: T.textDim, fontSize: 13, lineHeight: 1.6 }}>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Top post link */}
              {topPostUrl && (
                <div>
                  <SectionLabel>פוסט מוביל</SectionLabel>
                  <a
                    href={topPostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
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
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportCard({ report, isOpen, onToggle, openTopics, onToggleTopic, deepTopics, onToggleDeep }) {
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
      <div
        onClick={onToggle}
        style={{
          padding: "16px 20px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, background: isOpen ? T.card + "50" : "transparent",
          transition: "background .15s",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: T.text, fontSize: 14, fontWeight: 700 }}>{dateLabel}</div>
              {createdLabel && (
                <div style={{ color: T.textFaint, fontSize: 11, marginTop: 2 }}>נוצר: {createdLabel}</div>
              )}
            </div>
            <span style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: "3px 9px", color: T.textDim, fontSize: 12, fontWeight: 600,
              pointerEvents: "none",
            }}>
              {report.total_posts ?? "—"} פוסטים
            </span>
            <span style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: "3px 9px", color: T.textFaint, fontSize: 12,
              pointerEvents: "none",
            }}>
              {topics.length} נושאים
            </span>
          </div>
          {report.source && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {report.source.split(",").map(ch => ch.trim()).filter(Boolean).map(ch => (
                <span key={ch} style={{
                  background: T.accentHi + "14", color: T.accentHi,
                  border: `1px solid ${T.accentHi}30`,
                  borderRadius: 5, padding: "1px 7px",
                  fontSize: 11, fontFamily: "monospace", fontWeight: 600,
                  pointerEvents: "none",
                }}>
                  @{ch}
                </span>
              ))}
            </div>
          )}
        </div>
        <Chevron open={isOpen} />
      </div>

      {isOpen && (
        <div style={{ borderTop: `1px solid ${T.border}` }}>
          {topics.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: T.textDim, fontSize: 13 }}>
              אין נושאים בדוח זה.
            </div>
          ) : (
            topics.map((topic, i) => {
              const key = `${report.id}-${i}`;
              return (
                <TopicRow
                  key={i}
                  topic={topic}
                  index={i}
                  isOpen={openTopics.has(key)}
                  isDeep={deepTopics.has(key)}
                  onToggle={() => onToggleTopic(key)}
                  onToggleDeep={() => onToggleDeep(key)}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

async function generateReportForChannels(channels, apiKey) {
  const channelList = channels
    .map(ch => `- ${ch.name} (@${ch.username}, קטגוריה: ${ch.category || "כללי"})`)
    .join("\n");

  const prompt = `אתה מנתח קהילות Data/BI/AI/ML ישראליות בטלגרם.
עליך לנתח ולסכם את התוכן האחרון מהערוצים הבאים:
${channelList}

בהתבסס על הנושאים הנפוצים בקהילות אלה, זהה את 5 הנושאים החמים ביותר.
החזר JSON תקין בלבד — מערך של בדיוק 5 אובייקטים. ללא טקסט לפני או אחרי.
כל אובייקט חייב לכלול בדיוק את השדות הבאים:
{
  "title": "כותרת הנושא בעברית",
  "summary": "סיכום קצר של 1-2 משפטים",
  "posts_count": <מספר שלם>,
  "trend": "עולה" | "יורד" | "יציב",
  "source_channel": "שם המשתמש (username) של הערוץ שממנו מגיעים הכי הרבה פוסטים בנושא זה (לדוגמה: MDLI1)",
  "top_post_url": "https://t.me/channel/123 או null",
  "weekly_posts_count": <מספר שלם>,
  "avg_views": <מספר שלם>,
  "discussion_points": ["נקודת דיון ספציפית 1", "נקודת דיון ספציפית 2", "נקודת דיון ספציפית 3"],
  "key_reactions": ["תגובה/סנטימנט מרכזי 1", "תגובה/סנטימנט מרכזי 2"]
}`;

  const resp = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("תגובה לא תקינה מ-Claude");

  const raw = text.replace(/```json\n?|```/g, "").trim();
  return JSON.parse(raw);
}

export default function ReportsScreen({ runTrigger = 0 }) {
  const [reports,     setReports]    = useState([]);
  const [channels,    setChannels]   = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState("");
  const [toast,       setToast]      = useState("");
  const [openReports, setOpenReports] = useState(new Set());
  const [openTopics,  setOpenTopics]  = useState(new Set());
  const [deepTopics,  setDeepTopics]  = useState(new Set());
  const [running,     setRunning]    = useState(new Set());
  const [runningAll,  setRunningAll] = useState(false);

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { if (runTrigger > 0) fetchAll({ runAfter: true }); }, [runTrigger]);

  const showToast = (msg, ms = 3000) => {
    setToast(msg);
    setTimeout(() => setToast(""), ms);
  };

  const fetchAll = async ({ runAfter = false } = {}) => {
    setLoading(true);
    setError("");
    const [{ data: rData, error: rErr }, { data: cData, error: cErr }] = await Promise.all([
      supabase.from("digest_reports").select("*").order("created_at", { ascending: false }),
      supabase.from("telegram_channels").select("*").eq("is_active", true).order("name"),
    ]);
    if (rErr) setError(`שגיאה בטעינת דוחות: ${rErr.message}`);
    if (cErr) setError(`שגיאה בטעינת ערוצים: ${cErr.message}`);
    setReports(rData || []);
    const loadedChannels = cData || [];
    setChannels(loadedChannels);
    setLoading(false);
    if (runAfter && loadedChannels.length > 0) {
      runReport(loadedChannels);
    }
  };

  const toggleReport = (id) => {
    setOpenReports(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Toggling a topic closed also resets its deep state
  const toggleTopic = (key) => {
    setOpenTopics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        setDeepTopics(d => { const nd = new Set(d); nd.delete(key); return nd; });
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleDeep = (key) => {
    setDeepTopics(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const runReport = async (channelsToRun) => {
    const apiKey = typeof window !== "undefined" ? localStorage.getItem("digest_claude_key") : null;
    if (!apiKey) {
      setError("מפתח Claude API חסר. הגדר אותו בהגדרות.");
      return;
    }

    const ids = channelsToRun.map(ch => ch.id);
    setRunning(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });

    try {
      const topics = await generateReportForChannels(channelsToRun, apiKey);
      const sourceNames = channelsToRun.map(ch => ch.username).join(", ");
      const { error: insertErr } = await supabase.from("digest_reports").insert({
        report_date: new Date().toISOString().split("T")[0],
        source: sourceNames,
        total_posts: topics.reduce((sum, t) => sum + (t.posts_count || 0), 0),
        topics: JSON.stringify(topics),
      });
      if (insertErr) throw new Error(insertErr.message);
      showToast(`✅ דוח נוצר בהצלחה עבור: ${sourceNames}`);
      await fetchAll();
    } catch (err) {
      setError(`שגיאה ביצירת דוח: ${err.message}`);
    } finally {
      setRunning(prev => { const next = new Set(prev); ids.forEach(id => next.delete(id)); return next; });
    }
  };

  const runSingleChannel = (ch) => runReport([ch]);

  const runAllChannels = async () => {
    if (channels.length === 0) return;
    setRunningAll(true);
    await runReport(channels);
    setRunningAll(false);
  };

  return (
    <div style={{ direction: "rtl" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "#14532d", border: `1px solid ${T.green}`,
          color: "#fff", borderRadius: 10, padding: "10px 20px",
          fontSize: 14, fontWeight: 600, zIndex: 2000,
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>📊 דוחות</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!loading && (
            <span style={{ color: T.textFaint, fontSize: 13 }}>{reports.length} דוחות</span>
          )}
          <button
            onClick={runAllChannels}
            disabled={runningAll || channels.length === 0}
            style={{
              background: runningAll ? T.muted : T.green,
              border: "none", color: "#fff",
              borderRadius: 8, padding: "8px 16px",
              cursor: (runningAll || channels.length === 0) ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 700,
              opacity: (runningAll || channels.length === 0) ? 0.6 : 1,
              transition: "opacity .2s",
            }}
          >
            {runningAll ? "מריץ..." : "▶ הרץ את כל הדוחות"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: "#7f1d1d44", border: `1px solid ${T.red}66`,
          borderRadius: 8, padding: "10px 14px", marginBottom: 16,
          color: "#fca5a5", fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError("")}
            style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: 14, padding: 0 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Active channels */}
      {!loading && channels.length > 0 && (
        <div style={{
          background: T.panel, border: `1px solid ${T.border}`,
          borderRadius: 14, overflow: "hidden", marginBottom: 24,
        }}>
          <div style={{
            padding: "10px 16px", background: T.card,
            borderBottom: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ color: T.textFaint, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>
              ערוצים פעילים
            </span>
            <span style={{
              background: T.green + "22", color: T.green, border: `1px solid ${T.green}44`,
              borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700,
            }}>
              {channels.length}
            </span>
          </div>
          {channels.map((ch, i) => {
            const isRunning = running.has(ch.id) || runningAll;
            return (
              <div key={ch.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 16px", gap: 12,
                background: i % 2 === 0 ? T.panel : T.card + "80",
                borderBottom: i < channels.length - 1 ? `1px solid ${T.border}` : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                  <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{ch.name}</span>
                  <span style={{ color: T.accentHi, fontSize: 12, fontFamily: "monospace", direction: "ltr" }}>
                    @{ch.username}
                  </span>
                  {ch.category && (
                    <span style={{
                      background: T.card, border: `1px solid ${T.border}`,
                      borderRadius: 6, padding: "1px 7px", color: T.textDim, fontSize: 11,
                    }}>
                      {ch.category}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => runSingleChannel(ch)}
                  disabled={isRunning}
                  style={{
                    background: isRunning ? T.muted : T.accent,
                    border: "none", color: "#fff",
                    borderRadius: 7, padding: "5px 12px",
                    cursor: isRunning ? "not-allowed" : "pointer",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                    opacity: isRunning ? 0.6 : 1, transition: "opacity .2s",
                  }}
                >
                  {isRunning ? "מריץ..." : "הרץ דוח"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{
          background: T.panel, border: `1px solid ${T.border}`,
          borderRadius: 14, padding: 48, textAlign: "center", color: T.textDim, fontSize: 14,
        }}>
          טוען דוחות...
        </div>
      )}

      {/* Empty state */}
      {!loading && reports.length === 0 && (
        <div style={{
          background: T.panel, border: `1px solid ${T.border}`,
          borderRadius: 14, padding: 60, textAlign: "center",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginBottom: 8 }}>אין דוחות עדיין</div>
          <div style={{ color: T.textDim, fontSize: 13 }}>הרץ דוח כדי ליצור את הדוח הראשון.</div>
        </div>
      )}

      {/* Reports list */}
      {!loading && reports.map(report => (
        <ReportCard
          key={report.id}
          report={report}
          isOpen={openReports.has(report.id)}
          onToggle={() => toggleReport(report.id)}
          openTopics={openTopics}
          onToggleTopic={toggleTopic}
          deepTopics={deepTopics}
          onToggleDeep={toggleDeep}
        />
      ))}
    </div>
  );
}
