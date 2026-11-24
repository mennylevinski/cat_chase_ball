#!/usr/bin/env python3

"""
Author: Menny Levinski

Living-room Cat Chase Ball game (1280x720 widescreen with toggleable fullscreen).

Controls:
 - Move your hand (cursor) to lure the cat while holding the ball.
 - Left-click while holding the ball to toss it across the living room.
 - When the cat catches the ball, it runs away—jumping over furniture & floor
   pillows—so chase it down and touch the ball with your open hand to take it back.
 - Press F or F11 to toggle fullscreen.
 - Move the mouse out of the window, onto the top HUD bar, or keep it still
   for 4 seconds to watch the cat calm down, stroll, sit, groom, or sleep.
 - Esc or window close to quit.
"""

from collections import deque
from dataclasses import dataclass
import math
import random
import warnings

with warnings.catch_warnings():
    warnings.filterwarnings("ignore", category=UserWarning)
    import pygame
    from pygame.math import Vector2

# --- Config ---
WIDTH, HEIGHT = 1280, 720
FPS = 60

WALL_THICKNESS = 28
HUD_HEIGHT = 64
PLAY_RECT = pygame.Rect(
    WALL_THICKNESS,
    HUD_HEIGHT,
    WIDTH - WALL_THICKNESS * 2,
    HEIGHT - HUD_HEIGHT - WALL_THICKNESS,
)

# Palette
WALL_COLOR = (224, 214, 198)
BASEBOARD_COLOR = (176, 158, 134)
HUD_BG = (52, 46, 42)
FLOOR_BASE = (196, 154, 108)
FLOOR_DARK = (178, 136, 92)
FLOOR_LIGHT = (206, 166, 120)
FLOOR_SEAM = (152, 114, 74)

CAT_COLOR = (238, 148, 54)
CAT_STRIPE = (196, 106, 28)
CAT_INNER_EAR = (245, 180, 175)
EYE_COLOR = (255, 255, 255)
PUPIL_COLOR = (25, 25, 25)
MOUSE_COLOR = (36, 144, 245)
BALL_HIGHLIGHT = (155, 215, 255)
HAND_COLOR = (255, 218, 185)
HAND_OUTLINE = (110, 75, 55)

# Physics & behavior
MAX_SPEED = 220.0
FLEE_SPEED = 275.0
STROLL_SPEED = 94.0
ACCELERATION = 740.0
DAMPING = 2.2
GRAVITY = 1050.0
CATCH_DISTANCE = 32.0
MIN_THROW_DISTANCE = 220.0
THROW_LOCK_TIME = 0.35
GRAB_LOCK_TIME = 0.55
CAT_CATCH_COOLDOWN = 0.65
PICKUP_DISTANCE = 32.0
TAKE_BACK_DISTANCE = 36.0
TURN_SPEED = 9.0
MOUSE_RADIUS = 12
CAT_SIZE = 56
CAT_RADIUS = 24.0
OUTSIDE_IDLE_DELAY = 0.6
STILL_IDLE_DELAY = 4.0


@dataclass(frozen=True)
class Furniture:
    name: str
    rect: pygame.Rect
    kind: str       # "jumpable" | "solid"
    height: float   # surface height z in pixels
    style: str


@dataclass
class FloorPillow:
    pos: Vector2
    vel: Vector2
    radius: float
    height: float
    angle: float
    color: tuple
    trim_color: tuple
    button_color: tuple
    shape: str      # "square" | "round"


def create_living_room_furniture():
    """Return all widescreen living-room furniture items with generous walkways."""
    return [
        Furniture("Sofa", pygame.Rect(430, 96, 420, 102), "jumpable", 28.0, "sofa"),
        Furniture("Coffee Table", pygame.Rect(530, 336, 220, 114), "jumpable", 24.0, "coffee_table"),
        Furniture("Armchair", pygame.Rect(1024, 308, 134, 140), "jumpable", 28.0, "armchair"),
        Furniture("Ottoman", pygame.Rect(178, 344, 100, 100), "jumpable", 20.0, "ottoman"),
        Furniture("Cat Bed", pygame.Rect(74, 566, 112, 98), "jumpable", 6.0, "cat_bed"),
        Furniture("TV Stand", pygame.Rect(470, 624, 340, 64), "solid", 54.0, "tv_stand"),
        Furniture("Houseplant", pygame.Rect(34, 70, 76, 76), "solid", 58.0, "plant"),
        Furniture("Floor Lamp", pygame.Rect(1182, 70, 62, 62), "solid", 64.0, "lamp"),
    ]


def create_floor_pillows():
    """Create soft jumpable & gently nudgeable floor pillows around the living room."""
    return [
        FloorPillow(
            pos=Vector2(348, 505),
            vel=Vector2(0, 0),
            radius=30.0,
            height=12.0,
            angle=0.22,
            color=(212, 128, 96),
            trim_color=(168, 92, 66),
            button_color=(244, 216, 194),
            shape="square",
        ),
        FloorPillow(
            pos=Vector2(932, 232),
            vel=Vector2(0, 0),
            radius=28.0,
            height=12.0,
            angle=-0.30,
            color=(112, 162, 152),
            trim_color=(78, 122, 114),
            button_color=(220, 238, 232),
            shape="round",
        ),
        FloorPillow(
            pos=Vector2(952, 518),
            vel=Vector2(0, 0),
            radius=29.0,
            height=12.0,
            angle=0.42,
            color=(222, 178, 92),
            trim_color=(176, 134, 58),
            button_color=(248, 234, 198),
            shape="square",
        ),
    ]


FLEE_WAYPOINTS = [
    Vector2(640, 148),   # Sofa center
    Vector2(490, 148),   # Sofa left
    Vector2(790, 148),   # Sofa right
    Vector2(640, 393),   # Coffee table
    Vector2(228, 394),   # Ottoman
    Vector2(1088, 378),  # Armchair
    Vector2(310, 235),   # Upper-left rug
    Vector2(960, 235),   # Upper-right rug
    Vector2(320, 560),   # Lower-left floor
    Vector2(960, 560),   # Lower-right floor
    Vector2(130, 615),   # Cat bed
    Vector2(1135, 575),  # Open lower-right
]

COZY_SPOTS = [
    ("cat_bed", Vector2(130, 615)),    # Corner cat bed
    ("sofa", Vector2(515, 148)),       # Sofa left cushion
    ("sofa", Vector2(765, 148)),       # Sofa right cushion
    ("armchair", Vector2(1086, 378)),  # Armchair
    ("ottoman", Vector2(228, 394)),    # Ottoman
    ("rug", Vector2(640, 505)),        # Warm rug spot
    ("lamp", Vector2(1110, 185)),      # Warm spot near floor lamp
]

_STEER_DIRS = [
    Vector2(math.cos(i * math.pi / 8.0), math.sin(i * math.pi / 8.0))
    for i in range(16)
]


def lerp_angle(current, target, max_step):
    """Rotate `current` angle toward `target` along the shortest arc by at most `max_step`."""
    diff = (target - current + math.pi) % (2 * math.pi) - math.pi
    if abs(diff) <= max_step:
        return target
    return current + math.copysign(max_step, diff)


def clamp_point(pos, margin_x=0, margin_y=0, bounds=PLAY_RECT):
    """Clamp a Vector2 position inside the given rectangle."""
    return Vector2(
        max(bounds.left + margin_x, min(bounds.right - margin_x, pos.x)),
        max(bounds.top + margin_y, min(bounds.bottom - margin_y, pos.y)),
    )


def surface_height_at(pos, furniture, pillows=None):
    """Return the walkable elevation `z` at `pos` (0.0 on the floor)."""
    px, py = int(pos.x), int(pos.y)
    best = 0.0
    for item in furniture:
        if item.kind == "jumpable" and item.rect.collidepoint(px, py):
            if item.height > best:
                best = item.height
    if pillows:
        for p in pillows:
            if (pos - p.pos).length() <= p.radius + 4.0 and p.height > best:
                best = p.height
    return best


