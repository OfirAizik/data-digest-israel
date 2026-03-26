"use client";

import { useState, useEffect, useCallback } from "react";

/* ─── palette & tokens ────────────────────────────────────── */
const T = {
  bg:       "#0a0f1a",
  panel:    "#111827",
  card:     "#1a2236",
  border:   "#1e2d45",
  accent:   "#2563eb",
  accentHi: "#3b82f6",
  gold:     "#f59e0b",
  green:    "#10b981",
  red:      "#ef4444",
  orange:   "#f97316",
  muted:    "#4b5563",
  text:     "#e2e8f0",
  textDim:  "#94a3b8",
  textFaint:"#4b5563",
};

const PLATFORM_META = {
  telegram:  { color: "#229ed9", icon: "✈️",  label: "טלגרם"    },
  facebook:  { color: "#1877f2", icon: "📘",  label: "פייסבוק"  },
  linkedin:  { color: "#0a66c2", icon: "💼",  label: "לינקדאין" },
  meetup:    { color: "#f64060", icon: "📅",  label: "Meetup"   },
  rss:       { color: "#f59e0b", icon: "📡",  label: "RSS"      },
  reddit:    { color: "#ff4500", icon: "🔴",  label: "Reddit"   },
  twitter:   { color: "#1da1f2", icon: "🐦",  label: "Twitter"  },
  youtube:   { color: "#ff0000", icon: "▶️",  label: "YouTube"  },
  discord:   { color: "#5865f2", icon: "🎮",  label: "Discord"  },
  custom:    { color: "#6366f1", icon: "🌐",  label: "מותאם"    },
};

const CATEGORY_META = {
  "ML/DL/AI":      { color: "#8b5cf6", emoji: "🤖" },
  "Data Science":  { color: "#06b6d4", emoji: "🔬" },
  "BI/Analytics":  { color: "#f59e0b", emoji: "📊" },
  "Data Eng":      { color: "#10b981", emoji: "⚙️" },
  "Cloud/Infra":   { color: "#3b82f6", emoji: "☁️" },
  "AI גנרטיבי":   { color: "#ec4899", emoji: "✨" },
  "CDO/מנהלים":    { color: "#f97316", emoji: "👔" },
  "כללי":          { color: "#6b7280", emoji: "📌" },
};

