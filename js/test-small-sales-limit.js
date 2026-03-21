/**
 * Testi: pienten myyntien verovapausraja (TVL 48 §)
 * Ajo: node js/test-small-sales-limit.js
 *
 * Käytetään synteettistä mockup-dataa parseAccountStatement():n
 * palauttamassa muodossa. EKP-kurssi = 1.0 jolloin USD = EUR.
 *
 * Skenaariot:
 *   1. Osakkeet alle rajan (950 €)     → vapautus
 *   2. Osakkeet yli rajan (1 050 €)    → ei vapautusta, voitot verotetaan
 *   3. Osakkeet tasan rajalla (1 000 €) → vapautus (raja on ≤)
 *   4. Osakkeet + kryptot yhteensä yli rajan (1 050 €),
 *      kumpikin erikseen alle rajan     → ei vapautusta
 *   5. Voittoja ja tappioita yli rajan  → nettoverotettava tulo lasketaan oikein
 */

import { calculateStockTax, calculateCryptoTax, generateTaxReport }
    from './tax-calculator.js';

let passed = 0, failed = 0;

function assert(condition, message) {
    if (!condition) { console.error(`  FAIL: ${message}`); failed++; }
    else            { console.log(`  OK:   ${message}`);   passed++; }
}

// ---------------------------------------------------------------------------
// Mock-apufunktiot
// ---------------------------------------------------------------------------

// EKP-kurssit: 1.0 kahdelle päivälle → USD = EUR, laskenta helppoa seurata
const MOCK_ECB = {
    '2025-01-02': 1.0,
    '2025-01-03': 1.0,
};

let posId = 1;

/**
 * Luo yhden mock-position.
 * amount    = investoitu USD-summa = hankintameno EUR (kurssi 1.0)
 * profitUSD = voitto/tappio USD = voitto/tappio EUR (kurssi 1.0)
 * salePriceEUR = amount + profitUSD
 */
function pos(action, amount, profitUSD, type = 'Stocks') {
    return {
        positionId:    String(posId++),
        action,
        isin:          'FI0000000000',
        longShort:     'Long',
        amount,
        units:         1,
        openDate:      '2025-01-02T10:00:00',
        closeDate:     '2025-01-03T10:00:00',
        leverage:      1,
        spreadFeesUSD: 0,
        profitUSD,
        type,
        notes:         '',
    };
}

// ---------------------------------------------------------------------------
// Skenaario 1: Osakkeet alle rajan (950 €) → vapautus
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 1: Myyntihinnat yhteensä 950 € (< 1 000 €) → vapautus ──');
{
    // sale A = 400 + 100 = 500 €, sale B = 350 + 100 = 450 € → yht. 950 €
    const positions = [pos('Yhtiö A', 400, 100), pos('Yhtiö B', 350, 100)];
    const r = calculateStockTax(positions, MOCK_ECB);

    assert(r.smallSalesExemption === true,
        `smallSalesExemption=true (myyntihinnat ${r.totalSalePriceEUR} €)`);
    assert(r.taxableGainEUR === 0,
        `taxableGainEUR=0 (vapautus)`);
    assert(r.deductibleLossEUR === 0,
        `deductibleLossEUR=0 (vapautus)`);
    assert(r.totalSalePriceEUR === 950,
        `totalSalePriceEUR=950 (${r.totalSalePriceEUR})`);
    assert(r.totalGainsEUR === 200,
        `totalGainsEUR=200 (${r.totalGainsEUR})`);
}

// ---------------------------------------------------------------------------
// Skenaario 2: Osakkeet yli rajan (1 050 €) → ei vapautusta
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 2: Myyntihinnat yhteensä 1 050 € (> 1 000 €) → ei vapautusta ──');
{
    // sale A = 400 + 100 = 500 €, sale B = 450 + 100 = 550 € → yht. 1 050 €
    const positions = [pos('Yhtiö A', 400, 100), pos('Yhtiö B', 450, 100)];
    const r = calculateStockTax(positions, MOCK_ECB);

    assert(r.smallSalesExemption === false,
        `smallSalesExemption=false (myyntihinnat ${r.totalSalePriceEUR} €)`);
    assert(r.taxableGainEUR === 200,
        `taxableGainEUR=200 (voitot verotetaan) (${r.taxableGainEUR})`);
    assert(r.estimatedTaxEUR === 60,
        `estimatedTaxEUR=60 (30 % × 200) (${r.estimatedTaxEUR})`);
    assert(r.totalSalePriceEUR === 1050,
        `totalSalePriceEUR=1050 (${r.totalSalePriceEUR})`);
}

