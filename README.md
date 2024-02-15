# Sim World

A prototype of a colony management game, in which the environment (plants, climate, weather) is deeply simulated. The entities living in this world will be powered by the latest LLM AI, and will populate, build, and maintain the environment over many generations. 

## How to run

After cloning the repository:

- Install necessary packages

  ```powershell
  npm ci
  ```
  
- To build the assets, run:
  ```powershell
  npm run build:assets
  ```

- To build the application, run:

  ```powershell
  npm run build
  ```

  - To run the application using the dev server, run:

  ```powershell
  npm run dev
  ```

- To run multiple npm scripts cross platform in parallel run the following command:

  ```powershell
  # if globally installed
  concurrently npm:watch npm:serve

  # if locally installed
  npx concurrently npm:watch npm:serve
  ```

## Development Guide

This project uses rot.js as the game framework, and pixijs for rendering and handling sprites.

- sprite sheets are generated using pixijs AssetPack.
- Add new sprites to the appropriate sub-folder within raw-assets, then run

```powershell
    npm run build:assets
```

Find the rebuilt sprite sheets in public/sprites.


