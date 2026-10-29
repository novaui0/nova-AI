const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain } = require("electron");

let mainWindow = null;

// ========================================
// .ENV DOSYASI (API ANAHTARI KORUMASI)
// ========================================
// API anahtarı artık index.html içinde düz metin olarak durmuyor; proje
// klasöründeki .env dosyasından (GEMINI_API_KEY=... satırı) okunur ve
// SADECE renderer bunu istediğinde (get-api-key event'i ile) IPC üzerinden
// gönderilir. .env dosyası .gitignore'a eklenmelidir ki GitHub'a
// yüklenmesin — bu proje köküne örnek bir .env.example dosyası da eklendi.
//
// Ekstra bir npm paketi (dotenv) gerektirmemesi için basit bir .env
// ayrıştırıcı burada elle yazıldı: "ANAHTAR=değer" formatındaki satırları
// okur, # ile başlayan satırları ve boş satırları yok sayar.
function loadEnvFile() {
    const envPath = path.join(__dirname, ".env");
    const env = {};

    if (!fs.existsSync(envPath)) {
        writeLog(".env dosyası bulunamadı: " + envPath + " — API anahtarı boş kalacak.");
        return env;
    }

    try {
        const raw = fs.readFileSync(envPath, "utf8");
        raw.split(/\r?\n/).forEach(function (line) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) return;

            const eqIndex = trimmed.indexOf("=");
            if (eqIndex === -1) return;

            const key = trimmed.slice(0, eqIndex).trim();
            let value = trimmed.slice(eqIndex + 1).trim();
            // Değer tırnak içindeyse tırnakları temizle
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            env[key] = value;
        });
    } catch (error) {
        writeLog(".env dosyası okunamadı.", error);
    }

    return env;
}

const ENV = loadEnvFile();

// ========================================
// DOSYA YOLLARI
// ========================================

const USER_DATA_PATH = app.getPath("userData");
const USERS_FILE = path.join(USER_DATA_PATH, "users.json");
const LOG_FILE = path.join(USER_DATA_PATH, "error.log");

// ========================================
// LOG
// ========================================

function writeLog(message, error) {
    try {
        let text = "[" + new Date().toISOString() + "] " + message;

        if (error) {
            text += "\n" + (
                error.stack ||
                error.message ||
                String(error)
            );
        }

        text += "\n";

        fs.appendFileSync(
            LOG_FILE,
            text,
            "utf8"
        );
    } catch (_) {
    }

    console.log(message);

    if (error) {
        console.error(error);
    }
}

// ========================================
// USERS.JSON
// ========================================

function ensureUsersFile() {
    try {
        if (!fs.existsSync(USER_DATA_PATH)) {
            fs.mkdirSync(
                USER_DATA_PATH,
                {
                    recursive: true
                }
            );
        }

        if (!fs.existsSync(USERS_FILE)) {
            fs.writeFileSync(
                USERS_FILE,
                "[]",
                "utf8"
            );
        }
    } catch (error) {
        writeLog(
            "users.json oluşturulamadı.",
            error
        );
    }
}

// ========================================
// ANA PENCERE
// ========================================

function createWindow() {

    const indexPath = path.join(
        __dirname,
        "index.html"
    );

    if (!fs.existsSync(indexPath)) {
        throw new Error(
            "index.html bulunamadı: " +
            indexPath
        );
    }

    const windowOptions = {
        width: 1200,
        height: 800,

        minWidth: 900,
        minHeight: 600,

        autoHideMenuBar: true,

        backgroundColor: "#0f172a",

        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    };

    const iconPath = path.join(
        __dirname,
        "build",
        "icon.ico"
    );

    if (fs.existsSync(iconPath)) {
        windowOptions.icon = iconPath;
    }

    mainWindow = new BrowserWindow(
        windowOptions
    );

    if (process.platform === "win32") {
        app.setAppUserModelId(
            "NovaAI"
        );
    }

    // ----------------------------------------
    // MİKROFON İZNİ (sesli asistan / uyandırma kelimesi)
    // ----------------------------------------
    // Renderer içindeki ses tanıma ve getUserMedia çağrılarının sessizce
    // reddedilmemesi için mikrofon erişimine izin veriyoruz.

    const mediaPermissions = [
        "media",
        "audioCapture",
        "microphone"
    ];

    mainWindow.webContents.session.setPermissionRequestHandler(
        function (
            webContents,
            permission,
            callback
        ) {

            callback(
                mediaPermissions.indexOf(permission) !== -1
            );
        }
    );

    mainWindow.webContents.session.setPermissionCheckHandler(
        function (
            webContents,
            permission
        ) {

            return mediaPermissions.indexOf(permission) !== -1;
        }
    );

    mainWindow.loadFile(
        indexPath
    ).catch(
        function (error) {
            writeLog(
                "index.html yüklenemedi.",
                error
            );
        }
    );

    mainWindow.webContents.on(
        "did-finish-load",
        function () {

            if (
                mainWindow &&
                !mainWindow.isDestroyed()
            ) {
                mainWindow.webContents.send(
                    "start-app"
                );
            }
        }
    );

    mainWindow.webContents.on(
        "did-fail-load",
        function (
            event,
            errorCode,
            errorDescription
        ) {

            writeLog(
                "Sayfa yükleme hatası: " +
                errorCode +
                " - " +
                errorDescription
            );
        }
    );

    mainWindow.webContents.on(
        "render-process-gone",
        function (
            event,
            details
        ) {

            writeLog(
                "Renderer kapandı: " +
                details.reason +
                " / " +
                details.exitCode
            );
        }
    );

    mainWindow.on(
        "closed",
        function () {
            mainWindow = null;
        }
    );
}

