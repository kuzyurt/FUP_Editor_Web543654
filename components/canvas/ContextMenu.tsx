
import React from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    title: string;
    items: {
        label?: string;
        html?: string;
        onClick?: () => void;
        type?: 'action' | 'separator' | 'custom';
        customRender?: () => React.ReactNode;
    }[];
    onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, title, items, onClose }) => {
    return (
        <div 
            className="fixed z-50 min-w-[160px] bg-panel-bg border border-gray-600 shadow-2xl rounded-sm py-1 max-h-[60vh] overflow-y-auto"
            style={{ left: x, top: y }}
        >
            <div className="px-4 py-1.5 text-xs font-bold text-gray-500 border-b border-gray-700 mb-1 sticky top-0 bg-panel-bg z-10">
                {title}
            </div>
            {items.map((item, idx) => {
                if (item.type === 'separator') {
                    return <hr key={idx} className="border-gray-700 my-1" />;
                }
                if (item.type === 'custom' && item.customRender) {
                    return <div key={idx} className="px-4 py-1">{item.customRender()}</div>
                }
                return (
                    <div 
                        key={idx}
                        className="px-4 py-2 text-xs cursor-pointer hover:bg-accent hover:text-white flex items-center justify-between"
                        onClick={() => {
                            if (item.onClick) item.onClick();
                            onClose();
                        }}
                    >
                        {item.html ? <span dangerouslySetInnerHTML={{__html: item.html}} /> : item.label}
                    </div>
                );
            })}
        </div>
    );
};

export default ContextMenu;
