"""
Vision Module Configuration — Module A
Loads and validates all configuration values from environment or YAML.
"""

import os
import yaml
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


@dataclass
class IPFSConfig:
    host: str = "127.0.0.1"
    port: int = 5001
    gateway: str = "http://127.0.0.1:8080"
    timeout: int = 30


@dataclass
class HashingConfig:
    algorithms: list = field(default_factory=lambda: ["phash", "dhash", "ahash", "whash"])
    phash_threshold: int = 10         # Hamming distance threshold for phash (0=identical, 64=max diff)
    dhash_threshold: int = 10
    ssim_threshold: float = 0.85      # SSIM score below this = suspicious
    hash_size: int = 16               # Hash size for perceptual hashes
    enable_wavelet: bool = True


@dataclass
class PreprocessingConfig:
    target_size: tuple = (512, 512)
    normalize: bool = True
    denoise: bool = True
    denoise_method: str = "gaussian"  # gaussian | bilateral | nlmeans
    enhance_contrast: bool = True
    clahe_clip_limit: float = 2.0
    clahe_tile_grid: tuple = (8, 8)
    convert_grayscale: bool = True


@dataclass
class TamperingConfig:
    scenarios: list = field(default_factory=lambda: [
        "pixel_substitution",
        "region_blackout",
        "object_removal",
        "noise_injection",
        "rotation_shift",
        "content_swap",
        "brightness_attack",
    ])
    tampering_percentage: float = 0.05   # % of image to tamper
    num_samples_per_scenario: int = 50


@dataclass
class VisionConfig:
    # Server
    host: str = "0.0.0.0"
    port: int = 8001
    reload: bool = True
    log_level: str = "INFO"

    # Paths
    dataset_path: str = "./datasets/raw"
    processed_path: str = "./datasets/processed"
    output_path: str = "./output"
    models_path: str = "./models"

    # Sub-configs
    hashing: HashingConfig = field(default_factory=HashingConfig)
    preprocessing: PreprocessingConfig = field(default_factory=PreprocessingConfig)
    tampering: TamperingConfig = field(default_factory=TamperingConfig)
    ipfs: IPFSConfig = field(default_factory=IPFSConfig)

    # GPU
    enable_gpu: bool = False

    @classmethod
    def from_env(cls) -> "VisionConfig":
        """Load config from environment variables."""
        return cls(
            host=os.getenv("VISION_HOST", "0.0.0.0"),
            port=int(os.getenv("VISION_PORT", 8001)),
            dataset_path=os.getenv("DATASET_PATH", "./datasets/raw"),
            processed_path=os.getenv("PROCESSED_PATH", "./datasets/processed"),
            enable_gpu=os.getenv("ENABLE_GPU", "false").lower() == "true",
            hashing=HashingConfig(
                phash_threshold=int(os.getenv("PHASH_THRESHOLD", 10)),
                ssim_threshold=float(os.getenv("SSIM_THRESHOLD", 0.85)),
            ),
        )

    @classmethod
    def from_yaml(cls, path: str) -> "VisionConfig":
        """Load config from YAML file, with env variable overrides."""
        config_path = Path(path)
        if not config_path.exists():
            return cls.from_env()
        with open(config_path, "r") as f:
            raw = yaml.safe_load(f)
        # TODO: Deep-merge raw dict into dataclass
        return cls.from_env()

    def to_dict(self) -> dict:
        return {
            "host": self.host,
            "port": self.port,
            "dataset_path": self.dataset_path,
            "hashing": {
                "phash_threshold": self.hashing.phash_threshold,
                "ssim_threshold": self.hashing.ssim_threshold,
            },
        }
