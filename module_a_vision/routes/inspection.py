"""
Inspection routes — Module A Vision API.
Provides endpoints for:
  1. Analyzing a single X-ray image (SHA-256, pHash, HOG, keypoints, morphological features)
  2. Comparing two X-ray images using a multi-signal anomaly detector
     (global SSIM + tampered regions + object count delta + pHash + keypoint matching)
"""
from fastapi import APIRouter, File, UploadFile, HTTPException, Request
import numpy as np
import cv2
import tempfile
import os
import time

router = APIRouter()


def _save_upload(upload: UploadFile) -> str:
    """Save an uploaded file to a temp path and return the path."""
    suffix = os.path.splitext(upload.filename or "image.png")[1] or ".png"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(upload.file.read())
    tmp.close()
    return tmp.name


def _count_objects(image: np.ndarray, min_area: int = 80) -> int:
    """
    Count distinct foreground objects using contour detection.
    Works on normalized float32 images (converts to uint8 internally).
    min_area: ignore contours smaller than this pixel area (filters noise).
    """
    img_u8 = (image * 255).astype(np.uint8) if image.dtype in (np.float32, np.float64) else image
    # Gaussian blur to reduce noise before thresholding
    blurred = cv2.GaussianBlur(img_u8, (5, 5), 0)
    # Adaptive threshold — works better than a fixed threshold for X-ray images
    thresh = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=11, C=3
    )
    # Morphological close to fill small gaps inside objects
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return sum(1 for c in contours if cv2.contourArea(c) >= min_area)


def _histogram_chi2(img1: np.ndarray, img2: np.ndarray) -> float:
    """Compute chi-squared distance between two normalized histograms."""
    u1 = (img1 * 255).astype(np.uint8) if img1.dtype in (np.float32, np.float64) else img1
    u2 = (img2 * 255).astype(np.uint8) if img2.dtype in (np.float32, np.float64) else img2
    h1 = cv2.calcHist([u1], [0], None, [256], [0, 256])
    h2 = cv2.calcHist([u2], [0], None, [256], [0, 256])
    cv2.normalize(h1, h1)
    cv2.normalize(h2, h2)
    return float(cv2.compareHist(h1, h2, cv2.HISTCMP_CHISQR))


