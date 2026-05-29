/* Wabee Inbox — chat area: header, message bubbles, composer. */
const fmtTime = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
};

/* ---------- Avatar (initials, charcoal ring, no yellow) ---------- */
function Avatar({ initials, size = 40, online, accent }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "var(--r-full)", flexShrink: 0, position: "relative",
      background: accent ? "var(--accent-10)" : "rgba(26,26,26,.05)",
      border: "1px solid var(--line-2)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: accent ? "var(--accent)" : "var(--ink-2)",
      fontWeight: 600, fontSize: size * 0.33, letterSpacing: ".01em",
    }}>
      {initials}
      {online && (
        <span style={{
          position: "absolute", bottom: -1, right: -1, width: size * 0.28, height: size * 0.28,
          minWidth: 9, minHeight: 9, borderRadius: "var(--r-full)", background: "#22A45D",
          border: "2px solid var(--surface)",
        }} />
      )}
    </div>
  );
}

/* ---------- Delivery status ticks ---------- */
function Ticks() {
  return <span style={{ color: "var(--accent)", display: "inline-flex", opacity: .85 }}><Icons.checks size={14} /></span>;
}

/* ---------- One message ---------- */
function MessageBubble({ m }) {
  const out = m.dir === "out";

  // Handoff system divider
  if (m.handoff) {
    return (
      <React.Fragment>
        <Bubble m={m} out={out} />
        <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 10px" }}>
          <span className="t-meta" style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
            borderRadius: "var(--r-full)", background: "var(--accent-06)", color: "var(--accent)",
            border: "1px solid var(--accent-14)", fontWeight: 600,
          }}>
            <Icons.hand size={13} /> Transferido a un agente humano
          </span>
        </div>
      </React.Fragment>
    );
  }
  return <Bubble m={m} out={out} />;
}

function Bubble({ m, out }) {
  const isCampaign = m.sender === "system" && m.campaign;

  // Campaign / template card
  if (isCampaign) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <div style={{
          maxWidth: "min(560px, 72%)", background: "var(--surface)", border: "1px solid var(--line-2)",
          borderRadius: "var(--r-lg)", borderBottomRightRadius: var6(), overflow: "hidden", boxShadow: "var(--sh-2)",
        }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,var(--orange),var(--yellow))" }} />
          <div style={{ padding: "14px 16px 12px" }}>
            <span className="t-eyebrow" style={{
              display: "inline-block", color: "var(--orange)", background: "var(--orange-10)",
              padding: "3px 8px", borderRadius: "var(--r-xs)", marginBottom: 10,
            }}>Promo · {m.campaign}</span>
            <div className="t-title" style={{ marginBottom: 6, color: "var(--ink)" }}>{m.text}</div>
            <p className="t-body" style={{ margin: 0, color: "var(--ink-2)", whiteSpace: "pre-wrap" }}
              dangerouslySetInnerHTML={{ __html: mdLite(m.body) }} />
            {m.footer && <div className="t-meta" style={{ marginTop: 10, color: "var(--ink-3)" }}>{m.footer}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 5, marginTop: 8 }}>
              <span className="t-mono" style={{ color: "var(--ink-3)" }}>{fmtTime(m.time)}</span><Ticks />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const senderTag = out && (m.sender === "ai" ? "ai" : m.sender === "system" ? "system" : null);

  return (
    <div style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start", marginBottom: 10 }}>
      <div style={{
        maxWidth: "min(620px, 74%)", minWidth: 96,
        background: out ? "var(--accent-06)" : "var(--surface)",
        border: out ? "1px solid var(--accent-14)" : "1px solid var(--line-2)",
        borderRadius: "var(--r-lg)",
        borderBottomRightRadius: out ? var6() : "var(--r-lg)",
        borderBottomLeftRadius: out ? "var(--r-lg)" : var6(),
        padding: "9px 13px 7px", boxShadow: "var(--sh-1)", position: "relative",
      }}>
        {senderTag === "ai" && (
          <span className="t-eyebrow" style={{
            display: "inline-flex", alignItems: "center", gap: 4, color: "var(--ink)",
            background: "var(--yellow-14)", padding: "2px 7px", borderRadius: "var(--r-xs)", marginBottom: 6,
          }}><Icons.zap size={11} /> Asistente IA</span>
        )}
        <div className="t-msg" style={{ color: "var(--ink)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {m.link
            ? <a href="#!" onClick={(e)=>e.preventDefault()} style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>{m.text}</a>
            : m.text}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 5, marginTop: 3, marginLeft: 16, float: "right" }}>
          <span className="t-mono" style={{ color: "var(--ink-3)", fontSize: 10.5 }}>{fmtTime(m.time)}</span>
          {out && <Ticks />}
        </div>
        <div style={{ clear: "both" }} />
      </div>
    </div>
  );
}

