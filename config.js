// src/js/core/config.js - Static app config: templates, premium tiers, personalities

  // Simüle edilmiş kullanıcı veritabanı ve geçici kayıt verileri
  const chatTemplates = [
    {
      icon: "✉️",
      title: "Profesyonel E-posta Yaz",
      description: "Belirli bir konuda resmi bir e-posta taslağı oluşturur.",
      prompt: "**Alıcı:** [Buraya yazın]\n**Konu:** [Buraya yazın]\n**İstenen Ton:** Profesyonel\n**İçerik:**\n\n[E-postanın ana hatlarını buraya yazın]"
    },
    {
      icon: "🐛",
      title: "Kod Hata Ayıklama",
      description: "Bir kod bloğundaki hataları bulmak ve düzeltmek için yardım isteyin.",
      prompt: "Aşağıdaki kod bloğunda bir hata var. Hatayı bulup düzeltebilir misin?\n\n```[dil]\n[Kodunuzu buraya yapıştırın]\n```\n\n**Gördüğüm Hata:** [Aldığınız hata mesajını buraya yazın]"
    },
    {
      icon: "📄",
      title: "Metin Özeti",
      description: "Uzun bir metni anahtar noktalarıyla özetleyin.",
      prompt: "Aşağıdaki metni anahtar noktalarını vurgulayarak özetler misin?\n\n---\n\n[Metni buraya yapıştırın]\n\n---"
    },
    {
      icon: "🌐",
      title: "Sosyal Medya Gönderisi",
      description: "Belirli bir platform için ilgi çekici bir gönderi oluşturun.",
      prompt: "**Platform:** [Instagram/Twitter/LinkedIn vb.]\n**Konu:** [Gönderinin konusu]\n**Hedef Kitle:** [Kime hitap ediyor?]\n**İstenenler:** [Hashtagler, emoji kullanımı vb.]\n\n[Gönderi için ana fikirleri buraya yazın]",
      isPremium: true
    }
  ];

  const premiumTiers = {
    'go': { name: 'Go', cost: 60000, level: 1, features: ['Gelişmiş Sohbet Şablonları'] },
    'plus': { name: 'Plus', cost: 80000, level: 2, features: ['Veri Yönetimi (İçe/Dışa Aktarma)'] },
    'pro': { name: 'Pro', cost: 100000, level: 3, features: ['Görsel Oluşturma', 'Plan Modu'] },
    'ultra': { name: 'Ultra', cost: 150000, level: 4, features: ['Derin Araştırma'] },
    'advanced': { name: 'Advanced', cost: 200000, level: 5, features: ['✦Nova 3.5 Flash', 'Bütün Özellikler'] }
  };

  const dailyTips = [
    "**Plan Modu'nu** denediniz mi? Sohbet girişinin yanındaki 🎯 ikonuna tıklayarak yapay zekanın size sorular sorarak hedeflerinizi gerçekleştirmesini sağlayın.",
    "Bir sohbetin başlığını değiştirmek için kenar çubuğundaki sohbet öğesine **çift tıklayın**.",
    "**Derin Araştırma** özelliği ile belirli bir konu hakkında internetten kapsamlı bilgi toplayıp özetletebilirsiniz. `Ekle (+)` menüsünden erişebilirsiniz.",
    "Ayarlar menüsündeki **Veri Yönetimi** bölümünden tüm sohbetlerinizi ve profillerinizi yedekleyebilir veya geri yükleyebilirsiniz.",
    "Sohbetlerinizi daha sonra kolayca bulmak için **Sohbetlerde Arama Yapın** özelliğini kullanın."
  ];

  function hasAccess(requiredTier) {
    if (currentUserTier === 'none') return false;
    if (!requiredTier) return true; // Eğer özellik bir katman gerektirmiyorsa

    const userLevel = premiumTiers[currentUserTier]?.level || 0;
    const requiredLevel = premiumTiers[requiredTier]?.level || 99; // Bilinmeyen katman en yükseği olsun

    return userLevel >= requiredLevel;
  }

  function checkAccess(requiredTier, featureName) {
    if (hasAccess(requiredTier)) return true;
    openModal('upgradeModal');
    return false;
  }

  // KULLANICI & AI HAFIZASI
  let currentUser = localStorage.getItem("nova_user") || "Kullanıcı";
  let aiName = "Nova";

  // Basit "ilk harfi büyük yap" yardımcı fonksiyonu. Daha önce kod
  // String.prototype.capitalize() gibi var olmayan bir metodu çağırıyordu;
  // bu, görsel/video oluşturma sırasında (özellikle hata durumunda, onerror
  // tetiklendiğinde) "capitalize is not a function" hatasıyla fonksiyonun
  // yarıda kesilmesine ve dolayısıyla ışık halkasının hiç kapanmamasına
  // sebep oluyordu.
  function capitalizeWord(word) {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  // Nova'nın konuşma tonunu/kişiliğini belirleyen hazır seçenekler. Her biri
  // sistem talimatına eklenecek bir davranış tarifi taşır. "custom" seçilirse
  // kullanıcının kendi yazdığı serbest metin (nova_custom_personality) kullanılır.
  const NOVA_PERSONALITIES = {
    default: {
      label: 'Varsayılan',
      desc: 'Dengeli, yardımsever, standart Nova tonu',
      instruction: '',
    },
    friend: {
      label: '😊 Samimi Dost',
      desc: 'Rahat, sıcak, arkadaşça konuşur',
      instruction: 'KİŞİLİK: Kullanıcıya yakın bir arkadaş gibi davran. Samimi, sıcak ve rahat bir dille konuş; resmi ifadelerden kaçın, gerektiğinde espri yap, "sen" dilini kullan. Yine de doğru ve yardımcı olmaktan taviz verme.',
    },
    assistant: {
      label: '💼 Profesyonel Asistan',
      desc: 'Resmi, net, iş odaklı',
      instruction: 'KİŞİLİK: Profesyonel bir kişisel asistan gibi davran. Net, öz ve iş odaklı bir dil kullan; gereksiz espri veya laf kalabalığından kaçın, cevaplarını düzenli ve yapılandırılmış tut.',
    },
    funny: {
      label: '😄 Esprili',
      desc: 'Eğlenceli, şakacı, enerjik',
      instruction: 'KİŞİLİK: Eğlenceli ve şakacı bir tavırla konuş. Uygun yerlerde espri ve esprili benzetmeler kullan, enerjik ve pozitif bir ton tut. Ama ciddi ya da hassas konularda şakayı bırak, doğru ve saygılı ol.',
    },
    direct: {
      label: '⚡ Direkt ve Kısa',
      desc: 'Az laf, çok öz, hızlı cevaplar',
      instruction: 'KİŞİLİK: Cevaplarını olabildiğince kısa ve öz tut. Girizgahsız, doğrudan konuya gir; gereksiz açıklama ve nezaket cümlelerinden kaçın. Sadece istenen bilgiyi/sonucu ver.',
    },
    mentor: {
      label: '🎓 Sabırlı Öğretmen',
      desc: 'Açıklayıcı, adım adım, öğretici',
      instruction: 'KİŞİLİK: Sabırlı bir öğretmen gibi davran. Konuları adım adım, örneklerle ve basit bir dille açıkla; kullanıcının seviyesini gözet, anlaşılmayan noktalar için ek açıklama yapmaya hazır ol.',
    },
    custom: {
      label: '✏️ Özel (kendi tarifim)',
      desc: 'Nova\'nın nasıl davranacağını kendin yaz',
      instruction: null, // localStorage'daki nova_custom_personality metni kullanılır
    },
  };

  function getActivePersonalityId() {
    return localStorage.getItem('nova_personality') || 'default';
  }

  // Aktif kişilik tercihine göre sistem talimatına eklenecek metni döner
  // (kişilik seçilmemişse veya "Varsayılan" ise boş string döner).
  function getPersonalityInstruction() {
    const id = getActivePersonalityId();
    const personality = NOVA_PERSONALITIES[id];
    if (!personality) return '';
    if (id === 'custom') {
      const customText = (localStorage.getItem('nova_custom_personality') || '').trim();
      return customText ? `KİŞİLİK: ${customText}` : '';
    }
    return personality.instruction || '';
  }

  // Basit bir tarayıcı-içi şifre hash'i (Web Crypto API / SHA-256). Şifreler
  // asla düz metin olarak localStorage'a yazılmaz.
  async function hashPassword(password) {
    const enc = new TextEncoder().encode(password);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