// ========================================
// KULLANICI KAYDI
// ========================================

ipcMain.handle(
    "register-user",
    async function (
        event,
        userData
    ) {

        try {

            ensureUsersFile();

            userData = userData || {};

            let users = [];

            try {

                const rawData =
                    fs.readFileSync(
                        USERS_FILE,
                        "utf8"
                    );

                users =
                    JSON.parse(
                        rawData || "[]"
                    );

                if (!Array.isArray(users)) {
                    users = [];
                }

            } catch (error) {

                writeLog(
                    "users.json okunamadı.",
                    error
                );

                users = [];
            }

            const username =
                String(
                    userData.username || ""
                ).trim();

            const email =
                String(
                    userData.email || ""
                ).trim()
                .toLowerCase();

            const password =
                String(
                    userData.password || ""
                );

            if (
                username === "" ||
                email === "" ||
                password === ""
            ) {

                return {
                    success: false,
                    message:
                        "Kullanıcı adı, e-posta ve şifre zorunludur."
                };
            }

            const exists =
                users.some(
                    function (user) {

                        const oldUsername =
                            String(
                                user.username || ""
                            ).toLowerCase();

                        const oldEmail =
                            String(
                                user.email || ""
                            ).toLowerCase();

                        return (
                            oldUsername ===
                            username.toLowerCase()
                        ) || (
                            oldEmail === email
                        );
                    }
                );

            if (exists) {

                return {
                    success: false,
                    message:
                        "Bu kullanıcı adı veya e-posta zaten kayıtlı!"
                };
            }

            users.push({
                username: username,
                email: email,
                password: password
            });

            fs.writeFileSync(
                USERS_FILE,
                JSON.stringify(
                    users,
                    null,
                    2
                ),
                "utf8"
            );

            return {
                success: true,
                message: "Kayıt başarılı!"
            };

        } catch (error) {

            writeLog(
                "Kullanıcı kaydı sırasında hata.",
                error
            );

            return {
                success: false,
                message:
                    "Kullanıcı kaydedilemedi: " +
                    error.message
            };
        }
    }
);

// ========================================
// UYGULAMADAN ÇIKIŞ
// ========================================

ipcMain.on(
    "quit-app",
    function () {
        app.quit();
    }
);

// ========================================
// VERSİYON
// ========================================

ipcMain.on(
    "get-app-version",
    function (event) {

        if (
            mainWindow &&
            !mainWindow.isDestroyed()
        ) {

            event.sender.send(
                "app_version",
                app.getVersion()
            );
        }
    }
);

// ========================================
// API ANAHTARI (güvenli iletim) & ENV YÖNETİMİ
// ========================================
// Renderer, sayfa yüklendiğinde bu event'i gönderir; anahtar SADECE burada,
// IPC üzerinden, .env dosyasından okunmuş haliyle iletilir. index.html
// içinde artık anahtar sabit yazılı değildir.

ipcMain.handle(
    "get-api-key",
    function () {
        return ENV.GEMINI_API_KEY || "";
    }
);

function saveEnvKey(key, value) {
    const envPath = path.join(__dirname, ".env");
    let content = "";
    if (fs.existsSync(envPath)) {
        content = fs.readFileSync(envPath, "utf8");
    }
    const lines = content ? content.split(/\r?\n/) : [];
    let found = false;
    const newLines = lines.map(function (line) {
        const trimmed = line.trim();
        if (trimmed.startsWith(key + "=")) {
            found = true;
            return key + "=" + value;
        }
        return line;
    });
    if (!found) {
        newLines.push(key + "=" + value);
    }
    fs.writeFileSync(envPath, newLines.join("\n"), "utf8");
    ENV[key] = value;
}

