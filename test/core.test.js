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

test('valsede U-profiler og T-profiler udskåret af I-profiler', () => {
  const cat = C.catalog(), U = k => cat.U.find(p => p.key === k).dims;
  let G = C.run(C.buildRolledChannel(U('UPE 200')), { ...S355, NEd: 0, MEd: 0 }).G;
  near(G.A, 2900, 0.005, 'UPE 200 A'); near(G.Iy, 1910e4, 0.005, 'UPE 200 Iy'); near(G.Iz, 187e4, 0.01, 'UPE 200 Iz');
  G = C.run(C.buildRolledChannel(U('UPN 200')), { ...S355, NEd: 0, MEd: 0 }).G;
  near(G.A, 3220, 0.01, 'UPN 200 A'); near(G.Iy, 1910e4, 0.01, 'UPN 200 Iy'); near(G.Iz, 148e4, 0.03, 'UPN 200 Iz');
  near(G.yc + 75 / 2, 20.1, 0.03, 'UPN 200 tyngdepunkt fra ryg');
  const half = C.run(C.buildRolledTee(cat.T.find(p => p.key === '½ IPE 400').dims), { ...S355, NEd: 0, MEd: 0 }).G;
  near(2 * half.A, C.run(C.buildRolled('IPE', 400), { ...S355, NEd: 0, MEd: 0 }).G.A, 1e-9, '2 × ½ IPE 400 = IPE 400');
  // Huller i det effektive tværsnit følger de hældende flanger: A_eff = A − skraveret areal
  const r = C.run(C.buildRolledChannel({ h: 400, b: 160, tw: 6, tf: 10, r1: 10, r2: 5, sl: 8 }), { ...S355, NEd: 500e3, MEd: 0 });
  const area = p => Math.abs(p.reduce((a, q, i) => { const n = p[(i + 1) % p.length]; return a + q[0] * n[1] - n[0] * q[1]; }, 0) / 2);
  near(r.effN.A, r.G.A - r.effN.holes.reduce((a, p) => a + area(p), 0), 1e-9, 'A_eff');
});

test('forskydning efter 6.2.6 og 6.2.8', () => {
  const ipe = C.buildRolled('IPE', 400);
  let r = C.run(ipe, { ...S355, NEd: 0, MEd: 300e6, VEd: 600e3 });
  near(r.R.V.Av, 4269, 0.002, 'A_v IPE 400'); near(r.R.V.VplRd, 4269 * 355 / 1.1 / Math.sqrt(3), 0.002, 'V_pl,Rd');
  near(r.R.V.rho, 0.258, 0.01, 'ρ'); near(r.I.terms.MplV, 397e6, 0.003, 'M_y,V,Rd (6.30)');
  near(r.I.util, 300e6 / r.I.terms.MplV, 1e-9, 'udnyttelse');
  // V ≤ 0,5·V_pl,Rd påvirker ikke momentbæreevnen
  const u0 = C.run(ipe, { ...S355, NEd: 0, MEd: 300e6 }).I.util;
  assert.equal(C.run(ipe, { ...S355, NEd: 0, MEd: 300e6, VEd: 0.5 * r.R.V.VplRd }).I.util, u0);
  // Klasse 4: kroppen kontrolleres mod (1 − ρ)f_y, flangerne mod f_y
  r = C.run(ipe, { ...S355, NEd: 1500e3, MEd: 40e6, VEd: 700e3 });
  const T = r.I.terms;
  assert.ok(T.webV > T.sum && T.kY < 1);
  near(T.webV, (T.tN + T.tM * T.kY) / (1 - T.rho), 1e-12, 'kropsled');
  // Forskydningsbuling markeres for slanke kroppe
  assert.equal(C.run(C.buildWelded({ h: 1000, tw: 8, bt: 300, tft: 20, bb: 300, tfb: 20, a: 5 }), { ...S355, NEd: 0, MEd: 0, VEd: 100e3 }).R.V.buckling, true);
});

