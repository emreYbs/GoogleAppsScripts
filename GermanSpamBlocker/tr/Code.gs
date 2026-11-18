/**
 * Gmail Almanca Dating Spam Engelleyici (Çakışma Korumalı & Canlı Loglamalı)
 * 
 * emreYbs2026
 * AMAÇ:
 * Gelen Kutusu ve Spam klasöründeki son e-postaları tarar, Almanca dating/phishing
 * kalıplarını yakalar ve güvenli şekilde Çöp Kutusu'na taşır.
 */

// ==================== 1. BÖLÜM: AYARLAR ====================
// Tüm ayarları 'var' ve tek bir nesne (SPAM_AYARLARI) içinde tanımlıyoruz.
// Bu sayede 'Identifier has already been declared' (Çift tanımlama) hatası önlenir.

var SPAM_AYARLARI = {
  // Tek seferde incelenecek maksimum e-posta zinciri sayısı
  MAKSIMUM_ZINCIR: 25,

  // Genel kelime havuzu için gerekli minimum eşleşme puanı
  ESIK_DEGER: 2,

  // Yakalanan e-postaya uygulanacak işlem: "COP" (Çöpe taşır) veya "ETIKET" (Sadece etiketler)
  ISLEM_TURU: "COP",

  // Gizlilik / Alias Servisleri (Rastgele bot adresi kuralından muaf tutulurlar)
  GIZLILIK_SERVISI_DOMAINLERI: [
    "simplelogin.co",
    "simplelogin.com",
    "simplelogin.fr",
    "aleeas.com",
    "passmail.net",
    "passinbox.com",
    "privaterelay.appleid.com",
    "icloud.com"
  ],

  // Doğrudan engellenecek alan adı uzantıları
  ENGELLI_UZANTILAR: [
    ".biz"
  ],

  // Kesin Spam Kalıpları (Başlıkta veya içerikte sadece biri geçerse yakalanır)
  KESIN_SPAM_KALIPLARI: [
    "singles in deiner nähe",
    "sag hallo und schau, wohin es führt",
    "deine art mensch ist online",
    "heute jemanden ins auge gefasst",
    "sind heute online",
    "sind jetzt online",
    "bereit jetzt",
    "sie denkt gerade an dich",
    "das beste fängt mit einem simplen hallo an",
    "echte singles in deiner nähe",
    "nimm, was dein ist",
    "bitte date verantwortungsbewusst",
    "du erhältst diese e-mail im rahmen einer aktion",
    "sie hat dich für heute nacht ausgesucht",
    "wartet auf dich",
    "sie hat dir etwas heißes geschickt",
    "lass die smalltalk-apps",
    "leute in deiner nähe sind gerade online"
  ],

  // Engelli Gönderen Adları veya Özel Domain Parçaları
  ENGELLI_GONDERENLER: [
    "new match",
    "meetic",
    "online now",
    "loveciaty",
    "profinderlclubpartner",
    "osmartflirtoneconnect"
  ],

  // Genel Almanca Kelime Havuzu (Puanlama sistemi için)
  ALMANCA_KELIMELER: [
    "sehr geehrte", "herzlichen glückwunsch", "gewinn", "konto", "bestätigen",
    "klicken sie", "zahlung", "rechnung", "dringend", "verifizierung",
    "kostenlos", "jetzt", "deiner nähe", "bereit", "schau", "chatten", "heißes"
  ],

  // Asla dokunulmayacak tamamen güvenli adresler (Whitelist)
  GUVENLI_GONDERENLER: [
    // "guvenli@ornek.com"
  ]
};

// ==================== 2. BÖLÜM: ANA FONKSİYON ====================

/**
 * Zamanlayıcı (Tetikleyici) veya 'Çalıştır' butonu ile başlatılan ana fonksiyon.
 */
