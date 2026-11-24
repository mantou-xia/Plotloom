[Setup]
AppId={{A7A6157D-F485-448B-87B2-55B309C10E0E}
AppName=Plotloom
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\Plotloom
DefaultGroupName=Plotloom
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#OutputPath}
OutputBaseFilename=Plotloom-{#AppVersion}-Windows-x64-Setup
Compression=lzma2/max
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
UninstallDisplayIcon={app}\Plotloom.exe
WizardStyle=modern
SetupIconFile=plotloom.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "{#StagePath}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Plotloom"; Filename: "{app}\Plotloom.exe"

[Run]
Filename: "{app}\Plotloom.exe"; Description: "Launch Plotloom"; Flags: nowait postinstall skipifsilent
