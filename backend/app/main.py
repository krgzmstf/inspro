"""
insPRO — Kendi backend'imiz (FastAPI + PostgreSQL)

Supabase yerine tamamen bizim kontrolümüzde backend:
  • E-posta kodlu (OTP) kayıt/giriş + JWT
  • Roller (yonetici/sefi/taseron/muhasebeci) + kişiye özel yetkiler
  • Projeler, muhasebe ve diğer modüller (JSON kayıt) API'si
  • Yönetim: kullanıcı + rol yönetimi

Tüm veri kendi PostgreSQL'imizde. yazeproje gibi Docker'da çalışır,
istenen sunucuya deploy edilir.
"""

from __future__ import annotations

import os
import random
import datetime as dt
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from jose import jwt, JWTError
from sqlalchemy import String, Text, DateTime, ForeignKey, select, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
import aiosmtplib
from email.message import EmailMessage

# ── Ayarlar ───────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://inspro:inspro_local@db:5432/inspro")
JWT_SECRET = os.getenv("JWT_SECRET", "degistir")
JWT_ALG = "HS256"
JWT_GUN = 30
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "İNŞPRO <yazeinspro@gmail.com>")

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
Session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def yeni_id() -> str:
    import uuid
    return str(uuid.uuid4())


def simdi() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


# ── Modeller ──────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=yeni_id)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    ad_soyad: Mapped[str] = mapped_column(String, default="")
    firma: Mapped[str] = mapped_column(String, default="")
    rol: Mapped[str] = mapped_column(String, default="yonetici")
    yetkiler: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=simdi)
    son_giris: Mapped[Optional[dt.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class OtpKod(Base):
    __tablename__ = "otp_kodlar"
    email: Mapped[str] = mapped_column(String, primary_key=True)
    kod: Mapped[str] = mapped_column(String)
    ad_soyad: Mapped[str] = mapped_column(String, default="")
    firma: Mapped[str] = mapped_column(String, default="")
    son: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=yeni_id)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    veri: Mapped[Any] = mapped_column(JSONB)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=simdi, onupdate=simdi)


class Accounting(Base):
    __tablename__ = "accounting"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=yeni_id)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    veri: Mapped[Any] = mapped_column(JSONB)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=simdi, onupdate=simdi)


class ModulVeri(Base):
    __tablename__ = "modul_veri"
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    modul: Mapped[str] = mapped_column(String, primary_key=True)
    veri: Mapped[Any] = mapped_column(JSONB, default=list)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=simdi, onupdate=simdi)


# ── JWT + e-posta ─────────────────────────────────────────
def token_uret(user_id: str) -> str:
    payload = {"sub": user_id, "exp": simdi() + dt.timedelta(days=JWT_GUN)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def mail_gonder(hedef: str, kod: str):
    if not SMTP_HOST or not SMTP_USER:
        print(f"[OTP] {hedef} için kod (SMTP yok): {kod}")
        return
    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = hedef
    msg["Subject"] = "İNŞPRO doğrulama kodunuz"
    msg.set_content(f"İNŞPRO doğrulama kodunuz: {kod}\n\nKod 10 dakika geçerlidir.")
    msg.add_alternative(
        f"""<div style="font-family:Arial;background:#0e2240;padding:28px">
        <div style="max-width:420px;margin:auto;background:#fff;border-radius:14px;padding:24px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#0e2240">İNŞ<span style="color:#2563eb">PRO</span></div>
        <h3 style="color:#0e2240">Doğrulama Kodunuz</h3>
        <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#2563eb;font-family:monospace">{kod}</div>
        <p style="color:#475569;font-size:13px">Kod 10 dakika geçerlidir. Bu işlemi siz yapmadıysanız yok sayın.</p>
        </div></div>""", subtype="html")
    await aiosmtplib.send(msg, hostname=SMTP_HOST, port=SMTP_PORT, username=SMTP_USER, password=SMTP_PASSWORD, start_tls=True)


# ── Uygulama ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="insPRO API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], allow_credentials=False,
)


async def get_db() -> AsyncSession:
    async with Session() as s:
        yield s


