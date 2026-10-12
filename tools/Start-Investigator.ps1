param([switch]$Build,[int]$PollSeconds=3,[switch]$Once)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$config=Join-Path $root 'var\config\workbench.json'
$model=Join-Path $root 'var\config\model.json'
& (Join-Path $PSScriptRoot 'Configure-Model.ps1')
$settings=Get-Content $model -Raw | ConvertFrom-Json
if($settings.provider -notin @('openai','gemini') -or [string]::IsNullOrWhiteSpace($settings.api_key)){throw 'Live model access is not configured. Edit ignored var/config/model.json locally; never paste a key into chat. No ticket was claimed.'}
if($PollSeconds -lt 1 -or $PollSeconds -gt 60){throw 'PollSeconds must be 1–60.'}
& (Join-Path $PSScriptRoot 'Setup-DevDeskPostgres.ps1')
$latest=Join-Path $root 'devdesk\build\latest.json'
if($Build -or -not(Test-Path $latest)){& (Join-Path $PSScriptRoot 'Build-Workbench.ps1')}
$exe=Join-Path (Get-Content $latest -Raw | ConvertFrom-Json).directory 'devdesk.exe'
& $exe --model-access $model
if($LASTEXITCODE -ne 0){throw 'Live model access check failed. No queued report was claimed.'}
Write-Host 'Read-only investigator started. Start the reported playground fixture separately. Ctrl+C stops this worker; no source edits are possible.'
do {
    $info=New-Object Diagnostics.ProcessStartInfo
    $info.FileName=$exe;$info.Arguments='--worker "'+$config+'" "'+$model+'" "'+$root+'"'
    $info.UseShellExecute=$false;$info.CreateNoWindow=$true
    $child=[Diagnostics.Process]::Start($info)
    try {while(-not $child.HasExited){Start-Sleep -Milliseconds 250}}
    finally {if(-not $child.HasExited){$child.Kill();$child.WaitForExit()};$child.Dispose()}
    if(-not $Once){Start-Sleep -Seconds $PollSeconds}
} while(-not $Once)
