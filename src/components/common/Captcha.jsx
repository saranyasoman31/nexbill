// Interactive Canvas Captcha Component with Anti-OCR Noise, Refresh, and Audio Accessibility
import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { RotateCw, Volume2 } from 'lucide-react';

const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateRandomCode(length = 6) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return result;
}

const Captcha = forwardRef(({ onCodeChange, value, onChange }, ref) => {
  const canvasRef = useRef(null);
  const [captchaCode, setCaptchaCode] = useState('');
  const [isRotating, setIsRotating] = useState(false);

  const refreshCaptcha = () => {
    setIsRotating(true);
    setTimeout(() => setIsRotating(false), 500);

    const newCode = generateRandomCode(6);
    setCaptchaCode(newCode);
    if (onCodeChange) onCodeChange(newCode);
  };

  useImperativeHandle(ref, () => ({
    refresh: refreshCaptcha,
    getCode: () => captchaCode,
    validate: (input) => input?.trim().toUpperCase() === captchaCode,
  }));

  useEffect(() => {
    refreshCaptcha();
  }, []);

  // Draw captcha onto canvas whenever captchaCode changes
  useEffect(() => {
    if (!canvasRef.current || !captchaCode) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Background
    ctx.clearRect(0, 0, width, height);
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0f172a');
    bgGradient.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle Grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 15) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 15) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Interference noise curves
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = ['#6366f1', '#a855f7', '#38bdf8', '#34d399'][i % 4];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, Math.random() * height);
      ctx.bezierCurveTo(
        width / 3, Math.random() * height,
        (2 * width) / 3, Math.random() * height,
        width, Math.random() * height
      );
      ctx.stroke();
    }

    // Noise dots
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.35})`;
      ctx.beginPath();
      ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Captcha Characters
    const colors = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
    const charSpacing = width / (captchaCode.length + 1);

    ctx.textBaseline = 'middle';
    ctx.font = 'bold 24px monospace';

    for (let i = 0; i < captchaCode.length; i++) {
      const char = captchaCode[i];
      const x = charSpacing * (i + 0.8);
      const y = height / 2 + (Math.random() * 8 - 4);
      const angle = (Math.random() * 40 - 20) * (Math.PI / 180);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = colors[i % colors.length];
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }
  }, [captchaCode]);

  // Audio readout using SpeechSynthesis for accessibility
  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const textToSpeak = captchaCode.split('').join(' ');
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.8;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative rounded-xl overflow-hidden border border-slate-700/80 shadow-inner bg-slate-950 inline-block">
          <canvas
            ref={canvasRef}
            width={180}
            height={48}
            className="block cursor-pointer select-none"
            onClick={refreshCaptcha}
            title="Click to refresh captcha"
          />
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={refreshCaptcha}
            title="Generate new captcha"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleSpeak}
            title="Read captcha aloud (Audio)"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <input
        type="text"
        required
        maxLength={6}
        value={value}
        onChange={onChange}
        placeholder="Enter 6-character captcha"
        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono uppercase tracking-widest text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
});

export default Captcha;
