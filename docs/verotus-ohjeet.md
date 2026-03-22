# Verohallinnon ohjeet ulkomaisten osakkeiden ja sijoitusten verotuksesta Suomessa

Tämä selvitys perustuu vero.fi-sivuston virallisiin ohjeisiin (tilanne maaliskuu 2026, verovuosi 2025).

---

## 1. Ulkomaisten osinkojen ilmoittaminen

### Verotusperiaate

Ulkomaisten osinkojen verotus riippuu siitä, mistä maasta osinko tulee:

**EU/ETA-maista ja verosopimuskohteista saadut osingot** verotetaan samalla tavalla kuin suomalaiset osingot:
- Pörssilistatusta yhtiöstä: **85 % on veronalaista pääomatuloa, 15 % on verovapaata**
- Listaamattomasta yhtiöstä: jaetaan pääoma- ja ansiotuloksi osakkeiden matemaattisen arvon tai käyvän markkina-arvon perusteella (8 %:n vuotuinen tuotto)

**EU/ETA-alueen ulkopuolisista maista, joista ei ole verosopimusta:** osingot ovat **pääsääntöisesti kokonaan veronalaista tuloa**.

Tärkeä huomio: Ulkomaisesta yhtiöstä saadusta osingosta ei automaattisesti pidätetä suomalaista ennakonpidätystä, mutta lähdevaltio voi pidättää lähdeveron.

### Lomakkeet ja kentät

| Lomake | Käyttötarkoitus |
|--------|-----------------|
| **16B** (Selvitys ulkomaisista tuloista, pääomatulot) | **Ensisijainen lomake ulkomaisten osinkojen ilmoittamiseen** |
| **50B** (Pääomatulot ja vähennykset) | Kotimaiset osingot; ulkomaisista käytetään 16B:tä |

**Lomakkeessa 16B täytettävät kentät osinkojen osalta:**
- Lähtömaa
- Osingonmaksajayhtiön nimi
- Osingon bruttomäärä euroina
- Onko yhtiö pörssilistattu vai listaamaton
- Listaamattomista: osakkeiden lukumäärä ja käypä arvo
- Ulkomailla maksettu lähdevero (bruttomäärästä, euroina)

**OmaVerossa** osingot ilmoitetaan kohdassa "Ulkomaiset tulot – Muut ulkomaiset pääomatulot".

### Käytännön ohje eToro-käyttäjälle (esim. USA-osakkeet)
- eToro pidättää USA-osakkeista tyypillisesti **30 %:n lähdeveron** (tai verosopimuksen mukaisen 15 %:n, jos W-8BEN-lomake on täytetty)
- Ilmoita osingot **bruttomääräisinä euroina** lomakkeella 16B
- Ilmoita pidätetty lähdevero – se voidaan hyvittää Suomen verotuksessa (ks. kohta 5)

---

## 2. Osakkeiden myyntivoittojen ja -tappioiden laskeminen ja ilmoittaminen

### Laskentakaava

```
Myyntivoitto/tappio = Myyntihinta − hankintameno − kaupankäyntikulut
```

**Myyntihinta:** Saatu kauppahinta (tai vaihtoarvo)

**Hankintameno sisältää:**
- Osakkeiden ostohinta
- Välityspalkkiot (brokerage fees)
- Varainsiirtovero (suomalaisista osakkeista)

**Kaupankäyntikulut sisältävät:**
- Myyntiin liittyvät välityspalkkiot
- Muut myyntikulut

**Vaihtoehtona:** Hankintameno-olettama (ks. kohta 4)

### Verokannat

| Pääomatulo yhteensä | Verokanta |
|---------------------|-----------|
| Enintään 30 000 € | **30 %** |
| Yli 30 000 € | **34 %** |

### Pienien myyntien verovapaus

Kaksi erillistä sääntöä:

- **TVL 48 §:** Jos kaikkien osakkeiden + kryptojen **yhteenlaskettu myyntihinta** kalenterivuoden aikana on **enintään 1 000 €**, myyntivoitto on verovapaata.
- **TVL 50 §:** Jos kaikkien osakkeiden + kryptojen **yhteenlasketut hankintamenot** kalenterivuoden aikana ovat **enintään 1 000 €**, tappiot eivät ole vähennyskelpoisia.

Nämä ovat **kaksi erillistä kynnysarvoa** – myyntihinnat voivat olla alle rajan (voitot verovapaita) samaan aikaan kun hankintamenot ylittävät rajan (tappiot silti vähennyskelpoisia).

### FIFO-periaate

