// src/js/app/open-app.js - App bootstrap (openApp) + settings/profile helpers

  async function openApp() {
    try {
      await openAppInner();
    } catch (err) {
      // openApp() içinde HERHANGİ bir noktada beklenmedik bir hata oluşursa
      // (örn. eksik bir DOM elementi, null erişimi vb.) bu hatayı sessizce
      // yutmak yerine konsola yazdır ve state'in mümkün olduğunca kurulu
      // kalmasını sağla. Daha önce bu tür hatalar renderChatList()'e hiç
      // ulaşılamamasına ve sohbetlerin "kaybolmuş" gibi görünmesine sebep
      // oluyordu.
      console.error("openApp() içinde hata:", err);
      // Kritik state (chats/chatOrder/currentChatId) muhtemelen zaten
      // kurulmuş durumda; en azından sohbet listesini ve mevcut sohbeti
      // göstermeyi dene.
      try {
        document.getElementById("appContainer").classList.add("active");
        renderChatList();
        if (currentChatId && chats[currentChatId]) loadChat(currentChatId);
      } catch (e2) {
        console.error("Kurtarma denemesi de başarısız oldu:", e2);
      }
    }
  }

  async function openAppInner() {
    // Yükleme ekranını gizle ve ana uygulamayı göster
    document.getElementById("userSelectionRoot").style.display = "none"; // Zaten gizli olmalı
    document.getElementById("authContainer").style.display = "none"; // Zaten gizli olmalı
    currentUserEmail = localStorage.getItem("nova_user_email");
    currentUser = localStorage.getItem("nova_user");
    userPoints = parseInt(localStorage.getItem(`nova_points_${currentUserEmail}`) || 0);
    currentUserTier = localStorage.getItem(`nova_premium_tier_${currentUserEmail}`) || 'none'; 
    currentUserAvatar = localStorage.getItem(`nova_avatar_${currentUserEmail}`) || (currentUser ? currentUser[0].toUpperCase() : '?');
    isPremiumUser = currentUserTier !== 'none';

    // Model seçicinin gösterdiği isim, sayfa yenilendiğinde de son seçilen
    // modelle tutarlı olsun.
    const activeModelDisplayEl = document.getElementById("activeModelDisplay");
    if (activeModelDisplayEl) activeModelDisplayEl.innerText = getActiveNovaModel().label;

    // Kullanıcının güncel puan/premium/ban durumunu yerel (localStorage)
    // "nova_all_users" kaydından oku. Bu, sitenin tek gerçek kaynağıdır.
    if (currentUserEmail) {
      const allUsers = JSON.parse(localStorage.getItem("nova_all_users")) || {};
      const storedUser = allUsers[currentUserEmail];
      if (storedUser) {
        if (storedUser.banned) {
          showBanModal({
            ban_reason: storedUser.banReason,
            ban_duration: storedUser.banDuration,
            banned_at: storedUser.bannedAt,
          });
          logout();
          return;
        }
        userPoints = storedUser.points || 0;
        currentUserTier = storedUser.premiumTier || 'none';
        isPremiumUser = currentUserTier !== 'none';
        localStorage.setItem(`nova_points_${currentUserEmail}`, userPoints);
        localStorage.setItem(`nova_premium_tier_${currentUserEmail}`, currentUserTier);

        // Günlük giriş bonusu: kullanıcı bugün ilk kez giriş yapıyorsa otomatik
        // puan ver (takvim günü bazında, son giriş bonusu tarihine göre).
        const today = new Date().toDateString();
        if (storedUser.lastDailyBonus !== today) {
          const DAILY_BONUS = 500;
          storedUser.points = (storedUser.points || 0) + DAILY_BONUS;
          storedUser.lastDailyBonus = today;
          allUsers[currentUserEmail] = storedUser;
          localStorage.setItem("nova_all_users", JSON.stringify(allUsers));
          userPoints = storedUser.points;
          localStorage.setItem(`nova_points_${currentUserEmail}`, userPoints);
          setTimeout(() => {
            showDailyBonusToast(DAILY_BONUS);
          }, 800);
        }
      }
    }
    
    chats = JSON.parse(localStorage.getItem(`nova_chats_${currentUserEmail}`)) || {};
    chatOrder = JSON.parse(localStorage.getItem(`nova_chat_order_${currentUserEmail}`)) || Object.keys(chats).reverse();

    // ONARIM: chatOrder ile chats objesi zaman içinde (silme/hatalı state gibi
    // durumlarla) senkronsuz kalmış olabilir. chats içinde olup chatOrder'da
    // olmayan sohbetleri başa ekle, chatOrder'da olup chats'te artık olmayan
    // (silinmiş) kayıtları çıkar. Bu olmadan var olan sohbetler chats objesinde
    // dursa bile sidebar'da hiç görünmeyebiliyordu.
    const existingIds = new Set(chatOrder);
    Object.keys(chats).forEach(id => {
      if (!existingIds.has(id)) chatOrder.unshift(id);
    });
    chatOrder = chatOrder.filter(id => chats[id]);

    currentChatId = localStorage.getItem(`nova_active_chat_${currentUserEmail}`) || null;

    // Onarılmış chatOrder'ı kalıcı hale getir (chats boşsa currentChatId henüz
    // set edilmediği için burada sadece chats/chatOrder anahtarlarını yazıyoruz).
    if (currentUserEmail) {
      localStorage.setItem(`nova_chats_${currentUserEmail}`, JSON.stringify(chats));
      localStorage.setItem(`nova_chat_order_${currentUserEmail}`, JSON.stringify(chatOrder));
    }

    // Geçerli bir aktif sohbet yoksa (ör. kullanıcı ilk kez giriş yapıyor ya da
    // kayıtlı aktif sohbet artık mevcut değilse) burada YENİ BİR SOHBET oluştur.
    // Bu olmadan currentChatId null kalıyor ve ilk mesaj gönderildiğinde
    // chats[currentChatId] undefined olduğu için sendMessage sessizce hata
    // veriyordu (mesaj balonu görünüyor ama cevap hiç gelmiyordu).
    if (!currentChatId || !chats[currentChatId]) {
      const id = "chat_" + Date.now();
      chats[id] = { title: "Yeni Sohbet", history: [], createdAt: new Date().toISOString() };
      chatOrder.unshift(id);
      currentChatId = id;
      saveState();
    }

    document.getElementById("appContainer").classList.add("active");
    document.getElementById("userNameDisplay").textContent = currentUser; // Bu zaten doğru
    document.getElementById("heroTitle").innerHTML = marked.parse(`**Merhaba, <span id="welcomeUser">${currentUser}</span><br>Bugün sana nasıl yardımcı olabilirim?`);
    document.getElementById("heroTitle").innerHTML = `Merhaba, <span id="welcomeUser">${currentUser}</span>.<br>Bugün sana nasıl yardımcı olabilirim?`;

    // Animasyonlu giriş için sınıf ekle
    const appContainer = document.getElementById("appContainer");
    appContainer.classList.add("entering");
    setTimeout(() => appContainer.classList.remove("entering"), 550);
    
    const planBadge = document.getElementById('currentPlanBadge');
    if (currentUserTier !== 'none') {
      planBadge.textContent = currentUserTier.toUpperCase();
      planBadge.style.display = 'inline-block';
    } else {
      planBadge.style.display = 'none';
    }

    document.getElementById("settingsUsernameInput").value = currentUser;
    updateAvatarUI(currentUserAvatar); // Avatarı güncelle

    // Ayarlar modalını ilk açılışta sıfırla
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.settings-tab[onclick*="profile"]').classList.add('active');
    document.getElementById('settings-profile').classList.add('active');


    if (!currentChatId || !chats[currentChatId]) {
      createNewChat();
    } else {
      renderChatList();
      loadChat(currentChatId);
    }

    checkAppVersion(); // Uygulama sürümünü kontrol et ve yenilikleri göster
    // Bu bir Electron masaüstü uygulaması içinde çalışıyorsa ana sürece bildir.
    // Normal bir tarayıcıda (index.html doğrudan açıldığında) ipcRenderer
    // tanımsızdır; kontrolsüz çağrılırsa ReferenceError fırlatıp openApp()'ın
    // geri kalanını (ve state kurulumunu) yarıda keserdi — bu da ilk mesajın
    // sessizce başarısız olmasına yol açan asıl sebepti.
    if (typeof require === 'function') {
      try {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('renderer-ready-for-updates'); // Renderer hazır olduğunda ana sürece bildir
      } catch (e) {
        // Electron dışı ortam: sorun değil, sessizce geç.
      }
    }
    
    // Giriş sesini çal
    const entrySound = new Audio('sounds/menugirisses.mp3');
    entrySound.volume = 0.7;
    entrySound.play().catch(e => console.error("Giriş sesi çalınamadı:", e));

    // Sesli asistanı (uyandırma kelimesi + TTS) hazırla. Ayarlarda açıksa
    // arka planda "Nova uyan" dinlemeye başlar.
    try { initNovaVoice(); } catch (e) { console.error("Sesli asistan başlatılamadı:", e); }
  }
  
  function renderMainMenu() {
    // Bu fonksiyon artık kullanılmıyor, React render edecek.
  }

  function switchSettingsTab(tabElement, tabId) {
    // Tüm tabları ve içerikleri pasif yap
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-content').forEach(c => c.classList.remove('active'));

    // Tıklananı aktif yap
    tabElement.classList.add('active');
    document.getElementById(`settings-${tabId}`).classList.add('active');
  }

  function updateAvatarUI(avatarData) {
    const avatarDiv = document.getElementById("userAvatar");
    const settingsAvatarInput = document.getElementById("settingsAvatarInput"); // Bazı ekranlarda mevcut olmayabilir
    if (!avatarDiv) return;
    if (avatarData && avatarData.startsWith('data:image')) {
      avatarDiv.style.backgroundImage = `url(${avatarData})`;
      avatarDiv.innerText = '';
      if (settingsAvatarInput) settingsAvatarInput.value = ''; // Resim varsa emoji/metin alanını boş bırak
    } else {
      avatarDiv.style.backgroundImage = 'none';
      avatarDiv.innerText = avatarData || '?';
      if (settingsAvatarInput) settingsAvatarInput.value = avatarData || '';
    }
  }

  function handleImageEditUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target.result;
      const previewDiv = document.getElementById('imageEditPreview');
      previewDiv.innerHTML = `
        <img src="${imageUrl}" style="max-width: 100%; max-height: 200px; border-radius: 10px; margin-bottom: 10px;">
        <textarea id="imageEditPrompt" style="width:100%; height:60px; border-radius:10px; padding:10px; border:1px solid var(--border-color);" placeholder="Örn: Arka planı uzay yap, saçını maviye boya..."></textarea>
        <button onclick="startImageEdit('${imageUrl}')" class="upgrade-btn" style="width:100%; margin-top: 10px;">Düzenlemeyi Başlat</button>
      `;
    };
    reader.readAsDataURL(file);
  }

  async function startImageEdit(base64ImageUrl) {
    const prompt = document.getElementById('imageEditPrompt').value.trim();
    if (!prompt) {
      alert("Lütfen yapmak istediğiniz değişikliği açıklayın.");
      return;
    }
    closeModal('imageEditModal');
    document.getElementById('imageEditPreview').innerHTML = ''; // Temizle

    const botMessageDiv = appendMessageUI("Görsel düzenleniyor...", "bot");
    const editImageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?image=${encodeURIComponent(base64ImageUrl)}`;
    
    // generateImageInChat fonksiyonunu yeniden kullanarak sonucu göster
    await generateImageInChat(prompt, botMessageDiv, editImageUrl);
  }

