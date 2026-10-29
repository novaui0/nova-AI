// src/js/modes/modes.js - Plan mode, code mode, model dropdown, search, panel animations

  function openPlanModeUI() {
    if (!checkAccess('pro')) return;
    isPlanMode = true;
    const overlay = document.getElementById('planModeOverlay');
    overlay.classList.add('active');
    document.getElementById('planGoalInput').focus();
    const sound = new Audio('sounds/plan_mode_on.mp3');
    sound.volume = 0.7;
    sound.play().catch(e => console.error("Ses çalınamadı:", e));
  }

  function exitPlanMode() {
    isPlanMode = false;
    const overlay = document.getElementById('planModeOverlay');
    overlay.classList.remove('active');
    const sound = new Audio('sounds/plan_mode_off.mp3');
    sound.volume = 0.5;
    sound.play().catch(e => console.error("Ses çalınamadı:", e));
  }

  function startPlan() {
    const goal = document.getElementById('planGoalInput').value.trim();
    if (!goal) {
      alert("Lütfen bir hedef girin.");
      return;
    }
    // Plan modundan çık ve mesajı gönder
    exitPlanMode();
    sendMessage(`[PLAN MODU] Hedefim: "${goal}"`);
    document.getElementById('planGoalInput').value = ''; // Input'u temizle
  }

  function reorderChats(draggedId, targetId) {
    const draggedIndex = chatOrder.indexOf(draggedId);
    const targetIndex = chatOrder.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Öğeyi kaldır
    const [draggedItem] = chatOrder.splice(draggedIndex, 1);
    // Yeni pozisyona ekle
    const newTargetIndex = chatOrder.indexOf(targetId); // Index değişmiş olabilir
    chatOrder.splice(newTargetIndex, 0, draggedItem);

    saveState();
    renderChatList();
  }

  function toggleAddMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById("addMenu");
    if (menu.style.display === "block") {
      closeAnimatedPanel(menu);
    } else {
      openAnimatedPanel(menu, "block");
    }
  }

  // Menü dışına tıklayınca kapat
  window.onclick = function(event) {
    const menu = document.getElementById("addMenu");
    if (menu.style.display === 'block' && !event.target.closest('.add-menu-container')) {
      closeAnimatedPanel(menu);
    }
    const modelDd = document.getElementById("modelDropdown");
    if (modelDd && modelDd.style.display === 'block' && !event.target.closest('.model-selector')) {
      closeAnimatedPanel(modelDd);
    }
  }

  // ---------- GENEL AÇILIŞ ANİMASYONU YARDIMCILARI ----------
  // Herhangi bir "aniden görünen" öğeyi (dropdown, menü, panel) yumuşak bir
  // fade+scale animasyonuyla açar/kapatır. display:none <-> block/flex
  // arasında şak diye geçiş yapan tüm öğeler bu iki fonksiyonu kullanabilir.
  function openAnimatedPanel(el, displayType = "block") {
    if (!el) return;
    el.style.display = displayType;
    el.classList.remove('panel-anim-out');
    // Yeniden başlatılabilmesi için bir sonraki frame'de class ekle
    requestAnimationFrame(() => {
      el.classList.add('panel-anim-in');
    });
  }
  function closeAnimatedPanel(el) {
    if (!el) return;
    el.classList.remove('panel-anim-in');
    el.classList.add('panel-anim-out');
    setTimeout(() => {
      el.style.display = "none";
      el.classList.remove('panel-anim-out');
    }, 160);
  }

  // Kod modu: aktifken sistem talimatına "sadece kod yaz, açıklama yapma"
  // talimatı eklenir (bkz. systemInstructionText). Buton üstünde yumuşak bir
  // "aç/kapa" animasyonu ile görsel geri bildirim verir.
  function toggleCodeMode() {
    isCodeMode = !isCodeMode;
    const btn = document.getElementById("codeModeBtn");
    if (btn) {
      btn.classList.toggle("active", isCodeMode);
      btn.classList.remove('code-mode-pulse');
      void btn.offsetWidth; // reflow: animasyonun her tıklamada yeniden oynamasını sağlar
      btn.classList.add('code-mode-pulse');
    }
  }

  function toggleModelDropdown() {
    const dd = document.getElementById("modelDropdown");
    const isOpening = dd.style.display !== "block";
    if (isOpening) {
      renderModelDropdown();
      openAnimatedPanel(dd, "block");
    } else {
      closeAnimatedPanel(dd);
    }
  }

  // Model dropdown içeriğini NOVA_MODELS listesinden doldurur. Şu an aktif
  // model işaretli (✓) gösterilir. "Düşünen" model ayrıca küçük bir 🧠
  // rozetiyle vurgulanır.
  function renderModelDropdown() {
    const dd = document.getElementById("modelDropdown");
    dd.innerHTML = NOVA_MODELS.map(m => `
      <div class="model-option ${m.id === activeNovaModelId ? 'active' : ''}" onclick="event.stopPropagation(); selectNovaModel('${m.id}')">
        <div class="model-option-main">
          <span class="model-option-name">${m.label}${m.deepThink ? ' 🧠' : ''}</span>
          <span class="model-option-desc">${m.desc}</span>
        </div>
        ${m.id === activeNovaModelId ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </div>
    `).join('');
  }

  function selectNovaModel(modelId) {
    activeNovaModelId = modelId;
    localStorage.setItem("nova_active_model_id", modelId);
    const model = getActiveNovaModel();
    activeModel = model.geminiModel;
    document.getElementById("activeModelDisplay").innerText = model.label;
    closeAnimatedPanel(document.getElementById("modelDropdown"));
  }

  // forceOpen: true verilirse kutu kapalıysa açar (zaten açıksa dokunmaz),
  // false verilirse kapatır. Parametresiz çağrıda mevcut durumu tersine çevirir
  // (nav-item tıklamasındaki eski davranış).
  function toggleSearchBox(forceOpen = null) {
    const box = document.getElementById("searchBox");
    const isOpen = box.style.display === "block";

    let shouldOpen;
    if (forceOpen === true) shouldOpen = true;
    else if (forceOpen === false) shouldOpen = false;
    else shouldOpen = !isOpen;

    if (shouldOpen) {
      openAnimatedPanel(box, "block");
      const input = box.querySelector('input');
      if (input) setTimeout(() => input.focus(), 50);
    } else {
      closeAnimatedPanel(box);
    }
  }

  function filterChats(query) {
    const q = query.trim().toLowerCase();
    const items = document.querySelectorAll(".chat-item");
    let visibleCount = 0;

    items.forEach(item => {
      const id = item.dataset.chatId;
      const chat = chats[id];
      if (!q) {
        item.style.display = "flex";
        visibleCount++;
        return;
      }

      // Başlıkta ara
      const titleMatch = chat && chat.title && chat.title.toLowerCase().includes(q);
      // Sohbetin TÜM mesaj geçmişinde ara (sadece başlıkta değil)
      const contentMatch = chat && chat.history && chat.history.some(
        m => m.text && m.text.toLowerCase().includes(q)
      );

      const isMatch = titleMatch || contentMatch;
      item.style.display = isMatch ? "flex" : "none";
      if (isMatch) visibleCount++;
    });

    // Hiç sonuç bulunamadıysa listenin altına bir bilgi mesajı göster.
    const list = document.getElementById("chatList");
    let emptyMsg = document.getElementById("chatSearchEmptyMsg");
    if (q && visibleCount === 0) {
      if (!emptyMsg) {
        emptyMsg = document.createElement("div");
        emptyMsg.id = "chatSearchEmptyMsg";
        emptyMsg.style.cssText = "padding: 14px; text-align:center; color: var(--text-muted); font-size: 0.85rem;";
        emptyMsg.innerText = "Eşleşen sohbet bulunamadı.";
        list.appendChild(emptyMsg);
      }
    } else if (emptyMsg) {
      emptyMsg.remove();
    }
  }

