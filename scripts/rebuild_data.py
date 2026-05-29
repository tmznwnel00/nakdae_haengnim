"""Rebuild HerbLibrary data with 3-tier hierarchy: Category -> U-code -> Herb.

Strategy:
  1. symptom -> category / U-code via explicit UCODES list + CATEGORY_DIRECT_SYMPTOMS
  2. herb -> category via (a) linked symptoms, (b) prescription-mediated symptoms,
     (c) effectsPlain keyword fallback
  3. Keep ALL 207 herbs; unmatched herbs go to "기타" category (not shown in main filter
     but still searchable).

Inputs: backup files at /tmp/*.bak.json (original data before any rebuild)
Outputs: public/data/{categories,ucodes,herbs,symptoms,prescriptions,edges}.json
"""
import json
import re
from pathlib import Path
from collections import defaultdict, Counter

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public" / "data"
BACKUP = Path("/tmp")

CATEGORIES = [
    {"id": "musculoskeletal", "name": "근골격 통증",    "tagline": "근육·관절·허리·목·어깨의 통증과 저림", "icon": "Activity",  "color": "#e76f51"},
    {"id": "head",            "name": "두통 / 현훈",    "tagline": "두통·어지럼·머리 무거움",              "icon": "Brain",     "color": "#9b5de5"},
    {"id": "digestive",       "name": "소화",           "tagline": "소화불량·체기·복부 불편",              "icon": "Waves",     "color": "#06a77d"},
    {"id": "respiratory",     "name": "호흡기 / 알레르기","tagline": "감기·기침·비염·인후 증상",            "icon": "Sparkles",  "color": "#4cc9f0"},
    {"id": "fatigue",         "name": "피로 / 허증",    "tagline": "만성 피로·기력 저하·체질 보강",        "icon": "Sprout",    "color": "#f4a261"},
    {"id": "mind",            "name": "수면 / 정신",    "tagline": "불면·우울·불안·스트레스",              "icon": "Moon",      "color": "#264653"},
    {"id": "womens",          "name": "여성 건강",       "tagline": "갱년기·월경통·산후 회복",             "icon": "CircleDot", "color": "#e63946"},
    {"id": "skin",            "name": "피부",           "tagline": "가려움·발진·아토피",                  "icon": "Leaf",      "color": "#588157"},
]

