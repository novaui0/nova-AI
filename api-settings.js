// src/js/settings/api-settings.js - Settings > "Api" tab
// Lets the user add / edit / delete API providers, pick the active one and
// test the connection. Custom providers are stored locally via NovaAPI.
let novaApiBusy = {}; // provider-id -> boolean (test in flight)

function renderApiSettings() {
  const container = document.getElementById('apiProvidersList');
  if (!container || typeof NovaAPI === 'undefined') return;

  const activeId = NovaAPI.getActiveProvider().id;
  const providers = NovaAPI.listProviders();

  container.innerHTML = '';
  providers.forEach(p => {
    const hasKey = NovaAPI.resolveKey(p) !== '';
    const card = document.createElement('div');
    card.className = 'nova-api-card' + (p.id === activeId ? ' active' : '');

    const keyLabel = p.builtin
      ? '<span class="nova-api-key ' + (hasKey ? 'ok' : 'missing') + '">' +
        (hasKey ? 'Key loaded from .env' : 'Key not set (define GEMINI_API_KEY in project-root/.env)') + '</span>'
      : '<span class="nova-api-key ' + (hasKey ? 'ok' : 'missing') + '">' +
        (hasKey ? 'Key saved' : 'Key not set') + '</span>';

    card.innerHTML =
      '<div class="nova-api-card-head">' +
        '<label class="nova-api-radio">' +
          '<input type="radio" name="novaActiveProvider" value="' + p.id + '"' +
            (p.id === activeId ? ' checked' : '') +
            ' onchange="NovaAPI.setActiveProvider(\'' + p.id + '\'); renderApiSettings();">' +
          '<strong>' + escapeNovaHtml(p.name || p.id) + '</strong>' +
        '</label>' +
        '<div class="nova-api-head-actions">' +
          '<button type="button" class="nova-api-test-btn" id="novaApiTest_' + p.id + '"' +
            ' onclick="testNovaApiProvider(\'' + p.id + '\')">Test</button>' +
        '</div>' +
      '</div>' +
      '<div class="nova-api-card-meta">' +
        '<span class="nova-api-chip">' + (p.adapter === 'openai' ? 'OpenAI Compatible' : 'Google Gemini') + '</span>' +
        '<span class="nova-api-chip model">' + escapeNovaHtml(p.modelId || p.defaultModel || '') + '</span>' +
        keyLabel +
      '</div>';

    container.appendChild(card);

    if (!p.builtin) {
      const editor = document.createElement('div');
      editor.className = 'nova-api-card-fields';
      editor.innerHTML =
        '<input type="text" id="novaApiName_' + p.id + '" value="' + escapeNovaAttr(p.name || '') + '" placeholder="Name (e.g: OpenAI)" class="nova-api-input">' +
        '<input type="text" id="novaApiEndpoint_' + p.id + '" value="' + escapeNovaAttr(p.endpoint || '') + '" placeholder="Endpoint (e.g: https://api.openai.com/v1/chat/completions)" class="nova-api-input wide">' +
        '<input type="text" id="novaApiModel_' + p.id + '" value="' + escapeNovaAttr(p.modelId || '') + '" placeholder="Model id (e.g: gpt-4o-mini)" class="nova-api-input">' +
        '<input type="password" id="novaApiKey_' + p.id + '" value="' + escapeNovaAttr(p.apiKey || '') + '" placeholder="API key" class="nova-api-input" autocomplete="off">' +
        '<div class="nova-api-field-actions">' +
          '<button type="button" class="nova-api-save-btn" onclick="saveNovaApiProvider(\'' + p.id + '\')">Save</button>' +
          '<button type="button" class="nova-api-delete-btn" onclick="deleteNovaApiProvider(\'' + p.id + '\')">Delete</button>' +
        '</div>';
      container.appendChild(editor);
    }
  });

  syncGoogleClientIdInApiSettings();
}

async function syncGoogleClientIdInApiSettings() {
  if (typeof require !== 'undefined') {
    try {
      const { ipcRenderer } = require('electron');
      const cfg = await ipcRenderer.invoke('get-env-config');
      const input = document.getElementById('apiSettingsGoogleClientId');
      const chip = document.getElementById('googleOAuthStatusChip');
      if (input && cfg && cfg.googleClientId !== undefined) {
        input.value = cfg.googleClientId || '';
      }
      if (chip && cfg) {
        if (cfg.hasGoogleClientId) {
          chip.textContent = 'Tanımlı (.env)';
          chip.style.color = '#137333';
          chip.style.background = '#e6f4ea';
        } else {
          chip.textContent = 'Boş (Hızlı Giriş Etkin)';
          chip.style.color = '#b06000';
          chip.style.background = '#fef7e0';
        }
      }
    } catch (_) {}
  }
}