/* ─── default sources ─────────────────────────────────────── */
const DEFAULT_SOURCES = [
  // ── טלגרם ──────────────────────────────────────────────────────
  { id:"tg-mdli",      platform:"telegram", name:"Machine & Deep Learning Israel (ערוץ)", category:"ML/DL/AI",     url:"MDLI1",           active:true,  members:"15K+", activity:5 },
  { id:"tg-mdli-grp",  platform:"telegram", name:"Machine & Deep Learning Israel (קבוצה)", category:"ML/DL/AI",   url:"bit.ly/MDLIgroup", active:true,  members:"5K+",  activity:5 },

  // ── פייסבוק ────────────────────────────────────────────────────
  { id:"fb-mdli",      platform:"facebook", name:"Machine & Deep Learning Israel",  category:"ML/DL/AI",     url:"https://www.facebook.com/groups/MDLI1/",                  active:false, members:"55K+", activity:5 },
  { id:"fb-dai",       platform:"facebook", name:"Data Analytics Israel",           category:"BI/Analytics", url:"https://www.facebook.com/groups/DataAnalyticsIsrael/",     active:false, members:"20K+", activity:5 },
  { id:"fb-ds",        platform:"facebook", name:"Data Science Israel",             category:"Data Science", url:"https://www.facebook.com/groups/DataScienceIsrael/",       active:false, members:"15K+", activity:4 },
  { id:"fb-ai1",       platform:"facebook", name:"AI ISRAEL – כלים ושימושים",       category:"AI גנרטיבי",  url:"https://www.facebook.com/groups/aisrael/",                 active:false, members:"70K+", activity:5 },
  { id:"fb-ai2",       platform:"facebook", name:"AI ISRAEL – ChatGPT & Midjourney",category:"AI גנרטיבי",  url:"https://www.facebook.com/groups/845334450251048/",         active:false, members:"40K+", activity:4 },
  { id:"fb-chatgpt1",  platform:"facebook", name:"ChatGPT ישראל הקהילה",            category:"AI גנרטיבי",  url:"https://www.facebook.com/groups/715153780127233/",         active:false, members:"35K+", activity:4 },
  { id:"fb-chatgpt2",  platform:"facebook", name:"ChatGPT ישראל – קהילה נוספת",    category:"AI גנרטיבי",  url:"https://www.facebook.com/groups/3347199695494901/",        active:false, members:"25K+", activity:3 },
  { id:"fb-excel",     platform:"facebook", name:"Excel Pros Israel",               category:"BI/Analytics", url:"https://www.facebook.com/groups/excelprosisrael/",         active:false, members:"30K+", activity:4 },
  { id:"fb-hackit",    platform:"facebook", name:"HACKIT.CO.IL – AI האקינג ופיתוח", category:"ML/DL/AI",    url:"https://www.facebook.com/groups/725144319132970/",         active:false, members:"8K+",  activity:3 },
  { id:"fb-dana",      platform:"facebook", name:"בינה מלאכותית של דנה ישראלי",    category:"AI גנרטיבי",  url:"https://www.facebook.com/groups/574653557886298/",         active:false, members:"12K+", activity:3 },
  { id:"fb-gemini",    platform:"facebook", name:"Gemini Israel",                   category:"AI גנרטיבי",  url:"https://www.facebook.com/groups/1266824747259615/",        active:false, members:"5K+",  activity:2 },
  { id:"fb-sora",      platform:"facebook", name:"Sora Israel – וידאו ואנימציה AI", category:"AI גנרטיבי",  url:"https://www.facebook.com/groups/365817639698470/",         active:false, members:"6K+",  activity:3 },
  { id:"fb-law",       platform:"facebook", name:"בינה מלאכותית בעולם המשפט",      category:"CDO/מנהלים",  url:"https://www.facebook.com/groups/1087861915591003/",        active:false, members:"4K+",  activity:2 },
  { id:"fb-coffee",    platform:"facebook", name:"AI Coffee Club Israel",           category:"AI גנרטיבי",  url:"https://www.facebook.com/groups/aicoffeeclub",             active:false, members:"10K+", activity:3 },
  { id:"fb-mljobs",    platform:"facebook", name:"Machine & Deep Learning Jobs Israel", category:"ML/DL/AI", url:"https://www.facebook.com/groups/ml.jobs.il/",             active:false, members:"12K+", activity:4 },

  // ── לינקדאין ───────────────────────────────────────────────────
  { id:"li-mdli",      platform:"linkedin", name:"MDLI LinkedIn",                  category:"ML/DL/AI",     url:"machine-deep-learning-israel",  active:true,  members:"15K",  activity:4 },
  { id:"li-dh",        platform:"linkedin", name:"DataHack LinkedIn",              category:"Data Science", url:"datahack",                      active:true,  members:"6K",   activity:3 },
  { id:"li-bigdata",   platform:"linkedin", name:"Big Data Israel – LinkedIn Group",category:"Data Eng",    url:"linkedin.com/groups/4293229",   active:false, members:"8K+",  activity:3 },
  { id:"li-algo",      platform:"linkedin", name:"Israel Algorithms – LinkedIn",   category:"ML/DL/AI",     url:"linkedin.com/groups/5052809",   active:false, members:"3K+",  activity:2 },
  { id:"li-iict",      platform:"linkedin", name:"הלשכה לטכנולוגיות מידע – Data & AI", category:"CDO/מנהלים", url:"israel-it",                active:false, members:"5K+",  activity:3 },

  // ── Meetup ─────────────────────────────────────────────────────
  { id:"mu-bdi",       platform:"meetup",   name:"Big Data & Data Science Israel", category:"Data Eng",     url:"big-data-israel",                        active:true,  members:"6.8K", activity:3 },
  { id:"mu-dh",        platform:"meetup",   name:"DataHack Meetup",               category:"Data Science", url:"DataHack",                               active:true,  members:"3.2K", activity:3 },
  { id:"mu-ml",        platform:"meetup",   name:"ML & Big Data Hands-On TLV",    category:"ML/DL/AI",     url:"Machine_Learning_and_Big_Data_hands_on", active:true,  members:"2.9K", activity:2 },
  { id:"mu-tlvai",     platform:"meetup",   name:"Tel Aviv AI/ML/Data Developers", category:"ML/DL/AI",    url:"tel-aviv-ai-tech-talks",                 active:false, members:"3.2K", activity:3 },
  { id:"mu-dlboot",    platform:"meetup",   name:"Tel Aviv Deep Learning Bootcamp",category:"ML/DL/AI",    url:"Tel-Aviv-Deep-Learning-Bootcamp",         active:false, members:"1.5K", activity:2 },
  { id:"mu-schoolai",  platform:"meetup",   name:"Tel Aviv School of AI",         category:"ML/DL/AI",     url:"Tel-Aviv-School-of-AI",                  active:false, members:"1.2K", activity:3 },
  { id:"mu-datadriven",platform:"meetup",   name:"Data Driven AI Tel Aviv",       category:"Data Science", url:"meetup-group-data-driven",               active:false, members:"800+", activity:3 },
  { id:"mu-ibm",       platform:"meetup",   name:"IBM Big Data Enthusiasts Israel",category:"Data Eng",    url:"topics/big-data-analytics/il",           active:false, members:"3.4K", activity:2 },
  { id:"mu-meds",      platform:"meetup",   name:"Medical Data Science Israel",   category:"Data Science", url:"find/il--tel-aviv-yafo/machine-learning", active:false, members:"300+", activity:2 },
  { id:"mu-h2o",       platform:"meetup",   name:"H2O.ai AutoML Israel",          category:"ML/DL/AI",     url:"topics/automatic-machine-learning/il",   active:false, members:"2.5K", activity:1 },

  // ── קהילות ספקים ───────────────────────────────────────────────
  { id:"vnd-snowflake",platform:"custom",   name:"Snowflake User Group Israel",   category:"Data Eng",     url:"https://usergroups.snowflake.com/israel/",              active:false, members:"1K+",  activity:3 },
  { id:"vnd-pbi",      platform:"custom",   name:"Power BI User Group Israel",    category:"BI/Analytics", url:"https://www.meetup.com/israel-power-bi-user-group/",    active:false, members:"800+", activity:3 },
  { id:"vnd-tableau",  platform:"custom",   name:"Tableau Israel User Group",     category:"BI/Analytics", url:"https://usergroups.tableau.com/israel",                active:false, members:"500+", activity:2 },
  { id:"vnd-databricks",platform:"custom",  name:"Databricks User Group Israel",  category:"Data Eng",     url:"https://www.meetup.com/databricks-israel-user-group/", active:false, members:"600+", activity:2 },
  { id:"vnd-aws",      platform:"custom",   name:"AWS User Group Israel",         category:"Cloud/Infra",  url:"https://www.meetup.com/AWS-User-Group-Tel-Aviv/",      active:false, members:"3K+",  activity:3 },
  { id:"vnd-gdg",      platform:"custom",   name:"GDG Tel Aviv – Google Cloud",   category:"Cloud/Infra",  url:"https://gdg.community.dev/gdg-tel-aviv/",              active:false, members:"2.8K", activity:3 },

  // ── קהילות וארגונים ─────────────────────────────────────────────
  { id:"org-datahack",  platform:"custom",  name:"DataHack – עמותת Data Science", category:"Data Science", url:"https://www.datahack.org.il/",        active:false, members:"5K+",  activity:4 },
  { id:"org-iict",      platform:"custom",  name:"הלשכה לטכנולוגיות מידע – Data & AI", category:"CDO/מנהלים", url:"https://www.israel-it.org/data-ai", active:false, members:"2K+",  activity:3 },
  { id:"org-datail",    platform:"custom",  name:"DatA-IL – חדשנות דאטה לציבור", category:"CDO/מנהלים",   url:"https://data-il.org/",                active:false, members:"1.5K", activity:3 },
  { id:"org-coffee",    platform:"custom",  name:"AI Coffee Club Israel",          category:"AI גנרטיבי",  url:"https://aicoffeeclub.co.il/",         active:false, members:"20K+", activity:4 },
  { id:"org-ydata",     platform:"custom",  name:"Y-DATA / Nebius Academy Israel", category:"Data Science", url:"https://www.ydata.co.il/",           active:false, members:"1.2K", activity:4 },
  { id:"org-analytics", platform:"custom",  name:"ווב אנליטיקס ישראל",           category:"BI/Analytics", url:"https://www.analytics.org.il/",       active:false, members:"N/A",  activity:2 },
];

