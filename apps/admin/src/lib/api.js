// 统一的后台 API 请求封装：
// 1. 自动附加 admin_token；
// 2. 任意请求返回 401/403 时广播 admin:unauthorized 事件，由 App 统一登出，
//    避免失效 token 残留导致页面空白/报错却仍停留在后台。

export async function adminFetch(url, options = {}) {
  const token = localStorage.getItem('admin_token') || ''
  const headers = { ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(url, { ...options, headers })
  if (res.status === 401 || res.status === 403) {
    window.dispatchEvent(new CustomEvent('admin:unauthorized'))
  }
  return res
}
