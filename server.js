// server.js

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5500; // Sunucunun çalışacağı port

// Gelen JSON verilerini okuyabilmek ve CORS hatalarını önlemek için
app.use(cors({
  origin: '*' // Geliştirme için tüm kaynaklara izin ver. Gerçek uygulamada burayı kendi domain'inizle değiştirin.
}));
app.use(express.json());

app.listen(PORT, () => {
  console.log(`Nova-AI sunucusu http://localhost:${PORT} adresinde çalışıyor.`);
});
