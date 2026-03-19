import { Link } from 'react-router-dom';

export default function ProductCard({ product }) {
  const imageUrl = product.primary_image
    ? `/uploads/products/${product.primary_image}`
    : null;

  return (
    <Link to={`/products/${product.id}`} className="group block bg-white overflow-hidden">
      {/* 圖片區 — 1:1 正方形，滑過 zoom */}
      <div className="aspect-square overflow-hidden bg-surface-200 relative">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-108"
            loading="lazy"
            onError={e => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-navy-200 text-xs tracking-ultra uppercase">No Image</span>
          </div>
        )}
        {/* hover 時暗化覆蓋 */}
        <div className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/20 transition-colors duration-500" />
      </div>

      {/* 文字區 */}
      <div className="p-5 border-b border-surface-200">
        <p className="text-[9px] tracking-ultra uppercase text-warm-400 mb-1.5">
          {product.category_name}
        </p>
        <h3 className="font-serif text-base text-navy-900 group-hover:text-navy-600 transition-colors line-clamp-2 leading-snug">
          {product.name}
        </h3>
        {product.description && (
          <p className="mt-1.5 text-xs text-navy-400 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}
      </div>
    </Link>
  );
}
