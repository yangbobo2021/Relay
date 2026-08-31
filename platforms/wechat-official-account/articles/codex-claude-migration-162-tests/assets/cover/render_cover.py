from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "cover-background-v1.png"
FONT_MEDIUM = "/System/Library/Fonts/STHeiti Medium.ttc"
FONT_LIGHT = "/System/Library/Fonts/STHeiti Light.ttc"

INK = "#18242b"
MUTED = "#56656c"
TEAL = "#11877f"
AMBER = "#e8a52b"
PAPER = "#f7fbfa"


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size)


def cover_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_ratio = size[0] / size[1]
    source_ratio = image.width / image.height
    if source_ratio > target_ratio:
        crop_width = round(image.height * target_ratio)
        left = (image.width - crop_width) // 2
        box = (left, 0, left + crop_width, image.height)
    else:
        crop_height = round(image.width / target_ratio)
        top = (image.height - crop_height) // 2
        box = (0, top, image.width, top + crop_height)
    return image.crop(box).resize(size, Image.Resampling.LANCZOS)


def draw_label(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, size: int) -> None:
    label_font = font(FONT_MEDIUM, size)
    draw.rectangle((x, y + size + 7, x + 34, y + size + 10), fill=TEAL)
    draw.text((x, y), text, font=label_font, fill=TEAL)


def render_horizontal(source: Image.Image) -> None:
    canvas = cover_crop(source, (900, 383)).convert("RGB")
    draw = ImageDraw.Draw(canvas)

    draw_label(draw, 48, 44, "AI 工作台迁移实测", 17)
    title_font = font(FONT_MEDIUM, 43)
    draw.text((48, 103), "换个工作台，", font=title_font, fill=INK)
    draw.text((48, 160), "功能还在吗？", font=title_font, fill=INK)

    subtitle_font = font(FONT_LIGHT, 20)
    draw.text((50, 239), "Codex + Claude Code", font=subtitle_font, fill=MUTED)
    draw.text((50, 276), "162 项真实验证", font=font(FONT_MEDIUM, 22), fill=INK)
    draw.ellipse((222, 284, 230, 292), fill=AMBER)

    canvas.save(ROOT / "cover-900x383.jpg", quality=94, optimize=True, subsampling=0)


def render_square(source: Image.Image) -> None:
    canvas = Image.new("RGB", (500, 500), PAPER)
    draw = ImageDraw.Draw(canvas)

    draw_label(draw, 34, 34, "AI 工作台迁移实测", 15)
    title_font = font(FONT_MEDIUM, 37)
    draw.text((34, 86), "换个工作台，", font=title_font, fill=INK)
    draw.text((34, 137), "功能还在吗？", font=title_font, fill=INK)
    draw.text((36, 204), "Codex + Claude Code · 162 项验证", font=font(FONT_LIGHT, 16), fill=MUTED)

    visual = source.crop((source.width * 2 // 5, 0, source.width, source.height))
    visual.thumbnail((500, 255), Image.Resampling.LANCZOS)
    x = (500 - visual.width) // 2
    canvas.paste(visual.convert("RGB"), (x, 245))

    canvas.save(ROOT / "share-500x500.jpg", quality=94, optimize=True, subsampling=0)


if __name__ == "__main__":
    background = Image.open(SOURCE).convert("RGB")
    render_horizontal(background)
    render_square(background)
