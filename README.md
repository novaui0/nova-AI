# Nova-AI 🚀

 


**Nova-AI**,Electron ile oluşturulmuş modern ve zengin özelliklere sahip bir yapay zeka sohbet asistanıdır.

[![Sürüm](https://img.shields.io/badge/en-son-sürüm-v1.0.4-beta1-orange.svg)](https://github.com/kullanici-adiniz/nova-ai/releases)
[![Lisans](https://img.shields.io/badge/lisans-MIT-green.svg)](LICENSE)

---
## ➕ En Son Eklenenler
# Nova-AI v1.0.4 Sürüm Notları

Bu sürüm, kullanıcı deneyimini zenginleştiren, yönetici yeteneklerini artıran ve puan sistemini daha dinamik hale getiren bir dizi önemli yenilik ve düzeltme içeriyor.

---

### ✨ Yeni Özellikler

*   **💎 Katmanlı Plan Sistemi:** "Nova Advanced" tek bir seviye olmaktan çıkıp, puanla erişilebilen çok katmanlı bir yapıya dönüştü: **Go, Plus, Pro, Ultra ve Advanced**.   Her     katman, kendine özgü özelliklerin kilidini açar:
    *   **Go:** Gelişmiş Sohbet Şablonları
    *   **Plus:** Veri Yönetimi (İçe/Dışa Aktarma)
    *   **Pro:** Görsel Oluşturma ve Plan Modu
    *   **Ultra:** Derin Araştırma
    *   **Advanced:** En güçlü model olan `Nova 3.6 Flash`'ı kullanma.
*   **⚙️ Gelişmiş Yönetici Paneli:** Terminal üzerinden yöneticiler artık daha fazla kontrole sahip:
    *   **Premium Seviye Değiştirme:** Kullanıcıların plan katmanını doğrudan yönetici'ler değiştirebilir.
    *   **Puan Silme:** Kullanıcılardan puan ekleme/silme yapabilir.
    *   **Tüm Geçmişi Temizle:** Yöneticiler tüm kullanıcıların yerel sohbet geçmişlerini temizleyebilir.

---

### 🚀 İyileştirmeler

*   **🔄 Anlık Arayüz Güncellemeleri:**
    *   Yönetici tarafından yapılan puan veya premium seviye değişiklikleri artık kullanıcı arayüzüne **5 saniye içinde** yansıyor. Çıkış yapıp tekrar girmeye gerek yok!
    *   Ayarlar menüsüne, puanı anında yenilemek için bir **"Yenile" butonu** eklendi.

---

### 🐞 Hata Düzeltmeleri

*   **Yükseltme Menüsü Düzeltmesi:** "Yükselt" menüsünde, kullanıcının sahip olmadığı katmanların bile hatalı bir şekilde "Etkin" olarak görünmesi sorunu giderildi.
---

Bu sürümle birlikte Nova-AI, hem kullanıcılar hem de yöneticiler için çok daha esnek ve güçlü bir platform haline geldi.
## ✨ Özellikler

Nova-AI, standart bir sohbet uygulamasının ötesine geçen bir dizi güçlü özellik sunar:

*   **🧠 Güçlü Yapay Zeka:** Google'ın `Gemini 1.5 Pro` ve `Gemini 1.5 Flash` modelleri arasında geçiş yapma imkanı.
*   **👥 Çoklu Kullanıcı Desteği:** Her kullanıcı için ayrı profil ve sohbet geçmişi ile güvenli ve kişisel bir deneyim.
*   **💬 Kalıcı Sohbet Geçmişi:** Tüm konuşmalarınız yerel olarak saklanır ve kolayca erişilebilir.
*   **🖼️ Görsel Oluşturma:** Metin açıklamalarından görseller yaratın.
*   **🤖 Plan Modu:** Yapay zekanın size sorular sorarak hedeflerinize yönelik adım adım planlar oluşturmasını sağlayın.
*   **🔍 Derin Araştırma:** Belirttiğiniz konular hakkında internetten detaylı bilgi toplayıp özetleyin.
*   **🎙️ Sesli Komut:** "Gemini Live" özelliği ile sesli olarak sohbet edin.
*   **📁 Dosya Yükleme:** Sohbetlerinize resim ve metin dosyaları ekleyin.
*   **🌙 Karanlık Mod:** Göz yormayan bir deneyim için aydınlık ve karanlık tema arasında geçiş yapın.
*   **🔄 Güncelleme Ekranı :** `electron-updater` entegrasyonu sayesinde yeni sürümler yayınlandığında uygulamada güncelleme ekranı çıkar ve kolayca güncelleyebilirsiniz.

---

## 🛠️ Kullanılan Teknolojiler

*   **Masaüstü Çerçevesi:** Electron
*   **Arayüz:** HTML5, CSS3, Vanilla JavaScript
*   **Kütüphaneler:**
    *   Marked.js: Markdown metinlerini HTML'e dönüştürmek için.
    *   Highlight.js: Kod bloklarını renklendirmek için.
    *   electron-updater: Otomatik güncelleme işlevselliği için.

---

## 🚀 Kurulum ve Geliştirme

Projeyi yerel makinenizde çalıştırmak ve geliştirmek için aşağıdaki adımları izleyin.

### Gereksinimler

*   Node.js (LTS sürümü önerilir)
*   NPM (Node.js ile birlikte gelir)

### Adımlar

1.  **Projeyi Klonlayın:**
    ```bash
    git clone https://github.com/novaui0/nova-ai.git
    cd nova-ai
    ```

2.  **Bağımlılıkları Yükleyin:**
    ```bash
    npm install
    ```
---

## 📦 Uygulamayı Paketleme

Uygulamanızı Windows, macOS veya Linux için dağıtılabilir bir `.exe` veya kurulum dosyası haline getirmek için aşağıdaki komutu çalıştırın:

```bash
npm run dist
```

Oluşturulan kurulum dosyaları projenin ana dizinindeki `dist` klasöründe yer alacaktır.

---

## 📄 Lisans

Bu proje MIT Lisansı altında lisanslanmıştır. Detaylar için `LICENSE` dosyasına göz atın.

---

## ❤️ Katkıda Bulunma

Katkılarınız projeyi daha iyi hale getirmemize yardımcı olur! Lütfen bir "pull request" açmaktan veya "issue" bildirmekten çekinmeyin.

1.  Projeyi "fork" edin.
2.  Yeni bir "branch" oluşturun (`git checkout -b ozellik/yeni-bir-ozellik`).
3.  Değişikliklerinizi yapın ve "commit" edin (`git commit -m 'Yeni bir özellik eklendi'`).
4.  "Branch"inizi "push" edin (`git push origin ozellik/yeni-bir-ozellik`).
5.  Bir "Pull Request" açın.
