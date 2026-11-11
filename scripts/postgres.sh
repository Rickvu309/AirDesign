set -euo pipefail

root="${PGSQL_ROOT:-$HOME/.local/pgsql-18}"
if [ -x "$root/usr/lib/postgresql/18/bin/postgres" ]; then
  exit 0
fi

here="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
pgdg="https://apt.postgresql.org/pub/repos/apt"
index="main/binary-amd64/Packages.gz"

fetch() {
  curl -fsSL --retry 5 --retry-all-errors -o "$2" "$1"
}

checked() {
  echo "$1  $2" | sha256sum -c --quiet
}

gpg --batch --yes --dearmor -o "$work/key.gpg" "$here/.github/postgresql-archive.asc"
fetch "$pgdg/dists/noble-pgdg/InRelease" "$work/InRelease"
gpgv --quiet --keyring "$work/key.gpg" --output "$work/Release" "$work/InRelease"
fetch "$pgdg/dists/noble-pgdg/$index" "$work/Packages.gz"
checked "$(awk -v file="$index" '/^SHA256:/ { on = 1; next } /^[^ ]/ { on = 0 } on && $3 == file { print $1 }' "$work/Release")" "$work/Packages.gz"
gunzip "$work/Packages.gz"

mkdir -p "$root"
for package in postgresql-18 libpq5; do
  read -r file sum < <(awk -v package="$package" '
    $1 == "Package:" { on = ($2 == package) }
    on && $1 == "Filename:" { file = $2 }
    on && $1 == "SHA256:" { print file, $2 }' "$work/Packages" | sort -V | tail -1)
  fetch "$pgdg/$file" "$work/$package.deb"
  checked "$sum" "$work/$package.deb"
  dpkg-deb -x "$work/$package.deb" "$root"
done

fetch "http://archive.ubuntu.com/ubuntu/pool/main/libu/liburing/liburing2_2.5-1build1_amd64.deb" "$work/liburing2.deb"
checked "c2aef62accee92a06263c3ad4ef46132c13e409b54296c44792a20491830a7b0" "$work/liburing2.deb"
dpkg-deb -x "$work/liburing2.deb" "$root"

library="$(dirname "$(find "$root" -name 'libpq.so.5' | head -1)")"
LD_LIBRARY_PATH="$library" "$root/usr/lib/postgresql/18/bin/postgres" --version
