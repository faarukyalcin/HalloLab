# DeutschAI ücretsiz Cloudflare kurulumu — GitHub üzerinden

**Ücretli deneme değildir:** Cloudflare Workers Free ve D1 Free, kullanım kotası içeren ücretsiz katmanlardır. Aktif kullanımınız veya 1–2 ay geçmesi nedeniyle otomatik sona eren bir deneme süresi yoktur. Kota aşılırsa hizmetler sınırlanabilir; Gemini API'nin ayrı kullanım şartları ve olası ücretleri vardır.

Bu repoda **Actions → DeutschAI Cloudflare backend kurulumu → Run workflow** ile kurulum başlatan manuel bir iş akışı bulunur. Cloudflare hesabı bağlantısı yapılana kadar **canlı kullanıcı girişini açmaz**.

## Telefonla kurulum

1. https://dash.cloudflare.com/sign-up üzerinden ücretsiz Cloudflare hesabını açın. Workers Free planını kullanın, ücretli planı seçmek zorunda değilsiniz.
2. Cloudflare panelinden **Account ID**'nizi bulun.
3. **My Profile → API Tokens → Create Token** yoluyla yalnız bu proje için bir API token oluşturun. En az hesap düzeyinde **Workers Scripts Edit** ve **D1 Edit** izinlerini verin; ek izin talep edilirse en az yetki ilkesini koruyun. Tokenı sohbete veya kaynak koda göndermeyin.
4. GitHub reposunda **Settings → Secrets and variables → Actions → New repository secret** bölümüne şu DÖRT secret'ı ekleyin:
   - `CLOUDFLARE_ACCOUNT_ID`: Cloudflare Account ID
   - `CLOUDFLARE_API_TOKEN`: Cloudflare API token
   - `ENCRYPTION_SECRET`: 32 rastgele baytın Base64 değeri. Bilgisayarda `openssl rand -base64 32` komutuyla üretilebilir; değeri hiçbir sohbete koymayın.
   - `ADMIN_BOOTSTRAP_SECRET`: En az 32 karakter güçlü ve benzersiz rastgele yönetici kurulum şifresi.
5. GitHub'da **Actions → DeutschAI Cloudflare backend kurulumu → Run workflow** düğmesine basın.
6. Başarılı olduğunda GitHub Actions, veritabanını oluşturur/varsa bulur, migrasyonları uygular, Worker'ı yayınlar, sunucu gizli değerlerini kaydeder, API sağlık kontrolünü yapar ve `api-config.js` dosyasını Worker adresine bağlar.
7. DeutschAI'dan kendi hesabınızı kaydedin ve **Hesabım → İlk Yönetici Kurulumu** bölümünde `ADMIN_BOOTSTRAP_SECRET` değerini **yalnız sitenin formuna** girin.
8. **Admin Paneli** üzerinden Gemini API anahtarınızı kaydedin. API anahtarını **GitHub Actions secret olarak değil, admin paneli üzerinden** tanımlayın.
9. İki farklı kullanıcıyla kayıt, giriş, kullanıcı bazlı veri kaydetme ve Felkan bağlantısını test edin.

## Dikkat
- Worker açılırken otomatik hesap girişini devreye alacak API bağlantısı, yalnız backend sağlık kontrolü başarılıysa güncellenir. API'nin gerçek kayıt/giriş uç noktaları canlıda ayrıca sınanmalıdır.
- Cloudflare Workers Free CPU limiti **istek başına 10 ms** olduğundan ilk gerçek kullanıcı kaydı ve giriş mutlaka test edilmeli; sınır aşımı olursa daha uygun bir yönetilen kimlik doğrulama sağlayıcısı seçilmelidir.
- Şifreler veritabanına düz metin olarak kaydedilmez. Worker WebCrypto'nun 100.000 turluk PBKDF2 sınırıyla uyumlu türetme ve sunucuya özel gizli HMAC pepper kullanır. Bu, üretimde uzun vadeli kimlik doğrulama altyapısının tüm güvenlik ihtiyaçlarının yerini tutmaz.
- Mevcut `wrangler.toml` içindeki D1 ID yer tutucusu iş akışı sırasında değiştirilir; ID'yi repoya commit etmek gerekmez.
- GitHub repo Actions Secrets değerleri sohbetten okunamaz; hesap sahibi kendisi girer.
- Değişikliklerin gerçek kullanıcılarla kullanıma açılmasından önce giriş ve API çağrıları canlı test edilmelidir.

Resmî belgeler:
https://developers.cloudflare.com/workers/platform/pricing/
https://developers.cloudflare.com/d1/platform/pricing/
https://developers.cloudflare.com/d1/get-started/
https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions
