import './TopBar.css';

const TopBar = ({ onNavigate }) => {
  const navigate = (event, view) => {
    event.preventDefault();
    onNavigate(view);
  };

  return (
    <aside className="top-bar">
      <div className="top-bar-inner">
        <div className="top-bar-group top-bar-contacts">
          <a className="top-bar-link" href="tel:+251962714305">+251 962714305</a>
          <a className="top-bar-link" href="mailto:desuget726@gmail.com">desuget726@gmail.com</a>
        </div>
        <nav className="top-bar-group top-bar-links" aria-label="Helpful links">
          <a className="top-bar-link" href="#about" onClick={(event) => navigate(event, 'about')}>How it works</a>
          <a className="top-bar-link" href="#terms" onClick={(event) => navigate(event, 'terms')}>Safety tips</a>
          <a className="top-bar-link" href="#contact" onClick={(event) => navigate(event, 'contact')}>Help</a>
          <a className="top-bar-link" href="https://t.me/+pMJYhK3QZv4xYmZk" target="_blank" rel="noreferrer">Telegram</a>
        </nav>
      </div>
    </aside>
  );
};

export default TopBar;