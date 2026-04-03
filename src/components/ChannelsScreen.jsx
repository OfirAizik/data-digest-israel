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

const PLATFORM_META = {
  telegram:  { icon: "✈️", label: "טלגרם",    color: "#229ed9" },
  facebook:  { icon: "📘", label: "פייסבוק",  color: "#1877f2" },
  linkedin:  { icon: "💼", label: "לינקדאין", color: "#0077b5" },
  whatsapp:  { icon: "💬", label: "וואטסאפ", color: "#25d366" },
};

const PlatformBadge = ({ platform }) => {
  const p = platform?.toLowerCase() || "telegram";
  const { icon, label, color } = PLATFORM_META[p] || { icon: "🌐", label: "אחר", color: "#6b7280" };
  return (
    <span style={{
      background: color + "22", color,
      border: `1px solid ${color}44`,
      borderRadius: 6, padding: "2px 8px",
      fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {icon} {label}
    </span>
  );
};

const EMPTY_FORM = { name: "", username: "", category: "", is_active: true, is_member: false, notes: "" };

const FALLBACK_SUGGESTED = [
  { name: "Machine & Deep Learning Israel", username: "MDLI1",             category: "ML/DL/AI",  platform: "telegram" },
  { name: "בינה מלאכותית בעברית",           username: "hackit770",         category: "AI",        platform: "telegram" },
  { name: "חדשות טכנולוגיה ישראל",          username: "tech_news_israel",  category: "Tech News", platform: "telegram" },
];

export default function ChannelsScreen({ isAdmin }) {
  const [channels,         setChannels]        = useState([]);
  const [loading,          setLoading]         = useState(true);
  const [error,            setError]           = useState("");
  const [toast,            setToast]           = useState("");
  const [saving,           setSaving]          = useState(null);
  const [showForm,         setShowForm]        = useState(false);
  const [form,             setForm]            = useState(EMPTY_FORM);
  const [submitting,       setSubmitting]      = useState(false);
  const [deleteId,         setDeleteId]        = useState(null);
  const [editId,           setEditId]          = useState(null);
  const [editForm,         setEditForm]        = useState({});
  const [suggested,        setSuggested]       = useState(FALLBACK_SUGGESTED);
  const [suggestedUpdated, setSuggestedUpdated]= useState("");
  const [showSearchTip,    setShowSearchTip]   = useState(false);

  useEffect(() => { fetchChannels(); loadSuggestedCache(); }, []);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  const loadSuggestedCache = async () => {
    const { data } = await supabase
      .from("app_config")
      .select("key,value")
      .in("key", ["suggested_channels_cache", "suggested_channels_updated_at"]);
    if (!data || data.length === 0) return;
    const byKey = Object.fromEntries(data.map(r => [r.key, r.value]));
    if (byKey.suggested_channels_cache) {
      try {
        const parsed = JSON.parse(byKey.suggested_channels_cache);
        if (Array.isArray(parsed) && parsed.length > 0) setSuggested(parsed);
      } catch { /* keep fallback */ }
    }
    if (byKey.suggested_channels_updated_at) setSuggestedUpdated(byKey.suggested_channels_updated_at);
  };

  const saveSuggestedCache = async (list, updatedAt) => {
    await supabase.from("app_config").upsert(
      [
        { key: "suggested_channels_cache",      value: JSON.stringify(list) },
        { key: "suggested_channels_updated_at", value: updatedAt            },
      ],
      { onConflict: "key" }
    );
  };

  const searchNewChannels = () => setShowSearchTip(t => !t);

  const clearSuggestedCache = async () => {
    await supabase.from("app_config").delete()
      .in("key", ["suggested_channels_cache", "suggested_channels_updated_at"]);
    setSuggested(FALLBACK_SUGGESTED);
    setSuggestedUpdated("");
    showToast("✅ הרשימה נוקתה, נטענו ערוצים מאומתים בלבד");
  };

  const fetchChannels = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("telegram_channels")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) { setError(`שגיאה: ${err.message}`); setLoading(false); return; }
    setChannels(data || []);
    setLoading(false);
  };

  const toggleActive = async (id, val) => {
    setSaving(id);
    setChannels(prev => prev.map(c => c.id === id ? { ...c, is_active: val } : c));
    const { error: err } = await supabase
      .from("telegram_channels").update({ is_active: val }).eq("id", id);
    if (err) { setError(`שגיאת שמירה: ${err.message}`); fetchChannels(); }
    else showToast(val ? "✅ ערוץ הופעל" : "✅ ערוץ הושבת");
    setSaving(null);
  };

  const addChannel = async () => {
    if (!form.name.trim() || !form.username.trim()) return;
    setSubmitting(true);
    const { error: err } = await supabase.from("telegram_channels").insert({
      name:      form.name.trim(),
      username:  form.username.trim(),
      category:  form.category.trim() || null,
      is_active: form.is_active,
      is_member: form.is_member,
      notes:     form.notes.trim() || null,
    });
    if (err) setError(`שגיאת הוספה: ${err.message}`);
    else {
      showToast("✅ ערוץ נוסף בהצלחה");
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchChannels();
    }
    setSubmitting(false);
  };

  const toggleMember = async (id, val) => {
    setSaving(id);
    setChannels(prev => prev.map(c => c.id === id ? { ...c, is_member: val } : c));
    const { error: err } = await supabase
      .from("telegram_channels").update({ is_member: val }).eq("id", id);
    if (err) { setError(`שגיאת שמירה: ${err.message}`); fetchChannels(); }
    else showToast(val ? "✅ סומן כחבר" : "✅ סומן כלא חבר");
    setSaving(null);
  };

  const startEdit = (ch) => {
    setEditId(ch.id);
    setEditForm({ name: ch.name, category: ch.category || "", notes: ch.notes || "" });
  };

  const saveEdit = async () => {
    setSaving(editId);
    const { error: err } = await supabase
      .from("telegram_channels")
      .update({ name: editForm.name.trim(), category: editForm.category.trim() || null, notes: editForm.notes.trim() || null })
      .eq("id", editId);
    if (err) setError(`שגיאת עדכון: ${err.message}`);
    else { showToast("✅ ערוץ עודכן"); fetchChannels(); }
    setSaving(null);
    setEditId(null);
  };

  const confirmDelete = async () => {
    const { error: err } = await supabase
      .from("telegram_channels").delete().eq("id", deleteId);
    if (err) setError(`שגיאת מחיקה: ${err.message}`);
    else { showToast("✅ ערוץ נמחק"); fetchChannels(); }
    setDeleteId(null);
  };

  const colTemplate = isAdmin
    ? "2fr 1.3fr 1fr 1fr 70px 70px 1.5fr 88px"
    : "2fr 1.3fr 1fr 1fr 70px 70px 1.5fr";

  return (
    <div style={{ direction: "rtl" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ color: T.text, fontSize: 16, fontWeight: 700 }}>📡 ניהול ערוצים</h3>
        {isAdmin && (
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              background: T.accent, border: "none", color: "#fff",
              borderRadius: 8, padding: "8px 16px", cursor: "pointer",
              fontSize: 13, fontWeight: 700,
            }}
          >
            ➕ ערוץ חדש
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "#14532d", border: `1px solid ${T.green}`,
          color: "#fff", borderRadius: 10, padding: "10px 20px",
          fontSize: 14, fontWeight: 600, zIndex: 2000,
        }}>{toast}</div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "#7f1d1d44", border: `1px solid ${T.red}66`,
          borderRadius: 8, padding: "10px 14px", marginBottom: 16,
          color: "#fca5a5", fontSize: 13,
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Add form */}
      {isAdmin && showForm && (
        <div style={{
          background: T.panel, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <h4 style={{ color: T.text, fontSize: 14, fontWeight: 700, marginBottom: 16 }}>הוספת ערוץ חדש</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {[
              { key: "name",     label: "שם *",         placeholder: "Machine & Deep Learning Israel", ltr: false },
              { key: "username", label: "שם משתמש *",   placeholder: "MDLI1",                         ltr: true  },
              { key: "category", label: "קטגוריה",      placeholder: "ML/DL/AI",                      ltr: false },
              { key: "notes",    label: "הערות",        placeholder: "הערות אופציונליות",              ltr: false },
            ].map(f => (
              <div key={f.key}>
                <label style={{ color: T.textDim, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
                  {f.label}
                </label>
                <input
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: "100%", background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: 8, padding: "9px 12px", color: T.text,
                    fontSize: 13, outline: "none",
                    direction: f.ltr ? "ltr" : "rtl",
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
            {[
              { key: "is_active", label: "פעיל",        color: T.green    },
              { key: "is_member", label: "חבר בקבוצה",  color: T.accentHi },
            ].map(f => (
              <label key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: T.textDim, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.checked }))}
                  style={{ accentColor: f.color, width: 15, height: 15 }}
                />
                {f.label}
              </label>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={addChannel}
              disabled={submitting || !form.name.trim() || !form.username.trim()}
              style={{
                background: T.accent, border: "none", color: "#fff",
                borderRadius: 8, padding: "9px 20px", cursor: "pointer",
                fontSize: 13, fontWeight: 700,
                opacity: (submitting || !form.name.trim() || !form.username.trim()) ? 0.5 : 1,
              }}
            >
              {submitting ? "שומר..." : "הוסף ערוץ"}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              style={{
                background: "none", border: `1px solid ${T.border}`, color: T.textDim,
                borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13,
              }}
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.7)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{
            background: T.panel, border: `1px solid ${T.border}`,
            borderRadius: 14, padding: "28px 32px", maxWidth: 340, textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🗑️</div>
            <div style={{ color: T.text, fontSize: 15, fontWeight: 700, marginBottom: 8 }}>מחיקת ערוץ</div>
            <div style={{ color: T.textDim, fontSize: 13, marginBottom: 24 }}>האם אתה בטוח? פעולה זו אינה הפיכה.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={confirmDelete}
                style={{
                  background: T.red, border: "none", color: "#fff",
                  borderRadius: 8, padding: "9px 20px", cursor: "pointer",
                  fontSize: 13, fontWeight: 700,
                }}
              >
                מחק
              </button>
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  background: "none", border: `1px solid ${T.border}`, color: T.textDim,
                  borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13,
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggested channels */}
      <div style={{ marginBottom: 28 }}>
        {/* Section header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
          <div>
            <span style={{ color: T.text, fontSize: 15, fontWeight: 700 }}>⭐ ערוצים מומלצים</span>
            {suggestedUpdated && (
              <span style={{ color: T.textFaint, fontSize: 11, marginRight: 10 }}>
                עודכן לאחרונה: {suggestedUpdated}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={clearSuggestedCache}
              style={{
                background: "none", border: `1px solid ${T.red}66`,
                color: T.red, borderRadius: 8, padding: "7px 14px",
                cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              🗑 נקה רשימה
            </button>
            <button
              onClick={searchNewChannels}
              style={{
                background: T.card, border: `1px solid ${T.border}`,
                color: T.accentHi, borderRadius: 8, padding: "7px 14px",
                cursor: "pointer", fontSize: 13, fontWeight: 600,
              }}
            >
              🔍 חפש ערוצים חדשים
            </button>
          </div>
        </div>

        {/* Search tip */}
        {showSearchTip && (
          <div style={{
            background: "#1e3a5f33", border: `1px solid ${T.accentHi}44`,
            borderRadius: 8, padding: "10px 14px", marginBottom: 12,
            color: T.textDim, fontSize: 13, lineHeight: 1.6,
          }}>
            💡 כדי להוסיף ערוצים נוספים, חפש ידנית בטלגרם והוסף אותם דרך כפתור <strong style={{ color: T.text }}>➕ ערוץ חדש</strong> למעלה.
          </div>
        )}

        {/* Cards grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 10,
        }}>
          {suggested.map((ch) => {
            const alreadyAdded = channels.some(
              c => c.username.toLowerCase() === ch.username.toLowerCase()
            );
            return (
              <div key={ch.username} style={{
                background: T.panel,
                border: `1px solid ${alreadyAdded ? T.green + "44" : T.border}`,
                borderRadius: 10, padding: "12px 14px",
                display: "flex", flexDirection: "column", gap: 6,
                opacity: alreadyAdded ? 0.6 : 1,
              }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>
                  {ch.name}
                </div>
                <div style={{ color: T.accentHi, fontSize: 12, fontFamily: "monospace", direction: "ltr" }}>
                  @{ch.username}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <PlatformBadge platform={ch.platform} />
                  <span style={{
                    background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: 5, padding: "2px 7px",
                    color: T.textDim, fontSize: 11,
                  }}>
                    {ch.category || "—"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2, flexWrap: "wrap" }}>
                  <a
                    href={`https://t.me/${ch.username}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: "none",
                      border: `1px solid #229ed966`,
                      color: "#229ed9",
                      borderRadius: 6, padding: "4px 10px",
                      fontSize: 12, fontWeight: 600,
                      textDecoration: "none", whiteSpace: "nowrap",
                    }}
                  >
                    ✈️ הצטרף בטלגרם
                  </a>
                  {isAdmin && (
                    alreadyAdded ? (
                      <span style={{ color: T.green, fontSize: 11, fontWeight: 700 }}>✓ נוסף</span>
                    ) : (
                      <button
                        onClick={() => {
                          setForm({ ...EMPTY_FORM, name: ch.name, username: ch.username, category: ch.category || "" });
                          setShowForm(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        style={{
                          background: T.accent, border: "none", color: "#fff",
                          borderRadius: 6, padding: "4px 10px",
                          cursor: "pointer", fontSize: 12, fontWeight: 700,
                        }}
                      >
                        ➕ הוסף
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{
          display: "grid", gridTemplateColumns: colTemplate,
          padding: "10px 16px", background: T.card,
          borderBottom: `1px solid ${T.border}`,
        }}>
          {["שם", "שם משתמש", "פלטפורמה", "קטגוריה", "פעיל", "חבר", "הערות", ...(isAdmin ? [""] : [])].map((h, i) => (
            <div key={i} style={{ color: T.textFaint, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>{h}</div>
          ))}
        </div>

        {loading && (
          <div style={{ padding: 40, textAlign: "center", color: T.textDim }}>טוען...</div>
        )}

        {!loading && channels.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: T.textDim }}>
            אין ערוצים.{isAdmin && " לחץ על ״ערוץ חדש״ להוספה."}
          </div>
        )}

        {!loading && channels.map((ch, i) => (
          <div key={ch.id}>
            {/* Main row */}
            <div style={{
              display: "grid", gridTemplateColumns: colTemplate,
              padding: "12px 16px", alignItems: "center",
              background: i % 2 === 0 ? T.panel : T.card + "80",
              borderBottom: editId === ch.id ? "none" : `1px solid ${T.border}`,
              opacity: saving === ch.id ? 0.6 : 1, transition: "opacity .2s",
            }}>
              {/* Name */}
              <div style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{ch.name}</div>

              {/* Username */}
              <div style={{ color: T.accentHi, fontSize: 12, fontFamily: "monospace", direction: "ltr" }}>
                @{ch.username}
              </div>

              {/* Platform */}
              <div><PlatformBadge platform={ch.platform} /></div>

              {/* Category */}
              <div style={{ color: T.textDim, fontSize: 12 }}>{ch.category || "—"}</div>

              {/* is_active */}
              <div>
                {isAdmin ? (
                  <Toggle on={!!ch.is_active} onChange={val => toggleActive(ch.id, val)} />
                ) : (
                  <span style={{
                    background: ch.is_active ? T.green + "22" : T.muted + "22",
                    color:      ch.is_active ? T.green       : T.muted,
                    border:    `1px solid ${ch.is_active ? T.green + "44" : T.muted + "44"}`,
                    borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                  }}>
                    {ch.is_active ? "פעיל" : "לא פעיל"}
                  </span>
                )}
              </div>

              {/* is_member */}
              <div>
                {isAdmin ? (
                  <Toggle on={!!ch.is_member} onChange={val => toggleMember(ch.id, val)} />
                ) : (
                  <span style={{
                    background: ch.is_member ? T.accentHi + "22" : T.muted + "22",
                    color:      ch.is_member ? T.accentHi       : T.muted,
                    border:    `1px solid ${ch.is_member ? T.accentHi + "44" : T.muted + "44"}`,
                    borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                  }}>
                    {ch.is_member ? "חבר" : "לא חבר"}
                  </span>
                )}
              </div>

              {/* Notes */}
              <div style={{
                color: T.textFaint, fontSize: 12,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {ch.notes || "—"}
              </div>

              {/* Edit + Delete (admin only) */}
              {isAdmin && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => editId === ch.id ? setEditId(null) : startEdit(ch)}
                    title="ערוך"
                    style={{
                      background: editId === ch.id ? T.accent + "33" : "none",
                      border: `1px solid ${editId === ch.id ? T.accent : T.border}`,
                      color: editId === ch.id ? T.accentHi : T.textDim,
                      borderRadius: 6, padding: "4px 7px",
                      cursor: "pointer", fontSize: 13, lineHeight: 1,
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleteId(ch.id)}
                    title="מחק ערוץ"
                    style={{
                      background: "none", border: `1px solid ${T.border}`,
                      color: T.red, borderRadius: 6, padding: "4px 7px",
                      cursor: "pointer", fontSize: 13, lineHeight: 1,
                    }}
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>

            {/* Inline edit row */}
            {isAdmin && editId === ch.id && (
              <div style={{
                background: T.card, borderBottom: `1px solid ${T.border}`,
                padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end",
              }}>
                {[
                  { key: "name",     label: "שם",       width: "200px" },
                  { key: "category", label: "קטגוריה",  width: "130px" },
                  { key: "notes",    label: "הערות",    width: "200px" },
                ].map(f => (
                  <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <label style={{ color: T.textFaint, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" }}>
                      {f.label}
                    </label>
                    <input
                      value={editForm[f.key]}
                      onChange={e => setEditForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{
                        width: f.width, background: T.panel, border: `1px solid ${T.border}`,
                        borderRadius: 6, padding: "6px 10px", color: T.text,
                        fontSize: 13, outline: "none",
                      }}
                    />
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={saveEdit}
                    disabled={!editForm.name.trim() || saving === ch.id}
                    style={{
                      background: T.accent, border: "none", color: "#fff",
                      borderRadius: 6, padding: "7px 14px", cursor: "pointer",
                      fontSize: 13, fontWeight: 700,
                      opacity: !editForm.name.trim() || saving === ch.id ? 0.5 : 1,
                    }}
                  >
                    {saving === ch.id ? "שומר..." : "שמור"}
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    style={{
                      background: "none", border: `1px solid ${T.border}`, color: T.textDim,
                      borderRadius: 6, padding: "7px 12px", cursor: "pointer", fontSize: 13,
                    }}
                  >
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
