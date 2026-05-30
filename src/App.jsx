import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Compass,
  Grid3x3,
  Leaf,
  Moon,
  Search,
  Sparkles,
  Sprout,
  Waves,
} from "lucide-react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from "d3";
import L from "leaflet";
import DiagnosisResult from "./DiagnosisResult.jsx";

const dataFiles = {
  herbs: "/data/herbs.json",
  symptoms: "/data/symptoms.json",
  prescriptions: "/data/prescriptions.json",
  edges: "/data/edges.json",
  categories: "/data/categories.json",
  ucodes: "/data/ucodes.json",
  organs: "/data/organs.json",
  herbImages: "/data/herb_images.json",
};

const ICONS = {
  Activity, Brain, Waves, Sparkles, Sprout, Moon, CircleDot, Leaf,
};

const DEFAULT_BODY_TAGS = [
  { id: "head_skin",    label: "머리/얼굴/피부", count: 2858, tag: { x: 6,  y:  9 }, zone: "ellipse(10% 8%  at 50% 11%)", gradient: "radial-gradient(ellipse 62% 78% at 50% 11%, rgba(185,70,60,0.54), transparent 72%)" },
  { id: "neck_shoulder",label: "목/어깨",        count: 1628, tag: { x: 72, y: 20 }, zone: "ellipse(30% 5%  at 50% 22%)", gradient: "radial-gradient(ellipse 92% 44% at 50% 22%, rgba(185,70,60,0.48), transparent 70%)" },
  { id: "whole",        label: "전신",           count: 2560, tag: { x: 82, y: 32 }, zone: "inset(0% 0% 0% 0%)",           gradient: "radial-gradient(ellipse 80% 90% at 50% 50%, rgba(185,70,60,0.28), transparent 72%)" },
  { id: "digestive",    label: "소화기",         count:  297, tag: { x: 82, y: 44 }, zone: "ellipse(10% 9%  at 50% 39%)", gradient: "radial-gradient(ellipse 55% 84% at 50% 39%, rgba(185,70,60,0.52), transparent 72%)" },
  { id: "waist",        label: "허리",           count:  909, tag: { x: 6,  y: 48 }, zone: "ellipse(28% 4%  at 50% 47%)", gradient: "radial-gradient(ellipse 92% 42% at 50% 47%, rgba(185,70,60,0.50), transparent 68%)" },
  { id: "leg_knee",     label: "다리/무릎",      count:  390, tag: { x: 82, y: 72 }, zone: "inset(60% 32% 16% 32%)",      gradient: "radial-gradient(ellipse 32% 13% at 50% 72%, rgba(185,70,60,0.54), transparent 90%)" },
];

function useBodyTags() {
  const [bodyTags, setBodyTags] = useState(DEFAULT_BODY_TAGS);
  useEffect(() => {
    fetch("/data/body_tags.json")
      .then((res) => res.json())
      .then(setBodyTags)
      .catch(() => {});
  }, []);
  return bodyTags;
}

function useKnowledgeData() {
  const [data, setData] = useState({
    herbs: [], symptoms: [], prescriptions: [],
    edges: { herbSymptom: [], herbUcode: [], ucodeCategory: [] },
    categories: [], ucodes: [], organs: [], herbImages: {},
  });

  useEffect(() => {
    Promise.all(
      Object.entries(dataFiles).map(([key, path]) =>
        fetch(path).then((res) => res.json()).then((value) => [key, value])
      )
    )
      .then((entries) => setData(Object.fromEntries(entries)))
      .catch((err) => console.error("data fetch failed", err));
  }, []);

  return data;
}

function useClinicsData(active) {
  const [clinics, setClinics] = useState([]);
  useEffect(() => {
    if (!active || clinics.length) return;
    fetch("/data/clinic_journal.json").then((r) => r.json()).then(setClinics).catch(console.error);
  }, [active]);
  return clinics;
}

function App() {
  const [view, setViewState] = useState(() => {
    const h = window.location.hash;
    if (h === "#library") return "library";
    if (h === "#clinics") return "clinics";
    if (h === "#sasang") return "sasang";
    if (h === "#diagnosis") return "diagnosis";
    return "navigation";
  });
  const [complaint, setComplaint] = useState(null);
  const [libTarget, setLibTarget] = useState(null); // 진단→라이브러리 사전선택 U코드
  const data = useKnowledgeData();
  const clinicsData = useClinicsData(view === "clinics");
  const ucodeIdSet = useMemo(() => new Set((data.ucodes || []).map((u) => u.id)), [data.ucodes]);

  const setView = (nextView) => {
    setViewState(nextView);
    const hashMap = { library: "library", clinics: "clinics", sasang: "sasang", diagnosis: "diagnosis" };
    window.location.hash = hashMap[nextView] || "";
  };

  // 증상 선택 → 진단 결과 화면 열기
  const startDiagnosis = (c) => {
    if (!c) return;
    setComplaint(c);
    setView("diagnosis-result");
  };

  // 진단 결과의 변증(U코드) → 라이브러리에서 연결 약재 보기
  const openLibraryUcode = (uid) => {
    setLibTarget(uid);
    setView("library");
  };

  const isAltView = view === "library" || view === "clinics" || view === "sasang";
  const shellExtra = view === "library" ? "library-shell" : view === "clinics" ? "clinics-shell" : view === "sasang" ? "sasang-shell" : view === "navigation" ? "navigation-shell" : "";
  return (
    <main className={`shell ${shellExtra}`}>
      <Header view={view} setView={setView} />
      {view === "navigation" ? <PersonaGuide setView={setView} /> :
       view === "library" ? <HerbLibrary data={data} initialSelectedId={libTarget} onConsumeInitial={() => setLibTarget(null)} /> :
       view === "clinics" ? <ClinicsPage clinics={clinicsData} /> :
       view === "sasang" ? <SasangPage setView={setView} /> :
       view === "diagnosis-result" && complaint ? <DiagnosisResult complaint={complaint} setView={setView} onOpenLibrary={openLibraryUcode} ucodeIds={ucodeIdSet} /> :
       <StartPage setView={setView} onDiagnose={startDiagnosis} />}
    </main>
  );
}

function Header({ view, setView }) {
  const items = [
    ["navigation", "NAVIGATION"],
    ["diagnosis", "SELF-DIAGNOSIS"],
    ["library", "HERB LIBRARY"],
    ["clinics", "CLINICS"],
    ["sasang", "SASANG"],
  ];

  return (
    <header className="topbar">
      <button className="brand brand-button" type="button" onClick={() => setView("navigation")}>MEDVIS</button>
      <nav className="nav" aria-label="Primary">
        {items.map(([key, label]) => (
          <button key={key} className={view === key ? "active" : ""} type="button" onClick={() => setView(key)}>
            {label}
          </button>
        ))}
      </nav>
      <div className="actions" />
    </header>
  );
}

// 랜딩 페르소나 가이드 — 방문자 유형별 추천 사용 경로
const PERSONAS = [
  {
    id: "general",
    icon: Activity,
    title: "증상이 있어요",
    subtitle: "일반 · 환자",
    blurb: "지금 몸이 보내는 신호를 먼저 확인하고, 필요하면 가까운 한의원까지 이어서 찾아보세요.",
    steps: [
      { label: "증상 자가 체크", view: "diagnosis" },
      { label: "가까운 한의원 찾기", view: "clinics" },
    ],
  },
  {
    id: "constitution",
    icon: Sprout,
    title: "내 체질이 궁금해요",
    subtitle: "사상체질",
    blurb: "10가지 질문으로 사상체질을 알아보고, 체질에 맞는 약재와 음식을 확인해 보세요.",
    steps: [
      { label: "사상체질 진단", view: "sasang" },
      { label: "맞는 약재 살펴보기", view: "library" },
    ],
  },
  {
    id: "clinic",
    icon: Compass,
    title: "한의원을 찾아요",
    subtitle: "후기 · 지도",
    blurb: "지역과 진료과목으로 한의원을 찾고, 환자 후기를 모은 치료 결과를 비교해 보세요.",
    steps: [
      { label: "한의원 지도 보기", view: "clinics" },
    ],
  },
];

