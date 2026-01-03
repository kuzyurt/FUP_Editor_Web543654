
import React from 'react';

interface SCLModalProps {
    code: string;
    onClose: () => void;
}

const SCLModal: React.FC<SCLModalProps> = ({ code, onClose }) => {
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        alert("Code copied to clipboard!");
    };

    const handleDownload = () => {
        const blob = new Blob([code], { type: "text/plain" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = "logic.scl";
        a.click();
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[2000] p-4">
            <div className="bg-[#1e1e1e] border border-[#444] rounded shadow-2xl w-full max-w-3xl flex flex-col h-[80vh]">
                <div className="flex justify-between items-center p-3 border-b border-[#333] bg-[#252526]">
                    <h3 className="text-[#ccc] font-bold text-sm tracking-wider">GENERATED SCL CODE (IEC 61131-3)</h3>
                    <button onClick={onClose} className="text-[#888] hover:text-white font-bold px-2">✕</button>
                </div>
                
                <div className="flex-grow overflow-auto p-0 relative bg-[#1a1a1a]">
                    <pre className="text-[#d4d4d4] font-mono text-xs p-4 m-0 leading-5 whitespace-pre-wrap">
                        {code}
                    </pre>
                </div>

                <div className="p-3 border-t border-[#333] bg-[#252526] flex gap-3 justify-end">
                    <button 
                        onClick={handleCopy}
                        className="bg-[#2d4a5a] text-[#ddd] px-4 py-1.5 rounded text-xs font-bold hover:bg-[#3d5a6a] transition-colors"
                    >
                        Copy to Clipboard
                    </button>
                    <button 
                        onClick={handleDownload}
                        className="bg-accent text-white px-4 py-1.5 rounded text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                        Download .scl
                    </button>
                    <button 
                        onClick={onClose}
                        className="bg-transparent border border-[#555] text-[#888] px-4 py-1.5 rounded text-xs hover:text-white hover:border-white transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SCLModal;
