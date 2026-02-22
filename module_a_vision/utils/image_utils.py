"""
Image utility functions — Module A / Utils
"""

import cv2
import numpy as np
from typing import Tuple


def pad_to_square(image: np.ndarray) -> np.ndarray:
    """Pad non-square image to square with zero padding."""
    h, w = image.shape[:2]
    size = max(h, w)
    padded = np.zeros((size, size), dtype=image.dtype)
    padded[(size - h) // 2:(size - h) // 2 + h, (size - w) // 2:(size - w) // 2 + w] = image
    return padded


def overlay_heatmap(image: np.ndarray, heatmap: np.ndarray, alpha: float = 0.4) -> np.ndarray:
    """Overlay a colored heatmap on a grayscale image."""
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    return cv2.addWeighted(image, 1 - alpha, heatmap, alpha, 0)


def draw_bboxes(image: np.ndarray, regions: list, color=(0, 0, 255), thickness=2) -> np.ndarray:
    """Draw bounding boxes for tampered regions."""
    img = image.copy()
    if len(img.shape) == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    for r in regions:
        cv2.rectangle(img, (r['x'], r['y']), (r['x'] + r['width'], r['y'] + r['height']), color, thickness)
    return img


def create_comparison_grid(images: list, titles: list = None, cols: int = 3) -> np.ndarray:
    """Create a grid of images for visual comparison."""
    import math
    n = len(images)
    rows = math.ceil(n / cols)
    h, w = images[0].shape[:2]
    grid = np.zeros((rows * h, cols * w, 3), dtype=np.uint8)
    for i, img in enumerate(images):
        r, c = divmod(i, cols)
        if len(img.shape) == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        grid[r * h:(r + 1) * h, c * w:(c + 1) * w] = img
    return grid
