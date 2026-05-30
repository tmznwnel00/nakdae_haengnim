// 진단 결과(렌즈) — 루트 medvis lens.js + lens.html을 React로 이식.
// 선택한 한방 호소에 대해 Supabase 후기 데이터를 집계/시각화한다.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "./supabase.js";

// ============ 상수/유틸 ============
const OUT_CLASS = { "호전": "improve", "진행중": "progress", "불명": "unclear", "악화": "worse", "변화없음": "same" };
const OUTCOME_ORDER = ["호전", "진행중", "불명", "악화", "변화없음"];
const pct = (v, n) => (n ? (100 * v) / n : 0);
const fmtPct = (x) => (x < 10 ? x.toFixed(1) : x.toFixed(0)) + "%";
const fmtInt = (x) => Number(x).toLocaleString();
const srcCls = (s) => (s === "prior+cooccur" ? "strong" : s === "prior" ? "prior" : "cooccur");

// ============ Supabase 쿼리 ============
async function loadCrosswalkKcd(complaint) {
  const { data, error } = await supabase
    .from("crosswalk_complaint_to_kcd")
    .select("kcd3, kcd3_name_ko, prior_weight, source, note")
    .eq("complaint_hanbang", complaint)
    .order("prior_weight", { ascending: false });
  if (error) throw error;
  return data || [];
}
async function loadCrosswalkU(complaint) {
  const { data, error } = await supabase
    .from("crosswalk_complaint_to_u")
    .select("u_code, u_name_ko, u_name_en, score, rank")
    .eq("complaint_hanbang", complaint)
    .order("rank");
  if (error) throw error;
  return data || [];
}
async function loadKcdToU(kcdList) {
  if (!kcdList.length) return [];
  const { data, error } = await supabase
    .from("crosswalk_kcd3_to_u")
    .select("kcd3, u_code, u_name_ko, weight, rank")
    .in("kcd3", kcdList);
  if (error) throw error;
  return data || [];
}
async function loadExtracted(complaint) {
  const { data, error } = await supabase
    .from("reviews_extracted_lite_v1")
    .select(
      "review_id, source, outcome, treatment_emphasis, treatments_hanbang, prior_yangbang_tx, cross_modality_comparison, diagnosis_yangbang, outcome_evidence, outcome_timing, info_density, is_likely_ad"
    )
    .contains("complaints_hanbang", [complaint])
    .limit(2000);
  if (error) throw error;
  return data || [];
}
async function fetchReviewContent(reviewId, source) {
  const table = source === "naver" ? "naver_reviews" : "kakao_reviews";
  const { data, error } = await supabase
    .from(table)
    .select("content, written_at, clinic_id")
    .eq("id", reviewId)
    .maybeSingle();
  if (error || !data) return null;
  let clinic = null;
  if (data.clinic_id) {
    const { data: c } = await supabase
      .from("clinics")
      .select("name, district")
      .eq("id", data.clinic_id)
      .maybeSingle();
    clinic = c;
  }
  return { content: data.content, written_at: data.written_at, clinic };
}

// ============ 집계 ============
function aggregate(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const v = r[key] ?? "(null)";
    m.set(v, (m.get(v) || 0) + 1);
  }
  return [...m.entries()].map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n);
}
function aggregateTreatment(rows) {
  const m = new Map();
  for (const r of rows) {
    const tx = r.treatment_emphasis;
    if (!tx || tx === "처치불명") continue;
    if (!m.has(tx)) m.set(tx, { name: tx, n: 0, out: {} });
    const e = m.get(tx);
    e.n++;
    e.out[r.outcome] = (e.out[r.outcome] || 0) + 1;
  }
  return [...m.values()].sort((a, b) => b.n - a.n);
}
function unnestAgg(rows, key, filter) {
  const m = new Map();
  for (const r of rows) {
    const arr = r[key];
    if (!Array.isArray(arr)) continue;
    for (const v of arr) {
      if (filter && !filter(v)) continue;
      m.set(v, (m.get(v) || 0) + 1);
    }
  }
  return [...m.entries()].map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n);
}

