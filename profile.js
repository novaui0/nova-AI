// src/js/settings/profile.js - Settings: profile, password, account deletion, backups

  async function saveSettings() {
    const newUsername = document.getElementById("settingsUsernameInput").value.trim();
    const newAvatar = document.getElementById("settingsAvatarInput").value.trim();
    let settingsChanged = false;

    // Kullanıcı adı veya emoji avatarı güncelleniyorsa
    if ((newUsername && newUsername !== currentUser) || (newAvatar && newAvatar !== currentUserAvatar && !currentUserAvatar.startsWith('data:image'))) {
      settingsChanged = true;
      const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
      const user = allUsers[currentUserEmail];
      if (user) {
        if (newUsername) user.name = newUsername;
        if (newAvatar && !currentUserAvatar.startsWith('data:image')) user.avatar = newAvatar;
        allUsers[currentUserEmail] = user;
        localStorage.setItem('nova_all_users', JSON.stringify(allUsers));
        updateUserInfo({ name: user.name, avatar: user.avatar });
        updateAvatarUI(user.avatar);
      } else {
        alert('Kullanıcı bulunamadı.');
      }
    }

    if (settingsChanged) {
      alert("Ayarlar başarıyla kaydedildi!");
    }
    closeModal('settingsModal');
  }

  function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
      const base64Image = e.target.result;
      
      const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
      const user = allUsers[currentUserEmail];
      if (user) {
        user.avatar = base64Image;
        allUsers[currentUserEmail] = user;
        localStorage.setItem('nova_all_users', JSON.stringify(allUsers));
        updateUserInfo({ avatar: base64Image });
        updateAvatarUI(base64Image);
        alert("Profil resmi başarıyla güncellendi!");
        closeModal('settingsModal');
      }
    };
    reader.readAsDataURL(file);
  }

  function updateUserInfo({ name, avatar }) {
    if (name) {
      currentUser = name;
      localStorage.setItem("nova_user", currentUser);
      document.getElementById("userNameDisplay").innerText = currentUser;
      document.getElementById("welcomeUser").innerText = currentUser;
    }
    if (avatar) {
      localStorage.setItem(`nova_avatar_${currentUserEmail}`, avatar);
    }
  }

  async function handleChangePassword() {
    const oldPass = document.getElementById('oldPass').value;
    const newPass = document.getElementById('newPass').value;
    const newPassConfirm = document.getElementById('newPassConfirm').value;

    if (!oldPass || !newPass || !newPassConfirm) {
      return alert('Lütfen tüm alanları doldurun.');
    }
    if (newPass !== newPassConfirm) {
      return alert('Yeni şifreler eşleşmiyor.');
    }

    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    const user = allUsers[currentUserEmail];

    if (user && user.pass === oldPass) {
      user.pass = newPass;
      allUsers[currentUserEmail] = user;
      localStorage.setItem('nova_all_users', JSON.stringify(allUsers));
      alert('Şifreniz başarıyla güncellendi.');
      closeModal('changePasswordModal');
    } else {
      alert('Eski şifreniz yanlış.');
    }
  }

  async function handleDeleteAccount() {
    const password = document.getElementById('deleteAccountPass').value;
    if (!password) {
      return alert('Lütfen şifrenizi girin.');
    }

    if (!confirm("EMİN MİSİNİZ?\n\nBu işlem hesabınızı ve tüm sohbet geçmişinizi kalıcı olarak silecektir. Bu eylem geri alınamaz.")) {
      return;
    }

    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    const user = allUsers[currentUserEmail];

    if (user && user.pass === password) {
      delete allUsers[currentUserEmail];
      localStorage.setItem('nova_all_users', JSON.stringify(allUsers));
      alert('Hesabınız başarıyla silindi.');
      logout(); // Oturumu kapat ve yeniden başlat
    } else {
      alert('Şifre yanlış.');
    }
  }

  function clearAllChats() {
    if (confirm("DİKKAT!\n\nBu işlem, mevcut kullanıcıya ait tüm sohbet geçmişini kalıcı olarak silecektir. Bu eylem geri alınamaz. Devam etmek istediğinizden emin misiniz?")) {
      chats = {};
      currentChatId = null;
      localStorage.removeItem(`nova_chats_${currentUserEmail}`);
      localStorage.removeItem(`nova_active_chat_${currentUserEmail}`);
      
      // Uygulamayı temiz bir başlangıç için yeniden yükle
      alert("Tüm sohbet geçmişi temizlendi.");
      location.reload();
    }
  }

  function exportAllData() {
    const backupData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('nova_')) {
        backupData[key] = localStorage.getItem(key);
      }
    }

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.href = URL.createObjectURL(blob);
    link.download = `nova-ai-backup_${today}.json`;
    link.click();
    alert("Tüm veriler başarıyla dışa aktarıldı!");
  }

  function autoDeleteOldChats() {
    const dateInput = document.getElementById('deleteChatsBeforeDate');
    const selectedDateStr = dateInput.value;

    if (!selectedDateStr) {
      alert("Lütfen bir tarih seçin.");
      return;
    }

    const cutoffDate = new Date(selectedDateStr);
    cutoffDate.setHours(23, 59, 59, 999); // Gün sonunu dahil et

    const chatsToDelete = chatOrder.filter(id => {
      const chatDate = new Date(chats[id].createdAt);
      return chatDate < cutoffDate;
    });

    if (chatsToDelete.length === 0) {
      alert("Seçilen tarihten önce silinecek sohbet bulunamadı.");
      return;
    }

    if (confirm(`DİKKAT!\n\n${cutoffDate.toLocaleDateString('tr-TR')} tarihinden önceki ${chatsToDelete.length} adet sohbet kalıcı olarak silinecektir. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?`)) {
      chatsToDelete.forEach(id => delete chats[id]);
      chatOrder = chatOrder.filter(id => !chatsToDelete.includes(id));
      saveState();
      alert(`${chatsToDelete.length} adet eski sohbet başarıyla silindi. Değişikliklerin uygulanması için uygulama yeniden başlatılıyor.`);
      location.reload();
    }
  }

  function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (confirm("DİKKAT!\n\nBu işlem mevcut tüm kullanıcıları, sohbetleri ve ayarları yedekleme dosyasındaki verilerle değiştirecektir. Bu eylem geri alınamaz. Devam etmek istiyor musunuz?")) {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const backupData = JSON.parse(e.target.result);
          localStorage.clear(); // Önce mevcut tüm verileri temizle
          for (const key in backupData) {
            if (Object.hasOwnProperty.call(backupData, key)) {
              localStorage.setItem(key, backupData[key]);
            }
          }
          alert("Veriler başarıyla içe aktarıldı! Uygulama yeniden başlatılıyor.");
          location.reload();
        } catch (error) {
          alert("Yedekleme dosyası okunurken bir hata oluştu. Lütfen dosyanın bozuk olmadığından emin olun.\nHata: " + error.message);
        }
      };
      reader.readAsText(file);
    }
    event.target.value = ''; // Aynı dosyayı tekrar seçebilmek için input'u sıfırla
  }

