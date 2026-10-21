param([string]$ProfilePath = (Join-Path $env:USERPROFILE '.dsh/profiles/desktop'))
$ErrorActionPreference = 'Stop'
$profileRoot = (Resolve-Path -LiteralPath $ProfilePath).Path
if (-not (Test-Path -LiteralPath (Join-Path $profileRoot 'package.json'))) { throw 'Choose the DSH profile directory containing package.json.' }
$report = [ordered]@{
  administrator = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  profile = $profileRoot
  profileAttributes = [string](Get-Item -LiteralPath $profileRoot).Attributes
  packageManager = $null
  installSettings = @()
  packageDirectories = @()
  directoryAccess = @()
  loadedPluginBinaries = @()
  moduleInspectionErrors = @()
  permissionErrors = @()
}
foreach ($relative in @('.', 'node_modules', 'node_modules/@nidofy', 'node_modules/@nidofy/dsh-runtime-adapter', 'node_modules/@nidofy/dsh-runtime-adapter/node_modules', 'node_modules/@nidofy/dsh-working-notebook', 'node_modules/@nidofy/dsh-working-notebook/node_modules')) {
  $path = Join-Path $profileRoot $relative
  if (-not (Test-Path -LiteralPath $path)) { continue }
  try {
    $item = Get-Item -LiteralPath $path -Force
    $acl = Get-Acl -LiteralPath $path
    $report.directoryAccess += [pscustomobject]@{
      path=$item.FullName; attributes=[string]$item.Attributes; linkType=$item.LinkType; target=$item.Target
      owner=$acl.Owner; access=$acl.AccessToString
    }
  } catch { $report.directoryAccess += [pscustomobject]@{path=$path;error=$_.Exception.Message} }
}
# Read loaded module paths, not command lines (which can contain credentials).
# This can identify a loaded .node DLL, but absence is not proof of no directory lock.
foreach ($process in @(Get-Process | Where-Object { $_.ProcessName -match '^(node|electron)$|dsh|deepseek' })) {
  try {
    foreach ($module in $process.Modules) {
      if ($module.FileName.StartsWith($profileRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        $report.loadedPluginBinaries += [pscustomobject]@{pid=$process.Id;process=$process.ProcessName;file=$module.FileName}
      }
    }
  } catch { $report.moduleInspectionErrors += [pscustomobject]@{pid=$process.Id;error=$_.Exception.Message} }
}
# Inspect only installation metadata; never read notes, sessions, auth or registry tokens.
$modulesFile = Join-Path $profileRoot 'node_modules/.modules.yaml'
if (Test-Path -LiteralPath $modulesFile) {
  $report.packageManager = @(Select-String -LiteralPath $modulesFile -Pattern '^\s*"?packageManager"?\s*:' | ForEach-Object { $_.Line.Trim() })
}
$workspaceFile = Join-Path $profileRoot 'pnpm-workspace.yaml'
if (Test-Path -LiteralPath $workspaceFile) {
  $report.installSettings = @(Select-String -LiteralPath $workspaceFile -Pattern '^\s*(nodeLinker|packageImportMethod|autoInstallPeers)\s*:' | ForEach-Object { $_.Line.Trim() })
}
foreach ($relative in @('node_modules/@nidofy', 'node_modules/.ignored/@nidofy')) {
  $scopeRoot = Join-Path $profileRoot $relative
  if (-not (Test-Path -LiteralPath $scopeRoot)) { continue }
  $report.packageDirectories += @(Get-ChildItem -LiteralPath $scopeRoot -Directory -Force |
    Where-Object { $_.Name -match '^dsh-(runtime-adapter|working-notebook)(?:_tmp_\d+_\d+)?$' } |
    ForEach-Object {
      [pscustomobject]@{ path=$_.FullName; attributes=[string]$_.Attributes; lastWriteTime=$_.LastWriteTime.ToString('o') }
    })
}
# Read only: no ACL change, reinstall, cache deletion or preference modification.
$logRoot = Join-Path $profileRoot '.plugin-manager/logs'
if (Test-Path -LiteralPath $logRoot) {
  $logs = Get-ChildItem -LiteralPath $logRoot -File -Recurse | Where-Object { $_.Name -match 'pnpm|install' } | Sort-Object LastWriteTime -Descending | Select-Object -First 5
  $report.permissionErrors = @($logs | ForEach-Object {
    $file = $_
    Select-String -LiteralPath $file.FullName -Pattern '\bEPERM\b|\bEACCES\b|permission denied|using pnpm v|Moving .*_tmp_' | ForEach-Object {
      [pscustomobject]@{file=$file.FullName;line=$_.LineNumber;message=$_.Line}
    }
  })
}
$report | ConvertTo-Json -Depth 5
