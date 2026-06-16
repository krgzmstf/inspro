"""E-posta gönderimi (SMTP)."""
from __future__ import annotations

import logging
from email.message import EmailMessage

import aiosmtplib

from ..core.config import settings

log = logging.getLogger("inspro")


def _kod_govdesi(kod: str) -> str:
    return f"""<div style="font-family:Arial,sans-serif;background:#0e2240;padding:28px">
    <div style="max-width:420px;margin:auto;background:#fff;border-radius:14px;padding:24px;text-align:center">
    <div style="font-size:22px;font-weight:800;color:#0e2240">İNŞ<span style="color:#2563eb">PRO</span></div>
    <h3 style="color:#0e2240">Doğrulama Kodunuz</h3>
    <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#2563eb;font-family:monospace">{kod}</div>
    <p style="color:#475569;font-size:13px">Kod {settings.otp_gecerlilik_dk} dakika geçerlidir.
    Bu işlemi siz yapmadıysanız bu e-postayı yok sayın.</p>
    </div></div>"""


async def kod_maili_gonder(hedef: str, kod: str) -> None:
    if not settings.smtp_host or not settings.smtp_user:
        # SMTP yapılandırılmadıysa kodu loga yaz (yerel geliştirme).
        log.warning("[OTP] SMTP yok — %s için kod: %s", hedef, kod)
        return
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = hedef
    msg["Subject"] = "İNŞPRO doğrulama kodunuz"
    msg.set_content(f"İNŞPRO doğrulama kodunuz: {kod}\n\nKod {settings.otp_gecerlilik_dk} dakika geçerlidir.")
    msg.add_alternative(_kod_govdesi(kod), subtype="html")
    await aiosmtplib.send(
        msg,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user,
        password=settings.smtp_password,
        start_tls=True,
    )
