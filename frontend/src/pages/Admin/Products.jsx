import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Upload, Star, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

export default function AdminProducts() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterCat, setFilterCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category_id: '', description: '', specs: '', is_featured: false });
  const [saving, setSaving] = useState(false);
  const [uploadTarget, setUploadTarget] = useState(null);
  const fileRef = useRef();

  const loadCategories = () => api.get('/categories').then(r => setCategories(r.data));
  const loadProducts = () => {
    setLoading(true);
    const params = filterCat ? `?category=${filterCat}` : '';
    api.get(`/products${params}&limit=50`).then(r => setProducts(r.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { loadCategories(); }, []);
  useEffect(() => { loadProducts(); }, [filterCat]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/products', { ...form, is_featured: form.is_featured ? 1 : 0 });
      toast.success('產品已新增');
      setShowForm(false);
      setForm({ name: '', category_id: '', description: '', specs: '', is_featured: false });
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.errors?.[0]?.msg || '新增失敗');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`確定要刪除「${name}」嗎？`)) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('已刪除');
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch {
      toast.error('刪除失敗');
    }
  };

  const handleToggle = async (product) => {
    try {
      await api.put(`/products/${product.id}`, { ...product, is_active: product.is_active ? 0 : 1 });
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: p.is_active ? 0 : 1 } : p));
    } catch {
      toast.error('更新失敗');
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !uploadTarget) return;
    const formData = new FormData();
    files.forEach(f => formData.append('images', f));
    try {
      await api.post(`/uploads/product/${uploadTarget}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('圖片上傳成功');
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.error || '上傳失敗');
    }
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
          <h1 className="font-bold text-gray-900">產品管理</h1>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary py-2 px-4 text-sm">
          <Plus size={16} /> 新增產品
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* 新增表單 */}
        {showForm && (
          <div className="card p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">新增產品</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">產品名稱 *</label>
                  <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分類 *</label>
                  <select required value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500">
                    <option value="">請選擇分類</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">產品描述</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">規格說明</label>
                <textarea value={form.specs} onChange={e => setForm(f => ({ ...f, specs: e.target.value }))}
                  rows={3} placeholder="材質：強化玻璃&#10;厚度：8mm" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none font-mono focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))}
                  className="rounded text-primary-600" />
                <span className="text-sm text-gray-700">設為精選產品（顯示於首頁）</span>
              </label>
              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary py-2 px-6 text-sm disabled:opacity-60">
                  {saving ? '儲存中...' : '儲存'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline py-2 px-6 text-sm">取消</button>
              </div>
            </form>
          </div>
        )}

        {/* 分類篩選 */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setFilterCat('')}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${!filterCat ? 'bg-primary-700 text-white border-primary-700' : 'border-gray-300 text-gray-600'}`}>
            全部
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setFilterCat(c.slug)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${filterCat === c.slug ? 'bg-primary-700 text-white border-primary-700' : 'border-gray-300 text-gray-600'}`}>
              {c.name}
            </button>
          ))}
        </div>

        {/* 隱藏 file input */}
        <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />

        {/* 產品列表 */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">載入中...</div>
        ) : (
          <div className="space-y-3">
            {products.map(p => (
              <div key={p.id} className={`card p-4 flex items-center gap-4 ${!p.is_active ? 'opacity-50' : ''}`}>
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {p.primary_image
                    ? <img src={`/uploads/products/${p.primary_image}`} alt={p.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">無圖</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{p.name}</span>
                    {p.is_featured === 1 && <Star size={14} className="text-yellow-500 shrink-0" fill="currentColor" />}
                  </div>
                  <span className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{p.category_name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button title="上傳圖片" onClick={() => { setUploadTarget(p.id); fileRef.current.click(); }}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors">
                    <Upload size={16} />
                  </button>
                  <button title={p.is_active ? '下架' : '上架'} onClick={() => handleToggle(p)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    {p.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button title="刪除" onClick={() => handleDelete(p.id, p.name)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
