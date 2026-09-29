// Notes Atlas Admin Frontend
const API = '/admin/api';

let currentFile = null;
let treeData = [];

// DOM 元素
const $ = (id) => document.getElementById(id);
const loginView = $('login-view');
const mainView = $('main-view');
const loginForm = $('login-form');
const loginError = $('login-error');
const fileTree = $('file-tree');
const editorEmpty = $('editor-empty');
const previewEl = $('preview');
const split = $('split');
const divider = $('divider');

// 防抖 + 竞态:序号只增,过期响应直接丢弃,避免连续打字时预览内容倒退
let previewTimer = null;
let previewSeq = 0;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const editorContent = $('editor-content');
const editor = $('editor');
const filePathInput = $('file-path');
const fileMtime = $('file-mtime');
const parseError = $('parse-error');
const buildStatus = $('build-status');
const lastCommit = $('last-commit');

// API 请求
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 401) {
    showLogin();
    throw new Error('未登录');
  }
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || '请求失败');
  return data;
}

// 登录
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const user = $('login-user').value;
  const pass = $('login-pass').value;
  try {
    await api('/login', {
      method: 'POST',
      body: JSON.stringify({ user, pass }),
    });
    showMain();
  } catch (err) {
    loginError.textContent = err.message;
  }
});

// 退出
$('logout-btn').addEventListener('click', async () => {
  await api('/logout', { method: 'POST' });
  showLogin();
});

function showLogin() {
  mainView.classList.add('hidden');
  loginView.classList.remove('hidden');
}

function showMain() {
  loginView.classList.add('hidden');
  mainView.classList.remove('hidden');
  loadTree();
  loadStatus();
  setInterval(loadStatus, 5000);
}

// 文件树
async function loadTree() {
  try {
    const data = await api('/tree');
    treeData = data.nodes;
    renderTree(treeData, fileTree);
  } catch (err) {
    console.error('加载文件树失败:', err);
  }
}

function renderTree(nodes, container) {
  container.innerHTML = '';
  for (const node of nodes) {
    const item = document.createElement('div');
    item.className = 'tree-item';
    // 文件名必须走 textContent:node.name 是服务端 readdir 的原始条目,未转义;
    // files.create 只校验 safeResolve + .md 后缀、不校验 basename,
    // 拼进 innerHTML 等于让任何能操作面板的人给自己种一个 XSS
    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = node.type === 'dir' ? '📁' : '📄';
    const name = document.createElement('span');
    name.textContent = node.name;
    item.append(icon, name);

    if (node.type === 'file') {
      item.addEventListener('click', () => openFile(node.path));
      container.appendChild(item);
    } else {
      const children = document.createElement('div');
      children.className = 'tree-children';
      renderTree(node.children || [], children);
      
      item.addEventListener('click', () => {
        children.classList.toggle('hidden');
      });
      
      container.appendChild(item);
      container.appendChild(children);
    }
  }
}

// 打开文件
async function openFile(path) {
  try {
    const data = await api(`/file?path=${encodeURIComponent(path)}`);
    currentFile = path;
    editorEmpty.classList.add('hidden');
    editorContent.classList.remove('hidden');
    filePathInput.value = path;
    editor.value = data.content;
    // 打开即渲染一次,不等用户输入(直接赋值不触发 input 事件)
    schedulePreview();
    fileMtime.textContent = data.mtime ? new Date(data.mtime).toLocaleString() : '';
    parseError.textContent = data.parseError || '';
    
    // 高亮当前文件
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    // 简单高亮：遍历找到匹配的
    highlightActive(path);
  } catch (err) {
    alert('打开文件失败: ' + err.message);
  }
}

function highlightActive(path) {
  document.querySelectorAll('.tree-item').forEach(el => {
    el.classList.remove('active');
    const nameEl = el.querySelector('span:last-child');
    if (nameEl && path.endsWith(nameEl.textContent)) {
      el.classList.add('active');
    }
  });
}

// 保存
$('save-btn').addEventListener('click', async () => {
  if (!currentFile) return;
  try {
    await api('/file', {
      method: 'PUT',
      body: JSON.stringify({ path: currentFile, content: editor.value }),
    });
    fileMtime.textContent = new Date().toLocaleString();
    parseError.textContent = '';
  } catch (err) {
    alert('保存失败: ' + err.message);
  }
});