test('bøjning om z-aksen (M_z,Ed)', () => {
  // HEB 300, N = 1000 kN, M_y = 150 kNm, M_z = 60 kNm (håndregning)
  const r = C.run(C.buildRolled('HEB', 300), { ...S355, NEd: 1000e3, MEd: 150e6, MzEd: 60e6 }), T = r.I.terms;
  assert.match(r.I.method, /6\.41/);
  near(T.MNRd, 541.4e6, 0.002, 'M_N,y,Rd'); near(T.MNz, 280.8e6, 0.002, 'M_N,z,Rd'); near(T.ey, 5 * T.n, 1e-12, 'β = 5n');
  near((150e6 / (T.mu * T.MNRd)) ** 2 + (60e6 / (T.mu * T.MNz)) ** T.ey, 1, 1e-9, '(6.41) ved μ');
  // Ingen spring, når M_z → 0
  const ipe = C.buildRolled('IPE', 400);
  near(C.run(ipe, { ...S355, NEd: 300e3, MEd: 100e6, MzEd: 1e3 }).I.util, C.run(ipe, { ...S355, NEd: 300e3, MEd: 100e6 }).I.util, 1e-4, 'M_z → 0 (β ≈ 1 giver et lineært bidrag fra M_z = 1 Nm)');
  // Ren M_z: I-kroppen ligger i nullinjen og har intet membrantryk
  const z = C.run(ipe, { ...S355, NEd: 0, MEd: 0, MzEd: 20e6 });
  assert.equal(z.cC.els.find(e => e.el.id === 'web').lims, null);
  near(z.I.util, 20e6 / (z.G.Wplz * z.fyd), 1e-9, 'M_z/M_pl,z');
  // Kvadratisk SHS: W_eff,z ved ren M_z = W_eff,y ved ren M_y
  const shs = C.buildRHS({ h: 200, b: 200, t: 5, mfg: 'cold' });
  near(C.run(shs, { ...S355, NEd: 0, MEd: 0, MzEd: 30e6 }).effZ.Wmin, C.run(shs, { ...S355, NEd: 0, MEd: 30e6 }).effMp.Wmin, 1e-6, 'W_eff,z = W_eff,y');
  // CHS: det resulterende moment
  const chs = C.buildCHS({ d: 219.1, t: 10 });
  near(C.run(chs, { ...S355, NEd: 500e3, MEd: 30e6, MzEd: 40e6 }).I.util, C.run(chs, { ...S355, NEd: 500e3, MEd: 50e6 }).I.util, 1e-9, 'CHS √(My² + Mz²)');
  // M_z ignoreres for T-profiler (og usymmetriske I- og L-profiler)
  assert.equal(C.supportsMz(C.buildTee({ h: 300, tw: 10, b: 250, tf: 15, a: 4 })), false);
});

test('C/U-profiler i klasse 4: M_z,Ed lægges sammen med ΔM_z = N_Ed·|e_N,y| i (6.44)', () => {
  // Svejst C 360×10 / 500×15, S355, N = 718 kN, M_y = 77 kNm (håndregning: 0,226 + 0,177 + 0,327 = 0,730)
  const ch = C.buildChannel({ h: 360, tw: 10, b: 500, tf: 15, a: 0 }), L = { ...S355, NEd: 718e3, MEd: 77e6 }, fyd = 355 / 1.1;
  assert.equal(C.supportsMz(ch), true);
  const r0 = C.run(ch, L), T0 = r0.I.terms;
  near(r0.I.util, 0.7304, 0.001, 'udnyttelse uden M_z');
  near(T0.dMz, 94.73e6, 0.001, 'ΔM_z'); near(T0.Weffz, 898.44e3, 0.001, 'W_eff,z med tryk i flangespidserne');
  near(C.run(ch, { ...L, MzEd: 1e3 }).I.util, r0.I.util, 1e-5, 'ingen spring, når M_z → 0');
  // + = tryk i flangespidserne: lægges til ΔM_z
  const Tp = C.run(ch, { ...L, MzEd: 30e6 }).I.terms;
  near(Tp.MzT, 124.73e6, 0.001, 'M_z,Ed + ΔM_z'); near(Tp.tZ, 124.73e6 / (898.44e3 * fyd), 0.001, 'z-leddet');
  assert.ok(C.run(ch, { ...L, MzEd: -T0.dMz }).I.terms.tZ < 1e-9, 'M_z,Ed = −ΔM_z ophæver tillægsmomentet');
  // − = tryk ved kroppen: flangerne har træk i spidsen (ψ < −1, k_σ = 23,8) og kroppen er klasse 3, så W = W_el,z
  const rn = C.run(ch, { ...L, MzEd: -150e6 }), Tn = rn.I.terms;
  assert.equal(rn.cMz.cls, 3); assert.equal(Tn.zSrc, 'el');
  near(Tn.Weffz, rn.G.Iz / 294.18, 0.001, 'W_el,z til flangespidsen'); near(Tn.tZ, (150e6 - 94.73e6) / (Tn.Weffz * fyd), 0.001, 'z-leddet');
  // Ren bøjning om z med tryk i spidserne: samme W_eff,z som tillægsmomentet bruger
  near(C.run(ch, { ...S355, NEd: 0, MEd: 0, MzEd: 50e6 }).effZ.Wmin, 898.44e3, 0.001, 'W_eff,z ved ren M_z');
  // Valgfri regel: W_z fra det effektive tværsnit ved ren tryk (flangespids 217,5 mm fra ryg, I_z = 49,34·10⁶ mm⁴)
  const rw = C.run(ch, { ...L, wzN: true });
  assert.equal(rw.I.terms.zSrc, 'N'); near(rw.I.terms.Weffz, 343.6e3, 0.002, 'W_z fra A_eff-tværsnittet');
  near(rw.I.util, 0.226 + 0.177 + 94.73e6 / (343.6e3 * fyd), 0.003, 'udnyttelse med den valgfri regel');
  // Den valgfri regel bruges kun, når den giver et mindre W
  assert.equal(C.run(ch, { ...L, MzEd: -150e6, wzN: true }).I.terms.zSrc, 'N');
  near(C.run(C.buildChannel({ h: 300, tw: 8, b: 120, tf: 10, a: 4 }), { ...S355, NEd: 300e3, MEd: 20e6, wzN: true }).I.util,
    C.run(C.buildChannel({ h: 300, tw: 8, b: 120, tf: 10, a: 4 }), { ...S355, NEd: 300e3, MEd: 20e6 }).I.util, 1e-12, 'ingen klasse 4: reglen virker ikke');
});

