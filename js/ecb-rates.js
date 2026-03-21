/**
 * EKP EUR/USD -viitekurssien haku
 *
 * Pääfunktio:
 *   fetchEcbRates(startDate, endDate) → Promise<{ [date: string]: number }>
 *
 * Hakee EKP:n dataportalista päiväkohtaiset kurssit annetulle aikavälille.
 * Palauttaa objektin { 'YYYY-MM-DD': number }.
 *
 * Apufunktio:
 *   getRequiredDateRange(closedPositions, dividends)
 *     → { startDate: string, endDate: string } | null
 *
 * Poimitaan tarvittava päivämääräväli parsitusta aineistosta, jolloin
 * API-kutsu voidaan kohdistaa juuri tarvittavalle ajanjaksolla.
 */

const ECB_API_BASE =
    'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A';

/**
 * Hakee EKP:n EUR/USD-viitekurssit annetulle aikavälille.
 *
 * @param {string} startDate  'YYYY-MM-DD'
 * @param {string} endDate    'YYYY-MM-DD'
 * @returns {Promise<{[date: string]: number}>}  { 'YYYY-MM-DD': rate }
 */
export async function fetchEcbRates(startDate, endDate) {
    const url =
        `${ECB_API_BASE}?startPeriod=${startDate}&endPeriod=${endDate}&format=jsondata`;

    const resp = await fetch(url);
    if (!resp.ok) {
        throw new Error(`EKP API virhe: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json();
    return parseEcbResponse(data);
}

/**
 * Parsii EKP:n JSON-vastauksen kurssiobjektiksi.
 */
function parseEcbResponse(data) {
    const obs   = data.dataSets[0].series['0:0:0:0:0'].observations;
    const dates = data.structure.dimensions.observation[0].values;

    const rates = {};
    for (const [k, v] of Object.entries(obs)) {
        const date = dates[parseInt(k)].id;
        if (v[0] !== null) rates[date] = v[0];
    }
    return rates;
}

/**
 * Palauttaa parsitusta eToro-datasta tarvittavan päivämäärävälin
 * EKP-kurssien hakua varten.
 *
 * Mukaan otetaan:
 *  - osakekauppojen osto- ja myyntipäivät
 *  - osinkopäivät
 *
 * @param {Array} closedPositions   parseAccountStatement():n palauttama taulukko
 * @param {Array} dividends         parseAccountStatement():n palauttama taulukko
 * @returns {{ startDate: string, endDate: string } | null}
 */
export function getRequiredDateRange(closedPositions, dividends) {
    const dates = [];

    for (const p of closedPositions) {
        // Päivämäärät ovat muodossa 'YYYY-MM-DDTHH:MM:SS' – otetaan vain päivä
        if (p.openDate)  dates.push(p.openDate.slice(0, 10));
        if (p.closeDate) dates.push(p.closeDate.slice(0, 10));
    }

    for (const d of dividends) {
        // Osinkopäivät ovat jo muodossa 'YYYY-MM-DD'
        if (d.paymentDate) dates.push(d.paymentDate);
    }

    if (dates.length === 0) return null;

    return {
        startDate: dates.reduce((a, b) => (a < b ? a : b)),
        endDate:   dates.reduce((a, b) => (a > b ? a : b)),
    };
}
