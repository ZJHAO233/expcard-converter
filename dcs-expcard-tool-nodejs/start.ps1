if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

# ExpCard Converter - PowerShell Launcher
$Host.UI.RawUI.WindowTitle = "ExpCard Converter"
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$script:ServerPort = 3210

function Show-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "     ███████╗██████╗ ███████╗ ██████╗████████╗██████╗    " -ForegroundColor DarkCyan
    Write-Host "     ██╔════╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝██╔══██╗   " -ForegroundColor DarkCyan
    Write-Host "     █████╗  ██████╔╝█████╗  ██║        ██║   ██████╔╝   " -ForegroundColor DarkCyan
    Write-Host "     ██╔══╝  ██╔═══╝ ██╔══╝  ██║        ██║   ██╔══██╗   " -ForegroundColor DarkCyan
    Write-Host "     ███████╗██║     ███████╗╚██████╗   ██║   ██║  ██║   " -ForegroundColor DarkCyan
    Write-Host "     ╚══════╝╚═╝     ╚══════╝ ╚═════╝   ╚═╝   ╚═╝  ╚═╝   " -ForegroundColor DarkCyan
    Write-Host "  ========================================================" -ForegroundColor Cyan
    Write-Host "                  试验卡数据提取工具                       " -ForegroundColor Yellow
    Write-Host "  ========================================================" -ForegroundColor Cyan
}

function Show-Loading {
    param([string]$Message, [int]$Seconds = 3)
    Write-Host ""
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host ""
    for ($i = 0; $i -lt $Seconds; $i++) {
        $percent = [math]::Round(($i + 1) / $Seconds * 100)
        $filled = [math]::Round(($i + 1) / $Seconds * 30)
        $empty = 30 - $filled
        $bar = "[" + ("=" * $filled) + (" " * $empty) + "]"
        Write-Host "`r  $bar $percent%" -NoNewline -ForegroundColor Green
        Start-Sleep -Seconds 1
    }
    Write-Host ""
}

function Show-Menu {
    Write-Host ""
    Write-Host "  +--------------------------------------------------------+" -ForegroundColor White
    Write-Host "  |                                                        |" -ForegroundColor White
    Write-Host "  |    " -ForegroundColor White -NoNewline
    Write-Host "[ 1 ]" -ForegroundColor Green -NoNewline
    Write-Host "  启动服务                                  |" -ForegroundColor White
    Write-Host "  |                                                        |" -ForegroundColor White
    Write-Host "  |    " -ForegroundColor White -NoNewline
    Write-Host "[ 2 ]" -ForegroundColor Yellow -NoNewline
    Write-Host "  编辑配置                                  |" -ForegroundColor White
    Write-Host "  |                                                        |" -ForegroundColor White
    Write-Host "  |    " -ForegroundColor White -NoNewline
    Write-Host "[ 3 ]" -ForegroundColor Cyan -NoNewline
    Write-Host "  使用帮助                                  |" -ForegroundColor White
    Write-Host "  |                                                        |" -ForegroundColor White
    Write-Host "  |    " -ForegroundColor White -NoNewline
    Write-Host "[ 0 ]" -ForegroundColor Red -NoNewline
    Write-Host "  退出程序                                  |" -ForegroundColor White
    Write-Host "  |                                                        |" -ForegroundColor White
    Write-Host "  +--------------------------------------------------------+" -ForegroundColor White
    Write-Host ""
}

