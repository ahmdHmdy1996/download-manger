# Simple and reliable PNG to ICO converter
Add-Type -AssemblyName System.Drawing

$pngPath = Join-Path $PSScriptRoot "assets\icon.png"
$icoPath = Join-Path $PSScriptRoot "assets\icon.ico"

if (-not (Test-Path $pngPath)) {
    Write-Host "Error: icon.png not found!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "Converting PNG to ICO..." -ForegroundColor Cyan

try {
    # Load the image
    $img = [System.Drawing.Image]::FromFile($pngPath)
    
    # Create icon with standard size
    $icon = [System.Drawing.Icon]::FromHandle(([System.Drawing.Bitmap]$img).GetHicon())
    
    # Save as ICO file
    $fileStream = [System.IO.File]::Create($icoPath)
    $icon.Save($fileStream)
    $fileStream.Close()
    
    # Cleanup
    $icon.Dispose()
    $img.Dispose()
    
    Write-Host "`nSuccess! ICO file created!" -ForegroundColor Green
    Write-Host "Location: $icoPath" -ForegroundColor Yellow
    
    # Verify file was created
    if (Test-Path $icoPath) {
        $fileInfo = Get-Item $icoPath
        Write-Host "Size: $($fileInfo.Length) bytes" -ForegroundColor Gray
    }
    
}
catch {
    Write-Host "`nError: $_" -ForegroundColor Red
}

Read-Host "`nPress Enter to exit"
