"""
Supabase 저장 모듈.
clinics, reviews 테이블에 upsert 처리.
"""
import os
import time
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_KEY"],
        )
    return _client


def _retry(fn, retries=3):
    """네트워크 단절 시 클라이언트 재생성 후 재시도."""
    global _client
    for i in range(retries):
        try:
            return fn()
        except Exception:
            if i == retries - 1:
                raise
            _client = None
            time.sleep(2)


def upsert_clinic(clinic: dict) -> str:
    """한의원을 저장하고 id를 반환. naver_id 기준으로 중복 처리."""
    def _do():
        return get_client().table("clinics").upsert(clinic, on_conflict="naver_id").execute()
    return _retry(_do).data[0]["id"]


def save_kakao_id(clinic_id: str, kakao_id: str):
    from postgrest.exceptions import APIError
    def _do():
        get_client().table("clinics").update({"kakao_id": kakao_id}).eq("id", clinic_id).execute()
    try:
        _retry(_do)
    except APIError as e:
        if "23505" in str(e):  # unique constraint violation — 다른 한의원이 이미 같은 kakao_id 보유
            print(f"    [경고] kakao_id {kakao_id} 중복 — skip")
        else:
            raise


def update_clinic_meta(
    clinic_id: str,
    specialties: list[str] | None = None,
    tags: list[str] | None = None,
):
    """진료과목(네이버) 또는 매장태그(카카오)를 clinics 테이블에 업데이트."""
    payload = {}
    if specialties is not None:
        payload["naver_specialties"] = specialties
    if tags is not None:
        payload["kakao_tags"] = tags
    if not payload:
        return
    def _do():
        get_client().table("clinics").update(payload).eq("id", clinic_id).execute()
    _retry(_do)


def _clean(text: str | None) -> str | None:
    return text.replace("\x00", "") if text else text


def insert_naver_reviews(reviews: list[dict]):
    """네이버 리뷰 목록을 중복 무시하고 저장."""
    if not reviews:
        return
    cleaned = [{**r, "content": _clean(r.get("content"))} for r in reviews]
    def _do():
        get_client().table("naver_reviews").upsert(
            cleaned,
            on_conflict="clinic_id,content,written_at",
            ignore_duplicates=True,
        ).execute()
    _retry(_do)


def insert_kakao_reviews(reviews: list[dict]):
    """카카오 리뷰 목록을 중복 무시하고 저장."""
    if not reviews:
        return
    cleaned = [{**r, "content": _clean(r.get("content"))} for r in reviews]
    def _do():
        get_client().table("kakao_reviews").upsert(
            cleaned,
            on_conflict="clinic_id,content,written_at",
            ignore_duplicates=True,
        ).execute()
    _retry(_do)


def get_all_clinics() -> list[dict]:
    """clinics 전체 조회 (1000개 초과 대비 페이지네이션)."""
    db = get_client()
    result: list[dict] = []
    batch, offset = 1000, 0
    while True:
        rows = (
            db.table("clinics")
            .select("id,name,address,district,kakao_id,naver_id")
            .order("created_at")
            .range(offset, offset + batch - 1)
            .execute()
            .data
        )
        result.extend(rows)
        if len(rows) < batch:
            break
        offset += batch
    return result


def get_crawled_kakao_ids() -> set[str]:
    """kakao_reviews에 1건 이상 있는 clinic의 kakao_id 집합 반환 (재실행 시 skip용)."""
    db = get_client()

    clinic_ids_with_reviews: set[str] = set()
    batch, offset = 1000, 0
    while True:
        rows = (
            db.table("kakao_reviews")
            .select("clinic_id")
            .range(offset, offset + batch - 1)
            .execute()
            .data
        )
        clinic_ids_with_reviews.update(r["clinic_id"] for r in rows)
        if len(rows) < batch:
            break
        offset += batch

    clinics = db.table("clinics").select("id,kakao_id").execute().data
    return {
        row["kakao_id"]
        for row in clinics
        if row["id"] in clinic_ids_with_reviews and row["kakao_id"]
    }


def get_crawled_naver_ids() -> set[str]:
    """naver_reviews에 1건 이상 있는 clinic의 naver_id 집합 반환 (재실행 시 skip용)."""
    db = get_client()

    clinic_ids_with_reviews: set[str] = set()
    batch, offset = 1000, 0
    while True:
        rows = (
            db.table("naver_reviews")
            .select("clinic_id")
            .range(offset, offset + batch - 1)
            .execute()
            .data
        )
        clinic_ids_with_reviews.update(r["clinic_id"] for r in rows)
        if len(rows) < batch:
            break
        offset += batch

    clinics = db.table("clinics").select("id,naver_id").execute().data
    return {
        row["naver_id"]
        for row in clinics
        if row["id"] in clinic_ids_with_reviews and row["naver_id"]
    }
