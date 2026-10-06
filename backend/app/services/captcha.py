import secrets
import logging
from typing import Dict
from app.core.utils import generate_uuidv7
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)

# Character pool excluding confusing characters (0, O, 1, I, l)
CHAR_POOL = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

# Use cryptographically secure random generator for security/compliance
_rng = secrets.SystemRandom()

# Fallback in-memory cache if Redis is temporarily unreachable
_memory_captcha_store: Dict[str, str] = {}


def _generate_svg_captcha(text: str) -> str:
    """Generate high-contrast, bot-resistant SVG vector captcha without external binary dependencies."""
    width = 140
    height = 46

    # Random pastel background colors
    bg_h1 = _rng.randint(180, 260)
    bg_h2 = _rng.randint(140, 220)
    bg_gradient = f"""
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl({bg_h1}, 40%, 96%)" />
        <stop offset="100%" stop-color="hsl({bg_h2}, 50%, 92%)" />
      </linearGradient>
    </defs>
    <rect width="{width}" height="{height}" rx="8" fill="url(#bgGrad)" />
    """

    # Random noise lines
    noise_lines = []
    line_colors = ["#94a3b8", "#cbd5e1", "#64748b", "#38bdf8", "#34d399"]
    for _ in range(4):
        x1, y1 = _rng.randint(0, 30), _rng.randint(5, 40)
        x2, y2 = _rng.randint(110, 140), _rng.randint(5, 40)
        cx, cy = _rng.randint(40, 100), _rng.randint(5, 40)
        stroke = _rng.choice(line_colors)
        stroke_w = _rng.uniform(1.2, 2.2)
        noise_lines.append(
            f'<path d="M {x1} {y1} Q {cx} {cy} {x2} {y2}" stroke="{stroke}" stroke-width="{stroke_w:.1f}" fill="none" opacity="0.6"/>'
        )

    # Random noise dots
    dots = []
    for _ in range(25):
        cx = _rng.randint(5, width - 5)
        cy = _rng.randint(5, height - 5)
        r = _rng.uniform(0.8, 2.0)
        c = _rng.choice(line_colors)
        dots.append(f'<circle cx="{cx}" cy="{cy}" r="{r:.1f}" fill="{c}" opacity="0.5"/>')

    # Character rendering with distortion & rotation
    char_elements = []
    char_colors = ["#0f172a", "#1e293b", "#0369a1", "#047857", "#4338ca", "#b91c1c"]
    char_spacing = (width - 24) / len(text)

    for i, char in enumerate(text):
        x = 14 + (i * char_spacing) + _rng.uniform(-2, 2)
        y = 31 + _rng.uniform(-3, 3)
        angle = _rng.randint(-22, 22)
        font_size = _rng.randint(22, 26)
        color = _rng.choice(char_colors)
        char_elements.append(
            f'<text x="{x:.1f}" y="{y:.1f}" font-size="{font_size}" font-family="Arial, Helvetica, sans-serif" '
            f'font-weight="bold" fill="{color}" transform="rotate({angle}, {x:.1f}, {y:.1f})">{char}</text>'
        )

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" style="user-select:none;-webkit-user-select:none;">
    {bg_gradient}
    {''.join(noise_lines)}
    {''.join(dots)}
    {''.join(char_elements)}
</svg>"""
    return svg.strip()


async def generate_captcha() -> Dict[str, str]:
    """Generate a fresh captcha challenge with a 5-minute TTL in Redis."""
    code = "".join(_rng.choices(CHAR_POOL, k=5))
    captcha_id = str(generate_uuidv7())
    svg = _generate_svg_captcha(code)

    try:
        redis = get_redis_client()
        await redis.setex(f"captcha:{captcha_id}", 300, code.lower())
    except Exception as e:
        logger.warning("Redis offline during captcha generation, fallback to memory: %s", e)
        _memory_captcha_store[captcha_id] = code.lower()

    return {
        "captcha_id": captcha_id,
        "captcha_svg": svg,
        "expires_in_seconds": 300
    }


async def verify_captcha(captcha_id: str, captcha_code: str) -> bool:
    """Verify and immediately consume captcha challenge (single-use)."""
    if not captcha_id or not captcha_code:
        return False

    normalized_input = captcha_code.strip().lower()

    # 1. Try Redis first
    try:
        redis = get_redis_client()
        stored = await redis.get(f"captcha:{captcha_id}")
        if stored:
            await redis.delete(f"captcha:{captcha_id}")
            return stored.strip().lower() == normalized_input
    except Exception as e:
        logger.warning("Redis offline during captcha verification, fallback to memory: %s", e)

    # 2. Check fallback in-memory store
    if captcha_id in _memory_captcha_store:
        expected = _memory_captcha_store.pop(captcha_id)
        return expected == normalized_input

    return False
