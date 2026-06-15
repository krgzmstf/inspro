/* ──────────────────────────────────────────────────────────
   mk_ai — Yönetmelik / Mevzuat bilgi tabanı (hafif RAG)

   Türk inşaat mevzuatından KAMUYA AÇIK, yaygın bilinen kuralların
   özet bilgi tabanı. mk_ai bir soruyu yanıtlamak için yönetmelik
   bilgisine ihtiyaç duyduğunda `yonetmelikAra` ile burada arar ve
   cevabını KAYNAK göstererek verir (agentic + RAG).

   Mimari ilke: "kaynak otorite, LLM yorumcu". Sayı/kural buradaki
   metinden gelir; LLM yalnızca yorumlar ve mutlaka teyidi önerir.

   ⚠️ Bu özetler bilgilendirme amaçlıdır; mevzuat değişebilir.
   Uygulamadan önce resmî güncel metin (mevzuat.gov.tr / ÇŞB)
   esas alınmalıdır. Telifli/ticari kaynaklardan metin alınmamıştır.

   Ağırlıksız, sıfır-bağımlılık retrieval: Türkçe-duyarlı token
   eşleştirme + etiket/başlık ağırlıklı skorlama. Vektör DB gerekmez
   (serverless dostu, az RAM).
   ────────────────────────────────────────────────────────── */

export interface YonetmelikKayit {
  id: string;
  baslik: string;
  /** Resmî dayanak (yönetmelik/standart adı). Citation için. */
  kaynak: string;
  /** Arama isabetini artıran anahtar kelimeler. */
  etiketler: string[];
  /** Özet bilgi metni. */
  metin: string;
}

