import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


SIZE = 1024
INK = "#b8bbc4"
BG = "#000000"


def bezier(p0, p1, p2, p3, t):
    u = 1 - t
    return (
        u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0],
        u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1],
    )


def tangent_char(dx, dy):
    angle = math.atan2(dy, dx)
    horizontal = abs(math.cos(angle))
    vertical = abs(math.sin(angle))
    if horizontal > 0.88:
        return "-"
    if vertical > 0.88:
        return "|"
    return "\\" if dx * dy > 0 else "/"


def dotted_curve(draw, font, points, count=18, phase=0):
    previous = bezier(*points, 0)
    for index in range(1, count + 1):
        t = index / count
        current = bezier(*points, t)
        dx, dy = current[0] - previous[0], current[1] - previous[1]
        char = "." if (index + phase) % 4 == 0 else tangent_char(dx, dy)
        draw.text(current, char, font=font, fill=INK, anchor="mm")
        previous = current


def main():
    output = Path(__file__).resolve().parents[1] / "outputs" / "o8-ascii-logo-v3.png"
    output.parent.mkdir(parents=True, exist_ok=True)

    image = Image.new("RGB", (SIZE, SIZE), BG)
    draw = ImageDraw.Draw(image)
    glyph = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 26)
    eye = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 31)
    caption = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 29)

    # Soft mantle: a broad sac tapering gently into the web between the arms.
    dotted_curve(draw, glyph, ((505, 88), (405, 70), (330, 205), (350, 365)), 16)
    dotted_curve(draw, glyph, ((505, 88), (610, 70), (690, 205), (670, 365)), 16, 2)
    dotted_curve(draw, glyph, ((350, 365), (390, 420), (455, 420), (510, 405)), 9, 1)
    dotted_curve(draw, glyph, ((510, 405), (565, 420), (630, 420), (670, 365)), 9, 3)

    draw.text((438, 260), "o", font=eye, fill=INK, anchor="mm")
    draw.text((582, 260), "o", font=eye, fill=INK, anchor="mm")
    draw.text((510, 337), "---", font=glyph, fill=INK, anchor="mm")

    # Eight independently posed arms, including outward curls at the edges.
    arms = [
        ((382, 397), (290, 470), (135, 640), (208, 760)),
        ((414, 409), (360, 535), (205, 720), (300, 826)),
        ((450, 414), (445, 555), (330, 720), (382, 850)),
        ((486, 416), (455, 595), (505, 730), (452, 865)),
        ((534, 416), (570, 575), (515, 735), (580, 862)),
        ((570, 414), (585, 555), (700, 715), (642, 846)),
        ((606, 409), (660, 530), (820, 710), (730, 818)),
        ((638, 397), (730, 465), (892, 620), (812, 752)),
    ]
    for index, arm in enumerate(arms):
        dotted_curve(draw, glyph, arm, 18, index)

    # Small terminal-like curl marks keep the outer arms visibly soft and alive.
    draw.text((195, 767), "(_", font=glyph, fill=INK, anchor="mm")
    draw.text((296, 831), "_/", font=glyph, fill=INK, anchor="mm")
    draw.text((379, 855), "(_", font=glyph, fill=INK, anchor="mm")
    draw.text((450, 871), "_/", font=glyph, fill=INK, anchor="mm")
    draw.text((583, 868), "\\_", font=glyph, fill=INK, anchor="mm")
    draw.text((645, 851), "_)", font=glyph, fill=INK, anchor="mm")
    draw.text((734, 823), "\\_", font=glyph, fill=INK, anchor="mm")
    draw.text((817, 757), "_)", font=glyph, fill=INK, anchor="mm")

    text = "o8 assembled itself"
    draw.text((SIZE / 2, 945), text, font=caption, fill=INK, anchor="mm")
    image.save(output, optimize=True)
    print(output)


if __name__ == "__main__":
    main()
