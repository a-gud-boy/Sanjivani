"""
Unit test for DB-01: Alembic database migration setup and configuration.
"""
import os
from alembic.config import Config
from alembic.script import ScriptDirectory
from app.db.database import Base


def test_alembic_config_and_revisions():
    """Verify that alembic.ini is present and has valid script directory."""
    alembic_ini_path = os.path.abspath("alembic.ini")
    assert os.path.exists(alembic_ini_path), "alembic.ini must exist"

    config = Config(alembic_ini_path)
    script = ScriptDirectory.from_config(config)
    revisions = list(script.walk_revisions())
    assert len(revisions) > 0, "At least one migration revision must be registered"
    head_rev = script.get_current_head()
    assert head_rev is not None, "Alembic should have a valid head revision"


def test_target_metadata_contains_all_models():
    """Verify that Base.metadata includes all domain tables."""
    tables = Base.metadata.tables.keys()
    assert "patients" in tables
    assert "doctors" in tables
    assert "intake_sessions" in tables
    assert "patient_documents" in tables
    assert "active_otps" in tables
