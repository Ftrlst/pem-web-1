#requires -RunAsAdministrator
<#
  Mengalihkan MySQL 8.0 (service MySQL80) dari port 3306 ke 3307.

  Latar belakang: port 3306 sedang dipakai MariaDB 10.4 yang menyimpan database
  project lain (brandkita.id). MariaDB tidak akan disentuh oleh skrip ini.

  Jalankan di PowerShell sebagai Administrator:
      powershell -ExecutionPolicy Bypass -File .\scripts\start-mysql8-on-3307.ps1
#>

[CmdletBinding()]
param(
    [int]$Port = 3307
)

$ErrorActionPreference = 'Stop'

$iniPath    = 'C:\ProgramData\MySQL\MySQL Server 8.0\my.ini'
$serviceName = 'MySQL80'
$mysqlExe   = 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    OK: $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    ! $msg" -ForegroundColor Yellow }

# Catatan: $IsAdmin hanya tersedia di PowerShell 7+. Di Windows PowerShell 5.1
# nilainya $null. Karena itu selalu verifikasi sendiri memakai WindowsPrincipal.
$identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isElevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isElevated) {
    Write-Warn 'Script dijalankan WITHOUT hak Administrator; start service akan gagal.'
    Write-Host '    Jalankan ulang dari PowerShell yang dibuka sebagai Administrator.' -ForegroundColor Yellow
    exit 1
}

# 1. Pastikan file config ada
if (-not (Test-Path -LiteralPath $iniPath)) {
    throw "my.ini tidak ditemukan di $iniPath"
}
Write-Step "Membaca $iniPath"

# 2. Backup config
$backupPath = "$iniPath.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $iniPath -Destination $backupPath -Force
Write-Ok "Backup dibuat: $backupPath"

# 3. Hentikan service bila sedang berjalan
$svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($null -eq $svc) {
    throw "Service '$serviceName' tidak ditemukan. Pastikan MySQL Server 8.0 sudah terinstall."
}
if ($svc.Status -eq 'Running') {
    Write-Step "Menghentikan service $serviceName"
    Stop-Service -Name $serviceName -Force
    $svc.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
    Write-Ok 'Service dihentikan'
}

# 4. Ganti SEMUA baris "port=" (terdaftar di [client] dan [mysqld])
$content = Get-Content -LiteralPath $iniPath -Raw
$pattern = '(?m)^(\s*)port\s*=\s*\d+\s*$'
$matches = [regex]::Matches($content, $pattern)

if ($matches.Count -eq 0) {
    Write-Warn 'Tidak ada baris "port=" ditemukan; konfigurasi dibiarkan apa adanya.'
} else {
    $updated = [regex]::Replace($content, $pattern, "`${1}port = $Port")
    # Pertahankan line ending asli
    $eol = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
    $updated = $updated -replace "`r?`n", $eol
    Set-Content -LiteralPath $iniPath -Value $updated -NoNewline -Encoding UTF8
    Write-Ok "$($matches.Count) baris port diubah menjadi $Port"
}

# 5. Jalankan service
Write-Step "Menjalankan service $serviceName"
try {
    Start-Service -Name $serviceName
    (Get-Service -Name $serviceName).WaitForStatus('Running', [TimeSpan]::FromSeconds(60))
    Write-Ok 'Service Running'
} catch {
    Write-Warn "Gagal start service: $($_.Exception.Message)"
    Write-Host '    Periksa log error:' -ForegroundColor Yellow
    Write-Host '      Get-Content "C:\ProgramData\MySQL\MySQL Server 8.0\Data\*.err" -Tail 40' -ForegroundColor Yellow
    exit 1
}

# 6. Tunggu sampai benar-benar siap menerima koneksi
Write-Step 'Menunggu MySQL siap menerima koneksi'
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    $tcp = Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -WarningAction SilentlyContinue
    if ($tcp.TcpTestSucceeded) { $ready = $true; break }
    Start-Sleep -Seconds 2
}

if (-not $ready) {
    Write-Warn "Port $Port belum terbuka. Periksa log error MySQL."
    exit 1
}
Write-Ok "Port $Port terbuka"

# 7. Laporkan versi server
if (Test-Path -LiteralPath $mysqlExe) {
    Write-Step 'Versi server'
    $env:MYSQL_PWD = ''
    & $mysqlExe -h 127.0.0.1 -P $Port -u root -e 'SELECT VERSION();' 2>&1 |
        ForEach-Object { Write-Host "    $_" }
}

Write-Host ''
Write-Host 'SELESAI' -ForegroundColor Green
Write-Host "MySQL 8.0 sekarang berjalan di port $Port." -ForegroundColor Green
Write-Host 'MariaDB di port 3306 tidak diubah.' -ForegroundColor Green
Write-Host ''
Write-Host 'Langkah berikutnya:' -ForegroundColor Cyan
Write-Host "  1. Jalankan SQL bootstrap (Workbench): infra\mysql\bootstrap.sql"
Write-Host '  2. Ganti kredensial di .env dan apps\api\.env'
Write-Host "  3. pnpm db:migrate:deploy"
Write-Host '  4. pnpm test:integration'
Write-Host ''