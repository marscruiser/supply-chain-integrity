"""
Tampering Simulator — Module A / Tampering
Generates synthetic tampered X-ray images for training and testing purposes.

Implemented Scenarios:
  1. pixel_substitution  — Replace regions with random noise
  2. region_blackout     — Fill rectangular regions with black
  3. object_removal      — Remove high-density regions (simulate cargo removal)
  4. noise_injection     — Add Gaussian/salt-and-pepper noise
  5. rotation_shift      — Rotate or shift image region
  6. content_swap        — Swap two regions within the image
  7. brightness_attack   — Localized brightness manipulation
  8. edge_smoothing      — Smooth edges to hide tampering artifacts
"""

import cv2
import numpy as np
from pathlib import Path
from dataclasses import dataclass
from typing import Optional, List, Tuple
import logging
import json
import uuid

logger = logging.getLogger(__name__)


@dataclass
class TamperingRecord:
    """Metadata about a simulated tampering event."""
    record_id: str
    original_path: str
    tampered_path: str
    scenario: str
    tampered_region: Optional[dict]   # x, y, w, h
    tamper_percentage: float
    expected_hash_diff: int = 0

    def to_dict(self) -> dict:
        return {
            "record_id": self.record_id,
            "original_path": self.original_path,
            "tampered_path": self.tampered_path,
            "scenario": self.scenario,
            "tampered_region": self.tampered_region,
            "tamper_percentage": self.tamper_percentage,
        }


