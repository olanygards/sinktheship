# Sänka Skepp

Ett multiplayer Battleship-spel byggt med Next.js och Firebase.

## Installation och lokal utveckling

1. Klona repositoriet
   ```bash
   git clone https://github.com/ditt-användarnamn/sinktheship.git
   cd sinktheship
   ```

2. Installera beroenden
   ```bash
   npm install
   ```

3. Konfigurera miljövariabler:
   - Kopiera `.env.example` till `.env.local`
   - Fyll i dina Firebase-konfigurationsuppgifter i `.env.local`-filen

4. Starta utvecklingsservern
   ```bash
   npm run dev
   ```

5. Bygg för produktion
   ```bash
   npm run build
   ```

6. Deploya till Firebase
   ```bash
   firebase deploy
   ```

## Funktioner

- Multiplayer spel i realtid
- Skeppsplacering med drag-and-drop
- Turbaserat spel
- Responsiv design för både desktop och mobil

## Teknikstack

- Next.js
- Firebase (Authentication, Firestore, Hosting)
- Tailwind CSS
- TypeScript 