/* Wabee Inbox — main app shell, sidebar list, orchestration, tweaks. */
const { useState, useEffect, useMemo, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comoda",
  "primary": "#9524E3",
  "expressive": true,
  "monoMeta": true,
  "openContact": false
}/*EDITMODE-END*/;

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "ai", label: "IA activa" },
  { id: "priority", label: "Prioridad" },
  { id: "mine", label: "Para mí" },
  { id: "unassigned", label: "Sin asignar" },
  { id: "closed", label: "Cerrados" },
];

function relTimeShort(iso) {
  const d = new Date(iso); if (isNaN(d)) return "";
  const now = new Date(); const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === y.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }).replace(".", "");
}

/* ============== Conversation row ============== */
function ThreadRow({ thread, agents, selected, compact, expressive, onClick }) {
  const hasUnread = thread.unread > 0;
  const av = compact ? 38 : 44;
  const mineAgent = agents.find((a) => a.id === thread.assignedTo);
  const preview = thread.lastPreview;

  return (
    <button onClick={onClick} className="wb-row" data-sel={selected ? "1" : ""}
      style={{
        width: "100%", textAlign: "left", display: "flex", gap: 12, alignItems: "flex-start",
        padding: compact ? "9px 12px 9px 13px" : "12px 12px 12px 13px",
        borderRadius: "var(--r-md)", position: "relative", transition: "background .14s",
        background: selected ? "var(--accent-06)" : "transparent",
        boxShadow: selected ? "inset 3px 0 0 0 var(--accent)" : "none",
      }}>
      <div style={{ position: "relative" }}>
        <Avatar initials={thread.initials} size={av} online={thread.online} accent={selected || (expressive && hasUnread)} />
        {/* mode indicator dot */}
        <ModeDot mode={thread.mode} aiPaused={thread.aiPaused} priority={thread.mode === "priority"} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span className="t-strong14" style={{
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            color: selected ? "var(--accent-strong)" : "var(--ink)", fontWeight: hasUnread ? 700 : 600,
          }}>{thread.name}</span>
          <span className="t-mono" style={{ flexShrink: 0, fontSize: 10.5, color: hasUnread ? "var(--accent)" : "var(--ink-3)", fontWeight: hasUnread ? 600 : 500 }}>{relTimeShort(thread.time)}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}>
          <span className="t-sec" style={{
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
            color: hasUnread ? "var(--ink-2)" : "var(--ink-3)", fontWeight: hasUnread ? 500 : 400,
          }}>{preview}</span>
          {hasUnread && (
            <span style={{
              flexShrink: 0, minWidth: 18, height: 18, padding: "0 5px", borderRadius: "var(--r-full)",
              background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>{thread.unread}</span>
          )}
        </div>

        {!compact && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, flexWrap: "nowrap", overflow: "hidden" }}>
            <RowTag mode={thread.mode} aiPaused={thread.aiPaused} />
            {thread.assignedTo === "me" && <MiniTag label="Mío" kind="accent" />}
            {mineAgent && thread.assignedTo !== "me" && <MiniTag label={mineAgent.initials} kind="muted" />}
            {thread.status === "CLOSED" && <MiniTag label="Cerrado" kind="muted" />}
            {thread.source === "campaign" && <MiniTag label="Campaña" kind="warn" />}
          </div>
        )}
      </div>
    </button>
  );
}

function ModeDot({ mode, aiPaused }) {
  let color;
  if (mode === "human_queue") color = "var(--orange)";
  else if (mode === "ai") color = "var(--yellow)";
  else return null;
  return (
    <span style={{
      position: "absolute", top: -1, right: -1, width: 14, height: 14, borderRadius: "var(--r-full)",
      background: "var(--surface)", border: "2px solid var(--surface)", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ width: 9, height: 9, borderRadius: "var(--r-full)", background: color,
        animation: mode === "human_queue" ? "pulseDot 1.6s infinite" : "none" }} />
    </span>
  );
}

function RowTag({ mode, aiPaused }) {
  if (mode === "human_queue") return <MiniTag label="En cola" kind="warn" icon={<Icons.alert size={10} />} />;
  if (mode === "ai") return <MiniTag label="IA" kind="ai" icon={<Icons.zap size={10} />} />;
  if (mode === "human") return <MiniTag label={aiPaused ? "Humano" : "Humano"} kind="accent" icon={<Icons.user size={10} />} />;
  return null;
}

