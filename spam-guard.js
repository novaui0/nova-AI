// src/js/core/spam-guard.js - Anti-spam throttle (rate limiting with escalating penalties)

  // ---------- SPAM ENGELİ ----------
  // Kullanıcı SPAM_WINDOW_MS (3 saniye) içinde art arda mesaj gönderirse spam
  // sayılır. Her yeni ihlalde bekleme cezası bir sonraki kademeye çıkar ve son
  // kademeden sonra sabit kalır. Kullanıcı bazında (e-posta) localStorage'da
  // tutulur, böylece sayfa yenilense bile ceza süresi korunur.
  const SPAM_WINDOW_MS = 3000;
  const SPAM_PENALTIES_MS = [
    5 * 1000,        // 1. ihlal: 5 sn
    15 * 1000,        // 2. ihlal: 15 sn
    60 * 1000,        // 3. ihlal: 1 dk
    10 * 60 * 1000,    // 4. ihlal: 10 dk
    30 * 60 * 1000,    // 5. ihlal: 30 dk
    50 * 60 * 1000,    // 6. ihlal ve sonrası: 50 dk
  ];

  function getSpamState() {
    const key = `nova_spam_state_${currentUserEmail || 'anon'}`;
    return JSON.parse(localStorage.getItem(key)) || { lastMsgAt: 0, violationCount: 0, blockedUntil: 0 };
  }
  function saveSpamState(state) {
    const key = `nova_spam_state_${currentUserEmail || 'anon'}`;
    localStorage.setItem(key, JSON.stringify(state));
  }
  function formatRemaining(ms) {
    const totalSec = Math.ceil(ms / 1000);
    if (totalSec < 60) return `${totalSec} saniye`;
    const min = Math.ceil(totalSec / 60);
    return `${min} dakika`;
  }
  // Kullanıcı hızlı art arda mesaj gönderdi mi kontrol eder; gönderilebiliyorsa
  // true döner ve spam sayaçlarını günceller. Gönderilemiyorsa (ceza süresi
  // aktifse) false döner ve kullanıcıyı bilgilendirir.
  function checkSpamGuard() {
    const state = getSpamState();
    const now = Date.now();

    if (state.blockedUntil && now < state.blockedUntil) {
      showSpamWarning(state.blockedUntil - now);
      return false;
    }

    if (state.lastMsgAt && (now - state.lastMsgAt) < SPAM_WINDOW_MS) {
      // Spam tespit edildi: ihlal sayacını artır, uygun cezayı uygula.
      state.violationCount = (state.violationCount || 0) + 1;
      const tierIndex = Math.min(state.violationCount - 1, SPAM_PENALTIES_MS.length - 1);
      const penaltyMs = SPAM_PENALTIES_MS[tierIndex];
      state.blockedUntil = now + penaltyMs;
      state.lastMsgAt = now;
      saveSpamState(state);
      showSpamWarning(penaltyMs);
      return false;
    }

    // Spam yok: normal gönderim, sayaçları sıfırla ama son mesaj zamanını güncelle.
    state.lastMsgAt = now;
    state.violationCount = 0;
    state.blockedUntil = 0;
    saveSpamState(state);
    return true;
  }

  function showSpamWarning(remainingMs) {
    let toast = document.getElementById("spamWarningToast");
    if (toast) toast.remove();

    toast = document.createElement("div");
    toast.id = "spamWarningToast";
    toast.style.cssText = "position:fixed; bottom:24px; right:24px; z-index:99999; background:var(--card-bg,#fff); color:var(--text-color,#1f1f1f); border:1px solid var(--danger-color,#d93025); border-radius:14px; padding:16px 20px; box-shadow:0 12px 30px rgba(0,0,0,0.15); display:flex; align-items:center; gap:12px;";
    toast.innerHTML = `
      <div style="font-size:28px;">⏳</div>
      <div>
        <div style="font-weight:700; margin-bottom:2px; color:var(--danger-color,#d93025);">Çok hızlı mesaj gönderiyorsunuz</div>
        <div style="font-size:0.85rem; color:var(--text-muted,#666);">Lütfen ${formatRemaining(remainingMs)} sonra tekrar deneyin.</div>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => { if (toast && toast.parentNode) toast.remove(); }, 4000);
  }
  
