# DeutschAI + Felkan — kullanıcı sistemi, güvenli Gemini ve kişisel Almanca

Bu paket, mevcut `faarukyalcin/HalloLab` sitesini bozmadan entegre edilecek kaynak dosyalarını içerir. **Henüz canlı backend değildir.** GitHub Pages yalnız statik dosya sunar. Cloudflare Workers + D1 kurulmadan kayıt/giriş, gerçek hesap senkronizasyonu veya admin kontrollü Gemini çalışmaz.

## Mevcut mimari ve yapılacak düzenleme

- `index.html`: Büyük tek dosyalı DeutschAI uygulaması, dersler, gramer, kelimeler, testler, `state` ve `localStorage`.
- `learning-features.js`, `gemini-web.js` ve diğer CSS dosyaları: mevcut ek işlevler; korunur.
- `felkan.html`: Yüklenen orijinal **Felkan** dosyasından uyarlanır. Ses, panel, Goethe sınavı ve araç tanımları büyük ölçüde olduğu gibi kalır.
- `backend/src.js`: Cloudflare Worker. Kayıt/giriş, kalıcı kullanıcı verileri, yalnız yöneticinin güncelleyebildiği Gemini anahtarı ve kısa süreli Live token sağlar.
- `backend/migrations/0001_init.sql`: Cloudflare D1 kullanıcı, oturum, durum, admin ayarları, istek sınırlama tabloları.
- `repo kökü/deutschai-auth.js`: Tek kullanıcı adı/şifre giriş formu; 5 alanlı kayıt, admin ve API istemcisi.
- `repo kökü/deutschai-personalization.js`: Felkan'ın kullanıcının seviyesine ve yanlış kelimelerine göre 4 soruluk gramer/kelime/pratik içeriği oluşturması ve ana sayfada karşılaması.
- `repo kökü/felkan-bridge.js`: Felkan sesli bağlantısını uzun ömürlü gizli anahtar yerine backend üzerinden alınan **60 saniyelik başlangıç pencereli** geçici Gemini token ile kurar. Felkan `open_app_section` fonksiyonuyla gerçek DeutschAI sayfasını açabilir.
- `repo kökü/api-config.js`: **Yalnızca Worker URL'sini** içerir; asla API anahtarı içermez.

## Veritabanı

`users(id, username, email, first_name, last_name, password_salt, password_hash, role, created_at)`
`user_states(user_id, bucket, data, revision, updated_at)`
`sessions(token_hash, user_id, expires_at, created_at)`
`app_settings(key, value, updated_at)`
`login_attempts(key, count, reset_at)` ve `api_usage`.

Şifreler salt'lı PBKDF2-SHA256 (310.000 iterasyon) ile hash'lenir; oturum tokenlarının yalnızca SHA-256 özeti tutulur. Ortak Gemini anahtarı AES-256-GCM ile D1'de şifrelenir. `ENCRYPTION_SECRET` ve `ADMIN_BOOTSTRAP_SECRET` **yalnız** Worker secrets olarak tutulur. Kayıt ekranı: Username, Password, First Name, Last Name, Email. Giriş: Username ve Password.

## Kurulum