async function saveGoogleClientIdFromApiSettings() {
  const input = document.getElementById('apiSettingsGoogleClientId');
  const val = (input?.value || '').trim();
  if (typeof require !== 'undefined') {
    try {
      const { ipcRenderer } = require('electron');
      const res = await ipcRenderer.invoke('save-env-key', 'GOOGLE_CLIENT_ID', val);
      if (res && res.success) {
        alert('GOOGLE_CLIENT_ID başarıyla .env dosyasına kaydedildi!');
        syncGoogleClientIdInApiSettings();
      } else {
        alert('Kaydedilemedi: ' + (res?.error || 'Bilinmeyen hata'));
      }
    } catch (e) {
      alert('Kaydetme hatası: ' + e.message);
    }
  } else {
    localStorage.setItem('nova_google_client_id', val);
    alert('Client ID yerel olarak kaydedildi.');
  }
}

function escapeNovaHtml(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeNovaAttr(s) {
  return escapeNovaHtml(s).replace(/"/g, '&quot;');
}

function saveNovaApiProvider(id) {
  const name = document.getElementById('novaApiName_' + id).value.trim();
  const endpoint = document.getElementById('novaApiEndpoint_' + id).value.trim();
  const modelId = document.getElementById('novaApiModel_' + id).value.trim();
  const apiKey = document.getElementById('novaApiKey_' + id).value.trim();

  if (!name) return alert('Please give the API a name.');
  if (!apiKey) return alert('Please enter the API key.');

  const provider = Object.assign({}, NovaAPI.getProvider(id) || {}, {
    id: id,
    name: name,
    endpoint: endpoint,
    modelId: modelId,
    apiKey: apiKey,
  });
  NovaAPI.upsertCustom(provider);
  renderApiSettings();
}

function deleteNovaApiProvider(id) {
  if (!confirm('Delete this API? The saved key will also be removed.')) return;
  NovaAPI.deleteCustom(id);
  renderApiSettings();
}

function toggleNovaAddApiForm() {
  const form = document.getElementById('novaAddApiForm');
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  if (form.style.display === 'block') document.getElementById('novaAddApiName')?.focus();
}

function submitNovaAddApi() {
  const name = document.getElementById('novaAddApiName').value.trim();
  const adapter = document.getElementById('novaAddApiAdapter').value;
  const endpoint = document.getElementById('novaAddApiEndpoint').value.trim();
  const modelId = document.getElementById('novaAddApiModel').value.trim();
  const apiKey = document.getElementById('novaAddApiKey').value.trim();

  if (!name) return alert('Please give the API a name.');
  if (!apiKey) return alert('Please enter the API key.');
  if (adapter === 'openai') {
    const ep = endpoint || 'https://api.openai.com/v1/chat/completions';
    if (!/^https?:\/\//i.test(ep)) {
      return alert('The Endpoint must be a full URL (e.g: https://api.openai.com/v1/chat/completions)');
    }
  }

  const provider = {
    id: 'custom_' + Date.now(),
    name: name,
    adapter: adapter,
    endpoint: endpoint,
    modelId: modelId,
    apiKey: apiKey,
  };
  NovaAPI.upsertCustom(provider);

  // Clear the add form
  ['novaAddApiName', 'novaAddApiEndpoint', 'novaAddApiModel', 'novaAddApiKey'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('novaAddApiForm').style.display = 'none';

  renderApiSettings();
}

async function testNovaApiProvider(id) {
  const provider = NovaAPI.getProvider(id);
  if (!provider) return;

  const btn = document.getElementById('novaApiTest_' + id);
  if (btn) { btn.disabled = true; btn.textContent = 'Testing...'; }

  const result = await NovaAPI.test(provider);

  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Test';
    btn.classList.toggle('ok-flash', !!result.ok);
    setTimeout(() => btn.classList.remove('ok-flash'), 1500);
  }

  if (result.ok) {
    alert('Connection successful! Provider response: ' + (result.text || '(empty)'));
  } else if (novaApiBusy[id]) {
    // cancelled test, ignore
  } else {
    alert('Connection failed: ' + (result.error || 'Unknown error'));
  }
}