def _detect_duplicated_objects(
    origin_img: np.ndarray,
    dest_img: np.ndarray,
    min_area: int = 50,
    match_threshold: float = 0.82,
    nms_overlap: float = 0.3,
) -> list:
    """
    Duplication detector optimised for X-ray luggage images.

    Strategy (difference-first):
      1. Compute |origin − destination| to isolate what changed.
      2. Threshold the diff to find new/changed regions.
      3. For each changed region, crop a template from the destination.
      4. Count how many times that template appears in origin vs destination.
      5. If destination_count > origin_count → object was duplicated.

    This avoids trying to segment individual items inside an X-ray bag
    (which fails because objects overlap heavily).
    """
    # ── normalise to uint8 grayscale ─────────────────────────────────────
    def _to_gray_u8(img):
        u8 = (img * 255).astype(np.uint8) if img.dtype in (np.float32, np.float64) else img
        return cv2.cvtColor(u8, cv2.COLOR_BGR2GRAY) if len(u8.shape) == 3 else u8

    g1 = _to_gray_u8(origin_img)
    g2 = _to_gray_u8(dest_img)

    # Resize to match if needed
    if g1.shape != g2.shape:
        g2 = cv2.resize(g2, (g1.shape[1], g1.shape[0]))

    # CLAHE for better contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    e1 = clahe.apply(g1)
    e2 = clahe.apply(g2)

    # ── Step 1: Absolute difference ──────────────────────────────────────
    diff = cv2.absdiff(e1, e2)
    # Enhance the diff
    diff_blur = cv2.GaussianBlur(diff, (5, 5), 0)
    _, diff_thresh = cv2.threshold(diff_blur, 15, 255, cv2.THRESH_BINARY)

    # Morphological ops to get clean regions
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    diff_clean = cv2.morphologyEx(diff_thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    diff_clean = cv2.morphologyEx(diff_clean, cv2.MORPH_OPEN, kernel, iterations=1)

    # ── Step 2: Find changed regions ─────────────────────────────────────
    contours, _ = cv2.findContours(diff_clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    duplicated = []
    obj_idx = 0
    seen_boxes = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        x, y, w, h = cv2.boundingRect(cnt)

        if w < 10 or h < 10:
            continue
        if w > e1.shape[1] * 0.5 or h > e1.shape[0] * 0.5:
            continue

        # Skip overlapping regions
        skip = False
        for sx, sy, sw, sh in seen_boxes:
            ox = max(0, min(x+w, sx+sw) - max(x, sx))
            oy = max(0, min(y+h, sy+sh) - max(y, sy))
            if ox * oy > 0.4 * min(w*h, sw*sh):
                skip = True
                break
        if skip:
            continue
        seen_boxes.append((x, y, w, h))

        obj_idx += 1

        # ── Step 3: Template from the DESTINATION (where new object is) ──
        template = e2[y:y+h, x:x+w]
        if template.size == 0:
            continue

        # ── Step 4: Count matches in origin vs destination ───────────────
        origin_count = _count_template_matches(e1, template, match_threshold, nms_overlap, w, h)
        dest_count = _count_template_matches(e2, template, match_threshold, nms_overlap, w, h)

        if dest_count > origin_count and dest_count >= 2:
            duplicated.append({
                "object_id": obj_idx,
                "origin_count": origin_count,
                "destination_count": dest_count,
                "times_duplicated": dest_count - origin_count,
                "confidence": round(match_threshold, 4),
                "bbox_origin": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
            })

    return duplicated


def _count_template_matches(
    image: np.ndarray, template: np.ndarray,
    threshold: float, nms_overlap: float, w: int, h: int,
) -> int:
    """Count how many times a template appears in an image."""
    if template.shape[0] > image.shape[0] or template.shape[1] > image.shape[1]:
        return 0
    try:
        result = cv2.matchTemplate(image, template, cv2.TM_CCOEFF_NORMED)
    except cv2.error:
        return 0

    locations = np.where(result >= threshold)
    match_points = list(zip(locations[1].tolist(), locations[0].tolist()))

    if len(match_points) == 0:
        return 0

    boxes = [(mx, my, mx + w, my + h) for mx, my in match_points]
    scores = [float(result[my, mx]) for mx, my in match_points]
    keep = _nms(boxes, scores, nms_overlap)
    return len(keep)


def _nms(boxes: list, scores: list, overlap_thresh: float) -> list:
    """Simple non-maximum suppression."""
    if len(boxes) == 0:
        return []
    idxs = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    keep = []
    while idxs:
        i = idxs.pop(0)
        keep.append(i)
        remaining = []
        bx1, by1, bx2, by2 = boxes[i]
        for j in idxs:
            ax1, ay1, ax2, ay2 = boxes[j]
            ix1, ix2 = max(bx1, ax1), min(bx2, ax2)
            iy1, iy2 = max(by1, ay1), min(by2, ay2)
            inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
            area_j = (ax2 - ax1) * (ay2 - ay1)
            if area_j > 0 and inter / area_j < overlap_thresh:
                remaining.append(j)
        idxs = remaining
    return keep


@router.post("/analyze", summary="Analyze a single X-ray image")
async def analyze_image(request: Request, image: UploadFile = File(...), shipment_id: str = None):
    """
    Accepts an X-ray image upload.
    Returns SHA-256, perceptual hashes, HOG features, keypoint count,
    morphological descriptors, image statistics, and points of interest.
    """
    from config import VisionConfig
    from preprocessing.pipeline import PreprocessingPipeline
    from fingerprinting.fingerprint_engine import FingerprintEngine

    config = VisionConfig.from_env()
    t0 = time.time()

    path = _save_upload(image)
    try:
        pipeline = PreprocessingPipeline(config)
        processed = pipeline.process(path)

        engine = FingerprintEngine(config)
        fingerprint = engine.generate(processed, shipment_id=shipment_id)

        object_count = _count_objects(processed.image)
        elapsed = round((time.time() - t0) * 1000, 1)

        return {
            "fingerprint_id": fingerprint.fingerprint_id,
            "shipment_id": fingerprint.shipment_id,
            "timestamp": fingerprint.timestamp,
            "image_sha256": fingerprint.image_sha256,
            "perceptual_hashes": fingerprint.perceptual_hashes.to_dict(),
            "keypoint_count": fingerprint.keypoint_count,
            "object_count": object_count,
            "morphological_features": fingerprint.morphological_features,
            "image_stats": fingerprint.image_stats,
            "points_of_interest_count": len(fingerprint.points_of_interest),
            "processing_time_ms": elapsed,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        os.unlink(path)


@router.post("/compare", summary="Compare two X-ray images for tampering")
async def compare_images(
    request: Request,
    image1: UploadFile = File(...),
    image2: UploadFile = File(...),
):
    """
    Multi-signal tampering detector. Compares origin vs destination X-ray.

    Uses 5 independent signals combined by the AnomalyDetector:
      - Global SSIM (insensitive to small changes on its own)
      - Tampered region count + area (catches localized changes like a missing cylinder)
      - Object count delta (catches removal of individual items)
      - Perceptual hash (pHash) Hamming distance
      - Histogram chi-squared distance

    Verdict: CLEAN | SUSPICIOUS | TAMPERED
    """
    from config import VisionConfig
    from preprocessing.pipeline import PreprocessingPipeline
    from fingerprinting.fingerprint_engine import FingerprintEngine
    from hashing.perceptual_hasher import PerceptualHasher
    from hashing.ssim_comparator import SSIMComparator
    from anomaly_detection.anomaly_detector import AnomalyDetector, IntegrityStatus

    config = VisionConfig.from_env()
    t0 = time.time()

    path1 = _save_upload(image1)
    path2 = _save_upload(image2)
    try:
        pipeline = PreprocessingPipeline(config)
        proc1 = pipeline.process(path1)
        proc2 = pipeline.process(path2)

        # ── Signal 1 & 2: Perceptual hashes + full fingerprint ─────────────────
        engine = FingerprintEngine(config)
        fp1 = engine.generate(proc1, shipment_id="origin")
        fp2 = engine.generate(proc2, shipment_id="destination")

        hasher = PerceptualHasher(config)
        hash_comparison = hasher.compare(fp1.perceptual_hashes, fp2.perceptual_hashes)

        # ── Signal 3: Structural Similarity (global + per-pixel map) ───────────
        comparator = SSIMComparator(config)
        ssim_result = comparator.compare(proc1.image, proc2.image)

        # ── Signal 4: Object count delta (catches single item removal) ──────────
        obj_count_1 = _count_objects(proc1.image)
        obj_count_2 = _count_objects(proc2.image)
        obj_delta = abs(obj_count_1 - obj_count_2)

        # ── Signal 5: Histogram chi-squared distance ────────────────────────────
        hist_chi2 = _histogram_chi2(proc1.image, proc2.image)

        # ══════════════════════════════════════════════════════════════════════
        # VERDICT LOGIC — Only two outcomes: CLEAN or TAMPERED
        #
        # Core principle:
        #   "Tampering" = items were REMOVED or ADDED (theft / substitution).
        #   "Movement"  = same items shifted position during transport → CLEAN.
        #
        # How we distinguish them:
        #   - Object count delta:  if items disappeared or appeared → TAMPERED
        #   - Histogram chi²:     measures total material density in the image.
        #                         If similar, same stuff is there (just moved).
        #                         If very different, material was removed/added.
        #   - Tampered region area WITHOUT a balancing counter-region:
        #                         Movement creates PAIRS (bright + dark).
        #                         Removal creates only ONE dark region.
        # ══════════════════════════════════════════════════════════════════════

        tampered_region_area = sum(r.get("area", 0) for r in ssim_result.tampered_regions)
        max_region_area = max((r.get("area", 0) for r in ssim_result.tampered_regions), default=0)
        num_regions = len(ssim_result.tampered_regions)

        # Start with CLEAN, escalate to TAMPERED if any signal fires
        final_verdict = "CLEAN"
        triggered = []
        explanation_parts = []

        # ── Rule 1: Object count changed → item was removed or added ──────────
        # Threshold is 3 instead of 1: contour detection is noisy for X-rays,
        # and item movement shifts how overlapping objects are segmented,
        # causing ±1-2 count differences that are NOT actual item removal.
        OBJ_DELTA_THRESHOLD = 3
        if obj_delta >= OBJ_DELTA_THRESHOLD:
            final_verdict = "TAMPERED"
            triggered.append("object_count_delta")
            if obj_count_2 > obj_count_1:
                explanation_parts.append(
                    f"Object count increased from {obj_count_1} to {obj_count_2} "
                    f"(+{obj_count_2 - obj_count_1}). Items were multiplied/duplicated in the shipment."
                )
            else:
                explanation_parts.append(
                    f"Object count decreased from {obj_count_1} to {obj_count_2} "
                    f"(-{obj_count_1 - obj_count_2}). Items were removed from the shipment."
                )

        # ── Rule 2: Large histogram shift → material composition changed ──────
        # chi² > 12.0 required: X-ray intensity is affected by scan angle,
        # bag compression, and item overlap — all of which shift histograms
        # without any tampering. 12.0 catches actual material gain/loss.
        HIST_TAMPER_THRESHOLD = 12.0
        if hist_chi2 > HIST_TAMPER_THRESHOLD:
            final_verdict = "TAMPERED"
            triggered.append("histogram_shift")
            explanation_parts.append(
                f"Histogram chi² distance is {hist_chi2:.2f} (threshold: {HIST_TAMPER_THRESHOLD}). "
                f"Significant change in material density detected."
            )

        # ── Rule 3: Tampered regions — movement vs removal detection ──────────
        # For each tampered region, compare mean pixel intensity in origin vs
        # destination to determine if material was LOST or GAINED:
        #
        #   Movement: one region gets darker (object left), another gets
        #             brighter (object arrived). Lost ≈ Gained → balanced.
        #   Removal:  region gets darker (object gone), nothing gets brighter
        #             elsewhere. Lost ≫ Gained → unbalanced.
        #
        # If unbalanced → TAMPERED (something was stolen or added).
        # If balanced   → CLEAN   (items just shifted during transport).
        if num_regions > 0 and final_verdict != "TAMPERED":
            lost_mass = 0.0    # pixels that got darker (material disappeared)
            gained_mass = 0.0  # pixels that got brighter (material appeared)

            img1 = proc1.image
            img2 = proc2.image
            img1_u8 = (img1 * 255).astype(np.uint8) if img1.dtype in (np.float32, np.float64) else img1
            img2_u8 = (img2 * 255).astype(np.uint8) if img2.dtype in (np.float32, np.float64) else img2

            for region in ssim_result.tampered_regions:
                x, y = region["x"], region["y"]
                w, h = region["width"], region["height"]
                # Clamp to image bounds
                y1, y2 = max(0, y), min(img1_u8.shape[0], y + h)
                x1, x2 = max(0, x), min(img1_u8.shape[1], x + w)

                roi_origin = img1_u8[y1:y2, x1:x2].astype(float)
                roi_dest   = img2_u8[y1:y2, x1:x2].astype(float)

                mean_origin = roi_origin.mean() if roi_origin.size > 0 else 0
                mean_dest   = roi_dest.mean()   if roi_dest.size > 0 else 0
                area = region.get("area", w * h)

                if mean_origin > mean_dest:
                    # Region got darker → material was removed from here
                    lost_mass += (mean_origin - mean_dest) * area
                else:
                    # Region got brighter → material appeared here
                    gained_mass += (mean_dest - mean_origin) * area

            # Calculate balance ratio: how much of the lost material reappeared?
            total_change = lost_mass + gained_mass
            if total_change > 0:
                balance_ratio = min(lost_mass, gained_mass) / max(lost_mass, gained_mass) if max(lost_mass, gained_mass) > 0 else 1.0
            else:
                balance_ratio = 1.0  # No change at all

            # balance_ratio ≈ 1.0 → perfectly balanced (movement)
            # balance_ratio ≈ 0.0 → completely unbalanced (removal/theft)
            # 0.25: caught by any scenario where >75% of change is one-directional
            # (movement gives ~0.7–1.0; theft gives ~0.0–0.2)
            # min_region_area 200px: catches small items (phone, wallet) being removed.
            BALANCE_THRESHOLD = 0.25  # Below this = unbalanced = theft

            if balance_ratio < BALANCE_THRESHOLD and max_region_area >= 200:
                final_verdict = "TAMPERED"
                triggered.append("unbalanced_region_change")
                explanation_parts.append(
                    f"Detected {num_regions} changed region(s). "
                    f"Material loss is unbalanced (ratio={balance_ratio:.2f}): "
                    f"material disappeared without reappearing elsewhere. "
                    f"Likely item removal or theft."
                )

        # ── Rule 5: Object duplication detection via template matching ────────
        # Use RAW images (not preprocessed) — the preprocessing pipeline
        # normalises contrast which hurts template-matching accuracy.
        #
        # IMPORTANT: Template matching will find an object in both its OLD and
        # NEW position when it simply moved — this looks like duplication.
        # Guard: only treat duplication as TAMPERED if:
        #   (a) at least one other signal already fired, OR
        #   (b) 2+ distinct objects are duplicated (very unlikely from movement)
        try:
            raw1 = cv2.imread(path1, cv2.IMREAD_GRAYSCALE)
            raw2 = cv2.imread(path2, cv2.IMREAD_GRAYSCALE)
            if raw1 is not None and raw2 is not None:
                duplicated_objects = _detect_duplicated_objects(raw1, raw2)
            else:
                duplicated_objects = _detect_duplicated_objects(proc1.image, proc2.image)
        except Exception:
            duplicated_objects = []

        # Only fire if corroborated by another signal OR ≥2 objects duplicated
        other_signals_fired = len(triggered) > 0
        if duplicated_objects and (other_signals_fired or len(duplicated_objects) >= 2):
            final_verdict = "TAMPERED"
            triggered.append("object_duplication")
            dup_details = "; ".join(
                f"Object #{d['object_id']} multiplied {d['origin_count']}x → {d['destination_count']}x (+{d['times_duplicated']} copies)"
                for d in duplicated_objects
            )
            explanation_parts.append(
                f"Object duplication detected: {dup_details}. "
                f"Items were cloned/duplicated in the destination scan."
            )

        # ── Rule 4: SSIM below threshold → large-scale structural change ─────
        if ssim_result.is_suspicious:
            if final_verdict != "TAMPERED":
                final_verdict = "TAMPERED"
                triggered.append("ssim_below_threshold")
                explanation_parts.append(
                    f"SSIM score {ssim_result.ssim_score:.4f} is below "
                    f"threshold {ssim_result.threshold_used}."
                )

        # Build final explanation
        if final_verdict == "CLEAN":
            if num_regions > 0:
                explanation = (
                    f"Items may have shifted position during transport "
                    f"({num_regions} minor region difference(s) detected), "
                    f"but object count is unchanged ({obj_count_1}) and material "
                    f"density is consistent. No tampering detected."
                )
            else:
                explanation = "All signals within normal range. Cargo integrity verified."
        else:
            explanation = " ".join(explanation_parts)

        elapsed = round((time.time() - t0) * 1000, 1)

        return {
            "verdict": final_verdict,
            "confidence": round(1.0 - ssim_result.ssim_score + (obj_delta * 0.2) + min(hist_chi2 / 10.0, 0.3), 4),
            "explanation": explanation,
            "triggered_signals": triggered,

            # Signal breakdown
            "signals": {
                "ssim_score":        round(ssim_result.ssim_score, 6),
                "ssim_threshold":    ssim_result.threshold_used,
                "ssim_suspicious":   ssim_result.is_suspicious,
                "phash_distance":    hash_comparison.phash_distance,
                "phash_suspicious":  hash_comparison.is_suspicious,
                "histogram_chi2":    round(hist_chi2, 4),
                "object_count_origin":      obj_count_1,
                "object_count_destination": obj_count_2,
                "object_count_delta":       obj_delta,
            },

            # Tampered region map
            "tampered_regions_count": num_regions,
            "tampered_regions_total_area_px": round(tampered_region_area, 1),
            "tampered_regions": ssim_result.tampered_regions[:10],

            # Hashes for blockchain storage
            "origin_sha256":      fp1.image_sha256,
            "destination_sha256": fp2.image_sha256,
            "origin_phash":       str(fp1.perceptual_hashes.phash),
            "destination_phash":  str(fp2.perceptual_hashes.phash),

            # Object duplication via template matching
            "duplicated_objects": duplicated_objects,
            "object_duplication_detected": len(duplicated_objects) > 0,

            "processing_time_ms": elapsed,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")
    finally:
        os.unlink(path1)
        os.unlink(path2)
