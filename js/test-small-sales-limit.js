/**
 * Testi: pienten myyntien verovapausraja (TVL 48 § ja TVL 50 §)
 * Ajo: node js/test-small-sales-limit.js
 *
 * Kaksi erillistä säännöstä:
 *   TVL 48 §: Voitot verovapaita jos MYYNTIHINNAT yhteensä ≤ 1 000 €
 *   TVL 50 §: Tappiot vähennyskelvottomia jos HANKINTAMENOT yhteensä ≤ 1 000 €
 *
 * EKP-kurssi = 1.0 → USD = EUR, laskenta helppo seurata.
 * salePriceEUR = amount + profitUSD
 * acquisitionCostEUR = amount
 *
 * Skenaariot:
 *   1. Myyntihinnat 950 €, hankintamenot 750 € → molemmat vapautukset
 *   2. Myyntihinnat 1 050 €, hankintamenot 850 € → ei vapautuksia, voitot verotetaan
 *   3. Myyntihinnat tasan 1 000 € → voitot verovapaita (raja on ≤)
 *   4. Osakkeet + kryptot yhteensä yli rajan → ei vapautuksia
 *   5. Voittoja ja tappioita yli rajan → nettovoitto lasketaan oikein
 *   6. Myyntihinnat 800 € (≤ 1 000), hankintamenot 1 200 € (> 1 000) → tappio ON vähennyskelpoinen
 *   7. Myyntihinnat 1 200 € (> 1 000), hankintamenot 800 € (≤ 1 000) → voitto verotetaan, tappiota ei ole
 *   8. Sekatapauksessa eri säännöt voivat aktivoitua eri suuntiin
 */

import { calculateStockTax, calculateCryptoTax, generateTaxReport }
    from './tax-calculator.js';

let passed = 0, failed = 0;

function assert(condition, message) {
    if (!condition) { console.error(`  FAIL: ${message}`); failed++; }
    else            { console.log(`  OK:   ${message}`);   passed++; }
}

const MOCK_ECB = { '2025-01-02': 1.0, '2025-01-03': 1.0 };

let posId = 1;
function pos(action, amount, profitUSD, type = 'Stocks') {
    return {
        positionId: String(posId++), action, isin: 'FI0000000000',
        longShort: 'Long', amount, units: 1,
        openDate: '2025-01-02T10:00:00', closeDate: '2025-01-03T10:00:00',
        leverage: 1, spreadFeesUSD: 0, profitUSD, type, notes: '',
    };
}

// ---------------------------------------------------------------------------
// Skenaario 1: Myyntihinnat 950 € ja hankintamenot 750 € → molemmat vapautukset
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 1: Myyntihinnat 950 €, hankintamenot 750 € → molemmat vapautukset ──');
{
    // A: osto 400, myynti 500 (voitto 100)  B: osto 350, myynti 450 (voitto 100)
    // myyntihinnat yht. 950 €, hankintamenot yht. 750 €
    const positions = [pos('A', 400, 100), pos('B', 350, 100)];
    const r = calculateStockTax(positions, MOCK_ECB);

    assert(r.gainExemption === true,      `gainExemption=true (myyntihinnat ${r.totalSalePriceEUR} €)`);
    assert(r.lossNonDeductible === true,  `lossNonDeductible=true (hankintamenot ${r.totalAcquisitionEUR} €)`);
    assert(r.taxableGainEUR === 0,        `taxableGainEUR=0`);
    assert(r.deductibleLossEUR === 0,     `deductibleLossEUR=0`);
}

// ---------------------------------------------------------------------------
// Skenaario 2: Myyntihinnat 1 050 €, hankintamenot 850 € → ei vapautuksia
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 2: Myyntihinnat 1 050 €, hankintamenot 850 € → ei vapautuksia ──');
{
    // A: osto 400, myynti 500  B: osto 450, myynti 550
    // myyntihinnat yht. 1 050 €, hankintamenot yht. 850 €
    const positions = [pos('A', 400, 100), pos('B', 450, 100)];
    const r = calculateStockTax(positions, MOCK_ECB);

    assert(r.gainExemption === false,    `gainExemption=false (myyntihinnat ${r.totalSalePriceEUR} €)`);
    assert(r.lossNonDeductible === true, `lossNonDeductible=true (hankintamenot ${r.totalAcquisitionEUR} € ≤ 1 000)`);
    assert(r.taxableGainEUR === 200,     `taxableGainEUR=200 (${r.taxableGainEUR})`);
    assert(r.estimatedTaxEUR === 60,     `estimatedTaxEUR=60 (30 % × 200) (${r.estimatedTaxEUR})`);
}

