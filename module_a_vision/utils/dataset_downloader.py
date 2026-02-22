"""
Dataset Downloader — Module A / Utils
Downloads and organizes SIXray and GDXray datasets.
"""

import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

DATASETS = {
    'sixray': {
        'description': 'SIXray: Security Inspection X-ray Dataset (Univ. Chinese Academy of Sciences)',
        'url': 'https://github.com/MeioJane/SIXray',
        'classes': ['gun', 'knife', 'wrench', 'pliers', 'scissors'],
        'note': 'Requires manual download and license agreement.',
    },
    'gdxray': {
        'description': 'GDXray: X-ray Image Database for Nondestructive Testing (PUC Chile)',
        'url': 'https://domingomery.ing.puc.cl/material/gdxray/',
        'groups': ['Castings', 'Welds', 'Baggage', 'Nature', 'Settings'],
        'note': 'Public dataset — download scripts pending.',
    },
}


def list_available_datasets() -> dict:
    return DATASETS


def check_dataset_exists(name: str, dataset_path: str) -> bool:
    path = Path(dataset_path) / name
    return path.exists() and any(path.iterdir())


def get_image_paths(dataset_path: str, extensions=('.jpg', '.jpeg', '.png', '.bmp', '.tiff')) -> list:
    """Recursively find all image files in dataset directory."""
    paths = []
    for ext in extensions:
        paths.extend(Path(dataset_path).rglob(f'*{ext}'))
    return sorted([str(p) for p in paths])
