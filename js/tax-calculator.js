/**
 * Suomalainen verolaskenta eToro-positioille.
 * Verohallinnon ohjeiden mukainen laskenta.
 *
 * - Osakekaupat: lomake 9A (calculateStockTax)
 * - Kryptot: lomake 9A (calculateCryptoTax)
 * - CFD-sopimukset: lomake 7805 suorituslaji 2D (calculateCfdTax)
 *
 * Valuuttakonversio: EKP:n päivittäiset EUR/USD-viitekurssit.
 * Kurssi = USD per 1 EUR (esim. 1.08 → 1 EUR = 1.08 USD).
 * Muunnos USD → EUR: eur = usd / kurssi
 *
 * Jos kaupantekopäivälle ei löydy kurssia (viikonloppu, pyhäpäivä),
 * käytetään lähintä edellistä pankkipäivää (Verohallinnon ohjeistuksen mukainen käytäntö).
 */

// Pääomatuloveron rajat ja prosentit (2025)
const TAX_THRESHOLD = 30_000;   // EUR
const TAX_RATE_LOW  = 0.30;     // 30 %
const TAX_RATE_HIGH = 0.34;     // 34 %

// Pienten myyntien verovapausraja
const SMALL_SALES_LIMIT = 1_000; // EUR

/**
 * Laskee osakekauppojen verotuksen Suomen verolain mukaan (lomake 9A).
 *
 * Jokainen positio muunnetaan euroiksi EKP:n päivittäisillä viitekursseilla:
 *   - Hankintameno EUR  = amount_USD / ecb_kurssi_ostopaivana
 *   - Myyntihinta EUR   = (amount_USD + profitUSD) / ecb_kurssi_myyntipaivana
 *   - Voitto/tappio EUR = myyntihinta - hankintameno
 *
 * @param {ClosedPosition[]} closedPositions - parseAccountStatement():n palauttama data
 * @param {Object} ecbRates - EKP:n kurssit muodossa {"YYYY-MM-DD": usd_per_eur, ...}
 * @returns {StockTaxSummary}
 */
export function calculateStockTax(closedPositions, ecbRates) {
    const ecbIndex = buildEcbIndex(ecbRates);
    const stockPositions = closedPositions.filter(p => p.type === 'Stocks');

    const positions = stockPositions.map(p => calculatePositionEUR(p, ecbIndex));

    const totalSalePriceEUR   = sum(positions.map(p => p.salePriceEUR));
    const totalAcquisitionEUR = sum(positions.map(p => p.acquisitionCostEUR));
    const gains               = positions.filter(p => p.gainLossEUR > 0);
    const losses              = positions.filter(p => p.gainLossEUR < 0);
    const totalGainsEUR       = sum(gains.map(p => p.gainLossEUR));
    const totalLossesEUR      = sum(losses.map(p => p.gainLossEUR));
    const netGainLossEUR      = totalGainsEUR + totalLossesEUR;

    // TVL 48 § ja TVL 50 § – kaksi erillistä tarkistusta:
    //   Voitot verovapaita jos myyntihinnat yhteensä ≤ 1 000 € (TVL 48 §)
    //   Tappiot vähennyskelvottomia jos hankintamenot yhteensä ≤ 1 000 € (TVL 50 §)
    const gainExemption     = totalSalePriceEUR   <= SMALL_SALES_LIMIT;
    const lossNonDeductible = totalAcquisitionEUR <= SMALL_SALES_LIMIT;

    const taxableGainEUR    = gainExemption     ? 0 : Math.max(0, netGainLossEUR);
    const deductibleLossEUR = lossNonDeductible ? 0 : Math.min(0, netGainLossEUR);
    const estimatedTaxEUR   = calculateTax(taxableGainEUR);

    const missingRates = positions.filter(p => p.missingEcbRate);

    return {
        // Lukumäärät
        totalPositions:       stockPositions.length,
        gainPositions:        gains.length,
        lossPositions:        losses.length,

        // EUR-summat
        totalSalePriceEUR:    round2(totalSalePriceEUR),
        totalAcquisitionEUR:  round2(totalAcquisitionEUR),
        totalGainsEUR:        round2(totalGainsEUR),
        totalLossesEUR:       round2(totalLossesEUR),
        netGainLossEUR:       round2(netGainLossEUR),

        // Verotus
        gainExemption,
        lossNonDeductible,
        taxableGainEUR:       round2(taxableGainEUR),
        deductibleLossEUR:    round2(deductibleLossEUR),
        estimatedTaxEUR:      round2(estimatedTaxEUR),

        // Huomiot
        notes: buildNotes(gainExemption, lossNonDeductible, missingRates.length),

        // Yksityiskohdat per positio (liitettä varten)
        positions,
    };
}