// ---------------------------------------------------------------------------
// Skenaario 3: Myyntihinnat tasan 1 000 € → voitot verovapaita (raja on ≤)
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 3: Myyntihinnat tasan 1 000 € → gainExemption=true ──');
{
    // A: osto 400, myynti 450  B: osto 400, myynti 550  → yht. myynti 1 000 €
    const positions = [pos('A', 400, 50), pos('B', 400, 150)];
    const r = calculateStockTax(positions, MOCK_ECB);

    assert(r.gainExemption === true,  `gainExemption=true (tasan 1 000 €)`);
    assert(r.taxableGainEUR === 0,    `taxableGainEUR=0`);
    assert(r.totalSalePriceEUR === 1000, `totalSalePriceEUR=1000`);
}

// ---------------------------------------------------------------------------
// Skenaario 4: Osakkeet + kryptot yhteensä yli myynti- ja hankintarajojen
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 4: Osakkeet 450 € + kryptot 600 € = 1 050 € → ei vapautuksia ──');
{
    const stocks = [pos('Osake', 400, 50)];          // myynti=450, hankinta=400
    const crypto = [pos('Bitcoin', 500, 100, 'Crypto')]; // myynti=600, hankinta=500
    // yhdistetty myynti=1050 €, hankinta=900 €

    const report = generateTaxReport([...stocks, ...crypto], [], MOCK_ECB);
    const combined = report.lomake9A.myyntihinnatYhteensaEUR
        + report.lomakeKrypto.myyntihinnatYhteensaEUR;

    assert(combined === 1050, `Yhdistetty myynti 1050 € (${combined})`);
    assert(report.lomake9A.ilmoitettava === true,
        `lomake9A.ilmoitettava=true (myynti yli rajan)`);
    assert(report.lomakeKrypto.ilmoitettava === true,
        `lomakeKrypto.ilmoitettava=true (myynti yli rajan)`);
    assert(report.yhteenveto.osakkeetVeiotettavaTuloEUR === 50,
        `osakkeet verotettava=50 € (${report.yhteenveto.osakkeetVeiotettavaTuloEUR})`);
    assert(report.yhteenveto.kryptotVeiotettavaTuloEUR === 100,
        `kryptot verotettava=100 € (${report.yhteenveto.kryptotVeiotettavaTuloEUR})`);
}

// ---------------------------------------------------------------------------
// Skenaario 5: Voittoja ja tappioita yli rajan → nettovoitto lasketaan oikein
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 5: Voittoja ja tappioita, myynti 1 050 € → nettovoitto verotetaan ──');
{
    // A: osto 600, myynti 800 (voitto 200)  B: osto 300, myynti 250 (tappio -50)
    // myyntihinnat yht. 1 050 €, hankintamenot yht. 900 €
    const positions = [pos('A', 600, 200), pos('B', 300, -50)];
    const r = calculateStockTax(positions, MOCK_ECB);

    assert(r.gainExemption === false,    `gainExemption=false (myynti 1 050 €)`);
    assert(r.lossNonDeductible === true, `lossNonDeductible=true (hankinta 900 € ≤ 1 000)`);
    assert(r.netGainLossEUR === 150,      `netGainLossEUR=150 (${r.netGainLossEUR})`);
    assert(r.taxableGainEUR === 150,      `taxableGainEUR=150`);
    assert(r.deductibleLossEUR === 0,     `deductibleLossEUR=0 (tappio on netottu voittoon)`);
    assert(r.estimatedTaxEUR === 45,      `estimatedTaxEUR=45 (30 % × 150)`);
}

