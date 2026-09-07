

import { toast, Toast, Renderable, ValueFunction } from 'react-hot-toast';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import { css } from '@emotion/css';

// 🎯 Slide-in & fade animation
const slideInFade = css`
  animation: slideInFade 0.5s ease forwards;

  @keyframes slideInFade {
    0% {
      opacity: 0;
      transform: translateX(40px) scale(0.95);
    }
    100% {
      opacity: 1;
      transform: translateX(0px) scale(1);
    }
  }
`;

// ✨ Common base style
const baseStyle = {
    padding: '14px 20px',
    display: 'flex',
    alignItems: 'center',
    borderRadius: '10px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
    background: '#fff',
    fontWeight: 500,
    fontSize: '15px',
};

// ➕ Add colored left stripe
const withStripe = (color: string) => ({
    borderLeft: `6px solid ${color}`,
});

// ✅ Success Toast
export const showSuccessToast = (message: Renderable | ValueFunction<Renderable, Toast>) => {
    toast(message, {
        icon: <CheckCircle color="#22c55e" size={24} />,
        className: slideInFade,
        style: {
            ...baseStyle,
            ...withStripe('#22c55e'),
            color: '#166534',
        },
    });
};

// ❌ Error Toast
export const showErrorToast = (message: Renderable | ValueFunction<Renderable, Toast>) => {
    toast(message, {
        icon: <XCircle color="#ef4444" size={24} />,
        className: slideInFade,
        style: {
            ...baseStyle,
            ...withStripe('#ef4444'),
            color: '#7f1d1d',
        },
    });
};

// ℹ️ Info Toast
export const showInfoToast = (message: Renderable | ValueFunction<Renderable, Toast>) => {
    toast(message, {
        icon: <Info color="#fb923c" size={24} />,
        className: slideInFade,
        style: {
            ...baseStyle,
            ...withStripe('#fb923c'),
            color: '#9a3412',
        },
    });
};

// ⚠️ Warning Toast
export const showWarningToast = (message: Renderable | ValueFunction<Renderable, Toast>) => {
    toast(message, {
        icon: <AlertTriangle color="#facc15" size={24} />,
        className: slideInFade,
        style: {
            ...baseStyle,
            ...withStripe('#facc15'),
            color: '#78350f',
        },
    });
};
