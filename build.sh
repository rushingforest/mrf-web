#!/bin/bash

# Exit on error
set -e

echo "=== Building MRF WASM Module ==="

# Check for emcc
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten (emcc) not found. Please install it first."
    exit 1
fi

# Output files
OUTPUT_JS="mrf.js"
OUTPUT_WASM="mrf.wasm"

# Compile
# We split the compilation to handle C and C++ flags correctly.
# -x c++ forces the compiler to treat the following file as C++
echo "Compiling mrf.c and mrf_bindings.cpp..."

emcc \
    mrf.c \
    mrf_bindings.cpp \
    -x c++ \
    -o "$OUTPUT_JS" \
    -lembind \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createMRFModule" \
    -s EXPORT_ES6=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -O3 \
    -Wall \
    -std=c++17

echo "Build complete!"
echo "Generated: $OUTPUT_JS and $OUTPUT_WASM"
echo ""
echo "To test, include 'mrf.js' in your HTML or Node.js environment."