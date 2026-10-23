; Instalujemy gotową paczkę Electron. AppVersion musi odpowiadać wersji w package.json.
#define AppName "Cinema Movie Finder"
#define AppVersion "1.4.0"

[Setup]
AppId={{3B85FCA4-BEC8-4CB3-945C-D9A7D1C34821}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Cinema Movie Finder
DefaultDirName={localappdata}\Programs\Cinema Movie Finder
DefaultGroupName={#AppName}
UninstallDisplayIcon={app}\CinemaMovieFinder.exe
UninstallFilesDir={app}\Cinema Movie Finder Files\Uninstall
OutputDir=..\..\dist\windows-installer
OutputBaseFilename=CinemaMovieFinder-Setup
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
Uninstallable=yes
SetupIconFile=icon.ico
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "polish"; MessagesFile: "compiler:Languages\Polish.isl"

[Tasks]
Name: "desktopicon"; Description: "Utworz skrot na pulpicie"; GroupDescription: "Dodatkowe skroty:"; Flags: unchecked

[Files]
Source: "..\..\dist\CinemaMovieFinder-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Cinema Movie Finder"; Filename: "{app}\CinemaMovieFinder.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\Cinema Movie Finder"; Filename: "{app}\CinemaMovieFinder.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\CinemaMovieFinder.exe"; Description: "Uruchom Cinema Movie Finder"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "{sys}\cmd.exe"; Parameters: "/C taskkill /F /IM CinemaMovieFinder.exe /T >nul 2>&1"; Flags: runhidden waituntilterminated; RunOnceId: "CloseCinemaMovieFinder"

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
Type: filesandordirs; Name: "{userappdata}\cinema-movie-finder"
Type: filesandordirs; Name: "{localappdata}\cinema-movie-finder"
Type: filesandordirs; Name: "{userappdata}\Cinema Movie Finder"
Type: filesandordirs; Name: "{localappdata}\Cinema Movie Finder"
Type: filesandordirs; Name: "{userappdata}\CinemaMovieFinder"
Type: filesandordirs; Name: "{localappdata}\CinemaMovieFinder"
