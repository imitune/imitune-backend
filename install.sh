#!/bin/bash

# This script installs all necessary dependencies for the Imitune backend project.

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Step 1: Installing Vercel CLI (globally)... ---"
npm install -g vercel

echo "\n--- Step 2: Installing project dependencies from package.json... ---"
npm install

echo "\n✅ Installation complete! You can now start the server with 'vercel dev'."

pip install -r requirements.txt
