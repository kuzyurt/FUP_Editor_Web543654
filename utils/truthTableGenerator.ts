
import { NodeData, Connection, Variable } from '../types';
import { evaluateCircuit } from './logicEngine';

export interface TruthTableRow {
    inputs: { name: string, value: boolean }[];
    outputs: { name: string, value: boolean | number }[];
}

const getNodeName = (n: NodeData) => {
    // Priority: Variable Name -> Custom Label -> Type + ID
    if (n.varName) return n.varName;
    if (n.customLabel) return n.customLabel;
    // Format default names nicely
    if (n.type === 'OUTPUT') return `OUT ${n.id}`;
    return `${n.type} ${n.id}`;
};

export const generateTruthTableData = (
    originalNodes: NodeData[], 
    originalConnections: Connection[], 
    originalVariables: Variable[]
): TruthTableRow[] => {
    
    // 1. Identify Inputs and Outputs
    // We only consider Boolean inputs for Truth Table generation to keep it computable.
    // Inputs: INPUT, PUSH, SENSOR.
    const inputNodes = originalNodes
        .filter(n => ['INPUT', 'PUSH', 'SENSOR'].includes(n.type))
        .sort((a, b) => getNodeName(a).localeCompare(getNodeName(b)));

    const outputNodes = originalNodes
        .filter(n => n.type === 'OUTPUT')
        .sort((a, b) => getNodeName(a).localeCompare(getNodeName(b)));

    if (inputNodes.length === 0) return [];

    // Limit to 10 inputs (1024 rows) to prevent browser freeze
    const MAX_INPUTS = 10;
    const inputsToProcess = inputNodes.slice(0, MAX_INPUTS);
    const permutations = 1 << inputsToProcess.length; // 2^n

    const rows: TruthTableRow[] = [];

    // 2. Iterate through all binary combinations
    for (let i = 0; i < permutations; i++) {
        // Deep clone state to ensure statelessness for each row calculation
        const nodesCopy: NodeData[] = JSON.parse(JSON.stringify(originalNodes));
        const connectionsCopy: Connection[] = JSON.parse(JSON.stringify(originalConnections));
        const variablesCopy: Variable[] = JSON.parse(JSON.stringify(originalVariables));

        // 3. Set Input Values based on current bitmask 'i'
        const currentInputs: { name: string, value: boolean }[] = [];
        
        inputsToProcess.forEach((inputNode, bitIndex) => {
            // Check bit at specific position. Reverse index so 001 corresponds to last input usually
            const bit = (i >> (inputsToProcess.length - 1 - bitIndex)) & 1;
            const isHigh = bit === 1;

            // Find the cloned node
            const clonedNode = nodesCopy.find(n => n.id === inputNode.id);
            if (clonedNode) {
                clonedNode.state = isHigh;
                
                // If it has a variable, update that too
                if (clonedNode.varName) {
                    const clonedVar = variablesCopy.find(v => v.name === clonedNode.varName);
                    if (clonedVar) clonedVar.value = isHigh;
                }
            }

            currentInputs.push({
                name: getNodeName(inputNode),
                value: isHigh
            });
        });

        // 4. Run Simulation
        // For combinational logic, one pass is usually enough. 
        // For complex propagation, we might run it a few times to let signals settle through the graph.
        // We run it 5 times to ensure propagation through depths of logic gates.
        for(let step=0; step<5; step++) {
            evaluateCircuit(nodesCopy, connectionsCopy, variablesCopy, 0);
        }

        // 5. Capture Outputs
        const currentOutputs: { name: string, value: boolean | number }[] = [];
        outputNodes.forEach(outNode => {
            const clonedOut = nodesCopy.find(n => n.id === outNode.id);
            if (clonedOut) {
                currentOutputs.push({
                    name: getNodeName(outNode),
                    value: clonedOut.state
                });
            }
        });

        rows.push({
            inputs: currentInputs,
            outputs: currentOutputs
        });
    }

    return rows;
};
