# Tværsnitsklasseberegner

Et værktøj til at bestemme tværsnitsklassen for ståltværsnit efter Eurocode 3 (EC3). Programmet kører direkte i browseren, og hele programmet ligger i filen `index.html`.

## Sådan bruger du det

- **Online:** Når GitHub Pages er slået til, kan programmet åbnes på
  https://simonhansen8.github.io/Tvaersnitsklasseberegner/
- **På din egen computer:** Hent `index.html` og dobbeltklik på den. Så åbner den i din browser.

## Hvad programmet regner

- **Profiler:** valsede I/H (IPE, HEA, HEB, HEM), svejste I, T-profiler (svejste eller udskåret af IPE/HE), C/U-profiler (valsede UPE/UPN eller svejste), RHS/SHS, CHS og L-profiler.
- **Laster:** N<sub>Ed</sub>, M<sub>y,Ed</sub>, M<sub>z,Ed</sub> (dobbeltsymmetriske profiler) og V<sub>z,Ed</sub>.
- **Tværsnitsklasse** efter EN 1993-1-1 tabel 5.2 med trin-for-trin eftervisning, effektive tværsnit efter EN 1993-1-5 og tværsnitsbæreevne efter EN 1993-1-1 6.2 med γ<sub>M0</sub> efter DK NA.
- **Valgfrie regler:** reduceret slankhed (5.5.2(9)) og effektiv klasse 2 (5.5.2(11), 6.2.2.4).

Hvad programmet forudsætter og ikke dækker, står nederst på siden under *Forudsætninger*.

## Del en beregning

Tryk *Kopiér link* under inputfelterne. Linket indeholder alle indtastninger, så den, der åbner det, ser samme beregning. Bruger du en hentet fil, peger linket på den online udgave.

## Versionstjek

Øverst i programmet står der, om du har den nyeste version. Programmet sammenligner sig selv med den nyeste `index.html` på GitHub:

- **Ajour** (grøn): du har den nyeste version, og den seneste ændring (PR-nummer og dato) står ved siden af.
- **Ikke ajour** (rød): der findes en nyere version. Tryk *Genindlæs* (eller *Åbn nyeste version online*, hvis du bruger en hentet fil).
- **Kunne ikke tjekkes** (gul): ingen internetforbindelse. Programmet regner stadig som normalt.

Der skal ikke rettes noget versionsnummer i hånden, når en ændring lægges ind.

## Udskrift og PDF

Tryk *Udskriv / gem som PDF* under inputfelterne (eller brug browserens udskriv). Udskriften starter med en oversigt over inddata (profil, mål, materiale, snitkræfter, γ<sub>M0</sub>, dato og programversion) og får altid eftervisningen af tværsnitsklassen med. Serieoversigten udelades.

## Tests

Beregningskernen testes mod profiltabeller og håndregninger (tværsnitskonstanter, tabel 5.2, effektive bredder, interaktion, forskydning, bøjning om z, reduceret slankhed og effektiv klasse 2). Testene læser kernen direkte fra `index.html` og køres automatisk på GitHub ved hver ændring. Lokalt (kræver Node.js 18 eller nyere):

```bash
node --test
```