// ---------------------------------------------------------------------------
// Skenaario 3: Tasan rajalla (1 000 €) → vapautus (raja on ≤)
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 3: Myyntihinnat tasan 1 000 € → vapautus (≤) ──');
{
    // sale A = 400+50=450, sale B = 400+150=550 → yht. 1 000 €
    const positions = [pos('Yhtiö A', 400, 50), pos('Yhtiö B', 400, 150)];
    const r = calculateStockTax(positions, MOCK_ECB);

    assert(r.smallSalesExemption === true,
        `smallSalesExemption=true (tasan 1 000 €)`);
    assert(r.taxableGainEUR === 0,
        `taxableGainEUR=0 (vapautus)`);
    assert(r.totalSalePriceEUR === 1000,
        `totalSalePriceEUR=1000 (${r.totalSalePriceEUR})`);
}

// ---------------------------------------------------------------------------
// Skenaario 4: Osakkeet + kryptot yhteensä yli rajan
//              Kumpikin erikseen < 1 000 € mutta yhdessä 1 050 €
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 4: Osakkeet 450 € + kryptot 600 € = 1 050 € → ei vapautusta ──');
{
    const stocks = [pos('Yhtiö A', 400, 50)];   // sale = 450 €
    const crypto = [pos('Bitcoin', 500, 100, 'Crypto')]; // sale = 600 €

    const stockResult  = calculateStockTax(stocks, MOCK_ECB);
    const cryptoResult = calculateCryptoTax(crypto, MOCK_ECB);

    // Yksittäin tarkasteltuna kumpikin olisi vapautuksen piirissä
    assert(stockResult.smallSalesExemption === true,
        `Osakkeet yksinään: smallSalesExemption=true (${stockResult.totalSalePriceEUR} €)`);
    assert(cryptoResult.smallSalesExemption === true,
        `Kryptot yksinään: smallSalesExemption=true (${cryptoResult.totalSalePriceEUR} €)`);

    // generateTaxReport tarkistaa yhdistetyn summan
    const report = generateTaxReport([...stocks, ...crypto], [], MOCK_ECB);
    const combined = report.lomake9A.myyntihinnatYhteensaEUR
        + report.lomakeKrypto.myyntihinnatYhteensaEUR;

    assert(combined === 1050,
        `Yhdistetty myyntihinta 1050 € (${combined})`);
    assert(report.lomake9A.ilmoitettava === true,
        `lomake9A.ilmoitettava=true (yhdistetty yli rajan)`);
    assert(report.lomakeKrypto.ilmoitettava === true,
        `lomakeKrypto.ilmoitettava=true (yhdistetty yli rajan)`);
    assert(report.yhteenveto.osakkeetVeiotettavaTuloEUR === 50,
        `osakkeet verotettava=50 € (${report.yhteenveto.osakkeetVeiotettavaTuloEUR})`);
    assert(report.yhteenveto.kryptotVeiotettavaTuloEUR === 100,
        `kryptot verotettava=100 € (${report.yhteenveto.kryptotVeiotettavaTuloEUR})`);
}

// ---------------------------------------------------------------------------
// Skenaario 5: Voittoja ja tappioita yli rajan → nettoverotettava oikein
// ---------------------------------------------------------------------------
console.log('\n── Skenaario 5: Voittoja ja tappioita yli rajan → nettovoitto verotetaan ──');
{
    // sale A = 600+200=800 (voitto 200), sale B = 300-50=250 (tappio -50)
    // Myyntihinnat yht. 1 050 € → ei vapautusta
    // Netto = 200 - 50 = 150 € → verotettava 150 €
    const positions = [pos('Yhtiö A', 600, 200), pos('Yhtiö B', 300, -50)];
    const r = calculateStockTax(positions, MOCK_ECB);

    assert(r.smallSalesExemption === false,
        `smallSalesExemption=false (myyntihinnat ${r.totalSalePriceEUR} €)`);
    assert(r.totalGainsEUR === 200,
        `totalGainsEUR=200 (${r.totalGainsEUR})`);
    assert(r.totalLossesEUR === -50,
        `totalLossesEUR=-50 (${r.totalLossesEUR})`);
    assert(r.netGainLossEUR === 150,
        `netGainLossEUR=150 (${r.netGainLossEUR})`);
    assert(r.taxableGainEUR === 150,
        `taxableGainEUR=150 (${r.taxableGainEUR})`);
    assert(r.deductibleLossEUR === 0,
        `deductibleLossEUR=0 (tappio netotettiin voittoihin)`);
    assert(r.estimatedTaxEUR === 45,
        `estimatedTaxEUR=45 (30 % × 150) (${r.estimatedTaxEUR})`);
}

// ---------------------------------------------------------------------------
console.log(`\n=== Tulos: ${passed} OK, ${failed} FAIL ===\n`);
