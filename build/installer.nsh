; Дополнение к установщику NSIS, который генерирует electron-builder.
; customUnInstall выполняется при удалении приложения.

!macro customUnInstall
  ; Убираем запись автозапуска (имя — AUTOSTART_NAME в src/main/autostart.ts),
  ; иначе после удаления Windows пыталась бы запускать несуществующий файл.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Gamekeeper"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Gamekeeper"
!macroend
