# The original workspace remains the editable source. This generated Git checkout is the handoff.
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$target=[IO.Path]::GetFullPath((Join-Path $root 'var/github-submission'))
$expected=[IO.Path]::GetFullPath((Join-Path $root 'var'))+[IO.Path]::DirectorySeparatorChar
if(-not $target.StartsWith($expected,[StringComparison]::OrdinalIgnoreCase)){throw 'Submission target must stay inside workspace var.'}
if(Test-Path (Join-Path $target '.git')){
 $changes=& git -c "safe.directory=$target" -C $target status --porcelain
 if($LASTEXITCODE -ne 0){throw 'Submission Git status failed.'}
 if($changes){throw 'Submission checkout has uncommitted edits. Commit/reconcile them first; edit application source in the original workspace.'}
}
& node (Join-Path $PSScriptRoot 'Package-DevDesk.mjs')
if($LASTEXITCODE -ne 0){throw 'Source package failed; submission was not updated.'}
$package=Get-Content (Join-Path $root 'var/packages/latest.json') -Raw | ConvertFrom-Json
$manifest=Get-Content (Join-Path $package.directory 'distribution/manifest.json') -Raw | ConvertFrom-Json
$names=@($manifest.files.path)+@('distribution/manifest.json')
$marker=Join-Path $target 'distribution/submission-sync.json'
$privateRemoved=@()
if(Test-Path -LiteralPath $marker){
 $old=Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json
 foreach($relative in $old.files){
  if($names -contains $relative){continue}
  $file=[IO.Path]::GetFullPath((Join-Path $target $relative))
  if(-not $file.StartsWith(($target+[IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase) -or $relative -match '(^|/)\.git(/|$)'){throw 'Invalid previously generated file path.'}
  # Removed generated files remain locally available; untrack them after copying .gitignore.
  $privateRemoved+=@($relative)
 }
}
New-Item -ItemType Directory -Force -Path $target | Out-Null
foreach($relative in @($manifest.files.path)+@('distribution/manifest.json')){
 $destination=[IO.Path]::GetFullPath((Join-Path $target $relative))
 if(-not $destination.StartsWith(($target+[IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase) -or $relative -match '(^|/)\.git(/|$)'){throw 'Invalid package file path.'}
 New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
 Copy-Item -LiteralPath (Join-Path $package.directory $relative) -Destination $destination -Force
}
foreach($relative in $privateRemoved){
 & git -c "safe.directory=$target" -C $target check-ignore --no-index --quiet -- $relative
 if($LASTEXITCODE -ne 0){throw "Removed publication file needs an ignore rule before untracking: $relative"}
 $tracked=& git -c "safe.directory=$target" -C $target ls-files -- $relative
 if($LASTEXITCODE -ne 0){throw 'Could not inspect removed publication file.'}
 if($tracked){
  & git -c "safe.directory=$target" -C $target rm --cached -- $relative
  if($LASTEXITCODE -ne 0){throw 'Could not untrack private local file.'}
 }
}
@{files=$names;source='original workspace; edit there then sync'} | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $marker -Encoding UTF8
Write-Host "Submission synchronized: $target"
Write-Host 'Review git diff/status, then git add, commit and push. No automatic publication was performed.'
