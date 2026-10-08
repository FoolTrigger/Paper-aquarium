# tools/build-launcher.ps1
# Компиляция нативного Windows-лаунчера PaperAquarium.exe

$rootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$cscPath = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path $cscPath)) {
    $cscPath = "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}

if (-not (Test-Path $cscPath)) {
    Write-Error "Компилятор csc.exe не найден в системе Windows!"
    exit 1
}

$sourceFile = Join-Path $rootDir "src\launcher\Program.cs"
$iconFile = Join-Path $rootDir "assets\app-icon.ico"
$outputExe = Join-Path $rootDir "PaperAquarium.exe"

Write-Host "Компиляция лаунчера PaperAquarium.exe..."
$params = @(
    "/target:winexe",
    "/optimize+",
    "/platform:anycpu",
    "/win32icon:`"$iconFile`"",
    "/out:`"$outputExe`"",
    "/reference:System.dll,System.Windows.Forms.dll,System.Drawing.dll,System.Net.dll",
    "`"$sourceFile`""
)

& $cscPath $params

if ($LASTEXITCODE -eq 0 -and (Test-Path $outputExe)) {
    Write-Host "Лаунчер успешно скомпилирован:"
    Write-Host "  $outputExe"
    $size = (Get-Item $outputExe).Length / 1KB
    Write-Host "  Размер: $([Math]::Round($size, 1)) KB"
} else {
    Write-Error "Ошибка компиляции лаунчера!"
    exit 1
}
