// src/js/auth/user-selection.js - Profile selection screen

function showUserSelectionScreen() {
    // React bileşenini render et.
    document.getElementById("authContainer").style.display = "none";
    document.getElementById("userSelectionRoot").style.display = "block";

    const selectionRoot = document.getElementById("userSelectionRoot");

    selectionRoot.classList.remove("nova-selection-enter");
    void selectionRoot.offsetWidth;
    selectionRoot.classList.add("nova-selection-enter");

    if (!window.novaSelectionReactRoot) {
        window.novaSelectionReactRoot = ReactDOM.createRoot(selectionRoot);
    }

    window.novaSelectionRenderId =
        (window.novaSelectionRenderId || 0) + 1;

    window.novaSelectionReactRoot.render(
        React.createElement(MainMenu, {
            key: window.novaSelectionRenderId
        })
    );

    /*
      Eski kullanıcı kartı oluşturma kodu React'e taşındı.
      Bu bölüm eski kod olarak korunmuştur.
    */

    /*
    try {
        const userSelectionContainer =
            document.getElementById("userSelectionContainer");

        const userSelectionGrid =
            document.getElementById("userSelectionGrid");

        userSelectionGrid.innerHTML = "";

        const sortedUsers = Object.entries(users).sort(([, a], [, b]) => {
            const dateA = a.lastLogin
                ? new Date(a.lastLogin)
                : new Date(0);

            const dateB = b.lastLogin
                ? new Date(b.lastLogin)
                : new Date(0);

            return dateB - dateA;
        });

        let cardIndex = 0;

        if (sortedUsers.length > 0) {
            sortedUsers.forEach(([email, user]) => {
                const card = document.createElement("div");
                card.className = "user-profile-card";

                card.style.animation =
                    `card-fade-in 0.5s ${cardIndex * 0.1}s ease-out forwards`;

                card.onclick = () =>
                    selectUser(
                        email,
                        user.name,
                        user.premiumTier,
                        user.points
                    );

                const premiumIconHtml =
                    user.premiumTier && user.premiumTier !== "none"
                        ? `<svg xmlns="http://www.w3.org/2000/svg"
                               width="16"
                               height="16"
                               viewBox="0 0 24 24"
                               fill="none"
                               stroke="currentColor"
                               stroke-width="2"
                               stroke-linecap="round"
                               stroke-linejoin="round"
                               class="feather feather-award premium-card-icon">
                               <circle cx="12" cy="8" r="7"></circle>
                               <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                           </svg>`
                        : "";

                const deleteBtn = document.createElement("button");
                deleteBtn.className = "delete-profile-btn";
                deleteBtn.innerHTML = "✕";
                deleteBtn.title = "Profili Sil";
                deleteBtn.onclick = (e) =>
                    deleteUserFromCard(e, email);

                const editBtn = document.createElement("button");
                editBtn.className = "edit-profile-btn";
                editBtn.innerHTML = "✎";
                editBtn.title = "Adı Düzenle";
                editBtn.onclick = (e) =>
                    editUserNameFromCard(e, email, user.name);

                const lastLogin = user.lastLogin
                    ? new Date(user.lastLogin).toLocaleString("tr-TR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit"
                      })
                    : "İlk giriş";

                const avatarDiv = document.createElement("div");
                avatarDiv.className = "user-avatar";

                if (
                    user.avatar &&
                    user.avatar.startsWith("data:image")
                ) {
                    avatarDiv.style.backgroundImage =
                        `url(${user.avatar})`;
                } else {
                    avatarDiv.innerText = user.name[0].toUpperCase();
                }

                card.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:center;">
                        <strong>${user.name}</strong>
                        ${premiumIconHtml}
                    </div>
                    <span class="user-card-last-login">
                        Son Giriş: ${lastLogin}
                    </span>
                `;

                card.appendChild(deleteBtn);
                card.appendChild(editBtn);
                userSelectionGrid.appendChild(card);

                cardIndex++;
            });
        }

        const addCard = document.createElement("div");
        addCard.className = "user-profile-card new-user-card";

        addCard.style.animation =
            `card-fade-in 0.5s ${cardIndex * 0.1}s ease-out forwards`;

        addCard.onclick = () => showAuthScreen();

        addCard.innerHTML = `
            <div class="user-avatar"
                 style="background:var(--hover-bg);color:var(--text-color);">
                +
            </div>
            <strong>Yeni Kullanıcı</strong>
        `;

        userSelectionGrid.appendChild(addCard);

    } catch (error) {
        console.error(
            "Kullanıcı listesi alınamadı, sunucuya bağlanılamıyor:",
            error
        );
    }
    */
}

