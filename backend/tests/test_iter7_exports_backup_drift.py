"""Iteration 7 tests:
- Backup/restore round-trip (admin) & cashier forbidden (if gated)
- Rounding-drift absorption in close_session for unlinked multi-player sessions
- Regression: linked player underpayment still creates credit
"""
import os, uuid, copy, requests, pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL
API = f"{BASE_URL}/api"


def _login(u, p):
    r = requests.post(f"{API}/auth/login", json={"username": u, "password": p}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def H_admin():
    return _login("admin", "admin123")


@pytest.fixture(scope="module")
def H_cashier():
    return _login("cashier", "cashier123")


# ---------- helpers ----------
def _free_table(H):
    r = requests.get(f"{API}/tables", headers=H, timeout=15); r.raise_for_status()
    tables = r.json()
    ra = requests.get(f"{API}/sessions/active", headers=H, timeout=15)
    busy = {s.get("current_table_id") for s in ra.json()} if ra.status_code == 200 else set()
    free = [t for t in tables if t["id"] not in busy]
    assert free, "no free tables"
    return free[0]


def _open_unlinked_multi(H, n=2, start_offset_secs=180):
    t = _free_table(H)
    from datetime import datetime, timezone, timedelta
    start_iso = (datetime.now(timezone.utc) - timedelta(seconds=start_offset_secs)).isoformat()
    players = [{"name": f"TEST_ITR7_P{i}_{uuid.uuid4().hex[:4]}", "mobile": "", "ratio": 1} for i in range(n)]
    r = requests.post(
        f"{API}/sessions/open",
        headers=H,
        json={
            "table_id": t["id"],
            "player_name": players[0]["name"],
            "num_players": n,
            "players": players,
            "start_time": start_iso,
        }, timeout=20,
    )
    assert r.status_code == 200, r.text
    s = r.json()
    assert not s.get("player_id"), "session should be unlinked"
    return s


def _create_linked_player(H):
    name = f"TEST_ITR7_LINKED_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/players", headers=H, json={"name": name, "mobile": ""}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def _open_linked_single(H, player, start_offset_secs=180):
    t = _free_table(H)
    from datetime import datetime, timezone, timedelta
    start_iso = (datetime.now(timezone.utc) - timedelta(seconds=start_offset_secs)).isoformat()
    r = requests.post(
        f"{API}/sessions/open",
        headers=H,
        json={
            "table_id": t["id"],
            "player_id": player["id"],
            "player_name": player["name"],
            "num_players": 1,
            "players": [{"name": player["name"], "player_id": player["id"], "ratio": 1}],
            "start_time": start_iso,
        }, timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _preview_final(H, sid):
    r = requests.get(f"{API}/sessions/{sid}/preview-bill", headers=H, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["billing"]["final_amount"]


def _cleanup(H, sid):
    try:
        requests.post(f"{API}/sessions/{sid}/close", headers=H,
                      json={"payments": [{"method": "cash", "amount": 999999}], "pay_full": True}, timeout=15)
    except Exception:
        pass


# ---------- Backup / Restore ----------
def test_backup_admin_returns_all_collections(H_admin):
    r = requests.get(f"{API}/data/backup", headers=H_admin, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    for c in ["users", "tables", "memberships", "inventory", "players", "sessions",
              "invoices", "credit_payments", "settings", "counters"]:
        assert c in data, f"missing collection {c} in backup"
        assert isinstance(data[c], list)


def test_backup_cashier_forbidden(H_cashier):
    r = requests.get(f"{API}/data/backup", headers=H_cashier, timeout=30)
    assert r.status_code in (401, 403), f"cashier should not access backup, got {r.status_code}: {r.text}"


def test_restore_cashier_forbidden(H_cashier):
    r = requests.post(f"{API}/data/restore", headers=H_cashier, json={"tables": []}, timeout=30)
    assert r.status_code in (401, 403), f"cashier should not access restore, got {r.status_code}"


def test_backup_restore_roundtrip(H_admin):
    # Snapshot
    r = requests.get(f"{API}/data/backup", headers=H_admin, timeout=60)
    assert r.status_code == 200
    snap = r.json()
    counts_before = {k: len(v) for k, v in snap.items()}

    # Restore same payload back
    payload = copy.deepcopy(snap)
    r2 = requests.post(f"{API}/data/restore", headers=H_admin, json=payload, timeout=120)
    assert r2.status_code == 200, r2.text
    assert r2.json().get("ok") is True

    # Verify no data loss
    r3 = requests.get(f"{API}/data/backup", headers=H_admin, timeout=60)
    assert r3.status_code == 200
    after = r3.json()
    counts_after = {k: len(v) for k, v in after.items()}
    for k, before_count in counts_before.items():
        assert counts_after.get(k) == before_count, f"{k}: {before_count} -> {counts_after.get(k)}"

    # Sanity: admin can still hit an authed endpoint after restore (user preserved)
    r4 = requests.get(f"{API}/tables", headers=H_admin, timeout=15)
    assert r4.status_code == 200


# ---------- Rounding-drift absorption ----------
def test_close_drift_small_absorbed_unlinked(H_admin):
    s = _open_unlinked_multi(H_admin, n=2, start_offset_secs=300)
    sid = s["id"]
    try:
        final = _preview_final(H_admin, sid)
        assert final > 5.0
        # Underpay by 0.50 (0 < drift <= 1.0) - should be absorbed
        pay = round(final - 0.50, 2)
        r = requests.post(
            f"{API}/sessions/{sid}/close", headers=H_admin,
            json={"payments": [{"method": "cash", "amount": pay}], "pay_full": False}, timeout=20,
        )
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["credit_amount"] == 0, f"credit={inv['credit_amount']}"
        assert inv["payment_status"] == "paid"
        # After absorption, amount_paid ≈ final
        assert round(inv["amount_paid"], 2) == round(inv["final_amount"], 2)
    finally:
        _cleanup(H_admin, sid)


def test_close_drift_large_rejected_unlinked(H_admin):
    s = _open_unlinked_multi(H_admin, n=2, start_offset_secs=300)
    sid = s["id"]
    try:
        final = _preview_final(H_admin, sid)
        assert final > 5.0
        # Underpay by 2.0 (drift > 1.0) - must be rejected
        pay = round(final - 2.0, 2)
        r = requests.post(
            f"{API}/sessions/{sid}/close", headers=H_admin,
            json={"payments": [{"method": "cash", "amount": pay}], "pay_full": False}, timeout=20,
        )
        assert r.status_code == 400, r.text
        assert "credit" in r.text.lower() and "player" in r.text.lower()
    finally:
        _cleanup(H_admin, sid)


def test_close_underpay_linked_creates_credit(H_admin):
    p = _create_linked_player(H_admin)
    s = _open_linked_single(H_admin, p, start_offset_secs=300)
    sid = s["id"]
    try:
        final = _preview_final(H_admin, sid)
        assert final > 5.0
        pay = round(final - 2.0, 2)  # drift > 1 but linked -> credit expected
        r = requests.post(
            f"{API}/sessions/{sid}/close", headers=H_admin,
            json={"payments": [{"method": "cash", "amount": pay}], "pay_full": False}, timeout=20,
        )
        assert r.status_code == 200, r.text
        inv = r.json()
        assert round(inv["credit_amount"], 2) == 2.0
        assert inv["payment_status"] in ("partial", "credit")
    finally:
        _cleanup(H_admin, sid)
