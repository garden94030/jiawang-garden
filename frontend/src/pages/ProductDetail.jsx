import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Phone } from 'lucide-react';
import api from '../services/api';

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get(`/products/${id}`)
      .then(res => {
        setProduct(res.data);
        const primary = res.data.images?.find(i => i.is_primary) || res.data.images?.[0];
        setSelected(primary);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="max-w-5xl mx-auto px-4 py-20 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3 mb-8" />
      <div className="grid md:grid-cols-2 gap-10">
        <div className="aspect-square bg-gray-200 rounded-2xl" />
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
        </div>
      </div>
    </div>
  );

  if (error || !product) return (
    <div className="text-center py-24 text-gray-400">
      <p className="text-xl mb-4">找不到此產品</p>
      <Link to="/products" className="btn-primary">回到產品列表</Link>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link to="/products" className="inline-flex items-center gap-1 text-gray-500 hover:text-primary-700 text-sm mb-8">
        <ChevronLeft size={16} /> 返回產品列表
      </Link>

      <div className="grid md:grid-cols-2 gap-10">
        {/* 圖片 */}
        <div>
          <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-gray-100 mb-3">
            {selected ? (
              <img
                src={`/uploads/products/${selected.filename}`}
                alt={selected.alt_text || product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                尚無圖片
              </div>
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {product.images.map(img => (
                <button
                  key={img.id}
                  onClick={() => setSelected(img)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                    selected?.id === img.id ? 'border-primary-600' : 'border-transparent'
                  }`}
                >
                  <img
                    src={`/uploads/products/${img.filename}`}
                    alt={img.alt_text || ''}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 資訊 */}
        <div>
          <span className="text-xs text-primary-600 font-medium bg-primary-50 px-2 py-0.5 rounded-full">
            {product.category_name}
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3 mb-4">{product.name}</h1>

          {product.description && (
            <p className="text-gray-600 leading-relaxed mb-6">{product.description}</p>
          )}

          {product.specs && (
            <div className="bg-gray-50 rounded-xl p-5 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3">產品規格</h3>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap font-sans">{product.specs}</pre>
            </div>
          )}

          <div className="bg-primary-50 rounded-xl p-5">
            <p className="text-sm text-gray-600 mb-3">有興趣或需要報價？歡迎來電洽詢！</p>
            <a href="tel:0338100068" className="btn-primary w-full justify-center">
              <Phone size={18} /> 03-3810068 立即詢價
            </a>
            <Link to="/contact" className="btn-outline w-full justify-center mt-3">
              線上填寫詢問
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
