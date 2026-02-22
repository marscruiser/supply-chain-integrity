"""
Fingerprint Engine — Module A / Fingerprinting
Generates a rich multi-dimensional fingerprint of X-ray cargo contents.

A Fingerprint combines:
  1. Perceptual hashes (pHash, dHash, aHash, wHash)
  2. HOG (Histogram of Oriented Gradients) feature vector
  3. SIFT/ORB keypoints and descriptors
  4. Pixel histogram features
  5. Morphological shape descriptors
  6. Metadata (timestamp, shipment ID, operator ID)

The fingerprint is serializable to JSON for blockchain storage
and IPFS upload.
"""

import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import json
import uuid
import logging

from hashing.perceptual_hasher import PerceptualHasher, PerceptualHashResult
from hashing.hash_utils import sha256_of_image

logger = logging.getLogger(__name__)


@dataclass
class CargoPOI:
    """A Point of Interest within the X-ray image (object or anomaly region)."""
    poi_id: str
    x: int
    y: int
    width: int
    height: int
    area: float
    centroid: tuple
    label: str = "unknown"       # E.g., "dense_region", "void", "metal"
    confidence: float = 0.0

    def to_dict(self) -> dict:
        return {
            "poi_id": self.poi_id,
            "x": self.x, "y": self.y,
            "width": self.width, "height": self.height,
            "area": self.area,
            "centroid": list(self.centroid),
            "label": self.label,
            "confidence": self.confidence,
        }


@dataclass
class CargoFingerprint:
    """
    Complete perceptual fingerprint of X-ray cargo scan.
    This is the core data structure stored on IPFS and referenced on blockchain.
    """
    fingerprint_id: str                     # UUID
    shipment_id: Optional[str]             # Linked shipment
    timestamp: str                          # ISO 8601 UTC
    image_sha256: str                       # Cryptographic hash of raw image
    perceptual_hashes: PerceptualHashResult
    hog_features: List[float]              # HOG descriptor vector
    histogram_features: List[float]        # Pixel intensity histogram (256 bins)
    keypoint_count: int                    # Number of SIFT/ORB keypoints
    keypoint_descriptors_sha: str         # SHA256 of raw descriptors
    points_of_interest: List[CargoPOI]   # Detected regions/objects
    morphological_features: Dict[str, float]  # Shape metrics
    image_stats: Dict[str, float]          # Mean, std, entropy
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "fingerprint_id": self.fingerprint_id,
            "shipment_id": self.shipment_id,
            "timestamp": self.timestamp,
            "image_sha256": self.image_sha256,
            "perceptual_hashes": self.perceptual_hashes.to_dict(),
            "hog_features_length": len(self.hog_features),
            "hog_features_sha256": sha256_of_array(self.hog_features),
            "histogram_features": self.histogram_features,
            "keypoint_count": self.keypoint_count,
            "keypoint_descriptors_sha": self.keypoint_descriptors_sha,
            "points_of_interest": [poi.to_dict() for poi in self.points_of_interest],
            "morphological_features": self.morphological_features,
            "image_stats": self.image_stats,
            "metadata": self.metadata,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)

    @classmethod
    def from_dict(cls, d: dict) -> "CargoFingerprint":
        """Partial reconstruction from dict (used for verification)."""
        from hashing.perceptual_hasher import PerceptualHashResult
        return cls(
            fingerprint_id=d["fingerprint_id"],
            shipment_id=d.get("shipment_id"),
            timestamp=d["timestamp"],
            image_sha256=d["image_sha256"],
            perceptual_hashes=PerceptualHashResult.from_dict(d["perceptual_hashes"]),
            hog_features=[],          # Reconstructed separately if needed
            histogram_features=d.get("histogram_features", []),
            keypoint_count=d["keypoint_count"],
            keypoint_descriptors_sha=d["keypoint_descriptors_sha"],
            points_of_interest=[],
            morphological_features=d.get("morphological_features", {}),
            image_stats=d.get("image_stats", {}),
            metadata=d.get("metadata", {}),
        )


def sha256_of_array(arr) -> str:
    """SHA256 of a Python list or numpy array."""
    import hashlib
    return hashlib.sha256(np.array(arr, dtype=np.float32).tobytes()).hexdigest()


