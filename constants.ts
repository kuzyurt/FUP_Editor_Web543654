
import { BlockDef, IOType } from './types';

export const GRID_SIZE = 20;

export const BLOCKS: Record<string, BlockDef> = {
    'INPUT': { w: 90, h: 50, in: 0, out: 1, c: '#2d5a2d', outType: 'ANY' }, 
    'SENSOR':{ w: 90, h: 50, in: 0, out: 1, c: '#2d4a5a', outType: 'BOOL' }, 
    'PUSH':  { w: 90, h: 50, in: 0, out: 1, c: '#2d445a', outType: 'BOOL' }, 
    'OUTPUT':{ w: 90, h: 50, in: 1, out: 0, c: '#5a2d2d', inTypes: ['ANY'] }, 
    
    'AND':   { w: 60, h: 60, in: 2, out: 1, c: '#444', inTypes: ['BOOL', 'BOOL'], outType: 'BOOL' },
    'OR':    { w: 60, h: 60, in: 2, out: 1, c: '#444', inTypes: ['BOOL', 'BOOL'], outType: 'BOOL' },
    'XOR':   { w: 60, h: 60, in: 2, out: 1, c: '#444', inTypes: ['BOOL', 'BOOL'], outType: 'BOOL' },
    'NAND':  { w: 60, h: 60, in: 2, out: 1, c: '#444', inTypes: ['BOOL', 'BOOL'], outType: 'BOOL' },
    'NOR':   { w: 60, h: 60, in: 2, out: 1, c: '#444', inTypes: ['BOOL', 'BOOL'], outType: 'BOOL' },
    'NOT':   { w: 60, h: 40, in: 1, out: 1, c: '#444', inTypes: ['BOOL'], outType: 'BOOL' },
    
    'ADD':   { w: 60, h: 60, in: 2, out: 1, c: '#806000', inTypes:['ANY_NUM', 'ANY_NUM'], outType: 'ANY_NUM', typeConstraint: 'HOMOGENEOUS' },
    'SUB':   { w: 60, h: 60, in: 2, out: 1, c: '#806000', inTypes:['ANY_NUM', 'ANY_NUM'], outType: 'ANY_NUM', typeConstraint: 'HOMOGENEOUS' },
    'MUL':   { w: 60, h: 60, in: 2, out: 1, c: '#806000', inTypes:['ANY_NUM', 'ANY_NUM'], outType: 'ANY_NUM', typeConstraint: 'HOMOGENEOUS' },
    'DIV':   { w: 60, h: 60, in: 2, out: 1, c: '#806000', inTypes:['ANY_NUM', 'ANY_NUM'], outType: 'ANY_NUM', typeConstraint: 'HOMOGENEOUS' }, 
    
    'GT':    { w: 60, h: 60, in: 2, out: 1, c: '#806000', labels:['>'], inTypes:['ANY_NUM', 'ANY_NUM'], outType: 'BOOL', typeConstraint: 'INPUTS_MATCH' },
    'LT':    { w: 60, h: 60, in: 2, out: 1, c: '#806000', labels:['<'], inTypes:['ANY_NUM', 'ANY_NUM'], outType: 'BOOL', typeConstraint: 'INPUTS_MATCH' },
    'EQ':    { w: 60, h: 60, in: 2, out: 1, c: '#806000', labels:['='], inTypes:['ANY', 'ANY'], outType: 'BOOL', typeConstraint: 'INPUTS_MATCH' }, 

    'BOOL_TO_INT': { w: 90, h: 40, in: 1, out: 1, c: '#553355', labels: ['IN', 'OUT'], inTypes: ['BOOL'], outType: 'INT' },
    'INT_TO_BOOL': { w: 90, h: 40, in: 1, out: 1, c: '#553355', labels: ['IN', 'OUT'], inTypes: ['INT'], outType: 'BOOL' },
    'INT_TO_REAL': { w: 90, h: 40, in: 1, out: 1, c: '#553355', labels: ['IN', 'OUT'], inTypes: ['INT'], outType: 'REAL' },
    'REAL_TO_INT': { w: 90, h: 40, in: 1, out: 1, c: '#553355', labels: ['IN', 'OUT'], inTypes: ['REAL'], outType: 'INT' },

    'SEL':   { w: 60, h: 80, in: 3, out: 1, c: '#806000', labels:['G','IN0','IN1'], inTypes: ['BOOL', 'ANY', 'ANY'], outType: 'ANY', typeConstraint: 'HOMOGENEOUS' },
    'SR':    { w: 60, h: 60, in: 2, out: 1, c: '#2a5a4a', labels:['S1','R'], inTypes: ['BOOL', 'BOOL'], outType: 'BOOL' },
    'RS':    { w: 60, h: 60, in: 2, out: 1, c: '#5a2a2a', labels:['S','R1'], inTypes: ['BOOL', 'BOOL'], outType: 'BOOL' },
    'JK':    { w: 60, h: 80, in: 3, out: 1, c: '#6d4c41', labels:['J','K','CLK'], inTypes: ['BOOL', 'BOOL', 'BOOL'], outType: 'BOOL' },
    'TON':   { w: 100, h: 60, in: 1, out: 1, c: '#806000', labels:['IN'], props: {preset: 2000, acc:0}, inTypes: ['BOOL'], outType: 'BOOL' },
    'R_TRIG':{ w: 60, h: 50, in: 1, out: 1, c: '#555', labels:['CLK'], inTypes:['BOOL'], outType:'BOOL' },
    
    'CALC':  { 
        w: 80, h: 60, in: 17, out: 1, c: '#222', 
        labels: ['0','1','2','3','4','5','6','7','8','9','+','-','*','/','=','C','.'],
        props: { acc: 0, op: 0, newEntry: true, val: 0, dec: false, decPos: 1 },
        inTypes: Array(17).fill('BOOL' as IOType),
        outType: 'REAL',
    }
};