class TamperingSimulator:
    """
    Engine for producing synthetic tampered X-ray images.
    Outputs a dataset of original/tampered pairs for accuracy evaluation.
    """

    SCENARIOS = [
        "pixel_substitution",
        "region_blackout",
        "object_removal",
        "noise_injection",
        "rotation_shift",
        "content_swap",
        "brightness_attack",
        "edge_smoothing",
    ]

    def __init__(self, config):
        self.config = config
        self.t_config = config.tampering

    def _random_region(self, image: np.ndarray, pct: float = 0.05) -> Tuple[int, int, int, int]:
        """Choose a random rectangular region covering ~pct% of image area."""
        h, w = image.shape[:2]
        area = h * w
        region_area = int(area * pct)
        rw = int(np.sqrt(region_area) * (0.5 + np.random.random()))
        rh = int(region_area / (rw + 1))
        rw, rh = min(rw, w - 1), min(rh, h - 1)
        x = np.random.randint(0, max(1, w - rw))
        y = np.random.randint(0, max(1, h - rh))
        return x, y, rw, rh

    def pixel_substitution(self, image: np.ndarray) -> Tuple[np.ndarray, dict]:
        """Replace a region with random pixel noise."""
        tampered = image.copy()
        x, y, w, h = self._random_region(image, self.t_config.tampering_percentage)
        noise = np.random.randint(0, 256, (h, w), dtype=np.uint8)
        tampered[y:y+h, x:x+w] = noise
        return tampered, {"x": x, "y": y, "width": w, "height": h}

    def region_blackout(self, image: np.ndarray) -> Tuple[np.ndarray, dict]:
        """Fill a region with black pixels (zero intensity)."""
        tampered = image.copy()
        x, y, w, h = self._random_region(image, self.t_config.tampering_percentage)
        tampered[y:y+h, x:x+w] = 0
        return tampered, {"x": x, "y": y, "width": w, "height": h}

    def object_removal(self, image: np.ndarray) -> Tuple[np.ndarray, dict]:
        """Remove the highest-density region (simulate cargo removal)."""
        tampered = image.copy()
        # Find brightest region (high X-ray density = bright in X-ray)
        _, thresh = cv2.threshold(image, int(image.mean() + image.std()), 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            largest = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(largest)
            tampered[y:y+h, x:x+w] = int(image.mean())
            return tampered, {"x": x, "y": y, "width": w, "height": h}
        return self.region_blackout(image)

    def noise_injection(self, image: np.ndarray) -> Tuple[np.ndarray, dict]:
        """Add Gaussian noise to the entire image."""
        tampered = image.astype(np.float32)
        noise = np.random.normal(0, 15, image.shape).astype(np.float32)
        tampered = np.clip(tampered + noise, 0, 255).astype(np.uint8)
        return tampered, None

    def rotation_shift(self, image: np.ndarray) -> Tuple[np.ndarray, dict]:
        """Apply a small rotation to a region."""
        tampered = image.copy()
        x, y, w, h = self._random_region(image, self.t_config.tampering_percentage * 3)
        region = tampered[y:y+h, x:x+w]
        center = (w // 2, h // 2)
        angle = np.random.uniform(5, 25)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(region, M, (w, h))
        tampered[y:y+h, x:x+w] = rotated
        return tampered, {"x": x, "y": y, "width": w, "height": h, "angle": angle}

    def content_swap(self, image: np.ndarray) -> Tuple[np.ndarray, dict]:
        """Swap two non-overlapping regions in the image."""
        tampered = image.copy()
        h, w = image.shape[:2]
        half_w = w // 2
        x1, y1, rw, rh = self._random_region(image[:, :half_w], self.t_config.tampering_percentage)
        x2 = x1 + half_w
        y2 = np.random.randint(0, max(1, h - rh))

        rw = min(rw, w - x2)
        region1 = tampered[y1:y1+rh, x1:x1+rw].copy()
        region2 = tampered[y2:y2+rh, x2:x2+rw].copy()
        tampered[y1:y1+rh, x1:x1+rw] = region2
        tampered[y2:y2+rh, x2:x2+rw] = region1
        return tampered, {"region1": [x1, y1, rw, rh], "region2": [x2, y2, rw, rh]}

    def brightness_attack(self, image: np.ndarray) -> Tuple[np.ndarray, dict]:
        """Increase/decrease brightness in a localized region."""
        tampered = image.copy().astype(np.float32)
        x, y, w, h = self._random_region(image, self.t_config.tampering_percentage * 2)
        factor = np.random.choice([0.3, 0.5, 1.8, 2.5])
        tampered[y:y+h, x:x+w] = np.clip(tampered[y:y+h, x:x+w] * factor, 0, 255)
        return tampered.astype(np.uint8), {"x": x, "y": y, "width": w, "height": h, "factor": factor}

    def edge_smoothing(self, image: np.ndarray) -> Tuple[np.ndarray, dict]:
        """Aggressively smooth edges to hide tampering seams."""
        tampered = image.copy()
        x, y, w, h = self._random_region(image, self.t_config.tampering_percentage * 2)
        region = tampered[y:y+h, x:x+w]
        smoothed = cv2.GaussianBlur(region, (21, 21), 0)
        tampered[y:y+h, x:x+w] = smoothed
        return tampered, {"x": x, "y": y, "width": w, "height": h}

    def apply_scenario(self, image: np.ndarray, scenario: str) -> Tuple[np.ndarray, dict]:
        """Apply a named tampering scenario to an image."""
        dispatch = {
            "pixel_substitution": self.pixel_substitution,
            "region_blackout": self.region_blackout,
            "object_removal": self.object_removal,
            "noise_injection": self.noise_injection,
            "rotation_shift": self.rotation_shift,
            "content_swap": self.content_swap,
            "brightness_attack": self.brightness_attack,
            "edge_smoothing": self.edge_smoothing,
        }
        if scenario not in dispatch:
            raise ValueError(f"Unknown tampering scenario: {scenario}")
        return dispatch[scenario](image)

    def run_all_scenarios(self, output_dir: str):
        """Generate synthetic tampered dataset from all raw images."""
        import glob
        raw_dir = Path(self.config.dataset_path)
        out_dir = Path(output_dir) / "tampered"
        meta_dir = out_dir / "metadata"
        meta_dir.mkdir(parents=True, exist_ok=True)

        records = []
        image_files = list(raw_dir.glob("*.jpg")) + list(raw_dir.glob("*.png"))
        logger.info(f"Found {len(image_files)} images. Generating tampering scenarios...")

        for img_path in image_files:
            image = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
            if image is None:
                continue
            for scenario in self.t_config.scenarios:
                for i in range(self.t_config.num_samples_per_scenario):
                    try:
                        tampered, region = self.apply_scenario(image, scenario)
                        out_name = f"{img_path.stem}_{scenario}_{i:04d}.png"
                        out_path = out_dir / scenario / out_name
                        out_path.parent.mkdir(parents=True, exist_ok=True)
                        cv2.imwrite(str(out_path), tampered)
                        records.append(TamperingRecord(
                            record_id=str(uuid.uuid4()),
                            original_path=str(img_path),
                            tampered_path=str(out_path),
                            scenario=scenario,
                            tampered_region=region,
                            tamper_percentage=self.t_config.tampering_percentage,
                        ).to_dict())
                    except Exception as e:
                        logger.warning(f"Scenario {scenario} failed on {img_path}: {e}")

        with open(meta_dir / "tampering_records.json", "w") as f:
            json.dump(records, f, indent=2)
        logger.info(f"Generated {len(records)} tampered image pairs. Metadata saved.")
        return records
