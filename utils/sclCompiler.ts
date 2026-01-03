

import { NodeData, Connection, Variable } from '../types';
import { BLOCKS } from '../constants';
import { resolveBlockType } from './typeSystem';

export const generateSCL = (nodes: NodeData[], connections: Connection[], variables: Variable[]): string => {
    try {
        if (nodes.length === 0) return "(* No Logic Defined - Add blocks to the canvas *)";

        const lines: string[] = [];
        const indent = "    ";
        const cleanName = (name: string) => `"${name.replace(/"/g, '')}"`;

        // === 1. HEADER: PROGRAM ===
        lines.push(`PROGRAM Main_Logic`);
        lines.push(`TITLE = 'OpenPLC Generated Logic'`);
        lines.push(`VERSION : 1.0`);
        lines.push(``);

        // === 2. VARIABLE DECLARATION ===
        const inputs: string[] = [];
        const outputs: string[] = [];
        const statics: string[] = [];
        
        variables.forEach(v => {
            const sanitized = cleanName(v.name);
            let decl = `${indent}${sanitized}`;
            if(v.address && v.address.trim().length > 0) {
                decl += ` AT ${v.address.trim()}`;
            }
            decl += ` : ${v.dataType};`;
            if(v.displayName) decl += ` // ${v.displayName}`;

            const addr = v.address?.toUpperCase() || "";
            if (addr.startsWith('%I')) inputs.push(decl);
            else if (addr.startsWith('%Q')) outputs.push(decl);
            else statics.push(decl);
        });

        if (inputs.length > 0) {
            lines.push(`VAR_INPUT`);
            lines.push(...inputs);
            lines.push(`END_VAR`);
        }
        if (outputs.length > 0) {
            lines.push(`VAR_OUTPUT`);
            lines.push(...outputs);
            lines.push(`END_VAR`);
        }
        
        lines.push(`VAR`);
        lines.push(...statics);

        // === Internal Node States (Type Inference) ===
        lines.push(``);
        lines.push(`${indent}// Internal Block States`);
        
        // Helper to guess type based on block or variable
        const getNodeType = (n: NodeData): string => {
            // Polymorphic Blocks
            if(['ADD', 'SUB', 'MUL', 'DIV', 'SEL'].includes(n.type)) {
                const res = resolveBlockType(n, variables, connections, nodes);
                if (res === 'INT') return 'INT';
                if (res === 'REAL') return 'REAL';
                return 'REAL'; // Default fallback
            }
            if(['AND', 'OR', 'XOR', 'NOT', 'NAND', 'NOR', 'SR', 'RS', 'JK', 'TON', 'GT', 'LT', 'EQ'].includes(n.type)) return 'BOOL';
            if(n.type === 'BOOL_TO_INT' || n.type === 'REAL_TO_INT') return 'INT';
            if(n.type === 'INT_TO_REAL') return 'REAL';
            
            // For I/O, check variable
            if(n.varName) {
                const v = variables.find(x => x.name === n.varName);
                if(v) return v.dataType;
            }
            // Default I/O without variable
            return 'BOOL';
        };

        nodes.forEach(n => {
            if(n.type !== 'OUTPUT') {
                const type = getNodeType(n);
                lines.push(`${indent}stat_Node${n.id}_Out : ${type};`); 
            }
            
            if(['TON', 'SR', 'RS', 'JK'].includes(n.type)) {
                const fbType = n.type === 'JK' ? 'FB_JK' : n.type;
                lines.push(`${indent}inst_${n.type}_Node${n.id} : ${fbType};`);
            }
        });
        lines.push(`END_VAR`);

        lines.push(``);
        lines.push(`BEGIN`);

        // === 3. LOGIC GENERATION ===
        
        const getStatName = (id: number) => `stat_Node${id}_Out`;

        const getSource = (nodeId: number, pinIdx: number, requiredType?: 'INT'|'REAL'): string => {
            const conn = connections.find(c => c.to === nodeId && c.inPort === pinIdx);
            if (!conn) {
                // Default value
                if (requiredType === 'REAL') return "0.0";
                if (requiredType === 'INT') return "0";
                return "FALSE";
            }
            const srcNode = nodes.find(n => n.id === conn.from);
            if (srcNode && ['INPUT', 'PUSH', 'SENSOR'].includes(srcNode.type) && srcNode.varName) {
                return cleanName(srcNode.varName);
            }
            return getStatName(conn.from);
        };

        // Topological Sort
        const depGraph = new Map<number, number[]>();
        nodes.forEach(n => depGraph.set(n.id, []));
        connections.forEach(c => depGraph.get(c.to)?.push(c.from));
        
        const sorted: NodeData[] = [];
        const visited = new Set<number>();
        const visit = (id: number, stack: Set<number>) => {
            if (stack.has(id)) return;
            if (visited.has(id)) return;
            stack.add(id);
            depGraph.get(id)?.forEach(sid => visit(sid, stack));
            stack.delete(id);
            visited.add(id);
            const n = nodes.find(x => x.id === id);
            if(n) sorted.push(n);
        };
        nodes.forEach(n => visit(n.id, new Set()));

        sorted.forEach(n => {
            lines.push(`    // Block: ${n.type} #${n.id}`);
            const outVar = getStatName(n.id);
            const resolvedType = resolveBlockType(n, variables, connections, nodes);
            const isReal = resolvedType === 'REAL' || (!resolvedType && ['ADD','SUB','MUL','DIV'].includes(n.type));
            const numType = isReal ? 'REAL' : 'INT';

            switch(n.type) {
                case 'INPUT': case 'PUSH': case 'SENSOR':
                    if (n.varName) {
                         lines.push(`${indent}${outVar} := ${cleanName(n.varName)};`);
                    } else {
                        lines.push(`${indent}${outVar} := ${n.type === 'INPUT' && n.lockedType==='REAL' ? '0.0' : n.type==='INPUT' && n.lockedType==='INT' ? '0' : 'FALSE'};`);
                    }
                    break;
                
                case 'OUTPUT':
                    if (n.varName) {
                        lines.push(`${indent}${cleanName(n.varName)} := ${getSource(n.id, 0)};`);
                    }
                    break;

                // Logic
                case 'AND': case 'OR': case 'XOR':
                    {
                        const op = n.type;
                        const ins = n.customIn || BLOCKS[n.type].in;
                        const terms: string[] = [];
                        for(let i=0; i<ins; i++) terms.push(getSource(n.id, i));
                        if(terms.length) lines.push(`${indent}${outVar} := ${terms.join(` ${op} `)};`);
                    }
                    break;
                case 'NOT':
                    lines.push(`${indent}${outVar} := NOT ${getSource(n.id, 0)};`);
                    break;

                // Math
                case 'ADD':
                    lines.push(`${indent}${outVar} := ${getSource(n.id, 0, numType)} + ${getSource(n.id, 1, numType)};`);
                    break;
                case 'SUB':
                    lines.push(`${indent}${outVar} := ${getSource(n.id, 0, numType)} - ${getSource(n.id, 1, numType)};`);
                    break;
                case 'MUL':
                    lines.push(`${indent}${outVar} := ${getSource(n.id, 0, numType)} * ${getSource(n.id, 1, numType)};`);
                    break;
                case 'DIV':
                    lines.push(`${indent}${outVar} := ${getSource(n.id, 0, numType)} / ${getSource(n.id, 1, numType)};`);
                    break;
                
                // Converters
                case 'BOOL_TO_INT':
                    lines.push(`${indent}${outVar} := BOOL_TO_INT(${getSource(n.id, 0)});`);
                    break;
                case 'INT_TO_BOOL':
                    lines.push(`${indent}${outVar} := INT_TO_BOOL(${getSource(n.id, 0, 'INT')});`);
                    break;
                case 'INT_TO_REAL':
                    lines.push(`${indent}${outVar} := INT_TO_REAL(${getSource(n.id, 0, 'INT')});`);
                    break;
                case 'REAL_TO_INT':
                    lines.push(`${indent}${outVar} := REAL_TO_INT(${getSource(n.id, 0, 'REAL')});`);
                    break;

                // Function Blocks
                case 'SR':
                    lines.push(`${indent}inst_SR_Node${n.id}(S1 := ${getSource(n.id, 0)}, R := ${getSource(n.id, 1)});`);
                    lines.push(`${indent}${outVar} := inst_SR_Node${n.id}.Q1;`);
                    break;
                case 'RS':
                    lines.push(`${indent}inst_RS_Node${n.id}(S := ${getSource(n.id, 0)}, R1 := ${getSource(n.id, 1)});`);
                    lines.push(`${indent}${outVar} := inst_RS_Node${n.id}.Q1;`);
                    break;
                case 'TON':
                    lines.push(`${indent}inst_TON_Node${n.id}(IN := ${getSource(n.id, 0)}, PT := T#${n.props?.preset || 2000}ms);`);
                    lines.push(`${indent}${outVar} := inst_TON_Node${n.id}.Q;`);
                    break;
                case 'JK':
                    lines.push(`${indent}inst_JK_Node${n.id}(J:=${getSource(n.id,0)}, K:=${getSource(n.id,1)}, CLK:=${getSource(n.id,2)});`);
                    lines.push(`${indent}${outVar} := inst_JK_Node${n.id}.Q;`);
                    break;
            }
            lines.push(``);
        });

        lines.push(`END_PROGRAM`);

        if (nodes.some(n => n.type === 'JK')) {
            lines.push(`
FUNCTION_BLOCK FB_JK
    VAR_INPUT J : BOOL; K : BOOL; CLK : BOOL; END_VAR
    VAR_OUTPUT Q : BOOL; END_VAR
    VAR lastClk : BOOL; END_VAR
BEGIN
    IF CLK AND NOT lastClk THEN
        IF J AND K THEN Q := NOT Q;
        ELSIF J AND NOT K THEN Q := TRUE;
        ELSIF NOT J AND K THEN Q := FALSE;
        END_IF;
    END_IF;
    lastClk := CLK;
END_FUNCTION_BLOCK`);
        }

        return lines.join('\n');
    } catch(e: any) {
        return `(* Error: ${e.message} *)`;
    }
};