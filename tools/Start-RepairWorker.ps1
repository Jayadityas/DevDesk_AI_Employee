param([switch]$Build,[switch]$Once,[switch]$PatchOnly,[int]$PollSeconds=3)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
if($PollSeconds -lt 1 -or $PollSeconds -gt 60){throw 'PollSeconds must be 1–60.'}
$runner=Join-Path $root 'var/config/runner.json'
if(-not $PatchOnly -and (-not(Test-Path $runner) -or -not(Get-Content $runner -Raw | ConvertFrom-Json).verified)){throw 'Run Build-RepairRunner and trusted_checks/phase4-isolation.mjs first; repair execution is gated on verified containment. PatchOnly can store an approved, unverified patch without executing it.'}
& (Join-Path $PSScriptRoot 'Setup-DevDeskPostgres.ps1')
$latest=Join-Path $root 'devdesk/build/latest.json'
if($Build -or -not(Test-Path $latest)){& (Join-Path $PSScriptRoot 'Build-Workbench.ps1')}
$exe=Join-Path (Get-Content $latest -Raw | ConvertFrom-Json).directory 'devdesk.exe'
$model=Join-Path $root 'var/config/model.json'
& $exe --model-access $model
if($LASTEXITCODE -ne 0){throw 'Model access check failed; queue unchanged.'}
do{
 $info=New-Object Diagnostics.ProcessStartInfo
 $mode=if($PatchOnly){'--patch-only'}else{'--repair'}
 $info.FileName=$exe;$info.Arguments=$mode+' "'+(Join-Path $root 'var/config/workbench.json')+'" "'+$model+'" "'+$root+'"';$info.UseShellExecute=$false;$info.CreateNoWindow=$true
 $child=[Diagnostics.Process]::Start($info)
 try{while(-not $child.HasExited){Start-Sleep -Milliseconds 250}}
 finally{if(-not $child.HasExited){$child.Kill();$child.WaitForExit()};$child.Dispose()}
 if(-not $Once){Start-Sleep -Seconds $PollSeconds}
}while(-not $Once)
