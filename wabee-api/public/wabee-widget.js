(function () {
  console.log("[WABEE] Widget Loader Initializing...");

  // --- Auto-detection of apiBaseUrl ---
  function getApiBaseUrl() {
    let finalUrl = null;

    // 1. Explicitly defined in config
    if (window.WabeeWidgetConfig && window.WabeeWidgetConfig.apiBaseUrl) {
      finalUrl = window.WabeeWidgetConfig.apiBaseUrl;
      console.log("[WABEE] Using apiBaseUrl from config:", finalUrl);
    } else {
      // 2. document.currentScript (most reliable for where the script is loaded from)
      let scriptSrc = '';
      if (document.currentScript && document.currentScript.src) {
        scriptSrc = document.currentScript.src;
        console.log("[WABEE] Detected scriptSrc from currentScript:", scriptSrc);
      } else {
        // 3. Fallback: Search in document.scripts
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
          const src = scripts[i].src;
          if (src && (src.indexOf('/v1/wabee-widget.js') !== -1 || src.indexOf('wabee-widget.js') !== -1)) {
            scriptSrc = src;
            console.log("[WABEE] Detected scriptSrc from script search:", scriptSrc);
            break;
          }
        }
      }

      if (scriptSrc) {
        try {
          const url = new URL(scriptSrc);
          finalUrl = url.origin;
          console.log("[WABEE] Derived origin from scriptSrc:", finalUrl);
        } catch (e) {
          console.error("[WABEE] Failed to parse script source URL:", scriptSrc);
        }
      }
    }

    if (finalUrl) {
      // Clean up: ensure it doesn't end with /v1 or the script name itself
      finalUrl = finalUrl.split('/v1')[0].replace(/\/$/, '');
      if (finalUrl.endsWith('wabee-widget.js')) {
        finalUrl = new URL(finalUrl).origin;
      }
    }

    return finalUrl;
  }

  const apiBaseUrl = getApiBaseUrl();
  const apiVersion = '/v1'; // Standard prefix
  const { widgetId } = window.WabeeWidgetConfig || {};

  console.log("[WABEE] Configuration:", {
    apiBaseUrl,
    apiVersion,
    widgetId,
    previewMode: !!window.__WABEE_PREVIEW__
  });

  if (!widgetId) {
    console.error("[WABEE] Invalid configuration. widgetId is required.");
    return;
  }

  if (!apiBaseUrl) {
    console.error("[WABEE] Unable to detect apiBaseUrl automatically. Please check your installation.");
    return;
  }
  function loadStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      #wabee-widget-root {
        --wabee-primary: #16a34a;
        --wabee-radius: 16px;
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .wabee-launcher {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background-color: var(--wabee-primary);
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
      }
      .wabee-launcher:hover {
        transform: scale(1.05);
      }
      .wabee-window {
        position: absolute;
        bottom: 80px;
        width: 380px;
        height: 600px;
        max-height: 80vh;
        background: white;
        border-radius: var(--wabee-radius);
        box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        display: none;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid #e2e8f0;
      }
      .wabee-window.open {
        display: flex;
        animation: wabee-slide-up 0.3s ease-out;
      }
      @keyframes wabee-slide-up {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      /* Chat Layout */
      .wabee-header {
        padding: 16px;
        color: white;
        background-color: var(--wabee-primary);
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 12px;
        position: relative;
      }
      .wabee-header-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
      }
      .wabee-header-title {
        font-weight: bold;
        font-size: 18px;
        line-height: 1.2;
      }
      .wabee-header-subtitle {
        font-size: 13px;
        opacity: 0.9;
        line-height: 1.2;
      }
      .wabee-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #fcfcfc;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .wabee-input-area {
        padding: 16px;
        border-top: 1px solid #eee;
        background: white;
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .wabee-input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid #e2e8f0;
        border-radius: var(--wabee-radius);
        outline: none;
        font-size: 14px;
      }
      .wabee-send-btn {
        padding: 10px 20px;
        background-color: var(--wabee-primary);
        color: white;
        border: none;
        cursor: pointer;
        font-weight: bold;
        border-radius: var(--wabee-radius);
        font-size: 14px;
        transition: opacity 0.2s;
      }
      .wabee-send-btn:hover {
        opacity: 0.9;
      }
      .wabee-msg {
        max-width: 80%;
        padding: 10px 16px;
        border-radius: var(--wabee-radius);
        font-size: 14px;
        line-height: 1.5;
        word-wrap: break-word;
      }
      .wabee-msg p {
        margin: 0 0 8px 0;
      }
      .wabee-msg p:last-child {
        margin-bottom: 0;
      }
      .wabee-msg ul, .wabee-msg ol {
        margin: 8px 0;
        padding-left: 20px;
      }
      .wabee-msg li {
        margin-bottom: 4px;
      }
      .wabee-msg.inbound {
        align-self: flex-end;
        background-color: var(--wabee-primary);
        color: white;
        border-bottom-right-radius: 2px;
      }
      .wabee-msg.outbound {
        align-self: flex-start;
        background: white;
        color: #334155;
        border: 1px solid #e2e8f0;
        border-bottom-left-radius: 2px;
      }

      /* Mobile Support */
      @media screen and (max-width: 480px) {
        #wabee-widget-root {
          bottom: 10px;
          right: 10px;
        }
        .wabee-window {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100% !important;
          height: 100% !important;
          max-height: 100vh !important;
          border-radius: 0 !important;
          z-index: 1000000;
        }
        .wabee-window.open {
          display: flex;
        }
        .wabee-launcher {
          width: 50px;
          height: 50px;
        }
        .wabee-header {
          border-radius: 0 !important;
          padding: 12px;
        }
        .wabee-header-title {
          font-size: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  async function fetchConfig() {
    try {
      // Si estamos en modo preview, usar la config inyectada
      if (window.__WABEE_PREVIEW__ && window.__WABEE_PREVIEW_CONFIG__) {
        console.log("[WABEE] Preview mode - using injected config");
        return window.__WABEE_PREVIEW_CONFIG__;
      }

      const url = `${apiBaseUrl}${apiVersion}/public/widgets/${widgetId}/config?t=${Date.now()}`;
      console.log("[WABEE] Fetching config from", url);

      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store'
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || `Status ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error("[WABEE] Config fetch failed:", err);
      return null;
    }
  }

  // State
  let config = null;
  let isOpen = false;
  let visitorId = null;
  try {
    visitorId = localStorage.getItem(`wabee:visitor:${widgetId}`);
    if (!visitorId) {
      visitorId = 'vis_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem(`wabee:visitor:${widgetId}`, visitorId);
    }
  } catch (e) {
    console.warn("[WABEE] localStorage access denied. Guest mode active.");
    visitorId = 'guest_' + Math.random().toString(36).substring(2, 15);
  }
  let sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
  let messages = [];
  let threadId = null; // En memoria solamente

  // Render logic
  function render(widgetConfig) {
    if (!widgetConfig) return;
    config = widgetConfig;

    // Destructure safe defaults
    const theme = config.theme || {};
    const content = config.content || {};
    const primaryColor = theme.primaryColor || '#16a34a';
    const radius = theme.radius ?? 16;
    const position = theme.position || 'bottom-right';

    // Create Root
    const root = document.createElement('div');
    root.id = 'wabee-widget-root';
    root.style.setProperty('--wabee-primary', primaryColor);
    root.style.setProperty('--wabee-radius', `${radius}px`);

    // Apply positioning to root
    if (position === 'bottom-left') {
      root.style.right = 'auto';
      root.style.left = '20px';
    } else if (position === 'bottom-right') {
      root.style.left = 'auto';
      root.style.right = '20px';
    }
    // Logic for 'right' or 'left' (middle) not implemented in styles yet, defaulting to bottom corners.

    document.body.appendChild(root);

    // Initial HTML structure
    root.innerHTML = `
      <div class="wabee-window" id="wabee-window">
        <!-- Header -->
        <div class="wabee-header" style="border-top-left-radius: ${radius - 1}px; border-top-right-radius: ${radius - 1}px;">
          <div class="wabee-header-content">
            <div class="wabee-header-title">${content.title || config.title || 'Chat'}</div>
            <div class="wabee-header-subtitle">${content.subtitle || config.subtitle || ''}</div>
          </div>
          <div id="wabee-close" style="cursor: pointer; font-size: 20px; opacity: 0.8;">✕</div>
        </div>
        
        <!-- Messages -->
        <div class="wabee-messages" id="wabee-messages">
           <div class="wabee-msg outbound" style="border-radius: ${radius}px; border-bottom-left-radius: 4px;">
             ${content.welcomeMessage || config.welcomeMessage || '¡HOLA!'}
           </div>
        </div>

        <!-- Input -->
        <form class="wabee-input-area" id="wabee-form">
          <input class="wabee-input" type="text" placeholder="Type a message..." required style="border-radius: ${radius}px;" />
          <button type="submit" class="wabee-send-btn" style="background-color: ${primaryColor}">
            Send
          </button>
        </form>
        
        <!-- Branding -->
         ${!config.features?.poweredBy ?
        `<div style="text-align: center; padding: 4px; font-size: 10px; color: #94a3b8;">Con tecnología de WABEE</div>`
        : ''}
      </div>

      <div class="wabee-launcher" id="wabee-launcher" style="background-color: ${primaryColor}">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      </div>
    `;

    // Preview mode: ensure background is transparent
    if (window.__WABEE_PREVIEW__) {
      root.style.background = 'transparent';
    }

    // Adjust windown position relative to launcher
    // If left alignment, window should also align left.
    const windowEl = root.querySelector('#wabee-window');
    if (position === 'bottom-left' || position === 'left') {
      windowEl.style.right = 'auto';
      windowEl.style.left = '0';
    } else {
      windowEl.style.left = 'auto';
      windowEl.style.right = '0';
    }

    // Attach Listeners
    const launcher = root.querySelector('#wabee-launcher');
    const closeBtn = root.querySelector('#wabee-close');
    const form = root.querySelector('#wabee-form');
    const input = form.querySelector('input');
    const messagesContainer = root.querySelector('#wabee-messages');

    function toggle() {
      isOpen = !isOpen;
      if (isOpen) {
        windowEl.classList.add('open');
        input.focus();
        // UI RESET: No cargamos historial al abrir por primera vez en esta sesión
      } else {
        windowEl.classList.remove('open');
      }
    }

    launcher.addEventListener('click', toggle);
    closeBtn.addEventListener('click', toggle);

    // Auto-open in preview mode
    if (window.__WABEE_AUTO_OPEN__) {
      setTimeout(() => {
        isOpen = true;
        windowEl.classList.add('open');
        input.focus();
      }, 100);
    }


    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      // Optimistic UI - add user message
      addMessage(text, 'inbound');
      input.value = '';

      try {
        let url;
        let fetchOptions;

        if (window.__WABEE_PREVIEW__) {
          // --- MODO PREVIEW INTERNO ---
          // Usa el endpoint autenticado del dashboard; no valida domainAllowed.
          // El token JWT se inyecta en el iframe desde el dashboard (window.__WABEE_PREVIEW_TOKEN__).
          const previewToken = window.__WABEE_PREVIEW_TOKEN__;
          const previewApiBase = window.__WABEE_PREVIEW_API_BASE__ || apiBaseUrl;
          url = `${previewApiBase}${apiVersion}/wabee/web-widgets/${widgetId}/preview-message`;
          console.log('[WABEE][PREVIEW] Enviando a endpoint interno:', url);

          if (!previewToken) {
            console.error('[WABEE][PREVIEW] No hay token de sesión disponible. Verifica que estás autenticado en el dashboard.');
            addMessage('Error: sesión no disponible para el preview.', 'outbound');
            return;
          }

          fetchOptions = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${previewToken}`
            },
            body: JSON.stringify({
              visitorId,
              sessionId,
              textBody: text,
              previewConfig: config  // config activa del draft
            })
          };
        } else {
          // --- MODO PÚBLICO NORMAL ---
          url = `${apiBaseUrl}${apiVersion}/public/widgets/${widgetId}/messages`;
          console.log('[WABEE] Enviando a:', url);
          fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              visitorId,
              sessionId,
              textBody: text,
              pageUrl: window.location.href
            })
          };
        }

        const res = await fetch(url, fetchOptions);
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.error('[WABEE] Error HTTP:', res.status, errBody);
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        console.log('[WABEE] Respuesta API:', data);

        // Mismo contrato de respuesta para ambas rutas
        if (data.type === 'AI_MESSAGE' && data.message) {
          addMessage(data.message.textBody || data.message.text, 'outbound');
        } else if (data.type === 'FALLBACK' && data.text) {
          addMessage(data.text, 'outbound');
        }

      } catch (err) {
        console.error('[WABEE] Error al enviar mensaje:', err);
        addMessage('Error al enviar mensaje. Intenta de nuevo.', 'outbound');
      }
    });

    function formatMarkdown(text) {
      if (!text) return "";

      // 1. Escape HTML to prevent XSS
      const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      let html = escape(text);

      // 2. Bold: **text**
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // 3. Line breaks -> <br/> (Handle before lists for clarity)
      // Actually, we'll split by lines for list processing first.
      const lines = html.split('\n');
      let result = [];
      let inUl = false;
      let inOl = false;

      for (let line of lines) {
        const trimmed = line.trim();

        // Unordered list: * or -
        if (/^[\*\-]\s+/.test(trimmed)) {
          if (inOl) { result.push('</ol>'); inOl = false; }
          if (!inUl) { result.push('<ul style="margin: 8px 0; padding-left: 20px;">'); inUl = true; }
          result.push(`<li>${trimmed.replace(/^[\*\-]\s+/, '')}</li>`);
        }
        // Ordered list: 1. 2. etc
        else if (/^\d+\.\s+/.test(trimmed)) {
          if (inUl) { result.push('</ul>'); inUl = false; }
          if (!inOl) { result.push('<ol style="margin: 8px 0; padding-left: 20px;">'); inOl = true; }
          result.push(`<li>${trimmed.replace(/^\d+\.\s+/, '')}</li>`);
        }
        // Normal line
        else {
          if (inUl) { result.push('</ul>'); inUl = false; }
          if (inOl) { result.push('</ol>'); inOl = false; }

          if (trimmed === "") {
            result.push('<div style="height: 8px;"></div>');
          } else {
            result.push(`<p style="margin: 0 0 8px 0;">${line}</p>`);
          }
        }
      }

      if (inUl) result.push('</ul>');
      if (inOl) result.push('</ol>');

      return result.join('');
    }

    function addMessage(text, direction) {
      const msgDiv = document.createElement('div');
      msgDiv.className = `wabee-msg ${direction}`;

      if (direction === 'outbound') {
        msgDiv.innerHTML = formatMarkdown(text);
      } else {
        msgDiv.innerText = text; // User messages usually don't need markdown
      }
      // Basic dynamic styling
      // Leer el color dinámicamente desde config global (no de la clausura del render)
      const currentColor = config.theme?.primaryColor || primaryColor;
      const currentRadius = config.theme?.radius ?? radius;
      if (direction === 'inbound') {
        msgDiv.style.backgroundColor = currentColor;
        if (currentRadius) {
          msgDiv.style.borderRadius = `${currentRadius}px`;
          msgDiv.style.borderBottomRightRadius = '2px';
        }
      } else {
        if (currentRadius) {
          msgDiv.style.borderRadius = `${currentRadius}px`;
          msgDiv.style.borderBottomLeftRadius = '2px';
        }
      }

      messagesContainer.appendChild(msgDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      messages.push({ text, direction }); // simple local state
    }

    async function fetchHistory() {
      // Función deshabilitada para cumplimiento de "UI limpia al recargar"
      // Se mantiene la estructura por si se desea re-habilitar con un botón "Ver historial"
      /*
      try {
        const url = `${apiBaseUrl}${apiVersion}/public/widgets/${widgetId}/thread?visitorId=${visitorId}`;
        const res = await fetch(url);
        if (res.ok) {
          if (data.messages) {
             // ... rendering logic ...
          }
        }
      } catch (err) {
        console.error("History fetch failed", err);
      }
      */
    }
  }

  // --- Preview Mode: PostMessage Listener ---
  if (window.__WABEE_PREVIEW__) {
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'WABEE_PREVIEW_UPDATE') {
        console.log('[WABEE] Received preview config update', event.data.payload);
        applyConfig(event.data.payload);
      }
    });
  }

  function applyConfig(newConfig) {
    if (!config) return;

    // Actualizar config global
    config = {
      ...config,
      content: { ...(config.content || {}), ...(newConfig.content || {}) },
      theme: { ...(config.theme || {}), ...(newConfig.theme || {}) },
      ai: { ...(config.ai || {}), ...(newConfig.ai || {}) },
      features: { ...(config.features || {}), ...(newConfig.features || {}) }
    };

    // Mapear campos legacy para compatibilidad
    if (newConfig.title) config.title = newConfig.title;
    if (newConfig.subtitle) config.subtitle = newConfig.subtitle;
    if (newConfig.welcomeMessage) config.welcomeMessage = newConfig.welcomeMessage;

    // Aplicar estilos dinámicos
    const theme = config.theme || {};
    const content = config.content || {};
    const primaryColor = theme.primaryColor || '#16a34a';
    const radius = theme.radius ?? 16;
    const position = theme.position || 'bottom-right';

    // Actualizar elementos del DOM si ya están renderizados
    const root = document.getElementById('wabee-widget-root');
    if (!root) return;

    root.style.setProperty('--wabee-primary', primaryColor);
    root.style.setProperty('--wabee-radius', `${radius}px`);

    // Actualizar posición del root
    if (position === 'bottom-left') {
      root.style.right = 'auto';
      root.style.left = '20px';
    } else {
      root.style.left = 'auto';
      root.style.right = '20px';
    }

    // Actualizar posición relativa del window (alineación izq/der)
    const windowEl = root.querySelector('#wabee-window');
    if (windowEl) {
      if (position === 'bottom-left') {
        windowEl.style.right = 'auto';
        windowEl.style.left = '0';
      } else {
        windowEl.style.left = 'auto';
        windowEl.style.right = '0';
      }
    }

    const header = root.querySelector('.wabee-header');
    const titleEl = header?.querySelector('.wabee-header-title');
    const subtitleEl = header?.querySelector('.wabee-header-subtitle');
    const messages = root.querySelector('.wabee-messages');
    const welcomeMsg = messages?.querySelector('.wabee-msg.outbound:first-child');

    if (header) {
      header.style.borderTopLeftRadius = `${radius - 1}px`;
      header.style.borderTopRightRadius = `${radius - 1}px`;
    }

    if (titleEl) titleEl.textContent = content.title || config.title || 'Chat';
    if (subtitleEl) subtitleEl.textContent = content.subtitle || config.subtitle || '';
    if (welcomeMsg) welcomeMsg.textContent = content.welcomeMessage || config.welcomeMessage || '¡HOLA!';

    // Actualizar inline styles que NO reaccionan a la variable CSS
    const sendBtn = root.querySelector('.wabee-send-btn');
    if (sendBtn) sendBtn.style.backgroundColor = primaryColor;

    const launcherEl = root.querySelector('.wabee-launcher');
    if (launcherEl) launcherEl.style.backgroundColor = primaryColor;

    // Actualizar mensajes del usuario (inbound) ya renderizados
    const inboundMsgs = root.querySelectorAll('.wabee-msg.inbound');
    inboundMsgs.forEach(msg => {
      msg.style.backgroundColor = primaryColor;
    });
  }

  // --- Main Execution ---
  loadStyles();
  fetchConfig().then(config => {
    if (config) {
      render(config);
    } else {
      console.warn("[WABEE] Could not render widget due to missing config.");
    }
  });
})();