def is_in_solid(pos, furniture, padding=0):
    px, py = pos.x, pos.y
    for item in furniture:
        if item.kind == "solid":
            if item.rect.inflate(padding * 2, padding * 2).collidepoint(px, py):
                return True
    return False


def random_target_away_from(origin, furniture, min_dist=MIN_THROW_DISTANCE, margin=48):
    """Pick a random landing spot in the room away from `origin` and clear of solid furniture."""
    best_pos = Vector2(PLAY_RECT.centerx, PLAY_RECT.centery)
    best_dist = -1.0
    for _ in range(40):
        candidate = Vector2(
            random.uniform(PLAY_RECT.left + margin, PLAY_RECT.right - margin),
            random.uniform(PLAY_RECT.top + margin, PLAY_RECT.bottom - margin),
        )
        if is_in_solid(candidate, furniture, padding=MOUSE_RADIUS + 14):
            continue
        dist = (candidate - origin).length()
        if dist >= min_dist:
            return candidate
        if dist > best_dist:
            best_dist = dist
            best_pos = candidate
    return best_pos


def _segment_passes_near(a, b, point, radius=130.0):
    ab = b - a
    ab_len_sq = ab.length_squared()
    if ab_len_sq < 1e-6:
        return False
    t = max(0.0, min(1.0, (point - a).dot(ab) / ab_len_sq))
    closest = a + ab * t
    return (point - closest).length() < radius


def pick_flee_waypoint(cat_pos, cursor_pos, current_target=None, recent_targets=None):
    """Pick an open living-room destination far from the hand, avoiding recent waypoints to stop loops."""
    best_wp = FLEE_WAYPOINTS[0]
    best_score = -1e9
    recent = list(recent_targets) if recent_targets else []
    for wp in FLEE_WAYPOINTS:
        dist_cat = (wp - cat_pos).length()
        if dist_cat < 170.0:
            continue
        if current_target is not None and (wp - current_target).length() < 60.0:
            continue
        dist_hand = (wp - cursor_pos).length()
        score = dist_hand + random.uniform(-45.0, 45.0)
        if _segment_passes_near(cat_pos, wp, cursor_pos, radius=135.0):
            score -= 260.0
        for idx, prev in enumerate(recent):
            if (wp - prev).length() < 75.0:
                score -= 280.0 - idx * 45.0
        if score > best_score:
            best_score = score
            best_wp = wp
    return best_wp.copy()


def pick_cozy_spot(cat_pos, prefer_bed=False, pillows=None):
    """Pick a relaxed living-room spot (including floor pillows) for sitting, grooming, or napping."""
    candidates = []
    for kind, spot in COZY_SPOTS:
        weight = 3.0 if (prefer_bed and kind in ("cat_bed", "sofa")) else 1.0
        if (spot - cat_pos).length() < 55.0:
            weight *= 0.25
        candidates.append((kind, spot, weight))
    if pillows:
        for p in pillows:
            weight = 2.2 if prefer_bed else 1.5
            if (p.pos - cat_pos).length() < 55.0:
                weight *= 0.25
            candidates.append(("pillow", p.pos.copy(), weight))

    total = sum(w for _, _, w in candidates)
    r = random.uniform(0, total)
    acc = 0.0
    for kind, spot, w in candidates:
        acc += w
        if r <= acc:
            return kind, spot.copy()
    kind, spot, _ = candidates[0]
    return kind, spot.copy()


def choose_clear_direction(pos, target_pos, current_angle, furniture, avoid_point=None):
    """16-direction context steering: smoothly picks the best open direction without corner traps."""
    to_target = target_pos - pos
    if to_target.length() < 0.001:
        return Vector2(math.cos(current_angle), math.sin(current_angle))
    target_dir = to_target.normalize()
    curr_fwd = Vector2(math.cos(current_angle), math.sin(current_angle))

    inner_play = PLAY_RECT.inflate(-int((CAT_RADIUS + 8) * 2), -int((CAT_RADIUS + 8) * 2))
    solid_expanded = [
        item.rect.inflate(int((CAT_RADIUS + 10) * 2), int((CAT_RADIUS + 10) * 2))
        for item in furniture
        if item.kind == "solid"
    ]

    avoid_dir = None
    avoid_strength = 0.0
    if avoid_point is not None:
        to_avoid = avoid_point - pos
        avoid_dist = to_avoid.length()
        if 0.001 < avoid_dist < 220.0:
            avoid_dir = to_avoid / avoid_dist
            avoid_strength = (220.0 - avoid_dist) / 220.0

    best_dir = target_dir
    best_score = -1e9
    probes = ((36.0, 3.2), (72.0, 1.5), (108.0, 0.55))

    for d in _STEER_DIRS:
        score = d.dot(target_dir) + 0.25 * d.dot(curr_fwd)

        if avoid_dir is not None:
            toward_hand = d.dot(avoid_dir)
            if toward_hand > 0:
                score -= toward_hand * avoid_strength * 1.6

        for dist_step, penalty in probes:
            pt = pos + d * dist_step
            if not inner_play.collidepoint(pt.x, pt.y):
                score -= penalty
            else:
                for rect in solid_expanded:
                    if rect.collidepoint(pt.x, pt.y):
                        score -= penalty
                        break

        if score > best_score:
            best_score = score
            best_dir = d

    return best_dir


def resolve_rect_collisions(pos, vel, rects, radius):
    """Softly slide a circle out of a list of pygame.Rect obstacles without jittery bouncing."""
    out_pos = Vector2(pos)
    out_vel = Vector2(vel)
    for rect in rects:
        closest_x = max(rect.left, min(out_pos.x, rect.right))
        closest_y = max(rect.top, min(out_pos.y, rect.bottom))
        dx = out_pos.x - closest_x
        dy = out_pos.y - closest_y
        dist_sq = dx * dx + dy * dy

        if dist_sq < radius * radius:
            if dist_sq > 1e-6:
                dist = math.sqrt(dist_sq)
                nx, ny = dx / dist, dy / dist
                out_pos.x = closest_x + nx * radius
                out_pos.y = closest_y + ny * radius
            else:
                left_pen = abs(out_pos.x - rect.left)
                right_pen = abs(rect.right - out_pos.x)
                top_pen = abs(out_pos.y - rect.top)
                bot_pen = abs(rect.bottom - out_pos.y)
                m = min(left_pen, right_pen, top_pen, bot_pen)
                if m == left_pen:
                    nx, ny = -1.0, 0.0
                    out_pos.x = rect.left - radius
                elif m == right_pen:
                    nx, ny = 1.0, 0.0
                    out_pos.x = rect.right + radius
                elif m == top_pen:
                    nx, ny = 0.0, -1.0
                    out_pos.y = rect.top - radius
                else:
                    nx, ny = 0.0, 1.0
                    out_pos.y = rect.bottom + radius

            vn = out_vel.x * nx + out_vel.y * ny
            if vn < 0:
                out_vel.x -= vn * nx
                out_vel.y -= vn * ny
    return out_pos, out_vel


def resolve_solid_collisions(pos, vel, furniture, radius=CAT_RADIUS):
    """Softly slide out of any solid furniture rect without jittery bouncing."""
    solid_rects = [item.rect for item in furniture if item.kind == "solid"]
    return resolve_rect_collisions(pos, vel, solid_rects, radius)


