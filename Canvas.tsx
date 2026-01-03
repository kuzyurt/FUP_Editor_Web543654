
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { NodeData, Connection, Variable, Point, AppState } from '../types';
import { BLOCKS, GRID_SIZE } from '../constants';
import { PathFinder } from '../utils/pathfinding';
import { evaluateCircuit } from '../utils/logicEngine';
import { getNodeIOType, areTypesCompatible, getTypeColor, resolveActualType } from '../utils/typeSystem';
import ContextMenu from './ContextMenu';

interface CanvasProps {
    appState: React.MutableRefObject<AppState>;
    onSelectNode: (node: NodeData | null) => void;
    onUpdateUI: () => void;
    isSimMode: boolean;
}

const getNodeHeight = (n: NodeData) => {
    const conf = BLOCKS[n.type];
    const inCount = n.customIn || conf.in;
    return inCount > 2 ? Math.max(conf.h, (inCount + 1) * 20) : conf.h;
};

interface Segment {
    p1: Point;
    p2: Point;
    horizontal: boolean;
}

const Canvas: React.FC<CanvasProps> = ({ appState, onSelectNode, onUpdateUI, isSimMode }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [ctxMenu, setCtxMenu] = useState<{x: number, y: number, title: string, items: any[]} | null>(null);
    const [floatingInput, setFloatingInput] = useState<{
        x: number, 
        y: number, 
        node: NodeData, 
        error?: boolean,
        mode: 'variable' | 'value' | 'rename',
        initialValue?: string
    } | null>(null);
    
    const view = useRef({ x: 0, y: 0, scale: 1 });
    const isDragging = useRef(false);
    const isPanning = useRef(false);
    const isWireMode = useRef(false);
    const dragNode = useRef<NodeData | null>(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    const lastMouseScreen = useRef({ x: 0, y: 0 });
    const mousePos = useRef({ x: 0, y: 0 });
    const wireStart = useRef<{nodeId: number, port: number, type: string} | null>(null); // Added type
    const hoveredWire = useRef<Connection | null>(null);
    const selectedNode = useRef<NodeData | null>(null);
    
    // For invalid connection feedback
    const invalidTarget = useRef<boolean>(false);

    const getMouseWorld = (e: MouseEvent) => {
        if(!canvasRef.current) return {x:0, y:0};
        const r = canvasRef.current.getBoundingClientRect();
        return {
            x: (e.clientX - r.left - view.current.x) / view.current.scale,
            y: (e.clientY - r.top - view.current.y) / view.current.scale
        };
    };

    const getPortPos = (n: NodeData, i: number, t: 'in' | 'out') => {
        const conf = BLOCKS[n.type];
        const count = t === 'in' ? (n.customIn || conf.in) : conf.out;
        const effectiveH = getNodeHeight(n);
        const spacing = effectiveH / (count + 1);
        return { x: t === 'in' ? n.x : n.x + conf.w, y: n.y + spacing * (i + 1) };
    };

    const dist = (a: Point, b: Point) => Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);

    const distToSegment = (p: Point, v: Point, w: Point) => {
        const l2 = dist(v, w) ** 2;
        if (l2 === 0) return dist(p, v);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return dist(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
    };

    const lastTime = useRef(0);
    const runSimulationStep = useCallback((timestamp: number) => {
        if (!lastTime.current) lastTime.current = timestamp;
        const dt = timestamp - lastTime.current;
        lastTime.current = timestamp;
        const { nodes, connections, variables } = appState.current;
        evaluateCircuit(nodes, connections, variables, dt);
    }, [appState]);

    const drawWireWithJumps = (ctx: CanvasRenderingContext2D, path: Point[], existingSegments: Segment[], scale: number) => {
        if (path.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        const JUMP_RADIUS = 6;

        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];
            const isHoriz = Math.abs(p1.y - p2.y) < 0.1;
            const isVert = Math.abs(p1.x - p2.x) < 0.1;
            const intersections: Point[] = [];

            for (const seg of existingSegments) {
                if (isHoriz && !seg.horizontal) {
                    if (seg.p1.x > Math.min(p1.x, p2.x) && seg.p1.x < Math.max(p1.x, p2.x)) {
                        const myY = p1.y;
                        if (myY > Math.min(seg.p1.y, seg.p2.y) && myY < Math.max(seg.p1.y, seg.p2.y)) {
                            intersections.push({ x: seg.p1.x, y: myY });
                        }
                    }
                } else if (isVert && seg.horizontal) {
                    if (seg.p1.y > Math.min(p1.y, p2.y) && seg.p1.y < Math.max(p1.y, p2.y)) {
                        const myX = p1.x;
                        if (myX > Math.min(seg.p1.x, seg.p2.x) && myX < Math.max(seg.p1.x, seg.p2.x)) {
                            intersections.push({ x: myX, y: seg.p1.y });
                        }
                    }
                }
            }

            intersections.sort((a, b) => dist(p1, a) - dist(p1, b));
            let curr = p1;
            for (const hit of intersections) {
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx*dx + dy*dy);
                const ux = dx/len;
                const uy = dy/len;
                const gapStart = { x: hit.x - ux * JUMP_RADIUS, y: hit.y - uy * JUMP_RADIUS };
                const gapEnd = { x: hit.x + ux * JUMP_RADIUS, y: hit.y + uy * JUMP_RADIUS };
                ctx.lineTo(gapStart.x, gapStart.y);
                let cx = hit.x - uy * JUMP_RADIUS * 1.5;
                let cy = hit.y + ux * JUMP_RADIUS * 1.5;
                ctx.quadraticCurveTo(cx, cy, gapEnd.x, gapEnd.y);
                curr = gapEnd;
            }
            ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();
    };

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if(!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const step = GRID_SIZE * view.current.scale;
        if(step > 10) {
            ctx.fillStyle = '#2d2d2d';
            const offsetX = view.current.x % step;
            const offsetY = view.current.y % step;
            for (let x = offsetX; x < canvas.width; x += step) {
                for (let y = offsetY; y < canvas.height; y += step) {
                    ctx.fillRect(x, y, 2, 2);
                }
            }
        }

        const { nodes, connections, variables } = appState.current;
        const pathFinder = new PathFinder(nodes);
        const allSegments: Segment[] = [];

        connections.forEach(c => {
            const src = nodes.find(n => n.id === c.from);
            const dst = nodes.find(n => n.id === c.to);
            if(!src || !dst) return;
            const p1 = getPortPos(src, 0, 'out');
            const p2 = getPortPos(dst, c.inPort, 'in');
            
            c.path = pathFinder.findPath(p1, p2);

            for(let i=0; i<c.path.length-1; i++) {
                const a = c.path[i];
                const b = c.path[i+1];
                if (Math.abs(a.x - b.x) > 0.1 || Math.abs(a.y - b.y) > 0.1) {
                    allSegments.push({ p1: a, p2: b, horizontal: Math.abs(a.y - b.y) < 0.1 });
                }
                const steps = Math.ceil(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) / GRID_SIZE);
            }
        });

        ctx.save();
        ctx.translate(view.current.x, view.current.y);
        ctx.scale(view.current.scale, view.current.scale);

        // Draw Wires
        connections.forEach((c) => {
            if(!c.path) return;
            const src = nodes.find(n => n.id === c.from);
            
            // IEC Color Logic
            let col = '#555';
            if (src) {
                const type = resolveActualType(src, variables, connections, nodes);
                col = getTypeColor(type);
                // Active State Highlighting (Keep existing logic but blend with type color)
                if (isSimMode && (src.state === true || (typeof src.state === 'number' && src.state !== 0))) {
                   ctx.shadowBlur = 5;
                   ctx.shadowColor = col;
                }
            }
            if(c.color) col = c.color;
            
            if(hoveredWire.current === c) {
                ctx.lineWidth = 5 / view.current.scale;
                ctx.strokeStyle = 'rgba(255,255,255,0.3)'; 
                drawWireWithJumps(ctx, c.path, allSegments, view.current.scale);
            }

            ctx.lineWidth = 2.5 / view.current.scale; // Slightly thinner for cleaner look
            ctx.strokeStyle = col; 
            ctx.shadowBlur = 0;
            drawWireWithJumps(ctx, c.path, allSegments, view.current.scale);
        });

        // Dragging Wire
        if(isWireMode.current && wireStart.current) {
            const src = nodes.find(n => n.id === wireStart.current!.nodeId);
            if(src) {
                const p1 = getPortPos(src, wireStart.current.port, 'out');
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y);
                const midX = (p1.x + mousePos.current.x) / 2;
                ctx.lineTo(midX, p1.y); ctx.lineTo(midX, mousePos.current.y); ctx.lineTo(mousePos.current.x, mousePos.current.y);
                
                // Color based on source type OR Error
                if (invalidTarget.current) {
                    ctx.strokeStyle = '#e06c75'; // Error Red
                    ctx.lineWidth = 3 / view.current.scale;
                } else {
                    const type = getNodeIOType(src, variables, wireStart.current.port, false);
                    ctx.strokeStyle = getTypeColor(type);
                    ctx.lineWidth = 2 / view.current.scale;
                }
                
                ctx.setLineDash([5,5]); ctx.stroke(); ctx.setLineDash([]);
            }
        }

        // Draw Nodes
        nodes.forEach(n => {
            const conf = BLOCKS[n.type];
            const inCount = n.customIn || conf.in;
            const dynHeight = getNodeHeight(n);

            ctx.fillStyle = n === selectedNode.current ? '#444' : conf.c;
            if(n.type === 'PUSH' && n.state === true) ctx.fillStyle = '#007acc';
            
            ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
            ctx.fillRect(n.x, n.y, conf.w, dynHeight);
            ctx.shadowBlur = 0;

            ctx.strokeStyle = n === selectedNode.current ? '#007acc' : '#222';
            ctx.lineWidth = 2 / view.current.scale;
            ctx.strokeRect(n.x, n.y, conf.w, dynHeight);

            ctx.fillStyle = '#fff'; ctx.font = `bold 12px sans-serif`; ctx.textAlign = 'center';
            let lbl = n.customLabel || n.type;
            if(n.type === 'SENSOR') lbl = n.type;
            if(n.type === 'CALC') lbl = "F_CPU"; 
            if(lbl.length > 10) lbl = lbl.substring(0,8) + '..';
            ctx.fillText(lbl, n.x + conf.w/2, n.y + 15);
            
            if(n.type === 'CALC' && n.props) {
                 ctx.font = '10px monospace'; ctx.fillStyle='#0f0';
                 ctx.fillText(Number(n.props.val).toFixed(2), n.x + conf.w/2, n.y + dynHeight - 5);
            }

            if(n.varName) {
                ctx.fillStyle = '#FFD700'; ctx.font = '11px monospace';
                ctx.fillText(`[${n.varName}]`, n.x + conf.w/2, n.y - 6);
            }

            // Input Display
            if(n.type === 'INPUT') {
                const x = n.x + 25, y = n.y + 25;
                ctx.fillStyle = '#111'; ctx.fillRect(x, y, 40, 16);
                let isNumeric = typeof n.state === 'number';
                if (n.varName) {
                    const v = appState.current.variables.find(vx => vx.name === n.varName);
                    if (v) isNumeric = v.dataType !== 'BOOL';
                }
                if (isNumeric) {
                     ctx.fillStyle = '#00aaff'; ctx.font = '10px monospace';
                     ctx.fillText(Number(n.state).toFixed(1), x + 20, y + 11);
                } else {
                    const isActive = Boolean(n.state);
                    ctx.fillStyle = isActive ? '#0f0' : '#888';
                    ctx.fillRect(isActive ? x + 20 : x, y, 20, 16);
                }
            }
            if(n.type === 'PUSH') {
                const cx = n.x + 45, cy = n.y + 30;
                ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2);
                ctx.fillStyle = n.state ? '#4fa' : '#333'; ctx.fill();
                ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.stroke();
                ctx.fillStyle = n.state ? '#000' : '#fff';
                ctx.font='10px Arial'; ctx.fillText("PUSH", cx, cy+3);
            }
            if(n.type === 'OUTPUT') {
                const cx = n.x + 45, cy = n.y + 30;
                ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2);
                if(typeof n.state === 'number') {
                     ctx.fillStyle = '#00aaff'; ctx.fill();
                     ctx.fillStyle='#000'; ctx.font='9px Arial'; ctx.fillText(n.state.toFixed(1), cx, cy+3);
                } else {
                     ctx.fillStyle = n.state ? '#f00' : '#300'; ctx.fill();
                     ctx.fillStyle='#fff'; ctx.font='10px Arial'; ctx.fillText(n.state?'ON':'OFF', cx, cy+32);
                }
            }

            // Ports
            const spacingIn = dynHeight / (inCount + 1);
            for(let i=0; i<inCount; i++) {
                const p = { x: n.x, y: n.y + spacingIn * (i+1) };
                
                // Color Input Ports based on type
                const inType = getNodeIOType(n, variables, i, true);
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); 
                ctx.fillStyle = getTypeColor(inType); 
                ctx.fill();
                
                if(conf.labels && conf.labels[i]) {
                    ctx.fillStyle = '#ccc'; ctx.font='9px sans-serif'; ctx.textAlign='left';
                    ctx.fillText(conf.labels[i], p.x + 6, p.y + 3);
                }
            }
            const spacingOut = dynHeight / (conf.out + 1);
            for(let i=0; i<conf.out; i++) {
                const p = { x: n.x + conf.w, y: n.y + spacingOut * (i+1) };
                
                // Color Output Ports
                const outType = getNodeIOType(n, variables, i, false);
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); 
                ctx.fillStyle = getTypeColor(outType); 
                ctx.fill();
            }
        });
        ctx.restore();
    }, [appState]);

    useEffect(() => {
        let reqId: number;
        const loop = (time: number) => {
            runSimulationStep(time);
            if (!isSimMode) draw();
            reqId = requestAnimationFrame(loop);
        };
        reqId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(reqId);
    }, [runSimulationStep, draw, isSimMode]);

    useEffect(() => {
        const resize = () => {
            if(containerRef.current && canvasRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = containerRef.current.clientHeight;
                if(!isSimMode) draw();
            }
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, [draw, isSimMode]);

    const handleWheel = (e: React.WheelEvent) => {
        const dir = e.deltaY > 0 ? -1 : 1;
        const factor = 1 + (dir * 0.1);
        if (view.current.scale * factor < 0.2 || view.current.scale * factor > 3) return;
        const m = getMouseWorld(e.nativeEvent);
        view.current.x -= m.x * (factor - 1) * view.current.scale;
        view.current.y -= m.y * (factor - 1) * view.current.scale;
        view.current.scale *= factor;
        draw();
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if(isSimMode) return;
        setCtxMenu(null); setFloatingInput(null);
        const m = getMouseWorld(e.nativeEvent);
        lastMouseScreen.current = { x: e.clientX, y: e.clientY };
        mousePos.current = m;
        if(e.button === 1 || (e.button === 0 && e.shiftKey)) { isPanning.current = true; return; }
        if(e.button !== 0) return;
        const { nodes, variables } = appState.current;
        let portHit = false;
        nodes.forEach(n => {
            const conf = BLOCKS[n.type];
            for(let i=0; i<conf.out; i++) {
                if(dist(m, getPortPos(n, i, 'out')) < 8) {
                    isWireMode.current = true; 
                    const type = getNodeIOType(n, variables, i, false); // Get Source Type
                    wireStart.current = {nodeId: n.id, port: i, type: type as string}; 
                    portHit = true;
                }
            }
        });
        if(portHit) return;
        
        const hitNode = [...nodes].reverse().find(n => {
             const h = getNodeHeight(n);
             return m.x > n.x && m.x < n.x + BLOCKS[n.type].w && m.y > n.y && m.y < n.y + h;
        });

        if(hitNode) {
            // Interactive Checks (INPUT/PUSH toggle logic)
            if(hitNode.type === 'INPUT') {
                 if(m.x >= hitNode.x + 25 && m.x <= hitNode.x + 65 && m.y >= hitNode.y + 25 && m.y <= hitNode.y + 41) {
                     if (hitNode.varName) {
                         const v = appState.current.variables.find(x => x.name === hitNode.varName);
                         if (v) {
                             if (v.dataType === 'BOOL') {
                                 v.value = !v.value;
                                 hitNode.state = Boolean(v.value);
                                 onUpdateUI();
                             }
                         } else {
                             hitNode.state = !hitNode.state;
                         }
                     } else {
                         hitNode.state = !hitNode.state;
                     }
                     return; 
                 }
            } 
            if(hitNode.type === 'PUSH') {
                 if(dist(m, {x: hitNode.x + 45, y: hitNode.y + 30}) < 14) {
                     hitNode.state = true; 
                     if(hitNode.varName) {
                         const v = appState.current.variables.find(x => x.name === hitNode.varName);
                         if(v && v.dataType === 'BOOL') {
                             v.value = true;
                             onUpdateUI();
                         }
                     }
                     return;
                 }
            }
            selectedNode.current = hitNode; onSelectNode(hitNode);
            isDragging.current = true; dragNode.current = hitNode;
            dragOffset.current = {x: m.x - hitNode.x, y: m.y - hitNode.y};
        } else {
            selectedNode.current = null; onSelectNode(null);
        }
        draw();
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if(isSimMode) return;
        const m = getMouseWorld(e.nativeEvent);
        mousePos.current = m;
        if(isPanning.current) {
            view.current.x += e.clientX - lastMouseScreen.current.x;
            view.current.y += e.clientY - lastMouseScreen.current.y;
            lastMouseScreen.current = { x: e.clientX, y: e.clientY };
            draw(); return;
        }
        if(isDragging.current && dragNode.current) {
            let nx = m.x - dragOffset.current.x; let ny = m.y - dragOffset.current.y;
            dragNode.current.x = Math.round(nx / GRID_SIZE) * GRID_SIZE;
            dragNode.current.y = Math.round(ny / GRID_SIZE) * GRID_SIZE;
            draw(); return;
        }
        
        // Wire Validation while dragging
        if(isWireMode.current && wireStart.current) {
            const { nodes, variables } = appState.current;
            invalidTarget.current = false;
            // Check if hovering over an input port
            nodes.forEach(n => {
                const inCount = n.customIn || BLOCKS[n.type].in;
                for(let i=0; i<inCount; i++) {
                    if(dist(m, getPortPos(n, i, 'in')) < 12) {
                        const targetType = getNodeIOType(n, variables, i, true);
                        if (!areTypesCompatible(wireStart.current!.type as any, targetType)) {
                            invalidTarget.current = true;
                        }
                    }
                }
            });
            draw();
            return;
        }

        if(!isDragging.current && !isWireMode.current) {
            let foundWire = null;
            const { connections } = appState.current;
            for(let c of connections) {
                if(!c.path || c.path.length < 2) continue;
                let hit = false;
                for(let i = 0; i < c.path.length - 1; i++) {
                    const p1 = c.path[i], p2 = c.path[i+1];
                    if(distToSegment(m, p1, p2) < 6) { hit = true; break; }
                }
                if(hit) { foundWire = c; break; }
            }
            if(foundWire !== hoveredWire.current) { hoveredWire.current = foundWire; draw(); }
        } else { draw(); }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        const { nodes, variables } = appState.current;
        nodes.filter(n => n.type === 'PUSH' && n.state).forEach(n => {
            n.state = false;
            if(n.varName) {
                const v = appState.current.variables.find(x => x.name === n.varName);
                if(v && v.dataType === 'BOOL') {
                    v.value = false;
                    onUpdateUI();
                }
            }
        });

        if(isSimMode) return;
        if(isWireMode.current && wireStart.current) {
            const m = getMouseWorld(e.nativeEvent);
            nodes.forEach(n => {
                const inCount = n.customIn || BLOCKS[n.type].in;
                for(let i=0; i<inCount; i++) {
                    if(dist(m, getPortPos(n, i, 'in')) < 12) {
                        const targetType = getNodeIOType(n, variables, i, true);
                        
                        // Strict Type Validation
                        if (areTypesCompatible(wireStart.current!.type as any, targetType)) {
                            appState.current.connections = appState.current.connections.filter(c => !(c.to === n.id && c.inPort === i));
                            appState.current.connections.push({from: wireStart.current!.nodeId, to: n.id, inPort: i, id: Date.now()});
                            onUpdateUI();
                        } else {
                            // Feedback for failure? (Canvas already shows red wire)
                            console.warn("Incompatible types:", wireStart.current!.type, targetType);
                        }
                    }
                }
            });
        }
        isPanning.current = false; isWireMode.current = false; isDragging.current = false; dragNode.current = null; invalidTarget.current = false;
        draw();
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if(isSimMode) return;
        const m = getMouseWorld(e.nativeEvent);
        const { nodes } = appState.current;
        if(hoveredWire.current) {
            const wire = hoveredWire.current;
            setCtxMenu({
                x: e.clientX, y: e.clientY, title: 'Wire Actions',
                items: [
                    { label: 'Delete Wire', onClick: () => {
                        appState.current.connections = appState.current.connections.filter(c => c !== wire);
                        draw(); onUpdateUI();
                    }}
                ]
            });
            return;
        }
        const n = nodes.slice().reverse().find(n => {
            const h = getNodeHeight(n);
            return m.x > n.x && m.x < n.x + BLOCKS[n.type].w && m.y > n.y && m.y < n.y + h;
        });
        if(n) {
            const items: any[] = [];
            if(['AND','OR','NAND','NOR','XOR'].includes(n.type)) {
                items.push({ label: '+ Add Input Port', onClick: () => { n.customIn = (n.customIn || BLOCKS[n.type].in) + 1; n.inputs.push(0); draw(); }});
                items.push({ type: 'separator' });
            }
            items.push({ label: 'Rename Block', onClick: () => { 
                const r = canvasRef.current!.getBoundingClientRect();
                setFloatingInput({ 
                    x: (n.x * view.current.scale) + view.current.x + r.left, 
                    y: (n.y * view.current.scale) + view.current.y + r.top - 30, 
                    node: n,
                    mode: 'rename',
                    initialValue: n.customLabel || ""
                });
            }});
            
            if(['INPUT','OUTPUT','SENSOR','PUSH'].includes(n.type)) {
                items.push({ label: 'Assign Variable', onClick: () => {
                     const r = canvasRef.current!.getBoundingClientRect();
                     setFloatingInput({ 
                         x: (n.x * view.current.scale) + view.current.x + r.left, 
                         y: (n.y * view.current.scale) + view.current.y + r.top - 30, 
                         node: n,
                         mode: 'variable' 
                     });
                }});
            }

            if (n.type === 'INPUT' && n.varName) {
                const v = appState.current.variables.find(varObj => varObj.name === n.varName);
                if (v && ['INT', 'DINT', 'REAL'].includes(v.dataType)) {
                    items.push({ 
                        label: 'Set Input Value', 
                        onClick: () => {
                            const r = canvasRef.current!.getBoundingClientRect();
                            setFloatingInput({ 
                                x: (n.x * view.current.scale) + view.current.x + r.left, 
                                y: (n.y * view.current.scale) + view.current.y + r.top - 30, 
                                node: n,
                                mode: 'value',
                                initialValue: String(v.value)
                            });
                        }
                    });
                }
            }

            items.push({ label: 'Delete Block', onClick: () => {
                appState.current.connections = appState.current.connections.filter(c => c.from !== n.id && c.to !== n.id);
                appState.current.nodes = appState.current.nodes.filter(x => x !== n);
                if(selectedNode.current === n) { selectedNode.current = null; onSelectNode(null); }
                draw(); onUpdateUI();
            }});
            setCtxMenu({ x: e.clientX, y: e.clientY, title: `${n.type} #${n.id}`, items });
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData("type");
        if(!type) return;
        const m = getMouseWorld(e.nativeEvent);
        const sx = Math.round(m.x / GRID_SIZE) * GRID_SIZE;
        const sy = Math.round(m.y / GRID_SIZE) * GRID_SIZE;
        appState.current.nodes.push({
            id: appState.current.nextId++, type, x: sx, y: sy,
            inputs: Array(BLOCKS[type].in).fill(0), state: false, varName: null, customIn: 0
        });
        draw(); onUpdateUI();
    };

    const handleFloatingInput = (val: string) => {
        if(!floatingInput) return;
        const n = floatingInput.node;
        
        if (floatingInput.mode === 'rename') {
             n.customLabel = val; 
             setFloatingInput(null); 
             draw();
             return;
        }

        if (floatingInput.mode === 'value') {
            const v = appState.current.variables.find(x => x.name === n.varName);
            if (v) {
                const num = v.dataType === 'REAL' ? parseFloat(val) : parseInt(val, 10);
                if (!isNaN(num)) {
                    v.value = num;
                    n.state = num;
                    onUpdateUI();
                    setFloatingInput(null);
                    draw();
                } else {
                    setFloatingInput(prev => prev ? ({...prev, error: true}) : null);
                }
            } else {
                setFloatingInput(null);
            }
            return;
        }

        const v = appState.current.variables.find(x => x.name === val);
        if(!val) { n.varName = null; setFloatingInput(null); draw(); }
        else if(v) { n.varName = val; n.state = v.value; setFloatingInput(null); draw(); }
        else { setFloatingInput(prev => prev ? ({...prev, error: true}) : null); }
    };

    return (
        <div id="canvas-container" className="flex-grow relative bg-[#1e1e1e] cursor-grab active:cursor-grabbing overflow-hidden" ref={containerRef}>
            <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel} onContextMenu={handleContextMenu} onDragOver={(e)=>e.preventDefault()} onDrop={handleDrop} className="block"/>
            {ctxMenu && <ContextMenu {...ctxMenu} onClose={() => setCtxMenu(null)} />}
            {floatingInput && (
                <div className="absolute z-[999] flex flex-col" style={{left: floatingInput.x, top: floatingInput.y}}>
                    {floatingInput.error && <div className="bg-red-500 text-white text-[10px] p-1 rounded mb-1 animate-shake">
                        {floatingInput.mode === 'value' ? 'Invalid Number!' : 'Variable not found!'}
                    </div>}
                    <input autoFocus 
                        defaultValue={floatingInput.initialValue || ''}
                        className={`bg-black/90 border ${floatingInput.error ? 'border-red-500' : 'border-accent'} text-white p-1 text-xs rounded w-[120px] outline-none`} 
                        placeholder={floatingInput.mode === 'variable' ? "Variable Name" : floatingInput.mode === 'value' ? "Enter Value" : "Block Label"} 
                        onKeyDown={(e) => { if(e.key==='Enter') handleFloatingInput(e.currentTarget.value.trim()); if(e.key==='Escape') setFloatingInput(null); }} 
                        onBlur={()=>setFloatingInput(null)} 
                    />
                </div>
            )}
        </div>
    );
};

export default Canvas;
