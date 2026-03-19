import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Phone, MapPin, Clock } from 'lucide-react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';

const CATEGORIES = [
  { slug: 'shower-doors',   label: '淋浴拉門', en: 'Shower Doors',    desc: '無框・半框・折疊多款設計，為浴室注入輕盈光感' },
  { slug: 'mirror-cabinets', label: '鏡浴櫃',  en: 'Mirror Cabinets', desc: '整合收納與鏡面設計，演繹機能美學' },
  { slug: 'smart-mirrors',   label: '智能鏡',  en: 'Smart Mirrors',   desc: 'LED防霧・觸控調光，科技提升日常體驗' },
  { slug: 'hardware',        label: '五金配件', en: 'Hardware',        desc: '精鑄五金・表面處理講究，細節決定品味' },
];

const STATS = [
  { num: '20+', label: '年專業經驗' },
  { num: '5,000+', label: '完工案例' },
  { num: '4', label: '產品系列' },
  { num: '100%', label: '品質保證' },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    api.get('/products?featured=1&limit=8')
      .then(res => setFeatured(res.data.data))
      .catch(() => {});
  }, []);

  return (
    <div className="overflow-x-hidden">

      {/* ═══════════════════════════════════════════════
          HERO — 全版寬滿版影像，Kohler 風格
      ═══════════════════════════════════════════════ */}
      <section className="relative h-screen min-h-[640px] flex items-end bg-navy-900">
        {/* 背景圖 (上傳後取代 hero-bg.jpg) */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/hero-bg.jpg')" }}
        />
        {/* 漸層遮罩 — 下半部加深讓文字清晰 */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/85 via-navy-900/30 to-transparent" />

        {/* 文字區塊 */}
        <div className="relative w-full max-w-7xl mx-auto px-6 lg:px-10 pb-20 md:pb-28">
          <p className="eyebrow text-white/60 mb-5">
            Hé Cǎi International Bath · Since 2004
          </p>
          <h1 className="font-serif text-white text-5xl md:text-7xl leading-[1.1] mb-6 max-w-2xl">
            品味衛浴，<br />
            <span className="italic text-warm-300">成就生活美學</span>
          </h1>
          <p className="text-white/70 text-base max-w-md mb-10 leading-relaxed">
            赫采國際衛浴提供淋浴拉門、鏡浴櫃、智能鏡及精品五金，
            以細膩工藝為您的空間注入優雅質感。
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/products" className="btn-primary">
              探索產品系列 <ArrowRight size={14} />
            </Link>
            <Link to="/contact" className="btn-ghost">
              預約展間參觀
            </Link>
          </div>
        </div>

        {/* 右下角滾動提示 */}
        <div className="absolute bottom-8 right-10 hidden lg:flex flex-col items-center gap-2 text-white/40">
          <div className="w-px h-12 bg-white/30 animate-pulse" />
          <span className="text-[9px] tracking-ultra uppercase rotate-90 origin-center mt-4">Scroll</span>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          BRAND TAGLINE — 品牌宣言（黑底白字，精品感）
      ═══════════════════════════════════════════════ */}
      <section className="bg-navy-900 text-white py-10 px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6">
          <p className="font-serif text-xl md:text-2xl text-white/90 italic">
            "每一件產品，都是對生活品質的承諾。"
          </p>
          <a href="tel:0338100068"
            className="flex items-center gap-2 text-warm-300 text-sm tracking-widest uppercase hover:text-warm-200 transition-colors">
            <Phone size={14} />
            03-3810068
          </a>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          CATEGORIES — 產品系列（圖文並排，KOHLER 風格）
      ═══════════════════════════════════════════════ */}
      <section className="py-24 bg-surface">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="mb-16">
            <span className="section-label">Product Series</span>
            <h2 className="font-serif text-4xl text-navy-900">四大產品系列</h2>
            <div className="divider-gold" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-navy-100">
            {CATEGORIES.map(({ slug, label, en, desc }) => (
              <Link
                key={slug}
                to={`/products?category=${slug}`}
                className="group bg-white hover:bg-navy-900 transition-all duration-500 p-8 flex flex-col"
              >
                <span className="text-[10px] tracking-ultra uppercase text-warm-400 group-hover:text-warm-300 mb-6 transition-colors">
                  {en}
                </span>
                <h3 className="font-serif text-2xl text-navy-900 group-hover:text-white mb-4 transition-colors">
                  {label}
                </h3>
                <p className="text-sm text-navy-400 group-hover:text-white/60 leading-relaxed mb-6 flex-1 transition-colors">
                  {desc}
                </p>
                <span className="flex items-center gap-2 text-xs tracking-widest uppercase text-navy-700 group-hover:text-warm-300 transition-colors">
                  查看系列 <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          FEATURED PRODUCTS
      ═══════════════════════════════════════════════ */}
      {featured.length > 0 && (
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-10">
            <div className="flex items-end justify-between mb-14">
              <div>
                <span className="section-label">Featured</span>
                <h2 className="font-serif text-4xl text-navy-900">精選產品</h2>
                <div className="divider-gold" />
              </div>
              <Link to="/products"
                className="hidden md:flex items-center gap-2 text-xs tracking-ultra uppercase text-navy-500 hover:text-navy-900 transition-colors">
                瀏覽全部 <ArrowRight size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1 bg-navy-50">
              {featured.map(p => <ProductCard key={p.id} product={p} />)}
            </div>

            <div className="text-center mt-12 md:hidden">
              <Link to="/products" className="btn-outline">瀏覽全部產品</Link>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          BRAND STORY — 圖文二欄（Panasonic 風格）
      ═══════════════════════════════════════════════ */}
      <section className="py-24 bg-surface-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* 文字 */}
            <div>
              <span className="section-label">Our Story</span>
              <h2 className="font-serif text-4xl text-navy-900 mb-2">專業衛浴</h2>
              <h2 className="font-serif text-4xl text-navy-900 italic mb-6">成就卓越空間</h2>
              <div className="divider-gold" />
              <p className="text-navy-500 leading-relaxed mb-6">
                赫采國際衛浴自成立以來，始終致力於提供最高品質的衛浴設備。
                我們深知，浴室是每日生活的起點，因此對每一項產品的選材、
                工藝與安裝都追求精益求精。
              </p>
              <p className="text-navy-500 leading-relaxed mb-10">
                位於桃園大園的展間，備有完整產品實品展示，
                讓您在選購前能親身感受材質觸感與空間效果。
                <span className="text-warm-500 font-medium">展間參觀請先預約</span>，
                我們將安排專人為您詳細說明。
              </p>
              <Link to="/about" className="btn-outline">了解我們的故事</Link>
            </div>

            {/* 數據格 */}
            <div className="grid grid-cols-2 gap-1 bg-navy-100">
              {STATS.map(({ num, label }) => (
                <div key={label} className="bg-white p-10 flex flex-col items-center justify-center text-center">
                  <span className="font-serif text-4xl text-warm-400 mb-2">{num}</span>
                  <span className="text-xs tracking-widest uppercase text-navy-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          SHOWROOM INFO — 展間資訊
      ═══════════════════════════════════════════════ */}
      <section className="py-24 bg-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-16">
            <span className="section-label text-warm-400">Showroom</span>
            <h2 className="font-serif text-4xl text-white">展間資訊</h2>
            <div className="divider-gold mx-auto" />
            <p className="text-white/60 mt-2">親臨體驗，感受赫采的質感工藝</p>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-navy-700">
            {[
              {
                icon: MapPin,
                title: '展間地址',
                content: '桃園市大園區\n中興路二段429巷250號',
              },
              {
                icon: Phone,
                title: '預約電話',
                content: '03-3810068',
                href: 'tel:0338100068',
                note: '展間參觀請先預約',
              },
              {
                icon: Clock,
                title: '營業時間',
                content: '週一～週四　8:30–17:30\n週五　　　　8:30–17:00',
                note: '午休 12:00–13:00',
              },
            ].map(({ icon: Icon, title, content, href, note }) => (
              <div key={title} className="bg-navy-800 p-10 flex flex-col items-center text-center">
                <Icon size={22} className="text-warm-400 mb-5" />
                <p className="text-xs tracking-ultra uppercase text-white/40 mb-3">{title}</p>
                {href ? (
                  <a href={href} className="font-serif text-xl text-white hover:text-warm-300 transition-colors whitespace-pre-line">
                    {content}
                  </a>
                ) : (
                  <p className="font-serif text-lg text-white/90 whitespace-pre-line">{content}</p>
                )}
                {note && <p className="text-xs text-warm-400 mt-3">{note}</p>}
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <Link to="/contact" className="btn-primary">立即預約展間</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
