#!/usr/bin/env python3
"""한의원 리뷰 지도용 데이터 export → public/data/clinic_journal.json"""
import json, os, sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def paginate(table, select):
    result, offset, batch = [], 0, 1000
    while True:
        rows = sb.table(table).select(select).range(offset, offset + batch - 1).execute().data
        result.extend(rows)
        if len(rows) < batch:
            break
        offset += batch
    return result


print("Loading clinics...")
clinics_raw = paginate("clinics", "id,name,address,district,lat,lng")

print("Loading kakao_reviews...")
kakao_raw = paginate("kakao_reviews", "id,clinic_id,rating")

print("Loading naver_reviews...")
naver_raw = paginate("naver_reviews", "id,clinic_id,rating")

print("Loading extracted reviews...")
ext_raw = paginate(
    "reviews_extracted_lite_v1",
    "review_id,source,primary_category,body_parts,complaints_hanbang,treatments_hanbang,outcome,doctor_sentiment",
)

# 리뷰 ID → clinic_id 매핑
rid_to_clinic = {r["id"]: r["clinic_id"] for r in kakao_raw}
rid_to_clinic.update({r["id"]: r["clinic_id"] for r in naver_raw})

# clinic_id → 별점 목록
ratings_by_clinic = defaultdict(list)
for r in kakao_raw + naver_raw:
    if r.get("rating"):
        ratings_by_clinic[r["clinic_id"]].append(r["rating"])

# clinic별 집계
SKIP_BODY = {"부위없음", "전신"}
SKIP_COMPLAINTS = {"기타호소"}
SKIP_TREATMENTS = {"처치불명"}

stats = defaultdict(lambda: {
    "review_count": 0,
    "outcome": Counter(),
    "sentiment": Counter(),
    "body_parts": Counter(),
    "complaints": Counter(),
    "treatments": Counter(),
    "categories": Counter(),
})

for ext in ext_raw:
    cid = rid_to_clinic.get(ext["review_id"])
    if not cid:
        continue
    s = stats[cid]
    s["review_count"] += 1
    if ext.get("outcome"):
        s["outcome"][ext["outcome"]] += 1
    if ext.get("doctor_sentiment"):
        s["sentiment"][ext["doctor_sentiment"]] += 1
    if ext.get("primary_category"):
        s["categories"][ext["primary_category"]] += 1
    for bp in (ext.get("body_parts") or []):
        if bp not in SKIP_BODY:
            s["body_parts"][bp] += 1
    for c in (ext.get("complaints_hanbang") or []):
        if c not in SKIP_COMPLAINTS:
            s["complaints"][c] += 1
    for t in (ext.get("treatments_hanbang") or []):
        if t not in SKIP_TREATMENTS:
            s["treatments"][t] += 1

output = []
for clinic in clinics_raw:
    cid = clinic["id"]
    if clinic.get("lat") is None or clinic.get("lng") is None:
        continue
    s = stats.get(cid)
    if not s or s["review_count"] == 0:
        continue

    ratings = ratings_by_clinic.get(cid, [])
    output.append({
        "id": cid,
        "name": clinic["name"],
        "address": clinic.get("address", ""),
        "district": clinic.get("district", ""),
        "lat": clinic["lat"],
        "lng": clinic["lng"],
        "review_count": s["review_count"],
        "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else None,
        "outcome": dict(s["outcome"]),
        "sentiment": dict(s["sentiment"]),
        "body_parts": dict(s["body_parts"].most_common(8)),
        "complaints": dict(s["complaints"].most_common(6)),
        "treatments": dict(s["treatments"].most_common(6)),
        "categories": dict(s["categories"]),
    })

out_path = Path(__file__).parent.parent / "public/data/clinic_journal.json"
out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"✓ {len(output)} clinics exported → {out_path}")
