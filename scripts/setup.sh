#!/bin/bash
set -e
echo '═══════════════════════════════════════════════'
echo '  Supply Chain Integrity Platform — Setup'
echo '═══════════════════════════════════════════════'
echo ''
echo '[1/4] Installing Module A (Vision) dependencies...'
(cd module_a_vision && python3 -m pip install -r requirements.txt)
echo ''
echo '[2/4] Installing Module B (Blockchain) dependencies...'
(cd module_b_blockchain && npm install)
echo ''
echo '[3/4] Installing Module C API dependencies...'
(cd module_c_integration/api && python3 -m pip install -r requirements.txt)
echo ''
echo '[4/4] Installing Module C Dashboard dependencies...'
(cd module_c_integration/dashboard && npm install)
echo ''
echo '✅ Setup complete!'
echo '   Run: make up     → Start all Docker services'
echo '   Run: make dev    → Start local dev servers'
