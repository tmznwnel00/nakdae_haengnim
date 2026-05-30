"""
카카오맵 크롤러.
1단계: DB에 저장된 한의원을 이름+주소로 카카오맵에서 검색 → kakao_id 확보
2단계: 매장정보 태그 수집
3단계: 리뷰 수집

카카오 REST API 키 불필요 — Playwright로 웹 직접 크롤링.
"""
import time
import random
from datetime import date
from playwright.sync_api import sync_playwright, Page, TimeoutError as PwTimeout
from db import get_all_clinics, insert_kakao_reviews, update_clinic_meta, save_kakao_id, get_crawled_kakao_ids

KAKAO_SEARCH_URL = "https://map.kakao.com/?q={query}"
PLACE_URL = "https://place.map.kakao.com/{kakao_id}"
REVIEW_URL = "https://place.map.kakao.com/{kakao_id}#review"
REVIEW_LIMIT = 200
START_FROM = 725  # 이 번호부터 시작 (1-based). 처음부터 하려면 1로 설정


def search_kakao_id(page: Page, name: str, address: str | None) -> str | None:
    """
    이름(+주소)으로 카카오맵 검색 → kakao_id 반환.
    주소가 있으면 '{name} {district}' 형태로 검색해 정확도 향상.
    """
    district = _extract_district(address)
    query = f"{name} {district}" if district else name

    page.goto(KAKAO_SEARCH_URL.format(query=query))
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PwTimeout:
        pass

    try:
        # .link_name은 항상 #none — .moreview(상세보기)에 실제 place URL이 있음
        first = page.locator(".placelist .moreview[href*='place.map.kakao.com']").first
        first.wait_for(timeout=10000)
        href = first.get_attribute("href") or ""
        kakao_id = href.rstrip("/").split("/")[-1]
        if kakao_id.isdigit():
            return kakao_id
    except PwTimeout:
        pass
    return None


def _extract_district(address: str | None) -> str:
    """주소 문자열에서 자치구명 추출. 없으면 빈 문자열."""
    if not address:
        return ""
    for token in address.split():
        if token.endswith("구"):
            return token
    return ""


def crawl_tags(page: Page, kakao_id: str) -> list[str]:
    """카카오맵 메인 페이지에서 매장정보 태그 수집."""
    page.goto(PLACE_URL.format(kakao_id=kakao_id))
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PwTimeout:
        pass

    try:
        links = page.locator("div.unit_hashtag a.link_detail").all()
        return [link.inner_text(timeout=3000).strip() for link in links]
    except PwTimeout:
        return []


def crawl_reviews(page: Page, kakao_id: str) -> list[dict]:
    """카카오맵 후기(#review) 탭에서 리뷰 수집."""
    page.goto(REVIEW_URL.format(kakao_id=kakao_id))
    try:
        page.wait_for_load_state("networkidle", timeout=15000)
    except PwTimeout:
        pass
    page.wait_for_timeout(1000)

    reviews = []
    seen: set[tuple] = set()
    prev_count = 0

    while len(reviews) < REVIEW_LIMIT:
        cards = page.locator(".list_review > li").all()

        for card in cards:
            try:
                content_el = card.locator("p.desc_review")
                if content_el.count() == 0:
                    continue
                content = content_el.inner_text(timeout=3000).strip().removesuffix("더보기").strip()
                if not content:
                    continue
                rating = card.locator(".figure_star.on").count()
                date_text = card.locator(".txt_date").first.inner_text(timeout=3000).strip()
                written_at = parse_kakao_date(date_text)
            except PwTimeout:
                continue

            key = (content, written_at)
            if key in seen:
                continue
            seen.add(key)
            reviews.append({
                "rating": rating if rating > 0 else None,
                "content": content,
                "written_at": str(written_at) if written_at else None,
            })

        current_count = len(cards)
        if current_count == prev_count:
            break
        prev_count = current_count

        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1500)

    return reviews[:REVIEW_LIMIT]


def parse_kakao_date(text: str) -> date | None:
    import re
    m = re.match(r"(\d{4})\.(\d{2})\.(\d{2})", text.strip())
    if m:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None


def main():
    clinics = get_all_clinics()
    print(f"총 {len(clinics)}개 한의원 카카오 수집 시작 (#{START_FROM}부터)")
    clinics = clinics[START_FROM - 1:]
    print("이미 완료된 한의원 조회 중...")
    done_kakao_ids = get_crawled_kakao_ids()
    print(f"  skip 대상: {len(done_kakao_ids)}개")

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="ko-KR",
            viewport={"width": 1280, "height": 900},
        )
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        page = context.new_page()

        for idx, clinic in enumerate(clinics, 1):
            clinic_id = clinic["id"]
            kakao_id = clinic.get("kakao_id")

            if kakao_id and kakao_id in done_kakao_ids:
                print(f"  [{idx}/{len(clinics)}] {clinic['name']} — skip (이미 완료)")
                continue

            print(f"  [{idx}/{len(clinics)}] {clinic['name']} 처리 중...")

            # kakao_id가 없으면 이름으로 검색
            if not kakao_id:
                kakao_id = search_kakao_id(page, clinic["name"], clinic.get("address"))
                if not kakao_id:
                    print(f"  [skip] {clinic['name']}: 카카오 검색 실패")
                    continue
                save_kakao_id(clinic_id, kakao_id)

            tags = crawl_tags(page, kakao_id)
            update_clinic_meta(clinic_id, tags=tags)

            reviews = crawl_reviews(page, kakao_id)
            for r in reviews:
                r["clinic_id"] = clinic_id
            insert_kakao_reviews(reviews)

            print(f"  {clinic['name']}: 태그 {len(tags)}개, 리뷰 {len(reviews)}개 저장")
            time.sleep(random.uniform(1.0, 2.0))

        browser.close()


if __name__ == "__main__":
    main()
