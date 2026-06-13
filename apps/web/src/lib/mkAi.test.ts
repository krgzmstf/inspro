import { describe, it, expect } from "vitest";
import { mkAiRiskAnaliz, type RiskGirdi } from "./mkAi";
import type { Project } from "./projects";
import type { MuhasebeKayit } from "./muhasebe";
import type { IsKalemi } from "./isSurecleri";

function proje(extra?: Partial<Project>): Project {
  return {
    id: "p1", name: "Test", city: "Ankara", type: "konut", area: 1000, floors: 5,
    budget: 1_000_000, createdAt: "2026-01-01T00:00:00Z", phases: [], ...extra,
  };
}
function gider(tutar: number, tarih = "2026-06-01"): MuhasebeKayit {
  return { id: crypto.randomUUID(), projectId: "p1", tip: "gider", kategori: "Malzeme", aciklama: "", taraf: "", tutar, tarih, createdAt: tarih };
}
function is(ilerleme: number, bitis = "2027-01-01"): IsKalemi {
  return { id: crypto.randomUUID(), projectId: "p1", ad: "iş", grup: "Genel", sorumlu: "", baslangic: "2026-01-01", bitis, ilerleme };
}

describe("mk_ai EVM projeksiyonu", () => {
  it("EAC = AC / %tamam ve CPI = EV / AC doğru hesaplanır", () => {
    // %50 tamam, AC = 600.000, bütçe 1.000.000 → EAC = 1.200.000, CPI ≈ 0.833
    const g: RiskGirdi = {
      project: proje(),
      muhasebe: [gider(600_000)],
      saha: [],
      isKalemleri: [is(100), is(0)],
    };
    const r = mkAiRiskAnaliz(g);
    expect(r.projeksiyon.yuzdeTamam).toBe(50);
    expect(Math.round(r.projeksiyon.nihaiMaliyet!)).toBe(1_200_000);
    expect(r.projeksiyon.cpi!).toBeCloseTo(0.833, 2);
    expect(Math.round(r.projeksiyon.butceAsimYuzde!)).toBe(20);
  });

  it("tahmini bütçe aşımında yüksek seviye maliyet faktörü üretir", () => {
    const g: RiskGirdi = {
      project: proje(),
      muhasebe: [gider(600_000)],
      saha: [],
      isKalemleri: [is(100), is(0)],
    };
    const r = mkAiRiskAnaliz(g);
    const f = r.faktorler.find((x) => x.kategori === "maliyet");
    expect(f?.seviye).toBe("yuksek");
    expect(r.seviye).toBe("yuksek");
  });

  it("veri yoksa düşük skor döner", () => {
    const r = mkAiRiskAnaliz({ project: proje({ budget: null }), muhasebe: [], saha: [], isKalemleri: [] });
    // bütçe tanımsız faktörü 'orta' → skor 0 değil ama yüksek de değil
    expect(r.skor).toBeLessThan(60);
  });
});
