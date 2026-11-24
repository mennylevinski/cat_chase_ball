# Cat Chase Ball

A cozy living-room mini game where a Cat chases your toy, jumps onto furniture and floor pillows, runs away carrying the toy in its mouth if it catches it, and cuddles up to rest when you step away—playable both **in the browser** (GitHub Pages) and locally with **Python/Pygame**.

---

## 🌐 Play in Browser

Once GitHub Pages is enabled (**Settings → Pages → Deploy from branch `main` / `/docs`**), play directly at:

**https://mennylevinski.github.io/cat_chase_ball/**

You can also open [docs/index.html](docs/index.html) locally in any modern browser (no server or Python required).

---

## 🕹️ Controls & Features

- **Move your hand (cursor / finger)** while holding the toy to lure the cat around the widescreen (`1280×720`) living room.
- **Left-click** (or **Space** / **Toss Toy** button in browser) while holding the toy to toss it in a bouncing arc across the room.
- **Switch cat breeds (`C` key** or **Cat** dropdown in browser): *Orange Tabby, Tuxedo, Gray, Calico, Siamese*.
- **Switch toys (`T` key** or **Toy** dropdown in browser): *Blue Ball, Yarn Ball, Toy Mouse*.
- **Toggle fullscreen**: Press **`F`** (or **`F11`** on desktop / **Fullscreen** button in browser).
- **Reset (browser)**: Press **`R`** or click **Reset**.
- **Interactive living room**: The cat jumps onto and over low furniture & cushions (**sofa with throw pillows, coffee table, armchair, ottoman, cat bed, and gently nudgeable floor pillows**) and smoothly steers around solid obstacles (**TV stand, houseplant, floor lamp**).
- **Keep-away chase**: If the cat catches the toy, it carries it in its mouth and runs away—chase the cat and touch the toy with your open hand to take it back.
- **Natural resting behavior**: Move your mouse out of the frame, hover over the top HUD bar, or keep it still for 4 seconds and the cat will calm down, drop the toy, stroll to a cozy spot or floor pillow, sit, groom itself, or cuddle up asleep.
- **Quit (desktop)**: Press **`Esc`** or close the window.

---

## ⚙️ Desktop Installation (Python / Pygame)

### 1. Requirements
- Python **3.8+**
- Works on **Windows**, **macOS**, and **Linux**
- Install dependency:
  ```bash
  pip install -r requirements.txt
  ```
  *(or `pip install pygame`)*

### 2. Download & Run
```bash
python cat_chase_ball.py
```

---

### Third-Party Attributions
The desktop version uses:
- **Pygame**, a cross-platform set of Python modules for writing video games.  
  Licensed under the LGPL 2.1 License.  
  https://www.pygame.org/docs/
