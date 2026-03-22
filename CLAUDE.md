# eToro Tax Report – projektin ohjeet

## Projektin kuvaus

Selainkäyttöinen sovellus suomalaisen veroilmoituksen täyttämiseen eToro-sijoitusalustan account statement -dokumentin pohjalta. Sovellus lukee eToro:n Excel-tiedoston, laskee verotettavat tulot Suomen verosäännösten mukaisesti ja tuottaa yhteenvedon veroilmoitusta varten.

## Tekninen arkkitehtuuri

- **Täysin selainpohjainen** – ei Node.js:ää, ei build-työkaluja (Webpack, Vite, tms.), ei npm/yarn-riippuvuuksia
- **Vanilla JavaScript** – koodi kirjoitetaan suoraan selaimessa ajettavaksi ES-moduuleiksi tai tavallisiksi skripteiksi
- **Kirjastot ja CSS** ladataan CDN-lähteistä (esim. jsDelivr, cdnjs, unpkg)
- Ei TypeScriptiä, ei transpilointia – kirjoitettu JS ajetaan sellaisenaan
- Tiedostorakenne: staattiset HTML/JS/CSS-tiedostot, avataan suoraan selaimessa

## Hakemistorakenne

```
/
├── CLAUDE.md
├── docs/
│   └── verotus-ohjeet.md    # Verohallinnon ohjeet verotuksesta
├── samples/
│   └── etoro-account-statement-1-1-2025-12-31-2025.xlsx  # Esimerkkisyöte
└── (tuleva sovellus)
    ├── index.html
    ├── js/
    └── css/
```

## Verotussäännöt (Suomi, verovuosi 2025)

Katso tarkempi ohjeistus: `docs/verotus-ohjeet.md`

### Osakekaupat
- Lasketaan myyntivoitto/tappio per kauppa: `myyntihinta − hankintameno − kulut`
- **FIFO-periaate** (ensimmäisenä ostettu myydään ensin)
- Lomake **9A**
- Verokanta: 30 % (≤ 30 000 €) / 34 % (> 30 000 €)
- **TVL 48 §:** jos myyntihinnat yhteensä ≤ 1 000 €, voitot verovapaita
- **TVL 50 §:** jos hankintamenot yhteensä ≤ 1 000 €, tappiot vähennyskelvottomia (erillinen kynnys!)
- Tappiot vähennetään voitoista ja muista pääomatuloista; siirto 5 vuodelle

### Osingot
- EU/ETA ja verosopimuskohteista listatuista yhtiöistä: 85 % veronalaista, 15 % verovapaata
- Ilmoitetaan bruttomääräisinä euroina
- Lomake **16B**

### CFD-instrumentit
- Voitot: pääomatuloa (TVL 32 §)
- **Tappiot täysin vähennyskelvoittomia** (TVL 54 §) – ei ilmoiteta lainkaan
- Lomake **7805** (suorituslaji 2D)

### Valuuttamuunnos
- Jokainen kauppa muunnetaan euroiksi **kaupantekopäivän EKP-kurssilla**
- Hankintahinta ostohetken kurssilla, myyntihinta myyntihetken kurssilla

### Hankintameno-olettama
- Alle 10 v omistus: 20 % myyntihinnasta
- Vähintään 10 v omistus: 40 % myyntihinnasta
- Vapaaehtoinen – käytetään jos edullisempi kuin todelliset kulut

### Ulkomainen lähdevero
- Hyvitetään Suomen verosta, enintään Suomen veron suuruinen
- USA–Suomi verosopimus: enintään 15 %
- Ilmoitetaan lomakkeella 16B

## eToro Account Statement

- Tiedostomuoto: Excel (.xlsx)
- Esimerkkitiedosto: `samples/etoro-account-statement-1-1-2025-12-31-2025.xlsx`
- eToro ei ilmoita tietoja automaattisesti Verohallinnolle – käyttäjä itse vastuussa

## Kehitysohjeet

- Pidä koodi yksinkertaisena ja suoraan selaimessa ajettavana
- Käytä CDN-lähteitä kirjastoille (esim. SheetJS/xlsx Excel-lukemiseen)
- Ei moduulibundlausta – käytä ES-moduuleja (`type="module"`) tai globaaleja skriptejä
- Testaa avaamalla HTML-tiedosto suoraan selaimessa