function MiniTag({ label, kind, icon }) {
  const map = {
    accent: { c: "var(--accent)", b: "var(--accent-06)", bd: "var(--accent-14)" },
    warn: { c: "var(--orange)", b: "var(--orange-10)", bd: "var(--orange-22)" },
    ai: { c: "var(--ink-2)", b: "var(--yellow-14)", bd: "rgba(26,26,26,.08)" },
    muted: { c: "var(--ink-3)", b: "rgba(26,26,26,.04)", bd: "var(--line-2)" },
  };
  const s = map[kind];
  return <span style={{
    display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: "var(--r-full)",
    background: s.b, color: s.c, border: "1px solid " + s.bd, fontSize: 9.5, fontWeight: 700,
    letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0,
  }}>{icon}{label}</span>;
}

/* ============== Channel rail ============== */
function ChannelRail({ channels, active, onSelect }) {
  return (
    <nav style={{
      width: 60, flexShrink: 0, background: "var(--rail)", borderRight: "1px solid var(--line)",
      display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 0", gap: 12,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: "var(--r-md)", background: "var(--accent)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, boxShadow: "var(--sh-2)" }}>W</div>
      <div style={{ width: 24, height: 1, background: "var(--line-2)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {channels.map((c) => (
          <button key={c.id} onClick={() => onSelect(c.id)} title={c.name} className="wb-chan"
            style={{
              width: 40, height: 40, borderRadius: "var(--r-md)", position: "relative",
              background: active === c.id ? "var(--surface)" : "transparent",
              border: "1px solid " + (active === c.id ? "var(--accent-14)" : "transparent"),
              boxShadow: active === c.id ? "var(--sh-1)" : "none",
              color: active === c.id ? "var(--accent)" : "var(--ink-3)",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, transition: "all .15s",
            }}>
            {c.short}
            <span style={{ position: "absolute", bottom: 3, right: 3, width: 7, height: 7, borderRadius: 99,
              background: c.online ? "#22A45D" : "var(--ink-4)", border: "1.5px solid " + (active === c.id ? "var(--surface)" : "var(--rail)") }} />
          </button>
        ))}
      </div>
      <button className="wb-chan" title="Tu perfil" style={{ width: 40, height: 40, borderRadius: "var(--r-full)" }}>
        <Avatar initials="JE" size={36} />
      </button>
    </nav>
  );
}

