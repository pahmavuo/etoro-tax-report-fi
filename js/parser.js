/**
 * eToro Account Statement -tiedoston parsiminen.
 * Toimii sekä selaimessa (ES-moduuli) että Node.js:ssä.
 */

import * as XLSX from '../lib/xlsx.mjs';

const CLOSED_POSITIONS_SHEET = 'Closed Positions';
const DIVIDENDS_SHEET        = 'Dividends';

/**
 * Parsii eToro Excel-tiedoston ArrayBufferista ja palauttaa Closed Positions -datan.
 *
 * @param {ArrayBuffer} arrayBuffer - Excel-tiedoston sisältö binäärinä
 * @returns {Object} { closedPositions: ClosedPosition[] }
 */
export function parseAccountStatement(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array', raw: true });

    if (!workbook.SheetNames.includes(CLOSED_POSITIONS_SHEET)) {
        throw new Error(`Sheetti "${CLOSED_POSITIONS_SHEET}" puuttuu tiedostosta`);
    }
    if (!workbook.SheetNames.includes(DIVIDENDS_SHEET)) {
        throw new Error(`Sheetti "${DIVIDENDS_SHEET}" puuttuu tiedostosta`);
    }

    const closedPositions = parseClosedPositions(workbook.Sheets[CLOSED_POSITIONS_SHEET]);
    const dividends       = parseDividends(workbook.Sheets[DIVIDENDS_SHEET]);

    return { closedPositions, dividends };
}

/**
 * Parsii Closed Positions -sheetin riveiksi.
 *
 * @param {Object} sheet - SheetJS-worksheetti
 * @returns {ClosedPosition[]}
 */
function parseClosedPositions(sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    return rows.map((row, index) => {
        return {
            positionId:       toString(row['Position ID']),
            action:           toString(row['Action']),
            longShort:        toString(row['Long / Short']),
            amount:           toFloat(row['Amount']),
            units:            toFloat(row['Units / Contracts']),
            openDate:         parseDate(row['Open Date']),
            closeDate:        parseDate(row['Close Date']),
            leverage:         toInt(row['Leverage']),
            spreadFeesUSD:    toFloat(row['Spread Fees (USD)']),
            marketSpreadUSD:  toFloat(row['Market Spread (USD)']),
            profitUSD:        toFloat(row['Profit(USD)']),
            profitEUR:        toFloat(row['Profit(EUR)']),
            fxRateOpen:       toFloat(row['FX rate at open (USD)']),
            fxRateClose:      toFloat(row['FX rate at close (USD)']),
            openRate:         toFloat(row['Open Rate']),
            closeRate:        toFloat(row['Close Rate']),
            takeProfitRate:   toFloatOrNull(row['Take profit rate']),
            stopLossRate:     toFloatOrNull(row['Stop loss rate']),
            overnightFees:    toFloat(row['Overnight Fees and Dividends']),
            copiedFrom:       toStringOrNull(row['Copied From']),
            type:             toString(row['Type']),
            isin:             toStringOrNull(row['ISIN']),
            notes:            toStringOrNull(row['Notes']),
        };
    });
}

/**
 * Parsii Dividends-sheetin riveiksi.
 *
 * @param {Object} sheet - SheetJS-worksheetti
 * @returns {Dividend[]}
 */
function parseDividends(sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    return rows.map(row => {
        const netDividendUSD    = toFloat(row['Net Dividend Received (USD)']);
        const withholdingTaxUSD = toFloat(row['Withholding Tax Amount (USD)']);

        return {
            paymentDate:          parseDateShort(row['Date of Payment']),
            instrumentName:       toString(row['Instrument Name']),
            isin:                 toStringOrNull(row['ISIN']),
            positionId:           toString(row['Position ID']),
            type:                 toString(row['Type']),
            netDividendUSD,
            withholdingTaxUSD,
            grossDividendUSD:     round2(netDividendUSD + withholdingTaxUSD),
            withholdingTaxRatePct: parseWithholdingRate(row['Withholding Tax Rate (%)']),
        };
    });
}

// --- Apufunktiot ---

function toString(val) {
    return val != null ? String(val).trim() : '';
}

function toStringOrNull(val) {
    if (val == null || String(val).trim() === '') return null;
    return String(val).trim();
}

function toFloat(val) {
    if (val == null) return 0;
    const n = parseFloat(String(val).replace(',', '.'));
    return isNaN(n) ? 0 : n;
}

function toFloatOrNull(val) {
    if (val == null || String(val).trim() === '') return null;
    const n = parseFloat(String(val).replace(',', '.'));
    return isNaN(n) ? null : n;
}

function toInt(val) {
    if (val == null) return 0;
    const n = parseInt(String(val), 10);
    return isNaN(n) ? 0 : n;
}

/**
 * Parsii lähdeveroasteen merkkijonosta "15 %" → 15.0
 */
function parseWithholdingRate(val) {
    if (val == null) return 0;
    const n = parseFloat(String(val).replace('%', '').replace(',', '.').trim());
    return isNaN(n) ? 0 : n;
}

function round2(n) {
    return Math.round(n * 100) / 100;
}

/**
 * Parsii päivämäärän muodosta "DD/MM/YYYY" (ilman kellonaikaa).
 * Palauttaa "YYYY-MM-DD" tai null.
 */
function parseDateShort(val) {
    if (val == null) return null;
    const s = String(val).trim();
    const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
        const [, dd, mm, yyyy] = match;
        return `${yyyy}-${mm}-${dd}`;
    }
    return s;
}

/**
 * Parsii päivämäärän muodosta "DD/MM/YYYY HH:MM:SS" tai vastaavasta.
 * Palauttaa ISO 8601 -merkkijonon (YYYY-MM-DDTHH:MM:SS) tai null.
 */
function parseDate(val) {
    if (val == null) return null;
    const s = String(val).trim();
    if (s === '') return null;

    // Muoto: "24/03/2025 13:35:04"
    const match = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})$/);
    if (match) {
        const [, dd, mm, yyyy, time] = match;
        return `${yyyy}-${mm}-${dd}T${time}`;
    }

    // Palautetaan sellaisenaan jos muoto ei tunnettu
    return s;
}