/**
 * Laskee kryptovaluuttojen myyntivoitot/-tappiot Suomen verolain mukaan (lomake 9A).
 *
 * Kryptot verotetaan samoin kuin arvopaperit (TVL 45 §):
 *   - Voitot ja tappiot ovat pääomatuloa
 *   - Tappiot ovat vähennyskelpoisia (toisin kuin CFD-tappiot)
 *   - Pienten myyntien verovapaus (TVL 48 §) soveltuu
 *   - Valuuttamuunnos EKP:n kurssilla kaupantekopäivänä
 *
 * Huom: TVL 48 §:n 1 000 €:n raja koskee KAIKKIA luovutuksia yhteensä
 * (osakkeet + kryptot). Tarkistus tehdään generateTaxReport():ssa.
 *
 * @param {ClosedPosition[]} closedPositions
 * @param {Object} ecbRates
 * @returns {CryptoTaxSummary}
 */
export function calculateCryptoTax(closedPositions, ecbRates) {
    const ecbIndex = buildEcbIndex(ecbRates);
    const cryptoPositions = closedPositions.filter(p => p.type === 'Crypto');

    const positions = cryptoPositions.map(p => calculatePositionEUR(p, ecbIndex));

    const totalSalePriceEUR   = sum(positions.map(p => p.salePriceEUR));
    const totalAcquisitionEUR = sum(positions.map(p => p.acquisitionCostEUR));
    const gains               = positions.filter(p => p.gainLossEUR > 0);
    const losses              = positions.filter(p => p.gainLossEUR < 0);
    const totalGainsEUR       = sum(gains.map(p => p.gainLossEUR));
    const totalLossesEUR      = sum(losses.map(p => p.gainLossEUR));
    const netGainLossEUR      = totalGainsEUR + totalLossesEUR;

    // TVL 48 § ja TVL 50 § – kaksi erillistä tarkistusta (ks. calculateStockTax)
    // generateTaxReport() tarkistaa yhdistetyn rajan osakkeiden kanssa
    const gainExemption     = totalSalePriceEUR   <= SMALL_SALES_LIMIT;
    const lossNonDeductible = totalAcquisitionEUR <= SMALL_SALES_LIMIT;

    const taxableGainEUR    = gainExemption     ? 0 : Math.max(0, netGainLossEUR);
    const deductibleLossEUR = lossNonDeductible ? 0 : Math.min(0, netGainLossEUR);
    const estimatedTaxEUR   = calculateTax(taxableGainEUR);

    const missingRates = positions.filter(p => p.missingEcbRate);

    const notes = buildNotes(gainExemption, lossNonDeductible, missingRates.length);
    notes.unshift(
        'Kryptot ilmoitetaan lomakkeella 9A (pääomatulo, TVL 45 §). ' +
        'Tappiot ovat vähennyskelpoisia 5 vuotta (TVL 54 §).'
    );

    return {
        totalPositions:       cryptoPositions.length,
        gainPositions:        gains.length,
        lossPositions:        losses.length,
        totalSalePriceEUR:    round2(totalSalePriceEUR),
        totalAcquisitionEUR:  round2(totalAcquisitionEUR),
        totalGainsEUR:        round2(totalGainsEUR),
        totalLossesEUR:       round2(totalLossesEUR),
        netGainLossEUR:       round2(netGainLossEUR),
        gainExemption,
        lossNonDeductible,
        taxableGainEUR:       round2(taxableGainEUR),
        deductibleLossEUR:    round2(deductibleLossEUR),
        estimatedTaxEUR:      round2(estimatedTaxEUR),
        notes,
        positions,
    };
}

// ---------------------------------------------------------------------------
// Yksityinen apufunktio: laske EUR-arvot yhdelle positiolle
// ---------------------------------------------------------------------------

function calculatePositionEUR(p, ecbIndex) {
    const openDateStr  = isoDatePart(p.openDate);
    const closeDateStr = isoDatePart(p.closeDate);

    const ecbOpen  = lookupEcbRate(ecbIndex, openDateStr);
    const ecbClose = lookupEcbRate(ecbIndex, closeDateStr);

    // amount on USD-määrä (investoitu summa)
    // profitUSD on netto voitto/tappio USD:ssa (sis. overnight-maksut)
    const amountUSD   = p.amount;
    const salePriceUSD = amountUSD + p.profitUSD;

    const acquisitionCostEUR = ecbOpen  ? amountUSD   / ecbOpen  : null;
    const salePriceEUR       = ecbClose ? salePriceUSD / ecbClose : null;
    const gainLossEUR        = (acquisitionCostEUR != null && salePriceEUR != null)
        ? salePriceEUR - acquisitionCostEUR
        : null;

    const missingEcbRate = !ecbOpen || !ecbClose;

    return {
        positionId:          p.positionId,
        action:              p.action,
        isin:                p.isin,
        openDate:            p.openDate,
        closeDate:           p.closeDate,
        units:               p.units,
        amountUSD:           round2(amountUSD),
        salePriceUSD:        round2(salePriceUSD),
        ecbRateOpen:         ecbOpen  ?? null,
        ecbRateClose:        ecbClose ?? null,
        acquisitionCostEUR:  round2(acquisitionCostEUR ?? 0),
        salePriceEUR:        round2(salePriceEUR ?? 0),
        gainLossEUR:         round2(gainLossEUR ?? 0),
        missingEcbRate,
    };
}

