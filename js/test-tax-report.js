/**
 * Test driver: generateTaxReport
 * Ajo: node js/test-tax-report.js
 */

import { readFileSync } from 'fs';
import { parseAccountStatement } from './parser.js';
import { generateTaxReport } from './tax-calculator.js';

const FILE       = 'samples/etoro-account-statement-1-1-2025-12-31-2025.xlsx';
const RATES_FILE = 'data/ecb-usd-eur-rates.json';

let passed = 0, failed = 0;

function assert(condition, message) {
    if (!condition) { console.error(`  FAIL: ${message}`); failed++; }
    else            { console.log(`  OK:   ${message}`);   passed++; }
}

function run() {
    console.log(`\nLuetaan: ${FILE}\n`);

    const buffer   = readFileSync(FILE);
    const { closedPositions, dividends } = parseAccountStatement(buffer.buffer);
    const ecbRates = JSON.parse(readFileSync(RATES_FILE, 'utf-8')).rates;

    const report = generateTaxReport(closedPositions, dividends, ecbRates);

    // ── Tulosta raportti ────────────────────────────────────────────────────
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log(`║  eToro VEROILMOITUS – Verovuosi ${report.verovuosi}                      ║`);
    console.log(`║  Generoitu: ${report.generoitu}                                     ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // Lomake 9A
    const a = report.lomake9A;
    console.log('\n── LOMAKE 9A: Arvopaperien luovutusvoitot ja -tappiot ──────────');
    if (!a.ilmoitettava) {
        console.log(`  ⚠  EI ILMOITETA: ${a.eiIlmoitetaSyy}`);
    } else {
        console.log(`  Myyntihinnat yhteensä:    ${a.myyntihinnatYhteensaEUR.toFixed(2)} €`);
        console.log(`  Hankintamenot yhteensä:   ${a.hankintamenotYhteensaEUR.toFixed(2)} €`);
        console.log(`  Voitot yhteensä:          ${a.voitotYhteensaEUR.toFixed(2)} €`);
        console.log(`  Tappiot yhteensä:         ${a.tappiotYhteensaEUR.toFixed(2)} €`);
        console.log(`  Verotettava tulo:         ${a.verotettavaTuloEUR.toFixed(2)} €`);
        console.log(`  Vähennyskelp. tappio:     ${a.vahennyskelponenTappioEUR.toFixed(2)} €`);
    }

    // Lomake 7805
    const c = report.lomake7805;
    console.log('\n── LOMAKE 7805: CFD-sopimukset (suorituslaji 2D) ───────────────');
    if (!c.ilmoitettava) {
        console.log('  ⚠  EI ILMOITETA: ei voitollisia CFD-positioita');
    } else {
        console.log(`  Verotettava tulo:         ${c.verotettavaYhteensaEUR.toFixed(2)} €`);
        console.log(`  Arvioitu vero (30 %):     ${c.arvioistuVeroEUR.toFixed(2)} €`);
        c.voitollisetPositiot.forEach(p =>
            console.log(`    + ${p.action.slice(0,35).padEnd(35)} ${p.gainEUR.toFixed(2)} €`)
        );
        c.tappiollisetPositiot.forEach(p =>
            console.log(`    ✗ ${p.action.slice(0,35).padEnd(35)} ${p.gainEUR.toFixed(2)} € (ei ilmoiteta)`)
        );
    }

    // Lomake 16B
    const d = report.lomake16B;
    console.log('\n── LOMAKE 16B: Ulkomaiset pääomatulot – osingot ────────────────');
    if (!d.ilmoitettava) {
        console.log('  ⚠  EI ILMOITETA: ei osinkoja');
    } else {
        d.yhtioriviit.forEach(r =>
            console.log(`  ${r.yhtiöNimi.slice(0,28).padEnd(28)} ${r.lahtömaa.padEnd(16)} brutto=${r.bruttoOsinkoEUR.toFixed(4)} €  lähdevero=${r.ulkomainenLahdevero.toFixed(4)} €  lisävero=${r.maksettavaLisaveroEUR.toFixed(4)} €`)
        );
        console.log(`  ${'YHTEENSÄ'.padEnd(46)} brutto=${d.bruttoYhteensaEUR.toFixed(4)} €  lähdevero=${d.lahdeveroYhteensaEUR.toFixed(4)} €  lisävero=${d.lisaveroYhteensaEUR.toFixed(4)} €`);
    }

    // Yhteenveto
    const y = report.yhteenveto;
    console.log('\n── YHTEENVETO ──────────────────────────────────────────────────');
    console.log(`  Osakkeet – verotettava tulo:   ${y.osakkeetVeiotettavaTuloEUR.toFixed(2)} €`);
    console.log(`  CFD      – verotettava tulo:   ${y.cfdVeiotettavaTuloEUR.toFixed(2)} €`);
    console.log(`  Osingot  – verotettava tulo:   ${y.osinkoVeiotettavaTuloEUR.toFixed(2)} €`);
    console.log(`  ─────────────────────────────────────────────`);
    console.log(`  Verotettava tulo yhteensä:     ${y.verotettavaYhteensaEUR.toFixed(2)} €`);
    console.log(`  Arvioitu vero (30/34 %):       ${y.arvioistuKokonaisVeroEUR.toFixed(2)} €`);
    console.log(`  Lähdeveron hyvitys:           -${y.lahdeveroHyvitysEUR.toFixed(2)} €`);
    console.log(`  Maksettava vero yhteensä:      ${y.maksettavaVeroEUR.toFixed(2)} €`);
    if (y.vahennyskelponenTappioEUR < 0) {
        console.log(`  Vähennyskelp. tappio (5 v):   ${y.vahennyskelponenTappioEUR.toFixed(2)} €`);
    }
    console.log('\n  Täytettävät lomakkeet:');
    if (y.lomakkeet.length === 0) {
        console.log('    – Ei täytettäviä lomakkeita');
    } else {
        y.lomakkeet.forEach(l =>
            console.log(`    ✓ Lomake ${l.lomake}: ${l.kuvaus} (${l.ilmoitettavaTuloEUR.toFixed(2)} €)`)
        );
    }
    console.log('\n  Huomiot:');
    [...new Set(y.huomiot)].forEach(n => console.log(`    • ${n}`));

    // ── Tarkistukset ────────────────────────────────────────────────────────
    console.log('\n=== Tarkistukset ===');

    assert(report.verovuosi === 2025, `verovuosi = 2025 (saatiin ${report.verovuosi})`);
    assert(typeof report.generoitu === 'string' && report.generoitu.match(/^\d{4}-\d{2}-\d{2}$/),
        `generoitu on ISO-päivämäärä (${report.generoitu})`);

    // Lomake 9A
    assert(typeof a.ilmoitettava === 'boolean', 'lomake9A.ilmoitettava on boolean');
    assert(a.ilmoitettava === false, 'lomake9A ei ilmoiteta (pienten myyntien vapautus)');
    assert(a.eiIlmoitetaSyy !== null, 'lomake9A.eiIlmoitetaSyy on asetettu');
    assert(Array.isArray(a.positiot) && a.positiot.length === 254, 'lomake9A.positiot.length === 254');

    // Lomake 7805
    assert(typeof c.ilmoitettava === 'boolean', 'lomake7805.ilmoitettava on boolean');
    assert(c.ilmoitettava === true, 'lomake7805 ilmoitetaan (on voittoja)');
    assert(c.verotettavaYhteensaEUR > 0, `lomake7805.verotettavaYhteensaEUR > 0 (${c.verotettavaYhteensaEUR})`);
    assert(c.voitollisetPositiot.length === 2, `voitollisetPositiot.length === 2 (${c.voitollisetPositiot.length})`);
    assert(c.tappiollisetPositiot.length === 1, `tappiollisetPositiot.length === 1 (${c.tappiollisetPositiot.length})`);

    // Lomake 16B
    assert(typeof d.ilmoitettava === 'boolean', 'lomake16B.ilmoitettava on boolean');
    assert(d.ilmoitettava === true, 'lomake16B ilmoitetaan (on osinkoja)');
    assert(d.yhtioriviit.length === 9, `lomake16B.yhtioriviit.length === 9 (${d.yhtioriviit.length})`);
    assert(d.yhtioriviit.every(r => r.lahtömaa && r.bruttoOsinkoEUR >= 0),
        'Kaikilla osinkyriveillä on lähtömaa ja bruttomäärä');

    // Yhteenveto
    assert(y.verotettavaYhteensaEUR >= 0, `verotettavaYhteensaEUR >= 0 (${y.verotettavaYhteensaEUR})`);
    assert(y.arvioistuKokonaisVeroEUR >= 0, `arvioistuKokonaisVeroEUR >= 0 (${y.arvioistuKokonaisVeroEUR})`);
    assert(y.maksettavaVeroEUR >= 0, `maksettavaVeroEUR >= 0 (${y.maksettavaVeroEUR})`);
    assert(Array.isArray(y.lomakkeet), 'lomakkeet on taulukko');
    assert(y.lomakkeet.some(l => l.lomake === '7805'), 'lomakkeet sisältää 7805');
    assert(y.lomakkeet.some(l => l.lomake === '16B'), 'lomakkeet sisältää 16B');
    assert(!y.lomakkeet.some(l => l.lomake === '9A'), 'lomakkeet EI sisällä 9A (vapautus)');

    // Verolaskennan konsistenssi
    const expectedTotal = round2(y.osakkeetVeiotettavaTuloEUR + y.cfdVeiotettavaTuloEUR + y.osinkoVeiotettavaTuloEUR);
    assert(Math.abs(y.verotettavaYhteensaEUR - expectedTotal) < 0.05,
        `verotettavaYhteensaEUR = osakkeet + cfd + osingot (${y.verotettavaYhteensaEUR} ≈ ${expectedTotal})`);

    assert(Math.abs(y.maksettavaVeroEUR - (y.arvioistuKokonaisVeroEUR - y.lahdeveroHyvitysEUR)) < 0.05,
        `maksettavaVero = kokonaisVero - hyvitys`);

    console.log(`\n=== Tulos: ${passed} OK, ${failed} FAIL ===\n`);
}

function round2(n) { return Math.round(n * 100) / 100; }

run();
