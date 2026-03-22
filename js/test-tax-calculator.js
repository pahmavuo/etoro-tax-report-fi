/**
 * Test driver: tax-calculator.js
 * Ajo: node js/test-tax-calculator.js
 */

import { readFileSync } from 'fs';
import { parseAccountStatement } from './parser.js';
import { calculateStockTax } from './tax-calculator.js';
import { fetchEcbRates, getRequiredDateRange } from './ecb-rates.js';

const FILE = 'samples/etoro-account-statement-1-1-2025-12-31-2025.xlsx';
const RATES_FILE_FALLBACK = 'data/ecb-usd-eur-rates.json';

let passed = 0, failed = 0;

function assert(condition, message, extra = '') {
    if (!condition) {
        console.error(`  FAIL: ${message}${extra ? '  (' + extra + ')' : ''}`);
        failed++;
    } else {
        console.log(`  OK:   ${message}`);
        passed++;
    }
}

async function run() {
    console.log(`\nLuetaan: ${FILE}\n`);

    const buffer = readFileSync(FILE);
    const { closedPositions } = parseAccountStatement(buffer.buffer);

    const range = getRequiredDateRange(closedPositions, []);
    let ecbRates;
    try {
        console.log(`Haetaan EKP-kurssit ${range.startDate} – ${range.endDate}...`);
        ecbRates = await fetchEcbRates(range.startDate, range.endDate);
        console.log(`Haettu ${Object.keys(ecbRates).length} päiväkurssia EKP API:sta.\n`);
    } catch (e) {
        console.warn(`EKP API ei saatavilla (${e.message}) – käytetään lokaalitiedostoa.\n`);
        ecbRates = JSON.parse(readFileSync(RATES_FILE_FALLBACK, 'utf-8')).rates;
    }

    const summary = calculateStockTax(closedPositions, ecbRates);

    // --- Tulosta yhteenveto ---
    console.log('=== Verolaskelma: Osakekaupat (lomake 9A) ===\n');
    console.log(`  Positioita yhteensä:       ${summary.totalPositions}`);
    console.log(`  Voitolliset positiot:       ${summary.gainPositions}`);
    console.log(`  Tappiollliset positiot:     ${summary.lossPositions}`);
    console.log(`  Myyntihinnat yhteensä:      ${summary.totalSalePriceEUR.toFixed(2)} €`);
    console.log(`  Hankintamenot yhteensä:     ${summary.totalAcquisitionEUR.toFixed(2)} €`);
    console.log(`  Voitot yhteensä:            ${summary.totalGainsEUR.toFixed(2)} €`);
    console.log(`  Tappiot yhteensä:           ${summary.totalLossesEUR.toFixed(2)} €`);
    console.log(`  Nettovoitto/-tappio:        ${summary.netGainLossEUR.toFixed(2)} €`);
    console.log(`  Voitot verovapaita:         ${summary.gainExemption ? 'KYLLÄ' : 'EI'}`);
    console.log(`  Tappiot ei-väh.kelp.:       ${summary.lossNonDeductible ? 'KYLLÄ' : 'EI'}`);
    console.log(`  Verotettava tulo:           ${summary.taxableGainEUR.toFixed(2)} €`);
    console.log(`  Vähennyskelpoinen tappio:   ${summary.deductibleLossEUR.toFixed(2)} €`);
    console.log(`  Arvioitu vero:              ${summary.estimatedTaxEUR.toFixed(2)} €`);
    console.log('\n  Huomiot:');
    summary.notes.forEach(n => console.log(`    • ${n}`));

    // --- Esimerkkirivejä ---
    console.log('\n=== Esimerkkipositioita ===');
    summary.positions.slice(0, 3).forEach(p => {
        console.log(`  ${p.action}`);
        console.log(`    osto ${p.openDate?.slice(0,10)}  EKP=${p.ecbRateOpen}  hankinta=${p.acquisitionCostEUR} €`);
        console.log(`    myynti ${p.closeDate?.slice(0,10)}  EKP=${p.ecbRateClose}  myyntihinta=${p.salePriceEUR} €`);
        console.log(`    voitto/tappio: ${p.gainLossEUR} €`);
    });

    // --- Tarkistukset ---
    console.log('\n=== Tarkistukset ===');

    assert(summary.totalPositions === 254,
        `Stocks-positioita 254 (saatiin ${summary.totalPositions})`);

    assert(Array.isArray(summary.positions) && summary.positions.length === 254,
        'positions.length === 254');

    assert(typeof summary.totalSalePriceEUR === 'number' && summary.totalSalePriceEUR > 0,
        `totalSalePriceEUR > 0 (${summary.totalSalePriceEUR})`);

    assert(typeof summary.netGainLossEUR === 'number',
        'netGainLossEUR on numero');

    assert(
        Math.abs(summary.totalGainsEUR + summary.totalLossesEUR - summary.netGainLossEUR) < 0.05,
        `netGainLossEUR = gains + losses`
    );

    assert(summary.totalGainsEUR >= 0,  `totalGainsEUR >= 0 (${summary.totalGainsEUR})`);
    assert(summary.totalLossesEUR <= 0, `totalLossesEUR <= 0 (${summary.totalLossesEUR})`);
    assert(summary.estimatedTaxEUR >= 0, `estimatedTaxEUR >= 0 (${summary.estimatedTaxEUR})`);

    assert(typeof summary.gainExemption === 'boolean',     'gainExemption on boolean');
    assert(typeof summary.lossNonDeductible === 'boolean', 'lossNonDeductible on boolean');

    if (summary.gainExemption) {
        assert(summary.taxableGainEUR === 0,    'gainExemption → taxableGainEUR === 0');
    }
    if (summary.lossNonDeductible) {
        assert(summary.deductibleLossEUR === 0, 'lossNonDeductible → deductibleLossEUR === 0');
    }

    // Verolaskennan oikeellisuus alle 30 000 €:n voitoilla
    if (!summary.gainExemption && summary.taxableGainEUR > 0 && summary.taxableGainEUR <= 30_000) {
        const expectedTax = Math.round(summary.taxableGainEUR * 0.30 * 100) / 100;
        assert(Math.abs(summary.estimatedTaxEUR - expectedTax) < 0.10,
            `Vero 30 % voitoista: odotettiin ${expectedTax.toFixed(2)} €, saatiin ${summary.estimatedTaxEUR.toFixed(2)} €`);
    }

    // Positioiden kentät
    const p0 = summary.positions[0];
    assert(typeof p0.positionId === 'string',          'position.positionId on string');
    assert(typeof p0.gainLossEUR === 'number',         'position.gainLossEUR on numero');
    assert(typeof p0.salePriceEUR === 'number',        'position.salePriceEUR on numero');
    assert(typeof p0.acquisitionCostEUR === 'number',  'position.acquisitionCostEUR on numero');
    assert(typeof p0.ecbRateOpen === 'number',         `position.ecbRateOpen on numero (${p0.ecbRateOpen})`);
    assert(typeof p0.ecbRateClose === 'number',        `position.ecbRateClose on numero (${p0.ecbRateClose})`);

    // EKP-kurssien järkevyystarkistus (2024-2025 välillä USD/EUR noin 1.00–1.15)
    const allRatesValid = summary.positions.every(p =>
        p.ecbRateOpen > 0.95 && p.ecbRateOpen < 1.20 &&
        p.ecbRateClose > 0.95 && p.ecbRateClose < 1.20
    );
    assert(allRatesValid, 'Kaikilla positioilla EKP-kurssit välillä 0.95–1.20 (USD/EUR sanity check)');

    // Manuaalinen tarkistus: Sodexo ensimmäinen positio
    // openDate=2025-03-24, EKP=1.0824, amount=1.97 USD → hankinta=1.97/1.0824=1.82 EUR
    // closeDate=2025-04-22, EKP=1.1476, saleUSD=1.97-0.08=1.89 → myynti=1.89/1.1476=1.65 EUR
    const sodexo = summary.positions.find(p => p.action === 'Sodexo SA (SW.PA)');
    if (sodexo) {
        assert(Math.abs(sodexo.ecbRateOpen - 1.0824) < 0.001,
            `Sodexo EKP osto-kurssi 1.0824 (saatiin ${sodexo.ecbRateOpen})`);
        assert(Math.abs(sodexo.ecbRateClose - 1.1476) < 0.001,
            `Sodexo EKP myynti-kurssi 1.1476 (saatiin ${sodexo.ecbRateClose})`);
        assert(Math.abs(sodexo.acquisitionCostEUR - 1.82) < 0.02,
            `Sodexo hankintameno ≈ 1.82 € (saatiin ${sodexo.acquisitionCostEUR})`);
        assert(Math.abs(sodexo.salePriceEUR - 1.65) < 0.02,
            `Sodexo myyntihinta ≈ 1.65 € (saatiin ${sodexo.salePriceEUR})`);
        assert(sodexo.gainLossEUR < 0,
            `Sodexo on tappiollinen (${sodexo.gainLossEUR} €)`);
    }

    // --- Lopputulos ---
    console.log(`\n=== Tulos: ${passed} OK, ${failed} FAIL ===\n`);
}

run().catch(err => { console.error('Virhe:', err); process.exit(1); });