// ============ 브리지 SVG (DOM 측정 방식, lens.js drawBridge 이식) ============
function makeCurve(x1, y1, x2, y2, w, opacity) {
  const dx = (x2 - x1) * 0.5;
  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("stroke", "#a1a1aa");
  path.setAttribute("stroke-width", w);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("opacity", String(opacity));
  return path;
}
function drawBridge(root, svg, topKcd, topU, links) {
  if (!svg || !root) return;
  const rect = root.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  svg.setAttribute("width", rect.width);
  svg.setAttribute("height", rect.height);
  svg.innerHTML = "";
  const pos = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left - rect.left, right: r.right - rect.left, top: r.top - rect.top + r.height / 2 };
  };
  const cEl = root.querySelector("#bc-complaint");
  if (!cEl) return;
  const c = pos(cEl);
  topKcd.forEach((k, i) => {
    const el = root.querySelector(`#bc-kcd-${i}`);
    if (!el) return;
    const p = pos(el);
    const w = Math.max(1, Math.min(10, 16 * +k.prior_weight));
    svg.appendChild(makeCurve(c.right, c.top, p.left, p.top, w, 0.55));
  });
  const uIdx = new Map(topU.map((u, i) => [u.u_code, i]));
  topKcd.forEach((k, i) => {
    const fromEl = root.querySelector(`#bc-kcd-${i}`);
    if (!fromEl) return;
    const f = pos(fromEl);
    links
      .filter((l) => l.kcd3 === k.kcd3 && uIdx.has(l.u_code))
      .forEach((l) => {
        const tEl = root.querySelector(`#bc-u-${uIdx.get(l.u_code)}`);
        if (!tEl) return;
        const t = pos(tEl);
        const w = Math.max(0.5, Math.min(7, 8 * +l.weight));
        svg.appendChild(makeCurve(f.right, f.top, t.left, t.top, w, 0.32));
      });
  });
}

