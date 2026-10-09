; installer/setup.iss
; Inno Setup Script for Paper Aquarium (Бумажный Аквариум)

#define MyAppName "Paper Aquarium"
#define MyAppNameRu "Бумажный Аквариум"
#define MyAppVersion "1.4.0"
#define MyAppPublisher "Paper Aquarium Contributors"
#define MyAppExeName "PaperAquarium.exe"

[Setup]
AppId={{C481498B-D3F5-4BE7-96A1-E59B399C8D2F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\Paper Aquarium
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\dist
OutputBaseFilename=PaperAquarium-Setup
SetupIconFile=..\assets\app-icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\assets\app-icon.ico
WizardStyle=modern

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
russian.BeveledLabel=Бумажный Аквариум
english.BeveledLabel=Paper Aquarium

[CustomMessages]
russian.DesktopIcon=Создать значок на Рабочем столе
english.DesktopIcon=Create a desktop shortcut
russian.LaunchApp=Запустить Бумажный Аквариум сейчас
english.LaunchApp=Launch Paper Aquarium now
russian.DataNotice=Все аквариумы и рисунки сохраняются в папке пользователя: %APPDATA%\PaperAquarium
english.DataNotice=All tanks and fish drawings are saved in: %APPDATA%\PaperAquarium

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; Основной исполняемый лаунчер
Source: "..\PaperAquarium.exe"; DestDir: "{app}"; Flags: ignoreversion
; Встроенная среда выполнения Node.js (автономность)
Source: "..\runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
; Исходные файлы сервера и статики
Source: "..\server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\*.html"; DestDir: "{app}"; Flags: ignoreversion

; Ресурсы и ассеты
Source: "..\assets\*"; DestDir: "{app}\assets"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\demos\*"; DestDir: "{app}\demos"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\vendor\*"; DestDir: "{app}\vendor"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\assets\app-icon.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\assets\app-icon.ico"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchApp}"; Flags: nowait postinstall skipifsilent
