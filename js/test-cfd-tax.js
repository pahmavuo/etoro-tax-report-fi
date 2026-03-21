/**
 * Test driver: calculateCfdTax
 * Ajo: node js/test-cfd-tax.js
 */

import { readFileSync } from 'fs';
import { parseAccountStatement } from './parser.js';
import { calculateCfdTax } from './tax-calculator.js';
import { fetchEcbRates, getRequiredDateRange } from './ecb-rates.js';

const FILE = 'samples/etoro-account-statement-1-1-2025-12-31-2025.xlsx';
const RATES_FILE_FALLBACK = 'data/ecb-usd-eur-rates.json';

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

    const summary  = calculateCfdTax(closedPositions, ecbRates);

    // --- Tulosta yhteenveto ---
    console.log('=== Verolaskelma: CFD-sopimukset (lomake 7805, suorituslaji 2D) ===\n');
    console.log(`  CFD-positioita yhteensä:        ${summary.totalPositions}`);
    console.log(`  Voitolliset (verotettavat):      ${summary.taxablePositions}`);
    console.log(`  Tappiollliset (ei-vähennettävät):${summary.lossPositions}`);
    console.log(`  Verotettava tulo (voitot):       ${summary.taxableGainEUR.toFixed(2)} €`);
    console.log(`  Arvioitu vero:                   ${summary.estimatedTaxEUR.toFixed(2)} €`);
    console.log(`  Ei-vähennyskelpoinen tappio:     ${summary.nonDeductibleLossesUSD.toFixed(2)} USD (informaatioksi)`);
    console.log('\n  Positiot:');
    summary.positions.forEach(p => {
        const tag = p.isTaxable ? '✓ VOITTO' : '✗ TAPPIO (ei ilmoiteta)';
        console.log(`    [${tag}] ${p.action}`);
        console.log(`      osto ${p.openDate?.slice(0,10)}  →  sulku ${p.closeDate?.slice(0,10)}`);
        console.log(`      vipu x${p.leverage}  |  sijoitus ${p.amountUSD} USD`);
        console.log(`      profitUSD=${p.profitUSD}  EKP=${p.ecbRateClose}  gainEUR=${p.gainEUR} €`);
    });
    console.log('\n  Huomiot:');
    summary.notes.forEach(n => console.log(`    • ${n}`));

    // --- Tarkistukset ---
    console.log('\n=== Tarkistukset ===');

    assert(summary.totalPositions === 3,
        `CFD-positioita 3 (saatiin ${summary.totalPositions})`);

    assert(summary.taxablePositions === 2,
        `Voitollisia 2 (NASDAQ100 + SPX500 Jan) (saatiin ${summary.taxablePositions})`);

    assert(summary.lossPositions === 1,
        `Tappiollisia 1 (SPX500 Apr) (saatiin ${summary.lossPositions})`);

    assert(summary.taxableGainEUR > 0,
        `taxableGainEUR > 0 (${summary.taxableGainEUR})`);

    assert(summary.estimatedTaxEUR > 0,
        `estimatedTaxEUR > 0 (${summary.estimatedTaxEUR})`);

    // Vero on 30 % voitoista (alle 30 000 €)
    const expectedTax = Math.round(summary.taxableGainEUR * 0.30 * 100) / 100;
    assert(Math.abs(summary.estimatedTaxEUR - expectedTax) < 0.10,
        `Vero 30 % voitoista: odotettiin ${expectedTax.toFixed(2)} €, saatiin ${summary.estimatedTaxEUR.toFixed(2)} €`);

    assert(summary.nonDeductibleLossesUSD < 0,
        `nonDeductibleLossesUSD < 0 (tappio) (${summary.nonDeductibleLossesUSD})`);

    // Tappioita ei saa laskea verotettavaan tuloon
    const lossPos = summary.positions.find(p => !p.isTaxable);
    assert(lossPos !== undefined, 'Löytyy vähintään yksi tappiollinen positio');
    assert(lossPos.profitUSD < 0, `Tappiollisen position profitUSD < 0 (${lossPos?.profitUSD})`);

    // Manuaalinen tarkistus:
    // NASDAQ100: closeDate=2025-03-21, profitUSD=16.36, EKP=1.0827 → gainEUR=16.36/1.0827=15.11
    const nasdaq = summary.positions.find(p => p.action.includes('NASDAQ'));
    if (nasdaq) {
        assert(nasdaq.isTaxable, 'NASDAQ100 on verotettava (voitto)');
        assert(Math.abs(nasdaq.ecbRateClose - 1.0827) < 0.001,
            `NASDAQ100 EKP-kurssi 1.0827 (saatiin ${nasdaq.ecbRateClose})`);
        assert(Math.abs(nasdaq.gainEUR - 15.11) < 0.10,
            `NASDAQ100 gainEUR ≈ 15.11 € (saatiin ${nasdaq.gainEUR})`);
    }

    // SPX500 tappio: closeDate=2025-04-10, profitUSD=-63.88 → tappiollinen, ei verotettava
    const spxLoss = summary.positions.find(p => p.action.includes('SPX500') && p.profitUSD < 0);
    if (spxLoss) {
        assert(!spxLoss.isTaxable, 'SPX500 tappio ei ole verotettava');
        assert(spxLoss.gainEUR === 0 || spxLoss.gainEUR < 0,
            `SPX500 tappio: gainEUR ≤ 0 (${spxLoss.gainEUR})`);
    }

    // SPX500 voitto Jan: closeDate=2025-01-24, profitUSD=22.43, EKP=1.0472 → gainEUR≈21.42
    const spxGain = summary.positions.find(p => p.action.includes('SPX500') && p.profitUSD > 0);
    if (spxGain) {
        assert(spxGain.isTaxable, 'SPX500 voitto on verotettava');
        assert(Math.abs(spxGain.gainEUR - 21.42) < 0.20,
            `SPX500 voitto gainEUR ≈ 21.42 € (saatiin ${spxGain.gainEUR})`);
    }

    // Kenttien tyypit
    const p0 = summary.positions[0];
    assert(typeof p0.positionId === 'string',     'position.positionId on string');
    assert(typeof p0.profitUSD === 'number',      'position.profitUSD on numero');
    assert(typeof p0.gainEUR === 'number',        'position.gainEUR on numero');
    assert(typeof p0.ecbRateClose === 'number',   'position.ecbRateClose on numero');
    assert(typeof p0.isTaxable === 'boolean',     'position.isTaxable on boolean');

    console.log(`\n=== Tulos: ${passed} OK, ${failed} FAIL ===\n`);
}

run().catch(err => { console.error('Virhe:', err); process.exit(1); });
