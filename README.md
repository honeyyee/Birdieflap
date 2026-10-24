# Birdieflap

A cozy pixel-art Flappy Bird-inspired desktop game built with Electron. Guide a tiny bird through the pipes, chase your personal best, and enjoy a soft pink sky.

## Features

- Pixel-art canvas gameplay with scrolling scenery and animated bird sprites
- Personal-best score saved locally in the app
- Optional flap sound with an in-game sound toggle
- Pause and resume controls
- Windows installer packaging through Electron Builder

## Requirements

- Node.js and npm
- Windows, macOS, or Linux for running the development app

## Getting started

1. Install dependencies:

   ```sh
   npm install
   ```

2. Start the desktop app:

   ```sh
   npm start
   ```

The `npm run dev` script is an alias for `npm start`.

## Controls

| Input | Action |
| --- | --- |
| Space or Up Arrow | Flap / start the game |
| Click or tap the game | Flap / start the game |
| Escape or P | Pause or resume |
| Start a fresh run | Reset the game |

## Build

Create an unpacked application build:

```sh
npm run pack
```

Build distributable installer(s):

```sh
npm run dist
```

Build output is written to `dist/`.

## Project structure

- `main.js` — Electron main process and desktop window setup
- `preload.js` — Renderer security boundary (no privileged APIs are exposed)
- `index.html` — Game page and interface structure
- `styles.css` — Interface styling and layout
- `game.js` — Canvas game loop, input, scoring, sound, and local best-score storage
- `assets/` — Pixel-art images and sound effects

## License

This project is marked MIT in `package.json`.
