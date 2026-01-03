
import { NodeData, IOType, Variable, Connection, DataType } from './types';
import { BLOCKS } from './constants';

const COLORS = {
    BOOL: '#98c379',
    INT:  '#56b6c2',
    REAL: '#c678dd',
    ANY:  '#abb2bf',
    ANY_NUM: '#e5c07b'
};

const mapVarTypeToIO = (dt: DataType): IOType => {
    if (dt === 'DINT') return 'INT';
    return dt;
};

export const resolveBlockType = (
    node: NodeData, 
    variables: Variable[], 
    connections?: Connection[], 
    nodes?: NodeData[]
): IOType | undefined => {
    if (node.varName) {
        const v = variables.find(va => va.name === node.varName);
        if (v) return mapVarTypeToIO(v.dataType);
    }
    if (node.lockedType) return node.lockedType;

    const conf = BLOCKS[node.type];
    if (connections && nodes && (conf.typeConstraint === 'HOMOGENEOUS' || conf.typeConstraint === 'INPUTS_MATCH')) {
         const incoming = connections.filter(c => c.to === node.id);
         for (const conn of incoming) {
             const srcNode = nodes.find(n => n.id === conn.from);
             if (srcNode) {
                 if (srcNode.varName) {
                     const v = variables.find(va => va.name === srcNode.varName);
                     if (v) return mapVarTypeToIO(v.dataType);
                 }
                 if (srcNode.lockedType) return srcNode.lockedType;
                 const srcConf = BLOCKS[srcNode.type];
                 if (srcConf.outType && srcConf.outType !== 'ANY' && srcConf.outType !== 'ANY_NUM') {
                     return srcConf.outType;
                 }
             }
         }
    }
    return undefined;
};

export const getNodeIOType = (
    node: NodeData, 
    variables: Variable[], 
    portIndex: number, 
    isInput: boolean,
    connections?: Connection[],
    nodes?: NodeData[]
): IOType => {
    const conf = BLOCKS[node.type];
    const resolvedType = resolveBlockType(node, variables, connections, nodes);

    if (isInput) {
        if (resolvedType && (conf.typeConstraint === 'HOMOGENEOUS' || conf.typeConstraint === 'INPUTS_MATCH')) {
            const defType = conf.inTypes ? (conf.inTypes[portIndex] || 'BOOL') : 'BOOL';
            if (defType === 'ANY' || defType === 'ANY_NUM') return resolvedType;
        }
        if (!conf.inTypes) return 'BOOL'; 
        return conf.inTypes[portIndex] || 'BOOL';
    } else {
        if (resolvedType) {
            if (conf.outType === 'BOOL' && conf.typeConstraint === 'INPUTS_MATCH') return 'BOOL';
            return resolvedType;
        }
        if (!conf.outType) return 'BOOL'; 
        return conf.outType;
    }
};

export const areTypesCompatible = (sourceType: IOType, targetType: IOType): boolean => {
    if (sourceType === 'ANY' || targetType === 'ANY') return true;
    if (sourceType === targetType) return true;
    if (targetType === 'ANY_NUM') return sourceType === 'INT' || sourceType === 'REAL';
    if (sourceType === 'ANY_NUM') return targetType === 'INT' || targetType === 'REAL';
    return false;
};

export const getTypeColor = (type: IOType): string => {
    switch (type) {
        case 'BOOL': return COLORS.BOOL;
        case 'INT': return COLORS.INT;
        case 'REAL': return COLORS.REAL;
        case 'ANY_NUM': return COLORS.ANY_NUM;
        default: return COLORS.ANY;
    }
};

export const resolveActualType = (node: NodeData, variables: Variable[], connections?: Connection[], nodes?: NodeData[]): IOType => {
    return getNodeIOType(node, variables, 0, false, connections, nodes);
};
