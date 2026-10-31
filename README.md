# Logboek (Tidy Asset Logbook)

Een eenvoudige, zelf te hosten app om onderhoud bij te houden van je auto, moto, verwarming, huis, tuin en toestellen. Per item bewaar je een historiek van logs (datum, wat, kost, kilometerstand, notities) en upload je documenten zoals facturen en bewijzen.

- Aanmelden met gebruikersnaam, wachtwoord en tweestapsverificatie (TOTP, bv. Aegis, Google/Microsoft Authenticator, Bitwarden)
- Eén account, bedoeld voor persoonlijk gebruik
- Alle data staat in één map: een SQLite-database en de geüploade bestanden
- Draait als één container (NAS of Raspberry Pi), geen externe diensten of internetverbinding nodig

## Installeren op je NAS (kant-en-klare image)

1. Push de code naar `main` op GitHub. De workflow in `.github/workflows/docker-image.yml` bouwt dan automatisch een image voor amd64 en arm64 en zet die op `ghcr.io/<gebruiker>/<repository>:latest`.
2. Maak het pakket publiek: GitHub, je profiel, *Packages*, het pakket, *Package settings*, *Change visibility*. (Blijft het privé, doe dan eerst `docker login ghcr.io` op de NAS met een token met `read:packages`.)
3. Zet `docker-compose.yml` op je NAS (bv. in Container Manager van Synology: *Project*, *Aanmaken*) en pas in de `image:`-regel `GEBRUIKER` en de repositorynaam aan.
4. Start het project en open `http://<ip-van-je-nas>:4145`. Bij het eerste bezoek maak je je account aan en scan je de QR-code met je authenticator-app.

Een nieuwe versie installeren: `docker compose pull && docker compose up -d`.

Zelf bouwen in plaats van de image downloaden: `docker compose -f docker-compose.build.yml up -d --build`.

De data staat in het Docker-volume `logboek-data` (in de container: `/data`).

### Instellingen

| Variabele | Standaard | Uitleg |
| --- | --- | --- |
| `PORT` | `3000` | Poort in de container (in de compose-file gekoppeld aan 4145) |
| `DATA_DIR` | `/data` | Map voor database en documenten |
| `COOKIE_SECURE` | `false` | Zet op `true` als je de app via HTTPS bereikt (bv. achter een reverse proxy). Anders wordt de sessiecookie ook over gewoon HTTP verstuurd. |
| `LOGBOEK_RESET_AUTH` | niet gezet | Zet tijdelijk op `true` om het account te verwijderen (je logs en documenten blijven) en de setup opnieuw te doorlopen. Daarna weer weghalen. |

### Back-up

Maak een kopie van de volledige datamap. Stop de container eerst (`docker compose stop`), zodat de database consistent is:

```sh
docker compose stop
docker run --rm -v logboek-data:/data -v "$PWD":/backup alpine tar czf /backup/logboek-backup.tar.gz -C /data .
docker compose start
```

### Toegang van buitenaf

Zet de app niet rechtstreeks op het internet. Gebruik liever een VPN of een reverse proxy met HTTPS en zet dan `COOKIE_SECURE=true`. Na 5 mislukte aanmeldpogingen is aanmelden 5 minuten geblokkeerd.

## Ontwikkelen

Vereist Node.js 24 (met npm 11).

```sh
npm ci
npm run dev        # http://localhost:8080
npm run typecheck
npm run lint
npm test
npm run build      # bouwt een zelfstandige server in .output/
npm start          # draait de build (DATA_DIR standaard ./data)
```

Gebouwd met TanStack Start (React 19), Tailwind CSS 4, SQLite (`node:sqlite`) en shadcn/ui-componenten.
