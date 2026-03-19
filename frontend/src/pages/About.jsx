import { Link } from 'react-router-dom';

const VALUES = [
  {
    title: '品質保證',
    en: 'Quality Assurance',
    desc: '每件產品均通過嚴格品質檢測，材料選用不妥協，確保長久耐用。',
  },
  {
    title: '專業團隊',
    en: 'Expert Team',
    desc: '資深設計顧問與安裝技術人員，全程陪伴您完成理想衛浴空間。',
  },
  {
    title: '一站服務',
    en: 'One-Stop Service',
    desc: '從產品選擇、量測規劃到安裝完工，提供完整的配套服務。',
  },
  {
    title: '售後守護',
    en: 'After-Sales Care',
    desc: '完善售後保障機制，讓您的投資長期受到品質守護。',
  },
];

export default function About() {
  return (
    <div className="pt-16">

      {/* ── Hero ── */}
      <section className="relative bg-navy-900 text-white py-28 md:py-36 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[url('/hero-bg.jpg')] bg-cover bg-center opacity-15" />
        <div className="relative max-w-5xl mx-auto">
          <span className="section-label text-warm-400">About Us</span>
          <h1 className="font-serif text-5xl md:text-6xl text-white leading-tight mb-6">
            關於<br /><span className="italic">赫采國際衛浴</span>
          </h1>
          <div className="divider-gold" />
          <p className="text-white/60 text-lg max-w-xl leading-relaxed">
            以精緻工藝與專業服務，為每個衛浴空間注入品味與生命力。
          </p>
        </div>
      </section>

      {/* ── 品牌故事 ── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div>
              <span className="section-label">Brand Story</span>
              <h2 className="font-serif text-4xl text-navy-900 mb-2">品牌理念</h2>
              <div className="divider-gold" />
              <p className="text-navy-500 leading-relaxed mb-5">
                赫采國際衛浴股份有限公司，致力於提供高品質的衛浴設備，
                涵蓋淋浴拉門、鏡浴櫃、智能鏡及各式五金配件。
              </p>
              <p className="text-navy-500 leading-relaxed mb-5">
                我們深信，衛浴空間不僅是功能性場所，更是生活品質的體現。
                因此，我們在每一項產品的設計、材質與工藝上，都追求極致精良。
              </p>
              <p className="text-navy-500 leading-relaxed mb-10">
                位於桃園大園的展間，備有實品展示，歡迎預約參觀，
                讓您親身感受產品質感，找到最適合您生活風格的衛浴方案。
              </p>
              <Link to="/contact" className="btn-outline">預約展間參觀</Link>
            </div>

            {/* 數據格 — Villeroy & Boch 風格 */}
            <div className="grid grid-cols-2 gap-px bg-navy-100">
              {[
                { num: '20+', label: '年專業經驗' },
                { num: '5,000+', label: '完工案例' },
                { num: '4', label: '核心產品系列' },
                { num: '100%', label: '客戶滿意度' },
              ].map(({ num, label }) => (
                <div key={label} className="bg-white p-10 text-center">
                  <p className="font-serif text-4xl text-warm-400 mb-2">{num}</p>
                  <p className="text-[10px] tracking-ultra uppercase text-navy-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 核心價值 ── */}
      <section className="py-24 bg-surface">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-16">
            <span className="section-label">Our Values</span>
            <h2 className="font-serif text-4xl text-navy-900">為什麼選擇赫采</h2>
            <div className="divider-gold mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-navy-100">
            {VALUES.map(({ title, en, desc }) => (
              <div key={title} className="bg-white p-8">
                <p className="text-[9px] tracking-ultra uppercase text-warm-400 mb-4">{en}</p>
                <h3 className="font-serif text-xl text-navy-900 mb-3">{title}</h3>
                <p className="text-sm text-navy-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 展間地圖 ── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <div className="text-center mb-12">
            <span className="section-label">Showroom Location</span>
            <h2 className="font-serif text-4xl text-navy-900">展間位置</h2>
            <div className="divider-gold mx-auto" />
            <p className="text-navy-400 mt-2">桃園市大園區中興路二段429巷250號</p>
          </div>
          <div className="overflow-hidden h-80 bg-surface-200">
            <iframe
              title="赫采國際衛浴展間位置"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src="https://maps.google.com/maps?q=桃園市大園區中興路二段429巷250號&output=embed"
            />
          </div>
        </div>
      </section>

    </div>
  );
}
