"""
네이버 지도 크롤러.

전략:
  1단계 (목록): map.naver.com/p/search/서울 {district} 한의원 로드
               - allSearch API 응답 캡처 → id/이름/주소/좌표 수집
               - searchIframe 스크롤 후 a.uD1F4 클릭 → URL에서 naver_id 추출
  2단계 (진료과목): pcmap 상세 페이지에서 ul.xrrcZ li.zxtJF 파싱
  3단계 (리뷰): pcmap 리뷰 페이지에서 방문자 리뷰 수집

실행 전:
  playwright install chromium
"""
import os
import signal
import time
import random
from datetime import date, timedelta
from playwright.sync_api import sync_playwright, Page, TimeoutError as PwTimeout
from db import upsert_clinic, update_clinic_meta, insert_naver_reviews, get_crawled_naver_ids

MAP_SEARCH = "https://map.naver.com/p/search/서울 {district} 한의원"
PCMAP_DETAIL = "https://pcmap.place.naver.com/hospital/{naver_id}/home"
PCMAP_REVIEW = "https://pcmap.place.naver.com/hospital/{naver_id}/review/visitor"

REVIEW_LIMIT = 200

# DISTRICTS = [
#     "강남구", "강동구", "강북구", "강서구", "관악구",
#     "광진구", "구로구", "금천구", "노원구", "도봉구",
#     "동대문구", "동작구", "마포구", "서대문구", "서초구",
#     "성동구", "성북구", "송파구", "양천구", "영등포구",
#     "용산구", "은평구", "종로구", "중구", "중랑구",
# ]

DISTRICTS = [
    "동작구", "마포구", "서대문구", "서초구",
    "성동구", "성북구", "송파구", "양천구", "영등포구",
    "용산구", "은평구", "종로구", "중구", "중랑구",
]


BROWSER_ARGS = {
    "headless": True,
    "args": ["--disable-blink-features=AutomationControlled"],
}
CONTEXT_ARGS = {
    "user_agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "locale": "ko-KR",
    "viewport": {"width": 1280, "height": 900},
}


# ──────────────────────────────────────────────
# 1. 한의원 목록 수집
# ──────────────────────────────────────────────

def collect_district(page: Page, district: str) -> list[dict]:
    """
    map.naver.com 검색 페이지에서 한의원 목록 수집.
    - allSearch + pcmap graphql API 응답에서 id/이름/주소/좌표 수집
    - API로 확보 못한 항목만 클릭으로 naver_id 추출
    반환: [{"clinic": {...}, "specialties": [...]}, ...]
    """
    search_url = MAP_SEARCH.format(district=district)
    api_data: dict[str, dict] = {}  # naver_id → {name, address, lat, lng}

    def _store(item: dict):
        nid = str(item.get("id", "")).strip()
        if nid and nid.isdigit() and nid not in api_data:
            api_data[nid] = {
                "name": item.get("name", ""),
                "address": item.get("roadAddress") or item.get("address"),
                "lat": float(item["y"]) if item.get("y") else None,
                "lng": float(item["x"]) if item.get("x") else None,
            }

    def on_response(response):
        url = response.url
        try:
            if "allSearch" in url:
                body = response.json()
                for item in body.get("result", {}).get("place", {}).get("list", []):
                    _store(item)
            elif "pcmap-api.place.naver.com/graphql" in url:
                body = response.json()
                # 배열 형태 batch graphql 처리
                entries = body if isinstance(body, list) else [body]
                for entry in entries:
                    for item in (
                        entry.get("data", {})
                        .get("result", {})
                        .get("place", {})
                        .get("list", [])
                    ):
                        _store(item)
        except Exception:
            pass

    page.on("response", on_response)
    page.goto(search_url)
    page.wait_for_timeout(5000)

    search_frame = page.frame(name="searchIframe")
    if not search_frame:
        print(f"  [경고] searchIframe 없음 — {district}")
        page.remove_listener("response", on_response)
        return []

    # 스크롤해서 모든 아이템 렌더링 (display=70이라 최대 70개)
    _scroll_load_all(page, search_frame)
    total = search_frame.locator("a.uD1F4").count()
    print(f"  렌더된 항목: {total}개 (API 수집: {len(api_data)}개)")

    results: list[dict] = []
    seen_ids: set[str] = set()

    for i in range(total):
        try:
            items_now = search_frame.locator("a.uD1F4")
            if i >= items_now.count():
                break
            items_now.nth(i).click()
            # 고정 대기 대신 URL 변화 감지
            page.wait_for_url("**/place/**", timeout=5000)
        except Exception:
            _restore_search(page, search_url, district)
            search_frame = page.frame(name="searchIframe")
            if search_frame:
                _scroll_load_all(page, search_frame)
            continue

        url = page.url
        naver_id = url.split("/place/")[1].split("?")[0].split("/")[0] if "/place/" in url else ""
        if not naver_id.isdigit() or naver_id in seen_ids:
            page.go_back()
            page.wait_for_timeout(1000)
            search_frame = page.frame(name="searchIframe")
            if search_frame:
                _scroll_load_all(page, search_frame)
            continue
        seen_ids.add(naver_id)

        info = api_data.get(naver_id, {})
        results.append({
            "clinic": {
                "name": info.get("name", ""),
                "address": info.get("address"),
                "district": district,
                "naver_id": naver_id,
                "lat": info.get("lat"),
                "lng": info.get("lng"),
            },
            "specialties": [],
        })

        page.go_back()
        page.wait_for_timeout(1000)
        search_frame = page.frame(name="searchIframe")
        if not search_frame:
            search_frame = _restore_search(page, search_url, district)
        if search_frame:
            _scroll_load_all(page, search_frame)

        time.sleep(random.uniform(0.2, 0.5))

    page.remove_listener("response", on_response)
    return results


