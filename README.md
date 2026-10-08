# 🚍 VZTM Kielce – Poradnik Użytkownika i Systemu

Witaj w oficjalnym przewodniku po systemie **VZTM Kielce** (Wirtualny Zarząd Transportu Miejskiego w Kielcach – wirtualna firma dla symulatora OMSI 2).  
System umożliwia zarządzanie przewoźnikami **VMPK Kielce** oraz **VBP Kielce**, prowadzenie taboru, układanie rozkładów brygad, przydzielanie służb kierowcom oraz pełne rozliczanie i raportowanie wykonanych kursów.

---

## 📑 Spis treści
1. [Role w systemie](#-role-w-systemie)
2. [Jak korzystać ze strony – Pasażer / Odwiedzający](#-poradnik-dla-pasażera--odwiedzającego)
3. [Rejestracja i rekrutacja kierowcy](#-rejestracja-i-rekrutacja-kierowcy)
4. [Poradnik dla Kierowcy (Panel Kierowcy)](#-poradnik-dla-kierowcy)
   - [Grafik i przydzielone służby](#grafik-i-przydzielone-służby)
   - [Wykonywanie i raportowanie służby](#wykonywanie-i-raportowanie-służby)
   - [Automatyczne naliczanie kilometrów taboru](#automatyczne-naliczanie-kilometrów-taboru)
   - [Zgłaszanie awarii i usterek do warsztatu](#zgłaszanie-awarii-i-usterek-do-warsztatu)
   - [Wnioski pracownicze (urlopy, dodatkowe służby)](#wnioski-pracownicze)
5. [Poradnik dla Zarządu (Konto Zarządu: Godksawiss)](#-poradnik-dla-zarządu-konto-godksawiss)
   - [Dostęp do Panelu Zarządu](#dostęp-do-panelu-zarządu)
   - [Zatwierdzanie nowych kierowców](#zatwierdzanie-nowych-kierowców)
   - [Zarządzanie taborem autobusowym](#zarządzanie-taborem-autobusowym)
   - [Zarządzanie liniami komunikacyjnymi](#zarządzanie-liniami-komunikacyjnymi)
   - [Wykaz brygad i typy dni (dni robocze, soboty, niedziele)](#wykaz-brygad-i-typy-dni)
   - [Układanie grafiku i przydział służb](#układanie-grafiku-i-przydział-służb)
   - [Weryfikacja raportów i podgląd plików](#weryfikacja-raportów-i-podgląd-plików)
   - [Obsługa warsztatu i wiadomości kontaktowych](#obsługa-warsztatu-i-wiadomości-kontaktowych)
6. [Wersja systemu i informacje techniczne](#-wersja-systemu)

---

## 👥 Role w systemie

1. **Gość / Pasażer** – ma dostęp do publicznych rozkładów, wykazu linii, stanu taboru, harmonogramu brygad oraz formularza kontaktowego.
2. **Kierowca (`KIEROWCA`)** – po zaakceptowaniu przez Zarząd ma dostęp do własnego Panelu Kierowcy, gdzie odbiera służby, raportuje kilometry, zgłasza usterki oraz urlopy.
3. **Zarząd (`ZARZAD`)** – konto główne: **`Godksawiss`**. Posiada pełne uprawnienia administracyjne: akceptacja pracowników, dodawanie autobusów, linii, brygad, zatwierdzanie raportów i zarządzanie całą bazą.

---

## 🚌 Poradnik dla Pasażera / Odwiedzającego

Każdy użytkownik wchodzący na stronę może bez logowania skorzystać z zakładek:
- **Strona Główna** (`/`) – aktualności, skrót do najważniejszych funkcji i statystyk.
- **VMPK** (`/vmpk`) – dedykowana podstrona przewoźnika VMPK Kielce wraz z informacjami i taborem spółki.
- **VBP** (`/vbp`) – podstrona drugiego przewoźnika VBP Kielce.
- **Linie** (`/linie`) – spis wszystkich obsługiwanych linii komunikacyjnych, trasy (pętla początkowa &rarr; pętla końcowa), typy obsługujących pojazdów oraz przypisane brygady.
- **Brygady** (`/brygady`) – szczegółowy wykaz służb i brygad z godzinami wyjazdu, zjazdu, miejscami rozpoczęcia/zakończenia oraz wyznaczonymi punktami podmian kierowców (np. na przystankach pośrednich).  
  *Wykaz jest czytelnie podzielony i posortowany na:*
  - **Dni robocze**
  - **Sobotni**
  - **Niedzielny i Święta**
- **Tabor** (`/tabor`) – baza pojazdów spółki (numery taborowe, modele, status gotowości do jazdy, warsztat oraz aktualny przebieg w kilometrach).
- **Kontakt** (`/kontakt`) – formularz umożliwiający przesłanie zapytania lub zgłoszenia do Zarządu.

---

## 📝 Rejestracja i rekrutacja kierowcy

1. Kliknij przycisk **Złóż Wniosek** w prawym górnym rogu strony (lub wejdź na `/register`).
2. Wypełnij krótki formularz:
   - **Nazwa użytkownika (Login / Nick)**
   - **Hasło**
   - **Wybór przewoźnika** (VMPK lub VBP)
   - **Doświadczenie w OMSI 2**
3. Po wysłaniu formularza wniosek trafia do weryfikacji.
4. Gdy Zarząd (**`Godksawiss`**) zaakceptuje Twoją kandydaturę, Twoje konto zyska status aktywny i będziesz mógł zalogować się do systemu.

---

## 💺 Poradnik dla Kierowcy

### Logowanie do systemu
Wejdź w zakładkę **Logowanie** (`/login`), wpisz swój login i hasło. Po zalogowaniu zostaniesz automatycznie przekierowany do **Panelu Kierowcy** (`/panel/kierowca`).

### Grafik i przydzielone służby
W sekcji **Twoje Przydzielone Służby**:
- Zobaczysz przydzieloną linię, datę służby, przydzielony autobus z taboru oraz numer brygady.
- System automatycznie dopasuje godziny pracy, trasę wyjazdu/zjazdu oraz miejsca przesiadek z wykazu brygad.

### Wykonywanie i raportowanie służby
Po wykonaniu kursu w OMSI 2:
1. W Panelu Kierowcy odszukaj sekcję **Złóż Raport ze Służby**.
2. Wybierz odpowiednią służbę z listy.
3. Wprowadź:
   - **Stan licznika na starcie (km)** – początkowy przebieg pojazdu.
   - **Stan licznika na zjeździe (km)** – końcowy przebieg pojazdu.
   - **Zrzut ekranu – start służby** (zdjęcie pojazdu / pulpitu na początku kursu).
   - **Zrzut ekranu – koniec służby** (zdjęcie pojazdu po zakończeniu trasy).
   - **Plik podsumowania / raportu z OMSI 2** (plik podsumowujący przejechaną trasę).
4. Kliknij **Prześlij raport do weryfikacji**.

### Automatyczne naliczanie kilometrów taboru
Gdy Zarząd zweryfikuje i **zaakceptuje** Twój raport:
- Różnica kilometrów (`Licznik końcowy - Licznik początkowy`) zostanie **automatycznie dodana do licznika przebiegu danego autobusu w taborze**!
- Twoje osobiste statystyki przejechanych kilometrów powiększą się w panelu.

### Zgłaszanie awarii i usterek do warsztatu
Jeśli podczas jazdy w autobusie wystąpiła awaria (np. problem z drzwiami, hamulcami, silnikiem):
1. W sekcji **Zgłoś Usterkę Pojazdu** wybierz pojazd z taboru.
2. Wybierz kategorię awarii oraz opisz problem.
3. Zgłoszenie natychmiast trafi do dyspozytorni i warsztatu Zarządu.

### Wnioski pracownicze
W sekcji wniosków kierowca może złożyć:
- **Wniosek o urlop** (z podaniem dat od–do i powodu).
- **Wniosek o dodatkową służbę** (chęć wzięcia nadgodzin / dodatkowego grafiku).
- **Prośbę o anulowanie służby** w razie nagłych sytuacji losowych.

---

## 👑 Poradnik dla Zarządu (Konto: Godksawiss)

### Dostęp do Panelu Zarządu
- **Login:** `<nazwa_uzytkownika>`
- **Hasło domyślne:** `<haslo>`
- Po zalogowaniu w menu pojawi się przycisk **Panel Zarządu** (`/panel/zarzad`).

### Zatwierdzanie nowych kierowców
- W sekcji **Kandydaci oczekujący na zatwierdzenie** znajdują się nadesłane wnioski rejestracyjne.
- Kliknij **Zatwierdź**, aby przyjąć kierowcę do kadry, lub **Odrzuć**, aby oddalić wniosek.

### Zarządzanie taborem autobusowym
- **Dodawanie pojazdu:** Wpisz numer boczny (taborowy), model (np. Solaris Urbino 12, MAN Lion's City), przewoźnika (VMPK / VBP) oraz początkowy stan licznika w km.
- **Warsztat i serwis:** Każdy pojazd można skierować na warsztat jednym kliknięciem, zmienić status (SPRAWNY / WARSZTAT / ODSTAWIONY) oraz dopisać zalecenia mechaników.

### Zarządzanie liniami komunikacyjnymi
- Tworzenie nowych linii autobusowych z określeniem numeru linii, pętli początkowej, pętli końcowej, przystanków pośrednich oraz typów dopuszczonych wozów.

### Wykaz brygad i typy dni
W sekcji **Dodaj Nową Brygadę do Wykazu**:
- Wybierz linię.
- Wpisz numer brygady z oznaczeniem typu dnia, np.:
  - `34/1 - dni robocze`
  - `34/1 - sobotni`
  - `34/1 - niedzielny`
- Wprowadź godziny (`Start`, `Koniec`), miejsca wyjazdu/zjazdu oraz wyznaczone punkty podmian kierowców na trasie.
- **System automatycznie grupuje i sortuje wykaz:**
  1. Najpierw wszystkie brygady na **Dni robocze**
  2. Następnie brygady na **Soboty**
  3. Następnie brygady na **Niedziele i Święta**

### Układanie grafiku i przydział służb
- Wybierz kierowcę z listy aktywnych pracowników.
- Wybierz linię oraz pojazd z taboru.
- Pole wyboru brygady posiada automatyczną listę podpowiedzi posortowanych brygad z godzinami.
- Wybierz datę i zatwierdź – służba pojawi się natychmiast w panelu danego kierowcy.

### Weryfikacja raportów i podgląd plików
- W sekcji **Raporty oczekujące na weryfikację**:
  - Zarząd widzi kierowcę, linię, pojazd oraz wyliczony dystans.
  - Dostępny jest bezpośredni podgląd zdjęć: **Zrzut startowy** oraz **Zrzut końcowy**.
  - Dostępny jest podgląd / pobranie **Pliku podsumowania**.
  - Kliknięcie **Zatwierdź raport** zatwierdza służbę i **automatycznie dopisuje przejechane kilometry do licznika autobusu**.
  - W razie niezgodności Zarząd może wybrać **Odrzuć raport**.

### Obsługa warsztatu i wiadomości kontaktowych
- Podgląd wszystkich usterek zgłoszonych przez kierowców, możliwość zmiany statusu naprawy i wpisania notatki technicznej.
- Podgląd i odpowiadanie na wiadomości nadesłane z formularza kontaktowego.

---

## 📦 Wersja systemu

- **Aktualna wersja:** `0.2.0.0`
- **Typ wydania:** Wersja testowa / BETA
- **Platforma hostingowa:** Vercel
