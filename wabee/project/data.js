/* Wabee Inbox — mock data (Spanish, WhatsApp CRM). Plain JS → window.WABEE_DATA */
(function () {
  const now = new Date();
  const min = (m) => new Date(now.getTime() - m * 60000).toISOString();
  const hr = (h) => new Date(now.getTime() - h * 3600000).toISOString();
  const day = (d) => new Date(now.getTime() - d * 86400000).toISOString();

  // Agents (for assignment / reassign)
  const agents = [
    { id: "me", name: "Tú", initials: "JE", color: "#9524E3" },
    { id: "a2", name: "María Solís", initials: "MS", color: "#FF8C00" },
    { id: "a3", name: "Diego Marín", initials: "DM", color: "#1A1A1A" },
  ];

  // Conversations — varied states for density + scalability demo
  const threads = [
    {
      id: "t1", name: "Lucía Fernández", phone: "+52 55 4471 9023", initials: "LF",
      lastPreview: "Perfecto, ¿me puedes confirmar el horario de la demo?",
      time: min(2), unread: 3, status: "OPEN", mode: "human_queue", aiPaused: true,
      assignedTo: null, online: true, channel: "Ventas MX", tags: ["Lead", "Demo"],
      sla: "urgent", source: "whatsapp", value: "Plan Pro",
    },
    {
      id: "t2", name: "Carlos Beltrán", phone: "+52 81 2298 7741", initials: "CB",
      lastPreview: "Gracias, quedo atento a la cotización 🙌",
      time: min(14), unread: 1, status: "OPEN", mode: "human", aiPaused: true,
      assignedTo: "me", online: true, channel: "Ventas MX", tags: ["Cotización"],
      sla: "ok", source: "whatsapp", value: "Plan Pro",
    },
    {
      id: "t3", name: "Farmacia del Valle", phone: "+52 33 1180 5520", initials: "FV",
      lastPreview: "El asistente está procesando tu pedido recurrente…",
      time: min(31), unread: 0, status: "OPEN", mode: "ai", aiPaused: false,
      assignedTo: null, online: false, channel: "Soporte", tags: ["Recompra"],
      sla: "ok", source: "whatsapp", value: "Cliente",
    },
    {
      id: "t4", name: "Andrea Ríos", phone: "+52 55 6603 2218", initials: "AR",
      lastPreview: "Tú: Te comparto el enlace de pago seguro 👇",
      time: min(48), unread: 0, status: "OPEN", mode: "human", aiPaused: true,
      assignedTo: "me", online: false, channel: "Ventas MX", tags: ["Pago"],
      sla: "ok", source: "whatsapp", value: "Plan Starter",
    },
    {
      id: "t5", name: "Promo: Black Week", phone: "+52 55 0000 1122", initials: "PB",
      lastPreview: "Campaña entregada a 8,420 contactos",
      time: hr(2), unread: 0, status: "OPEN", mode: "ai", aiPaused: false,
      assignedTo: null, online: false, channel: "Marketing", tags: ["Campaña"],
      sla: "ok", source: "campaign", value: "Difusión",
    },
    {
      id: "t6", name: "Roberto Cano", phone: "+52 442 519 8830", initials: "RC",
      lastPreview: "¿Tienen integración con mi tienda en línea?",
      time: hr(3), unread: 2, status: "OPEN", mode: "human_queue", aiPaused: true,
      assignedTo: null, online: false, channel: "Soporte", tags: ["Integración"],
      sla: "warn", source: "whatsapp", value: "Lead",
    },
    {
      id: "t7", name: "Valentina Cruz", phone: "+52 55 7740 9912", initials: "VC",
      lastPreview: "María Solís: Listo, ya quedó agendado para mañana.",
      time: hr(5), unread: 0, status: "OPEN", mode: "human", aiPaused: true,
      assignedTo: "a2", online: true, channel: "Ventas MX", tags: ["Agendado"],
      sla: "ok", source: "whatsapp", value: "Plan Pro",
    },
    {
      id: "t8", name: "Soporte Técnico — Mesa 4", phone: "+52 55 3321 0098", initials: "S4",
      lastPreview: "El asistente resolvió la consulta automáticamente.",
      time: hr(8), unread: 0, status: "OPEN", mode: "ai", aiPaused: false,
      assignedTo: null, online: false, channel: "Soporte", tags: ["Resuelto IA"],
      sla: "ok", source: "whatsapp", value: "Cliente",
    },
    {
      id: "t9", name: "Gabriel Ponce", phone: "+52 33 4408 1170", initials: "GP",
      lastPreview: "Diego Marín: Cerramos el ticket, ¡gracias!",
      time: day(1), unread: 0, status: "CLOSED", mode: "human", aiPaused: false,
      assignedTo: "a3", online: false, channel: "Soporte", tags: ["Cerrado"],
      sla: "ok", source: "whatsapp", value: "Cliente",
    },
    {
      id: "t10", name: "Inmobiliaria Norte", phone: "+52 81 6650 4417", initials: "IN",
      lastPreview: "Quisiera más información sobre planes para equipos.",
      time: day(1), unread: 0, status: "OPEN", mode: "ai", aiPaused: false,
      assignedTo: null, online: false, channel: "Ventas MX", tags: ["Lead", "Equipos"],
      sla: "ok", source: "whatsapp", value: "Lead",
    },
    {
      id: "t11", name: "Paola Esquivel", phone: "+52 55 9912 3340", initials: "PE",
      lastPreview: "Tú: Quedo al pendiente de tu confirmación.",
      time: day(2), unread: 0, status: "OPEN", mode: "human", aiPaused: true,
      assignedTo: "me", online: false, channel: "Ventas MX", tags: ["Seguimiento"],
      sla: "ok", source: "whatsapp", value: "Plan Starter",
    },
    {
      id: "t12", name: "Tienda Aurora", phone: "+52 33 2207 6618", initials: "TA",
      lastPreview: "El asistente está esperando datos de facturación.",
      time: day(3), unread: 0, status: "OPEN", mode: "ai", aiPaused: false,
      assignedTo: null, online: false, channel: "Soporte", tags: ["Facturación"],
      sla: "ok", source: "whatsapp", value: "Cliente",
    },
  ];

  // Messages per thread. dir: in | out. sender: contact | agent | ai | system
  const messages = {
    t1: [
      { id: "m1", dir: "in", sender: "contact", text: "Hola, vi su anuncio y me interesa una demo de Wabee para mi equipo de ventas.", time: hr(1) },
      { id: "m2", dir: "out", sender: "ai", text: "¡Hola Lucía! Con gusto. Wabee centraliza WhatsApp, IA y CRM en una sola bandeja. ¿Cuántas personas hay en tu equipo?", time: min(55) },
      { id: "m3", dir: "in", sender: "contact", text: "Somos 6 agentes. ¿Pueden hacer una demo en vivo esta semana?", time: min(40) },
      { id: "m4", dir: "out", sender: "ai", text: "Claro. Te puedo agendar con un especialista. Paso la conversación a un asesor humano para coordinar el horario. 🙌", time: min(38), handoff: true },
      { id: "m5", dir: "in", sender: "contact", text: "Perfecto, ¿me puedes confirmar el horario de la demo?", time: min(2) },
    ],
    t2: [
      { id: "m1", dir: "in", sender: "contact", text: "Buenas, ¿me pueden mandar la cotización del plan Pro?", time: hr(3) },
      { id: "m2", dir: "out", sender: "agent", text: "¡Hola Carlos! Claro, el plan Pro incluye usuarios ilimitados, IA y campañas. Te preparo la cotización formal.", time: hr(2) },
      { id: "m3", dir: "in", sender: "contact", text: "Gracias, quedo atento a la cotización 🙌", time: min(14) },
    ],
    t3: [
      { id: "m1", dir: "in", sender: "contact", text: "Quiero repetir mi pedido del mes pasado.", time: hr(2) },
      { id: "m2", dir: "out", sender: "ai", text: "¡Hola! Encontré tu pedido recurrente. Estoy procesándolo y te confirmo en un momento.", time: min(31) },
    ],
    t4: [
      { id: "m1", dir: "in", sender: "contact", text: "Listo, quiero contratar el plan Starter.", time: hr(2) },
      { id: "m2", dir: "out", sender: "agent", text: "¡Excelente decisión, Andrea! Te comparto el enlace de pago seguro 👇", time: min(48) },
      { id: "m3", dir: "out", sender: "agent", text: "https://pay.wabee.app/starter", time: min(47), link: true },
    ],
    t5: [
      { id: "m1", dir: "out", sender: "system", text: "Black Week 2024", campaign: "Black Week", time: hr(2),
        body: "🐝 *Black Week en Wabee* — 30% de descuento en todos los planes anuales hasta el viernes. Responde *QUIERO* para activar tu beneficio.", footer: "Wabee · Mensaje promocional" },
    ],
    t6: [
      { id: "m1", dir: "in", sender: "contact", text: "Hola, ¿Wabee se integra con mi tienda en línea?", time: hr(4) },
      { id: "m2", dir: "out", sender: "ai", text: "¡Hola Roberto! Sí, Wabee se integra con las principales plataformas de e-commerce vía API y webhooks.", time: hr(3.5) },
      { id: "m3", dir: "in", sender: "contact", text: "¿Tienen integración con mi tienda en línea?", time: hr(3) },
    ],
    t7: [
      { id: "m1", dir: "in", sender: "contact", text: "¿Me pueden agendar una llamada?", time: hr(6) },
      { id: "m2", dir: "out", sender: "agent", text: "Listo, ya quedó agendado para mañana.", time: hr(5) },
    ],
    t8: [
      { id: "m1", dir: "in", sender: "contact", text: "¿Cómo cambio mi contraseña?", time: hr(9) },
      { id: "m2", dir: "out", sender: "ai", text: "Te explico: entra a Ajustes → Seguridad → Cambiar contraseña. ¿Necesitas algo más?", time: hr(8) },
    ],
    t9: [
      { id: "m1", dir: "in", sender: "contact", text: "Mi factura llegó con un dato incorrecto.", time: day(1.2) },
      { id: "m2", dir: "out", sender: "agent", text: "Lo corregimos y reenviamos. Cerramos el ticket, ¡gracias!", time: day(1) },
    ],
    t10: [
      { id: "m1", dir: "in", sender: "contact", text: "Quisiera más información sobre planes para equipos.", time: day(1) },
    ],
    t11: [
      { id: "m1", dir: "in", sender: "contact", text: "Lo platico con mi socio y te aviso.", time: day(2.1) },
      { id: "m2", dir: "out", sender: "agent", text: "Perfecto. Quedo al pendiente de tu confirmación.", time: day(2) },
    ],
    t12: [
      { id: "m1", dir: "in", sender: "contact", text: "Necesito mi factura del mes.", time: day(3.1) },
      { id: "m2", dir: "out", sender: "ai", text: "Con gusto. ¿Me confirmas tu RFC y razón social para generarla?", time: day(3) },
    ],
  };

  const notes = {
    t1: [
      { id: "n1", author: "María Solís", text: "Lead caliente — equipo de 6, viene de campaña de LinkedIn. Prioridad demo.", time: min(35), pinned: true },
      { id: "n2", author: "Tú", text: "Mencionó que evalúa también a un competidor. Destacar IA + handoff.", time: min(20), pinned: false },
    ],
    t2: [
      { id: "n1", author: "Tú", text: "Cliente recurrente, ya tiene plan Starter. Upsell a Pro.", time: hr(2), pinned: false },
    ],
    t6: [
      { id: "n1", author: "Diego Marín", text: "Pregunta técnica de integración — confirmar plataforma exacta.", time: hr(3), pinned: false },
    ],
  };

  window.WABEE_DATA = { agents, threads, messages, notes };
})();
