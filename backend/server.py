"""South Point Snooker Academy - Billing & Management API."""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

# ---------- App / DB Setup ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="South Point Snooker Academy")
api = APIRouter(prefix="/api")

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = "HS256"
JWT_EXP_HOURS = 24 * 7

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("snooker")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Auth Helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": now_utc() + timedelta(hours=JWT_EXP_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


# ---------- Audit Log ----------
async def audit(user: Optional[dict], action: str, entity_type: str = "", entity_id: str = "", details: Optional[dict] = None):
    doc = {
        "id": new_id(),
        "user_id": (user or {}).get("id"),
        "username": (user or {}).get("username", "system"),
        "role": (user or {}).get("role", ""),
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
        "created_at": iso(now_utc()),
    }
    await db.audit_logs.insert_one(doc)


# ---------- Models ----------
class LoginReq(BaseModel):
    username: str
    password: str


class TableIn(BaseModel):
    name: str
    hourly_rate: float


class PlayerIn(BaseModel):
    name: str
    mobile: Optional[str] = ""
    email: Optional[str] = ""
    membership_id: Optional[str] = None
    membership_start: Optional[str] = None
    membership_end: Optional[str] = None
    notes: Optional[str] = ""


class MembershipIn(BaseModel):
    name: str
    discount_percent: float
    validity_days: int = 365
    active: bool = True
    apply_to_snacks: bool = False


class InventoryIn(BaseModel):
    name: str
    selling_price: float
    cost_price: float = 0
    stock: int = 0
    low_stock_alert: int = 5


class SessionPlayerIn(BaseModel):
    name: str
    mobile: Optional[str] = ""
    player_id: Optional[str] = None
    ratio: float = 1.0


class OpenSessionReq(BaseModel):
    table_id: str
    player_name: str
    mobile: Optional[str] = ""
    player_id: Optional[str] = None
    num_players: int = 1
    remarks: Optional[str] = ""
    start_time: Optional[str] = None  # ISO
    players: List[SessionPlayerIn] = []  # multi-player list


class SnackAddReq(BaseModel):
    item_id: str
    qty: int = 1
    assigned_to: Optional[str] = None  # local session player id or None (shared)


class RatiosReq(BaseModel):
    ratios: Dict[str, float]


class SwitchReq(BaseModel):
    new_table_id: str


class AttachPlayerReq(BaseModel):
    player_id: str


class PaymentSplit(BaseModel):
    method: str  # cash | upi | card | credit
    amount: float


class CloseReq(BaseModel):
    manual_discount: float = 0
    apply_membership_to_snacks: bool = False
    payments: List[PaymentSplit] = []
    end_time: Optional[str] = None


class CreditPaymentReq(BaseModel):
    player_id: str
    amount: float
    method: str = "cash"
    remarks: Optional[str] = ""
    invoice_id: Optional[str] = None


class SettingsIn(BaseModel):
    business_name: str
    address: str = ""
    phone: str = ""
    invoice_footer: str = ""
    currency: str = "₹"
    tax_percent: float = 0


class UserIn(BaseModel):
    username: str
    password: Optional[str] = None
    role: str = "cashier"
    name: Optional[str] = ""


# ---------- Billing Utility ----------
def _entry_billable_seconds(entry: dict, ref_time: Optional[datetime] = None) -> int:
    start = datetime.fromisoformat(entry["start_time"])
    end_str = entry.get("end_time")
    end = datetime.fromisoformat(end_str) if end_str else (ref_time or now_utc())
    total = (end - start).total_seconds()
    pause_secs = 0
    for p in entry.get("pauses", []):
        p_start = datetime.fromisoformat(p["start"])
        p_end_str = p.get("end")
        p_end = datetime.fromisoformat(p_end_str) if p_end_str else (ref_time or now_utc())
        pause_secs += (p_end - p_start).total_seconds()
    return max(0, int(total - pause_secs))


