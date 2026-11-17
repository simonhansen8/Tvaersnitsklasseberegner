# Tværsnitsklasseberegner

Et værktøj til at bestemme tværsnitsklassen for ståltværsnit efter Eurocode 3 (EC3). Programmet kører direkte i browseren, og hele programmet ligger i filen `index.html`.

## Sådan bruger du det

- **Online:** Når GitHub Pages er slået til, kan programmet åbnes på
  https://simonhansen8.github.io/Tvaersnitsklasseberegner/
- **På din egen computer:** Hent `index.html` og dobbeltklik på den. Så åbner den i din browser.

## Versionstjek

Øverst i programmet står der, om du har den nyeste version. Programmet sammenligner sig selv med den nyeste `index.html` på GitHub:

- **Ajour** (grøn): du har den nyeste version, og den seneste ændring (PR-nummer og dato) står ved siden af.
- **Ikke ajour** (rød): der findes en nyere version. Tryk *Genindlæs* (eller *Åbn nyeste version online*, hvis du bruger en hentet fil).
- **Kunne ikke tjekkes** (gul): ingen internetforbindelse. Programmet regner stadig som normalt.

Der skal ikke rettes noget versionsnummer i hånden, når en ændring lægges ind.

## Udskrift og PDF

Tryk *Udskriv / gem som PDF* under inputfelterne (eller brug browserens udskriv). Udskriften starter med en oversigt over inddata (profil, mål, materiale, snitkræfter, γ<sub>M0</sub>, dato og programversion) og får altid eftervisningen af tværsnitsklassen med. Serieoversigten udelades.

## Tests

Beregningskernen testes mod profiltabeller og håndregninger (tværsnitskonstanter, tabel 5.2, effektive bredder, interaktion). Testene læser kernen direkte fra `index.html` og køres automatisk på GitHub ved hver ændring. Lokalt (kræver Node.js 18 eller nyere):

```bash
node --test
```
