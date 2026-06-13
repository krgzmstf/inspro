"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  type Segment, type Nokta, type Bounds,
  parseDxfSegments, polylinesToSegments, boundsOf, segUzunluk,
} from "@/lib/plan3d";

type Kaynak = "raster" | "dxf" | null;
type Anim = "yok" | "donme" | "insa" | "yuruyus";

export default function Plan3DPage() {
  // kaynak
  const [kaynak, setKaynak] = useState<Kaynak>(null);
  const [dosyaAd, setDosyaAd] = useState("");
  const [imgUrl, setImgUrl] = useState<string>("");        // raster arka plan
  const [srcW, setSrcW] = useState(1000);
  const [srcH, setSrcH] = useState(700);
  const [dxfSegments, setDxfSegments] = useState<Segment[]>([]);
  const [dxfBounds, setDxfBounds] = useState<Bounds | null>(null);
  const [hata, setHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  // çizim
  const [mod, setMod] = useState<"ciz" | "olcek">("ciz");
  const [polylines, setPolylines] = useState<Nokta[][]>([]);
  const [aktif, setAktif] = useState<Nokta[]>([]);
  const [olcekP, setOlcekP] = useState<Nokta[]>([]);
  const [metrePerPiksel, setMetrePerPiksel] = useState(0.02); // raster
  const [dxfBirimMetre, setDxfBirimMetre] = useState(1);      // dxf birim → m

  // 3B parametre
  const [duvarYuksek, setDuvarYuksek] = useState(2.8);
  const [duvarKalin, setDuvarKalin] = useState(0.2);
  const [anim, setAnim] = useState<Anim>("donme");
  const [kayit, setKayit] = useState(false);

  // raster otomatik tanıma
  const [rasterMod, setRasterMod] = useState<"oto" | "ciz">("oto");
  const [esik, setEsik] = useState(110);           // duvar hassasiyeti (luminance eşiği)
  const [gridEn, setGridEn] = useState(140);        // çözünürlük (yatay hücre)
  const [planGenislikM, setPlanGenislikM] = useState(20); // planın gerçek genişliği (m)

  const ref2d = useRef<HTMLCanvasElement>(null);
  const mount3d = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // three.js kalıcı nesneler
  const three = useRef<{
    scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer;
    controls: OrbitControls; wallGroup: THREE.Group; modelBoyut: number; merkez: THREE.Vector3;
  } | null>(null);
  const animRef = useRef<Anim>(anim);
  animRef.current = anim;
  const insaT = useRef(0);

  /* ───────── Dosya yükleme ───────── */
  const dosyaSec = async (file: File) => {
    setHata(""); setYukleniyor(true);
    setPolylines([]); setAktif([]); setOlcekP([]);
    setDosyaAd(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    try {
      if (ext === "dxf") {
        const text = await file.text();
        const { segments, bounds } = parseDxfSegments(text);
        if (segments.length === 0) throw new Error("DXF içinde çizgi/polyline bulunamadı.");
        setKaynak("dxf"); setDxfSegments(segments); setDxfBounds(bounds);
        setSrcW(bounds.maxX - bounds.minX || 1000); setSrcH(bounds.maxY - bounds.minY || 700);
        setImgUrl("");
      } else if (ext === "dwg") {
        throw new Error("DWG tarayıcıda doğrudan okunamaz. Lütfen CAD programından DXF olarak kaydedip yükleyin (ya da JPEG/PNG ekran görüntüsü).");
      } else if (ext === "pdf") {
        const url = await pdfIlkSayfa(file);
        await rasterYukle(url);
      } else if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext)) {
        const url = await dosyaDataUrl(file);
        await rasterYukle(url);
      } else {
        throw new Error("Desteklenmeyen biçim. PDF, DXF, JPEG/PNG yükleyin.");
      }
    } catch (e) {
      setHata((e as Error).message); setKaynak(null);
    } finally {
      setYukleniyor(false);
    }
  };

  const rasterYukle = (url: string) =>
    new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imgRef.current = img;
        setSrcW(img.naturalWidth); setSrcH(img.naturalHeight);
        setImgUrl(url); setKaynak("raster"); setDxfSegments([]); setDxfBounds(null);
        resolve();
      };
      img.onerror = () => reject(new Error("Görsel yüklenemedi."));
      img.src = url;
    });

  /* ───────── 2B canvas çizimi ───────── */
  const ciz2d = useCallback(() => {
    const cv = ref2d.current;
    if (!cv) return;
    const enboy = srcH / srcW;
    const W = Math.min(560, srcW);
    const H = W * enboy;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d")!;
    const sx = W / srcW;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f1f5f9"; ctx.fillRect(0, 0, W, H);

    if (kaynak === "raster" && imgRef.current) {
      ctx.drawImage(imgRef.current, 0, 0, W, H);
    } else if (kaynak === "dxf" && dxfBounds) {
      ctx.strokeStyle = "#1f2937"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const s of dxfSegments) {
        ctx.moveTo((s.x1 - dxfBounds.minX) * sx, H - (s.y1 - dxfBounds.minY) * sx);
        ctx.lineTo((s.x2 - dxfBounds.minX) * sx, H - (s.y2 - dxfBounds.minY) * sx);
      }
      ctx.stroke();
    }

    // çizilen polilinler (kaynak koordinat → ekran)
    const toScr = (p: Nokta) => ({ x: p.x * sx, y: p.y * sx });
    ctx.lineWidth = 3; ctx.strokeStyle = "#2a9fbf";
    for (const pl of polylines) cizPl(ctx, pl.map(toScr));
    ctx.strokeStyle = "#f5b80b";
    if (aktif.length) {
      cizPl(ctx, aktif.map(toScr));
      for (const p of aktif.map(toScr)) { ctx.fillStyle = "#f5b80b"; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); }
    }
    // ölçek çizgisi
    if (olcekP.length) {
      ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 2;
      cizPl(ctx, olcekP.map(toScr));
      for (const p of olcekP.map(toScr)) { ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); }
    }
  }, [kaynak, srcW, srcH, dxfSegments, dxfBounds, polylines, aktif, olcekP]);

  useEffect(() => { ciz2d(); }, [ciz2d]);

  function cizPl(ctx: CanvasRenderingContext2D, pts: Nokta[]) {
    if (pts.length < 1) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }

  const canvasTikla = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (kaynak === "dxf") return;                  // DXF zaten vektör
    if (kaynak === "raster" && rasterMod === "oto") return; // otomatik modda çizim yok
    const cv = ref2d.current!;
    const rect = cv.getBoundingClientRect();
    const p: Nokta = {
      x: ((e.clientX - rect.left) / rect.width) * srcW,
      y: ((e.clientY - rect.top) / rect.height) * srcH,
    };
    if (mod === "olcek") {
      setOlcekP((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
    } else {
      setAktif((prev) => [...prev, p]);
    }
  };
  const polyBitir = () => { if (aktif.length >= 2) setPolylines((p) => [...p, aktif]); setAktif([]); };

  const olcekUygula = () => {
    if (olcekP.length < 2) { setHata("Önce ölçek için iki nokta işaretleyin."); return; }
    const piks = Math.hypot(olcekP[1].x - olcekP[0].x, olcekP[1].y - olcekP[0].y);
    const m = prompt("Bu çizginin gerçek uzunluğu kaç metre?", "5");
    const metre = parseFloat(m || "");
    if (!metre || metre <= 0 || !piks) { setHata("Geçersiz uzunluk."); return; }
    setMetrePerPiksel(metre / piks);
    setHata(""); setMod("ciz");
  };

  /* ───────── 3B init (bir kez) ───────── */
  useEffect(() => {
    const mount = mount3d.current;
    if (!mount) return;
    const W = mount.clientWidth, H = mount.clientHeight || 460;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eaf0f5");
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.05, 5000);
    camera.position.set(20, 18, 20);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(W, H); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI / 2 - 0.01;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.05);
    dir.position.set(30, 50, 20); dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024); scene.add(dir);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.4));

    const wallGroup = new THREE.Group();
    scene.add(wallGroup);
    three.current = { scene, camera, renderer, controls, wallGroup, modelBoyut: 20, merkez: new THREE.Vector3() };

    let raf = 0; let t = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      t += 0.016;
      const T = three.current!;
      const m = animRef.current;
      // inşa animasyonu
      const duvarlar = T.wallGroup.children.filter((c) => c.userData.duvar);
      if (m === "insa") {
        insaT.current = Math.min(1, insaT.current + 0.006);
        const n = duvarlar.length;
        duvarlar.forEach((c, i) => {
          const start = (i / Math.max(1, n)) * 0.6;
          const p = Math.max(0, Math.min(1, (insaT.current - start) / 0.4));
          c.scale.y = p;
        });
      } else {
        duvarlar.forEach((c) => (c.scale.y = 1));
      }
      // kamera animasyonu
      if (m === "donme") {
        const r = T.modelBoyut * 1.1;
        T.camera.position.set(Math.cos(t * 0.3) * r, T.modelBoyut * 0.7, Math.sin(t * 0.3) * r);
        T.camera.lookAt(0, T.modelBoyut * 0.12, 0);
      } else if (m === "yuruyus") {
        const r = T.modelBoyut * 0.32;
        T.camera.position.set(Math.cos(t * 0.4) * r, 1.6, Math.sin(t * 0.4) * r);
        T.camera.lookAt(Math.cos(t * 0.4 + 0.5) * r * 0.3, 1.5, Math.sin(t * 0.4 + 0.5) * r * 0.3);
      } else {
        T.controls.update();
      }
      T.renderer.render(T.scene, T.camera);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight || 460;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      controls.dispose(); renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      three.current = null;
    };
  }, []);

  /* ───────── Otomatik: görüntüden duvar tanıma ───────── */
  const olusturOtomatik = () => {
    const T = three.current, img = imgRef.current;
    if (!T || !img) return;
    setHata("");
    const aspect = img.naturalHeight / img.naturalWidth;
    const gw = Math.max(20, Math.min(220, Math.round(gridEn)));
    const gh = Math.max(10, Math.round(gw * aspect));

    const oc = document.createElement("canvas");
    oc.width = gw; oc.height = gh;
    const octx = oc.getContext("2d", { willReadFrequently: true })!;
    octx.drawImage(img, 0, 0, gw, gh);
    const data = octx.getImageData(0, 0, gw, gh).data;

    // koyu pikseller = duvar
    const wall = new Uint8Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) {
      const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
      wall[i] = lum < esik ? 1 : 0;
    }
    // gürültü temizliği: 2'den az duvar komşusu olan hücreleri at (yazı/ölçü çizgileri)
    const wall2 = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const idx = y * gw + x;
      if (!wall[idx]) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < gw && ny >= 0 && ny < gh && wall[ny * gw + nx]) n++;
      }
      wall2[idx] = n >= 2 ? 1 : 0;
    }

    const planW = planGenislikM > 0 ? planGenislikM : 20;
    const cell = planW / gw;
    const planD = cell * gh;

    while (T.wallGroup.children.length) {
      const c = T.wallGroup.children.pop() as THREE.Mesh;
      c.geometry.dispose(); (c.material as THREE.Material).dispose?.();
    }

    // dokulu zemin (orijinal plan)
    const tex = new THREE.TextureLoader().load(imgUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(planW, planD),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    T.wallGroup.add(floor);

    let count = 0;
    for (let i = 0; i < gw * gh; i++) if (wall2[i]) count++;
    if (count === 0) {
      setHata("Otomatik duvar bulunamadı — 'Duvar hassasiyeti' eşiğini artırın veya elle çizime geçin.");
    } else {
      const geo = new THREE.BoxGeometry(cell * 1.02, duvarYuksek, cell * 1.02);
      geo.translate(0, duvarYuksek / 2, 0);
      const mat = new THREE.MeshStandardMaterial({ color: 0xb9c3cc, roughness: 0.85 });
      const inst = new THREE.InstancedMesh(geo, mat, count);
      inst.castShadow = true; inst.userData.duvar = true;
      const d = new THREE.Object3D();
      let k = 0;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        if (!wall2[y * gw + x]) continue;
        d.position.set((x + 0.5) * cell - planW / 2, 0, (y + 0.5) * cell - planD / 2);
        d.updateMatrix();
        inst.setMatrixAt(k++, d.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      T.wallGroup.add(inst);
    }

    T.modelBoyut = Math.max(planW, planD, 4);
    insaT.current = anim === "insa" ? 0 : 1;
    T.camera.position.set(T.modelBoyut, T.modelBoyut * 0.8, T.modelBoyut);
    T.controls.target.set(0, duvarYuksek / 2, 0);
    T.controls.update();
  };

  /* ───────── 3B model oluştur (DXF / elle çizim) ───────── */
  const olustur3D = () => {
    const T = three.current; if (!T) return;
    if (kaynak === "raster" && rasterMod === "oto") { olusturOtomatik(); return; }
    const segs: Segment[] = kaynak === "dxf" ? dxfSegments : polylinesToSegments(polylines);
    if (segs.length === 0) { setHata("Önce DXF yükleyin ya da raster üzerine duvar çizin."); return; }
    setHata("");

    const olcek = kaynak === "dxf" ? dxfBirimMetre : metrePerPiksel;
    const b = boundsOf(segs);
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    // plan(x,y) → dünya(x, -y) metre, merkezlenmiş
    const W2 = (x: number) => (x - cx) * olcek;
    const Z2 = (y: number) => -(y - cy) * olcek;

    // eski içerik temizle
    while (T.wallGroup.children.length) {
      const c = T.wallGroup.children.pop() as THREE.Mesh;
      c.geometry.dispose(); (c.material as THREE.Material).dispose?.();
    }

    const enX = (b.maxX - b.minX) * olcek;
    const enZ = (b.maxY - b.minY) * olcek;
    const modelBoyut = Math.max(enX, enZ, 4);

    // zemin (raster ise dokulu)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ec, roughness: 1 });
    if (kaynak === "raster" && imgUrl) {
      const tex = new THREE.TextureLoader().load(imgUrl);
      tex.colorSpace = THREE.SRGBColorSpace;
      floorMat.map = tex; floorMat.color.set(0xffffff); floorMat.needsUpdate = true;
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(enX || 4, enZ || 4), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    T.wallGroup.add(floor);

    // duvarlar
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xb9c3cc, roughness: 0.8 });
    for (const s of segs) {
      const x1 = W2(s.x1), z1 = Z2(s.y1), x2 = W2(s.x2), z2 = Z2(s.y2);
      const len = Math.hypot(x2 - x1, z2 - z1);
      if (len < 0.01) continue;
      const geo = new THREE.BoxGeometry(len, duvarYuksek, duvarKalin);
      geo.translate(0, duvarYuksek / 2, 0); // taban y=0
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2);
      mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      mesh.castShadow = true;
      mesh.userData.duvar = true;
      T.wallGroup.add(mesh);
    }

    T.modelBoyut = modelBoyut;
    insaT.current = anim === "insa" ? 0 : 1;
    // kamerayı çerçevele
    T.camera.position.set(modelBoyut, modelBoyut * 0.8, modelBoyut);
    T.controls.target.set(0, duvarYuksek / 2, 0);
    T.controls.update();
  };

  // Plan yüklenince OTOMATİK 3B'ye çevir (raster oto / DXF)
  const buildRef = useRef(olustur3D);
  buildRef.current = olustur3D;
  useEffect(() => {
    const hazir = (kaynak === "raster" && imgUrl) || (kaynak === "dxf" && dxfSegments.length > 0);
    if (!hazir) return;
    const id = setTimeout(() => buildRef.current(), 150);
    return () => clearTimeout(id);
  }, [imgUrl, dxfSegments, kaynak]);

  /* ───────── Video kayıt (WebM) ───────── */
  const videoKaydet = () => {
    const T = three.current; if (!T) return;
    if (!("captureStream" in T.renderer.domElement)) { setHata("Tarayıcı video kaydını desteklemiyor."); return; }
    if (anim === "insa") insaT.current = 0;
    const stream = (T.renderer.domElement as HTMLCanvasElement).captureStream(30);
    const tipler = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mime = tipler.find((t) => MediaRecorder.isTypeSupported(t)) ?? "video/webm";
    const rec = new MediaRecorder(stream, { mimeType: mime });
    const parcalar: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && parcalar.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(parcalar, { type: "video/webm" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `plan3d-${anim}-${Date.now()}.webm`;
      a.click(); URL.revokeObjectURL(a.href);
      setKayit(false);
    };
    rec.start(); setKayit(true);
    setTimeout(() => rec.stop(), 8000);
  };

  const segSayi = kaynak === "dxf" ? dxfSegments.length : polylinesToSegments(polylines).length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-slate-900">
            🧊 Plan → 3B Stüdyo <span className="rounded-lg bg-ink-900 px-2 py-0.5 text-xs font-bold text-brand-500">BETA</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">PDF · DXF · JPEG/PNG planı 3B modele dönüştür, animasyon üret, video kaydet.</p>
        </div>
        <label className="cursor-pointer rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
          {yukleniyor ? "Yükleniyor…" : "📂 Plan Yükle"}
          <input type="file" accept=".pdf,.dxf,.dwg,.jpg,.jpeg,.png,.webp,.bmp,.gif" className="hidden"
            onChange={(e) => e.target.files?.[0] && dosyaSec(e.target.files[0])} />
        </label>
      </div>

      {hata && <div className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{hata}</div>}

      {!kaynak ? (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl">🧊</div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Bir 2B plan yükleyin</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            <b>DXF</b> dosyaları doğrudan vektör olarak 3B'ye çıkar. <b>PDF / JPEG / PNG</b> planlarda
            duvarları fareyle çizip extrude edersiniz. (DWG → CAD'den DXF olarak kaydedin.)
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* SOL: 2B + çizim */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-semibold text-slate-700">📄 {dosyaAd}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{kaynak.toUpperCase()} · {segSayi} segment</span>
            </div>
            <canvas ref={ref2d} onClick={canvasTikla} onDoubleClick={polyBitir}
              className="w-full cursor-crosshair rounded-xl border border-slate-200 bg-slate-100 shadow-sm" />

            {kaynak === "raster" && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                <div className="flex gap-2">
                  <button onClick={() => setRasterMod("oto")} className={btn(rasterMod === "oto")}>⚡ Otomatik tanı</button>
                  <button onClick={() => setRasterMod("ciz")} className={btn(rasterMod === "ciz")}>✏️ Elle çiz</button>
                </div>

                {rasterMod === "oto" ? (
                  <div className="mt-3 space-y-2.5">
                    <Kaydir label={`Duvar hassasiyeti (eşik ${esik})`} min={40} max={220} value={esik} onChange={setEsik} />
                    <Kaydir label={`Çözünürlük (${gridEn})`} min={60} max={220} step={10} value={gridEn} onChange={setGridEn} />
                    <label className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-600">Planın gerçek genişliği (m)</span>
                      <input type="number" step="0.5" value={planGenislikM} onChange={(e) => setPlanGenislikM(parseFloat(e.target.value) || 20)}
                        className="w-24 rounded-lg border-2 border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" />
                    </label>
                    <button onClick={olusturOtomatik} className="w-full rounded-lg bg-ink-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-ink-800">⚡ Yeniden tanı</button>
                    <p className="text-[11px] text-slate-400">Planın koyu çizgileri otomatik duvar olur. Çok az/çok fazla duvar çıkıyorsa eşiği ayarlayın. Mobilya/yazı kalıyorsa çözünürlüğü düşürün.</p>
                  </div>
                ) : (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => setMod("ciz")} className={btn(mod === "ciz")}>✏️ Duvar çiz</button>
                      <button onClick={() => setMod("olcek")} className={btn(mod === "olcek")}>📐 Ölçek çizgisi</button>
                      <button onClick={polyBitir} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:border-brand-500">↵ Polilini bitir</button>
                      <button onClick={() => { setPolylines([]); setAktif([]); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:border-red-300 hover:text-red-500">🗑 Temizle</button>
                    </div>
                    {mod === "olcek" ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        İki nokta işaretle → <button onClick={olcekUygula} className="rounded bg-ink-900 px-2 py-1 font-bold text-white">uzunluğu gir</button>
                        <span className="ml-auto">1 px = {metrePerPiksel.toFixed(4)} m</span>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-400">Tıkla = nokta ekle · Çift tıkla = polilini bitir. Her duvar hattı için ayrı polilin çiz.</p>
                    )}
                  </>
                )}
              </div>
            )}
            {kaynak === "dxf" && (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm">
                <label className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">DXF birim → metre</span>
                  <input type="number" step="0.001" value={dxfBirimMetre} onChange={(e) => setDxfBirimMetre(parseFloat(e.target.value) || 1)}
                    className="w-24 rounded-lg border-2 border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" />
                  <span className="text-xs text-slate-400">(mm çizimde 0.001, m çizimde 1)</span>
                </label>
              </div>
            )}
          </div>

          {/* SAĞ: 3B + animasyon */}
          <div className="space-y-3">
            <div className="relative">
              <div ref={mount3d} className="h-[300px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm sm:h-[360px]" />
              {kayit && <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />REC</span>}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-semibold text-slate-600">Duvar yüksekliği (m)</span>
                  <input type="number" step="0.1" value={duvarYuksek} onChange={(e) => setDuvarYuksek(parseFloat(e.target.value) || 2.8)} className="mt-1 w-full rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500" /></label>
                <label className="block"><span className="text-xs font-semibold text-slate-600">Duvar kalınlığı (m)</span>
                  <input type="number" step="0.05" value={duvarKalin} onChange={(e) => setDuvarKalin(parseFloat(e.target.value) || 0.2)} className="mt-1 w-full rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500" /></label>
              </div>
              <button onClick={olustur3D} className="mt-3 w-full rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800">🧊 3B Oluştur / Güncelle</button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="text-xs font-extrabold uppercase text-slate-500">Animasyon</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {([["donme", "🔄 Döndür"], ["insa", "🏗️ İnşa"], ["yuruyus", "🚶 Yürüyüş"], ["yok", "✋ Serbest"]] as [Anim, string][]).map(([a, l]) => (
                  <button key={a} onClick={() => { setAnim(a); if (a === "insa") insaT.current = 0; }} className={btn(anim === a)}>{l}</button>
                ))}
              </div>
              <button onClick={videoKaydet} disabled={kayit}
                className="mt-3 w-full rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50">
                {kayit ? "● Kaydediliyor (8sn)…" : "🎬 Video Kaydet (WebM, 8sn)"}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-6 text-[11px] text-slate-400">
        Not: Bu stüdyo plandan yaklaşık bir kütle/duvar modeli üretir; mimari ölçü doğruluğu için ölçek çizgisini dikkatli ayarlayın. WebM videoyu MP4'e dönüştürmek için herhangi bir çevrimiçi/yerel dönüştürücü kullanılabilir.
      </p>
      <div className="mt-4 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}

function btn(aktif: boolean) {
  return `rounded-lg px-3 py-1.5 text-xs font-bold transition ${aktif ? "bg-brand-500 text-white" : "border border-slate-200 text-slate-600 hover:border-brand-500"}`;
}

function Kaydir({ label, min, max, step = 1, value, onChange }: {
  label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 w-full accent-brand-500" />
    </label>
  );
}

/* ───────── yardımcılar ───────── */
function dosyaDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Dosya okunamadı."));
    r.readAsDataURL(file);
  });
}

async function pdfIlkSayfa(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width; canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}
