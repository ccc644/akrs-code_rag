param([switch]$SkipFrontend, [switch]$SkipSemanticModels)
$ErrorActionPreference = 'Stop'
$env:PYTHONUTF8 = '1'
$projectDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))

# Windows PowerShell 5.1 会把原生命令写到 stderr 的进度当成终止错误，
# 这里只在这段调用内放宽，真实结果按退出码判断。
function Invoke-Native {
    param([scriptblock]$Command, [string]$FailureMessage)
    $ErrorActionPreference = 'Continue'
    & $Command
    if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
}

# 每个子目录使用自己的锁文件，避免升级后改变已验收的框架 API。
Push-Location (Join-Path $projectDirectory 'backend')
try {
    Invoke-Native { uv sync --frozen } 'Python 依赖安装失败'
    if (-not $SkipSemanticModels) {
        Invoke-Native { uv run python -m app.modules.knowledge.setup } '本地检索模型准备失败，可离线使用 -SkipSemanticModels'
    }
} finally { Pop-Location }

if (-not $SkipFrontend) {
    Push-Location (Join-Path $projectDirectory 'frontend')
    try {
        Invoke-Native { npm ci } '前端依赖安装失败'
        Invoke-Native { npm run build } '前端构建失败'
    } finally { Pop-Location }
}
Write-Host '环境准备完成。运行 Start.ps1 打开工作区。'
