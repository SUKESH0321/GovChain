$root = 'client/src'
$out = @()
Get-ChildItem $root -Recurse -File -Include *.jsx,*.js | ForEach-Object {
  $f = $_
  $c = Get-Content $f.FullName -Raw
  $ms = [regex]::Matches($c, 'from\s+[''"](\.[^''"]+)[''"]')
  foreach ($m in $ms) {
    $rel = $m.Groups[1].Value
    $base = Join-Path $f.DirectoryName $rel
    $ok = (Test-Path $base) -or (Test-Path "$base.js") -or (Test-Path "$base.jsx") -or (Test-Path "$base.json") -or (Test-Path "$base/index.js") -or (Test-Path "$base/index.jsx")
    if (-not $ok) {
      $out += ('MISSING: ' + $f.FullName.Replace((Get-Location).Path + '\', '') + ' -> ' + $rel)
    }
  }
}
if ($out.Count -eq 0) { 'ALL RELATIVE IMPORTS RESOLVE' } else { $out }
