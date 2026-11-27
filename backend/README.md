# DeutschAI + Felkan — Sunucu kurulumu

Bu repoda uygulamanın **frontend kodu hazırdır**. `index.html`, `deutschai-auth.js`, `deutschai-personalization.js`, `felkan.html` ve `felkan-bridge.js` birbirine bağlanmıştır. Kullanıcılar backend kurulana kadar mevcut statik dersleri görür; **canlı kayıt/giriş henüz açık değildir**.

## Mimari
- GitHub Pages: statik DeutschAI frontend.
- Cloudflare Worker (`backend/src.js`): kullanıcı oturumları, admin, Gemini proxy/Live token.
- D1 (`backend/migrations/0001_init.sql`): kullanıcı, salt'lı şifre hash, kullanıcı ilerlemesi, oturum ve yönetici ayarları.
- `api-config.js`: sadece Worker URL'si, **asla Gemini API key değil**.
- `gemini-web.js`: backend aktifken AI isteklerini Worker'a yönlendirir.
- Felkan: önceden mevcut ses, test ve paneller korunur. Kişisel öğretmen modunda sesli konuşma ve `open_app_section` ile DeutschAI sayfaları açılır.

## Cloudflare kurulum adımları
1. Cloudflare hesabında D1 ve Workers kullanıma açın. Terminalde `cd backend` komutuyla bu klasöre girin.
2. `npx wrangler login`
3. `npx wrangler d1 create deutschai` ve dönen `database_id` değerini `backend/wrangler.toml` içindeki `REPLACE_WITH_YOUR_D1_DATABASE_ID` ile değiştirin.
4. `npx wrangler d1 migrations apply DB --remote`
5. Güçlü ve farklı iki secret üretin: `ENCRYPTION_SECRET` 32 baytlık rastgele değerin **base64** çıktısı, `ADMIN_BOOTSTRAP_SECRET` en az 32 rastgele karakter. Bunları `npx wrangler secret put ENCRYPTION_SECRET` ve `npx wrangler secret put ADMIN_BOOTSTRAP_SECRET` komutlarıyla oluşturun. Değerlerini GitHub'a, ekran görüntüsüne veya sohbete yazmayın.
6. `npx wrangler deploy` ile Worker'ı yayımlayın. Çıkan `https://...workers.dev` adresini repo kökündeki `api-config.js` dosyasında `window.DEUTSCHAI_API_URL` değerine yazıp GitHub'a commit edin.
7. Web sitesini yeniden açın. Kayıtta **kullanıcı adı, şifre, isim, soyisim, e-posta**; girişte sadece **kullanıcı adı ve şifre** istenir. Kendi hesabınızı kaydedin.
8. Hesabım > İlk Yönetici Kurulumu sayfasında yalnız sizin bildiğiniz `ADMIN_BOOTSTRAP_SECRET` değerini girin. Sayfa bu secret'ı saklamaz. Bu işlem yalnızca **ilk yönetici hesabı** için yapılabilir.
9. Tekrar giriş yapıp Hesabım > Admin Paneli içinden ortak Gemini API anahtarını tanımlayın. Normal kullanıcılardan anahtar istenmez.
10. İki ayrı kullanıcı açarak veri izolasyonu; tekrar giriş, cihazlar arası ilerleme senkronizasyonu, gramer/kelime açılışı, sesli konuşma ve AI cevaplarını test edin.

## Güvenlik ve sınırlamalar
- Kalıcı API anahtarı yalnızca sunucuda AES-GCM ile şifrelenir. `ENCRYPTION_SECRET` kaybolursa anahtarın yeniden tanımlanması gerekir.
- Live bağlantısı `v1alpha` geçici Gemini token kullanır. Google model/önizleme uyumluluğu gerçek anahtarla test edilmelidir.
- Oturum tokenları mevcut cross-origin GitHub Pages mimarisinde `localStorage` içinde tutulur. Uzun vadede özel alan adı ve HttpOnly Secure SameSite cookie tercih edilir.
- Hesaplar sunucuda hazır olana kadar, kullanıcıları kilitlememek için boş `DEUTSCHAI_API_URL` giriş ekranını devre dışı tutar.
- Üretime açmadan önce staging testi, kötüye kullanım limitleri, hata izleme ve çok cihazlı çakışma çözümü doğrulanmalıdır.
