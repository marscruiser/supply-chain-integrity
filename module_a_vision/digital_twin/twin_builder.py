"""
Digital Twin Builder — Module A / Digital Twin
Constructs a structured digital representation of shipment cargo
based on X-ray inspection data.

A Digital Twin includes:
  - Cargo inventory estimation (object count, zones)
  - Material density map
  - Spatial layout model
  - Comparison between reference and current twin
  - Tamper delta report
"""

import cv2
import numpy as np
from dataclasses import dataclass, field
from typing import List, Dict, Optional
import json
import uuid
import logging

logger = logging.getLogger(__name__)


@dataclass
class CargoZone:
    """A spatial zone in the cargo with density and content estimate."""
    zone_id: str
    grid_row: int
    grid_col: int
    x: int
    y: int
    width: int
    height: int
    mean_density: float       # Avg pixel intensity in zone
    std_density: float
    material_estimate: str    # dense_metal | liquid | organic | empty | unknown
    object_count: int

    def to_dict(self) -> dict:
        return {
            "zone_id": self.zone_id,
            "position": {"row": self.grid_row, "col": self.grid_col},
            "bounds": {"x": self.x, "y": self.y, "w": self.width, "h": self.height},
            "density": {"mean": round(self.mean_density, 3), "std": round(self.std_density, 3)},
            "material_estimate": self.material_estimate,
            "object_count": self.object_count,
        }


@dataclass
class ShipmentDigitalTwin:
    """
    Full digital twin of a sealed shipment.
    Created from X-ray scan at origin and verified at destination.
    """
    twin_id: str
    shipment_id: Optional[str]
    created_at: str
    total_zones: int
    grid_size: tuple             # (rows, cols)
    zones: List[CargoZone]
    density_map: List[List[float]]    # 2D grid of mean densities
    total_mass_proxy: float     # Normalized sum of all densities
    dominant_material: str
    object_count_total: int
    fingerprint_id: Optional[str] = None   # Link to CargoFingerprint
    metadata: Dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "twin_id": self.twin_id,
            "shipment_id": self.shipment_id,
            "created_at": self.created_at,
            "grid_size": list(self.grid_size),
            "total_zones": self.total_zones,
            "zones": [z.to_dict() for z in self.zones],
            "density_map": self.density_map,
            "total_mass_proxy": round(self.total_mass_proxy, 4),
            "dominant_material": self.dominant_material,
            "object_count_total": self.object_count_total,
            "fingerprint_id": self.fingerprint_id,
            "metadata": self.metadata,
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)


class DigitalTwinBuilder:
    """
    Constructs a digital twin from preprocessed X-ray images.
    Divides image into a grid and analyzes each zone independently.
    """

    GRID_SIZE = (8, 8)   # 8x8 grid of zones

    MATERIAL_THRESHOLDS = {
        "empty": (0, 30),
        "organic": (30, 80),
        "liquid": (80, 130),
        "dense_metal": (130, 255),
    }

    def __init__(self, config):
        self.config = config

    def _classify_material(self, mean_density: float) -> str:
        for material, (low, high) in self.MATERIAL_THRESHOLDS.items():
            if low <= mean_density < high:
                return material
        return "unknown"

    def _count_objects_in_zone(self, zone_image: np.ndarray) -> int:
        """Count number of distinct objects in a zone."""
        img_uint8 = (zone_image * 255).astype(np.uint8) if zone_image.dtype == np.float32 else zone_image
        _, thresh = cv2.threshold(img_uint8, 80, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        return len([c for c in contours if cv2.contourArea(c) > 20])

    def build(self, preprocessed_image, shipment_id: str = None, fingerprint_id: str = None) -> ShipmentDigitalTwin:
        """Build a ShipmentDigitalTwin from a PreprocessedImage."""
        from datetime import datetime, timezone

        image = preprocessed_image.image
        if image.dtype == np.float32:
            image_uint8 = (image * 255).astype(np.uint8)
        else:
            image_uint8 = image

        h, w = image_uint8.shape[:2]
        rows, cols = self.GRID_SIZE
        zone_h = h // rows
        zone_w = w // cols

        zones = []
        density_map = []
        total_objects = 0

        for row in range(rows):
            density_row = []
            for col in range(cols):
                y = row * zone_h
                x = col * zone_w
                zone_img = image_uint8[y:y+zone_h, x:x+zone_w]
                mean_d = float(zone_img.mean())
                std_d = float(zone_img.std())
                material = self._classify_material(mean_d)
                obj_count = self._count_objects_in_zone(zone_img)
                total_objects += obj_count

                zones.append(CargoZone(
                    zone_id=str(uuid.uuid4())[:8],
                    grid_row=row, grid_col=col,
                    x=x, y=y, width=zone_w, height=zone_h,
                    mean_density=mean_d, std_density=std_d,
                    material_estimate=material, object_count=obj_count,
                ))
                density_row.append(round(mean_d, 3))
            density_map.append(density_row)

        # Determine dominant material
        material_counts = {}
        for zone in zones:
            material_counts[zone.material_estimate] = material_counts.get(zone.material_estimate, 0) + 1
        dominant = max(material_counts, key=material_counts.get)

        return ShipmentDigitalTwin(
            twin_id=str(uuid.uuid4()),
            shipment_id=shipment_id,
            created_at=datetime.now(timezone.utc).isoformat(),
            total_zones=len(zones),
            grid_size=self.GRID_SIZE,
            zones=zones,
            density_map=density_map,
            total_mass_proxy=float(image_uint8.mean()),
            dominant_material=dominant,
            object_count_total=total_objects,
            fingerprint_id=fingerprint_id,
        )

    def compare_twins(self, twin1: ShipmentDigitalTwin, twin2: ShipmentDigitalTwin) -> dict:
        """
        Compare two digital twins zone by zone.
        Returns a delta report showing which zones changed.
        """
        delta_zones = []
        for z1, z2 in zip(twin1.zones, twin2.zones):
            density_diff = abs(z1.mean_density - z2.mean_density)
            material_changed = z1.material_estimate != z2.material_estimate
            obj_diff = abs(z1.object_count - z2.object_count)

            if density_diff > 20 or material_changed or obj_diff > 0:
                delta_zones.append({
                    "zone_id": z1.zone_id,
                    "grid_pos": [z1.grid_row, z1.grid_col],
                    "density_diff": round(density_diff, 3),
                    "material_changed": material_changed,
                    "material_before": z1.material_estimate,
                    "material_after": z2.material_estimate,
                    "obj_count_diff": obj_diff,
                })

        return {
            "total_zones": twin1.total_zones,
            "changed_zones": len(delta_zones),
            "change_percentage": round(len(delta_zones) / max(twin1.total_zones, 1) * 100, 2),
            "mass_proxy_diff": round(abs(twin1.total_mass_proxy - twin2.total_mass_proxy), 4),
            "delta_zones": delta_zones,
        }
