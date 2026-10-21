$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$distRoot = Join-Path $repoRoot 'dist'
$kit = Join-Path $distRoot 'desktop-pets-carrier-0.2.1-rc.2'
$manifest = Get-Content -LiteralPath (Join-Path $kit 'manifest.json') -Raw | ConvertFrom-Json
$verified = Get-Content -LiteralPath (Join-Path $repoRoot '.build/pet-native-qa/validation.json') -Raw | ConvertFrom-Json
$plugins = Get-Content -LiteralPath (Join-Path $distRoot 'manifest.json') -Raw | ConvertFrom-Json
$pet = $plugins | Where-Object name -EQ '@nidofy/dsh-desktop-pets'
if (-not $verified.passed -or $verified.sha256 -ne $pet.sha256) { throw 'Native Desktop qualification is required for this pet package.' }
if ((Get-FileHash -LiteralPath (Join-Path $kit 'app.asar') -Algorithm SHA256).Hash -ne $manifest.asarSha256) { throw 'Carrier hash mismatch.' }
if ((Get-FileHash -LiteralPath (Join-Path $repoRoot '.build/pet-native-qa/carrier/resources/app.asar') -Algorithm SHA256).Hash -ne $manifest.asarSha256) { throw 'Tested carrier differs from delivery.' }
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs/releases/native-pets-tall-village-2026-10-21.md') -Destination (Join-Path $kit 'README.md') -Force
Copy-Item -LiteralPath (Join-Path $repoRoot '.build/pet-native-qa/validation.json') -Destination (Join-Path $kit 'validation.json') -Force
$files = @('app.asar','manifest.json','Install-PetCarrier.ps1','README.md','validation.json' | ForEach-Object { Join-Path $kit $_ })
$archive = Join-Path $distRoot 'dsh-desktop-pets-carrier-0.2.1-rc.2-win32-x64.zip'
Compress-Archive -LiteralPath $files -DestinationPath $archive -CompressionLevel Optimal -Force
$digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath ($archive + '.sha256') -Value ($digest + '  ' + [IO.Path]::GetFileName($archive)) -Encoding ascii
Write-Output "Native pet carrier archive: $archive"
Write-Output "SHA-256: $digest"