1. Cloudflare hesabında Workers + D1 aç. Yerel çalışma ortamında `cd backend && npx wrangler d1 create deutschai` komutunu çalıştır. Gelen D1 kimliğini `backend/wrangler.toml` dosyasındaki `database_id` kısmına yaz.
2. `npx wrangler d1 migrations apply DB --remote` ile tabloları oluştur. `wrangler.toml` içindeki `SITE_ORIGIN` değerini gerçek site origin'i olarak bırak (`https://faarukyalcin.github.io`) veya kendi domaininle değiştir.
3. Güçlü rastgele AES anahtarı üret: `python -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())"`. `npx wrangler secret put ENCRYPTION_SECRET` komutuyla ekle. Ayrıca `npx wrangler secret put ADMIN_BOOTSTRAP_SECRET` ile ayrı, rastgele 32+ karakterli ilk-admin sırrını oluştur.
4. `npx wrangler deploy` ile Worker'ı yayınla. Çıkan `https://...workers.dev` adresini `repo kökü/api-config.js` içine `window.DEUTSCHAI_API_URL` olarak koy.
5. `repo kökü/` içindeki `api-config.js`, `deutschai-auth.js`, `deutschai-personalization.js`, `felkan.html`, `felkan-bridge.js` dosyalarını sitenin repo köküne kopyala. **Önce `index.html` dosyasını yedekle.** Repo kökünde `python install_into_repo.py index.html` çalıştır. Bu işlem `index.html` dosyasına betik referanslarını ekler; var olan dersleri silmez.
6. Değişen kodu GitHub reposu `main` dalına yükle; GitHub Pages'in başarılı yayımlanmasını bekle.
7. Tarayıcıda önce kendi normal hesabını 5 alanla kaydet. Sonra `POST /admin/claim` isteğini, oturum Bearer tokenın ve `{ "bootstrapSecret": "..." }` JSON gövdesiyle **yalnız bir kere** gönder. Böylece o hesap admin olur. Örneğin terminalde:
   ```bash
   curl -X POST "$WORKER_URL/admin/claim" -H "Authorization: Bearer $SESSION_TOKEN" -H 'Content-Type: application/json' --data '{"bootstrapSecret":"BURAYA_WORKER_SECRET"}'
   ```
   Bootstrap sırrını **frontend'e veya GitHub'a yazma**. İsteği kendin güvenli terminalinden gönder.
8. Çıkış ve tekrar giriş yap: admin rolü ekranda güncellenecek. Hesap menüsünden **Admin Paneli** aç; Gemini anahtarını tanımla. Normal kullanıcıdan hiçbir zaman API anahtarı istenmez.
9. Kullanıcının dersi, ilerlemesi, seviye ve kelimeleri sunucuda kullanıcı ID'sine göre saklanır. Felkan'ın sesli oturumunu ve gerçek Gramer/Kelimeler sayfalarını açmasını test et.

## Önemli sınırlamalar ve güvenlik

- `index.html` ve Felkan çok büyük tek dosyalı uygulamalar olduğu için tam uçtan uca tarayıcı testi yapılmadan üretime aktarılmamalı. Önce staging ortamında test edin.
- Oturum tokenı cross-origin GitHub Pages/Worker mimarisi nedeniyle `localStorage` içinde tutulur. Üretim güvenliği için aynı alan adı altında backend ve `HttpOnly + Secure + SameSite` oturum cookie'sine geçmek daha iyidir; XSS ve rate-limit testlerini yapın.
- Bir kullanıcı aynı veriyi iki cihazda aynı anda değiştirirse son yazan kazanabilir; backend revizyon denetimi var ama frontend şu an iyimser eşleştirme kullanır.
- `gemini-web.js` gibi mevcut eski doğrudan Gemini kodları varsa üretimde kullanıcı API anahtarı isteme ve tarayıcıdan kalıcı anahtar gönderme yolları ayrı ayrı kapatılmalıdır. Bu paket `Felkan` Live bağını güvenli tokena geçirir fakat uygulamanın diğer eski AI çağrıları için ayrıca proxy geçişi gerekebilir.
- Felkan'ın eski Goethe verileri, kendi testleri ve yerel konu listeleri hâlâ mevcuttur. Öneri sistemi genel Almancaya yöneltilir; bütün eski Goethe varsayımlarını tek kalemde dönüştürdüğünü iddia etmez.
- Worker üzerinde `/health` endpoint'i, kullanıcıya özel `/state`, `/ai/generate`, `/ai/live-token`, `/admin/gemini-key` ve `/admin/status` vardır. Gemini Live ephemeral token özelliği önizlemededir ve seçilen modelle uyumu test edilmelidir.