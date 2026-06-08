import React, { useState, useEffect } from 'react'
import { adminFetch } from '../lib/api'

export default function Locales() {
  const [locales, setLocales] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLang, setSelectedLang] = useState(null)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchLocales = async () => {
    setLoading(true)
    const res = await adminFetch('/admin/api/locales')
    const data = await res.json()
    setLocales(data || [])
    if (data.length > 0) {
      setSelectedLang(data[0].lang)
      setContent(JSON.stringify(data[0].content, null, 2))
    }
    setLoading(false)
  }

  useEffect(() => { fetchLocales() }, [])

  const handleSelectLang = (lang) => {
    const locale = locales.find(l => l.lang === lang)
    if (locale) {
      setSelectedLang(lang)
      setContent(JSON.stringify(locale.content, null, 2))
    }
  }

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(content)
      setContent(JSON.stringify(parsed, null, 2))
    } catch (e) {
      alert('❌ JSON 格式错误: ' + e.message)
    }
  }

  const handleSave = async () => {
    if (!selectedLang) return
    setSaving(true)
    try {
      const parsed = JSON.parse(content)
      const res = await adminFetch(`/admin/api/locales/${selectedLang}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed)
      })
      if (!res.ok) throw new Error('保存失败')
      alert('✅ 语言包已保存')
      fetchLocales()
    } catch (e) {
      alert('❌ 保存失败: ' + e.message)
    }
    setSaving(false)
  }

  const handleSetDefault = async (lang) => {
    try {
      await adminFetch(`/admin/api/locales/${lang}/set-default`, {
        method: 'POST',
      })
      alert('默认语言已设置')
      fetchLocales()
    } catch (e) {
      alert('设置失败: ' + e.message)
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">⏳ 加载中...</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-black text-gray-900">🌐 多语言管理</h2>
        <p className="text-sm text-gray-500 mt-1">编辑和管理所有语言包</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 语言列表 */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200 p-6">
          <h3 className="font-black text-lg text-gray-900 mb-4">📚 语言列表</h3>
          <div className="space-y-2">
            {locales.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">暂无语言</p>
            ) : (
              locales.map(locale => (
                <div key={locale.lang} className="flex items-center justify-between">
                  <button 
                    onClick={() => handleSelectLang(locale.lang)}
                    className={`flex-1 text-left px-4 py-3 rounded-lg font-semibold transition-all ${
                      selectedLang === locale.lang 
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md' 
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {locale.lang.toUpperCase()}
                  </button>
                  {locale.isDefault && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full ml-2 font-bold">✅ 默认</span>
                  )}
                </div>
              ))
            )}
          </div>
          {selectedLang && (
            <button 
              onClick={() => handleSetDefault(selectedLang)}
              className="w-full mt-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-3 rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              ⭐ 设为默认语言
            </button>
          )}
        </div>

        {/* 编辑区域 */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-lg text-gray-900">✏️ 编辑内容 ({selectedLang || '未选择'})</h3>
            {selectedLang && (
              <button
                onClick={handleFormat}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-lg transition-all text-sm"
              >
                🔧 格式化 JSON
              </button>
            )}
          </div>
          {selectedLang ? (
            <>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="JSON 格式"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              >
                {saving ? '💾 保存中...' : '💾 保存语言包'}
              </button>
            </>
          ) : (
            <div className="h-96 flex flex-col items-center justify-center text-gray-500 gap-3">
              <div className="text-4xl">🌐</div>
              <p className="font-semibold">请从左侧选择一个语言</p>
              <p className="text-xs">选择后可编辑该语言的所有翻译内容</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