UCODES = [
    # 근골격 통증
    {"id": "U238", "name": "비증",     "hanja": "痺證",   "category": "musculoskeletal",
     "plain": "저리고 아픈 증상의 총칭",
     "symptoms": ["sym_통증", "sym_근비", "sym_혈비", "sym_열비", "sym_사지마목", "sym_지절종통", "sym_착비"]},
    {"id": "U240", "name": "저림증",   "hanja": "麻木",   "category": "musculoskeletal",
     "plain": "팔·다리·손·발이 저린 증상",
     "symptoms": ["sym_사지마목", "sym_피부불인", "sym_착비"]},
    {"id": "U241", "name": "불인",     "hanja": "不仁",   "category": "musculoskeletal",
     "plain": "감각이 둔하거나 마비된 느낌",
     "symptoms": ["sym_피부불인", "sym_사지마목", "sym_기육중착"]},
    {"id": "U301", "name": "통비",     "hanja": "痛痺",   "category": "musculoskeletal",
     "plain": "쑤시고 찌르는 통증",
     "symptoms": ["sym_통증", "sym_타박통", "sym_지절종통", "sym_흉복협통", "sym_심비통"]},
    {"id": "U302", "name": "착비",     "hanja": "着痺",   "category": "musculoskeletal",
     "plain": "한 자리에 고정된 무겁고 둔한 통증",
     "symptoms": ["sym_착비", "sym_근비", "sym_신중", "sym_통증"]},
    {"id": "U303", "name": "목 경직",  "hanja": "項强",   "category": "musculoskeletal",
     "plain": "목이 뻣뻣하고 굳음",
     "symptoms": ["sym_구련", "sym_지절종통", "sym_착비"]},
    {"id": "U304", "name": "주절풍",   "hanja": "肘節風", "category": "musculoskeletal",
     "plain": "팔꿈치·손목 관절의 풍사 통증",
     "symptoms": ["sym_지절종통", "sym_근비", "sym_착비"]},
    {"id": "U305", "name": "학슬풍",   "hanja": "鶴膝風", "category": "musculoskeletal",
     "plain": "무릎이 붓고 아픈 증상",
     "symptoms": ["sym_지절종통", "sym_부종", "sym_착비"]},
    {"id": "U306", "name": "근경련",   "hanja": "筋攣",   "category": "musculoskeletal",
     "plain": "근육이 당기고 경련",
     "symptoms": ["sym_구련", "sym_근비", "sym_착비"]},
    {"id": "U234", "name": "중풍 후유증","hanja": "中風後遺","category": "musculoskeletal",
     "plain": "뇌혈관 사고 후의 마비·언어 장애",
     "symptoms": ["sym_사지마목", "sym_피부불인", "sym_구련", "sym_언어섬란", "sym_기육중착"]},

    # 두통 / 현훈
    {"id": "U230", "name": "두풍",     "hanja": "頭風",   "category": "head",
     "plain": "오래 반복되는 두통",
     "symptoms": ["sym_두동", "sym_두목현훈", "sym_두한"]},
    {"id": "U650", "name": "간양상항", "hanja": "肝陽上亢","category": "head",
     "plain": "간의 양기가 위로 솟구쳐 어지럽고 머리가 아픔",
     "symptoms": ["sym_두목현훈", "sym_현훈", "sym_안화", "sym_두동"]},
    {"id": "U233", "name": "중풍 전조","hanja": "中風前兆","category": "head",
     "plain": "어지럼·저림 등 중풍을 예고하는 증상",
     "symptoms": ["sym_사지마목", "sym_현훈", "sym_두목현훈"]},
    {"id": "U236", "name": "진전",     "hanja": "振顫",   "category": "head",
     "plain": "손·머리가 떨림",
     "symptoms": ["sym_구련", "sym_지절종통"]},

    # 소화
    {"id": "U280", "name": "식적",     "hanja": "食積",   "category": "digestive",
     "plain": "음식이 정체되어 더부룩하고 답답함",
     "symptoms": ["sym_소화불량", "sym_식포", "sym_식결", "sym_불하식", "sym_음식불하", "sym_복창만"]},
    {"id": "U260", "name": "흉비",     "hanja": "胸痞",   "category": "digestive",
     "plain": "가슴이 답답하고 막힌 느낌",
     "symptoms": ["sym_흉만", "sym_흉격불관", "sym_흉복협통", "sym_심비통", "sym_복창만"]},
    {"id": "U730", "name": "위기허",   "hanja": "胃氣虛", "category": "digestive",
     "plain": "위의 소화 기능 저하",
     "symptoms": ["sym_소화불량", "sym_식포", "sym_불하식", "sym_음식불하", "sym_토역", "sym_토사",
                  "sym_곽란토사", "sym_사리", "sym_하리", "sym_설사"]},

    # 피로 / 허증
    {"id": "U204", "name": "허로",     "hanja": "虛勞",   "category": "fatigue",
     "plain": "오래 누적된 만성 피로·소모성 쇠약",
     "symptoms": ["sym_피로", "sym_기탈", "sym_기약", "sym_혈약", "sym_기혈구허", "sym_진원부족",
                  "sym_진음휴손", "sym_정신권핍", "sym_정신단소", "sym_내상", "sym_도한", "sym_허한",
                  "sym_자한", "sym_자한도한"]},
    {"id": "U600", "name": "기허",     "hanja": "氣虛",   "category": "fatigue",
     "plain": "기력이 부족한 상태",
     "symptoms": ["sym_기탈", "sym_기약", "sym_피로", "sym_단기", "sym_기단천급", "sym_기혈구허",
                  "sym_자한", "sym_양허"]},
    {"id": "U710", "name": "신기허",   "hanja": "腎氣虛", "category": "fatigue",
     "plain": "콩팥의 정기 부족 — 허리·다리 무력, 성기능 저하",
     "symptoms": ["sym_기탈", "sym_양허", "sym_진원부족", "sym_유뇨"]},
    {"id": "U784", "name": "간신음허", "hanja": "肝腎陰虛","category": "fatigue",
     "plain": "간·콩팥의 음액 부족 — 어지럼·이명·식은땀",
     "symptoms": ["sym_진음휴손", "sym_도한", "sym_허한", "sym_안화"]},
    {"id": "U794", "name": "비신양허", "hanja": "脾腎陽虛","category": "fatigue",
     "plain": "비장·콩팥의 양기 부족 — 추위·설사·부종",
     "symptoms": ["sym_양허", "sym_설사", "sym_하리", "sym_부종", "sym_수종", "sym_하리적백"]},

    # 호흡기
    {"id": "U680", "name": "비기허",   "hanja": "脾氣虛", "category": "respiratory",
     "plain": "비장 기능 저하 — 면역·소화 약화, 알레르기 체질",
     "symptoms": ["sym_피로", "sym_식포", "sym_불하식", "sym_부종", "sym_설사", "sym_하리"]},

    # 수면 / 정신
    {"id": "U221", "name": "우울/우수","hanja": "憂愁",   "category": "mind",
     "plain": "기분이 가라앉고 의욕 저하",
     "symptoms": ["sym_칠정내상", "sym_칠정울결", "sym_심계", "sym_정충", "sym_심계정충"]},
    {"id": "U222", "name": "화병",     "hanja": "火病",   "category": "mind",
     "plain": "오랜 스트레스로 가슴이 답답하고 열감",
     "symptoms": ["sym_칠정울결", "sym_번열", "sym_번갈", "sym_심계", "sym_조갈"]},
    {"id": "U332", "name": "야제",     "hanja": "夜啼",   "category": "mind",
     "plain": "밤에 잠을 못 이루고 불안",
     "symptoms": ["sym_수면장애", "sym_심계", "sym_정충", "sym_심계정충", "sym_번열"]},
    {"id": "U651", "name": "간기울결", "hanja": "肝氣鬱結","category": "mind",
     "plain": "스트레스로 간의 기 흐름이 막힘",
     "symptoms": ["sym_칠정울결", "sym_흉만", "sym_흉격불관", "sym_심계"]},
    {"id": "U670", "name": "심화염상", "hanja": "心火炎上","category": "mind",
     "plain": "심장에 열이 올라 가슴 두근·불면",
     "symptoms": ["sym_번열", "sym_번갈", "sym_수면장애", "sym_심계", "sym_조갈", "sym_심계정충"]},

    # 여성 건강
    {"id": "U640", "name": "간혈허",   "hanja": "肝血虛", "category": "womens",
     "plain": "간이 저장한 혈액 부족 — 어지럼·생리 이상",
     "symptoms": ["sym_혈약", "sym_혈비", "sym_기혈구허", "sym_안화", "sym_생리통"]},
]