/* ─── mock Claude summariser ──────────────────────────────── */
async function callClaude(apiKey, sources, days) {
  if (!apiKey || apiKey.length < 10) throw new Error("API key חסר");

  const activeSources = sources.filter(s => s.active);
  const byCategory = {};
  activeSources.forEach(s => {
    (byCategory[s.category] ??= []).push(s);
  });

  const prompt = `אתה מנתח קהילות Data/BI/AI/ML ישראליות.
להלן ${activeSources.length} מקורות שנסרקו ב-${days} הימים האחרונים:
${activeSources.map(s=>`- ${s.name} (${s.platform}, ${s.category})`).join("\n")}

צור דוח JSON עם הנושאים החמים ביותר לכל קטגוריה.
החזר JSON בלבד:
{
  "generated_at": "ISO_DATE",
  "days_scanned": ${days},
  "sources_scanned": ${activeSources.length},
  "categories": [
    {
      "name": "שם קטגוריה",
      "posts_scanned": 42,
      "topics": [
        {
          "title": "כותרת הנושא בעברית",
          "description": "תיאור קצר 2-3 משפטים",
          "interest": "high|medium|low",
          "sources": ["שם מקור 1", "שם מקור 2"],
          "tags": ["tag1","tag2"]
        }
      ],
      "trend": "תובנה מסכמת על הטרנד בקטגוריה"
    }
  ]
}`;

  const resp = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const raw = data.content[0].text.replace(/```json\n?|```/g, "").trim();
  return JSON.parse(raw);
}

/* ─── icons ──────────────────────────────────────────────── */
const Icon = ({ name, size=16 }) => {
  const icons = {
    plus:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    trash:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
    edit:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    play:    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
    mail:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    check:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
    x:       <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    settings:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    db:      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>,
    report:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    refresh: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>,
    eye:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    toggle:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="5" width="22" height="14" rx="7" ry="7"/><circle cx="8" cy="12" r="3" fill="currentColor"/></svg>,
  };
  return icons[name] || null;
};

/* ─── sub-components ──────────────────────────────────────── */

const Badge = ({ color, children }) => (
  <span style={{
    background: color + "22", color, border: `1px solid ${color}44`,
    borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700,
    letterSpacing: "0.03em", whiteSpace: "nowrap",
  }}>{children}</span>
);

const Pill = ({ on, onClick, children }) => (
  <button onClick={onClick} style={{
    background: on ? T.accentHi : T.card, color: on ? "#fff" : T.textDim,
    border: `1px solid ${on ? T.accentHi : T.border}`,
    borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", transition: "all .2s",
  }}>{children}</button>
);

