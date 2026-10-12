param([Parameter(Mandatory=$true)][ValidateNotNullOrEmpty()][string]$Message)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$target=Join-Path $root 'var/github-submission'
if(-not(Test-Path (Join-Path $target '.git'))){throw 'Prepare and connect the submission repository first; see docs/GITHUB_SUBMISSION.md.'}
& (Join-Path $PSScriptRoot 'Sync-GitHubSubmission.ps1')
& git -c "safe.directory=$target" -C $target add .
if($LASTEXITCODE -ne 0){throw 'Git staging failed.'}
& git -c "safe.directory=$target" -C $target diff --cached --quiet
if($LASTEXITCODE -eq 1){
 & git -c "safe.directory=$target" -C $target commit -m $Message
 if($LASTEXITCODE -ne 0){throw 'Git commit failed; staged changes retained.'}
} elseif($LASTEXITCODE -ne 0){throw 'Git comparison failed.'}
& git -c "safe.directory=$target" -C $target push
if($LASTEXITCODE -ne 0){throw 'Git push failed; local commit retained. Resolve authentication/remote changes, then retry push.'}
Write-Host 'Changes pushed to the configured GitHub repository.'
