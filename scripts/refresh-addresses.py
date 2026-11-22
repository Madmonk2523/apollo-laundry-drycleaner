#!/usr/bin/env python3
"""Build Apollo's local directory from NYC OTI's public AddressPoint data."""
import concurrent.futures
import gzip
import hashlib
import json
from pathlib import Path
import re
import time
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
URL = "https://data.cityofnewyork.us/resource/uf93-f8nk.json"
META = "https://data.cityofnewyork.us/api/views/uf93-f8nk.json"
BOX = "within_box(the_geom,40.79,-74.055,40.67,-73.869)"
FIELDS = "objectid,house_number,full_street_name,zipcode,boroughcode,the_geom"
PAGE = 10000

def get(url):
    for attempt in range(4):
        try:
            with urlopen(url, timeout=65) as result:
                return json.load(result)
        except (OSError, ValueError):
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)

def query(**params):
    return get(URL + "?" + urlencode(params))

def fetch_page(offset):
    return query(**{"$where": BOX, "$select": FIELDS, "$limit": PAGE,
                    "$offset": offset, "$order": "objectid"})

def main():
    revision = get(META)["rowsUpdatedAt"]
    expected = int(query(**{"$where": BOX, "$select": "count(*)"})[0]["count"])
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        raw = [r for page in pool.map(fetch_page, range(0, expected, PAGE)) for r in page]
    if len(raw) != expected or get(META)["rowsUpdatedAt"] != revision:
        raise RuntimeError("NYC data changed during download; rerun.")
    rows = []
    for r in raw:
        address = r.get("house_number", "").strip()
        street = r.get("full_street_name", "").strip()
        zip_code = r.get("zipcode", "")
        boro = r.get("boroughcode", "")
        if not address or not street or not re.fullmatch(r"\d{5}", zip_code) or boro not in "12345" or not boro:
            continue
        lon, lat = r["the_geom"]["coordinates"]
        rows.append([int(r["objectid"]), address, street, zip_code, int(boro), lat, lon])
    if len({x[0] for x in rows}) != len(rows):
        raise RuntimeError("Non-unique AddressPoint IDs.")
    shop = next(r for r in rows if r[0] == 1232477)
    if shop[1:5] != ["137", "FRANKLIN ST", "11222", 3]:
        raise RuntimeError("Storefront point changed; verify before updating.")
    payload = json.dumps({"rowsUpdatedAt": revision, "shopPointId": shop[0], "rows": rows},
                         separators=(",", ":"), ensure_ascii=True).encode()
    data = gzip.compress(payload, compresslevel=9, mtime=0)
    dest = ROOT / "data" / "address-points.json.gz"
    dest.write_bytes(data)
    print(f"{len(rows):,} of {expected:,} points; {len(data):,} bytes; SHA256 {hashlib.sha256(data).hexdigest()}")

if __name__ == "__main__":
    main()
