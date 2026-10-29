// src/js/chat/message-renderer.js - Bot message rendering: steps, file cards, code blocks

  // API GÖNDERİMİ (SİSTEM TALİMATI & HAFIZA EKLENDİ)
  // Bot mesajı içeriğini (metin + varsa bir veya daha fazla ```kod``` bloğu)
  // render eder. Kod blokları özel "code-bubble" kutusunda (başlık + indir/kopyala
  // ikonları + syntax highlighting) gösterilir, aralarındaki düz metin markdown
  // olarak render edilir. Hem appendMessageUI hem typewriterRenderReply bunu kullanır.
  // Global depo: dosya kartlarının "İndir" butonu tıklandığında kodun
  // tamamına erişebilmek için (DOM'a ham kodu gömmek yerine).
  window.__novaFileCodes = window.__novaFileCodes || {};
  let __novaFileCardCounter = 0;

  // Uzantıya göre dosya ikonu / dil adı eşleşmesi
  const NOVA_EXT_MAP = {
    js: 'js', javascript: 'js', jsx: 'jsx', ts: 'ts', typescript: 'ts',
    py: 'py', python: 'py', html: 'html', css: 'css', json: 'json',
    java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', 'c#': 'cs',
    php: 'php', bash: 'sh', shell: 'sh', sh: 'sh', sql: 'sql', go: 'go',
    rust: 'rs', swift: 'swift', kotlin: 'kt', ruby: 'rb', xml: 'xml',
    yaml: 'yml', yml: 'yml', text: 'txt'
  };

  // Nova'nın cevabındaki [[STEPS]]...[[/STEPS]] bloğunu ayıklar. Bu blok,
  // Nova'nın bir işi yaparken attığı adımları ("index.html syntax kontrolü"
  // gibi) satır satır içerir. Bulunamazsa steps boş dizi döner.
  function extractNovaSteps(text) {
    const stepsRegex = /\[\[STEPS\]\]([\s\S]*?)\[\[\/STEPS\]\]\s*/;
    const match = stepsRegex.exec(text);
    if (!match) return { steps: [], body: text };
    const steps = match[1].split('\n').map(s => s.trim()).filter(Boolean);
    const body = text.slice(0, match.index) + text.slice(match.index + match[0].length);
    return { steps, body };
  }

  // Adım listesini, tıklayınca açılıp kapanan bir kart olarak inşa eder.
  function buildNovaStepsBlock(steps) {
    if (!steps || steps.length === 0) return null;
    const block = document.createElement('div');
    block.className = 'nova-steps-block';
    const lastStep = steps[steps.length - 1];
    block.innerHTML = `
      <div class="nova-steps-toggle" onclick="this.closest('.nova-steps-block').classList.toggle('open')">
        <span>⚙️ ${lastStep}</span>
        <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="nova-steps-list">
        ${steps.map(s => `
          <div class="nova-step-item">
            <svg class="step-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${s.replace(/^[⚙️✅📄🔧✔️🔍]\s*/, '')}</span>
          </div>
        `).join('')}
      </div>
    `;
    return block;
  }

  // Kod bloğunu, ham kod kutusu yerine indirilebilir bir "dosya kartı"
  // olarak oluşturur.
  function buildNovaFileCard(language, code, filename) {
    const lang = (language || 'text').toLowerCase();
    const ext = NOVA_EXT_MAP[lang] || lang || 'txt';
    const finalName = filename || `nova-dosyasi-${++__novaFileCardCounter}.${ext}`;
    const id = 'novafile_' + (++__novaFileCardCounter) + '_' + Date.now();
    window.__novaFileCodes[id] = code;

    const card = document.createElement('div');
    card.className = 'nova-file-card';
    card.innerHTML = `
      <div class="file-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div class="file-meta">
        <div class="file-name">${finalName}</div>
        <div class="file-sub">Kod · ${lang.toUpperCase()}</div>
      </div>
      <button class="file-download-btn" onclick="downloadNovaFileCard('${id}','${finalName}')">İndir</button>
    `;
    return card;
  }

  function downloadNovaFileCard(id, filename) {
    const code = window.__novaFileCodes[id];
    if (code === undefined) return;
    const blob = new Blob([code], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }

  function renderBotContent(div, text) {
    div.innerHTML = "";

    const { steps, body } = extractNovaSteps(text);
    if (steps.length > 0) {
      const stepsBlock = buildNovaStepsBlock(steps);
      if (stepsBlock) div.appendChild(stepsBlock);
    }
    text = body;

    if (!text.includes("```")) {
      const rest = document.createElement('div');
      rest.innerHTML = marked.parse(text);
      div.appendChild(rest);
      return;
    }

    // ```dil:dosyaadi.uzanti şeklindeki fence'lerden dosya adını da yakalar.
    const codeBlockRegex = /```(\w*)(?::([^\n`]+))?\n?([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const preText = text.substring(lastIndex, match.index);
      if (preText.trim()) {
        const preSpan = document.createElement('div');
        preSpan.innerHTML = marked.parse(preText);
        div.appendChild(preSpan);
      }

      const language = match[1] || 'text';
      const filename = match[2] ? match[2].trim() : null;
      const code = match[3];
      div.appendChild(buildNovaFileCard(language, code, filename));

      lastIndex = codeBlockRegex.lastIndex;
    }

    const postText = text.substring(lastIndex);
    if (postText.trim()) {
      const postSpan = document.createElement('div');
      postSpan.innerHTML = marked.parse(postText);
      div.appendChild(postSpan);
    }
  }

  // Nova'nın cevabını kelime kelime, daktilo yazar gibi ekrana yazan yardımcı
  // fonksiyon. Ham metni parça parça yazıp en son renderBotContent ile render eder;
  // bu sayede markdown/kod bloğu etiketleri yazım sırasında bozuk görünmez.
  async function typewriterRenderReply(div, fullText, speedMs = 18, signal = null) {
    // Önce [[STEPS]] bloğu varsa anında (animasyonsuz) gösterilir; geri
    // kalan gövde metni ayrı bir alt kutuya daktilo efektiyle yazılır.
    // Adımlar HER ZAMAN en üstte, "yazıyor" göstergesi ise metnin altında,
    // yazım bitene kadar görünür kalır.
    const { steps, body } = extractNovaSteps(fullText);
    div.innerHTML = "";
    if (steps.length > 0) {
      const stepsBlock = buildNovaStepsBlock(steps);
      if (stepsBlock) div.appendChild(stepsBlock);
    }
    const contentDiv = document.createElement('div');
    div.appendChild(contentDiv);

    // Yazım sürerken metnin altında görünen küçük "yazıyor" göstergesi
    // (ayarlardan seçilen stile göre: dönen logo veya zıplayan noktalar).
    const writingIndicator = document.createElement('div');
    writingIndicator.className = 'writing-indicator';
    writingIndicator.innerHTML = getThinkingIndicatorHTML();
    div.appendChild(writingIndicator);

    contentDiv.classList.add('typing-cursor');
    const words = body.split(/(\s+)/); // boşlukları da koru (kelime + boşluk sırayla)
    let shown = "";
    for (let i = 0; i < words.length; i++) {
      if (signal && signal.aborted) {
        // Kullanıcı durdurdu: o ana kadar yazılanı kalıcı hale getir.
        break;
      }
      shown += words[i];
      // Yazım sırasında düz metin göster (markdown/kod bloğu bozulmasın diye),
      // otomatik aşağı kaydırmayı da tetiklemek için innerText kullanılıyor.
      contentDiv.innerText = shown;
      const chatArea = document.querySelector('.chat-area');
      if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
      // Boşluk parçalarını bekletmeden geç, sadece gerçek kelimelerde bekle.
      if (words[i].trim().length > 0) {
        await new Promise(r => setTimeout(r, speedMs));
      }
    }
    contentDiv.classList.remove('typing-cursor');
    // Yazım tamamlandı: "yazıyor" göstergesini kaldır.
    writingIndicator.remove();
    renderBotContent(contentDiv, shown);
    // Durdurulduysa kısmi metni, tamamlandıysa tam metni döner (steps bloğu
    // dahil), böylece sohbet geçmişine kaydedilen ham metin yeniden
    // yüklendiğinde adım listesi de doğru şekilde geri kurulur.
    const stepsPrefix = steps.length > 0 ? `[[STEPS]]\n${steps.join('\n')}\n[[/STEPS]]\n` : '';
    return stepsPrefix + shown;
  }

  // Tek mesajda izin verilen maksimum karakter sayısı. Kullanıcı bu limitin
  // %70'ine ulaştığında sayaç görünür hale gelir; limiti aşınca kırmızıya
  // döner ve gönderim engellenir.
