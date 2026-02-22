"""
SSIM Comparator — Module A / Hashing
Computes Structural Similarity Index Measure (SSIM) and
Mean Squared Error (MSE) between X-ray images.

SSIM ranges from -1 to 1:
  1.0  = identical images
  0.85 = threshold (configurable)
  < threshold = suspicious / tampered

Also provides:
  - Localized SSIM heat map (highlights tampered regions)
  - MSE-based scoring
  - Feature map comparison
"""

import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim
from skimage.metrics import mean_squared_error
from dataclasses import dataclass
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


@dataclass
class SSIMResult:
    """Full SSIM comparison result with score and heatmap."""
    ssim_score: float                   # Global SSIM score [-1, 1]
    mse_score: float                    # Mean squared error
    diff_map: np.ndarray                # Pixel-wise difference map
    ssim_map: Optional[np.ndarray]      # Per-pixel SSIM magnitude map
    tampered_regions: list              # Bounding boxes of suspicious regions
    is_suspicious: bool
    threshold_used: float

    def to_dict(self) -> dict:
        return {
            "ssim_score": round(self.ssim_score, 6),
            "mse_score": round(self.mse_score, 6),
            "tampered_regions": self.tampered_regions,
            "is_suspicious": self.is_suspicious,
            "threshold_used": self.threshold_used,
        }


class SSIMComparator:
    """
    Structural Similarity-based comparator for X-ray integrity checking.
    Produces both numeric scores and visual heat maps.
    """

    def __init__(self, config):
        self.config = config
        self.threshold = config.hashing.ssim_threshold
        self.window_size = 7      # SSIM window
        self.gradient_mode = True

    def _ensure_uint8(self, image: np.ndarray) -> np.ndarray:
        """Convert float32 [0,1] to uint8 [0,255] for SSIM computation."""
        if image.dtype in (np.float32, np.float64):
            return (image * 255).clip(0, 255).astype(np.uint8)
        return image

    def compare(self, img1: np.ndarray, img2: np.ndarray) -> SSIMResult:
        """
        Compare two images and return full SSIMResult.
        Images should be same shape (H, W) or (H, W, C).
        """
        i1 = self._ensure_uint8(img1)
        i2 = self._ensure_uint8(img2)

        # Resize i2 to match i1 if needed
        if i1.shape != i2.shape:
            i2 = cv2.resize(i2, (i1.shape[1], i1.shape[0]))

        # Global SSIM and per-pixel map
        score, ssim_map = ssim(i1, i2, full=True, win_size=self.window_size)
        mse = float(mean_squared_error(i1.astype(np.float32), i2.astype(np.float32)))

        # Difference image
        diff = cv2.absdiff(i1, i2)

        # Tampered region detection via thresholding the diff map
        tampered_regions = self._detect_tampered_regions(diff)

        return SSIMResult(
            ssim_score=float(score),
            mse_score=mse,
            diff_map=diff,
            ssim_map=ssim_map,
            tampered_regions=tampered_regions,
            is_suspicious=float(score) < self.threshold,
            threshold_used=self.threshold,
        )

    def _detect_tampered_regions(self, diff_map: np.ndarray) -> list:
        """Find contiguous tampered regions using contour detection."""
        _, thresh = cv2.threshold(diff_map, 25, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        regions = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area > 50:  # ignore tiny noise
                x, y, w, h = cv2.boundingRect(cnt)
                regions.append({
                    "x": int(x), "y": int(y),
                    "width": int(w), "height": int(h),
                    "area": float(area),
                })
        return regions

    def get_ssim_heatmap(self, img1: np.ndarray, img2: np.ndarray) -> np.ndarray:
        """Generate a colored heatmap of SSIM differences for visualization."""
        result = self.compare(img1, img2)
        ssim_map_uint8 = (result.ssim_map * 255).astype(np.uint8)
        heatmap = cv2.applyColorMap(cv2.bitwise_not(ssim_map_uint8), cv2.COLORMAP_JET)
        return heatmap

    def score_batch(self, ref_image: np.ndarray, candidate_images: list) -> list:
        """Compare a reference image against multiple candidates."""
        return [self.compare(ref_image, cand) for cand in candidate_images]