// ---------------------------------------------------------------------------
// EKP-kurssiindeksi: rakennetaan järjestetty lista pankkipäivistä
// ---------------------------------------------------------------------------

function buildEcbIndex(ecbRates) {
    const dates = Object.keys(ecbRates).sort();
    return { rates: ecbRates, dates };
}

/**
 * Hakee EKP-kurssin päivälle. Jos päivälle ei ole kurssia (viikonloppu, pyhä),
 * palautetaan lähimmän edellisen pankkipäivän kurssi.
 */
function lookupEcbRate(ecbIndex, dateStr) {
    if (!dateStr) return null;
    if (ecbIndex.rates[dateStr]) return ecbIndex.rates[dateStr];

    // Etsi lähin edeltävä pankkipäivä
    const dates = ecbIndex.dates;
    let lo = 0, hi = dates.length - 1, found = null;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (dates[mid] <= dateStr) { found = mid; lo = mid + 1; }
        else hi = mid - 1;
    }
    return found !== null ? ecbIndex.rates[dates[found]] : null;
}

// ---------------------------------------------------------------------------
// Verolaskenta
// ---------------------------------------------------------------------------

function calculateTax(gainEUR) {
    if (gainEUR <= 0) return 0;
    if (gainEUR <= TAX_THRESHOLD) {
        return gainEUR * TAX_RATE_LOW;
    }
    return TAX_THRESHOLD * TAX_RATE_LOW + (gainEUR - TAX_THRESHOLD) * TAX_RATE_HIGH;
}

// ---------------------------------------------------------------------------
// Apufunktiot
// ---------------------------------------------------------------------------

function isoDatePart(isoDateTime) {
    if (!isoDateTime) return null;
    return isoDateTime.slice(0, 10);  // "YYYY-MM-DD"
}

function sum(arr) {
    return arr.reduce((acc, v) => acc + v, 0);
}

function round2(n) {
    return Math.round(n * 100) / 100;
}

function round4(n) {
    return Math.round(n * 10000) / 10000;
}

/**
 * Laskee CFD-sopimusten verotuksen Suomen verolain mukaan (lomake 7805, suorituslaji 2D).
 *
 * Säännöt (TVL 32 § ja 54 §):
 *   - Voitot ovat pääomatuloa ja verotettavia
 *   - Tappiot ovat TÄYSIN vähennyskelvoittomia – niitä ei ilmoiteta lainkaan
 *
 * Voiton EUR-arvo lasketaan sulkupäivän EKP-kurssilla:
 *   profitEUR = profitUSD / ecb_kurssi_sulkupaivana
 *
 * @param {ClosedPosition[]} closedPositions - parseAccountStatement():n palauttama data
 * @param {Object} ecbRates - EKP:n kurssit muodossa {"YYYY-MM-DD": usd_per_eur, ...}
 * @returns {CfdTaxSummary}
 */
export function calculateCfdTax(closedPositions, ecbRates) {
    const ecbIndex      = buildEcbIndex(ecbRates);
    const cfdPositions  = closedPositions.filter(p => p.type === 'CFD');

    const positions = cfdPositions.map(p => calculateCfdPositionEUR(p, ecbIndex));

    const profitablePositions = positions.filter(p => p.profitUSD > 0);
    const lossPositions       = positions.filter(p => p.profitUSD <= 0);

    // Vain voitot ovat verotettavia; tappiot sivuutetaan kokonaan
    const taxableGainEUR  = sum(profitablePositions.map(p => p.gainEUR));
    const totalLossesUSD  = sum(lossPositions.map(p => p.profitUSD));  // info, ei vähennyskelpoinen
    const estimatedTaxEUR = calculateTax(taxableGainEUR);

    const missingRates = positions.filter(p => p.missingEcbRate);

    return {
        // Lukumäärät
        totalPositions:      cfdPositions.length,
        taxablePositions:    profitablePositions.length,
        lossPositions:       lossPositions.length,

        // Verotettava tulo (vain voitot)
        taxableGainEUR:      round2(taxableGainEUR),
        estimatedTaxEUR:     round2(estimatedTaxEUR),

        // Tappiot (vain informaatioksi – ei vähennyskelpoisia)
        nonDeductibleLossesUSD: round2(totalLossesUSD),

        // Huomiot
        notes: buildCfdNotes(lossPositions.length, missingRates.length),

        // Yksityiskohdat per positio
        positions,
    };
}

