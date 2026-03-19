import { useState } from 'react';
import { Phone, MapPin, Clock, Facebook } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const SUBJECTS = ['產品詢問', '展間預約', '安裝諮詢', '報價詢問', '售後服務', '其他'];

export default function Contact() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/contacts', form);
      toast.success(res.data.message);
      setForm({ name: '', phone: '', email: '', subject: '', message: '' });
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || '提交失敗，請稍後再試';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = `w-full border-0 border-b border-navy-200 bg-transparent px-0 py-3 text-sm
    text-navy-900 placeholder-navy-300 focus:outline-none focus:border-warm-400 transition-colors`;

  return (
    <div className="pt-16">
      {/* ── Hero ── */}
      <div className="bg-navy-900 text-white py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <span className="section-label text-warm-400">Contact</span>
          <h1 className="font-serif text-4xl md:text-5xl text-white">預約洽詢</h1>
          <div className="divider-gold" />
          <p className="text-white/50">歡迎詢問產品、預約展間或索取報價，我們將盡快與您聯絡</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-20">
        <div className="grid lg:grid-cols-5 gap-20">

          {/* ── 表單 (極簡底線風格) ── */}
          <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-8">
            <div className="grid sm:grid-cols-2 gap-8">
              <div>
                <label className="text-[10px] tracking-ultra uppercase text-navy-400 block mb-2">姓名 *</label>
                <input name="name" value={form.name} onChange={handleChange}
                  required maxLength={50} className={inputClass} placeholder="您的大名" />
              </div>
              <div>
                <label className="text-[10px] tracking-ultra uppercase text-navy-400 block mb-2">電話 *</label>
                <input name="phone" value={form.phone} onChange={handleChange}
                  required type="tel" className={inputClass} placeholder="09XX-XXX-XXX" />
              </div>
            </div>

            <div>
              <label className="text-[10px] tracking-ultra uppercase text-navy-400 block mb-2">Email（選填）</label>
              <input name="email" value={form.email} onChange={handleChange}
                type="email" className={inputClass} placeholder="your@email.com" />
            </div>

            <div>
              <label className="text-[10px] tracking-ultra uppercase text-navy-400 block mb-2">詢問主旨 *</label>
              <select name="subject" value={form.subject} onChange={handleChange}
                required className={`${inputClass} cursor-pointer`}>
                <option value="">請選擇...</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] tracking-ultra uppercase text-navy-400 block mb-2">訊息內容 *</label>
              <textarea name="message" value={form.message} onChange={handleChange}
                required minLength={10} maxLength={1000} rows={5}
                className={`${inputClass} resize-none`} placeholder="請詳述您的需求或問題..." />
            </div>

            <button type="submit" disabled={submitting}
              className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? '傳送中...' : '送出詢問'}
            </button>
          </form>

          {/* ── 聯絡資訊 ── */}
          <div className="lg:col-span-2 border-l border-navy-100 pl-10 space-y-10">
            <div>
              <p className="eyebrow mb-5">Contact Info</p>
              <ul className="space-y-6 text-sm text-navy-500">
                <li>
                  <p className="text-[9px] tracking-ultra uppercase text-navy-300 mb-1">地址</p>
                  <p>桃園市大園區中興路二段429巷250號</p>
                </li>
                <li>
                  <p className="text-[9px] tracking-ultra uppercase text-navy-300 mb-1">電話</p>
                  <a href="tel:0338100068" className="text-navy-900 font-medium hover:text-warm-500 transition-colors">
                    03-3810068
                  </a>
                </li>
                <li>
                  <p className="text-[9px] tracking-ultra uppercase text-navy-300 mb-1">營業時間</p>
                  <p className="leading-relaxed">
                    週一～週四　8:30–12:00 / 13:00–17:30<br />
                    週五　　　　8:30–12:00 / 13:00–17:00
                  </p>
                </li>
                <li>
                  <p className="text-[9px] tracking-ultra uppercase text-navy-300 mb-1">社群</p>
                  <a href="https://www.facebook.com/share/p/1AjY88eKq2/"
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-500 hover:text-blue-600 transition-colors">
                    <Facebook size={14} /> Facebook 粉絲頁
                  </a>
                </li>
              </ul>
            </div>

            <div className="bg-warm-50 border-l-2 border-warm-400 pl-4 py-3">
              <p className="text-xs font-medium text-warm-600 mb-1">展間參觀請先預約</p>
              <p className="text-xs text-warm-500">請來電或填寫表單，將安排專人接待</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