class FingerprintEngine:
    """
    Core engine for generating CargoFingerprint from preprocessed X-ray images.
    """

    def __init__(self, config):
        self.config = config
        self.hasher = PerceptualHasher(config)
        self.orb = cv2.ORB_create(nfeatures=500)
        self.sift = cv2.SIFT_create(nfeatures=500) if hasattr(cv2, 'SIFT_create') else None

    def compute_hog_features(self, image: np.ndarray) -> List[float]:
        """Compute HOG (Histogram of Oriented Gradients) feature vector."""
        img_uint8 = (image * 255).astype(np.uint8) if image.dtype == np.float32 else image
        hog = cv2.HOGDescriptor(
            _winSize=(64, 64), _blockSize=(16, 16),
            _blockStride=(8, 8), _cellSize=(8, 8), _nbins=9
        )
        features = hog.compute(cv2.resize(img_uint8, (64, 64)))
        return features.flatten().tolist()

    def compute_histogram_features(self, image: np.ndarray) -> List[float]:
        """Compute normalized pixel intensity histogram (256 bins)."""
        img_uint8 = (image * 255).astype(np.uint8) if image.dtype == np.float32 else image
        hist = cv2.calcHist([img_uint8], [0], None, [256], [0, 256])
        cv2.normalize(hist, hist)
        return hist.flatten().tolist()

    def compute_keypoints(self, image: np.ndarray):
        """Detect ORB keypoints and compute descriptors."""
        img_uint8 = (image * 255).astype(np.uint8) if image.dtype == np.float32 else image
        kps, descriptors = self.orb.detectAndCompute(img_uint8, None)
        return kps, descriptors

    def compute_image_stats(self, image: np.ndarray) -> Dict[str, float]:
        """Compute basic statistical features."""
        from scipy.stats import entropy
        flat = image.flatten()
        hist, _ = np.histogram(flat, bins=256, density=True)
        return {
            "mean": float(np.mean(image)),
            "std": float(np.std(image)),
            "min": float(np.min(image)),
            "max": float(np.max(image)),
            "entropy": float(entropy(hist + 1e-12)),
            "skewness": float(np.mean(((image - image.mean()) / (image.std() + 1e-8)) ** 3)),
        }

    def compute_morphological_features(self, image: np.ndarray) -> Dict[str, float]:
        """Compute morphological shape descriptors from thresholded image."""
        img_uint8 = (image * 255).astype(np.uint8) if image.dtype == np.float32 else image
        _, thresh = cv2.threshold(img_uint8, 50, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        areas = [cv2.contourArea(c) for c in contours if cv2.contourArea(c) > 20]
        return {
            "num_objects": float(len(areas)),
            "total_area": float(sum(areas)),
            "mean_area": float(np.mean(areas)) if areas else 0.0,
            "max_area": float(max(areas)) if areas else 0.0,
            "area_std": float(np.std(areas)) if areas else 0.0,
        }

    def detect_pois(self, image: np.ndarray) -> List[CargoPOI]:
        """Detect points of interest (dense regions, voids) in X-ray."""
        img_uint8 = (image * 255).astype(np.uint8) if image.dtype == np.float32 else image
        _, thresh = cv2.threshold(img_uint8, 80, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        pois = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < 100:
                continue
            x, y, w, h = cv2.boundingRect(cnt)
            M = cv2.moments(cnt)
            cx = M["m10"] / (M["m00"] + 1e-8)
            cy = M["m01"] / (M["m00"] + 1e-8)
            pois.append(CargoPOI(
                poi_id=str(uuid.uuid4())[:8],
                x=int(x), y=int(y), width=int(w), height=int(h),
                area=float(area), centroid=(round(cx, 2), round(cy, 2)),
                label="dense_region",
            ))
        return pois

    def generate(self, preprocessed_image, shipment_id: str = None) -> CargoFingerprint:
        """
        Full fingerprint generation from a PreprocessedImage.
        Returns a CargoFingerprint ready for IPFS upload.
        """
        image = preprocessed_image.image
        logger.info(f"Generating fingerprint for shipment: {shipment_id}")

        # Multi-hash
        ph_result = self.hasher.compute_hashes(image)

        # Feature extraction
        hog = self.compute_hog_features(image)
        hist = self.compute_histogram_features(image)
        kps, descs = self.compute_keypoints(image)
        stats = self.compute_image_stats(image)
        morph = self.compute_morphological_features(image)
        pois = self.detect_pois(image)

        # Descriptor hash
        import hashlib
        desc_sha = hashlib.sha256(descs.tobytes() if descs is not None else b"").hexdigest()

        # Full cryptographic hash of raw image
        img_sha = sha256_of_image(image)

        return CargoFingerprint(
            fingerprint_id=str(uuid.uuid4()),
            shipment_id=shipment_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            image_sha256=img_sha,
            perceptual_hashes=ph_result,
            hog_features=hog,
            histogram_features=hist,
            keypoint_count=len(kps),
            keypoint_descriptors_sha=desc_sha,
            points_of_interest=pois,
            morphological_features=morph,
            image_stats=stats,
            metadata=preprocessed_image.to_dict() if hasattr(preprocessed_image, 'to_dict') else {},
        )
