
import React from 'react';

interface FeedbackToastProps {
    x: number;
    y: number;
    msg: string;
    type: 'error' | 'info';
}

const FeedbackToast: React.FC<FeedbackToastProps> = ({ x, y, msg, type }) => {
    const isError = type === 'error';
    return (
        <div 
            className={`fixed z-[2000] px-3 py-2 rounded shadow-xl pointer-events-none flex items-center gap-2 text-xs font-bold animate-shake border backdrop-blur-md
                ${isError ? 'bg-[#2a0e0e]/90 border-red-500 text-red-200' : 'bg-[#0e2a1a]/90 border-green-500 text-green-200'}
            `}
            style={{ left: x + 12, top: y + 12 }} 
        >
            <span className="text-sm">{isError ? '⛔' : 'ℹ️'}</span>
            <span>{msg}</span>
        </div>
    );
};

export default FeedbackToast;
