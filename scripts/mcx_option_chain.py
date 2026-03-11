"""
MCX Option Chain Helper Script
-------------------------------
Fetches MCX commodity option chain data from mcxindia.com using requests.Session()
which handles Akamai anti-bot cookies. Called by the Node.js API route as a subprocess.

Usage:
    python scripts/mcx_option_chain.py <COMMODITY> [EXPIRY]
    
Outputs JSON to stdout.
"""
import sys
import json
import requests
from datetime import datetime

# ── MCX API Configuration ──────────────────────────────────────
BASE_URL = "https://www.mcxindia.com"

HEADERS = {
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Content-Type": "application/json",
    "Origin": BASE_URL,
    "Referer": f"{BASE_URL}/market-data/option-chain",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
}


def create_session():
    """Create a session and establish cookies with MCX India."""
    s = requests.Session()
    s.headers.update(HEADERS)
    try:
        s.get(BASE_URL, timeout=15)
    except Exception:
        pass  # Session cookies are set even on failed attempts
    return s


def parse_expiry(exp_str):
    """Parse MCX expiry string like '27FEB2026' into datetime."""
    try:
        return datetime.strptime(exp_str, "%d%b%Y")
    except Exception:
        return None


def get_expiry_dates(session, commodity):
    """Get valid expiry dates for a commodity from market watch data."""
    try:
        res = session.post(
            f"{BASE_URL}/backpage.aspx/GetMarketWatch",
            json={},
            timeout=15
        )
        if res.status_code == 200:
            items = res.json().get("d", {}).get("Data", []) or []
            # Filter for this commodity's option contracts
            expiries = set()
            for item in items:
                sym = (item.get("Symbol") or "").upper()
                if sym == commodity.upper():
                    exp = item.get("ExpiryDate")
                    if exp:
                        expiries.add(exp)
            # Sort chronologically
            sorted_expiries = sorted(
                list(expiries),
                key=lambda x: parse_expiry(x) or datetime.max
            )
            return sorted_expiries
    except Exception:
        pass
    return []


def fetch_option_chain(commodity, expiry=None):
    """Fetch MCX option chain data."""
    session = create_session()
    
    # If no expiry provided, find valid expiry dates
    expiry_dates = []
    if not expiry:
        expiry_dates = get_expiry_dates(session, commodity)
        if expiry_dates:
            expiry = expiry_dates[0]
        else:
            # Fallback: guess the nearest future date
            now = datetime.now()
            # MCX options typically expire on the 27th or last business day
            for delta in range(0, 60):
                test_date = datetime(now.year, now.month, now.day) 
                from datetime import timedelta
                test_date = now + timedelta(days=delta)
                exp_str = test_date.strftime("%d%b%Y").upper()
                expiry = exp_str
                break
    
    # Format expiry if needed (mcxpy format: "27FEB2026")
    if expiry and "-" in expiry:
        try:
            dt = datetime.strptime(expiry, "%d-%m-%Y")
            expiry = dt.strftime("%d%b%Y").upper()
        except ValueError:
            pass
    
    # Fetch option chain
    try:
        res = session.post(
            f"{BASE_URL}/backpage.aspx/GetOptionChain",
            json={"Commodity": commodity.upper(), "Expiry": expiry},
            timeout=15
        )
        
        if res.status_code != 200:
            return {"error": f"MCX API returned {res.status_code}"}
        
        data = res.json()
        items = data.get("d", {}).get("Data") or []
        summary = data.get("d", {}).get("Summary") or {}
        
        if not items:
            return {
                "error": f"No data for {commodity}/{expiry}",
                "expirationDates": expiry_dates
            }
        
        # Map MCX data to standard option chain format
        underlying = items[0].get("UnderlyingValue", 0) if items else 0
        
        options = []
        for item in items:
            strike = item.get("CE_StrikePrice") or item.get("PE_StrikePrice") or 0
            if strike == 0:
                continue
            
            options.append({
                "strike": strike,
                "callOI": item.get("CE_OpenInterest", 0) or 0,
                "callVolume": item.get("CE_Volume", 0) or 0,
                "callLTP": item.get("CE_LTP", 0) or 0,
                "callChange": item.get("CE_AbsoluteChange", 0) or 0,
                "callIV": 0,  # MCX doesn't provide IV directly
                "callBidQty": item.get("CE_BidQty", 0) or 0,
                "callBidPrice": item.get("CE_BidPrice", 0) or 0,
                "callAskQty": item.get("CE_AskQty", 0) or 0,
                "callAskPrice": item.get("CE_AskPrice", 0) or 0,
                "putOI": item.get("PE_OpenInterest", 0) or 0,
                "putVolume": item.get("PE_Volume", 0) or 0,
                "putLTP": item.get("PE_LTP", 0) or 0,
                "putChange": item.get("PE_AbsoluteChange", 0) or 0,
                "putIV": 0,
                "putBidQty": item.get("PE_BidQty", 0) or 0,
                "putBidPrice": item.get("PE_BidPrice", 0) or 0,
                "putAskQty": item.get("PE_AskQty", 0) or 0,
                "putAskPrice": item.get("PE_AskPrice", 0) or 0,
            })
        
        # Sort by strike price
        options.sort(key=lambda x: x["strike"])
        
        # Get as-on timestamp
        as_on = None
        if summary and summary.get("AsOn"):
            try:
                import re
                match = re.search(r"\((\d+)\)", summary["AsOn"])
                if match:
                    ts = int(match.group(1)) / 1000
                    as_on = datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S UTC")
            except Exception:
                pass
        
        return {
            "symbol": commodity.upper(),
            "underlyingPrice": underlying,
            "expirationDates": expiry_dates if expiry_dates else [expiry],
            "options": options,
            "source": "MCX India (Live)",
            "currency": "₹",
            "asOn": as_on,
            "totalStrikes": summary.get("Count", len(options)),
        }
        
    except requests.exceptions.Timeout:
        return {"error": "MCX API timeout"}
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python mcx_option_chain.py <COMMODITY> [EXPIRY]"}))
        sys.exit(1)
    
    commodity = sys.argv[1].upper()
    expiry = sys.argv[2] if len(sys.argv) > 2 else None
    
    result = fetch_option_chain(commodity, expiry)
    print(json.dumps(result))
