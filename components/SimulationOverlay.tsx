
import React from 'react';
import { NodeData, Variable } from '../core/types';

interface SimulationOverlayProps {
    active: boolean;
    nodes: NodeData[];
    variables: Variable[];
    onToggleNode: (node: NodeData) => void;
    onSetNode: (node: NodeData, state: boolean) => void;
    onSetValue: (node: NodeData, value: number) => void;
    onClose: () => void;
}

const SimulationOverlay: React.FC<SimulationOverlayProps> = ({ active, nodes, variables, onToggleNode, onSetNode, onSetValue, onClose }) => {
    if (!active) return null;

    // Filter out unassigned nodes
    const outputs = nodes.filter(n => n.type === 'OUTPUT' && n.varName);
    const inputs = nodes.filter(n => ['INPUT', 'PUSH', 'SENSOR'].includes(n.type) && n.varName);

    const getNodeName = (n: NodeData) => n.varName || `${n.type} ${n.id}`;
    
    const isNumeric = (n: NodeData) => {
        if (!n.varName) return false;
        const v = variables.find(x => x.name === n.varName);
        return v && (v.dataType === 'INT' || v.dataType === 'DINT' || v.dataType === 'REAL');
    };

    const getVarValue = (n: NodeData) => {
        if (!n.varName) return 0;
        const v = variables.find(x => x.name === n.varName);
        return v ? v.value : 0;
    };

    const getVarType = (n: NodeData) => {
        if (!n.varName) return 'BOOL';
        const v = variables.find(x => x.name === n.varName);
        return v ? v.dataType : 'BOOL';
    }

    return (
        <div className="absolute inset-0 bg-[#1a1a1a] z-50 flex flex-col bg-[radial-gradient(circle_at_center,_#222_0%,_#111_100%)]">
            {/* Top Panel - Outputs (Lights & Displays) */}
            <div className="p-5 flex justify-center items-center gap-10 shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-panel-bg border-y border-border-col h-[140px] bg-[#2b2b2b] border-b-4 border-b-[#111] relative">
                <div className="absolute top-1/2 left-0 right-0 h-2.5 bg-[#444] -mt-1.5 z-0 shadow-[inset_0_2px_5px_#000]"></div>
                
                {outputs.length === 0 && <div className="text-gray-500 text-xs italic">No Active Outputs Assigned</div>}

                {outputs.map(n => {
                    const numeric = isNumeric(n);
                    const val = numeric ? getVarValue(n) : n.state;
                    const vType = getVarType(n);
                    
                    return (
                        <div key={n.id} className="flex flex-col items-center z-10 mx-4">
                            {numeric ? (
                                <div className="w-[100px] h-[50px] bg-black border-2 border-gray-600 rounded flex items-center justify-center font-mono text-2xl text-[#00f0ff] shadow-[inset_0_0_15px_rgba(0,240,255,0.2)]">
                                    {Number(val).toFixed(vType === 'REAL' ? 2 : 0)}
                                </div>
                            ) : (
                                <div 
                                    className={`w-[50px] h-[50px] rounded-full border-2 border-[#111] transition-all duration-100
                                        ${val 
                                            ? 'bg-[radial-gradient(circle_at_30%_30%,_#fff,_#ffeb3b,_#ff9800)] shadow-[0_0_15px_#ff9800,0_0_30px_#ff9800,inset_0_0_2px_rgba(255,255,255,0.8)] border-[#aa6600]' 
                                            : 'bg-[radial-gradient(circle_at_30%_30%,_#666,_#222)] shadow-[0_4px_6px_rgba(0,0,0,0.6),inset_0_0_10px_rgba(0,0,0,0.8)]'
                                        }
                                    `}
                                ></div>
                            )}
                            <div className="mt-2 font-mono text-[10px] text-white bg-black px-1 py-0.5 rounded shadow-sm">
                                {getNodeName(n)}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Center Area */}
            <div className="flex-grow flex flex-col justify-center items-center text-[#444] text-xl uppercase tracking-[5px] font-bold shadow-[0_1px_1px_rgba(255,255,255,0.1)]">
                <div>PLC SIMULATION ACTIVE</div>
                <div className="text-xs mt-1 text-[#666] tracking-normal">Logic Engine v1.0 • Real-time Monitoring</div>
            </div>

            {/* Bottom Panel - Inputs (Switches & Keypads) */}
            <div className="p-5 flex justify-center items-center gap-10 shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-panel-bg border-y border-border-col h-[200px] bg-gradient-to-b from-[#2d2d2d] to-[#1f1f1f] border-t-2 border-t-[#555]">
                {inputs.length === 0 && <div className="text-gray-500 text-xs italic">No Active Inputs Assigned</div>}
                
                {inputs.map(n => {
                    const numeric = isNumeric(n);
                    const val = numeric ? getVarValue(n) : n.state;
                    const vType = getVarType(n);

                    return (
                        <div key={n.id} className="flex flex-col items-center z-10 mx-4">
                            <div className="mb-2 flex items-center justify-center min-h-[100px]">
                                {numeric ? (
                                    <div className="flex flex-col items-center gap-2">
                                         <input 
                                            type="number" 
                                            className="w-[100px] bg-black text-[#00f0ff] font-mono text-center p-2 border-2 border-gray-600 rounded text-xl shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] focus:outline-none focus:border-accent"
                                            value={Number(val)}
                                            onChange={(e) => onSetValue(n, parseFloat(e.target.value))}
                                         />
                                         <div className="flex gap-1">
                                             <button className="bg-[#444] px-2 py-0.5 rounded text-[10px] hover:bg-accent" onClick={() => onSetValue(n, Number(val) - 1)}>-1</button>
                                             <button className="bg-[#444] px-2 py-0.5 rounded text-[10px] hover:bg-accent" onClick={() => onSetValue(n, Number(val) + 1)}>+1</button>
                                         </div>
                                    </div>
                                ) : (
                                    <>
                                        {n.type === 'INPUT' && (
                                            <div 
                                                className={`w-[36px] h-[60px] bg-[#151515] rounded-sm p-1 shadow-2xl cursor-pointer transition-transform active:scale-95`}
                                                onClick={() => onToggleNode(n)}
                                            >
                                                <div className={`w-full h-full rounded-sm flex flex-col justify-between items-center py-1 transition-colors ${n.state ? 'bg-gradient-to-b from-[#444] via-[#222] to-[#111]' : 'bg-gradient-to-b from-[#111] via-[#222] to-[#444]'}`}>
                                                    <span className="text-[10px] font-bold text-gray-500">I</span>
                                                    <div className={`w-2 h-2 rounded-full ${n.state ? 'bg-[#0f0] shadow-[0_0_8px_#0f0]' : 'bg-gray-800'}`}></div>
                                                    <span className="text-[10px] font-bold text-gray-500">O</span>
                                                </div>
                                            </div>
                                        )}
                                        {n.type === 'PUSH' && (
                                            <div 
                                                className={`w-[60px] h-[60px] rounded-full bg-[radial-gradient(circle,_#007acc_0%,_#004c80_100%)] shadow-[0_5px_10px_rgba(0,0,0,0.6),inset_0_2px_3px_rgba(255,255,255,0.4),inset_0_-2px_5px_rgba(0,0,0,0.4)] border-4 border-[#1a1a1a] cursor-pointer transition-all duration-100 active:scale-90 active:shadow-[0_1px_2px_rgba(0,0,0,0.6),inset_0_5px_10px_rgba(0,0,0,0.6)]`}
                                                onMouseDown={() => onSetNode(n, true)}
                                                onMouseUp={() => onSetNode(n, false)}
                                                onMouseLeave={() => onSetNode(n, false)}
                                            ></div>
                                        )}
                                        {n.type === 'SENSOR' && (
                                            <div 
                                                className={`w-[24px] h-[80px] bg-[linear-gradient(90deg,_#b8860b_0%,_#f3e5ab_40%,_#b8860b_100%)] border border-[#705000] relative cursor-pointer shadow-[0_5px_10px_rgba(0,0,0,0.6)]`}
                                                onClick={() => onToggleNode(n)}
                                            >
                                                <div className="absolute -top-[5px] left-0 right-0 h-[5px] bg-[#333]"></div>
                                                <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full ${n.state ? 'bg-yellow-400 shadow-[0_0_10px_yellow]' : 'bg-red-900'}`}></div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="font-mono text-[10px] text-white bg-black px-1 py-0.5 rounded shadow-sm">
                                {getNodeName(n)}
                            </div>
                        </div>
                    );
                })}
            </div>
            <button 
                className="absolute top-4 right-4 bg-[#d9534f] text-white px-4 py-2 text-sm font-bold hover:bg-red-600 transition-colors shadow-xl rounded"
                onClick={onClose}
            >
                EXIT SIMULATION
            </button>
        </div>
    );
};

export default SimulationOverlay;