Arvo-osuusjärjestelmässä olevat osakkeet katsotaan myydyiksi siinä järjestyksessä kuin ne on hankittu: **ensimmäisenä ostettu myydään ensin (First In – First Out)**. Tätä sovelletaan tilin sisällä.

### Tappioiden vähentäminen

- Myyntitappiot vähennetään ensin myyntivoitoista, sitten muista pääomatuloista
- Jos tappioita ei voida vähentää verovuonna, ne siirretään **seuraavalle 5 vuodelle**
- Tappioita ei voi vähentää jos hankintamenot yhteensä ≤ 1 000 € (TVL 50 §)

### Lomake ja ilmoittaminen

**Lomake 9A** (Arvopaperien luovutusvoitot ja -tappiot) on ensisijainen lomake sekä kotimaisille että ulkomaisille pörssiosakkeille.

**Lomakkeen 9A täytettävät kentät kullekin kaupalle:**
- 3.1 Arvopaperin nimi (yhtiö ja osaketyyppi)
- 3.2 Myyty kappalemäärä
- 3.3 Myyntipäivä
- 3.4 Hankintapäivä
- 3.5 Myyntihinta
- 3.6 Myyntikulut (välityspalkkiot)
- 3.7 Hankintahinta
- 3.8 Hankintakulut
- 3.9 Hankintameno-olettama (vaihtoehto todelliselle hankintamenolle)
- 3.10–3.11 Luovutusvoitto tai -tappio
- Yhteenveto: kaikkien arvopaperimyyntien yhteenlaskettu myyntihinta ja voitot/tappiot

**OmaVerossa** kaupat ilmoitetaan kohdassa "Arvopaperien myyntivoitot ja -tappiot".

**Tärkeä huomio:** Ulkomaisilla pörssiosakkeilla käydyt kaupat ilmoitetaan lomakkeella **9A** (ei 16B:llä). Lomaketta 16B käytetään vain osingoille ja muille ulkomaisille pääomatuloille.

---

## 3. Valuuttakurssimuunnos (EUR-muunnos)

### Perusperiaate

Kaikki ulkomaisessa valuutassa tehdyt kaupat muunnetaan euroiksi **kaupantekopäivän kurssilla**:

- **Hankintahinta:** muunnetaan euroiksi ostohetken valuuttakurssilla
- **Myyntihinta:** muunnetaan euroiksi myyntihetken valuuttakurssilla

Näin valuuttakurssin muutos vaikuttaa automaattisesti laskettavaan voittoon tai tappioon.

### Käytettävät kurssit

Verohallinto julkaisee **vuosikeskikurssit** ohjeistuksessa, jotka perustuvat **Suomen Pankin tietoihin**.

Käytännössä voidaan käyttää:
- **Euroopan keskuspankin (EKP) päiväkurssia** kaupantekopäivältä (suositeltava tarkkuuden vuoksi)
- Verohallinnon julkaisemaa vuosikeskikurssia, kun päiväkurssia ei ole saatavilla

### Käytännön ohje

eToro-kaupat käydään usein USD:ssä. Jokaisen kaupan osto- ja myyntihinnat tulee muuntaa euroiksi vastaavien päivien kursseja käyttäen.

Valuuttakurssit 2025: https://www.vero.fi/syventavat-vero-ohjeet/ohje-hakusivu/49083/valuuttakurssit-2025/

---

## 4. Hankintameno-olettaman säännöt

### Milloin voi käyttää

Hankintameno-olettamaa voidaan käyttää **aina** todellisen hankintamenon sijasta – se on vapaaehtoinen vaihtoehto. Verovelvollinen valitsee itselleen edullisemman vaihtoehdon.

**Rajoitus:** Jos käyttää hankintameno-olettamaa, **ei voi vähentää todellisia hankintakuluja eikä myyntikuluja** erikseen.

### Prosentit omistusajan mukaan

| Omistusaika | Hankintameno-olettama |
|-------------|----------------------|
| **Alle 10 vuotta** | **20 % myyntihinnasta** |
| **Vähintään 10 vuotta** | **40 % myyntihinnasta** |

### Esimerkki

Osake ostettu 2020, myyty 2025 (omistusaika alle 10 v):
- Myyntihinta: 10 000 €
- Hankintameno-olettama: 20 % × 10 000 € = **2 000 €**
- Verotettava voitto: 10 000 € − 2 000 € = **8 000 €**

Jos todelliset kulut olivat esim. 7 000 €, todellinen menetelmä olisi edullisempi (voitto vain 3 000 €). Verovelvollinen voi valita kumpaa tahansa menetelmää.

