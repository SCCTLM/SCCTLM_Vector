; Per-user installer: no admin rights. Build: iscc /DAppVersion=X.Y.Z /DSourceDir=<dist\ext> setup.iss
#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "..\..\dist\ext"
#endif

[Setup]
AppId={{0D8B3F52-6C1A-4E57-9B0E-5C1F2A7D9E31}
AppName=SCCTLM Vector
AppVersion={#AppVersion}
AppPublisher=SCCTLM
SetupIconFile=logo.ico
DefaultDirName={userappdata}\Adobe\CEP\extensions\vn.scctlm.vector
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=SCCTLM-Vector-Setup
OutputDir=..\..\dist
Compression=lzma2
SolidCompression=yes
UninstallDisplayName=SCCTLM Vector (Illustrator panel)
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
Root: HKCU; Subkey: "Software\Adobe\CSXS.13"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"
Root: HKCU; Subkey: "Software\Adobe\CSXS.14"; ValueType: string; ValueName: "PlayerDebugMode"; ValueData: "1"

[Messages]
FinishedLabel=Installed. Restart Illustrator, then open Window > Extensions > SCCTLM Vector.

[Code]
procedure CheckDuplicateSystemInstall;
var
  Path32, Path64, FoundPaths, Msg: string;
begin
  FoundPaths := '';
  Path32 := ExpandConstant('{commoncf32}\Adobe\CEP\extensions\vn.scctlm.vector');
  if DirExists(Path32) then
    FoundPaths := Path32;

  if IsWin64 then
  begin
    Path64 := ExpandConstant('{commoncf64}\Adobe\CEP\extensions\vn.scctlm.vector');
    if (CompareText(Path64, Path32) <> 0) and DirExists(Path64) then
    begin
      if FoundPaths <> '' then
        FoundPaths := FoundPaths + #13#10 + Path64
      else
        FoundPaths := Path64;
    end;
  end;

  if FoundPaths <> '' then
  begin
    Msg :=
      'Cảnh báo: Phát hiện bản cài đặt SCCTLM Vector trùng lặp trong thư mục hệ thống:' + #13#10 +
      FoundPaths + #13#10#13#10 +
      'Việc tồn tại 2 bản cài đặt cùng lúc (Common Files và AppData) có thể gây xung đột hoặc treo Adobe Illustrator (CEP).' + #13#10 +
      'Vui lòng đóng hoàn toàn Illustrator và xóa thư mục hệ thống ở trên (cần quyền Administrator) trước khi mở lại Illustrator.';
    SuppressibleMsgBox(Msg, mbError, MB_OK, IDOK);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    CheckDuplicateSystemInstall;
end;
