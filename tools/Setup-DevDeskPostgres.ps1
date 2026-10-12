$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$bin='C:\Program Files\PostgreSQL\17\bin'
$configDir=Join-Path $root 'var/config';$data=Join-Path $root 'var/postgres-data'
New-Item -ItemType Directory -Force $configDir | Out-Null
$secretsFile=Join-Path $configDir 'postgres-admin.json'
if(-not(Test-Path $secretsFile)){
 function New-LocalSecret {$bytes=New-Object byte[] 32;[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes);return ([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()}
 @{admin=(New-LocalSecret);app=(New-LocalSecret)} | ConvertTo-Json | Set-Content $secretsFile -Encoding UTF8
}
$secrets=Get-Content $secretsFile -Raw | ConvertFrom-Json
if(-not(Test-Path (Join-Path $data 'PG_VERSION'))){
 $passwordFile=Join-Path $configDir 'postgres-init-password.tmp'
 try{[IO.File]::WriteAllText($passwordFile,$secrets.admin);& "$bin/initdb.exe" -D $data -U devdesk_admin --encoding=UTF8 --auth=scram-sha-256 --pwfile=$passwordFile | Out-Null;if($LASTEXITCODE -ne 0){throw 'Dedicated database initialization failed.'}}
 finally{if(Test-Path $passwordFile){Remove-Item -LiteralPath $passwordFile}}
}
& "$bin/pg_isready.exe" -h 127.0.0.1 -p 5433 | Out-Null
if($LASTEXITCODE -ne 0){& "$bin/pg_ctl.exe" -D $data -l (Join-Path $root 'var/postgres.log') -o '-p 5433 -h 127.0.0.1' -w start | Out-Null;if($LASTEXITCODE -ne 0){throw 'Dedicated PostgreSQL startup failed; existing data preserved.'}}
function Invoke-AdminSql([string]$database,[string]$sql){
 $info=New-Object Diagnostics.ProcessStartInfo
 $info.FileName=Join-Path $bin 'psql.exe';$info.Arguments='-X -q -t -A -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 5433 -U devdesk_admin -d '+$database
 $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.RedirectStandardInput=$true;$info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true;$info.EnvironmentVariables['PGPASSWORD']=$secrets.admin
 $child=[Diagnostics.Process]::Start($info)
 try{$output=$child.StandardOutput.ReadToEndAsync();$errors=$child.StandardError.ReadToEndAsync();$child.StandardInput.WriteLine($sql);$child.StandardInput.Close();$child.WaitForExit();$text=$output.GetAwaiter().GetResult();$null=$errors.GetAwaiter().GetResult();if($child.ExitCode -ne 0){throw 'Database setup query failed; credentials and SQL withheld.'};return $text.Trim()}
 finally{$child.Dispose()}
}
$appPassword=$secrets.app.Replace("'","''")
Invoke-AdminSql 'postgres' ("DO `$roles`$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='devdesk_owner') THEN CREATE ROLE devdesk_owner NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='devdesk_app') THEN CREATE ROLE devdesk_app LOGIN PASSWORD '$appPassword'; END IF; END `$roles`$; GRANT devdesk_owner TO devdesk_admin;") | Out-Null
if((Invoke-AdminSql 'postgres' "SELECT count(*) FROM pg_database WHERE datname='devdesk_demo';") -eq '0'){Invoke-AdminSql 'postgres' 'CREATE DATABASE devdesk_demo OWNER devdesk_owner;' | Out-Null}
$migration="CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY);`n"
foreach($file in (Get-ChildItem (Join-Path $root 'devdesk/db') -Filter '*.sql' | Sort-Object Name)){
 $migration+='DO $migration$ BEGIN IF NOT EXISTS(SELECT 1 FROM schema_migrations WHERE name='''+$file.Name+''') THEN '+(Get-Content $file.FullName -Raw)+' INSERT INTO schema_migrations(name) VALUES('''+$file.Name+'''); END IF; END $migration$;'+"`n"
}
Invoke-AdminSql 'devdesk_demo' ("REVOKE TEMP ON DATABASE devdesk_demo FROM PUBLIC; REVOKE CREATE ON SCHEMA public FROM PUBLIC; ALTER SCHEMA public OWNER TO devdesk_owner; SET ROLE devdesk_owner; BEGIN; SELECT pg_advisory_xact_lock(440040);`n"+$migration+"`nGRANT USAGE ON SCHEMA public TO devdesk_app; GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO devdesk_app; REVOKE UPDATE ON events,scope_approvals,candidate_decisions,feature_votes,feature_poll_members,feature_polls FROM devdesk_app; GRANT UPDATE(state,closed_at) ON feature_polls TO devdesk_app; REVOKE DELETE ON scope_approvals,candidate_decisions FROM devdesk_app; REVOKE INSERT,UPDATE,DELETE ON schema_migrations FROM devdesk_app; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO devdesk_app; COMMIT;") | Out-Null
$runtime=Join-Path $configDir 'workbench.json'
if(-not(Test-Path $runtime)){@{dsn="host=127.0.0.1 port=5433 dbname=devdesk_demo user=devdesk_app password=$($secrets.app)";schema='public';uploads=(Join-Path $root 'var/uploads')} | ConvertTo-Json | Set-Content $runtime -Encoding UTF8}
Write-Host 'Dedicated DevDesk PostgreSQL ready on 127.0.0.1:5433; existing data preserved.'
