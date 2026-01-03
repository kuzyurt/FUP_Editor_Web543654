
import React, { useMemo } from 'react';
import { NodeData, Connection, Variable } from '../types';
import { generateTruthTableData } from '../utils/truthTableGenerator';

interface TruthTableModalProps {
    nodes: NodeData[];
    connections: Connection[];
    variables: Variable[];
    onClose: () => void;
}

const TruthTableModal: React.FC<TruthTableModalProps> = ({ nodes, connections, variables, onClose }) => {
    
    // Memoize the expensive generation
    const tableData = useMemo(() => {
        return generateTruthTableData(nodes, connections, variables);
    }, [nodes, connections, variables]);

    const hasData = tableData.length > 0;
    const inputHeaders = hasData ? tableData[0].inputs.map(i => i.name) : [];
    const outputHeaders = hasData ? tableData[0].outputs.map(o => o.name) : [];

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[2000] p-6 backdrop-blur-sm">
            <div className="bg-[#1e1e1e] border border-[#444] rounded-lg shadow-2xl w-full max-w-5xl flex flex-col h-[85vh] animate-float">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-[#333] bg-[#252526] rounded-t-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">📊</span>
                        <h3 className="text-[#eee] font-bold text-base tracking-wider">LOGIC TRUTH TABLE</h3>
                    </div>
                    <button onClick={onClose} className="text-[#888] hover:text-white font-bold text-xl px-2 transition-colors">✕</button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-auto bg-[#1a1a1a] custom-scrollbar relative">
                    {!hasData ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <span className="text-4xl mb-2">🔌</span>
                            <p>No Boolean Inputs found to generate a table.</p>
                            <p className="text-xs mt-2">Add Inputs, Push Buttons, or Sensors.</p>
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-xs font-mono">
                            <thead className="sticky top-0 z-10 shadow-md">
                                <tr>
                                    {inputHeaders.map((h, i) => (
                                        <th key={`h-in-${i}`} className="p-3 bg-[#2d4a5a] text-[#ddd] text-left border-b border-[#444] border-r border-[#444] last:border-r-0 min-w-[80px]">
                                            IN: {h}
                                        </th>
                                    ))}
                                    <th className="w-[4px] bg-[#444] p-0"></th>
                                    {outputHeaders.map((h, i) => (
                                        <th key={`h-out-${i}`} className="p-3 bg-[#5a2d2d] text-[#ddd] text-left border-b border-[#444] border-r border-[#444] last:border-r-0 min-w-[80px]">
                                            OUT: {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map((row, rIdx) => (
                                    <tr key={rIdx} className="hover:bg-[#333] transition-colors border-b border-[#2a2a2a]">
                                        {row.inputs.map((inp, cIdx) => (
                                            <td key={`in-${rIdx}-${cIdx}`} className={`p-2 border-r border-[#333] ${inp.value ? 'text-[#4ec9b0] font-bold bg-[#1e2e2e]' : 'text-[#666]'}`}>
                                                {inp.value ? '1' : '0'}
                                            </td>
                                        ))}
                                        <td className="bg-[#2a2a2a]"></td>
                                        {row.outputs.map((out, cIdx) => {
                                            let displayVal = '0';
                                            let style = 'text-[#666]';
                                            
                                            if (typeof out.value === 'boolean') {
                                                displayVal = out.value ? '1' : '0';
                                                if(out.value) style = 'text-[#f88] font-bold bg-[#2e1e1e]';
                                            } else {
                                                displayVal = String(Number(out.value).toFixed(2));
                                                style = 'text-[#4fc1ff]';
                                            }

                                            return (
                                                <td key={`out-${rIdx}-${cIdx}`} className={`p-2 border-r border-[#333] ${style}`}>
                                                    {displayVal}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-[#333] bg-[#252526] flex justify-between items-center rounded-b-lg">
                    <div className="text-[#666] text-xs">
                        * Shows steady-state Combinational Logic. <br/>
                        * Limited to first 10 Boolean Inputs ({Math.pow(2, Math.min(10, inputHeaders.length))} rows).
                    </div>
                    <button 
                        onClick={onClose}
                        className="bg-accent text-white px-5 py-1.5 rounded text-xs font-bold hover:opacity-90 shadow-lg"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TruthTableModal;
