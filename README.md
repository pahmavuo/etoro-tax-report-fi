# eToro Tax Report

Selainpohjainen työkalu suomalaisen veroilmoituksen täyttämiseen eToro-sijoitusalustan account statement -tiedoston pohjalta. Tehty Vibe koodaamalla Claude Codella.

## Mitä sovellus tekee

Lataa eToro:n Excel-tiedoston, laskee verotettavat tulot Suomen verosäännösten mukaisesti ja tuottaa yhteenvedon täytettävistä lomakkeista:

| Lomake | Sisältö |
|--------|---------|
| **9A** | Osakekauppojen ja kryptovaluuttojen luovutusvoitot ja -tappiot |
| **7805** | CFD-sopimusten voitot (suorituslaji 2D) |
| **16B** | Ulkomaiset osingot ja lähdeveron hyvitys |

Valuuttamuunnos USD → EUR tehdään EKP:n päivittäisillä viitekursseilla, jotka haetaan automaattisesti tiedoston päivämäärävälin perusteella.

Raportti muodostetaan täysin selaimessa eli omalla koneellasi. Verotietojasi ei lähetetä mihinkään. Ainoa tieto minkä tiedoistasi vuotaa ulos on eToron raportin tapahtumien aikaväli. Sitä käytetään USD -> EUR päiväkohtaisten valuuttamuunnoskurssien hakemiseen EKP:n palvelusta.

## Käyttö

1. Muodosta eToro Account Statement halumaltasi verovuodelta. Se löytyy eTorosta Settings -> Account -> Account Statement (View). Valitse haluamasi aikarajaus, esim Last Year.
2. Luo raportti klikkaamalla Create-nappia.
3. Tallenna raportti klikkaamalla xls-ikonia.
4. Avaa sovellus osoitteessa https://pahmavuo.github.io/etoro-tax-report-fi/
   Lataa eToro:n account statement (.xlsx) sivulle
5. Sovellus laskee verot ja näyttää täytettävät lomakkeet

Raportin voi tulostaa tai tallentaa PDF:ksi selaimen tulostustoiminnolla.

## Verotussäännöt (Suomi)

### Osakekaupat ja kryptot – Lomake 9A
- Voitto/tappio = myyntihinta − hankintameno (EKP-kurssilla muutettuna)
- Tappiot ovat vähennyskelpoisia pääomatuloista (5 vuotta)
- **TVL 48 §:** jos osakkeiden + kryptojen *myyntihinnat* yhteensä ≤ 1 000 €, voitot ovat verovapaita
- **TVL 50 §:** jos osakkeiden + kryptojen *hankintamenot* yhteensä ≤ 1 000 €, tappiot ovat vähennyskelvottomia
- Nämä ovat kaksi erillistä sääntöä – voitot voivat olla verovapaita vaikka tappiot olisivat vähennyskelpoisia

### CFD-sopimukset – Lomake 7805
- Vain voitot ilmoitetaan (suorituslaji 2D)
- **Tappiot ovat kokonaan vähennyskelvoittomia (TVL 54 §)**

### Osingot – Lomake 16B
- Pörssilistatusta yhtiöstä: 85 % veronalaista, 15 % verovapaata (TVL 33a §)
- Ilmoitetaan bruttomääräisinä euroina
- Ulkomainen lähdevero hyvitetään Suomen verosta

### Verokanta
- 30 % pääomatuloista ≤ 30 000 €
- 34 % ylimenevältä osalta

## Tekninen toteutus

- Toteutus tehty vibe koodammalla Claude Codella
- **Täysin selainpohjainen** – ei build-työkaluja, ei npm-riippuvuuksia
- Vanilla JavaScript ES-moduuleina
- [SheetJS](https://sheetjs.com/) Excel-lukemiseen (CDN)
- [Bootstrap 5](https://getbootstrap.com/) käyttöliittymään (CDN)
- EKP:n kurssit haetaan [EKP:n data-API:sta](https://data-api.ecb.europa.eu/) automaattisesti

## Tiedostorakenne

```
├── index.html              # Sovelluksen pääsivu
├── js/
│   ├── parser.js           # eToro Excel-tiedoston parsiminen
│   ├── tax-calculator.js   # Verolaskenta (osakkeet, kryptot, CFD, osingot)
│   ├── ecb-rates.js        # EKP-kurssien haku
│   └── test-*.js           # Node.js-testit kehitystä varten
├── lib/
│   └── xlsx.mjs            # SheetJS (lokaali kopio)
├── data/
│   └── ecb-usd-eur-rates.json  # EKP-kurssit (fallback)
└── docs/
    └── verotus-ohjeet.md   # Verohallinnon ohjeet
```

## Vastuuvapauslauseke

Tämä sovellus on apuväline oman verolaskelman hahmottamiseen. **Käyttäjä vastaa itse veroilmoituksensa oikeellisuudesta.** Tarkista laskelmat ja tarvittaessa konsultoi veroasiantuntijaa.
