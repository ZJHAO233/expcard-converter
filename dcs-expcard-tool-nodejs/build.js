/**
 * SEA (Single Executable Application) 打包脚本
 * 需要 Node.js >= 20
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXE_NAME = 'expcard-converter.exe';
const BLOB_NAME = 'sea-prep.blob';
const CONFIG_NAME = 'sea-config.json';
const BUNDLE_NAME = 'server.bundle.js';
const EMBEDDED_NAME = 'server-embedded.js';

function copyWithRetry(src, dest, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const tmp = dest + '.tmp';
      fs.copyFileSync(src, tmp);
      try { fs.unlinkSync(dest); } catch (_) {}
      fs.renameSync(tmp, dest);
      return;
    } catch (e) {
      if (i < retries - 1) {
        try { execSync('taskkill /f /im ' + path.basename(dest), { stdio: 'ignore' }); } catch (_) {}
        execSync('ping -n 2 127.0.0.1 >nul', { stdio: 'ignore' });
      } else {
        throw e;
      }
    }
  }
}

console.log('开始 SEA 打包...\n');

const nodeVersion = parseInt(process.version.slice(1));
if (nodeVersion < 20) {
  console.error('SEA 打包需要 Node.js >= 20');
  process.exit(1);
}

// 清理旧文件
[EXE_NAME, BLOB_NAME, BUNDLE_NAME, EMBEDDED_NAME].forEach(f => {
  if (fs.existsSync(f)) fs.unlinkSync(f);
});

try {
  // 步骤1: 读取静态文件并创建嵌入版本的 server.js
  console.log('步骤1: 嵌入静态文件...');
  const indexHtml = fs.readFileSync('index.html', 'utf-8');
  const convertJs = fs.readFileSync('convert.js', 'utf-8');
  
  let serverCode = fs.readFileSync('server.js', 'utf-8');
  
  // 在文件开头插入嵌入的静态文件
  const embeddedCode = `
// ========== Embedded Static Files ==========
const __INDEX_HTML = ${JSON.stringify(indexHtml)};
const __CONVERT_JS = ${JSON.stringify(convertJs)};

// Override fs functions to serve embedded files
const __originalReadFileSync = require('fs').readFileSync;
const __originalExistsSync = require('fs').existsSync;

require('fs').readFileSync = function(filePath, options) {
  const name = require('path').basename(String(filePath));
  if (name === 'index.html') return __INDEX_HTML;
  if (name === 'convert.js') return __CONVERT_JS;
  return __originalReadFileSync(filePath, options);
};

require('fs').existsSync = function(filePath) {
  const name = require('path').basename(String(filePath));
  if (name === 'index.html' || name === 'convert.js') return true;
  return __originalExistsSync(filePath);
};
// ========== End Embedded Files ==========

`;
  
  fs.writeFileSync(EMBEDDED_NAME, embeddedCode + serverCode);
  console.log('静态文件嵌入完成\n');

  // 步骤2: 使用 esbuild 打包
  console.log('步骤2: 使用 esbuild 打包代码...');
  execSync('esbuild ' + EMBEDDED_NAME + ' --bundle --platform=node --outfile=' + BUNDLE_NAME, { stdio: 'inherit' });
  console.log('代码打包完成\n');

  // 步骤3: 更新 SEA 配置
  console.log('步骤3: 更新 SEA 配置...');
  const seaConfig = {
    main: BUNDLE_NAME,
    output: BLOB_NAME,
    assets: {}
  };
  fs.writeFileSync(CONFIG_NAME, JSON.stringify(seaConfig, null, 2));
  console.log('配置更新完成\n');

  // 步骤4: 生成 SEA blob
  console.log('步骤4: 生成 SEA blob...');
  execSync('node --experimental-sea-config ' + CONFIG_NAME, { stdio: 'inherit' });
  console.log('blob 生成完成\n');

  // 步骤5: 复制 node.exe
  console.log('步骤5: 复制 node.exe...');
  fs.copyFileSync(process.execPath, EXE_NAME);
  console.log('已复制为 ' + EXE_NAME + '\n');

  // 步骤6: 注入 blob
  console.log('步骤6: 注入 SEA blob...');
  execSync('npx postject ' + EXE_NAME + ' NODE_SEA_BLOB ' + BLOB_NAME + ' --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2', { stdio: 'inherit' });
  console.log('blob 注入完成\n');

  // 步骤7: 复制到 dist 目录
  console.log('步骤7: 复制到 dist 目录...');
  const distDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);
  
  copyWithRetry(EXE_NAME, path.join(distDir, EXE_NAME));
  ['config.js', 'pandoc.exe', 'start.bat', 'start.ps1'].forEach(f => {
    if (fs.existsSync(f)) copyWithRetry(f, path.join(distDir, f));
  });

  const launcherBat = `@echo off\r\npowershell -ExecutionPolicy Bypass -File "%~dp0start.ps1"\r\n`;
  fs.writeFileSync(path.join(distDir, '启动.bat'), launcherBat, 'ascii');
  console.log('已复制到 dist 目录\n');

  // 清理
  console.log('清理临时文件...');
  [EXE_NAME, BLOB_NAME, BUNDLE_NAME, EMBEDDED_NAME].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });

  console.log('\n打包完成！输出目录: dist/');
  execSync('explorer "' + distDir + '"');

} catch (error) {
  console.error('\n打包失败:', error.message);
  process.exit(1);
}
