#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/Sandeeprdy1729/timps-training-data"
DATASET_DIR="timps-code/dataset"

if [ -d "$DATASET_DIR" ] && [ -f "$DATASET_DIR/sft_train.jsonl" ]; then
  echo "Dataset already present at $DATASET_DIR — skipping download"
  exit 0
fi

mkdir -p "$DATASET_DIR"

echo "Downloading training dataset from $REPO_URL ..."

for file in sft_train.jsonl rlef_train.jsonl grpo_train.jsonl stats.json checkpoint.json; do
  curl -sL "$REPO_URL/releases/latest/download/$file" -o "$DATASET_DIR/$file" || {
    echo "Warning: could not download $file — dataset repo may not have a release yet"
    echo "Clone manually: git clone $REPO_URL"
    exit 1
  }
done

echo "Dataset downloaded successfully to $DATASET_DIR"