export const YONETMELIK: YonetmelikKayit[] = [
  {
    id: "betonarme-beton-sinifi",
    baslik: "Betonarme yapılarda asgari beton sınıfı",
    kaynak: "TS 500 / TBDY 2018",
    etiketler: ["beton", "betonarme", "beton sınıfı", "c25", "dayanım", "mukavemet", "kolon", "kiriş", "perde"],
    metin:
      "Betonarme taşıyıcı sistemlerde genel olarak en düşük beton sınıfı C25/30'dur (deprem yönetmeliği kapsamındaki binalarda). " +
      "Donatı çeliği olarak nervürlü B420C/B500C kullanılır. Beton ve donatı sınıfı proje statik hesabına göre seçilir; " +
      "agresif çevre koşullarında daha yüksek sınıf gerekebilir.",
  },
  {
    id: "betonarme-paspayi",
    baslik: "Betonarme pas payı (donatı örtü kalınlığı)",
    kaynak: "TS 500",
    etiketler: ["pas payı", "paspayı", "örtü", "donatı", "korozyon", "beton örtü", "kolon", "temel", "kiriş"],
    metin:
      "Pas payı (beton örtü), donatıyı korozyon ve yangından korur ve çevre koşuluna bağlıdır. Yaygın asgari değerler: " +
      "kolon/kiriş gibi elemanlarda ~25 mm; toprağa/neme maruz yüzeylerde ve temellerde daha fazladır (temel altında ~50 mm mertebesi). " +
      "Kesin değer çevresel etki sınıfına ve proje detayına göre belirlenir.",
  },
  {
    id: "deprem-tbdy",
    baslik: "Deprem tasarımı esasları",
    kaynak: "TBDY 2018 (Türkiye Bina Deprem Yönetmeliği)",
    etiketler: ["deprem", "sismik", "tbdy", "zemin", "düzensizlik", "taşıyıcı sistem", "afad", "deprem yükü"],
    metin:
      "Yeni binalar TBDY 2018'e göre tasarlanır. Tasarım; deprem yer hareketi düzeyi, bina kullanım/önem sınıfı, taşıyıcı sistem " +
      "süneklik düzeyi ve zemin sınıfına göre yapılır. Planda/düşeyde düzensizliklerden kaçınılır, kısa kolon ve yumuşak kat " +
      "oluşturacak detaylardan kaçınılır. Zemin etüdü (geoteknik rapor) zorunludur.",
  },
  {
    id: "imar-cekme-mesafe",
    baslik: "Bahçe mesafeleri (yapı çekme mesafeleri)",
    kaynak: "Planlı Alanlar İmar Yönetmeliği",
    etiketler: ["çekme mesafesi", "bahçe mesafesi", "komşu", "yol", "parsel", "imar", "ön bahçe", "yan bahçe", "arka bahçe"],
    metin:
      "Yapı ile parsel sınırları arasında bırakılması gereken asgari mesafeler vardır: ön bahçe mesafesi genelde en az 5 m " +
      "(yola göre). Yan ve arka bahçe mesafeleri bina yüksekliğine bağlı olarak hesaplanır (yükseklik arttıkça artar). " +
      "Kesin mesafeler ilgili imar planı ve yönetmeliğin güncel maddelerine göre belirlenir.",
  },
  {
    id: "imar-kat-yuksekligi",
    baslik: "Kat yükseklikleri",
    kaynak: "Planlı Alanlar İmar Yönetmeliği",
    etiketler: ["kat yüksekliği", "tavan", "net yükseklik", "konut", "ticari", "zemin kat", "döşeme"],
    metin:
      "Kat yükseklikleri kullanıma göre belirlenir. Yaygın uygulamada konutlarda kat yüksekliği yaklaşık 2,80–3,00 m " +
      "(net oda yüksekliği genelde ≥ 2,40 m), ticari zemin katlarda daha yüksektir. Asma kat ve özel mekânlar için ayrı kurallar vardır.",
  },
  {
    id: "otopark",
    baslik: "Otopark (araç) ihtiyacı",
    kaynak: "Otopark Yönetmeliği",
    etiketler: ["otopark", "park", "araç", "garaj", "bağımsız bölüm", "daire", "ticari", "kapasite"],
    metin:
      "Yapıda oluşturulması gereken otopark sayısı kullanıma ve bağımsız bölüm büyüklüğüne göre belirlenir. Konutlarda yaygın " +
      "kural her bağımsız bölüm için en az 1 araçlık otopark; büyük dairelerde ve ticari kullanımda oran artar. Kesin sayı yerel " +
      "otopark yönetmeliği ve plan notlarına bağlıdır.",
  },
  {
    id: "yangin",
    baslik: "Yangından korunma (kaçış, merdiven)",
    kaynak: "Binaların Yangından Korunması Hakkında Yönetmelik (BYKHY)",
    etiketler: ["yangın", "kaçış", "yangın merdiveni", "duman", "yangın kapısı", "kompartıman", "söndürme", "tahliye", "acil çıkış"],
    metin:
      "Binalarda güvenli kaçış için kaçış yolları, kaçış mesafeleri ve yapı yüksekliğine göre korunumlu kaçış merdiveni gerekir. " +
      "Belirli yükseklik/kullanımların üzerindeki binalarda yangın merdiveni, yangın kapıları (belirli yangın dayanımında), duman " +
      "tahliyesi ve yağmurlama (sprinkler) sistemleri zorunlu olabilir. Kaçış kapıları kaçış yönüne açılır.",
  },
  {
    id: "asansor",
    baslik: "Asansör zorunluluğu",
    kaynak: "Asansör Yönetmeliği / Planlı Alanlar İmar Yönetmeliği",
    etiketler: ["asansör", "kat sayısı", "engelli asansörü", "sedye", "kabin", "bina yüksekliği"],
    metin:
      "Belirli kat sayısının üzerindeki binalarda asansör zorunludur (yaygın eşik: zemin dahil belirli kat sayısından sonra). " +
      "Erişilebilirlik ve sedye taşınabilirliği için kabin ölçüsü ve sayısı kurallara tabidir. Yüksek binalarda birden fazla asansör " +
      "ve acil durum asansörü gerekebilir.",
  },
  {
    id: "erisilebilirlik",
    baslik: "Engelli erişilebilirliği",
    kaynak: "TS 9111 / İmar Yönetmeliği erişilebilirlik hükümleri",
    etiketler: ["engelli", "erişilebilirlik", "rampa", "eğim", "kapı genişliği", "tuvalet", "ts 9111", "tekerlekli sandalye"],
    metin:
      "Yapılar engelli erişimine uygun tasarlanır: rampaların azami eğimi sınırlıdır (yaklaşık %8 ve altı tercih edilir), " +
      "geçiş/kapı net genişlikleri tekerlekli sandalyeye uygun olmalı, erişilebilir tuvalet ve asansör sağlanmalıdır. Detaylar TS 9111'de tanımlıdır.",
  },
  {
    id: "enerji-bep",
    baslik: "Enerji kimlik belgesi ve yalıtım",
    kaynak: "Binalarda Enerji Performansı Yönetmeliği (BEP) / TS 825",
    etiketler: ["enerji", "yalıtım", "ısı yalıtımı", "enerji kimlik belgesi", "ekb", "bep", "ts 825", "mantolama"],
    metin:
      "Yeni binalar için Enerji Kimlik Belgesi (EKB) düzenlenir; asgari enerji performansı sınıfı şartı vardır. Isı yalıtımı " +
      "hesabı TS 825'e göre yapılır ve binanın bulunduğu derece-gün bölgesine bağlıdır. Mantolama, çatı/döşeme yalıtımı ve yalıtımlı " +
      "doğramalar enerji sınıfını doğrudan etkiler.",
  },
  {
    id: "isg-yapi-isleri",
    baslik: "İş sağlığı ve güvenliği (şantiye)",
    kaynak: "6331 sayılı İSG Kanunu / Yapı İşlerinde İSG Yönetmeliği",
    etiketler: ["isg", "iş güvenliği", "şantiye", "iskele", "düşme", "baret", "emniyet kemeri", "sağlık güvenlik planı", "kaza"],
    metin:
      "Şantiyelerde işveren İSG önlemlerini almakla yükümlüdür: Sağlık ve Güvenlik Planı, yüksekte çalışmada düşmeye karşı koruma " +
      "(korkuluk/emniyet kemeri/yaşam hattı), uygun ve denetimli iskele, kişisel koruyucu donanım (baret, ayakkabı), elektrik ve " +
      "kazı güvenliği zorunludur. İş kazaları yasal süresinde SGK'ya bildirilir.",
  },
  {
    id: "yapi-denetim",
    baslik: "Yapı denetimi ve ruhsat süreci",
    kaynak: "4708 sayılı Yapı Denetimi Kanunu / İmar Kanunu",
    etiketler: ["yapı denetim", "ruhsat", "iskan", "yapı kullanma izni", "fenni mesul", "denetim", "imar kanunu"],
    metin:
      "Yapılar onaylı projeye ve yapı ruhsatına göre inşa edilir; kapsamdaki yapılar yapı denetim kuruluşunca denetlenir. İmalat " +
      "aşamaları (temel, beton döküm vb.) denetim tutanaklarıyla belgelenir. İnşaat tamamlanınca yapı kullanma izni (iskân) alınır; " +
      "izinsiz/projeye aykırı imalat yasal yaptırıma tabidir.",
  },
];

