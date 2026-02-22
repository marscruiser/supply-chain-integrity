"""Cross-module hashing utilities."""
import hashlib


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_str(text: str) -> str:
    return sha256_bytes(text.encode('utf-8'))


def sha256_file(path: str) -> str:
    sha = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha.update(chunk)
    return sha.hexdigest()