### Lomakkeella 9A

Hankintameno-olettama merkitään kenttään **3.9** – tällöin kentät 3.7 (hankintahinta) ja 3.8 (hankintakulut) jätetään tyhjiksi.

---

## 5. Ulkomaisen lähdeveron hyvitys

### Perusperiaate

Ulkomailla pidätetty lähdevero on pääsääntöisesti **hyvitettävissä Suomessa** (hyvitysmenetelmä / credit method). Hyvitys vähennetään Suomessa maksettavasta verosta samasta tulosta.

### Hyvityksen enimmäismäärä

Hyvitys **ei voi ylittää** sitä veroa, jonka Suomi olisi perinyt samasta tulosta:

```
Enimmäishyvitys = Suomalainen pääomatulovero × (ulkomaisesta lähteestä saatu nettotulo / pääomatulot yhteensä)
```

**Käytännön esimerkki:**
- Ulkomaisia osinkoja: 5 000 €
- Ulkomainen lähdevero maksettu: 1 500 € (30 %)
- Suomessa sama tulo olisi verotettu: 1 300 €
- Hyvitys: **1 300 €** (ei 1 500 €, koska hyvitys ei ylitä Suomen veroa)

### Verosopimuksen mukainen enimmäislähdeveroaste

Useimmissa verosopimuksissa (esim. USA–Suomi) lähdevero on rajoitettu **15 %:iin osingon bruttomäärästä**. Jos lähdevaltio on pidättänyt enemmän (esim. 30 %), hyvitetään vain sopimuksen mukainen määrä (15 %). Ylimääräinen osa haetaan takaisin lähdemaasta (esim. USA:ssa W-8BEN-menettelyllä).

### Käyttämätön hyvitys

Jos ulkomainen vero ylittää enimmäismäärän, ylimäärä voidaan siirtää **seuraavalle 5 verovuodelle** saman tulolähteen veroja vastaan.

### Ilmoittaminen

- **Lomakkeella 16B:** Ilmoita osingon bruttomäärä ja ulkomailla maksettu lähdevero
- Verohallinto laskee hyvityksen automaattisesti verotuspäätöksessä

### Dokumentaatio

Säilytä todistus ulkomailla maksetusta lähdeverosta (esim. eToro-vuosiraportti). Tietoa ei tarvitse liittää ilmoitukseen, mutta se pitää esittää pyydettäessä.

---

## 6. CFD-instrumenttien verotus

### Verotusluonne

CFD-sopimuksista (hinnanerosopimuksista) saatu positiivinen hinnanerotus on **tuloverolain 32 §:n mukaista pääomatuloa** (KVL 80/2009).

Verokannat:
- Enintään 30 000 €: **30 %**
- Yli 30 000 €: **34 %**

### KRIITTINEN ERO muihin sijoitusinstrumentteihin

| Instrumentti | Tappioiden vähennyskelpoisuus |
|--------------|-------------------------------|
| Pörssiosakkeet | Kyllä – vähennetään muista pääomatuloista (5 v. siirto) |
| Säänneltyjen markkinoiden optiot/termiinit | Kyllä |
| **CFD-sopimukset** | **EI – tappiot ovat täysin vähennyskelvoittomia** |
| OTC-johdannaiset | Ei |

**Varoitus:** CFD-tappiot ovat **kokonaan vähennyskelvoittomia** TVL 54 §:n nojalla. Sijoittaja voi menettää kaikki sijoittamansa varat ja silti joutua maksamaan veroja voitollisista positioista.

### Ilmoittaminen

CFD-voitot **eivät ilmoiteta lomakkeella 9A**, vaan:

- **Lomake 7805** (Vuosi-ilmoitus tuloverolain mukaisista koroista ja jälkimarkkinahyvityksistä)
- **Suorituslaji:** 2D "Muu korko tai pääomatulo"
- **OmaVerossa:** "Ulkomaiset tulot – Muut ulkomaiset pääomatulot"

**Tappioita ei ilmoiteta lainkaan** – niistä ei saa verovähennystä.

### Johdannaiset säännellyillä markkinoilla (ero CFD:hen)

Säännellyillä markkinoilla käydyt standardioptiot ja -termiinit eroavat CFD:stä: niiden tappiot ovat vähennyskelpoisia TVL 50 §:n mukaan ja siirtyvät 5 vuodelle eteenpäin.

---

## 7. eToro-erityiskysymykset

### Ilmoitusvelvollisuus

