"""
Module A — Vision & Data Analysis
Main entry point for the X-Ray inspection pipeline.

This module orchestrates the full vision pipeline:
  1. Load and preprocess X-ray images
  2. Simulate tampering (optional, for training/testing)
  3. Generate perceptual fingerprints
  4. Compute SSIM anomaly scores
  5. Upload to IPFS
  6. Return structured inspection results to API
"""

import argparse
import logging
import sys
from pathlib import Path

from config import VisionConfig
from preprocessing.pipeline import PreprocessingPipeline
from hashing.perceptual_hasher import PerceptualHasher
from hashing.ssim_comparator import SSIMComparator
from fingerprinting.fingerprint_engine import FingerprintEngine
from tampering.simulator import TamperingSimulator
from anomaly_detection.anomaly_detector import AnomalyDetector
from digital_twin.twin_builder import DigitalTwinBuilder
from evaluation.metrics import EvaluationMetrics
from utils.logger import setup_logger
from utils.ipfs_uploader import IPFSUploader

logger = setup_logger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="Supply Chain X-Ray Inspection Pipeline")
    parser.add_argument("--mode", choices=["inspect", "simulate", "evaluate", "api"], default="api",
                        help="Pipeline execution mode")
    parser.add_argument("--image", type=str, help="Path to X-ray image for inspection")
    parser.add_argument("--reference", type=str, help="Path to reference/original image for comparison")
    parser.add_argument("--config", type=str, default="config.yaml", help="Path to config file")
    parser.add_argument("--output", type=str, default="./output", help="Output directory")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    return parser.parse_args()


def run_inspect_pipeline(args, config: VisionConfig):
    """Run full inspection pipeline on a single X-ray image."""
    logger.info(f"Starting inspection pipeline for: {args.image}")

    # Step 1: Preprocess
    pipeline = PreprocessingPipeline(config)
    processed = pipeline.process(args.image)

    # Step 2: Generate fingerprint
    engine = FingerprintEngine(config)
    fingerprint = engine.generate(processed)

    # Step 3: If reference provided, compare
    result = {"fingerprint": fingerprint.to_dict(), "status": "NO_REFERENCE"}
    if args.reference:
        ref_processed = pipeline.process(args.reference)
        ref_fingerprint = engine.generate(ref_processed)

        # Perceptual hash comparison
        hasher = PerceptualHasher(config)
        hash_distance = hasher.compare(fingerprint.phash, ref_fingerprint.phash)

        # SSIM comparison
        comparator = SSIMComparator(config)
        ssim_score = comparator.compare(processed.image, ref_processed.image)

        # Anomaly detection
        detector = AnomalyDetector(config)
        verdict = detector.detect(hash_distance, ssim_score, fingerprint, ref_fingerprint)

        result = {
            "fingerprint": fingerprint.to_dict(),
            "reference_fingerprint": ref_fingerprint.to_dict(),
            "hash_distance": hash_distance,
            "ssim_score": ssim_score,
            "verdict": verdict.to_dict(),
            "status": verdict.status,
        }

    # Step 4: Upload to IPFS
    uploader = IPFSUploader(config)
    ipfs_cid = uploader.upload_result(result, processed.image)
    result["ipfs_cid"] = ipfs_cid

    logger.info(f"Inspection complete. IPFS CID: {ipfs_cid}")
    return result


def run_simulation_pipeline(args, config: VisionConfig):
    """Run tampering simulation to generate synthetic tampered images."""
    logger.info("Starting tampering simulation pipeline...")
    simulator = TamperingSimulator(config)
    simulator.run_all_scenarios(args.output)
    logger.info("Simulation complete.")


def run_evaluation_pipeline(args, config: VisionConfig):
    """Run evaluation pipeline on dataset to measure detection accuracy."""
    logger.info("Starting evaluation pipeline...")
    metrics = EvaluationMetrics(config)
    report = metrics.run_full_evaluation()
    metrics.save_report(report, args.output)
    logger.info("Evaluation complete.")


def run_api_server(config: VisionConfig):
    """Start the FastAPI vision server."""
    import uvicorn
    from api import create_app
    app = create_app(config)
    uvicorn.run(app, host=config.host, port=config.port, reload=config.reload)


def main():
    args = parse_args()
    config = VisionConfig.from_yaml(args.config)

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.mode == "inspect":
        result = run_inspect_pipeline(args, config)
        print(result)
    elif args.mode == "simulate":
        run_simulation_pipeline(args, config)
    elif args.mode == "evaluate":
        run_evaluation_pipeline(args, config)
    elif args.mode == "api":
        run_api_server(config)
    else:
        logger.error(f"Unknown mode: {args.mode}")
        sys.exit(1)


if __name__ == "__main__":
    main()