def compute_session_billing(session: dict, membership: Optional[dict] = None, manual_discount: float = 0,
                            apply_membership_to_snacks: bool = False, ref_time: Optional[datetime] = None) -> dict:
    entries_billing = []
    total_table_amount = 0.0
    total_billable_secs = 0
    total_paused_secs = 0
    total_session_secs = 0

    for e in session.get("entries", []):
        start = datetime.fromisoformat(e["start_time"])
        end_str = e.get("end_time")
        end = datetime.fromisoformat(end_str) if end_str else (ref_time or now_utc())
        sess_secs = int((end - start).total_seconds())
        billable_secs = _entry_billable_seconds(e, ref_time=ref_time)
        paused_secs = sess_secs - billable_secs
        rate = float(e.get("hourly_rate", 0))
        amount = round(rate / 3600 * billable_secs, 2)
        entries_billing.append({
            "table_id": e["table_id"],
            "table_name": e["table_name"],
            "hourly_rate": rate,
            "start_time": e["start_time"],
            "end_time": iso(end) if not end_str else end_str,
            "session_seconds": sess_secs,
            "paused_seconds": paused_secs,
            "billable_seconds": billable_secs,
            "amount": amount,
        })
        total_table_amount += amount
        total_billable_secs += billable_secs
        total_paused_secs += paused_secs
        total_session_secs += sess_secs

    snacks_total = round(sum(s["total"] for s in session.get("snacks", [])), 2)

    mem_pct = float(membership["discount_percent"]) if membership else 0
    membership_discount = round(total_table_amount * mem_pct / 100, 2)
    snacks_discount = round(snacks_total * mem_pct / 100, 2) if (membership and apply_membership_to_snacks) else 0
    manual_discount = round(float(manual_discount or 0), 2)

    final = round(total_table_amount - membership_discount + snacks_total - snacks_discount - manual_discount, 2)
    if final < 0:
        final = 0.0

    # Per-player breakdown
    players_list = session.get("players", []) or []
    per_player = []
    if players_list:
        total_ratio = sum(max(0.0, float(p.get("ratio", 1))) for p in players_list) or 1.0
        for pl in players_list:
            share_ratio = max(0.0, float(pl.get("ratio", 1))) / total_ratio
            table_share = round(total_table_amount * share_ratio, 2)
            # Snacks: sum items assigned to this player + shared items prorated by ratio
            direct = 0.0
            shared = 0.0
            for s in session.get("snacks", []):
                if s.get("assigned_to") == pl["id"]:
                    direct += s["total"]
                elif not s.get("assigned_to"):
                    shared += s["total"]
            snack_share = round(direct + shared * share_ratio, 2)
            # Membership discount only if player has own membership_id resolved separately.
            # For preview we look up by player_id if provided in this player.
            p_final = round(table_share + snack_share, 2)
            per_player.append({
                "player_local_id": pl["id"],
                "player_id": pl.get("player_id"),
                "name": pl.get("name"),
                "ratio": pl.get("ratio", 1),
                "share_percent": round(share_ratio * 100, 2),
                "table_share": table_share,
                "snacks_share": snack_share,
                "subtotal": p_final,
            })

    return {
        "entries": entries_billing,
        "table_amount": round(total_table_amount, 2),
        "snacks_total": snacks_total,
        "membership_discount": membership_discount,
        "snacks_discount": snacks_discount,
        "manual_discount": manual_discount,
        "final_amount": final,
        "total_session_seconds": total_session_secs,
        "total_billable_seconds": total_billable_secs,
        "total_paused_seconds": total_paused_secs,
        "membership_percent": mem_pct,
        "per_player": per_player,
    }


