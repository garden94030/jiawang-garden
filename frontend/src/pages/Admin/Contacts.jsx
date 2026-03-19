import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';

const STATUS_LABELS = { pending: '待處理', processing: '處理中', done: '已完成' };
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
};

export default function AdminContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = () => {
    setLoading(true);
    api.get(`/contacts${filter ? `?status=${filter}` : ''}`)
      .then(res => setContacts(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/contacts/${id}/status`, { status });
      setContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
      toast.success('已更新狀態');
    } catch {
      toast.error('更新失敗');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link to="/admin" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={20} /></Link>
        <h1 className="font-bold text-gray-900">聯絡管理</h1>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* 篩選 */}
        <div className="flex gap-2 mb-6">
          {[['', '全部'], ['pending', '待處理'], ['processing', '處理中'], ['done', '已完成']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                filter === val ? 'bg-primary-700 text-white border-primary-700' : 'border-gray-300 text-gray-600 hover:border-primary-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">載入中...</div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">目前沒有聯絡單</div>
        ) : (
          <div className="space-y-4">
            {contacts.map(c => (
              <div key={c.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-semibold text-gray-900">{c.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 flex flex-wrap gap-3">
                      <span>📞 {c.phone}</span>
                      {c.email && <span>✉️ {c.email}</span>}
                      <span>主旨：{c.subject}</span>
                      <span>{c.created_at}</span>
                    </div>
                  </div>
                  <select
                    value={c.status}
                    onChange={e => updateStatus(c.id, e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="pending">待處理</option>
                    <option value="processing">處理中</option>
                    <option value="done">已完成</option>
                  </select>
                </div>
                <p className="mt-3 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{c.message}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