function calculateCfdPositionEUR(p, ecbIndex) {
    const closeDateStr = isoDatePart(p.closeDate);
    const ecbClose     = lookupEcbRate(ecbIndex, closeDateStr);

    // CFD-voitto/tappio realisoituu sulkuhetkellä → muunnetaan EUR:ksi sulkupäivän kurssilla
    const profitUSD    = p.profitUSD;
    const gainEUR      = ecbClose ? profitUSD / ecbClose : null;

    return {
        positionId:      p.positionId,
        action:          p.action,
        isin:            p.isin,
        openDate:        p.openDate,
        closeDate:       p.closeDate,
        leverage:        p.leverage,
        amountUSD:       round2(p.amount),
        profitUSD:       round2(profitUSD),
        ecbRateClose:    ecbClose ?? null,
        gainEUR:         round2(gainEUR ?? 0),
        isTaxable:       profitUSD > 0,
        missingEcbRate:  !ecbClose,
    };
}

/**
 * Laskee osinkotulojen verotuksen Suomen verolain mukaan (lomake 16B).
 *
 * Säännöt listatuille yhtiöille (TVL 33a §, 33b §):
 *   - Pörssilistattu yhtiö: 85 % brutto-osingosta on veronalaista, 15 % verovapaata
 *   - Ulkomailla pidätetty lähdevero hyvitetään Suomen verosta (enintään Suomen veron suuruinen)
 *
 * Laskentakaava per yhtiö:
 *   grossEUR          = (netDividendUSD + withholdingTaxUSD) / ecb_kurssi_maksupäivänä
 *   withholdingEUR    = withholdingTaxUSD / ecb_kurssi_maksupäivänä
 *   taxableEUR        = grossEUR × 0.85
 *   finnishTaxEUR     = taxableEUR × 0.30   (olettaen kokonaispääomatulot < 30 000 €)
 *   creditEUR         = min(withholdingEUR, finnishTaxEUR)
 *   additionalTaxEUR  = finnishTaxEUR − creditEUR
 *
 * Ryhmittely: lomakkeelle 16B täytetään yksi rivi per yhtiö (ISIN).
 *
 * @param {Dividend[]} dividends - parseDividends():n palauttama data
 * @param {Object} ecbRates - EKP:n kurssit muodossa {"YYYY-MM-DD": usd_per_eur, ...}
 * @returns {DividendTaxSummary}
 */
export function calculateDividendTax(dividends, ecbRates) {
    const ecbIndex = buildEcbIndex(ecbRates);

    // Muunna jokainen yksittäinen osinkorivi euroiksi
    const rows = dividends.map(d => convertDividendToEUR(d, ecbIndex));

    // Ryhmittele yhtiöittäin (ISIN) lomaketta 16B varten
    const byCompany = groupByCompany(rows);

    const totalGrossEUR      = sum(byCompany.map(c => c.grossEUR));
    const totalTaxableEUR    = sum(byCompany.map(c => c.taxableEUR));
    const totalTaxFreeEUR    = sum(byCompany.map(c => c.taxFreeEUR));
    const totalWithholdingEUR= sum(byCompany.map(c => c.withholdingTaxEUR));
    const totalFinnishTaxEUR = sum(byCompany.map(c => c.finnishTaxEUR));
    const totalCreditEUR     = sum(byCompany.map(c => c.withholdingCreditEUR));
    const totalAdditionalEUR = sum(byCompany.map(c => c.additionalTaxEUR));

    const missingRates = rows.filter(r => r.missingEcbRate);

    return {
        // Lukumäärät
        totalRows:              dividends.length,
        totalCompanies:         byCompany.length,

        // EUR-summat (kaikki yhtiöt yhteensä)
        totalGrossEUR:          round2(totalGrossEUR),
        totalTaxableEUR:        round2(totalTaxableEUR),   // 85 % bruttosta
        totalTaxFreeEUR:        round2(totalTaxFreeEUR),   // 15 % bruttosta
        totalWithholdingEUR:    round2(totalWithholdingEUR),
        totalFinnishTaxEUR:     round2(totalFinnishTaxEUR),
        totalCreditEUR:         round2(totalCreditEUR),
        totalAdditionalTaxEUR:  round2(totalAdditionalEUR), // maksettava lisää

        // Huomiot
        notes: buildDividendNotes(missingRates.length),

        // Lomake 16B: yksi rivi per yhtiö
        byCompany,

        // Kaikki yksittäiset rivit (liitettä varten)
        rows,
    };
}

