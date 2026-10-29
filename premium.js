// src/js/premium/premium.js - Premium tier rendering and purchase flow

  function renderTiers() {
    const tierList = document.getElementById('tierList');
    tierList.innerHTML = '';
    const userLevel = premiumTiers[currentUserTier]?.level || 0;

    for (const tierKey in premiumTiers) {
      const tier = premiumTiers[tierKey];
      const card = document.createElement('div');
      card.className = 'add-menu-item'; // Stili yeniden kullan
      card.style.flexDirection = 'column';
      card.style.alignItems = 'flex-start';
      card.style.border = '1px solid var(--border-color)';

      const isAffordable = userPoints >= tier.cost;
      const isUnlocked = userLevel >= tier.level;

      let buttonHtml;
      if (isUnlocked) {
        buttonHtml = `<button class="upgrade-btn" disabled style="width:100%; margin-top:15px; background: #c8e6c9; color: #256029;">✓ Etkin</button>`;
      } else if (isAffordable) {
        buttonHtml = `<button class="upgrade-btn" style="width:100%; margin-top:15px;" onclick="purchaseTier('${tierKey}', ${tier.cost})">Yükselt</button>`;
      } else {
        buttonHtml = `<button class="upgrade-btn" disabled style="width:100%; margin-top:15px;">Yetersiz Puan</button>`;
      }

      card.innerHTML = `
        <div class="text-content">
          <span class="title" style="font-size: 1.1rem;">${tier.name}</span>
          <span class="description" style="font-weight: bold; color: var(--primary-blue);">${tier.cost.toLocaleString()} Puan</span>
        </div>
        <ul style="font-size: 0.8rem; color: var(--text-muted); padding-left: 20px; margin-top: 10px;">
          ${tier.features.map(f => `<li>${f}</li>`).join('')}
        </ul>
        ${buttonHtml}
      `;
      tierList.appendChild(card);
    }
  }

  async function purchaseTier(tierKey, cost) {
    if (userPoints < cost) return alert('Yetersiz puan!');

    // Satın alma işlemini tamamen yerel olarak (localStorage) gerçekleştir.
    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    const user = allUsers[currentUserEmail];
    if (!user) return alert('Kullanıcı bulunamadı.');
    if ((user.points || 0) < cost) return alert('Yetersiz puan!');

    user.points = (user.points || 0) - cost;
    user.premiumTier = tierKey;
    allUsers[currentUserEmail] = user;
    localStorage.setItem('nova_all_users', JSON.stringify(allUsers));

    currentUserTier = user.premiumTier;
    userPoints = user.points;
    isPremiumUser = currentUserTier !== 'none';

    alert(`Tebrikler! Hesabınız başarıyla ${premiumTiers[tierKey].name} katmanına yükseltildi.`);
    localStorage.setItem(`nova_premium_tier_${currentUserEmail}`, currentUserTier);
    localStorage.setItem(`nova_points_${currentUserEmail}`, userPoints);
    closeModal('upgradeModal');
    // UI'ı anında güncelle
    const planBadge = document.getElementById('currentPlanBadge');
    if (currentUserTier !== 'none') {
      planBadge.textContent = currentUserTier.toUpperCase();
      planBadge.style.display = 'inline-block';
    } else {
      planBadge.style.display = 'none';
    }
  }

