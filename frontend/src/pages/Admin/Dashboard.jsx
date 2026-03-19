import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Package, MessageSquare, LogOut, Home } from 'lucide-react';

export default function AdminDashboard() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部 Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold text-gray-900">赫采管理後台</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">歡迎，{username}</span>
          <Link to="/" className="text-gray-400 hover:text-gray-600" title="前往網站首頁">
            <Home size={18} />
          </Link>
          <button onClick={handleLogout} className="text-gray-400 hover:text-red-500" title="登出">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">功能選單</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <Link to="/admin/products" className="card p-8 hover:border-primary-300 border border-transparent group">
            <Package size={32} className="text-primary-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-primary-700">產品管理</h3>
            <p className="text-gray-500 text-sm">新增、編輯、刪除產品與分類，上傳產品照片</p>
          </Link>
          <Link to="/admin/contacts" className="card p-8 hover:border-primary-300 border border-transparent group">
            <MessageSquare size={32} className="text-primary-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-primary-700">聯絡管理</h3>
            <p className="text-gray-500 text-sm">查看客戶詢問訊息，更新處理狀態</p>
          </Link>
        </div>
      </main>
    </div>
  );
}