CATEGORY_DIRECT_SYMPTOMS = {
    "respiratory": [
        "sym_감기", "sym_기침", "sym_상풍", "sym_천급", "sym_천촉", "sym_기단천급",
        "sym_담", "sym_담수", "sym_한천", "sym_인건", "sym_인통", "sym_인후종통",
        "sym_폐위", "sym_풍열상기", "sym_상습",
    ],
    "skin": ["sym_소양", "sym_풍양", "sym_두진"],
    "womens": ["sym_생리통", "sym_갱년기", "sym_하유즙", "sym_잉부통", "sym_태동", "sym_산후출혈부지"],
    "digestive": ["sym_소화불량"],
}

# effectsPlain keyword -> category (fallback for herbs with no symptom data)
PLAIN_KEYWORDS = {
    "musculoskeletal": ["통증", "근육", "관절", "허리", "요통", "어깨", "풍습", "저림", "마목", "비증",
                        "경항", "견비", "근경련", "타박"],
    "digestive":       ["소화", "위", "장", "식적", "구토", "설사", "변비", "소식", "소복", "복통",
                        "소창", "비위", "건위"],
    "respiratory":     ["감기", "기침", "비염", "호흡", "폐", "인후", "해수", "천식", "담음"],
    "fatigue":         ["피로", "허약", "보기", "보혈", "체력", "기력", "원기", "보익", "보허", "허로"],
    "mind":            ["불면", "수면", "우울", "불안", "심신", "신경", "스트레스", "번열", "화병"],
    "head":            ["두통", "어지럼", "현훈", "두풍", "두목", "편두"],
    "womens":          ["갱년기", "월경", "생리", "여성", "자궁", "냉증"],
    "skin":            ["피부", "가려움", "아토피", "발진", "습진"],
}