async function editUserNameFromCard(event, email, currentName) {
    event.stopPropagation();

    const newName = prompt(
        "Yeni kullanıcı adını girin:",
        currentName
    );

    if (
        newName === null ||
        newName.trim() === "" ||
        newName.trim() === currentName
    ) {
        return;
    }

    const allUsers =
        JSON.parse(localStorage.getItem("nova_all_users")) || {};

    if (allUsers[email]) {
        allUsers[email].name = newName.trim();

        localStorage.setItem(
            "nova_all_users",
            JSON.stringify(allUsers)
        );

        alert("Kullanıcı adı başarıyla güncellendi.");
        showUserSelectionScreen();
    } else {
        alert("Hata: Kullanıcı bulunamadı.");
    }
}

async function deleteUserFromCard(event, email) {
    event.stopPropagation();

    const password = prompt(
        `'${email}' kullanıcısını silmek için şifrenizi girin:`
    );

    if (password === null) {
        return;
    }

    if (!password) {
        alert("Silme işlemini onaylamak için şifre gereklidir.");
        return;
    }

    const allUsers =
        JSON.parse(localStorage.getItem("nova_all_users")) || {};

    const user = allUsers[email];

    if (user && user.pass === password) {
        delete allUsers[email];

        localStorage.setItem(
            "nova_all_users",
            JSON.stringify(allUsers)
        );

        // Kullanıcıya ait diğer verileri temizle.
        localStorage.removeItem(`nova_chats_${email}`);
        localStorage.removeItem(`nova_active_chat_${email}`);
        localStorage.removeItem(`nova_chat_order_${email}`);

        alert("Kullanıcı başarıyla silindi.");
        showUserSelectionScreen();
    } else {
        alert("Şifre yanlış veya kullanıcı bulunamadı.");
    }
}

function selectUser(email, name, tier, points, avatar) {
    const allUsers =
        JSON.parse(localStorage.getItem("nova_all_users")) || {};

    const user = allUsers[email];

    // BAN KONTROLÜ:
    // Banlı hesapta loginSuccess() çalıştırma.
    // Böylece uygulamanın açılış akışı başlatılmaz.
    if (user && user.banned) {
        showBanModal({
            ban_reason: user.banReason,
            ban_duration: user.banDuration,
            banned_at: user.bannedAt
        });

        return;
    }

    // Yalnızca banlı olmayan kullanıcıların giriş tarihini güncelle.
    if (user) {
        user.lastLogin = new Date().toISOString();

        localStorage.setItem(
            "nova_all_users",
            JSON.stringify(allUsers)
        );
    }

    loginSuccess(name, email, tier, points, avatar);
}

function showAuthScreen(mode = "login", email = "") {
    document.getElementById("userSelectionRoot").style.display = "none";

    const authContainer = document.getElementById("authContainer");
    authContainer.style.display = "flex";

    // Giriş kartı animasyonunu yeniden başlat.
    const card = document.querySelector(
        "#authContainer .glass-login-card"
    );

    if (card) {
        card.classList.remove("nova-auth-replay");
        void card.offsetWidth;
        card.classList.add("nova-auth-replay");
    }

    switchTab(mode);

    if (email) {
        document.getElementById("loginEmail").value = email;
        document.getElementById("loginPass").focus();
    }
}

function logout(showUserSelection = false) {
    localStorage.removeItem("nova_user");
    localStorage.removeItem("nova_user_email");

    if (showUserSelection) {
        document.getElementById("appContainer").classList.remove("active");
        showUserSelectionScreen();
    } else {
        location.reload();
    }
}