const Toggle = ({ on, onChange }) => (
  <div onClick={() => onChange(!on)} style={{
    width: 40, height: 22, borderRadius: 11,
    background: on ? T.green : T.muted,
    position: "relative", cursor: "pointer",
    transition: "background .25s", flexShrink: 0,
  }}>
    <div style={{
      width: 16, height: 16, borderRadius: "50%", background: "#fff",
      position: "absolute", top: 3,
      left: on ? 21 : 3,
      transition: "left .25s",
    }}/>
  </div>
);

const InterestDot = ({ level }) => {
  const map = { high: { c: T.gold, l: "🔥 גבוהה" }, medium: { c: T.accentHi, l: "📈 בינונית" }, low: { c: T.muted, l: "💬 נמוכה" } };
  const m = map[level] || map.medium;
  return <span style={{ color: m.c, fontSize: 12, fontWeight: 700 }}>{m.l}</span>;
};

const Spinner = () => (
  <div style={{
    width: 20, height: 20, border: `2px solid ${T.border}`,
    borderTop: `2px solid ${T.accentHi}`, borderRadius: "50%",
    animation: "spin .8s linear infinite", flexShrink: 0,
  }}/>
);

/* ─── Activity bar ────────────────────────────────────────── */
const ActivityBar = ({ level }) => (
  <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
    {[1,2,3,4,5].map(i => (
      <div key={i} style={{
        width: 4, height: 4 + i * 2.5, borderRadius: 2,
        background: i <= level ? T.accentHi : T.border,
        transition: "background .3s",
      }}/>
    ))}
  </div>
);

/* ─── Add/Edit Source Modal ───────────────────────────────── */
const SourceModal = ({ src, onSave, onClose }) => {
  const [form, setForm] = useState(src || {
    platform: "telegram", name: "", category: "ML/DL/AI",
    url: "", members: "", activity: 3, active: true,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: T.panel, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: 28, width: 460, maxWidth: "95vw",
        boxShadow: "0 24px 80px rgba(0,0,0,.6)",
        direction: "rtl",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <h3 style={{ color: T.text, margin: 0, fontSize: 16, fontWeight: 700 }}>
            {src ? "✏️ עריכת מקור" : "➕ הוספת מקור חדש"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", padding: 4 }}>
            <Icon name="x" size={18}/>
          </button>
        </div>

        {[
          { label: "שם המקור", key: "name", type: "text", placeholder: "לדוגמה: MDLI Facebook Group" },
          { label: "כתובת / Username / Slug", key: "url", type: "text", placeholder: "לדוגמה: MDLI1 או https://..." },
          { label: "מספר חברים (מוערך)", key: "members", type: "text", placeholder: "לדוגמה: 55K+" },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 14 }}>
            <label style={{ color: T.textDim, fontSize: 12, display: "block", marginBottom: 5 }}>{f.label}</label>
            <input
              value={form[f.key] || ""}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={{
                width: "100%", boxSizing: "border-box",
                background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 8, padding: "9px 12px", color: T.text,
                fontSize: 13, outline: "none",
              }}
            />
          </div>
        ))}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ color: T.textDim, fontSize: 12, display: "block", marginBottom: 5 }}>פלטפורמה</label>
            <select
              value={form.platform}
              onChange={e => set("platform", e.target.value)}
              style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", color: T.text, fontSize: 13, cursor: "pointer" }}
            >
              {Object.entries(PLATFORM_META).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ color: T.textDim, fontSize: 12, display: "block", marginBottom: 5 }}>קטגוריה</label>
            <select
              value={form.category}
              onChange={e => set("category", e.target.value)}
              style={{ width: "100%", background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 12px", color: T.text, fontSize: 13, cursor: "pointer" }}
            >
              {Object.keys(CATEGORY_META).map(c => (
                <option key={c} value={c}>{CATEGORY_META[c].emoji} {c}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ color: T.textDim, fontSize: 12, display: "block", marginBottom: 8 }}>
            רמת פעילות: {form.activity}/5
          </label>
          <input type="range" min={1} max={5} value={form.activity}
            onChange={e => set("activity", +e.target.value)}
            style={{ width: "100%", accentColor: T.accentHi }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            background: T.card, border: `1px solid ${T.border}`, color: T.textDim,
            borderRadius: 8, padding: "9px 18px", cursor: "pointer", fontSize: 13,
          }}>ביטול</button>
          <button
            onClick={() => { if (form.name && form.url) onSave({ ...form, id: src?.id || `src-${Date.now()}` }); }}
            disabled={!form.name || !form.url}
            style={{
              background: T.accent, border: "none", color: "#fff",
              borderRadius: 8, padding: "9px 20px", cursor: "pointer", fontSize: 13, fontWeight: 700,
              opacity: (!form.name || !form.url) ? 0.4 : 1,
            }}
          >שמור</button>
        </div>
      </div>
    </div>
  );
};