def infer_cats_from_plain(effects_plain: list[str]) -> list[str]:
    text = " ".join(effects_plain)
    matched = set()
    for cat, kws in PLAIN_KEYWORDS.items():
        if any(kw in text for kw in kws):
            matched.add(cat)
    return list(matched)


# ── 귀경(歸經) 장부 정의 ──────────────────────────────────────────────────────
# 오장(五臟) + 심포 / 육부(六腑). 표리(表裏) 쌍으로 묶임.
ORGANS = [
    {"id": "간",   "hanja": "肝",   "type": "장", "pair": "담",   "plain": "혈을 저장하고 기의 흐름을 조절"},
    {"id": "심",   "hanja": "心",   "type": "장", "pair": "소장", "plain": "혈맥과 정신을 주관"},
    {"id": "비",   "hanja": "脾",   "type": "장", "pair": "위",   "plain": "음식을 소화하고 기혈을 만듦"},
    {"id": "폐",   "hanja": "肺",   "type": "장", "pair": "대장", "plain": "호흡과 기를 주관"},
    {"id": "신",   "hanja": "腎",   "type": "장", "pair": "방광", "plain": "정을 저장하고 수액·생장을 주관"},
    {"id": "심포", "hanja": "心包", "type": "장", "pair": "삼초", "plain": "심장을 감싸 보호하는 막"},
    {"id": "담",   "hanja": "膽",   "type": "부", "pair": "간",   "plain": "결단을 주관하고 담즙을 저장"},
    {"id": "소장", "hanja": "小腸", "type": "부", "pair": "심",   "plain": "맑고 탁한 것을 가려냄"},
    {"id": "위",   "hanja": "胃",   "type": "부", "pair": "비",   "plain": "음식을 받아들이고 삭임"},
    {"id": "대장", "hanja": "大腸", "type": "부", "pair": "폐",   "plain": "찌꺼기를 전달해 배설"},
    {"id": "방광", "hanja": "膀胱", "type": "부", "pair": "신",   "plain": "소변을 저장하고 배출"},
    {"id": "삼초", "hanja": "三焦", "type": "부", "pair": "심포", "plain": "수액과 기가 오가는 통로"},
]
ORGAN_IDS = {o["id"] for o in ORGANS}


