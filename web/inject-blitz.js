// web/inject-blitz.js
// 产品级一键注入助手（复制这段到任意 Stitch HTML 页面底部即可）
// 严格遵守规则：只通过这个文件驱动 UI，绝不修改原始 HTML

(function () {
  const script = document.createElement('script');
  script.src = '/app.js';
  script.async = true;
  script.onload = () => console.log('%c[Blitz] Product-grade app.js injected successfully', 'color:#22c55e');
  document.head.appendChild(script);

  // 可选：如果页面没有 Socket.IO，自动加载（CDN 版本）
  if (typeof io === 'undefined') {
    const socketScript = document.createElement('script');
    socketScript.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
    document.head.appendChild(socketScript);
  }
})();

// 使用方法：
// 在任意 Stitch 生成的 HTML 文件底部（</body> 前）粘贴上面整段代码即可让页面“活”起来。
// 所有数据、实时、交互全部由后端驱动，完美符合 UI_CONTRACT 要求。