param([switch]$UseVerifiedBase,[switch]$Pull)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$arguments=@('build','-t','devdesk-repair-runner:phase4')
if($Pull){$arguments+='--pull'}
if($UseVerifiedBase){
 $prior=Get-Content (Join-Path $root 'var/config/runner.json') -Raw | ConvertFrom-Json
 if(-not $prior.verified -or $prior.image -notmatch '^sha256:[a-f0-9]{64}$'){throw 'A previously verified local runner image is required.'}
 $baseTag='devdesk-verified-build-base:'+($prior.image.Substring(7,16))
 & docker tag $prior.image $baseTag
 if($LASTEXITCODE -ne 0){throw 'Verified base image is unavailable locally.'}
 $arguments+=@('--build-arg',('DEVDESK_BASE_IMAGE='+$baseTag))
}
$arguments+=(Join-Path $root 'devdesk/runner')
& docker @arguments
if($LASTEXITCODE -ne 0){throw 'Trusted runner image build failed.'}
$image=& docker image inspect devdesk-repair-runner:phase4 --format '{{.Id}}'
if($LASTEXITCODE -ne 0 -or $image -notmatch '^sha256:[a-f0-9]{64}$'){throw 'Runner image identity unavailable.'}
@{image=$image;version='phase7-runtime-v1'} | ConvertTo-Json | Set-Content (Join-Path $root 'var/config/runner.json') -Encoding UTF8
Write-Host "Trusted runner recorded: $image. Containment checks must pass before repair execution."