function Start-Server {
    Clear-Host
    Write-Host ""
    Write-Host "  ========================================================" -ForegroundColor Green
    Write-Host "                  正在启动服务...                          " -ForegroundColor Green
    Write-Host "  ========================================================" -ForegroundColor Green
    Write-Host ""

    $configPath = Join-Path $PSScriptRoot "config.js"
    if (Test-Path $configPath) {
        Write-Host "  [ 1/4 ] " -NoNewline -ForegroundColor DarkGray
        Write-Host "检测配置文件..." -NoNewline -ForegroundColor White
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host "  [ 1/4 ] " -NoNewline -ForegroundColor DarkGray
        Write-Host "检测配置文件..." -NoNewline -ForegroundColor White
        Write-Host " 未找到，使用默认配置" -ForegroundColor Yellow
    }

    $pandocPath = Join-Path $PSScriptRoot "pandoc.exe"
    if (Test-Path $pandocPath) {
        Write-Host "  [ 2/4 ] " -NoNewline -ForegroundColor DarkGray
        Write-Host "检测 Word 转换工具..." -NoNewline -ForegroundColor White
        Write-Host " OK" -ForegroundColor Green
    } else {
        Write-Host "  [ 2/4 ] " -NoNewline -ForegroundColor DarkGray
        Write-Host "检测 Word 转换工具..." -NoNewline -ForegroundColor White
        Write-Host " 未找到 (导出Word功能不可用)" -ForegroundColor Yellow
    }

    $exePath = Join-Path $PSScriptRoot "expcard-converter.exe"
    $serverPath = Join-Path $PSScriptRoot "server.js"
    
    if (Test-Path $exePath) {
        Write-Host "  [ 3/4 ] " -NoNewline -ForegroundColor DarkGray
        Write-Host "检测程序文件..." -NoNewline -ForegroundColor White
        Write-Host " 打包版本" -ForegroundColor Green
    } elseif (Test-Path $serverPath) {
        Write-Host "  [ 3/4 ] " -NoNewline -ForegroundColor DarkGray
        Write-Host "检测程序文件..." -NoNewline -ForegroundColor White
        Write-Host " 开发版本" -ForegroundColor Cyan
    } else {
        Write-Host "  [ 3/4 ] " -NoNewline -ForegroundColor DarkGray
        Write-Host "检测程序文件..." -NoNewline -ForegroundColor White
        Write-Host " 未找到!" -ForegroundColor Red
        Write-Host ""
        Write-Host "  [错误] 请确保 expcard-converter.exe 或 server.js 存在" -ForegroundColor Red
        Write-Host ""
        Pause
        Show-MenuLoop
        return
    }

    Write-Host "  [ 4/4 ] " -NoNewline -ForegroundColor DarkGray
    Write-Host "检测端口 $($script:ServerPort)..." -NoNewline -ForegroundColor White
    $portInUse = Get-NetTCPConnection -LocalPort $script:ServerPort -ErrorAction SilentlyContinue
    if ($portInUse) {
        Write-Host " 被占用" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  [提示] 端口 $($script:ServerPort) 已被占用，尝试关闭旧进程..." -ForegroundColor Yellow
        Get-Process -Id $portInUse.OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
        Write-Host "  [提示] 旧进程已关闭" -ForegroundColor Green
    } else {
        Write-Host " OK" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "  ---------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "  访问地址  : " -NoNewline
    Write-Host "http://localhost:$($script:ServerPort)" -ForegroundColor Yellow -BackgroundColor DarkGray
    Write-Host "  停止服务  : 按 Ctrl+C"
    Write-Host ""
    Write-Host "  ---------------------------------------------------------" -ForegroundColor DarkGray

    Show-Loading -Message "正在启动服务器，请稍候..." -Seconds 3

    if (Test-Path $exePath) {
        $env:PORT = $script:ServerPort
        $process = Start-Process -FilePath $exePath -PassThru -WindowStyle Hidden
    } else {
        $process = Start-Process -FilePath "node" -ArgumentList "server.js" -PassThru -WindowStyle Hidden -Environment @{PORT=$script:ServerPort}
    }

    $maxWait = 10
    $waited = 0
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 1
        $waited++
        $portCheck = Get-NetTCPConnection -LocalPort $script:ServerPort -ErrorAction SilentlyContinue
        if ($portCheck) {
            break
        }
    }

    Write-Host ""
    Write-Host "  [信息] 正在打开浏览器..." -ForegroundColor Cyan
    Start-Process "http://localhost:$($script:ServerPort)"
    Write-Host "  [信息] 浏览器已打开" -ForegroundColor Green
    Write-Host ""
    Write-Host "  提示: 关闭此窗口将停止服务" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  按 Ctrl+C 停止服务，或关闭此窗口" -ForegroundColor DarkGray
    Write-Host ""
    
    try {
        $process.WaitForExit()
    } catch {
        Write-Host ""
        Write-Host "  服务已停止" -ForegroundColor Yellow
    }
    
    Show-MenuLoop
}

