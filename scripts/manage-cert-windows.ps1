$ErrorActionPreference = 'Stop'

$Action = $null
$ProjectRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'examples\orbit-dash-pwa'
$DryRun = $false

for ($i = 0; $i -lt $args.Count; $i += 1) {
  $arg = [string]$args[$i]
  switch ($arg) {
    '-Action' {
      $i += 1
      $Action = [string]$args[$i]
      continue
    }
    '-ProjectRoot' {
      $i += 1
      $ProjectRoot = [string]$args[$i]
      continue
    }
    '-DryRun' {
      $DryRun = $true
      continue
    }
    default {
      if (-not $Action) {
        $Action = $arg
        continue
      }
      throw "Unknown argument: $arg"
    }
  }
}

if (-not $Action) {
  throw 'Action is required. Use one of: install, remove, status, clean, reset.'
}

if ($Action -notin @('install', 'remove', 'status', 'clean', 'reset')) {
  throw "Invalid action: $Action"
}

$root = (Resolve-Path $ProjectRoot).Path
$certDir = Join-Path $root 'certs'
$rootCertCerPath = Join-Path $certDir 'root-ca-cert.cer'
$certCommonName = 'Orbit Dash Local Root CA'
$generatedFiles = @(
  'root-ca-key.pem',
  'root-ca-cert.pem',
  'root-ca-cert.cer',
  'root-ca-cert.srl',
  'local-key.pem',
  'local-cert.pem',
  'local-cert.cer',
  'local-cert.csr',
  'openssl-root.cnf',
  'openssl-local.cnf',
  'openssl-local.ext'
)

function Write-Step {
  param([string]$Message)
  Write-Host $Message -ForegroundColor Cyan
}

function Invoke-Action {
  param(
    [string]$Description,
    [scriptblock]$Script
  )

  if ($DryRun) {
    Write-Host "[dry-run] $Description" -ForegroundColor Yellow
    return
  }

  & $Script
}

function Require-RootCert {
  if (-not (Test-Path $rootCertCerPath)) {
    throw "Certificate not found: $rootCertCerPath. Generate certificates first with scripts/generate-cert.ps1."
  }
}

function Install-Cert {
  Require-RootCert
  Invoke-Action "Import root certificate into CurrentUser Root store" {
    certutil -user -addstore Root $rootCertCerPath | Out-Null
  }
  Write-Host "Certificate import completed." -ForegroundColor Green
}

function Remove-Cert {
  Invoke-Action "Remove root certificate '$certCommonName' from CurrentUser Root store" {
    certutil -user -delstore Root $certCommonName | Out-Null
  }
  Write-Host "Certificate removal completed." -ForegroundColor Green
}

function Show-Status {
  $fileStatus = [ordered]@{}
  foreach ($file in $generatedFiles) {
    $fileStatus[$file] = Test-Path (Join-Path $certDir $file)
  }

  Write-Host "Project root: $root"
  Write-Host "Certificate directory: $certDir"
  Write-Host "Generated files:"
  foreach ($entry in $fileStatus.GetEnumerator()) {
    Write-Host ("  {0}: {1}" -f $entry.Key, ($(if ($entry.Value) { 'present' } else { 'missing' })))
  }

  $inStore = certutil -user -store Root $certCommonName 2>$null | Out-String
  if ($LASTEXITCODE -eq 0 -and $inStore -match [regex]::Escape($certCommonName)) {
    Write-Host "Trusted root store: installed ($certCommonName)" -ForegroundColor Green
  } else {
    Write-Host "Trusted root store: not installed ($certCommonName)" -ForegroundColor Yellow
  }
}

function Clean-Artifacts {
  foreach ($file in $generatedFiles) {
    $target = Join-Path $certDir $file
    if (Test-Path $target) {
      Invoke-Action "Delete generated file $target" {
        Remove-Item $target -Force
      }
    }
  }
  Write-Host "Generated certificate artifacts cleaned." -ForegroundColor Green
}

switch ($Action) {
  'install' { Install-Cert }
  'remove' { Remove-Cert }
  'status' { Show-Status }
  'clean' { Clean-Artifacts }
  'reset' {
    Remove-Cert
    Clean-Artifacts
  }
}
