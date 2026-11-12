set -euo pipefail

root="${PPTX_TOOLS:-$HOME/.cache/pptx-tools}"
brand="$root/usr/lib/libreoffice"
soffice="$brand/program/soffice"
ppm="$root/usr/bin/pdftoppm"
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dotnet="$(node "$here/dotnet-sdk.mjs")" || exit 1

if [ ! -f "$root/installed" ] && command -v soffice > /dev/null && command -v pdftoppm > /dev/null; then
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

export PATH="$bindir:$PATH"
export PPTX_SOFFICE="$bindir/soffice"
export PPTX_DOTNET="$dotnet"
exec "$@"
