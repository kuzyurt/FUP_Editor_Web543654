
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { NodeData, Connection, Variable, Point, AppState, IOType } from '../types';
import { BLOCKS, GRID_SIZE } from '../constants';
import { PathFinder } from '../utils/pathfinding';
import { evaluateCircuit } from '../utils/logicEngine';
import { getNodeIOType, areTypesCompatible, getTypeColor, resolveActualType } from '../utils/typeSystem';
import ContextMenu from './ContextMenu';
import FeedbackToast from './FeedbackToast';

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
    
    const [toast, setToast] = useState<{msg: string, x: number, y: number, type: 'error' | 'info'} | null>(null);

    const view = useRef({ x: 0, y: 0, scale: 1 });
    const isDragging = useRef(false);
    const isPanning = useRef(false);
    const isWireMode = useRef(false);
    const dragNode = useRef<NodeData | null>(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    const lastMouseScreen = useRef({ x: 0, y: 0 });
    const mousePos = useRef({ x: 0, y: 0 });
    const wireStart = useRef<{nodeId: number, port: number, type: IOType} | null>(null); 
    const hoveredWire = useRef<Connection | null>(null);
    const selectedNode = useRef<NodeData | null>(null);
    const invalidTarget = useRef<boolean>(false);

    useEffect(() => {
        if(toast) {
            const t = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(t);
        }
    }, [toast]);

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
        const { nodes, connections, variables } = appState.current;
        
        ctx.save();
        ctx.translate(view.current.x, view.current.y);
        ctx.scale(view.current.scale, view.current.scale);

        // Draw Grid
        const step = GRID_SIZE;
        ctx.fillStyle = '#2d2d2d';
        const startX = -view.current.x / view.current.scale;
        const startY = -view.current.y / view.current.scale;
        const endX = startX + canvas.width / view.current.scale;
        const endY = startY + canvas.height / view.current.scale;
        for (let x = Math.floor(startX/step)*step; x < endX; x += step) {
            for (let y = Math.floor(startY/step)*step; y < endY; y += step) {
                ctx.fillRect(x, y, 1.5, 1.5);
            }
        }

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
                const a = c.path[i], b = c.path[i+1];
                allSegments.push({ p1: a, p2: b, horizontal: Math.abs(a.y - b.y) < 0.1 });
            }
        });

        connections.forEach((c) => {
            if(!c.path) return;
            const src = nodes.find(n => n.id === c.from);
            const type = src ? resolveActualType(src, variables, connections, nodes) : 'ANY';
            let col = getTypeColor(type);
            
            if(hoveredWire.current === c) {
                ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; 
                drawWireWithJumps(ctx, c.path, allSegments, view.current.scale);
            }

            ctx.lineWidth = 2.5; ctx.strokeStyle = col; 
            if (isSimMode && src && (src.state === true || (typeof src.state === 'number' && src.state !== 0))) {
                ctx.shadowBlur = 8; ctx.shadowColor = col;
            } else {
                ctx.shadowBlur = 0;
            }
            drawWireWithJumps(ctx, c.path, allSegments, view.current.scale);
        });

        if(isWireMode.current && wireStart.current) {
            const src = nodes.find(n => n.id === wireStart.current!.nodeId);
            if(src) {
                const p1 = getPortPos(src, wireStart.current.port, 'out');
                ctx.beginPath(); ctx.moveTo(p1.x, p1.y);
                const midX = (p1.x + mousePos.current.x) / 2;
                ctx.lineTo(midX, p1.y); ctx.lineTo(midX, mousePos.current.y); ctx.lineTo(mousePos.current.x, mousePos.current.y);
                ctx.strokeStyle = invalidTarget.current ? '#e06c75' : getTypeColor(wireStart.current.type);
                ctx.lineWidth = 2; ctx.setLineDash([5,5]); ctx.stroke(); ctx.setLineDash([]);
            }
        }

        nodes.forEach(n => {
            const conf = BLOCKS[n.type];
            const inCount = n.customIn || conf.in;
            const dynHeight = getNodeHeight(n);

            ctx.fillStyle = n === selectedNode.current ? '#444' : conf.c;
            ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
            ctx.fillRect(n.x, n.y, conf.w, dynHeight);
            ctx.shadowBlur = 0;
            ctx.strokeStyle = n === selectedNode.current ? '#007acc' : '#222';
            ctx.strokeRect(n.x, n.y, conf.w, dynHeight);

            ctx.fillStyle = '#fff'; ctx.font = `bold 11px sans-serif`; ctx.textAlign = 'center';
            ctx.fillText(n.customLabel || n.type, n.x + conf.w/2, n.y + 15);

            if(n.varName) {
                ctx.fillStyle = '#FFD700'; ctx.font = '10px monospace';
                ctx.fillText(`[${n.varName}]`, n.x + conf.w/2, n.y - 6);
            }

            const spacingIn = dynHeight / (inCount + 1);
            for(let i=0; i<inCount; i++) {
                const p = { x: n.x, y: n.y + spacingIn * (i+1) };
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); 
                ctx.fillStyle = getTypeColor(getNodeIOType(n, variables, i, true, connections, nodes)); 
                ctx.fill();
            }
            const spacingOut = dynHeight / (conf.out + 1);
            for(let i=0; i<conf.out; i++) {
                const p = { x: n.x + conf.w, y: n.y + spacingOut * (i+1) };
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); 
                ctx.fillStyle = getTypeColor(getNodeIOType(n, variables, i, false, connections, nodes)); 
                ctx.fill();
            }
        });
        ctx.restore();
    }, [appState, isSimMode]);

    useEffect(() => {
        let reqId: number;
        const loop = (time: number) => {
            runSimulationStep(time);
            draw();
            reqId = requestAnimationFrame(loop);
        };
        reqId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(reqId);
    }, [runSimulationStep, draw]);

    useEffect(() => {
        const resize = () => {
            if(containerRef.current && canvasRef.current) {
                canvasRef.current.width = containerRef.current.clientWidth;
                canvasRef.current.height = containerRef.current.clientHeight;
                draw();
            }
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, [draw]);

    const handleWheel = (e: React.WheelEvent) => {
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        if (view.current.scale * factor < 0.2 || view.current.scale * factor > 3) return;
        const m = getMouseWorld(e.nativeEvent);
        view.current.x -= m.x * (factor - 1) * view.current.scale;
        view.current.y -= m.y * (factor - 1) * view.current.scale;
        view.current.scale *= factor;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if(isSimMode) return;
        setCtxMenu(null); setFloatingInput(null);
        const m = getMouseWorld(e.nativeEvent);
        lastMouseScreen.current = { x: e.clientX, y: e.clientY };
        
        const { nodes, variables, connections } = appState.current;
        for(let n of nodes) {
            const conf = BLOCKS[n.type];
            for(let i=0; i<conf.out; i++) {
                if(dist(m, getPortPos(n, i, 'out')) < 8) {
                    isWireMode.current = true; 
                    wireStart.current = {nodeId: n.id, port: i, type: getNodeIOType(n, variables, i, false, connections, nodes)}; 
                    return;
                }
            }
        }
        
        const hitNode = nodes.slice().reverse().find(n => {
             const h = getNodeHeight(n);
             return m.x > n.x && m.x < n.x + BLOCKS[n.type].w && m.y > n.y && m.y < n.y + h;
        });

        if(hitNode) {
            selectedNode.current = hitNode; onSelectNode(hitNode);
            isDragging.current = true; dragNode.current = hitNode;
            dragOffset.current = {x: m.x - hitNode.x, y: m.y - hitNode.y};
        } else {
            selectedNode.current = null; onSelectNode(null);
            if(e.button === 0) isPanning.current = true;
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const m = getMouseWorld(e.nativeEvent);
        mousePos.current = m;
        if(isPanning.current) {
            view.current.x += e.clientX - lastMouseScreen.current.x;
            view.current.y += e.clientY - lastMouseScreen.current.y;
            lastMouseScreen.current = { x: e.clientX, y: e.clientY };
        } else if(isDragging.current && dragNode.current) {
            dragNode.current.x = Math.round((m.x - dragOffset.current.x) / GRID_SIZE) * GRID_SIZE;
            dragNode.current.y = Math.round((m.y - dragOffset.current.y) / GRID_SIZE) * GRID_SIZE;
        } else if(isWireMode.current && wireStart.current) {
            const { nodes, variables, connections } = appState.current;
            invalidTarget.current = false;
            for(let n of nodes) {
                const inCount = n.customIn || BLOCKS[n.type].in;
                for(let i=0; i<inCount; i++) {
                    if(dist(m, getPortPos(n, i, 'in')) < 12) {
                        if (!areTypesCompatible(wireStart.current!.type, getNodeIOType(n, variables, i, true, connections, nodes))) {
                            invalidTarget.current = true;
                        }
                    }
                }
            }
        } else {
            let foundWire = null;
            for(let c of appState.current.connections) {
                if(!c.path) continue;
                for(let i=0; i<c.path.length-1; i++) {
                    if(distToSegment(m, c.path[i], c.path[i+1]) < 6) { foundWire = c; break; }
                }
            }
            hoveredWire.current = foundWire;
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if(isSimMode) return;
        const m = getMouseWorld(e.nativeEvent);
        if(isWireMode.current && wireStart.current) {
            const { nodes, variables, connections } = appState.current;
            for(let n of nodes) {
                const inCount = n.customIn || BLOCKS[n.type].in;
                for(let i=0; i<inCount; i++) {
                    if(dist(m, getPortPos(n, i, 'in')) < 12) {
                        const targetType = getNodeIOType(n, variables, i, true, connections, nodes);
                        if (areTypesCompatible(wireStart.current.type, targetType)) {
                            appState.current.connections = appState.current.connections.filter(c => !(c.to === n.id && c.inPort === i));
                            appState.current.connections.push({from: wireStart.current!.nodeId, to: n.id, inPort: i, id: Date.now()});
                            onUpdateUI();
                        } else {
                            setToast({ msg: `Type Mismatch: ${wireStart.current.type} -> ${targetType}`, x: e.clientX, y: e.clientY, type: 'error' });
                        }
                    }
                }
            }
        }
        isPanning.current = false; isWireMode.current = false; isDragging.current = false; dragNode.current = null;
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        const m = getMouseWorld(e.nativeEvent);
        if(hoveredWire.current) {
            setCtxMenu({ x: e.clientX, y: e.clientY, title: 'Wire', items: [{ label: 'Delete Wire', onClick: () => {
                appState.current.connections = appState.current.connections.filter(c => c !== hoveredWire.current);
                onUpdateUI();
            }}]});
            return;
        }
        const n = appState.current.nodes.slice().reverse().find(n => {
            const h = getNodeHeight(n);
            return m.x > n.x && m.x < n.x + BLOCKS[n.type].w && m.y > n.y && m.y < n.y + h;
        });
        if(n) {
            const items: any[] = [
                { label: 'Rename', onClick: () => setFloatingInput({ x: e.clientX, y: e.clientY, node: n, mode: 'rename', initialValue: n.customLabel || '' }) },
                { label: 'Delete', onClick: () => {
                    appState.current.nodes = appState.current.nodes.filter(x => x.id !== n.id);
                    appState.current.connections = appState.current.connections.filter(c => c.from !== n.id && c.to !== n.id);
                    onUpdateUI();
                }}
            ];
            if(['INPUT','OUTPUT','SENSOR','PUSH'].includes(n.type)) {
                items.unshift({ label: 'Assign Variable', onClick: () => setFloatingInput({ x: e.clientX, y: e.clientY, node: n, mode: 'variable' }) });
            }
            setCtxMenu({ x: e.clientX, y: e.clientY, title: n.type, items });
        }
    };

    return (
        <div className="flex-grow relative bg-[#1e1e1e] overflow-hidden" ref={containerRef}>
            <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel} onContextMenu={handleContextMenu} onDragOver={e => e.preventDefault()} onDrop={e => {
                const type = e.dataTransfer.getData("type");
                if(!type) return;
                const m = getMouseWorld(e.nativeEvent);
                appState.current.nodes.push({ id: appState.current.nextId++, type, x: Math.round(m.x/GRID_SIZE)*GRID_SIZE, y: Math.round(m.y/GRID_SIZE)*GRID_SIZE, inputs: Array(BLOCKS[type].in).fill(0), state: false, varName: null });
                onUpdateUI();
            }} className="block h-full w-full outline-none" />
            {ctxMenu && <ContextMenu {...ctxMenu} onClose={() => setCtxMenu(null)} />}
            {toast && <FeedbackToast {...toast} />}
            {floatingInput && (
                <div className="absolute z-[999]" style={{left: floatingInput.x, top: floatingInput.y}}>
                    <input autoFocus className="bg-black/90 border border-accent text-white p-1 text-xs rounded w-[120px]" placeholder={floatingInput.mode === 'variable' ? "Variable Name" : "Label"} onKeyDown={e => {
                        if(e.key === 'Enter') {
                            const val = e.currentTarget.value.trim();
                            if(floatingInput.mode === 'variable') {
                                const v = appState.current.variables.find(x => x.name === val);
                                if(v || !val) { floatingInput.node.varName = val || null; setFloatingInput(null); onUpdateUI(); }
                                else setFloatingInput(p => p ? {...p, error: true} : null);
                            } else {
                                floatingInput.node.customLabel = val; setFloatingInput(null); onUpdateUI();
                            }
                        }
                        if(e.key === 'Escape') setFloatingInput(null);
                    }} onBlur={() => setFloatingInput(null)} />
                </div>
            )}
        </div>
    );
};

export default Canvas;
