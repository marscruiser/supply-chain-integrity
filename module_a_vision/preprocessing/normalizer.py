"""
Normalization Utilities — Module A / Preprocessing
Various normalization strategies for X-ray images.
"""

import cv2
import numpy as np
from typing import Tuple


def normalize_minmax(image: np.ndarray) -> np.ndarray:
    """Normalize image to [0, 1] float32 using min-max scaling."""
    img = image.astype(np.float32)
    return (img - img.min()) / (img.max() - img.min() + 1e-8)


def normalize_zscore(image: np.ndarray) -> np.ndarray:
    """Z-score normalization: (x - mean) / std."""
    img = image.astype(np.float32)
    return (img - img.mean()) / (img.std() + 1e-8)


def normalize_percentile(image: np.ndarray, low: float = 1.0, high: float = 99.0) -> np.ndarray:
    """Clip and normalize by percentile to reduce outlier influence."""
    low_val = np.percentile(image, low)
    high_val = np.percentile(image, high)
    img = np.clip(image, low_val, high_val).astype(np.float32)
    return (img - low_val) / (high_val - low_val + 1e-8)


def normalize_to_uint8(image: np.ndarray) -> np.ndarray:
    """Convert float [0,1] image back to uint8 [0,255]."""
    return (normalize_minmax(image) * 255).astype(np.uint8)


def equalize_histogram(image: np.ndarray) -> np.ndarray:
    """Standard global histogram equalization."""
    if image.dtype != np.uint8:
        image = normalize_to_uint8(image)
    return cv2.equalizeHist(image)


def apply_gamma_correction(image: np.ndarray, gamma: float = 1.5) -> np.ndarray:
    """Apply gamma correction for brightness adjustment."""
    inv_gamma = 1.0 / gamma
    table = np.array([(i / 255.0) ** inv_gamma * 255 for i in range(256)]).astype(np.uint8)
    return cv2.LUT(image, table)
