-- 한의원 정보
CREATE TABLE IF NOT EXISTS clinics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  address    TEXT,
  district   TEXT,
  lat        FLOAT,
  lng        FLOAT,
  naver_id            TEXT UNIQUE,
  kakao_id            TEXT UNIQUE,
  naver_specialties   TEXT[],
  kakao_tags          TEXT[],
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- 네이버 방문자 리뷰
CREATE TABLE IF NOT EXISTS naver_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID REFERENCES clinics(id) ON DELETE CASCADE,
  rating     SMALLINT,
  content    TEXT,
  written_at DATE,
  sentiment  TEXT,
  crawled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clinic_id, content, written_at)
);

-- 카카오맵 리뷰
CREATE TABLE IF NOT EXISTS kakao_reviews (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID REFERENCES clinics(id) ON DELETE CASCADE,
  rating     SMALLINT,
  content    TEXT,
  written_at DATE,
  sentiment  TEXT,
  crawled_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (clinic_id, content, written_at)
);