def update_floor_pillows(pillows, cat_pos, cat_vel, cat_z, furniture, dt):
    """Allow the cat to gently nudge loose floor pillows when sprinting past."""
    all_furniture_rects = [item.rect for item in furniture]
    speed = cat_vel.length()

    for p in pillows:
        # Gentle nudge when cat sprints against the pillow at floor level
        if speed > 135.0 and cat_z < 9.0:
            delta = p.pos - cat_pos
            dist = delta.length()
            touch_dist = CAT_RADIUS + p.radius - 4.0
            if 1.0 < dist < touch_dist:
                push_dir = delta / dist
                # Only nudge if cat is actually moving toward/across the pillow
                approach = cat_vel.dot(push_dir)
                if approach > 40.0:
                    p.vel += push_dir * min(105.0, approach * 0.42) * dt * 12.0
                    p.angle += (cat_vel.x * push_dir.y - cat_vel.y * push_dir.x) * 0.00018

        p.pos += p.vel * dt
        p.vel *= math.exp(-8.5 * dt)
        if p.vel.length() < 3.0:
            p.vel = Vector2(0, 0)

        p.pos, p.vel = resolve_rect_collisions(p.pos, p.vel, all_furniture_rects, p.radius + 4.0)
        p.pos = clamp_point(p.pos, p.radius + 8.0, p.radius + 8.0)

    # Keep floor pillows from overlapping each other
    for i in range(len(pillows)):
        for j in range(i + 1, len(pillows)):
            a, b = pillows[i], pillows[j]
            delta = b.pos - a.pos
            dist = delta.length()
            min_d = a.radius + b.radius + 4.0
            if 0.001 < dist < min_d:
                sep = (delta / dist) * ((min_d - dist) * 0.5)
                a.pos = clamp_point(a.pos - sep, a.radius + 8.0, a.radius + 8.0)
                b.pos = clamp_point(b.pos + sep, b.radius + 8.0, b.radius + 8.0)


def compute_flee_direction(cat_pos, cursor_pos, furniture, current_angle=0.0, flee_target=None):
    """Compute an open, corner-proof flee direction toward a safe waypoint away from the hand."""
    target = flee_target if flee_target is not None else pick_flee_waypoint(cat_pos, cursor_pos)
    return choose_clear_direction(cat_pos, target, current_angle, furniture, avoid_point=cursor_pos)


# --- Living Room Procedural Art ---
def _draw_shadow(surface, rect, radius=14, offset=(6, 8), alpha=55):
    sh = pygame.Surface((rect.width + 16, rect.height + 16), pygame.SRCALPHA)
    pygame.draw.rect(sh, (28, 22, 18, alpha), pygame.Rect(8, 8, rect.width, rect.height), border_radius=radius)
    surface.blit(sh, (rect.x + offset[0] - 8, rect.y + offset[1] - 8))


def _draw_ellipse_shadow(surface, center, rx, ry, alpha=60):
    w, h = max(4, int(rx * 2)), max(4, int(ry * 2))
    sh = pygame.Surface((w, h), pygame.SRCALPHA)
    pygame.draw.ellipse(sh, (25, 20, 16, alpha), pygame.Rect(0, 0, w, h))
    surface.blit(sh, (int(center.x - rx), int(center.y - ry)))


def draw_floor_pillow(surface, pillow):
    """Draw a plush, softly shadowed floor cushion."""
    px, py = int(pillow.pos.x), int(pillow.pos.y)
    r = int(pillow.radius)
    _draw_ellipse_shadow(surface, Vector2(px + 4, py + 6), r * 1.02, r * 0.92, alpha=48)

    if pillow.shape == "round":
        pygame.draw.circle(surface, pillow.trim_color, (px, py), r)
        pygame.draw.circle(surface, pillow.color, (px, py), r - 3)
        # Subtle tufted creases
        for k in range(6):
            a = pillow.angle + k * (math.pi / 3.0)
            ex = px + int(math.cos(a) * (r - 6))
            ey = py + int(math.sin(a) * (r - 6))
            pygame.draw.line(surface, pillow.trim_color, (px, py), (ex, ey), 1)
        pygame.draw.circle(surface, pillow.trim_color, (px, py), 6)
        pygame.draw.circle(surface, pillow.button_color, (px, py), 4)
    else:
        # Rotated plush square floor cushion
        box_size = r * 2 + 12
        tmp = pygame.Surface((box_size, box_size), pygame.SRCALPHA)
        body = pygame.Rect(6, 6, r * 2, r * 2)
        pygame.draw.rect(tmp, pillow.trim_color, body, border_radius=14)
        pygame.draw.rect(tmp, pillow.color, body.inflate(-6, -6), border_radius=12)
        c = box_size // 2
        # Soft corner creases
        for dx, dy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
            pygame.draw.line(tmp, pillow.trim_color, (c, c), (c + dx * (r - 8), c + dy * (r - 8)), 1)
        pygame.draw.circle(tmp, pillow.trim_color, (c, c), 6)
        pygame.draw.circle(tmp, pillow.button_color, (c, c), 4)

        rotated = pygame.transform.rotate(tmp, -math.degrees(pillow.angle))
        rect = rotated.get_rect(center=(px, py))
        surface.blit(rotated, rect)