function var6() { return "var(--r-xs)"; }

/* tiny markdown for *bold* */
function mdLite(t) {
  if (!t) return "";
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/\*(.+?)\*/g, "<strong style='font-weight:600'>$1</strong>");
}

/* ====================== CHAT HEADER ====================== */
function Btn({ kind = "ghost", children, active, ...p }) {
  const base = {
    height: 34, padding: "0 12px", borderRadius: "var(--r-sm)", display: "inline-flex",
    alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, transition: "all .15s", whiteSpace: "nowrap",
  };
  const styles = {
    primary: { background: "var(--accent)", color: "#fff", boxShadow: "var(--sh-1)" },
    secondary: { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line-2)" },
    warn: { background: "var(--surface)", color: "var(--orange)", border: "1px solid var(--orange-22)" },
    ghost: { background: active ? "var(--accent-10)" : "transparent", color: active ? "var(--accent)" : "var(--ink-2)", border: "1px solid " + (active ? "var(--accent-14)" : "var(--line-2)") },
  };
  return <button {...p} className={"wb-btn wb-btn-" + kind} style={{ ...base, ...styles[kind] }}>{children}</button>;
}

function ChatHeader({ thread, agents, onTake, onRelease, onReassign, contactOpen, notesOpen, onToggleContact, onToggleNotes, onBack, tablet }) {
  const accent = thread.assignedTo === "me" || thread.mode === "ai";
  const assignedAgent = agents.find((a) => a.id === thread.assignedTo);
  return (
    <header style={{
      height: 64, flexShrink: 0, background: "var(--surface)", borderBottom: "1px solid var(--line)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 16px 0 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {tablet && (
          <button className="wb-icon" onClick={onBack} style={iconBtn} title="Volver"><Icons.arrowLeft size={18} /></button>
        )}
        <Avatar initials={thread.initials} size={40} online={thread.online} accent />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 className="t-title" style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{thread.name}</h2>
            <ModePill mode={thread.mode} aiPaused={thread.aiPaused} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1 }}>
            <span className="t-mono" style={{ color: "var(--ink-3)" }}>{thread.phone}</span>
            {thread.online && <span className="t-meta" style={{ color: "#22A45D", display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: "#22A45D" }} />En línea</span>}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* assignment cluster */}
        {thread.assignedTo
          ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="t-meta" style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "0 10px", height: 34,
                borderRadius: "var(--r-sm)", background: thread.assignedTo === "me" ? "var(--accent-06)" : "rgba(26,26,26,.04)",
                color: thread.assignedTo === "me" ? "var(--accent)" : "var(--ink-2)", border: "1px solid " + (thread.assignedTo === "me" ? "var(--accent-14)" : "var(--line-2)"), fontWeight: 600,
              }}>
                <Avatar initials={assignedAgent ? assignedAgent.initials : "?"} size={18} />
                {!tablet && (thread.assignedTo === "me" ? "Asignado a mí" : assignedAgent && assignedAgent.name)}
              </span>
              <Btn kind="warn" onClick={onRelease}>Liberar</Btn>
            </div>
          : <Btn kind="primary" onClick={onTake}><Icons.hand size={15} /> {tablet ? "Tomar" : "Tomar chat"}</Btn>
        }
        <div style={{ width: 1, height: 24, background: "var(--line-2)" }} />
        <Btn kind="ghost" active={contactOpen} onClick={onToggleContact}><Icons.user size={15} /> {!tablet && "Contacto"}</Btn>
        <Btn kind="ghost" active={notesOpen} onClick={onToggleNotes}><Icons.note size={15} /> {!tablet && "Notas"}</Btn>
        <button className="wb-icon" style={iconBtn} title="Más acciones"><Icons.more size={18} /></button>
      </div>
    </header>
  );
}