# 대표 마커 성분 (현대 약리 분석) — 주요 약재 직접 큐레이션. [(성분명, 화학 계열), ...]
COMPOUNDS = {
    "감초": [("글리시리진", "사포닌"), ("리퀴리틴", "플라보노이드")],
    "인삼": [("진세노사이드", "사포닌")],
    "당귀": [("데쿠르신", "쿠마린"), ("페룰산", "페놀산")],
    "황기": [("아스트라갈로사이드", "사포닌"), ("포르모노네틴", "플라보노이드")],
    "마황": [("에페드린", "알칼로이드")],
    "황금": [("바이칼린", "플라보노이드")],
    "황련": [("베르베린", "알칼로이드")],
    "작약": [("패오니플로린", "모노테르펜 배당체")],
    "천궁": [("리구스틸라이드", "정유"), ("페룰산", "페놀산")],
    "백출": [("아트락틸레논", "정유")],
    "복령": [("파키몬", "다당")],
    "진피": [("헤스페리딘", "플라보노이드"), ("리모넨", "정유")],
    "오미자": [("시잔드린", "리그난")],
    "계피": [("신남알데하이드", "정유")],
    "생강": [("진저롤", "정유")],
    "대황": [("센노사이드", "안트라퀴논"), ("에모딘", "안트라퀴논")],
    "시호": [("사이코사포닌", "사포닌")],
    "길경": [("플라티코딘", "사포닌")],
    "갈근": [("푸에라린", "플라보노이드")],
    "지황": [("카탈폴", "이리도이드 배당체")],
    "치자": [("제니포사이드", "이리도이드 배당체")],
    "목향": [("코스투놀라이드", "정유")],
    "후박": [("마그놀롤", "리그난")],
    "행인": [("아미그달린", "시안 배당체")],
    "부자": [("아코니틴", "알칼로이드")],
    "오수유": [("에보디아민", "알칼로이드")],
    "맥문동": [("오피오포고닌", "사포닌")],
    "반하": [("정유·알칼로이드", "알칼로이드")],
    "방풍": [("크로몬류", "크로몬")],
    "곽향": [("파출리알코올", "정유")],
    "창출": [("아트락틸로딘", "정유")],
    "향부자": [("사이페론", "정유")],
}
# 변종 → 대표 약재 매핑
COMPOUND_ALIAS = {
    "적복령": "복령", "백복령": "복령", "복신": "복령",
    "백작약": "작약", "적작약": "작약",
    "귤피": "진피", "귤홍": "진피", "청피": "진피",
    "육계": "계피", "계지": "계피", "계심": "계피", "관계": "계피",
    "생지황": "지황", "숙지황": "지황",
    "당귀미": "당귀", "건강": "생강",
    "자감초": "감초", "산치자": "치자", "토목향": "목향",
}


def compounds_for(name: str):
    raw = COMPOUNDS.get(name) or COMPOUNDS.get(COMPOUND_ALIAS.get(name, ""))
    if not raw:
        return []
    return [{"name": n, "cls": c} for n, c in raw]


def parse_meridians(meridian: str) -> list[str]:
    """'간(肝), 비(脾), 심(心)' → ['간','비','심'] (정의된 장부만)."""
    found = re.findall(r"([가-힣]+)\(", meridian or "")
    seen = []
    for m in found:
        if m in ORGAN_IDS and m not in seen:
            seen.append(m)
    return seen


# U코드를 초보자가 "내가 이쪽이구나" 자기식별하게 돕는 일상어 cue
EVERYDAY = {
    # 근골격
    "U238": "여기저기 쑤시고 저려요",
    "U240": "손발이 저릿저릿해요",
    "U241": "감각이 둔하고 먹먹해요",
    "U301": "콕콕 쑤시고 아파요",
    "U302": "한 곳이 무겁고 뻐근해요",
    "U303": "목·어깨가 뻣뻣하게 굳어요",
    "U304": "팔꿈치·손목이 시큰해요",
    "U305": "무릎이 붓고 아파요",
    "U306": "근육이 당기고 쥐가 나요",
    "U234": "마비·저림이 남아 있어요",
    # 두통/현훈
    "U230": "두통이 자주 반복돼요",
    "U650": "어지럽고 머리가 띵해요",
    "U233": "어지럽고 손발이 저려요",
    "U236": "손·머리가 떨려요",
    # 소화
    "U280": "체해서 더부룩하고 답답해요",
    "U260": "명치·가슴이 막힌 듯 답답해요",
    "U730": "속이 차고 소화력이 약해요",
    # 호흡기
    "U680": "기운 없고 자주 감기·알레르기",
    # 피로/허증
    "U204": "늘 피곤하고 기운이 없어요",
    "U600": "조금만 해도 쉽게 지쳐요",
    "U710": "허리·다리에 힘이 없어요",
    "U784": "어지럽고 식은땀이 나요",
    "U794": "몸이 차고 잘 붓고 설사해요",
    # 수면/정신
    "U221": "기분이 가라앉고 의욕이 없어요",
    "U222": "가슴이 답답하고 열이 올라요",
    "U332": "밤에 잠들기 어렵고 불안해요",
    "U651": "스트레스로 가슴이 막혀요",
    "U670": "가슴이 두근거리고 잠이 안 와요",
    # 여성
    "U640": "어지럽고 생리가 불규칙해요",
}


