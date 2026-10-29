# 🚍 VZTM Kielce – Oficjalny Poradnik Użytkownika i Dokumentacja Systemu

Witaj w oficjalnym przewodniku po systemie **VZTM Kielce** (Wirtualny Zarząd Transportu Miejskiego w Kielcach – wirtualna firma dla symulatora OMSI 2).  
Wersja systemu: **0.5.0**.

System łączy zarządzanie przewoźnikami **VMPK Kielce** (malowanie żółto-czerwone) oraz **VBP Tour Regio Kielce** (malowanie niebieskie), organizację taboru, rozkłady brygad, grafik służb, zgłaszanie usterek warsztatowych, składanie wniosków pracowniczych, dwustronną komunikację oraz weryfikację raportów z tras i integrację z Discordem.

---

## 📑 Spis treści
1. [Struktura ról i numery służbowe](#-struktura-ról-i-numery-służbowe)
2. [Model dostępu do paneli](#-model-dostępu-do-paneli)
3. [Rejestracja i rekrutacja kierowcy](#-rejestracja-i-rekrutacja-kierowcy)
4. [Poradnik dla Kierowcy (Panel Kierowcy)](#-poradnik-dla-kierowcy)
   - [Profil, awatar i numer służbowy](#profil-awatar-i-numer-służbowy)
   - [Wybór etatu (Limit 6/7)](#wybór-etatu-limit-67)
   - [Wgląd do taboru swojego przewoźnika](#wgląd-do-taboru-swojego-przewoźnika)
   - [Odbiór służby, szczegóły brygady i blokada raportów](#odbiór-służby-szczegóły-brygady-i-blokada-raportów)
   - [Wykonywanie i raportowanie służby](#wykonywanie-i-raportowanie-służby)
   - [Wnioski pracownicze](#wnioski-pracownicze)
   - [Zgłoszenia techniczne i warsztat](#zgłoszenia-techniczne-i-warsztat)
5. [Poradnik dla Zarządu i Kadry Kierowniczej](#-poradnik-dla-kadry-kierowniczej)
   - [Uprawnienia właściciela](#uprawnienia-właściciela)
   - [Karta profilowa ze statystykami i zegarem LiveClock](#karta-profilowa-ze-statystykami-i-zegarem-liveclock)
   - [Uprawnienia poszczególnych ról](#uprawnienia-poszczególnych-ról)
   - [Dedykowani przewoźnicy dla Linii i Brygad](#dedykowani-przewoźnicy-dla-linii-i-brygad)
   - [Układanie grafiku, blokada urlopowa i walidacja dni/przewoźników](#układanie-grafiku-blokada-urlopowa-i-walidacja-dniprzewoźników)
   - [Wykaz brygad](#wykaz-brygad)
   - [Weryfikacja raportów i licznik taboru](#weryfikacja-raportów-i-licznik-taboru)
   - [Historia zgłoszeń technicznych i wniosków](#historia-zgłoszeń-technicznych-i-wniosków)
6. [Funkcje wizualne i techniczne](#-funkcje-wizualne-i-techniczne)
7. [Integracja z Discordem](#-integracja-z-discordem)
   - [1. Powiadomienia (webhooki i wiadomości prywatne)](#1-powiadomienia-webhooki-i-wiadomości-prywatne)
   - [2. Powiązanie konta i logowanie przez Discord](#2-powiązanie-konta-i-logowanie-przez-discord)
   - [3. Bot (komendy slash)](#3-bot-komendy-slash)
   - [4. Role na serwerze](#4-role-na-serwerze)
8. [Zmienne środowiskowe i wdrożenie](#-zmienne-środowiskowe-i-wdrożenie)
   - [Tabela zmiennych środowiskowych](#tabela-zmiennych-środowiskowych)
   - [Baza danych i wdrożenie](#baza-danych-i-wdrożenie)
9. [Historia zmian – Wersja 0.5.1](#-historia-zmian--wersja-051)
10. [Historia zmian – Wersja 0.5.0](#-historia-zmian--wersja-050)
11. [Historia wcześniejszych wydań](#-historia-wcześniejszych-wydań)

---

## 👥 Struktura ról i numery służbowe

Każdy użytkownik w systemie posiada przypisaną rolę oraz **unikalny numer służbowy** wygenerowany zgodnie z oficjalnym formatem:

| Rola | Oznaczenie | Zakres numeru | Opis i uprawnienia |
| :--- | :---: | :---: | :--- |
| **Właściciel** | `W` | `W0` – `W1` | Pełna administracja systemem, zarządzanie personelem, taborem, liniami i grafikiem. |
| **Dyspozytor** | `D` | `D1` – `D99` | Układanie grafiku, przydzielanie służb kierowcom, koordynacja ruchu. |
| **Kierownik Działu Przewozów** | `P` | `P1` – `P99` | Zarządzanie liniami komunikacyjnymi, trasami i wykazem brygad, przydzielanie linii operatorom. |
| **Mechanik** | `M` | `M1` – `M99` | Zarządzanie taborem, serwis techniczny, kierowanie wozów na warsztat i zatwierdzanie napraw. |
| **Sprawdzający** | `S` | `S1` – `S99` | Sprawdzanie i zatwierdzanie raportów z tras oraz rozpatrywanie wniosków pracowniczych. |
| **Kierowca** | `K` | `K1` – `K9999` | Realizacja przydzielonych służb, składanie raportów z OMSI 2, zgłaszanie wniosków i awarii. |

---

## 🔐 Model dostępu do paneli

Dostęp do poszczególnych widoków systemu i tras API jest ściśle kontrolowany na poziomie ról użytkowników:

- **Właściciel (`WLASCICIEL`) i Zarząd (`ZARZAD`):**
  - Dostęp do obu paneli: Panelu Zarządu (`/panel/zarzad`) oraz Panelu Kierowcy (`/panel/kierowca`).
  - Pełna funkcjonalność kierowcy na własnym koncie (odbiór i realizacja służb, składanie raportów, wnioski pracownicze, zgłaszanie awarii).
  - Pełna widoczność taboru obu spółek (`VMPK` i `VBP`) bez ograniczeń przewoźnika.
- **Role funkcyjne kadry (Dyspozytor `D`, Kierownik Działu Przewozów `P`, Mechanik `M`, Sprawdzający `S`):**
  - Dostęp do Panelu Zarządu (`/panel/zarzad`) w zakresie modułów przypisanych do danej roli zgodnie z `src/lib/roles.ts`:
    - **Dyspozytor:** grafik służb, przydzielanie kursów, koordynacja ruchu.
    - **Kierownik Działu Przewozów:** zarządzanie liniami, rozkładami brygad i operatorami.
    - **Mechanik:** ewidencja taboru, kierowanie wozów na warsztat, zatwierdzanie napraw.
    - **Sprawdzający:** weryfikacja i rozliczanie raportów z tras, rozpatrywanie wniosków kierowców.
  - Dostęp do Panelu Kierowcy (`/panel/kierowca`) dla realizacji własnych służb.
- **Kierowca (`KIEROWCA`):**
  - Dostęp wyłącznie do Panelu Kierowcy (`/panel/kierowca`) oraz dedykowanych tras API kierowcy (`/api/panel/kierowca/*`).
  - Próba bezpośredniego wejścia na ścieżkę `/panel/zarzad` (lub dowolną jej podstronę) skutkuje natychmiastowym przekierowaniem na `/panel/kierowca`.
  - Zapytania HTTP skierowane do tras `/api/panel/zarzad/*` są odrzucane z kodem `403 Forbidden` w formacie JSON.
- **Użytkownicy niezalogowani (Goście):**
  - Próba wejścia na dowolną podstronę panelu (`/panel/:path*`) powoduje przekierowanie do formularza logowania (`/login?callbackUrl=...`).
  - Żądania do API panelu (`/api/panel/:path*`) bez aktywnej sesji otrzymują odpowiedź `401 Unauthorized` (JSON).
  - Otwarte trasy publiczne: `/api/auth/*` (autoryzacja NextAuth), `/api/discord/interactions` (komendy slash bota Discord), `/api/kontakt` (formularz kontaktowy) oraz `/api/version` (informacja o wersji).
- **Architektura ochrony:**
  - Ochrona realizowana jest globalnie przez moduł `src/proxy.ts` (standard Next.js 16 zastępujący `middleware.ts`), który weryfikuje token sesyjny JWT (`getToken` z `next-auth/jwt`).
  - Niezależnie od proxy, każdy handler API w `/api/panel/**` posiada własną autoryzację backendową (`getServerSession(authOptions)` wraz z weryfikacją roli), gwarantując pełną redundancję zabezpieczeń (Defense in Depth).

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
   - Zaakceptowany urlop bezwzględnie blokuje dyspozytorowi możliwość wydania służby w tym terminie. Maksymalny czas urlopu wynosi 14 dni.
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
8. **Wniosek o odwieszenie konta:**
   - Dostępny w przypadku zawieszenia konta kierowcy (np. przy przekroczeniu limitu niezaliczonych służb).

Wszystkie rozpatrzone wnioski trafiają do podsekcji **Historia wniosków**.

### Zgłoszenia techniczne i warsztat
- W przypadku awarii wozu podczas gry zgłoś usterkę w sekcji technicznej.
- Po naprawieniu wozu przez Mechanika zgłoszenie automatycznie przenosi się do **Historii zgłoszeń technicznych**, a pojazd odzyskuje status sprawny.

---

## 👑 Poradnik dla Kadry Kierowniczej

### Uprawnienia właściciela
- Uprawnienia w systemie wynikają **wyłącznie z przypisanej roli** (`WLASCICIEL` / `ZARZAD`), a nie z konkretnej nazwy użytkownika.
- Numer służbowy nadawany jest automatycznie według roli przez generator (`generateBadgeNumber`), z prefiksem `W` dla Właściciela (np. `W1`).
- Właściciel posiada dostęp do obu paneli (`/panel/zarzad` oraz `/panel/kierowca`) z pełną funkcjonalnością kierowcy na swoim koncie oraz wglądem do taboru obu przewoźników (`VMPK` i `VBP`).

### Karta profilowa ze statystykami i zegarem LiveClock
Na samej górze Panelu Zarządu znajduje się pełna karta profilowa tożsama z panelem kierowcy:
- Wyświetla awatar z plakietką numeru służbowego (np. `W1`), nazwę użytkownika, rolę oraz spółkę (`VMPK` lub `VBP`).
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
   - Czas rzeczywisty w języku polskim w Panelu Zarządu oraz Panelu Kierowcy.
4. **Płynna responsywność:**
   - Pełne wsparcie dla urządzeń mobilnych, tabletów i komputerów stacjonarnych.

---

## 💬 Integracja z Discordem

System łączy się z Discordem na cztery sposoby. Każdy element działa niezależnie – brak zmiennych środowiskowych po prostu wyłącza dany element, a reszta systemu działa normalnie.

### 1. Powiadomienia (webhooki i wiadomości prywatne)

| Zdarzenie | Gdzie trafia |
| :--- | :--- |
| Nowe zgłoszenie rekrutacyjne | kanał `REKRUTACJA` |
| Nowy wniosek kierowcy | kanał `WNIOSKI` |
| Nowa usterka | kanał `USTERKI` + **wiadomość prywatna do mechaników** |
| Nowy raport do sprawdzenia | kanał `RAPORTY` |
| Wiadomość kierowcy do Zarządu | kanał `WIADOMOSCI` |
| Formularz kontaktowy ze strony | kanał `KONTAKT` |
| Decyzja o wniosku, nowa służba w grafiku, wynik sprawdzenia raportu, wiadomość i odpowiedź od Zarządu, akceptacja konta, zmiana roli | **wiadomość prywatna do zainteresowanego** |

Wiadomości prywatne dostają tylko osoby, które powiązały konto Discord i nie wyłączyły powiadomień (przełącznik w panelu). Jeśli ktoś ma zablokowane wiadomości prywatne od członków serwera, wysyłka po cichu się pomija – akcja w systemie nie jest blokowana.

### 2. Powiązanie konta i logowanie przez Discord

1. W [Discord Developer Portal](https://discord.com/developers/applications) utwórz aplikację i w zakładce **OAuth2** dodaj dwa adresy przekierowania:
   - `https://TWOJA-DOMENA/api/auth/callback/discord` (logowanie)
   - `https://TWOJA-DOMENA/api/discord/link/callback` (powiązanie konta)
2. Ustaw zmienne `DISCORD_CLIENT_ID` i `DISCORD_CLIENT_SECRET`.
3. Zalogowany użytkownik klika w panelu **Połącz z Discordem**. Od tej chwili na stronie logowania pojawia się przycisk **Zaloguj się przez Discord**.
4. Przy odłączeniu konta Discord (`/api/discord/unlink`) bot automatycznie usuwa przypisane role serwerowe oraz resetuje pseudonim kierowcy na serwerze.

Logowanie przez Discord działa wyłącznie dla kont wcześniej powiązanych i zaakceptowanych – nie tworzy nowych kont. Powiązanie wymaga uprzedniego zalogowania hasłem.

### 3. Bot (komendy slash)

Bot działa bez stałego procesu: Discord wysyła komendy na adres strony.

1. W ustawieniach aplikacji w polu **Interactions Endpoint URL** wpisz `https://TWOJA-DOMENA/api/discord/interactions`.
2. Ustaw `DISCORD_PUBLIC_KEY`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`.
3. Zarejestruj komendy (raz): `node scripts/discord-register-commands.js`.
4. Zaproś bota na serwer (zakres `bot` i `applications.commands`; do ról potrzebne jest uprawnienie *Zarządzanie rolami*, a rola bota musi być **wyżej** niż role zarządzane przez system).

| Komenda | Opis |
| :--- | :--- |
| `/zarzad` | Panel zarządu: liczniki spraw, przegląd i szybkie decyzje (wnioski, raporty, usterki, rekrutacja) |
| `/grafik` | Twój grafik na 7 dni |
| `/sluzba` | Twoja służba na dziś i jutro |
| `/status` | Rola, przewoźnik, etat, niezaliczone służby, wnioski |
| `/linie` | Lista linii (dostępna dla każdego) |
| `/tabor` | Stan taboru VMPK i VBP (dostępna dla każdego) |

Odpowiedzi są widoczne tylko dla osoby, która użyła komendy (flaga `flags: 64` / ephemeral).

#### Panel Zarządu w bocie Discord (`/zarzad`)
Komenda `/zarzad` zapewnia bezpieczny mobilny dostęp do najważniejszych funkcji zarządczych bezpośrednio w Discordzie:
- **Wymagane role:** Dostępna wyłącznie dla zweryfikowanych i aktywnych członków kadry (`canAccessManagementPanel`): `WLASCICIEL`, `ZARZAD`, `KIEROWNIK`, `DYSPOZYTOR`, `SPRAWDZAJACY`, `MECHANIK`. Dla zwykłego kierowcy (`KIEROWCA`) oraz osób bez powiązanego konta bot zwraca komunikat *Brak uprawnień*.
- **Liczniki spraw:** Embed wyświetla bieżące liczniki spraw wymagających decyzji: wnioski `PENDING` (`canManageRequests`), raporty `PENDING` (`canManageRequests`), nowe usterki `NOWE` (`canManageFleet`) oraz oczekujących kandydatów `PENDING` (`canManageUsers`). Użytkownik widzi wyłącznie liczniki, do których posiada uprawnienia.
- **Dostępne moduły akcji:**
  - **Wnioski kierowców (`DriverRequest`)**: przeglądanie do 5 najstarszych wniosków oczekujących, przyciski *Zatwierdź* / *Odrzuć* dla aktualnie wyświetlanego wniosku oraz strzałki paginacji. Zatwierdzenie wykonuje wszystkie skutki uboczne w atomowej transakcji (`STALY_POJAZD`, `ZMIANA_ETATU`, `ODWIESZENIE`, `ANULOWANIE_SLUZBY`) i wysyła powiadomienie kierowcy (wymaga `canManageRequests`).
  - **Raporty ze służb (`Report`)**: weryfikacja raportów ze służb z bezpiecznymi odnośnikami do zrzutów ekranu i linkiem do panelu WWW. Zatwierdzenie aktualizuje przebieg przypisanego pojazdu i powiadamia kierowcę (wymaga `canManageRequests`).
  - **Usterki techniczne (`VehicleDefect`)**: lista nowych usterek (status `NOWE`) z możliwością natychmiastowego skierowania na warsztat (`WARSZTAT`) lub oznaczenia jako naprawione (`NAPRAWIONE`) wraz ze spójną aktualizacją stanu pojazdu w transakcji (wymaga `canManageFleet`).
  - **Rekrutacja kandydatów (`User`)**: akceptacja i odrzucanie oczekujących zgłoszeń kandydatów (`PENDING`) z automatycznym nadaniem numeru służbowego (badge) i natychmiastową synchronizacją ról na serwerze Discord (wymaga `canManageUsers`).
- **Bezpieczeństwo i zasady operacyjne:**
  - **Wszystkie odpowiedzi są efemeryczne** (niewidoczne dla osób trzecich).
  - **Brak operacji destrukcyjnych:** bot nie pozwala na usuwanie kont, modyfikację ról, zawieszanie użytkowników ani zmiany w taborze, liniach czy grafikach.
  - **Ochrona przed powtórzeniami i atakami:** ścisła weryfikacja uprawnień przy każdej akcji, ponowne sprawdzanie statusu `PENDING` przed wykonaniem decyzji, walidacja formatu parametrów `custom_id` (regex cuid/uuid) oraz rate limit 30 akcji na 10 minut na użytkownika (`rateLimit` z `@/lib/rateLimit`).
  - **Rejestracja komend:** po wdrożeniu zmian należy zarejestrować komendę w Discord API:
    ```bash
    node scripts/discord-register-commands.js
    ```

### 4. Role na serwerze

Po akceptacji konta, zmianie roli lub kliknięciu przycisku **Synchronizuj role na serwerze** (Panel Zarządu) bot nadaje rolę Discord odpowiadającą roli w systemie oraz przewoźnikowi (`DISCORD_ROLE_*`). Synchronizacja użytkownika objęta jest ograniczeniem czasowym (rate limit: maks. 3 próby na 10 minut).

---

## ⚙️ Zmienne środowiskowe i wdrożenie

Wszystkie zmienne konfiguracyjne aplikacji definiowane są w pliku `.env` (lokalnie) lub w ustawieniach środowiskowych platformy hostingowej (np. Vercel). Przykładowy szablon konfiguracji znajduje się w pliku `.env.example`.

### Tabela zmiennych środowiskowych

| Zmienna | Wymagana | Opis i przeznaczenie |
| :--- | :---: | :--- |
| `DATABASE_URL` | **Tak** | Ciąg połączeniowy do bazy danych PostgreSQL (np. Neon: `postgresql://user:pass@ep-xyz.eu-central-1.aws.neon.tech/neondb?sslmode=require`). |
| `NEXTAUTH_SECRET` | **Tak** | 32-bajtowy klucz szyfrowania tokenów sesyjnych JWT. Wymagany przez NextAuth oraz `src/proxy.ts`. Wygenerowanie: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `NEXTAUTH_URL` | **Tak** | Pełny kanoniczny adres URL aplikacji (np. `https://twoja-domena.vercel.app` lub `http://localhost:3000`). |
| `DISCORD_CLIENT_ID` | Opcjonalna | Application ID z Discord Developer Portal. Wykorzystywany do logowania OAuth2 oraz powiązania konta. |
| `DISCORD_CLIENT_SECRET` | Opcjonalna | Klucz tajny (Client Secret) aplikacji Discord z zakładki OAuth2. |
| `DISCORD_PUBLIC_KEY` | Opcjonalna | Klucz publiczny aplikacji Discord do weryfikacji podpisów kryptograficznych Ed25519 komend slash bota. |
| `DISCORD_BOT_TOKEN` | Opcjonalna | Token bota Discord do wysyłania wiadomości prywatnych, zarządzania rolami i rejestracji komend. |
| `DISCORD_GUILD_ID` | Opcjonalna | ID serwera Discord (gildii), na którym działa bot i na którym synchronizowane są role kierowców. |
| `DISCORD_WEBHOOK_URL` | Opcjonalna | Główny/domyślny adres webhooka Discord dla powiadomień systemowych (gdy brak webhooka dedykowanego). |
| `DISCORD_WEBHOOK_<KANAŁ>` | Opcjonalna | Dedykowane webhooki: `DISCORD_WEBHOOK_REKRUTACJA`, `DISCORD_WEBHOOK_WNIOSKI`, `DISCORD_WEBHOOK_USTERKI`, `DISCORD_WEBHOOK_RAPORTY`, `DISCORD_WEBHOOK_WIADOMOSCI`, `DISCORD_WEBHOOK_KONTAKT`. |
| `DISCORD_ROLE_<ROLA>` | Opcjonalna | ID ról na serwerze Discord do synchronizacji: `DISCORD_ROLE_WLASCICIEL`, `DISCORD_ROLE_DYSPOZYTOR`, `DISCORD_ROLE_KIEROWNIK`, `DISCORD_ROLE_MECHANIK`, `DISCORD_ROLE_SPRAWDZAJACY`, `DISCORD_ROLE_KIEROWCA`, `DISCORD_ROLE_VMPK`, `DISCORD_ROLE_VBP`. |
| `OWNER_SETUP_TOKEN` | Opcjonalna | Opcjonalny token inicjalizacyjny dla konfiguracji pierwszego konta właściciela. |

### Baza danych i wdrożenie

- **Wdrożenie schematu bazy danych:** Wykonuje się ręcznie za pomocą polecenia `npm run db:push` (dla baz prototypowych) lub `npm run db:migrate` (dla migracji produkcyjnych). W skryptach wdrożeniowych celowo wykluczono flagę `--accept-data-loss`.
- **Zasilenie bazy danymi (seed):** Wykonuje się jednorazowo poleceniem `npm run db:seed`.
- **Automatyczny build:** Skrypt `npm run build` wykonuje kolejno `prisma generate && next build`, generując klienta Prisma przed kompilacją Next.js.
- **Środowisko Preview na Vercelu:** Powinno korzystać z osobnej gałęzi bazy danych (np. dedykowanego brancha w Neon) niż baza produkcyjna, aby zapobiec modyfikacjom danych produkcyjnych przez wdrożenia testowe.

---

## 🚀 Historia zmian – Wersja 0.5.1

Wydanie **0.5.1** rozbudowuje integrację z Discordem o dedykowany mobilny Panel Zarządu (`/zarzad`), architekturę współdzielonych modułów logiki biznesowej oraz testy jednostkowe:

1. **Mobilny Panel Zarządu w bocie Discord (`/zarzad`):**
   - Dodano komendę `/zarzad` wraz z bezpieczną obsługą komponentów interaktywnych (przyciski decyzji i nawigacji).
   - Liczniki spraw oczekujących (`PENDING`/`NOWE`) z automatycznym filtrowaniem pod kątem uprawnień zalogowanego użytkownika.
   - Paginowany przegląd i zatwierdzanie/odrzucanie wniosków kierowców z atomowym stosowaniem skutków ubocznych w transakcji (`STALY_POJAZD`, `ZMIANA_ETATU`, `ODWIESZENIE`, `ANULOWANIE_SLUZBY`).
   - Weryfikacja i rozpatrywanie raportów ze służb z aktualizacją licznika pojazdu i bezpiecznymi odnośnikami do załączników.
   - Obsługa zgłoszeń warsztatowych (kierowanie pojazdu do warsztatu `WARSZTAT` lub oznaczenie usterki jako naprawionej `NAPRAWIONE` wraz z aktualizacją statusu pojazdu w transakcji).
   - Rekrutacja kandydatów: akceptacja i odrzucanie zgłoszeń z przydzieleniem unikalnego numeru służbowego (badge) oraz automatyczną synchronizacją ról na serwerze Discord.
   - Rygorystyczne bezpieczeństwo: odpowiedzi wyłącznie efemeryczne (`flags: 64`), brak operacji destrukcyjnych, walidacja formatu identyfikatorów w `custom_id` (regex), ochrona przed podwójnym kliknięciem (`status === "PENDING"`) oraz rate limit 30 akcji / 10 min na użytkownika.

2. **Architektura Single Source of Truth (współdzielona logika domenowa):**
   - Wyekstrahowano logikę biznesową do dedykowanych modułów w `src/lib/`:
     - `src/lib/requests.ts` (`reviewRequest`) – wspólna logika dla endpointu WWW `/api/panel/zarzad/wnioski` oraz bota Discord.
     - `src/lib/reports.ts` (`reviewReport`) – wspólna logika dla endpointu WWW `/api/panel/zarzad/raporty` oraz bota Discord.
     - `src/lib/defects.ts` (`reviewDefect`) – transakcyjna obsługa usterek dla WWW `/api/panel/zarzad/usterki` i bota Discord.
     - `src/lib/recruitment.ts` (`reviewCandidate`) – obsługa akceptacji/odrzucania kandydatów dla WWW `/api/panel/zarzad/akceptacja` i bota Discord.
   - Wyeliminowano duplikację kodu, zapewniając 100% spójności zachowania, powiadomień i skutków ubocznych między interfejsem webowym a Discordem.

3. **Testy jednostkowe (`tests/discordZarzad.test.ts`):**
   - Wdrożono zestaw testów dla parsera akcji `parseZarzadCustomId`, walidatora identyfikatorów `ID_REGEX` oraz mapowania uprawnień zarządczych `getZarzadPermissions`.

---

## 🚀 Historia zmian – Wersja 0.5.0

Wydanie **0.5.0** to fundamentalna aktualizacja skupiona na wzmocnieniu bezpieczeństwa całego systemu, eliminacji podatności sieciowych (Path Traversal, XSS, CSRF), wdrożeniu globalnego mechanizmu proxy Next.js 16, usunięciu uprawnień po nazwach użytkowników na rzecz czystego modelu opartego o role, optymalizacji bota Discord oraz unowocześnieniu skryptów wdrożeniowych:

1. **Bezpieczeństwo plików i ochrona przed Path Traversal / XSS:**
   - Wprowadzono moduł `src/lib/files.ts` z funkcjami walidującymi `isSafeStoredFile` oraz `isSafeImageUrl`.
   - Zezwolono wyłącznie na bezpieczne formaty danych: `data:image/(png|jpeg|webp);base64,...` (oraz `data:text/plain` dla raportów), bezpieczne ścieżki `/uploads/reports/<nazwa>` (alfanumeryczne bez sekwencji `..`) oraz zewnętrzne odnośniki `https://`.
   - Bezwzględne odrzucanie niebezpiecznych schematów (`javascript:`, `data:image/svg+xml`, prób path traversal `/../.env`).
   - Bezpieczny odczyt plików z dysku w `src/app/api/panel/zarzad/raporty/plik/route.ts` ograniczony wyłącznie do katalogu `/uploads/reports/` wewnątrz `public/uploads` zweryfikowanego przez `path.resolve`, z wymuszeniem nagłówków `X-Content-Type-Options: nosniff` oraz `Cache-Control: private, no-store`. Odpowiedzi błędów 500 nie ujawniają szczegółów technicznych serwera.
   - Osłonięcie renderowania tagów `<img>` i `<a>` walidatorem `isSafeImageUrl` w galeriach usterek, formularzach zgłoszeniowych (`DefectReportForm`), liście załączników (`ReportFileList`) oraz na podstronach taboru i profilu.
   - Dodano testy jednostkowe walidacji plików (`tests/files.test.ts`).

2. **Zaawansowana walidacja i optymalizacja bota Discord (`src/app/api/discord/interactions/route.ts`):**
   - **Raporty (`modal_report_*`):** Natychmiastowe odrzucenie zgłoszenia, jeśli konto kierowcy jest zawieszone (`user.suspended`). Blokada raportowania służb zaplanowanych na przyszłość na podstawie daty w strefie `Europe/Warsaw`. Rygorystyczna walidacja całkowitoliczbowości przebiegów (`Number.isInteger`, `>= 0`, maksymalny dystans na służbie 2000 km, licznik `<= 2 000 000 000 km`). Aktualizacja licznika autobusu następuje tylko przy prawidłowej delcie. Wymóg bezpiecznych zrzutów ekranu wyłącznie jako URL `https://`. Podsumowanie tekstowe przycinane do 1000 znaków.
   - **Wnioski (`modal_request`):** Wprowadzono ścisłą allowlistę typów wniosków (`URLOP`, `DODATKOWA_SLUZBA`, `ZMIANA_ETATU`, `ANULOWANIE_SLUZBY`, `ODWIESZENIE`, `STALY_POJAZD`, `INNE`). Wnioski urlopowe wymagają obu dat, relacji `end >= start` oraz limitu maksymalnie 14 dni z komunikatem o kontakcie z Zarządem. Kierowca z zawieszonym kontem może przesłać wyłącznie wniosek o `ODWIESZENIE`. Ograniczenie długości uzasadnienia (500 znaków) i szczegółów (200 znaków).
   - **Usterki (`modal_defect`):** Wyszukiwanie pojazdu w bazie po numerze taborowym z uwzględnieniem przewoźnika kierowcy (`user.carrier`), zapobiegające kolizjom numeracji między VMPK i VBP. Obsługa wielu dopasowań z prośbą o doprecyzowanie. Zdjęcia przyjmowane wyłącznie jako `https://` (w przeciwnym razie pusta tablica `[]` zamiast napisu "brak"). Atomowy zapis zgłoszenia awarii oraz zmiana statusu pojazdu na `WARSZTAT` w pojedynczej transakcji `prisma.$transaction`. Ograniczenie liczby zgłoszeń (rate limit: 5/godz.).
   - **Odznaka:** Budowana wyłącznie na bazie `user.badgeNumber` (wyeliminowano hardkodowane fallbacki do `W1`).

3. **Zarządzanie integracją i kontem Discord:**
   - **Rate limit synchronizacji (`sync-me`):** Ograniczenie do maksymalnie 3 prób na 10 minut na użytkownika, chroniące przed przekroczeniem limitów Discord API.
   - **Odłączanie konta (`unlink`):** Nowy endpoint `src/app/api/discord/unlink/route.ts` realizujący bezpieczne odpięcie konta, usunięcie ról serwerowych z Discorda oraz przywrócenie domyślnego nicku.
   - **Ochrona konfiguracji (`/api/discord/me`):** Pola konfiguracyjne ról i uprawnień serwera są dostępne do odczytu i modyfikacji wyłącznie dla uprawnionych ról funkcyjnych (`canManageUsers`).
   - **Testy jednostkowe:** Weryfikacja sygnatur kryptograficznych Ed25519 oraz podpisów stanu OAuth w `tests/discord.test.ts`.

4. **Uprawnienia wynikające wyłącznie z ról i bezpieczeństwo autoryzacji:**
   - Usunięto wszelkie uprawnienia, aliasy administracyjne oraz automatyczne przydziały odznak przypisane na sztywno do konkretnych loginów.
   - Uprawnienia weryfikowane są bezwzględnie na podstawie roli (`role === "WLASCICIEL"` lub `role === "ZARZAD"`).
   - Automatyczny przydział brakującego numeru służbowego `badgeNumber` na podstawie roli (`generateBadgeNumber`) w sesji i w bazie.
   - Zoptymalizowano kolejność autoryzacji w `src/lib/auth.ts`: limit prób logowania ➔ wyszukanie użytkownika ➔ weryfikacja hasła (bcrypt) ➔ weryfikacja statusu akceptacji (`ACCEPTED`) ➔ przydział odznaki ➔ wyczyszczenie licznika prób (`clearKey`). Komunikaty błędów nie ujawniają, czy dany login istnieje w bazie.
   - Zalogowanie na konto zawieszone (`suspended: true`) pozostaje dozwolone, umożliwiając kierowcy złożenie wniosku o odwieszenie (`ODWIESZENIE`).
   - Wymóg aktywnej sesji użytkownika na stronie `/tabor`.
   - Precyzyjne reguły usuwania wniosków urlopowych (`usun-urlop`): kierowca może usunąć wyłącznie własny wniosek urlopowy, a kadra zarządzająca (`canManageRequests` / `isUserAdminOrOwner`) posiada uprawnienia zarządcze.

5. **Nowy model ochrony tras i Proxy (Next.js 16):**
   - Utworzono plik `src/proxy.ts` (nowy standard Next.js 16 zastępujący `middleware.ts`), chroniący ścieżki `/panel/*` oraz `/api/panel/*`.
   - Użytkownicy o roli `KIEROWCA` są blokowani przed dostępem do `/panel/zarzad` (przekierowanie na `/panel/kierowca`) oraz tras `/api/panel/zarzad/*` (odpowiedź 403 Forbidden).
   - Niezalogowani użytkownicy są przekierowywani do `/login` (lub otrzymują kod 401 w przypadku API).
   - Handlery API posiadają dodatkowo niezależną weryfikację sesji i ról (`getServerSession`).

6. **Zarządzanie wnioskami, służbami, liniami i taborem:**
   - Weryfikacja CSRF (`assertSameOrigin`) we wszystkich metodach mutujących (`POST`, `PUT`, `PATCH`, `DELETE`).
   - Dedykowane endpointy edycji i usuwania brygad, linii, taboru i służb z kontrolą ról uprawnionych.
   - Usunięcie nieużywanych rzutowań `as any` przy obsłudze sesji i uprawnień.

7. **Optymalizacja skryptów wdrożeniowych i zależności:**
   - Skrypt `npm run build` zmieniony na `prisma generate && next build` (usunięto niebezpieczne automatyczne `db push` bez migracji).
   - Dodano jawne skrypty wdrożeniowe bazy danych: `npm run db:push`, `npm run db:migrate` oraz `npm run db:seed`.
   - Usunięto nieużywane i zbędne zależności: `@types/bcryptjs`, `@libsql/client` oraz `@prisma/adapter-libsql`.
   - Zaktualizowano wersję projektu w `package.json` do `0.5.0`.

---

## 📜 Historia wcześniejszych wydań

### Wersja 0.4.5.0
- Wniosek o odwieszenie konta ściśle powiązany z 10 niezaliczonymi służbami.
- Poprawki w jasnym motywie (Light Theme): pastelowe tła, wysoki kontrast i czytelne etykiety.
- Historia wysyłania wiadomości w Panelu Zarządu oraz Panelu Kierowcy.
- Data i godzina w czasie rzeczywistym w Panelu Kierowcy (komponent LiveClock).
- Dedykowany podział zmian według rodzaju linii (linie nocne N1 i N2 powiązane z 3 Zmianą).
- Wyznaczanie wozu zastępczego ściśle powiązane ze zgłoszeniem awarii w warsztacie.
- Poprawny nagłówek floty dla Właściciela w Panelu Kierowcy (widok wszystkich wozów VMPK i VBP).
- Responsywny wykaz brygad u kierowcy z limitem kolumn i poziomym przewijaniem.
- Dwustronna komunikacja kierowcy z zarządem oraz możliwość bezpośrednich odpowiedzi.
- Automatyczne niezaliczenie służby z przeszłości bez zatwierdzonego raportu.
- Odrabianie niezaliczonych służb przez służby dodatkowe w relacji 1:1.

### Wersja 0.4.0.0
- Pełna widoczność taboru dla Właściciela (rola `WLASCICIEL` / `ZARZAD`) – wgląd do wszystkich pojazdów floty VBP i VMPK.
- Obowiązkowy powód we wniosku o zmianę etatu (`ZMIANA_ETATU`).
- Limit urlopu wypoczynkowego (`URLOP`) do maksymalnie 14 dni z wymogiem kontaktu z Zarządem w sprawach dłuższych urlopów.
- Wybór zmiany (1, 2, 3 Zmiana) i formatowanie brygad przy przydzielaniu służby.
- Obsługa linii nocnych N1 i N2 powiązanych z 3 Zmianą.
- System ostrzeżeń (5 służb) i zawieszeń (10 służb) przy niezaliczonych służbach.
- Wyznaczanie wozu zastępczego przy awarii na trasie.
- Usunięcie przycisku „Zobacz Tabor” z podstron przewoźników.
- Dopracowanie paska nawigacji w trybie jasnym.
- Wysyłanie bezpośrednich wiadomości do kierowcy.
- Zmiana hasła bezpośrednio na stronie logowania.

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

---
*VZTM Kielce © 2026. Wszelkie prawa zastrzeżone.*
