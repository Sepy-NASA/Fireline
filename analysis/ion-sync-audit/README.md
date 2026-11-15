# Audyt IonCurrent i synchronizacji PSI-159

Audyt: 15 listopada 2026. Próby 21088A1, 21088B1, 21088C1.

## Wniosek

Brak spadku `IonCurrent` bezpośrednio po zaniku płomienia w obrazie występuje już
w źródłowych plikach NASA. Nie powstaje podczas eksportu ani rysowania wykresu.
Jednocześnie nazwa kanału nie wystarcza do uznania jego wartości za wiarygodny
pomiar jonizacji w tych próbach CFI-G.

Synchronizacja programowa jest zachowana: wszystkie 5790 czasów klatek odpowiada
nazwom źródłowych TIFF, a eksportowane czasy próbek odpowiadają CSV dokładnie.
Nie ma jednak podstaw do deklaracji synchronizacji aparatury z dokładnością do
jednej ekspozycji. Porównanie niezależnych sygnałów optycznych wskazuje na pozorną
różnicę około 0,1 s; podgląd i wykresy są dodatkowo odświeżane rzadziej niż pole 3D.

## Co pokazują surowe dane

Wszystkie czasy poniżej liczone są od pierwszego obrazu INTNS danej próby.

| Próba | Zanik emisji INTNS* | `extinctionMs` | Spadek MFCA3 do połowy** | Spadek IonCurrent do połowy** | Ion po zaniku obrazu |
|---|---:|---:|---:|---:|---:|
| 21088A1 | 73,258 s | 78,123 s | 81,912 s | 82,248 s | +8,990 s |
| 21088B1 | 70,628 s | 70,542 s | 78,767 s | 79,095 s | +8,467 s |
| 21088C1 | 65,290 s | 65,246 s | 73,842 s | 74,161 s | +8,871 s |

\* Operacyjna granica wykrywalności optycznej: pierwsza klatka po ostatniej
co najmniej trzyklatkowej serii powyżej zmierzonego progu 5 sigma średniej ciemnego
obrazu. Pojedyncze późniejsze zdarzenia kamery nie są uznawane za ponowny zapłon.
Nie jest to niezależny pomiar zakończenia wszystkich reakcji chemicznych.

\** Połowa pomiędzy medianą tła przed zapłonem a medianą plateau w trakcie
spalania, wyznaczona z oryginalnych próbek około 125 Hz. To kryterium pomiarowe,
nie czas polecenia zamknięcia zaworu ani dokładna chwila ustania przepływu.

- `IonCurrent` przed zapłonem ma już wartość około 3,2–3,5; w trakcie spalania
  i po zaniku obrazu około 3,68; po wyłączeniu przepływu wraca do około -1,02.
  Są to surowe wartości kanału bez zastosowanej kalibracji, a nie nA czy mikroampery.
- Korelacja Pearsona `IonCurrent` z `MFCA3FuelFlow` w całym zapisie wynosi
  odpowiednio 0,99594 / 0,99594 / 0,99585. Duża część tej korelacji wynika ze
  wspólnych przejść włączenia i wyłączenia. Nie dowodzi ona konkretnego rodzaju
  sprzężenia elektrycznego.
- Fotopowielacz `PMT1` opada wraz z emisją INTNS. Przykładowo A1 przy t=73,645 s
  ma już ciemny obraz i PMT1 około -0,0005, podczas gdy `IonCurrent` nadal wynosi
  około 3,680. To jednoczesne wartości z zarejestrowanej osi czasu.
- W nagłówkach wszystkich trzech CSV jest `EField: 0`. Dokumentacja NASA opisuje
  pomiar prądu jonowego jako część aparatury E-FIELD: napięcie na znanym rezystorze
  w obwodzie palnik–elektroda. Sam zapis kolumny w uniwersalnym CSV nie potwierdza,
  że tor pomiarowy był aktywny i skalibrowany dla CFI-G.

