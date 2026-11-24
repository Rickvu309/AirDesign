#!/usr/bin/env bash
set -euo pipefail

output=$(cd "$(dirname "$0")" && pwd)
source=$(cd "${1:?Pass the ICU release-77-1 checkout}" && pwd)
scratch=$(cd "${2:?Pass an empty build directory outside the repository}" && pwd)
test "$(git -C "$source" rev-parse HEAD)" = 457157a92aa053e632cc7fcfd0e12f8a943b2d11
emcc --version | head -1 | grep -q ' 4\.0\.23 '
mkdir -p "$scratch/native" "$scratch/wasm/lib" "$scratch/data"

(
  cd "$scratch/native"
  "$source/icu4c/source/runConfigureICU" Linux --disable-tests --disable-samples --disable-extras --with-data-packaging=archive
  make -j6
)

(
  cd "$scratch/wasm"
  emconfigure "$source/icu4c/source/configure" --host=i686-unknown-linux-gnu --with-cross-build="$scratch/native" \
    --enable-static --disable-shared --disable-tests --disable-samples --disable-tools --disable-extras --disable-icuio \
    --with-data-packaging=archive CFLAGS=-Oz CXXFLAGS=-Oz
  emmake make -j6 -C common
)

export LD_LIBRARY_PATH="$scratch/native/lib:$scratch/native/stubdata"
icupkg="$scratch/native/bin/icupkg"
full="$scratch/native/data/out/icudt77l.dat"
"$icupkg" -l "$full" | awk '!/^brkitr\// && !/^(nfkc\.nrm|uemoji\.icu|pool\.res|root\.res|res_index\.res)$/' > "$scratch/data/exclude.txt"
"$icupkg" -r "$scratch/data/exclude.txt" "$full" "$scratch/data/icudt77l.dat"
cd "$scratch/data"
python3 - <<'PY'
from pathlib import Path

data = Path("icudt77l.dat").read_bytes()
with Path("icu-data.cpp").open("w") as output:
    output.write('extern "C" alignas(16) const unsigned char icudt77_dat[] = {\n')
    for start in range(0, len(data), 32):
        output.write(",".join(map(str, data[start:start + 32])) + ",\n")
    output.write("};\n")
PY

em++ "$output/icu-breaks.cpp" icu-data.cpp "$scratch/wasm/lib/libicuuc.a" \
  -I "$source/icu4c/source/common" -DU_STATIC_IMPLEMENTATION -Oz -fno-exceptions --no-entry \
  -sSTANDALONE_WASM -sFILESYSTEM=0 -sALLOW_MEMORY_GROWTH=1 \
  -sINITIAL_HEAP=2097152 -sSTACK_SIZE=262144 -sMAXIMUM_MEMORY=33554432 \
  -sEXPORTED_FUNCTIONS=_malloc,_free,_ad_init,_ad_breaks,_ad_script,_ad_properties -o "$output/icu-breaks.wasm"
chmod 644 "$output/icu-breaks.wasm"
