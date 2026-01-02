Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d ""d:\download app"" && npm start", 0, False
Set WshShell = Nothing