# ---------- Auth Endpoints ----------
@api.post("/auth/login")
async def login(body: LoginReq):
    user = await db.users.find_one({"username": body.username.lower()})
    if not user or not verify_pw(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = create_token(user["id"], user["username"], user["role"])
    await audit({"id": user["id"], "username": user["username"], "role": user["role"]}, "login", "user", user["id"])
    return {
        "token": token,
        "user": {"id": user["id"], "username": user["username"], "role": user["role"], "name": user.get("name", "")},
    }


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------- Users (admin) ----------
@api.get("/users")
async def list_users(_: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@api.post("/users")
async def create_user(body: UserIn, _: dict = Depends(require_admin)):
    if not body.password:
        raise HTTPException(400, "Password required")
    if await db.users.find_one({"username": body.username.lower()}):
        raise HTTPException(400, "Username exists")
    doc = {
        "id": new_id(),
        "username": body.username.lower(),
        "password_hash": hash_pw(body.password),
        "role": body.role,
        "name": body.name or "",
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash")
    doc.pop("_id", None)
    return doc


@api.put("/users/{uid}")
async def update_user(uid: str, body: UserIn, _: dict = Depends(require_admin)):
    update = {"role": body.role, "name": body.name or ""}
    if body.password:
        update["password_hash"] = hash_pw(body.password)
    res = await db.users.update_one({"id": uid}, {"$set": update})
    if not res.matched_count:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@api.delete("/users/{uid}")
async def delete_user(uid: str, current: dict = Depends(require_admin)):
    if uid == current["id"]:
        raise HTTPException(400, "Cannot delete self")
    await db.users.delete_one({"id": uid})
    return {"ok": True}


# ---------- Tables ----------
@api.get("/tables")
async def list_tables(_: dict = Depends(get_current_user)):
    return await db.tables.find({}, {"_id": 0}).sort("order", 1).to_list(1000)


@api.post("/tables")
async def create_table(body: TableIn, _: dict = Depends(require_admin)):
    count = await db.tables.count_documents({})
    doc = {"id": new_id(), "name": body.name, "hourly_rate": body.hourly_rate, "order": count}
    await db.tables.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/tables/{tid}")
async def update_table(tid: str, body: TableIn, _: dict = Depends(require_admin)):
    res = await db.tables.update_one({"id": tid}, {"$set": {"name": body.name, "hourly_rate": body.hourly_rate}})
    if not res.matched_count:
        raise HTTPException(404, "Table not found")
    return {"ok": True}


@api.delete("/tables/{tid}")
async def delete_table(tid: str, _: dict = Depends(require_admin)):
    active = await db.sessions.find_one({"status": {"$in": ["running", "paused"]}, "current_table_id": tid})
    if active:
        raise HTTPException(400, "Table has active session")
    await db.tables.delete_one({"id": tid})
    return {"ok": True}


# ---------- Memberships ----------
@api.get("/memberships")
async def list_memberships(_: dict = Depends(get_current_user)):
    return await db.memberships.find({}, {"_id": 0}).to_list(1000)


@api.post("/memberships")
async def create_membership(body: MembershipIn, _: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump()}
    await db.memberships.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/memberships/{mid}")
async def update_membership(mid: str, body: MembershipIn, _: dict = Depends(require_admin)):
    res = await db.memberships.update_one({"id": mid}, {"$set": body.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/memberships/{mid}")
async def delete_membership(mid: str, _: dict = Depends(require_admin)):
    await db.memberships.delete_one({"id": mid})
    return {"ok": True}


# ---------- Inventory ----------
@api.get("/inventory")
async def list_inventory(_: dict = Depends(get_current_user)):
    return await db.inventory.find({}, {"_id": 0}).sort("name", 1).to_list(1000)


@api.get("/inventory/low-stock")
async def low_stock(_: dict = Depends(get_current_user)):
    items = await db.inventory.find({}, {"_id": 0}).to_list(1000)
    return [i for i in items if i["stock"] <= i.get("low_stock_alert", 0)]


@api.post("/inventory")
async def create_inventory(body: InventoryIn, _: dict = Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump()}
    await db.inventory.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/inventory/{iid}")
async def update_inventory(iid: str, body: InventoryIn, _: dict = Depends(require_admin)):
    res = await db.inventory.update_one({"id": iid}, {"$set": body.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/inventory/{iid}")
async def delete_inventory(iid: str, _: dict = Depends(require_admin)):
    await db.inventory.delete_one({"id": iid})
    return {"ok": True}


# ---------- Players ----------
@api.get("/players")
async def list_players(q: Optional[str] = None, _: dict = Depends(get_current_user)):
    query = {}
    if q:
        query = {"$or": [{"name": {"$regex": q, "$options": "i"}}, {"mobile": {"$regex": q}}]}
    return await db.players.find(query, {"_id": 0}).sort("name", 1).to_list(2000)


@api.post("/players")
async def create_player(body: PlayerIn, _: dict = Depends(get_current_user)):
    doc = {
        "id": new_id(),
        **body.model_dump(),
        "credit_balance": 0.0,
        "total_visits": 0,
        "total_spent": 0.0,
        "created_at": iso(now_utc()),
    }
    await db.players.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/players/{pid}")
async def get_player(pid: str, _: dict = Depends(get_current_user)):
    p = await db.players.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    return p


@api.put("/players/{pid}")
async def update_player(pid: str, body: PlayerIn, _: dict = Depends(get_current_user)):
    res = await db.players.update_one({"id": pid}, {"$set": body.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "Not found")
    return {"ok": True}


@api.delete("/players/{pid}")
async def delete_player(pid: str, _: dict = Depends(require_admin)):
    await db.players.delete_one({"id": pid})
    return {"ok": True}


@api.get("/players/{pid}/history")
async def player_history(pid: str, _: dict = Depends(get_current_user)):
    return await db.invoices.find({"player_id": pid}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/players/{pid}/credit")
async def player_credit(pid: str, _: dict = Depends(get_current_user)):
    invoices = await db.invoices.find({"player_id": pid, "credit_amount": {"$gt": 0}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    payments = await db.credit_payments.find({"player_id": pid}, {"_id": 0}).sort("created_at", -1).to_list(500)
    p = await db.players.find_one({"id": pid}, {"_id": 0})
    return {"player": p, "credit_invoices": invoices, "payments": payments}


# ---------- Sessions ----------
async def _get_active_membership(player: dict) -> Optional[dict]:
    if not player or not player.get("membership_id"):
        return None
    mem = await db.memberships.find_one({"id": player["membership_id"]}, {"_id": 0})
    if not mem or not mem.get("active"):
        return None
    end = player.get("membership_end")
    if end:
        try:
            if datetime.fromisoformat(end) < now_utc():
                return None
        except Exception:
            pass
    return mem


@api.get("/sessions/active")
async def active_sessions(_: dict = Depends(get_current_user)):
    return await db.sessions.find({"status": {"$in": ["running", "paused"]}}, {"_id": 0}).to_list(200)


@api.post("/sessions/open")
async def open_session(body: OpenSessionReq, _: dict = Depends(get_current_user)):
    table = await db.tables.find_one({"id": body.table_id}, {"_id": 0})
    if not table:
        raise HTTPException(404, "Table not found")
    existing = await db.sessions.find_one({"current_table_id": body.table_id, "status": {"$in": ["running", "paused"]}})
    if existing:
        raise HTTPException(400, "Table is occupied")
    start_time = body.start_time or iso(now_utc())
    entry = {
        "table_id": table["id"],
        "table_name": table["name"],
        "hourly_rate": table["hourly_rate"],
        "start_time": start_time,
        "end_time": None,
        "pauses": [],
    }
    # Build multi-player list. If none supplied, create one entry from primary.
    players_list = []
    if body.players:
        for p in body.players:
            players_list.append({
                "id": new_id(),
                "name": p.name,
                "mobile": p.mobile or "",
                "player_id": p.player_id,
                "ratio": max(0.0, float(p.ratio or 1.0)),
            })
    else:
        players_list.append({
            "id": new_id(),
            "name": body.player_name,
            "mobile": body.mobile or "",
            "player_id": body.player_id,
            "ratio": 1.0,
        })
    session = {
        "id": new_id(),
        "player_id": body.player_id or (players_list[0].get("player_id") if players_list else None),
        "player_name": body.player_name or players_list[0]["name"],
        "player_mobile": body.mobile or players_list[0].get("mobile", ""),
        "num_players": body.num_players or len(players_list),
        "remarks": body.remarks or "",
        "entries": [entry],
        "current_table_id": table["id"],
        "snacks": [],
        "players": players_list,
        "status": "running",
        "created_at": iso(now_utc()),
    }
    await db.sessions.insert_one(session)
    await audit(_, "session_open", "session", session["id"], {"table": table["name"], "player": session["player_name"], "players": [p["name"] for p in players_list]})
    session.pop("_id", None)
    return session


@api.get("/sessions/{sid}")
async def get_session(sid: str, _: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Not found")
    return s


@api.post("/sessions/{sid}/pause")
async def pause_session(sid: str, _: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid})
    if not s or s["status"] != "running":
        raise HTTPException(400, "Session not running")
    entries = s["entries"]
    entries[-1].setdefault("pauses", []).append({"start": iso(now_utc()), "end": None})
    await db.sessions.update_one({"id": sid}, {"$set": {"entries": entries, "status": "paused"}})
    await audit(_, "session_pause", "session", sid)
    return {"ok": True}


@api.post("/sessions/{sid}/resume")
async def resume_session(sid: str, _: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid})
    if not s or s["status"] != "paused":
        raise HTTPException(400, "Session not paused")
    entries = s["entries"]
    pauses = entries[-1].get("pauses", [])
    if pauses and not pauses[-1].get("end"):
        pauses[-1]["end"] = iso(now_utc())
    await db.sessions.update_one({"id": sid}, {"$set": {"entries": entries, "status": "running"}})
    await audit(_, "session_resume", "session", sid)
    return {"ok": True}


@api.post("/sessions/{sid}/switch")
async def switch_table(sid: str, body: SwitchReq, _: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid})
    if not s or s["status"] not in ("running", "paused"):
        raise HTTPException(400, "Session not active")
    new_table = await db.tables.find_one({"id": body.new_table_id}, {"_id": 0})
    if not new_table:
        raise HTTPException(404, "New table not found")
    occupied = await db.sessions.find_one({"current_table_id": body.new_table_id, "status": {"$in": ["running", "paused"]}, "id": {"$ne": sid}})
    if occupied:
        raise HTTPException(400, "New table is occupied")
    entries = s["entries"]
    # Close current entry: end any active pause and set end_time
    now = iso(now_utc())
    pauses = entries[-1].get("pauses", [])
    if pauses and not pauses[-1].get("end"):
        pauses[-1]["end"] = now
    entries[-1]["end_time"] = now
    # New entry
    entries.append({
        "table_id": new_table["id"],
        "table_name": new_table["name"],
        "hourly_rate": new_table["hourly_rate"],
        "start_time": now,
        "end_time": None,
        "pauses": [],
    })
    await db.sessions.update_one({"id": sid}, {"$set": {"entries": entries, "current_table_id": new_table["id"], "status": "running"}})
    await audit(_, "session_switch", "session", sid, {"to": new_table["name"]})
    return {"ok": True}


@api.post("/sessions/{sid}/snacks")
async def add_snack(sid: str, body: SnackAddReq, _: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid})
    if not s or s["status"] not in ("running", "paused"):
        raise HTTPException(400, "Session not active")
    item = await db.inventory.find_one({"id": body.item_id})
    if not item:
        raise HTTPException(404, "Item not found")
    if body.qty <= 0:
        raise HTTPException(400, "Qty must be > 0")
    if item["stock"] < body.qty:
        raise HTTPException(400, f"Only {item['stock']} in stock")
    snack = {
        "id": new_id(),
        "item_id": item["id"],
        "name": item["name"],
        "qty": body.qty,
        "price": item["selling_price"],
        "total": round(item["selling_price"] * body.qty, 2),
        "added_at": iso(now_utc()),
        "assigned_to": body.assigned_to or None,
    }
    snacks = s.get("snacks", []) + [snack]
    await db.sessions.update_one({"id": sid}, {"$set": {"snacks": snacks}})
    await db.inventory.update_one({"id": item["id"]}, {"$inc": {"stock": -body.qty}})
    new_item = await db.inventory.find_one({"id": item["id"]}, {"_id": 0})
    low = new_item["stock"] <= new_item.get("low_stock_alert", 0)
    return {"snack": snack, "low_stock": low, "stock_left": new_item["stock"]}


@api.delete("/sessions/{sid}/snacks/{snack_id}")
async def remove_snack(sid: str, snack_id: str, _: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Not found")
    snacks = s.get("snacks", [])
    target = next((x for x in snacks if x["id"] == snack_id), None)
    if not target:
        raise HTTPException(404, "Snack not found")
    snacks = [x for x in snacks if x["id"] != snack_id]
    await db.sessions.update_one({"id": sid}, {"$set": {"snacks": snacks}})
    await db.inventory.update_one({"id": target["item_id"]}, {"$inc": {"stock": target["qty"]}})
    return {"ok": True}


@api.post("/sessions/{sid}/attach-player")
async def attach_player(sid: str, body: AttachPlayerReq, _: dict = Depends(get_current_user)):
    p = await db.players.find_one({"id": body.player_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Player not found")
    await db.sessions.update_one({"id": sid}, {"$set": {"player_id": p["id"], "player_name": p["name"], "player_mobile": p.get("mobile", "")}})
    return {"ok": True}


@api.post("/sessions/{sid}/ratios")
async def update_ratios(sid: str, body: RatiosReq, _: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Not found")
    players = s.get("players", [])
    for p in players:
        if p["id"] in body.ratios:
            p["ratio"] = max(0.0, float(body.ratios[p["id"]] or 1))
    await db.sessions.update_one({"id": sid}, {"$set": {"players": players}})
    return {"ok": True, "players": players}


@api.get("/sessions/{sid}/preview-bill")
async def preview_bill(sid: str, apply_membership_to_snacks: bool = False, manual_discount: float = 0, _: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid}, {"_id": 0})
    if not s:
        raise HTTPException(404, "Not found")
    membership = None
    if s.get("player_id"):
        p = await db.players.find_one({"id": s["player_id"]}, {"_id": 0})
        membership = await _get_active_membership(p) if p else None
    billing = compute_session_billing(s, membership=membership, manual_discount=manual_discount, apply_membership_to_snacks=apply_membership_to_snacks)
    return {"session": s, "membership": membership, "billing": billing}


async def _next_invoice_number() -> str:
    counter = await db.counters.find_one_and_update(
        {"id": "invoice"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    seq = counter["seq"] if counter else 1
    return f"INV-{now_utc().strftime('%Y%m%d')}-{seq:04d}"


@api.post("/sessions/{sid}/close")
async def close_session(sid: str, body: CloseReq, user: dict = Depends(get_current_user)):
    s = await db.sessions.find_one({"id": sid})
    if not s or s["status"] not in ("running", "paused"):
        raise HTTPException(400, "Session not active")
    entries = s["entries"]
    end_time = body.end_time or iso(now_utc())
    # close pause if paused
    pauses = entries[-1].get("pauses", [])
    if pauses and not pauses[-1].get("end"):
        pauses[-1]["end"] = end_time
    entries[-1]["end_time"] = end_time

    player = await db.players.find_one({"id": s.get("player_id")}, {"_id": 0}) if s.get("player_id") else None
    membership = await _get_active_membership(player) if player else None

    billing = compute_session_billing(
        {**s, "entries": entries},
        membership=membership,
        manual_discount=body.manual_discount,
        apply_membership_to_snacks=body.apply_membership_to_snacks,
        ref_time=datetime.fromisoformat(end_time),
    )

    total_paid = round(sum(p.amount for p in body.payments), 2)
    final = billing["final_amount"]
    credit_amount = round(max(0.0, final - total_paid), 2)

    if credit_amount > 0 and not player:
        raise HTTPException(400, "Credit requires a linked player")

    if total_paid == 0:
        payment_status = "credit" if credit_amount > 0 else "paid"
    elif credit_amount > 0:
        payment_status = "partial"
    elif len(body.payments) > 1:
        payment_status = "split"
    else:
        payment_status = "paid"

    invoice_number = await _next_invoice_number()
    invoice = {
        "id": new_id(),
        "invoice_number": invoice_number,
        "session_id": sid,
        "player_id": s.get("player_id"),
        "player_name": s.get("player_name"),
        "player_mobile": s.get("player_mobile"),
        "entries": billing["entries"],
        "snacks": s.get("snacks", []),
        "table_amount": billing["table_amount"],
        "snacks_total": billing["snacks_total"],
        "membership_id": membership["id"] if membership else None,
        "membership_name": membership["name"] if membership else None,
        "membership_percent": billing["membership_percent"],
        "membership_discount": billing["membership_discount"],
        "snacks_discount": billing["snacks_discount"],
        "manual_discount": billing["manual_discount"],
        "final_amount": final,
        "payments": [p.model_dump() for p in body.payments],
        "amount_paid": total_paid,
        "credit_amount": credit_amount,
        "payment_status": payment_status,
        "total_session_seconds": billing["total_session_seconds"],
        "total_billable_seconds": billing["total_billable_seconds"],
        "total_paused_seconds": billing["total_paused_seconds"],
        "per_player": billing["per_player"],
        "created_at": iso(now_utc()),
        "created_by": user["username"],
    }
    await db.invoices.insert_one(invoice)

    await db.sessions.update_one({"id": sid}, {"$set": {
        "status": "closed",
        "entries": entries,
        "closed_at": end_time,
        "invoice_id": invoice["id"],
    }})

    if player:
        await db.players.update_one({"id": player["id"]}, {
            "$inc": {"total_visits": 1, "total_spent": final, "credit_balance": credit_amount}
        })

    await audit(user, "session_close", "invoice", invoice["id"], {
        "invoice": invoice_number, "final": final, "paid": total_paid, "credit": credit_amount, "player": s.get("player_name")
    })

    invoice.pop("_id", None)
    return invoice


# ---------- Invoices ----------
@api.get("/invoices")
async def list_invoices(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    player_id: Optional[str] = None,
    table_id: Optional[str] = None,
    payment_method: Optional[str] = None,
    payment_status: Optional[str] = None,
    _: dict = Depends(get_current_user),
):
    q: Dict[str, Any] = {}
    if from_date or to_date:
        q["created_at"] = {}
        if from_date:
            q["created_at"]["$gte"] = from_date
        if to_date:
            q["created_at"]["$lte"] = to_date
    if player_id:
        q["player_id"] = player_id
    if payment_status:
        q["payment_status"] = payment_status
    invoices = await db.invoices.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    if table_id:
        invoices = [i for i in invoices if any(e["table_id"] == table_id for e in i["entries"])]
    if payment_method:
        invoices = [i for i in invoices if any(p["method"] == payment_method for p in i.get("payments", []))]
    return invoices


@api.get("/invoices/{iid}")
async def get_invoice(iid: str, _: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": iid}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Not found")
    return inv


# ---------- Credit ----------
@api.get("/credit/pending")
async def credit_pending(_: dict = Depends(get_current_user)):
    players = await db.players.find({"credit_balance": {"$gt": 0}}, {"_id": 0}).to_list(1000)
    total = round(sum(p["credit_balance"] for p in players), 2)
    return {"total_pending": total, "players": players}


@api.get("/credit/history")
async def credit_history(player_id: Optional[str] = None, from_date: Optional[str] = None, to_date: Optional[str] = None, _: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if player_id:
        q["player_id"] = player_id
    if from_date or to_date:
        q["created_at"] = {}
        if from_date:
            q["created_at"]["$gte"] = from_date
        if to_date:
            q["created_at"]["$lte"] = to_date
    payments = await db.credit_payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    invoices = await db.invoices.find({**q, "credit_amount": {"$gt": 0}}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"credit_invoices": invoices, "payments": payments}


@api.post("/credit/payment")
async def credit_payment(body: CreditPaymentReq, user: dict = Depends(get_current_user)):
    p = await db.players.find_one({"id": body.player_id})
    if not p:
        raise HTTPException(404, "Player not found")
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be > 0")
    doc = {
        "id": new_id(),
        "player_id": body.player_id,
        "player_name": p.get("name"),
        "amount": round(body.amount, 2),
        "method": body.method,
        "remarks": body.remarks or "",
        "invoice_id": body.invoice_id,
        "created_at": iso(now_utc()),
        "created_by": user["username"],
    }
    await db.credit_payments.insert_one(doc)
    await db.players.update_one({"id": body.player_id}, {"$inc": {"credit_balance": -round(body.amount, 2)}})
    await audit(user, "credit_payment", "player", body.player_id, {"amount": body.amount, "method": body.method})
    doc.pop("_id", None)
    return doc


# ---------- Audit Log Endpoint ----------
@api.get("/audit/logs")
async def audit_logs(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    username: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 500,
    _: dict = Depends(require_admin),
):
    q: Dict[str, Any] = {}
    if from_date or to_date:
        q["created_at"] = {}
        if from_date:
            q["created_at"]["$gte"] = from_date
        if to_date:
            q["created_at"]["$lte"] = to_date
    if username:
        q["username"] = username
    if action:
        q["action"] = action
    return await db.audit_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 2000))


# ---------- Reports ----------
@api.get("/reports")
async def reports(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    table_id: Optional[str] = None,
    player_id: Optional[str] = None,
    payment_method: Optional[str] = None,
    payment_status: Optional[str] = None,
    _: dict = Depends(get_current_user),
):
    invoices = await list_invoices(from_date, to_date, player_id, table_id, payment_method, payment_status, _)
    total_table_rev = round(sum(i["table_amount"] for i in invoices), 2)
    total_snacks_rev = round(sum(i["snacks_total"] for i in invoices), 2)
    total_discount = round(sum(i["membership_discount"] + i["snacks_discount"] + i["manual_discount"] for i in invoices), 2)
    total_credit_gen = round(sum(i["credit_amount"] for i in invoices), 2)
    grand_total = round(sum(i["final_amount"] for i in invoices), 2)

    by_method: Dict[str, float] = {}
    for i in invoices:
        for p in i.get("payments", []):
            by_method[p["method"]] = round(by_method.get(p["method"], 0) + p["amount"], 2)

    # credit received in period
    q_pay: Dict[str, Any] = {}
    if from_date or to_date:
        q_pay["created_at"] = {}
        if from_date:
            q_pay["created_at"]["$gte"] = from_date
        if to_date:
            q_pay["created_at"]["$lte"] = to_date
    if player_id:
        q_pay["player_id"] = player_id
    credit_payments = await db.credit_payments.find(q_pay, {"_id": 0}).to_list(2000)
    total_credit_received = round(sum(c["amount"] for c in credit_payments), 2)

    # by table
    table_usage: Dict[str, Dict[str, Any]] = {}
    for i in invoices:
        for e in i["entries"]:
            t = table_usage.setdefault(e["table_id"], {"table_name": e["table_name"], "sessions": 0, "revenue": 0, "seconds": 0})
            t["sessions"] += 1
            t["revenue"] = round(t["revenue"] + e["amount"], 2)
            t["seconds"] += e["billable_seconds"]

    # top players
    player_spend: Dict[str, Dict[str, Any]] = {}
    for i in invoices:
        if not i.get("player_id"):
            continue
        p = player_spend.setdefault(i["player_id"], {"player_name": i.get("player_name"), "sessions": 0, "spent": 0})
        p["sessions"] += 1
        p["spent"] = round(p["spent"] + i["final_amount"], 2)
    top_players = sorted(player_spend.values(), key=lambda x: -x["spent"])[:10]

    # snacks sales
    snack_sales: Dict[str, Dict[str, Any]] = {}
    for i in invoices:
        for s in i.get("snacks", []):
            row = snack_sales.setdefault(s["name"], {"name": s["name"], "qty": 0, "revenue": 0})
            row["qty"] += s["qty"]
            row["revenue"] = round(row["revenue"] + s["total"], 2)

    most_used_table = max(table_usage.values(), key=lambda x: x["sessions"], default=None)

    return {
        "num_sessions": len(invoices),
        "total_table_revenue": total_table_rev,
        "total_snacks_revenue": total_snacks_rev,
        "total_discount": total_discount,
        "total_credit_generated": total_credit_gen,
        "total_credit_received": total_credit_received,
        "grand_total_revenue": grand_total,
        "by_payment_method": by_method,
        "table_usage": list(table_usage.values()),
        "top_players": top_players,
        "snack_sales": list(snack_sales.values()),
        "most_used_table": most_used_table,
        "invoices": invoices,
    }


# ---------- Settings ----------
@api.get("/settings")
async def get_settings(_: dict = Depends(get_current_user)):
    s = await db.settings.find_one({"id": "main"}, {"_id": 0})
    if not s:
        s = {
            "id": "main",
            "business_name": "South Point Snooker Academy",
            "address": "",
            "phone": "",
            "invoice_footer": "Thank you for playing!",
            "currency": "₹",
            "tax_percent": 0,
        }
        await db.settings.insert_one(s)
        s.pop("_id", None)
    return s


@api.put("/settings")
async def update_settings(body: SettingsIn, _: dict = Depends(require_admin)):
    await db.settings.update_one({"id": "main"}, {"$set": body.model_dump()}, upsert=True)
    return {"ok": True}


# ---------- Data Backup ----------
@api.get("/data/backup")
async def backup(_: dict = Depends(require_admin)):
    out = {}
    for c in ["users", "tables", "memberships", "inventory", "players", "sessions", "invoices", "credit_payments", "settings", "counters"]:
        docs = await db[c].find({}, {"_id": 0}).to_list(10000)
        # Never export password hashes for security-sensitive prod, but include for full restore
        out[c] = docs
    return out


@api.post("/data/restore")
async def restore(payload: Dict[str, Any], _: dict = Depends(require_admin)):
    for c, docs in payload.items():
        if not isinstance(docs, list):
            continue
        await db[c].delete_many({})
        if docs:
            await db[c].insert_many(docs)
    return {"ok": True}


@api.post("/data/clear")
async def clear_data(_: dict = Depends(require_admin)):
    for c in ["tables", "memberships", "inventory", "players", "sessions", "invoices", "credit_payments"]:
        await db[c].delete_many({})
    return {"ok": True}


# ---------- Seed ----------
async def seed_all():
    # Users
    admin_user = os.environ.get("ADMIN_USERNAME", "admin").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    cashier_user = os.environ.get("CASHIER_USERNAME", "cashier").lower()
    cashier_pw = os.environ.get("CASHIER_PASSWORD", "cashier123")
    for uname, pw, role, name in [(admin_user, admin_pw, "admin", "Administrator"), (cashier_user, cashier_pw, "cashier", "Cashier")]:
        existing = await db.users.find_one({"username": uname})
        if not existing:
            await db.users.insert_one({
                "id": new_id(),
                "username": uname,
                "password_hash": hash_pw(pw),
                "role": role,
                "name": name,
                "created_at": iso(now_utc()),
            })
        elif not verify_pw(pw, existing["password_hash"]):
            await db.users.update_one({"username": uname}, {"$set": {"password_hash": hash_pw(pw), "role": role}})

    # Tables
    if await db.tables.count_documents({}) == 0:
        defaults = [
            ("Table 1", 220),
            ("Table 2", 320),
            ("Table 3", 320),
            ("Table 4", 320),
        ]
        for i, (n, r) in enumerate(defaults):
            await db.tables.insert_one({"id": new_id(), "name": n, "hourly_rate": r, "order": i})

    # Memberships
    if await db.memberships.count_documents({}) == 0:
        for mem in [
            {"name": "Regular Member", "discount_percent": 10, "validity_days": 365, "active": True, "apply_to_snacks": False},
            {"name": "Premium Member", "discount_percent": 20, "validity_days": 365, "active": True, "apply_to_snacks": False},
        ]:
            await db.memberships.insert_one({"id": new_id(), **mem})

    # Inventory
    if await db.inventory.count_documents({}) == 0:
        for item in [
            {"name": "Tea", "selling_price": 15, "cost_price": 8, "stock": 100, "low_stock_alert": 10},
            {"name": "Coffee", "selling_price": 15, "cost_price": 8, "stock": 100, "low_stock_alert": 10},
            {"name": "Chips", "selling_price": 20, "cost_price": 12, "stock": 50, "low_stock_alert": 5},
            {"name": "Juice", "selling_price": 25, "cost_price": 15, "stock": 40, "low_stock_alert": 5},
        ]:
            await db.inventory.insert_one({"id": new_id(), **item})

    # Settings
    if not await db.settings.find_one({"id": "main"}):
        await db.settings.insert_one({
            "id": "main",
            "business_name": "South Point Snooker Academy",
            "address": "",
            "phone": "",
            "invoice_footer": "Thank you for playing!",
            "currency": "₹",
            "tax_percent": 0,
        })


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("username", unique=True)
    await db.tables.create_index("id", unique=True)
    await db.players.create_index("id", unique=True)
    await db.invoices.create_index("created_at")
    await seed_all()
    logger.info("Startup seeding complete")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
