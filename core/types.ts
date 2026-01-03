
export interface Point {
    x: number;
    y: number;
}

export type DataType = 'BOOL' | 'INT' | 'DINT' | 'REAL';

// IEC 61131-3 Data Types
export type IOType = 'BOOL' | 'INT' | 'REAL' | 'ANY_NUM' | 'ANY';

export interface NodeData {
    id: number;
    type: string;
    x: number;
    y: number;
    inputs: (boolean | number)[]; 
    state: boolean | number;      
    varName: string | null;
    customIn?: number;
    customLabel?: string;
    prevClk?: boolean;
    props?: Record<string, any>;
    prevInputs?: boolean[]; 
    lockedType?: IOType; // User-forced type override
}

export interface Connection {
    id: number;
    from: number; 
    to: number;   
    inPort: number; 
    color?: string;
    path?: Point[];
}

export interface Variable {
    id: number;
    name: string;
    address: string; 
    dataType: DataType;
    displayName: string;
    value: boolean | number;
}

export interface BlockDef {
    w: number;
    h: number;
    in: number;
    out: number;
    c: string;
    labels?: string[];
    props?: Record<string, any>;
    inTypes?: IOType[]; 
    outType?: IOType;   
    typeConstraint?: 'HOMOGENEOUS' | 'INPUTS_MATCH'; 
}

export interface AppState {
    nodes: NodeData[];
    connections: Connection[];
    variables: Variable[];
    nextId: number;
    nextVarId: number;
}

export interface CanvasHandle {
    getExportImage: (format?: 'image/jpeg' | 'image/png') => string;
}
