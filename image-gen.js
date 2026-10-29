// src/js/media/image-gen.js - Image generation (Pollinations)

  async function generateImage() {
    if (!checkAccess('pro')) return;
    const prompt = document.getElementById("imageGenPrompt").value.trim();
    if (!prompt) {
      alert("Lütfen bir açıklama girin.");
      return;
    }

    const resultDiv = document.getElementById("imageGenResult");
    resultDiv.innerHTML = ""; // Önceki içeriği temizle
    resultDiv.innerHTML = "Görsel oluşturuluyor... (Bu işlem 30 saniye sürebilir)";
    
    // Sohbet içi görsel oluşturma fonksiyonunu yeniden kullan
    await generateImageInChat(prompt, resultDiv);
  }

  // Yeni yardımcı fonksiyon: Medyayı sohbette göstermek için
  // Bu fonksiyon hem görsel hem de video için kullanılabilir.
  // generateImageInChat ve generateVideoInChat bu fonksiyonu çağıracak.
  async function displayMediaInChat(prompt, mediaUrl, mimeType, botMessageDiv, mediaType) {
    try {
      let mediaElement;
      let downloadButtonHtml;

      if (mediaType === 'image') {
        mediaElement = new Image();
        mediaElement.src = mediaUrl;
        mediaElement.style.maxWidth = '350px';
        mediaElement.style.borderRadius = '16px';
        mediaElement.style.display = 'block';
        mediaElement.alt = prompt;
        downloadButtonHtml = `<a href="${mediaUrl}" download="${prompt.replace(/\s+/g, '_')}.png" class="download-btn" style="margin-top: 10px;">Görseli İndir 📥</a>`;
      } else if (mediaType === 'video') {
        mediaElement = document.createElement('video');
        mediaElement.src = mediaUrl;
        mediaElement.controls = true;
        mediaElement.autoplay = false; // Otomatik oynatma olmasın
        mediaElement.loop = true; // Döngüde oynasın
        mediaElement.muted = true; // Başlangıçta sessiz
        mediaElement.style.maxWidth = '400px';
        mediaElement.style.maxHeight = '300px';
        mediaElement.style.borderRadius = '16px';
        mediaElement.style.display = 'block';
        mediaElement.style.marginTop = '10px';
        downloadButtonHtml = `<a href="${mediaUrl}" download="${prompt.replace(/\s+/g, '_')}.mp4" class="download-btn" style="margin-top: 10px;">Videoyu İndir 📥</a>`;
      } else {
        throw new Error("Desteklenmeyen medya türü.");
      }

      const mediaLoadPromise = new Promise((resolve, reject) => {
          mediaElement.onload = () => resolve(mediaElement); // For images
          mediaElement.onloadeddata = () => resolve(mediaElement); // For videos
          mediaElement.onerror = (e) => reject(new Error(`${capitalizeWord(mediaType)} yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.`));
      });

      const loadedMedia = await mediaLoadPromise;

      const mediaWrapper = document.createElement('div');
      mediaWrapper.style.position = 'relative';
      mediaWrapper.style.display = 'inline-block';
      mediaWrapper.style.marginTop = '10px';

      // Sparkle overlay sadece görseller için mantıklı
      if (mediaType === 'image') {
        const sparkleOverlay = document.createElement('div');
        sparkleOverlay.className = 'sparkle-overlay';
        sparkleOverlay.innerHTML = '<span style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:white; font-weight:bold; text-shadow: 0 0 5px black;">Görseli görmek için tıklayın</span>';
        sparkleOverlay.onclick = () => {
            sparkleOverlay.style.clipPath = 'inset(0 0 100% 0)';
            setTimeout(() => sparkleOverlay.remove(), 800);
        };
        mediaWrapper.appendChild(sparkleOverlay);
      }

      mediaWrapper.appendChild(loadedMedia);

      botMessageDiv.innerHTML = marked.parse(`**İstek:** "${prompt}"`);
      botMessageDiv.appendChild(mediaWrapper);
      botMessageDiv.insertAdjacentHTML('beforeend', downloadButtonHtml);

      // If this is a chat message, add it to history
      if (botMessageDiv.id !== 'imageGenResult' && botMessageDiv.id !== 'videoGenResult') { // Check if it's not a modal result div
          chats[currentChatId].history.push({ role: "model", text: `${capitalizeWord(mediaType)} oluşturuldu: "${prompt}"`, files: [{ type: mediaType, mime_type: mimeType, data: mediaUrl }] });
          saveState();
      }

    } catch (e) {
      botMessageDiv.innerText = `${capitalizeWord(mediaType)} oluşturulurken bir hata oluştu: ` + e.message;
    } finally {
      // Görsel/video üretimi (başarılı ya da hatalı) tamamlandı: input
      // kutusunun kenarındaki ışık halkasını kapat. Sohbet kutusundan değil
      // de bir modal üzerinden (imageGenResult/videoGenResult) çağrıldıysa
      // ışık zaten hiç açılmamış olabilir; kapatma böyle durumlarda
      // zararsızdır.
      stopThinkingGlow();
    }
  }

  // generateImageInChat'i displayMediaInChat'i kullanacak şekilde güncelle
  async function generateImageInChat(prompt, targetDiv = null, imageUrl = null) {
    if (!prompt && !imageUrl) {
        alert("Lütfen oluşturulacak görsel için bir açıklama girin.");
        return;
    }

    let botMessageDiv;
    if (!targetDiv) {
        document.getElementById("heroTitle").style.display = "none";
        botMessageDiv = appendMessageUI("Görsel oluşturuluyor... Lütfen bekleyin.", "bot");
    } else {
        botMessageDiv = targetDiv;
        botMessageDiv.innerHTML = "Görsel oluşturuluyor... Lütfen bekleyin.";
    }

    // Rastgele bir seed ekleniyor: aynı prompt tekrar yazıldığında Pollinations.ai
    // CDN önbelleğinden AYNI görseli döndürmesin diye. Her istekte farklı görsel gelir.
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const enhancedPrompt = `${prompt}, photorealistic, 8k, ultra detailed, cinematic lighting, professional photography, sharp focus`;
    const finalImageUrl = imageUrl || `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?seed=${seed}&nologo=true`;
    await displayMediaInChat(prompt, finalImageUrl, 'image/png', botMessageDiv, 'image');
  }