/* ── Türkçe-duyarlı normalizasyon ── */
function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/[çğöşü]/g, (c) => ({ ç: "c", ğ: "g", ö: "o", ş: "s", ü: "u" }[c] ?? c))
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenlar(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t.length >= 2);
}

export interface YonetmelikIsabet extends YonetmelikKayit {
  skor: number;
}

/**
 * Bilgi tabanında arama yapar (hafif RAG). Sorgu token'larını
 * etiket (ağırlık 3) > başlık (2) > metin (1) alanlarında eşler,
 * skora göre sıralayıp en iyi `adet` kaydı döner.
 */
export function yonetmelikAra(
  sorgu: string,
  adet = 4,
  ekKayitlar: YonetmelikKayit[] = [],
): YonetmelikIsabet[] {
  const qs = tokenlar(sorgu);
  if (qs.length === 0) return [];

  const corpus = ekKayitlar.length ? [...YONETMELIK, ...ekKayitlar] : YONETMELIK;
  const isabetler: YonetmelikIsabet[] = corpus.map((k) => {
    const etiketMetni = normalize(k.etiketler.join(" "));
    const baslikMetni = normalize(k.baslik);
    const govdeMetni = normalize(k.metin);
    let skor = 0;
    for (const q of qs) {
      if (etiketMetni.includes(q)) skor += 3;
      if (baslikMetni.includes(q)) skor += 2;
      if (govdeMetni.includes(q)) skor += 1;
    }
    return { ...k, skor };
  })
    .filter((k) => k.skor > 0)
    .sort((a, b) => b.skor - a.skor);

  return isabetler.slice(0, adet);
}
