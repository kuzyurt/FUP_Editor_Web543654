
import React from 'react';
import { Variable, DataType } from '../types';

interface VariablePanelProps {
    variables: Variable[];
    onAdd: () => void;
    onUpdateName: (oldName: string, newName: string) => void;
    onUpdateAddress: (name: string, address: string) => void;
    onUpdateType: (name: string, type: DataType) => void;
    onUpdateDisplay: (name: string, newVal: string) => void;
    onToggle: (name: string) => void;
    onDelete: (name: string) => void;
}

const VariablePanel: React.FC<VariablePanelProps> = ({ 
    variables, onAdd, onUpdateName, onUpdateAddress, onUpdateType, onUpdateDisplay, onToggle, onDelete 
}) => {
    
    const types: DataType[] = ['BOOL', 'INT', 'DINT', 'REAL'];

    return (
        <div id="variable-panel" className="h-[250px] bg-panel-bg border-t border-border-col flex flex-col shrink-0">
            <div className="px-2.5 py-1.5 bg-[#2d2d2d] border-b border-border-col flex justify-between items-center">
                <span className="text-xs font-bold text-gray-300">PLC TAG TABLE & I/O MAPPING</span>
                <button 
                    onClick={onAdd}
                    className="bg-accent text-white border-none py-1 px-2.5 rounded cursor-pointer text-xs hover:opacity-90"
                >
                    + Add Variable
                </button>
            </div>
            <div className="overflow-y-auto flex-grow">
                <table className="w-full border-collapse text-[12px] table-fixed">
                    <thead>
                        <tr>
                            <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#2d2d2d] text-gray-500 sticky top-0 z-10 w-[20%]">Name</th>
                            <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#2d2d2d] text-gray-500 sticky top-0 z-10 w-[15%]">Address</th>
                            <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#2d2d2d] text-gray-500 sticky top-0 z-10 w-[15%]">Data Type</th>
                            <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#2d2d2d] text-gray-500 sticky top-0 z-10 w-[25%]">Comment</th>
                            <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#2d2d2d] text-gray-500 sticky top-0 z-10 w-[15%]">Sim Value</th>
                            <th className="text-left p-1 px-2 border-b border-gray-700 bg-[#2d2d2d] text-gray-500 sticky top-0 z-10 w-[10%]"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {variables.map(v => (
                            <tr key={v.id} className="border-b border-gray-800 hover:bg-white/5 group">
                                <td className="p-1 px-2">
                                    <input 
                                        className="bg-transparent border border-transparent text-gray-300 w-full text-[12px] p-0.5 focus:border-accent focus:bg-neutral-800 focus:outline-none rounded-sm font-mono"
                                        value={v.name}
                                        onChange={(e) => onUpdateName(v.name, e.target.value)}
                                        placeholder="Tag Name"
                                    />
                                </td>
                                <td className="p-1 px-2">
                                    <input 
                                        className="bg-transparent border border-transparent text-gray-300 w-full text-[12px] p-0.5 focus:border-accent focus:bg-neutral-800 focus:outline-none rounded-sm font-mono text-yellow-500"
                                        value={v.address}
                                        placeholder="%I0.0"
                                        onChange={(e) => onUpdateAddress(v.name, e.target.value)}
                                    />
                                </td>
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
                                        <span className="text-gray-500 text-[10px] italic">
                                            {v.dataType}
                                        </span>
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
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default VariablePanel;
