import { useTranslation } from 'react-i18next';
import './styles/branding.css'; // Asegúrate que esté importado

function App() {
  const { t, i18n } = useTranslation('loginFlow');

  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="card" style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <h1>{t('title')}</h1>

      <label>{t('email')}</label><br />
      <input type="email" className="input" /><br />

      <label>{t('password')}</label><br />
      <input type="password" className="input" /><br />

      <button>{t('submit')}</button>

      <hr />

      <button onClick={() => changeLanguage('es')}>Español</button>{' '}
      <button onClick={() => changeLanguage('en')}>English</button>
    </div>
  );
}

export default App;
