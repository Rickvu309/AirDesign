set -euo pipefail

root="${PPTX_TOOLS:-$HOME/.cache/pptx-tools}"
brand="$root/usr/lib/libreoffice"
soffice="$brand/program/soffice"
ppm="$root/usr/bin/pdftoppm"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dotnet="$(node "$here/dotnet-sdk.mjs")" || exit 1
fonts="$root/fonts/$(sha256sum "$here/reference-fonts.json" | cut -c1-16)"
stamp="$fonts/installed"

reference_fonts() {
  local mirrors="http://archive.ubuntu.com/ubuntu https://mirrors.kernel.org/ubuntu https://mirror.math.princeton.edu/pub/ubuntu"
  local packages
  mapfile -t packages < <(node -e 'for (const p of require(process.argv[1]).packages) console.log(p.file, p.sha256)' "$here/reference-fonts.json")
  if [ ! -f "$stamp" ]; then
    local work
    work="$(mktemp -d)"
    rm -rf "$fonts"
    mkdir -p "$fonts"
    local entry file sum mirror got
    for entry in "${packages[@]}"; do
      read -r file sum <<< "$entry"
      got=0
      for mirror in $mirrors; do
        if curl -fsSL --retry 3 --retry-all-errors --connect-timeout 10 --max-time 120 -o "$work/font.deb" "$mirror/$file"; then
          got=1
          break
        fi
        echo "$mirror did not serve $file, so the next mirror is tried" >&2
      done
      if [ "$got" -ne 1 ]; then
        rm -rf "$work" "$fonts"
        echo "The reference fonts did not download: $file" >&2
        exit 1
      fi
      if ! echo "$sum  $work/font.deb" | sha256sum -c --quiet; then
        rm -rf "$work" "$fonts"
        echo "The reference font package $file does not match its pinned checksum." >&2
        exit 1
      fi
      dpkg-deb -x "$work/font.deb" "$fonts"
    done
    rm -rf "$work"
    touch "$stamp"
  fi
  local base="${FONTCONFIG_FILE:-/etc/fonts/fonts.conf}"
  case "$base" in
    "$root"/fonts/*/fonts-*.conf) base=/etc/fonts/fonts.conf ;;
  esac
  local config
  config="$({
    printf '%s\n' '<?xml version="1.0"?>' '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">'
    printf '%s' "<fontconfig><include>${base}</include><dir>${fonts}/usr/share/fonts</dir>"
    node -e 'for (const a of require(process.argv[1])) process.stdout.write(`<alias binding="same"><family>${a.family}</family><prefer><family>${a.prefer}</family></prefer></alias>`)' "$here/../packages/fonts/src/twins.json"
    printf '%s\n' '</fontconfig>'
  })"
  local file
  file="$fonts/fonts-$(printf '%s' "$config" | sha256sum | cut -c1-16).conf"
  if [ ! -f "$file" ]; then
    printf '%s\n' "$config" > "$file.$$"
    mv "$file.$$" "$file"
  fi
  export FONTCONFIG_FILE="$file"
}

if [ ! -f "$root/installed" ] && command -v soffice > /dev/null && command -v pdftoppm > /dev/null; then
  reference_fonts
  PPTX_SOFFICE="$(command -v soffice)"
  export PPTX_SOFFICE
  export PPTX_DOTNET="$dotnet"
  exec "$@"
fi

if [ ! -f "$root/installed" ]; then
  debs="$root.debs"
  rm -rf "$root" "$debs"
  mkdir -p "$root" "$debs"
  if [ -n "${CI:-}" ]; then
    sudo apt-get update
  fi
  apt-get install -s --no-install-recommends libreoffice-impress poppler-utils > "$debs/packages.txt"
  mapfile -t packages < <(awk '/^Inst / { print $2 }' "$debs/packages.txt")
  packages+=(libreoffice-impress poppler-utils)
  if ! (cd "$debs" && apt-get download "${packages[@]}"); then
    echo "LibreOffice and poppler did not download. Run sudo apt-get update, then run this again." >&2
    exit 1
  fi
  found=0
  for deb in "$debs"/*.deb; do
    if [ ! -f "$deb" ]; then
      continue
    fi
    dpkg-deb -x "$deb" "$root"
    found=1
  done
  rm -rf "$debs"
  if [ "$found" -ne 1 ]; then
    echo "LibreOffice and poppler did not download." >&2
    exit 1
  fi
  if [ ! -f "$brand/program/fundamentalrc" ]; then
    echo "LibreOffice did not extract." >&2
    exit 1
  fi
  sed -i "s|/usr/lib/libreoffice|${brand}|g" "$brand/program/fundamentalrc"
  sed -i "s|/etc/libreoffice|${root}/etc/libreoffice|g" "$brand/program/fundamentalrc"
  if [ -f "$brand/program/sofficerc" ]; then
    sed -i "s|/etc/libreoffice|${root}/etc/libreoffice|g" "$brand/program/sofficerc"
  fi
  if [ -f "$brand/program/java-set-classpath" ]; then
    sed -i "s|/usr/lib/libreoffice|${brand}|g" "$brand/program/java-set-classpath"
  fi
  if [ -f "$brand/program/unopkg" ]; then
    sed -i "s|/usr/lib/libreoffice|${brand}|g" "$brand/program/unopkg"
  fi
  registry="$root/etc/libreoffice/registry"
  mkdir -p "$registry"
  if [ -d "$brand/share/.registry" ]; then
    while IFS= read -r source; do
      rel="${source#"$brand/share/.registry/"}"
      dest="$registry/$rel"
      if [ -e "$dest" ]; then
        continue
      fi
      mkdir -p "$(dirname "$dest")"
      ln -sfn "$source" "$dest"
    done < <(find "$brand/share/.registry" -type f)
  fi
  if [ ! -f "$registry/main.xcd" ]; then
    echo "LibreOffice registry is missing." >&2
    exit 1
  fi
  while IFS= read -r link; do
    target=$(readlink "$link")
    case "$target" in
      /*)
        if [ -e "$root$target" ]; then
          ln -sfn "$root$target" "$link"
        fi
        ;;
    esac
  done < <(find "$root" -type l)
  touch "$root/installed"
fi

if [ ! -x "$soffice" ] || [ ! -x "$ppm" ]; then
  echo "The PowerPoint tools in $root are incomplete. Delete that folder and run again." >&2
  exit 1
fi

libs="$brand/program"
extra=0
for dir in "$root"/usr/lib/*-linux-gnu; do
  if [ -d "$dir" ]; then
    libs="${libs}:${dir}"
    extra=1
  fi
done
if [ "$extra" -ne 1 ]; then
  echo "The PowerPoint tools in $root have no libraries. Delete that folder and run again." >&2
  exit 1
fi

bindir="$root/bin"
mkdir -p "$bindir"
printf '%s\n' '#!/bin/sh' \
  "export LD_LIBRARY_PATH=\"${libs}\${LD_LIBRARY_PATH:+:\$LD_LIBRARY_PATH}\"" \
  "exec \"${soffice}\" \"\$@\"" \
  > "$bindir/soffice"
printf '%s\n' '#!/bin/sh' \
  "export LD_LIBRARY_PATH=\"${libs}\${LD_LIBRARY_PATH:+:\$LD_LIBRARY_PATH}\"" \
  "exec \"${ppm}\" \"\$@\"" \
  > "$bindir/pdftoppm"
chmod +x "$bindir/soffice" "$bindir/pdftoppm"

reference_fonts

export PATH="$bindir:$PATH"
export PPTX_SOFFICE="$bindir/soffice"
export PPTX_DOTNET="$dotnet"
exec "$@"
