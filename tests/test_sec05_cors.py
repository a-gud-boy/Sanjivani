"""
Unit and integration tests for SEC-05: CORS origin whitelist and credential protection.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings


@pytest.mark.asyncio
async def test_cors_allowed_origin():
    """Verify that requests from a whitelisted origin receive valid CORS headers."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Local development Vite port
        res_local = await client.options(
            "/",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert res_local.headers.get("access-control-allow-origin") == "http://localhost:5173"
        assert res_local.headers.get("access-control-allow-credentials") == "true"

        # 2. Local Vite preview port
        res_prev = await client.options(
            "/",
            headers={
                "Origin": "http://localhost:4173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert res_prev.headers.get("access-control-allow-origin") == "http://localhost:4173"
        assert res_prev.headers.get("access-control-allow-credentials") == "true"

        # 3. GitHub Pages deployment origin
        res_gh = await client.options(
            "/api/v1/auth/patient/register",
            headers={
                "Origin": "https://a-gud-boy.github.io",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert res_gh.status_code == 200
        assert res_gh.headers.get("access-control-allow-origin") == "https://a-gud-boy.github.io"
        assert res_gh.headers.get("access-control-allow-credentials") == "true"

        # 4. Render app origin
        res_render = await client.options(
            "/api/v1/auth/patient/register",
            headers={
                "Origin": "https://sanjivani-9ne0.onrender.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert res_render.status_code == 200
        assert res_render.headers.get("access-control-allow-origin") == "https://sanjivani-9ne0.onrender.com"
        assert res_render.headers.get("access-control-allow-credentials") == "true"


@pytest.mark.asyncio
async def test_cors_disallowed_origin():
    """Verify that requests from an untrusted origin are not granted CORS access."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.options(
            "/",
            headers={
                "Origin": "https://malicious-site.example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        # Disallowed origin must not be reflected in access-control-allow-origin
        assert response.headers.get("access-control-allow-origin") != "https://malicious-site.example.com"


def test_cors_origins_parsing():
    """Verify that comma-separated ALLOWED_CORS_ORIGINS strings parse into lists."""
    from app.core.config import Settings
    custom_settings = Settings(
        ALLOWED_CORS_ORIGINS="https://app.sanjivani.in, https://doctor.sanjivani.in"
    )
    assert "https://app.sanjivani.in" in custom_settings.ALLOWED_CORS_ORIGINS
    assert "https://doctor.sanjivani.in" in custom_settings.ALLOWED_CORS_ORIGINS
    assert len(custom_settings.ALLOWED_CORS_ORIGINS) == 2
