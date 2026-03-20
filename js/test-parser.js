/**
 * Test driver: parser.js
 * Ajo: node js/test-parser.js
 */

import { readFileSync } from 'fs';
import { parseAccountStatement } from './parser.js';

const FILE = 'samples/etoro-account-statement-1-1-2025-12-31-2025.xlsx';

function assert(condition, message) {
    if (!condition) {
        console.error(`  FAIL: ${message}`);
        process.exitCode = 1;
    } else {
        console.log(`  OK:   ${message}`);
    }
}

function run() {
    console.log(`\nLuetaan: ${FILE}\n`);

    const buffer = readFileSync(FILE);
    const { closedPositions } = parseAccountStatement(buffer.buffer);

    // --- Perustarkistukset ---
    console.log('=== Perustarkistukset ===');
    assert(Array.isArray(closedPositions), 'closedPositions on taulukko');
    assert(closedPositions.length === 257, `Rivejä 257 (saatiin ${closedPositions.length})`);

    // --- Ensimmäinen rivi ---
    console.log('\n=== Ensimmäinen rivi ===');
    const first = closedPositions[0];
    console.log('  Data:', JSON.stringify(first, null, 2));

    assert(first.positionId === '2975600224', `positionId: ${first.positionId}`);
    assert(first.action === 'Sodexo SA (SW.PA)', `action: ${first.action}`);
    assert(first.longShort === 'Long', `longShort: ${first.longShort}`);
    assert(first.amount === 1.97, `amount: ${first.amount}`);
    assert(first.leverage === 1, `leverage: ${first.leverage}`);
    assert(first.type === 'Stocks', `type: ${first.type}`);
    assert(first.isin === 'FR0000121220', `isin: ${first.isin}`);
    assert(first.openDate === '2025-03-24T13:35:04', `openDate: ${first.openDate}`);
    assert(first.closeDate === '2025-04-22T07:01:02', `closeDate: ${first.closeDate}`);
    assert(first.profitEUR === -0.07, `profitEUR: ${first.profitEUR}`);

    // --- Instrumenttityypit ---
    console.log('\n=== Instrumenttityypit ===');
    const stocks = closedPositions.filter(p => p.type === 'Stocks');
    const cfds   = closedPositions.filter(p => p.type === 'CFD');
    console.log(`  Stocks: ${stocks.length}, CFD: ${cfds.length}`);
    assert(stocks.length + cfds.length === closedPositions.length, 'Kaikki rivit ovat Stocks tai CFD');
    assert(stocks.length > 0, 'Stocks-rivejä löytyy');
    assert(cfds.length > 0, 'CFD-rivejä löytyy');

    // --- Kenttien tyypit ---
    console.log('\n=== Kenttien tyypit ===');
    const sample = closedPositions[0];
    assert(typeof sample.positionId === 'string', 'positionId on string');
    assert(typeof sample.amount === 'number', 'amount on number');
    assert(typeof sample.units === 'number', 'units on number');
    assert(typeof sample.leverage === 'number', 'leverage on number');
    assert(typeof sample.profitUSD === 'number', 'profitUSD on number');
    assert(typeof sample.profitEUR === 'number', 'profitEUR on number');
    assert(typeof sample.openDate === 'string', 'openDate on string');
    assert(typeof sample.closeDate === 'string', 'closeDate on string');

    // --- Yhteenveto ---
    console.log('\n=== Yhteenveto ===');
    const totalProfitEUR = closedPositions.reduce((sum, p) => sum + p.profitEUR, 0);
    const totalProfitUSD = closedPositions.reduce((sum, p) => sum + p.profitUSD, 0);
    console.log(`  Kokonaisvoitto EUR: ${totalProfitEUR.toFixed(2)}`);
    console.log(`  Kokonaisvoitto USD: ${totalProfitUSD.toFixed(2)}`);
    console.log(`  Stocks-positioita:  ${stocks.length}`);
    console.log(`  CFD-positioita:     ${cfds.length}`);

    console.log('\n=== Valmis ===\n');
}

run();