eToro **ei toimita tietoja automaattisesti** Suomen Verohallinnolle. **Sijoittajan itse täytyy ilmoittaa kaikki kaupat.** eToro tarjoaa vuosiraportin (Account Statement), jonka tiedot tulee siirtää veroilmoitukseen.

Verohallinto saa tietoja automaattisen tietojenvaihdon kautta (DAC2/CRS-direktiivi), joten tiedot on syytä ilmoittaa oikein.

### Käytännön veroilmoittaminen eToro-kaupoista

**Osakekaupat:**
1. Laske myyntivoitto/tappio jokaiselle kaupalle erikseen (FIFO-periaate per osake)
2. Muunna USD-hinnat euroiksi kaupantekopäivän kurssilla (EKP)
3. Ilmoita lomakkeella **9A**

**Osingot:**
1. Muunna bruttoosinko euroiksi maksupäivän kurssilla
2. Ilmoita lomakkeella **16B** (bruttomäärä + pidätetty lähdevero)
3. USA-osakkeista tyypillisesti pidätetään 15 % tai 30 % lähdeveroa

**CFD-kaupat:**
1. Laske jokaisen CFD-position nettovoitto erikseen
2. Ilmoita vain voitot – tappioita ei ilmoiteta eikä ne ole vähennyskelpoisia
3. Ilmoita lomakkeella **7805** tai OmaVerossa "Muut pääomatulot"

### Ennakkoveron maksaminen

Koska eToro ei pidätä suomalaista ennakonpidätystä myyntivoitoista, kannattaa hakea **ennakkovero** tai **lisäennakkovero** OmaVeron kautta (lomake 5010). Maksamattomalle verolle kertyy viivästyskorkoa.

### Asiakirjojen säilytysaika

Kaikki kaupankäyntiin liittyvät asiakirjat (kauppavahvistukset, eToro-raportit, valuuttakurssilaskelmat) on säilytettävä **6 vuotta** verovuotta seuraavan vuoden alusta.

---

## Lomakkeet yhteenvetona

| Lomake | Käyttötarkoitus |
|--------|-----------------|
| **9A** | Pörssiosakkeiden myyntivoitot ja -tappiot (kotimaiset ja ulkomaiset listatut osakkeet) |
| **16B** | Ulkomaiset pääomatulot: osingot, vuokratulot, muut |
| **50B** | Kotimaiset osingot ja pääomatulot/vähennykset |
| **7805** | CFD-voitot (suorituslaji 2D) |
| **9** | Kiinteistöt ja listaamattomat osakkeet |

---

## Lähteet

- [Osakkeiden myynti – vero.fi](https://www.vero.fi/en/individuals/property/investments/selling-shares/)
- [Sijoitusten ilmoittaminen – vero.fi](https://www.vero.fi/en/individuals/property/investments/report-the-information-on-your-investments/)
- [Ulkomaiset osingot – vero.fi](https://www.vero.fi/en/individuals/property/investments/dividends/foreign-dividends/)
- [CFD-sopimukset – vero.fi](https://www.vero.fi/en/individuals/property/investments/ukk/i-invested-in-a-contract-for-difference-cfd.-how-do-i-report-the-profits-on-my-tax-return-may-i-deduct-the-losses)
- [Johdannaisten verotus – vero.fi](https://www.vero.fi/syventavat-vero-ohjeet/ohje-hakusivu/48914/johdannaisten-verotus2/)
- [Osinkotulojen verotus – vero.fi](https://www.vero.fi/syventavat-vero-ohjeet/ohje-hakusivu/47901/osinkotulojen-verotus5/)
- [Arvopaperien luovutusten verotus – vero.fi](https://www.vero.fi/syventavat-vero-ohjeet/ohje-hakusivu/48262/arvopaperien-luovutusten-verotus4/)
- [Kansainvälinen kaksinkertainen verotus – vero.fi](https://www.vero.fi/en/detailed-guidance/guidance/77657/relief-for-international-double-taxation-in-natural-persons-tax-assessment/)
- [Valuuttakurssit 2025 – vero.fi](https://www.vero.fi/syventavat-vero-ohjeet/ohje-hakusivu/49083/valuuttakurssit-2025/)
- [Lomake 9A täyttöohjeet – vero.fi](https://www.vero.fi/en/About-us/contact-us/forms/filling-instructions/9a-capital-gains-and-capital-losses-from-trading-with-securities---instructions/)
- [Lomake 16B täyttöohjeet – vero.fi](https://www.vero.fi/en/About-us/contact-us/forms/filling-instructions/16b-statement-on-foreign-income-capital-income--instructions2/)
