// src/js/api/api-manager.js - Nova API layer
// Provider registry + adapters + key management.
//
// - Built-in providers come from the .env file (via the Electron main process).
// - Custom providers (OpenAI-compatible endpoints etc.) are added from the
//   Settings > Api tab and stored locally, never sent anywhere.
// - The old direct-Gemini fetch in send-message.js now goes through
//   NovaAPI.buildRequest() / NovaAPI.parseResponse(), so switching providers
//   requires no changes anywhere else in the code.
const NOVA_API_STORAGE_KEYS = {
  providers: 'nova_api_providers',
  active: 'nova_active_api_provider',
};

const NOVA_API_BUILTIN = [
  {
    id: 'gemini',
    name: 'Nova Gemini (built-in)',
    adapter: 'gemini',
    builtin: true,
    envKey: 'GEMINI_API_KEY',
    defaultModel: 'gemini-3.5-flash-lite',
  },
];

const NovaAPI = {
  // ---- Registry -----------------------------------------------------------
  listCustom() {
    try { return JSON.parse(localStorage.getItem(NOVA_API_STORAGE_KEYS.providers) || '[]'); }
    catch (_) { return []; }
  },
  saveCustomList(list) {
    localStorage.setItem(NOVA_API_STORAGE_KEYS.providers, JSON.stringify(list));
  },
  listProviders() {
    return NOVA_API_BUILTIN.concat(this.listCustom());
  },
  getProvider(id) {
    return this.listProviders().find(p => p.id === id) || null;
  },
  getActiveProvider() {
    const id = localStorage.getItem(NOVA_API_STORAGE_KEYS.active) || 'gemini';
    return this.getProvider(id) || NOVA_API_BUILTIN[0];
  },
  setActiveProvider(id) {
    localStorage.setItem(NOVA_API_STORAGE_KEYS.active, id);
  },

  // ---- Custom provider CRUD ------------------------------------------------
  upsertCustom(provider) {
    const list = this.listCustom();
    const idx = list.findIndex(p => p.id === provider.id);
    if (idx >= 0) list[idx] = provider; else list.push(provider);
    this.saveCustomList(list);
  },
  deleteCustom(id) {
    this.saveCustomList(this.listCustom().filter(p => p.id !== id));
    if (this.getActiveProvider().id === id) this.setActiveProvider('gemini');
  },

  // ---- Keys ----------------------------------------------------------------
  envKeys: {},
  setEnvKey(name, value) {
    this.envKeys[name] = value;
  },
  resolveKey(provider, fallback) {
    if (!provider) return '';
    if (provider.envKey) {
      const k = this.envKeys[provider.envKey] || fallback || '';
      return typeof k === 'string' ? k.trim() : '';
    }
    return String(provider.apiKey || '').trim();
  },

  // ---- Request builder ------------------------------------------------------
  // opts: { model, systemInstruction, contents, apiKey }
  buildRequest(provider, opts) {
    if (!provider) return { error: 'Active provider not found.' };

    const key = this.resolveKey(provider, opts && opts.apiKey);
    if (!key) {
      return { error: 'API key not set for ' + (provider.name || provider.id) + ' (key: ' + (provider.envKey || provider.id) + ').' };
    }

    const builtinGemini = provider.builtin;
    const model = builtinGemini
      ? (opts.model || provider.defaultModel)
      : (provider.modelId || provider.defaultModel || 'gpt-4o-mini');

    if (provider.adapter === 'openai') {
      const messages = [];
      if (opts.systemInstruction) {
        messages.push({ role: 'system', content: opts.systemInstruction });
      }
      (opts.contents || []).forEach(c => {
        const text = (c.parts || []).filter(p => p.text).map(p => p.text).join('\n');
        const role = (c.role === 'model' || c.role === 'assistant') ? 'assistant' : 'user';
        if (text) messages.push({ role, content: text });
      });
      const endpoint = String(provider.endpoint || '').trim() || 'https://api.openai.com/v1/chat/completions';
      return {
        provider,
        url: endpoint,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + key,
          },
          body: JSON.stringify({ model: model, messages: messages }),
        },
      };
    }

    // Gemini (Google AI Studio) adapter — current default.
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
    return {
      provider,
      url: url,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: opts.systemInstruction }] },
          contents: opts.contents || [],
        }),
      },
    };
  },

  // ---- Response parser -------------------------------------------------------
  // Returns { text } or { error } for either adapter format.
  parseResponse(provider, data) {
    if (!data) return { error: 'Provider returned an empty response.' };
    if (provider && provider.adapter === 'openai') {
      if (data.error) return { error: data.error.message || String(data.error) };
      const choice = (data.choices || [])[0];
      const text = choice && choice.message && choice.message.content ? choice.message.content : '';
      return text ? { text: String(text) } : { error: 'Provider returned an empty response.' };
    }
    if (data.error) return { error: data.error.message || String(data.error) };
    const cand = (data.candidates || [])[0];
    const parts = cand && cand.content && cand.content.parts ? cand.content.parts : [];
    const text = parts.map(p => p.text || '').filter(Boolean).join('');
    return text ? { text: text } : { error: 'Provider returned an empty response.' };
  },

  // ---- Connection test (Settings > Api "Test" button) ------------------------
  async test(provider) {
    const req = this.buildRequest(provider, {
      systemInstruction: 'You are a test bot. Reply only with "OK".',
      contents: [{ role: 'user', parts: [{ text: 'OK' }] }],
    });
    if (req.error) return { ok: false, error: req.error };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(req.url, Object.assign({}, req.init, { signal: controller.signal }));
      const data = await res.json();
      const parsed = this.parseResponse(provider, data);
      if (parsed.error) return { ok: false, error: parsed.error };
      return { ok: true, text: parsed.text };
    } catch (e) {
      return { ok: false, error: 'Connection error: ' + (e && e.message ? e.message : String(e)) };
    } finally {
      clearTimeout(timer);
    }
  },
};
