// src/js/auth/auth.js - Login / register / Google sign-in / ban / password reset

  function switchTab(mode) {
    currentAuthMode = mode;
    document.getElementById("tabLogin").classList.toggle("active", mode === 'login');
    document.getElementById("tabRegister").classList.toggle("active", mode === 'register');
    // İsim alanını (nameField) yumuşak bir yükseklik+opaklık animasyonuyla
    // aç/kapat; daha önce style.display ile aniden görünüp kayboluyordu.
    document.getElementById("nameField").classList.toggle("field-hidden", mode !== 'register');
    document.getElementById("authSubmitBtn").innerText = mode === 'register' ? 'KAYIT OL' : 'GİRİŞ YAP';
  }

  function togglePasswordVisibility() {
    const pass = document.getElementById("loginPass");
    pass.type = pass.type === "password" ? "text" : "password";
  }

  async function handleAuth(e) {
    e.preventDefault();

    const nameInput = document.getElementById("loginName");
    const emailInput = document.getElementById("loginEmail");
    const passInput = document.getElementById("loginPass");
    const submitBtn = document.getElementById("authSubmitBtn");

    const name = (nameInput.value.trim() || "Kullanıcı");
    const email = emailInput.value.trim().toLowerCase();
    const pass = passInput.value;

    if (!email || !pass) {
      alert("E-posta ve şifre zorunludur.");
      return;
    }

    const originalBtnText = submitBtn.innerText;
    submitBtn.innerText = "Lütfen bekleyin...";
    submitBtn.disabled = true;

    const allUsers = JSON.parse(localStorage.getItem("nova_all_users")) || {};
    const passHash = await hashPassword(pass);

    if (currentAuthMode === "register") {
      if (allUsers[email]) {
        submitBtn.innerText = originalBtnText;
        submitBtn.disabled = false;
        alert("Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.");
        return;
      }
      const user = {
        name, email, passHash,
        premiumTier: "none", points: 0,
        banned: false, banReason: null, banDuration: null, bannedAt: null,
        lastLogin: new Date().toISOString(),
        lastDailyBonus: null, // günlük giriş bonusu için son alınan tarih
        createdAt: new Date().toISOString(),
      };
      allUsers[email] = user;
      localStorage.setItem("nova_all_users", JSON.stringify(allUsers));

      submitBtn.innerText = originalBtnText;
      submitBtn.disabled = false;
      loginSuccess(user.name, user.email, user.premiumTier, user.points, user.avatar);
      return;
    }

    // GİRİŞ
    const user = allUsers[email];
    submitBtn.innerText = originalBtnText;
    submitBtn.disabled = false;

    if (!user || user.passHash !== passHash) {
      alert("E-posta veya şifre hatalı.");
      return;
    }

    if (user.banned) {
      showBanModal({
        ban_reason: user.banReason,
        ban_duration: user.banDuration,
        banned_at: user.bannedAt,
      });
      return;
    }

    user.lastLogin = new Date().toISOString();
    allUsers[email] = user;
    localStorage.setItem("nova_all_users", JSON.stringify(allUsers));

    loginSuccess(user.name, user.email, user.premiumTier || "none", user.points || 0, user.avatar);
  }

  // "Google ile Devam Et" butonuna basınca çalışır.
  async function handleGoogleSignIn() {
    const btn = document.getElementById("googleSignInBtn");
    const originalHtml = btn ? btn.innerHTML : "";

    if (typeof require !== 'undefined') {
      try {
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = "<span>Google kontrol ediliyor...</span>";
        }

        const { ipcRenderer } = require('electron');
        const result = await ipcRenderer.invoke('google-sign-in');

        if (result && result.accessToken) {
          await completeGoogleLoginWithToken(result.accessToken);
          return;
        }

        if (result && result.cancelled) {
          // Kullanıcı pencereyi kapattı
          return;
        }

        if (result && result.needConfig) {
          // Google Client ID .env'de tanımlı değil -> Kullanıcı dostu Google giriş modalını aç
          openGoogleSignInModal("Google Cloud Client ID henüz yapılandırılmamış. Dilerseniz Google e-postanızla hızlı giriş yapabilir veya Client ID tanımlayabilirsiniz.");
          return;
        }

        if (result && result.error) {
          console.warn("Google OAuth uyarısı:", result.error);
          openGoogleSignInModal("Google OAuth bildirimi: " + result.error + ". Dilerseniz hesabınızla doğrudan hızlı giriş yapabilirsiniz.");
          return;
        }
      } catch (err) {
        console.error("Google sign-in invoke hatası:", err);
        openGoogleSignInModal("Google bağlantısı sırasında bir hata oluştu: " + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      }
    } else {
      // Tarayıcı / web ortamında
      openGoogleSignInModal();
    }
  }

  async function completeGoogleLoginWithToken(accessToken) {
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (!profileRes.ok) {
      throw new Error("Google profil bilgisi alınamadı (HTTP " + profileRes.status + ").");
    }
    const profile = await profileRes.json();
    const email = (profile.email || '').trim().toLowerCase();
    const name = profile.name || profile.given_name || "Google Kullanıcısı";
    const avatar = profile.picture || null;

    if (!email) {
      throw new Error("Google hesabınızdan e-posta bilgisi alınamadı.");
    }

    applyGoogleUserAndLogin(name, email, avatar);
  }

  function applyGoogleUserAndLogin(name, email, avatar) {
    const allUsers = JSON.parse(localStorage.getItem("nova_all_users")) || {};
    let user = allUsers[email];

    if (!user) {
      // İlk kez Google ile giriş: yeni kullanıcı kaydı oluştur.
      user = {
        name: name,
        email: email,
        passHash: null,
        authProvider: 'google',
        avatar: avatar,
        premiumTier: "none",
        points: 100,
        banned: false,
        banReason: null,
        banDuration: null,
        bannedAt: null,
        lastLogin: new Date().toISOString(),
        lastDailyBonus: null,
        createdAt: new Date().toISOString(),
      };
    } else {
      if (user.banned) {
        showBanModal({ ban_reason: user.banReason, ban_duration: user.banDuration, banned_at: user.bannedAt });
        return;
      }
      user.lastLogin = new Date().toISOString();
      user.authProvider = 'google';
      if (avatar && !user.avatar) user.avatar = avatar;
      if (name && name !== "Google Kullanıcısı") user.name = name;
    }

    allUsers[email] = user;
    localStorage.setItem("nova_all_users", JSON.stringify(allUsers));

    loginSuccess(user.name, user.email, user.premiumTier || "none", user.points || 0, user.avatar);
  }

  function openGoogleSignInModal(noticeText = "") {
    let modal = document.getElementById("googleSignInModal");
    if (!modal) return;

    const noticeEl = document.getElementById("googleSignInModalNotice");
    if (noticeEl) {
      if (noticeText) {
        noticeEl.textContent = noticeText;
        noticeEl.style.display = "block";
      } else {
        noticeEl.style.display = "none";
      }
    }

    // Varsa mevcut form alanlarını temizle veya önceki kullanıcıyı doldur
    const emailInput = document.getElementById("quickGoogleEmail");
    if (emailInput && !emailInput.value) {
      const lastEmail = localStorage.getItem("nova_user_email") || "";
      if (lastEmail.includes("@gmail.com")) {
        emailInput.value = lastEmail;
      }
    }

    openModal("googleSignInModal");
  }

  function submitQuickGoogleLogin(event) {
    if (event) event.preventDefault();

    const emailInput = document.getElementById("quickGoogleEmail");
    const nameInput = document.getElementById("quickGoogleName");

    const email = (emailInput?.value || "").trim().toLowerCase();
    const rawName = (nameInput?.value || "").trim();
    const name = rawName || (email.split('@')[0] ? (email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1)) : "Google Kullanıcısı");

    if (!email || !email.includes("@")) {
      alert("Lütfen geçerli bir Google e-posta adresi girin (örn: ornek@gmail.com).");
      return;
    }

    closeModal("googleSignInModal");
    applyGoogleUserAndLogin(name, email, null);
  }

  function toggleGoogleOAuthAdvanced() {
    const sec = document.getElementById("googleOAuthAdvancedSection");
    const arrow = document.getElementById("googleOAuthToggleArrow");
    if (!sec) return;
    const isHidden = sec.style.display === "none" || !sec.style.display;
    sec.style.display = isHidden ? "block" : "none";
    if (arrow) arrow.textContent = isHidden ? "▲" : "▼";
  }

  async function saveAndStartGoogleOAuth() {
    const input = document.getElementById("customGoogleClientId");
    const clientId = (input?.value || "").trim();
    if (!clientId) {
      alert("Lütfen geçerli bir Google Client ID girin.");
      return;
    }

    if (typeof require !== 'undefined') {
      try {
        const { ipcRenderer } = require('electron');
        const res = await ipcRenderer.invoke('save-env-key', 'GOOGLE_CLIENT_ID', clientId);
        if (res && res.success) {
          alert("GOOGLE_CLIENT_ID başarıyla kaydedildi! OAuth penceresi açılıyor...");
          closeModal("googleSignInModal");
          handleGoogleSignIn();
        } else {
          alert("Kaydedilemedi: " + (res?.error || "Bilinmeyen hata"));
        }
      } catch (e) {
        alert("Kaydetme hatası: " + e.message);
      }
    } else {
      localStorage.setItem('nova_google_client_id', clientId);
      alert("Client ID yerel olarak kaydedildi.");
    }
  }

  function formatBanDate(isoString) {
    if (!isoString) return "Bilinmiyor";
    try {
      const d = new Date(isoString);
      const gun = String(d.getDate()).padStart(2, '0');
      const ay = String(d.getMonth() + 1).padStart(2, '0');
      const yil = d.getFullYear();
      const saat = String(d.getHours()).padStart(2, '0');
      const dakika = String(d.getMinutes()).padStart(2, '0');
      return `${gun}.${ay}.${yil} ${saat}:${dakika}`;
    } catch (e) {
      return "Bilinmiyor";
    }
  }

  function showBanModal(banInfo) {
    const reason = banInfo.ban_reason || "Belirtilmedi";
    const duration = banInfo.ban_duration || "Kalıcı";
    const bannedAt = formatBanDate(banInfo.banned_at);

    // Var olan bir ban modalı varsa tekrar oluşturma
    let overlay = document.getElementById("banModalOverlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "banModalOverlay";
    overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:99999; display:flex; align-items:center; justify-content:center; padding:20px;";
    overlay.innerHTML = `
      <div style="background:var(--card-bg,#fff); color:var(--text-color,#1f1f1f); max-width:440px; width:100%; border-radius:16px; padding:28px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.4); border:1px solid var(--danger-color,#d93025);">
        <div style="font-size:48px; margin-bottom:10px;">🚫</div>
        <h2 style="color:var(--danger-color,#d93025); margin-bottom:16px; font-size:1.3rem;">Hesabınız Banlandı</h2>
        <p style="line-height:1.6; margin-bottom:8px;">
          Hesabınız Console Tarafından <strong>${bannedAt}</strong> Tarihinde,
          <strong>${duration}</strong> Süresi Boyunca Ban Yemiştir.
        </p>
        <p style="line-height:1.6; margin-bottom:20px;">
          <strong>Sebep:</strong> ${reason}
        </p>
        <button id="banModalCloseBtn" class="upgrade-btn" style="width:100%;">Kapat</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById("banModalCloseBtn").onclick = () => overlay.remove();
  }

  // Günlük giriş bonusu kazanıldığında sağ altta kısa süreliğine görünen
  // basit bir bildirim (toast) gösterir.
  function showDailyBonusToast(amount) {
    let toast = document.getElementById("dailyBonusToast");
    if (toast) toast.remove();

    toast = document.createElement("div");
    toast.id = "dailyBonusToast";
    toast.style.cssText = "position:fixed; bottom:24px; right:24px; z-index:99999; background:var(--card-bg,#fff); color:var(--text-color,#1f1f1f); border:1px solid var(--primary-blue,#0b57d0); border-radius:14px; padding:16px 20px; box-shadow:0 12px 30px rgba(0,0,0,0.15); display:flex; align-items:center; gap:12px; animation: daily-bonus-in 0.4s ease-out;";
    toast.innerHTML = `
      <div style="font-size:28px;">🎁</div>
      <div>
        <div style="font-weight:700; margin-bottom:2px;">Günlük Giriş Bonusu!</div>
        <div style="font-size:0.85rem; color:var(--text-muted,#666);">+${amount} puan hesabınıza eklendi.</div>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = "opacity 0.4s ease, transform 0.4s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    const email = prompt("Lütfen şifresini sıfırlamak istediğiniz hesabın e-posta adresini girin:");
    if (!email) return;

    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    const userEmail = email.toLowerCase().trim();

    if (!allUsers[userEmail]) {
      return alert("Bu e-posta adresiyle kayıtlı bir kullanıcı bulunamadı.");
    }

    const newPassword = prompt(`'${userEmail}' için yeni şifrenizi girin (en az 4 karakter):`);
    if (!newPassword) {
      return alert("Şifre sıfırlama iptal edildi.");
    }
    if (newPassword.length < 4) {
      return alert("Şifre en az 4 karakter olmalıdır.");
    }

    // Şifre, giriş sırasında kontrol edilen aynı hash yöntemiyle (SHA-256)
    // kaydedilir; aksi halde yeni şifre asla kabul edilmezdi.
    allUsers[userEmail].passHash = await hashPassword(newPassword);
    localStorage.setItem('nova_all_users', JSON.stringify(allUsers));

    alert("Şifreniz başarıyla sıfırlandı. Şimdi yeni şifrenizle giriş yapabilirsiniz.");
    // Kullanıcıyı giriş ekranına yönlendir ve e-posta alanını doldur
    document.getElementById('loginEmail').value = userEmail;
    document.getElementById('loginPass').value = '';
    document.getElementById('loginPass').focus();
  }

  function loginSuccess(name, email, tier, points, avatar) {
    currentUser = name;
    currentUserEmail = email;
    currentUserTier = tier || 'none';
    currentUserAvatar = avatar || name[0].toUpperCase();
    isPremiumUser = currentUserTier !== 'none'; // Geriye dönük uyumluluk
    userPoints = points || 0;

    localStorage.setItem("nova_user", currentUser); // Bu eski anahtar uyumluluk için kalabilir ama yeni sistem email bazlı çalışır
    localStorage.setItem("nova_user_email", currentUserEmail);
    localStorage.setItem(`nova_premium_tier_${currentUserEmail}`, currentUserTier);
    localStorage.setItem(`nova_points_${currentUserEmail}`, userPoints);
    localStorage.setItem(`nova_avatar_${currentUserEmail}`, currentUserAvatar);

    // Giriş sonrası splash ekranı gösterimi
    const authContainer = document.getElementById("authContainer");
    const userSelectionRoot = document.getElementById("userSelectionRoot");
    const splash = document.getElementById("splash-screen");

    authContainer.style.display = "none";
    userSelectionRoot.style.display = "none";
    splash.classList.remove("hidden");
    splash.style.removeProperty("visibility");
    splash.style.removeProperty("opacity");

    setTimeout(async () => {
      try {
        await openApp();
      } catch (err) {
        console.error("openApp() sırasında beklenmeyen hata:", err);
        alert("Uygulama açılırken bir hata oluştu: " + err.message + "\n\nLütfen sayfayı yenileyin.");
      } finally {
        // Geçişte oluşan hata yükleme katmanını ekranda bırakmasın.
        splash.style.removeProperty("visibility");
        splash.style.removeProperty("opacity");
        splash.classList.add("hidden");
        requestAnimationFrame(() => document.getElementById("userInput")?.focus());
      }
    }, 1000); // 1 saniye bekleme
  }