function Show-Config {
    Clear-Host
    Write-Host ""
    Write-Host "  ========================================================" -ForegroundColor Yellow
    Write-Host "                      配置文件说明                          " -ForegroundColor Yellow
    Write-Host "  ========================================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  文件      : " -NoNewline
    Write-Host "config.js" -ForegroundColor Green
    Write-Host ""
    Write-Host "  可修改项  :"
    Write-Host "    - LOGIC_OPERATORS       逻辑运算符映射" -ForegroundColor White
    Write-Host "    - SPECIAL_SEPARATORS    特殊分隔符映射" -ForegroundColor White
    Write-Host "    - SKIP_HEADERS          跳过的表头" -ForegroundColor White
    Write-Host "    - SECTION_HEADERS       段落标题" -ForegroundColor White
    Write-Host ""
    Write-Host "  " -NoNewline
    Write-Host "注意" -ForegroundColor Yellow -NoNewline
    Write-Host "：修改后需重启服务生效"
    Write-Host ""
    Write-Host "  ---------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""

    $configPath = Join-Path $PSScriptRoot "config.js"
    if (Test-Path $configPath) {
        Write-Host "  [信息] 正在打开配置文件..." -ForegroundColor Cyan
        notepad $configPath
    }
    else {
        Write-Host "  [错误] 未找到 config.js 文件!" -ForegroundColor Red
        Write-Host ""
        Pause
    }
    Show-MenuLoop
}

function Show-Help {
    Clear-Host
    Write-Host ""
    Write-Host "  ========================================================" -ForegroundColor Cyan
    Write-Host "                        使用帮助                            " -ForegroundColor Cyan
    Write-Host "  ========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  使用步骤  :" -ForegroundColor White
    Write-Host ""
    Write-Host "    1. 双击 start.ps1 启动程序" -ForegroundColor Gray
    Write-Host "    2. 选择 [1] 启动服务" -ForegroundColor Gray
    Write-Host "    3. 浏览器会自动打开" -ForegroundColor Gray
    Write-Host "    4. 拖入或点击上传 Excel 文件" -ForegroundColor Gray
    Write-Host "    5. 选择要转换的工作表" -ForegroundColor Gray
    Write-Host "    6. 点击「转换」按钮" -ForegroundColor Gray
    Write-Host "    7. 预览结果并导出" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  注意事项  :" -ForegroundColor White
    Write-Host ""
    Write-Host "    - 文件格式: 仅支持 .xlsx 格式" -ForegroundColor Gray
    Write-Host "    - 若您的文件是 .xls 格式，请先用 Excel 另存为 .xlsx" -ForegroundColor Gray
    Write-Host "    - 关闭启动窗口将停止服务" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  ---------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
    Pause
    Show-MenuLoop
}

function Show-MenuLoop {
    Show-Banner
    Show-Menu
    $choice = Read-Host "  请选择 [0-3]"
    
    switch ($choice) {
        "1" { Start-Server }
        "2" { Show-Config }
        "3" { Show-Help }
        "0" {
            Write-Host ""
            Write-Host "  再见!" -ForegroundColor Green
            Write-Host ""
            exit
        }
        default {
            Write-Host ""
            Write-Host "  [错误] 无效选项!" -ForegroundColor Red
            Start-Sleep -Seconds 1
            Show-MenuLoop
        }
    }
}

Show-MenuLoop