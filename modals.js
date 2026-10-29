// src/js/ui/modals.js - Modal helpers, tips of the day, gallery, library, notebook

  function openModal(id) {
    const modal = document.getElementById(id);
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add("active"), 10); // Animasyon için küçük bir gecikme
    if (id === 'upgradeModal') {
      document.getElementById('currentTierLabel').textContent = premiumTiers[currentUserTier]?.name || 'Standart';
      document.getElementById('upgradeModalPoints').textContent = `${userPoints.toLocaleString()} Puan`;
      renderTiers();
    }
    if (id === "imagesModal") loadGallery();
    if (id === "libraryModal") loadLibrary();
    if (id === "settingsModal") {
      const style = localStorage.getItem('nova_thinking_style') || 'dots';
      const radio = document.querySelector(`input[name="thinkingStyle"][value="${style}"]`);
      if (radio) radio.checked = true;
      renderPersonalityOptions();
      syncVoiceSettingsUI();
      renderApiSettings();
      if (typeof initNovaBackground === 'function') initNovaBackground();
    }
  }

  // Düşünüyor göstergesi tercihini kaydeder (dönen logo / zıplayan noktalar)
  function setThinkingStyle(style) {
    localStorage.setItem('nova_thinking_style', style);
  }

  // Ayarlar > Uygulama sekmesindeki kişilik seçim kartlarını render eder.
  // Her karta tıklanınca seçilir; "Özel" seçilirse serbest metin alanı açılır.
  function renderPersonalityOptions() {
    const list = document.getElementById('personalityOptionsList');
    if (!list) return;
    const activeId = getActivePersonalityId();
    list.innerHTML = Object.entries(NOVA_PERSONALITIES).map(([id, p]) => `
      <div class="personality-option ${id === activeId ? 'active' : ''}" onclick="selectPersonality('${id}')">
        <div class="personality-option-main">
          <span class="personality-option-name">${p.label}</span>
          <span class="personality-option-desc">${p.desc}</span>
        </div>
        ${id === activeId ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </div>
    `).join('');

    const customInput = document.getElementById('customPersonalityInput');
    if (customInput) {
      customInput.style.display = activeId === 'custom' ? 'block' : 'none';
      customInput.value = localStorage.getItem('nova_custom_personality') || '';
    }
  }

  function selectPersonality(id) {
    localStorage.setItem('nova_personality', id);
    renderPersonalityOptions();
    if (id === 'custom') {
      setTimeout(() => document.getElementById('customPersonalityInput')?.focus(), 50);
    }
  }

  function saveCustomPersonalityText(text) {
    localStorage.setItem('nova_custom_personality', text);
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("active");
    if (id === 'tipModal') {
      if (document.getElementById('dontShowTipAgain').checked) {
        localStorage.setItem('nova_show_tip', 'false');
      }
    }
    // Animasyon bittikten sonra display:none yap
    setTimeout(() => modal.style.display = 'none', 300);
  }

  function showTipOfTheDay() {
    if (localStorage.getItem('nova_show_tip') === 'false') {
      return;
    }
    const randomTip = dailyTips[Math.floor(Math.random() * dailyTips.length)];
    document.getElementById('tipContent').innerHTML = marked.parse(randomTip);
    openModal('tipModal');
  }

  async function checkAppVersion() {
    if (typeof require === 'undefined') return;
    const { ipcRenderer } = require('electron');
    
    ipcRenderer.send('get-app-version');
    ipcRenderer.once('app_version', async (event, currentVersion) => {
      const lastVersion = localStorage.getItem('nova_app_version');
      if (currentVersion !== lastVersion) {
        // Yeni sürüm! Yenilikleri göster.
        try {
          const response = await fetch('https://raw.githubusercontent.com/novaui0/nova-AI/main/RELEASE_NOTES.md');
          const notes = await response.text();
          document.getElementById('releaseNotesContent').innerHTML = marked.parse(notes);
          openModal('releaseNotesModal');
        } catch (error) { console.error("Sürüm notları alınamadı:", error); }
        localStorage.setItem('nova_app_version', currentVersion);
      }
    });
  }

  function loadGallery() {
    const gal = document.getElementById("imagesGallery");
    gal.innerHTML = "";
    let count = 0;
    Object.values(chats).forEach(c => {
      c.history.forEach(m => {
        if (m.files) {
          m.files.filter(f => f.type === "image").forEach(img => {
            gal.innerHTML += `<img src="data:${img.mime_type};base64,${img.data}" style="width:100%; border-radius:10px;">`;
            count++;
          });
        }
      });
    });
    if (count === 0) gal.innerText = "Henüz görsel yüklenmemiş.";
  }

  function loadLibrary() {
    const lib = document.getElementById("libraryList");
    lib.innerHTML = "";
    Object.keys(chats).forEach(id => {
      lib.innerHTML += `<div style="padding:8px 0; border-bottom:1px solid #eee; cursor:pointer;" onclick="closeModal('libraryModal'); loadChat('${id}');">💬 ${chats[id].title}</div>`;
    });
  }

  function saveNotebook() {
    const text = document.getElementById("notebookText").value;
    localStorage.setItem("nova_notebook", text);
    alert("Not kaydedildi!");
    closeModal("notebookModal");
  }