// ============ 컴포넌트 ============
export default function DiagnosisResult({ complaint, setView, onOpenLibrary, ucodeIds }) {
  const canLink = (uc) => !!(onOpenLibrary && ucodeIds && ucodeIds.has(uc));
  const [state, setState] = useState({ status: "loading", error: null, kcdRows: [], uRows: [], links: [], extracted: [], samples: [] });
  const [expanded, setExpanded] = useState(() => new Set());
  const bridgeRef = useRef(null);
  const svgRef = useRef(null);
  const reviewDragRef = useRef(null);

  const onReviewListMouseDown = (e) => {
    const el = e.currentTarget;
    reviewDragRef.current = { y: e.clientY, top: el.scrollTop };
    const onMove = (mv) => { el.scrollTop = reviewDragRef.current.top - (mv.clientY - reviewDragRef.current.y); };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    if (!complaint) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading", error: null }));
    (async () => {
      try {
        const [kcdRows, uRows, extracted] = await Promise.all([
          loadCrosswalkKcd(complaint),
          loadCrosswalkU(complaint),
          loadExtracted(complaint),
        ]);
        const topKcd = kcdRows.slice(0, 6);
        const links = await loadKcdToU(topKcd.map((r) => r.kcd3));
        const samples = await pickSamples(extracted);
        if (cancelled) return;
        setState({ status: "ready", error: null, kcdRows, uRows, links, extracted, samples });
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({ ...s, status: "error", error: e.message || String(e) }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [complaint]);

  const { extracted } = state;
  const outcomeAgg = useMemo(() => aggregate(extracted, "outcome"), [extracted]);
  const txAgg = useMemo(() => aggregateTreatment(extracted), [extracted]);
  const modalityAgg = useMemo(() => aggregate(extracted, "cross_modality_comparison"), [extracted]);
  const priorAgg = useMemo(
    () => unnestAgg(extracted, "prior_yangbang_tx", (v) => v !== "없음" && v !== "처치불명"),
    [extracted]
  );
  const n = extracted.length;
  const topKcd = state.kcdRows.slice(0, 6);
  const topU = state.uRows.slice(0, 5);

  // 브리지 SVG 그리기 + 리사이즈 대응
  useEffect(() => {
    if (state.status !== "ready") return undefined;
    const root = bridgeRef.current;
    const svg = svgRef.current;
    if (!root || !svg) return undefined;
    const redraw = () => drawBridge(root, svg, topKcd, topU, state.links);
    const raf = requestAnimationFrame(redraw);
    const ro = new ResizeObserver(redraw);
    ro.observe(root);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [state.status, state.kcdRows, state.uRows, state.links]); // eslint-disable-line react-hooks/exhaustive-deps

  const outGet = (k) => outcomeAgg.find((o) => o.key === k)?.n || 0;

  return (
    <div className="lens-view">
      <div className="lens-top">
        <button type="button" className="lens-back" onClick={() => setView("diagnosis")}>
          <ArrowLeft size={15} /> 증상 다시 선택
        </button>
        <div className="lens-meta">
          {state.status === "loading" && "loading…"}
          {state.status === "ready" && `supabase · n=${fmtInt(n)}`}
          {state.status === "error" && <span className="error">로딩 실패: {state.error}</span>}
        </div>
      </div>

      <section className="header">
        <div>
          <h1>
            <span className="kind">한방 호소</span>
            {complaint || "—"}
          </h1>
          <p className="lede">
            한의원 후기 9,700건을 LLM으로 추출한 데이터셋에서, 환자가 직접 호소한 한방 증상을 양방 진단·한의 변증 코드와 연결하고 실제 경과를 집계합니다.
          </p>
          {topU.some((r) => canLink(r.u_code)) && (
            <button type="button" className="lens-cta" onClick={() => onOpenLibrary(topU.find((r) => canLink(r.u_code)).u_code)}>
              이 증상의 한방 약재 보기 <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
        <div className="stats">
          <div className="stat">
            <div className="label">후기 수</div>
            <div className="value">{fmtInt(n)} <span className="unit">건</span></div>
          </div>
          <div className="stat">
            <div className="label">호전</div>
            <div className="value">{fmtPct(pct(outGet("호전"), n))}</div>
          </div>
          <div className="stat">
            <div className="label">악화</div>
            <div className="value">{fmtPct(pct(outGet("악화"), n))}</div>
          </div>
        </div>
      </section>

      {state.status === "loading" ? (
        <div className="loading" style={{ marginTop: 24 }}>데이터 불러오는 중…</div>
      ) : state.status === "error" ? (
        <div className="error" style={{ marginTop: 24 }}>{state.error}</div>
      ) : (
        <>
          <div className="grid">
            {/* 행 1: 양방↔한의 매핑 | 경과 분포 */}
            <section className="panel">
              <div className="title">
                <h2>양방 ↔ 한의 매핑</h2>
                <span className="n">{topKcd.length} × {topU.length}</span>
              </div>
              <div className="bridge-wrap" ref={bridgeRef}>
                <div className="bridge-cols">
                  <div className="bridge-col">
                    <h3>한방 호소</h3>
                    <div className="item" id="bc-complaint">
                      <div className="label">{complaint}</div>
                      <div className="meta"><span className="w">기준</span></div>
                    </div>
                  </div>
                  <div className="bridge-col">
                    <h3>양방 KCD-7</h3>
                    {topKcd.map((r, i) => (
                      <div className="item" id={`bc-kcd-${i}`} key={r.kcd3} data-kcd={r.kcd3}>
                        <div className="label"><span className="code">{r.kcd3}</span>{r.kcd3_name_ko || ""}</div>
                        <div className="meta">
                          <span className={`badge ${srcCls(r.source)}`}>{r.source}</span>
                          <span className="w">{(+r.prior_weight).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bridge-col">
                    <h3>한의 U코드</h3>
                    {topU.map((r, i) => {
                      const link = canLink(r.u_code);
                      return (
                        <div className={`item ${link ? "u-link" : ""}`} id={`bc-u-${i}`} key={r.u_code} data-u={r.u_code}
                          role={link ? "button" : undefined} tabIndex={link ? 0 : undefined}
                          title={link ? "이 변증에 쓰는 약재 보기" : undefined}
                          onClick={link ? () => onOpenLibrary(r.u_code) : undefined}
                          onKeyDown={link ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenLibrary(r.u_code); } } : undefined}>
                          <div className="label"><span className="code">{r.u_code}</span>{r.u_name_ko || ""}</div>
                          <div className="meta">
                            <span style={{ fontSize: "10.5px", color: "var(--l-muted)" }}>{r.u_name_en || ""}</span>
                            <span className="w">{(+r.score).toFixed(2)}</span>
                          </div>
                          {link && <span className="u-go" aria-hidden="true">약재 보기 →</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <svg className="bridge-svg" ref={svgRef} aria-hidden="true" />
              </div>
              <div className="legend">
                <span className="item"><span className="badge strong">prior+cooccur</span> 도메인 + 우리 데이터 양쪽 일치</span>
                <span className="item"><span className="badge prior">prior</span> 도메인 지식 기반</span>
                <span className="item"><span className="badge cooccur">cooccur</span> 우리 데이터 관측만</span>
              </div>
            </section>

            <section className="panel">
              <div className="title">
                <h2>경과 분포</h2>
                <span className="n">n={fmtInt(n)}</span>
              </div>
              <div className="bars">
                {OUTCOME_ORDER.map((k) => {
                  const v = outGet(k);
                  const p = pct(v, n);
                  return (
                    <div className="bar-row" key={k}>
                      <div className={`name ${k === "호전" ? "strong" : ""}`}>{k}</div>
                      <div className="track"><div className={`fill ${OUT_CLASS[k] || "neutral"}`} style={{ width: `${p.toFixed(2)}%` }} /></div>
                      <div className="val">{fmtPct(p)} <span className="n">n={fmtInt(v)}</span></div>
                    </div>
                  );
                })}
              </div>
              <div className="callout">
                <strong>주의 — 호전율 ≠ 임상 효능</strong>: 후기는 만족한 환자가 더 많이 남기는 경향(survivorship bias)이 있어, 실제 치료 효과보다 호전율이 과대평가됩니다. 대조군이 없는 관찰 데이터로서 참고만 하세요.
              </div>
            </section>

            {/* 행 2: 양방→한방 경로 | 처치별 경과 */}
            <section className="panel">
              <div className="title">
                <h2>양방 → 한방 경로</h2>
                <span className="n">n={fmtInt(n)}</span>
              </div>
              <ModalitySection modalityAgg={modalityAgg} priorAgg={priorAgg} n={n} />
            </section>

            <section className="panel">
              <div className="title">
                <h2>처치별 경과</h2>
                <span className="n">명시된 처치 n={fmtInt(txAgg.reduce((s, t) => s + t.n, 0))}</span>
              </div>
              {txAgg.map((t) => {
                const improvePct = pct(t.out["호전"] || 0, t.n);
                return (
                  <div className="stacked-row" key={t.name}>
                    <div className="name">{t.name}</div>
                    <div className="stack">
                      {OUTCOME_ORDER.map((o) => {
                        const v = t.out[o] || 0;
                        const p = pct(v, t.n);
                        return p > 0 ? <div className={`seg ${OUT_CLASS[o] || "neutral"}`} style={{ width: `${p.toFixed(2)}%` }} title={`${o} ${v}`} key={o} /> : null;
                      })}
                    </div>
                    <div className="nval">{fmtPct(improvePct)} <span style={{ color: "var(--l-muted)" }}>n={t.n}</span></div>
                  </div>
                );
              })}
              <div className="subnote">막대는 경과 분포(스택). 우측 숫자는 호전 비율. '처치불명'(후기 본문에서 구체 처치명 미추출)은 제외.</div>
            </section>
          </div>

          {/* 실제 후기 샘플 */}
          <section className="panel reviews-panel" style={{ marginTop: 24 }}>
            <div className="title">
              <h2>실제 후기 샘플</h2>
              <span className="n">n={state.samples.length} · info_density=high · is_likely_ad=false</span>
            </div>
            <div className="review-list" onMouseDown={onReviewListMouseDown}>
              {state.samples.length === 0 ? (
                <div className="loading">샘플 없음</div>
              ) : (
                state.samples.map((p, i) => {
                  const cls = OUT_CLASS[p.outcome] || "neutral";
                  const tags = [];
                  if (p.treatment_emphasis) tags.push(`처치: ${p.treatment_emphasis}`);
                  if (p.cross_modality_comparison && p.cross_modality_comparison !== "불명") tags.push(p.cross_modality_comparison);
                  if (p.prior_yangbang_tx && p.prior_yangbang_tx.length && p.prior_yangbang_tx[0] !== "없음") tags.push(`선치료: ${p.prior_yangbang_tx.join(", ")}`);
                  if (p.diagnosis_yangbang && p.diagnosis_yangbang.length) tags.push(`양방진단: ${p.diagnosis_yangbang.join(", ")}`);
                  const open = expanded.has(i);
                  return (
                    <div className="review" key={p.review_id}>
                      <div className="hd">
                        <span className={`out ${cls}`}>{p.outcome}</span>
                        {tags.map((t, ti) => <span className="tag" key={ti}>{t}</span>)}
                        <span className="meta">{p.content.clinic?.name ?? "?"} · {p.content.clinic?.district ?? "?"} · {p.content.written_at ?? ""} · {p.source}</span>
                      </div>
                      <div className={`body ${open ? "open" : ""}`}>{p.content.content || ""}</div>
                      {p.outcome_evidence ? <div className="evidence">LLM 추출 경과 근거: "{p.outcome_evidence}"</div> : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* 다음 단계 + 데이터 한계 2컬럼 */}
          <div className="bottom-row">
            {topU.some((r) => canLink(r.u_code)) && (
              <section className="panel lens-next">
                <div className="title">
                  <h2>다음 단계 — 한방 약재로 이어보기</h2>
                  <span className="n">변증 {topU.filter((r) => canLink(r.u_code)).length}</span>
                </div>
                <p className="lens-next-lede">’{complaint}’과(와) 연결된 한의 변증입니다. 눌러서 라이브러리에서 해당 변증에 쓰는 약재를 확인하세요.</p>
                <div className="lens-next-chips">
                  {topU.filter((r) => canLink(r.u_code)).map((r) => (
                    <button key={r.u_code} type="button" className="chip" onClick={() => onOpenLibrary(r.u_code)}>
                      <span className="code">{r.u_code}</span>{r.u_name_ko} <span aria-hidden="true">→</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section className="panel limits">
              <div className="title">
                <h2>데이터 한계 · 출처</h2>
                <span className="n">v1</span>
              </div>
              <ul>
                <li>LLM 추출 9,700건 중 해당 한방 호소가 포함된 후기를 집계합니다.</li>
                <li>치료 효과 인과 추정이 아니며, 후기 텍스트 LLM 라벨에 의존합니다.</li>
                <li>한방↔양방 매핑은 ECAM 2016 + 동시 명시 387건 결합 초안입니다.</li>
                <li>강남구 편중, naver/kakao 신뢰성·작성 동기 차이 주의.</li>
              </ul>
              <div className="src">
                출처: Supabase <code>jmojkseooezbxmdyblyl</code> · ECAM 2016 (PMC4812360)
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

// 양방→한방 경로 (modality) 서브 렌더
function ModalitySection({ modalityAgg, priorAgg, n }) {
  const order = ["직접_한방", "대체_양방실패", "대체_양방불신", "보완", "병행", "불명"];
  const labels = {
    "직접_한방": "처음부터 한방",
    "대체_양방실패": "양방 실패 후",
    "대체_양방불신": "양방 불신으로",
    "보완": "양방 보완",
    "병행": "양방 병행",
    "불명": "분류 불명",
  };
  const lookup = Object.fromEntries(modalityAgg.map((a) => [a.key, a.n]));
  const priorTotal = priorAgg.reduce((s, x) => s + x.n, 0);
  return (
    <>
      <div className="bars">
        {order.map((k) => {
          const v = lookup[k] || 0;
          if (!v) return null;
          const p = pct(v, n);
          return (
            <div className="bar-row" key={k}>
              <div className="name">{labels[k]}</div>
              <div className="track"><div className={`fill ${k === "불명" ? "unclear" : "neutral"}`} style={{ width: `${p.toFixed(2)}%` }} /></div>
              <div className="val">{fmtPct(p)} <span className="n">n={fmtInt(v)}</span></div>
            </div>
          );
        })}
      </div>
      <div className="subnote">선치료 명시 후기 {fmtInt(priorTotal)}건의 양방 처치 종류 (대부분은 '없음'으로 직접 한방행)</div>
      <div className="bars" style={{ marginTop: 8 }}>
        {priorAgg.length === 0 ? (
          <div className="loading">선치료 명시 없음</div>
        ) : (
          priorAgg.slice(0, 8).map((p) => (
            <div className="bar-row" key={p.key}>
              <div className="name">{p.key}</div>
              <div className="track"><div className="fill neutral" style={{ width: `${pct(p.n, priorTotal).toFixed(2)}%` }} /></div>
              <div className="val">{fmtPct(pct(p.n, priorTotal))} <span className="n">n={p.n}</span></div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

// 샘플 후기 최대 10건 선택 + 본문 로드
async function pickSamples(rows) {
  const used = new Set();
  const pickOne = (filter) => {
    const r = rows.find((x) => filter(x) && !used.has(x.review_id));
    if (r) used.add(r.review_id);
    return r;
  };
  const picks = [
    pickOne((r) => r.outcome === "악화" && r.info_density === "high" && !r.is_likely_ad),
    pickOne((r) => r.cross_modality_comparison === "대체_양방실패" && r.outcome === "호전" && r.info_density === "high"),
    pickOne((r) => r.outcome === "호전" && r.treatment_emphasis === "추나" && r.info_density === "high"),
    pickOne((r) => r.outcome === "호전" && r.treatment_emphasis === "침" && r.info_density === "high"),
    pickOne((r) => r.outcome === "진행중" && r.info_density === "high"),
    pickOne((r) => r.outcome === "호전" && r.info_density === "high" && !r.is_likely_ad),
    pickOne((r) => r.outcome === "호전" && r.treatment_emphasis === "한약" && r.info_density === "high"),
    pickOne((r) => r.outcome === "불명" && r.info_density === "high"),
    pickOne((r) => r.outcome === "호전" && r.info_density === "high"),
    pickOne((r) => r.info_density === "high" && !r.is_likely_ad),
  ].filter(Boolean);
  const contents = await Promise.all(picks.map((p) => fetchReviewContent(p.review_id, p.source)));
  return picks.map((p, i) => ({ ...p, content: contents[i] })).filter((p) => p.content);
}