def _scroll_load_all(page: Page, frame) -> None:
    """searchIframe의 .Ryr1F 컨테이너를 반복 스크롤해서 모든 항목 렌더링."""
    prev = 0
    for _ in range(15):
        frame.evaluate(
            "() => { const el = document.querySelector('.Ryr1F'); if(el) el.scrollTo(0, el.scrollHeight); }"
        )
        page.wait_for_timeout(700)
        cnt = frame.locator("a.uD1F4").count()
        if cnt == prev:
            break
        prev = cnt


def _restore_search(page: Page, search_url: str, district: str):
    """검색 페이지로 복귀 후 searchIframe 반환. 실패 시 None."""
    try:
        page.goto(search_url)
        page.wait_for_timeout(6000)
        return page.frame(name="searchIframe")
    except Exception:
        return None


# ──────────────────────────────────────────────
# 2. 진료과목 수집
# ──────────────────────────────────────────────

def get_specialties(page: Page, naver_id: str) -> list[str]:
    """pcmap 상세 페이지에서 진료과목 수집."""
    try:
        page.goto(PCMAP_DETAIL.format(naver_id=naver_id))
        page.wait_for_load_state("networkidle", timeout=12000)
        page.wait_for_timeout(1000)
        return [
            el.inner_text(timeout=2000).strip()
            for el in page.locator("ul.xrrcZ li.zxtJF").all()
        ]
    except Exception:
        return []


# ──────────────────────────────────────────────
# 3. 리뷰 수집
# ──────────────────────────────────────────────

def crawl_reviews(page: Page, naver_id: str) -> list[dict]:
    """pcmap 방문자 리뷰 페이지에서 리뷰 수집. '펼쳐서 더보기' 버튼으로 페이지네이션."""
    try:
        page.goto(PCMAP_REVIEW.format(naver_id=naver_id), timeout=30000)
    except PwTimeout:
        return []
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PwTimeout:
        pass
    page.wait_for_timeout(1000)

    reviews = []
    seen: set[tuple] = set()

    while True:
        cards = page.locator("li.place_apply_pui").all()
        new_this_round = 0

        for card in cards:
            try:
                # pui__vn15t2 는 obfuscated hash — 깨지면 아래 주석 방식으로 교체
                # card.evaluate("el => [...el.querySelectorAll('div')].find(d=>d.children.length<=1&&d.textContent.trim().length>10)?.textContent.trim()||''")
                content = card.locator("div.pui__vn15t2").inner_text(timeout=3000).strip()
                if not content:
                    continue
                written_at = None
                for bs in card.locator("span.pui__blind").all():
                    t = bs.inner_text(timeout=1000).strip()
                    if "년" in t and "월" in t and "일" in t:
                        written_at = _parse_date(t)
                        break
            except PwTimeout:
                continue

            key = (content, written_at)
            if key in seen:
                continue
            seen.add(key)
            new_this_round += 1
            reviews.append({
                "rating": None,
                "content": content,
                "written_at": str(written_at) if written_at else None,
            })

        if len(reviews) >= REVIEW_LIMIT:
            break

        # "펼쳐서 더보기" 버튼 — role=button으로 찾아 텍스트로 확인 (클래스명은 obfuscated)
        more_btn = page.locator("a[role='button']").filter(has_text="펼쳐서 더보기")
        if more_btn.count() == 0:
            break
        try:
            more_btn.click(timeout=5000)
        except PwTimeout:
            break
        page.wait_for_timeout(1200)

    return reviews[:REVIEW_LIMIT]


