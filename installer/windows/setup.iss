; Per-user installer: no admin rights. Build: iscc /DAppVersion=X.Y.Z /DSourceDir=<dist\ext> setup.iss
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\..\dist\ext"
#endif

[Setup]
AppId={{0D8B3F52-6C1A-4E57-9B0E-5C1F2A7D9E31}
AppName=SCCTLM Ilus
AppVersion={#AppVersion}
AppPublisher=SCCTLM
DefaultDirName={userappdata}\Adobe\CEP\extensions\vn.scctlm.ilus
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=SCCTLM-Ilus-Setup
OutputDir=..\..\dist
Compression=lzma2
SolidCompression=yes
UninstallDisplayName=SCCTLM Ilus (Illustrator panel)
LicenseFile=..\..\LICENSE

[InstallDelete]
; Replace the whole extension on reinstall, including any app.prev left by an update.
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\app.prev"
Type: filesandordirs; Name: "{app}\app.staging"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Registry]
; Let Illustrator load unsigned CEP panels. Left in place on uninstall: other panels may rely on them.
Root: HKCU; Subkey: "Software\Adobe\CSXS.9";  ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.10"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.11"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.12"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"

[Messages]
FinishedLabel=Installed. Restart Illustrator, then open Window > Extensions > SCCTLM Ilus.