Najbardziej prawdopodobna interpretacja to nieaktywny lub niewiarygodny w tej
konfiguracji tor, którego zapis jest związany z działaniem przepływu/elektroniki.
Dokładnego mechanizmu (np. sprzężenia, mapowania wejścia czy konfiguracji toru)
nie da się ustalić na podstawie tych plików. Nie ma podstaw, aby utrzymywanie
plateau opisywać jako wykazany fizyczny ogon jonizacji po wygaszeniu.

Źródło opisu aparatury:
[NASA ACME Hardware, strona 2](https://www1.grc.nasa.gov/wp-content/uploads/PS-01548-ACME-info-sheet-1.pdf).
Opis jest ogólny; nie stanowi potwierdzenia konfiguracji toru w tych trzech próbach.

## Co zweryfikowano w synchronizacji

1. Odczytano 37 032 wiersze oryginalnych CSV. Kolejność czasów jest rosnąca.
   Każda próbka pokazana w aplikacji odpowiada próbce źródłowej przy dokładnie tym
   samym czasie. Maksymalna różnica wartości to 0,0000005 wynikające z zaokrąglenia.
   Nie ma zamiany kolumny ani przesunięcia wynikającego z różnego indeksowania.
2. Sprawdzono wszystkie 5790 znaczników klatek względem nazw TIFF w oryginalnych
   archiwach. Sprawdzono też wszystkie znaczniki podglądów. Manifest rekonstrukcji,
   manifest podglądów i sensory mają identyczne `timeOrigin` dla każdej próby.
3. Silnik wybiera rekonstrukcję i podgląd według tego samego `timeMs`, a wykres
   otrzymuje `timeMs / 1000`. Nie używa do sensorów dawnego sztucznego zegara FPS.
4. Porównano zmienność INTNS z PMT1, pomijając fazę ustawiania aparatury przed
   zapłonem. Najlepsze dopasowanie logarytmów sygnałów wypada przy PMT1 wyprzedzającym
   INTNS o około 70 / 100 / 110 ms. Porównanie pierwszych różnic daje około
   80 / 60 / 60 ms. Nie należy automatycznie przesuwać danych o te liczby:
   wpływ mają także inne widma, ekspozycja, odpowiedź toru i znaczenie znacznika
   czasu. To wskazówka do dalszej kalibracji, nie identyfikacja błędu zegara.
5. Eksport sensorów ma odstępy do 105 ms. Odświeżanie panelu wykresów jest
   ograniczone do około 8 Hz (odstępy co najmniej 125 ms). Podgląd kamery zachowuje
   co piątą klatkę: zwykle około 215 ms, maksymalne odstępy w zapisach wynoszą
   323 / 320 / 300 ms. Najbliższy podgląd może więc wyprzedzać lub opóźniać
   odtwarzane pole o około połowę odstępu. To wyklucza deklarację idealnej
   zgodności do jednej klatki, ale nie wyjaśnia około dziewięciu sekund plateau Ion.

Ta weryfikacja dotyczy klatek INTNS i CSV. Nie stanowi potwierdzenia wspólnego
zegara odrębnego nagrania VLC/TS; jego wyrównanie wymaga osobnego dopasowania
zdarzeń. Nie wyprowadzano przesunięcia tego filmu z samej nazwy pliku.

## Problemy w interpretacji i prezentacji

- **A1 ma niejednoznaczne `extinctionMs`.** Wartość 78,123 s odpowiada w
  przybliżeniu komunikatowi `Extinction detected: 15:28:11` w oryginalnym TP.txt,
  podczas gdy emisja INTNS zanika około 15:28:06,112. Różnica wynosi 4,865 s.
  Zdarzenie wykrycia przez procedurę i optyczny zanik emisji trzeba rozdzielić.
  Nie oznacza to przesunięcia samych klatek o pięć sekund. Rekonstrukcja nie
  zeruje obrazu w czasie `extinctionMs`; stosuje próg zmierzonego szumu.
- **Etykieta „Ion current” sugeruje więcej niż wiemy.** Powinna zawierać informację
  o braku potwierdzonej przydatności tego kanału w CFI-G i braku przeliczenia na
  jednostki prądu. Z surowego napięcia/odczytu toru nie wolno robić detektora płomienia.
- **Wykres przedstawia cały zapis.** Nie narasta podczas odtwarzania. Przesuwa się
  kursor, punkt i liczba przy nazwie kanału. Na wykresie pozostaje więc widoczne
  wcześniejsze plateau nawet po przejściu kursora do fazy bez płomienia.
- **Tryb modelu 1D i sensory to różne źródła.** W obu jest ta sama oś czasu
  eksperymentu, lecz sensory pozostają pomiarami, a model przewiduje własny zanik
  płomienia. Model nie generuje sygnału jonowego. Niezgodność jego czasu zaniku z
  pomiarem oznacza błąd modelu lub jego parametrów, a nie automatycznie błąd zegara.

Miejsca w implementacji:
[eksport sensorów](/Users/szymonpasieczny/hackathon/app/app/scripts/build_flame_data.py:180),
[wspólny czas odtwarzania](/Users/szymonpasieczny/hackathon/app/app/src/features/vr/flameEngine.ts:400),
[etykiety i wykres całego zapisu](/Users/szymonpasieczny/hackathon/app/app/src/features/vr/flamePanels.ts:161),
[ładowanie manifestów](/Users/szymonpasieczny/hackathon/app/app/src/features/vr/FlameVrView.tsx:118).

## Zalecane poprawki

1. Oznaczyć `IonCurrent` jako surowy kanał o niepotwierdzonej przydatności w tej
   konfiguracji; domyślnie używać PMT1 i mierzonej emisji INTNS do porównania zaniku
   płomienia. Nie dopasowywać arbitralnie Ion do obrazu i nie zerować po wygaszeniu.
2. Rozdzielić `opticalExtinctionMs`, `extinctionDetectedMs` i czas wyłączenia
   przepływu. Pokazywać zdarzenia na wykresach wraz z kryterium ich wyznaczenia.
3. Sprawdzać zgodność `timeOrigin` także przy ładowaniu danych w aplikacji;
   aktualna ścieżka sprawdza zgodność identyfikatorów prób, ale nie originów.
4. Opisać granice rozdzielczości i widoczny kursor; zwiększyć częstość podglądów,
   jeżeli wymagana jest dokładność pojedynczej ekspozycji. Ewentualną korektę
   opóźnienia sprzętowego wprowadzać dopiero po niezależnej kalibracji.
5. W trybie modelu jednoznacznie oznaczyć wykresy jako pomiary eksperymentalne.

## Materiał dowodowy i odtworzenie analizy

[Oryginalne obrazy i równoczesne odczyty](/Users/szymonpasieczny/hackathon/app/analysis/ion-sync-audit/camera-versus-ion.png),
[wyniki liczbowe](/Users/szymonpasieczny/hackathon/app/analysis/ion-sync-audit/results.json),
[tabela zdarzeń CSV](/Users/szymonpasieczny/hackathon/app/analysis/ion-sync-audit/events.csv),
[skrypt audytu](/Users/szymonpasieczny/hackathon/app/analysis/ion-sync-audit/analyze.py).

Uruchomienie z katalogu repozytorium, z NumPy i Pillow oraz oryginalnymi archiwami
`PSI-159_Raw Data_21088{A,B,C}1_INTNS_ALL.zip` w `/private/tmp`:

```sh
python3 analysis/ion-sync-audit/analyze.py --archive-dir /private/tmp
```

Audyt zapisuje wyłącznie artefakty analityczne w swoim katalogu. Nie zmienia
surowych danych ani zachowania aplikacji.
