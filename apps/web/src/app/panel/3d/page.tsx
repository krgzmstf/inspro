"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { type Project, loadProjects, getProject, FLOOR_USAGE_LABELS } from "@/lib/projects";
import { type Kat3D, binaKatlari, KULLANIM_RENK } from "@/lib/bina3d";

export default function Bina3DPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [secili, setSecili] = useState<Kat3D | null>(null);
  const [otoDon, setOtoDon] = useState(true);

  const mountRef = useRef<HTMLDivElement>(null);
  const otoDonRef = useRef(otoDon);
  otoDonRef.current = otoDon;
  const seçFnRef = useRef<(k: Kat3D | null) => void>(() => {});
  seçFnRef.current = setSecili;

  useEffect(() => {
    const ps = loadProjects();
    setProjects(ps);
    const id = new URLSearchParams(window.location.search).get("proje");
    setProjectId(id && ps.some((p) => p.id === id) ? id : (ps[0]?.id ?? ""));
  }, []);

  const proje = useMemo(() => (projectId ? getProject(projectId) : undefined), [projectId]);
  const katlar = useMemo(() => (proje ? binaKatlari(proje) : []), [proje]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || katlar.length === 0) return;
    setSecili(null);

    const W = mount.clientWidth;
    const H = mount.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#eef2f6");

    // model boyutu → kamera mesafesi
    const enBuyukW = Math.max(...katlar.map((k) => k.w));
    const ustY = Math.max(...katlar.map((k) => k.y + k.h));
    const altY = Math.min(...katlar.map((k) => k.y));
    const yuk = ustY - altY;
    const merkezY = (ustY + altY) / 2;
    const mesafe = Math.max(enBuyukW * 2.2, yuk * 1.8, 30);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 2000);
    camera.position.set(mesafe * 0.8, merkezY + yuk * 0.6 + 8, mesafe * 0.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, merkezY, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // zemin altına geçme
    controls.minDistance = 8;
    controls.maxDistance = mesafe * 4;

    // ışıklar
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const gunes = new THREE.DirectionalLight(0xffffff, 1.1);
    gunes.position.set(enBuyukW, yuk + 40, enBuyukW * 0.6);
    gunes.castShadow = true;
    gunes.shadow.mapSize.set(2048, 2048);
    const camS = gunes.shadow.camera as THREE.OrthographicCamera;
    const ext = enBuyukW * 2.5;
    camS.left = -ext; camS.right = ext; camS.top = ext; camS.bottom = -ext;
    camS.near = 1; camS.far = mesafe * 8;
    scene.add(gunes);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.4));

    // zemin + ızgara
    const zemin = new THREE.Mesh(
      new THREE.CircleGeometry(enBuyukW * 3, 64),
      new THREE.MeshStandardMaterial({ color: 0xdfe6ec, roughness: 1 }),
    );
    zemin.rotation.x = -Math.PI / 2;
    zemin.position.y = altY - 0.02;
    zemin.receiveShadow = true;
    scene.add(zemin);
    const grid = new THREE.GridHelper(enBuyukW * 6, 60, 0xb8c2cc, 0xd2dae1);
    grid.position.y = altY - 0.01;
    scene.add(grid);

    // katlar
    const meshler: THREE.Mesh[] = [];
    const katMap = new Map<THREE.Mesh, Kat3D>();
    for (const k of katlar) {
      const geo = new THREE.BoxGeometry(k.w, k.h * 0.94, k.d);
      const renk = new THREE.Color(KULLANIM_RENK[k.kullanim]);
      const mat = new THREE.MeshStandardMaterial({
        color: renk, roughness: 0.55, metalness: 0.05,
        transparent: k.bodrum, opacity: k.bodrum ? 0.55 : 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, k.y + (k.h * 0.94) / 2, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      // kenar çizgileri
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x1f2937, transparent: true, opacity: 0.25 }),
      );
      mesh.add(edges);
      meshler.push(mesh);
      katMap.set(mesh, k);
    }

    // tıklama / hover
    const ray = new THREE.Raycaster();
    const fare = new THREE.Vector2();
    let seciliMesh: THREE.Mesh | null = null;
    function vurgula(m: THREE.Mesh | null) {
      meshler.forEach((x) => {
        const mat = x.material as THREE.MeshStandardMaterial;
        mat.emissive.setHex(x === m ? 0xf5b80b : 0x000000);
        mat.emissiveIntensity = x === m ? 0.4 : 0;
      });
      seciliMesh = m;
    }
    function onClick(e: MouseEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      fare.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      fare.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(fare, camera);
      const hit = ray.intersectObjects(meshler, false)[0];
      if (hit) {
        const m = hit.object as THREE.Mesh;
        vurgula(m);
        seçFnRef.current(katMap.get(m) ?? null);
      } else {
        vurgula(null);
        seçFnRef.current(null);
      }
    }
    function onMove(e: MouseEvent) {
      const r = renderer.domElement.getBoundingClientRect();
      fare.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      fare.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(fare, camera);
      renderer.domElement.style.cursor = ray.intersectObjects(meshler, false).length ? "pointer" : "grab";
    }
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("mousemove", onMove);

    // animasyon
    let raf = 0;
    function tick() {
      raf = requestAnimationFrame(tick);
      if (otoDonRef.current && !seciliMesh) {
        const a = 0.0025;
        const c = Math.cos(a), s = Math.sin(a);
        const x = camera.position.x, z = camera.position.z;
        camera.position.x = x * c - z * s;
        camera.position.z = x * s + z * c;
      }
      controls.update();
      renderer.render(scene, camera);
    }
    tick();

    function onResize() {
      const w = mount!.clientWidth, h = mount!.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("mousemove", onMove);
      controls.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [katlar]);

  const ozet = useMemo(() => {
    const ust = katlar.filter((k) => !k.bodrum).length;
    const bod = katlar.filter((k) => k.bodrum).length;
    const daire = katlar.reduce((s, k) => s + k.daireSayisi, 0);
    return { ust, bod, daire };
  }, [katlar]);

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-extrabold text-slate-900">🏢 3B Görselleştirme</h1>
        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl">🏗️</div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Önce bir proje gerekli</h3>
          <Link href="/panel/yeni" className="mt-5 inline-block rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">+ Proje Oluştur</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">🏢 3B Görselleştirme</h1>
          <p className="mt-1 text-sm text-slate-500">Kat verisinden otomatik bina kütlesi. Döndür · yakınlaştır · kata tıkla.</p>
        </div>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
          className="rounded-xl border-2 border-sky-200 bg-[#f2f8fd] px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Özet */}
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Rozet renk="bg-ink-900">{ozet.ust} üst kat</Rozet>
        {ozet.bod > 0 && <Rozet renk="bg-slate-500">{ozet.bod} bodrum</Rozet>}
        <Rozet renk="bg-emerald-600">{ozet.daire} bölüm/daire</Rozet>
        <Rozet renk="bg-brand-500">{proje ? proje.area.toLocaleString("tr-TR") : 0} m²</Rozet>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_260px]">
        {/* sahne */}
        <div className="relative">
          <div ref={mountRef} className="h-[460px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm sm:h-[560px]" />
          <button onClick={() => setOtoDon((v) => !v)}
            className={`absolute right-3 top-3 rounded-lg px-3 py-1.5 text-xs font-bold shadow transition ${otoDon ? "bg-brand-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
            {otoDon ? "⏸ Döndürmeyi durdur" : "▶ Otomatik döndür"}
          </button>
        </div>

        {/* yan panel */}
        <div className="space-y-4">
          {secili ? (
            <div className="rounded-2xl border-2 border-brand-500/50 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 rounded" style={{ background: KULLANIM_RENK[secili.kullanim] }} />
                <h3 className="text-base font-extrabold text-slate-900">{secili.ad}</h3>
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Satir l="Kullanım" v={FLOOR_USAGE_LABELS[secili.kullanim]} />
                <Satir l="Kat alanı" v={`${Math.round(secili.alan).toLocaleString("tr-TR")} m²`} />
                <Satir l="Bölüm/daire" v={`${secili.daireSayisi}`} />
                <Satir l="Konum" v={secili.bodrum ? "Yer altı" : `+${secili.y.toFixed(1)} m`} />
              </dl>
              <button onClick={() => setSecili(null)} className="mt-3 text-xs font-semibold text-slate-400 hover:text-slate-600">Seçimi kaldır</button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-center text-sm text-slate-500">
              Detay için bir kata tıkla 👆
            </div>
          )}

          {/* lejant */}
          <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-4 shadow-sm">
            <h4 className="text-xs font-extrabold uppercase text-slate-500">Kat Kullanımı</h4>
            <ul className="mt-2 space-y-1.5 text-sm">
              {(Object.keys(KULLANIM_RENK) as (keyof typeof KULLANIM_RENK)[]).map((u) => (
                <li key={u} className="flex items-center gap-2">
                  <span className="inline-block h-3.5 w-3.5 rounded" style={{ background: KULLANIM_RENK[u] }} />
                  <span className="text-slate-600">{FLOOR_USAGE_LABELS[u]}</span>
                </li>
              ))}
            </ul>
          </div>

          {proje && (
            <Link href={`/panel/proje?id=${proje.id}`} className="block rounded-xl border-2 border-slate-200 px-4 py-2.5 text-center text-sm font-bold text-slate-600 transition hover:border-brand-500 hover:text-brand-600">
              Proje detayına git →
            </Link>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-400">Not: Kütle modeli kat alanından türetilmiş yaklaşık ayak izidir; gerçek mimari plan değildir.</p>

      <div className="mt-6 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}

function Rozet({ children, renk }: { children: React.ReactNode; renk: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${renk}`}>{children}</span>;
}
function Satir({ l, v }: { l: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-slate-500">{l}</dt><dd className="font-semibold text-slate-800">{v}</dd></div>;
}
