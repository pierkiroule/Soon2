# Room Battle - React + Vite

Webapp React/Vite pour un mini-jeu multijoueur par room.

## Gameplay
- Création d'une room avec code partageable.
- Rejoindre une room via code.
- Chat de room.
- Mini-jeu: deviner un nombre (1-100), avec feedback trop grand/petit.

## Technique
- React 18 + Vite.
- Synchronisation temps réel locale via `BroadcastChannel` (multi-onglets/même navigateur).

## Lancer
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```
