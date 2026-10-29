// src/js/chat/send-message.js - Send message pipeline + provider API request

  const MAX_MESSAGE_CHARS = 8000;
  function updateCharCounter() {
    const input = document.getElementById("userInput");
    const counter = document.getElementById("charCounter");
    if (!input || !counter) return;
    const len = input.value.length;
    const warnThreshold = MAX_MESSAGE_CHARS * 0.7;

    if (len < warnThreshold) {
      counter.style.display = "none";
      return;
    }
    counter.style.display = "inline";
    counter.innerText = `${len} / ${MAX_MESSAGE_CHARS}`;
    counter.style.color = len > MAX_MESSAGE_CHARS ? "var(--danger-color, #d93025)" : "var(--text-muted)";
  }

  async function sendMessage(forcedText = null) {
    const input = document.getElementById("userInput");
    const text = forcedText || input.value.trim();
    if (!text && attachedFiles.length === 0) return;

    if (!API_KEY && !NovaAPI.resolveKey(NovaAPI.getActiveProvider())) {
      alert("API anahtarı bulunamadı. Proje kökündeki .env dosyasına GEMINI_API_KEY=... satırını ekleyin veya Ayarlar > Api bölümünden bir API ekleyin.");
      return;
    }

    if (text.length > MAX_MESSAGE_CHARS) {
      alert(`Mesajınız çok uzun (${text.length} karakter). Lütfen ${MAX_MESSAGE_CHARS} karakterin altına indirin.`);
      return;
    }

    // Aynı sohbette hâlâ bekleyen bir istek varsa (Nova düşünüyor), yeni bir
    // istek başlatılmaz. Aksi halde iki eşzamanlı cevap aynı sohbet
    // geçmişine yarışarak eklenebilir ve karışıklık yaratabilir.
    if (pendingChatIds.has(currentChatId)) {
      return;
    }

    // Spam engeli: 3 saniye içinde art arda gönderim tespit edilirse mesaj
    // gönderilmez ve artan süreli bir bekleme cezası başlar.
    if (!checkSpamGuard()) return;

  
    const sendBtn = document.getElementById("sendBtn");
    sendBtn.classList.add("sending"); // Animasyonu başlat

    // Gemini tarzı dönen ışık halkasını input kutusunun kenarında başlat.
    // Görsel/video/normal metin — hangi yola girerse girsin, Nova bir şeyler
    // "işlerken" bu halka döner; ilgili işlem bitince kapatılır.
    startThinkingGlow();

  
    // Görsel oluşturma isteğini algıla.
    // 1) "... resim oluştur / çiz / draw" gibi bir eylem fiiliyle bitenler.
    // 2) "resim/görsel/foto oluştur/çiz/yap" ile BAŞLAYıp konuyu sonra söyleyenler
    //    (örn. "resim oluştur: balina" ya da "görsel: balina").
    const imageTrailingRegex = /(?:resim(?:ini)? oluştur|resmini çiz|görsel(?:ini)? oluştur|fotoğraf(?:ını)? oluştur|çiz|generate image|draw)\s*$/i;
    const imageLeadingRegex = /^(?:resim|görsel|foto(?:ğraf)?)\s*(?:oluştur|yap|çiz)?\s*[:\-]?\s*/i;

    if (imageTrailingRegex.test(text)) {
      const prompt = text.replace(imageTrailingRegex, "").trim();
      generateImageInChat(prompt || text);
      input.value = "";
      sendBtn.classList.remove("sending"); // Animasyonu durdur
      return;
    }
    if (imageLeadingRegex.test(text) && text.replace(imageLeadingRegex, "").trim()) {
      const prompt = text.replace(imageLeadingRegex, "").trim();
      generateImageInChat(prompt);
      input.value = "";
      sendBtn.classList.remove("sending"); // Animasyonu durdur
      return;
    }

    // Video oluşturma isteğini algıla
    const videoRequestRegex = /(?:video oluştur|video yap|generate video|make video)\s*$/i;
    if (videoRequestRegex.test(text)) {
      const prompt = text.replace(videoRequestRegex, "").trim();
      generateVideoInChat(prompt);
      input.value = "";
      sendBtn.classList.remove("sending"); // Animasyonu durdur
      return;
    }

    const isEditingImage = attachedFiles.some(f => f.type === 'image') && text;
    document.getElementById("heroTitle").style.display = "none";

    let fileContext = "";
    attachedFiles.filter(f => f.type === "text").forEach(f => {
      fileContext += `\n\n[Ekli Dosya: ${f.name}]\n${f.content}\n---`;
    });

    const fullPrompt = text + fileContext;
    const currentFiles = [...attachedFiles];

    // Puan ekleme
    const allUsers = JSON.parse(localStorage.getItem('nova_all_users')) || {};
    const user = allUsers[currentUserEmail];
    if (user && !forcedText) {
      user.points = (user.points || 0) + 1000;
      allUsers[currentUserEmail] = user;
      localStorage.setItem('nova_all_users', JSON.stringify(allUsers));
      userPoints = user.points;
      localStorage.setItem(`nova_points_${currentUserEmail}`, userPoints);
    }
    
    appendMessageUI(text, "user", currentFiles);
    chats[currentChatId].history.push({ role: "user", text: fullPrompt, files: currentFiles });

    if (chats[currentChatId].history.length === 1 && text) {
      chats[currentChatId].title = text.substring(0, 25);
      renderChatList();
    }

    input.value = "";
    updateCharCounter();
    attachedFiles = [];
    renderChips();

    // Bu isteğin hangi sohbete ait olduğunu sabitle. Kullanıcı cevap gelmeden
    // önce başka bir sohbete geçerse currentChatId değişecektir, ama bu
    // değişken sabit kalır — cevap her zaman DOĞRU sohbetin geçmişine yazılır.
    const targetChatId = currentChatId;
    pendingChatIds.add(targetChatId);

    // Bu sohbet için isteği iptal edebilecek bir AbortController oluştur.
    const abortController = new AbortController();
    activeAbortControllers[targetChatId] = abortController;
    renderChatList();
    updateStopButtonVisibility();

    // GÜVENLİK SÜRESİ: istek herhangi bir sebeple (ağ sorunu, API'nin çok
    // yavaş cevap vermesi vb.) makul bir sürede tamamlanmazsa isteği otomatik
    // iptal et. Bu olmadan istek teorik olarak süresiz asılı kalabiliyor ve
    // kullanıcı dakikalarca "Nova Düşünüyor..." ekranında bekleyip hiçbir
    // geri bildirim alamıyordu.
    const REQUEST_TIMEOUT_MS = 45 * 1000; // 45 saniye
    const timeoutId = setTimeout(() => {
      abortController.abort(new DOMException('Zaman aşımı', 'TimeoutError'));
    }, REQUEST_TIMEOUT_MS);

    // Sadece kullanıcı hâlâ bu sohbetteyse "Nova Düşünüyor..." balonunu göster.
    const isViewingTarget = () => currentChatId === targetChatId;
    const botDiv = isViewingTarget() ? appendMessageUI("Nova Düşünüyor...", "bot") : null;

    const payloadContents = chats[targetChatId].history.map(m => {
      const parts = [{ text: m.text }];
      if (m.files) {
        m.files.filter(f => f.type === "image").forEach(img => {
          parts.push({ inline_data: { mime_type: img.mime_type, data: img.data } });
        });
      }
      return { role: m.role === "user" ? "user" : "model", parts };
    });

    // SISTEM TALIMATI (AI KİMLİĞİ VE KULLANICI HAFIZASI)
    let systemInstructionText = `Senin adın Nova-AI. Sen, dünyanın en gelişmiş yapay zeka asistanısın. Cevapların her zaman net, doğru, kapsamlı ve son derece zeki olacak. Kendini asla Google, Gemini veya başka bir model olarak tanıtmayacaksın.
Kullanıcının adı ${currentUser}. Ona ismiyle hitap edebilirsin. Amacın, en karmaşık sorunları bile çözmek ve en doğru bilgiyi sunmaktır.
`;
    // Kullanıcının Ayarlar > Uygulama'dan seçtiği kişilik/ton tercihi (varsa).
    const personalityInstruction = getPersonalityInstruction();
    if (personalityInstruction) {
      systemInstructionText += `\n${personalityInstruction}\n`;
    }
    systemInstructionText += `
ADIM GÖSTERİMİ: Bir görevi (özellikle kod yazma/düzenleme gibi çok adımlı işleri) yaparken attığın adımları cevabının EN BAŞINA, aşağıdaki formatla ekle. Her satır kısa bir adım açıklaması olsun (örn. "index.html syntax kontrolü", "main.js syntax kontrolü", "Sağlam. Şimdi dosyaları sunuyorum."). Basit, tek adımlık sorularda bu bloğu KULLANMA.
[[STEPS]]
adım 1
adım 2
adım 3
[[/STEPS]]

DOSYA VERME FORMATI: Kullanıcıya tam bir dosyanın içeriğini (kod dosyası) verirken, markdown kod bloğunun dil etiketinden hemen sonra iki nokta ve dosya adını ekle, örn: \`\`\`javascript:main.js ... \`\`\` veya \`\`\`html:index.html ... \`\`\`. Dosya adı belirtmezsen dil otomatik bir ad üretir. Bu format sayesinde kod, kullanıcıya indirilebilir bir dosya kartı olarak gösterilir.`;
    if (getActiveNovaModel().deepThink) {
      systemInstructionText += "\n\nDERİN DÜŞÜNME MODU AKTİF (nova-3.1-deep-think): Cevap vermeden önce konuyu birden fazla açıdan değerlendir; olası yanlış anlamaları, uç durumları ve alternatif çözümleri iç sesinle tarttıktan sonra en sağlam sonucu sun. Adım listesini (varsa) normalden daha ayrıntılı tut; her adımda gerçekten ne düşündüğünü ve neden o kararı verdiğini kısaca belirt. Yüzeysel veya aceleyle verilmiş cevaplardan kesinlikle kaçın.";
    }
    if (isCodeMode) {
      systemInstructionText += "\n\nKOD MODU AKTİF: Sen uzman bir yazılım mühendisisin. Sadece kod yazmaya odaklan. Açıklamaları minimumda tut ve doğrudan istenen kodu veya çözümü sağla. Kodları her zaman uygun markdown kod blokları içinde ver.";
    }
    if (isPlanMode) {
      systemInstructionText += "\n\nPLAN MODU AKTİF: Proaktif bir planlayıcı gibi davran. Verilen hedefi gerçekleştirmek için gereken adımları belirle. Plan adımlarını madde işaretleri (✅) kullanarak listele. Eksik veya belirsiz bilgiler olduğunda, kullanıcıya sorular sorarak planı detaylandır. Örneğin, 'Bu uygulamanın hedef kitlesi kim olacak?' veya 'Hangi teknolojileri kullanmayı tercih edersin?' gibi sorularla en iyi planı oluşturmaya çalış. Cevaplarını yapılandırılmış bir plan ve ardından soracağın sorular şeklinde sun.";
    } else if (text.startsWith('[DERİN ARAŞTIRMA]')) {
      systemInstructionText += "\n\nDERİN ARAŞTIRMA MODU: Sen bir araştırma asistanısın. Kullanıcının verdiği konu hakkında internetten detaylı bilgi toplayıp, bulgularını yapılandırılmış, anlaşılır ve kapsamlı bir özet olarak sun. Cevabının başına '**[DERİN ARAŞTIRMA] Konu: [Konu Adı]**' başlığını ekle.";
    } else if (isEditingImage) {
      systemInstructionText += "\n\nGÖRSEL DÜZENLEME MODU: Kullanıcının yüklediği görsel üzerinde, verdiği metin talimatına göre düzenlemeler yap. Örneğin, renk değiştirme, nesne ekleme/çıkarma veya stil değişikliği gibi. Cevap olarak sadece düzenlenmiş görseli veya bir hata mesajı döndür. Açıklama yapma.";
    }

    try {
      const novaProvider = NovaAPI.getActiveProvider();
      const novaReq = NovaAPI.buildRequest(novaProvider, {
        model: activeModel,
        systemInstruction: systemInstructionText,
        contents: payloadContents,
        apiKey: API_KEY,
      });
      if (novaReq.error) throw new Error(novaReq.error + " Ayarlar > Api sekmesinden bir API ekleyebilirsiniz.");

      const res = await fetch(novaReq.url, Object.assign({}, novaReq.init, { signal: abortController.signal }));

      const data = await res.json();
      const novaParsed = NovaAPI.parseResponse(novaProvider, data);

      if (novaParsed.error) {
        if (botDiv && isViewingTarget()) botDiv.innerText = "Hata: " + novaParsed.error;
        saveState(); // Hata durumunda bile durumu kaydet
      } else {
        let reply = novaParsed.text || "";
        if (isPlanMode) {
          reply = "**[PLAN MODU] Eylem Planı:**\n\n" + reply;
        }
        let finalText = reply;
        if (botDiv && isViewingTarget()) {
          // Kullanıcı hâlâ bu sohbeti görüntülüyor: daktilo efektiyle yaz.
          // Kullanıcı "Durdur" butonuna basarsa o ana kadar yazılan kısım
          // kalıcı hale getirilir (finalText olarak geri döner).
          finalText = await typewriterRenderReply(botDiv, reply, 18, abortController.signal);
        }
        // Kullanıcı başka bir sohbete geçmiş olsa bile cevap DOĞRU sohbetin
        // geçmişine kaydedilir; sohbet asla kaybolmaz. Durdurulduysa sadece
        // o ana kadar yazılan kısım kaydedilir.
        chats[targetChatId].history.push({ role: "model", text: finalText });
        saveState();
        // Sesli asistan: cevap hazır. Sesli soru sorulduysa cevabı yüksek
        // sesle okuması için ses modülüne haber ver.
        if (typeof novaVoiceOnReply === 'function') novaVoiceOnReply(finalText, targetChatId);
        // Kullanıcı cevap tamamlandıktan SONRA bu sohbete geri dönerse ve
        // yazım o sırada yapılmadıysa (arka planda tamamlandıysa), sohbeti
        // yeniden yükleyip cevabı göstermesi için işaretleyelim.
        if (currentChatId === targetChatId && !botDiv) {
          loadChat(targetChatId);
        }
      }

    } catch (e) {
      const wasTimeout = abortController.signal.reason && abortController.signal.reason.name === 'TimeoutError';
      if (wasTimeout) {
        if (botDiv && isViewingTarget()) {
          botDiv.innerText = "Nova şu anda yanıt vermekte gecikti (45 saniyeyi aştı). Lütfen tekrar deneyin ya da farklı bir model seçin.";
        }
      } else if (e.name === 'AbortError') {
        // Kullanıcı isteği durdurdu; bu bir hata değil, sessizce geç.
        if (botDiv && isViewingTarget() && botDiv.innerText.trim() === '') {
          botDiv.innerText = "(Yanıt durduruldu)";
        }
      } else {
        if (botDiv && isViewingTarget()) botDiv.innerText = "Bağlantı hatası oluştu: " + e.message;
        console.error(e);
      }
    } finally {
      clearTimeout(timeoutId);
      // Sesli asistan bu tur için hâlâ cevap bekliyorsa (hata/iptal durumu)
      // beklemede kalmasın, tekrar uyandırma kelimesini dinlemeye dönsün.
      if (typeof novaVoiceOnTurnEnd === 'function') novaVoiceOnTurnEnd(targetChatId);
      // Bu sohbet artık "cevap bekleniyor" durumunda değil; sidebar'daki
      // dönen göstergeyi kaldır.
      pendingChatIds.delete(targetChatId);
      delete activeAbortControllers[targetChatId];
      renderChatList();
      updateStopButtonVisibility();
      const sendBtn = document.getElementById("sendBtn");
      if (sendBtn) sendBtn.classList.remove("sending");
      // Işık halkasını SADECE kullanıcı hâlâ bu sohbetteyse kapat; başka bir
      // sohbete geçtiyse, orada gördüğü ışık kendi sohbetinin durumuna aittir.
      if (isViewingTarget()) {
        stopThinkingGlow();
      }
    }
  }

  // Şu an görüntülenen sohbet için devam eden bir istek varsa "Durdur"
  // butonunu, yoksa normal gönder butonunu gösterir.
  function updateStopButtonVisibility() {
    const sendBtn = document.getElementById("sendBtn");
    const stopBtn = document.getElementById("stopGenerationBtn");
    if (!sendBtn || !stopBtn) return;
    const isGenerating = activeAbortControllers[currentChatId] !== undefined;
    stopBtn.style.display = isGenerating ? "flex" : "none";
    sendBtn.style.display = isGenerating ? "none" : "flex";
  }

  // Kullanıcı "Durdur" butonuna bastığında şu an görüntülenen sohbetin
  // isteğini iptal eder.
  function stopGeneration() {
    const controller = activeAbortControllers[currentChatId];
    if (controller) controller.abort();
  }

  // Kullanıcının Ayarlar > Uygulama sekmesinden seçtiği "düşünüyor/yazıyor"
  // göstergesini (dönen logo veya zıplayan noktalar) HTML olarak döner.
  // Hem appendMessageUI (ilk "Nova Düşünüyor..." balonu) hem
  // typewriterRenderReply (yazım sırasındaki alt gösterge) bunu kullanır.
  function getThinkingIndicatorHTML() {
    const thinkingStyle = localStorage.getItem('nova_thinking_style') || 'dots';
    if (thinkingStyle === 'logo') {
      return `<svg class="thinking-logo-mini" viewBox="0 0 100 100">
        <ellipse cx="50" cy="50" rx="40" ry="15" fill="none" stroke="#0b57d0" stroke-width="6" transform="rotate(0 50 50)"/>
        <ellipse cx="50" cy="50" rx="40" ry="15" fill="none" stroke="#0b57d0" stroke-width="6" transform="rotate(60 50 50)"/>
        <ellipse cx="50" cy="50" rx="40" ry="15" fill="none" stroke="#0b57d0" stroke-width="6" transform="rotate(120 50 50)"/>
        <circle cx="50" cy="50" r="8" fill="#0b57d0"/>
      </svg>`;
    }
    return `<span class="typing-dots"><span></span><span></span><span></span></span>`;
  }

  function appendMessageUI(text, sender, files = []) {
    const container = document.getElementById("messagesContainer");
    const div = document.createElement("div");
    // Sohbet geçmişi Gemini API formatını kullanır ("user" / "model"), ancak
    // UI/CSS "user" / "bot" bekler. Geçmiş sohbetler yeniden yüklendiğinde
    // (loadChat) "model" değeri geliyordu ve bot mesajları yanlışlıkla düz
    // metin olarak gösteriliyordu (markdown/kod blokları render edilmiyordu).
    // Burada normalize ederek bu iki adlandırmayı birleştiriyoruz.
    const isBot = sender === "bot" || sender === "model";
    div.className = `msg ${isBot ? "bot" : "user"}`;

    if (isBot) {
      if (text === "Nova Düşünüyor...") {
        div.innerHTML = getThinkingIndicatorHTML();
      } else {
        renderBotContent(div, text);
      }
    } else {
      div.innerText = text;
    }
    
    if (files && files.length > 0) {
      files.forEach(f => {
        if (f.type === "image") {
          const img = document.createElement("img");

          if (f.data.startsWith('data:image')) {
            img.src = f.data;
          } else if (f.data.startsWith('http')) {
            img.src = f.data;
          } else {
            img.src = `data:${f.mime_type};base64,${f.data}`;
          }

          img.style.maxWidth = '100%';
          img.style.borderRadius = '12px';
          img.style.marginTop = '10px';
          div.appendChild(img);
        } else if (f.type === "video") {
          const video = document.createElement("video");
          video.src = f.data;
          video.controls = true;
          video.autoplay = false;
          video.loop = true;
          video.muted = true;
          video.style.maxWidth = '100%';
          video.style.maxHeight = '300px';
          video.style.borderRadius = '12px';
          video.style.marginTop = '10px';
          div.appendChild(video);
        }
      });
    }

    container.appendChild(div);
    document.getElementById("chatArea").scrollTop = document.getElementById("chatArea").scrollHeight;
    // Sadece yeni eklenen mesaj içindeki kodları highlight et
    div.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
    addCopyButtonsToCodeBlocks(div); // Kopyala butonlarını ekle

    // Tamamlanmış bot mesajlarına (yükleniyor durumu hariç) tepki çubuğu ekle:
    // yanıtı kopyala, beğen, beğenme.
    if (isBot && text !== "Nova Düşünüyor...") {
      div.appendChild(createMessageActionsBar(text, div));
    }

    const sendBtn = document.getElementById("sendBtn");
    if (sendBtn) sendBtn.classList.remove("sending"); // Animasyonu bitir
    // Animasyon CSS ile kendi kendine biter, JS ile kaldırmaya gerek yok.
    return div;
  }

  // Bot mesajının altına kopyala / beğen / beğenme butonlarını içeren küçük
  // bir aksiyon çubuğu oluşturur. Beğeni durumu mesaj metnine göre
  // localStorage'da (sohbetler arası kalıcı) tutulur.
  function createMessageActionsBar(rawText, msgDiv) {
    const bar = document.createElement('div');
    bar.className = 'msg-actions-bar';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn';
    copyBtn.title = 'Yanıtı kopyala';
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(rawText).then(() => {
        const original = copyBtn.innerHTML;
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => { copyBtn.innerHTML = original; }, 1500);
      });
    };

    const likeBtn = document.createElement('button');
    likeBtn.className = 'msg-action-btn';
    likeBtn.title = 'Beğen';
    likeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/></svg>`;

    const dislikeBtn = document.createElement('button');
    dislikeBtn.className = 'msg-action-btn';
    dislikeBtn.title = 'Beğenme';
    dislikeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/></svg>`;

    // Bu mesaj için daha önce verilmiş bir tepki varsa yükle ve buton
    // durumlarını (aktif renk) buna göre ayarla.
    const reactionKey = `nova_msg_reaction_${simpleHash(rawText)}`;
    const setActive = (which) => {
      likeBtn.classList.toggle('active-like', which === 'like');
      dislikeBtn.classList.toggle('active-dislike', which === 'dislike');
    };
    setActive(localStorage.getItem(reactionKey));

    likeBtn.onclick = () => {
      const current = localStorage.getItem(reactionKey);
      const next = current === 'like' ? null : 'like';
      if (next) localStorage.setItem(reactionKey, next); else localStorage.removeItem(reactionKey);
      setActive(next);
    };
    dislikeBtn.onclick = () => {
      const current = localStorage.getItem(reactionKey);
      const next = current === 'dislike' ? null : 'dislike';
      if (next) localStorage.setItem(reactionKey, next); else localStorage.removeItem(reactionKey);
      setActive(next);
    };

    bar.appendChild(copyBtn);
    bar.appendChild(likeBtn);
    bar.appendChild(dislikeBtn);
    return bar;
  }

  // Basit, hızlı bir string hash fonksiyonu (kriptografik değil) — beğeni
  // durumunu mesaj içeriğine göre anahtarlamak için kullanılır.
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  }

  function copyCode(button) {
    const code = button.closest('.code-bubble').querySelector('code').innerText;
    navigator.clipboard.writeText(code).then(() => {
      const originalSvg = button.innerHTML;
      const originalTitle = button.title;
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      button.title = 'Kopyalandı!';
      setTimeout(() => {
        button.innerHTML = originalSvg;
        button.title = originalTitle;
      }, 1500);
    });
  }

  function downloadCode(button) {
    const code = button.closest('.code-bubble').querySelector('code').innerText;
    const language = button.closest('.code-bubble-header').querySelector('.code-bubble-title').innerText;
    const fileExtension = {
      'javascript': 'js', 'js': 'js', 'typescript': 'ts', 'python': 'py', 'py': 'py',
      'html': 'html', 'css': 'css', 'json': 'json', 'java': 'java', 'c': 'c',
      'cpp': 'cpp', 'c++': 'cpp', 'csharp': 'cs', 'c#': 'cs', 'php': 'php',
      'bash': 'sh', 'shell': 'sh', 'sh': 'sh', 'sql': 'sql', 'go': 'go',
      'rust': 'rs', 'swift': 'swift', 'kotlin': 'kt', 'ruby': 'rb', 'xml': 'xml',
      'yaml': 'yml', 'yml': 'yml',
    }[language.toLowerCase()] || 'txt';
    const blob = new Blob([code], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nova-code.${fileExtension}`;
    link.click();
  }

  function previewCode(button) {
    const code = button.closest('.code-bubble').querySelector('code').innerText;
    const language = button.closest('.code-bubble-header').querySelector('.code-bubble-title').innerText;
    const previewWindow = window.open('', '_blank');
    if (language === 'html') {
      previewWindow.document.write(code);
    } else {
      previewWindow.document.write(`<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`);
    }
    previewWindow.document.close();
  }


  function addCopyButtonsToCodeBlocks(container) {
    const codeBlocks = container.querySelectorAll('pre');
    codeBlocks.forEach(pre => {
      if (pre.querySelector('.copy-code-btn')) return; // Zaten varsa ekleme

      const copyButton = document.createElement('button');
      copyButton.className = 'copy-code-btn';
      copyButton.innerText = 'Kopyala';

      copyButton.addEventListener('click', () => {
        const code = pre.querySelector('code').innerText;
        navigator.clipboard.writeText(code).then(() => {
          // Ses efektini çal
          const copySound = new Audio('sounds/copy.mp3'); // Bu ses dosyasının projenizde olduğunu varsayıyorum.
          copySound.volume = 0.6; // Sesi çok baskın olmaması için kısalım.
          copySound.play().catch(e => console.error("Kopyalama sesi çalınamadı:", e));

          copyButton.innerText = 'Kopyalandı!';
          setTimeout(() => {
            copyButton.innerText = 'Kopyala';
          }, 2000);
        });
      });
      pre.appendChild(copyButton);
    });
  }

