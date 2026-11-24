(() => {
      "use strict";

      const WIDTH = 1280;
      const HEIGHT = 720;
      const WALL_THICKNESS = 28;
      const HUD_HEIGHT = 64;

      const PLAY_RECT = {
        left: WALL_THICKNESS,
        top: HUD_HEIGHT,
        right: WIDTH - WALL_THICKNESS,
        bottom: HEIGHT - WALL_THICKNESS,
        width: WIDTH - WALL_THICKNESS * 2,
        height: HEIGHT - HUD_HEIGHT - WALL_THICKNESS,
        centerx: WIDTH / 2,
        centery: HUD_HEIGHT + (HEIGHT - HUD_HEIGHT - WALL_THICKNESS) / 2,
      };

      // Palette
      const WALL_COLOR = "#e0d6c6";
      const BASEBOARD_COLOR = "#b09e86";
      const HUD_BG = "#342e2a";
      const FLOOR_BASE = "#c49a6c";
      const FLOOR_DARK = "#b2885c";
      const FLOOR_LIGHT = "#cea678";
      const FLOOR_SEAM = "#98724a";

      const CAT_COLOR = "#ee9436";
      const CAT_STRIPE = "#c46a1c";
      const CAT_INNER_EAR = "#f5b4af";
      const EYE_COLOR = "#ffffff";
      const PUPIL_COLOR = "#191919";
      const MOUSE_COLOR = "#2490f5";
      const BALL_HIGHLIGHT = "#9bd7ff";
      const HAND_COLOR = "#ffdab9";
      const HAND_OUTLINE = "#6e4b37";

      // Physics & behavior constants
      const MAX_SPEED = 220.0;
      const FLEE_SPEED = 275.0;
      const STROLL_SPEED = 94.0;
      const ACCELERATION = 740.0;
      const DAMPING = 2.2;
      const GRAVITY = 1050.0;
      const CATCH_DISTANCE = 32.0;
      const MIN_THROW_DISTANCE = 220.0;
      const THROW_LOCK_TIME = 0.35;
      const GRAB_LOCK_TIME = 0.55;
      const CAT_CATCH_COOLDOWN = 0.65;
      const PICKUP_DISTANCE = 32.0;
      const TAKE_BACK_DISTANCE = 36.0;
      const TURN_SPEED = 9.0;
      const MOUSE_RADIUS = 12;
      const CAT_SIZE = 56;
      const CAT_RADIUS = 24.0;
      const OUTSIDE_IDLE_DELAY = 0.6;
      const STILL_IDLE_DELAY = 4.0;

      function makeRect(x, y, w, h) {
        return {
          x, y, width: w, height: h,
          left: x, top: y, right: x + w, bottom: y + h,
          centerx: x + w / 2, centery: y + h / 2,
        };
      }

      function rectContains(r, px, py) {
        return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
      }

      function inflateRect(r, dx, dy) {
        return makeRect(r.x - dx / 2, r.y - dy / 2, r.width + dx, r.height + dy);
      }

      const FURNITURE = [
        { name: "Sofa", rect: makeRect(430, 96, 420, 102), kind: "jumpable", height: 28.0, style: "sofa" },
        { name: "Coffee Table", rect: makeRect(530, 336, 220, 114), kind: "jumpable", height: 24.0, style: "coffee_table" },
        { name: "Armchair", rect: makeRect(1024, 308, 134, 140), kind: "jumpable", height: 28.0, style: "armchair" },
        { name: "Ottoman", rect: makeRect(178, 344, 100, 100), kind: "jumpable", height: 20.0, style: "ottoman" },
        { name: "Cat Bed", rect: makeRect(74, 566, 112, 98), kind: "jumpable", height: 6.0, style: "cat_bed" },
        { name: "TV Stand", rect: makeRect(470, 624, 340, 64), kind: "solid", height: 54.0, style: "tv_stand" },
        { name: "Houseplant", rect: makeRect(34, 70, 76, 76), kind: "solid", height: 58.0, style: "plant" },
        { name: "Floor Lamp", rect: makeRect(1182, 70, 62, 62), kind: "solid", height: 64.0, style: "lamp" },
      ];

      const SOLID_ITEMS = FURNITURE.filter((f) => f.kind === "solid");
      const ALL_FURNITURE_RECTS = FURNITURE.map((f) => f.rect);
      const SOLID_RECTS = SOLID_ITEMS.map((f) => f.rect);

      function createFloorPillows() {
        return [
          {
            pos: { x: 348, y: 505 },
            vel: { x: 0, y: 0 },
            radius: 30.0,
            height: 12.0,
            angle: 0.22,
            color: "#d48060",
            trimColor: "#a85c42",
            buttonColor: "#f4d8c2",
            shape: "square",
          },
          {
            pos: { x: 932, y: 232 },
            vel: { x: 0, y: 0 },
            radius: 28.0,
            height: 12.0,
            angle: -0.30,
            color: "#70a298",
            trimColor: "#4e7a72",
            buttonColor: "#dceee8",
            shape: "round",
          },
          {
            pos: { x: 952, y: 518 },
            vel: { x: 0, y: 0 },
            radius: 29.0,
            height: 12.0,
            angle: 0.42,
            color: "#deb25c",
            trimColor: "#b0863a",
            buttonColor: "#f8eac6",
            shape: "square",
          },
        ];
      }

      const FLEE_WAYPOINTS = [
        { x: 640, y: 148 },
        { x: 490, y: 148 },
        { x: 790, y: 148 },
        { x: 640, y: 393 },
        { x: 228, y: 394 },
        { x: 1088, y: 378 },
        { x: 310, y: 235 },
        { x: 960, y: 235 },
        { x: 320, y: 560 },
        { x: 960, y: 560 },
        { x: 130, y: 615 },
        { x: 1135, y: 575 },
      ];

      const COZY_SPOTS = [
        { kind: "cat_bed", pos: { x: 130, y: 615 } },
        { kind: "sofa", pos: { x: 515, y: 148 } },
        { kind: "sofa", pos: { x: 765, y: 148 } },
        { kind: "armchair", pos: { x: 1086, y: 378 } },
        { kind: "ottoman", pos: { x: 228, y: 394 } },
        { kind: "rug", pos: { x: 640, y: 505 } },
        { kind: "lamp", pos: { x: 1110, y: 185 } },
      ];

      const STEER_DIRS = Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8;
        return { x: Math.cos(a), y: Math.sin(a) };
      });

      const vLen = (x, y) => Math.hypot(x, y);
      const vDist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const randRange = (a, b) => a + Math.random() * (b - a);
      const randChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];

      function lerpAngle(current, target, maxStep) {
        let diff = ((target - current + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        if (Math.abs(diff) <= maxStep) return target;
        return current + Math.sign(diff) * maxStep;
      }

      function clampPoint(pos, mx = 0, my = 0) {
        return {
          x: Math.max(PLAY_RECT.left + mx, Math.min(PLAY_RECT.right - mx, pos.x)),
          y: Math.max(PLAY_RECT.top + my, Math.min(PLAY_RECT.bottom - my, pos.y)),
        };
      }

      function surfaceHeightAt(pos, pillows = null) {
        let best = 0.0;
        for (const item of FURNITURE) {
          if (item.kind === "jumpable" && rectContains(item.rect, pos.x, pos.y)) {
            if (item.height > best) best = item.height;
          }
        }
        if (pillows) {
          for (const p of pillows) {
            if (vDist(pos, p.pos) <= p.radius + 4.0 && p.height > best) {
              best = p.height;
            }
          }
        }
        return best;
      }

      function isInSolid(pos, padding = 0) {
        for (const item of SOLID_ITEMS) {
          if (rectContains(inflateRect(item.rect, padding * 2, padding * 2), pos.x, pos.y)) {
            return true;
          }
        }
        return false;
      }

      function randomTargetAwayFrom(origin, minDist = MIN_THROW_DISTANCE, margin = 48) {
        let bestPos = { x: PLAY_RECT.centerx, y: PLAY_RECT.centery };
        let bestDist = -1;
        for (let i = 0; i < 40; i++) {
          const cand = {
            x: PLAY_RECT.left + margin + Math.random() * (PLAY_RECT.width - margin * 2),
            y: PLAY_RECT.top + margin + Math.random() * (PLAY_RECT.height - margin * 2),
          };
          if (isInSolid(cand, MOUSE_RADIUS + 14)) continue;
          const d = vDist(cand, origin);
          if (d >= minDist) return cand;
          if (d > bestDist) {
            bestDist = d;
            bestPos = cand;
          }
        }
        return bestPos;
      }

      function segmentPassesNear(a, b, point, radius = 135.0) {
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const lenSq = abx * abx + aby * aby;
        if (lenSq < 1e-6) return false;
        const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lenSq));
        const cx = a.x + abx * t;
        const cy = a.y + aby * t;
        return Math.hypot(point.x - cx, point.y - cy) < radius;
      }

      function pickFleeWaypoint(catPos, cursorPos, currentTarget = null, recentTargets = []) {
        let bestWp = FLEE_WAYPOINTS[0];
        let bestScore = -1e9;
        for (const wp of FLEE_WAYPOINTS) {
          if (vDist(wp, catPos) < 170.0) continue;
          if (currentTarget && vDist(wp, currentTarget) < 60.0) continue;
          let score = vDist(wp, cursorPos) + randRange(-45, 45);
          if (segmentPassesNear(catPos, wp, cursorPos, 135.0)) score -= 260.0;
          for (let i = 0; i < recentTargets.length; i++) {
            if (vDist(wp, recentTargets[i]) < 75.0) {
              score -= 280.0 - i * 45.0;
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestWp = wp;
          }
        }
        return { x: bestWp.x, y: bestWp.y };
      }

      function pickCozySpot(catPos, preferBed = false, pillows = []) {
        const weighted = COZY_SPOTS.map((spot) => {
          let w = preferBed && (spot.kind === "cat_bed" || spot.kind === "sofa") ? 3.0 : 1.0;
          if (vDist(spot.pos, catPos) < 55.0) w *= 0.25;
          return { kind: spot.kind, pos: spot.pos, w };
        });
        for (const p of pillows) {
          let w = preferBed ? 2.2 : 1.5;
          if (vDist(p.pos, catPos) < 55.0) w *= 0.25;
          weighted.push({ kind: "pillow", pos: { x: p.pos.x, y: p.pos.y }, w });
        }
        const total = weighted.reduce((s, item) => s + item.w, 0);
        let r = Math.random() * total;
        for (const item of weighted) {
          r -= item.w;
          if (r <= 0) return { kind: item.kind, pos: { x: item.pos.x, y: item.pos.y } };
        }
        const first = weighted[0];
        return { kind: first.kind, pos: { x: first.pos.x, y: first.pos.y } };
      }

      function chooseClearDirection(pos, targetPos, currentAngle, avoidPoint = null) {
        const tx = targetPos.x - pos.x;
        const ty = targetPos.y - pos.y;
        const tLen = Math.hypot(tx, ty);
        if (tLen < 0.001) return { x: Math.cos(currentAngle), y: Math.sin(currentAngle) };
        const tdx = tx / tLen;
        const tdy = ty / tLen;
        const cfx = Math.cos(currentAngle);
        const cfy = Math.sin(currentAngle);

        const innerPlay = inflateRect(PLAY_RECT, -(CAT_RADIUS + 8) * 2, -(CAT_RADIUS + 8) * 2);
        const solidExpanded = SOLID_ITEMS.map((item) =>
          inflateRect(item.rect, (CAT_RADIUS + 10) * 2, (CAT_RADIUS + 10) * 2)
        );

        let avoidDir = null;
        let avoidStrength = 0;
        if (avoidPoint) {
          const ax = avoidPoint.x - pos.x;
          const ay = avoidPoint.y - pos.y;
          const aDist = Math.hypot(ax, ay);
          if (aDist > 0.001 && aDist < 220.0) {
            avoidDir = { x: ax / aDist, y: ay / aDist };
            avoidStrength = (220.0 - aDist) / 220.0;
          }
        }

        let bestDir = { x: tdx, y: tdy };
        let bestScore = -1e9;
        const probes = [
          [36.0, 3.2],
          [72.0, 1.5],
          [108.0, 0.55],
        ];

        for (const d of STEER_DIRS) {
          let score = (d.x * tdx + d.y * tdy) + 0.25 * (d.x * cfx + d.y * cfy);
          if (avoidDir) {
            const towardHand = d.x * avoidDir.x + d.y * avoidDir.y;
            if (towardHand > 0) score -= towardHand * avoidStrength * 1.6;
          }
          for (const [distStep, penalty] of probes) {
            const px = pos.x + d.x * distStep;
            const py = pos.y + d.y * distStep;
            if (!rectContains(innerPlay, px, py)) {
              score -= penalty;
            } else {
              for (const rect of solidExpanded) {
                if (rectContains(rect, px, py)) {
                  score -= penalty;
                  break;
                }
              }
            }
          }
          if (score > bestScore) {
            bestScore = score;
            bestDir = d;
          }
        }
        return bestDir;
      }

      function resolveRectCollisions(pos, vel, rects, radius) {
        let ox = pos.x;
        let oy = pos.y;
        let vx = vel.x;
        let vy = vel.y;
        for (const r of rects) {
          const cx = Math.max(r.left, Math.min(ox, r.right));
          const cy = Math.max(r.top, Math.min(oy, r.bottom));
          const dx = ox - cx;
          const dy = oy - cy;
          const distSq = dx * dx + dy * dy;

          if (distSq < radius * radius) {
            let nx = 0, ny = 0;
            if (distSq > 1e-6) {
              const dist = Math.sqrt(distSq);
              nx = dx / dist;
              ny = dy / dist;
              ox = cx + nx * radius;
              oy = cy + ny * radius;
            } else {
              const lp = Math.abs(ox - r.left);
              const rp = Math.abs(r.right - ox);
              const tp = Math.abs(oy - r.top);
              const bp = Math.abs(r.bottom - oy);
              const m = Math.min(lp, rp, tp, bp);
              if (m === lp) { nx = -1; ox = r.left - radius; }
              else if (m === rp) { nx = 1; ox = r.right + radius; }
              else if (m === tp) { ny = -1; oy = r.top - radius; }
              else { ny = 1; oy = r.bottom + radius; }
            }
            const vn = vx * nx + vy * ny;
            if (vn < 0) {
              vx -= vn * nx;
              vy -= vn * ny;
            }
          }
        }
        return { pos: { x: ox, y: oy }, vel: { x: vx, y: vy } };
      }

      function resolveSolidCollisions(pos, vel, radius = CAT_RADIUS) {
        return resolveRectCollisions(pos, vel, SOLID_RECTS, radius);
      }

      function updateFloorPillows(pillows, catPos, catVel, catZ, dt) {
        const speed = vLen(catVel.x, catVel.y);
        const drag = Math.exp(-8.5 * dt);

        for (const p of pillows) {
          if (speed > 135.0 && catZ < 9.0) {
            const dx = p.pos.x - catPos.x;
            const dy = p.pos.y - catPos.y;
            const dist = Math.hypot(dx, dy);
            const touchDist = CAT_RADIUS + p.radius - 4.0;
            if (dist > 1.0 && dist < touchDist) {
              const px = dx / dist;
              const py = dy / dist;
              const approach = catVel.x * px + catVel.y * py;
              if (approach > 40.0) {
                const boost = Math.min(105.0, approach * 0.42) * dt * 12.0;
                p.vel.x += px * boost;
                p.vel.y += py * boost;
                p.angle += (catVel.x * py - catVel.y * px) * 0.00018;
              }
            }
          }

          p.pos.x += p.vel.x * dt;
          p.pos.y += p.vel.y * dt;
          p.vel.x *= drag;
          p.vel.y *= drag;
          if (vLen(p.vel.x, p.vel.y) < 3.0) {
            p.vel.x = 0;
            p.vel.y = 0;
          }

          const resolved = resolveRectCollisions(p.pos, p.vel, ALL_FURNITURE_RECTS, p.radius + 4.0);
          p.pos = clampPoint(resolved.pos, p.radius + 8.0, p.radius + 8.0);
          p.vel = resolved.vel;
        }

        // Prevent floor pillows from overlapping each other
        for (let i = 0; i < pillows.length; i++) {
          for (let j = i + 1; j < pillows.length; j++) {
            const a = pillows[i], b = pillows[j];
            const dx = b.pos.x - a.pos.x;
            const dy = b.pos.y - a.pos.y;
            const dist = Math.hypot(dx, dy);
            const minD = a.radius + b.radius + 4.0;
            if (dist > 0.001 && dist < minD) {
              const push = (minD - dist) * 0.5;
              const nx = dx / dist, ny = dy / dist;
              a.pos = clampPoint({ x: a.pos.x - nx * push, y: a.pos.y - ny * push }, a.radius + 8.0, a.radius + 8.0);
              b.pos = clampPoint({ x: b.pos.x + nx * push, y: b.pos.y + ny * push }, b.radius + 8.0, b.radius + 8.0);
            }
          }
        }
      }

      // Drawing helpers
      function roundRectPath(ctx, x, y, w, h, radius) {
        const r = Math.min(radius, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      }

      function fillStrokeRoundRect(ctx, x, y, w, h, r, fill, stroke = null, lineWidth = 2) {
        roundRectPath(ctx, x, y, w, h, r);
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = lineWidth;
          ctx.stroke();
        }
      }

      function drawShadowRect(ctx, rect, radius = 14, ox = 6, oy = 8, alpha = 0.22) {
        ctx.save();
        ctx.fillStyle = `rgba(28, 22, 18, ${alpha})`;
        roundRectPath(ctx, rect.x + ox, rect.y + oy, rect.width, rect.height, radius);
        ctx.fill();
        ctx.restore();
      }

      function drawShadowEllipse(ctx, cx, cy, rx, ry, alpha = 0.24) {
        ctx.save();
        ctx.fillStyle = `rgba(25, 20, 16, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(2, rx), Math.max(2, ry), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function drawFloorPillow(ctx, p) {
        const px = p.pos.x, py = p.pos.y, r = p.radius;
        drawShadowEllipse(ctx, px + 4, py + 6, r * 1.02, r * 0.92, 0.19);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(p.angle);
        if (p.shape === "round") {
          ctx.fillStyle = p.trimColor;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(0, 0, r - 3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = p.trimColor;
          ctx.lineWidth = 1;
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6));
            ctx.stroke();
          }
          ctx.fillStyle = p.trimColor;
          ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = p.buttonColor;
          ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        } else {
          fillStrokeRoundRect(ctx, -r, -r, r * 2, r * 2, 14, p.trimColor);
          fillStrokeRoundRect(ctx, -r + 3, -r + 3, r * 2 - 6, r * 2 - 6, 12, p.color);
          ctx.strokeStyle = p.trimColor;
          ctx.lineWidth = 1;
          for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(dx * (r - 8), dy * (r - 8));
            ctx.stroke();
          }
          ctx.fillStyle = p.trimColor;
          ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = p.buttonColor;
          ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }

      function drawFurnitureItem(ctx, item) {
        const r = item.rect;
        if (item.style === "sofa") {
          drawShadowRect(ctx, r, 18, 6, 10, 0.24);
          fillStrokeRoundRect(ctx, r.x, r.y, r.width, r.height, 16, "#527284", "#3a5462", 2);
          fillStrokeRoundRect(ctx, r.x + 8, r.y + 6, r.width - 16, 26, 10, "#446274");
          fillStrokeRoundRect(ctx, r.x + 4, r.y + 10, 26, r.height - 16, 10, "#4a687a");
          fillStrokeRoundRect(ctx, r.right - 30, r.y + 10, 26, r.height - 16, 10, "#4a687a");
          const cw = Math.floor((r.width - 72) / 3);
          for (let i = 0; i < 3; i++) {
            fillStrokeRoundRect(ctx, r.x + 34 + i * (cw + 2), r.y + 34, cw - 2, r.height - 42, 10, "#688a9c", "#4a687a", 2);
          }
          // Sofa throw pillows
          fillStrokeRoundRect(ctx, r.x + 38, r.y + 34, 38, 30, 8, "#da8e60", "#b06844", 1.5);
          fillStrokeRoundRect(ctx, r.x + 68, r.y + 42, 30, 24, 7, "#eee4d2", "#cec4b2", 1.5);
          fillStrokeRoundRect(ctx, r.right - 80, r.y + 36, 40, 28, 8, "#e4bc62", "#b08e40", 1.5);
        } else if (item.style === "coffee_table") {
          drawShadowRect(ctx, r, 14, 7, 9, 0.23);
          fillStrokeRoundRect(ctx, r.x, r.y, r.width, r.height, 12, "#845838", "#603e26", 2);
          fillStrokeRoundRect(ctx, r.x + 7, r.y + 7, r.width - 14, r.height - 14, 8, "#946644");
          fillStrokeRoundRect(ctx, r.x + 26, r.y + 24, 56, 40, 4, "#eee8da");
          fillStrokeRoundRect(ctx, r.x + 32, r.y + 30, 44, 12, 2, "#b67a5c");
          const mx = r.right - 46, my = r.y + 42;
          ctx.fillStyle = "#dcd4c6";
          ctx.beginPath(); ctx.arc(mx, my, 13, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#f5f5f5";
          ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#704a30";
          ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill();
        } else if (item.style === "armchair") {
          drawShadowRect(ctx, r, 18, 6, 9, 0.24);
          fillStrokeRoundRect(ctx, r.x, r.y, r.width, r.height, 16, "#9e6652", "#764a3a", 2);
          fillStrokeRoundRect(ctx, r.right - 30, r.y + 10, 24, r.height - 20, 10, "#865442");
          fillStrokeRoundRect(ctx, r.x + 8, r.y + 5, r.width - 16, 20, 8, "#905c4a");
          fillStrokeRoundRect(ctx, r.x + 8, r.bottom - 25, r.width - 16, 20, 8, "#905c4a");
          fillStrokeRoundRect(ctx, r.x + 10, r.y + 27, r.width - 42, r.height - 54, 10, "#b27862", "#865442", 2);
          // Accent cushion
          fillStrokeRoundRect(ctx, r.right - 56, r.centery - 22, 24, 44, 7, "#ece0ca", "#c2b6a2", 1.5);
        } else if (item.style === "ottoman") {
          drawShadowEllipse(ctx, r.centerx + 5, r.centery + 7, r.width / 2, r.height / 2, 0.23);
          ctx.beginPath();
          ctx.ellipse(r.centerx, r.centery, r.width / 2, r.height / 2, 0, 0, Math.PI * 2);
          ctx.fillStyle = "#7c9476"; ctx.fill();
          ctx.strokeStyle = "#586e54"; ctx.lineWidth = 2; ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(r.centerx, r.centery, r.width / 2 - 9, r.height / 2 - 9, 0, 0, Math.PI * 2);
          ctx.fillStyle = "#8ea686"; ctx.fill();
          ctx.beginPath();
          ctx.arc(r.centerx, r.centery, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#60765c"; ctx.fill();
        } else if (item.style === "cat_bed") {
          drawShadowEllipse(ctx, r.centerx + 3, r.centery + 4, r.width / 2, r.height / 2, 0.16);
          ctx.beginPath();
          ctx.ellipse(r.centerx, r.centery, r.width / 2, r.height / 2, 0, 0, Math.PI * 2);
          ctx.fillStyle = "#ba987a"; ctx.fill();
          ctx.strokeStyle = "#927258"; ctx.lineWidth = 2; ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(r.centerx, r.centery, r.width / 2 - 12, r.height / 2 - 11, 0, 0, Math.PI * 2);
          ctx.fillStyle = "#ecdcc6"; ctx.fill();
        } else if (item.style === "tv_stand") {
          drawShadowRect(ctx, r, 10, 5, 6, 0.25);
          fillStrokeRoundRect(ctx, r.x, r.y, r.width, r.height, 8, "#624836", "#443024", 2);
          fillStrokeRoundRect(ctx, r.x + 48, r.y + 24, r.width - 96, 14, 4, "#24262c");
          fillStrokeRoundRect(ctx, r.x + 54, r.y + 27, r.width - 108, 4, 2, "#4c5666");
        } else if (item.style === "plant") {
          const cx = r.centerx, cy = r.centery;
          drawShadowEllipse(ctx, cx + 6, cy + 8, 36, 36, 0.24);
          ctx.fillStyle = "#b06240";
          ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#5c3e2a";
          ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fill();
          const angles = [0, 50, 105, 160, 215, 270, 320];
          angles.forEach((deg, idx) => {
            const rad = (deg * Math.PI) / 180;
            const lx = cx + Math.cos(rad) * 20;
            const ly = cy + Math.sin(rad) * 20;
            ctx.fillStyle = "#306034";
            ctx.beginPath(); ctx.arc(lx, ly, 13, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = idx % 2 === 0 ? "#488a4a" : "#5ca256";
            ctx.beginPath(); ctx.arc(lx, ly, 11, 0, Math.PI * 2); ctx.fill();
          });
          ctx.fillStyle = "#6cb262";
          ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
        } else if (item.style === "lamp") {
          const cx = r.centerx, cy = r.centery;
          drawShadowEllipse(ctx, cx + 5, cy + 7, 28, 28, 0.2);
          const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 70);
          grad.addColorStop(0, "rgba(255, 240, 185, 0.34)");
          grad.addColorStop(1, "rgba(255, 236, 175, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#eee0bc";
          ctx.beginPath(); ctx.arc(cx, cy, 25, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#baa884"; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = "#fff6d7";
          ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
        }
      }

      function mulberry32(seed) {
        let a = seed >>> 0;
        return () => {
          a |= 0; a = (a + 0x6d2b79f5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      }

      function buildLivingRoomCanvas() {
        const off = document.createElement("canvas");
        off.width = WIDTH;
        off.height = HEIGHT;
        const c = off.getContext("2d");

        c.fillStyle = WALL_COLOR;
        c.fillRect(0, 0, WIDTH, HEIGHT);

        c.fillStyle = FLOOR_BASE;
        c.fillRect(PLAY_RECT.left, PLAY_RECT.top, PLAY_RECT.width, PLAY_RECT.height);
        const rng = mulberry32(42);
        const shades = [FLOOR_BASE, FLOOR_LIGHT, FLOOR_DARK, FLOOR_BASE];
        const plankH = 34;
        let row = 0;
        for (let y = PLAY_RECT.top; y < PLAY_RECT.bottom; y += plankH) {
          const h = Math.min(plankH, PLAY_RECT.bottom - y);
          const offset = (row * 95) % 180;
          for (let x = PLAY_RECT.left - offset; x < PLAY_RECT.right; x += 180) {
            const x1 = Math.max(x, PLAY_RECT.left);
            const x2 = Math.min(x + 180, PLAY_RECT.right);
            if (x2 > x1) {
              c.fillStyle = shades[Math.floor(rng() * shades.length)];
              c.fillRect(x1, y, x2 - x1, h);
              c.strokeStyle = FLOOR_SEAM;
              c.lineWidth = 1;
              c.strokeRect(x1 + 0.5, y + 0.5, x2 - x1 - 1, h - 1);
            }
          }
          row++;
        }

        fillStrokeRoundRect(
          c,
          PLAY_RECT.left - 5,
          PLAY_RECT.top - 5,
          PLAY_RECT.width + 10,
          PLAY_RECT.height + 10,
          4,
          null,
          BASEBOARD_COLOR,
          6
        );

        const rug = makeRect(290, 224, 700, 340);
        fillStrokeRoundRect(c, rug.x, rug.y, rug.width, rug.height, 10, "#dacebc");
        fillStrokeRoundRect(c, rug.x + 7, rug.y + 7, rug.width - 14, rug.height - 14, 8, null, "#b07e62", 5);
        fillStrokeRoundRect(c, rug.x + 16, rug.y + 16, rug.width - 32, rug.height - 32, 6, null, "#7c9286", 2);
        c.strokeStyle = "#e8dece";
        c.lineWidth = 2;
        for (let fy = rug.top + 8; fy < rug.bottom - 6; fy += 10) {
          c.beginPath(); c.moveTo(rug.left - 8, fy); c.lineTo(rug.left, fy); c.stroke();
          c.beginPath(); c.moveTo(rug.right, fy); c.lineTo(rug.right + 8, fy); c.stroke();
        }

        for (const item of FURNITURE) {
          if (item.kind === "jumpable") drawFurnitureItem(c, item);
        }

        c.fillStyle = HUD_BG;
        c.fillRect(0, 0, WIDTH, HUD_HEIGHT - 4);
        c.strokeStyle = "#5c524a";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(0, HUD_HEIGHT - 4);
        c.lineTo(WIDTH, HUD_HEIGHT - 4);
        c.stroke();

        return off;
      }

      function drawCapsule(ctx, x1, y1, x2, y2, radius, fill, outline) {
        ctx.lineCap = "round";
        ctx.strokeStyle = outline;
        ctx.lineWidth = radius * 2 + 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = fill;
        ctx.lineWidth = radius * 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }

      const CAT_PALETTES = {
        tabby:   { label: "Orange Tabby", body: "#ee9436", stripe: "#c46a1c", ear: "#f5b4af", paw: "#fac88c", patch: null,      eye: "#ffffff", darkFace: false },
        tuxedo:  { label: "Tuxedo",       body: "#2c2f36", stripe: "#1b1d22", ear: "#e6a4a4", paw: "#f2f2f2", patch: "#f2f2f2", eye: "#d8f5a2", darkFace: false },
        gray:    { label: "Gray",         body: "#8c96a4", stripe: "#636c78", ear: "#e8b4b8", paw: "#b9c1cc", patch: null,      eye: "#ffe082", darkFace: false },
        calico:  { label: "Calico",       body: "#f6efe4", stripe: "#d97a32", ear: "#f2b2ac", paw: "#fffaf2", patch: "#3a3532", eye: "#c5e8a6", darkFace: false },
        siamese: { label: "Siamese",      body: "#efe2cc", stripe: "#5c4638", ear: "#6a5244", paw: "#5c4638", patch: "#6a5244", eye: "#7ec8ff", darkFace: true  },
      };
      const CAT_KEYS = Object.keys(CAT_PALETTES);

      const TOY_LABELS = {
        ball: "Blue Ball",
        yarn: "Yarn Ball",
        mouse: "Toy Mouse",
      };
      const TOY_KEYS = Object.keys(TOY_LABELS);

      function drawBall(ctx, pos, z = 0, groundZ = 0, angle = 0) {
        const air = Math.max(0, z - groundZ);
        const shScale = Math.max(0.55, 1.0 - air * 0.005);
        drawShadowEllipse(
          ctx,
          pos.x + 2,
          pos.y + 4 - groundZ * 0.65,
          MOUSE_RADIUS * shScale,
          MOUSE_RADIUS * 0.72 * shScale,
          Math.max(0.1, 0.27 - air * 0.0014)
        );
        const bx = pos.x;
        const by = pos.y - z * 0.8;
        const rad = MOUSE_RADIUS * (1.0 + Math.min(0.28, air * 0.003));

        if (toyType === "yarn") {
          ctx.fillStyle = "#a62b4f";
          ctx.beginPath(); ctx.arc(bx, by, rad + 1, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#e04872";
          ctx.beginPath(); ctx.arc(bx, by, rad, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#ff9bb6";
          ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.arc(bx - 2, by, rad * 0.65, -0.7, 1.5); ctx.stroke();
          ctx.beginPath(); ctx.arc(bx + 3, by - 2, rad * 0.55, 1.8, 4.1); ctx.stroke();
          ctx.beginPath(); ctx.arc(bx, by + 3, rad * 0.5, 3.3, 5.5); ctx.stroke();
          ctx.strokeStyle = "#e04872";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(bx - rad, by + 2);
          ctx.quadraticCurveTo(bx - rad - 9, by + 10, bx - rad - 15, by + 2);
          ctx.stroke();
        } else if (toyType === "mouse") {
          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(angle);
          ctx.strokeStyle = "#e6a4a4";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-12, 0);
          ctx.quadraticCurveTo(-19, -6, -24, 2);
          ctx.stroke();
          ctx.fillStyle = "#7a8088";
          ctx.beginPath(); ctx.ellipse(0, 0, 14, 9.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#9aa0a8";
          ctx.beginPath(); ctx.ellipse(0, 0, 13, 8.5, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#e8a8a8";
          ctx.beginPath(); ctx.arc(4, -7, 4, 0, Math.PI * 2); ctx.arc(4, 7, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#222222";
          ctx.beginPath(); ctx.arc(8.5, -3, 1.6, 0, Math.PI * 2); ctx.arc(8.5, 3, 1.6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#f29494";
          ctx.beginPath(); ctx.arc(13, 0, 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = "#165caf";
          ctx.beginPath(); ctx.arc(bx, by, rad + 1, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = MOUSE_COLOR;
          ctx.beginPath(); ctx.arc(bx, by, rad, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = BALL_HIGHLIGHT;
          ctx.beginPath(); ctx.arc(bx - Math.max(2, rad / 3), by - Math.max(2, rad / 3), Math.max(2, rad / 4), 0, Math.PI * 2); ctx.fill();
        }
      }

      function drawHand(ctx, pos, holding = false) {
        const hx = pos.x, hy = pos.y;
        if (!holding) {
          const fingers = [
            [hx - 8, hy + 1, hx - 12, hy - 14],
            [hx - 3, hy, hx - 3, hy - 17],
            [hx + 3, hy, hx + 5, hy - 15],
            [hx + 8, hy + 2, hx + 12, hy - 10],
            [hx - 10, hy + 7, hx - 18, hy - 1],
          ];
          for (const [x1, y1, x2, y2] of fingers) {
            drawCapsule(ctx, x1, y1, x2, y2, 3, HAND_COLOR, HAND_OUTLINE);
          }
          fillStrokeRoundRect(ctx, hx - 7, hy + 11, 14, 10, 4, HAND_COLOR, HAND_OUTLINE, 1.5);
          ctx.beginPath();
          ctx.ellipse(hx, hy + 6.5, 11, 8.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = HAND_COLOR; ctx.fill();
          ctx.strokeStyle = HAND_OUTLINE; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(hx, hy + 5, 9, 6, 0, 0, Math.PI * 2);
          ctx.fillStyle = HAND_COLOR; ctx.fill();
        } else {
          fillStrokeRoundRect(ctx, hx - 7, hy + 10, 14, 11, 4, HAND_COLOR, HAND_OUTLINE, 1.5);
          ctx.beginPath();
          ctx.ellipse(hx, hy + 7, 12, 8, 0, 0, Math.PI * 2);
          ctx.fillStyle = HAND_COLOR; ctx.fill();
          ctx.strokeStyle = HAND_OUTLINE; ctx.lineWidth = 1.5; ctx.stroke();

          drawBall(ctx, pos, 0, 0);

          for (const [fx, fy] of [[hx - 8, hy - 9], [hx - 3, hy - 11], [hx + 3, hy - 11], [hx + 8, hy - 8]]) {
            ctx.fillStyle = HAND_OUTLINE;
            ctx.beginPath(); ctx.arc(fx, fy, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = HAND_COLOR;
            ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI * 2); ctx.fill();
          }
          drawCapsule(ctx, hx - 11, hy + 5, hx - 3, hy + 2, 3, HAND_COLOR, HAND_OUTLINE);
        }
      }

      function drawEars(ctx, hx, hy, fx, fy, rx, ry, s, pal) {
        for (const side of [-1, 1]) {
          const outer = [
            { x: hx - fx * (s * 0.06) + rx * (side * s * 0.18), y: hy - fy * (s * 0.06) + ry * (side * s * 0.18) },
            { x: hx - fx * (s * 0.18) + rx * (side * s * 0.54), y: hy - fy * (s * 0.18) + ry * (side * s * 0.54) },
            { x: hx + fx * (s * 0.20) + rx * (side * s * 0.34), y: hy + fy * (s * 0.20) + ry * (side * s * 0.34) },
          ];
          const centX = (outer[0].x + outer[1].x + outer[2].x) / 3;
          const centY = (outer[0].y + outer[1].y + outer[2].y) / 3;
          const inner = outer.map((p) => ({
            x: centX + (p.x - centX) * 0.55,
            y: centY + (p.y - centY) * 0.55,
          }));
          ctx.fillStyle = pal.darkFace ? pal.patch : pal.body;
          ctx.beginPath();
          ctx.moveTo(outer[0].x, outer[0].y);
          ctx.lineTo(outer[1].x, outer[1].y);
          ctx.lineTo(outer[2].x, outer[2].y);
          ctx.closePath(); ctx.fill();

          ctx.fillStyle = pal.ear;
          ctx.beginPath();
          ctx.moveTo(inner[0].x, inner[0].y);
          ctx.lineTo(inner[1].x, inner[1].y);
          ctx.lineTo(inner[2].x, inner[2].y);
          ctx.closePath(); ctx.fill();
        }
      }

      function drawCat(ctx, pos, angle, z, groundZ, walkPhase, tailPhase, mood = "active", moodPhase = 0, carryingBall = false) {
        const pal = CAT_PALETTES[catType] || CAT_PALETTES.tabby;
        const air = Math.max(0, z - groundZ);
        const isResting = mood === "sit" || mood === "groom" || mood === "sleep";
        const breath = mood === "sleep" ? 1.0 + 0.025 * Math.sin(moodPhase * 2.0) : 1.0;
        const scale = (1.0 + Math.min(0.24, air * 0.0042)) * breath;
        const s = CAT_SIZE * scale;

        const cx = pos.x;
        const cy = pos.y - z * 0.8;
        const fx = Math.cos(angle), fy = Math.sin(angle);
        const rx = -fy, ry = fx;

        const shScale = Math.max(0.58, 1.0 - air * 0.0045);
        drawShadowEllipse(
          ctx,
          pos.x + 4,
          pos.y + 8 - groundZ * 0.65,
          CAT_SIZE * (isResting ? 0.64 : 0.68) * shScale,
          CAT_SIZE * 0.46 * shScale,
          Math.max(0.1, 0.28 - air * 0.0016)
        );

        // Multi-segment curved tail (cuddles warmly around the hip when asleep)
        const tailPts = [];
        if (mood === "sleep") {
          const tailBaseX = cx - fx * (s * 0.40) + rx * (s * 0.18);
          const tailBaseY = cy - fy * (s * 0.40) + ry * (s * 0.18);
          for (let i = 0; i < 8; i++) {
            const t = i / 7;
            const aArc = t * Math.PI * 0.92;
            const along = -Math.sin(aArc) * 0.24 + t * 0.48;
            const sideOff = 0.28 * Math.sin(aArc * 0.85) + 0.14 * t + 0.03 * Math.sin(moodPhase * 1.4 - t * 2.0) * t;
            tailPts.push([
              tailBaseX + fx * (s * along) + rx * (s * sideOff),
              tailBaseY + fy * (s * along) + ry * (s * sideOff),
            ]);
          }
        } else {
          const tailBaseX = cx - fx * (s * (isResting ? 0.46 : 0.52));
          const tailBaseY = cy - fy * (s * (isResting ? 0.46 : 0.52));
          const tailAmp = isResting ? 0.16 : 0.24;
          for (let i = 0; i < 6; i++) {
            const t = i / 5;
            const sway = Math.sin(tailPhase - t * 2.1) * (s * tailAmp * t);
            tailPts.push([
              tailBaseX - fx * (s * 0.72 * t) + rx * sway,
              tailBaseY - fy * (s * 0.72 * t) + ry * sway,
            ]);
          }
        }
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = pal.stripe;
        ctx.lineWidth = Math.max(3, s * 0.12);
        ctx.beginPath();
        tailPts.forEach(([px, py], idx) => (idx === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
        ctx.stroke();
        ctx.strokeStyle = pal.darkFace ? pal.patch : pal.body;
        ctx.lineWidth = Math.max(2, s * 0.09);
        ctx.stroke();

        // Paws (keeps full cat silhouette in sit, groom, and cuddled sleep)
        if (mood === "sleep") {
          for (const [pf, pr] of [[0.42, 0.02], [0.34, 0.28], [-0.24, -0.26]]) {
            const px = cx + fx * (s * pf) + rx * (s * pr);
            const py = cy + fy * (s * pf) + ry * (s * pr);
            ctx.fillStyle = pal.stripe;
            ctx.beginPath(); ctx.arc(px, py, Math.max(3, s * 0.11), 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = pal.paw;
            ctx.beginPath(); ctx.arc(px, py, Math.max(2, s * 0.085), 0, Math.PI * 2); ctx.fill();
          }
        } else if (isResting) {
          for (const [pf, pr] of [[0.42, -0.18], [0.42, 0.18], [-0.24, -0.30], [-0.24, 0.30]]) {
            const px = cx + fx * (s * pf) + rx * (s * pr);
            const py = cy + fy * (s * pf) + ry * (s * pr);
            ctx.fillStyle = pal.stripe;
            ctx.beginPath(); ctx.arc(px, py, Math.max(3, s * 0.11), 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = pal.paw;
            ctx.beginPath(); ctx.arc(px, py, Math.max(2, s * 0.085), 0, Math.PI * 2); ctx.fill();
          }
        } else {
          const stride = air > 4.0 ? 0 : Math.sin(walkPhase) * (s * 0.14);
          const paws = [
            [0.32 + stride / s, -0.34],
            [0.32 - stride / s, 0.34],
            [-0.30 - stride / s, -0.34],
            [-0.30 + stride / s, 0.34],
          ];
          for (const [pf, pr] of paws) {
            const px = cx + fx * (s * pf) + rx * (s * pr);
            const py = cy + fy * (s * pf) + ry * (s * pr);
            ctx.fillStyle = pal.stripe;
            ctx.beginPath(); ctx.arc(px, py, Math.max(3, s * 0.12), 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = pal.paw;
            ctx.beginPath(); ctx.arc(px, py, Math.max(2, s * 0.09), 0, Math.PI * 2); ctx.fill();
          }
        }

        // Full elongated cat body (gentle cozy C-curve cuddle when sleeping)
        let bodyCircles;
        if (mood === "sleep") {
          bodyCircles = [[-0.22, 0.11, 0.41], [0.0, -0.04, 0.44], [0.21, 0.05, 0.40]];
        } else if (isResting) {
          bodyCircles = [[-0.22, 0.0, 0.41], [0.0, 0.0, 0.44], [0.22, 0.0, 0.40]];
        } else {
          bodyCircles = [[-0.24, 0.0, 0.40], [0.0, 0.0, 0.44], [0.24, 0.0, 0.40]];
        }
        for (const [bf, brSide, brad] of bodyCircles) {
          ctx.fillStyle = pal.body;
          ctx.beginPath();
          ctx.arc(cx + fx * (s * bf) + rx * (s * brSide), cy + fy * (s * bf) + ry * (s * brSide), s * brad, 0, Math.PI * 2);
          ctx.fill();
        }

        // Breed coat markings (patches for tuxedo/calico, stripes for tabby/gray/calico)
        if (pal.patch && !pal.darkFace) {
          ctx.fillStyle = pal.patch;
          ctx.beginPath();
          ctx.arc(cx - fx * (s * 0.10) + rx * (s * 0.14), cy - fy * (s * 0.10) + ry * (s * 0.14), s * 0.19, 0, Math.PI * 2);
          ctx.fill();
          if (catType === "calico") {
            ctx.fillStyle = pal.stripe;
            ctx.beginPath();
            ctx.arc(cx + fx * (s * 0.12) - rx * (s * 0.15), cy + fy * (s * 0.12) - ry * (s * 0.15), s * 0.16, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (!pal.darkFace && catType !== "tuxedo") {
          ctx.strokeStyle = pal.stripe;
          ctx.lineWidth = Math.max(2, s * 0.06);
          for (const sf of [-0.18, 0.0, 0.16]) {
            const sideShift = mood === "sleep" ? (sf === 0.0 ? -0.03 : 0.04) : 0.0;
            const bx = cx + fx * (s * sf) + rx * (s * sideShift);
            const by = cy + fy * (s * sf) + ry * (s * sideShift);
            ctx.beginPath();
            ctx.moveTo(bx - rx * (s * 0.25), by - ry * (s * 0.25));
            ctx.lineTo(bx + rx * (s * 0.25), by + ry * (s * 0.25));
            ctx.stroke();
          }
        }

        let hfx = fx, hfy = fy, hrx = rx, hry = ry, hx, hy;
        if (mood === "sleep") {
          const headAngle = angle + 0.55;
          hfx = Math.cos(headAngle);
          hfy = Math.sin(headAngle);
          hrx = -hfy;
          hry = hfx;
          hx = cx + fx * (s * 0.44) + rx * (s * 0.16);
          hy = cy + fy * (s * 0.44) + ry * (s * 0.16);
        } else {
          const headShift = isResting ? 0.50 : 0.56;
          const groomBob = mood === "groom" ? Math.sin(moodPhase * 7.5) * (s * 0.04) : 0;
          hx = cx + fx * (s * headShift + groomBob);
          hy = cy + fy * (s * headShift + groomBob);
        }

        // Draw carried toy tucked into the mouth BEFORE the upper head/muzzle
        if (carryingBall) {
          drawBall(
            ctx,
            { x: pos.x + fx * (CAT_SIZE * 1.00), y: pos.y + fy * (CAT_SIZE * 1.00) },
            z,
            groundZ,
            angle
          );
        }

        ctx.fillStyle = pal.body;
        ctx.beginPath(); ctx.arc(hx, hy, s * 0.40, 0, Math.PI * 2); ctx.fill();
        if (pal.darkFace) {
          ctx.fillStyle = pal.patch;
          ctx.beginPath(); ctx.arc(hx + hfx * (s * 0.16), hy + hfy * (s * 0.16), s * 0.24, 0, Math.PI * 2); ctx.fill();
        }
        drawEars(ctx, hx, hy, hfx, hfy, hrx, hry, s, pal);

        const blinking = mood === "sit" && (moodPhase % 3.4) > 3.22;
        const eyesClosed = blinking || mood === "groom" || mood === "sleep";
        const ebx = hx + hfx * (s * 0.15);
        const eby = hy + hfy * (s * 0.15);
        for (const side of [-1, 1]) {
          const ex = ebx + hrx * (side * s * 0.15);
          const ey = eby + hry * (side * s * 0.15);
          if (eyesClosed) {
            ctx.strokeStyle = PUPIL_COLOR;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ex - hrx * (s * 0.06), ey - hry * (s * 0.06));
            ctx.lineTo(ex + hrx * (s * 0.06), ey + hry * (s * 0.06));
            ctx.stroke();
          } else {
            ctx.fillStyle = pal.eye;
            ctx.beginPath(); ctx.arc(ex, ey, Math.max(3, s * 0.085), 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = PUPIL_COLOR;
            ctx.beginPath(); ctx.arc(ex + hfx * (s * 0.03), ey + hfy * (s * 0.03), Math.max(2, s * 0.045), 0, Math.PI * 2); ctx.fill();
          }
        }

        if (carryingBall) {
          ctx.fillStyle = pal.darkFace ? pal.patch : pal.body;
          for (const side of [-1, 1]) {
            const chx = hx + hfx * (s * 0.30) + hrx * (side * s * 0.11);
            const chy = hy + hfy * (s * 0.30) + hry * (side * s * 0.11);
            ctx.beginPath(); ctx.arc(chx, chy, Math.max(3, s * 0.11), 0, Math.PI * 2); ctx.fill();
          }
        }

        ctx.fillStyle = pal.ear;
        ctx.beginPath();
        ctx.arc(hx + hfx * (s * 0.34), hy + hfy * (s * 0.34), Math.max(2, s * 0.045), 0, Math.PI * 2);
        ctx.fill();

        if (mood === "groom") {
          const rub = Math.sin(moodPhase * 7.5);
          const lpx = hx + fx * (s * (0.24 + 0.08 * rub)) + rx * (s * (0.26 - 0.10 * rub));
          const lpy = hy + fy * (s * (0.24 + 0.08 * rub)) + ry * (s * (0.26 - 0.10 * rub));
          ctx.fillStyle = pal.stripe;
          ctx.beginPath(); ctx.arc(lpx, lpy, Math.max(3, s * 0.11), 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = pal.paw;
          ctx.beginPath(); ctx.arc(lpx, lpy, Math.max(2, s * 0.085), 0, Math.PI * 2); ctx.fill();
        }

        if (mood === "sleep") {
          const zLabels = ["z", "z", "Z"];
          ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          for (let i = 0; i < zLabels.length; i++) {
            const cyc = (moodPhase * 0.45 + i * 0.33) % 1.0;
            const zx = hx + 14 + i * 8 + Math.sin(cyc * 5.0) * 4;
            const zy = hy - 14 - cyc * 34;
            const alpha = Math.sin(cyc * Math.PI) * 0.88;
            if (alpha > 0.08) {
              ctx.fillStyle = `rgba(255, 250, 240, ${alpha.toFixed(2)})`;
              ctx.fillText(zLabels[i], zx, zy);
            }
          }
        }
      }

      // Main setup
      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");
      const fsBtn = document.getElementById("fsBtn");
      const catSelect = document.getElementById("catSelect");
      const toySelect = document.getElementById("toySelect");
      const roomBg = buildLivingRoomCanvas();

      // State
      let catType = "tabby";
      let toyType = "ball";
      let pillows;
      let catPos, catVel, catAngle, catZ, catVz, walkPhase, tailPhase;
      let cursorPos, prevCursorPos, handSpeed, pointerInside, pointerOnHud;
      let ballPos, ballVel, ballZ, ballVz, ballState;
      let throwLockTimer, grabLockTimer, catCatchCooldown;
      let fleeTarget, fleeRetargetTimer, recentFleeWaypoints;
      let outsideTimer, mouseIdleTimer, catMood, moodTimer, moodPhase;
      let cozyTarget, cozyKind, sitLookAngle, sitLookTimer;

      function wakeCat() {
        outsideTimer = 0;
        mouseIdleTimer = 0;
        if (catMood !== "active") {
          catMood = "active";
          moodTimer = 0;
          cozyTarget = null;
          cozyKind = null;
        }
      }

      function chooseNextIdleMood(arrivedKind = null) {
        moodPhase = 0;
        if ((arrivedKind === "cat_bed" || arrivedKind === "sofa" || arrivedKind === "pillow") && Math.random() < 0.58) {
          catMood = "sleep";
          moodTimer = randRange(7.5, 12.0);
          return;
        }
        if (catMood === "stroll") catMood = randChoice(["sit", "groom", "sleep"]);
        else if (catMood === "sleep") catMood = randChoice(["sit", "groom"]);
        else if (catMood === "groom") catMood = randChoice(["sleep", "stroll", "sit"]);
        else catMood = randChoice(["groom", "stroll", "sleep"]);

        if (catMood === "stroll") {
          const picked = pickCozySpot(catPos, Math.random() < 0.6, pillows);
          cozyKind = picked.kind;
          cozyTarget = picked.pos;
          moodTimer = randRange(6.0, 10.0);
        } else if (catMood === "sit") {
          moodTimer = randRange(3.5, 6.0);
          sitLookAngle = catAngle;
          sitLookTimer = randRange(1.2, 2.2);
        } else if (catMood === "groom") {
          moodTimer = randRange(4.0, 6.5);
        } else if (catMood === "sleep") {
          moodTimer = randRange(7.5, 12.0);
        }
      }

      function resetGame() {
        pillows = createFloorPillows();
        catPos = { x: 360, y: 480 };
        catVel = { x: 0, y: 0 };
        catAngle = 0.0;
        catZ = surfaceHeightAt(catPos, pillows);
        catVz = 0.0;
        walkPhase = 0.0;
        tailPhase = 0.0;

        cursorPos = { x: 640, y: 400 };
        prevCursorPos = { x: 640, y: 400 };
        handSpeed = 0.0;
        pointerInside = true;
        pointerOnHud = false;
        ballPos = { x: cursorPos.x, y: cursorPos.y };
        ballVel = { x: 0, y: 0 };
        ballZ = surfaceHeightAt(ballPos, pillows);
        ballVz = 0.0;
        ballState = "held"; // "held" | "loose" | "cat"

        throwLockTimer = 0.0;
        grabLockTimer = 0.0;
        catCatchCooldown = 0.0;
        fleeTarget = null;
        fleeRetargetTimer = 0.0;
        recentFleeWaypoints = [];

        outsideTimer = 0.0;
        mouseIdleTimer = 0.0;
        catMood = "active";
        moodTimer = 0.0;
        moodPhase = 0.0;
        cozyTarget = null;
        cozyKind = null;
        sitLookAngle = 0.0;
        sitLookTimer = 0.0;
      }

      function tossBall() {
        wakeCat();
        if (ballState !== "held") return;
        const dest = randomTargetAwayFrom(catPos);
        const flightTime = 0.52;
        ballVel = {
          x: (dest.x - ballPos.x) / flightTime,
          y: (dest.y - ballPos.y) / flightTime,
        };
        ballZ = Math.max(surfaceHeightAt(ballPos, pillows) + 12.0, 22.0);
        ballVz = 290.0;
        ballState = "loose";
        throwLockTimer = THROW_LOCK_TIME;
      }

      async function toggleFullscreen() {
        try {
          if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          } else {
            await document.exitFullscreen();
          }
        } catch (_) {
          // Ignore if browser blocks fullscreen outside gesture
        }
      }

      function syncFullscreenUI() {
        const isFs = Boolean(document.fullscreenElement);
        document.body.classList.toggle("is-fullscreen", isFs);
        fsBtn.textContent = isFs ? "Exit Fullscreen" : "Fullscreen";
      }

      document.addEventListener("fullscreenchange", syncFullscreenUI);

      function toRawCanvasCoords(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return { x: cursorPos.x, y: cursorPos.y };
        }
        return {
          x: ((clientX - rect.left) / rect.width) * WIDTH,
          y: ((clientY - rect.top) / rect.height) * HEIGHT,
        };
      }

      canvas.addEventListener("pointermove", (e) => {
        const raw = toRawCanvasCoords(e.clientX, e.clientY);
        pointerInside = true;
        pointerOnHud = raw.y < HUD_HEIGHT;
        const nextPos = clampPoint(raw, MOUSE_RADIUS, MOUSE_RADIUS);
        if (!pointerOnHud && vDist(nextPos, cursorPos) > 1.5) wakeCat();
        cursorPos = nextPos;
      });

      canvas.addEventListener("pointerenter", (e) => {
        const raw = toRawCanvasCoords(e.clientX, e.clientY);
        pointerInside = true;
        pointerOnHud = raw.y < HUD_HEIGHT;
        cursorPos = clampPoint(raw, MOUSE_RADIUS, MOUSE_RADIUS);
        if (!pointerOnHud) wakeCat();
      });

      canvas.addEventListener("pointerleave", () => {
        pointerInside = false;
        pointerOnHud = false;
      });

      canvas.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        const raw = toRawCanvasCoords(e.clientX, e.clientY);
        pointerInside = true;
        pointerOnHud = raw.y < HUD_HEIGHT;
        cursorPos = clampPoint(raw, MOUSE_RADIUS, MOUSE_RADIUS);
        if (pointerOnHud) return;
        wakeCat();
        if (ballState === "held") {
          tossBall();
        } else if (ballState === "loose" && vDist(cursorPos, ballPos) <= PICKUP_DISTANCE) {
          ballState = "held";
          ballVel = { x: 0, y: 0 };
          ballVz = 0;
        } else if (ballState === "cat" && grabLockTimer <= 0 && vDist(cursorPos, ballPos) <= TAKE_BACK_DISTANCE) {
          ballState = "held";
          catCatchCooldown = CAT_CATCH_COOLDOWN;
        }
      });

      window.addEventListener("keydown", (e) => {
        if (e.code === "Space") {
          e.preventDefault();
          tossBall();
        } else if (e.code === "KeyF") {
          e.preventDefault();
          toggleFullscreen();
        } else if (e.code === "KeyC") {
          const idx = (CAT_KEYS.indexOf(catType) + 1) % CAT_KEYS.length;
          catType = CAT_KEYS[idx];
          if (catSelect) catSelect.value = catType;
        } else if (e.code === "KeyT") {
          const idx = (TOY_KEYS.indexOf(toyType) + 1) % TOY_KEYS.length;
          toyType = TOY_KEYS[idx];
          if (toySelect) toySelect.value = toyType;
        } else if (e.code === "KeyR") {
          resetGame();
        }
      });

      if (catSelect) {
        catSelect.addEventListener("change", () => {
          if (CAT_PALETTES[catSelect.value]) catType = catSelect.value;
        });
      }
      if (toySelect) {
        toySelect.addEventListener("change", () => {
          if (TOY_LABELS[toySelect.value]) toyType = toySelect.value;
        });
      }

      document.getElementById("tossBtn").addEventListener("click", tossBall);
      fsBtn.addEventListener("click", toggleFullscreen);
      document.getElementById("resetBtn").addEventListener("click", resetGame);

      resetGame();

      let lastTime = performance.now();

      function step(dt) {
        throwLockTimer = Math.max(0, throwLockTimer - dt);
        grabLockTimer = Math.max(0, grabLockTimer - dt);
        catCatchCooldown = Math.max(0, catCatchCooldown - dt);
        fleeRetargetTimer = Math.max(0, fleeRetargetTimer - dt);

        const pointerInRoom = pointerInside && !pointerOnHud;

        if (pointerInRoom) {
          outsideTimer = 0;
          const moved = vDist(cursorPos, prevCursorPos);
          handSpeed = handSpeed * 0.75 + (moved / Math.max(dt, 1e-4)) * 0.25;
          if (moved <= 1.5) mouseIdleTimer += dt;
          else mouseIdleTimer = 0;
          prevCursorPos = { x: cursorPos.x, y: cursorPos.y };
        } else {
          outsideTimer += dt;
          mouseIdleTimer += dt;
          handSpeed *= 0.8;
        }

        // Calm autonomous behavior when mouse leaves frame, hovers top HUD, or stays still
        const idleTriggered =
          outsideTimer >= OUTSIDE_IDLE_DELAY ||
          (mouseIdleTimer >= STILL_IDLE_DELAY && ballState !== "loose");
        if (idleTriggered && catMood === "active") {
          if (ballState === "cat") {
            ballState = "loose";
            ballVel = { x: Math.cos(catAngle) * 45.0, y: Math.sin(catAngle) * 45.0 };
            ballVz = 60.0;
            fleeTarget = null;
            recentFleeWaypoints = [];
          }
          if (Math.random() < 0.65) {
            catMood = "stroll";
            const picked = pickCozySpot(catPos, true, pillows);
            cozyKind = picked.kind;
            cozyTarget = picked.pos;
            moodTimer = randRange(6.0, 10.0);
          } else {
            catMood = randChoice(["sit", "groom"]);
            moodTimer = randRange(3.5, 6.0);
            sitLookAngle = catAngle;
            sitLookTimer = 1.6;
          }
          moodPhase = 0;
        }

        if (pointerInRoom) {
          if (ballState === "loose" && throwLockTimer <= 0) {
            if (vDist(cursorPos, ballPos) <= PICKUP_DISTANCE && ballZ - surfaceHeightAt(ballPos, pillows) < 35.0) {
              ballState = "held";
              ballVel = { x: 0, y: 0 };
              ballVz = 0;
              wakeCat();
            }
          } else if (ballState === "cat" && grabLockTimer <= 0) {
            if (vDist(cursorPos, ballPos) <= TAKE_BACK_DISTANCE) {
              ballState = "held";
              catCatchCooldown = CAT_CATCH_COOLDOWN;
              wakeCat();
            }
          }
        }

        // Ball physics
        if (ballState === "held") {
          ballPos = { x: cursorPos.x, y: cursorPos.y };
          ballVel = { x: 0, y: 0 };
          ballZ = surfaceHeightAt(ballPos, pillows);
          ballVz = 0;
        } else if (ballState === "loose") {
          ballPos.x += ballVel.x * dt;
          ballPos.y += ballVel.y * dt;

          if (ballPos.x < PLAY_RECT.left + MOUSE_RADIUS) {
            ballPos.x = PLAY_RECT.left + MOUSE_RADIUS;
            ballVel.x = Math.abs(ballVel.x) * 0.65;
          } else if (ballPos.x > PLAY_RECT.right - MOUSE_RADIUS) {
            ballPos.x = PLAY_RECT.right - MOUSE_RADIUS;
            ballVel.x = -Math.abs(ballVel.x) * 0.65;
          }
          if (ballPos.y < PLAY_RECT.top + MOUSE_RADIUS) {
            ballPos.y = PLAY_RECT.top + MOUSE_RADIUS;
            ballVel.y = Math.abs(ballVel.y) * 0.65;
          } else if (ballPos.y > PLAY_RECT.bottom - MOUSE_RADIUS) {
            ballPos.y = PLAY_RECT.bottom - MOUSE_RADIUS;
            ballVel.y = -Math.abs(ballVel.y) * 0.65;
          }

          const resolvedBall = resolveSolidCollisions(ballPos, ballVel, MOUSE_RADIUS + 2);
          ballPos = resolvedBall.pos;
          ballVel = resolvedBall.vel;

          const bGround = surfaceHeightAt(ballPos, pillows);
          ballVz -= GRAVITY * dt;
          ballZ += ballVz * dt;
          if (ballZ <= bGround) {
            ballZ = bGround;
            if (Math.abs(ballVz) > 75.0) {
              ballVz = -ballVz * 0.45;
              ballVel.x *= 0.72;
              ballVel.y *= 0.72;
            } else {
              ballVz = 0;
              const drag = Math.exp(-5.0 * dt);
              ballVel.x *= drag;
              ballVel.y *= drag;
              if (vLen(ballVel.x, ballVel.y) < 6.0) {
                ballVel = { x: 0, y: 0 };
              }
            }
          }
        }

        // Cat AI steering
        const catGroundZ = surfaceHeightAt(catPos, pillows);
        let desired = { x: 0, y: 0 };
        let speedCap = MAX_SPEED;

        if (catMood !== "active") {
          moodPhase += dt;
          moodTimer -= dt;
          if (catMood === "stroll") {
            speedCap = STROLL_SPEED;
            if (!cozyTarget) {
              const picked = pickCozySpot(catPos, true, pillows);
              cozyKind = picked.kind;
              cozyTarget = picked.pos;
            }
            const distCozy = vDist(cozyTarget, catPos);
            if (distCozy <= 24.0 || moodTimer <= 0) {
              chooseNextIdleMood(cozyKind);
            } else {
              const moveDir = chooseClearDirection(catPos, cozyTarget, catAngle);
              const pace = STROLL_SPEED * Math.min(1.0, Math.max(0.35, distCozy / 70.0));
              desired = { x: moveDir.x * pace, y: moveDir.y * pace };
              catAngle = lerpAngle(catAngle, Math.atan2(moveDir.y, moveDir.x), TURN_SPEED * 0.65 * dt);
            }
          } else if (catMood === "sit") {
            sitLookTimer -= dt;
            if (sitLookTimer <= 0) {
              sitLookAngle = catAngle + randRange(-0.9, 0.9);
              sitLookTimer = randRange(1.4, 2.5);
            }
            catAngle = lerpAngle(catAngle, sitLookAngle, 2.2 * dt);
            if (moodTimer <= 0) chooseNextIdleMood();
          } else if (catMood === "groom" || catMood === "sleep") {
            if (moodTimer <= 0) chooseNextIdleMood();
          }
        } else if (ballState === "cat") {
          speedCap = FLEE_SPEED;
          const handDist = vDist(catPos, cursorPos);
          const safePause =
            handDist > 290.0 &&
            handSpeed < 65.0 &&
            catZ <= catGroundZ + 1.0 &&
            (!fleeTarget || vDist(fleeTarget, catPos) < 95.0 || catGroundZ >= 12.0);
          if (safePause) {
            const lx = cursorPos.x - catPos.x;
            const ly = cursorPos.y - catPos.y;
            if (Math.hypot(lx, ly) > 1.0) {
              catAngle = lerpAngle(catAngle, Math.atan2(ly, lx), TURN_SPEED * 0.7 * dt);
            }
          } else {
            const needNew =
              !fleeTarget ||
              vDist(fleeTarget, catPos) < 75.0 ||
              vDist(fleeTarget, cursorPos) < 165.0 ||
              (fleeRetargetTimer <= 0 && vLen(catVel.x, catVel.y) < 60.0);
            if (needNew) {
              if (fleeTarget) {
                recentFleeWaypoints.push({ x: fleeTarget.x, y: fleeTarget.y });
                if (recentFleeWaypoints.length > 3) recentFleeWaypoints.shift();
              }
              fleeTarget = pickFleeWaypoint(catPos, cursorPos, fleeTarget, recentFleeWaypoints);
              fleeRetargetTimer = 0.45;
            }
            const fleeDir = chooseClearDirection(catPos, fleeTarget, catAngle, cursorPos);
            desired = { x: fleeDir.x * FLEE_SPEED, y: fleeDir.y * FLEE_SPEED };
            catAngle = lerpAngle(catAngle, Math.atan2(fleeDir.y, fleeDir.x), TURN_SPEED * dt);
          }
        } else {
          fleeTarget = null;
          recentFleeWaypoints = [];
          const dx = ballPos.x - catPos.x;
          const dy = ballPos.y - catPos.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 4.0) {
            const moveDir =
              dist > 45.0
                ? chooseClearDirection(catPos, ballPos, catAngle)
                : { x: dx / dist, y: dy / dist };
            let targetSpeed = MAX_SPEED;
            if (catCatchCooldown > 0 && dist < 95.0) {
              targetSpeed = MAX_SPEED * Math.max(0.25, dist / 95.0);
            }
            desired = { x: moveDir.x * targetSpeed, y: moveDir.y * targetSpeed };
            if (dist > 12.0) {
              catAngle = lerpAngle(catAngle, Math.atan2(moveDir.y, moveDir.x), TURN_SPEED * dt);
            }
          }
        }

        let sx = desired.x - catVel.x;
        let sy = desired.y - catVel.y;
        const sLen = Math.hypot(sx, sy);
        if (sLen > 0) {
          const limit = ACCELERATION * dt;
          if (sLen > limit) {
            sx = (sx / sLen) * limit;
            sy = (sy / sLen) * limit;
          }
          catVel.x += sx;
          catVel.y += sy;
        }
        const damp = Math.exp(-DAMPING * dt);
        catVel.x *= damp;
        catVel.y *= damp;

        let speed = vLen(catVel.x, catVel.y);
        if (speed > speedCap) {
          catVel.x = (catVel.x / speed) * speedCap;
          catVel.y = (catVel.y / speed) * speedCap;
          speed = speedCap;
        }

        // Proactive jumping onto/off furniture & floor pillows
        if (catZ <= catGroundZ + 1.0 && speed > 22.0) {
          const lookAhead = {
            x: catPos.x + (catVel.x / speed) * 38.0,
            y: catPos.y + (catVel.y / speed) * 38.0,
          };
          const nextZ = surfaceHeightAt(lookAhead, pillows);
          if (nextZ > catGroundZ + 5.0) {
            catVz = Math.sqrt(Math.max(0, 2.0 * GRAVITY * ((nextZ - catZ) + 26.0)));
          } else if (nextZ < catGroundZ - 5.0) {
            catVz = 150.0;
          }
        }

        catPos.x += catVel.x * dt;
        catPos.y += catVel.y * dt;
        const resolvedCat = resolveSolidCollisions(catPos, catVel, CAT_RADIUS);
        catPos = clampPoint(resolvedCat.pos, CAT_RADIUS, CAT_RADIUS);
        catVel = resolvedCat.vel;

        // Gently nudge loose floor pillows when sprinting past
        updateFloorPillows(pillows, catPos, catVel, catZ, dt);

        const newGroundZ = surfaceHeightAt(catPos, pillows);
        if (newGroundZ > catZ + 5.0 && catVz <= 0) {
          catVz = Math.sqrt(Math.max(0, 2.0 * GRAVITY * ((newGroundZ - catZ) + 20.0)));
        }
        catVz -= GRAVITY * dt;
        catZ += catVz * dt;
        if (catZ <= newGroundZ) {
          catZ = newGroundZ;
          catVz = 0;
        }

        walkPhase += speed * dt * 0.09;
        const tailRate =
          catMood === "sit" || catMood === "groom" || catMood === "sleep"
            ? 1.4
            : 2.8 + speed * 0.025;
        tailPhase += tailRate * dt;

        if (catMood === "active" && ballState !== "cat" && catCatchCooldown <= 0) {
          if (vDist(catPos, ballPos) <= CATCH_DISTANCE && Math.abs(catZ - ballZ) <= 32.0) {
            ballState = "cat";
            grabLockTimer = GRAB_LOCK_TIME;
            recentFleeWaypoints = [];
            fleeTarget = pickFleeWaypoint(catPos, cursorPos);
            fleeRetargetTimer = 0.45;
            const fleeDir = chooseClearDirection(catPos, fleeTarget, catAngle, cursorPos);
            catVel = { x: fleeDir.x * FLEE_SPEED, y: fleeDir.y * FLEE_SPEED };
            catAngle = Math.atan2(fleeDir.y, fleeDir.x);
          }
        }

        if (ballState === "cat") {
          ballPos = clampPoint(
            {
              x: catPos.x + Math.cos(catAngle) * (CAT_SIZE * 1.00),
              y: catPos.y + Math.sin(catAngle) * (CAT_SIZE * 1.00),
            },
            MOUSE_RADIUS,
            MOUSE_RADIUS
          );
          ballZ = catZ;
        }
      }

      function render() {
        ctx.drawImage(roomBg, 0, 0);

        for (const pillow of pillows) {
          drawFloorPillow(ctx, pillow);
        }

        for (const item of SOLID_ITEMS) {
          drawFurnitureItem(ctx, item);
        }

        if (ballState === "loose") {
          const toyAngle = vLen(ballVel.x, ballVel.y) > 8 ? Math.atan2(ballVel.y, ballVel.x) : 0;
          drawBall(ctx, ballPos, ballZ, surfaceHeightAt(ballPos, pillows), toyAngle);
        }

        const catGroundZ = surfaceHeightAt(catPos, pillows);
        drawCat(ctx, catPos, catAngle, catZ, catGroundZ, walkPhase, tailPhase, catMood, moodPhase, ballState === "cat");

        if (pointerInside && !pointerOnHud) {
          drawHand(ctx, cursorPos, ballState === "held");
        }

        // HUD text
        ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = "#eee8de";
        ctx.fillText(
          "Click / Space: toss toy  |  C: cat breed  |  T: toy  |  F: fullscreen  |  Hover top bar: rest",
          16,
          23
        );

        let stateLabel = "Holding toy";
        if (catMood === "stroll") stateLabel = "Cat is strolling to a cozy spot...";
        else if (catMood === "sit") stateLabel = "Cat is sitting & looking around";
        else if (catMood === "groom") stateLabel = "Cat is grooming itself";
        else if (catMood === "sleep") stateLabel = "Cat is sleeping... zZz";
        else if (ballState === "loose") stateLabel = "Toy loose (pick it up!)";
        else if (ballState === "cat") stateLabel = "Cat stole the toy! Chase it to take it back!";

        const onSurface =
          catZ > catGroundZ + 4.0 ? "Airborne!" : catGroundZ > 0 ? "On furniture" : "Floor";
        const catName = (CAT_PALETTES[catType] || CAT_PALETTES.tabby).label;
        const toyName = TOY_LABELS[toyType] || TOY_LABELS.ball;

        ctx.fillStyle = "#d4c6b2";
        ctx.fillText(
          `${catName}  ·  ${toyName}  |  Speed: ${Math.round(vLen(catVel.x, catVel.y))} px/s   Surface: ${onSurface}   [${stateLabel}]`,
          16,
          46
        );
      }

      function loop(now) {
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        step(dt);
        render();
        requestAnimationFrame(loop);
      }

      requestAnimationFrame(loop);
    })();
