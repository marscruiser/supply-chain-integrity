"""
Hash Utilities — Module A / Hashing
Helper functions for hash serialization, storage, and batch operations.
"""

import json
import hashlib
from pathlib import Path
from typing import List, Optional
import numpy as np


def hamming_distance(hash1: str, hash2: str) -> int:
    """Compute Hamming distance between two hex hash strings."""
    if len(hash1) != len(hash2):
        raise ValueError("Hash lengths must match")
    return sum(c1 != c2 for c1, c2 in zip(
        bin(int(hash1, 16))[2:].zfill(len(hash1) * 4),
        bin(int(hash2, 16))[2:].zfill(len(hash2) * 4)
    ))


def sha256_of_image(image: np.ndarray) -> str:
    """Compute SHA-256 cryptographic hash of raw image data."""
    return hashlib.sha256(image.tobytes()).hexdigest()


def sha256_of_file(path: str) -> str:
    """Compute SHA-256 of the raw file bytes."""
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def serialize_hash_result(result) -> str:
    """Serialize a PerceptualHashResult to JSON string."""
    return json.dumps(result.to_dict())


def deserialize_hash_result(json_str: str):
    """Deserialize JSON string back to PerceptualHashResult dict."""
    return json.loads(json_str)


def normalize_hamming(distance: int, hash_size: int = 16) -> float:
    """Normalize Hamming distance to [0, 1] range."""
    max_distance = hash_size * hash_size
    return distance / max_distance


def batch_similarity_matrix(hashes: list) -> np.ndarray:
    """
    Compute pairwise Hamming distance matrix for a list of hash results.
    Returns NxN numpy matrix.
    """
    n = len(hashes)
    matrix = np.zeros((n, n), dtype=np.float32)
    for i in range(n):
        for j in range(i + 1, n):
            dist = hashes[i].phash - hashes[j].phash
            matrix[i][j] = dist
            matrix[j][i] = dist
    return matrix
