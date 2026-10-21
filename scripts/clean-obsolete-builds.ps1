param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$buildRoot = Join-Path $repoRoot '.build'
$distRoot = Join-Path $repoRoot 'dist'
$manifest = Get-Content -LiteralPath (Join-Path $distRoot 'manifest.json') -Raw | ConvertFrom-Json
$keep = @($manifest.file) + @('dsh-plugins-0.2.1-rc.2-win32-x64-offline.zip')
$targets = [Collections.Generic.List[string]]::new()
foreach ($entry in Get-ChildItem -LiteralPath $buildRoot -Force) {
  if ($entry.Name -match '^(pack-|installed-|offline-check-)' -or $entry.Name -in @('original-dsh', 'original-dsh.tar')) {
    $targets.Add($entry.FullName)
  }
}
foreach ($phase in 1..4) {
  $directory = Join-Path $buildRoot "ai-village-phase$phase"
  if (Test-Path -LiteralPath $directory) {
    foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
      if ($entry.Name -match '^(pack-|unpack-|extracted-|preview-)') { $targets.Add($entry.FullName) }
    }
  }
}
foreach ($entry in Get-ChildItem -LiteralPath $distRoot -File) {
  if ($entry.Extension -in @('.tgz', '.zip') -and $entry.Name -notin $keep) { $targets.Add($entry.FullName) }
}
# Never traverse a junction into toolchain/runtime sources or another repository.
$script:bytes = [long]0
$script:files = 0
function Remove-GeneratedEntry([string]$Path) {
  $absolute = [IO.Path]::GetFullPath($Path)
  if (-not ($absolute.StartsWith($buildRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
      $absolute.StartsWith($distRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase))) { throw "Outside generated roots: $absolute" }
  $entry = Get-Item -LiteralPath $absolute -Force
  if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    if ($Apply) { Remove-Item -LiteralPath $absolute -Force }
    return
  }
  if ($entry.PSIsContainer) {
    foreach ($child in Get-ChildItem -LiteralPath $absolute -Force) { Remove-GeneratedEntry $child.FullName }
    if ($Apply) { Remove-Item -LiteralPath $absolute -Force }
  } else {
    $script:bytes += $entry.Length; $script:files++
    if ($Apply) { Remove-Item -LiteralPath $absolute -Force }
  }
}
foreach ($target in $targets) { Remove-GeneratedEntry $target }
$report = [ordered]@{ applied = [bool]$Apply; directoriesOrArchives = $targets.Count; files = $script:files; bytes = $script:bytes; targets = $targets.ToArray(); retainedArtifacts = $keep }
if ($Apply) { $report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $distRoot 'cleanup-report.json') -Encoding utf8 }
$report | ConvertTo-Json -Depth 4