function convertDividendToEUR(d, ecbIndex) {
    const ecbRate = lookupEcbRate(ecbIndex, d.paymentDate);

    const grossEUR       = ecbRate ? d.grossDividendUSD  / ecbRate : null;
    const withholdingEUR = ecbRate ? d.withholdingTaxUSD / ecbRate : null;

    return {
        ...d,
        ecbRate:          ecbRate ?? null,
        grossEUR:         round4(grossEUR ?? 0),
        withholdingEUR:   round4(withholdingEUR ?? 0),
        missingEcbRate:   !ecbRate,
    };
}

function groupByCompany(rows) {
    const map = new Map();

    for (const r of rows) {
        const key = r.isin ?? r.instrumentName;
        if (!map.has(key)) {
            map.set(key, {
                isin:              r.isin,
                instrumentName:    r.instrumentName,
                country:           r.isin ? r.isin.slice(0, 2) : '??',
                withholdingRatePct: r.withholdingTaxRatePct,
                paymentDates:      [],
                grossEUR:          0,
                withholdingTaxEUR: 0,
                rowCount:          0,
            });
        }
        const c = map.get(key);
        c.grossEUR          += r.grossEUR;
        c.withholdingTaxEUR += r.withholdingEUR;
        c.rowCount          += 1;
        if (!c.paymentDates.includes(r.paymentDate)) {
            c.paymentDates.push(r.paymentDate);
        }
    }

    return Array.from(map.values()).map(c => {
        // Pörssilistattu yhtiö: 85 % veronalaista, 15 % verovapaata
        const taxableEUR     = round2(c.grossEUR * 0.85);
        const taxFreeEUR     = round2(c.grossEUR * 0.15);
        // Suomen vero (30 %) taxable-osuudesta
        const finnishTaxEUR  = round2(taxableEUR * TAX_RATE_LOW);
        // Lähdeveron hyvitys: enintään Suomen veron suuruinen
        const creditEUR      = round2(Math.min(c.withholdingTaxEUR, finnishTaxEUR));
        const additionalEUR  = round2(finnishTaxEUR - creditEUR);

        return {
            isin:                c.isin,
            instrumentName:      c.instrumentName,
            country:             c.country,
            withholdingRatePct:  c.withholdingRatePct,
            rowCount:            c.rowCount,
            paymentDates:        c.paymentDates.sort(),
            // Lomake 16B -kentät
            grossEUR:            round2(c.grossEUR),
            withholdingTaxEUR:   round2(c.withholdingTaxEUR),
            taxableEUR,
            taxFreeEUR,
            finnishTaxEUR,
            withholdingCreditEUR: creditEUR,
            additionalTaxEUR:    additionalEUR,
        };
    });
}

function buildDividendNotes(missingRatesCount) {
    const notes = [
        'Osingot ilmoitetaan lomakkeella 16B, yksi rivi per yhtiö.',
        'Pörssilistattu yhtiö: 85 % brutto-osingosta veronalaista, 15 % verovapaata (TVL 33a §).',
        'Ulkomainen lähdevero hyvitetään Suomen verosta (enintään Suomen veron suuruinen).',
        'Bruttomäärä = netto-osinko + pidätetty lähdevero.',
    ];
    if (missingRatesCount > 0) {
        notes.push(
            `${missingRatesCount} riville ei löydy EKP-kurssia maksupäivälle – käytetty lähintä edellistä pankkipäivää.`
        );
    }
    notes.push('Valuuttamuunnos: EKP:n päivittäinen EUR/USD-viitekurssi maksupäivältä.');
    return notes;
}

function buildCfdNotes(lossCount, missingRatesCount) {
    const notes = [
        'CFD-tappiot ovat TÄYSIN vähennyskelvoittomia (TVL 54 §) – niitä ei ilmoiteta veroilmoituksella.',
        'CFD-voitot ilmoitetaan lomakkeella 7805 (suorituslaji 2D) tai OmaVerossa kohdassa "Muut pääomatulot".',
    ];
    if (lossCount > 0) {
        notes.push(
            `${lossCount} tappiollista CFD-positiota (yhteensä ei-vähennyskelpoista tappiota – vain informaatioksi).`
        );
    }
    if (missingRatesCount > 0) {
        notes.push(
            `${missingRatesCount} positiolle ei löydy EKP-kurssia sulkupäivälle – käytetty lähintä edellistä pankkipäivää.`
        );
    }
    notes.push('Valuuttamuunnos: EKP:n päivittäinen EUR/USD-viitekurssi sulkupäivältä.');
    return notes;
}

