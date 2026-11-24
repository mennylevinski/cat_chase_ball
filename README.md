# Cat Chase Ball

A cozy living-room mini game where a Cat chases your Ball, jumps onto furniture, and runs away with the ball if it catches it—playable both **in the browser** (GitHub Pages) and locally with **Python/Pygame**.

---

## 🌐 Play in Browser

Once GitHub Pages is enabled (**Settings → Pages → Deploy from branch `main` / `/docs`**), play directly at:

**https://mennylevinski.github.io/cat_chase_ball/**

You can also open [docs/index.html](docs/index.html) locally in any modern browser.

---

## 🕹️ Controls & Features:

 - **Move your hand (cursor / finger)** while holding the ball to lure the cat around the widescreen (`1280×720`) living room
 - **Left-click** (or **Space** in browser) while holding the ball to toss it in a bouncing arc across the room
 - **Press `F`** (or **`F11`** on desktop / **Fullscreen** button in browser) to toggle fullscreen
 - The cat **jumps onto and over low furniture & floor pillows** (sofa with throw cushions, coffee table, armchair, ottoman, and softly nudgeable floor pillows) and smoothly steers around solid obstacles (TV stand, houseplant, floor lamp)
 - If the cat catches the ball, it **runs away carrying it**—chase the cat and touch the ball with your open hand to take it back
 - Move your mouse out of the frame, hover over the top HUD bar, or stay still for 4 seconds and the cat will **calm down, drop the ball, stroll to a cozy spot or floor pillow, sit, groom itself, or curl up asleep**
 - **Esc** (desktop) or close window to quit

---

## ⚙️ Desktop Installation (Python / Pygame)

### 1️ Requirements
- Python **3.1+**
- Works on **Windows**, **macOS**, and **Linux**
- Install dependency:
  ```bash
  pip install pygame
  ```

### 2️ Download & Run
```bash
python cat_chase_ball.py
```

---

### Third-Party Attributions
The desktop version uses:
- **Pygame**, a cross-platform set of Python modules for writing video games.  
  Licensed under the LGPL 2.1 License.  
  https://www.pygame.org/docs/
