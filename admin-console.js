// src/js/admin/admin-console.js - Gizli Yönetici Konsolu (şifre: 6165)

  /* ─── Şifre Doğrulama ─── */
  function openSecretAdminPrompt() {
    const old = document.getElementById('adminPinOverlay');
    if (old) old.remove();

    const overlay = document.createElement('div');
    overlay.className = 'admin-pin-overlay';
    overlay.id = 'adminPinOverlay';
    overlay.innerHTML = `
      <div class="admin-pin-card">
        <span class="pin-icon">🔐</span>
        <h3>Yönetici Girişi</h3>
        <p>Devam etmek için yönetici kodunu girin.</p>
        <input
          type="password"
          class="admin-pin-input"
          id="adminPinInput"
          placeholder="••••"
          maxlength="8"
          autocomplete="off"
        >
        <div class="admin-pin-actions">
          <button class="admin-pin-cancel" onclick="closeAdminPin()">İptal</button>
          <button class="admin-pin-submit" onclick="verifyAdminPin()">Giriş</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
      const inp = document.getElementById('adminPinInput');
      if (inp) {
        inp.focus();
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') verifyAdminPin();
          if (e.key === 'Escape') closeAdminPin();
        });
      }
    }, 80);
  }

  function closeAdminPin() {
    const overlay = document.getElementById('adminPinOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transform = 'scale(0.95)';
      overlay.style.transition = 'opacity 0.2s, transform 0.2s';
      setTimeout(() => overlay.remove(), 220);
    }
  }

  function verifyAdminPin() {
    const inp = document.getElementById('adminPinInput');
    if (!inp) return;
    const val = inp.value.trim();

    if (val === '6165') {
      closeAdminPin();
      closeModal('settingsModal');
      openModal('secretAdminModal');
      renderSecretAdminUsers('');
      _adminUpdateStats();
    } else {
      inp.classList.add('shake');
      inp.value = '';
      setTimeout(() => inp.classList.remove('shake'), 400);
    }
  }

  /* ─── İstatistik paneli ─── */
  function _adminUpdateStats() {
    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    const entries = Object.values(allUsers);
    const total = entries.length;
    const banned = entries.filter(u => u.banned).length;
    const premium = entries.filter(u => u.premiumTier && u.premiumTier !== 'none').length;
    const totalPoints = entries.reduce((sum, u) => sum + (u.points || 0), 0);

    const statsEl = document.getElementById('adminStatsBar');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="admin-stat-chip">👥 <strong>${total}</strong> Kullanıcı</div>
        <div class="admin-stat-chip">🚫 <strong>${banned}</strong> Banlı</div>
        <div class="admin-stat-chip">💎 <strong>${premium}</strong> Premium</div>
        <div class="admin-stat-chip">🎯 <strong>${totalPoints.toLocaleString('tr-TR')}</strong> Toplam Puan</div>
      `;
    }
  }

  /* ─── Kullanıcı Listeleme ─── */
  function adminFilterUsers(query) {
    renderSecretAdminUsers(query || '');
  }

  function renderSecretAdminUsers(query) {
    const list = document.getElementById('adminUserList');
    if (!list) return;

    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    let entries = Object.entries(allUsers);

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      entries = entries.filter(([email, u]) =>
        email.toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
      );
    }

    // Sıralama: önce banlılar, sonra premium, sonra ada göre
    entries.sort(([, a], [, b]) => {
      if (a.banned && !b.banned) return -1;
      if (!a.banned && b.banned) return 1;
      const ap = a.premiumTier && a.premiumTier !== 'none' ? 0 : 1;
      const bp = b.premiumTier && b.premiumTier !== 'none' ? 0 : 1;
      return ap - bp || (a.name || '').localeCompare(b.name || '');
    });

    _adminUpdateStats();

    if (entries.length === 0) {
      list.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:40px;font-size:0.9rem;">🔍 Kullanıcı bulunamadı.</div>`;
      return;
    }

    list.innerHTML = entries.map(([email, u]) => {
      const initials = (u.name || email[0] || '?').charAt(0).toUpperCase();
      const avatarStyle = u.avatar && (u.avatar.startsWith('data:image') || u.avatar.startsWith('http'))
        ? `background-image:url(${u.avatar});background-size:cover;background-position:center;`
        : '';
      const tierLabel = u.premiumTier && u.premiumTier !== 'none' ? u.premiumTier.toUpperCase() : 'ÜCRETSİZ';
      const tierClass = u.premiumTier && u.premiumTier !== 'none' ? 'admin-badge-vip' : 'admin-badge-none';
      const banLabel = u.banned ? `<span class="admin-badge admin-badge-ban">🚫 BANLANDI</span>` : '';
      const providerLabel = u.authProvider === 'google'
        ? `<span style="font-size:0.68rem;background:#4285F4;color:#fff;padding:1px 5px;border-radius:4px;font-weight:700;">G</span>` : '';
      const lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleString('tr-TR', {day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'}) : 'Hiç giriş yapılmadı';
      const createdAt = u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '—';
      const emailSafe = email.replace(/'/g, "\\'");

      // Şifre hash gösterimi (son 8 karakter)
      const hashPreview = u.passHash ? '···' + u.passHash.slice(-8) : (u.authProvider === 'google' ? '[Google OAuth]' : '—');

      return `
        <div class="admin-user-card">
          <div class="admin-user-avatar" style="${avatarStyle}">${avatarStyle ? '' : initials}</div>
          <div class="admin-user-info">
            <div class="admin-user-name">
              ${providerLabel}
              <span>${u.name || 'İsimsiz'}</span>
              ${banLabel}
              <span class="admin-badge ${tierClass}">${tierLabel}</span>
            </div>

            <!-- E-POSTA (görünür, kopyalanabilir) -->
            <div class="admin-user-email" title="Kopyalamak için tıkla" onclick="navigator.clipboard&&navigator.clipboard.writeText('${emailSafe}');_adminToast('📋 E-posta kopyalandı!')" style="cursor:pointer;">
              📧 ${email}
            </div>

            <div class="admin-user-meta">
              <span title="Şifre hash önizleme">🔑 ${hashPreview}</span>
              <span>📅 Son giriş: ${lastLogin}</span>
              <span>🗓️ Kayıt: ${createdAt}</span>
              <span>🎯 ${(u.points || 0).toLocaleString('tr-TR')} puan</span>
              <span>💬 ${_countUserChats(email)} sohbet</span>
            </div>

            ${u.banned ? `<div style="font-size:0.75rem;color:#dc2626;margin-top:4px;background:rgba(239,68,68,0.08);padding:4px 10px;border-radius:8px;">Yasak sebebi: ${u.banReason || '—'} | Tarih: ${u.bannedAt ? new Date(u.bannedAt).toLocaleDateString('tr-TR') : '—'}</div>` : ''}

            <div class="admin-user-actions">
              <button class="admin-action-btn success" onclick="adminAddPoints('${emailSafe}', 100)">+100 Puan</button>
              <button class="admin-action-btn success" onclick="adminAddPoints('${emailSafe}', 1000)">+1K Puan</button>
              <button class="admin-action-btn success" onclick="adminAddPoints('${emailSafe}', 10000)">+10K Puan</button>
              <button class="admin-action-btn" onclick="adminSetCustomPoints('${emailSafe}')">✏️ Puan Ayarla</button>
              <button class="admin-action-btn" onclick="adminSetTier('${emailSafe}', 'silver')">🥈 Silver</button>
              <button class="admin-action-btn" onclick="adminSetTier('${emailSafe}', 'gold')">🥇 Gold</button>
              <button class="admin-action-btn" onclick="adminSetTier('${emailSafe}', 'diamond')">💎 Diamond</button>
              <button class="admin-action-btn" onclick="adminSetTier('${emailSafe}', 'none')">↩️ Sıfırla</button>
              <button class="admin-action-btn" onclick="adminRenameUser('${emailSafe}')">✏️ İsim Değiştir</button>
              <button class="admin-action-btn danger" onclick="adminToggleBan('${emailSafe}')">${u.banned ? '✅ Yasağı Kaldır' : '🚫 Banla'}</button>
              <button class="admin-action-btn danger" onclick="adminResetPass('${emailSafe}')">🔑 Şifre Sıfırla</button>
              <button class="admin-action-btn danger" onclick="adminViewPass('${emailSafe}')">👁️ Şifreyi Gör</button>
              <button class="admin-action-btn danger" onclick="adminWipeChats('${emailSafe}')">🗑️ Sohbetleri Sil</button>
              <button class="admin-action-btn danger" onclick="adminDeleteUser('${emailSafe}')">❌ Hesabı Sil</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function _countUserChats(email) {
    try {
      const key = `nova_chats_${email}`;
      const data = localStorage.getItem(key);
      if (!data) return 0;
      const obj = JSON.parse(data);
      return Object.keys(obj).length;
    } catch { return 0; }
  }

  /* ─── Admin Aksiyonlar ─── */
  function _adminSave(allUsers) {
    localStorage.setItem('nova_all_users', JSON.stringify(allUsers));
    const q = document.getElementById('adminSearchInput')?.value || '';
    renderSecretAdminUsers(q);
  }

  function adminAddPoints(email, pts) {
    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    if (!allUsers[email]) return;
    allUsers[email].points = (allUsers[email].points || 0) + pts;
    _adminSave(allUsers);
    const currentEmail = localStorage.getItem('nova_user_email');
    if (currentEmail === email) {
      const pointsEl = document.getElementById('userPointsDisplay');
      if (pointsEl) pointsEl.textContent = allUsers[email].points;
    }
    _adminToast(`✅ ${allUsers[email].name || email} → +${pts} puan`);
  }

  function adminSetCustomPoints(email) {
    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    if (!allUsers[email]) return;
    const cur = allUsers[email].points || 0;
    const raw = prompt(`"${allUsers[email].name || email}" için yeni puan miktarı:\n(Mevcut: ${cur})`, cur);
    if (raw === null) return;
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 0) { alert('Geçersiz değer.'); return; }
    allUsers[email].points = val;
    _adminSave(allUsers);
    _adminToast(`✅ ${allUsers[email].name || email} → ${val} puan ayarlandı.`);
  }

  function adminSetTier(email, tier) {
    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    if (!allUsers[email]) return;
    allUsers[email].premiumTier = tier;
    _adminSave(allUsers);
    _adminToast(`✅ ${allUsers[email].name || email} → tier: "${tier}"`);
  }

  function adminRenameUser(email) {
    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    if (!allUsers[email]) return;
    const newName = prompt(`"${allUsers[email].name || email}" için yeni isim:`, allUsers[email].name || '');
    if (!newName || !newName.trim()) return;
    allUsers[email].name = newName.trim();
    _adminSave(allUsers);
    _adminToast(`✅ ${email} → isim: "${newName.trim()}"`);
  }

  function adminToggleBan(email) {
    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    if (!allUsers[email]) return;
    const isBanned = allUsers[email].banned;
    if (!isBanned) {
      const reason = prompt(`"${allUsers[email].name || email}" kullanıcısını banlama nedeni:`);
      if (reason === null) return;
      allUsers[email].banned = true;
      allUsers[email].banReason = reason || 'Yönetici kararı';
      allUsers[email].bannedAt = new Date().toISOString();
      allUsers[email].banDuration = 'kalıcı';
      _adminToast(`🚫 ${allUsers[email].name || email} banlandı.`);
    } else {
      allUsers[email].banned = false;
      allUsers[email].banReason = null;
      allUsers[email].bannedAt = null;
      allUsers[email].banDuration = null;
      _adminToast(`✅ ${allUsers[email].name || email} yasağı kaldırıldı.`);
    }
    _adminSave(allUsers);
  }

  async function adminResetPass(email) {
    const newPass = prompt(`"${email}" kullanıcısı için yeni şifre:`);
    if (!newPass || newPass.trim().length < 4) {
      if (newPass !== null) alert('Şifre en az 4 karakter olmalıdır.');
      return;
    }
    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    if (!allUsers[email]) return;
    allUsers[email].passHash = await hashPassword(newPass.trim());
    _adminSave(allUsers);
    _adminToast(`✅ ${allUsers[email].name || email} şifresi güncellendi.`);
  }

  async function adminViewPass(email) {
    // Güvenlik notu: hash'i decode edemeyiz, sadece yeni şifre belirleme popup'u
    // Ama kullanıcı ID/info gösterebiliriz
    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    const u = allUsers[email];
    if (!u) return;
    const info = [
      `👤 Kullanıcı: ${u.name || 'İsimsiz'}`,
      `📧 E-posta: ${email}`,
      `🔒 Şifre hash: ${u.passHash ? u.passHash.substring(0, 20) + '...' : '[Yok]'}`,
      `🌐 Giriş yöntemi: ${u.authProvider === 'google' ? 'Google OAuth' : 'E-posta/Şifre'}`,
      ``,
      `Not: Şifreler SHA-256 ile hashlenir, okunamaz.`,
      `Şifre sıfırlamak için "Şifre Sıfırla" butonunu kullanın.`
    ].join('\n');
    alert(info);
  }

  function adminWipeChats(email) {
    if (!confirm(`"${email}" kullanıcısının tüm sohbet geçmişi silinsin mi? Bu geri alınamaz!`)) return;
    localStorage.removeItem(`nova_chats_${email}`);
    const currentEmail = localStorage.getItem('nova_user_email');
    if (currentEmail === email) {
      localStorage.removeItem('nova_chats');
      const chatList = document.getElementById('chatList');
      if (chatList) chatList.innerHTML = '';
    }
    _adminSave(JSON.parse(localStorage.getItem('nova_all_users')) || {});
    _adminToast(`🗑️ ${email} kullanıcısının sohbetleri silindi.`);
  }

  function adminDeleteUser(email) {
    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    const name = allUsers[email]?.name || email;
    if (!confirm(`"${name}" (${email}) hesabı tamamen silinsin mi?\nBu işlem geri alınamaz!`)) return;
    delete allUsers[email];
    localStorage.removeItem(`nova_chats_${email}`);
    // Eğer aktif kullanıcıysa çıkış yaptır
    const currentEmail = localStorage.getItem('nova_user_email');
    if (currentEmail === email) {
      localStorage.removeItem('nova_user');
      localStorage.removeItem('nova_user_email');
    }
    _adminSave(allUsers);
    _adminToast(`❌ "${name}" hesabı silindi.`);
  }

  /* ─── Toast bildirimi ─── */
  function _adminToast(msg) {
    const old = document.getElementById('adminToast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.style.cssText = `
      position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
      background:rgba(15,20,30,0.92);color:#fff;padding:12px 22px;
      border-radius:20px;font-size:0.88rem;font-weight:500;
      box-shadow:0 8px 28px rgba(0,0,0,0.3);z-index:99999;
      backdrop-filter:blur(12px);white-space:nowrap;
      animation:adminToastIn 0.25s ease;
    `;
    toast.textContent = msg;

    const style = document.createElement('style');
    style.textContent = '@keyframes adminToastIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(style);
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => { toast.remove(); style.remove(); }, 320);
    }, 2800);
  }
