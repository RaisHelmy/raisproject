# Convenience wrapper: installs the Task Scheduler task for git-sync-daemon.
# Usage: .\install-windows.ps1 -Root "C:\path\to\projects" [-Root "D:\more\projects"]
param(
  [Parameter(Mandatory = $true)]
  [string[]]$Root
)

$Dir = Split-Path -Parent $PSScriptRoot
$Script = Join-Path $Dir "bin\git-sync.js"

$nodeArgs = @("install")
foreach ($r in $Root) {
  $nodeArgs += "--root"
  $nodeArgs += $r
}

& node $Script @nodeArgs
