$keyPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.downloadmanager.native"
$jsonPath = "d:\download app\native-host\com.downloadmanager.native.json"

Write-Host "Registering Native Host..."

if (!(Test-Path $keyPath)) {
    New-Item -Path $keyPath -Force | Out-Null
    Write-Host "Created new registry key."
}

Set-ItemProperty -Path $keyPath -Name "(Default)" -Value $jsonPath
Write-Host "Registry key set to: $jsonPath"
Write-Host "Done! You can now test the extension."
