import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);

  const currentCategory = searchParams.get('category') || '';
  const currentPage = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    api.get('/categories').then(res => setCategories(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: currentPage, limit: 12 });
    if (currentCategory) params.set('category', currentCategory);

    api.get(`/products?${params}`)
      .then(res => {
        setProducts(res.data.data);
        setPagination(res.data.pagination);
      })
      .finally(() => setLoading(false));
  }, [currentCategory, currentPage]);

  const setCategory = (slug) => {
    const next = new URLSearchParams();
    if (slug) next.set('category', slug);
    setSearchParams(next);
  };

  return (
    <div className="pt-16">
      {/* ── 頁首 Banner ── */}
      <div className="bg-navy-900 text-white py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <span className="section-label text-warm-400">Products</span>
          <h1 className="font-serif text-4xl md:text-5xl text-white">產品系列</h1>
          <div className="divider-gold" />
          <p className="text-white/50 max-w-md">
            淋浴拉門・鏡浴櫃・智能鏡・五金配件，四大系列滿足您的衛浴需求
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-14">
        {/* ── 分類篩選（底線風格）── */}
        <div className="flex flex-wrap gap-0 border-b border-navy-100 mb-10">
          {[{ id: '', slug: '', name: '全部產品' }, ...categories].map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.slug)}
              className={`px-5 py-3 text-xs tracking-ultra uppercase transition-colors border-b-2 -mb-px ${
                (currentCategory === cat.slug || (!currentCategory && cat.id === ''))
                  ? 'border-warm-400 text-navy-900'
                  : 'border-transparent text-navy-400 hover:text-navy-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* ── 產品格 ── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-navy-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white animate-pulse">
                <div className="aspect-square bg-surface-200" />
                <div className="p-5 space-y-2">
                  <div className="h-2 bg-surface-200 w-1/4" />
                  <div className="h-4 bg-surface-200 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-28">
            <Search size={40} className="mx-auto mb-5 text-navy-200" />
            <p className="text-xs tracking-ultra uppercase text-navy-300">此分類目前沒有產品</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-navy-100">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}

        {/* ── 分頁 ── */}
        {pagination.pages > 1 && (
          <div className="flex justify-center gap-2 mt-14">
            {Array.from({ length: pagination.pages }).map((_, i) => {
              const page = i + 1;
              const next = new URLSearchParams(searchParams);
              next.set('page', page);
              return (
                <Link
                  key={page}
                  to={`?${next}`}
                  className={`w-10 h-10 flex items-center justify-center text-xs border transition-colors ${
                    page === currentPage
                      ? 'bg-navy-900 text-white border-navy-900'
                      : 'border-navy-200 text-navy-500 hover:border-navy-600'
                  }`}
                >
                  {page}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
