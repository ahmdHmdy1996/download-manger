' Create shortcut for Download Manager with custom icon
Set WshShell = CreateObject("WScript.Shell")
Set oShellLink = WshShell.CreateShortcut(WshShell.CurrentDirectory & "\Download Manager.lnk")

' Set shortcut properties
oShellLink.TargetPath = WshShell.CurrentDirectory & "\start download manager.vbs"
oShellLink.WorkingDirectory = WshShell.CurrentDirectory
oShellLink.Description = "Download Manager - Advanced Download Tool"
oShellLink.IconLocation = WshShell.CurrentDirectory & "\assets\icon.ico"

' Save the shortcut
oShellLink.Save

' Show success message
MsgBox "Shortcut created successfully!" & vbCrLf & vbCrLf & _
       "You can now use 'Download Manager.lnk' with the custom icon." & vbCrLf & _
       "Feel free to move it to your Desktop or Start Menu.", _
       vbInformation, "Download Manager Setup"
