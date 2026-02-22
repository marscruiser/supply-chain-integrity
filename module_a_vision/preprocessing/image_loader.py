"""
Image Loader — Module A / Preprocessing
Handles loading of various X-ray image formats including:
  - Standard JPEG/PNG (SIXray, GDXray datasets)
  - DICOM medical images
  - 16-bit grayscale PNG
  - HDF5 volumetric data
"""

import cv2
import numpy as np
from pathlib import Path
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class ImageLoader:
    """
    Unified image loader supporting multiple X-ray formats.
    Normalizes all inputs to uint8 or float32 numpy arrays.
    """

    SUPPORTED_FORMATS = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif", ".dcm", ".h5", ".hdf5"}

    def __init__(self, grayscale: bool = True):
        self.grayscale = grayscale

    def load(self, path: str) -> Tuple[np.ndarray, dict]:
        """
        Load an image from the given path.
        Returns (image_array, metadata_dict)
        """
        p = Path(path)
        ext = p.suffix.lower()

        if ext not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format: {ext}")

        if ext == ".dcm":
            return self._load_dicom(path)
        elif ext in {".h5", ".hdf5"}:
            return self._load_hdf5(path)
        else:
            return self._load_standard(path)

    def _load_standard(self, path: str) -> Tuple[np.ndarray, dict]:
        """Load standard image formats via OpenCV."""
        flag = cv2.IMREAD_GRAYSCALE if self.grayscale else cv2.IMREAD_COLOR
        img = cv2.imread(path, flag)
        if img is None:
            raise IOError(f"OpenCV could not open: {path}")
        if not self.grayscale:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        meta = {"format": Path(path).suffix, "shape": img.shape, "dtype": str(img.dtype)}
        return img, meta

    def _load_dicom(self, path: str) -> Tuple[np.ndarray, dict]:
        """Load DICOM medical imaging format."""
        try:
            import pydicom
            ds = pydicom.dcmread(path)
            img = ds.pixel_array.astype(np.float32)
            # Normalize to 0-255 uint8
            img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
            meta = {
                "format": "DICOM",
                "patient_name": str(ds.get("PatientName", "Unknown")),
                "modality": str(ds.get("Modality", "Unknown")),
                "shape": img.shape,
            }
            return img, meta
        except ImportError:
            raise ImportError("pydicom not installed. Run: pip install pydicom")

    def _load_hdf5(self, path: str) -> Tuple[np.ndarray, dict]:
        """Load volumetric X-ray data from HDF5."""
        try:
            import h5py
            with h5py.File(path, "r") as f:
                dataset_key = list(f.keys())[0]
                data = f[dataset_key][:]
            # Take middle slice if 3D
            if data.ndim == 3:
                data = data[data.shape[0] // 2]
            img = cv2.normalize(data, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
            meta = {"format": "HDF5", "original_shape": data.shape, "shape": img.shape}
            return img, meta
        except ImportError:
            raise ImportError("h5py not installed. Run: pip install h5py")

    def load_batch(self, paths: list) -> list:
        """Load a list of images, skipping failures."""
        results = []
        for path in paths:
            try:
                img, meta = self.load(path)
                results.append({"path": path, "image": img, "meta": meta})
            except Exception as e:
                logger.warning(f"Skipping {path}: {e}")
        return results
