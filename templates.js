// src/js/chat/templates.js - Chat templates + conversation export

  function renderTemplates() {
    const list = document.getElementById("templatesList");
    list.innerHTML = "";
    chatTemplates.forEach(template => {
      const item = document.createElement("div");
      item.className = "add-menu-item"; // Aynı stili kullanabiliriz
      item.style.cursor = "pointer";
      item.onclick = () => applyTemplate(template.prompt);
      const premiumBadge = template.isPremium ? '<span class="premium-badge">✦ Go</span>' : '';
      item.innerHTML = `
        <span class="icon">${template.icon}</span>
        <div class="text-content">
          <span class="title">${template.title}${premiumBadge}</span>
          <span class="description">${template.description}</span>
        </div>
      `;
      list.appendChild(item);
    });
  }

  function applyTemplate(promptText) {
    if (!checkAccess('go')) {
      return;
    }
    document.getElementById("userInput").value = promptText;
    closeModal('templatesModal');
    document.getElementById("userInput").focus();
  }

  function exportChat() {
    if (!checkAccess('plus')) {
      return;
    }
    if (!currentChatId || !chats[currentChatId]) {
      alert("Dışa aktarılacak bir sohbet bulunmuyor.");
      return;
    }

    const chat = chats[currentChatId];
    let markdownContent = `# ${chat.title}\n\n`;

    chat.history.forEach(msg => {
      const sender = msg.role === 'user' ? 'Kullanıcı' : 'Nova';
      markdownContent += `**${sender}:**\n\n${msg.text}\n\n---\n\n`;
    });

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${chat.title.replace(/ /g, '_')}.md`;
    link.click();
  }

