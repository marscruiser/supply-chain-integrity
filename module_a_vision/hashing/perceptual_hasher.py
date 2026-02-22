"""
Perceptual Hasher — Module A / Hashing
Implements multiple perceptual hashing algorithms:
  - pHash (DCT-based)
  - dHash (difference hash)
  - aHash (average hash)
  - wHash (wavelet hash)
  - cHash (color histogram hash — for non-grayscale)

Uses the `imagehash` library for hash generation and
computes Hamming distance for similarity measurement.
"""

import numpy as np
import imagehash
from PIL import Image
from dataclasses import dataclass
from typing import Optional, Dict
import logging

logger = logging.getLogger(__name__)


@dataclass
class PerceptualHashResult:
    """Container for all hash values of a single image."""
    phash: str                    # DCT perceptual hash
    dhash: str                    # Difference hash
    ahash: str                    # Average hash
    whash: Optional[str] = None  # Wavelet hash
    hash_size: int = 16

    def to_dict(self) -> dict:
        return {
            "phash": str(self.phash),
            "dhash": str(self.dhash),
            "ahash": str(self.ahash),
            "whash": str(self.whash) if self.whash else None,
            "hash_size": self.hash_size,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "PerceptualHashResult":
        return cls(
            phash=d["phash"],
            dhash=d["dhash"],
            ahash=d["ahash"],
            whash=d.get("whash"),
            hash_size=d.get("hash_size", 16),
        )


@dataclass
class HashComparisonResult:
    """Stores comparison distances between two images."""
    phash_distance: int
    dhash_distance: int
    ahash_distance: int
    whash_distance: Optional[int]
    weighted_distance: float         # Weighted average across algorithms
    is_suspicious: bool

    def to_dict(self) -> dict:
        return {
            "phash_distance": self.phash_distance,
            "dhash_distance": self.dhash_distance,
            "ahash_distance": self.ahash_distance,
            "whash_distance": self.whash_distance,
            "weighted_distance": self.weighted_distance,
            "is_suspicious": self.is_suspicious,
        }


class PerceptualHasher:
    """
    Multi-algorithm perceptual hasher.
    Creates perceptual fingerprints from numpy arrays or PIL images.
    """

    def __init__(self, config):
        self.config = config
        self.hash_size = config.hashing.hash_size
        self.phash_threshold = config.hashing.phash_threshold
        self.enable_wavelet = config.hashing.enable_wavelet

    def _to_pil(self, image: np.ndarray) -> Image.Image:
        """Convert numpy array to PIL image."""
        if image.dtype == np.float32 or image.dtype == np.float64:
            image = (image * 255).clip(0, 255).astype(np.uint8)
        return Image.fromarray(image)

    def compute_hashes(self, image: np.ndarray) -> PerceptualHashResult:
        """Compute all perceptual hashes for an image."""
        pil_img = self._to_pil(image)
        h = int(self.hash_size)

        phash = imagehash.phash(pil_img, hash_size=h)
        dhash = imagehash.dhash(pil_img, hash_size=h)
        ahash = imagehash.average_hash(pil_img, hash_size=h)
        whash = None
        if self.enable_wavelet:
            try:
                whash = imagehash.whash(pil_img, hash_size=h)
            except Exception as e:
                logger.warning(f"Wavelet hash failed: {e}")

        return PerceptualHashResult(
            phash=phash,
            dhash=dhash,
            ahash=ahash,
            whash=whash,
            hash_size=h,
        )

    def compare(self, hash1: PerceptualHashResult, hash2: PerceptualHashResult) -> HashComparisonResult:
        """Compare two PerceptualHashResult objects and return distances."""
        phash_dist = hash1.phash - hash2.phash
        dhash_dist = hash1.dhash - hash2.dhash
        ahash_dist = hash1.ahash - hash2.ahash
        whash_dist = None

        distances = [phash_dist, dhash_dist, ahash_dist]
        weights = [0.5, 0.3, 0.2]

        if hash1.whash and hash2.whash:
            whash_dist = hash1.whash - hash2.whash
            distances.append(whash_dist)
            weights = [0.4, 0.25, 0.15, 0.2]

        weighted = sum(d * w for d, w in zip(distances, weights))
        is_suspicious = phash_dist > self.phash_threshold

        return HashComparisonResult(
            phash_distance=phash_dist,
            dhash_distance=dhash_dist,
            ahash_distance=ahash_dist,
            whash_distance=whash_dist,
            weighted_distance=weighted,
            is_suspicious=is_suspicious,
        )

    def hash_from_path(self, image_path: str) -> PerceptualHashResult:
        """Compute hashes directly from an image file path."""
        pil_img = Image.open(image_path).convert("L")
        h = int(self.hash_size)
        phash = imagehash.phash(pil_img, hash_size=h)
        dhash = imagehash.dhash(pil_img, hash_size=h)
        ahash = imagehash.average_hash(pil_img, hash_size=h)
        whash = imagehash.whash(pil_img, hash_size=h) if self.enable_wavelet else None
        return PerceptualHashResult(phash=phash, dhash=dhash, ahash=ahash, whash=whash, hash_size=h)
