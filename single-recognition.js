// src/js/voice/single-recognition.js - Manual mic-button voice recognition

  function startVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return alert("Tarayıcınız ses tanımayı desteklemiyor.");
    }

    const micBtn = document.getElementById("micBtn");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.interimResults = true; // Anlık sonuçları al

    // Uyandırma kelimesi dinleyicisi açıksa mikrofonu bırakması için geçici
    // olarak durdurulur; bu pencere kapanınca tekrar devreye girer.
    if (typeof stopWakeRecognizer === 'function') stopWakeRecognizer();

    openModal('geminiLiveModal');
    micBtn.style.color = "var(--danger-color)";
    recognition.start();

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      document.getElementById("liveTranscript").innerText = transcript;
      // Sonuç kesinleştiğinde input'a yaz
      if (e.results[0].isFinal) document.getElementById("userInput").value = transcript;
    };

    recognition.onerror = () => micBtn.style.color = "var(--text-muted)";
    recognition.onend = () => {
      micBtn.style.color = "var(--text-muted)";
      if (typeof returnVoiceToIdle === 'function') returnVoiceToIdle(400);
    };
  }

  function startDeepResearch() {
    if (!checkAccess('ultra')) return;
    const topic = document.getElementById("researchTopic").value.trim();
    if (!topic) {
      alert("Lütfen bir araştırma konusu girin.");
      return;
    }
    closeModal('researchModal');
    sendMessage(`[DERİN ARAŞTIRMA] Şu konu hakkında internetten detaylı bilgi toplayıp kapsamlı bir özet sun: "${topic}"`);
  }

