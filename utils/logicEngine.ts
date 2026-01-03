

import { NodeData, Connection, Variable } from '../types';
import { BLOCKS } from '../constants';
import { resolveBlockType } from './typeSystem';

export const evaluateCircuit = (
    nodes: NodeData[], 
    connections: Connection[], 
    variables: Variable[],
    dt: number = 0
) => {
    // 1. Sync Variables -> Inputs
    nodes.filter(n => ['INPUT', 'SENSOR'].includes(n.type)).forEach(n => {
        if (n.varName) {
            const v = variables.find(x => x.name === n.varName);
            if (v) {
                n.state = v.value; // Store actual value (boolean or number)
            }
        }
    });

    // 2. Sync PUSH -> Variables (Always Bool)
    nodes.filter(n => n.type === 'PUSH').forEach(n => {
        if (n.varName) {
            const v = variables.find(x => x.name === n.varName);
            if (v) v.value = Boolean(n.state);
        }
    });

    // 3. Compute Blocks
    nodes.forEach(n => {
        const inp = n.inputs;
        const limit = n.customIn || BLOCKS[n.type].in;
        const rawArgs = inp.slice(0, limit);
        const boolArgs = rawArgs.map(v => !!v); // For logic gates
        
        // Resolve type for math precision
        const type = resolveBlockType(n, variables, connections, nodes);
        const isInt = type === 'INT';

        switch(n.type) {
            // Logic
            case 'AND': n.state = boolArgs.every(i => i); break;
            case 'OR':  n.state = boolArgs.some(i => i); break;
            case 'NAND':n.state = !boolArgs.every(i => i); break;
            case 'NOR': n.state = !boolArgs.some(i => i); break;
            case 'XOR': n.state = (boolArgs.filter(i => i).length % 2) === 1; break;
            case 'NOT': n.state = !boolArgs[0]; break;
            
            // Math
            case 'ADD': 
                n.state = Number(rawArgs[0] || 0) + Number(rawArgs[1] || 0); 
                if(isInt) n.state = Math.floor(n.state); // Truncate for INT
                n.customLabel = `=${Number(n.state).toFixed(isInt ? 0 : 2)}`; 
                break;
            case 'SUB': 
                n.state = Number(rawArgs[0] || 0) - Number(rawArgs[1] || 0); 
                if(isInt) n.state = Math.floor(n.state);
                n.customLabel = `=${Number(n.state).toFixed(isInt ? 0 : 2)}`; 
                break;
            case 'MUL': 
                n.state = Number(rawArgs[0] || 0) * Number(rawArgs[1] || 0); 
                if(isInt) n.state = Math.floor(n.state);
                n.customLabel = `=${Number(n.state).toFixed(isInt ? 0 : 2)}`; 
                break;
            case 'DIV': 
                const denom = Number(rawArgs[1] || 0);
                if (denom === 0) {
                    n.state = 0; // IEC division by zero typically 0 or error.
                } else {
                    n.state = Number(rawArgs[0] || 0) / denom;
                    if(isInt) n.state = Math.floor(n.state); // Integer Division
                }
                n.customLabel = `=${Number(n.state).toFixed(isInt ? 0 : 2)}`;
                break;
            case 'GT': n.state = Number(rawArgs[0]||0) > Number(rawArgs[1]||0); break;
            case 'LT': n.state = Number(rawArgs[0]||0) < Number(rawArgs[1]||0); break;
            case 'EQ': n.state = Number(rawArgs[0]||0) === Number(rawArgs[1]||0); break;

            // Converters
            case 'BOOL_TO_INT': n.state = boolArgs[0] ? 1 : 0; break;
            case 'INT_TO_BOOL': n.state = Number(rawArgs[0]) !== 0; break;
            case 'INT_TO_REAL': n.state = Number(rawArgs[0]); break;
            case 'REAL_TO_INT': n.state = Math.round(Number(rawArgs[0])); break;

            // Functions
            case 'SEL': n.state = boolArgs[0] ? (rawArgs[2] || 0) : (rawArgs[1] || 0); break;
            case 'R_TRIG':
                if (boolArgs[0] && !n.prevClk) n.state = true; else n.state = false;
                n.prevClk = boolArgs[0];
                break;
            case 'SR': if(boolArgs[0]) n.state = true; else if(boolArgs[1]) n.state = false; break;
            case 'RS': if(boolArgs[1]) n.state = false; else if(boolArgs[0]) n.state = true; break;
            case 'JK':
                const j = boolArgs[0], k = boolArgs[1], clk = boolArgs[2];
                if(clk && !n.prevClk) {
                    if(j && k) n.state = !n.state; else if(j && !k) n.state = true; else if(!j && k) n.state = false;
                }
                n.prevClk = clk;
                break;
            case 'TON':
                if(!n.props) n.props = { preset: 2000, acc: 0 };
                if(boolArgs[0]) {
                    if(n.props.acc < n.props.preset) n.props.acc += dt;
                    n.state = n.props.acc >= n.props.preset;
                } else { n.props.acc = 0; n.state = false; }
                n.customLabel = `T:${(n.props.acc/1000).toFixed(1)}s`;
                break;
            case 'CALC':
                // Inputs: 0-9, +,-,*,/, =, C, .
                if (!n.props) n.props = { val: 0, acc: 0, op: 0, newEntry: true, dec: false, decPos: 0.1 };
                if (!n.prevInputs) n.prevInputs = new Array(17).fill(false);
                // Decimal
                if(boolArgs[16] && !n.prevInputs[16]) {
                    n.props.dec = true; n.props.decPos = 0.1;
                    if(n.props.newEntry) { n.props.val = 0; n.props.newEntry = false; }
                }
                // Digits
                for(let i=0; i<=9; i++) {
                    if(boolArgs[i] && !n.prevInputs[i]) {
                        if (n.props.newEntry) { n.props.val = i; n.props.newEntry = false; n.props.dec = false; }
                        else {
                            if(n.props.dec) { n.props.val += i * n.props.decPos; n.props.decPos *= 0.1; }
                            else { n.props.val = n.props.val * 10 + i; }
                        }
                    }
                }
                // Ops
                [10,11,12,13].forEach((pin, idx) => {
                    if(boolArgs[pin] && !n.prevInputs[pin]) {
                        if (n.props.op !== 0 && !n.props.newEntry) {
                            switch(n.props.op) {
                                case 1: n.props.acc += n.props.val; break;
                                case 2: n.props.acc -= n.props.val; break;
                                case 3: n.props.acc *= n.props.val; break;
                                case 4: if(n.props.val!==0) n.props.acc /= n.props.val; break;
                            }
                            n.props.val = n.props.acc;
                        } else { n.props.acc = n.props.val; }
                        n.props.op = idx + 1; n.props.newEntry = true; n.props.dec = false;
                    }
                });
                // EQ
                if(boolArgs[14] && !n.prevInputs[14] && n.props.op !== 0) {
                        switch(n.props.op) {
                        case 1: n.props.val = n.props.acc + n.props.val; break;
                        case 2: n.props.val = n.props.acc - n.props.val; break;
                        case 3: n.props.val = n.props.acc * n.props.val; break;
                        case 4: if(n.props.val!==0) n.props.val = n.props.acc / n.props.val; break;
                    }
                    n.props.acc = n.props.val; n.props.op = 0; n.props.newEntry = true; n.props.dec = false;
                }
                // CLR
                if(boolArgs[15] && !n.prevInputs[15]) {
                    n.props.val = 0; n.props.acc = 0; n.props.op = 0; n.props.newEntry = true; n.props.dec = false;
                }
                n.state = n.props.val; n.prevInputs = [...boolArgs];
                break;
        }
    });

    // 4. Reset Internal Inputs (prepare for next wire propagation)
    nodes.filter(n => !['INPUT','PUSH','SENSOR'].includes(n.type)).forEach(n => n.inputs.fill(0));
    
    // 5. Propagate Wires
    connections.forEach(c => {
        const src = nodes.find(n => n.id === c.from);
        const dst = nodes.find(n => n.id === c.to);
        if(src && dst && dst.inputs) dst.inputs[c.inPort] = src.state;
    });

    // 6. Sync Outputs to Variables (Result)
    nodes.filter(n => n.type === 'OUTPUT').forEach(n => {
        n.state = n.inputs[0] !== undefined ? n.inputs[0] : false;
        if(n.varName) {
            const v = variables.find(x => x.name === n.varName);
            if(v && v.value !== n.state) v.value = n.state; 
        }
    });
};