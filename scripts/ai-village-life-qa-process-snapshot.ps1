param([ValidatePattern('^ai-village-life-qa-desktop(?:-[a-z0-9-]+)?$')][string]$RunRoot = 'ai-village-life-qa-desktop-baseline')
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = Join-Path $repoRoot ".build/$RunRoot"
$testPid = [int](Get-Content -LiteralPath (Join-Path $testRoot 'desktop.pid') -Raw).Trim()
$carrier = Join-Path $repoRoot '.build/ai-village-phase5/carrier/DeepSeek Harness.exe'
$userData = (Join-Path $testRoot 'electron-data').Replace('\','/')
$all = @(Get-CimInstance Win32_Process)
$main = $all | Where-Object { $_.ProcessId -eq $testPid }
if (-not $main -or $main.ExecutablePath -ne $carrier -or -not $main.CommandLine.Contains($userData)) { throw 'Isolated native identity does not match.' }
$ids = [System.Collections.Generic.HashSet[int]]::new()
[void]$ids.Add($testPid)
do { $added = $false; foreach ($item in $all) { if ($ids.Contains([int]$item.ParentProcessId) -and $ids.Add([int]$item.ProcessId)) { $added = $true } } } while ($added)
$processes = foreach ($item in $all) { if ($ids.Contains([int]$item.ProcessId)) { $p = Get-Process -Id $item.ProcessId -ErrorAction SilentlyContinue; if ($p) { $role = if ($p.Id -eq $testPid) { 'browser' } elseif ($item.CommandLine -match 'dsh-desktop-host') { 'host' } elseif ($item.CommandLine -match '--type=([^ ]+)') { $Matches[1] } else { 'other-descendant' }; [PSCustomObject]@{ id=$p.Id; parentId=$item.ParentProcessId; name=$p.ProcessName; role=$role; cpuSeconds=$p.CPU; workingSetBytes=$p.WorkingSet64; privateBytes=$p.PrivateMemorySize64 } } } }
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class VillageQADpi { [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hwnd); [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd); [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); }'
$window = Get-Process -Id $testPid
[PSCustomObject]@{ sampledAt=[DateTime]::UtcNow.ToString('o'); rootPid=$testPid; dpi=[VillageQADpi]::GetDpiForWindow($window.MainWindowHandle); mainWindowHandle=$window.MainWindowHandle.ToInt64(); windowVisible=[VillageQADpi]::IsWindowVisible($window.MainWindowHandle); foreground=($window.MainWindowHandle -ne 0 -and $window.MainWindowHandle -eq [VillageQADpi]::GetForegroundWindow()); processes=@($processes); scope='Identity-verified complete descendant snapshot, including Electron-run Host; cumulative CPU seconds; process creation/exit requires interval reconciliation.' } | ConvertTo-Json -Depth 6
