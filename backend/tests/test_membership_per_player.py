import os, sys, json, requests
from datetime import datetime, timedelta, timezone

API = [l.split("=", 1)[1].strip() for l in open("/app/frontend/.env") if l.startswith("REACT_APP_BACKEND_URL")][0] + "/api"
tok = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "admin123"}).json()["token"]
H = {"Authorization": f"Bearer {tok}"}
g = lambda p, **kw: requests.get(f"{API}/{p}", headers=H, **kw).json()
post = lambda p, body: requests.post(f"{API}/{p}", headers=H, json=body).json()

busy = {s["current_table_id"] for s in g("sessions/active")}
tid = next(t["id"] for t in g("tables") if t["id"] not in busy)
mem = g("memberships")[0]
mp = post("players", {"name": "Member Mike", "membership_id": mem["id"]})["id"]
st = (datetime.now(timezone.utc) - timedelta(minutes=60)).isoformat()
s = post("sessions/open", {"table_id": tid, "player_name": "Member Mike", "player_id": mp, "start_time": st,
                           "players": [{"name": "Member Mike", "player_id": mp}, {"name": "Guest Gary"}]})
sid, gary = s["id"], s["players"][1]["id"]
b = g(f"sessions/{sid}/preview-bill")["billing"]
print("50/50: table", b["table_amount"], "memdisc", b["membership_discount"], "final", b["final_amount"])
for p in b["per_player"]:
    print("  ", p["name"], "share", p["table_share"], "disc", p["membership_discount"], "sub", p["subtotal"])
assert b["membership_discount"] == round(b["table_amount"] / 2 * mem["discount_percent"] / 100, 2)
b2 = g(f"sessions/{sid}/preview-bill", params={"table_payer_id": gary})["billing"]
print("Gary pays all: memdisc", b2["membership_discount"], "final", b2["final_amount"])
assert b2["membership_discount"] == 0
inv = post(f"sessions/{sid}/close", {"payments": [{"method": "cash", "amount": 0}], "table_payer_id": gary, "pay_full": True})
print("closed:", inv["final_amount"], inv["membership_discount"], inv["membership_name"])
assert inv["membership_discount"] == 0 and inv["final_amount"] == b2["final_amount"]
print("PASS")
