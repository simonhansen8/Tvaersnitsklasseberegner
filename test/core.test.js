// Tests af beregningskernen (Core) i index.html. Køres med: node --test
// Kernen læses direkte fra index.html, så testene altid gælder den fil, der ligger online.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('const Core = (() =>');
const endTxt = "if (typeof module !== 'undefined') module.exports = Core;";
const end = html.indexOf(endTxt);
assert.ok(start > 0 && end > start, 'Beregningskernen blev ikke fundet i index.html');
const sandbox = { module: { exports: {} } };
vm.runInNewContext(html.slice(start, end + endTxt.length), sandbox);
const C = sandbox.module.exports;

const near = (actual, expected, relTol, msg) =>
  assert.ok(Math.abs(actual - expected) <= relTol * Math.abs(expected), `${msg}: ${actual} ≠ ${expected} (±${relTol * 100} %)`);
const S355 = { fy: 355, gM0: 1.1 };

test('tværsnitskonstanter svarer til profiltabeller', () => {
  let G = C.run(C.buildRolled('IPE', 400), { ...S355, NEd: 0, MEd: 0 }).G;
  near(G.A, 8446, 0.002, 'IPE 400 A'); near(G.Iy, 23130e4, 0.002, 'IPE 400 Iy');
  near(G.Wpl, 1307e3, 0.002, 'IPE 400 Wpl,y'); near(G.Iz, 1318e4, 0.002, 'IPE 400 Iz'); near(G.Wplz, 229e3, 0.005, 'IPE 400 Wpl,z');
  G = C.run(C.buildRolled('HEB', 300), { ...S355, NEd: 0, MEd: 0 }).G;
  near(G.A, 14910, 0.002, 'HEB 300 A'); near(G.Iy, 25170e4, 0.002, 'HEB 300 Iy'); near(G.Wpl, 1869e3, 0.002, 'HEB 300 Wpl,y');
  G = C.run(C.buildRHS({ h: 200, b: 200, t: 5, mfg: 'cold' }), { ...S355, NEd: 0, MEd: 0 }).G;
  near(G.A, 3836, 0.005, 'SHS 200×5 A'); near(G.Iy, 2410e4, 0.005, 'SHS 200×5 I');
  G = C.run(C.buildCHS({ d: 508, t: 8 }), { ...S355, NEd: 0, MEd: 0 }).G;
  near(G.A, Math.PI * 500 * 8, 0.001, 'CHS 508×8 A');
  G = C.run(C.buildAngle({ h: 150, b: 90, t: 10, r1: 12, r2: 6 }), { ...S355, NEd: 0 }).G;
  near(G.A, 2320, 0.005, 'L150×90×10 A'); near(G.Iu, 591e4, 0.005, 'L150×90×10 Iu'); near(G.Iv, 88.6e4, 0.01, 'L150×90×10 Iv');
});

test('f_y efter produktstandard og γ_M0 efter DK NA', () => {
  assert.equal(C.fyTable('S355', 16), 355); assert.equal(C.fyTable('S355', 16.1), 345);
  assert.equal(C.fyTable('S235', 100), 215); assert.equal(C.fyTable('S460', 50), 430);
  assert.equal(C.fyTable('S355', 101), null);
  near(C.gammaM0({ situation: 'vedvarende', lk: 2, cc: 'CC2', control: 'normal' }).g, 1.1, 1e-12, 'γM0 lk 2');
  near(C.gammaM0({ situation: 'vedvarende', lk: 5, cc: 'CC3', control: 'skaerpet' }).g, 1.1 * 1.2 * 1.1 * 0.95, 1e-12, 'γM0 lk 5');
  assert.equal(C.gammaM0({ situation: 'ulykke' }).g, 1.0);
});

test('k_σ og effektive bredder efter EN 1993-1-5 tabel 4.1 og 4.2', () => {
  assert.equal(C.kSigmaInternal(1), 4.0);
  near(C.kSigmaInternal(0), 7.81, 1e-9, 'kσ ψ = 0');
  near(C.kSigmaInternal(-1), 23.9, 0.002, 'kσ ψ = −1 (tabel 4.1: 23,9)');
  assert.equal(C.kSigmaOutstand(1, true), 0.43);
  near(C.kSigmaOutstand(0, true), 0.57, 1e-9, 'kσ udstående, fri kant');
  near(C.kSigmaOutstand(0, false), 1.70, 1e-9, 'kσ udstående, rod');
  // Svejst I 1000×8 / 300×20, ren bøjning: krop med ψ = −1 (håndregning)
  const r = C.run(C.buildWelded({ h: 1000, tw: 8, bt: 300, tft: 20, bb: 300, tfb: 20, a: 5 }), { ...S355, NEd: 0, MEd: 1000e6 });
  assert.equal(r.cM.cls, 4);
  const w = r.effMp.det.find(d => d.el.id === 'web').w;
  near(w.psi, -1, 1e-6, 'ψ'); near(w.lp, 1.046, 0.002, 'λp'); near(w.rho, 0.855, 0.002, 'ρ');
  near(w.beff, 404.5, 0.002, 'b_eff'); near(w.be1, 0.4 * w.beff, 1e-9, 'b_e1');
});

