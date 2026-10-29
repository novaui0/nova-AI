  const e = React.createElement;
  const { useState, useEffect, useRef } = React;

  function MainMenu() {
    const [users, setUsers] = useState([]); // [email, user_object] çiftleri
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
      const fetchUsers = () => {
        // Sunucu çağrısını yerel depolama okumasıyla değiştir
        setIsLoading(true);
        const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
        const sortedUsers = Object.entries(allUsers).sort(([, a], [, b]) => {
          const dateA = a.lastLogin ? new Date(a.lastLogin) : new Date(0);
          const dateB = b.lastLogin ? new Date(b.lastLogin) : new Date(0);
          return dateB - dateA;
        });
        setUsers(sortedUsers);
        setIsLoading(false);

        // Yükleme bittiğinde splash ekranını gizle
        const splash = document.getElementById("splash-screen");
        if (splash) {
          splash.style.opacity = "0";
          setTimeout(() => splash.classList.add("hidden"), 400);
        }
      };
      fetchUsers();
    }, []);

    const handleUserSelect = (email, name, tier, points) => {
      // Bu fonksiyon global scope'taki selectUser'ı çağıracak
      // Ses efekti ekle
      const clickSound = new Audio('sounds/menuclick.mp3'); // Ses dosyasının doğru yolda olduğundan emin olun
      clickSound.volume = 0.7;
      clickSound.play().catch(e => console.error("Tıklama sesi çalınamadı:", e));

      window.selectUser(email, name, tier, points, users.find(([e]) => e === email)[1].avatar);
    };

    const handleNewUser = () => {
      window.showAuthScreen();
    };

    const handleEditUser = (e, email, name) => {
      e.stopPropagation();
      window.editUserNameFromCard(e, email, name);
    };

    const handleDeleteUser = (e, email) => {
      e.stopPropagation();
      window.deleteUserFromCard(e, email);
    };

    // Parçacık animasyonunu başlat
    useEffect(() => {
      return initParticles();
    }, []);

    // Fare Parallax efekti - orb'lar mouse'a göre hareket eder
    useEffect(() => {
      const bg = document.getElementById('novaAppBg');
      if (!bg) return;

      let targetX = 0, targetY = 0;
      let currentX = 0, currentY = 0;
      let rafId = null;

      const onMouseMove = (e) => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        targetX = (e.clientX - cx) / cx; // -1 ile +1 arası
        targetY = (e.clientY - cy) / cy;
      };

      const lerp = (a, b, t) => a + (b - a) * t;

      const tick = () => {
        currentX = lerp(currentX, targetX, 0.06);
        currentY = lerp(currentY, targetY, 0.06);

        const orbs = bg.querySelectorAll('.nova-lava-orb');
        orbs.forEach((orb, i) => {
          const factor = 18 + i * 10; // her orb farklı hız
          orb.style.transform = `translate(${currentX * factor}px, ${currentY * factor}px)`;
        });

        rafId = requestAnimationFrame(tick);
      };

      window.addEventListener('mousemove', onMouseMove);
      rafId = requestAnimationFrame(tick);

      return () => {
        window.removeEventListener('mousemove', onMouseMove);
        cancelAnimationFrame(rafId);
        // Temizleme: transform'u sıfırla
        const orbs = bg.querySelectorAll('.nova-lava-orb');
        orbs.forEach(orb => { orb.style.transform = ''; });
      };
    }, []);

    // Daktilo animasyonu için state'ler
    const [titleText, setTitleText] = useState('');
    const [subtitleText, setSubtitleText] = useState('');
    const fullTitle = "Nova-AI'a Hoş Geldiniz";
    const fullSubtitle = "Devam etmek için bir profil seçin veya yeni bir tane oluşturun.";

    useEffect(() => {
      // Başlık animasyonu
      let i = 0;
      const typeTitle = () => {
        if (i < fullTitle.length) {
          setTitleText(fullTitle.substring(0, i + 1));
          i++;
          setTimeout(typeTitle, 60);
        } else {
          // Başlık bittikten sonra alt başlık animasyonunu başlat
          let j = 0;
          const typeSubtitle = () => {
            if (j < fullSubtitle.length) {
              setSubtitleText(fullSubtitle.substring(0, j + 1));
              j++;
              setTimeout(typeSubtitle, 35);
            }
          };
          typeSubtitle();
        }
      };
      typeTitle();
    }, []);

    return (

      <div id="mainMenuContainer" className="user-selection-container" style={{ display: 'flex' }}>
        <canvas id="particle-canvas" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}></canvas>
        <div style={{ zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', color: 'var(--text-color)', padding: '40px 20px' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, padding: '4px 14px', borderRadius: '20px', background: 'rgba(11, 87, 208, 0.1)', color: 'var(--primary-blue)', marginBottom: '16px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            ✦ Nova AI Workspace ✦
          </div>
          <h1 className="animated-gradient-text" style={{ minHeight: '70px', margin: '0 0 10px 0' }}>{titleText}<span className="update-cursor"></span></h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', marginBottom: '2.5rem', minHeight: '40px', fontWeight: 400 }}>{subtitleText}</p>
          
          {isLoading && <p style={{ color: 'var(--text-muted)' }}>Profiller hazırlanıyor...</p>}
          {error ? (
            <div className="user-selection-grid">
                <div className="user-profile-card new-user-card" style={{ animation: `card-fade-in 0.5s 0s ease-out forwards` }} onClick={handleNewUser}>
                    <div className="user-avatar" style={{ background: 'var(--hover-bg)', color: 'var(--primary-blue)', fontSize: '2rem' }}>+</div>
                    <strong>Yeni Kullanıcı</strong>
                    <span className="user-card-last-login">Yeni profil aç</span>
                </div>
            </div>
          ) : (
            <div className="user-selection-grid">
              {users.map(([email, user], index) => (
                <div 
                  key={email} 
                  className="user-profile-card" 
                  style={{ animation: `card-fade-in 0.5s ${index * 0.1}s ease-out forwards` }}
                  onClick={() => handleUserSelect(email, user.name, user.premiumTier, user.points, user.avatar)}
                >
                  <div 
                    className="user-avatar"
                    style={user.avatar && (user.avatar.startsWith('data:image') || user.avatar.startsWith('http')) ? { backgroundImage: `url(${user.avatar})`, backgroundSize: 'cover' } : {}}
                  >
                    {!(user.avatar && (user.avatar.startsWith('data:image') || user.avatar.startsWith('http'))) && user.name[0].toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <strong style={{ fontSize: '0.98rem' }}>{user.name}</strong>
                    {user.authProvider === 'google' && (
                      <span title="Google Hesabı" style={{ display: 'inline-flex', verticalAlign: 'middle' }}>
                        <svg width="13" height="13" viewBox="0 0 48 48">
                          <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                          <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                          <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                          <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                        </svg>
                      </span>
                    )}
                    {user.premiumTier && user.premiumTier !== 'none' && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-award premium-card-icon">
                        <circle cx="12" cy="8" r="7"></circle>
                        <polyline points="8.36 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
                      </svg>
                    )}
                  </div>
                  <button 
                    className="delete-profile-btn" 
                    title="Profili Sil"
                    onClick={(e) => handleDeleteUser(e, email)}
                  >✕</button>
                  <button 
                    className="edit-profile-btn" 
                    title="Adı Düzenle"
                    onClick={(e) => handleEditUser(e, email, user.name)}
                  >✎</button>
                  <span className="user-card-last-login">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString('tr-TR', { day: 'numeric', month: 'short' }) : 'İlk Giriş'}
                  </span>
                </div>
              ))}
              <div 
                className="user-profile-card new-user-card" 
                style={{ animation: `card-fade-in 0.5s ${users.length * 0.1}s ease-out forwards` }}
                onClick={handleNewUser}
              >
                <div className="user-avatar" style={{ background: 'var(--hover-bg)', color: 'var(--primary-blue)', fontSize: '2rem' }}>+</div>
                <strong style={{ fontSize: '0.98rem' }}>Yeni Kullanıcı</strong>
                <span className="user-card-last-login">Yeni profil aç</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

