// src/js/chat/chat-manager.js - Chat lifecycle: create/rename/delete, list render, drag-and-drop

  function createNewChat() {
    // Boş sohbet birikmesini önle: kullanıcı "Yeni Sohbet"e basıp hiç mesaj
    // yazmadan tekrar "Yeni Sohbet"e basarsa, önceki boş sohbeti sidebar'da
    // anlamsızca biriktirmek yerine sil.
    cleanupEmptyChat(currentChatId);

    const id = "chat_" + Date.now();
    chats[id] = { title: "Yeni Sohbet", history: [], createdAt: new Date().toISOString() };
    chatOrder.unshift(id); // Yeni sohbeti listenin başına ekle
    currentChatId = id;
    saveState();
    renderChatList();
    loadChat(id);
    // Yeni sohbet eski taslağı ve ekleri taşımadan yazmaya hazır açılsın.
    attachedFiles = [];
    renderChips();
    const input = document.getElementById("userInput");
    input.value = "";
    input.style.height = "auto";
    updateCharCounter();
    input.focus();
  }

  // Verilen sohbet hiç mesaj içermiyorsa (boşsa) ve arka planda bir işlem
  // beklemiyorsa sessizce siler. "Yeni Sohbet" başlığı hâlâ değişmemişse ve
  // history boşsa bu sohbet kullanıcı tarafından hiç kullanılmamış demektir.
  function cleanupEmptyChat(id) {
    if (!id || !chats[id]) return;
    if (pendingChatIds.has(id)) return; // Arka planda bir şey bekleniyorsa dokunma
    if (chats[id].history.length === 0) {
      delete chats[id];
      chatOrder = chatOrder.filter(cid => cid !== id);
    }
  }

  function saveState() {
    localStorage.setItem(`nova_chats_${currentUserEmail}`, JSON.stringify(chats));
    localStorage.setItem(`nova_active_chat_${currentUserEmail}`, currentChatId);
    localStorage.setItem(`nova_chat_order_${currentUserEmail}`, JSON.stringify(chatOrder));
  }

  function renderChatList() {
    const list = document.getElementById("chatList");
    list.innerHTML = "";
    
    // Kayıtlı sıralamaya göre render et
    chatOrder.forEach(id => {
      if (!chats[id]) return; // Silinmiş ama order'da kalmış sohbetleri atla
      const item = document.createElement("div");
      item.className = `chat-item ${id === currentChatId ? 'active' : ''}`;      
      item.draggable = true;
      item.dataset.chatId = id;
      item.ondblclick = () => {
        const titleSpan = item.querySelector('.chat-item-title');
        const currentTitle = titleSpan.innerText;
        titleSpan.style.display = 'none';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'chat-item-input';
        input.value = currentTitle;
        
        const saveRename = () => {
          const newTitle = input.value.trim();
          if (newTitle && newTitle !== currentTitle) {
            chats[id].title = newTitle;
            saveState();
          }
          renderChatList(); // Her durumda listeyi yeniden çiz
        };

        input.onblur = saveRename;
        input.onkeydown = (e) => { if (e.key === 'Enter') saveRename(); };

        item.prepend(input);
        input.focus();
      };
      item.onclick = (e) => {
        if (e.target.classList.contains('delete-chat-btn') || e.target.tagName === 'INPUT') return;
        if (id !== currentChatId) cleanupEmptyChat(currentChatId); // Terk edilen boş sohbeti temizle
        loadChat(id);
      };

      item.addEventListener('dragstart', handleDragStart);
      item.addEventListener('dragend', handleDragEnd);
      item.addEventListener('dragover', handleDragOver);
      item.addEventListener('dragleave', handleDragLeave);
      item.addEventListener('drop', handleDrop);

      const titleSpan = document.createElement('span');
      titleSpan.className = 'chat-item-title';
      titleSpan.innerText = chats[id].title;

      const dateSpan = document.createElement('span');
      dateSpan.className = 'chat-item-date';
      if (chats[id].createdAt) {
        dateSpan.innerText = new Date(chats[id].createdAt).toLocaleDateString('tr-TR');
      }

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-chat-btn';
      deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>';
      deleteBtn.title = 'Sohbeti Sil';
      deleteBtn.onclick = (e) => {
        e.stopPropagation(); // Üstteki div'in onclick'ini tetikleme
        deleteChat(id);
      };

      item.appendChild(titleSpan);
      // Bu sohbet arka planda hâlâ Nova'dan cevap bekliyorsa (kullanıcı başka
      // bir sohbete geçmiş olsa bile) dönen bir gösterge ekle; tarih/silme
      // butonu yerine geçici olarak bunu göster.
      if (pendingChatIds.has(id)) {
        const spinner = document.createElement('span');
        spinner.className = 'chat-item-spinner';
        spinner.title = 'Nova yanıt üretiyor...';
        item.appendChild(spinner);
      } else {
        item.appendChild(dateSpan);
        item.appendChild(deleteBtn);
      }
      list.appendChild(item);
    });
  }

  function loadChat(id) {
    currentChatId = id;
    saveState();
    renderChatList();
    
    const container = document.getElementById("messagesContainer");
    const heroTitle = document.getElementById("heroTitle");
    container.innerHTML = "";

    if (chats[id].history.length === 0) {
      heroTitle.style.display = "block";
    } else {
      heroTitle.style.display = "none";
      chats[id].history.forEach(msg => appendMessageUI(msg.text, msg.role, msg.files));
    }

    // Bu sohbet hâlâ arka planda cevap bekliyorsa (kullanıcı yanıt gelmeden
    // önce başka sohbete geçmiş, şimdi geri dönmüş), "Nova Düşünüyor..."
    // balonunu tekrar göster ki cevabın hâlâ üretildiği anlaşılsın.
    if (pendingChatIds.has(id)) {
      heroTitle.style.display = "none";
      appendMessageUI("Nova Düşünüyor...", "bot");
      startThinkingGlow();
    } else {
      stopThinkingGlow();
    }

    // Bu sohbete özel "Durdur" / "Gönder" buton durumunu güncelle.
    updateStopButtonVisibility();
  }

  function deleteChat(id) {
    if (confirm(`'${chats[id].title}' başlıklı sohbeti kalıcı olarak silmek istediğinizden emin misiniz?`)) {
      delete chats[id];
      chatOrder = chatOrder.filter(chatId => chatId !== id);

      // Eğer silinen sohbet aktif sohbet ise
      if (currentChatId === id) {
        const remainingChatIds = Object.keys(chats);
        if (remainingChatIds.length > 0) {
          // Kalan ilk sohbete geç
          loadChat(remainingChatIds[0]);
        } else {
          // Hiç sohbet kalmadıysa yeni bir tane oluştur
          createNewChat();
        }
      }
      saveState();
      renderChatList();
    }
  }

  // Sürükle-Bırak Fonksiyonları
  let draggedItemId = null;

  function handleDragStart(e) {
    draggedItemId = e.target.dataset.chatId;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    draggedItemId = null;
    // Tüm indicator'ları temizle
    document.querySelectorAll('.drop-indicator').forEach(ind => ind.remove());
  }

  function handleDragOver(e) {
    e.preventDefault();
    const targetItem = e.target.closest('.chat-item');
    if (!targetItem || targetItem.dataset.chatId === draggedItemId) return;

    // Mevcut indicator'ları temizle
    document.querySelectorAll('.drop-indicator').forEach(ind => ind.remove());

    const rect = targetItem.getBoundingClientRect();
    const isAfter = e.clientY > rect.top + rect.height / 2;

    const indicator = document.createElement('div');
    indicator.className = 'drop-indicator';
    indicator.style.top = isAfter ? `${rect.height}px` : '0px';
    targetItem.appendChild(indicator);
  }

  function handleDragLeave(e) {
    // Sadece item'dan tamamen çıkıldığında indicator'u kaldır
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.querySelector('.drop-indicator')?.remove();
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const targetItemId = e.target.closest('.chat-item').dataset.chatId;
    reorderChats(draggedItemId, targetItemId);
    document.querySelectorAll('.drop-indicator').forEach(ind => ind.remove());
  }

