# Poprawki panelu zarządu – pozostałe punkty (3 paczki)

Uwaga: dawne punkty 1-9 (gałąź zarzad-fixes, PR #11 "Zarzad fixes") uznano za zrobione i usunięto z listy. Poniżej zostało to, co dotyczy nowej partii (dawne 10-20). Jeśli któryś punkt jest już w kodzie, agent ma go pominąć (patrz ZASADY).

## Jak używać
- Każda paczka = JEDNO zadanie w Julesie (albo jedna rozmowa w Antigravity). Paczki są niezależne – kolejność dowolna.
- Na początku każdej paczki wklej blok "ZASADY", potem treść paczki.
- Antigravity: dopisz jeszcze blok "GIT (tylko Antigravity)".

---------------------------------------------------------------------
## ZASADY (wklej na początku KAŻDEJ paczki)

Projekt: Next.js 16 + Prisma 5 + next-auth 4. Zmiany minimalne, nie refaktoruj reszty kodu. Wykonuj punkty po kolei.
- NIE zmieniaj prisma/schema.prisma. Nie dotykaj plików .env*. Nie dodawaj nowych zależności.
- W handlerach POST/PUT/PATCH/DELETE zachowaj assertSameOrigin (src/lib/csrf.ts) i istniejące sprawdzanie uprawnień.
- Komunikaty dla użytkownika po polsku, w stylu istniejących.
- Czytaj tylko pliki potrzebne do punktów. Jeśli punkt jest już zrobiony w kodzie (w całości lub części), pomiń zrobioną część i napisz o tym w podsumowaniu.
- Na końcu uruchom: `npx tsc --noEmit`, `npm run lint` (ostrzeżenia sprzed zmian zostaw, bez nowych błędów), `npm test`. Nie uruchamiaj `npm run build`, prisma db push/migrate ani seed.
- W podsumowaniu wypisz: co zmieniono w każdym punkcie, co pominięto jako już zrobione, czego nie dało się zrobić, wyniki trzech komend.

## GIT (tylko Antigravity – Julesowi tego NIE wklejaj)
Pracuj na gałęzi `zarzad-fixes-2-<numer paczki>` utworzonej z aktualnego main (git checkout main && git pull). Commit po każdym punkcie, bez --force/rebase/amend. `git status` ma nie zawierać .env*, *.db, node_modules, .next. Dodawaj pliki konkretnymi ścieżkami. Na końcu `git push --set-upstream origin <gałąź>`. Nie pushuj na main.

---------------------------------------------------------------------
## PACZKA 1 – przebieg pojazdu, usuwanie służb, linki w bocie

1.1. src/lib/reports.ts: przebieg pojazdu przy zatwierdzeniu dotyczy pojazdu faktycznie użytego: duty.replacementVehicleId ?? duty.vehicleId (dołącz replacementVehicle w include lub użyj tych pól). Dotyczy też ścieżki WWW (api/panel/zarzad/raporty, jeśli ma własną logikę przebiegu; jeśli woła funkcję z reports.ts, wystarczy zmiana w lib). Nie zmieniaj niczego poza wyborem pojazdu.

1.2. src/app/api/panel/zarzad/sluzby/delete/route.ts: przed usunięciem sprawdź służbę (findUnique z include report). Jeśli służba ma raport (report != null) albo status COMPLETED, NIE usuwaj: zwróć 409 z komunikatem "Nie można usunąć służby z raportem. Najpierw rozpatrz raport w panelu." (Raport ma onDelete: Cascade względem służby, dlatego usunięcie służby kasowałoby raport.) Dla nieistniejącego id zwróć 404 zamiast nieobsłużonego wyjątku. Zachowaj uprawnienia (canManageDuties), CSRF i redirect. W src/lib/requests.ts przy ANULOWANIE_SLUZBY usuwaj służbę tylko wtedy, gdy nie ma raportu; jeśli ma, wniosek zaakceptuj, ale służby nie kasuj i dopisz w responseNotes "Służba ma raport, nie usunięto". W UI listy służb (src/app/panel/zarzad/page.tsx) ukryj przycisk "Usuń służbę" dla służb z raportem (zmiana tylko wyświetlania).

1.3. Bot, lista raportów (src/app/api/discord/interactions/route.ts, linki "Screen wyjazdu/zjazdu"): linki pokazuj tylko gdy URL parsowany przez `new URL()` ma protokół https, hostname należy do allowlisty, adres nie zawiera spacji ani nawiasów, a etykieta linku zawiera hostname. Allowlista: cdn.discordapp.com, media.discordapp.net oraz hosty, których faktycznie używa formularz raportu w bocie i panel/raport (sprawdź w kodzie; dodaj też i.imgur.com i prnt.sc, jeśli formularz na to pozwala). Pozostałe adresy pokaż jako tekst `(link niedostępny w bocie, sprawdź w panelu WWW)`. Dodaj helper do src/lib/files.ts (np. isTrustedImageHost) z testami w tests/files.test.ts.

---------------------------------------------------------------------
## PACZKA 2 – role, numery służbowe, komendy Discorda

2.1. src/lib/auth.ts: zamiast generateBadgeNumber(...) dla roli WLASCICIEL/ZARZAD bez badge użyj generateUniqueBadgeNumber(role, prisma) (jak w recruitment.ts) w OBU miejscach (~linia 90 i ~linia 213), z obecnym try/catch.

2.2. src/app/api/panel/zarzad/discord-commands/route.ts: lista komend nie zawiera /zarzad, a PUT nadpisuje wszystkie komendy, więc kasuje /zarzad. Dodaj komendę identyczną jak w scripts/discord-register-commands.js: { name: "zarzad", description: "Panel zarządu: liczniki i szybkie akcje", type: 1, default_member_permissions: "0", dm_permission: false }. Dodaj test w tests/, który wczytuje oba pliki jako tekst i sprawdza, że zbiory nazw komend są identyczne (regex tylko po wpisach `{ name: "...", description:`, żeby nie łapać innych `name:`).

2.3. src/app/api/panel/zarzad/uzytkownicy/route.ts: tylko WLASCICIEL może nadać rolę WLASCICIEL (dla nie-WLASCICIEL zwróć 403 "Tylko Właściciel może nadawać rolę Właściciela"). Rola ZARZAD ma pozostać w pełni dostępna dla zarządu: ZARZAD może nadawać rolę ZARZAD innym użytkownikom oraz zmieniać role innym członkom zarządu tak jak dotąd. Obecne blokady zostaw: brak zmiany własnej roli i brak edycji konta Właściciela przez nie-Właściciela. Nie dodawaj innych ograniczeń.

2.4. Ta sama trasa: walidacja customBadge. Format /^[A-Za-z]{1,3}[0-9]{1,4}$/, maks. 8 znaków, po trim, zapisywany wielkimi literami. Przed zapisem sprawdź unikalność przez prisma.user.findFirst({ where: { badgeNumber, NOT: { id: userId } } }); zajęty → 409 z komunikatem; zły format → 400. Obecne generowanie numeru przy zmianie roli (generateUniqueBadgeNumber) zostaw. Dodaj czystą funkcję isValidBadgeNumber w src/lib/roles.ts i test w tests/.

2.5. src/proxy.ts (TYLKO RAPORT, bez zmian logiki sesji): sprawdź i opisz w podsumowaniu, czy rola z getToken może być nieaktualna względem bazy (callback jwt w lib/auth.ts odświeża rolę z bazy, ale proxy czyta surowy token). Blokadę KIEROWCA na /panel/zarzad i /api/panel/zarzad zostaw jako dodatkową warstwę, dodaj komentarz w kodzie o tym ograniczeniu i upewnij się, że src/app/panel/zarzad/page.tsx oraz handlery /api/panel/zarzad/* same sprawdzają świeżą rolę (getServerSession), a redirect z page.tsx dla roli bez dostępu prowadzi na /panel/kierowca. Opisz, jak przetestować awans konta KIEROWCA → ZARZAD bez wylogowania.

---------------------------------------------------------------------
## PACZKA 3 – urlopy, tabor, awatary

3.0. Najpierw dodaj mały helper dat w nowym src/lib/dates.ts (np. warsawTodayStr(): string zwracający YYYY-MM-DD w strefie Europe/Warsaw przez Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" })). Użyj go tylko w 3.1 i 3.2; nie refaktoruj innych miejsc (w projekcie nie ma wspólnego helpera, strefa jest liczona osobno w kilku plikach).

3.1. src/app/api/panel/kierowca/edytuj-urlop/route.ts: (a) reason ograniczony do 1000 znaków (400 po przekroczeniu), (b) dzisiejszą datę licz w Europe/Warsaw przez helper z 3.0 i porównuj daty jako napisy YYYY-MM-DD (obecnie setHours(0,0,0,0) działa na czasie serwera), (c) gdy urlop edytuje ktoś inny niż autor (zarząd) i zmiana dotyczy dat, powiadom kierowcę przez notifyUser/runAfter z lib/discord (tytuł "Zmiana urlopu", nowe daty). Nie zmieniaj pozostałej logiki.

3.2. src/app/api/panel/zarzad/tabor/delete/route.ts: przed usunięciem pojazdu sprawdź (findUnique + count): (a) czy ma usterki w statusie NOWE lub WARSZTAT (usterki mają onDelete: Cascade, więc usunięcie skasowałoby historię napraw), (b) czy jest przypisany jako assignedVehicle któremukolwiek użytkownikowi, (c) czy ma służby ze statusem SCHEDULED, w których vehicleId lub replacementVehicleId równa się id pojazdu, z datą >= dziś (warsawTodayStr). Jeśli którykolwiek warunek zachodzi, zwróć 409 z konkretnym komunikatem (np. "Pojazd ma aktywne usterki / jest przypisany kierowcy / ma zaplanowane służby") i nie usuwaj. Wyjątek: pojazd ze statusem KASACJA można usunąć mimo usterek WARSZTAT/NOWE (warunki b i c nadal obowiązują). Dla nieistniejącego id zwróć 404 zamiast wyjątku. Zachowaj uprawnienia (canManageFleet), CSRF i redirect.

3.3. src/app/api/panel/avatar/route.ts: (a) w odpowiedzi z base64 zamień Cache-Control na "private, max-age=86400, stale-while-revalidate=43200", (b) w przekierowaniu 307 dopuszczaj tylko adresy zaczynające się od "https://" (http:// traktuj jak nieprawidłowy format, 400); dodatkowo ogranicz hostname do cdn.discordapp.com i media.discordapp.net, a inne https:// traktuj jak nieprawidłowy format, (c) nic więcej nie zmieniaj w tej trasie.
