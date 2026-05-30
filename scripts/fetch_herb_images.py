"""상위 약재 이미지 큐레이션 — 한국어 위키백과 REST 요약 API의 썸네일을 수집.

- 처방 등장 빈도(rxCount) 상위 약재 위주 + 변종은 대표명으로 치환해 조회.
- 결과: public/data/herb_images.json  { herb_id: {img, page, title} }
- 썸네일은 upload.wikimedia.org(이미지 CDN) 직링크 + 출처 페이지 attribution 동봉.
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" if (ROOT / "data").exists() else ROOT / "public" / "data"
DATA = ROOT / "public" / "data"

# 변종 → 위키백과 조회용 대표명
WIKI_ALIAS = {
    "적복령": "복령", "백복령": "복령", "복신": "복령",
    "백작약": "작약", "적작약": "작약",
    "귤피": "귤", "귤홍": "귤", "청피": "귤", "진피": "귤",
    "육계": "계피", "계지": "계피", "계심": "계피", "관계": "계피",
    "생지황": "지황", "숙지황": "지황", "당귀미": "당귀",
    "건강": "생강", "자감초": "감초", "산치자": "치자",
    "토목향": "목향", "상백피": "뽕나무",
    "백지": "구릿대", "갈근": "칡", "길경": "도라지",
    "천궁": "궁궁이", "치자": "치자나무", "산치자": "치자나무",
    "후박": "후박나무", "맥문동": "맥문동", "오미자": "오미자",
    "작약": "작약", "시호": "시호(식물)", "목단피": "모란",
    "지황": "지황", "오수유": "쉬나무", "곽향": "배초향",
    "창출": "삽주", "향부자": "향부자", "백두구": "백두구",
    "대조": "대추나무", "총백": "파", "흑두": "검은콩",
    "행인": "살구씨",
}

API = "https://ko.wikipedia.org/api/rest_v1/page/summary/"


def fetch_summary(title):
    url = API + urllib.parse.quote(title)
    req = urllib.request.Request(url, headers={"User-Agent": "MEDVIS-HerbLibrary/1.0 (research prototype)"})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.load(r)
    except Exception:
        return None


def main():
    herbs = json.loads((DATA / "herbs.json").read_text(encoding="utf-8"))
    # rxCount 상위 + 성분 보유 약재 우선
    herbs_sorted = sorted(herbs, key=lambda h: -(h.get("rxCount", 0)))
    target = herbs_sorted[:40]

    out = {}
    for h in target:
        name = h["nameKo"]
        query = WIKI_ALIAS.get(name, name)
        data = fetch_summary(query)
        time.sleep(0.3)
        if not data:
            continue
        thumb = (data.get("thumbnail") or {}).get("source")
        if not thumb:
            continue
        # API가 준 썸네일 URL을 그대로 사용 (임의 리사이즈는 400 유발)
        out[h["id"]] = {
            "img": thumb,
            "title": data.get("title", query),
            "page": (data.get("content_urls", {}).get("desktop", {}) or {}).get("page", ""),
        }
        print(f"  ✓ {name} ({query}) → {data.get('title')}")

    (DATA / "herb_images.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n[완료] {len(out)}종 이미지 수집 → herb_images.json")


if __name__ == "__main__":
    main()
