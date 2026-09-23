"""Iteration 8: Multi-club registration, tenant isolation, /invoices/unpaid,
/invoices/{id}/collect, minute-wise billing, per-player ratio-of-total-table split,
walk-in/unlinked session underpayment (no more 400 'Credit requires a linked player').
"""
import os
import uuid
import time
import requests
import pytest
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Default club fixtures ----------
@pytest.fixture(scope="module")
def admin_tok():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def cashier_tok():
    r = requests.post(f"{API}/auth/login", json={"username": "cashier", "password": "cashier123"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["token"]


# ---------- New-club registration fixture ----------
@pytest.fixture(scope="module")
def new_club():
    """Register a brand-new club; return dict with token, user, club_name, username."""
    suffix = uuid.uuid4().hex[:8]
    body = {
        "club_name": f"TEST Club {suffix}",
        "username": f"test_club_{suffix}",
        "password": "secret123",
        "mobile": "9998887777",
        "location": "Test City",
    }
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    assert data["user"]["club_id"]
    assert data["user"]["club_name"] == body["club_name"]
    assert isinstance(data["token"], str) and len(data["token"]) > 20
    return {**body, "token": data["token"], "user": data["user"]}


# ============================================================
# 1. Registration
# ============================================================
class TestRegister:
    def test_register_returns_token_and_admin(self, new_club):
        # Verify /auth/me works and reflects club
        r = requests.get(f"{API}/auth/me", headers=_hdr(new_club["token"]))
        assert r.status_code == 200
        me = r.json()
        assert me["role"] == "admin"
        assert me["club_id"] == new_club["user"]["club_id"]
        assert me["club_name"] == new_club["club_name"]

    def test_duplicate_username_400(self, new_club):
        r = requests.post(f"{API}/auth/register", json={
            "club_name": "Dup Club",
            "username": new_club["username"],  # already taken
            "password": "secret123",
        })
        assert r.status_code == 400
        assert "taken" in r.text.lower() or "exists" in r.text.lower()

    def test_short_password_400(self):
        suffix = uuid.uuid4().hex[:8]
        r = requests.post(f"{API}/auth/register", json={
            "club_name": f"ShortPw {suffix}",
            "username": f"shortpw_{suffix}",
            "password": "abc",  # too short
        })
        assert r.status_code == 400

    def test_new_club_seed_defaults(self, new_club):
        H = _hdr(new_club["token"])
        tables = requests.get(f"{API}/tables", headers=H).json()
        assert len(tables) == 4
        mems = requests.get(f"{API}/memberships", headers=H).json()
        assert len(mems) == 2
        inv = requests.get(f"{API}/inventory", headers=H).json()
        assert len(inv) == 4
        players = requests.get(f"{API}/players", headers=H).json()
        assert players == []
        invoices = requests.get(f"{API}/invoices", headers=H).json()
        assert invoices == []
        settings = requests.get(f"{API}/settings", headers=H).json()
        assert settings["business_name"] == new_club["club_name"]

    def test_new_club_users_only_own(self, new_club):
        H = _hdr(new_club["token"])
        users = requests.get(f"{API}/users", headers=H).json()
        assert len(users) == 1
        assert users[0]["username"] == new_club["username"]


# ============================================================
# 2. Tenant isolation
# ============================================================
class TestIsolation:
    def test_default_admin_cannot_see_new_club_data(self, new_club, admin_tok):
        H_new = _hdr(new_club["token"])
        # Create a player in new club
        p = requests.post(f"{API}/players", headers=H_new, json={"name": "TEST_ISO_player"}).json()
        # Open + close unlinked session in new club
        tables = requests.get(f"{API}/tables", headers=H_new).json()
        tid = tables[0]["id"]
        # Open with start_time 2 min ago so we get some billable amount
        st = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()
        s = requests.post(f"{API}/sessions/open", headers=H_new, json={
            "table_id": tid, "player_name": "TEST_ISO_walk", "start_time": st,
        })
        assert s.status_code == 200, s.text
        sid = s.json()["id"]
        c = requests.post(f"{API}/sessions/{sid}/close", headers=H_new, json={"payments": []})
        assert c.status_code == 200, c.text
        new_inv_id = c.json()["id"]

        # Default admin: should NOT see this data
        H_def = _hdr(admin_tok)
        def_players = requests.get(f"{API}/players", headers=H_def).json()
        assert not any(x["name"] == "TEST_ISO_player" for x in def_players)
        def_invoices = requests.get(f"{API}/invoices", headers=H_def).json()
        assert not any(x["id"] == new_inv_id for x in def_invoices)

        # Also new club shouldn't see default admin/cashier users
        users_new = requests.get(f"{API}/users", headers=H_new).json()
        assert not any(u["username"] in ("admin", "cashier") for u in users_new)


# ============================================================
# 3. Unlinked underpayment (no 400)
# ============================================================
class TestUnlinkedUnderpayment:
    def test_close_unlinked_underpay(self, admin_tok):
        H = _hdr(admin_tok)
        tables = requests.get(f"{API}/tables", headers=H).json()
        # find a free table
        active = requests.get(f"{API}/sessions/active", headers=H).json()
        busy = {a["current_table_id"] for a in active}
        tid = next(t["id"] for t in tables if t["id"] not in busy)
        st = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        s = requests.post(f"{API}/sessions/open", headers=H, json={
            "table_id": tid, "player_name": "TEST_UNPAID_walkin", "start_time": st,
        }).json()
        r = requests.post(f"{API}/sessions/{s['id']}/close", headers=H, json={
            "payments": [{"method": "cash", "amount": 1.0}],
        })
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["credit_amount"] > 0
        assert inv["payment_status"] in ("partial", "credit")

    def test_walkin_sale_underpay(self, admin_tok):
        H = _hdr(admin_tok)
        inv_items = requests.get(f"{API}/inventory", headers=H).json()
        item = inv_items[0]
        r = requests.post(f"{API}/walk-in/sale", headers=H, json={
            "customer_name": "TEST_walkin_underpay",
            "items": [{"item_id": item["id"], "qty": 1}],
            "payments": [{"method": "cash", "amount": 1.0}],
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["credit_amount"] > 0
        assert d["payment_status"] in ("partial", "credit")


# ============================================================
# 4. /invoices/unpaid + /invoices/{id}/collect
# ============================================================
@pytest.fixture(scope="module")
def unpaid_invoice(admin_tok):
    """Create a linked-player unpaid invoice for collect tests."""
    H = _hdr(admin_tok)
    p = requests.post(f"{API}/players", headers=H, json={"name": f"TEST_ITR8_credit_{uuid.uuid4().hex[:6]}"}).json()
    tables = requests.get(f"{API}/tables", headers=H).json()
    active = requests.get(f"{API}/sessions/active", headers=H).json()
    busy = {a["current_table_id"] for a in active}
    tid = next(t["id"] for t in tables if t["id"] not in busy)
    st = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    s = requests.post(f"{API}/sessions/open", headers=H, json={
        "table_id": tid, "player_name": p["name"], "player_id": p["id"], "start_time": st,
    }).json()
    r = requests.post(f"{API}/sessions/{s['id']}/close", headers=H, json={
        "payments": [{"method": "cash", "amount": 5.0}],
    }).json()
    assert r["credit_amount"] > 0
    return {"invoice": r, "player_id": p["id"]}


class TestUnpaidCollect:
    def test_unpaid_endpoint_shape(self, admin_tok, unpaid_invoice):
        H = _hdr(admin_tok)
        r = requests.get(f"{API}/invoices/unpaid", headers=H).json()
        assert "total_due" in r and "count" in r and "invoices" in r and "by_player" in r
        assert r["count"] >= 1
        # All returned invoices have credit_amount > 0
        for i in r["invoices"]:
            assert i["credit_amount"] > 0
        # by_player grouping keys
        keys = [row["key"] for row in r["by_player"]]
        target_key = unpaid_invoice["player_id"]
        assert target_key in keys
        row = next(x for x in r["by_player"] if x["key"] == target_key)
        assert row["due"] > 0 and row["billed"] > 0
        # Walk-in bucket key format for unlinked
        walkins = [k for k in keys if isinstance(k, str) and k.startswith("walkin:")]
        # At least the walk-in from previous test likely exists
        assert isinstance(walkins, list)

    def test_partial_collect_then_full(self, admin_tok, unpaid_invoice):
        H = _hdr(admin_tok)
        inv = unpaid_invoice["invoice"]
        pid = unpaid_invoice["player_id"]
        due = inv["credit_amount"]
        # Fetch player balance before
        p_before = requests.get(f"{API}/players/{pid}", headers=H).json()
        bal_before = p_before["credit_balance"]

        # Partial: pay half
        half = round(due / 2, 2)
        r = requests.post(f"{API}/invoices/{inv['id']}/collect", headers=H, json={
            "amount": half, "method": "upi", "remarks": "partial-test",
        })
        assert r.status_code == 200, r.text
        after = r.json()
        assert after["payment_status"] == "partial"
        assert after["credit_amount"] == round(due - half, 2)
        assert after["amount_paid"] == round(inv["amount_paid"] + half, 2)
        assert any(pay.get("collected_at") for pay in after["payments"])

        # Player credit_balance dropped by half
        p_mid = requests.get(f"{API}/players/{pid}", headers=H).json()
        assert round(bal_before - p_mid["credit_balance"], 2) == half

        # credit_payments doc created linked to invoice
        hist = requests.get(f"{API}/credit/history", headers=H, params={"player_id": pid}).json()
        assert any(pmt.get("invoice_id") == inv["id"] for pmt in hist["payments"])

        # Full: collect remaining
        remaining = after["credit_amount"]
        r2 = requests.post(f"{API}/invoices/{inv['id']}/collect", headers=H, json={
            "amount": remaining, "method": "cash",
        })
        assert r2.status_code == 200
        settled = r2.json()
        assert settled["payment_status"] == "paid"
        assert settled["credit_amount"] == 0

        p_after = requests.get(f"{API}/players/{pid}", headers=H).json()
        assert round(bal_before - p_after["credit_balance"], 2) == round(due, 2)

        # Over-collect on settled -> 400
        r3 = requests.post(f"{API}/invoices/{inv['id']}/collect", headers=H, json={"amount": 1, "method": "cash"})
        assert r3.status_code == 400

    def test_over_collect_rejected(self, admin_tok):
        H = _hdr(admin_tok)
        # Create fresh unpaid invoice
        p = requests.post(f"{API}/players", headers=H, json={"name": f"TEST_ITR8_over_{uuid.uuid4().hex[:6]}"}).json()
        tables = requests.get(f"{API}/tables", headers=H).json()
        active = requests.get(f"{API}/sessions/active", headers=H).json()
        busy = {a["current_table_id"] for a in active}
        tid = next(t["id"] for t in tables if t["id"] not in busy)
        st = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        s = requests.post(f"{API}/sessions/open", headers=H, json={
            "table_id": tid, "player_name": p["name"], "player_id": p["id"], "start_time": st,
        }).json()
        inv = requests.post(f"{API}/sessions/{s['id']}/close", headers=H, json={"payments": []}).json()
        due = inv["credit_amount"]
        r = requests.post(f"{API}/invoices/{inv['id']}/collect", headers=H, json={"amount": due + 100, "method": "cash"})
        assert r.status_code == 400


# ============================================================
# 5. Minute-wise billing & per-player split of TOTAL
# ============================================================
class TestBilling:
    def test_minute_wise_31min_40s_at_320(self, admin_tok):
        H = _hdr(admin_tok)
        tables = requests.get(f"{API}/tables", headers=H).json()
        # find a table with hourly_rate 320 that is free (Table 2/3/4)
        active = requests.get(f"{API}/sessions/active", headers=H).json()
        busy = {a["current_table_id"] for a in active}
        t = next(t for t in tables if abs(t["hourly_rate"] - 320) < 0.01 and t["id"] not in busy)
        st = (datetime.now(timezone.utc) - timedelta(seconds=1900)).isoformat()  # 31min 40s
        s = requests.post(f"{API}/sessions/open", headers=H, json={
            "table_id": t["id"], "player_name": "TEST_ITR8_min", "start_time": st,
        }).json()
        r = requests.post(f"{API}/sessions/{s['id']}/close", headers=H, json={"payments": []}).json()
        # 31 completed minutes -> billable_seconds = 1860; amount = 320/60*31 = 165.33
        assert r["total_billable_seconds"] == 1860, r
        assert r["table_amount"] == 165.33, r

    def test_two_player_ratio_1_1_and_2_1(self, admin_tok):
        H = _hdr(admin_tok)
        tables = requests.get(f"{API}/tables", headers=H).json()
        active = requests.get(f"{API}/sessions/active", headers=H).json()
        busy = {a["current_table_id"] for a in active}
        t = next(t for t in tables if abs(t["hourly_rate"] - 320) < 0.01 and t["id"] not in busy)
        st = (datetime.now(timezone.utc) - timedelta(minutes=20)).isoformat()
        s = requests.post(f"{API}/sessions/open", headers=H, json={
            "table_id": t["id"], "player_name": "TEST_ITR8_A", "start_time": st,
        }).json()
        # Add player B (later in real time, but ratio-of-total should ignore presence)
        add = requests.post(f"{API}/sessions/{s['id']}/add-player", headers=H, json={
            "name": "TEST_ITR8_B", "ratio": 1.0,
        })
        assert add.status_code == 200
        # Ratio 1:1
        prev = requests.get(f"{API}/sessions/{s['id']}/preview-bill", headers=H).json()
        pp = prev["billing"]["per_player"]
        assert len(pp) == 2
        shares = sorted([x["table_share"] for x in pp])
        # equal 50/50
        assert abs(shares[0] - shares[1]) < 0.02, pp
        total_t = prev["billing"]["table_amount"]
        assert abs(sum(x["table_share"] for x in pp) - total_t) < 0.02

        # Now set ratio 2:1 (A pays 2, B pays 1) → 66.67% / 33.33%
        players = prev["session"]["players"]
        ratios = {}
        for pl in players:
            ratios[pl["id"]] = 2.0 if pl["name"] == "TEST_ITR8_A" else 1.0
        rr = requests.post(f"{API}/sessions/{s['id']}/ratios", headers=H, json={"ratios": ratios})
        assert rr.status_code == 200
        prev2 = requests.get(f"{API}/sessions/{s['id']}/preview-bill", headers=H).json()
        pp2 = {x["name"]: x for x in prev2["billing"]["per_player"]}
        assert abs(pp2["TEST_ITR8_A"]["share_percent"] - 66.67) < 0.05, pp2
        assert abs(pp2["TEST_ITR8_B"]["share_percent"] - 33.33) < 0.05, pp2
        # Cleanup: close so it doesn't block table for later tests
        requests.post(f"{API}/sessions/{s['id']}/close", headers=H, json={"payments": []})


# ============================================================
# 6. Regression: default admin login still ok, dashboard basics
# ============================================================
class TestRegression:
    def test_admin_login(self, admin_tok):
        assert admin_tok
        r = requests.get(f"{API}/auth/me", headers=_hdr(admin_tok))
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_cashier_no_backup(self, cashier_tok):
        r = requests.get(f"{API}/data/backup", headers=_hdr(cashier_tok))
        assert r.status_code == 403

    def test_admin_backup(self, admin_tok):
        r = requests.get(f"{API}/data/backup", headers=_hdr(admin_tok))
        assert r.status_code == 200
        assert "users" in r.json()
