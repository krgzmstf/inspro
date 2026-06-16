"""Sağlık ucu testleri (DB gerektirmez)."""
import pytest


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    govde = r.json()
    assert govde["ok"] is True
    assert "surum" in govde


@pytest.mark.asyncio
async def test_korumali_uc_oturumsuz_401(client):
    r = await client.get("/auth/ben")
    assert r.status_code == 401
