// src/js/media/video-gen.js - Video generation (Pollinations)

  async function generateVideo() {
    if (!checkAccess('pro')) return; // Video generation is also a Pro feature
    const prompt = document.getElementById("videoGenPrompt").value.trim();
    if (!prompt) {
      alert("Lütfen bir açıklama girin.");
      return;
    }

    const resultDiv = document.getElementById("videoGenResult");
    resultDiv.innerHTML = ""; // Önceki içeriği temizle
    resultDiv.innerHTML = "Video oluşturuluyor... (Bu işlem biraz zaman alabilir)";
    
    closeModal('videoGenModal');

    // Sohbet içi video oluşturma fonksiyonunu çağır
    await generateVideoInChat(prompt, resultDiv);
  }

  async function generateVideoInChat(prompt, targetDiv = null) {
    let botMessageDiv;
    if (!targetDiv) {
        document.getElementById("heroTitle").style.display = "none";
        botMessageDiv = appendMessageUI("Video oluşturuluyor... Lütfen bekleyin.", "bot");
    } else {
        botMessageDiv = targetDiv;
        botMessageDiv.innerHTML = "Video oluşturuluyor... Lütfen bekleyin.";
    }

    const videoUrl = `https://pollinations.ai/video/${encodeURIComponent(prompt)}`;
    // Pollinations.ai genellikle .mp4 döndürür.
    await displayMediaInChat(prompt, videoUrl, 'video/mp4', botMessageDiv, 'video');
  }

