// src/js/ui/theme.js - Dark mode, Arka Plan Seçenekleri, Blur Efektleri & Sidebar Toggle

  const NOVA_BG_THEMES = {
    lava: { name: "Lava Lambası", desc: "Klasik akışkan mavi-mor lav" },
    aurora: { name: "Kuzey Işıkları", desc: "Zümrüt ve neon camgöbeği" },
    sunset: { name: "Gün Batımı", desc: "Sıcak macenta ve şeftali" },
    ocean: { name: "Derin Okyanus", desc: "Akvamarin ve safir dalgalar" },
    cosmic: { name: "Kozmik Nebula", desc: "Galaksi moru ve yıldız tozu" },
    smoke: { name: "Buzlu Duman", desc: "Minimalist, sade buğu" },
    matrix: { name: "Siber Matris", desc: "Teknolojik neon siber ışıma" },
    none: { name: "Sade (Düz)", desc: "Animasyonsuz düz arka plan" }
  };

  function initNovaBackground() {
    const savedTheme = localStorage.getItem('nova_bg_theme') || 'lava';
    const savedBlur = localStorage.getItem('nova_bg_blur') || '30';
    const savedGlass = localStorage.getItem('nova_glass_blur') === 'true';
    const savedColor = localStorage.getItem('nova_theme_color');
    const savedThinking = localStorage.getItem('nova_thinking_style') || 'logo';

    setNovaBackground(savedTheme, false);
    setNovaBgBlur(savedBlur, false);
    toggleGlassmorphism(savedGlass, false);

    if (savedColor) {
      changeThemeColor(savedColor, false);
      const colorPicker = document.getElementById('themeColorPicker');
      if (colorPicker) colorPicker.value = savedColor;
    }

    setThinkingStyle(savedThinking, false);
  }

  function setNovaBackground(themeName, save = true) {
    const bgContainer = document.getElementById('novaAppBg') || document.querySelector('.nova-lava-bg');
    if (!bgContainer) return;

    if (!NOVA_BG_THEMES[themeName]) themeName = 'lava';

    // Var olan tüm tema sınıflarını temizle
    Object.keys(NOVA_BG_THEMES).forEach(t => {
      bgContainer.classList.remove('nova-bg-' + t);
    });

    // Yeni temayı ekle
    bgContainer.classList.add('nova-bg-' + themeName);

    if (save) {
      localStorage.setItem('nova_bg_theme', themeName);
    }

    // UI Rozetini güncelle
    const badge = document.getElementById('activeBgThemeBadge');
    if (badge) {
      badge.textContent = NOVA_BG_THEMES[themeName].name;
    }

    // Ayarlardaki seçili kartı güncelle
    const cards = document.querySelectorAll('.nova-bg-card');
    cards.forEach(card => {
      const isTarget = card.getAttribute('data-theme') === themeName;
      card.classList.toggle('active', isTarget);
    });
  }

  function setNovaBgBlur(blurValue, save = true) {
    const val = parseInt(blurValue, 10) || 30;
    const orbVal = Math.max(10, Math.round(val * 0.8));

    document.documentElement.style.setProperty('--nova-bg-blur', val + 'px');
    document.documentElement.style.setProperty('--nova-orb-blur', orbVal + 'px');

    if (save) {
      localStorage.setItem('nova_bg_blur', String(val));
    }

    const rangeInput = document.getElementById('bgBlurRange');
    if (rangeInput && rangeInput.value != val) {
      rangeInput.value = val;
    }

    const label = document.getElementById('bgBlurValueLabel');
    if (label) {
      label.textContent = val + 'px';
    }
  }

  function toggleGlassmorphism(enabled, save = true) {
    const isEnabled = Boolean(enabled);
    document.body.classList.toggle('glassmorphism-active', isEnabled);

    if (save) {
      localStorage.setItem('nova_glass_blur', String(isEnabled));
    }

    const glassSwitch = document.getElementById('glassmorphismSwitch');
    if (glassSwitch) {
      glassSwitch.checked = isEnabled;
    }
  }

  function changeThemeColor(color, save = true) {
    if (!color) return;
    document.documentElement.style.setProperty('--primary-blue', color);
    if (save) {
      localStorage.setItem('nova_theme_color', color);
    }
  }

  function setThinkingStyle(style, save = true) {
    const validStyle = (style === 'dots') ? 'dots' : 'logo';
    if (save) {
      localStorage.setItem('nova_thinking_style', validStyle);
    }
    const radio = document.querySelector(`input[name="thinkingStyle"][value="${validStyle}"]`);
    if (radio) {
      radio.checked = true;
    }
  }

  function toggleDarkMode(isInitialLoad = false) {
    const isDarkMode = document.getElementById('darkModeSwitch')?.checked ?? false;
    
    if (isInitialLoad) {
      const savedMode = localStorage.getItem('nova_dark_mode') === 'true';
      document.body.classList.toggle('dark-mode', savedMode);
      const switchEl = document.getElementById('darkModeSwitch');
      if (switchEl) switchEl.checked = savedMode;
    } else {
      document.body.classList.toggle('dark-mode', isDarkMode);
      localStorage.setItem('nova_dark_mode', isDarkMode);
    }
  }

  function resetTheme() {
    localStorage.removeItem('nova_dark_mode');
    localStorage.removeItem('nova_bg_theme');
    localStorage.removeItem('nova_bg_blur');
    localStorage.removeItem('nova_glass_blur');
    localStorage.removeItem('nova_theme_color');

    document.body.classList.remove('dark-mode');
    document.body.classList.remove('glassmorphism-active');
    document.documentElement.style.removeProperty('--primary-blue');
    
    const switchEl = document.getElementById('darkModeSwitch');
    if (switchEl) switchEl.checked = false;

    setNovaBackground('lava', false);
    setNovaBgBlur(30, false);
    toggleGlassmorphism(false, false);

    alert("Tema ve arka plan varsayılan ayarlara sıfırlandı.");
  }

  function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const topBtn = document.getElementById("topToggleBtn");
    if (!sidebar) return;
    sidebar.classList.toggle("collapsed");
    if (topBtn) {
      topBtn.style.display = sidebar.classList.contains("collapsed") ? "block" : "none";
    }
  }
