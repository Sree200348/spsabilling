"""Iteration 6 fix retests:
- preview-bill accepts table_payer_id
- close_session with pay_full=True tops up first payment (no linked player OK)
- close_session with pay_full=False and underpayment on unlinked session -> 400
"""
import os, time, uuid, requests, pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def H():
    r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"}


def _free_table(H):
    r = requests.get(f"{API}/tables", headers=H, timeout=15); r.raise_for_status()
    tables = r.json()
    ra = requests.get(f"{API}/sessions/active", headers=H, timeout=15)
    busy = {s.get("current_table_id") for s in ra.json()} if ra.status_code == 200 else set()
    free = [t for t in tables if t["id"] not in busy]
    assert free, "no free tables"
    return free[0]


def _open_multi(H, n=2, start_offset_secs=0):
    t = _free_table(H)
    # Backdate start_time to ensure billable time > 0
    from datetime import datetime, timezone, timedelta
    start_iso = (datetime.now(timezone.utc) - timedelta(seconds=start_offset_secs)).isoformat()
    players = [{"name": f"TEST_ITR6_P{i}_{uuid.uuid4().hex[:4]}", "mobile": "", "ratio": 1} for i in range(n)]
    r = requests.post(
        f"{API}/sessions/open",
        headers=H,
        json={
            "table_id": t["id"],
            "player_name": players[0]["name"],
            "num_players": n,
            "players": players,
            "start_time": start_iso,
        },
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()


# ----- Fix 1: preview-bill accepts table_payer_id -----
@pytest.mark.parametrize("num_players", [2, 3])
def test_preview_bill_with_table_payer_id(H, num_players):
    s = _open_multi(H, n=num_players, start_offset_secs=120)  # 2 mins in the past
    sid = s["id"]
    try:
        # Default preview (split by ratio)
        r = requests.get(f"{API}/sessions/{sid}/preview-bill", headers=H, timeout=15)
        assert r.status_code == 200
        billing = r.json()["billing"]
        table_amt = billing["table_amount"]
        assert table_amt > 0, "need nonzero table amount"
        pp = billing["per_player"]
        assert len(pp) == num_players
        # Default: all should have > 0 table_share (split)
        for row in pp:
            assert row["table_share"] > 0

        # Now request preview with table_payer_id = first player
        payer = pp[0]
        r2 = requests.get(
            f"{API}/sessions/{sid}/preview-bill",
            headers=H,
            params={"table_payer_id": payer["player_local_id"]},
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        pp2 = r2.json()["billing"]["per_player"]
        by_id = {x["player_local_id"]: x for x in pp2}
        # Selected payer gets full table amount
        assert round(by_id[payer["player_local_id"]]["table_share"], 2) == round(r2.json()["billing"]["table_amount"], 2)
        # Others get 0 table_share
        for pid, row in by_id.items():
            if pid != payer["player_local_id"]:
                assert row["table_share"] == 0.0, f"other={row['table_share']}"
            # snacks_share should still be per-player (0 here since no snacks)
            assert "snacks_share" in row
    finally:
        # Cleanup: close session
        requests.post(f"{API}/sessions/{sid}/close", headers=H, json={"payments": [{"method": "cash", "amount": 999999}], "pay_full": True}, timeout=15)


# ----- Fix 2: pay_full=True tops up first payment; no linked player OK -----
def test_close_pay_full_tops_up_no_linked_player(H):
    s = _open_multi(H, n=2, start_offset_secs=180)
    sid = s["id"]
    # Confirm no linked player_id on session
    assert not s.get("player_id"), f"sanity: session unexpectedly linked to player {s.get('player_id')}"
    # Deliberately underpay by a huge amount, then let server top up
    r = requests.post(
        f"{API}/sessions/{sid}/close",
        headers=H,
        json={"payments": [{"method": "cash", "amount": 1.0}], "pay_full": True},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    inv = r.json()
    assert inv["credit_amount"] == 0, f"credit={inv['credit_amount']}"
    assert inv["payment_status"] == "paid"
    assert round(inv["amount_paid"], 2) == round(inv["final_amount"], 2)
    # And single payment method reflects the topped-up amount
    assert len(inv["payments"]) == 1
    assert round(inv["payments"][0]["amount"], 2) == round(inv["final_amount"], 2)


# ----- Fix 3: regression - pay_full=False + underpay + no linked player -> 400 -----
def test_close_underpay_no_linked_player_still_rejected(H):
    s = _open_multi(H, n=2, start_offset_secs=180)
    sid = s["id"]
    assert not s.get("player_id")
    r = requests.post(
        f"{API}/sessions/{sid}/close",
        headers=H,
        json={"payments": [{"method": "cash", "amount": 1.0}]},  # pay_full defaults to False
        timeout=20,
    )
    assert r.status_code == 400, r.text
    assert "credit" in r.text.lower() and "player" in r.text.lower()
    # Cleanup: close for real
    requests.post(f"{API}/sessions/{sid}/close", headers=H, json={"payments": [{"method": "cash", "amount": 999999}], "pay_full": True}, timeout=15)
