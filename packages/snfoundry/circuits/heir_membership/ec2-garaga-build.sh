#!/bin/bash
# EC2 Garaga Verifier Build Script
# Run on Ubuntu 22.04+ (t3.xlarge or c5.2xlarge recommended, 16GB+ RAM)
#
# Usage:
#   1. Launch EC2 instance (Ubuntu 22.04, t3.xlarge)
#   2. SSH in and run: bash ec2-garaga-build.sh
#   3. SCP the compiled artifacts back to your Mac

set -euo pipefail

echo "=== Step 1: System dependencies ==="
sudo apt-get update && sudo apt-get install -y \
  build-essential git curl pkg-config libssl-dev

echo "=== Step 2: Install Rust ==="
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

echo "=== Step 3: Install Scarb 2.16.0 ==="
curl --proto '=https' --tlsv1.2 -sSf https://docs.swmansion.com/scarb/install.sh | sh -s -- -v 2.16.0
export PATH="$HOME/.local/bin:$PATH"
scarb --version

echo "=== Step 4: Clone the verifier project ==="
# Create workspace
mkdir -p ~/garaga-build
cd ~/garaga-build

# You need to SCP the heir_verifier directory from your Mac first:
#   scp -r packages/snfoundry/circuits/heir_membership/heir_verifier ubuntu@<ec2-ip>:~/garaga-build/
# OR copy the files inline below.

echo "=== Step 5: Build with large stack ==="
cd ~/garaga-build/heir_verifier
RUST_MIN_STACK=134217728 scarb build 2>&1 | tee build.log

echo "=== Step 6: Verify artifacts ==="
ls -la target/dev/

echo ""
echo "=== BUILD COMPLETE ==="
echo "SCP artifacts back to Mac:"
echo "  scp -r ubuntu@<ec2-ip>:~/garaga-build/heir_verifier/target/dev/ ./target/dev/"
echo ""
echo "Files you need:"
echo "  target/dev/heir_verifier_UltraKeccakZKHonkVerifier.contract_class.json  (sierra)"
echo "  target/dev/heir_verifier_UltraKeccakZKHonkVerifier.compiled_contract_class.json  (casm)"
