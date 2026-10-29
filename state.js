// src/js/core/state.js - Nova state: API key wiring, model registry, global app state

  // API anahtarı artık burada düz metin olarak DURMUYOR. Electron'un ana
  // süreci (main.js), proje kökündeki .env dosyasından (GEMINI_API_KEY=...)
  // anahtarı okuyup bu değişkeni sayfa yüklenir yüklenmez IPC ile doldurur
  // (bkz. initApiKeyFromEnv() ve aşağıdaki window.onload çağrısı). .env
  // dosyası olmadan (ör. tarayıcıda doğrudan açılırsa) API_KEY boş kalır ve
  // sendMessage() kullanıcıyı buna göre uyarır.
  let API_KEY = "";

  async function initApiKeyFromEnv() {
    if (typeof require === 'undefined') return; // Electron dışı ortam
    try {
      const { ipcRenderer } = require('electron');
      const key = await ipcRenderer.invoke('get-api-key');
      if (key) {
        API_KEY = key;
        if (window.NovaAPI) NovaAPI.setEnvKey('GEMINI_API_KEY', key);
      } else {
        console.warn('GEMINI_API_KEY .env dosyasında bulunamadı. Proje kökünde bir .env dosyası oluşturup GEMINI_API_KEY=... satırını ekleyin (.env.example dosyasına bakın).');
      }
    } catch (e) {
      console.warn('API anahtarı alınamadı:', e);
    }
  }

  const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycby8mZFYQVEWifPj7o-m_rs0CAtZKyKOsytT1pkN0QCCJud5DDEhTGsYB3yIIjQD9zS9/exec";

  // Görünen (Nova markalı) model isimleri ile arka planda gerçekten çağrılan
  // Gemini model kimlikleri arasındaki eşleme. "Düşünen" modelde ayrıca
  // isDeepThinkMode devreye girer (sistem talimatına ek derin düşünme talimatı
  // eklenir) çünkü elimizdeki API anahtarının ayrı bir "thinking" modeline
  // erişimi garanti değil; bu yüzden mevcut modele ek talimatla derin
  // düşünmeyi simüle ediyoruz.
  const NOVA_MODELS = [
    { id: "nova-3.1-mos-turbo", geminiModel: "gemini-3.5-flash-lite", deepThink: false, label: "nova-3.1-mos-turbo", desc: "Hızlı ve dengeli, günlük kullanım için" },
    { id: "nova-3.1-try-flash", geminiModel: "gemini-3.5-flash-lite", deepThink: false, label: "nova-3.1-try-flash", desc: "Deneysel, hızlı yanıtlar" },
    { id: "nova-3.1-swift-flash", geminiModel: "gemini-3.5-flash-lite", deepThink: false, label: "nova-3.1-swift-flash", desc: "En hızlı yanıt süresi" },
    { id: "nova-3.1-deep-think", geminiModel: "gemini-3.5-flash-lite", deepThink: true, label: "nova-3.1-deep-think", desc: "Karmaşık problemler için derinlemesine düşünür" },
  ];
  let activeNovaModelId = localStorage.getItem("nova_active_model_id") || "nova-3.1-mos-turbo";

  function getActiveNovaModel() {
    return NOVA_MODELS.find(m => m.id === activeNovaModelId) || NOVA_MODELS[0];
  }

  // Input kutusunun kenarında dönen "ışık halkası" özelliği kaldırıldı
  // (farklı Chromium/Electron sürümlerinde CSS mask düzgün çalışmıyordu,
  // kutunun dışına taşan uzun bir çizgi/kuyruk olarak görünüyordu). Bu iki
  // fonksiyon, kod içindeki çağrı noktalarını tek tek değiştirmemek için
  // bilerek no-op (hiçbir şey yapmayan) bırakıldı.
  function startThinkingGlow() {}
  function stopThinkingGlow() {}

  // activeModel: geriye dönük uyumluluk için tutuluyor (gerçek Gemini model
  // adı). fetch çağrısı bunu kullanır.
  let activeModel = getActiveNovaModel().geminiModel;

  let currentAuthMode = "login";
  let chats = JSON.parse(localStorage.getItem("nova_chats")) || {};
  let currentChatId = localStorage.getItem("nova_active_chat") || null;
  let attachedFiles = [];
  let isPlanMode = false;
  let isCodeMode = false;
  let chatOrder = [];
  let isPremiumUser = false;
  let currentUserTier = 'none';
  let userPoints = 0;
  // Hangi sohbet id'lerinin şu anda arka planda Nova'dan cevap beklediğini tutar.
  // Kullanıcı cevap gelmeden başka bir sohbete geçse bile istek iptal edilmez;
  // sidebar'da o sohbetin yanında dönen bir gösterge (spinner) gösterilir.
  let pendingChatIds = new Set();
  // Her sohbet için devam eden isteği iptal edebilmek için AbortController
  // tutulur. Kullanıcı "Durdur" butonuna bastığında bu controller abort()
  // edilir; fetch isteği ve daktilo efekti döngüsü buna göre durur.
  let activeAbortControllers = {};