// 删除文件
$('delete-btn').addEventListener('click', async () => {
  if (!currentFile) return;
  if (!confirm(`确定删除 ${currentFile}?`)) return;
  try {
    await api(`/file?path=${encodeURIComponent(currentFile)}`, { method: 'DELETE' });
    currentFile = null;
    editorContent.classList.add('hidden');
    editorEmpty.classList.remove('hidden');
    loadTree();
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
});

// 重命名
$('rename-btn').addEventListener('click', async () => {
  if (!currentFile) return;
  const newName = prompt('新文件名:', currentFile.split('/').pop());
  if (!newName) return;
  const dir = currentFile.split('/').slice(0, -1).join('/');
  const newPath = dir ? `${dir}/${newName}` : newName;
  try {
    await api('/rename', {
      method: 'POST',
      body: JSON.stringify({ from: currentFile, to: newPath }),
    });
    currentFile = newPath;
    filePathInput.value = newPath;
    loadTree();
  } catch (err) {
    alert('重命名失败: ' + err.message);
  }
});

// 新建文件
$('new-file-btn').addEventListener('click', async () => {
  const path = prompt('文件路径 (如: notes/hello.md):');
  if (!path) return;
  try {
    await api('/file', {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
    loadTree();
    openFile(path);
  } catch (err) {
    alert('创建失败: ' + err.message);
  }
});

// 新建目录
$('new-dir-btn').addEventListener('click', async () => {
  const path = prompt('目录路径:');
  if (!path) return;
  try {
    await api('/dir', {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
    loadTree();
  } catch (err) {
    alert('创建失败: ' + err.message);
  }
});

// 刷新
$('refresh-btn').addEventListener('click', loadTree);

// 构建状态
async function loadStatus() {
  try {
    const data = await api('/build/status');
    buildStatus.textContent = data.state;
    buildStatus.className = `status-badge ${data.state}`;
    if (data.lastCommit) {
      lastCommit.textContent = data.lastCommit;
    }
  } catch (err) {
    console.error('加载状态失败:', err);
  }
}

// 检查是否已登录
(async () => {
  try {
    await api('/tree');
    showMain();
  } catch {
    showLogin();
  }
})();

// ===== 预览 =====

function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 300);
}

async function renderPreview() {
  const seq = ++previewSeq;
  const content = editor.value;
  const path = currentFile || '';
  if (!content.trim()) {
    previewEl.innerHTML = '<p class="preview-empty">（空文档）</p>';
    return;
  }
  try {
    const data = await api('/preview', {
      method: 'POST',
      body: JSON.stringify({ content, path }),
    });
    if (seq !== previewSeq) return; // 过期响应,丢弃
    previewEl.innerHTML = data.html;
    hardenPreviewLinks();
    renderMath();
    renderMermaid();
  } catch (err) {
    if (seq !== previewSeq) return;
    previewEl.innerHTML = `<p class="preview-error">预览渲染失败：${escapeHtml(err.message)}</p>`;
  }
}

// 预览里的 [[双链]] / 外链都是裸 <a>,没有 target/rel。点一下就把 admin 页面
// 导航走,用户正在编辑但没保存的内容直接丢(数据丢失)。统一开新窗口。
// 用「设属性」而不是 click 委托 + window.open:设属性是声明式的,
// 浏览器自己处理中键/Ctrl+点击/右键新标签页,委托 + preventDefault 会把这些
// 全部劫持掉,还要自己判断 href 协议,收益不抵复杂度
function hardenPreviewLinks() {
  for (const a of previewEl.querySelectorAll('a[href]')) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
}

// KaTeX 纯客户端排版:markdown-it 未装数学插件,公式原样透传
// 定界符与站点 markdown-it-mathjax3 一致(含单 $ —— 全库真实笔记有 146 处单 $ 公式)
function renderMath() {
  if (typeof renderMathInElement !== 'function') return;
  try {
    renderMathInElement(previewEl, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      throwOnError: false, // 解析失败退回原文,不中断整篇
    });
  } catch (err) {
    console.error('公式排版失败:', err);
  }
}

// renderMermaid 会被每次预览都调,initialize 只需一次
// 设计文档 §6.3 要求显式关掉 startOnLoad:mermaid 默认是 true,只在
// DOMContentLoaded 时自动跑一遍 run();现在无害仅因为 vendor 是 body 末尾的
// 阻塞 <script>,自动钩子已经错过——这是对脚本加载位置的隐性依赖,
// 一旦有人给它们加 defer/async 就会重复渲染
let mermaidReady = false;
async function renderMermaid() {
  if (!window.mermaid) return;
  const nodes = previewEl.querySelectorAll('.language-mermaid:not([data-processed])');
  if (!nodes.length) return;
  try {
    if (!mermaidReady) {
      window.mermaid.initialize({ startOnLoad: false });
      mermaidReady = true;
    }
    await window.mermaid.run({ nodes });
  } catch (err) {
    // 单图语法错只坏该图,mermaid 会把错误写进该节点
    console.error('mermaid 渲染失败:', err);
  }
}

editor.addEventListener('input', schedulePreview);

// 分隔条拖动:clamp 20%~80%,避免任一侧被压到不可用
// endDrag 三个出口都要绑:只绑 mouseup 的话,拖出窗口 / alt-tab 失焦后 dragging
// 会一直悬挂,此后每一次无关的 mousemove 都在改宽度,分隔条也一直高亮
let dragging = false;
function endDrag() {
  if (!dragging) return;
  dragging = false;
  divider.classList.remove('dragging');
}
divider.addEventListener('mousedown', (e) => {
  dragging = true;
  divider.classList.add('dragging');
  e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const r = split.getBoundingClientRect();
  const pct = ((e.clientX - r.left) / r.width) * 100;
  split.style.setProperty('--split', Math.min(80, Math.max(20, pct)) + '%');
});
window.addEventListener('mouseup', endDrag);
window.addEventListener('blur', endDrag);
window.addEventListener('mouseleave', endDrag);