function PersonaGuide({ setView }) {
  const [persona, setPersona] = useState(PERSONAS[0].id);
  const active = PERSONAS.find((p) => p.id === persona) || PERSONAS[0];
  return (
    <section className="persona-guide" aria-label="사용 안내">
      <div className="persona-left">
        <h2 className="persona-title">어디서부터 보면 좋을까요?</h2>
        <p className="persona-lead">당신이 누구냐에 따라, 이 사이트를 어떻게 쓰면 좋을지 안내해드려요.</p>
        <div className="persona-guide-detail">
          <p className="persona-blurb">{active.blurb}</p>
          <div className="persona-path">
            {active.steps.map((s, i) => (
              <Fragment key={s.label}>
                {i > 0 && <span className="persona-arrow" aria-hidden="true"><ArrowRight size={16} /></span>}
                <button type="button" className="persona-step" onClick={() => setView(s.view)}>
                  <em>{String(i + 1).padStart(2, "0")}</em>{s.label}
                </button>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      <div className="persona-right">
        <div className="persona-cards" role="tablist">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            const on = p.id === persona;
            return (
              <button key={p.id} type="button" role="tab" aria-selected={on}
                className={`persona-card ${on ? "active" : ""}`}
                onClick={() => setPersona(p.id)}>
                <span className="persona-card-icon"><Icon size={22} /></span>
                <span className="persona-card-body">
                  <strong>{p.title}</strong>
                  <small>{p.subtitle}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// UI 라벨 → DB 한방 호소 enum (루트 medvis app.js FREQUENT 매핑 이식)
const SYMPTOMS = [
  ["피로감", Activity, "만성피로"],
  ["소화불량", Waves, "소화 증상"],
  ["수면장애", Moon, "불면"],
  ["두통", Brain, "두통 증상"],
  ["어깨 결림", CircleDot, "견비통"],
  ["손발 차가움", Sparkles, "냉증"],
  ["생리통", CircleDot, "월경통"],
  ["스트레스", Sprout, "스트레스"],
];

// 신체부위별 한방 호소 (루트 medvis app.js BODY_PARTS 이식)
const BODY_PARTS = [
  { part: "head", label: "머리/정신", complaints: ["두통 증상", "불면", "스트레스", "우울_불안", "공황", "만성피로", "탈모", "틱", "ADHD증상"] },
  { part: "chest", label: "가슴", complaints: ["호흡기 증상", "공황", "축농증상", "가래"] },
  { part: "shoulder", label: "어깨/허리", complaints: ["견비통", "경항통", "요통", "디스크증상", "근육통", "교통사고후유증", "좌상_타박", "손목통증"] },
  { part: "digest", label: "소화기", complaints: ["소화 증상", "식욕부진"] },
  { part: "lower", label: "하복부", complaints: ["월경통", "월경불순", "갱년기증상", "산후관리", "난임관련", "냉증", "야뇨"] },
  { part: "leg", label: "다리/하체", complaints: ["슬통", "족통", "좌골신경통", "손발저림", "안면마비"] },
];
const BODY_BY_PART = Object.fromEntries(BODY_PARTS.map((b) => [b.part, b]));
// 전체 호소 (순서 보존 중복 제거)
const ALL_COMPLAINTS = [...new Set(BODY_PARTS.flatMap((b) => b.complaints))];
// 인체 레이어 body tag → 관련 증상 매핑
const BODY_TAG_COMPLAINTS = {
  head_skin:    ["두통 증상", "불면", "스트레스", "만성피로", "탈모", "ADHD증상"],
  neck_shoulder:["견비통", "경항통", "요통", "디스크증상", "근육통", "손목통증"],
  whole:        ALL_COMPLAINTS,
  digestive:    ["소화 증상", "식욕부진"],
  waist:        ["요통", "디스크증상", "근육통", "교통사고후유증", "좌상_타박"],
  leg_knee:     ["슬통", "족통", "좌골신경통", "손발저림"],
};
// 친숙 라벨/아이콘 (8개 frequent만; 나머지는 enum 라벨 + 기본 아이콘)
const LABEL_BY_COMPLAINT = Object.fromEntries(SYMPTOMS.map(([label, , c]) => [c, label]));
const ICON_BY_COMPLAINT = Object.fromEntries(SYMPTOMS.map(([, Icon, c]) => [c, Icon]));
const labelOf = (c) => LABEL_BY_COMPLAINT[c] || c;
const iconOf = (c) => ICON_BY_COMPLAINT[c] || Leaf;

function StartPage({ setView, onDiagnose }) {
  const [selected, setSelected] = useState("만성피로"); // 선택된 한방 호소(enum)
  const [activeBody, setActiveBody] = useState(null);     // 신체부위 필터
  const [showAll, setShowAll] = useState(false);          // 전체 증상 보기
  const [query, setQuery] = useState("");                 // 검색어
  const [activeBodyTag, setActiveBodyTag] = useState(null);
  const [debugPos, setDebugPos] = useState(null);
  const bodyTags = useBodyTags();
  const bodyDebug = new URLSearchParams(window.location.search).has("bodyDebug");
  const primary = selected || null;
  const goDiagnose = () => onDiagnose && onDiagnose(primary);

  const handleFigureMouseMove = bodyDebug ? (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width * 100);
    const y = Math.round((e.clientY - rect.top) / rect.height * 100);
    setDebugPos({ x, y });
  } : undefined;
  const handleFigureMouseLeave = bodyDebug ? () => setDebugPos(null) : undefined;

  const toggleComplaint = (c) => setSelected((cur) => cur === c ? null : c);
  const resetView = () => { setShowAll(false); setActiveBody(null); setQuery(""); };
  const pickBody = (part) => { setQuery(""); setShowAll(false); setActiveBody((p) => (p === part ? null : part)); };

  // 표시 목록 우선순위: 검색 > 전체 > 신체부위 > 자주 8
  const q = query.trim();
  let items, headerLabel;
  if (q) {
    items = ALL_COMPLAINTS.filter((c) => labelOf(c).includes(q) || c.includes(q));
    headerLabel = `검색 결과 (${items.length})`;
  } else if (showAll) {
    items = ALL_COMPLAINTS;
    headerLabel = `전체 증상 (${items.length})`;
  } else if (activeBody && BODY_TAG_COMPLAINTS[activeBody]) {
    items = BODY_TAG_COMPLAINTS[activeBody];
    const tagLabel = bodyTags.find((t) => t.id === activeBody)?.label || activeBody;
    headerLabel = `${tagLabel} 관련 증상`;
  } else if (activeBody && BODY_BY_PART[activeBody]) {
    items = BODY_BY_PART[activeBody].complaints;
    headerLabel = `${BODY_BY_PART[activeBody].label} 관련 증상`;
  } else {
    items = SYMPTOMS.map(([, , c]) => c);
    headerLabel = "자주 선택한 증상";
  }
  const isFrequent = !q && !showAll && !activeBody && !activeBodyTag;

  return (
    <>
      <section className="hero" aria-label="Self diagnosis">
      <div className="intro">
        <p className="eyebrow">SELF-DIAGNOSIS</p>
        <h1>당신의 몸은 지금,<br />어떤 신호를<br />보내고 있나요?</h1>
        <p className="copy">몸이 보내는 작은 신호들을 놓치지 마세요.<br />AI가 당신의 컨디션을 분석하고, 균형 회복을 위한<br />맞춤 솔루션을 제안해드려요.</p>
      </div>

      <div className="anatomy-stage" aria-label="신체 부위">
        <div className="orbit orbit-a" aria-hidden="true" /><div className="orbit orbit-b" aria-hidden="true" /><div className="orbit orbit-c" aria-hidden="true" />
        <div className="spark s1" aria-hidden="true" /><div className="spark s2" aria-hidden="true" /><div className="spark s3" aria-hidden="true" />
        <div className={`figure-wrap ${bodyDebug ? "debug" : ""}`}
          onMouseMove={handleFigureMouseMove}
          onMouseLeave={handleFigureMouseLeave}
        >
          <img className="human-figure" src="/assets/images/human-figure-cropped.png" alt="" />
          <div className="body-heat-layer">
            {bodyTags.map((part) => (
              <div key={`${part.id}-heat`}
                className={`body-heat-zone ${activeBodyTag === part.id ? "active" : ""}`}
                style={{ clipPath: part.zone, WebkitClipPath: part.zone, background: part.gradient }}
              />
            ))}
          </div>
          <div className="body-zone-debug" aria-hidden="true">
            {bodyTags.map((part) => (
              <div key={`${part.id}-debug`} className="body-zone-guide"
                style={{ clipPath: part.zone, WebkitClipPath: part.zone }} />
            ))}
          </div>
          {bodyDebug && debugPos && (
            <>
              <div className="debug-crosshair-v" style={{ left: `${debugPos.x}%` }} />
              <div className="debug-crosshair-h" style={{ top: `${debugPos.y}%` }} />
              <div className="debug-pos-label" style={{
                left: debugPos.x > 60 ? "auto" : `${debugPos.x}%`,
                right: debugPos.x > 60 ? `${100 - debugPos.x}%` : "auto",
                top: debugPos.y > 80 ? "auto" : `${debugPos.y}%`,
                bottom: debugPos.y > 80 ? `${100 - debugPos.y}%` : "auto",
              }}>x:{debugPos.x} y:{debugPos.y}</div>
            </>
          )}
          {bodyTags.map((part) => (
            <button key={part.id}
              className={`body-tag data-body-tag ${activeBodyTag === part.id ? "active" : ""}`}
              style={{ left: `${part.tag.x}%`, top: `${part.tag.y}%` }}
              type="button"
              onMouseEnter={() => setActiveBodyTag(part.id)}
              onMouseLeave={() => setActiveBodyTag(null)}
              onClick={() => {
                const complaints = BODY_TAG_COMPLAINTS[part.id] || [];
                setActiveBody(part.id);
                setShowAll(false);
                setQuery("");
                if (complaints.length > 0) setSelected(complaints[0]);
              }}
            >
              <span />{part.label}
              <small>{Number(part.count || 0).toLocaleString()}</small>
            </button>
          ))}
        </div>
      </div>

      <aside className="diagnosis" aria-label="증상 선택">
        <div className="panel">
          <h2>어떤 증상이 느껴지나요?</h2>
          <p>해당하는 증상을 선택해주세요.</p>
          <label className="search"><Search size={18} /><input type="search" placeholder="증상을 검색해보세요" value={query} onChange={(e) => { setQuery(e.target.value); setShowAll(false); setActiveBody(null); }} /></label>
          <p className="section-label">
            <span>{headerLabel}</span>
            {!isFrequent && <button type="button" className="clear" onClick={resetView}>← 자주 본 증상</button>}
          </p>
          <div className={`symptoms ${isFrequent ? "" : "expanded"}`}>
            {items.length === 0 ? (
              <p className="sym-empty">검색 결과가 없어요. 다른 키워드로 찾아보세요.</p>
            ) : (
              items.map((complaint) => {
                const Icon = iconOf(complaint);
                const isSelected = selected === complaint;
                return (
                  <button key={complaint} className={`symptom ${isSelected ? "selected" : ""}`} type="button" onClick={() => toggleComplaint(complaint)}>
                    {isSelected && <i className="check">✓</i>}
                    <Icon className="sym-icon" />
                    {labelOf(complaint)}
                  </button>
                );
              })
            )}
          </div>
          <button className="all" type="button" onClick={() => { setShowAll((v) => !v); setActiveBody(null); setQuery(""); }}>
            <span>{showAll ? "자주 본 증상만" : "전체 증상 보기"}</span><b>{showAll ? "－" : "＋"}</b>
          </button>
          <button className="complete" type="button" onClick={goDiagnose} disabled={!primary}><span>선택 완료</span><b><ArrowRight size={20} /></b></button>
        </div>
      </aside>

      </section>
    </>
  );
}

function HerbLibrary({ data, initialSelectedId, onConsumeInitial }) {
  const { herbs, symptoms, prescriptions, categories, ucodes, organs, herbImages } = data;
  const [viewMode, setViewMode] = useState("guide"); // 'guide' | 'organ' | 'prescription'
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [selectedId, setSelectedId] = useState(null); // herb_xxx | U### | sym_xxx
  const [query, setQuery] = useState("");

  // initialize once data is loaded
  useEffect(() => {
    if (categories.length && !activeCategoryId) setActiveCategoryId(categories[0].id);
  }, [categories, activeCategoryId]);

  const herbById = useMemo(() => Object.fromEntries(herbs.map((h) => [h.id, h])), [herbs]);
  const symById = useMemo(() => Object.fromEntries(symptoms.map((s) => [s.id, s])), [symptoms]);
  const ucodeById = useMemo(() => Object.fromEntries(ucodes.map((u) => [u.id, u])), [ucodes]);

  // 진단 결과에서 넘어온 변증(U코드) 사전선택 적용 (1회 소비)
  useEffect(() => {
    if (!initialSelectedId) return;
    setSelectedId(initialSelectedId);
    const cat = ucodeById[initialSelectedId]?.category;
    if (cat) setActiveCategoryId(cat);
    setViewMode("guide");
    if (onConsumeInitial) onConsumeInitial();
  }, [initialSelectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  const catById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  const organById = useMemo(() => Object.fromEntries(organs.map((o) => [o.id, o])), [organs]);

  const filteredHerbs = useMemo(() => {
    if (!query) return herbs;
    const q = query.trim();
    if (!q) return herbs;
    return herbs.filter((h) => {
      const hay = `${h.nameKo} ${h.nameHanja} ${(h.effectsPlain || []).join(" ")} ${(h.effectsTraditional || []).join(" ")}`;
      return hay.includes(q);
    });
  }, [herbs, query]);

  if (!categories.length || !herbs.length) {
    return <section className="library-page"><div className="library-left glass-panel"><p>데이터를 불러오는 중…</p></div></section>;
  }

  return (
    <section className="library-page">
      <LibraryLeftPanel
        query={query}
        setQuery={setQuery}
        filteredHerbs={filteredHerbs}
        onPickHerb={(id) => setSelectedId(id)}
        herbs={herbs}
      />

      <div className="library-center">
        <div className="center-head">
          <div className="center-head-text">
            {viewMode === "guide" ? (
              <>
                <h2>어떤 점이 불편하세요?</h2>
                <p>불편한 영역을 고르고, 가까운 느낌을 따라가면 맞는 재료를 찾아드려요.</p>
              </>
            ) : viewMode === "prescription" ? (
              <>
                <h2>처방 사전</h2>
                <p>전통 한방 처방 {prescriptions.length}가지를 약재 구성과 적용 병증으로 살펴보세요.</p>
              </>
            ) : (
              <>
                <h2>약재들은 어떻게 연결될까요?</h2>
                <p>작용 장부(귀경)와 대표 성분 계열, 두 렌즈로 재료의 숨은 연결을 살펴보세요.</p>
              </>
            )}
          </div>
          <div className="view-toggle glass-panel">
            <button
              type="button"
              className={viewMode === "guide" ? "active" : ""}
              onClick={() => setViewMode("guide")}
            >
              <Compass size={15} /> 안내
            </button>
            <button
              type="button"
              className={viewMode === "organ" ? "active" : ""}
              onClick={() => setViewMode("organ")}
            >
              <Sparkles size={15} /> 약재 유니버스
            </button>
            <button
              type="button"
              className={viewMode === "prescription" ? "active" : ""}
              onClick={() => { setViewMode("prescription"); setSelectedId(null); }}
            >
              <BookOpen size={15} /> 처방 사전
            </button>
          </div>
        </div>

        <div className="center-panel glass-panel">
          {viewMode === "guide" ? (
            <>
              <CategoryGrid
                categories={categories}
                activeCategoryId={activeCategoryId}
                setActiveCategoryId={(id) => { setActiveCategoryId(id); setSelectedId(null); }}
              />
              <GuidedView
                categories={categories}
                ucodes={ucodes}
                herbs={herbs}
                activeCategoryId={activeCategoryId}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                ucodeById={ucodeById}
              />
            </>
          ) : viewMode === "prescription" ? (
            <PrescriptionView
              prescriptions={prescriptions}
              herbById={herbById}
              categories={categories}
              catById={catById}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            />
          ) : (
            <OrganMap
              organs={organs}
              herbs={herbs}
              categories={categories}
              catById={catById}
              organById={organById}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
            />
          )}
        </div>
      </div>

      <DetailPanel
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        herbById={herbById}
        symById={symById}
        ucodeById={ucodeById}
        catById={catById}
        organById={organById}
        herbImages={herbImages}
        prescriptions={prescriptions}
        activeCategoryId={activeCategoryId}
      />
    </section>
  );
}

function LibraryLeftPanel({ query, setQuery, filteredHerbs, onPickHerb, herbs }) {
  const friendlyNames = ["생강", "계피", "인삼", "감초", "당귀"];
  return (
    <div className="library-left glass-panel">
      <p className="eyebrow">HANYUL · 한방 재료 도감</p>
      <h1>오늘 내 몸엔<br />어떤 재료가<br />필요할까요?</h1>
      <p className="copy">불편한 곳을 고르면, 예로부터 그 증상에 쓰여온 한방 재료를 모아 보여드려요.</p>

      <label className="library-search">
        <Search size={15} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="재료 이름이나 효능을 검색" />
      </label>

      {query ? (
        <div className="browse-block herb-results">
          <h3>검색 결과 {filteredHerbs.length}건</h3>
          {filteredHerbs.length === 0 && <p className="muted-hint">일치하는 재료를 찾지 못했어요.</p>}
          {filteredHerbs.slice(0, 8).map((herb) => (
            <button key={herb.id} type="button" onClick={() => onPickHerb(herb.id)}>
              <span>{herb.nameKo}</span>
              <small>{herb.nameHanja}</small>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      ) : (
        <div className="browse-block">
          <h3>익숙한 재료부터</h3>
          <div className="material-list">
            {friendlyNames.map((name) => {
              const herb = herbs.find((h) => h.nameKo === name);
              return (
                <button key={name} type="button" disabled={!herb} onClick={() => herb && onPickHerb(herb.id)}>
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="left-foot">전통 문헌의 기록을 정리한 정보예요.<br />의학적 진단이나 복용 권고가 아닙니다.</p>
    </div>
  );
}

function CategoryGrid({ categories, activeCategoryId, setActiveCategoryId }) {
  return (
    <div className="card-grid">
      {categories.map((cat) => {
        const Icon = ICONS[cat.icon] || Leaf;
        const isActive = cat.id === activeCategoryId;
        return (
          <button
            key={cat.id}
            type="button"
            className={`cat-card ${isActive ? "active" : ""}`}
            onClick={() => setActiveCategoryId(cat.id)}
            style={{
              "--cat-color": cat.color,
              background: isActive ? `linear-gradient(135deg, ${cat.color}22, ${cat.color}08)` : "rgba(255,255,255,0.42)",
              borderColor: isActive ? cat.color : "rgba(255,255,255,0.78)",
            }}
          >
            <div className="cat-card-icon" style={{ background: `${cat.color}1f`, color: cat.color }}>
              <Icon size={20} />
            </div>
            <div className="cat-card-body">
              <strong>{cat.name}</strong>
              <small>{cat.tagline}</small>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function HerbCard({ herb, accent, selected, onClick, ucodeById, showTypes = false }) {
  return (
    <button
      type="button"
      className={`herb-card ${selected ? "selected" : ""} ${herb.isHarmonizer ? "harmonizer" : ""}`}
      onClick={onClick}
      style={selected ? { borderColor: accent } : {}}
    >
      <span className="herb-name">
        {herb.nameKo}
        {herb.isHarmonizer && <i className="harm-badge">기본</i>}
      </span>
      <small className="herb-hanja">{herb.nameHanja}</small>
      {showTypes && !herb.isHarmonizer && herb.ucodes.length > 0 && (
        <div className="herb-ucodes">
          {herb.ucodes.slice(0, 3).map((uid) => {
            const u = ucodeById[uid];
            if (!u) return null;
            return <span key={uid} style={{ background: `${accent}14` }}>{u.name}</span>;
          })}
          {herb.ucodes.length > 3 && <span>+{herb.ucodes.length - 3}</span>}
        </div>
      )}
    </button>
  );
}

function HerbSections({ herbs, accent, selectedId, setSelectedId, ucodeById, showTypes }) {
  const feat = herbs.filter((h) => !h.isHarmonizer);
  const harm = herbs.filter((h) => h.isHarmonizer);
  return (
    <>
      {feat.length > 0 && (
        <div className="herb-section">
          <p className="herb-section-label">이 증상에 특징적인 재료 <em>{feat.length}</em></p>
          <div className="herb-grid">
            {feat.map((h) => (
              <HerbCard key={h.id} herb={h} accent={accent} selected={selectedId === h.id}
                onClick={() => setSelectedId(h.id)} ucodeById={ucodeById} showTypes={showTypes} />
            ))}
          </div>
        </div>
      )}
      {harm.length > 0 && (
        <div className="herb-section">
          <p className="herb-section-label muted">
            두루 쓰이는 기본 약재 <em>{harm.length}</em>
            <span className="label-hint">여러 처방에 공통으로 들어가는 조화·보조 재료예요</span>
          </p>
          <div className="herb-grid">
            {harm.map((h) => (
              <HerbCard key={h.id} herb={h} accent={accent} selected={selectedId === h.id}
                onClick={() => setSelectedId(h.id)} ucodeById={ucodeById} showTypes={showTypes} />
            ))}
          </div>
        </div>
      )}
      {herbs.length === 0 && (
        <p style={{ color: "#7b8590", padding: "16px 4px" }}>매핑된 재료가 없어요.</p>
      )}
    </>
  );
}

// 초보자 안내: 영역 → (유형 좁히기) → 맞는 재료
function GuidedView({ categories, ucodes, herbs, activeCategoryId, selectedId, setSelectedId, ucodeById }) {
  const activeCat = categories.find((c) => c.id === activeCategoryId);
  const catUcodes = useMemo(
    () => ucodes.filter((u) => u.category === activeCategoryId && u.herbCount > 0)
      .sort((a, b) => b.herbCount - a.herbCount),
    [ucodes, activeCategoryId]
  );
  const catHerbs = useMemo(
    () => herbs.filter((h) => h.categories.includes(activeCategoryId)),
    [herbs, activeCategoryId]
  );
  const [pickedType, setPickedType] = useState(null);
  useEffect(() => { setPickedType(null); }, [activeCategoryId]);

  if (!activeCat) return null;
  const accent = activeCat.color;
  const hasTypes = catUcodes.length >= 2;
  const typeObj = pickedType ? ucodeById[pickedType] : null;

  // 추천 재료: 유형 선택 시 그 유형 재료, 아니면 영역 전체 특징 재료
  const recHerbs = typeObj
    ? typeObj.herbs.map((id) => herbs.find((h) => h.id === id)).filter(Boolean)
    : catHerbs;

  // STEP: 유형 질문 (유형 2개 이상 & 미선택)
  if (hasTypes && !typeObj) {
    return (
      <div className="guide-view">
        <div className="guide-context">
          <p className="guide-q">‘{activeCat.name}’ — 어떤 느낌에 가까우세요?</p>
          <p className="guide-sub">가장 비슷한 걸 고르면 맞는 재료를 보여드려요. 잘 모르겠다면 아무거나 눌러봐도 좋아요.</p>
        </div>
        <div className="type-grid">
          {catUcodes.map((uc) => (
            <button key={uc.id} type="button" className="type-card"
              onClick={() => setPickedType(uc.id)}
              style={{ "--cat-color": accent }}>
              <span className="type-everyday">{uc.everyday || uc.plain}</span>
              <span className="type-meta">{uc.name} · 재료 {uc.herbCount}가지</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // STEP: 추천 재료
  return (
    <div className="guide-view">
      <div className="guide-result-head">
        {hasTypes && (
          <button type="button" className="guide-back" onClick={() => setPickedType(null)}>
            <ChevronLeft size={15} /> 다른 느낌 보기
          </button>
        )}
        <div className="guide-context-card" style={{ borderColor: `${accent}40`, background: `${accent}0c` }}>
          {typeObj ? (
            <>
              <p className="guide-context-everyday">“{typeObj.everyday || typeObj.plain}”</p>
              <p className="guide-context-desc">
                <strong style={{ color: accent }}>{typeObj.name}</strong> · {typeObj.plain}
              </p>
            </>
          ) : (
            <>
              <p className="guide-context-everyday">{activeCat.name}</p>
              <p className="guide-context-desc">{activeCat.tagline}</p>
            </>
          )}
        </div>
        <p className="guide-rec-label">이런 재료가 전통적으로 쓰여 왔어요 · 눌러서 자세히 보기</p>
      </div>

      <HerbSections herbs={recHerbs} accent={accent} selectedId={selectedId}
        setSelectedId={setSelectedId} ucodeById={ucodeById} showTypes={false} />
    </div>
  );
}

// 약재 유니버스 — 정적 force 레이아웃. 렌즈: 귀경(장부) ↔ 성분 계열
const ORGAN_PAIRS = [["간", "담"], ["심", "소장"], ["비", "위"], ["폐", "대장"], ["신", "방광"], ["심포", "삼초"]];
const CLASS_SHORT = {
  "이리도이드 배당체": "이리도이드", "모노테르펜 배당체": "모노테르펜",
  "시안 배당체": "시안배당체",
};
// 성분 계열별 일반 특징·효능 (현대 약리)
const CLASS_INFO = {
  "사포닌": "비누처럼 거품을 내는 배당체. 면역 조절·강장·항염 작용 연구가 많아요.",
  "알칼로이드": "질소를 품은 강력한 생리활성 물질. 진통·각성·항균 등 작용이 뚜렷해요.",
  "플라보노이드": "식물 색소 계열의 항산화 물질. 항염·혈관 보호 작용으로 알려져 있어요.",
  "정유": "휘발성 방향(芳香) 성분. 소화·순환을 돕고 향이 강한 게 특징이에요.",
  "페놀산": "항산화 페놀 화합물. 혈류 개선·항염 관련 연구가 있어요.",
  "쿠마린": "향이 나는 화합물로 혈류·항염 작용과 관련돼요.",
  "안트라퀴논": "장운동을 촉진하는 색소 성분. 변비에 쓰이나 과량은 설사를 유발해요.",
  "이리도이드 배당체": "쓴맛이 나는 배당체. 항염·간 보호 작용 연구가 있어요.",
  "리그난": "항산화·간 보호로 알려진 폴리페놀 계열이에요.",
  "모노테르펜 배당체": "진경(경련 완화)·진통과 관련된 배당체예요.",
  "다당": "면역을 조절하는 큰 당류(다당체)예요.",
  "시안 배당체": "기침을 가라앉히는 작용이 있으나, 과량은 독성을 띨 수 있어요.",
  "크로몬": "항알레르기·항염 작용과 관련된 화합물이에요.",
};

function OrganMap({ organs, herbs, categories, catById, organById, selectedId, setSelectedId }) {
  const W = 1140, H = 800, CX = W / 2, CY = H / 2;
  const [lens, setLens] = useState("organ");
  const [hoverId, setHoverId] = useState(null);
  const [connectedOnly, setConnectedOnly] = useState(true);   // 연결만 보기(기본) ↔ 전체 보기
  const [, setFrame] = useState(0);
  const dispRef = useRef({});   // id → {x,y} 화면상 위치(애니메이션)
  const rafRef = useRef(0);

  // ── 두 렌즈 레이아웃 모두 미리 계산 ──
  const layouts = useMemo(() => {
    if (!herbs.length) return { organ: null, compound: null };

    const build = (lensType) => {
      let anchorNodes = [], herbNodes = [];
      const ls = [];
      if (lensType === "organ") {
        if (!organs.length) return null;
        const maxC = Math.max(1, ...organs.map((o) => o.herbCount));
        anchorNodes = organs.map((o, i) => ({
          ...o, id: o.id, type: "anchor", kind: "organ", isJang: o.type === "장",
          label: o.id, count: o.herbCount, r: 26 + (o.herbCount / maxC) * 18,
          x: CX + Math.cos((i / organs.length) * 6.283) * 140, y: CY + Math.sin((i / organs.length) * 6.283) * 140,
        }));
        herbNodes = herbs.filter((h) => (h.meridians || []).length > 0)
          .map((h, i) => ({ ...h, id: h.id, type: "herb", r: 12 + h.meridians.length * 0.8,
            x: CX + Math.cos(i * 2.4) * 300, y: CY + Math.sin(i * 2.4) * 300 }));
        herbNodes.forEach((h) => h.meridians.forEach((m) => { if (organById[m]) ls.push({ source: h.id, target: m }); }));
        ORGAN_PAIRS.forEach(([a, b]) => ls.push({ source: a, target: b, pair: true }));
      } else {
        const cc = {};
        herbs.forEach((h) => (h.compounds || []).forEach((c) => { cc[c.cls] = (cc[c.cls] || 0) + 1; }));
        const classes = Object.keys(cc);
        if (!classes.length) return null;
        const maxC = Math.max(1, ...Object.values(cc));
        anchorNodes = classes.map((cls, i) => ({
          id: `cls:${cls}`, type: "anchor", kind: "compound", isJang: true,
          label: CLASS_SHORT[cls] || cls, fullLabel: cls, count: cc[cls],
          r: 22 + (cc[cls] / maxC) * 18,
          x: CX + Math.cos((i / classes.length) * 6.283) * 150, y: CY + Math.sin((i / classes.length) * 6.283) * 150,
        }));
        herbNodes = herbs.filter((h) => (h.compounds || []).length > 0)
          .map((h, i) => { const u = [...new Set(h.compounds.map((c) => c.cls))];
            return { ...h, id: h.id, type: "herb", r: 12 + u.length * 1.4,
              x: CX + Math.cos(i * 2.4) * 290, y: CY + Math.sin(i * 2.4) * 290 }; });
        herbNodes.forEach((h) => [...new Set(h.compounds.map((c) => c.cls))].forEach((cls) => ls.push({ source: h.id, target: `cls:${cls}` })));
      }
      const ns = [...anchorNodes, ...herbNodes];
      const sim = forceSimulation(ns)
        .force("link", forceLink(ls).id((d) => d.id).distance((d) => (d.pair ? 150 : 92)).strength((d) => (d.pair ? 0.05 : 0.13)))
        .force("charge", forceManyBody().strength((d) => (d.type === "anchor" ? -650 : -190)))
        .force("collide", forceCollide().radius((d) => d.r + (d.type === "anchor" ? 18 : 8)).strength(1).iterations(4))
        .force("center", forceCenter(CX, CY))
        .force("x", forceX(CX).strength(0.11)).force("y", forceY(CY).strength(0.11))
        .stop();
      for (let i = 0; i < 700; i++) sim.tick();
      // 콘텐츠 bbox → viewBox (항상 꽉 차게)
      const pad = 26;
      const minX = Math.min(...ns.map((n) => n.x - n.r)) - pad;
      const minY = Math.min(...ns.map((n) => n.y - n.r)) - pad;
      const maxX = Math.max(...ns.map((n) => n.x + n.r)) + pad;
      const maxY = Math.max(...ns.map((n) => n.y + n.r)) + pad;
      return { nodes: ns, links: ls, byId: Object.fromEntries(ns.map((n) => [n.id, n])),
        vb: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` };
    };
    return { organ: build("organ"), compound: build("compound") };
  }, [organs, herbs, organById]);

  const layout = layouts[lens] || { nodes: [], links: [], byId: {}, vb: `0 0 ${W} ${H}` };
  const { nodes, links, byId } = layout;

  // ── 렌즈 전환 시 위치 트윈(중앙→제자리) 애니메이션 ──
  useEffect(() => {
    if (!nodes.length) return undefined;
    const from = { ...dispRef.current };
    const start = performance.now();
    const dur = 620;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const e = ease(t);
      const dp = {};
      nodes.forEach((n) => {
        const f = from[n.id] || { x: CX, y: CY };
        dp[n.id] = { x: f.x + (n.x - f.x) * e, y: f.y + (n.y - f.y) * e };
      });
      dispRef.current = dp;
      setFrame((v) => v + 1);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [lens, layouts]); // eslint-disable-line react-hooks/exhaustive-deps

  const P = dispRef.current;
  const px = (n) => (P[n.id] ? P[n.id].x : n.x);
  const py = (n) => (P[n.id] ? P[n.id].y : n.y);

  // 1-홉 이웃 집합 계산 헬퍼 (id + 직접 연결된 노드)
  const oneHop = (id) => {
    const set = new Set([id]);
    links.forEach((l) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (s === id) set.add(t);
      if (t === id) set.add(s);
    });
    return set;
  };

  const selId = byId[selectedId] ? selectedId : null;
  const focusId = hoverId || selId;
  // 하이라이트(hover/선택)용 이웃 — 진하게 표시할 노드
  const neighbors = useMemo(() => (focusId ? oneHop(focusId) : null), [focusId, links]); // eslint-disable-line react-hooks/exhaustive-deps
  // "연결만 보기" scope — 선택된 노드와 1-홉만 화면에 남김(선택이 있을 때만 작동)
  const scopeSet = useMemo(
    () => (connectedOnly && selId ? oneHop(selId) : null),
    [connectedOnly, selId, links] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const focusAnchor = focusId && byId[focusId]?.type === "anchor" ? byId[focusId] : null;

  // 노드/엣지 불투명도 모델 (scope 밖 → 거의 숨김, hover 비이웃 → 흐리게)
  const OUT = 0.08, DIM = 0.15;
  const nodeOpacity = (id) => {
    if (scopeSet && !scopeSet.has(id)) return OUT;
    if (neighbors) return neighbors.has(id) ? 1 : DIM;
    return 1;
  };
  const inScope = (id) => !scopeSet || scopeSet.has(id);
  const linkOpacity = (s, t) => {
    if (scopeSet && !(scopeSet.has(s) && scopeSet.has(t))) return 0.04;
    const lit = !neighbors || (neighbors.has(s) && neighbors.has(t));
    if (!lit) return 0.05;
    return focusId ? 0.85 : 0.28;
  };

  const selMissingHerb = selectedId?.startsWith("herb_") && !byId[selectedId]
    ? herbs.find((h) => h.id === selectedId) : null;

  return (
    <div className="organ-map">
      <div className="organ-legend">
        <div className="legend-row">
          <div className={`lens-toggle ${lens}`}>
            <span className="lens-knob" aria-hidden="true" />
            <button type="button" className={lens === "organ" ? "on" : ""} onClick={() => setLens("organ")}>작용 장부</button>
            <button type="button" className={lens === "compound" ? "on" : ""} onClick={() => setLens("compound")}>성분 계열</button>
          </div>
          <button
            type="button"
            className={`view-toggle ${connectedOnly ? "filtered" : ""}`}
            onClick={() => setConnectedOnly((v) => !v)}
            title={connectedOnly ? "선택한 장부와 직접 연결된 노드만 표시 중 — 클릭하면 전체 그래프" : "전체 그래프 표시 중 — 클릭하면 연결만 보기"}
          >
            {connectedOnly ? "연결만 보기" : "전체 보기"}
          </button>
          <span className="lg-divider" />
          {categories.map((c) => (
            <span key={c.id} className="lg-item"><i style={{ background: c.color }} />{c.name}</span>
          ))}
        </div>
        <div className="legend-encoding" aria-label="시각 인코딩 설명">
          <span className="enc">
            <svg width="26" height="14" viewBox="0 0 26 14" aria-hidden="true">
              <circle cx="6" cy="7" r="3.5" fill="#9aa7b1" />
              <circle cx="18" cy="7" r="6" fill="#9aa7b1" />
            </svg>
            원 크기 = {lens === "organ"
              ? "연결된 약재 수(장부) · 작용 장부 수(약재)"
              : "연결된 재료 수(성분) · 성분 계열 수(약재)"}
          </span>
          <span className="enc">
            <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
              <line x1="1" y1="4" x2="21" y2="4" stroke="#8c9eaa" strokeWidth="1.6" />
            </svg>
            실선 = {lens === "organ" ? "약재 귀경(歸經) 연결" : "재료–성분 연결"}
          </span>
          {lens === "organ" && (
            <span className="enc">
              <svg width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">
                <line x1="1" y1="4" x2="21" y2="4" stroke="#96a5b2" strokeWidth="1.6" strokeDasharray="3,4" />
              </svg>
              점선 = 장부 음양 짝(표리·表裏)
            </span>
          )}
        </div>
        <p className="organ-hint">
          {selMissingHerb
            ? <><strong>{selMissingHerb.nameKo}</strong>은(는) {lens === "organ" ? "귀경(歸經)" : "성분"} 기록이 없어 지도에 표시되지 않아요 — 오른쪽에서 정보를 확인하세요.</>
            : focusAnchor
              ? (focusAnchor.kind === "organ"
                  ? <><strong>{focusAnchor.id}({focusAnchor.hanja})</strong> · {focusAnchor.plain} — 연결된 재료 {focusAnchor.count}종</>
                  : <><strong>{focusAnchor.fullLabel}</strong> 계열 — 이 성분군을 가진 재료 {focusAnchor.count}종</>)
              : (lens === "organ"
                  ? <>재료가 작용하는 <b>장부(귀경)</b> 지도예요. 비·폐·간에 집중됩니다.</>
                  : <>재료의 <b>대표 성분 계열</b> 지도예요. 같은 계열을 공유하는 재료끼리 묶입니다.</>)}
        </p>
      </div>

      <svg viewBox={layout.vb} role="img" aria-label="약재 유니버스 그래프" className="universe-svg">
        {links.map((l, i) => {
          const s = typeof l.source === "object" ? l.source : byId[l.source];
          const t = typeof l.target === "object" ? l.target : byId[l.target];
          if (!s || !t) return null;
          const lit = !neighbors || (neighbors.has(s.id) && neighbors.has(t.id));
          return (
            <line key={i} className="uni-link" x1={px(s)} y1={py(s)} x2={px(t)} y2={py(t)}
              stroke={l.pair ? "rgba(150,165,178,0.45)" : "rgba(140,158,170,0.6)"}
              strokeWidth={focusId && lit ? 2 : 1}
              strokeDasharray={l.pair ? "3,4" : undefined}
              style={{ opacity: linkOpacity(s.id, t.id) }} />
          );
        })}

        {nodes.filter((n) => n.type === "herb").map((n) => {
          const color = catById[n.primaryCategory]?.color || "#9aa7b1";
          const sel = selectedId === n.id;
          return (
            <g key={n.id} className="uni-node" transform={`translate(${px(n)},${py(n)})`}
               onPointerEnter={() => setHoverId(n.id)} onPointerLeave={() => setHoverId((h) => (h === n.id ? null : h))}
               onClick={(e) => { e.stopPropagation(); setHoverId(n.id); setSelectedId(selectedId === n.id ? null : n.id); }}
               style={{ cursor: "pointer", opacity: nodeOpacity(n.id), pointerEvents: inScope(n.id) ? "auto" : "none" }}>
              <circle r={n.r} fill={color} stroke="#fff" strokeWidth={sel ? 2.5 : 1.5}
                style={sel || hoverId === n.id ? { filter: `drop-shadow(0 0 7px ${color})` } : {}} />
              <text textAnchor="middle" dy="3.5" fontSize={n.nameKo.length > 2 ? 10 : 11.5}
                fontWeight="700" fill="#fff" style={{ pointerEvents: "none" }}>{n.nameKo}</text>
            </g>
          );
        })}

        {nodes.filter((n) => n.type === "anchor").map((n) => {
          const isFocus = focusId === n.id;
          return (
            <g key={n.id} className="uni-node" transform={`translate(${px(n)},${py(n)})`}
               onPointerEnter={() => setHoverId(n.id)} onPointerLeave={() => setHoverId((h) => (h === n.id ? null : h))}
               onClick={(e) => { e.stopPropagation(); setHoverId(n.id); setSelectedId(selectedId === n.id ? null : n.id); }}
               style={{ cursor: "pointer", opacity: nodeOpacity(n.id), pointerEvents: inScope(n.id) ? "auto" : "none" }}>
              <circle r={n.r}
                fill={n.kind === "compound" ? "rgba(47,93,69,0.95)" : (n.isJang ? "rgba(54,70,82,0.96)" : "rgba(248,251,252,0.97)")}
                stroke={isFocus ? "#1d2832" : (n.kind === "compound" ? "#2f5d45" : (n.isJang ? "#364652" : "rgba(120,140,155,0.8)"))}
                strokeWidth={isFocus ? 3.5 : 1.8}
                style={isFocus ? { filter: "drop-shadow(0 0 10px rgba(60,80,95,0.55))" } : {}} />
              <text textAnchor="middle" dy="5" fontSize={n.label.length > 4 ? 10 : 13.5}
                fontWeight="800" fill={n.kind === "compound" || n.isJang ? "#fff" : "#2a3640"}
                style={{ pointerEvents: "none" }}>{n.label}</text>
            </g>
          );
        })}

        {(() => {
          const n = hoverId ? byId[hoverId] : null;
          if (!n) return null;
          const [vbX, , vbW] = layout.vb.split(" ").map(Number);
          const W_TIP = 190;
          const flip = px(n) + n.r + 12 + W_TIP > vbX + vbW;        // 오른쪽 경계 넘으면 좌측 배치
          const tx = flip ? px(n) - n.r - 12 - W_TIP : px(n) + n.r + 12;
          const ty = py(n) - 18;
          let body;
          if (n.type === "herb") {
            const cat = catById[n.primaryCategory];
            const organs = (n.meridians || []).filter((m) => organById[m]);
            body = (
              <>
                <div className="tip-name">{n.nameKo}{n.nameHanja ? <small>{n.nameHanja}</small> : null}</div>
                {cat ? <div className="tip-cat"><i style={{ background: cat.color }} />{cat.name}</div> : null}
                {organs.length ? <div className="tip-organs">연결 장부 <b>{organs.join(" · ")}</b></div> : null}
              </>
            );
          } else if (n.kind === "organ") {
            body = (
              <>
                <div className="tip-name">{n.id}{n.hanja ? <small>{n.hanja}</small> : null}</div>
                {n.plain ? <div className="tip-organs">{n.plain}</div> : null}
                <div className="tip-organs">연결된 재료 <b>{n.count}종</b></div>
              </>
            );
          } else {
            body = (
              <>
                <div className="tip-name">{n.fullLabel || n.label}</div>
                <div className="tip-organs">이 성분군 재료 <b>{n.count}종</b></div>
              </>
            );
          }
          return (
            <foreignObject x={tx} y={ty} width={W_TIP} height={150}
              style={{ pointerEvents: "none", overflow: "visible" }}>
              <div className="uni-tip" xmlns="http://www.w3.org/1999/xhtml">{body}</div>
            </foreignObject>
          );
        })()}
      </svg>
    </div>
  );
}

function DetailPanel({ selectedId, setSelectedId, herbById, symById, ucodeById, catById, organById, herbImages, prescriptions, activeCategoryId }) {
  const activeCat = catById[activeCategoryId];
  const accent = activeCat?.color || "#6f97aa";

  const rxById = useMemo(() => Object.fromEntries(prescriptions.map((r) => [r.id, r])), [prescriptions]);

  let kind = null;
  if (selectedId?.startsWith("herb_")) kind = "herb";
  else if (selectedId?.startsWith("cls:")) kind = "compound";
  else if (selectedId?.startsWith("U")) kind = "ucode";
  else if (selectedId?.startsWith("sym_")) kind = "symptom";
  else if (selectedId?.startsWith("P")) kind = "prescription";
  else if (organById?.[selectedId]) kind = "organ";

  const herb = kind === "herb" ? herbById[selectedId] : null;
  const ucode = kind === "ucode" ? ucodeById[selectedId] : null;
  const symptom = kind === "symptom" ? symById[selectedId] : null;
  const organ = kind === "organ" ? organById[selectedId] : null;
  const rx = kind === "prescription" ? rxById[selectedId] : null;

  if (rx) {
    const rxHerbs = rx.herbs.map((hid) => herbById[hid]).filter(Boolean);
    const rxCats = (rx.categories || []).map((cid) => catById[cid]).filter(Boolean);
    const match = rx.name.match(/^(.+?)\(([^)]+)\)/);
    const nameKo = match ? match[1] : rx.name;
    const nameHanja = match ? match[2] : "";
    return (
      <aside className="library-detail glass-panel">
        <div className="detail-heading">
          <span style={{ color: accent }}>전통 처방</span>
          <h2>{nameKo} {nameHanja && <small>{nameHanja}</small>}</h2>
          {rxCats.length > 0 && (
            <div className="pill-list" style={{ marginTop: 6 }}>
              {rxCats.map((c) => (
                <span key={c.id} className="meridian-pill" style={{ background: `${c.color}18`, color: c.color }}>{c.name}</span>
              ))}
            </div>
          )}
        </div>

        {rx.diseasesRaw?.length > 0 && (
          <div className="detail-section">
            <h3>적용 병증</h3>
            <div className="pill-list">
              {rx.diseasesRaw.map((d) => <span key={d} className="compound-pill">{d}</span>)}
            </div>
          </div>
        )}

        <div className="detail-section">
          <h3>구성 약재 ({rxHerbs.length})</h3>
          <div className="herb-chip-list">
            {rxHerbs.map((h) => (
              <button key={h.id} type="button" onClick={() => setSelectedId(h.id)}>
                {h.nameKo} <small>{h.nameHanja}</small>
              </button>
            ))}
            {rx.herbs.filter((hid) => !herbById[hid]).map((hid) => (
              <span key={hid} className="compound-pill" style={{ opacity: 0.5 }}>{hid.replace("herb_", "")}</span>
            ))}
          </div>
        </div>

        {rx.method && (
          <div className="detail-section">
            <h3>복용법</h3>
            <p style={{ fontSize: 13, lineHeight: 1.75, color: "#4a5a66" }}>{rx.method}</p>
          </div>
        )}

        {rx.sources?.length > 0 && (
          <div className="detail-section">
            <h3>출처</h3>
            <p style={{ fontSize: 12, color: "#8a98a3", lineHeight: 1.6 }}>{rx.sources.join(" · ")}</p>
          </div>
        )}

        <p className="disclaimer">전통 문헌의 기록을 정리한 정보예요. 의학적 처방이 아닙니다.</p>
      </aside>
    );
  }

  if (kind === "compound") {
    const cls = selectedId.slice(4);
    const members = Object.values(herbById).filter((h) => (h.compounds || []).some((c) => c.cls === cls));
    // 이 계열의 대표 성분 예시 (재료별 성분명)
    const examples = [];
    const seen = new Set();
    members.forEach((h) => (h.compounds || []).forEach((c) => {
      if (c.cls === cls && !seen.has(c.name)) { seen.add(c.name); examples.push(c.name); }
    }));
    return (
      <aside className="library-detail glass-panel">
        <div className="detail-heading">
          <span style={{ color: "#2f5d45" }}>성분 계열</span>
          <h2>{cls}</h2>
          <p>{CLASS_INFO[cls] || "현대 약리에서 연구되는 성분 계열이에요."}</p>
        </div>
        {examples.length > 0 && (
          <div className="detail-section">
            <h3>이 계열의 대표 성분</h3>
            <div className="pill-list">
              {examples.slice(0, 8).map((n) => <span key={n} className="compound-pill">{n}</span>)}
            </div>
          </div>
        )}
        <div className="detail-section">
          <h3>이 성분 계열을 가진 재료 ({members.length})</h3>
          <div className="herb-chip-list">
            {members.map((h) => (
              <button key={h.id} type="button" onClick={() => setSelectedId(h.id)}>
                {h.nameKo} <small>{h.nameHanja}</small>
              </button>
            ))}
          </div>
        </div>
        <p className="disclaimer">대표 성분은 현대 분석 기반의 일부 정보예요. 의학적 진단·처방이 아닙니다.</p>
      </aside>
    );
  }

  if (organ) {
    const organHerbs = (organ.herbs || []).map((id) => herbById[id]).filter(Boolean);
    return (
      <aside className="library-detail glass-panel">
        <div className="detail-heading">
          <span style={{ color: accent }}>장부 (귀경)</span>
          <h2>{organ.id} <small>{organ.hanja}</small></h2>
          <p>{organ.plain}</p>
          <p style={{ marginTop: 6, fontSize: 12, color: "#8a98a3" }}>
            {organ.type === "장" ? "오장(五臟)" : "육부(六腑)"} · 표리 짝 {organ.pair}
          </p>
        </div>
        <div className="detail-section">
          <h3>이 장부에 작용하는 재료 ({organHerbs.length})</h3>
          <div className="herb-chip-list">
            {organHerbs.map((h) => (
              <button key={h.id} type="button" onClick={() => setSelectedId(h.id)}>
                {h.nameKo} <small>{h.nameHanja}</small>
              </button>
            ))}
          </div>
        </div>
        <p className="disclaimer">전통 문헌의 기록을 정리한 정보예요. 의학적 진단·처방이 아닙니다.</p>
      </aside>
    );
  }

  if (!selectedId || (!herb && !ucode && !symptom)) {
    return (
      <aside className="library-detail glass-panel">
        <div className="detail-heading">
          <span style={{ color: accent }}>{activeCat?.name || ""}</span>
          <h2>재료를 골라보세요</h2>
          <p>가운데에서 재료를 누르면, 그 재료가 어떤 증상에 쓰여 왔고 어떤 처방에 들어갔는지 여기에서 보여드려요.</p>
        </div>
        <p className="disclaimer">전통 문헌의 기록을 정리한 정보예요. 의학적 진단·처방·복용 권고가 아닙니다.</p>
      </aside>
    );
  }

  if (herb) {
    const linkedUcodes = (herb.ucodes || []).map((id) => ucodeById[id]).filter(Boolean);
    const linkedRx = prescriptions
      .filter((rx) => rx.herbs.includes(herb.id))
      .slice(0, 5);
    // 성분 계열이 닮은 재료 (같은 화학 계열 공유)
    const myClasses = new Set((herb.compounds || []).map((c) => c.cls));
    const seenNames = new Set([herb.nameKo]);
    const relatedByClass = [];
    if (myClasses.size) {
      for (const h2 of Object.values(herbById)) {
        if (h2.id === herb.id) continue;
        const shared = (h2.compounds || []).find((c) => myClasses.has(c.cls));
        if (shared && !seenNames.has(h2.nameKo)) {
          seenNames.add(h2.nameKo);
          relatedByClass.push({ id: h2.id, nameKo: h2.nameKo, cls: shared.cls });
        }
      }
    }
    return (
      <aside className="library-detail glass-panel">
        <div className="detail-heading">
          <span style={{ color: accent }}>한방 재료{herb.isHarmonizer ? " · 기본 약재" : ""}</span>
          <h2>{herb.nameKo} <small>{herb.nameHanja}</small></h2>
          <p>{herb.categories.map((c) => catById[c]?.name).filter(Boolean).join(" · ")} 영역</p>
        </div>

        {(() => {
          const img = herbImages?.[herb.id];
          const heroText = herb.isHarmonizer
            ? `여러 처방에 두루 쓰이는 조화·보조 재료예요. 특정 증상보다 처방 전체의 균형을 잡아주는 역할을 합니다. (수록 처방 ${herb.rxCount}건)`
            : `${herb.categories.map((c) => catById[c]?.name).filter(Boolean).join(" · ")} 영역에서 전통적으로 쓰여온 재료예요.`;
          if (img) {
            return (
              <div className="herb-hero">
                <figure className="herb-photo">
                  <img src={img.img} alt={herb.nameKo} loading="lazy" />
                  <figcaption>
                    {img.title}
                    {img.page && <> · <a href={img.page} target="_blank" rel="noreferrer">위키백과</a></>}
                  </figcaption>
                </figure>
                <p className="herb-hero-text">{heroText}</p>
              </div>
            );
          }
          return herb.isHarmonizer ? <p className="harm-note">{heroText}</p> : null;
        })()}

        {herb.compounds?.length > 0 && (
          <div className="detail-section">
            <h3>대표 성분 (현대 분석)</h3>
            <div className="pill-list">
              {herb.compounds.map((c) => (
                <span key={c.name} className="compound-pill">{c.name}<i>{c.cls}</i></span>
              ))}
            </div>
            {relatedByClass.length > 0 && (
              <div className="related-compound">
                <p className="related-label">성분 계열이 닮은 재료</p>
                <div className="herb-chip-list">
                  {relatedByClass.slice(0, 8).map((r) => (
                    <button key={r.id} type="button" onClick={() => setSelectedId(r.id)}>
                      {r.nameKo} <small>{r.cls}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {herb.meridians?.length > 0 && (
          <div className="detail-section">
            <h3>작용 장부 (귀경)</h3>
            <div className="pill-list">
              {herb.meridians.map((m) => (
                <span key={m} className="meridian-pill">{m}</span>
              ))}
            </div>
          </div>
        )}

        {linkedUcodes.length > 0 && (
          <div className="detail-section">
            <h3>전통적으로 이런 증상에 써요</h3>
            <div className="pill-list">
              {linkedUcodes.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="pill-button"
                  onClick={() => setSelectedId(u.id)}
                  style={{ background: `${accent}1a`, color: "#26313b" }}
                  title={u.plain}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {herb.effectsPlain?.length > 0 && (
          <div className="detail-section">
            <h3>옛 문헌 속 효능</h3>
            <p className="plain-effects">{herb.effectsPlain.slice(0, 12).join(" · ")}</p>
          </div>
        )}

        {linkedRx.length > 0 && (
          <div className="detail-section">
            <h3>이 재료가 들어간 처방</h3>
            <div className="rx-list">
              {linkedRx.map((rx) => (
                <article key={rx.id}>
                  <strong>{rx.name}</strong>
                  <p>{rx.method}</p>
                </article>
              ))}
            </div>
          </div>
        )}

        <p className="disclaimer">전통 문헌의 기록을 정리한 정보예요. 진단·처방이 아닙니다.</p>
      </aside>
    );
  }

  if (ucode) {
    const cat = catById[ucode.category];
    const linkedHerbs = (ucode.herbs || []).slice(0, 20);
    return (
      <aside className="library-detail glass-panel">
        <div className="detail-heading">
          <span style={{ color: cat?.color || accent }}>한방에서 보는 유형</span>
          <h2>{ucode.name} <small>{ucode.hanja}</small></h2>
          <p>{ucode.plain}</p>
          <p style={{ marginTop: 6, fontSize: 12, color: "#8a98a3" }}>{cat?.name} 영역</p>
        </div>

        <div className="detail-section">
          <h3>이 유형에 전통적으로 쓰인 재료 ({ucode.herbCount})</h3>
          <div className="herb-chip-list">
            {linkedHerbs.map((hid) => {
              const h = herbById[hid];
              if (!h) return null;
              return (
                <button key={hid} type="button" onClick={() => setSelectedId(hid)}>
                  {h.nameKo} <small>{h.nameHanja}</small>
                </button>
              );
            })}
          </div>
        </div>

        <p className="disclaimer">전통 문헌의 기록을 정리한 정보예요. 진단·처방이 아닙니다.</p>
      </aside>
    );
  }

  // symptom
  return (
    <aside className="library-detail glass-panel">
      <div className="detail-heading">
        <span style={{ color: accent }}>증상</span>
        <h2>{symptom.plain}</h2>
      </div>
      <p className="disclaimer">증상 상세는 추후 보강 예정.</p>
    </aside>
  );
}

// ─────────────────────────────────────────────
// JOURNAL PAGE — 한의원 리뷰 지도
// ─────────────────────────────────────────────

const OUTCOME_COLORS = {
  호전: "#5c8c72", 진행중: "#6f97aa", 불명: "#a8b5be",
  변화없음: "#c0a898", 재발: "#b97070", 악화: "#b97070",
};
const OUTCOME_ORDER = ["호전", "진행중", "불명", "변화없음", "재발", "악화"];

function ClinicsPage({ clinics }) {
  const [selected, setSelected] = useState(null);
  const [district, setDistrict] = useState(null);
  const [category, setCategory] = useState(null);

  const districts = useMemo(
    () => [...new Set(clinics.map((c) => c.district).filter(Boolean))].sort(),
    [clinics]
  );

  const allCategories = useMemo(() => {
    const counter = {};
    clinics.forEach((c) => Object.entries(c.categories || {}).forEach(([k, v]) => { counter[k] = (counter[k] || 0) + v; }));
    return Object.entries(counter).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [clinics]);

  const filtered = useMemo(() => {
    let result = clinics;
    if (district) result = result.filter((c) => c.district === district);
    if (category) result = result.filter((c) => (c.categories || {})[category] > 0);
    return result;
  }, [clinics, district, category]);

  const handleSetDistrict = (d) => { setDistrict(d); setSelected(null); };
  const handleSetCategory = (cat) => { setCategory(cat); setSelected(null); };

  if (!clinics.length) {
    return <section className="clinics-page"><div className="clinics-loading"><p>데이터를 불러오는 중…</p></div></section>;
  }

  return (
    <section className="clinics-page">
      <ClinicsLeft
        districts={districts} district={district} setDistrict={handleSetDistrict}
        categories={allCategories} category={category} setCategory={handleSetCategory}
        total={clinics.length}
      />
      <div className="clinics-map-wrap glass-panel">
        <ClinicsMap clinics={filtered} selectedId={selected?.id} onSelect={setSelected} />
      </div>
      <ClinicsDetail clinic={selected} />
    </section>
  );
}

function ClinicsLeft({ districts, district, setDistrict, categories, category, setCategory, total }) {
  return (
    <aside className="clinics-left glass-panel">
      <p className="eyebrow" style={{ margin: "0 0 10px" }}>CLINICS</p>
      <h2 className="clinics-title">서울 한의원<br />리뷰 지도</h2>
      <p className="clinics-desc">{total}개 한의원</p>

      <p className="clinics-section-label">진료과목</p>
      <div className="district-chips">
        <button type="button" className={`district-chip ${!category ? "active" : ""}`} onClick={() => setCategory(null)}>전체</button>
        {categories.map((cat) => (
          <button key={cat} type="button" className={`district-chip ${category === cat ? "active" : ""}`} onClick={() => setCategory(category === cat ? null : cat)}>{cat}</button>
        ))}
      </div>

      <p className="clinics-section-label" style={{ marginTop: 16 }}>지역 (구)</p>
      <div className="district-chips">
        <button type="button" className={`district-chip ${!district ? "active" : ""}`} onClick={() => setDistrict(null)}>전체</button>
        {districts.map((d) => (
          <button key={d} type="button" className={`district-chip ${district === d ? "active" : ""}`} onClick={() => setDistrict(district === d ? null : d)}>{d}</button>
        ))}
      </div>

      <p className="clinics-section-label" style={{ marginTop: 16 }}>마커 범례</p>
      <div className="clinics-legend">
        <span><i style={{ background: "#5c8c72" }} />긍정 리뷰 많음</span>
        <span><i style={{ background: "#6f97aa" }} />혼합</span>
        <span><i style={{ background: "#a07c70" }} />부정 포함</span>
        <span className="legend-size-hint">마커 크기 = 리뷰 수</span>
      </div>
    </aside>
  );
}

function ClinicsMap({ clinics, selectedId, onSelect }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [37.5665, 126.978], zoom: 11 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap contributors © CARTO",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    clinics.forEach((clinic) => {
      const pos = (clinic.sentiment["긍정"] || 0) / Math.max(1, clinic.review_count);
      const color = pos > 0.82 ? "#5c8c72" : pos > 0.5 ? "#6f97aa" : "#a07c70";
      const r = Math.max(6, Math.min(20, 5 + clinic.review_count * 2));
      const isSel = clinic.id === selectedId;

      const m = L.circleMarker([clinic.lat, clinic.lng], {
        radius: isSel ? r + 3 : r,
        fillColor: color,
        fillOpacity: isSel ? 1 : 0.78,
        color: isSel ? "#1d2832" : "rgba(255,255,255,0.9)",
        weight: isSel ? 2.5 : 1.5,
      })
        .addTo(map)
        .bindTooltip(clinic.name, { direction: "top", offset: [0, -(r + 6)], className: "c-tooltip" })
        .on("click", () => onSelect(clinic));

      markersRef.current.set(clinic.id, m);
    });
  }, [clinics, selectedId]);

  return <div ref={containerRef} className="clinics-map" />;
}

function MiniBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mini-bar-row">
      <span className="mini-bar-label">{label}</span>
      <div className="mini-bar-track"><div className="mini-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
      <span className="mini-bar-pct">{pct}%</span>
    </div>
  );
}

function ClinicsDetail({ clinic }) {
  if (!clinic) {
    return (
      <aside className="clinics-detail glass-panel">
        <div className="clinics-empty">
          <p>지도에서<br />한의원을 클릭해보세요</p>
          <small>리뷰 분석 결과를<br />여기서 확인할 수 있어요</small>
        </div>
      </aside>
    );
  }

  const totalOutcome = Object.values(clinic.outcome).reduce((a, b) => a + b, 0);
  const topParts = Object.entries(clinic.body_parts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topTreatments = Object.entries(clinic.treatments).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topComplaints = Object.entries(clinic.complaints || {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topCategories = Object.entries(clinic.categories || {}).sort((a, b) => b[1] - a[1]);
  const posRatio = Math.round(((clinic.sentiment["긍정"] || 0) / Math.max(1, clinic.review_count)) * 100);

  return (
    <aside className="clinics-detail glass-panel">
      <div className="detail-heading">
        <span style={{ color: "#6f97aa" }}>한의원</span>
        <h2>{clinic.name}</h2>
        <p>{clinic.district} · {(clinic.address || "").replace("서울특별시 ", "").split(" ").slice(0, 3).join(" ")}</p>
      </div>

      <div className="jd-meta">
        <span className="jd-count">리뷰 분석 {clinic.review_count}건</span>
        {clinic.avg_rating && <span className="jd-rating">★ {clinic.avg_rating}</span>}
        <span className="jd-pos-badge" style={{ background: posRatio >= 80 ? "rgba(92,140,114,0.14)" : "rgba(160,175,188,0.14)", color: posRatio >= 80 ? "#3a7a5c" : "#6b7885" }}>
          긍정 {posRatio}%
        </span>
      </div>

      {topCategories.length > 0 && (
        <div className="jd-category-row">
          {topCategories.map(([cat]) => (
            <span key={cat} className="jd-cat-badge">{cat}</span>
          ))}
        </div>
      )}

      <div className="detail-section">
        <h3>치료 결과</h3>
        {OUTCOME_ORDER.filter((k) => clinic.outcome[k]).map((k) => (
          <MiniBar key={k} label={k} count={clinic.outcome[k]} total={totalOutcome} color={OUTCOME_COLORS[k]} />
        ))}
      </div>

      {topParts.length > 0 && (
        <div className="detail-section">
          <h3>주요 증상 부위</h3>
          <div className="jd-pills">
            {topParts.map(([part, cnt]) => (
              <span key={part} className="jd-pill">{part} <em>{cnt}</em></span>
            ))}
          </div>
        </div>
      )}

      {topTreatments.length > 0 && (
        <div className="detail-section">
          <h3>주요 치료법</h3>
          <div className="jd-pills">
            {topTreatments.map(([tx, cnt]) => (
              <span key={tx} className="jd-pill tx">{tx} <em>{cnt}</em></span>
            ))}
          </div>
        </div>
      )}

      {topComplaints.length > 0 && (
        <div className="detail-section">
          <h3>주요 호소 증상</h3>
          <div className="jd-pills">
            {topComplaints.map(([c, cnt]) => (
              <span key={c} className="jd-pill complaint">{c} <em>{cnt}</em></span>
            ))}
          </div>
        </div>
      )}

      <div className="detail-section">
        <h3>진료 만족도</h3>
        <MiniBar label="긍정" count={clinic.sentiment["긍정"] || 0} total={clinic.review_count} color="#5c8c72" />
        <MiniBar label="언급없음" count={clinic.sentiment["언급없음"] || 0} total={clinic.review_count} color="#a8b5be" />
        {(clinic.sentiment["부정"] || 0) > 0 && (
          <MiniBar label="부정" count={clinic.sentiment["부정"]} total={clinic.review_count} color="#b97070" />
        )}
      </div>

      <p className="disclaimer">리뷰 자동 분석 결과예요. 의학적 조언이 아닙니다.</p>
    </aside>
  );
}

// ─────────────────────────────────────────────
// 처방 사전
// ─────────────────────────────────────────────

function parsePrescriptionName(name) {
  const m = name.match(/^(.+?)\(([^)]+)\)/);
  return m ? { ko: m[1], hanja: m[2] } : { ko: name, hanja: "" };
}

function PrescriptionView({ prescriptions, herbById, categories, catById, selectedId, setSelectedId }) {
  const hasCat = useMemo(
    () => categories.filter((c) => prescriptions.some((rx) => (rx.categories || []).includes(c.id))),
    [categories, prescriptions]
  );
  const [catFilter, setCatFilter] = useState(() => hasCat[0]?.id || null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim() && !catFilter) return [];
    let result = prescriptions;
    if (catFilter && !query.trim()) result = result.filter((rx) => (rx.categories || []).includes(catFilter));
    if (query.trim()) {
      const q = query.trim();
      result = result.filter((rx) =>
        rx.name.includes(q) ||
        (rx.diseasesRaw || []).some((d) => d.includes(q)) ||
        rx.herbs.some((hid) => herbById[hid]?.nameKo.includes(q))
      );
    }
    return [...result].sort((a, b) => b.herbs.length - a.herbs.length);
  }, [prescriptions, catFilter, query, herbById]);

  return (
    <div className="rx-view">
      <div className="rx-filters">
        <label className="library-search rx-search">
          <Search size={14} />
          <input value={query} onChange={(e) => { setQuery(e.target.value); if (e.target.value) setCatFilter(null); }} placeholder="처방명, 약재, 병증 검색" />
        </label>
        <div className="district-chips">
          {hasCat.map((c) => (
            <button key={c.id} type="button" className={`district-chip ${catFilter === c.id ? "active" : ""}`}
              style={catFilter === c.id ? {} : { borderColor: `${c.color}60`, color: c.color }}
              onClick={() => { setCatFilter(catFilter === c.id ? hasCat[0]?.id : c.id); setQuery(""); }}>
              {c.name}
            </button>
          ))}
        </div>
        <p className="rx-count">{filtered.length}가지 처방</p>
      </div>
      <div className="rx-grid">
        {filtered.map((rx) => {
          const { ko, hanja } = parsePrescriptionName(rx.name);
          const rxCats = (rx.categories || []).map((cid) => catById[cid]).filter(Boolean);
          const herbNames = rx.herbs.slice(0, 4).map((hid) => herbById[hid]?.nameKo).filter(Boolean);
          const isSelected = selectedId === rx.id;
          return (
            <button key={rx.id} type="button" className={`rx-card ${isSelected ? "selected" : ""}`}
              onClick={() => setSelectedId(isSelected ? null : rx.id)}>
              <div className="rx-card-head">
                <span className="rx-name">{ko}</span>
                {hanja && <span className="rx-hanja">{hanja}</span>}
              </div>
              {rxCats.length > 0 && (
                <div className="rx-cats">
                  {rxCats.map((c) => <span key={c.id} style={{ color: c.color, background: `${c.color}18` }}>{c.name}</span>)}
                </div>
              )}
              <p className="rx-herbs-preview">
                {herbNames.join(" · ")}{rx.herbs.length > 4 ? ` 외 ${rx.herbs.length - 4}` : ""}
              </p>
              {rx.diseasesRaw?.[0] && <p className="rx-disease">{rx.diseasesRaw[0]}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SASANG 사상체질 진단
// ─────────────────────────────────────────────

const SASANG_DATA = {
  태양인: {
    color: "#6b8fa8",
    ratio: "~1%",
    desc: "독립적이고 사회적 정의감이 강한 리더형. 가장 드문 체질(1% 미만)로 창의적이고 혁신적인 사고가 특징입니다.",
    strengths: ["독립심·리더십", "사회적 통찰력", "창의적 사고"],
    weaknesses: ["하체·허리 약함", "소화기 주의", "무리하면 탈진"],
    herbs: ["오매", "갈근", "행인", "오미자"],
    foods: ["새우", "붕어", "모과", "포도"],
    avoid: ["지방질 음식", "자극적 음식", "과음"],
  },
  태음인: {
    color: "#5c8c72",
    ratio: "~50%",
    desc: "꾸준하고 인내력이 강한 대기만성형. 가장 많은 체질(약 50%)로 묵묵히 노력하며 성과를 쌓아갑니다.",
    strengths: ["지구력·꾸준함", "안정감·신뢰감", "강한 체력"],
    weaknesses: ["호흡기·피부 약함", "땀이 많음", "비만·고혈압 주의"],
    herbs: ["황기", "갈근", "맥문동", "오미자", "녹용"],
    foods: ["율무", "콩", "도라지", "배", "마"],
    avoid: ["기름진 음식", "과식", "음주"],
  },
  소양인: {
    color: "#c17f40",
    ratio: "~30%",
    desc: "활발하고 추진력이 넘치는 행동형. 두 번째로 많은 체질(약 30%)로 열정적이고 사교성이 좋습니다.",
    strengths: ["추진력·행동력", "사교성·솔직함", "빠른 판단력"],
    weaknesses: ["신장·하체 약함", "급한 성격", "신장·방광 주의"],
    herbs: ["숙지황", "황금", "백복령", "백작약", "시호"],
    foods: ["돼지고기", "오이", "수박", "생굴", "보리"],
    avoid: ["맵고 뜨거운 음식", "과한 운동", "스트레스"],
  },
  소음인: {
    color: "#7b6fa8",
    ratio: "~20%",
    desc: "꼼꼼하고 내면이 풍부한 완벽주의형. 세 번째로 많은 체질(약 20%)로 신중하고 정확성을 중시합니다.",
    strengths: ["세밀함·꼼꼼함", "지적 호기심", "충성심·배려"],
    weaknesses: ["소화기·냉증 약함", "걱정이 많음", "위장·냉대하 주의"],
    herbs: ["인삼", "생강", "계피", "감초", "당귀"],
    foods: ["닭고기", "사과", "생강차", "꿀", "멥쌀"],
    avoid: ["찬 음식·냉수", "과로", "지나친 걱정"],
  },
};

const SASANG_COMPARE = [
  { label: "소화력", 태양인: 2, 태음인: 4, 소양인: 4, 소음인: 3 },
  { label: "체력",   태양인: 2, 태음인: 5, 소양인: 4, 소음인: 3 },
  { label: "호흡기", 태양인: 3, 태음인: 2, 소양인: 4, 소음인: 4 },
  { label: "수면질", 태양인: 3, 태음인: 4, 소양인: 3, 소음인: 3 },
  { label: "면역력", 태양인: 3, 태음인: 4, 소양인: 3, 소음인: 4 },
];

const SASANG_QUIZ = [
  {
    category: "체형",
    q: "체형에서 어느 부위가 가장 발달해 있나요?",
    options: [
      { label: "목·어깨가 발달, 허리·하체가 약한 편", scores: { 태양인:3, 태음인:0, 소양인:0, 소음인:0 } },
      { label: "허리·뒷목이 굵고 하체가 탄탄한 편", scores: { 태양인:0, 태음인:3, 소양인:0, 소음인:0 } },
      { label: "상체·가슴이 발달, 엉덩이·허리가 약한 편", scores: { 태양인:0, 태음인:0, 소양인:3, 소음인:0 } },
      { label: "엉덩이·하체가 발달, 상체가 약한 편", scores: { 태양인:0, 태음인:0, 소양인:0, 소음인:3 } },
    ],
  },
  {
    category: "소화",
    q: "평소 소화는 어떤 편인가요?",
    options: [
      { label: "구역감이 잘 생기고 음식 조절이 중요하다", scores: { 태양인:2, 태음인:0, 소양인:1, 소음인:0 } },
      { label: "식욕이 왕성하고 소화가 잘 된다 (과식 주의)", scores: { 태양인:0, 태음인:3, 소양인:0, 소음인:0 } },
      { label: "음식을 빨리 먹고 소화도 빠른 편이다", scores: { 태양인:0, 태음인:0, 소양인:3, 소음인:0 } },
      { label: "소화기가 약해 잘 체하거나 배탈이 잦다", scores: { 태양인:0, 태음인:0, 소양인:0, 소음인:3 } },
    ],
  },
  {
    category: "땀·체온",
    q: "땀과 체온 반응은 어떤가요?",
    options: [
      { label: "땀이 거의 없고 더위·추위 모두 예민하다", scores: { 태양인:3, 태음인:0, 소양인:0, 소음인:1 } },
      { label: "땀이 많고 더위를 유독 많이 탄다", scores: { 태양인:0, 태음인:3, 소양인:0, 소음인:0 } },
      { label: "더위를 타고 땀이 나지만 금방 개운해진다", scores: { 태양인:0, 태음인:0, 소양인:3, 소음인:0 } },
      { label: "추위를 많이 타고 몸이 늘 차가운 편이다", scores: { 태양인:0, 태음인:0, 소양인:0, 소음인:3 } },
    ],
  },
  {
    category: "성격",
    q: "성격·행동 방식에서 가장 가까운 것은?",
    options: [
      { label: "독립적·개혁적, 규칙보다 신념을 따른다", scores: { 태양인:3, 태음인:0, 소양인:0, 소음인:0 } },
      { label: "신중·꾸준, 한 번 결정하면 끝까지 밀어붙인다", scores: { 태양인:0, 태음인:3, 소양인:0, 소음인:0 } },
      { label: "외향적·추진력이 강하고 빠른 결정을 내린다", scores: { 태양인:0, 태음인:0, 소양인:3, 소음인:0 } },
      { label: "꼼꼼·계획적, 안정과 정확성을 중시한다", scores: { 태양인:0, 태음인:0, 소양인:0, 소음인:3 } },
    ],
  },
  {
    category: "감정",
    q: "감정 표현 방식은?",
    options: [
      { label: "감정보다 원칙·사회 정의를 중시한다", scores: { 태양인:3, 태음인:0, 소양인:0, 소음인:0 } },
      { label: "감정을 잘 드러내지 않고 묵묵히 일한다", scores: { 태양인:0, 태음인:3, 소양인:0, 소음인:0 } },
      { label: "감정이 풍부하고 솔직하며 정이 많다", scores: { 태양인:0, 태음인:0, 소양인:3, 소음인:0 } },
      { label: "감수성이 예민하고 걱정·불안이 많은 편이다", scores: { 태양인:0, 태음인:0, 소양인:0, 소음인:3 } },
    ],
  },
  {
    category: "에너지",
    q: "에너지 패턴이 어떤가요?",
    options: [
      { label: "에너지가 위로 집중되고 하체에 힘이 부족하다", scores: { 태양인:3, 태음인:0, 소양인:0, 소음인:0 } },
      { label: "오래 일할 수 있지만 땀을 많이 흘린다", scores: { 태양인:0, 태음인:3, 소양인:0, 소음인:0 } },
      { label: "활동할 때 에너지가 넘치고 행동이 빠르다", scores: { 태양인:0, 태음인:0, 소양인:3, 소음인:0 } },
      { label: "꼼꼼하게 일하지만 금방 지치고 쉬어야 충전된다", scores: { 태양인:0, 태음인:0, 소양인:0, 소음인:3 } },
    ],
  },
  {
    category: "온도",
    q: "선호하는 기후·온도는?",
    options: [
      { label: "서늘하고 맑은 날씨가 좋다", scores: { 태양인:2, 태음인:0, 소양인:1, 소음인:0 } },
      { label: "시원한 환경을 선호, 더운 여름이 힘들다", scores: { 태양인:0, 태음인:3, 소양인:0, 소음인:0 } },
      { label: "시원하고 상쾌한 환경이 좋다, 더위도 잘 버틴다", scores: { 태양인:0, 태음인:0, 소양인:3, 소음인:0 } },
      { label: "따뜻한 환경을 선호, 추위를 매우 많이 탄다", scores: { 태양인:0, 태음인:0, 소양인:0, 소음인:3 } },
    ],
  },
  {
    category: "음식",
    q: "선호하는 음식 스타일은?",
    options: [
      { label: "담백하고 묽은 음식, 특별히 가리지 않는다", scores: { 태양인:3, 태음인:0, 소양인:0, 소음인:0 } },
      { label: "육류·기름진 음식을 즐기고 식욕이 왕성하다", scores: { 태양인:0, 태음인:3, 소양인:0, 소음인:0 } },
      { label: "차갑고 시원한 음식, 채소·과일이 잘 맞는다", scores: { 태양인:0, 태음인:0, 소양인:3, 소음인:0 } },
      { label: "따뜻하고 구수한 음식, 닭고기·생강이 잘 맞는다", scores: { 태양인:0, 태음인:0, 소양인:0, 소음인:3 } },
    ],
  },
  {
    category: "수면",
    q: "수면 패턴은 어떤가요?",
    options: [
      { label: "잠을 잘 못 자거나 수면이 불규칙하다", scores: { 태양인:2, 태음인:0, 소양인:1, 소음인:0 } },
      { label: "잠드는 편이고 깊이 자는 편이다", scores: { 태양인:0, 태음인:3, 소양인:0, 소음인:0 } },
      { label: "잠드는 데 시간이 걸리지만 일어나면 개운하다", scores: { 태양인:0, 태음인:0, 소양인:2, 소음인:1 } },
      { label: "잠들기 어렵고 작은 소리에도 잘 깬다", scores: { 태양인:0, 태음인:0, 소양인:0, 소음인:3 } },
    ],
  },
  {
    category: "건강",
    q: "자주 생기는 건강 문제는?",
    options: [
      { label: "다리 힘 약함·요도·소변 관련 불편", scores: { 태양인:3, 태음인:0, 소양인:0, 소음인:0 } },
      { label: "호흡기(기침·가래)나 피부 트러블", scores: { 태양인:0, 태음인:3, 소양인:0, 소음인:0 } },
      { label: "허리 아래·신장·방광이 자주 약하다", scores: { 태양인:0, 태음인:0, 소양인:3, 소음인:0 } },
      { label: "소화불량·복통·설사 등 속 문제", scores: { 태양인:0, 태음인:0, 소양인:0, 소음인:3 } },
    ],
  },
];

function SasangPage({ setView }) {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);

  const handleAnswer = (scores) => {
    const newAnswers = [...answers, scores];
    if (step < SASANG_QUIZ.length - 1) {
      setAnswers(newAnswers);
      setStep(step + 1);
    } else {
      const totals = { 태양인: 0, 태음인: 0, 소양인: 0, 소음인: 0 };
      newAnswers.forEach((s) => Object.entries(s).forEach(([k, v]) => { totals[k] += v; }));
      const winner = Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];
      setResult({ type: winner, totals });
      setStep("done");
    }
  };

  const reset = () => { setStep(-1); setAnswers([]); setResult(null); };

  if (step === "done" && result) {
    return <SasangResult result={result} onReset={reset} setView={setView} />;
  }

  if (step === -1) {
    return (
      <section className="sasang-page">
        <div className="sas-landing">
          <div className="sas-landing-header glass-panel">
            <p className="eyebrow">SASANG · 사상체질</p>
            <h1 className="sasang-main-title">나는 어떤<br />체질일까요?</h1>
            <p className="sasang-intro">
              조선 시대 이제마(李濟馬) 선생이 체계화한 사상의학은 사람을 네 가지 체질로 분류합니다.
              10가지 질문으로 내 체질을 알아보고, 어울리는 약재와 생활 조언을 확인해보세요.
            </p>
          </div>

          <div className="sas-type-grid">
            {Object.entries(SASANG_DATA).map(([type, d]) => (
              <div key={type} className="sas-type-card glass-panel">
                <div className="sas-type-card-bar" style={{ background: d.color }} />
                <div className="sas-type-card-body">
                  <div className="sas-type-card-head">
                    <span className="sas-type-name" style={{ color: d.color }}>{type}</span>
                    <span className="sas-type-ratio" style={{ background: `${d.color}18`, color: d.color, borderColor: `${d.color}40` }}>{d.ratio}</span>
                  </div>
                  <p className="sas-type-card-desc">{d.desc.split('.')[0]}.</p>
                  <div className="jd-pills sas-type-card-chips">
                    {d.strengths.slice(0, 2).map((s) => (
                      <span key={s} className="jd-pill" style={{ background: `${d.color}12`, color: d.color, borderColor: `${d.color}35` }}>{s}</span>
                    ))}
                  </div>
                  <p className="sas-type-card-herbs">약재: {d.herbs.slice(0, 2).join(' · ')}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="sas-compare-table glass-panel">
            <p className="sas-compare-title">체질별 강약 비교</p>
            <div className="sas-compare-header">
              <div className="sas-compare-label" />
              {Object.entries(SASANG_DATA).map(([type, d]) => (
                <div key={type} className="sas-compare-col-head" style={{ color: d.color }}>{type}</div>
              ))}
            </div>
            {SASANG_COMPARE.map((row) => (
              <div key={row.label} className="sas-compare-row">
                <div className="sas-compare-label">{row.label}</div>
                {Object.entries(SASANG_DATA).map(([type, d]) => (
                  <div key={type} className="sas-compare-cell">
                    <div className="sas-compare-bar-track">
                      <div className="sas-compare-bar-fill" style={{ width: `${(row[type] / 5) * 100}%`, background: d.color }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <button type="button" className="start sas-start-btn" onClick={() => setStep(0)}>
            <span>진단 시작하기</span><span className="arrow"><ArrowRight size={22} /></span>
          </button>
        </div>
      </section>
    );
  }

  const question = SASANG_QUIZ[step];
  const ALPHA = ["A", "B", "C", "D"];
  return (
    <section className="sasang-page">
      <div className="sasang-card glass-panel">
        <div className="sasang-progress-wrap">
          <div className="sasang-progress-bar" style={{ width: `${((step + 1) / SASANG_QUIZ.length) * 100}%` }} />
        </div>
        <div className="sas-step-dots">
          {SASANG_QUIZ.map((_, i) => (
            <div key={i} className={`sas-step-dot${i < step ? " done" : i === step ? " active" : ""}`} />
          ))}
        </div>
        <p className="sas-quiz-meta">
          STEP {step + 1} <span className="sas-quiz-category">· {question.category}</span>
        </p>
        <h2 className="sasang-q">{question.q}</h2>
        <div className="sasang-options">
          {question.options.map((opt, i) => (
            <button key={i} type="button" className="sasang-option" onClick={() => handleAnswer(opt.scores)}>
              <span className="sasang-option-inner">
                <span className="sas-opt-badge">{ALPHA[i]}</span>
                <span>{opt.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SasangResult({ result, onReset, setView }) {
  const data = SASANG_DATA[result.type];
  const totalScore = Object.values(result.totals).reduce((a, b) => a + b, 0);

  return (
    <section className="sasang-page">
      <div className="sasang-result glass-panel">
        <div className="sas-result-head" style={{ background: `${data.color}0e` }}>
          <p className="eyebrow">체질 진단 결과</p>
          <div className="sas-type-badge" style={{ color: data.color, borderColor: `${data.color}50`, background: `${data.color}14` }}>
            {result.type}
          </div>
          <p className="sas-desc">{data.desc}</p>
        </div>

        <div className="sas-score-bars">
          {Object.entries(result.totals).sort((a, b) => b[1] - a[1]).map(([type, score]) => {
            const d2 = SASANG_DATA[type];
            const pct = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;
            return (
              <div key={type} className="sas-score-row">
                <span className="sas-score-label" style={{ color: d2.color }}>{type}</span>
                <div className="sas-score-track">
                  <div className="sas-score-fill" style={{ width: `${pct}%`, background: d2.color }} />
                </div>
                <span className="sas-score-pct">{pct}%</span>
              </div>
            );
          })}
        </div>

        <div className="sas-sections-area">
          <div className="sas-two-col">
            <div className="sas-section">
              <h3>강점</h3>
              <div className="jd-pills">{data.strengths.map((s) => <span key={s} className="jd-pill">{s}</span>)}</div>
            </div>
            <div className="sas-section">
              <h3>주의 경향</h3>
              <div className="jd-pills">{data.weaknesses.map((w) => <span key={w} className="jd-pill complaint">{w}</span>)}</div>
            </div>
          </div>

          <div className="sas-section">
            <h3>어울리는 약재</h3>
            <p className="sas-hint">클릭하면 Herb Library에서 자세히 볼 수 있어요</p>
            <div className="jd-pills">
              {data.herbs.map((h) => (
                <button key={h} type="button" className="jd-pill tx" onClick={() => setView("library")}>{h}</button>
              ))}
            </div>
          </div>

          <div className="sas-two-col">
            <div className="sas-section">
              <h3>좋은 음식</h3>
              <div className="jd-pills">{data.foods.map((f) => <span key={f} className="jd-pill">{f}</span>)}</div>
            </div>
            <div className="sas-section">
              <h3>피할 것</h3>
              <div className="jd-pills">{data.avoid.map((a) => <span key={a} className="jd-pill complaint">{a}</span>)}</div>
            </div>
          </div>
        </div>

        <button type="button" className="sas-reset-btn" onClick={onReset}>다시 진단하기</button>
        <p className="disclaimer">참고용 진단이에요. 정확한 체질 진단은 한의사와 상담하세요.</p>
      </div>
    </section>
  );
}

export default App;