test('klassifikation efter tabel 5.2', () => {
  const ipe = C.run(C.buildRolled('IPE', 400), { ...S355, NEd: 1500e3, MEd: 40e6 });
  assert.equal(ipe.cN.cls, 4); assert.equal(ipe.cM.cls, 1); assert.equal(ipe.cC.cls, 4);
  near(ipe.effN.A, 8117, 0.002, 'IPE 400 A_eff');
  assert.equal(C.run(C.buildRolled('HEA', 200), { ...S355, NEd: 0, MEd: 0 }).cN.cls, 2); // flange c/t = 7,9 mellem 9ε og 10ε
  assert.equal(C.run(C.buildRolled('HEB', 300), { ...S355, NEd: 0, MEd: 0 }).cN.cls, 1);
  assert.equal(C.run(C.buildCHS({ d: 508, t: 8 }), { ...S355, NEd: 0, MEd: 0 }).cN.cls, 4); // d/t = 63,5 > 90ε²
  assert.equal(C.run(C.buildAngle({ h: 150, b: 90, t: 10, r1: 12, r2: 6 }), { ...S355, NEd: 1e5 }).cN.cls, 4); // h/t = 15 > 15ε
  // I serieoversigten skal den kombinerede klasse være den samme som i hovedberegningen
  assert.equal(C.combinedClass(C.buildRolled('IPE', 400), { ...S355, NEd: 1500e3, MEd: 40e6 }), ipe.cC.cls);
});

test('interaktion N + M efter 6.2.9', () => {
  const heb = C.buildRolled('HEB', 300);
  let r = C.run(heb, { ...S355, NEd: 4000e3, MEd: 100e6 });
  assert.match(r.I.method, /6\.36/); near(r.I.util, 0.866, 0.002, 'HEB 300 (6.36)');
  r = C.run(heb, { ...S355, NEd: 400e3, MEd: 100e6 });
  assert.match(r.I.method, /6\.33/); near(r.I.util, 100e6 / (r.G.Wpl * r.fyd), 1e-9, 'ingen reduktion');
  r = C.run(heb, { ...S355, NEd: 5000e3, MEd: 100e6 });
  assert.equal(r.I.util, Infinity);
  r = C.run(heb, { ...S355, NEd: 0, MEd: 0 });
  assert.equal(r.I.util, 0);
});

test('klasse 4: (6.44) og ren tryk', () => {
  const tee = C.buildTee({ h: 300, tw: 10, b: 250, tf: 15, a: 4 });
  const u0 = C.run(tee, { ...S355, NEd: 300e3, MEd: 0 }).I.util;
  const uSmall = C.run(tee, { ...S355, NEd: 300e3, MEd: -1 }).I.util; // 1 Nmm
  near(uSmall, u0, 1e-6, 'ingen spring i udnyttelsen, når M → 0');
  // Klasse 1–3 ved N + M men klasse 4 ved ren tryk: udnyttelsen er aldrig under N_Ed/N_c,Rd
  for (const M of [1e6, 20e6, 60e6, 200e6]) {
    const r = C.run(C.buildRolled('IPE', 400), { ...S355, NEd: 1500e3, MEd: M });
    assert.ok(r.I.util >= 1500e3 / r.R.NcRd - 1e-12, `IPE 400, M = ${M / 1e6} kNm`);
  }
  // C-profil: tillægsmoment om z fra e_N,y tages med
  const ch = C.run(C.buildChannel({ h: 360, tw: 10, b: 500, tf: 15, a: 5 }), { ...S355, NEd: 1500e3, MEd: 40e6 });
  assert.ok(ch.effN.eNy < 0, 'A_eff flytter tyngdepunktet ind mod kroppen');
  assert.ok(ch.I.terms.tZ > 0);
  near(ch.I.util, ch.I.terms.tN + ch.I.terms.tM + ch.I.terms.tZ, 1e-12, 'sum af led');
});

test('standardprofilernes mål giver gyldige tværsnit', () => {
  const cat = C.catalog();
  for (const p of cat.rolled) assert.ok(C.buildRolledDims({ name: p.key, ...p.dims }).shapes.length === 1, p.key);
  for (const p of [...cat.SHS, ...cat.RHS]) for (const mfg of ['hot', 'cold']) {
    const [ro] = C.rhsRadii(p.dims.t, mfg);
    assert.ok(2 * ro <= Math.min(p.dims.h, p.dims.b), `${p.key} ${mfg}: hjørneradius for stor`);
  }
  for (const p of cat.L) assert.ok(p.dims.b > p.dims.t + p.dims.r1 && p.dims.r2 <= p.dims.t, p.key);
});
