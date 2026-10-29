// src/js/voice/voice-assistant.js - Voice assistant: wake word, question listen, TTS

  /* =========================================================================
     NOVA SESLİ ASİSTAN — "Nova uyan" / "Nova wake up"
     -------------------------------------------------------------------------
     Uyandırma kelimesi tespiti tamamen yerel ve ücretsizdir: tarayıcının
     yerleşik Web Speech API'si sürekli dinleme modunda çalışır, gelen metin
     normalize edilip basit bir bulanık (Levenshtein toleranslı) eşleştirmeyle
     "nova + uyan/wake" kalıbına benzetilir. Harici bir servis, model dosyası
     ya da ücretli API kullanılmaz.

     Akış:
       1. Boşta  : uyandırma kelimesi dinlenir.
       2. Uyanma : kısa bir bip çalar, mikrofon soru dinlemeye geçer.
       3. Soru   : sessizlik algılanınca metin sendMessage() ile Nova'ya gider.
       4. Cevap  : gelen yanıt konuşma metnine sadeleştirilip speechSynthesis
                   ile sesli okunur, ardından tekrar 1. adıma dönülür.
     ========================================================================= */

  const NOVA_WAKE_ENABLED_KEY = 'nova_wake_enabled';
  const NOVA_TTS_ENABLED_KEY = 'nova_tts_enabled';
  const NOVA_VOICE_LANG_KEY = 'nova_voice_lang';
  const NOVA_TTS_RATE_KEY = 'nova_tts_rate';

  // Uyandırma kelimesinin parçaları. İsim + eylem şeklinde iki token aranır;
  // ses tanıma "nova"yı "nowa/novaa" gibi yazabildiği için tolerans bırakıldı.
  const NOVA_WAKE_NAMES = ['nova', 'novaa', 'nowa', 'noha', 'nowva'];
  const NOVA_WAKE_ACTIONS = ['uyan', 'uyansana', 'uyanir', 'uyaniyor', 'wake', 'wakeup', 'uyanmisin'];

  let novaVoiceState = 'off';        // off | idle | listening | thinking | speaking
  let novaWakeRec = null;            // uyandırma kelimesi dinleyicisi
  let novaAskRec = null;             // soru dinleyicisi
  let novaWakeRestartTimer = null;
  let novaAskSilenceTimer = null;
  let novaAskMaxTimer = null;
  let novaVoiceAwaitingReply = false;
  let novaVoiceReplyTimeout = null;
  let novaVoiceStartCheckTimer = null;
  let novaVoiceNetworkErrors = 0;
  let novaVoiceInitialized = false;
  let novaAudioCtx = null;
  let novaTtsKeepAlive = null;

  function novaVoiceSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  function novaTtsSupported() {
    return typeof window.speechSynthesis !== 'undefined';
  }
  function isWakeWordEnabled() {
    return localStorage.getItem(NOVA_WAKE_ENABLED_KEY) === 'true';
  }
  function isNovaTtsEnabled() {
    // Varsayılan: açık (sesli soru sorulduğunda sesli cevap beklenir).
    return localStorage.getItem(NOVA_TTS_ENABLED_KEY) !== 'false';
  }
  function novaVoiceLang() {
    return localStorage.getItem(NOVA_VOICE_LANG_KEY) || 'tr-TR';
  }
  function novaTtsRate() {
    const r = parseFloat(localStorage.getItem(NOVA_TTS_RATE_KEY));
    return isNaN(r) ? 1 : Math.min(1.6, Math.max(0.6, r));
  }

  // Türkçe karakterleri sadeleştirip yalnızca harf/rakam bırakır.
  function novaNormalizeSpeech(text) {
    return String(text || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/[ıİ]/g, 'i')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[şŞ]/g, 's')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Küçük ve hızlı Levenshtein mesafesi (kısa kelimeler için yeterli).
  function novaLevenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = new Array(n + 1);
    let cur = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      const tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }

  function novaTokenMatches(token, target, maxDist) {
    if (token === target) return true;
    if (Math.abs(token.length - target.length) > maxDist) return false;
    return novaLevenshtein(token, target) <= maxDist;
  }

  // "nova uyan" / "nova wake up" kalıbını bulanık olarak arar.
  function novaDetectWakeWord(rawText) {
    const norm = novaNormalizeSpeech(rawText)
      // Ses tanıma ismi bazen ikiye bölüyor ("no va uyan").
      .replace(/\bno va\b/g, 'nova');
    if (!norm) return false;

    // Bitişik yazım ("novauyan", "novawake") için hızlı kontrol.
    if (/nova\s*(uyan|wake)/.test(norm)) return true;

    const tokens = norm.split(' ');
    for (let i = 0; i < tokens.length; i++) {
      const isName = NOVA_WAKE_NAMES.some(n => novaTokenMatches(tokens[i], n, 1));
      if (!isName) continue;
      // İsimden sonraki 2 kelime içinde eylem kelimesi aranır
      // ("nova hadi uyan" gibi araya kelime giren söyleyişleri de yakalar).
      for (let j = i + 1; j <= i + 2 && j < tokens.length; j++) {
        if (NOVA_WAKE_ACTIONS.some(a => novaTokenMatches(tokens[j], a, 1))) return true;
      }
    }
    return false;
  }

  // ---------- Durum kapsülü (Dynamic Island HUD) ----------
  function setVoiceHud(state, stateText, detailText) {
    const hud = document.getElementById('novaVoiceHud');
    if (!hud) return;

    const wasOff = !hud.classList.contains('visible');

    hud.classList.toggle('visible', state !== 'off');
    hud.classList.remove('state-idle', 'state-listening', 'state-thinking', 'state-speaking');
    if (state !== 'off') hud.classList.add('state-' + state);

    const st = document.getElementById('novaVoiceStateText');
    const dt = document.getElementById('novaVoiceDetailText');
    if (st && stateText !== undefined) st.innerText = stateText;
    if (dt && detailText !== undefined) dt.innerText = detailText;

    // Geri bildirim: state'e göre arka plan rengi ince geçiş
    if (state === 'listening') {
      hud.style.background = '#110808';
    } else if (state === 'thinking') {
      hud.style.background = '#080b14';
    } else if (state === 'speaking') {
      hud.style.background = 'linear-gradient(135deg, #0a0a12, #0d0816)';
    } else {
      hud.style.background = '#0a0a0a';
    }
  }

  function novaVoiceToast(title, message, isError) {
    let toast = document.getElementById('novaVoiceToast');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.id = 'novaVoiceToast';
    const accent = isError ? 'var(--danger-color,#d93025)' : 'var(--primary-blue,#0b57d0)';
    toast.style.cssText = `position:fixed; bottom:24px; right:24px; z-index:99999; max-width:340px; background:var(--card-bg,#fff); color:var(--text-color,#1f1f1f); border:1px solid ${accent}; border-radius:14px; padding:14px 18px; box-shadow:0 12px 30px rgba(0,0,0,0.15);`;
    toast.innerHTML = `
      <div style="font-weight:700; margin-bottom:4px; color:${accent};">${title}</div>
      <div style="font-size:0.83rem; color:var(--text-muted,#666); line-height:1.5;">${message}</div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast && toast.parentNode) toast.remove(); }, 6500);
  }

  // Uyanma / bitiş bipleri (ses dosyası gerektirmez, WebAudio ile üretilir).
  function novaPlayCue(freq, duration) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!novaAudioCtx) novaAudioCtx = new Ctx();
      if (novaAudioCtx.state === 'suspended') novaAudioCtx.resume();
      const t = novaAudioCtx.currentTime;
      const dur = duration || 0.12;
      const osc = novaAudioCtx.createOscillator();
      const gain = novaAudioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq || 880;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(novaAudioCtx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    } catch (_) { /* ses üretilemezse sessizce geç */ }
  }

  // ---------- Uyandırma kelimesi dinleyicisi ----------
  function startWakeRecognizer() {
    clearTimeout(novaWakeRestartTimer);
    if (!isWakeWordEnabled() || !novaVoiceSupported()) return;
    if (novaWakeRec || novaVoiceState === 'listening' || novaVoiceState === 'thinking' || novaVoiceState === 'speaking') return;

    // Kullanıcı henüz sohbet ekranında değilse (giriş/kullanıcı seçimi)
    // mikrofonu açma; ekran hazır olunca tekrar dene.
    const app = document.getElementById('appContainer');
    if (!app || !app.classList.contains('active')) {
      novaWakeRestartTimer = setTimeout(startWakeRecognizer, 1500);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = novaVoiceLang();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onresult = (event) => {
      if (novaVoiceState !== 'idle') return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        for (let k = 0; k < result.length; k++) {
          if (novaDetectWakeWord(result[k].transcript)) {
            novaVoiceNetworkErrors = 0;
            beginQuestionCapture();
            return;
          }
        }
      }
    };

    rec.onerror = (event) => handleWakeRecError(event.error);

    rec.onend = () => {
      novaWakeRec = null;
      // Tarayıcı sürekli dinlemeyi periyodik olarak kendiliğinden bitirir;
      // hâlâ boştaysak yeniden başlat.
      if (isWakeWordEnabled() && novaVoiceState === 'idle') {
        novaWakeRestartTimer = setTimeout(startWakeRecognizer, 400);
      }
    };

    try {
      rec.start();
      novaWakeRec = rec;
      novaVoiceState = 'idle';
      setVoiceHud('idle', 'Bekliyorum', novaVoiceLang() === 'en-US' ? 'Say "Nova wake up"' : '"Nova uyan" de');
    } catch (err) {
      // Zaten çalışıyor olabilir (InvalidStateError) — kısa süre sonra dene.
      novaWakeRec = null;
      novaWakeRestartTimer = setTimeout(startWakeRecognizer, 900);
    }
  }

  function stopWakeRecognizer() {
    clearTimeout(novaWakeRestartTimer);
    if (novaWakeRec) {
      const rec = novaWakeRec;
      novaWakeRec = null;
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try { rec.stop(); } catch (_) {}
      try { rec.abort(); } catch (_) {}
    }
  }

  function handleWakeRecError(errorCode) {
    if (errorCode === 'no-speech' || errorCode === 'aborted') {
      return; // normal; onend zaten yeniden başlatacak
    }
    if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
      setWakeWordEnabled(false);
      novaVoiceToast('Mikrofon izni yok',
        'Sesli asistan için mikrofon izni gerekiyor. İzni verdikten sonra ayarlardan tekrar açabilirsin.', true);
      return;
    }
    if (errorCode === 'network') {
      novaVoiceNetworkErrors++;
      if (novaVoiceNetworkErrors >= 3) {
        setWakeWordEnabled(false);
        novaVoiceToast('Ses tanıma servisine ulaşılamadı',
          'Tarayıcının ses tanıma servisi yanıt vermiyor. İnternet bağlantını kontrol et; masaüstü sürümünde bu servis kapalı olabilir.', true);
      }
      return;
    }
    console.warn('Uyandırma kelimesi dinleyicisi hatası:', errorCode);
  }

  // ---------- Soru dinleme ----------
  function beginQuestionCapture() {
    if (!novaVoiceSupported()) return;
    if (novaVoiceState === 'listening' || novaVoiceState === 'thinking') return;

    novaVoiceState = 'listening';
    stopWakeRecognizer();
    novaStopSpeaking();
    novaPlayCue(920, 0.12);
    setTimeout(() => novaPlayCue(1180, 0.10), 130);
    setVoiceHud('listening', 'Dinliyorum…', novaVoiceLang() === 'en-US' ? 'Ask your question' : 'Sorunu söyle');

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = novaVoiceLang();
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = '';
    let interimText = '';

    const finish = () => { try { rec.stop(); } catch (_) {} };

    const armSilenceTimer = (ms) => {
      clearTimeout(novaAskSilenceTimer);
      novaAskSilenceTimer = setTimeout(finish, ms);
    };

    rec.onresult = (event) => {
      interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript + ' ';
        else interimText += event.results[i][0].transcript;
      }
      const shown = (finalText + interimText).trim();
      setVoiceHud('listening', 'Dinliyorum…', shown || 'Sorunu söyle');
      // Konuşma durduktan ~1.6 sn sonra soruyu tamamlanmış say.
      armSilenceTimer(1600);
    };

    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setWakeWordEnabled(false);
        novaVoiceToast('Mikrofon izni yok', 'Sesli asistan için mikrofon izni gerekiyor.', true);
      }
    };

    rec.onend = () => {
      novaAskRec = null;
      clearTimeout(novaAskSilenceTimer);
      clearTimeout(novaAskMaxTimer);
      const question = (finalText.trim() || interimText.trim());
      if (question) {
        submitVoiceQuestion(question);
      } else {
        novaPlayCue(420, 0.14);
        setVoiceHud('idle', 'Bir şey duyamadım', '"Nova uyan" diyerek tekrar dene');
        returnVoiceToIdle(1400);
      }
    };

    try {
      rec.start();
      novaAskRec = rec;
      // Hiç konuşulmazsa 7 sn, uzun konuşmada en fazla 20 sn dinle.
      armSilenceTimer(7000);
      novaAskMaxTimer = setTimeout(finish, 20000);
    } catch (err) {
      novaAskRec = null;
      returnVoiceToIdle(600);
    }
  }

  function submitVoiceQuestion(question) {
    novaVoiceState = 'thinking';
    setVoiceHud('thinking', 'Nova düşünüyor…', question);
    novaVoiceAwaitingReply = true;

    clearTimeout(novaVoiceReplyTimeout);
    // Güvenlik ağı: herhangi bir sebeple cevap gelmezse takılı kalmasın.
    novaVoiceReplyTimeout = setTimeout(() => {
      if (novaVoiceAwaitingReply) {
        novaVoiceAwaitingReply = false;
        returnVoiceToIdle(0);
      }
    }, 90000);

    try {
      sendMessage(question);
    } catch (err) {
      console.error('Sesli soru gönderilemedi:', err);
      novaVoiceAwaitingReply = false;
      returnVoiceToIdle(300);
      return;
    }

    // sendMessage bazı durumlarda (görsel/video üretimi, spam engeli, boş
    // mesaj) API isteği başlatmadan döner. Böyle bir durumda cevap kancası
    // hiç tetiklenmeyeceği için kısa bir kontrolle boşta kalmayı önlüyoruz.
    setTimeout(() => {
      if (novaVoiceAwaitingReply && !pendingChatIds.has(currentChatId)) {
        novaVoiceAwaitingReply = false;
        returnVoiceToIdle(300);
      }
    }, 1500);
  }

  // sendMessage başarılı bir cevap ürettiğinde çağrılır.
  function novaVoiceOnReply(replyText) {
    if (!novaVoiceAwaitingReply) return;
    novaVoiceAwaitingReply = false;
    clearTimeout(novaVoiceReplyTimeout);
    if (isNovaTtsEnabled()) {
      novaSpeak(replyText, () => returnVoiceToIdle(250));
    } else {
      returnVoiceToIdle(250);
    }
  }

  // sendMessage her durumda (hata/iptal dahil) bittiğinde çağrılır.
  function novaVoiceOnTurnEnd() {
    if (!novaVoiceAwaitingReply) return;
    novaVoiceAwaitingReply = false;
    clearTimeout(novaVoiceReplyTimeout);
    returnVoiceToIdle(300);
  }

  function returnVoiceToIdle(delayMs) {
    clearTimeout(novaVoiceStartCheckTimer);
    novaVoiceStartCheckTimer = setTimeout(() => {
      if (!isWakeWordEnabled()) {
        novaVoiceState = 'off';
        setVoiceHud('off');
        return;
      }
      novaVoiceState = 'idle';
      setVoiceHud('idle', 'Bekliyorum', novaVoiceLang() === 'en-US' ? 'Say "Nova wake up"' : '"Nova uyan" de');
      startWakeRecognizer();
    }, delayMs || 0);
  }

  // ---------- Metin okuma (TTS) ----------
  // Cevabı sesli okumaya uygun hale getirir: adım blokları, kod blokları,
  // markdown işaretleri, bağlantılar ve emojiler ayıklanır.
  function novaStripForSpeech(text) {
    let t = String(text || '');
    t = t.replace(/\[\[STEPS\]\][\s\S]*?\[\[\/STEPS\]\]/g, ' ');
    t = t.replace(/```[\s\S]*?```/g, ' Kodu ekranda paylaştım. ');
    t = t.replace(/`([^`]+)`/g, '$1');
    t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
    t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    t = t.replace(/https?:\/\/\S+/g, ' bağlantı ');
    t = t.replace(/^\s*[-*+]\s+/gm, ' ');
    t = t.replace(/[*_>#~|`]/g, ' ');
    t = t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function novaPickVoice(lang) {
    if (!novaTtsSupported()) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    const prefix = lang.split('-')[0];
    return voices.find(v => v.lang === lang)
      || voices.find(v => v.lang && v.lang.replace('_', '-') === lang)
      || voices.find(v => v.lang && v.lang.toLowerCase().startsWith(prefix))
      || null;
  }

  function novaStopSpeaking() {
    if (!novaTtsSupported()) return;
    clearInterval(novaTtsKeepAlive);
    novaTtsKeepAlive = null;
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }

  function novaSpeak(text, onDone) {
    const done = () => { if (typeof onDone === 'function') onDone(); };
    if (!novaTtsSupported()) return done();

    const clean = novaStripForSpeech(text);
    if (!clean) return done();

    novaStopSpeaking();
    novaVoiceState = 'speaking';
    setVoiceHud('speaking', 'Nova konuşuyor…', clean.slice(0, 140));

    // Çok uzun cevaplarda konuşma dakikalarca sürmesin; ekranda tamamı zaten var.
    const spoken = clean.length > 1200 ? clean.slice(0, 1200) + '… Devamı ekranda.' : clean;
    const utter = new SpeechSynthesisUtterance(spoken);
    utter.lang = novaVoiceLang();
    const voice = novaPickVoice(utter.lang);
    if (voice) utter.voice = voice;
    utter.rate = novaTtsRate();
    utter.pitch = 1;
    utter.volume = 1;

    const finishSpeech = () => {
      clearInterval(novaTtsKeepAlive);
      novaTtsKeepAlive = null;
      done();
    };
    utter.onend = finishSpeech;
    utter.onerror = finishSpeech;

    try {
      window.speechSynthesis.speak(utter);
      // Chromium, ~15 saniyeden uzun konuşmalarda sesi kesebiliyor;
      // periyodik pause/resume ile konuşmayı canlı tutuyoruz.
      clearInterval(novaTtsKeepAlive);
      novaTtsKeepAlive = setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(novaTtsKeepAlive);
          novaTtsKeepAlive = null;
          return;
        }
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, 9000);
    } catch (err) {
      finishSpeech();
    }
  }

  // ---------- Aç / kapa ve ayar arayüzü ----------
  function setWakeWordEnabled(enabled) {
    localStorage.setItem(NOVA_WAKE_ENABLED_KEY, enabled ? 'true' : 'false');
    novaVoiceNetworkErrors = 0;

    const btn = document.getElementById('wakeWordBtn');
    if (btn) btn.classList.toggle('wake-on', enabled);
    const sw = document.getElementById('wakeWordSwitch');
    if (sw) sw.checked = enabled;

    if (enabled) {
      novaVoiceState = 'idle';
      setVoiceHud('idle', 'Bekliyorum', novaVoiceLang() === 'en-US' ? 'Say "Nova wake up"' : '"Nova uyan" de');
      startWakeRecognizer();
    } else {
      novaVoiceState = 'off';
      stopWakeRecognizer();
      if (novaAskRec) { try { novaAskRec.abort(); } catch (_) {} novaAskRec = null; }
      clearTimeout(novaAskSilenceTimer);
      clearTimeout(novaAskMaxTimer);
      novaStopSpeaking();
      setVoiceHud('off');
    }
  }

  // Giriş çubuğundaki buton (argümansız) ve ayarlardaki anahtar (true/false)
  // aynı fonksiyonu kullanır.
  function toggleWakeWord(forceState) {
    if (!novaVoiceSupported()) {
      novaVoiceToast('Ses tanıma desteklenmiyor',
        'Bu ortamda tarayıcı ses tanıma (Web Speech API) kullanılamıyor, bu yüzden uyandırma kelimesi çalışmaz.', true);
      const sw = document.getElementById('wakeWordSwitch');
      if (sw) sw.checked = false;
      return;
    }
    const next = (typeof forceState === 'boolean') ? forceState : !isWakeWordEnabled();
    setWakeWordEnabled(next);
    if (next) {
      novaVoiceToast('Sesli asistan açık',
        novaVoiceLang() === 'en-US'
          ? 'Say <strong>"Nova wake up"</strong>, then ask your question.'
          : '<strong>"Nova uyan"</strong> de, ardından sorunu sesli sor. Nova cevabını sesli okuyacak.');
    }
  }

  function setNovaTtsEnabled(enabled) {
    localStorage.setItem(NOVA_TTS_ENABLED_KEY, enabled ? 'true' : 'false');
    if (!enabled) novaStopSpeaking();
  }

  function setNovaVoiceLang(lang) {
    localStorage.setItem(NOVA_VOICE_LANG_KEY, lang);
    // Dil değişince dinleyiciyi yeni dille yeniden kur.
    if (isWakeWordEnabled()) {
      stopWakeRecognizer();
      returnVoiceToIdle(200);
    }
  }

  function setNovaTtsRate(rate) {
    localStorage.setItem(NOVA_TTS_RATE_KEY, String(rate));
    const label = document.getElementById('ttsRateLabel');
    if (label) label.innerText = parseFloat(rate).toFixed(1);
  }

  function syncVoiceSettingsUI() {
    const wakeSwitch = document.getElementById('wakeWordSwitch');
    if (wakeSwitch) wakeSwitch.checked = isWakeWordEnabled();
    const ttsSwitch = document.getElementById('ttsSwitch');
    if (ttsSwitch) ttsSwitch.checked = isNovaTtsEnabled();
    const langSelect = document.getElementById('voiceLangSelect');
    if (langSelect) langSelect.value = novaVoiceLang();
    const rateRange = document.getElementById('ttsRateRange');
    if (rateRange) rateRange.value = novaTtsRate();
    const rateLabel = document.getElementById('ttsRateLabel');
    if (rateLabel) rateLabel.innerText = novaTtsRate().toFixed(1);

    const warn = document.getElementById('voiceSupportWarning');
    if (warn) {
      const missing = [];
      if (!novaVoiceSupported()) missing.push('ses tanıma (mikrofon)');
      if (!novaTtsSupported()) missing.push('sesli okuma (TTS)');
      if (missing.length) {
        warn.style.display = 'block';
        warn.innerText = `Bu ortamda ${missing.join(' ve ')} desteklenmiyor.`;
      } else {
        warn.style.display = 'none';
      }
    }
  }

  // Durum kapsülüne tıklama: konuşurken sustur, dinlerken iptal et,
  // boştayken uyandırma kelimesi beklemeden doğrudan dinlemeye başla.
  function onVoiceHudClick() {
    if (novaVoiceState === 'speaking') {
      novaStopSpeaking();
      returnVoiceToIdle(0);
      return;
    }
    if (novaVoiceState === 'listening') {
      if (novaAskRec) { try { novaAskRec.abort(); } catch (_) {} novaAskRec = null; }
      returnVoiceToIdle(0);
      return;
    }
    if (novaVoiceState === 'idle') {
      beginQuestionCapture();
    }
  }

  function initNovaVoice() {
    if (novaVoiceInitialized) {
      // Kullanıcı değiştirildiğinde tekrar çağrılabilir: sadece durumu tazele.
      if (isWakeWordEnabled()) startWakeRecognizer();
      return;
    }
    novaVoiceInitialized = true;

    // TTS sesleri Chromium'da geç yüklenir; hazır olunca sadece önbelleğe girer.
    if (novaTtsSupported() && typeof window.speechSynthesis.getVoices === 'function') {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
    }

    const btn = document.getElementById('wakeWordBtn');
    if (btn) btn.classList.toggle('wake-on', isWakeWordEnabled());

    // Sayfa kapanırken mikrofonu ve konuşmayı serbest bırak.
    window.addEventListener('beforeunload', () => {
      stopWakeRecognizer();
      novaStopSpeaking();
    });

    if (isWakeWordEnabled()) {
      setWakeWordEnabled(true);
    } else {
      setVoiceHud('off');
    }
  }

