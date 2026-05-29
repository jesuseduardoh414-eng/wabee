/* Wabee Inbox — icon set (stroke, lucide-style). Exports to window. */
function Ico({ d, size = 16, sw = 1.75, fill = "none", style, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
      stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, display: "block", ...style }}>
      {children || <path d={d} />}
    </svg>
  );
}

const Icons = {
  search: (p) => <Ico {...p} d="M21 21l-4.3-4.3M11 18a7 7 0 110-14 7 7 0 010 14z" sw={2} />,
  bot: (p) => <Ico {...p}><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 8V4M9 3h6M8.5 13v1.5M15.5 13v1.5" /></Ico>,
  zap: (p) => <Ico {...p} fill="currentColor" sw={0}><path d="M13 2L4.5 13.2c-.4.5 0 1.3.7 1.3H11l-1 7.5c-.1.8.9 1.2 1.4.6L20 11.4c.4-.5 0-1.3-.7-1.3H13l1-7.5c.1-.8-.9-1.2-1.3-.6z" /></Ico>,
  sparkles: (p) => <Ico {...p}><path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4zM18 15l.7 1.9L20.5 17.6 18.7 18.3 18 20l-.7-1.7-1.8-.7 1.8-.7L18 15z" /></Ico>,
  clock: (p) => <Ico {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></Ico>,
  check: (p) => <Ico {...p} d="M4 12.5l5 5L20 6.5" sw={2.2} />,
  checks: (p) => <Ico {...p} sw={2.2}><path d="M2 13l4.5 4.5L15 9" /><path d="M9.5 15.6L11 17l8-8" /></Ico>,
  user: (p) => <Ico {...p}><circle cx="12" cy="8" r="4" /><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" /></Ico>,
  note: (p) => <Ico {...p}><path d="M5 4.5h14a1 1 0 011 1V15l-5 4.5H6a1 1 0 01-1-1V4.5z" /><path d="M19.5 15H15v4.4M8 9h8M8 12.5h5" /></Ico>,
  clip: (p) => <Ico {...p} d="M20 11.5l-7.6 7.6a4.5 4.5 0 11-6.4-6.4l8-8a3 3 0 114.2 4.2l-8 8a1.5 1.5 0 11-2.1-2.1l7.3-7.3" />,
  smile: (p) => <Ico {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8M9 9.5h.01M15 9.5h.01" /></Ico>,
  send: (p) => <Ico {...p} fill="currentColor" sw={0}><path d="M3.4 20.4l17.4-7.5c.9-.4.9-1.6 0-2L3.4 3.6c-.8-.3-1.6.4-1.4 1.3L3.6 11l9 1-9 1-1.6 6.1c-.2.9.6 1.6 1.4 1.3z" /></Ico>,
  arrowLeft: (p) => <Ico {...p} d="M14 6l-6 6 6 6" sw={2} />,
  inbox: (p) => <Ico {...p}><path d="M3 12h5l2 3h4l2-3h5" /><path d="M5.5 5h13l2.5 7v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6l2.5-7z" /></Ico>,
  more: (p) => <Ico {...p} fill="currentColor" sw={0}><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></Ico>,
  phone: (p) => <Ico {...p} d="M6.5 4h-2A1.5 1.5 0 003 5.6C3.3 13 9 18.7 16.4 19a1.5 1.5 0 001.6-1.5v-2a1 1 0 00-.8-1l-2.6-.5a1 1 0 00-1 .4l-.8 1a11 11 0 01-4.9-4.9l1-.8a1 1 0 00.4-1L8.4 4.8a1 1 0 00-1-.8z" />,
  tag: (p) => <Ico {...p}><path d="M3 11.5V5a2 2 0 012-2h6.5a2 2 0 011.4.6l7 7a2 2 0 010 2.8l-6.5 6.5a2 2 0 01-2.8 0l-7-7A2 2 0 013 11.5z" /><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" /></Ico>,
  alert: (p) => <Ico {...p}><path d="M12 3.5L2.5 19a1 1 0 00.9 1.5h17.2a1 1 0 00.9-1.5L12 3.5z" /><path d="M12 9.5V14M12 17h.01" /></Ico>,
  x: (p) => <Ico {...p} d="M6 6l12 12M18 6L6 18" sw={2} />,
  pin: (p) => <Ico {...p}><path d="M9 3.5h6l-1 5 3 3v2H7v-2l3-3-1-5zM12 13.5V21" /></Ico>,
  chevron: (p) => <Ico {...p} d="M6 9l6 6 6-6" sw={2} />,
  msg: (p) => <Ico {...p} d="M21 11.5a8 8 0 01-11.6 7.1L4 20l1.4-5.4A8 8 0 1121 11.5z" />,
  plus: (p) => <Ico {...p} d="M12 5v14M5 12h14" sw={2} />,
  filter: (p) => <Ico {...p} d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5z" />,
  link: (p) => <Ico {...p}><path d="M10 14a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1 1M14 10a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1-1" /></Ico>,
  layers: (p) => <Ico {...p}><path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 16.5l9 5 9-5" /></Ico>,
  hand: (p) => <Ico {...p}><path d="M9 11V5.5a1.5 1.5 0 013 0V11m0-.5V4.5a1.5 1.5 0 013 0V12m0-.5V6.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1.2a5 5 0 01-3.7-1.7L5 16c-.7-.8.4-2 1.3-1.4L9 16.5" /></Ico>,
  dot: (p) => <Ico {...p} fill="currentColor" sw={0}><circle cx="12" cy="12" r="4" /></Ico>,
  block: (p) => <Ico {...p}><circle cx="12" cy="12" r="8.5" /><path d="M6 6l12 12" /></Ico>,
};

window.Icons = Icons;
window.Ico = Ico;
