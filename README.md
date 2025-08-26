# 🚀 Asteroid Game

A modern take on the classic Asteroids arcade game, built with **HTML5 Canvas** and **JavaScript (ES6)**. This project demonstrates advanced front-end engineering concepts including physics-based movement, real-time rendering, collision detection, performance optimization, and modular game architecture.

<img width="1919" height="984" alt="image" src="https://github.com/user-attachments/assets/c250088c-7a40-4d75-af92-570541331156" />

---

## 🎮 Features

* **Physics & Movement**

  * Delta-time game loop for consistent speed across devices
  * Screen wrapping for seamless gameplay
  * Friction, thrust, rotation, and max speed controls

* **Gameplay Systems**

  * Asteroid splitting (Large → Medium → Small)
  * Projectile lifetimes and fire-rate limiting
  * Hyperspace teleportation with temporary invulnerability
  * Game states: **MENU, PLAYING, PAUSED, GAME OVER**

* **Visual Effects**

  * Particle system for thrust trails and explosions
  * Jagged polygon asteroid rendering with randomization
  * HiDPI (Retina/4K) support with device-pixel scaling

* **Performance Optimizations**

  * Spatial hashing for efficient collision broad-phase detection
  * Memory-safe entity lifecycle management (bullets, asteroids, particles)
  * Optimized canvas rendering for smooth FPS

* **HUD & Progression**

  * Score, level, and lives tracking
  * Persistent high scores via `localStorage`
  * Difficulty scaling with wave progression

---

## 🛠️ Tech Stack

* **Languages:** JavaScript (ES6), HTML5, CSS
* **Rendering:** HTML5 Canvas API
* **Architecture:** Object-Oriented Design (`Entity` base class, modular components)
* **Data Structures:** Spatial Hashing for collision optimization

---

## 📂 Project Structure

```
├── index.html      # Entry point (Canvas, HUD, Game States)
├── index.js        # Core game logic and classes
└── README.md       # Project documentation
```

---

## 🎯 How to Play

* **Move:** `W / ↑`
* **Rotate:** `A / D` or `← / →`
* **Shoot:** `Space`
* **Hyperspace:** `Shift` (random teleport)
* **Pause:** `P`
* **Start / Restart:** `Enter`

**Objective:** Destroy asteroids, survive waves, and aim for the highest score.

---

## 🚦 Getting Started

### Run Locally

1. Clone the repo:

   ```bash
   git clone https://github.com/Gabbystarks7/Asteroid_Game.git
   cd asteroid-game
   ```
2. Open `index.html` in a browser. *(No build tools required!)*

### Play Online

* [View Live Demo](https://sunny-beignet-392f89.netlify.app/)

---

## 📈 Future Improvements

* Enemy saucers with basic AI and predictive shooting
* Power-ups (shields, rapid fire, spread shot)
* Sound effects and background music
* Mobile-friendly touch controls

---

## 📜 License

This project is licensed under the MIT License — free to use, modify, and share.

---
