#!/bin/bash

# Usage: ./add-gcp-key.sh /path/to/your-service-account-key.json

if [ -z "$1" ]; then
    echo "Usage: ./add-gcp-key.sh <path-to-json-key-file>"
    exit 1
fi

KEY_FILE="$1"

if [ ! -f "$KEY_FILE" ]; then
    echo "Error: File '$KEY_FILE' not found"
    exit 1
fi

# Read JSON, minify it (remove newlines and extra whitespace)
JSON_CONTENT=$(cat "$KEY_FILE" | jq -c .)

if [ $? -ne 0 ]; then
    echo "Error: Invalid JSON file"
    exit 1
fi

# Remove existing GOOGLE_APPLICATION_CREDENTIALS_JSON line if present
if [ -f .env ]; then
    grep -v "^GOOGLE_APPLICATION_CREDENTIALS_JSON=" .env > .env.tmp
    mv .env.tmp .env
fi

# Append the new credential with single quotes to protect special characters
echo "GOOGLE_APPLICATION_CREDENTIALS_JSON='$JSON_CONTENT'" >> .env

echo "Successfully added Google credentials to .env"
