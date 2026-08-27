const socialLinks = [
  {
    label: 'Telegram',
    href: 'https://t.me/mekdelauniversity/1',
    icon: <path d="m21.5 3.5-3.2 15.1c-.2 1.1-.8 1.4-1.7.9l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.8 8.7-7.8c.4-.4-.1-.6-.6-.2L6.3 12.8l-4.6-1.4c-1-.3-1-1 .2-1.5L19.8 3c.8-.3 1.9.2 1.7.5Z" />,
  },
  {
    label: 'LinkedIn',
    href: 'https://et.linkedin.com/company/mekdela-amba-university-mau',
    icon: <><path d="M5.2 7.8H1.6V21h3.6V7.8ZM3.4 2A2.1 2.1 0 1 0 3.4 6.2 2.1 2.1 0 0 0 3.4 2ZM8 7.8h3.5v1.8h.1c.5-1 1.8-2.1 3.8-2.1 4 0 4.7 2.6 4.7 6V21h-3.6v-6.7c0-1.6 0-3.6-2.2-3.6s-2.5 1.7-2.5 3.5V21H8V7.8Z" /></>,
  },
  {
    label: 'Facebook',
    href: 'https://web.facebook.com/Mekdela.Amba.University/?_rdc=1&_rdr#',
    icon: <path d="M14 21v-8h2.7l.4-3.1H14V7.9c0-.9.3-1.6 1.7-1.6h1.8V3.5c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v2H7.7V13h2.8v8H14Z" />,
  },
];

const Footer = ({ onNavigate, onOpenPrivacy, onOpenTerms }) => (
  <footer className="border-t border-slate-800 bg-slate-900 px-4 py-10 text-sm text-white sm:px-6 lg:px-8">
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-3">
      <div>
        <p className="text-lg font-bold text-white">Campus Marketplace</p>
        <p className="mt-3 max-w-xs leading-6 text-slate-300">Making campus exchange simple, trusted, and student-friendly.</p>
      </div>

      <nav className="grid grid-cols-2 gap-x-8 gap-y-3" aria-label="Footer navigation">
        <button type="button" onClick={() => onNavigate('about')} className="text-left text-white transition-colors hover:text-blue-400">About</button>
        <button type="button" onClick={() => onNavigate('contact')} className="text-left text-white transition-colors hover:text-blue-400">Contact</button>
        <button type="button" onClick={() => onNavigate('login')} className="text-left text-white transition-colors hover:text-blue-400">Login</button>
        <button type="button" onClick={() => onNavigate('register')} className="text-left text-white transition-colors hover:text-blue-400">Register</button>
        <button type="button" onClick={onOpenPrivacy} className="text-left text-white transition-colors hover:text-blue-400">Privacy Policy</button>
        <button type="button" onClick={onOpenTerms} className="text-left text-white transition-colors hover:text-blue-400">Terms of Service</button>
      </nav>

      <div>
        <p className="font-semibold text-white">Connect with us</p>
        <div className="mt-4 flex gap-3">
          {socialLinks.map((social) => (
            <a key={social.label} href={social.href} target="_blank" rel="noreferrer" aria-label={social.label} title={social.label} className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 text-slate-300 transition-colors hover:border-blue-400 hover:bg-slate-800 hover:text-blue-400">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">{social.icon}</svg>
            </a>
          ))}
        </div>
      </div>
    </div>

    <div className="mx-auto mt-10 max-w-7xl border-t border-slate-800 pt-5 text-center text-xs text-slate-400">© 2026 Campus Marketplace. All rights reserved.</div>
  </footer>
);

export default Footer;
