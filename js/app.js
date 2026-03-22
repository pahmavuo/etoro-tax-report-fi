import { parseAccountStatement }               from './parser.js';
import { generateTaxReport }                  from './tax-calculator.js';
import { fetchEcbRates, getRequiredDateRange } from './ecb-rates.js';

// ── Tiedoston valinta ────────────────────────────────────────────────────
const input    = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');

input.addEventListener('change', e => handleFile(e.target.files[0]));

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', ()  => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFile(e.dataTransfer.files[0]);
});

async function handleFile(file) {
  if (!file) return;
  if (!file.name.endsWith('.xlsx')) { showError('Valitse .xlsx-tiedosto.'); return; }

  document.getElementById('file-name').textContent = `📄 ${file.name}`;
  showSpinner(true);
  hideError();
  document.getElementById('results').style.display = 'none';

  try {
    const buffer = await file.arrayBuffer();
    const { closedPositions, dividends } = parseAccountStatement(buffer);
    const range = getRequiredDateRange(closedPositions, dividends);
    const ecbRates = await fetchEcbRates(range.startDate, range.endDate);
    const report = generateTaxReport(closedPositions, dividends, ecbRates);
    renderReport(report);
    document.getElementById('pdf-btn').style.display = 'block';
  } catch (err) {
    showError('Virhe tiedoston käsittelyssä: ' + err.message);
  } finally {
    showSpinner(false);
  }
}

// ── Raportin renderöinti ─────────────────────────────────────────────────
function renderReport(r) {
  const el = document.getElementById('results');
  el.innerHTML = [
    renderHeader(r),
    renderYhteenveto(r.yhteenveto),
    renderLomake9A(r.lomake9A),
    renderLomakeKrypto(r.lomakeKrypto),
    renderLomake7805(r.lomake7805),
    renderLomake16B(r.lomake16B),
    renderHuomiot(r.yhteenveto.huomiot),
  ].join('');
  el.style.display = 'block';
}

// ── Header ───────────────────────────────────────────────────────────────
function renderHeader(r) {
  return `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h3 class="mb-0 fw-bold">Veroilmoitusohje</h3>
        <div class="text-muted small">Verovuosi ${r.verovuosi} &nbsp;·&nbsp; Generoitu ${r.generoitu}</div>
      </div>
      <div class="text-end">
        ${r.yhteenveto.lomakkeet.map(l =>
          `<span class="badge bg-primary badge-lomake ms-1">Lomake ${l.lomake}</span>`
        ).join('')}
        ${r.yhteenveto.lomakkeet.length === 0
          ? '<span class="badge bg-success badge-lomake">Ei ilmoitettavaa</span>' : ''}
      </div>
    </div>`;
}

// ── Yhteenveto ───────────────────────────────────────────────────────────
function renderYhteenveto(y) {
  const disclaimer = `
    <p class="text-muted small mb-3">
      Käyttäjä vastaa itse veroilmoituksensa oikeellisuudesta. Tarkista laskelmat ja
      tarvittaessa konsultoi veroasiantuntijaa. Voit raportoida mahdolliset virheet
      <a href="https://github.com/pahmavuo/etoro-tax-report-fi/issues" target="issues">täällä</a>.
    </p>`;
  const rows = [
    ['Osakkeet – verotettava tulo', y.osakkeetVeiotettavaTuloEUR],
    ...(y.kryptotVeiotettavaTuloEUR !== undefined
      ? [['Kryptovaluutat – verotettava tulo', y.kryptotVeiotettavaTuloEUR]]
      : []),
    ['CFD-sopimukset – verotettava tulo', y.cfdVeiotettavaTuloEUR],
    ['Osingot – verotettava tulo (85 %)', y.osinkoVeiotettavaTuloEUR],
  ];
  const tappio = y.vahennyskelponenTappioEUR < 0
    ? `<tr class="table-warning"><td>Vähennyskelpoinen tappio (siirtyy 5 v.)</td>
       <td class="text-end euro">${eur(y.vahennyskelponenTappioEUR)}</td></tr>` : '';

  return `
    <div class="card shadow-sm section-card status-fill">
      <div class="card-header bg-primary text-white fw-semibold">Yhteenveto – maksettava vero</div>
      <div class="card-body p-0">
        <table class="table table-sm mb-0">
          <tbody>
            ${rows.map(([label, val]) => `
              <tr>
                <td class="ps-3">${label}</td>
                <td class="text-end pe-3 euro">${eur(val)}</td>
              </tr>`).join('')}
            <tr class="table-light fw-semibold">
              <td class="ps-3">Verotettava tulo yhteensä</td>
              <td class="text-end pe-3 euro">${eur(y.verotettavaYhteensaEUR)}</td>
            </tr>
            <tr>
              <td class="ps-3">Arvioitu vero (30 / 34 %)</td>
              <td class="text-end pe-3 euro">${eur(y.arvioistuKokonaisVeroEUR)}</td>
            </tr>
            <tr>
              <td class="ps-3">Lähdeveron hyvitys</td>
              <td class="text-end pe-3 euro text-success">− ${eur(y.lahdeveroHyvitysEUR)}</td>
            </tr>
            ${tappio}
            <tr class="table-primary fw-bold">
              <td class="ps-3">Maksettava vero yhteensä</td>
              <td class="text-end pe-3 euro">${eur(y.maksettavaVeroEUR)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    ${disclaimer}`;
}

