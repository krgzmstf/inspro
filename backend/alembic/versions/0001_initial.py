"""ilk şema

Revision ID: 0001
Revises:
Create Date: 2026-06-16
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("ad_soyad", sa.String(), nullable=False),
        sa.Column("firma", sa.String(), nullable=False),
        sa.Column("rol", sa.String(), nullable=False),
        sa.Column("yetkiler", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("aktif", sa.Boolean(), nullable=False),
        sa.Column("son_giris", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "otp_kodlar",
        sa.Column("email", sa.String(), primary_key=True),
        sa.Column("kod", sa.String(), nullable=False),
        sa.Column("ad_soyad", sa.String(), nullable=False),
        sa.Column("firma", sa.String(), nullable=False),
        sa.Column("deneme", sa.Integer(), nullable=False),
        sa.Column("olusturma", sa.DateTime(timezone=True), nullable=False),
        sa.Column("son", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "projects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_id", sa.String(), nullable=False),
        sa.Column("veri", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_projects_owner_id", "projects", ["owner_id"])

    op.create_table(
        "accounting",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_id", sa.String(), nullable=False),
        sa.Column("veri", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_accounting_owner_id", "accounting", ["owner_id"])

    op.create_table(
        "modul_veri",
        sa.Column("owner_id", sa.String(), primary_key=True),
        sa.Column("modul", sa.String(), primary_key=True),
        sa.Column("veri", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
    )

    op.create_table(
        "dosyalar",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner_id", sa.String(), nullable=False),
        sa.Column("ad", sa.String(), nullable=False),
        sa.Column("mime", sa.String(), nullable=False),
        sa.Column("boyut", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_dosyalar_owner_id", "dosyalar", ["owner_id"])


def downgrade() -> None:
    op.drop_table("dosyalar")
    op.drop_table("modul_veri")
    op.drop_table("accounting")
    op.drop_table("projects")
    op.drop_table("otp_kodlar")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