function buildNotes(gainExemption, lossNonDeductible, missingRatesCount) {
    const notes = [];
    if (gainExemption) {
        notes.push(
            'Voitot verovapaita (TVL 48 §): myyntihinnat yhteensä ≤ 1 000 €.'
        );
    }
    if (lossNonDeductible) {
        notes.push(
            'Tappiot vähennyskelvottomia (TVL 50 §): hankintamenot yhteensä ≤ 1 000 €.'
        );
    }
    if (missingRatesCount > 0) {
        notes.push(
            `${missingRatesCount} positiolle ei löydy EKP-kurssia kaupantekopäivälle – ` +
            'käytetty lähintä edellistä pankkipäivää (Verohallinnon ohjeistuksen mukainen käytäntö).'
        );
    }
    notes.push(
        'Valuuttamuunnos: EKP:n päivittäiset EUR/USD-viitekurssit (USD → EUR kaupantekopäivän kurssilla).'
    );
    return notes;
}

// ---------------------------------------------------------------------------
// Yhteenvetoraportti
// ---------------------------------------------------------------------------

/**
 * Laskee kaiken ja palauttaa yhden yhteenvetoobjektin HTML-generointia varten.
 *
 * Rakenne:
 *   verovuosi, generoitu
 *   lomake9A     – osakekaupat (TVL 9A)
 *   lomake7805   – CFD-voitot (TVL 7805 suorituslaji 2D)
 *   lomake16B    – ulkomaiset osingot (TVL 16B)
 *   yhteenveto   – kokonaistilanne: verotettava tulo, vero, mitä ilmoitetaan
 *
 * @param {ClosedPosition[]} closedPositions
 * @param {Dividend[]}       dividends
 * @param {Object}           ecbRates  {"YYYY-MM-DD": usd_per_eur}
 * @returns {TaxReport}
 */