// ── Lomake 9A ────────────────────────────────────────────────────────────
function renderLomake9A(a) {
  if (!a.ilmoitettava) {
    return `
      <div class="card shadow-sm section-card status-skip">
        <div class="card-body">
          <div class="d-flex align-items-center gap-2">
            <span class="fs-4">✅</span>
            <div>
              <div class="fw-semibold">Lomake 9A – Arvopaperien luovutusvoitot ja -tappiot</div>
              <div class="text-muted small">${a.eiIlmoitetaSyy}</div>
              <div class="text-muted small mt-1">
                Myyntihinnat: ${eur(a.myyntihinnatYhteensaEUR)} &nbsp;·&nbsp;
                Voitot: ${eur(a.voitotYhteensaEUR)} &nbsp;·&nbsp;
                Tappiot: ${eur(a.tappiotYhteensaEUR)}
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="card shadow-sm section-card status-fill">
      <div class="card-header fw-semibold">📋 Lomake 9A – Arvopaperien luovutusvoitot ja -tappiot</div>
      <div class="card-body p-0">
        <table class="table table-sm mb-0">
          <tbody>
            ${row9A('Myyntihinnat yhteensä (9A kohta 2.1)', a.myyntihinnatYhteensaEUR)}
            ${row9A('Hankintamenot yhteensä', a.hankintamenotYhteensaEUR)}
            ${row9A('Voitot yhteensä', a.voitotYhteensaEUR)}
            ${row9A('Tappiot yhteensä', a.tappiotYhteensaEUR)}
            ${row9A('Verotettava luovutusvoitto (9A kohta 2.3)', a.verotettavaTuloEUR, true)}
            ${a.vahennyskelponenTappioEUR < 0
              ? row9A('Vähennyskelpoinen tappio (9A kohta 2.4)', a.vahennyskelponenTappioEUR, true)
              : ''}
          </tbody>
        </table>
      </div>
      <div class="card-footer text-muted small">
        eToro Account Statement liitetään ilmoitukseen (${a.positiot.length} positiota).
      </div>
    </div>`;
}

function row9A(label, val, bold = false) {
  return `<tr${bold ? ' class="table-light fw-semibold"' : ''}>
    <td class="ps-3">${label}</td>
    <td class="text-end pe-3 euro">${eur(val)}</td>
  </tr>`;
}

// ── Kryptovaluutat (Lomake 9A) ───────────────────────────────────────────
function renderLomakeKrypto(k) {
  if (k.positiot.length === 0) return '';
  if (!k.ilmoitettava) {
    return `
      <div class="card shadow-sm section-card status-skip">
        <div class="card-body">
          <div class="d-flex align-items-center gap-2">
            <span class="fs-4">✅</span>
            <div>
              <div class="fw-semibold">Lomake 9A – Kryptovaluuttojen luovutusvoitot ja -tappiot</div>
              <div class="text-muted small">${k.eiIlmoitetaSyy}</div>
              <div class="text-muted small mt-1">
                Myyntihinnat: ${eur(k.myyntihinnatYhteensaEUR)} &nbsp;·&nbsp;
                Voitot: ${eur(k.voitotYhteensaEUR)} &nbsp;·&nbsp;
                Tappiot: ${eur(k.tappiotYhteensaEUR)}
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="card shadow-sm section-card status-fill">
      <div class="card-header fw-semibold">📋 Lomake 9A – Kryptovaluuttojen luovutusvoitot ja -tappiot</div>
      <div class="card-body p-0">
        <table class="table table-sm mb-0">
          <tbody>
            ${row9A('Myyntihinnat yhteensä (9A kohta 2.1)', k.myyntihinnatYhteensaEUR)}
            ${row9A('Hankintamenot yhteensä', k.hankintamenotYhteensaEUR)}
            ${row9A('Voitot yhteensä', k.voitotYhteensaEUR)}
            ${row9A('Tappiot yhteensä', k.tappiotYhteensaEUR)}
            ${row9A('Verotettava luovutusvoitto (9A kohta 2.3)', k.verotettavaTuloEUR, true)}
            ${k.vahennyskelponenTappioEUR < 0
              ? row9A('Vähennyskelpoinen tappio (9A kohta 2.4)', k.vahennyskelponenTappioEUR, true)
              : ''}
          </tbody>
        </table>
      </div>
      <div class="card-footer text-muted small">
        eToro Account Statement liitetään ilmoitukseen (${k.positiot.length} positiota).
        Kryptot ilmoitetaan OmaVerossa kohdassa "Virtuaalivaluuttojen luovutukset".
      </div>
    </div>`;
}

// ── Lomake 7805 ──────────────────────────────────────────────────────────
function renderLomake7805(c) {
  if (!c.ilmoitettava) {
    return `
      <div class="card shadow-sm section-card status-skip">
        <div class="card-body">
          <span class="fs-4">✅</span>
          <span class="fw-semibold ms-2">Lomake 7805 – CFD-sopimukset</span>
          <span class="text-muted ms-2 small">Ei verotettavia CFD-voittoja.</span>
        </div>
      </div>`;
  }

  const voittoRivit = c.voitollisetPositiot.map(p => `
    <tr>
      <td class="ps-3">${p.action}</td>
      <td>${p.openDate?.slice(0,10) ?? '—'}</td>
      <td>${p.closeDate?.slice(0,10) ?? '—'}</td>
      <td class="text-end euro text-success">+ ${eur(p.gainEUR)}</td>
    </tr>`).join('');

  const tappioRivit = c.tappiollisetPositiot.map(p => `
    <tr class="text-muted">
      <td class="ps-3"><s>${p.action}</s></td>
      <td>${p.openDate?.slice(0,10) ?? '—'}</td>
      <td>${p.closeDate?.slice(0,10) ?? '—'}</td>
      <td class="text-end euro">${eur(p.gainEUR)} – ei ilmoiteta</td>
    </tr>`).join('');

  return `
    <div class="card shadow-sm section-card status-fill">
      <div class="card-header fw-semibold">📋 Lomake 7805 – CFD-sopimukset (suorituslaji 2D)</div>
      <div class="card-body pb-0">
        <div class="row g-3 mb-3">
          <div class="col-sm-6">
            <div class="p-3 bg-light rounded">
              <div class="small text-muted">OmaVeroon ilmoitettava tulo</div>
              <div class="fs-4 fw-bold euro">${eur(c.verotettavaYhteensaEUR)}</div>
              <div class="small text-muted">Ulkomaiset tulot → Muut ulkomaiset pääomatulot</div>
            </div>
          </div>
          <div class="col-sm-6">
            <div class="p-3 bg-light rounded">
              <div class="small text-muted">Maksajan tiedot</div>
              <div class="fw-semibold">eToro Europe Ltd</div>
              <div class="small text-muted">Kotipaikka: Kypros &nbsp;·&nbsp; Suorituslaji: 2D</div>
            </div>
          </div>
        </div>
      </div>
      <div class="card-body p-0">
        <table class="table table-sm mb-0">
          <thead class="table-light">
            <tr>
              <th class="ps-3">Instrumentti</th>
              <th>Avattu</th>
              <th>Suljettu</th>
              <th class="text-end pe-3">Voitto EUR</th>
            </tr>
          </thead>
          <tbody>
            ${voittoRivit}
            ${tappioRivit}
          </tbody>
          <tfoot class="table-light fw-semibold">
            <tr>
              <td class="ps-3" colspan="3">Verotettava tulo yhteensä</td>
              <td class="text-end pe-3 euro">${eur(c.verotettavaYhteensaEUR)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      ${c.tappiollisetPositiot.length > 0 ? `
      <div class="card-footer text-muted small">
        ⚠️ ${c.tappiollisetPositiot.length} tappiollinen CFD-positio (${eur(c.eiVahennettavatTappiotUSD)} USD) ei ole vähennyskelpoinen (TVL 54 §) eikä sitä ilmoiteta.
      </div>` : ''}
    </div>`;
}

// ── Lomake 16B ───────────────────────────────────────────────────────────
function renderLomake16B(d) {
  if (!d.ilmoitettava) {
    return `
      <div class="card shadow-sm section-card status-skip">
        <div class="card-body">
          <span class="fs-4">✅</span>
          <span class="fw-semibold ms-2">Lomake 16B – Osingot</span>
          <span class="text-muted ms-2 small">Ei osinkoja.</span>
        </div>
      </div>`;
  }

  const rivit = d.yhtioriviit.map(r => `
    <tr>
      <td class="ps-3">${r.yhtiöNimi}</td>
      <td>${r.lahtömaa}</td>
      <td class="text-center">${r.pörssiListattu ? 'Kyllä' : 'Ei'}</td>
      <td class="text-end euro">${eur(r.bruttoOsinkoEUR)}</td>
      <td class="text-end euro">${eur(r.ulkomainenLahdevero)}</td>
      <td class="text-end euro">${eur(r.veronalainenOsuusEUR)}</td>
      <td class="text-end euro">${eur(r.hyvitysEUR)}</td>
      <td class="text-end pe-3 euro ${r.maksettavaLisaveroEUR > 0 ? 'text-danger fw-semibold' : ''}">${eur(r.maksettavaLisaveroEUR)}</td>
    </tr>`).join('');

  return `
    <div class="card shadow-sm section-card status-fill">
      <div class="card-header fw-semibold">📋 Lomake 16B – Ulkomaiset pääomatulot (osingot)</div>
      <div class="card-body pb-0">
        <div class="small text-muted mb-2">
          Täytä lomakkeelle 16B yksi rivi per yhtiö. Bruttomäärä = netto + ulkomainen lähdevero.
          Pörssilistattu yhtiö: 85 % veronalaista, 15 % verovapaata.
        </div>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-sm mb-0">
            <thead class="table-light">
              <tr>
                <th class="ps-3">Yhtiö</th>
                <th>Lähtömaa</th>
                <th class="text-center">Listattu</th>
                <th class="text-end">Brutto €</th>
                <th class="text-end">Lähdevero €</th>
                <th class="text-end">Veronalainen €</th>
                <th class="text-end">Hyvitys €</th>
                <th class="text-end pe-3">Lisävero €</th>
              </tr>
            </thead>
            <tbody>${rivit}</tbody>
            <tfoot class="table-light fw-semibold">
              <tr>
                <td class="ps-3" colspan="3">Yhteensä</td>
                <td class="text-end euro">${eur(d.bruttoYhteensaEUR)}</td>
                <td class="text-end euro">${eur(d.lahdeveroYhteensaEUR)}</td>
                <td class="text-end euro">${eur(d.veronalainenYhteensaEUR)}</td>
                <td class="text-end euro">${eur(d.lahdeveroHyvitysEUR)}</td>
                <td class="text-end pe-3 euro">${eur(d.lisaveroYhteensaEUR)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>`;
}

// ── Huomiot ──────────────────────────────────────────────────────────────
function renderHuomiot(huomiot) {
  const uniq = [...new Set(huomiot)];
  return `
    <div class="card shadow-sm section-card status-warn">
      <div class="card-header fw-semibold">⚠️ Huomiot</div>
      <ul class="list-group list-group-flush">
        ${uniq.map(h => `<li class="list-group-item small">${h}</li>`).join('')}
      </ul>
    </div>`;
}

// ── Apufunktiot ──────────────────────────────────────────────────────────
function eur(val) {
  if (val == null) return '—';
  return val.toFixed(2).replace('.', ',') + ' €';
}

function showSpinner(on) {
  document.getElementById('spinner').style.display = on ? 'block' : 'none';
}

function showError(msg) {
  const el = document.getElementById('error-box');
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError() {
  document.getElementById('error-box').style.display = 'none';
}
