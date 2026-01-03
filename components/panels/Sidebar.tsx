
import React from 'react';

interface SidebarProps {
    onDragStart: (e: React.DragEvent, type: string) => void;
    onSave: () => void;
    onLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onReset: () => void;
    onToggleSim: () => void;
    onGenerateSCL: () => void;
    onShowTruthTable: () => void;
    onLoadExample: (key: string) => void;
    onExportPDF: () => void;
    onExportImage: () => void;
    exampleOptions: { key: string, label: string }[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
    onDragStart, 
    onSave, 
    onLoad, 
    onReset, 
    onToggleSim, 
    onGenerateSCL, 
    onShowTruthTable,
    onLoadExample, 
    onExportPDF,
    onExportImage,
    exampleOptions 
}) => {
    const [examplesOpen, setExamplesOpen] = React.useState(true);
    const [mathOpen, setMathOpen] = React.useState(false);
    const [advancedOpen, setAdvancedOpen] = React.useState(false);
    const [convertersOpen, setConvertersOpen] = React.useState(false);
    
    const PaletteItem = ({ type, label }: { type: string, label: string }) => (
        <div 
            className="bg-neutral-800 border border-neutral-700 p-2 mb-1.5 cursor-grab rounded flex items-center text-xs transition-all hover:border-accent hover:bg-neutral-700 hover:translate-x-1"
            draggable
            onDragStart={(e) => onDragStart(e, type)}
        >
            {label}
        </div>
    );

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (!val) return;
        onLoadExample(val);
        e.target.value = "";
    };

    return (
        <div id="sidebar" className="w-[230px] bg-panel-bg border-r border-border-col p-2.5 flex flex-col z-10 shadow-lg overflow-y-auto shrink-0">
            <div className="mb-4">
                <div 
                    className="text-gray-500 text-[11px] font-bold tracking-wider mb-1 cursor-pointer flex items-center hover:text-gray-300 transition-colors select-none"
                    onClick={() => setExamplesOpen(!examplesOpen)}
                >
                    <span className={`mr-1.5 transform transition-transform duration-200 inline-block text-[10px] ${examplesOpen ? 'rotate-90' : ''}`}>▶</span>
                    EXAMPLES
                </div>
                {examplesOpen && (
                    <select 
                        className="w-full bg-[#333] text-white text-xs p-1.5 border border-[#444] rounded outline-none cursor-pointer hover:border-accent"
                        onChange={handleSelectChange}
                        defaultValue=""
                    >
                        <option value="" disabled>Load Example Project...</option>
                        {exampleOptions.map(opt => (
                            <option key={opt.key} value={opt.key}>{opt.label}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="text-gray-500 text-[11px] font-bold tracking-wider mb-1">I/O COMPONENTS</div>
            <PaletteItem type="INPUT" label="Switch (Input)" />
            <PaletteItem type="PUSH" label="Push Button (Mom)" />
            <PaletteItem type="SENSOR" label="Sensor (Pure Input)" />
            <PaletteItem type="OUTPUT" label="Output (Coil)" />
            
            <div className="text-gray-500 text-[11px] font-bold tracking-wider mb-1 mt-4">LOGIC GATES</div>
            <PaletteItem type="AND" label="AND Gate" />
            <PaletteItem type="OR" label="OR Gate" />
            <PaletteItem type="NOT" label="NOT Gate" />
            <PaletteItem type="NAND" label="NAND Gate" />
            <PaletteItem type="NOR" label="NOR Gate" />
            <PaletteItem type="XOR" label="XOR Gate" />

            <div 
                className="text-gray-500 text-[11px] font-bold tracking-wider mb-1 mt-4 cursor-pointer flex items-center hover:text-gray-300 transition-colors select-none"
                onClick={() => setMathOpen(!mathOpen)}
            >
                <span className={`mr-1.5 transform transition-transform duration-200 inline-block text-[10px] ${mathOpen ? 'rotate-90' : ''}`}>▶</span>
                MATH
            </div>
            {mathOpen && (
                <>
                    <PaletteItem type="ADD" label="ADD (Sum)" />
                    <PaletteItem type="SUB" label="SUB (Subtract)" />
                    <PaletteItem type="MUL" label="MUL (Multiply)" />
                    <PaletteItem type="DIV" label="DIV (Divide)" />
                    <PaletteItem type="GT" label="GT (Greater Than)" />
                    <PaletteItem type="LT" label="LT (Less Than)" />
                    <PaletteItem type="EQ" label="EQ (Equal)" />
                </>
            )}

            <div 
                className="text-gray-500 text-[11px] font-bold tracking-wider mb-1 mt-4 cursor-pointer flex items-center hover:text-gray-300 transition-colors select-none"
                onClick={() => setConvertersOpen(!convertersOpen)}
            >
                <span className={`mr-1.5 transform transition-transform duration-200 inline-block text-[10px] ${convertersOpen ? 'rotate-90' : ''}`}>▶</span>
                CONVERTERS
            </div>
            {convertersOpen && (
                <>
                    <PaletteItem type="BOOL_TO_INT" label="BOOL_TO_INT" />
                    <PaletteItem type="INT_TO_BOOL" label="INT_TO_BOOL" />
                    <PaletteItem type="INT_TO_REAL" label="INT_TO_REAL" />
                    <PaletteItem type="REAL_TO_INT" label="REAL_TO_INT" />
                </>
            )}
            
            <div 
                className="text-gray-500 text-[11px] font-bold tracking-wider mb-1 mt-4 cursor-pointer flex items-center hover:text-gray-300 transition-colors select-none"
                onClick={() => setAdvancedOpen(!advancedOpen)}
            >
                <span className={`mr-1.5 transform transition-transform duration-200 inline-block text-[10px] ${advancedOpen ? 'rotate-90' : ''}`}>▶</span>
                ADVANCED
            </div>
            {advancedOpen && (
                <>
                    <PaletteItem type="SR" label="SR Latch" />
                    <PaletteItem type="RS" label="RS Latch" />
                    <PaletteItem type="JK" label="JK Flip-Flop" />
                    <PaletteItem type="TON" label="TON (Timer)" />
                    <PaletteItem type="R_TRIG" label="R_TRIG (Rising Edge)" />
                    <PaletteItem type="SEL" label="SEL (Select)" />
                    <PaletteItem type="CALC" label="CPU (Calculator)" />
                </>
            )}

            <div className="text-gray-500 text-[11px] font-bold tracking-wider mb-1 mt-4">PROJECT</div>
            <button 
                type="button"
                className="bg-[#2d8a2d] text-white border-none py-1.5 px-2.5 rounded cursor-pointer text-xs font-bold w-full mt-2.5 hover:opacity-90 transition-opacity" 
                onClick={onToggleSim}
            >
                🚀 SIMULATION MODE
            </button>
            <button 
                type="button"
                className="bg-[#007acc] text-white border-none py-1.5 px-2.5 rounded cursor-pointer text-xs font-bold w-full mt-2 hover:opacity-90 transition-opacity" 
                onClick={onShowTruthTable}
            >
                📊 Truth Table
            </button>
            <button 
                type="button"
                className="bg-[#444] text-white border border-[#555] py-1.5 px-2.5 rounded cursor-pointer text-xs w-full mt-2 hover:bg-[#555] transition-colors"
                onClick={onGenerateSCL}
            >
                📝 Get SCL Code
            </button>
            <div className="flex gap-1.5 mt-2">
                <button type="button" className="flex-1 bg-accent text-white py-1.5 px-2.5 rounded text-xs hover:opacity-90" onClick={onSave}>Save</button>
                <button type="button" className="flex-1 bg-accent text-white py-1.5 px-2.5 rounded text-xs hover:opacity-90" onClick={() => document.getElementById('file-upload')?.click()}>Load</button>
                <input type="file" id="file-upload" className="hidden" onChange={onLoad} accept=".json" />
            </div>
            <button 
                type="button"
                className="bg-[#e0e0e0] text-[#333] border border-gray-400 py-1.5 px-2.5 rounded cursor-pointer text-xs font-bold w-full mt-2 hover:bg-white transition-colors"
                onClick={onExportImage}
            >
                🖼️ Export Image (JPEG)
            </button>
            <button 
                type="button"
                className="bg-[#e0e0e0] text-[#333] border border-gray-400 py-1.5 px-2.5 rounded cursor-pointer text-xs font-bold w-full mt-2 hover:bg-white transition-colors"
                onClick={onExportPDF}
            >
                📄 Export as PDF
            </button>
            <button 
                type="button"
                className="bg-[#d9534f] text-white py-1.5 px-2.5 rounded text-xs w-full mt-1.5 hover:opacity-90" 
                onClick={onReset}
            >
                Clear Project
            </button>
        </div>
    );
};

export default Sidebar;
