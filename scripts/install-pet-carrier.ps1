param(
  [Parameter(Mandatory=$true)][string]$SourceDirectory,
  [Parameter(Mandatory=$true)][string]$DestinationDirectory
)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath($SourceDirectory).TrimEnd('\')
$destinationRoot = [IO.Path]::GetFullPath($DestinationDirectory).TrimEnd('\')
if (Test-Path -LiteralPath $destinationRoot) { throw 'Destination must be a new directory; existing files will not be overwritten.' }
if ($destinationRoot.StartsWith($sourceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Destination must be outside the original application directory.' }
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
$original = Join-Path $sourceRoot 'resources\app.asar'
$replacement = Join-Path $PSScriptRoot 'app.asar'
if ((Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash -ne $manifest.originalAsarSha256) { throw 'This carrier does not match the verified official Windows 0.2.1-rc.2 build.' }
if ((Get-FileHash -LiteralPath $replacement -Algorithm SHA256).Hash -ne $manifest.asarSha256) { throw 'Pet carrier archive checksum failed.' }
Copy-Item -LiteralPath $sourceRoot -Destination $destinationRoot -Recurse
Copy-Item -LiteralPath $replacement -Destination (Join-Path $destinationRoot 'resources\app.asar') -Force
Write-Output "Created an adapted Desktop copy at $destinationRoot. Close other DSH windows before launching it. Import the desktop-pets 0.2.1 plugin and use Settings > Desktop pets."
