import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Menu,
  Moon,
  Search,
  Sparkles,
  Sprout,
  Waves,
} from "lucide-react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from "d3";

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

function App() {
  const [view, setViewState] = useState(() => (window.location.hash === "#library" ? "library" : "diagnosis"));
  const data = useKnowledgeData();
  const setView = (nextView) => {
    setViewState(nextView);
    window.location.hash = nextView === "library" ? "library" : "";
  };

  return (
    <main className={`shell ${view === "library" ? "library-shell" : ""}`}>
      <Header view={view} setView={setView} />
      {view === "library" ? <HerbLibrary data={data} /> : <StartPage />}
    </main>
  );
}

function Header({ view, setView }) {
  const items = [
    ["about", "ABOUT"],
    ["diagnosis", "SELF-DIAGNOSIS"],
    ["library", "HERB LIBRARY"],
    ["journal", "JOURNAL"],
    ["mypage", "MY PAGE"],
  ];

  return (
    <header className="topbar">
      <button className="brand brand-button" type="button" onClick={() => setView("diagnosis")}>MEDVIS</button>
      <nav className="nav" aria-label="Primary">
        {items.map(([key, label]) => (
          <button key={key} className={view === key ? "active" : ""} type="button" onClick={() => setView(key === "library" ? "library" : "diagnosis")}>
            {label}
          </button>
        ))}
      </nav>
      <div className="actions">
        <button className="login" type="button">로그인</button>
        <button className="icon-button" type="button" aria-label="메뉴 열기"><Menu size={20} /></button>
      </div>
    </header>
  );
}

function StartPage() {
  const [selected, setSelected] = useState(["피로감"]);
  const symptoms = [
    ["피로감", Activity],
    ["소화불량", Waves],
    ["수면장애", Moon],
    ["두통", Brain],
    ["어깨 결림", CircleDot],
    ["손발 차가움", Sparkles],
    ["생리통", CircleDot],
    ["스트레스", Sprout],
  ];

  return (
    <section className="hero" aria-label="Self diagnosis">
      <div className="intro">
        <p className="eyebrow">SELF-DIAGNOSIS</p>
        <h1>당신의 몸은 지금,<br />어떤 신호를<br />보내고 있나요?</h1>
        <p className="copy">몸이 보내는 작은 신호들을 놓치지 마세요.<br />AI가 당신의 컨디션을 분석하고, 균형 회복을 위한<br />맞춤 솔루션을 제안해드려요.</p>
        <button className="start" type="button"><span>진단 시작하기</span><span className="arrow"><ArrowRight size={22} /></span></button>
      </div>

      <div className="anatomy-stage" aria-hidden="true">
        <div className="orbit orbit-a" /><div className="orbit orbit-b" /><div className="orbit orbit-c" />
        <div className="spark s1" /><div className="spark s2" /><div className="spark s3" />
        <button className="body-tag tag-head" type="button"><span />머리/정신 <b>＋</b></button>
        <button className="body-tag tag-chest" type="button"><span />가슴 <b>＋</b></button>
        <button className="body-tag tag-shoulder" type="button"><span />어깨/허리 <b>＋</b></button>
        <button className="body-tag tag-digest" type="button"><span />소화기 <b>＋</b></button>
        <button className="body-tag tag-lower" type="button"><span />하복부 <b>＋</b></button>
        <button className="body-tag tag-leg" type="button"><span />다리/하체 <b>＋</b></button>
      </div>

      <aside className="diagnosis" aria-label="증상 선택">
        <div className="progress-row"><span>진단 진행률</span><div className="progress"><i /></div><strong>1/5</strong></div>
        <div className="panel">
          <h2>어떤 증상이 느껴지나요?</h2>
          <p>해당하는 증상을 선택해주세요. (복수 선택 가능)</p>
          <label className="search"><Search size={18} /><input type="search" placeholder="증상을 검색해보세요" /></label>
          <p className="section-label">자주 선택한 증상</p>
          <div className="symptoms">
            {symptoms.map(([label, Icon]) => {
              const isSelected = selected.includes(label);
              return (
                <button key={label} className={`symptom ${isSelected ? "selected" : ""}`} type="button" onClick={() => setSelected((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label])}>
                  {isSelected && <i className="check">✓</i>}
                  <Icon className="sym-icon" />
                  {label}
                </button>
              );
            })}
          </div>
          <button className="all" type="button"><span>전체 증상 보기</span><b>＋</b></button>
          <button className="complete" type="button"><span>선택 완료</span><small>{selected.length}</small><b><ArrowRight size={20} /></b></button>
        </div>
      </aside>

      <div className="steps"><button className="current" type="button">01 증상 선택</button><button type="button">02 문진</button><button type="button">03 분석 중</button><button type="button">04 결과 확인</button></div>
    </section>
  );
}

