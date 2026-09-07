const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 10000;

// Render'ın web arayüzünü görmesi için index.html'i dışarı açıyoruz
app.use(express.static(__dirname));

app.get('/', (req, res) => {
    if (fs.existsSync(path.join(__dirname, 'index.html'))) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        res.send("Nova AI Yapay Zeka Sunucusu 7/24 Aktif!");
    }
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda başarıyla başlatıldı.`);
});

// Masaüstü (Electron) ortamındaki IPC yapılarını sunucu için güvenli hale getiriyoruz
global.ENV = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || ""
};

console.log("Masaüstü modülleri köprülendi. Yapay zeka arka plan görevleri çalışıyor...");
