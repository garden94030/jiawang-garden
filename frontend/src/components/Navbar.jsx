import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Phone } from 'lucide-react';

const navLinks = [
  { to: '/', label: '首頁' },
  { to: '/products', label: '產品系列' },
  { to: '/about', label: '關於我們' },
  { to: '/contact', label: '預約洽詢' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // 首頁：透明 hero 上方 → 滾動後轉白
  const transparent = isHome && !scrolled && !open;

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-400 ${
        transparent
          ? 'bg-transparent border-transparent'
          : 'bg-white/95 backdrop-blur-md border-b border-navy-100 shadow-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex items-center justify-between h-18 py-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="flex flex-col leading-none">
              <span className={`font-serif text-lg tracking-wider transition-colors ${
                transparent ? 'text-white' : 'text-navy-900'
              }`}>
                赫采國際衛浴
              </span>
              <span className={`text-[9px] tracking-ultra uppercase transition-colors ${
                transparent ? 'text-white/60' : 'text-warm-400'
              }`}>
                Hé Cǎi International Bath
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `text-xs tracking-ultra uppercase transition-colors pb-0.5 border-b ${
                    isActive
                      ? transparent
                        ? 'text-white border-white'
                        : 'text-navy-900 border-warm-400'
                      : transparent
                        ? 'text-white/80 border-transparent hover:text-white hover:border-white/50'
                        : 'text-navy-500 border-transparent hover:text-navy-900'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Phone CTA */}
          <a
            href="tel:0338100068"
            className={`hidden md:flex items-center gap-2 text-xs tracking-widest uppercase transition-colors ${
              transparent ? 'text-white/90 hover:text-white' : 'text-navy-700 hover:text-navy-900'
            }`}
          >
            <Phone size={13} />
            03-3810068
          </a>

          {/* Mobile Button */}
          <button
            onClick={() => setOpen(!open)}
            className={`md:hidden p-2 ${transparent ? 'text-white' : 'text-navy-700'}`}
            aria-label="開啟選單"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-navy-100 px-6 pb-6">
          {navLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block py-3 text-xs tracking-ultra uppercase border-b border-navy-50 transition-colors ${
                  isActive ? 'text-navy-900 font-medium' : 'text-navy-500'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
          <a
            href="tel:0338100068"
            className="flex items-center gap-2 mt-4 text-xs tracking-widest uppercase text-navy-700"
          >
            <Phone size={13} />
            03-3810068
          </a>
        </div>
      )}
    </header>
  );
}