function almancaSpamEngelle() {
  console.info("Tarama başlatıldı... Son 2 günün e-postaları kontrol ediliyor.");

  // Gelen Kutusu ve Spam klasöründeki son 2 günün e-postalarını arar
  const aramaSorgusu = "(in:inbox OR in:spam) newer_than:2d";
  const zincirler = GmailApp.search(aramaSorgusu, 0, SPAM_AYARLARI.MAKSIMUM_ZINCIR);

  console.info("Toplam " + zincirler.length + " adet e-posta zinciri bulundu. İnceleniyor...");

  // Eğer test modu ("ETIKET") seçiliyse ilgili etiketi hazırlar
  let testEtiketi = null;
  if (SPAM_AYARLARI.ISLEM_TURU === "ETIKET") {
    testEtiketi = GmailApp.getUserLabelByName("Almanca-Spam-Test") ||
                  GmailApp.createLabel("Almanca-Spam-Test");
  }

  let yakalananSayisi = 0;

  // Bulunan her bir e-posta zincirini sırayla döngüye sokar
  for (let i = 0; i < zincirler.length; i++) {
    const zincir = zincirler[i];
    const mesajlar = zincir.getMessages();
    const sonMesaj = mesajlar[mesajlar.length - 1];

    const hamGonderen = (sonMesaj.getFrom() || "").toLowerCase();
    const temizEposta = epostaAdresiniCikar(hamGonderen);

    // 0. Katman: Güvenli listedeyse (Whitelist) hiçbir işlem yapmadan atla
    if (listedeVarMi(hamGonderen, SPAM_AYARLARI.GUVENLI_GONDERENLER)) {
      continue;
    }

    const baslik = sonMesaj.getSubject() || "(Konu Yok)";
    const icerik = sonMesaj.getPlainBody() || "";
    const tamMetin = (baslik + " " + icerik).toLowerCase();

    // 1-4. Katman: Filtreleme Kontrolleri
    const uzantiEslesmesi = engelliUzantiMi(temizEposta);
    const gonderenEslesmesi = listedeVarMi(hamGonderen, SPAM_AYARLARI.ENGELLI_GONDERENLER);
    const kesinKalipEslesmesi = listedeVarMi(tamMetin, SPAM_AYARLARI.KESIN_SPAM_KALIPLARI);
    const puan = almancaPuanHesapla(tamMetin);

    // Gönderen SimpleLogin/Apple vb. değilse rastgele bot adresi kontrolünü uygula
    const gizlilikServisi = gizlilikServisiMi(temizEposta);
    const botAdresiVeAlmanca = !gizlilikServisi && rastgeleBotAdresiMi(temizEposta) && puan >= 1;

    // Herhangi bir kural tetiklendiyse işlemi uygula
    if (uzantiEslesmesi || gonderenEslesmesi || kesinKalipEslesmesi || botAdresiVeAlmanca || puan >= SPAM_AYARLARI.ESIK_DEGER) {
      yakalananSayisi++;

      // Yürütme günlüğünde hangi kuralın çalıştığını göstermek için sebep belirle
      let sebep = "Kelime Puanı (" + puan + ")";
      if (uzantiEslesmesi) sebep = "Engelli Uzantı (.biz vb.)";
      else if (gonderenEslesmesi) sebep = "Engelli Gönderen";
      else if (kesinKalipEslesmesi) sebep = "Kesin Spam Kalıbı";
      else if (botAdresiVeAlmanca) sebep = "Bot Adresi + Almanca";

      islemUygula(zincir, testEtiketi, baslik, temizEposta, sebep);
    }
  }

  // Tarama bittiğinde genel özeti ekrana yazdır
  console.info(
    "Tarama tamamlandı! İncelenen: " + zincirler.length +
    " | Yakalanan Spam: " + yakalananSayisi +
    " | Temiz/Normal: " + (zincirler.length - yakalananSayisi)
  );
}

// ==================== 3. BÖLÜM: YARDIMCI FONKSİYONLAR ====================

/**
 * 'Ad Soyad <ornek@domain.com>' biçimindeki metinden sadece 'ornek@domain.com' adresini ayıklar.
 */
function epostaAdresiniCikar(fromBasligi) {
  const eslesme = fromBasligi.match(/<([^>]+)>/);
  return (eslesme ? eslesme[1] : fromBasligi).trim();
}

/**
 * Gönderen domainin bilinen gizlilik/alias servislerinden biri olup olmadığını kontrol eder.
 */
function gizlilikServisiMi(epostaAdresi) {
  const parcalar = epostaAdresi.split("@");
  if (parcalar.length !== 2) return false;

  const domain = parcalar[1].toLowerCase();
  return SPAM_AYARLARI.GIZLILIK_SERVISI_DOMAINLERI.some(servis =>
    domain === servis.toLowerCase() || domain.endsWith("." + servis.toLowerCase())
  );
}

/**
 * E-posta adresinin sonunun ENGELLI_UZANTILAR listesindeki bir uzantıyla bitip bitmediğini kontrol eder.
 */
function engelliUzantiMi(epostaAdresi) {
  return SPAM_AYARLARI.ENGELLI_UZANTILAR.some(uzanti =>
    epostaAdresi.endsWith(uzanti.toLowerCase())
  );
}

/**
 * Gönderenin '@' öncesi kısmının botlar tarafından üretilmiş rastgele bir kod olup olmadığını kontrol eder.
 */
function rastgeleBotAdresiMi(epostaAdresi) {
  const parcalar = epostaAdresi.split("@");
  if (parcalar.length !== 2) return false;

  const kullaniciAdi = parcalar[0];
  const botRegEx = /^(?=.*[a-z])(?=.*\d)[a-z0-9]{14,}$/;
  return botRegEx.test(kullaniciAdi);
}

/**
 * Bir metnin içinde verilen listedeki ifadelerden herhangi birinin geçip geçmediğini kontrol eder.
 */
function listedeVarMi(metin, liste) {
  return liste.some(ifade => metin.includes(ifade.toLowerCase()));
}

/**
 * Genel Almanca kelime listesindeki kelimeleri tam kelime eşleşmesiyle sayar.
 */
function almancaPuanHesapla(metin) {
  let puan = 0;
  const kelimeler = SPAM_AYARLARI.ALMANCA_KELIMELER;
  for (let j = 0; j < kelimeler.length; j++) {
    const kelime = kelimeler[j].toLowerCase();
    const regex = new RegExp("(^|[\\s.,!?;:()\"'\\-])" + kelime + "($|[\\s.,!?;:()\"'\\-])", "i");
    if (regex.test(metin)) {
      puan++;
    }
  }
  return puan;
}

/**
 * Seçilen ISLEM_TURU ayarına göre e-postayı Çöp Kutusu'na taşır veya etiketler.
 */
function islemUygula(zincir, testEtiketi, baslik, temizEposta, sebep) {
  if (SPAM_AYARLARI.ISLEM_TURU === "COP") {
    zincir.moveToTrash();
    console.log("🗑️ Çöpe taşındı [" + sebep + "] -> Gönderen: " + temizEposta + " | Konu: " + baslik);
  } else if (SPAM_AYARLARI.ISLEM_TURU === "ETIKET") {
    zincir.addLabel(testEtiketi);
    console.log("🏷️ Etiketlendi [" + sebep + "] -> Gönderen: " + temizEposta + " | Konu: " + baslik);
  }
}
