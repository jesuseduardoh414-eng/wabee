/* Wabee Inbox — side panels (contact / notes), empty state, AI banner. */

function PanelShell({ title, icon, onClose, children, footer }) {
  return (
    <aside style={{
      width: 320, flexShrink: 0, background: "var(--surface)", borderLeft: "1px solid var(--line)",
      display: "flex", flexDirection: "column", height: "100%",
    }}>
      <div style={{ height: 64, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px 0 18px", borderBottom: "1px solid var(--line)" }}>
        <span className="t-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ink-2)" }}>{icon}{title}</span>
        <button className="wb-icon" onClick={onClose} style={iconBtn} title="Cerrar"><Icons.x size={16} /></button>
      </div>
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: 18 }}>{children}</div>
      {footer}
    </aside>
  );
}

/* ---------------- Contact panel ---------------- */
function ContactPanel({ thread, onClose }) {
  const fields = [
    { k: "Teléfono", v: thread.phone, mono: true },
    { k: "Canal", v: thread.channel },
    { k: "Etapa", v: thread.value },
    { k: "Origen", v: thread.source === "campaign" ? "Campaña" : "WhatsApp" },
  ];
  return (
    <PanelShell title="Contacto" icon={<Icons.user size={14} />} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingBottom: 18, borderBottom: "1px solid var(--line)" }}>
        <Avatar initials={thread.initials} size={64} online={thread.online} accent />
        <h3 className="t-h" style={{ margin: "12px 0 2px" }}>{thread.name}</h3>
        <span className="t-mono" style={{ color: "var(--ink-3)" }}>{thread.phone}</span>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn kind="secondary"><Icons.phone size={14} /> Llamar</Btn>
          <Btn kind="secondary"><Icons.tag size={14} /> Etiquetar</Btn>
        </div>
      </div>

      <div style={{ padding: "16px 0", borderBottom: "1px solid var(--line)" }}>
        <span className="t-eyebrow" style={{ color: "var(--ink-3)", display: "block", marginBottom: 12 }}>Detalles</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {fields.map((f) => (
            <div key={f.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <span className="t-sec" style={{ color: "var(--ink-3)" }}>{f.k}</span>
              <span className={f.mono ? "t-mono" : "t-strong14"} style={{ color: "var(--ink)", textAlign: "right" }}>{f.v}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 0" }}>
        <span className="t-eyebrow" style={{ color: "var(--ink-3)", display: "block", marginBottom: 12 }}>Etiquetas</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {thread.tags.map((t) => <Chip key={t}>{t}</Chip>)}
          <button className="t-meta" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: "var(--r-full)", border: "1px dashed var(--line-strong)", color: "var(--ink-3)", fontWeight: 600 }}><Icons.plus size={12} /> Añadir</button>
        </div>
      </div>
    </PanelShell>
  );
}

function Chip({ children }) {
  return <span className="t-meta" style={{ padding: "5px 11px", borderRadius: "var(--r-full)", background: "var(--accent-06)", color: "var(--accent)", border: "1px solid var(--accent-14)", fontWeight: 600 }}>{children}</span>;
}

/* ---------------- Notes panel ---------------- */
function NotesPanel({ thread, notes, onAdd, onClose }) {
  const [val, setVal] = React.useState("");
  const submit = (e) => { e.preventDefault(); if (!val.trim()) return; onAdd(val.trim()); setVal(""); };
  const sorted = [...notes].sort((a, b) => (a.pinned === b.pinned ? new Date(b.time) - new Date(a.time) : a.pinned ? -1 : 1));
  return (
    <PanelShell title="Notas internas" icon={<Icons.note size={14} />} onClose={onClose}
      footer={
        <form onSubmit={submit} style={{ flexShrink: 0, borderTop: "1px solid var(--line)", padding: 14, display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea value={val} onChange={(e) => setVal(e.target.value)} rows={2} placeholder="Escribe una nota privada…" className="t-body scroll"
            style={{ flex: 1, resize: "none", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", padding: "8px 11px", outline: "none", background: "var(--canvas)", color: "var(--ink)", maxHeight: 90 }} />
          <button type="submit" disabled={!val.trim()} title="Guardar nota" style={{ width: 40, height: 40, borderRadius: "var(--r-md)", background: val.trim() ? "var(--accent)" : "var(--canvas)", color: val.trim() ? "#fff" : "var(--ink-4)", border: val.trim() ? "none" : "1px solid var(--line-2)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icons.plus size={18} /></button>
        </form>
      }>
      {sorted.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", color: "var(--ink-4)", gap: 12 }}>
          <Icons.note size={32} />
          <span className="t-sec">Aún no hay notas internas.<br />Solo tu equipo puede verlas.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((n) => (
            <div key={n.id} style={{
              background: n.pinned ? "var(--yellow-14)" : "var(--canvas)", border: "1px solid " + (n.pinned ? "rgba(26,26,26,.08)" : "var(--line)"),
              borderRadius: "var(--r-md)", padding: 13,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span className="t-meta" style={{ fontWeight: 600, color: "var(--ink-2)" }}>{n.author}</span>
                {n.pinned && <span style={{ color: "var(--ink-2)" }}><Icons.pin size={13} /></span>}
              </div>
              <p className="t-body" style={{ margin: 0, color: "var(--ink)" }}>{n.text}</p>
              <span className="t-mono" style={{ color: "var(--ink-3)", marginTop: 8, display: "block", fontSize: 10.5 }}>{relTime(n.time)}</span>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function relTime(iso) {
  const d = new Date(iso), now = new Date();
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const h = Math.floor(mins / 60); if (h < 24) return `Hace ${h} h`;
  const days = Math.floor(h / 24); return days === 1 ? "Ayer" : `Hace ${days} días`;
}

/* ---------------- AI paused banner ---------------- */
function AiBanner({ onResume }) {
  return (
    <div style={{
      flexShrink: 0, background: "var(--orange-10)", borderBottom: "1px solid var(--orange-22)",
      padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <span className="t-sec" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ink-2)", fontWeight: 500 }}>
        <span style={{ color: "var(--orange)", display: "inline-flex" }}><Icons.zap size={15} /></span>
        IA en pausa — atención humana activa en esta conversación.
      </span>
      <button onClick={onResume} className="t-meta" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "var(--r-sm)", background: "var(--surface)", color: "var(--orange)", border: "1px solid var(--orange-22)", fontWeight: 600, whiteSpace: "nowrap" }}>
        <Icons.zap size={13} /> Reanudar IA
      </button>
    </div>
  );
}

/* ---------------- Empty state ---------------- */
function EmptyState() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 32, background: "var(--canvas)" }}>
      <div style={{ width: 72, height: 72, borderRadius: "var(--r-lg)", background: "var(--surface)", border: "1px solid var(--line-2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", boxShadow: "var(--sh-2)", marginBottom: 20 }}>
        <Icons.msg size={32} />
      </div>
      <h2 className="t-h" style={{ margin: "0 0 8px" }}>Selecciona una conversación</h2>
      <p className="t-body" style={{ margin: 0, maxWidth: 320, color: "var(--ink-3)" }}>
        Empieza por la bandeja de prioridad o por tus conversaciones asignadas para atender, dar seguimiento y colaborar con tu equipo.
      </p>
    </div>
  );
}

Object.assign(window, { ContactPanel, NotesPanel, AiBanner, EmptyState, Chip, PanelShell, relTime });