// ---------------------------------------------------------------------------
// Skenaario 6: Myyntihinnat 800 € (≤ 1 000 → voitot verovapaita)
//              Hankintamenot 1 200 € (> 1 000 → tappiot OVAT vähennyskelpoisia)
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 6: Ostettu 1200 €, myyty 800 € → tappio 400 € ON vähennyskelpoinen ──');
{
    // Osto 1200 €, myynti 800 € → tappio -400 €
    // TVL 48 §: myynti 800 ≤ 1000 → voitot verovapaita (ei ole voittoja)
    // TVL 50 §: hankinta 1200 > 1000 → tappiot OVAT vähennyskelpoisia
    const positions = [pos('Yhtiö', 1200, -400)];
    const r = calculateStockTax(positions, MOCK_ECB);

    assert(r.totalSalePriceEUR === 800,      `totalSalePriceEUR=800 (${r.totalSalePriceEUR})`);
    assert(r.totalAcquisitionEUR === 1200,   `totalAcquisitionEUR=1200 (${r.totalAcquisitionEUR})`);
    assert(r.gainExemption === true,         `gainExemption=true (myynti 800 ≤ 1 000)`);
    assert(r.lossNonDeductible === false,    `lossNonDeductible=false (hankinta 1 200 > 1 000)`);
    assert(r.taxableGainEUR === 0,           `taxableGainEUR=0 (ei voittoja)`);
    assert(r.deductibleLossEUR === -400,     `deductibleLossEUR=-400 (tappio vähennyskelpoinen) (${r.deductibleLossEUR})`);
}

// ---------------------------------------------------------------------------
// Skenaario 7: Myyntihinnat 1 200 € (> 1 000 → voitto verotetaan)
//              Hankintamenot 800 € (≤ 1 000 → tappiot vähennyskelvottomia)
//              Tässä ei ole tappiota lainkaan, joten TVL 50 § ei käytännössä vaikuta
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 7: Ostettu 800 €, myyty 1200 € → voitto 400 € verotetaan ──');
{
    const positions = [pos('Yhtiö', 800, 400)];
    const r = calculateStockTax(positions, MOCK_ECB);

    assert(r.gainExemption === false,        `gainExemption=false (myynti 1 200 > 1 000)`);
    assert(r.lossNonDeductible === true,     `lossNonDeductible=true (hankinta 800 ≤ 1 000)`);
    assert(r.taxableGainEUR === 400,         `taxableGainEUR=400 (voitto verotetaan) (${r.taxableGainEUR})`);
    assert(r.deductibleLossEUR === 0,        `deductibleLossEUR=0 (ei tappiota)`);
    assert(r.estimatedTaxEUR === 120,        `estimatedTaxEUR=120 (30 % × 400) (${r.estimatedTaxEUR})`);
}

// ---------------------------------------------------------------------------
// Skenaario 8: Sekatapauksessa voitot verovapaita mutta tappiot vähennyskelpoisia
//              (eri osakkeet samalla verovuodella)
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 8: Voitot verovapaita (myynti < 1000), tappiot vähennyskelpoisia (hankinta > 1000) ──');
{
    // A: osto 200, myynti 300 (voitto 100)
    // B: osto 1100, myynti 500 (tappio -600)
    // Myyntihinnat yht. 800 € (≤ 1000 → voitot verovapaita)
    // Hankintamenot yht. 1300 € (> 1000 → tappiot vähennyskelpoisia)
    const positions = [pos('A', 200, 100), pos('B', 1100, -600)];
    const r = calculateStockTax(positions, MOCK_ECB);

    assert(r.totalSalePriceEUR === 800,      `totalSalePriceEUR=800`);
    assert(r.totalAcquisitionEUR === 1300,   `totalAcquisitionEUR=1300`);
    assert(r.gainExemption === true,         `gainExemption=true (myynti 800 ≤ 1 000)`);
    assert(r.lossNonDeductible === false,    `lossNonDeductible=false (hankinta 1 300 > 1 000)`);
    assert(r.taxableGainEUR === 0,           `taxableGainEUR=0 (voitot verovapaita)`);
    assert(r.deductibleLossEUR === -500,     `deductibleLossEUR=-500 (nettotappio vähennyskelpoinen) (${r.deductibleLossEUR})`);
}

// ---------------------------------------------------------------------------
console.log(`\n=== Tulos: ${passed} OK, ${failed} FAIL ===\n`);
