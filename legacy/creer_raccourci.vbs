Set WshShell = CreateObject("WScript.Shell")
Set oShellLink = WshShell.CreateShortcut(WshShell.SpecialFolders("Desktop") & "\Tournoi Chelles TT.lnk")
oShellLink.TargetPath = "C:\Users\franc\TT_Tournoi\start_tournoi.bat"
oShellLink.WorkingDirectory = "C:\Users\franc\TT_Tournoi"
oShellLink.WindowStyle = 1
oShellLink.IconLocation = "C:\Windows\System32\shell32.dll,13"
oShellLink.Description = "Demarrer le Tournoi Chelles TT"
oShellLink.Save

MsgBox "Raccourci cree sur le Bureau !", vbInformation, "Tournoi Chelles TT"
