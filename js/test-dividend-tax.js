/**
 * Test driver: calculateDividendTax
 * Ajo: node js/test-dividend-tax.js
 */

import { readFileSync } from 'fs';
import { parseAccountStatement } from './parser.js';
import { calculateDividendTax } from './tax-calculator.js';

const FILE       = 'samples/etoro-account-statement-1-1-2025-12-31-2025.xlsx';
const RATES_FILE = 'data/ecb-usd-eur-rates.json';

let passed = 0, failed = 0;

function assert(condition, message) {
    if (!condition) {
        console.error(`  FAIL: ${message}`);
        failed++;
    } else {
        console.log(`  OK:   ${message}`);
        passed++;
    }
}

function run() {
    console.log(`\nLuetaan: ${FILE}`);
    console.log(`Kurssit:  ${RATES_FILE}\n`);

    const buffer  = readFileSync(FILE);
    const { dividends } = parseAccountStatement(buffer.buffer);
    const ecbRates = JSON.parse(readFileSync(RATES_FILE, 'utf-8')).rates;
    const summary  = calculateDividendTax(dividends, ecbRates);

    // --- Tulosta yhteenveto ---
    console.log('=== Verolaskelma: Osingot (lomake 16B) ===\n');
    console.log(`  Osinkorivejä yhteensä:      ${summary.totalRows}`);
    console.log(`  Yhtiöitä:                   ${summary.totalCompanies}`);
    console.log(`  Brutto-osingot yhteensä:    ${summary.totalGrossEUR.toFixed(4)} €`);
    console.log(`  Veronalainen osuus (85 %):  ${summary.totalTaxableEUR.toFixed(4)} €`);
    console.log(`  Verovapaa osuus (15 %):     ${summary.totalTaxFreeEUR.toFixed(4)} €`);
    console.log(`  Lähdevero yhteensä:         ${summary.totalWithholdingEUR.toFixed(4)} €`);
    console.log(`  Suomen vero (30 % × 85 %):  ${summary.totalFinnishTaxEUR.toFixed(4)} €`);
    console.log(`  Lähdeveron hyvitys:         ${summary.totalCreditEUR.toFixed(4)} €`);
    console.log(`  Maksettava lisävero:        ${summary.totalAdditionalTaxEUR.toFixed(4)} €`);

    console.log('\n  Lomake 16B – yhtiöittäin:');
    const h = (s, w) => s.padEnd(w);
    console.log('  ' + [h('Yhtiö',28), h('Maa',4), h('LV%',6), h('Brutto €',10), h('Veronalainen €',15), h('LV €',10), h('FI-vero €',10), h('Hyvitys €',10), h('Lisävero €',10)].join(' '));
    summary.byCompany.forEach(c => {
        console.log('  ' + [
            h(c.instrumentName.slice(0,28), 28),
            h(c.country, 4),
            h(c.withholdingRatePct + '%', 6),
            h(c.grossEUR.toFixed(4), 10),
            h(c.taxableEUR.toFixed(4), 15),
            h(c.withholdingTaxEUR.toFixed(4), 10),
            h(c.finnishTaxEUR.toFixed(4), 10),
            h(c.withholdingCreditEUR.toFixed(4), 10),
            h(c.additionalTaxEUR.toFixed(4), 10),
        ].join(' '));
    });

    console.log('\n  Huomiot:');
    summary.notes.forEach(n => console.log(`    • ${n}`));

    // --- Tarkistukset ---
    console.log('\n=== Tarkistukset ===');

    assert(summary.totalRows === 76,
        `Osinkorivejä 76 (saatiin ${summary.totalRows})`);

    assert(summary.totalCompanies === 9,
        `Yhtiöitä 9 (saatiin ${summary.totalCompanies})`);

    assert(summary.totalGrossEUR > 0,
        `totalGrossEUR > 0 (${summary.totalGrossEUR})`);

    // 85 % + 15 % = 100 %
    assert(
        Math.abs(summary.totalTaxableEUR + summary.totalTaxFreeEUR - summary.totalGrossEUR) < 0.01,
        `taxable (${summary.totalTaxableEUR}) + tax-free (${summary.totalTaxFreeEUR}) = gross (${summary.totalGrossEUR})`
    );

    // Lähdeveron hyvitys ≤ Suomen vero
    assert(summary.totalCreditEUR <= summary.totalFinnishTaxEUR + 0.01,
        `Lähdeveron hyvitys (${summary.totalCreditEUR}) ≤ Suomen vero (${summary.totalFinnishTaxEUR})`
    );

    // Lisävero = Suomen vero - hyvitys
    assert(
        Math.abs(summary.totalFinnishTaxEUR - summary.totalCreditEUR - summary.totalAdditionalTaxEUR) < 0.01,
        `additionalTax = finnishTax - credit`
    );

    // Kaikki yhtiöt löytyvät
    const names = summary.byCompany.map(c => c.instrumentName);
    assert(names.some(n => n.includes('Nordea')),       'Nordea löytyy');
    assert(names.some(n => n.includes('Land Securities')), 'Land Securities löytyy');
    assert(names.some(n => n.includes('Enel')),         'Enel löytyy');
    assert(names.some(n => n.includes('Aalberts')),     'Aalberts NV löytyy');

    // Manuaalinen tarkistus: Nordea, 35% lähdevero, 8 riviä
    const nordea = summary.byCompany.find(c => c.instrumentName.includes('Nordea'));
    assert(nordea !== undefined, 'Nordea löytyy byCompany:sta');
    if (nordea) {
        assert(nordea.country === 'FI',             `Nordea maa=FI (saatiin ${nordea.country})`);
        assert(nordea.rowCount === 8,               `Nordea rowCount=8 (saatiin ${nordea.rowCount})`);
        assert(nordea.withholdingRatePct === 35,    `Nordea lähdevero 35 % (saatiin ${nordea.withholdingRatePct})`);
        assert(nordea.grossEUR > 0,                 `Nordea grossEUR > 0 (${nordea.grossEUR})`);
        assert(nordea.taxableEUR < nordea.grossEUR, `Nordea taxableEUR < grossEUR (85 %-sääntö)`);
        // Nordealla lähdevero (35%) > Suomen vero (30% × 85% = 25.5%) → hyvitys = Suomen vero, lisävero = 0
        assert(nordea.additionalTaxEUR === 0,
            `Nordea: lähdevero kattaa Suomen veron → lisävero = 0 (${nordea.additionalTaxEUR})`);
        assert(Math.abs(nordea.withholdingCreditEUR - nordea.finnishTaxEUR) < 0.01,
            `Nordea: hyvitys = Suomen vero (${nordea.withholdingCreditEUR} ≈ ${nordea.finnishTaxEUR})`);
    }

    // Tarkistus: 0 % lähdevero → koko Suomen vero jää maksettavaksi
    const sse = summary.byCompany.find(c => c.instrumentName.includes('SSE'));
    if (sse) {
        assert(sse.withholdingTaxEUR === 0,        `SSE: ei lähdeveroa (${sse.withholdingTaxEUR})`);
        assert(sse.withholdingCreditEUR === 0,     `SSE: ei hyvitystä (${sse.withholdingCreditEUR})`);
        assert(sse.additionalTaxEUR === sse.finnishTaxEUR,
            `SSE: koko Suomen vero maksettava (${sse.additionalTaxEUR})`);
    }

    // Kenttien tyypit
    const c0 = summary.byCompany[0];
    assert(typeof c0.grossEUR === 'number',          'byCompany[0].grossEUR on numero');
    assert(typeof c0.taxableEUR === 'number',        'byCompany[0].taxableEUR on numero');
    assert(typeof c0.finnishTaxEUR === 'number',     'byCompany[0].finnishTaxEUR on numero');
    assert(typeof c0.additionalTaxEUR === 'number',  'byCompany[0].additionalTaxEUR on numero');
    assert(Array.isArray(c0.paymentDates),           'byCompany[0].paymentDates on taulukko');

    // EKP-kurssi parsitaan oikein (paymentDate on "YYYY-MM-DD" -muodossa)
    const firstRow = summary.rows[0];
    assert(firstRow.paymentDate !== null && firstRow.paymentDate.match(/^\d{4}-\d{2}-\d{2}$/),
        `paymentDate ISO-muodossa: ${firstRow.paymentDate}`);
    assert(typeof firstRow.ecbRate === 'number' && firstRow.ecbRate > 0,
        `ecbRate löytyy: ${firstRow.ecbRate}`);

    console.log(`\n=== Tulos: ${passed} OK, ${failed} FAIL ===\n`);
}

run();
