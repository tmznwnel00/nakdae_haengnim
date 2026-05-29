// 약재 유니버스 force 레이아웃 겹침/경계/분포 점검 — 파라미터 튜닝용
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from "d3";
import fs from "fs";
const here = new URL(".", import.meta.url).pathname;
const D = here + "../public/data/";
const herbs = JSON.parse(fs.readFileSync(D + "herbs.json"));
const organs = JSON.parse(fs.readFileSync(D + "organs.json"));
const W = 1140, H = 800, CX = W / 2, CY = H / 2;
const ORGAN_PAIRS = [["간", "담"], ["심", "소장"], ["비", "위"], ["폐", "대장"], ["신", "방광"], ["심포", "삼초"]];
const organById = Object.fromEntries(organs.map((o) => [o.id, o]));

const P = { // 후보 파라미터
  linkPair: 150, linkOther: 92, sPair: 0.05, sOther: 0.13,
  chAnchor: -650, chHerb: -190, colAnchor: 18, colHerb: 8,
  xy: 0.11, ticks: 700,
};

function layout(lens) {
  let anchors = [], hn = [], ls = [];
  if (lens === "organ") {
    const maxC = Math.max(1, ...organs.map((o) => o.herbCount));
    anchors = organs.map((o, i) => ({ ...o, id: o.id, type: "anchor", r: 26 + (o.herbCount / maxC) * 18, x: CX + Math.cos(i / organs.length * 6.28) * 140, y: CY + Math.sin(i / organs.length * 6.28) * 140 }));
    hn = herbs.filter((h) => (h.meridians || []).length > 0).map((h, i) => ({ ...h, type: "herb", r: 12 + h.meridians.length * 0.8, x: CX + Math.cos(i * 2.4) * 300, y: CY + Math.sin(i * 2.4) * 300 }));
    hn.forEach((h) => h.meridians.forEach((m) => { if (organById[m]) ls.push({ source: h.id, target: m }); }));
    ORGAN_PAIRS.forEach(([a, b]) => ls.push({ source: a, target: b, pair: true }));
  } else {
    const cc = {}; herbs.forEach((h) => (h.compounds || []).forEach((c) => cc[c.cls] = (cc[c.cls] || 0) + 1));
    const cls = Object.keys(cc), maxC = Math.max(1, ...Object.values(cc));
    anchors = cls.map((c, i) => ({ id: `cls:${c}`, type: "anchor", r: 22 + (cc[c] / maxC) * 18, x: CX + Math.cos(i / cls.length * 6.28) * 150, y: CY + Math.sin(i / cls.length * 6.28) * 150 }));
    hn = herbs.filter((h) => (h.compounds || []).length > 0).map((h, i) => { const u = [...new Set(h.compounds.map((c) => c.cls))]; return { ...h, type: "herb", r: 12 + u.length * 1.4, x: CX + Math.cos(i * 2.4) * 290, y: CY + Math.sin(i * 2.4) * 290 }; });
    hn.forEach((h) => [...new Set(h.compounds.map((c) => c.cls))].forEach((c) => ls.push({ source: h.id, target: `cls:${c}` })));
  }
  const ns = [...anchors, ...hn];
  const sim = forceSimulation(ns)
    .force("link", forceLink(ls).id((d) => d.id).distance((d) => d.pair ? P.linkPair : P.linkOther).strength((d) => d.pair ? P.sPair : P.sOther))
    .force("charge", forceManyBody().strength((d) => d.type === "anchor" ? P.chAnchor : P.chHerb))
    .force("collide", forceCollide().radius((d) => d.r + (d.type === "anchor" ? P.colAnchor : P.colHerb)).strength(1).iterations(4))
    .force("center", forceCenter(CX, CY)).force("x", forceX(CX).strength(P.xy)).force("y", forceY(CY).strength(P.xy)).stop();
  for (let i = 0; i < P.ticks; i++) sim.tick();
  // 경계 밖 노드 수
  let oob = ns.filter((n) => n.x < n.r || n.x > W - n.r || n.y < n.r || n.y > H - n.r).length;
  // 겹침 (실제 시각 반경)
  let ov = 0;
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const d = Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y);
    if (d < ns[i].r + ns[j].r - 2) ov++;
  }
  const xs = ns.map((n) => n.x), ys = ns.map((n) => n.y);
  return { n: ns.length, ov, oob, bx: [Math.round(Math.min(...xs)), Math.round(Math.max(...xs))], by: [Math.round(Math.min(...ys)), Math.round(Math.max(...ys))] };
}
console.log("params:", JSON.stringify(P));
for (const l of ["organ", "compound"]) { const r = layout(l); console.log(`${l}: 노드${r.n} 겹침${r.ov} 경계밖${r.oob} x[${r.bx}] y[${r.by}]`); }