function HerbLibrary({ data }) {
  const { herbs, symptoms, prescriptions, categories, ucodes, organs, herbImages } = data;
  const [viewMode, setViewMode] = useState("guide"); // 'guide' | 'browse'
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

  const focusId = hoverId || (byId[selectedId] ? selectedId : null);
  const neighbors = useMemo(() => {
    if (!focusId) return null;
    const set = new Set([focusId]);
    links.forEach((l) => {
      const s = typeof l.source === "object" ? l.source.id : l.source;
      const t = typeof l.target === "object" ? l.target.id : l.target;
      if (s === focusId) set.add(t);
      if (t === focusId) set.add(s);
    });
    return set;
  }, [focusId, links]);
  const focusAnchor = focusId && byId[focusId]?.type === "anchor" ? byId[focusId] : null;
  const isLit = (id) => !neighbors || neighbors.has(id);

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
          <span className="lg-divider" />
          {categories.map((c) => (
            <span key={c.id} className="lg-item"><i style={{ background: c.color }} />{c.name}</span>
          ))}
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
            <line key={i} x1={px(s)} y1={py(s)} x2={px(t)} y2={py(t)}
              stroke={l.pair ? "rgba(150,165,178,0.4)" : "rgba(140,158,170,0.55)"}
              strokeWidth={focusId && lit ? 2.2 : (l.pair ? 1 : 0.8)}
              strokeDasharray={l.pair ? "3,4" : undefined}
              style={{ opacity: lit ? (focusId ? 0.85 : 0.28) : 0.05 }} />
          );
        })}

        {nodes.filter((n) => n.type === "herb").map((n) => {
          const lit = isLit(n.id);
          const color = catById[n.primaryCategory]?.color || "#9aa7b1";
          const sel = selectedId === n.id;
          return (
            <g key={n.id} transform={`translate(${px(n)},${py(n)})`}
               onMouseEnter={() => setHoverId(n.id)} onMouseLeave={() => setHoverId(null)}
               onClick={(e) => { e.stopPropagation(); setSelectedId(selectedId === n.id ? null : n.id); }}
               style={{ cursor: "pointer", opacity: lit ? 1 : 0.12 }}>
              <circle r={n.r} fill={color} stroke="#fff" strokeWidth={sel ? 2.5 : 1.5}
                style={sel || hoverId === n.id ? { filter: `drop-shadow(0 0 7px ${color})` } : {}} />
              <text textAnchor="middle" dy="3.5" fontSize={n.nameKo.length > 2 ? 10 : 11.5}
                fontWeight="700" fill="#fff" style={{ pointerEvents: "none" }}>{n.nameKo}</text>
            </g>
          );
        })}

        {nodes.filter((n) => n.type === "anchor").map((n) => {
          const lit = isLit(n.id);
          const isFocus = focusId === n.id;
          return (
            <g key={n.id} transform={`translate(${px(n)},${py(n)})`}
               onMouseEnter={() => setHoverId(n.id)} onMouseLeave={() => setHoverId(null)}
               onClick={(e) => { e.stopPropagation(); setSelectedId(selectedId === n.id ? null : n.id); }}
               style={{ cursor: "pointer", opacity: lit ? 1 : 0.2 }}>
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
      </svg>
    </div>
  );
}

function DetailPanel({ selectedId, setSelectedId, herbById, symById, ucodeById, catById, organById, herbImages, prescriptions, activeCategoryId }) {
  const activeCat = catById[activeCategoryId];
  const accent = activeCat?.color || "#6f97aa";

  let kind = null;
  if (selectedId?.startsWith("herb_")) kind = "herb";
  else if (selectedId?.startsWith("cls:")) kind = "compound";
  else if (selectedId?.startsWith("U")) kind = "ucode";
  else if (selectedId?.startsWith("sym_")) kind = "symptom";
  else if (organById?.[selectedId]) kind = "organ";

  const herb = kind === "herb" ? herbById[selectedId] : null;
  const ucode = kind === "ucode" ? ucodeById[selectedId] : null;
  const symptom = kind === "symptom" ? symById[selectedId] : null;
  const organ = kind === "organ" ? organById[selectedId] : null;

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

export default App;
