@echo off
title ExpCard Converter
color 0B
mode con: cols=58 lines=35
cd /d "%~dp0"

:menu
cls
echo.
echo    +----------------------------------------------------+
echo    ^|                                                    ^|
echo    ^|      _____ _____ _____ ____  __  __ ____  _     __ ^|
echo    ^|     ^|  ___^|  _  ^|  _  ^|  _ ^|  \/  ^|  _ ^| ^|   / _ ^|^|
echo    ^|     ^| ^|_  ^| ^|_\\| ^|_^| ^| ^|_) ^| ^|\/^| ^| ^|_) ^| ^|  ^| ^| ^|^|
echo    ^|     ^|  _^| ^|  _ ^|  _ ^|  _ ^|^| ^|  ^| ^|  __/^| ^|__^| ^|_^|^|
echo    ^|     ^|_^|   ^|_^| ^|_^| ^|_^| ^|\_\^|_^|  ^|_^|_^|    ^|_____\___/^|
echo    ^|                                                    ^|
echo    ^|           [ Excel to Markdown Converter ]          ^|
echo    ^|                                                    ^|
echo    +----------------------------------------------------+
echo.
echo    +----------------------------------------------------+
echo    ^|                                                    ^|
echo    ^|    [ 1 ]  Start Server                             ^|
echo    ^|                                                    ^|
echo    ^|    [ 2 ]  Edit Config                              ^|
echo    ^|                                                    ^|
echo    ^|    [ 3 ]  Help                                     ^|
echo    ^|                                                    ^|
echo    ^|    [ 0 ]  Exit                                     ^|
echo    ^|                                                    ^|
echo    +----------------------------------------------------+
echo.
set /p choice="    Select [0-3]: "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto config
if "%choice%"=="3" goto help
if "%choice%"=="0" goto exit

echo.
echo    Invalid option!
timeout /t 2 >nul
goto menu

:start
cls
echo.
echo    +----------------------------------------------------+
echo    ^|                                                    ^|
echo    ^|              Starting Server...                    ^|
echo    ^|                                                    ^|
echo    +----------------------------------------------------+
echo.
echo    Address  : http://localhost:3210
echo    Stop     : Press Ctrl+C
echo.
echo    -----------------------------------------------------
echo.

if exist "expcard-converter.exe" (
    echo    [Info] Running packaged version...
    echo.
    expcard-converter.exe
    if errorlevel 1 (
        echo.
        echo    [ERROR] Server crashed! Error code: %errorlevel%
        echo    Please ensure:
        echo      1. No antivirus is blocking the program
        echo      2. Visual C++ Redistributable is installed
        echo         Download: https://aka.ms/vs/17/release/vc_redist.x64.exe
        echo.
        pause
        goto menu
    )
) else (
    echo    [Info] Packaged version not found, using Node.js...
    echo.
    node -v >nul 2>&1
    if errorlevel 1 (
        echo    [ERROR] Node.js not found!
        echo        Download: https://nodejs.org/
        echo.
        pause
        goto menu
    )
    node server.js
    if errorlevel 1 (
        echo.
        echo    [ERROR] Server crashed! Error code: %errorlevel%
        echo.
        pause
        goto menu
    )
)
goto menu

:config
cls
echo.
echo    +----------------------------------------------------+
echo    ^|                                                    ^|
echo    ^|              Config File                           ^|
echo    ^|                                                    ^|
echo    +----------------------------------------------------+
echo.
echo    File     : config.js
echo.
echo    Editable:
echo      - LOGIC_OPERATORS      (Logic operators)
echo      - SPECIAL_SEPARATORS   (Special separators)
echo      - SKIP_HEADERS         (Skip headers)
echo      - SECTION_HEADERS      (Section headers)
echo.
echo    Note: Restart server after edit.
echo.
echo    -----------------------------------------------------
echo.
if exist "config.js" (
    echo    Opening config.js...
    notepad config.js
) else (
    echo    [!] config.js not found!
)
pause
goto menu

:help
cls
echo.
echo    +----------------------------------------------------+
echo    ^|                                                    ^|
echo    ^|              Help                                  ^|
echo    ^|                                                    ^|
echo    +----------------------------------------------------+
echo.
echo    Quick Start:
echo      1. Double click start.bat
echo      2. Open http://localhost:3210
echo      3. Upload .xlsx file
echo      4. Select sheet and range
echo      5. Click Convert button
echo      6. Preview and export result
echo.
echo    Support Modes:
echo      - Sub-number mode (x.y format)
echo      - Pure number mode (column nesting)
echo.
echo    Special Separators:
echo      - "or delay" converts to "or"
echo      - "and delay" converts to "and"
echo.
echo    -----------------------------------------------------
echo.
pause
goto menu

:exit
exit /b 0

:end
pause
goto menu