def main():
    orig_herbs = json.loads((BACKUP / "herbs.bak.json").read_text(encoding="utf-8"))
    orig_syms  = json.loads((BACKUP / "symptoms.bak.json").read_text(encoding="utf-8"))
    orig_pres  = json.loads((BACKUP / "prescriptions.bak.json").read_text(encoding="utf-8"))

    sym_by_id  = {s["id"]: s for s in orig_syms}
    herb_by_id = {h["id"]: h for h in orig_herbs}
    cat_priority = {c["id"]: i for i, c in enumerate(CATEGORIES)}

    # ── 1) symptom → cats / ucodes ───────────────────────────────────────────
    sym_to_cats   = defaultdict(set)
    sym_to_ucodes = defaultdict(set)
    for uc in UCODES:
        for sid in uc["symptoms"]:
            if sid in sym_by_id:
                sym_to_cats[sid].add(uc["category"])
                sym_to_ucodes[sid].add(uc["id"])
    for cat, sids in CATEGORY_DIRECT_SYMPTOMS.items():
        for sid in sids:
            if sid in sym_by_id:
                sym_to_cats[sid].add(cat)

    kept_sym_ids = set(sym_to_cats.keys())

    # ── 2) specificity model ─────────────────────────────────────────────────
    # 처방 co-occurrence는 감초 같은 조화약을 모든 카테고리에 연결시킨다.
    # 해결: (a) lift(과대표현)로 "특징적" 카테고리만 남기고,
    #       (b) 다빈도 약재(조화약)는 별도 플래그 후 최상위 1개 카테고리에만 노출.
    HARMONIZER_DF = 20   # 처방 등장 횟수 ≥ 20 이면 "두루 쓰이는 기본 약재"
    LIFT_MIN      = 1.2  # 일반 약재가 카테고리에 "특징적"으로 묶이는 최소 lift

    # herb → prescription document frequency
    herb_df = Counter()
    for rx in orig_pres:
        for hid in set(rx.get("herbs", [])):
            herb_df[hid] += 1

    # prescription → categories (그 처방 증상들의 카테고리 합집합)
    rx_cat_sets = []
    for rx in orig_pres:
        cs = set()
        for sid in rx.get("symptoms", []):
            cs |= sym_to_cats.get(sid, set())
        rx_cat_sets.append(cs)

    n_rx = len(orig_pres)
    cat_base = Counter()                 # 카테고리별 처방 수 (baseline)
    herb_cat_count = defaultdict(Counter)  # herb → category → 처방 동시등장 수
    herb_rx_total = Counter()
    herb_sym_via_rx = defaultdict(set)
    for rx, cs in zip(orig_pres, rx_cat_sets):
        for c in cs:
            cat_base[c] += 1
        for hid in set(rx.get("herbs", [])):
            herb_rx_total[hid] += 1
            herb_sym_via_rx[hid].update(rx.get("symptoms", []))
            for c in cs:
                herb_cat_count[hid][c] += 1

    def lift(hid, c):
        if herb_rx_total[hid] == 0 or cat_base[c] == 0:
            return 0.0
        return (herb_cat_count[hid][c] / herb_rx_total[hid]) / (cat_base[c] / n_rx)

    # ── 3) herbs ─────────────────────────────────────────────────────────────
    new_herbs = []
    for h in orig_herbs:
        hid = h["id"]
        sym_links = list(dict.fromkeys(
            [sid for sid in h.get("symptoms", []) if sid in kept_sym_ids]
            + [sid for sid in herb_sym_via_rx.get(hid, []) if sid in kept_sym_ids]
        ))

        # 후보 카테고리: effectsPlain 키워드 ∪ 증상매핑 ∪ 처방동시등장
        kw_cats  = set(infer_cats_from_plain(h.get("effectsPlain", [])))
        sym_cats = set()
        for sid in sym_links:
            sym_cats |= sym_to_cats[sid]
        cand = kw_cats | sym_cats | {c for c in cat_base if herb_cat_count[hid][c] > 0}
        if not cand:
            continue

        is_harm = herb_df[hid] >= HARMONIZER_DF
        # 점수: lift 우선, lift 없으면 키워드 보너스
        def score(c):
            l = lift(hid, c)
            return l if l > 0 else (0.5 if c in kw_cats else 0.0)
        ranked = sorted(cand, key=lambda c: -score(c))

        if is_harm:
            cats = ranked[:1]                       # 조화약: 가장 특징적인 1개만
        else:
            cats = [c for c in ranked if lift(hid, c) >= LIFT_MIN or c in kw_cats][:2]
            if not cats:
                cats = ranked[:1]
        cats = sorted(cats, key=lambda c: cat_priority[c])

        # ucode는 배정된 카테고리 안의 것만
        herb_ucodes = sorted({
            uc for sid in sym_links for uc in sym_to_ucodes[sid]
            if any(u["id"] == uc and u["category"] in cats for u in UCODES)
        })

        new_herbs.append({
            **h,
            "symptoms":        sym_links,
            "categories":      cats,
            "primaryCategory": cats[0] if cats else None,
            "isHarmonizer":    is_harm,
            "rxCount":         herb_df[hid],
            "ucodes":          herb_ucodes,
            "meridians":       parse_meridians(h.get("meridian", "")),
            "compounds":       compounds_for(h["nameKo"]),
        })

    dropped = len(orig_herbs) - len(new_herbs)
    kept_herb_ids = {h["id"] for h in new_herbs}
    print(f"[약재] {len(orig_herbs)} → {len(new_herbs)}  "
          f"(미분류 {dropped}개 제외, 조화약 {sum(1 for h in new_herbs if h['isHarmonizer'])}개)")

    # ── 4) symptoms (keep only mapped) ───────────────────────────────────────
    new_symptoms = []
    for s in orig_syms:
        if s["id"] not in kept_sym_ids:
            continue
        cats = sorted(sym_to_cats[s["id"]], key=lambda c: cat_priority[c])
        ucs  = sorted(sym_to_ucodes[s["id"]])
        new_symptoms.append({**s, "category": cats[0], "categories": cats, "ucodes": ucs})
    print(f"[증상] {len(orig_syms)} → {len(new_symptoms)}")

    # ── 5) prescriptions ─────────────────────────────────────────────────────
    new_prescriptions = []
    for rx in orig_pres:
        rx_herbs = [hid for hid in rx.get("herbs", []) if hid in kept_herb_ids]
        rx_syms  = [sid for sid in rx.get("symptoms", []) if sid in kept_sym_ids]
        if not rx_herbs:
            continue
        rx_cats = set()
        for sid in rx_syms:
            rx_cats.update(sym_to_cats[sid])
        new_prescriptions.append({
            **rx,
            "herbs": rx_herbs,
            "symptoms": rx_syms,
            "categories": sorted(rx_cats, key=lambda c: cat_priority[c]),
        })
    print(f"[처방] {len(orig_pres)} → {len(new_prescriptions)}")

    # ── 6) edges ─────────────────────────────────────────────────────────────
    rx_by_pair = defaultdict(int)
    for rx in new_prescriptions:
        for hid in rx["herbs"]:
            for sid in rx["symptoms"]:
                rx_by_pair[(hid, sid)] += 1

    herb_sym_edges = [
        {"source": h["id"], "target": sid,
         "weight": 1 + rx_by_pair.get((h["id"], sid), 0) ** 0.5,
         "prescriptionCount": rx_by_pair.get((h["id"], sid), 0)}
        for h in new_herbs for sid in h["symptoms"]
    ]
    herb_ucode_edges = [{"source": h["id"], "target": uc} for h in new_herbs for uc in h["ucodes"]]
    ucode_cat_edges  = [{"source": uc["id"], "target": uc["category"]} for uc in UCODES]

    # ── 7) category / ucode summaries ────────────────────────────────────────
    cat_herb_count  = defaultdict(int)
    cat_feat_count  = defaultdict(int)
    cat_harm_count  = defaultdict(int)
    ucode_herb_map  = defaultdict(list)
    for h in new_herbs:
        for c in h["categories"]:
            cat_herb_count[c] += 1
            if h["isHarmonizer"]:
                cat_harm_count[c] += 1
            else:
                cat_feat_count[c] += 1
        for uc in h["ucodes"]:
            ucode_herb_map[uc].append(h["id"])

    categories_out = [{
        **c,
        "ucodes":    [uc["id"] for uc in UCODES if uc["category"] == c["id"]],
        "herbCount": cat_herb_count[c["id"]],
        "featCount": cat_feat_count[c["id"]],
        "harmCount": cat_harm_count[c["id"]],
        "ucodeCount": sum(1 for uc in UCODES if uc["category"] == c["id"]),
    } for c in CATEGORIES]

    ucodes_out = [{
        **uc,
        "everyday":  EVERYDAY.get(uc["id"], ""),
        "herbs":     ucode_herb_map[uc["id"]],
        "herbCount": len(ucode_herb_map[uc["id"]]),
        "symptoms":  [s for s in uc["symptoms"] if s in kept_sym_ids],
    } for uc in UCODES]

    # ── 7b) 귀경 장부 요약 ────────────────────────────────────────────────────
    organ_herb_map = defaultdict(list)
    for h in new_herbs:
        for m in h["meridians"]:
            organ_herb_map[m].append(h["id"])
    organs_out = [{
        **o,
        "herbs":     organ_herb_map[o["id"]],
        "herbCount": len(organ_herb_map[o["id"]]),
    } for o in ORGANS]
    n_with_mer = sum(1 for h in new_herbs if h["meridians"])

    # ── 8) write ──────────────────────────────────────────────────────────────
    (DATA / "organs.json").write_text(json.dumps(organs_out, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "categories.json").write_text(json.dumps(categories_out, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "ucodes.json").write_text(    json.dumps(ucodes_out,     ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "herbs.json").write_text(     json.dumps(new_herbs,      ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "symptoms.json").write_text(  json.dumps(new_symptoms,   ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "prescriptions.json").write_text(json.dumps(new_prescriptions, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA / "edges.json").write_text(json.dumps({
        "herbSymptom": herb_sym_edges,
        "herbUcode":   herb_ucode_edges,
        "ucodeCategory": ucode_cat_edges,
    }, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== 카테고리별 ===")
    for c in categories_out:
        print(f"  {c['name']:20s}  U{c['ucodeCount']:2d}  약재 {c['herbCount']:3d}")
    print(f"\n=== 귀경 장부 (재료 {n_with_mer}/{len(new_herbs)}개 보유) ===")
    for o in sorted(organs_out, key=lambda x: -x["herbCount"]):
        print(f"  {o['id']:3s}({o['type']})  {o['herbCount']:3d}개")


if __name__ == "__main__":
    main()
