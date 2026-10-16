"""
RaisTrade ↔ moomoo OpenD bridge.

Runs next to moomoo OpenD on YOUR machine and exposes a small, token-protected HTTPS API that
RaisTrade (Cloudflare) can call. Your moomoo login and trade password never leave this machine.

Setup
  1. Install and log in to moomoo OpenD (https://www.moomoo.com/download/OpenAPI) — default port 11111.
  2. pip install futu-api fastapi uvicorn
  3. export BRIDGE_TOKEN=$(python -c "import secrets;print(secrets.token_urlsafe(32))")   # paste the same token in RaisTrade ⚙ Settings
     export OPEND_HOST=127.0.0.1 OPEND_PORT=11111 SECURITY_FIRM=FUTUMY
     # Real-money orders are refused unless you also set:  ALLOW_REAL=1  and  TRADE_PWD=<your trade password>
  4. uvicorn bridge:app --host 127.0.0.1 --port 8787
  5. Expose it over HTTPS, e.g.  cloudflared tunnel --url http://127.0.0.1:8787   and paste the https URL in RaisTrade.

Endpoints (all need  Authorization: Bearer <BRIDGE_TOKEN>)
  GET  /health                         OpenD status (quote/trade login)
  GET  /accounts?market=US             trading accounts visible to OpenD
  GET  /funds?acc_id=..&trd_env=SIMULATE
  GET  /positions?acc_id=..&trd_env=SIMULATE
  GET  /quote?code=US.AAPL             live snapshot (needs quote rights)
  POST /order  {"code","side":"BUY|SELL","qty","price","order_type":"MARKET|NORMAL","trd_env","acc_id"}
"""
import hmac, os
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from futu import (OpenQuoteContext, OpenSecTradeContext, OrderType, RET_OK, SecurityFirm, TrdEnv, TrdMarket, TrdSide)

TOKEN = os.environ.get("BRIDGE_TOKEN", "")
HOST, PORT = os.environ.get("OPEND_HOST", "127.0.0.1"), int(os.environ.get("OPEND_PORT", "11111"))
FIRM = getattr(SecurityFirm, os.environ.get("SECURITY_FIRM", "FUTUMY"), SecurityFirm.FUTUSECURITIES)
ALLOW_REAL = os.environ.get("ALLOW_REAL") == "1"
TRADE_PWD = os.environ.get("TRADE_PWD")
if len(TOKEN) < 16:
    raise SystemExit("Set BRIDGE_TOKEN (16+ chars) before starting the bridge.")

app = FastAPI(title="RaisTrade moomoo bridge", docs_url=None, redoc_url=None)


def auth(authorization: str = Header("")):
    if not hmac.compare_digest(authorization, f"Bearer {TOKEN}"):
        raise HTTPException(401, "bad token")


def trade_ctx(market: str = "US"):
    return OpenSecTradeContext(filter_trdmarket=getattr(TrdMarket, market, TrdMarket.US), host=HOST, port=PORT, security_firm=FIRM)


def frame(ret, data):
    if ret != RET_OK:
        raise HTTPException(502, str(data))
    return data.to_dict("records") if hasattr(data, "to_dict") else data


@app.get("/health", dependencies=[Depends(auth)])
def health():
    q = OpenQuoteContext(host=HOST, port=PORT)
    try:
        ret, st = q.get_global_state()
        st = frame(ret, st)
        return {"ok": True, "qot_logined": st.get("qot_logined"), "trd_logined": st.get("trd_logined"), "server_ver": st.get("server_ver"), "allow_real": ALLOW_REAL}
    finally:
        q.close()


@app.get("/accounts", dependencies=[Depends(auth)])
def accounts(market: str = "US"):
    t = trade_ctx(market)
    try:
        rows = frame(*t.get_acc_list())
        return {"accounts": [{"acc_id": str(r["acc_id"]), "trd_env": r["trd_env"], "acc_type": r.get("acc_type"), "markets": r.get("trdmarket_auth")} for r in rows]}
    finally:
        t.close()


@app.get("/funds", dependencies=[Depends(auth)])
def funds(acc_id: int, trd_env: str = "SIMULATE", market: str = "US"):
    t = trade_ctx(market)
    try:
        return {"funds": frame(*t.accinfo_query(trd_env=getattr(TrdEnv, trd_env), acc_id=acc_id))}
    finally:
        t.close()


@app.get("/positions", dependencies=[Depends(auth)])
def positions(acc_id: int, trd_env: str = "SIMULATE", market: str = "US"):
    t = trade_ctx(market)
    try:
        return {"positions": frame(*t.position_list_query(trd_env=getattr(TrdEnv, trd_env), acc_id=acc_id))}
    finally:
        t.close()


@app.get("/quote", dependencies=[Depends(auth)])
def quote(code: str):
    q = OpenQuoteContext(host=HOST, port=PORT)
    try:
        return {"snapshot": frame(*q.get_market_snapshot([code]))}
    finally:
        q.close()


class Order(BaseModel):
    code: str
    side: str
    qty: float
    price: float = 0.0
    order_type: str = "NORMAL"
    trd_env: str = "SIMULATE"
    acc_id: int
    market: str = "US"


@app.post("/order", dependencies=[Depends(auth)])
def order(o: Order):
    if o.trd_env == "REAL" and not ALLOW_REAL:
        raise HTTPException(403, "Real-money orders are disabled on this bridge (set ALLOW_REAL=1 to enable).")
    t = trade_ctx(o.market)
    try:
        if o.trd_env == "REAL":
            if not TRADE_PWD:
                raise HTTPException(403, "TRADE_PWD not set on the bridge machine.")
            frame(*t.unlock_trade(TRADE_PWD))
        data = frame(*t.place_order(price=o.price, qty=o.qty, code=o.code, trd_side=getattr(TrdSide, o.side),
                                    order_type=getattr(OrderType, o.order_type), trd_env=getattr(TrdEnv, o.trd_env), acc_id=o.acc_id))
        return {"order": data}
    finally:
        t.close()
