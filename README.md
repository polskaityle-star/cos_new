# 🚍 VZTM Kielce – Oficjalny Poradnik Użytkownika i Dokumentacja Systemu

Witaj w oficjalnym przewodniku po systemie **VZTM Kielce** (Wirtualny Zarząd Transportu Miejskiego w Kielcach – wirtualna firma dla symulatora OMSI 2).  
Wersja systemu: **0.3.0.0** (BETA).

System łączy zarządzanie przewoźnikami **VMPK Kielce** (malowanie żółto-czerwone) oraz **VBP Tour Regio Kielce** (malowanie niebieskie), organizację taboru, rozkłady brygad, grafik służb, zgłaszanie usterek warsztatowych, składanie wniosków pracowniczych oraz weryfikację raportów z tras.

---

## 📑 Spis treści
1. [Struktura ról i numery służbowe](#-struktura-ról-i-numery-służbowe)
2. [Rejestracja i rekrutacja kierowcy](#-rejestracja-i-rekrutacja-kierowcy)
3. [Poradnik dla Kierowcy (Panel Kierowcy)](#-poradnik-dla-kierowcy)
   - [Profil, awatar i numer służbowy](#profil-awatar-i-numer-służbowy)
   - [Wybór etatu (Limit 6/7)](#wybór-etatu-limit-67)
   - [Dostęp do taboru przewoźnika](#dostęp-do-taboru-przewoźnika)
   - [Odbiór służby i blokada wcześniejszych raportów](#odbiór-służby-i-blokada-wcześniejszych-raportów)
   - [Wykonywanie i raportowanie służby](#wykonywanie-i-raportowanie-służby)
   - [Wnioski pracownicze (Urlopy, Stały wóz, Zmiana etatu)](#wnioski-pracownicze)
   - [Zgłoszenia techniczne i warsztat](#zgłoszenia-techniczne-i-warsztat)
4. [Poradnik dla Zarządu i Kadry Kierowniczej](#-poradnik-dla-kadry-kierowniczej)
   - [Konto Główne Właściciela: Godksawiss](#konto-główne-właściciela-godksawiss)
   - [Uprawnienia poszczególnych ról](#uprawnienia-poszczególnych-ról)
   - [Zarządzanie Personelem i zmiana ról](#zarządzanie-personelem-i-zmiana-ról)
   - [Układanie grafiku i blokada urlopowa](#układanie-grafiku-i-blokada-urlopowa)
   - [Wykaz brygad (Godziny wyjazdu, zjazdu i przystanków)](#wykaz-brygad)
   - [Weryfikacja raportów i przeliczanie licznika taboru](#weryfikacja-raportów-i-licznik-taboru)
   - [Historia zgłoszeń technicznych i wniosków](#historia-zgłoszeń-technicznych-i-wniosków)
5. [Funkcje wizualne i techniczne](#-funkcje-wizualne-i-techniczne)
6. [Historia zmian – Wersja 0.3.0.0](#-historia-zmian--wersja-0300)

---

## 👥 Struktura ról i numery służbowe

Każdy użytkownik w systemie posiada przypisaną rolę oraz **unikalny numer służbowy** wygenerowany zgodnie z oficjalnym formatem:

| Rola | Oznaczenie | Zakres numeru | Opis i uprawnienia |
| :--- | :---: | :---: | :--- |
| **Właściciel** | `W` | `W0` – `W1` | Pełna administracja systemem, zarządzanie personelem, taborem, liniami i grafikiem. Konto główne: **`Godksawiss`** (`W1`). |
| **Dyspozytor** | `D` | `D1` – `D99` | Układanie grafiku, przydzielanie służb kierowcom, koordynacja ruchu. |
| **Kierownik Działu Przewozów** | `P` | `P1` – `P99` | Zarządzanie liniami komunikacyjnymi, trasami i wykazem brygad. |
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
W prawym górnym rogu Panelu Kierowcy znajduje się sekcja Twojego profilu:
- Możesz wgrać **własne zdjęcie profilowe** (JPG, PNG, WEBP) lub wybrać jeden z przygotowanych gotowych awatarów.
- Obok Twojego nicku zawsze widnieje Twój numer służbowy (np. `K1923`) oraz spółka (`VMPK` lub `VBP`).

### Wybór etatu (Limit 6/7)
Po pierwszej akceptacji konta system wyświetla okno wyboru dni pracy (etatu):
- Zaznacz dni tygodnia, w których chcesz realizować kursy (np. Poniedziałek – Piątek).
- **Ścisła reguła 6/7:** Niemożliwe jest wybranie 7 dni z rzędu. Przy próbie zaznaczenia 7 dni system wyświetla ostrzeżenie:  
  *„Brak możliwości przekroczenia etatu 6/7! Maksymalnie 6 dni w tygodniu.”*
- Wybór etatu można w każdej chwili zaktualizować za pomocą dedykowanego wniosku.

### Dostęp do taboru przewoźnika
- Kierowcy zatrudnieni w **VMPK** mają dostęp wyłącznie do autobusów spółki VMPK.
- Kierowcy zatrudnieni w **VBP** mają dostęp wyłącznie do autobusów spółki VBP Tour Regio.
- Informacja o Twoim stałym pojeździe wyświetla się w nagłówku Twojego panelu.

### Odbiór służby i blokada wcześniejszych raportów
W sekcji **Twoje Przydzielone Służby**:
- Widzisz datę, linię, autobus oraz brygadę.
- **Blokada przedwczesnych raportów:** Jeżeli służba jest zaplanowana na jutro lub kolejny dzień, przycisk złożenia raportu jest zablokowany z informacją:  
  *„🔒 Dostępny w dniu służby (DD.MM.RRRR)”*. Raport można złożyć wyłącznie w dniu odbywania służby lub po jej zakończeniu.

### Wykonywanie i raportowanie służby
Po zakończeniu jazdy w symulatorze OMSI 2:
1. Kliknij **Złóż raport** przy danej służbie.
2. Wprowadź stan licznika początkowego i końcowego.
3. Dołącz zrzuty ekranu ze startu i końca oraz plik podsumowania.
4. Kliknij **Prześlij raport**.
5. Po akceptacji przez Sprawdzającego lub Zarząd przejechane kilometry automatycznie zasilają licznik przypisanego autobusu!

### Wnioski pracownicze
Dostępne w Panelu Kierowcy w 5 dedykowanych formularzach:
1. **Wniosek o urlop wypoczynkowy:**
   - Wybierz *Data początkowa (dla urlopu)* oraz *Data końcowa (dla urlopu)*.
   - Zaakceptowany urlop blokuje możliwość przydzielenia służby w tym terminie przez dyspozytora.
2. **Wniosek o stały pojazd / zmiana stałego pojazdu:**
   - Wybierz pożądany autobus z taboru swojego przewoźnika. Po zatwierdzeniu pojazd jest na stałe przypisany do Twojego konta.
3. **Wniosek o zmianę etatu:**
   - Interaktywny wybór nowych dni pracy z walidacją limitu 6/7.
4. **Wniosek o dodatkową służbę:**
   - Wskaż konkretny dzień, w którym chcesz otrzymać dodatkową służbę (uzasadnienie jest opcjonalne).
5. **Prośba o anulowanie służby:**
   - Wybierz konkretną zaplanowaną służbę z listy, jeśli z przyczyn losowych nie możesz jej zrealizować.

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

### Uprawnienia poszczególnych ról
Panel Zarządzania (`/panel/zarzad`) automatycznie dostosowuje widok i akcje do uprawnień zalogowanego pracownika:
- **Dyspozytor (`D`):** Dostęp do grafiku służb i przydzielania kursów.
- **Kierownik Działu Przewozów (`P`):** Dostęp do zarządzania liniami oraz wykazem brygad.
- **Mechanik (`M`):** Dostęp do taboru, kierowania pojazdów na warsztat i potwierdzania napraw.
- **Sprawdzający (`S`):** Dostęp do weryfikacji raportów z tras oraz rozpatrywania wniosków pracowniczych.
- **Właściciel (`W`):** Pełny dostęp do wszystkich sekcji, w tym rekrutacji i zmiany ról pracowników.

### Zarządzanie Personelem i zmiana ról
Właściciel może w sekcji **Zarządzanie Personelem i Rolami**:
- Przeglądać wszystkich aktywnych pracowników, ich wiek, opis, etat oraz stały pojazd.
- Za pomocą listy rozwijanej awansować pracownika na inną rolę (np. Kierowca &rarr; Dyspozytor &rarr; Mechanik).  
- System automatycznie nadaje wtedy właściwy prefiks numeru służbowego!

### Układanie grafiku i blokada urlopowa
Przy przydzielaniu nowej służby:
- System wyświetla listę kierowców wraz z ich stałymi pojazdami.
- **Weryfikacja urlopowa:** Jeżeli kierowca ma zaakceptowany urlop w wybranym dniu, system zablokuje przydzielenie służby i wyświetli komunikat ostrzegawczy:  
  *„Brak możliwości przydzielenia służby! Kierowca przebywa w tym dniu na zaakceptowanym urlopie wypoczynkowym.”*

### Wykaz brygad
W formularzu tworzenia i edycji brygady dostępne są precyzyjne pola:
- **Godzina Wyjazdu** (czas rozpoczęcia pracy)
- **Godzina Zjazdu** (czas zakończenia pracy)
- **Godzina pierwszego przystanku** (opcjonalny czas odjazdu z pętli początkowej)
- **Godzina ostatniego przystanku** (opcjonalny czas przyjazdu na pętlę końcową)
- Miejsca wyjazdu i zjazdu (np. Zajezdnia VMPK)
- Punkty podmian kierowców i dodatkowe uwagi

### Weryfikacja raportów i licznik taboru
- Sprawdzający widzi podgląd zdjęć ze startu i zjazdu oraz plik podsumowania.
- Kliknięcie **Akceptuj Raport** powoduje **automatyczne powiększenie stanu licznika kilometrów w autobusie** o dystans przebyty podczas służby.

### Historia zgłoszeń technicznych i wniosków
- Rozpatrzone wnioski kierowców nie znikają z bazy – są archiwizowane w sekcji **Historia rozpatrzonych wniosków**.
- Zgłoszenia naprawione przez warsztat lub odrzucone trafiają do sekcji **Historia zgłoszeń technicznych**, zachowując pełny ślad wykonanych napraw.

---

## 🎨 Funkcje wizualne i techniczne

1. **Tryb Jasny / Ciemny (Dark / Light Theme):**
   - Przycisk w prawym górnym rogu nawigacji (ikona ☀️ / 🌙) pozwala błyskawicznie przełączać motyw strony.
   - Wybór jest trwale zapisywany w przeglądarce (`localStorage`).
2. **Uproszczony Navbar:**
   - Główne menu zostało odchudzone o linki Taboru, Linii i Brygad, które są teraz bezpośrednio dostępne z poziomu paneli i dedykowanych kart.
3. **Płynna responsywność:**
   - Pełne wsparcie dla urządzeń mobilnych, tabletów i komputerów stacjonarnych.

---

## 🚀 Historia zmian – Wersja 0.3.0.0

- ✨ Dodano pola wieku (`age`) oraz opisu o sobie (`bio`) do formularza rejestracji.
- 🔒 Wprowadzono separację taboru – kierowcy widzą wyłącznie pojazdy swojego przewoźnika (VMPK / VBP).
- 🏷️ Wprowadzono oficjalny system numerów służbowych z prefiksami (`K`, `D`, `P`, `M`, `S`, `W`).
- 🛡️ Utworzono 6 wyspecjalizowanych ról z uprawnieniami modułowymi (Właściciel, Dyspozytor, Kierownik Przewozów, Mechanik, Sprawdzający, Kierowca).
- 📅 Wdrożono automatyczny wybór etatu po rekrutacji z blokadą przekroczenia limitu 6/7.
- 🏖️ Zaktualizowano wniosek o urlop z etykietami „dla urlopu” oraz blokadą przydzielania służb w trakcie urlopu.
- 🚌 Dodano wniosek o stały pojazd z automatycznym przypisaniem do profilu kierowcy.
- 🔄 Dodano wniosek o zmianę etatu z walidacją 6/7.
- ➕ Przeprojektowano wniosek o dodatkową służbę (wybór dnia, usunięcie wymogu uzasadnienia).
- ❌ Przeprojektowano wniosek o anulowanie służby (wybór z listy zaplanowanych służb).
- 🔒 Wprowadzono blokadę składania raportów przed dniem odbywania służby.
- 📋 Wzbogacono wykaz brygad o godziny pierwszego i ostatniego przystanku oraz nazwy „Godzina Wyjazdu” i „Godzina Zjazdu”.
- 📜 Wdrożono archiwum i historię wniosków oraz zgłoszeń warsztatowych.
- 🖼️ Dodano obsługę awatarów profilowych kierowcy.
- 🌓 Wprowadzono przełącznik trybu ciemnego/jasnego.
- 🧼 Uporządkowano pasek nawigacji i zaktualizowano wersję do `0.3.0.0`.

---
*VZTM Kielce © 2026. Wszelkie prawa zastrzeżone.*