def draw_furniture_item(surface, item):
    r = item.rect
    if item.style == "sofa":
        _draw_shadow(surface, r, radius=18, offset=(6, 10), alpha=60)
        pygame.draw.rect(surface, (82, 114, 132), r, border_radius=16)
        pygame.draw.rect(surface, (58, 84, 98), r, 2, border_radius=16)
        back = pygame.Rect(r.x + 8, r.y + 6, r.width - 16, 26)
        pygame.draw.rect(surface, (68, 98, 116), back, border_radius=10)
        arm_l = pygame.Rect(r.x + 4, r.y + 10, 26, r.height - 16)
        arm_r = pygame.Rect(r.right - 30, r.y + 10, 26, r.height - 16)
        pygame.draw.rect(surface, (74, 104, 122), arm_l, border_radius=10)
        pygame.draw.rect(surface, (74, 104, 122), arm_r, border_radius=10)
        cw = (r.width - 72) // 3
        for i in range(3):
            cush = pygame.Rect(r.x + 34 + i * (cw + 2), r.y + 34, cw - 2, r.height - 42)
            pygame.draw.rect(surface, (104, 138, 156), cush, border_radius=10)
            pygame.draw.rect(surface, (74, 104, 122), cush, 2, border_radius=10)
        # Throw cushions on both ends of the sofa
        p1 = pygame.Rect(r.x + 38, r.y + 34, 38, 30)
        pygame.draw.rect(surface, (176, 104, 68), p1.inflate(2, 2), border_radius=9)
        pygame.draw.rect(surface, (218, 142, 96), p1, border_radius=8)
        p2 = pygame.Rect(r.right - 80, r.y + 36, 40, 28)
        pygame.draw.rect(surface, (176, 142, 64), p2.inflate(2, 2), border_radius=9)
        pygame.draw.rect(surface, (228, 188, 98), p2, border_radius=8)
        p3 = pygame.Rect(r.x + 68, r.y + 42, 30, 24)
        pygame.draw.rect(surface, (206, 196, 178), p3.inflate(2, 2), border_radius=8)
        pygame.draw.rect(surface, (238, 228, 210), p3, border_radius=7)

    elif item.style == "coffee_table":
        _draw_shadow(surface, r, radius=14, offset=(7, 9), alpha=58)
        pygame.draw.rect(surface, (132, 88, 56), r, border_radius=12)
        pygame.draw.rect(surface, (96, 62, 38), r, 2, border_radius=12)
        inner = r.inflate(-14, -14)
        pygame.draw.rect(surface, (148, 102, 68), inner, border_radius=8)
        mag = pygame.Rect(r.x + 26, r.y + 24, 56, 40)
        pygame.draw.rect(surface, (238, 232, 218), mag, border_radius=4)
        pygame.draw.rect(surface, (182, 122, 92), pygame.Rect(mag.x + 6, mag.y + 6, 44, 12), border_radius=2)
        pygame.draw.circle(surface, (220, 212, 198), (r.right - 46, r.y + 42), 13)
        pygame.draw.circle(surface, (245, 245, 245), (r.right - 46, r.y + 42), 9)
        pygame.draw.circle(surface, (112, 74, 48), (r.right - 46, r.y + 42), 6)

    elif item.style == "armchair":
        _draw_shadow(surface, r, radius=18, offset=(6, 9), alpha=60)
        pygame.draw.rect(surface, (158, 102, 82), r, border_radius=16)
        pygame.draw.rect(surface, (118, 74, 58), r, 2, border_radius=16)
        back = pygame.Rect(r.right - 30, r.y + 10, 24, r.height - 20)
        pygame.draw.rect(surface, (134, 84, 66), back, border_radius=10)
        pygame.draw.rect(surface, (144, 92, 74), pygame.Rect(r.x + 8, r.y + 5, r.width - 16, 20), border_radius=8)
        pygame.draw.rect(surface, (144, 92, 74), pygame.Rect(r.x + 8, r.bottom - 25, r.width - 16, 20), border_radius=8)
        seat = pygame.Rect(r.x + 10, r.y + 27, r.width - 42, r.height - 54)
        pygame.draw.rect(surface, (178, 120, 98), seat, border_radius=10)
        pygame.draw.rect(surface, (134, 84, 66), seat, 2, border_radius=10)
        # Cozy accent cushion tucked against the backrest
        cushion = pygame.Rect(r.right - 56, r.centery - 22, 24, 44)
        pygame.draw.rect(surface, (194, 182, 162), cushion.inflate(2, 2), border_radius=8)
        pygame.draw.rect(surface, (236, 224, 202), cushion, border_radius=7)

    elif item.style == "ottoman":
        _draw_ellipse_shadow(surface, Vector2(r.centerx + 5, r.centery + 7), r.width / 2, r.height / 2, alpha=58)
        pygame.draw.ellipse(surface, (124, 148, 118), r)
        pygame.draw.ellipse(surface, (88, 110, 84), r, 2)
        inner = r.inflate(-18, -18)
        pygame.draw.ellipse(surface, (142, 166, 134), inner)
        pygame.draw.circle(surface, (96, 118, 92), r.center, 5)

    elif item.style == "cat_bed":
        _draw_ellipse_shadow(surface, Vector2(r.centerx + 3, r.centery + 4), r.width / 2, r.height / 2, alpha=42)
        pygame.draw.ellipse(surface, (186, 152, 122), r)
        pygame.draw.ellipse(surface, (146, 114, 88), r, 2)
        inner = r.inflate(-24, -22)
        pygame.draw.ellipse(surface, (236, 220, 198), inner)

    elif item.style == "tv_stand":
        _draw_shadow(surface, r, radius=10, offset=(5, 6), alpha=65)
        pygame.draw.rect(surface, (98, 72, 54), r, border_radius=8)
        pygame.draw.rect(surface, (68, 48, 36), r, 2, border_radius=8)
        tv = pygame.Rect(r.x + 48, r.y + 24, r.width - 96, 14)
        pygame.draw.rect(surface, (36, 38, 44), tv, border_radius=4)
        pygame.draw.rect(surface, (76, 86, 102), pygame.Rect(tv.x + 6, tv.y + 3, tv.width - 12, 4), border_radius=2)

    elif item.style == "plant":
        cx, cy = r.center
        _draw_ellipse_shadow(surface, Vector2(cx + 6, cy + 8), 36, 36, alpha=60)
        pygame.draw.circle(surface, (176, 98, 64), (cx, cy), 22)
        pygame.draw.circle(surface, (92, 62, 42), (cx, cy), 17)
        leaf_angles = [0, 50, 105, 160, 215, 270, 320]
        for idx, deg in enumerate(leaf_angles):
            rad = math.radians(deg)
            lx = cx + int(math.cos(rad) * 20)
            ly = cy + int(math.sin(rad) * 20)
            col = (72, 138, 74) if idx % 2 == 0 else (92, 162, 86)
            pygame.draw.circle(surface, (48, 96, 52), (lx, ly), 13)
            pygame.draw.circle(surface, col, (lx, ly), 11)
        pygame.draw.circle(surface, (108, 178, 98), (cx, cy), 11)

    elif item.style == "lamp":
        cx, cy = r.center
        _draw_ellipse_shadow(surface, Vector2(cx + 5, cy + 7), 28, 28, alpha=52)
        glow = pygame.Surface((136, 136), pygame.SRCALPHA)
        pygame.draw.circle(glow, (255, 236, 175, 48), (68, 68), 65)
        surface.blit(glow, (cx - 68, cy - 68))
        pygame.draw.circle(surface, (238, 224, 188), (cx, cy), 25)
        pygame.draw.circle(surface, (186, 168, 132), (cx, cy), 25, 2)
        pygame.draw.circle(surface, (255, 246, 215), (cx, cy), 10)


def build_living_room_surface(furniture):
    """Pre-render the widescreen living-room floor, walls, rug, and static jumpable furniture."""
    surf = pygame.Surface((WIDTH, HEIGHT))
    surf.fill(WALL_COLOR)

    pygame.draw.rect(surf, FLOOR_BASE, PLAY_RECT)
    plank_h = 34
    rng = random.Random(42)
    y = PLAY_RECT.top
    row = 0
    while y < PLAY_RECT.bottom:
        h = min(plank_h, PLAY_RECT.bottom - y)
        offset = (row * 95) % 180
        x = PLAY_RECT.left - offset
        while x < PLAY_RECT.right:
            pw = 180
            plank_rect = pygame.Rect(
                max(x, PLAY_RECT.left),
                y,
                min(x + pw, PLAY_RECT.right) - max(x, PLAY_RECT.left),
                h,
            )
            if plank_rect.width > 0:
                shade = rng.choice([FLOOR_BASE, FLOOR_LIGHT, FLOOR_DARK, FLOOR_BASE])
                pygame.draw.rect(surf, shade, plank_rect)
                pygame.draw.rect(surf, FLOOR_SEAM, plank_rect, 1)
            x += pw
        y += plank_h
        row += 1

    pygame.draw.rect(surf, BASEBOARD_COLOR, PLAY_RECT.inflate(10, 10), 6, border_radius=4)

    rug = pygame.Rect(290, 224, 700, 340)
    pygame.draw.rect(surf, (218, 206, 188), rug, border_radius=10)
    pygame.draw.rect(surf, (176, 126, 98), rug.inflate(-14, -14), 5, border_radius=8)
    pygame.draw.rect(surf, (124, 146, 134), rug.inflate(-32, -32), 2, border_radius=6)
    for fy in range(rug.top + 8, rug.bottom - 6, 10):
        pygame.draw.line(surf, (232, 222, 206), (rug.left - 8, fy), (rug.left, fy), 2)
        pygame.draw.line(surf, (232, 222, 206), (rug.right, fy), (rug.right + 8, fy), 2)

    for item in furniture:
        if item.kind == "jumpable":
            draw_furniture_item(surf, item)

    pygame.draw.rect(surf, HUD_BG, pygame.Rect(0, 0, WIDTH, HUD_HEIGHT - 4))
    pygame.draw.line(surf, (92, 82, 74), (0, HUD_HEIGHT - 4), (WIDTH, HUD_HEIGHT - 4), 2)

    return surf


def _draw_capsule(surface, p1, p2, radius, fill_color, outline_color):
    x1, y1 = int(p1[0]), int(p1[1])
    x2, y2 = int(p2[0]), int(p2[1])
    pygame.draw.line(surface, outline_color, (x1, y1), (x2, y2), radius * 2 + 2)
    pygame.draw.circle(surface, outline_color, (x1, y1), radius + 1)
    pygame.draw.circle(surface, outline_color, (x2, y2), radius + 1)
    pygame.draw.line(surface, fill_color, (x1, y1), (x2, y2), radius * 2)
    pygame.draw.circle(surface, fill_color, (x1, y1), radius)
    pygame.draw.circle(surface, fill_color, (x2, y2), radius)


