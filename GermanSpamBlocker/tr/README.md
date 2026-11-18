
# Gmail Almanca Spam Engelleyici (Google Apps Script)

> **For English documentation:** Please check the main [README.md](../README.md).

Kişisel Gmail hesaplarına gelen Almanca dating ve phishing spam e-postalarını otomatik olarak tespit edip güvenli şekilde **Çöp Kutusu'na** taşıyan, harici sunucu gerektirmeyen ücretsiz bir Google Apps Script aracıdır.

## Özellikler

- **Üç Katmanlı Filtreleme:** Belirli alan adı uzantılarını (`.biz` vb.), kesin spam cümle kalıplarını ve genel Almanca kelime puanlamasını birlikte kullanır.
- **Bot Adresi Tespiti:** Rastgele harf ve rakamlardan oluşan bot gönderen adreslerini düzenli ifadeler (`RegExp`) ile yakalar.
- **Gizlilik Servisi Koruması:** SimpleLogin, Proton Pass ve Apple Hide My Email gibi alias servislerinden gelen gerçek e-postaları rastgele adres filtresinden muaf tutar.
- **Güvenli Temizlik:** E-postaları kalıcı olarak silmez; yanlış alarmlara karşı 30 gün boyunca geri alınabilir şekilde Çöp Kutusu'na taşır (isteğe bağlı olarak yalnızca etiketleme modunda test edilebilir).

## Kurulum Adımları

1. [script.google.com](https://script.google.com) adresine gidin ve **Yeni proje** oluşturun.
2. Bu klasördeki [Code.gs](Code.gs) dosyasının içeriğini kopyalayıp editöre yapıştırın ve kaydedin (`Ctrl + S`).
3. Kodun en üstündeki `AYARLAR` bölümünü kendi ihtiyacınıza göre düzenleyin.
4. Üst menüden `almancaSpamEngelle` fonksiyonunu seçip **Çalıştır** butonuna basın ve gerekli Gmail izinlerini onaylayın.
5. Sol menüdeki **Tetikleyiciler** (saat simgesi) bölümünden `almancaSpamEngelle` fonksiyonu için **Zamana dayalı -> Dakika zamanlayıcı -> Her 15 dakikada bir** olacak şekilde bir zamanlayıcı ekleyin.

## Özelleştirilebilir Ayarlar

- `GIZLILIK_SERVISI_DOMAINLERI`: Rastgele adres kontrolünden muaf tutulacak alias servisleri.
- `ENGELLI_UZANTILAR`: Doğrudan engellenecek alan adı uzantıları (varsayılan: `.biz`).
- `KESIN_SPAM_KALIPLARI`: Tek bir eşleşmede spam sayılacak kesin ifadeler.
- `GUVENLI_GONDERENLER`: Hiçbir filtreye takılmayacak tamamen güvenli adresler (Whitelist).
- `ISLEM_TURU`: Test için `"ETIKET"`, normal kullanım için `"COP"` olarak ayarlanabilir.

## Uyarı

Bu kod yalnızca kendi Google hesabınız üzerinde çalışır ve verilerinizi üçüncü taraf sunuculara göndermez. Kullanmadan önce `ISLEM_TURU = "ETIKET"` seçeneği ile birkaç gün test etmeniz önerilir.