def _parse_date(text: str) -> date | None:
    import re
    text = text.strip()
    # "2026년 5월 14일" 또는 "2026년 5월 14일 목요일"
    m = re.match(r"(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일", text)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    # "2024.03.15"
    m = re.match(r"(\d{4})\.(\d{2})\.(\d{2})", text)
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    # "N일 전"
    m = re.match(r"(\d+)일 전", text)
    if m:
        return date.today() - timedelta(days=int(m.group(1)))
    return None


# ──────────────────────────────────────────────
# 4. 메인
# ──────────────────────────────────────────────

_browser_ref: list = []  # [browser] — signal handler에서 접근
_shutdown_requested = False


def _shutdown(signum, _frame):
    """Ctrl+C / kill 시 Playwright 정리 후 프로세스 즉시 종료 (asyncio 잔류 방지)."""
    global _shutdown_requested
    sig = signum or signal.SIGINT
    if _shutdown_requested:
        print("\n강제 종료합니다.")
        os._exit(128 + sig)
    _shutdown_requested = True
    print("\n종료 신호 수신 — 브라우저 정리 후 종료합니다... (다시 누르면 즉시 종료)")
    for browser in _browser_ref:
        try:
            browser.close()
        except Exception:
            pass
    os._exit(128 + sig)


def main():
    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(**BROWSER_ARGS)
            _browser_ref.append(browser)
            ctx = browser.new_context(**CONTEXT_ARGS)
            ctx.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )
            page = ctx.new_page()

            print("이미 완료된 한의원 조회 중...")
            done_ids = get_crawled_naver_ids()
            print(f"  skip 대상: {len(done_ids)}개")

            for district in DISTRICTS:
                print(f"\n[{district}] 목록 수집 중...")
                entries = collect_district(page, district)
                print(f"  {len(entries)}개 발견")

                for idx, entry in enumerate(entries, 1):
                    naver_id = entry["clinic"]["naver_id"]

                    if naver_id in done_ids:
                        print(f"  [{idx}/{len(entries)}] {entry['clinic']['name'] or naver_id} — skip (이미 완료)")
                        continue

                    print(f"  [{idx}/{len(entries)}] {entry['clinic']['name'] or naver_id} 처리 중...")

                    # name이 없으면 상세 페이지에서 가져오기
                    if not entry["clinic"]["name"]:
                        try:
                            page.goto(PCMAP_DETAIL.format(naver_id=naver_id))
                            page.wait_for_load_state("networkidle", timeout=12000)
                            name = page.locator("span.GHAhO").first.inner_text(timeout=3000).strip()
                            address = page.locator("span.pz7wy").first.inner_text(timeout=3000).strip()
                            entry["clinic"]["name"] = name
                            if not entry["clinic"]["address"]:
                                entry["clinic"]["address"] = address
                        except Exception:
                            pass

                    clinic_id = upsert_clinic(entry["clinic"])

                    specialties = get_specialties(page, naver_id)
                    if specialties:
                        update_clinic_meta(clinic_id, specialties=specialties)

                    reviews = crawl_reviews(page, naver_id)
                    for r in reviews:
                        r["clinic_id"] = clinic_id
                    insert_naver_reviews(reviews)

                    print(
                        f"    → 진료과목 {len(specialties)}개, 리뷰 {len(reviews)}개 저장"
                    )
                    time.sleep(random.uniform(0.8, 1.5))

            browser.close()
    except KeyboardInterrupt:
        _shutdown(signal.SIGINT, None)


if __name__ == "__main__":
    main()