export function generateTaxReport(closedPositions, dividends, ecbRates) {
    const stocks    = calculateStockTax(closedPositions, ecbRates);
    const crypto    = calculateCryptoTax(closedPositions, ecbRates);
    const cfds      = calculateCfdTax(closedPositions, ecbRates);
    const divs      = calculateDividendTax(dividends, ecbRates);

    // TVL 48 § ja TVL 50 § koskevat kaikkia luovutuksia yhteensä (osakkeet + kryptot).
    // Kaksi erillistä tarkistusta:
    //   Voitot verovapaita jos myyntihinnat yhteensä ≤ 1 000 € (TVL 48 §)
    //   Tappiot vähennyskelvottomia jos hankintamenot yhteensä ≤ 1 000 € (TVL 50 §)
    const combinedSalePriceEUR   = stocks.totalSalePriceEUR   + crypto.totalSalePriceEUR;
    const combinedAcquisitionEUR = stocks.totalAcquisitionEUR + crypto.totalAcquisitionEUR;
    const combinedGainExemption     = combinedSalePriceEUR   <= SMALL_SALES_LIMIT;
    const combinedLossNonDeductible = combinedAcquisitionEUR <= SMALL_SALES_LIMIT;

    const stocksTaxable    = combinedGainExemption     ? 0 : Math.max(0, stocks.netGainLossEUR);
    const cryptoTaxable    = combinedGainExemption     ? 0 : Math.max(0, crypto.netGainLossEUR);
    const stocksDeductible = combinedLossNonDeductible ? 0 : Math.min(0, stocks.netGainLossEUR);
    const cryptoDeductible = combinedLossNonDeductible ? 0 : Math.min(0, crypto.netGainLossEUR);

    // Verotettavat tulot yhteensä
    const verotettavaYhteensaEUR = round2(
        stocksTaxable +
        cryptoTaxable +
        cfds.taxableGainEUR +
        divs.totalTaxableEUR
    );

    // Arvioitu kokonaisvero ennen hyvityksiä
    // Lasketaan yhteisellä progressiivisella asteikolla kaikille pääomatuloille
    const arvioistuKokonaisVeroEUR = round2(calculateTax(verotettavaYhteensaEUR));

    // Lähdeveron hyvitys (osingoista)
    const lahdeveroHyvitysEUR = divs.totalCreditEUR;

    // Maksettava vero yhteensä (lähdeveron hyvityksen jälkeen)
    const maksettavaVeroEUR = round2(arvioistuKokonaisVeroEUR - lahdeveroHyvitysEUR);

    return {
        // Metatiedot
        verovuosi: resolveVeovuosi(closedPositions, dividends),
        generoitu: new Date().toISOString().slice(0, 10),

        // ── Lomake 9A: Arvopaperien luovutusvoitot ja -tappiot ─────────────
        lomake9A: {
            ilmoitettava:             stocks.positions.length > 0 &&
                                      (stocksTaxable > 0 || stocksDeductible < 0),
            // Täytettävät kentät
            myyntihinnatYhteensaEUR:  stocks.totalSalePriceEUR,
            hankintamenotYhteensaEUR: stocks.totalAcquisitionEUR,
            voitotYhteensaEUR:        stocks.totalGainsEUR,
            tappiotYhteensaEUR:       stocks.totalLossesEUR,
            nettovoittoEUR:           stocks.netGainLossEUR,
            verotettavaTuloEUR:       round2(stocksTaxable),
            vahennyskelponenTappioEUR: round2(stocksDeductible),
            arvioistuVeroEUR:         round2(calculateTax(stocksTaxable)),
            // Syy jos ei ilmoiteta
            eiIlmoitetaSyy:           buildSmallSalesReason(
                combinedGainExemption, combinedLossNonDeductible,
                combinedSalePriceEUR, combinedAcquisitionEUR),
            // Positiot liitettä varten
            positiot:                 stocks.positions,
            huomiot:                  stocks.notes,
        },

        // ── Lomake 9A: Kryptovaluuttojen luovutusvoitot ja -tappiot ────────
        lomakeKrypto: {
            ilmoitettava:             crypto.positions.length > 0 &&
                                      (cryptoTaxable > 0 || cryptoDeductible < 0),
            // Täytettävät kentät
            myyntihinnatYhteensaEUR:  crypto.totalSalePriceEUR,
            hankintamenotYhteensaEUR: crypto.totalAcquisitionEUR,
            voitotYhteensaEUR:        crypto.totalGainsEUR,
            tappiotYhteensaEUR:       crypto.totalLossesEUR,
            nettovoittoEUR:           crypto.netGainLossEUR,
            verotettavaTuloEUR:       round2(cryptoTaxable),
            vahennyskelponenTappioEUR: round2(cryptoDeductible),
            arvioistuVeroEUR:         round2(calculateTax(cryptoTaxable)),
            // Syy jos ei ilmoiteta
            eiIlmoitetaSyy:           crypto.positions.length === 0
                ? 'Ei krypto-positioita'
                : buildSmallSalesReason(
                    combinedGainExemption, combinedLossNonDeductible,
                    combinedSalePriceEUR, combinedAcquisitionEUR),
            // Positiot liitettä varten
            positiot:                 crypto.positions,
            huomiot:                  crypto.notes,
        },

        // ── Lomake 7805: CFD-sopimukset (suorituslaji 2D) ──────────────────
        lomake7805: {
            ilmoitettava:             cfds.taxableGainEUR > 0,
            // Täytettävät kentät (vain voitot – tappiot sivuutetaan)
            verotettavaYhteensaEUR:   cfds.taxableGainEUR,
            arvioistuVeroEUR:         cfds.estimatedTaxEUR,
            // Tappiot (informaatioksi, ei ilmoiteta)
            eiVahennettavatTappiotUSD: cfds.nonDeductibleLossesUSD,
            // Positiot
            voitollisetPositiot:      cfds.positions.filter(p => p.isTaxable),
            tappiollisetPositiot:     cfds.positions.filter(p => !p.isTaxable),
            huomiot:                  cfds.notes,
        },

        // ── Lomake 16B: Ulkomaiset pääomatulot (osingot) ───────────────────
        lomake16B: {
            ilmoitettava:             divs.totalGrossEUR > 0,
            // Yhteissummat
            bruttoYhteensaEUR:        divs.totalGrossEUR,
            veronalainenYhteensaEUR:  divs.totalTaxableEUR,
            verovapaaMaaraEUR:        divs.totalTaxFreeEUR,
            lahdeveroYhteensaEUR:     divs.totalWithholdingEUR,
            suomenVeroYhteensaEUR:    divs.totalFinnishTaxEUR,
            lahdeveroHyvitysEUR:      divs.totalCreditEUR,
            lisaveroYhteensaEUR:      divs.totalAdditionalTaxEUR,
            // Täytettävät rivit (yksi per yhtiö)
            yhtioriviit:              divs.byCompany.map(c => ({
                yhtiöNimi:            c.instrumentName,
                isin:                 c.isin,
                lahtömaa:             isinToCountryName(c.country),
                lahtömaaKoodi:        c.country,
                pörssiListattu:       true,
                bruttoOsinkoEUR:      c.grossEUR,
                ulkomainenLahdevero:  c.withholdingTaxEUR,
                veronalainenOsuusEUR: c.taxableEUR,
                suomenVeroEUR:        c.finnishTaxEUR,
                hyvitysEUR:           c.withholdingCreditEUR,
                maksettavaLisaveroEUR: c.additionalTaxEUR,
            })),
            huomiot:                  divs.notes,
        },

        // ── Kokonaisyhteenveto ──────────────────────────────────────────────
        yhteenveto: {
            // Pääomatulot yhteensä
            osakkeetVeiotettavaTuloEUR: round2(stocksTaxable),
            kryptotVeiotettavaTuloEUR:  round2(cryptoTaxable),
            cfdVeiotettavaTuloEUR:      cfds.taxableGainEUR,
            osinkoVeiotettavaTuloEUR:   divs.totalTaxableEUR,
            verotettavaYhteensaEUR,

            // Vero
            arvioistuKokonaisVeroEUR,
            lahdeveroHyvitysEUR,
            maksettavaVeroEUR,

            // Vähennyskelpoinen tappio (osakkeet + kryptot)
            vahennyskelponenTappioEUR:  round2(stocksDeductible + cryptoDeductible),

            // Mitä lomakkeita täytetään
            lomakkeet: buildLomakeList(stocks, crypto, cfds, divs,
                stocksTaxable, cryptoTaxable, stocksDeductible, cryptoDeductible),

            // Kaikki huomiot koottuna
            huomiot: [
                ...stocks.notes,
                ...crypto.notes,
                ...cfds.notes,
                ...divs.notes,
            ],
        },
    };
}

