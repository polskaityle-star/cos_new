# 🚍 VZTM Kielce – Oficjalny Poradnik Użytkownika i Dokumentacja Systemu

Witaj w oficjalnym przewodniku po systemie **VZTM Kielce** (Wirtualny Zarząd Transportu Miejskiego w Kielcach – wirtualna firma dla symulatora OMSI 2).  
Wersja systemu: **0.4.0.0** (BETA).

System łączy zarządzanie przewoźnikami **VMPK Kielce** (malowanie żółto-czerwone) oraz **VBP Tour Regio Kielce** (malowanie niebieskie), organizację taboru, rozkłady brygad, grafik służb, zgłaszanie usterek warsztatowych, składanie wniosków pracowniczych oraz weryfikację raportów z tras.

---

## 📑 Spis treści
1. [Struktura ról i numery służbowe](#-struktura-ról-i-numery-służbowe)
2. [Rejestracja, rekrutacja i zmiana hasła](#-rejestracja-rekrutacja-i-zmiana-hasła)
3. [Poradnik dla Kierowcy (Panel Kierowcy)](#-poradnik-dla-kierowcy)
   - [Profil, awatar i numer służbowy](#profil-awatar-i-numer-służbowy)
   - [Wybór etatu (Limit 6/7) i zmiana etatu](#wybór-etatu-limit-67-i-zmiana-etatu)
   - [System niezaliczonych służb (Ostrzeżenia i Zawieszenie)](#system-niezaliczonych-służb-ostrzeżenia-i-zawieszenie)
   - [Wgląd do taboru](#wgląd-do-taboru)
   - [Odbiór służby, wóz zastępczy i blokada raportów](#odbiór-służby-wóz-zastępczy-i-blokada-raportów)
   - [Wnioski pracownicze (Urlopy do 14 dni, Stały wóz, Odwieszenie)](#wnioski-pracownicze)
   - [Powiadomienia i wiadomości od Zarządu](#powiadomienia-i-wiadomości-od-zarządu)
   - [Zgłoszenia techniczne i warsztat](#zgłoszenia-techniczne-i-warsztat)
4. [Poradnik dla Zarządu i Kadry Kierowniczej](#-poradnik-dla-kadry-kierowniczej)
   - [Konto Główne Właściciela: Godksawiss i pełna widoczność taboru](#konto-główne-właściciela-godksawiss)
   - [Wozy zastępcze przy awarii na trasie](#wozy-zastępcze-przy-awarii-na-trasie)
   - [Wysyłanie bezpośrednich wiadomości do kierowców](#wysyłanie-bezpośrednich-wiadomości-do-kierowców)
   - [Układanie grafiku ze zmianami (1, 2, 3 Zmiana, linie nocne N1 i N2)](#układanie-grafiku-ze-zmianami)
5. [Historia zmian – Wersja 0.4.0.0](#-historia-zmian--wersja-0400)
6. [Historia wcześniejszych wydań](#-historia-wcześniejszych-wydań)

---

## 👥 Struktura ról i numery służbowe

Każdy użytkownik w systemie posiada przypisaną rolę oraz **unikalny numer służbowy** wygenerowany zgodnie z oficjalnym formatem:

| Rola | Oznaczenie | Zakres numeru | Opis i uprawnienia |
| :--- | :---: | :---: | :--- |
| **Właściciel** | `W` | `W0` – `W1` | Pełna administracja systemem, zarządzanie personelem, taborem, liniami i grafikiem. Konto główne: **`Godksawiss`** (`W1`). |
| **Dyspozytor** | `D` | `D1` – `D99` | Układanie grafiku, przydzielanie służb kierowcom, koordynacja ruchu. |
| **Kierownik Działu Przewozów** | `P` | `P1` – `P99` | Zarządzanie liniami komunikacyjnymi, trasami i wykazem brygad, przydzielanie linii operatorom. |
| **Mechanik** | `M` | `M1` – `M99` | Zarządzanie taborem, serwis techniczny, kierowanie wozów na warsztat i zatwierdzanie napraw. |
| **Sprawdzający** | `S` | `S1` – `S99` | Sprawdzanie i zatwierdzanie raportów z tras oraz rozpatrywanie wniosków pracowniczych. |
| **Kierowca** | `K` | `K1` – `K9999` | Realizacja przydzielonych służb, składanie raportów z OMSI 2, zgłaszanie wniosków i awarii. |

---

## 📝 Rejestracja i rekrutacja kierowcy

1. Przejdź na stronę rejestracji (`/register`).
2. Uzupełnij wymagane pola:
   - **Nazwa użytkownika (Login)**
   - **Hasło**
   - **Przewoźnik** (VMPK Kielce lub VBP Tour Regio)
   - **Wiek** (np. 18 lat)
   - **Coś o sobie / doświadczenie w OMSI 2**
3. System automatycznie przydziela kandydatowi unikalny numer służbowy (np. `K1923`).
4. Po przesłaniu wniosek trafia do sekcji rekrutacyjnej w Panelu Zarządu. Po akceptacji przez Właściciela konto staje się aktywne.

---

## 💺 Poradnik dla Kierowcy

### Profil, awatar i numer służbowy
W nagłówku Panelu Kierowcy znajduje się sekcja Twojego profilu:
- Możesz wgrać **własne zdjęcie profilowe** (JPG, PNG, WEBP) lub wybrać jeden z gotowych awatarów.
- Twój awatar wyświetla się również bezpośrednio w pasku nawigacji obok Twojego nicku i przycisku *Panel Kierowcy*.
- Obok Twojego nicku widnieje Twój numer służbowy (np. `K1923`) oraz spółka (`VMPK` lub `VBP`).

### Wybór etatu (Limit 6/7)
Po pierwszej akceptacji konta system wyświetla okno wyboru dni pracy (etatu):
- Zaznacz dni tygodnia, w których chcesz realizować kursy (np. Poniedziałek – Piątek).
- **Ścisła reguła 6/7:** Niemożliwe jest wybranie 7 dni z rzędu. Przy próbie zaznaczenia 7 dni system wyświetla ostrzeżenie:  
  *„Brak możliwości przekroczenia etatu 6/7! Maksymalnie 6 dni w tygodniu.”*
- Wybór etatu można w każdej chwili zaktualizować za pomocą dedykowanego wniosku.

### Wgląd do taboru swojego przewoźnika
- W sekcji **Tabor Twojego Przewoźnika** kierowca ma pełny podgląd wszystkich autobusów przypisanych do jego spółki (`VMPK` lub `VBP`).
- Przy każdym pojeździe prezentowane są: zdjęcie, numer taborowy (np. `#101`), model, numer rejestracyjny, aktualny stan licznika w kilometrach oraz stan techniczny (Sprawny / Warsztat / Kasacja).
- Kierowcy VMPK widzą tylko tabor VMPK, a kierowcy VBP tylko tabor VBP.

### Odbiór służby, szczegóły brygady i blokada raportów
W sekcji **Twoje Służby (Grafik)**:
- Pod numerem linii znajduje się przejrzysta karta z datą i statusem służby (usunięto powtarzający się napis trasy).
- Jeśli do służby przypisano brygadę, wyświetla się szczegółowe okno harmonogramu zawierające:
  - **Godziny:** `Wyjazd - Zjazd`
  - **1. przystanek:** godzina odjazdu z przystanku początkowego
  - **Ostatni przystanek:** godzina przyjazdu na przystanek końcowy
  - **Wyjazd:** w formacie `Zajezdnia VMPK - <Przystanek Początkowy>`
  - **Zjazd:** w formacie `<Przystanek Końcowy> - Zajezdnia VMPK`
  - **Przesiadki i podmiany:** informacje o podmianach na trasie
- **Blokada przedwczesnych raportów:** Jeżeli służba jest zaplanowana na przyszły dzień, przycisk złożenia raportu jest zablokowany:  
  *„🔒 Dostępny w dniu służby (DD.MM.RRRR)”*. Raport można złożyć wyłącznie w dniu odbywania służby lub po jej zakończeniu.

### Wykonywanie i raportowanie służby
Po zakończeniu jazdy w symulatorze OMSI 2:
1. Kliknij **Złóż raport** przy danej służbie.
2. Wprowadź stan licznika początkowego i końcowego.
3. Dołącz zrzuty ekranu ze startu i końca oraz plik podsumowania.
4. Kliknij **Prześlij raport**.
5. Po akceptacji przez Sprawdzającego lub Zarząd przejechane kilometry automatycznie zasilają licznik przypisanego autobusu!

### Wnioski pracownicze
Dostępne w Panelu Kierowcy w dedykowanych, precyzyjnych formularzach:
1. **Wniosek o urlop wypoczynkowy:**
   - Wybierz *Data początkowa (dla urlopu)* oraz *Data końcowa (dla urlopu)*.
   - Zaakceptowany urlop bezwzględnie blokuje dyspozytorowi możliwość wydania służby w tym terminie.
2. **Wniosek o dodatkową służbę:**
   - Wybierz dzień, preferowaną linię/zmianę oraz **opcjonalny preferowany pojazd z taboru** swojego przewoźnika.
3. **Prośba o anulowanie służby:**
   - Wygodny wybór konkretnej zaplanowanej służby bezpośrednio z grafiku (wraz z datą, linią i brygadą).
4. **Wniosek o stały pojazd:**
   - Wniosek o przypisanie pierwszego stałego wozu z floty Twojego przewoźnika.
5. **Wniosek o zmianę stałego pojazdu:**
   - Osobny wniosek umożliwiający zmianę obecnie przypisanego autobusu na inny wóz.
6. **Wniosek o usunięcie stałego pojazdu (rezygnacja):**
   - Pozwala zrezygnować ze stałego przydziału i powrócić do pojazdów rotacyjnych.
7. **Wniosek o zmianę etatu:**
   - Interaktywny wybór nowych dni pracy z walidacją limitu 6/7.

Wszystkie rozpatrzone wnioski trafiają do podsekcji **Historia wniosków**.

### Zgłoszenia techniczne i warsztat
- W przypadku awarii wozu podczas gry zgłoś usterkę w sekcji technicznej.
- Po naprawieniu wozu przez Mechanika zgłoszenie automatycznie przenosi się do **Historii zgłoszeń technicznych**, a pojazd odzyskuje status sprawny.

---

## 👑 Poradnik dla Kadry Kierowniczej

### Konto Główne Właściciela: Godksawiss
- **Login:** `Godksawiss`
- **Rola:** `WLASCICIEL`
- **Numer służbowy:** `W1`

### Karta profilowa ze statystykami i zegarem LiveClock
Na samej górze Panelu Zarządu znajduje się pełna karta profilowa tożsama z panelem kierowcy:
- Wyświetla awatar z plakietką numeru służbowego (np. `W1`), nick `Godksawiss`, rolę oraz spółkę (`VMPK`).
- Zawiera aktualne dni etatu oraz przypisany stały pojazd.
- Posiada wbudowany **zegar czasu rzeczywistego (LiveClock)** z datą i godziną co sekundę.
- Przyciski szybkiego dostępu: *Wykaz Brygad*, *Strona publiczna*, *Panel Kierowcy &rarr;*.

### Uprawnienia poszczególnych ról
Panel Zarządzania (`/panel/zarzad`) automatycznie dostosowuje widok i akcje do uprawnień zalogowanego pracownika:
- **Dyspozytor (`D`):** Dostęp do grafiku służb i przydzielania kursów.
- **Kierownik Działu Przewozów (`P`):** Dostęp do zarządzania liniami oraz wykazem brygad, przydzielanie linii przewoźnikom.
- **Mechanik (`M`):** Dostęp do taboru, kierowania pojazdów na warsztat i zatwierdzania napraw.
- **Sprawdzający (`S`):** Dostęp do weryfikacji raportów z tras oraz rozpatrywania wniosków pracowniczych.
- **Właściciel (`W`):** Pełny dostęp do wszystkich sekcji, w tym rekrutacji i zmiany ról pracowników.

### Dedykowani przewoźnicy dla Linii i Brygad
- Zarówno przy dodawaniu, jak i edycji linii oraz brygad istnieje możliwość wyznaczenia dedykowanego operatora (`VMPK`, `VBP` lub Dowolny).
- W wykazie brygad oraz w grafiku widoczne są plakietki spółek przy numerach linii.

### Układanie grafiku, blokada urlopowa i walidacja dni/przewoźników
Podczas wydawania nowej służby system prowadzi wielostopniową weryfikację:
1. **Weryfikacja urlopowa:** Jeżeli kierowca ma zaakceptowany urlop w wybranym dniu, system zablokuje przydzielenie służby z komunikatem:  
   *„Brak możliwości przydzielenia służby! Kierowca przebywa w tym dniu na zaakceptowanym urlopie wypoczynkowym.”*
2. **Separacja przewoźników (Pojazd & Linia):**
   - Kierowcy VMPK nie można przydzielić autobusu VBP ani linii dedykowanej dla VBP.
   - Kierowcy VBP nie można przydzielić autobusu VMPK ani linii dedykowanej dla VMPK.
3. **Walidacja dnia tygodnia dla brygad:**
   - Brygadę oznaczoną jako **sobotnia** można przydzielić wyłącznie na **sobotę**.
   - Brygadę oznaczoną jako **niedzielna / święta** można przydzielić wyłącznie na **niedzielę**.
   - Brygadę na **dni robocze** można przydzielić wyłącznie na dni od **poniedziałku do piątku**.
4. **Czysty wygląd grafiku:** Z kart służb usunięto zbędny napis `Trasa:`, eksponując datę, linię, autobus, kierowcę oraz podgląd harmonogramu brygady.

### Wykaz brygad
W formularzu tworzenia i edycji brygady dostępne są precyzyjne pola:
- **Godzina Wyjazdu** (czas rozpoczęcia pracy)
- **Godzina Zjazdu** (czas zakończenia pracy)
- **Godzina pierwszego przystanku** (odjazd z pętli początkowej)
- **Godzina ostatniego przystanku** (przyjazd na pętlę końcową)
- **Miejsce wyjazdu i zjazdu** (np. `Zajezdnia VMPK - Jagiellońska MPK` i `Jagiellońska MPK - Zajezdnia VMPK`)
- **Dedykowany przewoźnik** (VMPK / VBP)
- Punkty podmian kierowców i dodatkowe uwagi

### Weryfikacja raportów i licznik taboru
- Sprawdzający widzi podgląd zdjęć ze startu i zjazdu oraz plik podsumowania.
- Kliknięcie **Akceptuj Raport** powoduje **automatyczne powiększenie stanu licznika kilometrów w autobusie** o dystans przebyty podczas służby.

### Historia zgłoszeń technicznych i wniosków
- Rozpatrzone wnioski kierowców są archiwizowane w sekcji **Historia rozpatrzonych wniosków** (wraz z obsługą stałego pojazdu, zmian i rezygnacji).
- Zgłoszenia naprawione przez warsztat lub odrzucone trafiają do sekcji **Historia zgłoszeń technicznych**.

---

## 🎨 Funkcje wizualne i techniczne

1. **Awatar użytkownika w pasku nawigacji:**
   - Profilowe użytkownika jest widoczne bezpośrednio obok nicku oraz przycisku *Panel Kierowcy*.
2. **Tryb Jasny / Ciemny (Dark / Light Theme):**
   - Przełącznik motywu w prawym górnym rogu z trwałym zapisem w `localStorage`.
3. **Zegar LiveClock:**
   - Czas rzeczywisty w języku polskim w Panelu Zarządu.
4. **Płynna responsywność:**
   - Pełne wsparcie dla urządzeń mobilnych, tabletów i komputerów stacjonarnych.

---

## 🚀 Historia zmian – Wersja 0.4.0.0

Wydanie **0.4.0.0** wprowadza kompleksowy pakiet usprawnień organizacyjnych, technicznych i dyspozytorskich:

1. **Pełna widoczność taboru dla Właściciela:**
   - Właściciel (`Godksawiss` oraz rola `WLASCICIEL` / `ZARZAD`) posiada pełny wgląd do wszystkich pojazdów – zarówno floty VBP, jak i VMPK na podstronie `/tabor`, w Panelu Kierowcy oraz w Panelu Zarządu.
2. **Obowiązkowy powód we wniosku o zmianę etatu:**
   - Formularz wniosku o zmianę etatu (`ZMIANA_ETATU`) wymaga podania konkretnego uzasadnienia w dedykowanym polu tekstowym (walidacja frontendowa i backendowa).
3. **Limit urlopu do maksymalnie 14 dni:**
   - Wniosek o urlop wypoczynkowy (`URLOP`) dopuszcza maksymalnie 14 dni roboczych. Przy próbie wyboru dłuższego okresu system blokuje wysłanie formularza z informacją o konieczności bezpośredniego kontaktu z Zarządem przez wiadomość.
4. **Wybór zmiany i formatowanie brygad przy przydzielaniu służby:**
   - W formularzu przydziału służby (`DutyAssignmentForm`) dodano wybór zmiany:
     - **1 Zmiana** (Wyjazd)
     - **2 Zmiana** (Podmiana / Przesiadka)
     - **3 Zmiana** (Nocna)
   - Automatyczny zapis brygady w formacie np. `2/1 - Dni robocze/1 Zmiana` bez podawania surowych godzin.
5. **Obsługa linii nocnych N1 i N2:**
   - Linie nocne `N1` oraz `N2` są automatycznie powiązane z **3 Zmianą** w formularzu grafiku.
6. **System ostrzeżeń i zawieszeń przy niezaliczonych służbach:**
   - **5 niezaliczonych służb:** W Panelu Kierowcy wyświetla się pomarańczowy baner ostrzegawczy z wezwaniem do nadrobienia zaległości poprzez *Wniosek o dodatkową służbę*.
   - **10 niezaliczonych służb:** Automatyczne zawieszenie konta (`suspended: true`), utrata stałego pojazdu (zwolnienie do puli ogólnej), etat pozostaje bez zmian. Kierowca otrzymuje czerwony baner z instrukcją złożenia *Wniosku o odwieszenie konta* (`ODWIESZENIE`).
7. **Wyznaczanie wozu zastępczego przy awarii na trasie:**
   - Mechanik (`M`) oraz Sprawdzający (`S`) (jak również Dyspozytor i Właściciel) mogą przypisać pojazd zastępczy (`replacementVehicle`) do zaplanowanej służby w razie wystąpienia awarii autobusu. Kierowca otrzymuje natychmiastowe powiadomienie oraz oznaczenie wozu zastępczego na karcie służby.
8. **Usunięcie przycisku „Zobacz Tabor” z podstron przewoźników:**
   - Usunięto niepotrzebne przyciski „Zobacz tabor” z podstron `/vbp` oraz `/vmpk`.
9. **Dopracowanie paska nawigacji w trybie jasnym:**
   - Wyeliminowano problem nieczytelnego tekstu w jasnym motywie dzięki wymuszeniu pełnego kontrastu dla całego paska nawigacyjnego, profilowego i przycisków.
10. **Wysyłanie bezpośrednich wiadomości do kierowcy:**
    - Zarząd może przesłać bezpośrednią dyspozycję lub wiadomość do wybranego kierowcy (`DriverNotification`), która natychmiast wyświetla się w dedykowanej sekcji Panelu Kierowcy.
11. **Zmiana hasła bezpośrednio na stronie logowania:**
    - Na stronie `/login` dodano zakładkę *Zmiana hasła* umożliwiającą bezpieczną zmianę hasła po weryfikacji starego hasła przez API.

---

## 📜 Historia wcześniejszych wydań

### Wersja 0.3.6.0
- Obsługa brygad szczytowych (dwurazowych) z dwoma wyjazdami i zjazdami.
- Komponent edycji brygad `BrigadeEditCard`.
- Prezentacja obu szczytów w wykazie brygad i grafiku kierowcy.

### Wersja 0.3.5.0
- Dedykowany wykaz brygad dla przewoźnika VBP (brak dostępu do brygad VMPK).
- Automatyczne archiwizowanie rozwiązanych zgłoszeń technicznych w historii oraz przycisk „Ustaw jako naprawione”.
- Płynna akceptacja wniosku o dodatkową służbę (auto-prefill kierowcy, daty i wozu w grafiku).
- Dynamiczne filtrowanie linii, brygad i taboru w grafiku według przewoźnika kierowcy.
- Opcjonalne godziny wyjazdu i zjazdu oraz opcjonalna notatka dyspozytorska.
- Gruntowna naprawa kontrastów w motywie jasnym (Light Theme).
- Wymagany pojazd z taboru przy przydzielaniu służby.
- Uproszczona karta przydzielonej służby (Linia, Brygada, Pojazd, Uwagi).
- Automatyczny wybór przewoźnika brygady na podstawie wybranej linii.
 
### Wersja 0.3.2.0
- Wybór preferowanego pojazdu we wniosku o dodatkową służbę.
- Wybór konkretnej zaplanowanej służby przy wniosku o anulowanie.
- Rozdzielenie wniosków o stały pojazd na wniosek o przydział, zmianę oraz rezygnację ze stałego pojazdu.
- Karta profilowa z awatarem i statystykami w Panelu Zarządu oraz zegar czasu rzeczywistego LiveClock.
- Wgląd do taboru w Panelu Kierowcy z filtrowaniem wg przewoźnika.
- Usunięcie etykiety „Trasa” z kart grafiku.
- Przypisanie linii oraz brygad do operatorów (VMPK / VBP).
- Walidacja dni tygodnia (dni robocze / soboty / niedziele) przy przydzielaniu służb.
- Blokada mieszania przewoźników (VMPK / VBP).
- Formatowanie godzin pierwszego/ostatniego przystanku oraz wyjazdu i zjazdu.
- Wyświetlanie miniatury profilowego w pasku nawigacji.

### Wersja 0.3.0.0
- Wprowadzenie ról służbowych: Właściciel (`W`), Dyspozytor (`D`), Kierownik Przewozów (`P`), Mechanik (`M`), Sprawdzający (`S`), Kierowca (`K`).
- Generowanie unikalnych numerów służbowych z literowymi prefiksami.
- Wybór etatu po rekrutacji z blokadą etatu powyżej 6/7.
- Blokada urlopowa przy planowaniu służb w grafiku.
- Blokada składania raportów przed dniem służby.
- Archiwum i historia wniosków oraz napraw technicznych taboru.
- Obsługa awatarów użytkownika i przełącznik trybu ciemnego/jasnego.

### Wersja 0.2.0.0
- Dedykowane podstrony przewoźników VMPK i VBP.
- Przeliczanie dystansu z raportu na licznik kilometrów pojazdu.
- Sortowanie brygad: dni robocze &rarr; soboty &rarr; niedziele.
- Zmiana konta administracyjnego na `Godksawiss`.

---
*VZTM Kielce © 2026. Wszelkie prawa zastrzeżone.*
