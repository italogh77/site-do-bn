@echo off
set "GIT_DESKTOP_APP="

for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "(Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'GitHubDesktop') -Directory -Filter 'app-*' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName"`) do set "GIT_DESKTOP_APP=%%D"

if defined GIT_DESKTOP_APP (
    set "GIT_DESKTOP_ROOT=%GIT_DESKTOP_APP%\resources\app\git"
    set "PATH=%PATH%;%GIT_DESKTOP_APP%\resources\app\git\cmd;%GIT_DESKTOP_APP%\resources\app\git\mingw64\bin"
)