function resolveVeovuosi(closedPositions, dividends) {
    // Verovuosi = sulkupäivien vuosi (verotettava tulo syntyy sulkuhetkellä)
    const years = new Set();
    for (const p of closedPositions) {
        if (p.closeDate) years.add(p.closeDate.slice(0, 4));
    }
    for (const d of dividends) {
        if (d.paymentDate) years.add(d.paymentDate.slice(0, 4));
    }
    // Palauta korkein vuosi (viimeisin verovuosi)
    return years.size > 0 ? Math.max(...[...years].map(Number)) : null;
}

function buildSmallSalesReason(gainExemption, lossNonDeductible,
    salePriceEUR, acquisitionEUR) {
    const parts = [];
    if (gainExemption) {
        parts.push(
            `Voitot verovapaita (TVL 48 §): myyntihinnat yhteensä ${salePriceEUR.toFixed(2)} € ≤ 1 000 €`
        );
    }
    if (lossNonDeductible) {
        parts.push(
            `Tappiot vähennyskelvottomia (TVL 50 §): hankintamenot yhteensä ${acquisitionEUR.toFixed(2)} € ≤ 1 000 €`
        );
    }
    return parts.length > 0 ? parts.join('. ') : null;
}

function buildLomakeList(stocks, crypto, cfds, divs,
    stocksTaxable, cryptoTaxable, stocksDeductible, cryptoDeductible) {
    const lomakkeet = [];
    if (stocks.positions.length > 0 && (stocksTaxable > 0 || stocksDeductible < 0)) {
        lomakkeet.push({
            lomake: '9A',
            kuvaus: 'Arvopaperien luovutusvoitot ja -tappiot (osakkeet)',
            ilmoitettavaTuloEUR: round2(stocksTaxable),
        });
    }
    if (crypto.positions.length > 0 && (cryptoTaxable > 0 || cryptoDeductible < 0)) {
        lomakkeet.push({
            lomake: '9A',
            kuvaus: 'Arvopaperien luovutusvoitot ja -tappiot (kryptot)',
            ilmoitettavaTuloEUR: round2(cryptoTaxable),
        });
    }
    if (cfds.taxableGainEUR > 0) {
        lomakkeet.push({
            lomake: '7805',
            kuvaus: 'CFD-sopimusten voitot (suorituslaji 2D)',
            ilmoitettavaTuloEUR: cfds.taxableGainEUR,
        });
    }
    if (divs.totalGrossEUR > 0) {
        lomakkeet.push({
            lomake: '16B',
            kuvaus: 'Ulkomaiset pääomatulot (osingot)',
            ilmoitettavaTuloEUR: divs.totalTaxableEUR,
        });
    }
    return lomakkeet;
}

function isinToCountryName(code) {
    const map = {
        FI: 'Suomi', US: 'Yhdysvallat', GB: 'Iso-Britannia',
        DE: 'Saksa', FR: 'Ranska', SE: 'Ruotsi', NO: 'Norja',
        DK: 'Tanska', NL: 'Alankomaat', IT: 'Italia', ES: 'Espanja',
        CH: 'Sveitsi', AU: 'Australia', CA: 'Kanada', JP: 'Japani',
    };
    return map[code] ?? code;
}
