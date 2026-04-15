$ErrorActionPreference = 'Stop'

param(
  [string]$ProjectRoot = $(Join-Path (Split-Path -Parent $PSScriptRoot) 'examples\orbit-dash-pwa')
)

$root = (Resolve-Path $ProjectRoot).Path
$certDir = Join-Path $root 'certs'
$rootKeyPath = Join-Path $certDir 'root-ca-key.pem'
$rootCertPemPath = Join-Path $certDir 'root-ca-cert.pem'
$rootCertCerPath = Join-Path $certDir 'root-ca-cert.cer'
$keyPath = Join-Path $certDir 'local-key.pem'
$certPath = Join-Path $certDir 'local-cert.pem'
$cerPath = Join-Path $certDir 'local-cert.cer'
$csrPath = Join-Path $certDir 'local-cert.csr'
$rootConfigPath = Join-Path $certDir 'openssl-root.cnf'
$serverConfigPath = Join-Path $certDir 'openssl-local.cnf'
$serverExtPath = Join-Path $certDir 'openssl-local.ext'

New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$ipv4Addresses = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -ne '127.0.0.1' -and
    $_.IPAddress -notlike '169.254.*' -and
    $_.PrefixOrigin -ne 'WellKnown'
  } |
  Select-Object -ExpandProperty IPAddress -Unique

$dnsNames = @('localhost')
if ($env:COMPUTERNAME) {
  $dnsNames += $env:COMPUTERNAME
}

$altNames = @()
$dnsIndex = 1
foreach ($dnsName in ($dnsNames | Select-Object -Unique)) {
  $altNames += "DNS.$dnsIndex = $dnsName"
  $dnsIndex += 1
}

$ipIndex = 1
$altNames += "IP.$ipIndex = 127.0.0.1"
$ipIndex += 1
foreach ($ip in $ipv4Addresses) {
  $altNames += "IP.$ipIndex = $ip"
  $ipIndex += 1
}

$opensslConfig = @"
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_ca

[dn]
CN = Orbit Dash Local Root CA
O = Orbit Dash

[v3_ca]
basicConstraints = critical, CA:true
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid:always,issuer
"@

Set-Content -Path $rootConfigPath -Value $opensslConfig -Encoding ASCII

$serverConfig = @"
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn

[dn]
CN = Orbit Dash Local Dev
O = Orbit Dash
"@

Set-Content -Path $serverConfigPath -Value $serverConfig -Encoding ASCII

$serverExtensions = @"
[v3_req]
subjectAltName = @alt_names
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
basicConstraints = critical, CA:FALSE

[alt_names]
$($altNames -join [Environment]::NewLine)
"@

Set-Content -Path $serverExtPath -Value $serverExtensions -Encoding ASCII

$openssl = (Get-Command openssl).Source
& $openssl req -x509 -nodes -newkey rsa:2048 -keyout $rootKeyPath -out $rootCertPemPath -days 3650 -config $rootConfigPath -extensions v3_ca | Out-Null
& $openssl x509 -in $rootCertPemPath -outform der -out $rootCertCerPath | Out-Null
& $openssl req -nodes -newkey rsa:2048 -keyout $keyPath -out $csrPath -config $serverConfigPath | Out-Null
& $openssl x509 -req -in $csrPath -CA $rootCertPemPath -CAkey $rootKeyPath -CAcreateserial -out $certPath -days 825 -sha256 -extfile $serverExtPath -extensions v3_req | Out-Null
& $openssl x509 -in $certPath -outform der -out $cerPath | Out-Null

certutil -user -addstore Root $rootCertCerPath | Out-Null

Write-Host "Created HTTPS certificate files:" -ForegroundColor Green
Write-Host "  $rootKeyPath"
Write-Host "  $rootCertPemPath"
Write-Host "  $rootCertCerPath"
Write-Host "  $keyPath"
Write-Host "  $certPath"
Write-Host "  $cerPath"
Write-Host ""
Write-Host "Installed root CA into CurrentUser Trusted Root store." -ForegroundColor Green
Write-Host "Restart Chrome/Edge if they were already open." -ForegroundColor Yellow
Write-Host ""
Write-Host "Included SAN entries:" -ForegroundColor Green
foreach ($line in $altNames) {
  Write-Host "  $line"
}
Write-Host ""
Write-Host "Project root: $root" -ForegroundColor Green
Write-Host "Start the example server from that directory, for example:" -ForegroundColor Yellow
Write-Host "  node server.js" -ForegroundColor Yellow
Write-Host "Then open the HTTPS or LAN address printed by the server." -ForegroundColor Yellow
Write-Host "On iOS / iPadOS, if Safari still marks the site as untrusted, install and trust certs/root-ca-cert.cer or a mobileconfig built from it." -ForegroundColor Yellow
