const { app, BrowserWindow, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

let mainWindow;

// Otomatik indirmeyi kapatıyoruz (Kullanıcı 'İndir' butonuna basınca başlayacak)
autoUpdater.autoDownload = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // HTML dosyasını tam dosya yoluyla yüklüyoruz (Beyaz ekran sorununu çözer)
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    // Uygulama açıldıktan 2 saniye sonra güncellemeleri kontrol et
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(err => console.log("Güncelleme kontrol hatası:", err));
    }, 2000);
  });
}

app.whenReady().then(createWindow);

// --- GÜNCELLEME OLAYLARI (IPC) ---

// 1. Yeni Güncelleme Bulundu -> HTML'e haber ver
autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update_available', info.version);
  }
});

// 2. Kullanıcı "İndir" butonuna bastı -> İndirmeyi başlat
ipcMain.on('start_download', () => {
  autoUpdater.downloadUpdate();
});

// 3. İndirme Yüzdesi -> HTML'e gönder
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('download_progress', Math.round(progressObj.percent));
  }
});

// 4. İndirme Bitti -> Uygulamayı kapat ve yeni sürümü kur
autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall();
});

function setChatUser(username) {
  // Karşılama ekranındaki ismi ayarla
  const nameElem = document.getElementById('welcomeUserName');
  if (nameElem) {
    nameElem.innerText = username;
  }
}

// Mesaj gönderme tetiklendiğinde karşılama ekranını gizleyip sohbet akışını açan mantık
function sendMessage() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;

  // İlk mesaj atıldığında ortadaki büyük karşılama yazısını gizle, sohbet geçmişini göster
  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('messagesContainer').style.display = 'flex';

  // Mesaj ekleme kodların buraya devam edecek...
  input.value = '';
}

