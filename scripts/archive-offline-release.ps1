$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$distRoot = Join-Path $repoRoot 'dist'
$manifest = Get-Content -LiteralPath (Join-Path $distRoot 'manifest.json') -Raw | ConvertFrom-Json
$validation = Get-Content -LiteralPath (Join-Path $distRoot 'offline-validation.json') -Raw | ConvertFrom-Json
$runtimeValidation = Get-Content -LiteralPath (Join-Path $distRoot 'runtime-install-validation.json') -Raw | ConvertFrom-Json
if (-not $runtimeValidation.passed -or $runtimeValidation.elevated -or $runtimeValidation.results.Count -ne 3) { throw 'Non-administrator installation qualification is required.' }
foreach ($checked in $runtimeValidation.results) {
  $current = $manifest | Where-Object name -EQ $checked.name
  if (-not $current -or $current.sha256 -ne $checked.sha256 -or $checked.exitCode -ne 0) { throw "Re-run runtime installation qualification: $($checked.name)" }
}
$expected = @(Get-ChildItem -LiteralPath (Join-Path $repoRoot 'packages') -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'package.json') })
if ($manifest.Count -ne $expected.Count -or -not $validation.passed) { throw 'All packages must pass offline qualification first.' }
foreach ($item in $manifest) {
  $artifact = [IO.Path]::GetFullPath((Join-Path $distRoot $item.file))
  if (-not $artifact.StartsWith($distRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid artifact path.' }
  if ((Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256) { throw "Artifact hash mismatch: $($item.file)" }
  $checked = $validation.artifacts | Where-Object name -EQ $item.name
  if ($checked.sha256 -ne $item.sha256) { throw "Re-run offline qualification: $($item.name)" }
}
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs/releases/ui-fixes-2026-10-21.md') -Destination (Join-Path $distRoot 'INSTALL.md') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'scripts/diagnose-plugin-install.ps1') -Destination (Join-Path $distRoot 'diagnose-plugin-install.ps1') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs/releases/native-pets-tall-village-2026-10-21.md') -Destination (Join-Path $distRoot 'NATIVE-PETS-AND-VILLAGE.md') -Force
$files = @($manifest | ForEach-Object { Join-Path $distRoot $_.file }) + @('manifest.json', 'offline-validation.json', 'INSTALL.md', 'NATIVE-PETS-AND-VILLAGE.md', 'diagnose-plugin-install.ps1', 'runtime-install-validation.json' | ForEach-Object { Join-Path $distRoot $_ })
$archive = Join-Path $distRoot 'dsh-plugins-0.2.1-rc.2-win32-x64-offline.zip'
Compress-Archive -LiteralPath $files -DestinationPath $archive -CompressionLevel Optimal -Force
$digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath ($archive + '.sha256') -Value ($digest + '  ' + [IO.Path]::GetFileName($archive)) -Encoding ascii
Write-Output "Offline archive: $archive"
Write-Output "SHA-256: $digest"
