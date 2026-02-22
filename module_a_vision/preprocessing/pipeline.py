"""
Preprocessing Pipeline — Module A
Handles all X-ray image preprocessing steps before hashing/fingerprinting.

Steps:
  1. Load image (grayscale or RGB)
  2. Resize to standard dimensions
  3. Denoise (Gaussian / Bilateral / NL-Means)
  4. CLAHE contrast enhancement
  5. Normalize pixel values
  6. Return PreprocessedImage dataclass
"""

import cv2
import numpy as np
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


@dataclass
class PreprocessedImage:
    """Container for a preprocessed X-ray image and its metadata."""
    image: np.ndarray           # The processed image array
    original_path: str          # Path to the original image
    original_shape: Tuple       # Original (H, W, C)
    processed_shape: Tuple      # After resize (H, W, C)
    grayscale: bool
    normalize_range: Tuple      # (min, max) after normalization
    metadata: dict              # Additional metadata

    def to_dict(self) -> dict:
        return {
            "original_path": self.original_path,
            "original_shape": self.original_shape,
            "processed_shape": self.processed_shape,
            "grayscale": self.grayscale,
            "normalize_range": self.normalize_range,
            "metadata": self.metadata,
        }


class PreprocessingPipeline:
    """
    Full preprocessing pipeline for X-ray images.
    Used by inspection pipeline and fingerprint engine.
    """

    def __init__(self, config):
        self.config = config
        self.pp_config = config.preprocessing

    def load_image(self, path: str) -> np.ndarray:
        """Load image from disk. Handles grayscale and color."""
        img_path = Path(path)
        if not img_path.exists():
            raise FileNotFoundError(f"Image not found: {path}")

        if self.pp_config.convert_grayscale:
            image = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
        else:
            image = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        if image is None:
            raise ValueError(f"Could not load image: {path}")

        return image

    def resize(self, image: np.ndarray) -> np.ndarray:
        """Resize to target dimensions using Lanczos interpolation."""
        target = self.pp_config.target_size
        return cv2.resize(image, target, interpolation=cv2.INTER_LANCZOS4)

    def denoise(self, image: np.ndarray) -> np.ndarray:
        """Apply denoising filter based on config."""
        method = self.pp_config.denoise_method
        if method == "gaussian":
            return cv2.GaussianBlur(image, (5, 5), 0)
        elif method == "bilateral":
            return cv2.bilateralFilter(image, 9, 75, 75)
        elif method == "nlmeans":
            return cv2.fastNlMeansDenoising(image, h=10)
        else:
            logger.warning(f"Unknown denoise method: {method}. Skipping.")
            return image

    def apply_clahe(self, image: np.ndarray) -> np.ndarray:
        """Apply CLAHE contrast-limited adaptive histogram equalization."""
        clip = self.pp_config.clahe_clip_limit
        tile = self.pp_config.clahe_tile_grid
        clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=tile)
        return clahe.apply(image)

    def normalize(self, image: np.ndarray) -> Tuple[np.ndarray, Tuple]:
        """Normalize pixel values to [0, 1] float."""
        norm = image.astype(np.float32) / 255.0
        return norm, (float(norm.min()), float(norm.max()))

    def process(self, image_path: str) -> PreprocessedImage:
        """Run full preprocessing pipeline on an image file."""
        logger.info(f"Preprocessing image: {image_path}")

        raw = self.load_image(image_path)
        original_shape = raw.shape

        img = self.resize(raw)

        if self.pp_config.denoise:
            img = self.denoise(img)

        if self.pp_config.enhance_contrast:
            img = self.apply_clahe(img)

        norm_img, norm_range = self.normalize(img) if self.pp_config.normalize else (img, (0, 255))

        return PreprocessedImage(
            image=norm_img,
            original_path=image_path,
            original_shape=original_shape,
            processed_shape=norm_img.shape,
            grayscale=self.pp_config.convert_grayscale,
            normalize_range=norm_range,
            metadata={},
        )

    def process_batch(self, image_paths: list) -> list:
        """Process a batch of images."""
        results = []
        for path in image_paths:
            try:
                results.append(self.process(path))
            except Exception as e:
                logger.error(f"Failed to process {path}: {e}")
        return results
