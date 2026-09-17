import dg from '../../assets/dg.jpg';
import { useLanguage } from '../../context/LanguageContext';

const socialLinks = [
  {
    label: 'Telegram',
    href: 'https://t.me/desuget11',
    icon: <path d="m21.5 3.5-3.2 15.1c-.2 1.1-.8 1.4-1.7.9l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.7-7.8c.4-.4-.1-.6-.6-.2L6.3 12.8l-4.6-1.4c-1-.3-1-1 .2-1.5L19.8 3c.8-.3 1.9.2 1.7.5Z" />,
  },
  {
    label: 'Facebook',
    href: 'https://facebook.com/',
    icon: <path d="M14 21v-8h2.7l.4-3.1H14V7.9c0-.9.3-1.6 1.7-1.6h1.8V3.5c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v2H7.7V13h2.8v8H14Z" />,
  },
  {
    label: 'Email',
    href: 'mailto:desuget726@gmail.com',
    icon: <><path d="M3 5h18v14H3V5Z" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="m4 7 8 6 8-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></>,
  },
];

const Footer = ({ onNavigate }) => {
  const { language, setLanguage } = useLanguage();

  const navigate = (view) => onNavigate?.(view);

  return (
    <footer className="w-full border-t border-blue-950 bg-sky-700 px-4 py-12 text-sm text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <button type="button" onClick={() => navigate('home')} className="flex items-center gap-3 text-left">
            <img src={dg} alt="DG Market logo" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white/30" />
            <span className="text-xl font-black tracking-tight">DG Market</span>
          </button>
          <p className="mt-4 max-w-xs leading-6 text-blue-100">Your trusted campus marketplace for buying, selling, and exchanging with confidence.</p>
        </div>

        <nav aria-label="Footer quick links">
          <h2 className="font-bold uppercase tracking-[0.16em] text-blue-100">Quick Links</h2>
          <div className="mt-4 grid gap-3">
            {[
              ['Home', 'home'],
              ['About', 'about'],
              ['Services', 'services'],
              ['Contact', 'contact'],
              ['Dashboard', 'student-dashboard'],
            ].map(([label, view]) => (
              <button key={view} type="button" onClick={() => navigate(view)} className="w-fit text-left text-white transition-colors hover:text-blue-200">{label}</button>
            ))}
          </div>
        </nav>

        <nav aria-label="Footer legal links">
          <h2 className="font-bold uppercase tracking-[0.16em] text-blue-100">Legal</h2>
          <div className="mt-4 grid gap-3">
            <button type="button" onClick={() => navigate('terms')} className="w-fit text-left text-white transition-colors hover:text-blue-200">Terms of Service</button>
            <button type="button" onClick={() => navigate('privacy')} className="w-fit text-left text-white transition-colors hover:text-blue-200">Privacy Policy</button>
            <button type="button" onClick={() => navigate('refund-dispute')} className="w-fit text-left text-white transition-colors hover:text-blue-200">Refund / Dispute Policy</button>
          </div>
        </nav>

        <div>
          <h2 className="font-bold uppercase tracking-[0.16em] text-blue-100">Contact</h2>
          <div className="mt-4 grid gap-3 text-blue-50">
            <a href="mailto:desuget726@gmail.com" className="w-fit transition-colors hover:text-white">desuget726@gmail.com</a>
            <a href="tel:+251962714305" className="w-fit transition-colors hover:text-white">0962714305</a>
          </div>
          <div className="mt-5 flex gap-3">
            {socialLinks.map((social) => (
              <a key={social.label} href={social.href} target={social.href.startsWith('http') ? '_blank' : undefined} rel={social.href.startsWith('http') ? 'noreferrer' : undefined} aria-label={social.label} title={social.label} className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-300/50 text-blue-50 transition-colors hover:border-white hover:bg-white/10 hover:text-white">
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">{social.icon}</svg>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-4 border-t border-blue-400/40 pt-5 text-xs text-blue-100 sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 DG Market. All rights reserved.</p>
        <div className="flex items-center gap-2 font-semibold" aria-label="Language switcher">
          <button type="button" onClick={() => setLanguage('en')} className={language === 'en' ? 'text-white' : 'text-blue-200 hover:text-white'}>English</button>
          <span aria-hidden="true">|</span>
          <button type="button" onClick={() => setLanguage('am')} className={language === 'am' ? 'text-white' : 'text-blue-200 hover:text-white'}>አማርኛ</button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
