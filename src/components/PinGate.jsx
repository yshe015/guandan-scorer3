import React, { useState, useEffect, useRef } from 'react';
import * as api from '../api';

export default function PinGate({ children, config }) {
  const pinLength = config?.pinLength || 0;
  const [step, setStep] = useState('loading'); // loading | pin | app
  const [pin, setPin] = useState([]);
  const [error, setError] = useState('');
  const inputRefs = useRef([]);

  useEffect(() => {
    const check = async () => {
      const token = localStorage.getItem('pin_token');
      if (token) {
        try {
          const result = await api.checkAuth();
          if (result.valid) {
            setStep('app');
            return;
          }
        } catch (e) {
          // fall through to pin page
        }
        localStorage.removeItem('pin_token');
      }
      setStep('pin');
    };
    check();
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setPin([]);
      setError('会话已过期，请重新输入PIN');
      setStep('pin');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const focusBox = (i) => {
    if (i >= 0 && i < pinLength && inputRefs.current[i]) {
      inputRefs.current[i].focus();
    }
  };

  const handleChange = (i, value) => {
    if (!/^[0-9]$/.test(value) && value !== '') return;
    const newPin = [...pin];
    newPin[i] = value;
    setPin(newPin);
    setError('');
    if (value !== '' && i < pinLength - 1) {
      focusBox(i + 1);
    }
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      if (pin[i]) {
        const newPin = [...pin];
        newPin[i] = '';
        setPin(newPin);
      } else if (i > 0) {
        focusBox(i - 1);
      }
    }
  };

  useEffect(() => {
    if (pin.length === pinLength && pin.every(d => d !== '') && pinLength > 0) {
      const doAuth = async () => {
        try {
          const result = await api.auth(pin.join(''));
          localStorage.setItem('pin_token', result.token);
          setStep('app');
        } catch (e) {
          setError(e.message);
          setPin([]);
          focusBox(0);
        }
      };
      doAuth();
    }
  }, [pin, pinLength]);

  if (step === 'loading') {
    return (
      <div className="container">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  if (step === 'pin') {
    return (
      <div className="container">
        <div className="header">
          <h1>🃏 地下室掼蛋记分器</h1>
        </div>
        <div className="pin-section">
          <div className="pin-title">请输入PIN</div>
          <div className="pin-container">
            {Array.from({ length: pinLength }).map((_, i) => (
              <input
                key={i}
                ref={el => inputRefs.current[i] = el}
                className="pin-box"
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={pin[i] || ''}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                autoFocus={i === 0}
              />
            ))}
          </div>
          {error && <div className="pin-error">{error}</div>}
        </div>
      </div>
    );
  }

  return children;
}
