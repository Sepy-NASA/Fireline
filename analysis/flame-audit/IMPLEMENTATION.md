Przebudowano generator danych, solver i widok VR. Domyślny tryb odtwarza rekonstrukcję pomiarów INTNS; osobny tryb uruchamia zredukowany model transportu i spalania. Model oraz pomiar korzystają z tej samej osi czasu. Ten raport opisuje aktualny stan, a wcześniejszy README zachowuje audyt sprzed zmian.

| Test | Zachowane ekspozycje | Czas rekordu | Mediana NRMSE projekcji / liczba użytecznych klatek | Błąd promienia modelu | NRMSE przybliżenia emisji modelu |
|---|---:|---:|---:|---:|---:|
| 21088A1 | 2017 | 86.822 s | 2.10% / 961 | 1.22 mm | 41% |
| 21088B1 | 1944 | 83.677 s | 1.79% / 922 | 0.97 mm | 41% |
| 21088C1 | 1829 | 78.726 s | 1.74% / 825 | 0.92 mm | 76% |

NRMSE rekonstrukcji dotyczy wyłącznie użytecznych, nieprześwietlonych obserwacji poza maskami. Nie określa błędu całego wolumenu 3D. Wartości mm korzystają z szacowanej skali kamery, więc nie stanowią potwierdzonej dokładności metrologicznej.

Zmieniono cały tor danych:

- Zachowano wszystkie 5790 ekspozycji i ich rzeczywiste znaczniki czasu. Sekwencje nie są już przyspieszane przez sztuczne 12 fps. Podgląd i sensory są wybierane według czasu, a nie wspólnego numeru klatki.
- Stała siatka 128×64 i ten sam układ kamery zachowują wzrost i położenie płomienia. Eksport jest liniowy float16 z bezstratną kompresją gzip; usunięto rozciąganie p99 osobno dla każdej klatki.
- Średnie klatek ciemnych oraz interpolacja dryftu tła zastąpiły medianę, która źle opisywała rzadkie impulsy intensyfikatora. Próg detekcji wynika z pomiaru szumu, a ustawienia kamery i SHA-256 archiwów są w metadanych.
- Konserwatywna maska osprzętu i nieujemne, regularizowane dopasowanie Abela zastępują obracanie cienia pręta w wolumen gazu. Nieprzystające do modelu klatki przechodzą na oznaczone przybliżenie sferyczne; ograniczenia danych są widoczne w UI.
- Chwile dopływu paliwa wynikają z najdłuższego stabilnego sygnału MFC. Krótki pik A1 przed właściwym włączeniem został wykluczony. Wygaszenie z metadanych nie odcina dopływu paliwa w solverze.

[Kanoniczny generator](/Users/szymonpasieczny/hackathon/app/app/scripts/build_flame_data.py) zastąpił rozbieżne skrypty tymczasowe. Oba notebooki uruchamiają ten sam kod. Instrukcje, jednostki i założenia są w [dokumentacji generatora](/Users/szymonpasieczny/hackathon/app/app/scripts/psi159/README.md).

[Solver](/Users/szymonpasieczny/hackathon/app/app/src/features/vr/flamePhysics.ts) liczy radialną adwekcję i dyfuzję składników, przewodzenie entalpii, reakcję etanu ze stechiometrią, zmienną gęstość, rozszerzalność, straty radiacyjne i bilans cieplny palnika. Daleki brzeg obliczeń jest poza kadrem kamery. Źródło odpowiada konfiguracji Normal i 2 mg/s. Nie ma zadanej sinusoidy, okresu 2,2 s ani animowanej obwiedni wygaszania. Warunki zerowego tlenu nie tworzą emisji reakcyjnej.

Współczynniki transportu, promieniowania i jeden mnożnik przybliżenia emisji dopasowano na A1. B1/C1 zachowują własne warunki i są sprawdzianem poza zbiorem dopasowania. Wyniki oraz próbki porównawcze zawiera [model-calibration.json](/Users/szymonpasieczny/hackathon/app/app/public/psi159/model-calibration.json). Energia reakcji pozostaje w budżecie dostarczonego paliwa; to sprawdzenie nie jest pełną walidacją całego bilansu cieplnego eksperymentu.

Renderer oddziela emisję od pochłaniania, zachowuje stałą ekspozycję i liczy promienie z macierzy właściwego oka. Geometria palnika jest spójna z domeną; gaz przed metalem pozostaje widoczny. Ustawiono układ odniesienia od podłogi, oczekiwanie na konfigurację sesji XR i raportowanie błędów. Obliczenia modelu działają w workerze, a pamięć podglądów ma ograniczony cache. Poprawiono też informacje o źródle, jednostkach, niepewności i przełączanie widoku na wąskim ekranie.

Sprawdzenia obejmują 12 regresji Node i 4 testy rekonstrukcji Python: dane wszystkich testów, czas nieregularnych ekspozycji, precyzję, brak reakcji bez tlenu, bilans paliwa, zagęszczanie siatki i kroku czasu, geometrię obu oczu, zachowanie wzrostu, liniowość jasności, maski, niezgodną projekcję i odrzucanie krótkich pików MFC. Build przeszedł; lint nie zgłasza błędów, pozostawiając wcześniejsze ostrzeżenia w innych widokach. W przeglądarce sprawdzono A1/B1/C1, oba źródła, zachowanie czasu przy przełączeniu i zatrzymanie na końcu. Zaobserwowano 25,88 s eksperymentu w 25,852 s czasu rzeczywistego. W kontrolowanych odsłonach nie wystąpiły błędy shadera ani konsoli.

Pozostają istotne ograniczenia naukowe. Rekonstrukcja z pojedynczego obrazu zakłada symetrię i uzupełnia zasłonięte obszary. Średnica palnika w obrazie oraz maska wymagają niezależnej kalibracji/annotacji; deklarowana skala jest szacowana. Model ma jedną globalną reakcję gorącego etanu, bez chemii chłodnych płomieni. Jego przybliżenie emisji ma znacznie większy błąd niż promień i nie odwzorowuje jeszcze dokładnie samoczynnego wygaszenia. Dokładne odtwarzanie zarejestrowanej jasności i końca płomienia zapewnia tryb rekonstrukcji, nie deklaracja predykcyjnej poprawności solvera. Kolory są umowne. Test na fizycznych goglach pozostaje do wykonania.

[Film porównawczy](/Users/szymonpasieczny/hackathon/app/flame-simulation.mp4) i [arkusz porównawczy](/Users/szymonpasieczny/hackathon/app/flame-simulation-sheet.png) pokazują projekcje emisji pomiaru i modelu w tych samych chwilach. Film trwa około 86,8 s i nie jest nagraniem z gogli. GIF to fragment w tempie rzeczywistym, o obniżonej częstości klatek. Stare pliki zachowano z prefiksem `legacy-` w katalogu audytu.

![Poprawiony widok VR](/Users/szymonpasieczny/hackathon/app/analysis/flame-audit/after-final-a1.jpg)

[Surowe wyniki walidacji i sumy kodu](/Users/szymonpasieczny/hackathon/app/analysis/flame-audit/validation-v2.json).
