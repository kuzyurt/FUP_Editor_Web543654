
import { NodeData, Connection, Variable } from '../core/types';
import { evaluateCircuit } from './logicEngine';

export interface TruthTableRow {
    inputs: { name: string, value: boolean }[];
    states: { name: string, current: boolean, next: boolean }[]; // New: State tracking
    outputs: { name: string, value: boolean | number }[];
    isSequential: boolean;
}

const getNodeName = (n: NodeData) => {
    if (n.varName) return n.varName;
    if (n.customLabel) return n.customLabel;
    if (n.type === 'OUTPUT') return `OUT ${n.id}`;
    return `${n.type} ${n.id}`;
};

export const generateTruthTableData = (
    originalNodes: NodeData[], 
    originalConnections: Connection[], 
    originalVariables: Variable[]
): TruthTableRow[] => {
    
    // 1. Identify Inputs (External)
    const inputNodes = originalNodes
        .filter(n => ['INPUT', 'PUSH', 'SENSOR'].includes(n.type))
        .sort((a, b) => getNodeName(a).localeCompare(getNodeName(b)));

    // 2. Identify Outputs (External)
    const outputNodes = originalNodes
        .filter(n => n.type === 'OUTPUT')
        .sort((a, b) => getNodeName(a).localeCompare(getNodeName(b)));

    // 3. Identify Stateful Blocks (JK, SR, RS, Flip-Flops)
    // These act as both Inputs (Current State) and Outputs (Next State) in the transition table
    const stateNodes = originalNodes
        .filter(n => ['JK', 'SR', 'RS', 'R_TRIG'].includes(n.type))
        .sort((a, b) => getNodeName(a).localeCompare(getNodeName(b)));

    if (inputNodes.length === 0 && stateNodes.length === 0) return [];

    // Limit permutations to avoid crash. 
    // Inputs + States <= 10 usually limits processing load.
    const allInputVariables = [...inputNodes, ...stateNodes];
    const MAX_VARS = 10;
    const processableVars = allInputVariables.slice(0, MAX_VARS);
    
    const permutations = 1 << processableVars.length; 
    const rows: TruthTableRow[] = [];

    // 4. Iterate Permutations (Input Combinations + Current State Combinations)
    for (let i = 0; i < permutations; i++) {
        // Deep clone state to isolate rows
        const nodesCopy: NodeData[] = JSON.parse(JSON.stringify(originalNodes));
        const connectionsCopy: Connection[] = JSON.parse(JSON.stringify(originalConnections));
        const variablesCopy: Variable[] = JSON.parse(JSON.stringify(originalVariables));

        const currentInputs: { name: string, value: boolean }[] = [];
        const currentStates: { name: string, current: boolean, next: boolean }[] = [];

        // Apply bitmask to Inputs AND Current States
        processableVars.forEach((pNode, bitIndex) => {
            const bit = (i >> (processableVars.length - 1 - bitIndex)) & 1;
            const isHigh = bit === 1;
            
            const clonedNode = nodesCopy.find(n => n.id === pNode.id);
            if (clonedNode) {
                clonedNode.state = isHigh; // Force State (Current Q for FlipFlops)

                if (['INPUT', 'PUSH', 'SENSOR'].includes(clonedNode.type)) {
                    if (clonedNode.varName) {
                        const clonedVar = variablesCopy.find(v => v.name === clonedNode.varName);
                        if (clonedVar) clonedVar.value = isHigh;
                    }
                    currentInputs.push({ name: getNodeName(pNode), value: isHigh });
                } else {
                    // It's a state node
                    currentStates.push({ name: getNodeName(pNode), current: isHigh, next: false });
                    
                    // CRITICAL for Sequential Logic in Static Table:
                    // We must trick the logic engine into detecting edges if the CLK input is high in this row.
                    // By default, deep clone leaves prevClk undefined.
                    // We explicitly set prevClk to FALSE for all state nodes before eval.
                    // This ensures that if the input CLK is 1, the engine sees 0 -> 1 (Rising Edge).
                    clonedNode.prevClk = false;
                }
            }
        });

        // 5. Evaluate Circuit
        // We run a few passes to settle combinatorial logic
        for(let step=0; step<5; step++) {
            evaluateCircuit(nodesCopy, connectionsCopy, variablesCopy, 0);
        }

        // 6. Capture Outputs (Next State)
        const outputs: { name: string, value: boolean | number }[] = [];
        
        outputNodes.forEach(outNode => {
            const clonedOut = nodesCopy.find(n => n.id === outNode.id);
            if (clonedOut) outputs.push({ name: getNodeName(outNode), value: clonedOut.state });
        });

        // Update "Next State" in our tracking array
        currentStates.forEach(stateItem => {
            const originalNode = stateNodes.find(n => getNodeName(n) === stateItem.name);
            const processedNode = nodesCopy.find(n => n.id === originalNode?.id);
            if(processedNode) stateItem.next = Boolean(processedNode.state);
        });

        rows.push({
            inputs: currentInputs,
            states: currentStates,
            outputs: outputs,
            isSequential: stateNodes.length > 0
        });
    }

    return rows;
};
