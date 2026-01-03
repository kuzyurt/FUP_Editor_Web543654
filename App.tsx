
import React, { useRef, useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import Sidebar from './components/panels/Sidebar';
import Canvas from './components/canvas/Canvas';
import VariablePanel from './components/panels/VariablePanel';
import SimulationOverlay from './components/simulation/SimulationOverlay';
import SCLModal from './components/modals/SCLModal';
import TruthTableModal from './components/modals/TruthTableModal';
import { AppState, NodeData, DataType, IOType, CanvasHandle } from './core/types';
import { generateSCL } from './engine/sclCompiler';
import { EXAMPLES, EXAMPLE_OPTIONS } from './examples/data';
import { areTypesCompatible, getNodeIOType } from './core/typeSystem';

const App = () => {
    const appState = useRef<AppState>({
        nodes: [],
        connections: [],
        variables: [
            { id: 1, name: 'Start_Btn', address: '%I0.0', dataType: 'BOOL', displayName: 'System Start', value: false },
            { id: 2, name: 'Stop_Btn', address: '%I0.1', dataType: 'BOOL', displayName: 'System Stop', value: false },
            { id: 3, name: 'Motor_Out', address: '%Q0.0', dataType: 'BOOL', displayName: 'Main Conveyor', value: false }
        ],
        nextId: 1,
        nextVarId: 4
    });

    const canvasRef = useRef<CanvasHandle>(null);
    const [tick, setTick] = useState(0); 
    const [resetKey, setResetKey] = useState(0); 
    const [isSimMode, setIsSimMode] = useState(false);
    const [showSCL, setShowSCL] = useState(false);
    const [sclCode, setSCLCode] = useState("");
    const [showTruthTable, setShowTruthTable] = useState(false);
    
    const forceUpdate = () => setTick(t => t + 1);

    const handleLoadExample = (key: string) => {
        if(EXAMPLES[key]) {
            appState.current = JSON.parse(JSON.stringify(EXAMPLES[key]));
            setResetKey(k => k + 1);
        }
    };

    const handleExportPDF = () => {
        if (!canvasRef.current) return;
        const imgData = canvasRef.current.getExportImage('image/jpeg');
        if (!imgData) {
            alert("Nothing to export! Add nodes to the canvas.");
            return;
        }

        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: 'a4' 
        });

        const img = new Image();
        img.src = imgData;
        img.onload = () => {
            const imgWidth = img.width;
            const imgHeight = img.height;
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
            const w = imgWidth * (ratio > 1 ? 1 : ratio);
            const h = imgHeight * (ratio > 1 ? 1 : ratio);
            pdf.addImage(imgData, 'JPEG', 10, 10, w - 20, h - 20);
            pdf.save("plc-logic.pdf");
        };
    };

    const handleExportImage = () => {
        if (!canvasRef.current) return;
        // Defaulting to JPEG 0.9 as per request logic optimization
        const imgData = canvasRef.current.getExportImage('image/jpeg');
        if (!imgData) {
            alert("Nothing to export!");
            return;
        }
        const a = document.createElement('a');
        a.href = imgData;
        a.download = 'plc-diagram.jpg';
        a.click();
    };

    return (
        <>
            {showSCL && <SCLModal code={sclCode} onClose={() => setShowSCL(false)} />}
            {showTruthTable && (
                <TruthTableModal 
                    nodes={appState.current.nodes} 
                    connections={appState.current.connections}
                    variables={appState.current.variables}
                    onClose={() => setShowTruthTable(false)}
                />
            )}

            <div id="main-area" className="flex flex-grow relative h-[calc(100vh-250px)]">
                <Sidebar 
                    onDragStart={(e, type) => e.dataTransfer.setData("type", type)}
                    onSave={() => {
                         const blob = new Blob([JSON.stringify(appState.current)], {type: "application/json"});
                         const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                         a.download = "project.json"; a.click();
                    }}
                    onLoad={(e) => {
                         const f = e.target.files?.[0]; if(!f) return;
                         const r = new FileReader(); r.onload = (ev) => {
                             appState.current = JSON.parse(ev.target?.result as string);
                             setResetKey(k => k + 1);
                         }; r.readAsText(f);
                    }}
                    onReset={() => {
                        appState.current = { nodes: [], connections: [], variables: [], nextId: 1, nextVarId: 1 };
                        setResetKey(k => k + 1);
                    }}
                    onToggleSim={() => setIsSimMode(true)}
                    onGenerateSCL={() => {
                        setSCLCode(generateSCL(appState.current.nodes, appState.current.connections, appState.current.variables));
                        setShowSCL(true);
                    }}
                    onShowTruthTable={() => setShowTruthTable(true)}
                    onLoadExample={handleLoadExample}
                    onExportPDF={handleExportPDF}
                    onExportImage={handleExportImage}
                    exampleOptions={EXAMPLE_OPTIONS}
                />
                <Canvas 
                    ref={canvasRef}
                    key={resetKey} 
                    appState={appState} 
                    onSelectNode={() => {}} 
                    onUpdateUI={forceUpdate}
                    isSimMode={isSimMode}
                />
            </div>

            <VariablePanel 
                variables={appState.current.variables}
                onAdd={(io) => {
                    const id = appState.current.nextVarId++;
                    appState.current.variables.push({
                        id: Date.now(), name: `Var_${id}`, address: io ? `%I0.${id}` : '',
                        dataType: 'BOOL', displayName: '', value: false
                    });
                    forceUpdate();
                }}
                onUpdateName={(old, n) => {
                    const v = appState.current.variables.find(x => x.name === old);
                    if(v) v.name = n; forceUpdate();
                }}
                onUpdateAddress={(name, addr) => {
                    const v = appState.current.variables.find(x => x.name === name);
                    if(v) v.address = addr; forceUpdate();
                }}
                onUpdateType={(name, type) => {
                    const v = appState.current.variables.find(x => x.name === name);
                    if(v) { v.dataType = type; v.value = type === 'BOOL' ? false : 0; }
                    forceUpdate();
                }}
                onUpdateDisplay={(name, d) => {
                    const v = appState.current.variables.find(x => x.name === name);
                    if(v) v.displayName = d; forceUpdate();
                }}
                onToggle={(name) => {
                    const v = appState.current.variables.find(x => x.name === name);
                    if(v && v.dataType === 'BOOL') v.value = !v.value;
                    forceUpdate();
                }}
                onUpdateValue={(name, val) => {
                    const v = appState.current.variables.find(x => x.name === name);
                    if(v) v.value = val; forceUpdate();
                }}
                onDelete={(name) => {
                    appState.current.variables = appState.current.variables.filter(x => x.name !== name);
                    forceUpdate();
                }}
            />

            <SimulationOverlay 
                active={isSimMode} 
                nodes={appState.current.nodes}
                variables={appState.current.variables}
                onClose={() => setIsSimMode(false)}
                onToggleNode={(n) => {
                    if (n.varName) {
                        const v = appState.current.variables.find(x => x.name === n.varName);
                        if(v && v.dataType === 'BOOL') {
                            v.value = !v.value;
                            n.state = Boolean(v.value);
                        } else if (!v) {
                            // Variable deleted but node retains name
                            n.state = !n.state;
                        }
                    } else { n.state = !n.state; }
                    forceUpdate();
                }}
                onSetNode={(n, s) => {
                    n.state = s;
                    if(n.varName) {
                        const v = appState.current.variables.find(x => x.name === n.varName);
                        if(v && v.dataType === 'BOOL') v.value = s;
                    }
                    forceUpdate();
                }}
                onSetValue={(n, val) => {
                    if(n.varName) {
                        const v = appState.current.variables.find(x => x.name === n.varName);
                        if(v) { v.value = val; n.state = val; }
                    }
                    forceUpdate();
                }}
            />
        </>
    );
};

export default App;
