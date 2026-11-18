/**
 * Gmail Almanca Dating Spam Engelleyici (v4)
 * - Gelen Kutusu ve Spam klasörünü tarar.
 * - SimpleLogin, Proton ve Apple Hide My Email gibi gizlilik servislerini
 *   rastgele adres filtresinden muaf tutarak yanlış alarmları önler.
 * - Kalıcı silme yapmaz; yakalananları güvenli şekilde Çöp Kutusu'na taşır.
 */

// ==================== AYARLAR ====================

// 1. Gizlilik / Alias Servisleri (Rastgele bot adresi kuralından muaf tutulurlar)
// Bu domainlerden gelen gerçek mailler karmaşık adresleri yüzünden yanlışlıkla yakalanmaz.
const GIZLILIK_SERVISI_DOMAINLERI = [
  "simplelogin.co",
  "simplelogin.com",
  "simplelogin.fr",
  "aleeas.com",
  "passmail.net",
  "passinbox.com",
  "privaterelay.appleid.com",
  "icloud.com"
];

// 2. Doğrudan engellenecek alan adı uzantıları
const ENGELLI_UZANTILAR = [
  ".biz"
];

// 3. Kesin Spam Kalıpları (Başlıkta veya içerikte sadece biri geçerse yakalanır)
const KESIN_SPAM_KALIPLARI = [
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
];

// 4. Engelli Gönderen Adları veya Özel Domain Parçaları
const ENGELLI_GONDERENLER = [
  "new match",
  "meetic",
  "online now",
  "loveciaty",
  "profinderlclubpartner",
  "osmartflirtoneconnect"
];

// 5. Genel Almanca Kelime Havuzu (Puanlama sistemi için)
const ALMANCA_KELIMELER = [
  "sehr geehrte", "herzlichen glückwunsch", "gewinn", "konto", "bestätigen",
  "klicken sie", "zahlung", "rechnung", "dringend", "verifizierung",
  "kostenlos", "jetzt", "deiner nähe", "bereit", "schau", "chatten", "heißes"
];

// 6. Asla dokunulmayacak tamamen güvenli adresler (Tüm kuralları atlar)
const GUVENLI_GONDERENLER = [
  // "guvenli@ornek.com"
];

// 7. Genel Almanca kelime havuzu için eşik puanı
const ESIK_DEGER = 2;

// 8. Yakalanan e-postaya uygulanacak işlem:
// "COP"    -> Çöp kutusuna taşır (30 gün boyunca geri alınabilir, güvenli)
// "ETIKET" -> Taşımaz, sadece "Almanca-Spam-Test" etiketi ekler
const ISLEM_TURU = "COP";

// =================================================

function almancaSpamEngelle() {
  const aramaSorgusu = "(in:inbox OR in:spam) newer_than:2d";
  const zincirler = GmailApp.search(aramaSorgusu, 0, 50);

  let testEtiketi = null;
  if (ISLEM_TURU === "ETIKET") {
    testEtiketi = GmailApp.getUserLabelByName("Almanca-Spam-Test") ||
                  GmailApp.createLabel("Almanca-Spam-Test");
  }

  for (let i = 0; i < zincirler.length; i++) {
    const zincir = zincirler[i];
    const mesajlar = zincir.getMessages();
    const sonMesaj = mesajlar[mesajlar.length - 1];

    const hamGonderen = (sonMesaj.getFrom() || "").toLowerCase();
    const temizEposta = epostaAdresiniCikar(hamGonderen);

    // 0. Katman: Tamamen güvenli listedeyse tüm kontrolleri atla
    if (listedeVarMi(hamGonderen, GUVENLI_GONDERENLER)) {
      continue;
    }

    const baslik = sonMesaj.getSubject() || "";
    const icerik = sonMesaj.getPlainBody() || "";
    const tamMetin = (baslik + " " + icerik).toLowerCase();

    // Kontrol Katmanları
    const uzantiEslesmesi = engelliUzantiMi(temizEposta);
    const gonderenEslesmesi = listedeVarMi(hamGonderen, ENGELLI_GONDERENLER);
    const kesinKalipEslesmesi = listedeVarMi(tamMetin, KESIN_SPAM_KALIPLARI);
    const puan = almancaPuanHesapla(tamMetin);

    // Eğer gönderen bir gizlilik/alias servisi DEĞİLSE rastgele bot adresi kontrolünü çalıştır
    const gizlilikServisi = gizlilikServisiMi(temizEposta);
    const botAdresiVeAlmanca = !gizlilikServisi && rastgeleBotAdresiMi(temizEposta) && puan >= 1;

    if (uzantiEslesmesi || gonderenEslesmesi || kesinKalipEslesmesi || botAdresiVeAlmanca || puan >= ESIK_DEGER) {
      islemUygula(zincir, testEtiketi, baslik, temizEposta);
    }
  }
}

/**
 * 'Ad Soyad <ornek@domain.com>' metninden saf e-posta adresini ayıklar.
 */
function epostaAdresiniCikar(fromBasligi) {
  const eslesme = fromBasligi.match(/<([^>]+)>/);
  return (eslesme ? eslesme[1] : fromBasligi).trim();
}

/**
 * E-posta adresinin alan adının bilinen gizlilik/alias servislerinden biri olup olmadığını kontrol eder.
 */
function gizlilikServisiMi(epostaAdresi) {
  const parcalar = epostaAdresi.split("@");
  if (parcalar.length !== 2) return false;

  const domain = parcalar[1].toLowerCase();
  return GIZLILIK_SERVISI_DOMAINLERI.some(servis =>
    domain === servis.toLowerCase() || domain.endsWith("." + servis.toLowerCase())
  );
}

/**
 * E-posta adresinin sonunun ENGELLI_UZANTILAR listesindeki bir uzantıyla bitip bitmediğini kontrol eder.
 */
function engelliUzantiMi(epostaAdresi) {
  return ENGELLI_UZANTILAR.some(uzanti => epostaAdresi.endsWith(uzanti.toLowerCase()));
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
 * Metin içinde listedeki ifadelerden herhangi birinin geçip geçmediğini kontrol eder.
 */
function listedeVarMi(metin, liste) {
  return liste.some(ifade => metin.includes(ifade.toLowerCase()));
}

/**
 * Genel Almanca kelime listesindeki kelimeleri tam kelime eşleşmesiyle sayar.
 */
function almancaPuanHesapla(metin) {
  let puan = 0;
  for (let j = 0; j < ALMANCA_KELIMELER.length; j++) {
    const kelime = ALMANCA_KELIMELER[j].toLowerCase();
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
function islemUygula(zincir, testEtiketi, baslik, temizEposta) {
  if (ISLEM_TURU === "COP") {
    zincir.moveToTrash();
    Logger.log("Çöp kutusuna taşındı [" + temizEposta + "]: " + baslik);
  } else if (ISLEM_TURU === "ETIKET") {
    zincir.addLabel(testEtiketi);
    Logger.log("Test etiketi eklendi [" + temizEposta + "]: " + baslik);
  }
}
