// src/App.jsx
import { useEffect, useState } from 'react';
import api from './api';

function App() {
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    api.get('/ping').then((res) => {
      setMensaje(res.data.message);
    }).catch(err => {
      setMensaje('Error al conectar con el backend');
      console.error(err);
    });
  }, []);

  return <div>{mensaje}</div>;
}

export default App;
