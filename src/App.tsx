import React, { useState } from 'react';
import logo from './logo.svg';
import './App.css';

function App(): JSX.Element {
  const [count, setCount] = useState(0);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <h1>Eaters React + TypeScript + Electron</h1>
        <p>Привіт! Це ваш новий проект.</p>
        
        <div className="counter-section">
          <p>Лічильник: {count}</p>
          <button 
            className="counter-button" 
            onClick={() => setCount(count + 1)}
          >
            Збільшити
          </button>
          <button 
            className="counter-button" 
            onClick={() => setCount(count - 1)}
          >
            Зменшити
          </button>
          <button 
            className="counter-button reset" 
            onClick={() => setCount(0)}
          >
            Скину티
          </button>
        </div>

        <div className="info-section">
          <p>Проект готовий до використання!</p>
          <p>Запускіть:</p>
          <ul>
            <li><code>npm start</code> - для запуску в браузері</li>
            <li><code>npm run electron:dev</code> - для запуску Electron додатку</li>
            <li><code>npm run build</code> - для збірки в браузер</li>
            <li><code>npm run build:electron</code> - для збірки Electron додатку</li>
          </ul>
        </div>
      </header>
    </div>
  );
}

export default App;
