"""parola + profil + 2FA alanları

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # users
    op.add_column("users", sa.Column("sifre_hash", sa.String(), nullable=True))
    for ad, varsayilan in [
        ("ad", "''"), ("soyad", "''"), ("telefon", "''"), ("dogum_tarihi", "''"),
        ("meslek", "''"), ("sirket_adi", "''"), ("vergi_dairesi", "''"), ("vergi_no", "''"),
        ("iki_adim_yontem", "'email'"),
    ]:
        op.add_column("users", sa.Column(ad, sa.String(), nullable=False, server_default=sa.text(varsayilan)))
    op.add_column("users", sa.Column("sirket_mi", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("profil_tamam", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("totp_secret", sa.String(), nullable=True))

    # otp_kodlar
    op.add_column("otp_kodlar", sa.Column("sifre_hash", sa.String(), nullable=True))
    op.add_column("otp_kodlar", sa.Column("amac", sa.String(), nullable=False, server_default=sa.text("'giris'")))


def downgrade() -> None:
    op.drop_column("otp_kodlar", "amac")
    op.drop_column("otp_kodlar", "sifre_hash")
    for ad in ["totp_secret", "profil_tamam", "sirket_mi", "iki_adim_yontem", "vergi_no",
               "vergi_dairesi", "sirket_adi", "meslek", "dogum_tarihi", "telefon", "soyad", "ad", "sifre_hash"]:
        op.drop_column("users", ad)