const iconBtn = {
  width: 34, height: 34, borderRadius: "var(--r-sm)", display: "inline-flex", alignItems: "center",
  justifyContent: "center", color: "var(--ink-3)", border: "1px solid transparent", transition: "all .15s",
};

/* mode pill: AI / Cola / Humano */
function ModePill({ mode, aiPaused }) {
  let cfg;
  if (mode === "human_queue") cfg = { label: "En cola", color: "var(--orange)", bg: "var(--orange-10)", bd: "var(--orange-22)", icon: <Icons.alert size={11} /> };
  else if (mode === "human") cfg = { label: aiPaused ? "Humano · IA en pausa" : "Humano", color: "var(--accent)", bg: "var(--accent-06)", bd: "var(--accent-14)", icon: <Icons.user size={11} /> };
  else cfg = { label: "IA activa", color: "var(--ink-2)", bg: "var(--yellow-14)", bd: "rgba(26,26,26,.08)", icon: <Icons.zap size={11} /> };
  return (
    <span className="t-eyebrow" style={{
      display: "inline-flex", alignItems: "center", gap: 4, color: cfg.color, background: cfg.bg,
      border: "1px solid " + cfg.bd, padding: "2px 8px", borderRadius: "var(--r-full)", fontSize: 9.5,
    }}>{cfg.icon}{cfg.label}</span>
  );
}

/* ====================== COMPOSER ====================== */
function Composer({ canReply, onSend }) {
  const [val, setVal] = React.useState("");
  const ref = React.useRef(null);
  React.useEffect(() => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 132) + "px"; }, [val]);
  const submit = () => { if (!val.trim() || !canReply) return; onSend(val.trim()); setVal(""); };
  const key = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } };

  if (!canReply) {
    return (
      <div style={{ flexShrink: 0, background: "var(--surface)", borderTop: "1px solid var(--line)", padding: "16px 20px" }}>
        <div className="t-body" style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 46,
          borderRadius: "var(--r-md)", background: "var(--canvas)", border: "1px dashed var(--line-2)", color: "var(--ink-3)",
        }}><Icons.hand size={16} /> Toma el chat para poder responder</div>
      </div>
    );
  }

  return (
    <div style={{ flexShrink: 0, background: "var(--surface)", borderTop: "1px solid var(--line)", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <button className="wb-icon" style={iconBtn} title="Emoji"><Icons.smile size={20} /></button>
        <button className="wb-icon" style={iconBtn} title="Adjuntar"><Icons.clip size={20} /></button>
        <div style={{
          flex: 1, display: "flex", alignItems: "flex-end", background: "var(--canvas)",
          border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", padding: "8px 14px", transition: "border .15s",
        }} className="wb-composer">
          <textarea ref={ref} rows={1} value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={key}
            placeholder="Escribe un mensaje…" className="t-body scroll"
            style={{ flex: 1, resize: "none", border: "none", background: "transparent", outline: "none", color: "var(--ink)", maxHeight: 132, lineHeight: 1.5, padding: "3px 0" }} />
        </div>
        <button onClick={submit} disabled={!val.trim()} title="Enviar" style={{
          width: 44, height: 44, borderRadius: "var(--r-md)", display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: val.trim() ? "var(--accent)" : "var(--canvas)", color: val.trim() ? "#fff" : "var(--ink-4)",
          border: val.trim() ? "none" : "1px solid var(--line-2)", transition: "all .15s", boxShadow: val.trim() ? "var(--sh-2)" : "none",
        }} className="wb-send"><Icons.send size={19} /></button>
      </div>
    </div>
  );
}

Object.assign(window, { Avatar, MessageBubble, ChatHeader, Composer, Btn, ModePill, fmtTime, iconBtn });
