$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$distRoot = Join-Path $repoRoot 'dist'
$manifest = Get-Content -LiteralPath (Join-Path $distRoot 'manifest.json') -Raw | ConvertFrom-Json
$validation = Get-Content -LiteralPath (Join-Path $distRoot 'offline-validation.json') -Raw | ConvertFrom-Json
if ($manifest.Count -ne 9 -or -not $validation.passed) { throw 'All nine packages must pass offline qualification first.' }
foreach ($item in $manifest) {
  $artifact = [IO.Path]::GetFullPath((Join-Path $distRoot $item.file))
  if (-not $artifact.StartsWith($distRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid artifact path.' }
  if ((Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256) { throw "Artifact hash mismatch: $($item.file)" }
  $checked = $validation.artifacts | Where-Object name -EQ $item.name
  if ($checked.sha256 -ne $item.sha256) { throw "Re-run offline qualification: $($item.name)" }
}
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs/releases/0.2.1-rc.2.md') -Destination (Join-Path $distRoot 'INSTALL.md') -Force
$files = @($manifest | ForEach-Object { Join-Path $distRoot $_.file }) + @('manifest.json', 'offline-validation.json', 'INSTALL.md' | ForEach-Object { Join-Path $distRoot $_ })
$archive = Join-Path $distRoot 'dsh-plugins-0.2.1-rc.2-win32-x64-offline.zip'
Compress-Archive -LiteralPath $files -DestinationPath $archive -CompressionLevel Optimal -Force
$digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath ($archive + '.sha256') -Value ($digest + '  ' + [IO.Path]::GetFileName($archive)) -Encoding ascii
Write-Output "Offline archive: $archive"
Write-Output "SHA-256: $digest"
