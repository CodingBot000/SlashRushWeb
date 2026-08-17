#!/usr/bin/env python3
"""Build deterministic, aligned boss pixel layers without external packages."""

from __future__ import annotations

import argparse
import binascii
import json
import math
import struct
import zlib
from collections import deque
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Raster:
    width: int
    height: int
    pixels: bytearray

    @classmethod
    def empty(cls, width: int, height: int) -> "Raster":
        return cls(width, height, bytearray(width * height * 4))

    def copy(self) -> "Raster":
        return Raster(self.width, self.height, bytearray(self.pixels))


def paeth(left: int, up: int, upper_left: int) -> int:
    candidate = left + up - upper_left
    left_distance = abs(candidate - left)
    up_distance = abs(candidate - up)
    diagonal_distance = abs(candidate - upper_left)
    if left_distance <= up_distance and left_distance <= diagonal_distance:
        return left
    return up if up_distance <= diagonal_distance else upper_left


def read_png(path: Path) -> Raster:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"Not a PNG: {path}")

    position = 8
    image_data = bytearray()
    header = None
    while position < len(data):
        length = struct.unpack(">I", data[position : position + 4])[0]
        kind = data[position + 4 : position + 8]
        payload = data[position + 8 : position + 8 + length]
        position += length + 12
        if kind == b"IHDR":
            header = struct.unpack(">IIBBBBB", payload)
        elif kind == b"IDAT":
            image_data.extend(payload)
        elif kind == b"IEND":
            break

    if header is None:
        raise ValueError(f"Missing PNG header: {path}")
    width, height, bit_depth, color_type, _, _, interlace = header
    if bit_depth != 8 or color_type not in (2, 6) or interlace != 0:
        raise ValueError(f"Unsupported PNG format in {path}: {header}")

    channels = 4 if color_type == 6 else 3
    stride = width * channels
    raw = zlib.decompress(image_data)
    previous = bytearray(stride)
    decoded_rows: list[bytearray] = []
    cursor = 0

    for _ in range(height):
        filter_kind = raw[cursor]
        cursor += 1
        current = bytearray(raw[cursor : cursor + stride])
        cursor += stride
        for index in range(stride):
            left = current[index - channels] if index >= channels else 0
            up = previous[index]
            upper_left = previous[index - channels] if index >= channels else 0
            if filter_kind == 1:
                current[index] = (current[index] + left) & 255
            elif filter_kind == 2:
                current[index] = (current[index] + up) & 255
            elif filter_kind == 3:
                current[index] = (current[index] + ((left + up) // 2)) & 255
            elif filter_kind == 4:
                current[index] = (current[index] + paeth(left, up, upper_left)) & 255
            elif filter_kind != 0:
                raise ValueError(f"Unsupported PNG filter {filter_kind} in {path}")
        decoded_rows.append(current)
        previous = current

    rgba = bytearray(width * height * 4)
    for y, row in enumerate(decoded_rows):
        for x in range(width):
            source = x * channels
            target = (y * width + x) * 4
            rgba[target : target + 3] = row[source : source + 3]
            rgba[target + 3] = row[source + 3] if channels == 4 else 255
    return Raster(width, height, rgba)


def png_chunk(kind: bytes, payload: bytes) -> bytes:
    checksum = binascii.crc32(kind + payload) & 0xFFFFFFFF
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", checksum)


def write_png(path: Path, image: Raster) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    scanlines = bytearray()
    stride = image.width * 4
    for y in range(image.height):
        scanlines.append(0)
        start = y * stride
        scanlines.extend(image.pixels[start : start + stride])
    output = bytearray(b"\x89PNG\r\n\x1a\n")
    output.extend(png_chunk(b"IHDR", struct.pack(">IIBBBBB", image.width, image.height, 8, 6, 0, 0, 0)))
    output.extend(png_chunk(b"IDAT", zlib.compress(bytes(scanlines), 9)))
    output.extend(png_chunk(b"IEND", b""))
    path.write_bytes(output)


def alpha_mask(image: Raster, threshold: int = 16) -> bytearray:
    return bytearray(1 if image.pixels[index + 3] > threshold else 0 for index in range(0, len(image.pixels), 4))


def connected_components(mask: bytearray, width: int, height: int) -> list[list[int]]:
    seen = bytearray(width * height)
    components: list[list[int]] = []
    for start, value in enumerate(mask):
        if not value or seen[start]:
            continue
        seen[start] = 1
        queue = deque([start])
        component: list[int] = []
        while queue:
            index = queue.popleft()
            component.append(index)
            y, x = divmod(index, width)
            for next_index in (index - 1, index + 1, index - width, index + width):
                if next_index < 0 or next_index >= width * height:
                    continue
                next_y, next_x = divmod(next_index, width)
                if abs(next_x - x) + abs(next_y - y) != 1:
                    continue
                if mask[next_index] and not seen[next_index]:
                    seen[next_index] = 1
                    queue.append(next_index)
        components.append(component)
    return sorted(components, key=len, reverse=True)


def raster_from_indices(source: Raster, indices: list[int]) -> Raster:
    output = Raster.empty(source.width, source.height)
    for pixel_index in indices:
        source_index = pixel_index * 4
        output.pixels[source_index : source_index + 4] = source.pixels[source_index : source_index + 4]
    return output


def keep_largest_components(image: Raster, count: int) -> Raster:
    components = connected_components(alpha_mask(image), image.width, image.height)
    kept = [pixel_index for component in components[:count] for pixel_index in component]
    return raster_from_indices(image, kept)


def bounding_box(image: Raster, padding: int = 0) -> tuple[int, int, int, int]:
    min_x, min_y = image.width, image.height
    max_x = max_y = -1
    for y in range(image.height):
        for x in range(image.width):
            if image.pixels[(y * image.width + x) * 4 + 3] == 0:
                continue
            min_x = min(min_x, x)
            min_y = min(min_y, y)
            max_x = max(max_x, x)
            max_y = max(max_y, y)
    if max_x < min_x:
        return 0, 0, 1, 1
    x0 = max(0, min_x - padding)
    y0 = max(0, min_y - padding)
    x1 = min(image.width, max_x + padding + 1)
    y1 = min(image.height, max_y + padding + 1)
    return x0, y0, x1, y1


def crop(image: Raster, box: tuple[int, int, int, int]) -> Raster:
    x0, y0, x1, y1 = box
    output = Raster.empty(x1 - x0, y1 - y0)
    for y in range(output.height):
        source_start = ((y0 + y) * image.width + x0) * 4
        target_start = y * output.width * 4
        output.pixels[target_start : target_start + output.width * 4] = image.pixels[source_start : source_start + output.width * 4]
    return output


def paste(destination: Raster, source: Raster, x: int, y: int, blend: bool = True) -> None:
    for source_y in range(source.height):
        target_y = y + source_y
        if target_y < 0 or target_y >= destination.height:
            continue
        for source_x in range(source.width):
            target_x = x + source_x
            if target_x < 0 or target_x >= destination.width:
                continue
            source_index = (source_y * source.width + source_x) * 4
            target_index = (target_y * destination.width + target_x) * 4
            source_alpha = source.pixels[source_index + 3]
            if source_alpha == 0:
                continue
            if not blend or source_alpha == 255:
                destination.pixels[target_index : target_index + 4] = source.pixels[source_index : source_index + 4]
                continue
            target_alpha = destination.pixels[target_index + 3]
            out_alpha = source_alpha + ((target_alpha * (255 - source_alpha)) // 255)
            if out_alpha == 0:
                continue
            for channel in range(3):
                source_value = source.pixels[source_index + channel]
                target_value = destination.pixels[target_index + channel]
                destination.pixels[target_index + channel] = min(
                    255,
                    (
                        source_value * source_alpha
                        + target_value * target_alpha * (255 - source_alpha) // 255
                    )
                    // out_alpha,
                )
            destination.pixels[target_index + 3] = out_alpha


def point_in_polygon(x: int, y: int, polygon: list[tuple[int, int]]) -> bool:
    inside = False
    previous_x, previous_y = polygon[-1]
    for current_x, current_y in polygon:
        if (current_y > y) != (previous_y > y):
            crossing = (previous_x - current_x) * (y - current_y) / (previous_y - current_y) + current_x
            if x < crossing:
                inside = not inside
        previous_x, previous_y = current_x, current_y
    return inside


def split_armor(source: Raster) -> dict[str, Raster]:
    names = ("head", "rightArmShoulder", "leftArmShoulderSword", "waist")
    groups = {name: Raster.empty(source.width, source.height) for name in names}
    source_mask = alpha_mask(source)
    components = connected_components(source_mask, source.width, source.height)
    forced_waist = set(components[1]) if len(components) > 1 else set()
    forced_right = set(components[2]) if len(components) > 2 else set()
    head_polygon = [(135, 35), (365, 35), (380, 115), (350, 255), (320, 305), (170, 305), (125, 215)]
    right_polygon = [(350, 65), (620, 65), (625, 345), (515, 405), (405, 375), (350, 285), (330, 220)]
    waist_knot_polygon = [(185, 265), (345, 265), (355, 365), (315, 400), (205, 395), (175, 330)]
    labels: list[str | None] = [None] * (source.width * source.height)

    for y in range(source.height):
        for x in range(source.width):
            pixel_index = y * source.width + x
            if not source_mask[pixel_index]:
                continue
            if pixel_index in forced_waist:
                labels[pixel_index] = "waist"
            elif pixel_index in forced_right:
                labels[pixel_index] = "rightArmShoulder"
            elif point_in_polygon(x, y, head_polygon):
                labels[pixel_index] = "head"
            elif point_in_polygon(x, y, right_polygon):
                labels[pixel_index] = "rightArmShoulder"
            elif point_in_polygon(x, y, waist_knot_polygon):
                labels[pixel_index] = "waist"
            else:
                labels[pixel_index] = "leftArmShoulderSword"

    # A two-pixel overlap at articulated seams prevents transparent cracks when
    # adjacent parts rotate by a few degrees around their recorded pivots.
    seam_overlap = 2
    for y in range(source.height):
        for x in range(source.width):
            pixel_index = y * source.width + x
            name = labels[pixel_index]
            if name is None:
                continue
            for delta_y in range(-seam_overlap, seam_overlap + 1):
                for delta_x in range(-seam_overlap, seam_overlap + 1):
                    if abs(delta_x) + abs(delta_y) > seam_overlap:
                        continue
                    neighbor_x, neighbor_y = x + delta_x, y + delta_y
                    if neighbor_x < 0 or neighbor_x >= source.width or neighbor_y < 0 or neighbor_y >= source.height:
                        continue
                    neighbor_index = neighbor_y * source.width + neighbor_x
                    if not source_mask[neighbor_index]:
                        continue
                    source_index = neighbor_index * 4
                    groups[name].pixels[source_index : source_index + 4] = source.pixels[source_index : source_index + 4]
    # Semantic groups can pick up tiny detached anti-alias fragments near a
    # polygon boundary. Keep only the expected substantial components.
    return {
        "head": keep_largest_components(groups["head"], 1),
        "rightArmShoulder": keep_largest_components(groups["rightArmShoulder"], 2),
        "leftArmShoulderSword": keep_largest_components(groups["leftArmShoulderSword"], 1),
        "waist": keep_largest_components(groups["waist"], 2),
    }


def draw_rectangle(image: Raster, box: tuple[int, int, int, int], color: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    for x in range(x0, x1):
        for y in (y0, y1 - 1):
            if 0 <= x < image.width and 0 <= y < image.height:
                index = (y * image.width + x) * 4
                image.pixels[index : index + 4] = bytes(color)
    for y in range(y0, y1):
        for x in (x0, x1 - 1):
            if 0 <= x < image.width and 0 <= y < image.height:
                index = (y * image.width + x) * 4
                image.pixels[index : index + 4] = bytes(color)


def draw_cross(image: Raster, x: int, y: int, color: tuple[int, int, int, int], radius: int = 6) -> None:
    for delta in range(-radius, radius + 1):
        for target_x, target_y in ((x + delta, y), (x, y + delta)):
            if 0 <= target_x < image.width and 0 <= target_y < image.height:
                index = (target_y * image.width + target_x) * 4
                image.pixels[index : index + 4] = bytes(color)


def shift_and_grade(source: Raster, x_shift: int, y_shift: int, brightness: float, alpha_scale: float = 1.0) -> Raster:
    output = Raster.empty(source.width, source.height)
    for y in range(source.height):
        row_wave = round(math.sin((y / 42.0) + x_shift) * abs(x_shift)) if x_shift else 0
        for x in range(source.width):
            source_index = (y * source.width + x) * 4
            alpha = source.pixels[source_index + 3]
            if alpha == 0:
                continue
            target_x = x + x_shift + row_wave
            target_y = y + y_shift
            if target_x < 0 or target_x >= source.width or target_y < 0 or target_y >= source.height:
                continue
            target_index = (target_y * source.width + target_x) * 4
            for channel in range(3):
                value = source.pixels[source_index + channel]
                if channel == 0:
                    value = min(255, round(value * brightness))
                elif channel == 2:
                    value = min(255, round(value * (1 + (brightness - 1) * 0.55)))
                output.pixels[target_index + channel] = value
            output.pixels[target_index + 3] = min(255, round(alpha * alpha_scale))
    return output


def animate_aura(source: Raster, components: list[list[int]], frame_index: int, frame_count: int) -> Raster:
    output = Raster.empty(source.width, source.height)
    angle = (math.tau * frame_index) / frame_count
    for component_index, component in enumerate(components):
        phase = angle + component_index * 1.137
        x_shift = round(math.sin(phase) * (1 + component_index % 3))
        y_shift = round(math.cos(phase) * 2 - 1)
        brightness = 0.92 + 0.10 * (0.5 + 0.5 * math.sin(phase + 0.6))
        alpha_scale = 0.82 + 0.18 * (0.5 + 0.5 * math.cos(phase))
        for pixel_index in component:
            y, x = divmod(pixel_index, source.width)
            target_x, target_y = x + x_shift, y + y_shift
            if target_x < 0 or target_x >= source.width or target_y < 0 or target_y >= source.height:
                continue
            source_index = pixel_index * 4
            target_index = (target_y * source.width + target_x) * 4
            for channel in range(3):
                output.pixels[target_index + channel] = min(255, round(source.pixels[source_index + channel] * brightness))
            output.pixels[target_index + 3] = min(255, round(source.pixels[source_index + 3] * alpha_scale))
    return output


def common_box(frames: list[Raster], padding: int = 2) -> tuple[int, int, int, int]:
    boxes = [bounding_box(frame) for frame in frames]
    x0 = max(0, min(box[0] for box in boxes) - padding)
    y0 = max(0, min(box[1] for box in boxes) - padding)
    x1 = min(frames[0].width, max(box[2] for box in boxes) + padding)
    y1 = min(frames[0].height, max(box[3] for box in boxes) + padding)
    return x0, y0, x1, y1


def make_sheet(frames: list[Raster], columns: int, box: tuple[int, int, int, int]) -> tuple[Raster, list[dict[str, int]]]:
    cell_width = box[2] - box[0]
    cell_height = box[3] - box[1]
    rows = math.ceil(len(frames) / columns)
    sheet = Raster.empty(cell_width * columns, cell_height * rows)
    frame_records = []
    for index, frame in enumerate(frames):
        column = index % columns
        row = index // columns
        paste(sheet, crop(frame, box), column * cell_width, row * cell_height, blend=False)
        frame_records.append({
            "index": index,
            "x": column * cell_width,
            "y": row * cell_height,
            "width": cell_width,
            "height": cell_height,
        })
    return sheet, frame_records


def write_cropped_layer(output_dir: Path, filename: str, image: Raster, pivot: tuple[int, int] | None, z_index: int) -> dict:
    box = bounding_box(image, 2)
    cropped = crop(image, box)
    write_png(output_dir / "layers" / filename, cropped)
    record = {
        "path": f"layers/{filename}",
        "zIndex": z_index,
        "offset": {"x": box[0], "y": box[1]},
        "size": {"width": cropped.width, "height": cropped.height},
        "placement": {"originX": 0, "originY": 0, "x": box[0], "y": box[1]},
    }
    if pivot is not None:
        local_x = pivot[0] - box[0]
        local_y = pivot[1] - box[1]
        record["pivot"] = {
            "masterX": pivot[0],
            "masterY": pivot[1],
            "localX": local_x,
            "localY": local_y,
            "originX": round(local_x / cropped.width, 6),
            "originY": round(local_y / cropped.height, 6),
            "positionX": pivot[0],
            "positionY": pivot[1],
        }
    return record


def build(armor_path: Path, spirit_path: Path, output_dir: Path) -> None:
    armor = read_png(armor_path)
    spirit = read_png(spirit_path)
    if (armor.width, armor.height) != (spirit.width, spirit.height):
        raise ValueError("Armor and spirit master canvases must match")

    output_dir.mkdir(parents=True, exist_ok=True)
    source_dir = output_dir / "source"
    source_dir.mkdir(parents=True, exist_ok=True)
    write_png(source_dir / "boss_armor_master_640x725.png", armor)
    write_png(source_dir / "boss_spirit_master_640x725.png", spirit)

    spirit_components = connected_components(alpha_mask(spirit), spirit.width, spirit.height)
    body_indices = spirit_components[0]
    aura_components = spirit_components[1:]
    body_base = raster_from_indices(spirit, body_indices)
    aura_base = raster_from_indices(spirit, [index for component in aura_components for index in component])

    body_frames = [
        shift_and_grade(body_base, 0, 0, 0.98),
        shift_and_grade(body_base, 1, -1, 1.06),
        shift_and_grade(body_base, -1, 0, 1.00),
    ]
    aura_frames = [animate_aura(spirit, aura_components, index, 4) for index in range(4)]
    body_box = common_box(body_frames, 3)
    aura_box = common_box(aura_frames, 3)

    write_png(output_dir / "layers" / "spirit_body.png", crop(body_base, body_box))
    write_png(output_dir / "layers" / "spirit_aura.png", crop(aura_base, aura_box))
    body_sheet, body_frame_records = make_sheet(body_frames, 3, body_box)
    aura_sheet, aura_frame_records = make_sheet(aura_frames, 2, aura_box)
    write_png(output_dir / "sprites" / "spirit_body_sheet.png", body_sheet)
    write_png(output_dir / "sprites" / "spirit_aura_sheet.png", aura_sheet)

    armor_groups = split_armor(armor)
    layer_records = {
        "spiritAura": {
            "path": "layers/spirit_aura.png",
            "zIndex": 0,
            "offset": {"x": aura_box[0], "y": aura_box[1]},
            "size": {"width": aura_box[2] - aura_box[0], "height": aura_box[3] - aura_box[1]},
            "placement": {"originX": 0, "originY": 0, "x": aura_box[0], "y": aura_box[1]},
        },
        "spiritBody": {
            "path": "layers/spirit_body.png",
            "zIndex": 10,
            "offset": {"x": body_box[0], "y": body_box[1]},
            "size": {"width": body_box[2] - body_box[0], "height": body_box[3] - body_box[1]},
            "placement": {"originX": 0, "originY": 0, "x": body_box[0], "y": body_box[1]},
        },
        "armorWaist": write_cropped_layer(output_dir, "armor_waist.png", armor_groups["waist"], (392, 390), 20),
        "armorHead": write_cropped_layer(output_dir, "armor_head.png", armor_groups["head"], (286, 285), 30),
        "armorRightArmShoulder": write_cropped_layer(output_dir, "armor_right_arm_shoulder.png", armor_groups["rightArmShoulder"], (377, 220), 40),
        "armorLeftArmShoulderSword": write_cropped_layer(output_dir, "armor_left_arm_shoulder_sword.png", armor_groups["leftArmShoulderSword"], (210, 345), 50),
    }

    composite = Raster.empty(armor.width, armor.height)
    paste(composite, aura_base, 0, 0)
    paste(composite, body_base, 0, 0)
    for key in ("waist", "head", "rightArmShoulder", "leftArmShoulderSword"):
        paste(composite, armor_groups[key], 0, 0)
    write_png(output_dir / "preview" / "boss_layer_composite.png", composite)

    debug = composite.copy()
    debug_specs = {
        "armorWaist": (armor_groups["waist"], (392, 390), (90, 235, 255, 255)),
        "armorHead": (armor_groups["head"], (286, 285), (255, 221, 80, 255)),
        "armorRightArmShoulder": (armor_groups["rightArmShoulder"], (377, 220), (120, 255, 150, 255)),
        "armorLeftArmShoulderSword": (armor_groups["leftArmShoulderSword"], (210, 345), (255, 100, 135, 255)),
    }
    for image, pivot, color in debug_specs.values():
        draw_rectangle(debug, bounding_box(image), color)
        draw_cross(debug, pivot[0], pivot[1], color)
    write_png(output_dir / "preview" / "boss_layout_debug.png", debug)

    manifest = {
        "version": 1,
        "status": "integrated-phaser",
        "masterCanvas": {"width": armor.width, "height": armor.height, "coordinateOrigin": "top-left"},
        "placementRule": "Place cropped assets at placement.x/y with origin 0,0. For rotating armor, use pivot.origin and pivot.position instead.",
        "layerOrderBackToFront": [
            "spiritAura",
            "spiritBody",
            "armorWaist",
            "armorHead",
            "armorRightArmShoulder",
            "armorLeftArmShoulderSword",
        ],
        "layers": layer_records,
        "animations": {
            "spiritBody": {
                "path": "sprites/spirit_body_sheet.png",
                "columns": 3,
                "rows": 1,
                "offset": {"x": body_box[0], "y": body_box[1]},
                "durationMsPerFrame": 220,
                "loopSequence": [0, 1, 2, 1],
                "frames": body_frame_records,
            },
            "spiritAura": {
                "path": "sprites/spirit_aura_sheet.png",
                "columns": 2,
                "rows": 2,
                "offset": {"x": aura_box[0], "y": aura_box[1]},
                "durationMsPerFrame": 120,
                "loopSequence": [0, 1, 2, 3],
                "frames": aura_frame_records,
            },
        },
        "recommendedRuntime": {
            "containerOrigin": {"x": 0, "y": 0},
            "masterScale": 1,
            "filter": "nearest",
            "auraBlendMode": "ADD",
            "auraAlpha": 0.78,
            "note": "Loaded by BootScene and assembled by BossVisualController.",
        },
        "debugPreview": {
            "path": "preview/boss_layout_debug.png",
            "colors": {
                "armorWaist": "#5aebff",
                "armorHead": "#ffdd50",
                "armorRightArmShoulder": "#78ff96",
                "armorLeftArmShoulderSword": "#ff6487"
            }
        },
    }
    (output_dir / "boss-layout.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--armor", type=Path, required=True)
    parser.add_argument("--spirit", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(args.armor, args.spirit, args.output)


if __name__ == "__main__":
    main()
