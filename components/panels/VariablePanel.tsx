
import React, { useState } from 'react';
import { Variable, DataType } from '../../core/types';

interface VariablePanelProps {
    variables: Variable[];
    onAdd: (isIO: boolean) => void;
    onUpdateName: (oldName: string, newName: string) => void;
    onUpdateAddress: (name: string, address: string) => void;
    onUpdateType: (name: string, type: DataType) => void;
    onUpdateDisplay: (name: string, newVal: string) => void;
    onToggle: (name: string) => void;
    onUpdateValue: (name: string, value: number) => void;
    onDelete: (name: string) => void;
}

const VariablePanel: React.FC<VariablePanelProps> = ({ 
    variables, onAdd, onUpdateName, onUpdateAddress, onUpdateType, onUpdateDisplay, onToggle, onUpdateValue, onDelete 
}) => {
    const [activeTab, setActiveTab] = useState<'IO' | 'INTERNAL'>('IO');
    
    const types: DataType[] = ['BOOL', 'INT', 'DINT', 'REAL'];

    const ioVars = variables.filter(v => v.address.trim() !== '');
    const internalVars = variables.filter(v => v.address.trim() === '');

    return (
        <div id="variable-panel" className="h-[250px] bg-panel-bg border-t border-border-col flex flex-col shrink-0">
            {/* Tabs Header */}
            <div className="flex border-b border-border-col bg-[#2d2d2d]">
                <button 
                    className={`px-4 py-2 text-xs font-bold transition-colors ${activeTab === 'IO' ? 'bg-[#3e3e42] text-white border-b-2 border-accent' : 'text-gray-400 hover:bg-[#333]'}`}
                    onClick={() => setActiveTab('IO')}
                >
                    I/O MAPPING (Physical)
                </button>
                <button 
                    className={`px-4 py-2 text-xs font-bold transition-colors ${activeTab === 'INTERNAL' ? 'bg-[#3e3e42] text-white border-b-2 border-accent' : 'text-gray-400 hover:bg-[#333]'}`}
                    onClick={() => setActiveTab('INTERNAL')}
                >
                    INTERNAL VARS (Memory)
                </button>
                <div className="flex-grow"></div>
                <div className="p-1">
                    <button 
                        onClick={() => onAdd(activeTab === 'IO')}
                        className="bg-accent text-white border-none py-1 px-3 rounded cursor-pointer text-xs hover:opacity-90 h-full font-bold"
                    >
                        + Add {activeTab === 'IO' ? 'I/O Tag' : 'Internal Tag'}
                    </button>
                </div>
            </div>

            <div className="overflow-y-auto flex-grow bg-[#1e1e1e]">
                <table className="w-full border-collapse text-[12px] table-fixed">
                    <thead>
                        <tr>
                            <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#252526] text-gray-500 sticky top-0 z-10 w-[20%]">Name</th>
                            {activeTab === 'IO' && (
                                <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#252526] text-gray-500 sticky top-0 z-10 w-[15%]">Address</th>
                            )}
                            <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#252526] text-gray-500 sticky top-0 z-10 w-[15%]">Data Type</th>
                            <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#252526] text-gray-500 sticky top-0 z-10 w-[25%]">Comment</th>
                            <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#252526] text-gray-500 sticky top-0 z-10 w-[15%]">Sim Value</th>
                            <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#252526] text-gray-500 sticky top-0 z-10 w-[10%]"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {(activeTab === 'IO' ? ioVars : internalVars).map(v => (
                            <tr key={v.id} className="border-b border-gray-800 hover:bg-white/5 group">
                                <td className="p-1 px-2">
                                    <input 
                                        className="bg-transparent border border-transparent text-gray-300 w-full text-[12px] p-0.5 focus:border-accent focus:bg-neutral-800 focus:outline-none rounded-sm font-mono"
                                        value={v.name}
                                        onChange={(e) => onUpdateName(v.name, e.target.value)}
                                        placeholder="Tag Name"
                                    />
                                </td>
                                {activeTab === 'IO' && (
                                    <td className="p-1 px-2">
                                        <input 
                                            className="bg-transparent border border-transparent text-gray-300 w-full text-[12px] p-0.5 focus:border-accent focus:bg-neutral-800 focus:outline-none rounded-sm font-mono text-yellow-500"
                                            value={v.address}
                                            placeholder="%I0.0"
                                            onChange={(e) => {
                                                const newAddr = e.target.value;
                                                onUpdateAddress(v.name, newAddr);
                                            }}
                                        />
                                    </td>
                                )}
                                <td className="p-1 px-2">
                                    <select 
                                        className="bg-transparent border border-transparent text-gray-300 w-full text-[12px] p-0.5 focus:border-accent focus:bg-neutral-800 focus:outline-none rounded-sm cursor-pointer"
                                        value={v.dataType}
                                        onChange={(e) => onUpdateType(v.name, e.target.value as DataType)}
                                    >
                                        {types.map(t => <option key={t} value={t} className="bg-[#2d2d2d]">{t}</option>)}
                                    </select>
                                </td>
                                <td className="p-1 px-2">
                                    <input 
                                        className="bg-transparent border border-transparent text-gray-300 w-full text-[12px] p-0.5 focus:border-accent focus:bg-neutral-800 focus:outline-none rounded-sm"
                                        value={v.displayName}
                                        placeholder="..."
                                        onChange={(e) => onUpdateDisplay(v.name, e.target.value)}
                                    />
                                </td>
                                <td className="p-1 px-2">
                                    {v.dataType === 'BOOL' ? (
                                        <span 
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer inline-block w-10 text-center select-none ${v.value ? 'bg-[#1e5e1e] text-[#4ec9b0]' : 'bg-[#5e1e1e] text-[#f14c4c]'}`}
                                            onClick={() => onToggle(v.name)}
                                        >
                                            {v.value ? 'TRUE' : 'FALSE'}
                                        </span>
                                    ) : (
                                        <input 
                                            type="number"
                                            className="text-[#00f0ff] font-mono text-[11px] bg-black/30 px-1 rounded w-full border border-transparent focus:border-accent outline-none"
                                            value={typeof v.value === 'number' ? v.value : 0}
                                            onChange={(e) => onUpdateValue(v.name, parseFloat(e.target.value))}
                                            step={v.dataType === 'REAL' ? 0.1 : 1}
                                        />
                                    )}
                                </td>
                                <td className="p-1 px-2 text-center">
                                    <button 
                                        className="text-[#d9534f] hover:text-red-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => onDelete(v.name)}
                                    >
                                        ✕
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {(activeTab === 'IO' ? ioVars : internalVars).length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center p-4 text-gray-600 italic">
                                    No {activeTab === 'IO' ? 'I/O mapped' : 'internal'} variables found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default VariablePanel;
