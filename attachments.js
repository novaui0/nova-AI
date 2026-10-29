// src/js/chat/attachments.js - Attached file chips

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      if (file.type.startsWith("image/")) {
        reader.onload = (e) => {
          attachedFiles.push({ type: "image", mime_type: file.type, data: e.target.result.split(',')[1], name: file.name });
          renderChips();
        };
        reader.readAsDataURL(file);
      } else { // Diğer dosyaları metin olarak oku
        reader.onload = (e) => {
          attachedFiles.push({ type: "text", content: e.target.result, name: file.name });
          renderChips();
        };
        reader.readAsText(file);
      }
    });
  }

  function renderChips() {
    const prev = document.getElementById("filePreview");
    prev.innerHTML = "";
    attachedFiles.forEach((f, i) => {
      prev.innerHTML += `<div class="file-chip">${f.name} <span onclick="attachedFiles.splice(${i},1);renderChips();" style="cursor:pointer;">✕</span></div>`;
    });
  }

