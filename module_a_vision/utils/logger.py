"""
Shared Logger Utility — shared/utils
Provides setup_logger() factory with consistent formatting across all modules.
"""

import logging
import sys
from pathlib import Path
from datetime import datetime


def setup_logger(name: str, level: str = "INFO", log_file: str = None) -> logging.Logger:
    """
    Create and configure a named logger.
    Outputs to stdout and optionally to a log file.
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    fmt = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    if not logger.handlers:
        # Console handler
        ch = logging.StreamHandler(sys.stdout)
        ch.setFormatter(fmt)
        logger.addHandler(ch)

        # File handler (optional)
        if log_file:
            fh = logging.FileHandler(log_file, encoding="utf-8")
            fh.setFormatter(fmt)
            logger.addHandler(fh)

    return logger


def get_logger(name: str) -> logging.Logger:
    """Alias for setup_logger with default settings."""
    return logging.getLogger(name)
