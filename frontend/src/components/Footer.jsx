import { Link } from 'react-router-dom';
import { Phone, MapPin, Clock, Facebook } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-navy-950 text-white/60">
      {/* 上區：三欄資訊 */}
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
        {/* 品牌 */}
        <div className="md:col-span-2">
          <p className="font-serif text-white text-xl mb-1">赫采國際衛浴</p>
          <p className="text-[10px] tracking-ultra uppercase text-warm-400 mb-5">
            Hé Cǎi International Bath Co., Ltd.
          </p>
          <p className="text-sm leading-relaxed text-white/50 max-w-sm">
            專業提供淋浴拉門、鏡浴櫃、智能鏡及五金配件，
            致力於以精緻工藝打造高品質的衛浴空間體驗。
          </p>
          <a
            href="https://www.facebook.com/share/p/1AjY88eKq2/"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-6 text-xs tracking-widest uppercase text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Facebook size={13} /> Facebook
          </a>
        </div>

        {/* 聯絡 */}
        <div>
          <p className="text-[10px] tracking-ultra uppercase text-white/30 mb-5">Contact</p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2.5">
              <MapPin size={13} className="mt-0.5 shrink-0 text-warm-400" />
              桃園市大園區中興路二段429巷250號
            </li>
            <li className="flex items-center gap-2.5">
              <Phone size={13} className="shrink-0 text-warm-400" />
              <a href="tel:0338100068" className="hover:text-white transition-colors">03-3810068</a>
            </li>
            <li className="flex items-start gap-2.5">
              <Clock size={13} className="mt-0.5 shrink-0 text-warm-400" />
              <span className="text-xs leading-relaxed">
                週一～週四　8:30–17:30<br />
                週五　　　　8:30–17:00<br />
                <span className="text-warm-400">展間請先預約</span>
              </span>
            </li>
          </ul>
        </div>

        {/* 產品連結 */}
        <div>
          <p className="text-[10px] tracking-ultra uppercase text-white/30 mb-5">Products</p>
          <ul className="space-y-2.5 text-sm">
            {[
              { to: '/products?category=shower-doors', label: '淋浴拉門' },
              { to: '/products?category=mirror-cabinets', label: '鏡浴櫃' },
              { to: '/products?category=smart-mirrors', label: '智能鏡' },
              { to: '/products?category=hardware', label: '五金配件' },
              { to: '/contact', label: '預約展間' },
            ].map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="hover:text-white transition-colors">{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 底部版權 */}
      <div className="border-t border-white/10 py-5 px-6 lg:px-10 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/30">
        <span>© {new Date().getFullYear()} 赫采國際衛浴股份有限公司 版權所有</span>
        <Link to="/admin/login" className="hover:text-white/60 transition-colors">管理後台</Link>
      </div>
    </footer>
  );
}
