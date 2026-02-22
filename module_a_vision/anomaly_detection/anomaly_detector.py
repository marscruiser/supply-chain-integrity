"""
Anomaly Detector — Module A / Anomaly Detection
Combines multiple signals to issue a final tampering verdict.

Inputs:
  - Perceptual hash distances (pHash, dHash, aHash, wHash)
  - SSIM score and tampered region bounding boxes
  - HOG feature cosine distance
  - Histogram chi-squared distance
  - Keypoint descriptor matching score (BFMatcher)
  - Point-of-interest count delta

Output:
  - AnomalyVerdict: CLEAN | SUSPICIOUS | TAMPERED
  - Confidence score [0, 1]
  - Which signals triggered
  - Severity level: LOW | MEDIUM | HIGH | CRITICAL
"""

import numpy as np
from dataclasses import dataclass, field
from typing import Optional, List, Dict
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class IntegrityStatus(str, Enum):
    CLEAN = "CLEAN"
    SUSPICIOUS = "SUSPICIOUS"
    TAMPERED = "TAMPERED"
    UNKNOWN = "UNKNOWN"


class SeverityLevel(str, Enum):
    NONE = "NONE"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class AnomalyVerdict:
    """Final tampering verdict combining all signals."""
    status: IntegrityStatus
    confidence: float                       # [0, 1]
    severity: SeverityLevel
    triggered_signals: List[str]            # Which detectors flagged
    signal_scores: Dict[str, float]        # Raw scores per signal
    tampered_regions: List[dict]           # From SSIM
    explanation: str                        # Human-readable reason

    def to_dict(self) -> dict:
        return {
            "status": self.status.value,
            "confidence": round(self.confidence, 4),
            "severity": self.severity.value,
            "triggered_signals": self.triggered_signals,
            "signal_scores": {k: round(v, 4) for k, v in self.signal_scores.items()},
            "tampered_regions": self.tampered_regions,
            "explanation": self.explanation,
        }

    @property
    def is_tampered(self) -> bool:
        return self.status in (IntegrityStatus.TAMPERED, IntegrityStatus.SUSPICIOUS)


class AnomalyDetector:
    """
    Multi-signal anomaly detector for X-ray cargo integrity.
    Uses a weighted signal fusion approach.
    """

    # Signal weights for scoring (sum = 1.0)
    SIGNAL_WEIGHTS = {
        "phash": 0.30,
        "ssim": 0.30,
        "histogram": 0.15,
        "hog": 0.10,
        "keypoint": 0.10,
        "poi_count": 0.05,
    }

    def __init__(self, config):
        self.config = config
        self.phash_threshold = config.hashing.phash_threshold
        self.ssim_threshold = config.hashing.ssim_threshold

    def _score_phash(self, hash_distance: int) -> float:
        """Normalize pHash Hamming distance to anomaly score [0,1]."""
        # 0 distance = identical (score 0), 64 max = fully different (score 1)
        return min(float(hash_distance) / 64.0, 1.0)

    def _score_ssim(self, ssim_score: float) -> float:
        """Convert SSIM score to anomaly score (inverted)."""
        return max(0.0, 1.0 - ssim_score)

    def _score_histogram(self, chi2_distance: float) -> float:
        """Normalize histogram chi-squared distance."""
        return min(chi2_distance / 100.0, 1.0)

    def _score_hog(self, cosine_distance: float) -> float:
        """HOG cosine distance (0=identical, 1=completely different)."""
        return float(np.clip(cosine_distance, 0.0, 1.0))

    def _score_keypoint(self, match_ratio: float) -> float:
        """Lower match ratio = more suspicious."""
        return 1.0 - float(np.clip(match_ratio, 0.0, 1.0))

    def _score_poi(self, poi_delta: int, expected: int) -> float:
        """Score based on difference in point-of-interest count."""
        if expected == 0:
            return 0.0
        return min(abs(poi_delta) / max(expected, 1), 1.0)

    def _determine_severity(self, confidence: float) -> SeverityLevel:
        if confidence < 0.2:
            return SeverityLevel.NONE
        elif confidence < 0.4:
            return SeverityLevel.LOW
        elif confidence < 0.6:
            return SeverityLevel.MEDIUM
        elif confidence < 0.8:
            return SeverityLevel.HIGH
        else:
            return SeverityLevel.CRITICAL

    def detect(
        self,
        hash_distance: int,
        ssim_result,
        fingerprint=None,
        reference_fingerprint=None,
        histogram_chi2: float = 0.0,
        hog_cosine: float = 0.0,
        keypoint_match_ratio: float = 1.0,
    ) -> AnomalyVerdict:
        """
        Combine all signals and produce a final AnomalyVerdict.
        """
        # Compute per-signal anomaly scores
        scores = {
            "phash": self._score_phash(hash_distance),
            "ssim": self._score_ssim(ssim_result.ssim_score if hasattr(ssim_result, 'ssim_score') else ssim_result),
            "histogram": self._score_histogram(histogram_chi2),
            "hog": self._score_hog(hog_cosine),
            "keypoint": self._score_keypoint(keypoint_match_ratio),
            "poi_count": 0.0,
        }

        if fingerprint and reference_fingerprint:
            poi_delta = fingerprint.keypoint_count - reference_fingerprint.keypoint_count
            scores["poi_count"] = self._score_poi(poi_delta, reference_fingerprint.keypoint_count)

        # Weighted fusion
        confidence = sum(scores[k] * self.SIGNAL_WEIGHTS[k] for k in scores)

        # Determine status
        triggered = [k for k, v in scores.items() if v > 0.4]

        if confidence < 0.25:
            status = IntegrityStatus.CLEAN
        elif confidence < 0.55:
            status = IntegrityStatus.SUSPICIOUS
        else:
            status = IntegrityStatus.TAMPERED

        tampered_regions = []
        if hasattr(ssim_result, 'tampered_regions'):
            tampered_regions = ssim_result.tampered_regions

        severity = self._determine_severity(confidence)

        if status == IntegrityStatus.CLEAN:
            explanation = "All signals within normal range. Cargo contents match reference scan."
        elif status == IntegrityStatus.SUSPICIOUS:
            explanation = f"Moderate anomalies detected in signals: {', '.join(triggered)}. Manual review recommended."
        else:
            explanation = f"High-confidence tampering detected! Triggered signals: {', '.join(triggered)}. {len(tampered_regions)} tampered regions identified."

        return AnomalyVerdict(
            status=status,
            confidence=round(confidence, 4),
            severity=severity,
            triggered_signals=triggered,
            signal_scores=scores,
            tampered_regions=tampered_regions,
            explanation=explanation,
        )
