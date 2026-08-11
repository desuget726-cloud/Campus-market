const Footer = ({ onNavigate }) => (
  <footer className="bg-blue-600 border-t border-blue-700 px-4 py-8 text-sm sm:px-6 lg:px-8 text-white">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="font-semibold text-white">Campus Marketplace</p>
        <p className="mt-1 text-blue-100">Making campus exchange simple.</p>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <button onClick={() => onNavigate('about')} className="inline-block text-white hover:text-slate-100 hover:underline transition duration-150">About</button>
        <button onClick={() => onNavigate('contact')} className="inline-block text-white hover:text-slate-100 hover:underline transition duration-150">Contact</button>
        <button onClick={() => onNavigate('login')} className="inline-block text-white hover:text-slate-100 hover:underline transition duration-150">Login</button>
        <button onClick={() => onNavigate('register')} className="inline-block text-white hover:text-slate-100 hover:underline transition duration-150">Register</button>
        <a href="#" className="inline-block text-white hover:text-slate-100 hover:underline transition duration-150">Privacy Policy</a>
        <a href="#" className="inline-block text-white hover:text-slate-100 hover:underline transition duration-150">Terms of Service</a>
      </div>
      <div className="flex gap-3 text-lg">
        <span>📘</span>
        <span>📸</span>
        <span>🐦</span>
      </div>
    </div>
    <div className="mx-auto mt-6 max-w-7xl border-t border-blue-100 pt-4 text-center text-white">© 2026 Campus Marketplace. All rights reserved.</div>
  </footer>
);

export default Footer;