/* ─── Report Viewer ───────────────────────────────────────── */
const ReportViewer = ({ report, onClose }) => {
  if (!report) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.85)",
      zIndex: 900, overflow: "auto", backdropFilter: "blur(6px)",
      padding: "32px 16px", direction: "rtl",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h2 style={{ color: T.text, margin: 0, fontSize: 22, fontWeight: 800 }}>📊 דוח Data Digest</h2>
            <p style={{ color: T.textDim, margin: "4px 0 0", fontSize: 13 }}>
              נוצר: {new Date(report.generated_at).toLocaleString("he-IL")} | {report.sources_scanned} מקורות | {report.days_scanned} ימים
            </p>
          </div>
          <button onClick={onClose} style={{
            background: T.card, border: `1px solid ${T.border}`, color: T.textDim,
            borderRadius: 10, padding: "8px 16px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6,
          }}>
            <Icon name="x" size={14}/> סגור
          </button>
        </div>

        {(report.categories || []).map((cat, ci) => {
          const meta = CATEGORY_META[cat.name] || CATEGORY_META["כללי"];
          return (
            <div key={ci} style={{
              background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14,
              marginBottom: 20, overflow: "hidden",
            }}>
              <div style={{
                background: meta.color + "22", borderBottom: `1px solid ${meta.color}44`,
                padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <h3 style={{ color: T.text, margin: 0, fontSize: 16, fontWeight: 700 }}>
                  {meta.emoji} {cat.name}
                </h3>
                <span style={{ color: T.textDim, fontSize: 12 }}>{cat.posts_scanned} פוסטים נסרקו</span>
              </div>
              <div style={{ padding: "16px 20px" }}>
                {(cat.topics || []).map((t, ti) => (
                  <div key={ti} style={{
                    borderRight: `3px solid ${meta.color}`,
                    paddingRight: 14, marginBottom: 16,
                    background: meta.color + "08", borderRadius: "0 8px 8px 0",
                    padding: "10px 14px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                      <span style={{ color: T.text, fontWeight: 700, fontSize: 14 }}>{t.title}</span>
                      <InterestDot level={t.interest}/>
                    </div>
                    <p style={{ color: T.textDim, fontSize: 13, margin: "0 0 8px", lineHeight: 1.6 }}>{t.description}</p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {(t.tags || []).map(tag => <Badge key={tag} color={meta.color}>#{tag}</Badge>)}
                      {(t.sources || []).map(s => <span key={s} style={{ color: T.textFaint, fontSize: 11 }}>📍 {s}</span>)}
                    </div>
                  </div>
                ))}
                {cat.trend && (
                  <div style={{
                    background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: 10, padding: "10px 14px", marginTop: 4,
                  }}>
                    <span style={{ color: T.green, fontSize: 12, fontWeight: 700 }}>🌱 טרנד: </span>
                    <span style={{ color: T.textDim, fontSize: 13 }}>{cat.trend}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Settings Panel ──────────────────────────────────────── */
const SettingsPanel = ({ cfg, onChange }) => {
  const set = (k, v) => onChange({ ...cfg, [k]: v });
  const Field = ({ label, k, type = "text", placeholder = "" }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ color: T.textDim, fontSize: 12, display: "block", marginBottom: 5 }}>{label}</label>
      <input
        type={type}
        value={cfg[k] || ""}
        onChange={e => set(k, e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box",
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: "9px 12px", color: T.text, fontSize: 13, outline: "none",
          fontFamily: type === "password" ? "monospace" : "inherit",
        }}
      />
    </div>
  );

  return (
    <div style={{ direction: "rtl" }}>
      <h3 style={{ color: T.text, fontSize: 15, fontWeight: 700, marginBottom: 20 }}>⚙️ הגדרות מערכת</h3>

      <div style={{ background: T.card, borderRadius: 12, padding: 20, marginBottom: 16, border: `1px solid ${T.border}` }}>
        <h4 style={{ color: T.accentHi, margin: "0 0 16px", fontSize: 13, fontWeight: 700 }}>🤖 Claude API</h4>
        <Field label="Claude API Key" k="claudeKey" type="password" placeholder="sk-ant-..." />
        <div style={{ background: T.panel, borderRadius: 8, padding: 10, fontSize: 12, color: T.textDim }}>
          💡 קבל API key ב: <a href="https://console.anthropic.com" target="_blank" style={{ color: T.accentHi }}>console.anthropic.com</a>
        </div>
      </div>

      <div style={{ background: T.card, borderRadius: 12, padding: 20, marginBottom: 16, border: `1px solid ${T.border}` }}>
        <h4 style={{ color: "#10b981", margin: "0 0 16px", fontSize: 13, fontWeight: 700 }}>📧 שליחת מייל (Gmail)</h4>
        <Field label="כתובת Gmail" k="gmailUser" placeholder="your@gmail.com" />
        <Field label="App Password (16 תווים)" k="gmailPass" type="password" placeholder="xxxx xxxx xxxx xxxx" />
        <Field label="נמענים (מופרדים בפסיק)" k="recipients" placeholder="you@gmail.com, colleague@gmail.com" />
        <div style={{ background: T.panel, borderRadius: 8, padding: 10, fontSize: 12, color: T.textDim }}>
          💡 צור App Password ב: <a href="https://myaccount.google.com/apppasswords" target="_blank" style={{ color: T.accentHi }}>myaccount.google.com/apppasswords</a>
        </div>
      </div>

      <div style={{ background: T.card, borderRadius: 12, padding: 20, border: `1px solid ${T.border}` }}>
        <h4 style={{ color: T.gold, margin: "0 0 16px", fontSize: 13, fontWeight: 700 }}>🗓️ תדירות הדוח</h4>
        <div style={{ marginBottom: 14 }}>
          <label style={{ color: T.textDim, fontSize: 12, display: "block", marginBottom: 5 }}>
            סריקה כל {cfg.intervalDays || 2} ימים
          </label>
          <input type="range" min={1} max={7} value={cfg.intervalDays || 2}
            onChange={e => set("intervalDays", +e.target.value)}
            style={{ width: "100%", accentColor: T.gold }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", color: T.textFaint, fontSize: 11, marginTop: 2 }}>
            <span>כל יום</span><span>שבועי</span>
          </div>
        </div>
        <div style={{ marginBottom: 0 }}>
          <label style={{ color: T.textDim, fontSize: 12, display: "block", marginBottom: 5 }}>
            נושאים לקטגוריה: {cfg.topicsPerCat || 4}
          </label>
          <input type="range" min={2} max={8} value={cfg.topicsPerCat || 4}
            onChange={e => set("topicsPerCat", +e.target.value)}
            style={{ width: "100%", accentColor: T.gold }}
          />
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════ */
export default function App() {
  const [tab, setTab]         = useState("sources");   // sources | settings | history
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [cfg, setCfg]         = useState({ intervalDays: 2, topicsPerCat: 4 });
  const [modal, setModal]     = useState(null);        // null | "add" | source_obj
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport]   = useState(null);        // current report
  const [history, setHistory] = useState([]);
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterCat, setFilterCat] = useState("all");
  const [toast, setToast]     = useState(null);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  };

  const activeSources = sources.filter(s => s.active);
  const filteredSources = sources.filter(s =>
    (filterPlatform === "all" || s.platform === filterPlatform) &&
    (filterCat === "all" || s.category === filterCat)
  );

  const platforms = [...new Set(sources.map(s => s.platform))];
  const categories = [...new Set(sources.map(s => s.category))];

  const handleSaveSource = (src) => {
    setSources(prev =>
      prev.find(s => s.id === src.id)
        ? prev.map(s => s.id === src.id ? src : s)
        : [...prev, src]
    );
    setModal(null);
    showToast(src.id.startsWith("src-") && !DEFAULT_SOURCES.find(d => d.id === src.id)
      ? "✅ מקור נוסף בהצלחה" : "✅ מקור עודכן", "ok");
  };

  const handleDelete = (id) => {
    setSources(prev => prev.filter(s => s.id !== id));
    showToast("🗑️ מקור הוסר", "warn");
  };

  const handleToggle = (id) => {
    setSources(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const runDigest = async () => {
    if (!cfg.claudeKey) { showToast("❌ הכנס Claude API Key בהגדרות", "error"); setTab("settings"); return; }
    if (activeSources.length === 0) { showToast("❌ אין מקורות פעילים", "error"); return; }

    setRunning(true);
    setProgress("מאתחל סריקה...");

    try {
      setProgress(`סורק ${activeSources.length} מקורות...`);
      await new Promise(r => setTimeout(r, 800));

      setProgress("שולח ל-Claude API לסיכום...");
      const result = await callClaude(cfg.claudeKey, sources, cfg.intervalDays || 2);

      setReport(result);
      setHistory(prev => [{ ...result, id: Date.now() }, ...prev.slice(0, 9)]);
      showToast("✅ דוח נוצר בהצלחה!", "ok");
    } catch (e) {
      showToast(`❌ שגיאה: ${e.message}`, "error");
    } finally {
      setRunning(false);
      setProgress("");
    }
  };

  /* stats */
  const statCards = [
    { label: "מקורות כולל", value: sources.length,        color: T.accentHi, icon: "db"      },
    { label: "מקורות פעילים", value: activeSources.length, color: T.green,    icon: "check"   },
    { label: "פלטפורמות",    value: platforms.length,      color: T.gold,     icon: "settings" },
    { label: "דוחות שנוצרו", value: history.length,        color: T.orange,   icon: "report"  },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, color: T.text,
      fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
      direction: "rtl",
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        * { box-sizing: border-box; }
        input, select { outline: none; }
        select option { background: #1a2236; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2d45; border-radius: 3px; }
        input[type=range] { cursor:pointer; }
      `}</style>

      {/* ── Toast ─────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: toast.type === "error" ? "#7f1d1d" : toast.type === "warn" ? "#78350f" : "#14532d",
          border: `1px solid ${toast.type === "error" ? T.red : toast.type === "warn" ? T.orange : T.green}`,
          color: "#fff", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 600,
          zIndex: 2000, animation: "slideIn .3s ease",
          boxShadow: "0 8px 32px rgba(0,0,0,.5)",
        }}>{toast.msg}</div>
      )}

      {/* ── Sidebar ───────────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 220,
        background: T.panel, borderLeft: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.text, letterSpacing: "-0.5px" }}>
            📡 <span style={{ color: T.accentHi }}>Data</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: T.text, letterSpacing: "-0.5px", marginTop: -4 }}>
            Digest<span style={{ color: T.accentHi }}>.</span>IL
          </div>
          <div style={{ fontSize: 10, color: T.textFaint, marginTop: 4, letterSpacing: "0.08em" }}>
            COMMUNITY MONITOR
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 10px", flex: 1 }}>
          {[
            { id: "sources",  label: "מקורות",   icon: "db"       },
            { id: "settings", label: "הגדרות",   icon: "settings" },
            { id: "history",  label: "היסטוריה", icon: "report"   },
          ].map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              background: tab === item.id ? T.accent + "22" : "none",
              border: `1px solid ${tab === item.id ? T.accent + "55" : "transparent"}`,
              color: tab === item.id ? T.accentHi : T.textDim,
              borderRadius: 9, padding: "10px 12px", cursor: "pointer",
              fontSize: 13, fontWeight: tab === item.id ? 700 : 400,
              marginBottom: 4, transition: "all .2s",
            }}>
              <Icon name={item.icon} size={15}/>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Run button */}
        <div style={{ padding: "16px 12px", borderTop: `1px solid ${T.border}` }}>
          <div style={{
            color: T.textFaint, fontSize: 11, textAlign: "center",
            marginBottom: 8,
          }}>
            {activeSources.length} מקורות פעילים
          </div>
          <button
            onClick={runDigest}
            disabled={running}
            style={{
              width: "100%", background: running ? T.muted : `linear-gradient(135deg,${T.accent},${T.accentHi})`,
              border: "none", color: "#fff", borderRadius: 10,
              padding: "11px 0", cursor: running ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all .2s",
              boxShadow: running ? "none" : "0 4px 16px rgba(37,99,235,.4)",
            }}
          >
            {running ? <><Spinner/> מריץ...</> : <><Icon name="play" size={14}/> הפעל דוח</>}
          </button>
          {progress && (
            <div style={{ color: T.accentHi, fontSize: 11, textAlign: "center", marginTop: 8, animation: "pulse 1.5s infinite" }}>
              {progress}
            </div>
          )}
        </div>
      </div>

      {/* ── Main content ──────────────────────────────────── */}
      <div style={{ marginRight: 220, padding: "28px 28px 40px" }}>

        {/* ── SOURCES TAB ────────────────────────────────── */}
        {tab === "sources" && (
          <>
            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
              {statCards.map(s => (
                <div key={s.label} style={{
                  background: T.panel, border: `1px solid ${T.border}`,
                  borderRadius: 12, padding: "16px 18px",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: s.color + "22", border: `1px solid ${s.color}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: s.color, flexShrink: 0,
                  }}>
                    <Icon name={s.icon} size={18}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Pill on={filterPlatform === "all"} onClick={() => setFilterPlatform("all")}>כל הפלטפורמות</Pill>
                {platforms.map(p => (
                  <Pill key={p} on={filterPlatform === p} onClick={() => setFilterPlatform(p)}>
                    {PLATFORM_META[p]?.icon} {PLATFORM_META[p]?.label || p}
                  </Pill>
                ))}
              </div>
              <button
                onClick={() => setModal("add")}
                style={{
                  background: T.accent, border: "none", color: "#fff",
                  borderRadius: 9, padding: "9px 16px",
                  display: "flex", alignItems: "center", gap: 7,
                  cursor: "pointer", fontSize: 13, fontWeight: 700,
                  boxShadow: "0 2px 12px rgba(37,99,235,.35)",
                }}
              >
                <Icon name="plus" size={14}/> הוסף מקור
              </button>
            </div>

            {/* Category filters */}
            <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
              <Pill on={filterCat === "all"} onClick={() => setFilterCat("all")}>כל הקטגוריות</Pill>
              {categories.map(c => (
                <Pill key={c} on={filterCat === c} onClick={() => setFilterCat(c)}>
                  {CATEGORY_META[c]?.emoji} {c}
                </Pill>
              ))}
            </div>

            {/* Sources table */}
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "2.5fr 1fr 1.3fr 80px 70px 80px",
                gap: 0, padding: "10px 18px",
                borderBottom: `1px solid ${T.border}`,
                background: T.card,
              }}>
                {["שם המקור", "פלטפורמה", "קטגוריה", "חברים", "פעילות", "פעולות"].map(h => (
                  <div key={h} style={{ color: T.textFaint, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>{h}</div>
                ))}
              </div>

              {filteredSources.length === 0 && (
                <div style={{ padding: "40px", textAlign: "center", color: T.textDim }}>
                  אין מקורות לתצוגה. לחץ "הוסף מקור" להתחלה.
                </div>
              )}

              {filteredSources.map((src, i) => {
                const pm = PLATFORM_META[src.platform] || PLATFORM_META.custom;
                const cm = CATEGORY_META[src.category] || CATEGORY_META["כללי"];
                return (
                  <div key={src.id} style={{
                    display: "grid", gridTemplateColumns: "2.5fr 1fr 1.3fr 80px 70px 80px",
                    padding: "13px 18px", alignItems: "center",
                    background: i % 2 === 0 ? T.panel : T.card + "80",
                    borderBottom: `1px solid ${T.border}`,
                    opacity: src.active ? 1 : 0.5,
                    transition: "opacity .2s",
                  }}>
                    {/* Name + toggle */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Toggle on={src.active} onChange={() => handleToggle(src.id)}/>
                      <div>
                        <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{src.name}</div>
                        <div style={{ color: T.textFaint, fontSize: 11, marginTop: 2, fontFamily: "monospace" }}>
                          {src.url.length > 35 ? src.url.slice(0, 35) + "…" : src.url}
                        </div>
                      </div>
                    </div>
                    {/* Platform */}
                    <div>
                      <Badge color={pm.color}>{pm.icon} {pm.label}</Badge>
                    </div>
                    {/* Category */}
                    <div>
                      <Badge color={cm.color}>{cm.emoji} {src.category}</Badge>
                    </div>
                    {/* Members */}
                    <div style={{ color: T.textDim, fontSize: 12 }}>{src.members || "—"}</div>
                    {/* Activity */}
                    <div><ActivityBar level={src.activity}/></div>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setModal(src)} title="עריכה" style={{
                        background: "none", border: `1px solid ${T.border}`,
                        color: T.textDim, borderRadius: 6, padding: "4px 7px",
                        cursor: "pointer", display: "flex", alignItems: "center",
                      }}><Icon name="edit" size={13}/></button>
                      <button onClick={() => handleDelete(src.id)} title="מחיקה" style={{
                        background: "none", border: `1px solid ${T.border}`,
                        color: T.red + "aa", borderRadius: 6, padding: "4px 7px",
                        cursor: "pointer", display: "flex", alignItems: "center",
                      }}><Icon name="trash" size={13}/></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Last report preview */}
            {report && (
              <div style={{
                marginTop: 24, background: T.panel, border: `1px solid ${T.green}44`,
                borderRadius: 14, padding: "18px 22px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <span style={{ color: T.green, fontWeight: 700, fontSize: 14 }}>✅ דוח אחרון זמין</span>
                    <span style={{ color: T.textDim, fontSize: 12, marginRight: 12 }}>
                      {new Date(report.generated_at).toLocaleString("he-IL")}
                    </span>
                  </div>
                  <button onClick={() => setReport(report)} style={{
                    background: T.accent + "22", border: `1px solid ${T.accent}55`,
                    color: T.accentHi, borderRadius: 8, padding: "7px 14px",
                    cursor: "pointer", fontSize: 12, fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    <Icon name="eye" size={13}/> פתח דוח
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(report.categories || []).map(cat => {
                    const meta = CATEGORY_META[cat.name] || CATEGORY_META["כללי"];
                    return (
                      <div key={cat.name} style={{
                        background: meta.color + "15", border: `1px solid ${meta.color}33`,
                        borderRadius: 8, padding: "6px 12px",
                        fontSize: 12, color: meta.color, fontWeight: 600,
                      }}>
                        {meta.emoji} {cat.name} ({cat.topics?.length || 0} נושאים)
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── SETTINGS TAB ────────────────────────────────── */}
        {tab === "settings" && (
          <div style={{ maxWidth: 600 }}>
            <SettingsPanel cfg={cfg} onChange={setCfg}/>
            <button
              onClick={() => { showToast("✅ הגדרות נשמרו", "ok"); }}
              style={{
                marginTop: 20, background: T.accent, border: "none", color: "#fff",
                borderRadius: 10, padding: "11px 24px", cursor: "pointer",
                fontSize: 14, fontWeight: 700,
              }}
            >
              💾 שמור הגדרות
            </button>
          </div>
        )}

        {/* ── HISTORY TAB ──────────────────────────────────── */}
        {tab === "history" && (
          <div>
            <h3 style={{ color: T.text, fontSize: 16, fontWeight: 700, marginBottom: 20 }}>📋 היסטוריית דוחות</h3>
            {history.length === 0 ? (
              <div style={{
                background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14,
                padding: "60px 40px", textAlign: "center", color: T.textDim,
              }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>אין דוחות עדיין</div>
                <div style={{ fontSize: 13 }}>לחץ "הפעל דוח" כדי לייצר את הדוח הראשון</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {history.map((r, i) => (
                  <div key={r.id} style={{
                    background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12,
                    padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <div style={{ color: T.text, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                        {i === 0 && <span style={{ color: T.green, marginLeft: 8 }}>● עדכני</span>}
                        דוח #{history.length - i}
                      </div>
                      <div style={{ color: T.textDim, fontSize: 12 }}>
                        {new Date(r.generated_at).toLocaleString("he-IL")} •
                        {r.sources_scanned} מקורות •
                        {(r.categories || []).length} קטגוריות
                      </div>
                    </div>
                    <button onClick={() => setReport(r)} style={{
                      background: T.accent + "22", border: `1px solid ${T.accent}55`,
                      color: T.accentHi, borderRadius: 8, padding: "7px 14px",
                      cursor: "pointer", fontSize: 12, fontWeight: 700,
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <Icon name="eye" size={13}/> צפה
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────── */}
      {modal && (
        <SourceModal
          src={modal === "add" ? null : modal}
          onSave={handleSaveSource}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── Report fullscreen ────────────────────────────── */}
      {report && tab !== "sources" && (
        <ReportViewer report={report} onClose={() => setReport(null)}/>
      )}
      {report && tab === "sources" && report._open && (
        <ReportViewer report={report} onClose={() => setReport({ ...report, _open: false })}/>
      )}
    </div>
  );
}
