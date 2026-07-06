"""Tests for 4 recently-added features:
 1) Walk-in Snack Sale (fully paid, insufficient no player, insufficient w/ player=credit)
 2) Add player mid-session with prorated billing
 3) Single-player table payment via table_payer_id
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    assert tok
    return tok


@pytest.fixture(scope="module")
def H(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def inventory_item(H):
    # Get inventory list; if none in stock, create one
    r = requests.get(f"{API}/inventory", headers=H, timeout=15)
    assert r.status_code == 200
    items = [i for i in r.json() if i.get("stock", 0) > 5]
    if items:
        return items[0]
    # create
    r = requests.post(
        f"{API}/inventory",
        headers=H,
        json={"name": f"TEST_Snack_{uuid.uuid4().hex[:6]}", "selling_price": 20, "cost_price": 10, "stock": 100, "category": "snack"},
        timeout=15,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()


@pytest.fixture(scope="module")
def test_player(H):
    r = requests.post(
        f"{API}/players",
        headers=H,
        json={"name": f"TEST_Player_{uuid.uuid4().hex[:6]}", "mobile": "9" + str(uuid.uuid4().int)[:9]},
        timeout=15,
    )
    assert r.status_code in (200, 201), r.text
    return r.json()


@pytest.fixture(scope="module")
def table(H):
    r = requests.get(f"{API}/tables", headers=H, timeout=15)
    assert r.status_code == 200
    tables = r.json()
    assert tables, "No tables configured"
    # get active sessions to skip busy tables
    r2 = requests.get(f"{API}/sessions/active", headers=H, timeout=15)
    busy = {s.get("current_table_id") or s.get("table_id") for s in r2.json()} if r2.status_code == 200 else set()
    free = [t for t in tables if t["id"] not in busy]
    return free[0] if free else tables[0]


# -------------------- Auth --------------------
def test_admin_login_and_me(admin_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=10)
    assert r.status_code == 200
    assert r.json()["username"] == "admin"


# -------------------- Walk-in sale --------------------
class TestWalkInSale:
    def test_walkin_paid_full(self, H, inventory_item):
        stock_before = inventory_item["stock"]
        price = inventory_item["selling_price"]
        qty = 2
        total = round(price * qty, 2)
        r = requests.post(
            f"{API}/walk-in/sale",
            headers=H,
            json={
                "customer_name": "TEST_Walkin",
                "items": [{"item_id": inventory_item["id"], "qty": qty}],
                "payments": [{"method": "cash", "amount": total}],
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["walk_in"] is True
        assert inv["snacks_total"] == total
        assert inv["payment_status"] == "paid"
        assert inv["credit_amount"] == 0
        # verify stock decremented
        r2 = requests.get(f"{API}/inventory", headers=H, timeout=15)
        item2 = next(i for i in r2.json() if i["id"] == inventory_item["id"])
        assert item2["stock"] == stock_before - qty, f"stock={item2['stock']} expected {stock_before-qty}"

    def test_walkin_partial_no_player_rejected(self, H, inventory_item):
        price = inventory_item["selling_price"]
        r = requests.post(
            f"{API}/walk-in/sale",
            headers=H,
            json={
                "customer_name": "TEST_Walkin2",
                "items": [{"item_id": inventory_item["id"], "qty": 1}],
                "payments": [{"method": "cash", "amount": max(0, price - 10)}],  # partial
            },
            timeout=20,
        )
        assert r.status_code == 400, r.text
        assert "credit" in (r.text or "").lower() and "player" in (r.text or "").lower()

    def test_walkin_partial_with_player_creates_credit(self, H, inventory_item, test_player):
        price = inventory_item["selling_price"]
        qty = 1
        total = round(price * qty, 2)
        pay = max(0.0, total / 2)  # partial
        # get player's credit before
        r0 = requests.get(f"{API}/players/{test_player['id']}", headers=H, timeout=10)
        assert r0.status_code == 200
        cb_before = r0.json().get("credit_balance", 0)

        r = requests.post(
            f"{API}/walk-in/sale",
            headers=H,
            json={
                "customer_name": test_player["name"],
                "player_id": test_player["id"],
                "items": [{"item_id": inventory_item["id"], "qty": qty}],
                "payments": [{"method": "cash", "amount": pay}],
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["credit_amount"] > 0
        assert inv["payment_status"] in ("partial", "credit")
        assert inv["walk_in"] is True

        r1 = requests.get(f"{API}/players/{test_player['id']}", headers=H, timeout=10)
        cb_after = r1.json().get("credit_balance", 0)
        assert round(cb_after - cb_before, 2) == round(inv["credit_amount"], 2)


# -------------------- Add player mid-session + presence weighting --------------------
class TestAddPlayerAndPresence:
    def test_add_player_and_preview_prorated(self, H, table):
        # open session with 1 player
        p1_name = f"TEST_P1_{uuid.uuid4().hex[:5]}"
        r = requests.post(
            f"{API}/sessions/open",
            headers=H,
            json={
                "table_id": table["id"],
                "player_name": p1_name,
                "num_players": 1,
                "players": [{"name": p1_name, "mobile": "", "ratio": 1}],
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        session = r.json()
        sid = session["id"]

        # wait so second player joins later
        time.sleep(4)

        # add player 2
        p2_name = f"TEST_P2_{uuid.uuid4().hex[:5]}"
        r = requests.post(
            f"{API}/sessions/{sid}/add-player",
            headers=H,
            json={"name": p2_name, "mobile": "", "ratio": 1},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        new_p = r.json()
        assert new_p["name"] == p2_name
        assert new_p.get("joined_at")

        time.sleep(2)

        # preview bill
        r = requests.get(f"{API}/sessions/{sid}/preview-bill", headers=H, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        pp = data["billing"]["per_player"]
        assert len(pp) == 2
        by_name = {x["name"]: x for x in pp}
        assert by_name[p1_name]["presence_seconds"] > by_name[p2_name]["presence_seconds"]
        # with equal ratio, player1 table_share should be > player2's table_share
        # (unless table_amount = 0 due to rate 0)
        if data["billing"]["table_amount"] > 0:
            assert by_name[p1_name]["table_share"] > by_name[p2_name]["table_share"]

        # Test single-player table payment via close
        # Ensure enough final_amount by waiting a tiny bit or just close now
        table_payer = pp[0]  # player 1 pays
        payer_id = table_payer["player_local_id"]
        # Fetch current final estimate
        final_est = data["billing"]["final_amount"]

        r = requests.post(
            f"{API}/sessions/{sid}/close",
            headers=H,
            json={
                "manual_discount": 0,
                "apply_membership_to_snacks": False,
                "payments": [{"method": "cash", "amount": final_est + 100}],  # pay in full+buffer
                "table_payer_id": payer_id,
            },
            timeout=20,
        )
        assert r.status_code == 200, r.text
        inv = r.json()
        per = {x["player_local_id"]: x for x in inv["per_player"]}
        assert round(per[payer_id]["table_share"], 2) == round(inv["table_amount"], 2)
        for pid, row in per.items():
            if pid != payer_id:
                assert row["table_share"] == 0.0, f"other player got table_share={row['table_share']}"
