param([switch]$Baseline)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$bundle=Join-Path $root 'distribution/playground.bundle'
$catalog=Join-Path $root 'distribution/fixtures.json'
if(-not(Test-Path -LiteralPath $bundle) -or -not(Test-Path -LiteralPath $catalog)){throw 'Run this bootstrap from the extracted source package.'}
$manifest=Get-Content -LiteralPath $catalog -Raw | ConvertFrom-Json
$repo=Join-Path $root 'playground'
if(-not(Test-Path -LiteralPath $repo)){
 & git clone --branch main -- $bundle $repo
 if($LASTEXITCODE -ne 0){throw 'Playground bundle clone failed.'}
} elseif(-not(Test-Path -LiteralPath (Join-Path $repo '.git'))){throw 'Existing playground is not a Git checkout; it was preserved.'}
$fixtures=Join-Path $root 'var/fixtures'
New-Item -ItemType Directory -Force -Path $fixtures | Out-Null
foreach($profile in @('frontend','backend','feature')){
 $target=Join-Path $fixtures $profile
 if(Test-Path -LiteralPath $target){Write-Host "Preserving existing $profile fixture; no source reset.";continue}
 $entry=$manifest.$profile
 $commit=if($Baseline){$entry.baseline}else{$entry.accepted}
 if($commit -notmatch '^[a-f0-9]{40}$'){throw 'Invalid packaged fixture identity.'}
 & git -c "safe.directory=$repo" -C $repo worktree add --detach $target $commit
 if($LASTEXITCODE -ne 0){throw "Could not restore $profile fixture; existing source was preserved."}
}
Write-Host 'Packaged Git history and fixtures restored. Application code has not been built or executed.'
