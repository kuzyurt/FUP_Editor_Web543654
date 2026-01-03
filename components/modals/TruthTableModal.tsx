
import React, { useMemo } from 'react';
import { NodeData, Connection, Variable } from '../../core/types';
import { generateTruthTableData } from '../../engine/truthTableGenerator';

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
    const isSeq = hasData && tableData[0].isSequential;
    
    const inputHeaders = hasData ? tableData[0].inputs.map(i => i.name) : [];
    const stateHeaders = hasData ? tableData[0].states.map(s => s.name) : [];
    const outputHeaders = hasData ? tableData[0].outputs.map(o => o.name) : [];

    return (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[2000] p-6 backdrop-blur-sm">
            <div className="bg-[#1e1e1e] border border-[#444] rounded-lg shadow-2xl w-full max-w-6xl flex flex-col h-[85vh] animate-float">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-[#333] bg-[#252526] rounded-t-lg">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📊</span>
                            <h3 className="text-[#eee] font-bold text-base tracking-wider">
                                {isSeq ? 'STATE TRANSITION TABLE' : 'TRUTH TABLE'}
                            </h3>
                        </div>
                        {isSeq && <span className="text-[#f88] text-[10px] uppercase font-bold mt-1">Sequential Logic Detected • Showing Q(t) → Q(t+1)</span>}
                    </div>
                    <button onClick={onClose} className="text-[#888] hover:text-white font-bold text-xl px-2 transition-colors">✕</button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-auto bg-[#1a1a1a] custom-scrollbar relative">
                    {!hasData ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <span className="text-4xl mb-2">🔌</span>
                            <p>No Boolean Inputs or State Blocks found.</p>
                            <p className="text-xs mt-2">Add Inputs, Push Buttons, Sensors, or Flip-Flops.</p>
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-xs font-mono">
                            <thead className="sticky top-0 z-10 shadow-md">
                                <tr>
                                    {/* Inputs */}
                                    {inputHeaders.map((h, i) => (
                                        <th key={`h-in-${i}`} className="p-3 bg-[#2d4a5a] text-[#ddd] text-left border-b border-[#444] border-r border-[#444] last:border-r-0 min-w-[80px]">
                                            IN: {h}
                                        </th>
                                    ))}
                                    
                                    {/* Current State */}
                                    {stateHeaders.map((h, i) => (
                                        <th key={`h-st-${i}`} className="p-3 bg-[#5a4a2d] text-[#ddd] text-left border-b border-[#444] border-r border-[#444] last:border-r-0 min-w-[100px]">
                                            State(t): {h}
                                        </th>
                                    ))}

                                    <th className="w-[4px] bg-[#444] p-0"></th>

                                    {/* Next State (If Sequential) */}
                                    {isSeq && stateHeaders.map((h, i) => (
                                        <th key={`h-nst-${i}`} className="p-3 bg-[#4a2d5a] text-[#ddd] text-left border-b border-[#444] border-r border-[#444] last:border-r-0 min-w-[100px]">
                                            State(t+1): {h}
                                        </th>
                                    ))}

                                    {/* Outputs */}
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
                                        {/* Inputs */}
                                        {row.inputs.map((inp, cIdx) => (
                                            <td key={`in-${rIdx}-${cIdx}`} className={`p-2 border-r border-[#333] ${inp.value ? 'text-[#4ec9b0] font-bold bg-[#1e2e2e]' : 'text-[#666]'}`}>
                                                {inp.value ? '1' : '0'}
                                            </td>
                                        ))}

                                        {/* Current State */}
                                        {row.states.map((st, cIdx) => (
                                            <td key={`st-${rIdx}-${cIdx}`} className={`p-2 border-r border-[#333] ${st.current ? 'text-[#e5c07b] font-bold bg-[#2e2e1e]' : 'text-[#666]'}`}>
                                                {st.current ? '1' : '0'}
                                            </td>
                                        ))}

                                        <td className="bg-[#2a2a2a]"></td>

                                        {/* Next State */}
                                        {isSeq && row.states.map((st, cIdx) => (
                                            <td key={`nst-${rIdx}-${cIdx}`} className={`p-2 border-r border-[#333] ${st.next ? 'text-[#c678dd] font-bold bg-[#2e1e2e]' : 'text-[#666]'}`}>
                                                {st.next ? '1' : '0'}
                                                {st.next !== st.current && <span className="ml-2 opacity-50 text-[10px]">↺</span>}
                                            </td>
                                        ))}

                                        {/* Outputs */}
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
                        {isSeq ? 
                            "* System includes memory elements. Table permutes Inputs AND Internal States." : 
                            "* Shows steady-state Combinational Logic."
                        }
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