def draw_ball(surface, pos, z=0.0, ground_z=0.0):
    air = max(0.0, z - ground_z)
    sh_scale = max(0.55, 1.0 - air * 0.005)
    _draw_ellipse_shadow(
        surface,
        Vector2(pos.x + 2, pos.y + 4 - ground_z * 0.65),
        MOUSE_RADIUS * sh_scale,
        MOUSE_RADIUS * 0.72 * sh_scale,
        alpha=max(25, int(68 - air * 0.35)),
    )
    bx = int(pos.x)
    by = int(pos.y - z * 0.8)
    rad = int(MOUSE_RADIUS * (1.0 + min(0.28, air * 0.003)))
    pygame.draw.circle(surface, (22, 92, 175), (bx, by), rad + 1)
    pygame.draw.circle(surface, MOUSE_COLOR, (bx, by), rad)
    pygame.draw.circle(surface, BALL_HIGHLIGHT, (bx - max(2, rad // 3), by - max(2, rad // 3)), max(2, rad // 4))


def draw_hand(surface, pos, holding=False):
    """Draw a custom hand cursor: open/loose when empty, closed/gripping when holding the ball."""
    hx, hy = int(pos.x), int(pos.y)

    if not holding:
        fingers = [
            ((hx - 8, hy + 1), (hx - 12, hy - 14)),
            ((hx - 3, hy), (hx - 3, hy - 17)),
            ((hx + 3, hy), (hx + 5, hy - 15)),
            ((hx + 8, hy + 2), (hx + 12, hy - 10)),
            ((hx - 10, hy + 7), (hx - 18, hy - 1)),
        ]
        for p1, p2 in fingers:
            _draw_capsule(surface, p1, p2, 3, HAND_COLOR, HAND_OUTLINE)

        wrist_rect = pygame.Rect(hx - 7, hy + 11, 14, 10)
        pygame.draw.rect(surface, HAND_OUTLINE, wrist_rect.inflate(2, 2), border_radius=4)
        pygame.draw.rect(surface, HAND_COLOR, wrist_rect, border_radius=4)

        palm_rect = pygame.Rect(hx - 11, hy - 2, 22, 17)
        pygame.draw.ellipse(surface, HAND_OUTLINE, palm_rect.inflate(2, 2))
        pygame.draw.ellipse(surface, HAND_COLOR, palm_rect)
        pygame.draw.ellipse(surface, HAND_COLOR, pygame.Rect(hx - 9, hy - 1, 18, 12))
    else:
        wrist_rect = pygame.Rect(hx - 7, hy + 10, 14, 11)
        pygame.draw.rect(surface, HAND_OUTLINE, wrist_rect.inflate(2, 2), border_radius=4)
        pygame.draw.rect(surface, HAND_COLOR, wrist_rect, border_radius=4)

        palm_rect = pygame.Rect(hx - 12, hy - 1, 24, 16)
        pygame.draw.ellipse(surface, HAND_OUTLINE, palm_rect.inflate(2, 2))
        pygame.draw.ellipse(surface, HAND_COLOR, palm_rect)

        draw_ball(surface, pos, z=0.0, ground_z=0.0)

        for fx, fy in [(hx - 8, hy - 9), (hx - 3, hy - 11), (hx + 3, hy - 11), (hx + 8, hy - 8)]:
            pygame.draw.circle(surface, HAND_OUTLINE, (fx, fy), 4)
            pygame.draw.circle(surface, HAND_COLOR, (fx, fy), 3)

        _draw_capsule(surface, (hx - 11, hy + 5), (hx - 3, hy + 2), 3, HAND_COLOR, HAND_OUTLINE)


def _draw_ears(surface, head_pos, forward, right, s):
    for side in (-1, 1):
        outer_ear = [
            head_pos - forward * (s * 0.06) + right * (side * s * 0.18),
            head_pos - forward * (s * 0.18) + right * (side * s * 0.54),
            head_pos + forward * (s * 0.20) + right * (side * s * 0.34),
        ]
        centroid = (outer_ear[0] + outer_ear[1] + outer_ear[2]) / 3.0
        inner_ear = [centroid + (p - centroid) * 0.55 for p in outer_ear]
        pygame.draw.polygon(surface, CAT_COLOR, [(p.x, p.y) for p in outer_ear])
        pygame.draw.polygon(surface, CAT_INNER_EAR, [(p.x, p.y) for p in inner_ear])


def draw_cat(
    surface,
    pos,
    angle,
    z=0.0,
    ground_z=0.0,
    walk_phase=0.0,
    tail_phase=0.0,
    size=CAT_SIZE,
    mood="active",
    mood_phase=0.0,
    zzz_font=None,
):
    air = max(0.0, z - ground_z)
    scale = 1.0 + min(0.24, air * 0.0042)
    s = size * scale

    center = Vector2(pos.x, pos.y - z * 0.8)
    forward = Vector2(math.cos(angle), math.sin(angle))
    right = Vector2(-forward.y, forward.x)

    if mood == "sleep":
        breath = 1.0 + 0.035 * math.sin(mood_phase * 2.2)
        sr = s * breath
        _draw_ellipse_shadow(
            surface,
            Vector2(pos.x + 3, pos.y + 7 - ground_z * 0.65),
            size * 0.56,
            size * 0.48,
            alpha=64,
        )
        pygame.draw.circle(surface, CAT_COLOR, (int(center.x), int(center.y)), int(sr * 0.50))
        for a_deg in (-35, 0, 35):
            rad = angle + math.radians(a_deg + 160)
            p1 = center + Vector2(math.cos(rad), math.sin(rad)) * (sr * 0.16)
            p2 = center + Vector2(math.cos(rad), math.sin(rad)) * (sr * 0.44)
            pygame.draw.line(surface, CAT_STRIPE, (int(p1.x), int(p1.y)), (int(p2.x), int(p2.y)), max(2, int(sr * 0.06)))

        wrap_pts = []
        for i in range(10):
            t = i / 9.0
            a = angle + math.pi * (0.65 + t * 1.05)
            rad_tail = sr * (0.50 + 0.04 * math.sin(mood_phase * 1.4 + t * 2.0))
            wrap_pts.append((int(center.x + math.cos(a) * rad_tail), int(center.y + math.sin(a) * rad_tail)))
        pygame.draw.lines(surface, CAT_STRIPE, False, wrap_pts, max(3, int(sr * 0.12)))
        pygame.draw.lines(surface, CAT_COLOR, False, wrap_pts, max(2, int(sr * 0.09)))

        head_pos = center + forward * (sr * 0.28) + right * (sr * 0.12)
        pygame.draw.circle(surface, CAT_COLOR, (int(head_pos.x), int(head_pos.y)), int(sr * 0.34))
        _draw_ears(surface, head_pos, forward, right, sr * 0.85)

        eye_base = head_pos + forward * (sr * 0.12)
        for side in (-1, 1):
            ep = eye_base + right * (side * sr * 0.12)
            p1 = ep - right * (sr * 0.05)
            p2 = ep + right * (sr * 0.05)
            pygame.draw.line(surface, PUPIL_COLOR, (int(p1.x), int(p1.y)), (int(p2.x), int(p2.y)), 2)

        nose = head_pos + forward * (sr * 0.27)
        pygame.draw.circle(surface, CAT_INNER_EAR, (int(nose.x), int(nose.y)), max(2, int(sr * 0.04)))

        if zzz_font is not None:
            for idx, label in enumerate(("z", "z", "Z")):
                cyc = (mood_phase * 0.45 + idx * 0.33) % 1.0
                zx = head_pos.x + 14 + idx * 8 + math.sin(cyc * 5.0) * 4
                zy = head_pos.y - 16 - cyc * 34
                alpha = int(220 * math.sin(cyc * math.pi))
                if alpha > 20:
                    z_surf = zzz_font.render(label, True, (245, 240, 232))
                    z_surf.set_alpha(alpha)
                    surface.blit(z_surf, (int(zx), int(zy)))
        return

    sh_scale = max(0.58, 1.0 - air * 0.0045)
    _draw_ellipse_shadow(
        surface,
        Vector2(pos.x + 4, pos.y + 8 - ground_z * 0.65),
        size * (0.56 if mood in ("sit", "groom") else 0.68) * sh_scale,
        size * 0.46 * sh_scale,
        alpha=max(26, int(72 - air * 0.4)),
    )

    tail_pts = []
    tail_base = center - forward * (s * (0.42 if mood in ("sit", "groom") else 0.52))
    tail_amp = 0.16 if mood in ("sit", "groom") else 0.24
    for i in range(6):
        t = i / 5.0
        sway = math.sin(tail_phase - t * 2.1) * (s * tail_amp * t)
        pt = tail_base - forward * (s * 0.72 * t) + right * sway
        tail_pts.append((int(pt.x), int(pt.y)))
    pygame.draw.lines(surface, CAT_STRIPE, False, tail_pts, max(3, int(s * 0.12)))
    pygame.draw.lines(surface, CAT_COLOR, False, tail_pts, max(2, int(s * 0.09)))

    if mood in ("sit", "groom"):
        for side in (-1, 1):
            paw_pos = center + forward * (s * 0.38) + right * (side * s * 0.17)
            pygame.draw.circle(surface, CAT_STRIPE, (int(paw_pos.x), int(paw_pos.y)), max(3, int(s * 0.11)))
            pygame.draw.circle(surface, (250, 200, 140), (int(paw_pos.x), int(paw_pos.y)), max(2, int(s * 0.085)))
        body_circles = [(-0.14, 0.44), (0.10, 0.42)]
    else:
        stride = 0.0 if air > 4.0 else math.sin(walk_phase) * (s * 0.14)
        paw_offsets = [
            (0.32 + stride / s, -0.34),
            (0.32 - stride / s, 0.34),
            (-0.30 - stride / s, -0.34),
            (-0.30 + stride / s, 0.34),
        ]
        for pf, pr in paw_offsets:
            paw_pos = center + forward * (s * pf) + right * (s * pr)
            pygame.draw.circle(surface, CAT_STRIPE, (int(paw_pos.x), int(paw_pos.y)), max(3, int(s * 0.12)))
            pygame.draw.circle(surface, (250, 200, 140), (int(paw_pos.x), int(paw_pos.y)), max(2, int(s * 0.09)))
        body_circles = [(-0.24, 0.40), (0.0, 0.44), (0.24, 0.40)]

    for bf, brad in body_circles:
        bp = center + forward * (s * bf)
        pygame.draw.circle(surface, CAT_COLOR, (int(bp.x), int(bp.y)), int(s * brad))

    stripes = (-0.12, 0.06) if mood in ("sit", "groom") else (-0.18, 0.0, 0.16)
    for sf in stripes:
        sp1 = center + forward * (s * sf) - right * (s * 0.26)
        sp2 = center + forward * (s * sf) + right * (s * 0.26)
        pygame.draw.line(surface, CAT_STRIPE, (int(sp1.x), int(sp1.y)), (int(sp2.x), int(sp2.y)), max(2, int(s * 0.06)))

    head_shift = 0.42 if mood in ("sit", "groom") else 0.56
    groom_bob = math.sin(mood_phase * 7.5) * (s * 0.04) if mood == "groom" else 0.0
    head_pos = center + forward * (s * head_shift + groom_bob)
    pygame.draw.circle(surface, CAT_COLOR, (int(head_pos.x), int(head_pos.y)), int(s * 0.40))
    _draw_ears(surface, head_pos, forward, right, s)

    blinking = mood == "sit" and (mood_phase % 3.4) > 3.22
    eye_base = head_pos + forward * (s * 0.15)
    sep = s * 0.15
    for side in (-1, 1):
        ep = eye_base + right * (side * sep)
        if blinking or mood == "groom":
            p1 = ep - right * (s * 0.06)
            p2 = ep + right * (s * 0.06)
            pygame.draw.line(surface, PUPIL_COLOR, (int(p1.x), int(p1.y)), (int(p2.x), int(p2.y)), 2)
        else:
            pygame.draw.circle(surface, EYE_COLOR, (int(ep.x), int(ep.y)), max(3, int(s * 0.085)))
            look = forward * (s * 0.03)
            pygame.draw.circle(surface, PUPIL_COLOR, (int(ep.x + look.x), int(ep.y + look.y)), max(2, int(s * 0.045)))

    nose = head_pos + forward * (s * 0.33)
    pygame.draw.circle(surface, CAT_INNER_EAR, (int(nose.x), int(nose.y)), max(2, int(s * 0.045)))

    if mood == "groom":
        rub = math.sin(mood_phase * 7.5)
        lick_paw = head_pos + forward * (s * (0.24 + 0.08 * rub)) + right * (s * (0.26 - 0.10 * rub))
        pygame.draw.circle(surface, CAT_STRIPE, (int(lick_paw.x), int(lick_paw.y)), max(3, int(s * 0.11)))
        pygame.draw.circle(surface, (250, 200, 140), (int(lick_paw.x), int(lick_paw.y)), max(2, int(s * 0.085)))


def main():
    pygame.init()
    fullscreen = False
    base_flags = pygame.SCALED
    screen = pygame.display.set_mode((WIDTH, HEIGHT), base_flags)
    pygame.display.set_caption("Cat Chasing Ball — Living Room")
    clock = pygame.time.Clock()
    font = pygame.font.SysFont(None, 23)
    zzz_font = pygame.font.SysFont(None, 20, bold=True)
    pygame.mouse.set_visible(False)

    furniture = create_living_room_furniture()
    pillows = create_floor_pillows()
    room_bg = build_living_room_surface(furniture)
    solid_items = [f for f in furniture if f.kind == "solid"]

    cat_pos = Vector2(360, 480)
    cat_vel = Vector2(0, 0)
    cat_angle = 0.0
    cat_z = surface_height_at(cat_pos, furniture, pillows)
    cat_vz = 0.0
    walk_phase = 0.0
    tail_phase = 0.0

    raw_mouse = Vector2(pygame.mouse.get_pos())
    cursor_pos = clamp_point(raw_mouse, MOUSE_RADIUS, MOUSE_RADIUS)
    prev_cursor_pos = cursor_pos.copy()
    hand_speed = 0.0
    ball_pos = cursor_pos.copy()
    ball_vel = Vector2(0, 0)
    ball_z = surface_height_at(ball_pos, furniture, pillows)
    ball_vz = 0.0
    ball_state = "held"  # "held" | "loose" | "cat"

    throw_lock_timer = 0.0
    grab_lock_timer = 0.0
    cat_catch_cooldown = 0.0

    flee_target = None
    flee_retarget_timer = 0.0
    recent_flee_waypoints = deque(maxlen=3)

    outside_timer = 0.0
    mouse_idle_timer = 0.0
    cat_mood = "active"  # "active" | "stroll" | "sit" | "groom" | "sleep"
    mood_timer = 0.0
    mood_phase = 0.0
    cozy_target = None
    cozy_kind = None
    sit_look_angle = 0.0
    sit_look_timer = 0.0

    def wake_cat():
        nonlocal cat_mood, mood_timer, cozy_target, cozy_kind, mouse_idle_timer, outside_timer
        mouse_idle_timer = 0.0
        outside_timer = 0.0
        if cat_mood != "active":
            cat_mood = "active"
            mood_timer = 0.0
            cozy_target = None
            cozy_kind = None

    def choose_next_idle_mood(arrived_kind=None):
        nonlocal cat_mood, mood_timer, mood_phase, cozy_target, cozy_kind, sit_look_angle, sit_look_timer
        mood_phase = 0.0
        if arrived_kind in ("cat_bed", "sofa", "pillow") and random.random() < 0.58:
            cat_mood = "sleep"
            mood_timer = random.uniform(7.5, 12.0)
            return
        if cat_mood == "stroll":
            cat_mood = random.choice(["sit", "groom", "sleep"])
        elif cat_mood == "sleep":
            cat_mood = random.choice(["sit", "groom"])
        elif cat_mood == "groom":
            cat_mood = random.choice(["sleep", "stroll", "sit"])
        else:
            cat_mood = random.choice(["groom", "stroll", "sleep"])

        if cat_mood == "stroll":
            cozy_kind, cozy_target = pick_cozy_spot(cat_pos, prefer_bed=(random.random() < 0.6), pillows=pillows)
            mood_timer = random.uniform(6.0, 10.0)
        elif cat_mood == "sit":
            mood_timer = random.uniform(3.5, 6.0)
            sit_look_angle = cat_angle
            sit_look_timer = random.uniform(1.2, 2.2)
        elif cat_mood == "groom":
            mood_timer = random.uniform(4.0, 6.5)
        elif cat_mood == "sleep":
            mood_timer = random.uniform(7.5, 12.0)

    try:
        running = True
        while running:
            dt = min(0.05, clock.tick(FPS) / 1000.0)
            throw_lock_timer = max(0.0, throw_lock_timer - dt)
            grab_lock_timer = max(0.0, grab_lock_timer - dt)
            cat_catch_cooldown = max(0.0, cat_catch_cooldown - dt)
            flee_retarget_timer = max(0.0, flee_retarget_timer - dt)

            pointer_focused = bool(pygame.mouse.get_focused())

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        running = False
                    elif event.key in (pygame.K_f, pygame.K_F11):
                        fullscreen = not fullscreen
                        flags = base_flags | pygame.FULLSCREEN if fullscreen else base_flags
                        screen = pygame.display.set_mode((WIDTH, HEIGHT), flags)
                elif event.type == pygame.MOUSEMOTION:
                    raw_mouse = Vector2(event.pos)
                    new_pos = clamp_point(raw_mouse, MOUSE_RADIUS, MOUSE_RADIUS)
                    if raw_mouse.y >= HUD_HEIGHT and (new_pos - cursor_pos).length() > 1.5:
                        wake_cat()
                    cursor_pos = new_pos
                elif event.type == pygame.MOUSEBUTTONDOWN:
                    if event.button == 1:
                        raw_mouse = Vector2(event.pos)
                        cursor_pos = clamp_point(raw_mouse, MOUSE_RADIUS, MOUSE_RADIUS)
                        if raw_mouse.y >= HUD_HEIGHT:
                            wake_cat()
                            if ball_state == "held":
                                dest = random_target_away_from(cat_pos, furniture)
                                flight_time = 0.52
                                ball_vel = (dest - ball_pos) / flight_time
                                ball_z = max(surface_height_at(ball_pos, furniture, pillows) + 12.0, 22.0)
                                ball_vz = 290.0
                                ball_state = "loose"
                                throw_lock_timer = THROW_LOCK_TIME
                            elif ball_state == "loose" and (cursor_pos - ball_pos).length() <= PICKUP_DISTANCE:
                                ball_state = "held"
                                ball_vel = Vector2(0, 0)
                                ball_vz = 0.0
                            elif (
                                ball_state == "cat"
                                and grab_lock_timer <= 0.0
                                and (cursor_pos - ball_pos).length() <= TAKE_BACK_DISTANCE
                            ):
                                ball_state = "held"
                                cat_catch_cooldown = CAT_CATCH_COOLDOWN

            if pointer_focused:
                raw_mouse = Vector2(pygame.mouse.get_pos())
                on_hud = raw_mouse.y < HUD_HEIGHT
                if on_hud:
                    outside_timer += dt
                    mouse_idle_timer += dt
                    hand_speed *= 0.8
                else:
                    outside_timer = 0.0
                    live_pos = clamp_point(raw_mouse, MOUSE_RADIUS, MOUSE_RADIUS)
                    moved = (live_pos - prev_cursor_pos).length()
                    hand_speed = hand_speed * 0.75 + (moved / max(dt, 1e-4)) * 0.25
                    if moved > 1.5:
                        wake_cat()
                    else:
                        mouse_idle_timer += dt
                    cursor_pos = live_pos
                    prev_cursor_pos = live_pos.copy()
            else:
                on_hud = False
                outside_timer += dt
                mouse_idle_timer += dt
                hand_speed *= 0.8

            pointer_in_room = pointer_focused and not on_hud

            # Enter calm autonomous mode when leaving window, hovering top HUD, or staying still
            idle_triggered = (outside_timer >= OUTSIDE_IDLE_DELAY) or (
                mouse_idle_timer >= STILL_IDLE_DELAY and ball_state != "loose"
            )
            if idle_triggered and cat_mood == "active":
                if ball_state == "cat":
                    ball_state = "loose"
                    fwd = Vector2(math.cos(cat_angle), math.sin(cat_angle))
                    ball_vel = fwd * 45.0
                    ball_vz = 60.0
                    flee_target = None
                    recent_flee_waypoints.clear()
                if random.random() < 0.65:
                    cat_mood = "stroll"
                    cozy_kind, cozy_target = pick_cozy_spot(cat_pos, prefer_bed=True, pillows=pillows)
                    mood_timer = random.uniform(6.0, 10.0)
                else:
                    cat_mood = random.choice(["sit", "groom"])
                    mood_timer = random.uniform(3.5, 6.0)
                    sit_look_angle = cat_angle
                    sit_look_timer = 1.6
                mood_phase = 0.0

            if pointer_in_room:
                if ball_state == "loose" and throw_lock_timer <= 0.0:
                    if (
                        (cursor_pos - ball_pos).length() <= PICKUP_DISTANCE
                        and ball_z - surface_height_at(ball_pos, furniture, pillows) < 35.0
                    ):
                        ball_state = "held"
                        ball_vel = Vector2(0, 0)
                        ball_vz = 0.0
                        wake_cat()
                elif ball_state == "cat" and grab_lock_timer <= 0.0:
                    if (cursor_pos - ball_pos).length() <= TAKE_BACK_DISTANCE:
                        ball_state = "held"
                        cat_catch_cooldown = CAT_CATCH_COOLDOWN
                        wake_cat()

            # Ball physics
            if ball_state == "held":
                ball_pos = cursor_pos.copy()
                ball_vel = Vector2(0, 0)
                ball_z = surface_height_at(ball_pos, furniture, pillows)
                ball_vz = 0.0
            elif ball_state == "loose":
                ball_pos += ball_vel * dt
                if ball_pos.x < PLAY_RECT.left + MOUSE_RADIUS:
                    ball_pos.x = PLAY_RECT.left + MOUSE_RADIUS
                    ball_vel.x = abs(ball_vel.x) * 0.65
                elif ball_pos.x > PLAY_RECT.right - MOUSE_RADIUS:
                    ball_pos.x = PLAY_RECT.right - MOUSE_RADIUS
                    ball_vel.x = -abs(ball_vel.x) * 0.65
                if ball_pos.y < PLAY_RECT.top + MOUSE_RADIUS:
                    ball_pos.y = PLAY_RECT.top + MOUSE_RADIUS
                    ball_vel.y = abs(ball_vel.y) * 0.65
                elif ball_pos.y > PLAY_RECT.bottom - MOUSE_RADIUS:
                    ball_pos.y = PLAY_RECT.bottom - MOUSE_RADIUS
                    ball_vel.y = -abs(ball_vel.y) * 0.65

                ball_pos, ball_vel = resolve_solid_collisions(ball_pos, ball_vel, furniture, radius=MOUSE_RADIUS + 2)
                b_ground = surface_height_at(ball_pos, furniture, pillows)
                ball_vz -= GRAVITY * dt
                ball_z += ball_vz * dt
                if ball_z <= b_ground:
                    ball_z = b_ground
                    if abs(ball_vz) > 75.0:
                        ball_vz = -ball_vz * 0.45
                        ball_vel *= 0.72
                    else:
                        ball_vz = 0.0
                        ball_vel *= math.exp(-5.0 * dt)
                        if ball_vel.length() < 6.0:
                            ball_vel = Vector2(0, 0)

            # Cat AI steering
            cat_ground_z = surface_height_at(cat_pos, furniture, pillows)
            desired = Vector2(0, 0)
            speed_cap = MAX_SPEED

            if cat_mood != "active":
                mood_phase += dt
                mood_timer -= dt
                if cat_mood == "stroll":
                    speed_cap = STROLL_SPEED
                    if cozy_target is None:
                        cozy_kind, cozy_target = pick_cozy_spot(cat_pos, prefer_bed=True, pillows=pillows)
                    to_cozy = cozy_target - cat_pos
                    dist_cozy = to_cozy.length()
                    if dist_cozy <= 24.0 or mood_timer <= 0.0:
                        choose_next_idle_mood(arrived_kind=cozy_kind)
                    else:
                        move_dir = choose_clear_direction(cat_pos, cozy_target, cat_angle, furniture)
                        pace = STROLL_SPEED * min(1.0, max(0.35, dist_cozy / 70.0))
                        desired = move_dir * pace
                        cat_angle = lerp_angle(cat_angle, math.atan2(move_dir.y, move_dir.x), TURN_SPEED * 0.65 * dt)
                elif cat_mood == "sit":
                    sit_look_timer -= dt
                    if sit_look_timer <= 0.0:
                        sit_look_angle = cat_angle + random.uniform(-0.9, 0.9)
                        sit_look_timer = random.uniform(1.4, 2.5)
                    cat_angle = lerp_angle(cat_angle, sit_look_angle, 2.2 * dt)
                    if mood_timer <= 0.0:
                        choose_next_idle_mood()
                elif cat_mood in ("groom", "sleep"):
                    if mood_timer <= 0.0:
                        choose_next_idle_mood()
            elif ball_state == "cat":
                speed_cap = FLEE_SPEED
                hand_dist = (cat_pos - cursor_pos).length()
                safe_pause = (
                    hand_dist > 290.0
                    and hand_speed < 65.0
                    and cat_z <= cat_ground_z + 1.0
                    and (flee_target is None or (flee_target - cat_pos).length() < 95.0 or cat_ground_z >= 12.0)
                )
                if safe_pause:
                    desired = Vector2(0, 0)
                    look_dir = cursor_pos - cat_pos
                    if look_dir.length() > 1.0:
                        cat_angle = lerp_angle(cat_angle, math.atan2(look_dir.y, look_dir.x), TURN_SPEED * 0.7 * dt)
                else:
                    need_new_target = (
                        flee_target is None
                        or (flee_target - cat_pos).length() < 75.0
                        or (flee_target - cursor_pos).length() < 165.0
                        or (flee_retarget_timer <= 0.0 and cat_vel.length() < 60.0)
                    )
                    if need_new_target:
                        if flee_target is not None:
                            recent_flee_waypoints.append(flee_target.copy())
                        flee_target = pick_flee_waypoint(
                            cat_pos, cursor_pos, current_target=flee_target, recent_targets=recent_flee_waypoints
                        )
                        flee_retarget_timer = 0.45

                    flee_dir = compute_flee_direction(
                        cat_pos, cursor_pos, furniture, current_angle=cat_angle, flee_target=flee_target
                    )
                    desired = flee_dir * FLEE_SPEED
                    cat_angle = lerp_angle(cat_angle, math.atan2(flee_dir.y, flee_dir.x), TURN_SPEED * dt)
            else:
                flee_target = None
                recent_flee_waypoints.clear()
                dir_vec = ball_pos - cat_pos
                dist = dir_vec.length()
                if dist > 4.0:
                    if dist > 45.0:
                        move_dir = choose_clear_direction(cat_pos, ball_pos, cat_angle, furniture)
                    else:
                        move_dir = dir_vec.normalize()
                    target_speed = MAX_SPEED
                    if cat_catch_cooldown > 0.0 and dist < 95.0:
                        target_speed = MAX_SPEED * max(0.25, dist / 95.0)
                    desired = move_dir * target_speed
                    if dist > 12.0:
                        cat_angle = lerp_angle(cat_angle, math.atan2(move_dir.y, move_dir.x), TURN_SPEED * dt)

            steer = desired - cat_vel
            if steer.length() > 0:
                steer_limit = ACCELERATION * dt
                if steer.length() > steer_limit:
                    steer.scale_to_length(steer_limit)
                cat_vel += steer

            cat_vel *= math.exp(-DAMPING * dt)
            if cat_vel.length() > speed_cap:
                cat_vel.scale_to_length(speed_cap)

            # Proactive jumping onto/off living-room furniture & floor pillows
            speed = cat_vel.length()
            if cat_z <= cat_ground_z + 1.0 and speed > 22.0:
                look_ahead = cat_pos + cat_vel.normalize() * 38.0
                next_z = surface_height_at(look_ahead, furniture, pillows)
                if next_z > cat_ground_z + 5.0:
                    jump_peak = (next_z - cat_z) + 26.0
                    cat_vz = math.sqrt(2.0 * GRAVITY * jump_peak)
                elif next_z < cat_ground_z - 5.0:
                    cat_vz = 150.0

            cat_pos += cat_vel * dt
            cat_pos, cat_vel = resolve_solid_collisions(cat_pos, cat_vel, furniture, radius=CAT_RADIUS)
            cat_pos = clamp_point(cat_pos, CAT_RADIUS, CAT_RADIUS)

            # Update gently nudgeable floor pillows
            update_floor_pillows(pillows, cat_pos, cat_vel, cat_z, furniture, dt)

            new_ground_z = surface_height_at(cat_pos, furniture, pillows)
            if new_ground_z > cat_z + 5.0 and cat_vz <= 0.0:
                cat_vz = math.sqrt(2.0 * GRAVITY * ((new_ground_z - cat_z) + 20.0))
            cat_vz -= GRAVITY * dt
            cat_z += cat_vz * dt
            if cat_z <= new_ground_z:
                cat_z = new_ground_z
                cat_vz = 0.0

            walk_phase += speed * dt * 0.09
            tail_rate = 1.4 if cat_mood in ("sit", "groom", "sleep") else (2.8 + speed * 0.025)
            tail_phase += tail_rate * dt

            if cat_mood == "active" and ball_state != "cat" and cat_catch_cooldown <= 0.0:
                horiz_dist = (cat_pos - ball_pos).length()
                vert_dist = abs(cat_z - ball_z)
                if horiz_dist <= CATCH_DISTANCE and vert_dist <= 32.0:
                    ball_state = "cat"
                    grab_lock_timer = GRAB_LOCK_TIME
                    recent_flee_waypoints.clear()
                    flee_target = pick_flee_waypoint(cat_pos, cursor_pos)
                    flee_retarget_timer = 0.45
                    flee_dir = compute_flee_direction(
                        cat_pos, cursor_pos, furniture, current_angle=cat_angle, flee_target=flee_target
                    )
                    cat_vel = flee_dir * FLEE_SPEED
                    cat_angle = math.atan2(flee_dir.y, flee_dir.x)

            if ball_state == "cat":
                forward = Vector2(math.cos(cat_angle), math.sin(cat_angle))
                ball_pos = clamp_point(cat_pos + forward * (CAT_SIZE * 0.88), MOUSE_RADIUS, MOUSE_RADIUS)
                ball_z = cat_z + 4.0

            # --- Draw ---
            screen.blit(room_bg, (0, 0))

            for pillow in pillows:
                draw_floor_pillow(screen, pillow)

            for item in solid_items:
                draw_furniture_item(screen, item)

            if ball_state == "loose":
                draw_ball(screen, ball_pos, z=ball_z, ground_z=surface_height_at(ball_pos, furniture, pillows))

            draw_cat(
                screen,
                cat_pos,
                cat_angle,
                z=cat_z,
                ground_z=new_ground_z,
                walk_phase=walk_phase,
                tail_phase=tail_phase,
                size=CAT_SIZE,
                mood=cat_mood,
                mood_phase=mood_phase,
                zzz_font=zzz_font,
            )

            if ball_state == "cat":
                draw_ball(screen, ball_pos, z=ball_z, ground_z=new_ground_z)

            if pointer_in_room:
                draw_hand(screen, cursor_pos, holding=(ball_state == "held"))

            # HUD
            txt = font.render(
                "Left-click: toss ball | F / F11: fullscreen | Hover top bar or stay still: let cat rest | Esc: quit",
                True,
                (238, 232, 222),
            )
            screen.blit(txt, (16, 10))
            if cat_mood == "stroll":
                state_label = "Cat is strolling to a cozy spot..."
            elif cat_mood == "sit":
                state_label = "Cat is sitting & looking around"
            elif cat_mood == "groom":
                state_label = "Cat is grooming itself"
            elif cat_mood == "sleep":
                state_label = "Cat is sleeping... zZz"
            elif ball_state == "held":
                state_label = "Holding ball"
            elif ball_state == "loose":
                state_label = "Ball loose (pick it up!)"
            else:
                state_label = "Cat stole the ball! Chase it to take it back!"
            on_surface = "Airborne!" if cat_z > new_ground_z + 4.0 else ("On furniture" if new_ground_z > 0 else "Floor")
            speed_txt = font.render(
                f"Speed: {int(cat_vel.length())} px/s   Surface: {on_surface}   [{state_label}]",
                True,
                (212, 198, 178),
            )
            screen.blit(speed_txt, (16, 34))

            pygame.display.flip()
    finally:
        pygame.mouse.set_visible(True)
        pygame.quit()


if __name__ == "__main__":
    main()
