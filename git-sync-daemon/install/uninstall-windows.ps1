$Dir = Split-Path -Parent $PSScriptRoot
$Script = Join-Path $Dir "bin\git-sync.js"
& node $Script uninstall