ipcMain.handle("save-env-key", function (event, key, value) {
    try {
        if (!key || typeof key !== "string") return { success: false, error: "Geçersiz anahtar" };
        saveEnvKey(key.trim(), String(value || "").trim());
        return { success: true };
    } catch (err) {
        writeLog(".env kaydedilemedi: " + key, err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle("get-env-config", function () {
    return {
        hasGeminiKey: Boolean(ENV.GEMINI_API_KEY && ENV.GEMINI_API_KEY.trim()),
        hasGoogleClientId: Boolean(ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_ID.trim()),
        googleClientId: ENV.GOOGLE_CLIENT_ID || ""
    };
});

// ========================================
// GOOGLE İLE GİRİŞ (OAuth & Güvenli Akış)
// ========================================
let googleAuthWindow = null;

ipcMain.handle(
    "google-sign-in",
    function () {
        return new Promise(function (resolve) {
            const clientId = (ENV.GOOGLE_CLIENT_ID || "").trim();
            if (!clientId) {
                // Client ID tanımlı değilse çökertmek yerine renderer'a yapılandırma bayrağı dönüyoruz
                resolve({ needConfig: true, message: "GOOGLE_CLIENT_ID henüz .env dosyasında tanımlı değil." });
                return;
            }

            const redirectUri = "http://localhost/oauth-callback";
            const scope = encodeURIComponent("openid email profile");
            const authUrl =
                "https://accounts.google.com/o/oauth2/v2/auth" +
                "?client_id=" + encodeURIComponent(clientId) +
                "&redirect_uri=" + encodeURIComponent(redirectUri) +
                "&response_type=token" +
                "&scope=" + scope +
                "&prompt=select_account";

            if (googleAuthWindow && !googleAuthWindow.isDestroyed()) {
                try { googleAuthWindow.close(); } catch (_) {}
                googleAuthWindow = null;
            }

            // Google OAuth'un Electron'da 'disallowed_useragent' (403) hatası vermesini
            // önlemek için standart güncel Chrome User-Agent kullanılır.
            const chromeUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

            googleAuthWindow = new BrowserWindow({
                width: 520,
                height: 680,
                autoHideMenuBar: true,
                title: "Google ile Giriş Yap",
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true
                },
            });

            googleAuthWindow.webContents.setUserAgent(chromeUserAgent);

            let resolved = false;
            function finish(result) {
                if (resolved) return;
                resolved = true;
                if (googleAuthWindow && !googleAuthWindow.isDestroyed()) {
                    try { googleAuthWindow.close(); } catch (_) {}
                    googleAuthWindow = null;
                }
                resolve(result);
            }

            // Ağ isteği gitmeden redirectUri yakalanır (ERR_CONNECTION_REFUSED engellenir)
            const filter = {
                urls: [
                    "http://localhost/*",
                    "http://127.0.0.1/*",
                    "https://localhost/*"
                ]
            };

            googleAuthWindow.webContents.session.webRequest.onBeforeRequest(filter, function (details, callback) {
                const targetUrl = details.url;
                if (targetUrl.startsWith("http://localhost/oauth-callback") || targetUrl.startsWith("http://127.0.0.1/oauth-callback")) {
                    callback({ cancel: true });
                    const hashPart = targetUrl.split("#")[1] || "";
                    const queryPart = targetUrl.split("?")[1] || "";
                    const params = new URLSearchParams(hashPart || queryPart);
                    const accessToken = params.get("access_token");
                    const error = params.get("error");
                    const code = params.get("code");

                    if (error) {
                        finish({ error: "Google girişi reddedildi: " + error });
                    } else if (accessToken) {
                        finish({ accessToken: accessToken });
                    } else if (code) {
                        finish({ code: code });
                    } else {
                        finish({ error: "Google girişinden token alınamadı." });
                    }
                    return;
                }
                callback({ cancel: false });
            });

            googleAuthWindow.loadURL(authUrl, { userAgent: chromeUserAgent }).catch(function (err) {
                writeLog("Google auth URL yüklenemedi:", err);
                finish({ error: "Google giriş sayfası açılamadı: " + err.message });
            });

            googleAuthWindow.on("closed", function () {
                googleAuthWindow = null;
                if (!resolved) {
                    finish({ cancelled: true, message: "Google giriş penceresi kapatıldı." });
                }
            });
        });
    }
);

// ========================================
// ELECTRON BAŞLAT
// ========================================

app.whenReady()
    .then(
        function () {

            writeLog(
                "Nova başlatılıyor..."
            );

            ensureUsersFile();

            createWindow();

            app.on(
                "activate",
                function () {

                    if (
                        BrowserWindow
                            .getAllWindows()
                            .length === 0
                    ) {
                        createWindow();
                    }
                }
            );
        }
    )
    .catch(
        function (error) {

            writeLog(
                "Electron başlatılamadı.",
                error
            );
        }
    );

// ========================================
// TÜM PENCERELER KAPANDI
// ========================================

app.on(
    "window-all-closed",
    function () {

        if (
            process.platform !== "darwin"
        ) {
            app.quit();
        }
    }
);

// ========================================
// KRİTİK HATALAR
// ========================================

process.on(
    "uncaughtException",
    function (error) {

        writeLog(
            "KRİTİK MAIN PROCESS HATASI",
            error
        );
    }
);

process.on(
    "unhandledRejection",
    function (reason) {

        writeLog(
            "PROMISE HATASI",
            reason
        );
    }
);
