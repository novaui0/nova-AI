// src/js/core/app-updates.js - Electron update-check IPC

  function checkForUpdatesManual() {
    if (typeof require !== 'undefined') {
      require('electron').ipcRenderer.send('check_for_updates_manual');
    }
  }
  // --- ELECTRON IPC (GÜNCELLEME) ---

  // isManualCheck bayrağını global olarak tanımla
  let isManualCheck = false;

  if (typeof require !== 'undefined') {
    try {
      const { ipcRenderer } = require('electron'); 

      // Manuel kontrol başlatıldığında bayrağı ayarla
      ipcRenderer.on('checking_for_updates', () => {
        isManualCheck = true;
      });

      ipcRenderer.on('update_available', (event, version) => {
        if (isManualCheck) {
          if (confirm(`Güncelleme Bulundu (v${version}). İndirilsin mi?`)) {
            startUpdateDownload(); // İndirmeyi başlat
          }
          isManualCheck = false; // Bayrağı sıfırla
        } else {
          // Otomatik kontrol: Modal'ı göster
          const verElem = document.getElementById('newVersionNumber');
          if(verElem) verElem.innerText = 'v' + version;
          document.getElementById('updateModal').classList.add('active');
        }
      });

      ipcRenderer.on('download_progress', (event, percent) => {
        // Hem modal hem de belki ileride eklenecek başka bir gösterge için
        const pBar = document.getElementById('progressBar');
        const pText = document.getElementById('progressText');
        if(pBar) pBar.style.width = percent + '%';
        if(pText) pText.innerText = `İndiriliyor: %${Math.round(percent)}`;
      });

      ipcRenderer.on('update_not_available', () => {
        console.log("Update not available event received in renderer. isManualCheck:", isManualCheck);
        if (isManualCheck) {
          alert("Güncelleme Bulunamadı. Daha Sonra Tekrar Dene.");
          isManualCheck = false; // Bayrağı sıfırla
        }
      });

      // İndirme işlemini başlatan fonksiyon
      window.startUpdateDownload = function() {
        document.getElementById('updateActionBtns').style.display = 'none';
        document.getElementById('progressContainer').style.display = 'block';
        ipcRenderer.send('start_download');
      };

      ipcRenderer.on('update_error', (event, message) => {
        if (isManualCheck) {
          alert(`Güncelleme kontrolü sırasında bir hata oluştu: ${message}. Lütfen internet bağlantınızı kontrol edin veya daha sonra tekrar deneyin.`);
          isManualCheck = false;
        }
      });

      // Uygulama sürümünü al
      // main.js, sayfa tamamen yüklendiğinde ('did-finish-load') 'start-app'
      // event'ini gönderir. Daha önce burada 'server-ready-signal' bekleniyordu
      // ama main.js hiçbir zaman böyle bir event göndermiyordu — bu yüzden
      // renderer-ready-for-updates asla tetiklenmiyor, otomatik güncelleme
      // kontrolü hiç çalışmıyordu.
      ipcRenderer.on('start-app', () => {
        console.log("start-app sinyali alındı, güncelleme kontrolü başlatılıyor.");
        ipcRenderer.send('renderer-ready-for-updates');
      });

      ipcRenderer.send('get-app-version');
      ipcRenderer.on('app_version', (event, version) => {
        const versionDisplay = document.getElementById('appVersionDisplay');
        if (versionDisplay) versionDisplay.innerText = 'Sürüm ' + version;
      });
    } catch (err) { console.error("IPC Bağlantı Hatası:", err); }
  }

  function closeUpdateModal() {
    document.getElementById('updateModal').classList.remove('active');
  }

