#!/usr/bin/env bash
set -euo pipefail

# Enable nullglob so unmatched globs expand to nothing instead of staying literal
shopt -s nullglob

# Which file extensions to include
EXTS=(rs toml cs csproj proto ts tsx css sql json)
# EXTS=(rs)
# EXTS=(yml)
# EXTS=(ts tsx)

# Which directories to search (relative to script execution directory)
# Syntax:
#   "./path" or "./path/"     - Search recursively (default)
#   "./path/:"                - Search only files in this dir (non-recursive, maxdepth 1)
#   "./path/*"                - Expand glob and search each recursively
#   "./path/*:"               - Expand glob and search each non-recursively
#
# Examples:
#   "./src/:"                 - Only files directly in src/, not subdirs
#   "./src"                   - All files in src/ and all subdirs (recursive)
#   "./src/db/*:"             - Files in each subdir of db/, but not their subdirs

# DIRS=("./daemo-engine/src")
# DIRS=("~/.config/nvim/lua/custom/")
DIRS=("./src/" "./:")
# DIRS=("./src/bin/")

# Name of the output file
OUT="all_code_dump.txt"
# OUT="all_code_dump_ts.txt"
# OUT="all_code_dump_frontend.txt"
# OUT="all_code_dump_dotnet.txt"

echo "=== Debug: Starting dump script ==="
echo "Script running in directory: $(pwd)"

# remove previous dump file if exists
if [ -f "$OUT" ]; then
  echo "Removing old output file $OUT"
  rm "$OUT"
fi

FOUND_ANY=0

# Expand all directories (handles both exact paths and globs)
# Also tracks which should be searched non-recursively
declare -a EXPANDED_DIRS
declare -a IS_NON_RECURSIVE

for dir_pattern in "${DIRS[@]}"; do
  # Check if this should be non-recursive (ends with /:)
  non_recursive=0
  if [[ "$dir_pattern" == *"/:" ]]; then
    non_recursive=1
    # Remove the /: suffix for processing
    dir_pattern="${dir_pattern%/:}"
  fi
  
  # If the pattern contains wildcards, expand it
  if [[ "$dir_pattern" == *"*"* ]] || [[ "$dir_pattern" == *"?"* ]] || [[ "$dir_pattern" == *"["* ]]; then
    # Expand the glob pattern
    expanded_count=0
    for expanded in $dir_pattern; do
      if [ -d "$expanded" ]; then
        EXPANDED_DIRS+=("$expanded")
        IS_NON_RECURSIVE+=("$non_recursive")
        ((expanded_count++))
      fi
    done
    if [ $expanded_count -eq 0 ]; then
      echo "WARNING: glob pattern '$dir_pattern' matched no directories (skipping)"
    fi
  else
    # Not a glob, add as-is
    EXPANDED_DIRS+=("$dir_pattern")
    IS_NON_RECURSIVE+=("$non_recursive")
  fi
done

# If no directories after expansion, warn and exit
if [ ${#EXPANDED_DIRS[@]} -eq 0 ]; then
  echo "ERROR: No directories found after expansion. Check your DIRS patterns."
  exit 1
fi

echo "Directories to search:"
for i in "${!EXPANDED_DIRS[@]}"; do
  dir="${EXPANDED_DIRS[$i]}"
  is_non_rec="${IS_NON_RECURSIVE[$i]}"
  if [ "$is_non_rec" -eq 1 ]; then
    echo "  - $dir (non-recursive)"
  else
    echo "  - $dir (recursive)"
  fi
done
echo ""

for i in "${!EXPANDED_DIRS[@]}"; do
  dir="${EXPANDED_DIRS[$i]}"
  is_non_rec="${IS_NON_RECURSIVE[$i]}"
  
  if [ -d "$dir" ]; then
    if [ "$is_non_rec" -eq 1 ]; then
      echo "Searching in directory (non-recursive): $dir"
    else
      echo "Searching in directory: $dir"
    fi
    
    # build the -name part
    name_args=()
    for ext in "${EXTS[@]}"; do
      name_args+=(-name "*.${ext}" -o)
    done
    # Remove trailing -o
    unset 'name_args[-1]'

    # Collect matching files
    # Exclude bin and obj
    # Add -maxdepth 1 if non-recursive
    if [ "$is_non_rec" -eq 1 ]; then
      # matches=$(find "$dir" -maxdepth 1 -type f \( "${name_args[@]}" \) -not -path "*/bin/*" -not -path "*/obj/*")
      matches=$(find "$dir" -maxdepth 1 -type f \( "${name_args[@]}" \) -not -path "*/obj/*")
    else
      matches=$(find "$dir" -type f \( "${name_args[@]}" \) -not -path "*/obj/*")
    fi
    
    if [ -z "$matches" ]; then
      echo "  No matching files found in $dir"
    else
      FOUND_ANY=1
      # iterate over them
      while IFS= read -r file; do
        # skip if somehow matches the output file
        if [ "$file" == "$OUT" ]; then
          echo "  Skipping output file itself"
          continue
        fi
        echo "  Dumping file: $file"
        echo "===== FILE: $file =====" >> "$OUT"
        cat "$file" >> "$OUT"
        echo "" >> "$OUT"
      done <<< "$matches"
    fi
  else
    echo "WARNING: directory '$dir' does not exist (skipping)"
  fi
done

if [ "$FOUND_ANY" -eq 1 ]; then
  echo "=== Done: dumped code to $OUT ==="
else
  echo "=== No files dumped. Check your directory names and extensions. ==="
fi
