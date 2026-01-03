
import { AppState } from '../core/types';
import { STATE_MACHINE } from './state_machine';

export const EXAMPLE_OPTIONS = [
    { key: 'simple_latch', label: 'Simple Latch' },
    { key: 'blinking_light', label: 'Blinking Light (Timer)' },
    { key: 'real_sum', label: 'Calculator (Real)' },
    { key: 'custom_demo', label: 'Custom Sensor Demo' },
    { key: 'state_machine', label: 'Sequential State Machine (F0/F1)' }
];

export const EXAMPLES: Record<string, AppState> = {
    'simple_latch': {
        "nodes": [
            { "id": 1, "type": "PUSH", "x": 60, "y": 60, "inputs": [], "state": false, "varName": "Start_Btn" },
            { "id": 2, "type": "INPUT", "x": 60, "y": 160, "inputs": [], "state": false, "varName": "Stop_Btn" },
            { "id": 3, "type": "SR", "x": 260, "y": 100, "inputs": [false, false], "state": false, "varName": null },
            { "id": 4, "type": "OUTPUT", "x": 440, "y": 110, "inputs": [false], "state": false, "varName": "Motor" }
        ],
        "connections": [
            { "id": 101, "from": 1, "to": 3, "inPort": 0 },
            { "id": 102, "from": 2, "to": 3, "inPort": 1 },
            { "id": 103, "from": 3, "to": 4, "inPort": 0 }
        ],
        "variables": [
            { "id": 1, "name": "Start_Btn", "address": "%I0.0", "dataType": "BOOL", "displayName": "Start System", "value": false },
            { "id": 2, "name": "Stop_Btn", "address": "%I0.1", "dataType": "BOOL", "displayName": "Emergency Stop", "value": false },
            { "id": 3, "name": "Motor", "address": "%Q0.0", "dataType": "BOOL", "displayName": "Motor Coil", "value": false }
        ],
        "nextId": 5,
        "nextVarId": 4
    },
    'blinking_light': {
        "nodes": [
            { "id": 1, "type": "INPUT", "x": 60, "y": 60, "inputs": [], "state": false, "varName": "Enable" },
            { "id": 2, "type": "NOT", "x": 260, "y": 200, "inputs": [false], "state": false, "varName": null },
            { "id": 3, "type": "TON", "x": 260, "y": 60, "inputs": [false], "state": false, "varName": null, "props": { "preset": 1000, "acc": 0 } },
            { "id": 4, "type": "OUTPUT", "x": 460, "y": 70, "inputs": [false], "state": false, "varName": "Light" }
        ],
        "connections": [
            { "id": 101, "from": 1, "to": 3, "inPort": 0 },
            { "id": 102, "from": 3, "to": 2, "inPort": 0 },
            { "id": 103, "from": 3, "to": 4, "inPort": 0 }
        ],
        "variables": [
            { "id": 1, "name": "Enable", "address": "%I0.0", "dataType": "BOOL", "displayName": "Master Switch", "value": false },
            { "id": 2, "name": "Light", "address": "%Q0.0", "dataType": "BOOL", "displayName": "Blinking Output", "value": false }
        ],
        "nextId": 5,
        "nextVarId": 3
    },
    'real_sum': {
        "nodes": [
            { "id": 7, "type": "PUSH", "x": 40, "y": 40, "inputs": [], "state": false, "varName": "D7" },
            { "id": 8, "type": "PUSH", "x": 140, "y": 40, "inputs": [], "state": false, "varName": "D8" },
            { "id": 9, "type": "PUSH", "x": 240, "y": 40, "inputs": [], "state": false, "varName": "D9" },
            { "id": 13, "type": "PUSH", "x": 340, "y": 40, "inputs": [], "state": false, "varName": "Div" },
            { "id": 4, "type": "PUSH", "x": 40, "y": 100, "inputs": [], "state": false, "varName": "D4" },
            { "id": 5, "type": "PUSH", "x": 140, "y": 100, "inputs": [], "state": false, "varName": "D5" },
            { "id": 6, "type": "PUSH", "x": 240, "y": 100, "inputs": [], "state": false, "varName": "D6" },
            { "id": 12, "type": "PUSH", "x": 340, "y": 100, "inputs": [], "state": false, "varName": "Mul" },
            { "id": 1, "type": "PUSH", "x": 40, "y": 160, "inputs": [], "state": false, "varName": "D1" },
            { "id": 2, "type": "PUSH", "x": 140, "y": 160, "inputs": [], "state": false, "varName": "D2" },
            { "id": 3, "type": "PUSH", "x": 240, "y": 160, "inputs": [], "state": false, "varName": "D3" },
            { "id": 11, "type": "PUSH", "x": 340, "y": 160, "inputs": [], "state": false, "varName": "Sub" },
            { "id": 0, "type": "PUSH", "x": 40, "y": 220, "inputs": [], "state": false, "varName": "D0" },
            { "id": 15, "type": "PUSH", "x": 140, "y": 220, "inputs": [], "state": false, "varName": "Dot" },
            { "id": 99, "type": "PUSH", "x": 240, "y": 220, "inputs": [], "state": false, "varName": "Clear" },
            { "id": 10, "type": "PUSH", "x": 340, "y": 220, "inputs": [], "state": false, "varName": "Add" },
            { "id": 14, "type": "PUSH", "x": 40, "y": 280, "inputs": [], "state": false, "varName": "Eq" },
            { "id": 100, "type": "CALC", "x": 500, "y": 40, "inputs": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], "state": 0, "varName": null },
            { "id": 200, "type": "OUTPUT", "x": 640, "y": 200, "inputs": [0], "state": 0, "varName": "Display" }
        ],
        "connections": [
            { "id": 1, "from": 0, "to": 100, "inPort": 0 },
            { "id": 2, "from": 1, "to": 100, "inPort": 1 },
            { "id": 3, "from": 2, "to": 100, "inPort": 2 },
            { "id": 4, "from": 3, "to": 100, "inPort": 3 },
            { "id": 5, "from": 4, "to": 100, "inPort": 4 },
            { "id": 6, "from": 5, "to": 100, "inPort": 5 },
            { "id": 7, "from": 6, "to": 100, "inPort": 6 },
            { "id": 8, "from": 7, "to": 100, "inPort": 7 },
            { "id": 9, "from": 8, "to": 100, "inPort": 8 },
            { "id": 10, "from": 9, "to": 100, "inPort": 9 },
            { "id": 11, "from": 10, "to": 100, "inPort": 10 },
            { "id": 12, "from": 11, "to": 100, "inPort": 11 },
            { "id": 13, "from": 12, "to": 100, "inPort": 12 },
            { "id": 14, "from": 13, "to": 100, "inPort": 13 },
            { "id": 15, "from": 14, "to": 100, "inPort": 14 },
            { "id": 16, "from": 99, "to": 100, "inPort": 15 },
            { "id": 17, "from": 15, "to": 100, "inPort": 16 },
            { "id": 18, "from": 100, "to": 200, "inPort": 0 }
        ],
        "variables": [
            { "id": 0, "name": "D0", "address": "", "dataType": "BOOL", "displayName": "Digit 0", "value": false },
            { "id": 1, "name": "D1", "address": "", "dataType": "BOOL", "displayName": "Digit 1", "value": false },
            { "id": 2, "name": "D2", "address": "", "dataType": "BOOL", "displayName": "Digit 2", "value": false },
            { "id": 3, "name": "D3", "address": "", "dataType": "BOOL", "displayName": "Digit 3", "value": false },
            { "id": 4, "name": "D4", "address": "", "dataType": "BOOL", "displayName": "Digit 4", "value": false },
            { "id": 5, "name": "D5", "address": "", "dataType": "BOOL", "displayName": "Digit 5", "value": false },
            { "id": 6, "name": "D6", "address": "", "dataType": "BOOL", "displayName": "Digit 6", "value": false },
            { "id": 7, "name": "D7", "address": "", "dataType": "BOOL", "displayName": "Digit 7", "value": false },
            { "id": 8, "name": "D8", "address": "", "dataType": "BOOL", "displayName": "Digit 8", "value": false },
            { "id": 9, "name": "D9", "address": "", "dataType": "BOOL", "displayName": "Digit 9", "value": false },
            { "id": 10, "name": "Add", "address": "", "dataType": "BOOL", "displayName": "Add", "value": false },
            { "id": 11, "name": "Sub", "address": "", "dataType": "BOOL", "displayName": "Subtract", "value": false },
            { "id": 12, "name": "Mul", "address": "", "dataType": "BOOL", "displayName": "Multiply", "value": false },
            { "id": 13, "name": "Div", "address": "", "dataType": "BOOL", "displayName": "Divide", "value": false },
            { "id": 14, "name": "Eq", "address": "", "dataType": "BOOL", "displayName": "Equals", "value": false },
            { "id": 15, "name": "Dot", "address": "", "dataType": "BOOL", "displayName": "Decimal Point", "value": false },
            { "id": 99, "name": "Clear", "address": "", "dataType": "BOOL", "displayName": "Clear", "value": false },
            { "id": 100, "name": "Display", "address": "%MD100", "dataType": "REAL", "displayName": "Calc Result", "value": 0 }
        ],
        "nextId": 300,
        "nextVarId": 200
    },
    'custom_demo': {
      "nodes": [
        {"id":1,"type":"INPUT","x":220,"y":120,"inputs":[],"state":true,"varName":null,"customIn":0},
        {"id":2,"type":"PUSH","x":220,"y":180,"inputs":[],"state":false,"varName":null,"customIn":0},
        {"id":3,"type":"SENSOR","x":220,"y":240,"inputs":[],"state":false,"varName":"X","customIn":0},
        {"id":4,"type":"OUTPUT","x":580,"y":180,"inputs":[false],"state":false,"varName":"X","customIn":0},
        {"id":5,"type":"AND","x":420,"y":180,"inputs":[true,false],"state":false,"varName":null,"customIn":0},
        {"id":6,"type":"OUTPUT","x":580,"y":240,"inputs":[false],"state":false,"varName":null,"customIn":0}
      ],
      "connections": [
        {"from":1,"to":5,"inPort":0,"id":1765490944367,"path":[{"x":310,"y":145},{"x":340,"y":140},{"x":360,"y":140},{"x":380,"y":140},{"x":380,"y":160},{"x":380,"y":180},{"x":380,"y":200},{"x":400,"y":200},{"x":420,"y":200}]},
        {"from":2,"to":5,"inPort":1,"id":1765490945810,"path":[{"x":310,"y":205},{"x":340,"y":200},{"x":360,"y":200},{"x":380,"y":200},{"x":380,"y":220},{"x":400,"y":220},{"x":420,"y":220}]},
        {"from":5,"to":4,"inPort":0,"id":1765490948369,"path":[{"x":480,"y":210},{"x":500,"y":220},{"x":520,"y":220},{"x":540,"y":220},{"x":540,"y":200},{"x":560,"y":200},{"x":580,"y":205}]},
        {"from":3,"to":6,"inPort":0,"id":1765490957640,"path":[{"x":310,"y":265},{"x":340,"y":260},{"x":360,"y":260},{"x":380,"y":260},{"x":380,"y":280},{"x":400,"y":280},{"x":420,"y":280},{"x":440,"y":280},{"x":460,"y":280},{"x":480,"y":280},{"x":500,"y":280},{"x":520,"y":280},{"x":540,"y":280},{"x":540,"y":260},{"x":560,"y":260},{"x":580,"y":265}]}
      ],
      "variables": [
        {"id":1765490928299,"name":"Start_Btn","address":"","dataType":"BOOL","displayName":"","value":false},
        {"id":1765490928299,"name":"Stop_Btn","address":"","dataType":"BOOL","displayName":"","value":false},
        {"id":1765490928299,"name":"Motor_Out","address":"","dataType":"BOOL","displayName":"","value":false},
        {"id":1765490964490,"name":"X","address":"%I0.2","dataType":"BOOL","displayName":"Sensor X","value":false}
      ],
      "nextId":7,
      "nextVarId":2
    },
    'state_machine': STATE_MACHINE
};