async def get_user(authorization: str = Header(default=""), db: AsyncSession = Depends(get_db)) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Oturum yok.")
    try:
        payload = jwt.decode(authorization[7:], JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload["sub"]
    except (JWTError, KeyError):
        raise HTTPException(401, "Geçersiz oturum.")
    u = await db.get(User, uid)
    if not u:
        raise HTTPException(401, "Kullanıcı yok.")
    return u


# ── Şemalar ───────────────────────────────────────────────
class KodIstek(BaseModel):
    email: EmailStr
    kayit: bool = False
    ad_soyad: str = ""
    firma: str = ""


class KodDogrula(BaseModel):
    email: EmailStr
    kod: str


# ── Endpoints ─────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"ok": True, "servis": "insPRO API"}


@app.post("/auth/kod-gonder")
async def kod_gonder(g: KodIstek, db: AsyncSession = Depends(get_db)):
    email = g.email.lower().strip()
    var = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not g.kayit and not var:
        raise HTTPException(400, "Bu e-posta kayıtlı değil; önce kayıt olun.")
    kod = f"{random.randint(0, 999999):06d}"
    rec = await db.get(OtpKod, email)
    if rec:
        rec.kod, rec.son, rec.ad_soyad, rec.firma = kod, simdi() + dt.timedelta(minutes=10), g.ad_soyad, g.firma
    else:
        db.add(OtpKod(email=email, kod=kod, ad_soyad=g.ad_soyad, firma=g.firma, son=simdi() + dt.timedelta(minutes=10)))
    await db.commit()
    try:
        await mail_gonder(email, kod)
    except Exception as e:
        raise HTTPException(500, f"E-posta gönderilemedi: {e}")
    return {"ok": True}


@app.post("/auth/kod-dogrula")
async def kod_dogrula(g: KodDogrula, db: AsyncSession = Depends(get_db)):
    email = g.email.lower().strip()
    rec = await db.get(OtpKod, email)
    if not rec or rec.kod != g.kod.strip():
        raise HTTPException(400, "Kod hatalı.")
    if rec.son < simdi():
        raise HTTPException(400, "Kod süresi doldu. Tekrar kod iste.")
    u = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not u:
        u = User(email=email, ad_soyad=rec.ad_soyad, firma=rec.firma)
        db.add(u)
    u.son_giris = simdi()
    await db.delete(rec)
    await db.commit()
    await db.refresh(u)
    return {"access_token": token_uret(u.id), "user": _user_dto(u)}


@app.get("/auth/ben")
async def ben(u: User = Depends(get_user)):
    return _user_dto(u)


def _user_dto(u: User) -> dict:
    return {"id": u.id, "email": u.email, "ad_soyad": u.ad_soyad, "firma": u.firma, "rol": u.rol, "yetkiler": u.yetkiler}


# ── Projeler ──────────────────────────────────────────────
@app.get("/projeler")
async def projeler(u: User = Depends(get_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Project).where(Project.owner_id == u.id))).scalars().all()
    return [r.veri for r in rows]


@app.post("/projeler")
async def proje_kaydet(veri: dict, u: User = Depends(get_user), db: AsyncSession = Depends(get_db)):
    pid = str(veri.get("id") or yeni_id())
    veri["id"] = pid
    row = await db.get(Project, pid)
    if row:
        if row.owner_id != u.id:
            raise HTTPException(403, "Yetki yok.")
        row.veri = veri
    else:
        db.add(Project(id=pid, owner_id=u.id, veri=veri))
    await db.commit()
    return veri


@app.delete("/projeler/{pid}")
async def proje_sil(pid: str, u: User = Depends(get_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(Project, pid)
    if row and row.owner_id == u.id:
        await db.delete(row)
        await db.commit()
    return {"ok": True}


# ── Muhasebe ──────────────────────────────────────────────
@app.get("/muhasebe")
async def muhasebe(u: User = Depends(get_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Accounting).where(Accounting.owner_id == u.id))).scalars().all()
    return [r.veri for r in rows]


@app.post("/muhasebe")
async def muhasebe_kaydet(veri: dict, u: User = Depends(get_user), db: AsyncSession = Depends(get_db)):
    kid = str(veri.get("id") or yeni_id())
    veri["id"] = kid
    row = await db.get(Accounting, kid)
    if row:
        if row.owner_id != u.id:
            raise HTTPException(403, "Yetki yok.")
        row.veri = veri
    else:
        db.add(Accounting(id=kid, owner_id=u.id, veri=veri))
    await db.commit()
    return veri


@app.delete("/muhasebe/{kid}")
async def muhasebe_sil(kid: str, u: User = Depends(get_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(Accounting, kid)
    if row and row.owner_id == u.id:
        await db.delete(row)
        await db.commit()
    return {"ok": True}


# ── Diğer modüller (JSON blob) ────────────────────────────
@app.get("/modul/{modul}")
async def modul_getir(modul: str, u: User = Depends(get_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(ModulVeri, (u.id, modul))
    return {"veri": row.veri if row else []}


@app.put("/modul/{modul}")
async def modul_yaz(modul: str, govde: dict, u: User = Depends(get_user), db: AsyncSession = Depends(get_db)):
    veri = govde.get("veri", [])
    row = await db.get(ModulVeri, (u.id, modul))
    if row:
        row.veri = veri
    else:
        db.add(ModulVeri(owner_id=u.id, modul=modul, veri=veri))
    await db.commit()
    return {"ok": True}


# ── Yönetim (kullanıcı + rol) — yalnız yönetici ───────────
class RolGuncelle(BaseModel):
    id: str
    rol: str
    yetkiler: Optional[list[str]] = None


@app.get("/yonetim/kullanicilar")
async def kullanicilar(u: User = Depends(get_user), db: AsyncSession = Depends(get_db)):
    if u.rol != "yonetici":
        raise HTTPException(403, "Yalnız yönetici.")
    rows = (await db.execute(select(User))).scalars().all()
    return {"users": [
        {**_user_dto(r), "created_at": r.created_at.isoformat() if r.created_at else None,
         "son_giris": r.son_giris.isoformat() if r.son_giris else None} for r in rows]}


@app.post("/yonetim/kullanicilar")
async def rol_ata(g: RolGuncelle, u: User = Depends(get_user), db: AsyncSession = Depends(get_db)):
    if u.rol != "yonetici":
        raise HTTPException(403, "Yalnız yönetici.")
    if g.rol not in ("yonetici", "sefi", "taseron", "muhasebeci"):
        raise HTTPException(400, "Geçersiz rol.")
    hedef = await db.get(User, g.id)
    if not hedef:
        raise HTTPException(404, "Kullanıcı yok.")
    hedef.rol = g.rol
    if g.yetkiler is not None:
        hedef.yetkiler = g.yetkiler
    await db.commit()
    return {"ok": True}