/* ============== Sidebar (list + header + filters) ============== */
function Sidebar({ threads, agents, filter, setFilter, search, setSearch, selectedId, onSelect, counts, compact, expressive, full }) {
  return (
    <aside style={{
      width: full ? "100%" : 344, flexShrink: 0, background: "var(--surface)", borderRight: "1px solid var(--line)",
      display: "flex", flexDirection: "column", height: "100%",
    }}>
      {/* header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 className="t-h" style={{ margin: 0 }}>Mensajes</h1>
            <p className="t-meta" style={{ margin: "2px 0 0", color: "var(--ink-3)" }}>
              {counts.visible} conversaciones · {counts.unread} sin leer
            </p>
          </div>
          <button className="wb-icon" style={{ ...iconBtn, border: "1px solid var(--line-2)" }} title="Nueva conversación"><Icons.plus size={18} /></button>
        </div>

        {/* search */}
        <div className="wb-search" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 9, padding: "0 12px", height: 38,
          background: "var(--canvas)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", transition: "border .15s" }}>
          <span style={{ color: "var(--ink-3)", display: "flex" }}><Icons.search size={16} /></span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversaciones…"
            className="t-body" style={{ flex: 1, border: "none", background: "transparent", outline: "none", color: "var(--ink)" }} />
          {search && <button onClick={() => setSearch("")} style={{ color: "var(--ink-3)", display: "flex" }}><Icons.x size={14} /></button>}
        </div>
      </div>

      {/* filter chips */}
      <div className="scroll no-scrollbar" style={{ display: "flex", gap: 7, padding: "12px 16px", overflowX: "auto", flexShrink: 0, borderBottom: "1px solid var(--line)" }}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          const n = counts.byFilter[f.id];
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} className="wb-chip"
              style={{
                flexShrink: 0, height: 30, padding: "0 11px", borderRadius: "var(--r-full)", display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 12.5, fontWeight: 600, transition: "all .14s", whiteSpace: "nowrap",
                background: on ? "var(--accent)" : "var(--canvas)", color: on ? "#fff" : "var(--ink-2)",
                border: "1px solid " + (on ? "var(--accent)" : "var(--line-2)"),
              }}>
              {f.label}
              {n > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "0 5px", minWidth: 16, height: 16, borderRadius: 99,
                background: on ? "rgba(255,255,255,.22)" : "rgba(26,26,26,.06)", color: on ? "#fff" : "var(--ink-3)",
                display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{n}</span>}
            </button>
          );
        })}
      </div>

      {/* list */}
      <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "8px 8px 16px" }}>
        {threads.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", textAlign: "center", color: "var(--ink-4)", gap: 12 }}>
            <Icons.inbox size={30} /><span className="t-sec">No hay conversaciones en este filtro.</span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {threads.map((t) => (
              <ThreadRow key={t.id} thread={t} agents={agents} selected={selectedId === t.id}
                compact={compact} expressive={expressive} onClick={() => onSelect(t.id)} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

/* ============== App ============== */
function App() {
  const data = window.WABEE_DATA;
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [threads, setThreads] = useState(() => data.threads.map((x) => ({ ...x })));
  const [msgMap, setMsgMap] = useState(() => JSON.parse(JSON.stringify(data.messages)));
  const [noteMap, setNoteMap] = useState(() => JSON.parse(JSON.stringify(data.notes)));
  const [channels] = useState([
    { id: "c1", name: "Ventas MX", short: "VM", online: true },
    { id: "c2", name: "Soporte", short: "SO", online: true },
    { id: "c3", name: "Marketing", short: "MK", online: false },
  ]);
  const [activeChannel, setActiveChannel] = useState("c1");
  const [selectedId, setSelectedId] = useState("t1");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [contactOpen, setContactOpen] = useState(t.openContact);
  const [notesOpen, setNotesOpen] = useState(false);
  const [width, setWidth] = useState(window.innerWidth);
  const [tabletView, setTabletView] = useState("list"); // list | chat
  const scrollRef = useRef(null);

  // apply accent + density to :root
  useEffect(() => {
    const r = document.documentElement.style;
    const p = t.primary;
    r.setProperty("--accent", p);
    r.setProperty("--accent-06", `color-mix(in srgb, ${p} 6%, white)`);
    r.setProperty("--accent-10", `color-mix(in srgb, ${p} 10%, white)`);
    r.setProperty("--accent-14", `color-mix(in srgb, ${p} 18%, white)`);
    r.setProperty("--accent-22", `color-mix(in srgb, ${p} 26%, white)`);
    r.setProperty("--accent-strong", `color-mix(in srgb, ${p} 84%, black)`);
  }, [t.primary]);

  useEffect(() => {
    document.body.classList.toggle("mono-off", !t.monoMeta);
  }, [t.monoMeta]);

  useEffect(() => { setContactOpen(t.openContact); }, [t.openContact]);

  useEffect(() => {
    const onR = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  const tablet = width < 1024;
  const compact = t.density === "compacta";

  const active = threads.find((x) => x.id === selectedId);
  const messages = active ? (msgMap[active.id] || []) : [];

  // auto-scroll to bottom on thread / message change
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selectedId, messages.length]);

  // filtering
  const visibleThreads = useMemo(() => {
    return threads.filter((th) => {
      if (search) {
        const q = search.toLowerCase();
        if (!th.name.toLowerCase().includes(q) && !th.phone.includes(search)) return false;
      }
      if (filter === "closed") return th.status === "CLOSED";
      if (th.status === "CLOSED") return false; // closed only show under Cerrados
      if (filter === "ai") return th.mode === "ai";
      if (filter === "priority") return th.mode === "human_queue";
      if (filter === "mine") return th.assignedTo === "me";
      if (filter === "unassigned") return !th.assignedTo;
      return true; // all
    });
  }, [threads, filter, search]);

  const counts = useMemo(() => {
    const open = threads.filter((x) => x.status !== "CLOSED");
    return {
      visible: visibleThreads.length,
      unread: threads.reduce((a, x) => a + (x.unread > 0 ? 1 : 0), 0),
      byFilter: {
        all: open.length,
        ai: threads.filter((x) => x.mode === "ai" && x.status !== "CLOSED").length,
        priority: threads.filter((x) => x.mode === "human_queue").length,
        mine: threads.filter((x) => x.assignedTo === "me" && x.status !== "CLOSED").length,
        unassigned: threads.filter((x) => !x.assignedTo && x.status !== "CLOSED").length,
        closed: threads.filter((x) => x.status === "CLOSED").length,
      },
    };
  }, [threads, visibleThreads]);

  // handlers
  const selectThread = (id) => {
    setSelectedId(id);
    setThreads((prev) => prev.map((x) => x.id === id ? { ...x, unread: 0 } : x));
    if (tablet) setTabletView("chat");
  };
  const take = () => setThreads((prev) => prev.map((x) => x.id === selectedId ? { ...x, assignedTo: "me", mode: "human", aiPaused: true } : x));
  const release = () => setThreads((prev) => prev.map((x) => x.id === selectedId ? { ...x, assignedTo: null, mode: "human_queue" } : x));
  const resumeAi = () => setThreads((prev) => prev.map((x) => x.id === selectedId ? { ...x, aiPaused: false, mode: "ai" } : x));
  const send = (text) => {
    const msg = { id: "u" + Date.now(), dir: "out", sender: "agent", text, time: new Date().toISOString() };
    setMsgMap((prev) => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), msg] }));
    setThreads((prev) => prev.map((x) => x.id === selectedId ? { ...x, lastPreview: "Tú: " + text, time: msg.time } : x));
  };
  const addNote = (text) => {
    const note = { id: "n" + Date.now(), author: "Tú", text, time: new Date().toISOString(), pinned: false };
    setNoteMap((prev) => ({ ...prev, [selectedId]: [...(prev[selectedId] || []), note] }));
  };

  const canReply = active && (active.assignedTo === "me");
  const showList = !tablet || tabletView === "list";
  const showChat = !tablet || tabletView === "chat";
  const panelOpen = contactOpen || notesOpen;

  return (
    <div className="app-stage">
      <div style={{ display: "flex", width: "100%", height: "100%", background: "var(--canvas)", overflow: "hidden", position: "relative" }}>
        {!tablet && <ChannelRail channels={channels} active={activeChannel} onSelect={setActiveChannel} />}

        {showList && (
          <Sidebar threads={visibleThreads} agents={data.agents} filter={filter} setFilter={setFilter}
            search={search} setSearch={setSearch} selectedId={selectedId} onSelect={selectThread}
            counts={counts} compact={compact} expressive={t.expressive} full={tablet} />
        )}

        {showChat && (
          <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100%", background: "var(--canvas)" }}>
            {active ? (
              <React.Fragment>
                <ChatHeader thread={active} agents={data.agents} onTake={take} onRelease={release}
                  contactOpen={contactOpen} notesOpen={notesOpen}
                  onToggleContact={() => { setContactOpen((v) => !v); setNotesOpen(false); }}
                  onToggleNotes={() => { setNotesOpen((v) => !v); setContactOpen(false); }}
                  onBack={() => setTabletView("list")} tablet={tablet} />
                {active.aiPaused && active.mode === "human" && <AiBanner onResume={resumeAi} />}
                <div ref={scrollRef} className="scroll" style={{ flex: 1, overflowY: "auto", padding: "20px 24px 8px", position: "relative" }}>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", minHeight: "100%" }}>
                    <DayDivider />
                    {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
                  </div>
                </div>
                <Composer canReply={canReply} onSend={send} />
              </React.Fragment>
            ) : <EmptyState />}
          </main>
        )}

        {/* side panels */}
        {!tablet && contactOpen && active && <ContactPanel thread={active} onClose={() => setContactOpen(false)} />}
        {!tablet && notesOpen && active && <NotesPanel thread={active} notes={noteMap[active.id] || []} onAdd={addNote} onClose={() => setNotesOpen(false)} />}

        {/* tablet: panels as overlay */}
        {tablet && panelOpen && active && (
          <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", justifyContent: "flex-end" }}>
            <div onClick={() => { setContactOpen(false); setNotesOpen(false); }} style={{ position: "absolute", inset: 0, background: "rgba(26,26,26,.28)" }} />
            <div style={{ position: "relative", height: "100%" }}>
              {contactOpen
                ? <ContactPanel thread={active} onClose={() => setContactOpen(false)} />
                : <NotesPanel thread={active} notes={noteMap[active.id] || []} onAdd={addNote} onClose={() => setNotesOpen(false)} />}
            </div>
          </div>
        )}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Densidad y marca" />
        <TweakRadio label="Densidad" value={t.density} options={["compacta", "comoda"]} onChange={(v) => setTweak("density", v)} />
        <TweakColor label="Color primario" value={t.primary} options={["#9524E3", "#FF8C00", "#1A1A1A"]} onChange={(v) => setTweak("primary", v)} />
        <TweakToggle label="Acento expresivo en lista" value={t.expressive} onChange={(v) => setTweak("expressive", v)} />
        <TweakSection label="Detalles" />
        <TweakToggle label="Metadatos monoespaciados" value={t.monoMeta} onChange={(v) => setTweak("monoMeta", v)} />
        <TweakToggle label="Abrir panel de contacto" value={t.openContact} onChange={(v) => setTweak("openContact", v)} />
      </TweaksPanel>
    </div>
  );
}

function DayDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "4px 0 16px" }}>
      <span className="t-meta" style={{ padding: "4px 12px", borderRadius: "var(--r-full)", background: "var(--surface)", border: "1px solid var(--line)", color: "var(--ink-3)", fontWeight: 600 }}>Hoy</span>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
