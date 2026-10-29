// src/boot.js - Boot: window.onload + keyboard shortcuts


  window.onload = () => {
    // Klavye kısayolları, sonraki adımlardan biri (örn. React render'ı) hata
    // verse bile çalışmaya devam etmesi için en başta kaydedilir.
    try { initKeyboardShortcuts(); } catch (e) { console.error("initKeyboardShortcuts hatası:", e); }
    // API anahtarı .env üzerinden (Electron ana süreci ile) en erken
    // aşamada alınır ki kullanıcı ilk mesajı gönderdiğinde hazır olsun.
    initApiKeyFromEnv();
    try { toggleDarkMode(true); } catch (e) { console.error(e); }
    try { initNovaBackground(); } catch (e) { console.error(e); }
    try { renderTemplates(); } catch (e) { console.error(e); }
    try { renderTiers(); } catch (e) { console.error(e); }
    // React MainMenu (text/babel, harici src) Babel tarafindan ASYNC
    // derlenir; sayfa onload aninda MainMenu henüz tanimli olmayabilir.
    // Direkt cagri "MainMenu is not defined" hatasi veriyordu; hazır
    // olana kadar 100ms aralıklarla yeniden dener (en fazla 6 saniye),
    // hazir olmazsa (babel yüklenemedi) auth ekranına duser.
    let novaSelectionRetries = 60;
    function novaShowSelectionWhenReady() {
      if (typeof MainMenu === 'function' || novaSelectionRetries-- <= 0) {
        if (typeof MainMenu === 'function') {
          try { showUserSelectionScreen(); } catch (e) { console.error(e); }
        } else {
          console.warn("MainMenu derlenemedi (Babel/CDN?) — auth ekranına geçiliyor.");
          try { showAuthScreen(); } catch (e) { console.error(e); }
        }
      } else {
        setTimeout(novaShowSelectionWhenReady, 100);
      }
    }
    novaShowSelectionWhenReady();
    try { showTipOfTheDay(); } catch (e) { console.error(e); }
  }

  // Genel klavye kısayolları. Ctrl/Cmd kombinasyonları input/textarea
  // içindeyken de çalışır (aksi halde kullanıcı yazarken tetiklenmezler);
  // tek başına Escape gibi tuşlar ise sadece odak bir yazı alanında
  // değilken devreye girer, aksi halde yazarken rahatsız edici olur.
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const ctrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd + Shift + O -> Yeni sohbet
      if (ctrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        if (document.getElementById('appContainer').classList.contains('active')) {
          createNewChat();
        }
        return;
      }

      // Ctrl/Cmd + K -> Sohbetlerde ara kutusunu aç/odakla
      if (ctrlOrCmd && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (document.getElementById('appContainer').classList.contains('active')) {
          toggleSearchBox(true); // true: kutu kapalıysa aç ve odakla
        }
        return;
      }

      // Escape -> açık bir modal varsa kapat, yoksa arama kutusunu kapat
      if (e.key === 'Escape') {
        const openModalEl = document.querySelector('.modal-overlay.active');
        if (openModalEl) {
          closeModal(openModalEl.id);
          return;
        }
        const searchBox = document.getElementById('searchBox');
        if (searchBox && searchBox.style.display === 'block') {
          toggleSearchBox(false);
        }
        return;
      }
    });
  }
