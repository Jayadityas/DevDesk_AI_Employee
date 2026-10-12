param([switch]$Build,[switch]$Once,[ValidateRange(1,60)][int]$PollSeconds=3,[ValidateRange(0,86400)][int]$RunForSeconds=0,[string]$Config='')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
if(-not $Config){$Config=Join-Path $root 'var/config/workbench.json'}
$Config=[IO.Path]::GetFullPath($Config)
if(-not $Config.StartsWith(([IO.Path]::GetFullPath((Join-Path $root 'var'))+[IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)){throw 'Worker configuration must stay under workspace var.'}
& (Join-Path $PSScriptRoot 'Setup-DevDeskPostgres.ps1')
if($Build){& (Join-Path $PSScriptRoot 'Build-Workbench.ps1')}
$release=(Get-Content (Join-Path $root 'devdesk/build/latest.json') -Raw | ConvertFrom-Json).directory
$exe=Join-Path $release 'devdesk.exe';$model=Join-Path $root 'var/config/model.json'
& $exe --model-access $model
if($LASTEXITCODE -ne 0){throw 'Model access failed; no work was claimed.'}
$deadline=if($RunForSeconds){[DateTime]::UtcNow.AddSeconds($RunForSeconds)}else{[DateTime]::MaxValue}
Write-Host 'Workers polling: recovery, integration, preview, investigation, repair. Human approval and acceptance remain required. Ctrl+C stops owned children.'
$cycles=0;$attempts=0
do{
 $cycles++
 $runner=Join-Path $root 'var/config/runner.json'
 $verified=(Test-Path $runner) -and (Get-Content $runner -Raw | ConvertFrom-Json).verified
 foreach($mode in @('--recover','--integrate','--activate-preview','--worker','--repair')){
  if([DateTime]::UtcNow -ge $deadline){break}
  if($mode -in @('--integrate','--repair','--activate-preview') -and -not $verified){continue}
  $info=New-Object Diagnostics.ProcessStartInfo
  $info.FileName=$exe;$info.Arguments=$mode+' "'+$Config+'" '+$(if($mode -in @('--integrate','--recover','--activate-preview')){''}else{'"'+$model+'" '})+'"'+$root+'"'
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
  $child=[Diagnostics.Process]::Start($info)
  $attempts++
  try{
   $stdout=$child.StandardOutput.ReadToEndAsync();$stderr=$child.StandardError.ReadToEndAsync()
   while(-not $child.HasExited -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 250}
   if(-not $child.HasExited){$child.Kill();$child.WaitForExit()}
   $output=$stdout.GetAwaiter().GetResult().Trim();$errorText=$stderr.GetAwaiter().GetResult().Trim()
   $routineRecovery=$mode -eq '--recover' -and $child.ExitCode -eq 0 -and $output -eq 'Recovery reconciled; uncertain operations were not replayed.'
   if($output -and -not $routineRecovery -and $output -notmatch '^(No eligible|No queued|Project worker busy)'){Write-Host $output}
   if($errorText){Write-Warning $errorText}
  }finally{if(-not $child.HasExited){$child.Kill();$child.WaitForExit()};$child.Dispose()}
 }
 if(-not $Once -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Seconds $PollSeconds}
}while(-not $Once -and [DateTime]::UtcNow -lt $deadline)
Write-Host "Worker launcher stopped after $cycles polling cycles ($attempts child runs)."