test('C/U-profiler i klasse 1–2: plastisk spændingsblok med skrå nullinje', () => {
  const U = C.catalog().U.find(p => p.key === 'UPE 200').dims, upe = C.buildRolledChannel(U);
  let r = C.run(upe, { ...S355, NEd: 0, MEd: 30e6 });
  assert.ok(r.cC.cls <= 2); near(r.I.util, 30e6 / (r.G.Wpl * r.fyd), 1e-4, 'ren M_y = M_y/M_pl,y');
  for (const Mz of [5e6, -5e6]) { r = C.run(upe, { ...S355, NEd: 0, MEd: 0, MzEd: Mz }); near(r.I.util, 5e6 / (r.G.Wplz * r.fyd), 1e-4, `ren M_z = ${Mz / 1e6} kNm`); }
  // Med N: blokkens moment har ingen z-komposant, når M_z,Ed = 0, og der er intet spring, når M_z → 0
  r = C.run(upe, { ...S355, NEd: 100e3, MEd: 20e6 });
  assert.ok(Math.abs(r.I.terms.MRz) < 1e-6 * r.I.terms.MRy, 'M_N,z,Rd = 0');
  near(C.run(upe, { ...S355, NEd: 100e3, MEd: 20e6, MzEd: 1e3 }).I.util, r.I.util, 1e-4, 'M_z → 0');
  near(C.run(upe, { ...S355, NEd: 100e3, MEd: -20e6 }).I.util, r.I.util, 1e-6, 'symmetri om y-aksen');
  // Samme klasse i serieoversigten som i hovedberegningen
  assert.equal(C.combinedClass(upe, { ...S355, NEd: 100e3, MEd: 20e6, MzEd: 5e6 }), C.run(upe, { ...S355, NEd: 100e3, MEd: 20e6, MzEd: 5e6 }).cC.cls);
});

test('reduceret slankhed (5.5.2(9)) og effektiv klasse 2 (6.2.2.4)', () => {
  const ipe = C.buildRolled('IPE', 400);
  let r = C.run(ipe, { ...S355, NEd: 300e3, MEd: 0, redSl: true });
  assert.equal(r.cC.cls, 3); assert.equal(r.cC.reduced, true); near(r.I.util, 300e3 / r.G.A / r.fyd, 1e-9, 'elastisk');
  assert.equal(C.run(ipe, { ...S355, NEd: 2500e3, MEd: 0, redSl: true }).cC.cls, 4); // σ for høj
  assert.equal(C.run(ipe, { ...S355, NEd: 300e3, MEd: 0 }).cC.cls, 4);                 // kun når valgt
  // Svejst I 1000×10 / 300×20, ren bøjning (håndregning): z_pl = 345,4 mm, M_pl,eff = 7,442·10⁶ mm³ · f_y/γ_M0
  const w = C.buildWelded({ h: 1000, tw: 10, bt: 300, tft: 20, bb: 300, tfb: 20, a: 0 });
  r = C.run(w, { ...S355, NEd: 0, MEd: 2000e6, effCl2: true });
  assert.equal(r.cM.cls, 3); near(r.R.eff2.zp, 345.4, 0.001, 'z_pl'); near(r.R.McRd, 7.4419e6 * 355 / 1.1, 0.001, 'M_c,Rd');
  assert.match(r.I.method, /6\.2\.2\.4/); near(r.I.util, 2000e6 / r.R.McRd, 0.001, 'udnyttelse');
});
