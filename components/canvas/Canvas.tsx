
import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { NodeData, Connection, Point, AppState, DataType, CanvasHandle } from '../../core/types';
import { BLOCKS, GRID_SIZE, ROUTER_GRID_SIZE } from '../../core/constants';
import { evaluateCircuit } from '../../engine/logicEngine';
import { getNodeIOType, areTypesCompatible, getTypeColor, resolveActualType } from '../../core/typeSystem';
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

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ appState, onSelectNode, onUpdateUI, isSimMode }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [ctxMenu, setCtxMenu] = useState<{x: number, y: number, title: string, items: any[]} | null>(null);
    const [floatingInput, setFloatingInput] = useState<any>(null);
    const [toast, setToast] = useState<{msg: string, x: number, y: number, type: 'error' | 'info'} | null>(null);

    const view = useRef({ x: 0, y: 0, scale: 1 });
    const isDragging = useRef(false);
    const isPanning = useRef(false);
    
    // Wiring State
    const isWireMode = useRef(false);
    const wireStart = useRef<{nodeId: number, port: number, type: string, pos: Point} | null>(null); 
    const wirePath = useRef<Point[]>([]); 
    const wireGhost = useRef<Point | null>(null); 
    
    // Edge Moving State
    const [hoveredSegment, setHoveredSegment] = useState<{c: Connection, index: number, p: Point, orientation: 'H' | 'V'} | null>(null);
    const dragSegment = useRef<{c: Connection, index: number, orientation: 'H' | 'V', startVal: number, mouseStartVal: number} | null>(null);

    const dragNode = useRef<NodeData | null>(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    const lastMouseScreen = useRef({ x: 0, y: 0 });
    const mousePos = useRef({ x: 0, y: 0 });
    
    const hoveredWire = useRef<Connection | null>(null);
    const selectedNode = useRef<NodeData | null>(null);
    const invalidTarget = useRef<boolean>(false);
    const animationFrameRef = useRef<number>(0);

    // Export Logic
    useImperativeHandle(ref, () => ({
        getExportImage: (format: 'image/jpeg' | 'image/png' = 'image/jpeg') => {
            const { nodes } = appState.current;
            if (nodes.length === 0) return "";

            // 1. Calculate Bounding Box
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            nodes.forEach(n => {
                const h = getNodeHeight(n);
                minX = Math.min(minX, n.x);
                minY = Math.min(minY, n.y);
                maxX = Math.max(maxX, n.x + BLOCKS[n.type].w);
                maxY = Math.max(maxY, n.y + h);
            });

            // Add Padding
            const PADDING = 50;
            minX -= PADDING; minY -= PADDING;
            maxX += PADDING; maxY += PADDING;
            const width = maxX - minX;
            const height = maxY - minY;

            // 2. Save current state
            const originalWidth = canvasRef.current!.width;
            const originalHeight = canvasRef.current!.height;
            const originalView = { ...view.current };

            // 3. High Resolution Export (Target ~4K)
            // 4K resolution is approx 3840px wide. We scale the canvas to match this max dimension.
            const TARGET_DIMENSION = 3840; 
            const currentMaxDim = Math.max(width, height);
            const scaleFactor = TARGET_DIMENSION / currentMaxDim;

            canvasRef.current!.width = width * scaleFactor;
            canvasRef.current!.height = height * scaleFactor;
            
            // 4. Center View with Scaling
            view.current = { 
                x: -minX * scaleFactor, 
                y: -minY * scaleFactor, 
                scale: scaleFactor 
            };

            // 5. Draw in Light Mode (Export Mode)
            draw(0, 'light');

            // 6. Capture
            const dataUrl = canvasRef.current!.toDataURL(format, format === 'image/jpeg' ? 0.9 : undefined);

            // 7. Restore State
            canvasRef.current!.width = originalWidth;
            canvasRef.current!.height = originalHeight;
            view.current = originalView;
            draw(0); // Redraw normal

            return dataUrl;
        }
    }));

    useEffect(() => {
        if(toast) {
            const t = setTimeout(() => setToast(null), 4000);
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
    
    const getClosestPointOnSegment = (p: Point, a: Point, b: Point) => {
        const l2 = dist(a, b) ** 2;
        if (l2 === 0) return a;
        let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    };

    const ensurePathsExist = () => {
        const { nodes, connections } = appState.current;
        connections.forEach(c => {
            if (!c.path || c.path.length === 0) {
                const src = nodes.find(n => n.id === c.from);
                const dst = nodes.find(n => n.id === c.to);
                if(src && dst) {
                    const p1 = getPortPos(src, 0, 'out');
                    const p2 = getPortPos(dst, c.inPort, 'in');
                    const midX = (p1.x + p2.x) / 2;
                    c.path = [
                        p1,
                        { x: midX, y: p1.y },
                        { x: midX, y: p2.y },
                        p2
                    ];
                }
            }
        });
    };

    const lastTime = useRef(0);
    const runSimulationStep = useCallback((timestamp: number) => {
        if (!lastTime.current) lastTime.current = timestamp;
        const dt = timestamp - lastTime.current;
        lastTime.current = timestamp;
        const { nodes, connections, variables } = appState.current;
        evaluateCircuit(nodes, connections, variables, dt);
    }, [appState]);

    const drawRoundedPath = (ctx: CanvasRenderingContext2D, path: Point[]) => {
        if (!path || path.length < 2) return;
        const RADIUS = 8;
        ctx.beginPath();
        ctx.moveTo(path[0].x, path[0].y);
        
        for (let i = 1; i < path.length - 1; i++) {
            const prev = path[i - 1];
            const curr = path[i];
            const next = path[i + 1];
            
            // Collinear check
            if ((Math.abs(prev.x - curr.x) < 1 && Math.abs(curr.x - next.x) < 1) || 
                (Math.abs(prev.y - curr.y) < 1 && Math.abs(curr.y - next.y) < 1)) {
                ctx.lineTo(curr.x, curr.y);
                continue;
            }

            const v1x = curr.x - prev.x;
            const v1y = curr.y - prev.y;
            const v2x = next.x - curr.x;
            const v2y = next.y - curr.y;
            const l1 = Math.sqrt(v1x*v1x + v1y*v1y);
            const l2 = Math.sqrt(v2x*v2x + v2y*v2y);
            const r = Math.min(RADIUS, l1 / 2, l2 / 2);
            
            if (l1 > 0) ctx.lineTo(curr.x - (v1x / l1) * r, curr.y - (v1y / l1) * r);
            if (l2 > 0) ctx.quadraticCurveTo(curr.x, curr.y, curr.x + (v2x / l2) * r, curr.y + (v2y / l2) * r);
        }
        const last = path[path.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
    };

    const draw = useCallback((timestamp: number, scheme: 'dark' | 'light' = 'dark') => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if(!canvas || !ctx) return;
        
        const isLight = scheme === 'light';
        const dpr = isLight ? 1 : (window.devicePixelRatio || 1); 

        ctx.setTransform(1, 0, 0, 1, 0, 0); 
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background
        ctx.fillStyle = isLight ? '#FFFFFF' : '#1e1e1e';
        ctx.fillRect(0,0, canvas.width, canvas.height);

        ctx.scale(dpr, dpr); 
        
        const { nodes, connections, variables } = appState.current;
        ctx.save();
        ctx.translate(view.current.x, view.current.y);
        ctx.scale(view.current.scale, view.current.scale);
        
        // Grid - Only draw in Dark Mode (Editor) to keep PDF export clean
        if (!isLight) {
            ctx.fillStyle = '#2d2d2d';
            const startX = -view.current.x / view.current.scale;
            const startY = -view.current.y / view.current.scale;
            const endX = startX + (canvas.width / dpr) / view.current.scale;
            const endY = startY + (canvas.height / dpr) / view.current.scale;
            for (let x = Math.floor(startX/GRID_SIZE)*GRID_SIZE; x < endX; x += GRID_SIZE) {
                for (let y = Math.floor(startY/GRID_SIZE)*GRID_SIZE; y < endY; y += GRID_SIZE) {
                    ctx.fillRect(x, y, 1.5, 1.5);
                }
            }
        }

        // Draw Committed Wires
        connections.forEach((c) => {
            if(!c.path) return;
            const src = nodes.find(n => n.id === c.from);
            const type = src ? resolveActualType(src, variables, connections, nodes) : 'ANY';
            
            let col = c.color || getTypeColor(type);
            // In light mode, darken standard grey wires for contrast
            if (isLight && col === '#abb2bf') col = '#666'; 

            // Highlight whole wire on hover
            if(!isLight && (hoveredWire.current === c || (hoveredSegment && hoveredSegment.c === c))) {
                ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.2)'; 
                drawRoundedPath(ctx, c.path);
            }

            const isActive = isSimMode && src && (src.state === true || (typeof src.state === 'number' && src.state !== 0));
            ctx.lineWidth = 2; ctx.strokeStyle = col; 
            
            if (isActive) { ctx.shadowBlur = 8; ctx.shadowColor = col; }
            ctx.lineJoin = 'round';
            drawRoundedPath(ctx, c.path);
            
            if (isActive) {
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.setLineDash([8,8]);
                ctx.lineDashOffset = -timestamp/30; ctx.shadowBlur = 0;
                drawRoundedPath(ctx, c.path); ctx.setLineDash([]);
            }
        });

        // Draw Edge Drag Handle
        if (hoveredSegment && !isSimMode && !isLight) {
             ctx.fillStyle = '#fff';
             ctx.shadowBlur = 5; ctx.shadowColor = '#000';
             ctx.beginPath();
             ctx.arc(hoveredSegment.p.x, hoveredSegment.p.y, 4, 0, Math.PI * 2);
             ctx.fill();
             
             // Visual cue for drag direction
             ctx.strokeStyle = '#007acc'; ctx.lineWidth = 1;
             ctx.beginPath();
             if (hoveredSegment.orientation === 'V') {
                 // Left-Right arrows
                 ctx.moveTo(hoveredSegment.p.x - 8, hoveredSegment.p.y);
                 ctx.lineTo(hoveredSegment.p.x + 8, hoveredSegment.p.y);
             } else {
                 // Up-Down arrows
                 ctx.moveTo(hoveredSegment.p.x, hoveredSegment.p.y - 8);
                 ctx.lineTo(hoveredSegment.p.x, hoveredSegment.p.y + 8);
             }
             ctx.stroke();
             ctx.shadowBlur = 0;
        }

        // Manual Wire Drawing Visualization
        if(isWireMode.current && wireStart.current && wirePath.current.length > 0) {
            const startType = wireStart.current.type;
            const col = invalidTarget.current ? '#e06c75' : getTypeColor(startType as any);

            // Draw finalized segments
            ctx.beginPath();
            ctx.moveTo(wirePath.current[0].x, wirePath.current[0].y);
            for(let i=1; i<wirePath.current.length; i++) {
                ctx.lineTo(wirePath.current[i].x, wirePath.current[i].y);
            }
            // Draw active ghost segment
            if(wireGhost.current) {
                ctx.lineTo(wireGhost.current.x, wireGhost.current.y);
            }
            ctx.lineWidth = 2;
            ctx.strokeStyle = col;
            ctx.setLineDash([]);
            ctx.stroke();

            // Draw "Target" indicator
            if (wireGhost.current) {
                ctx.fillStyle = col;
                ctx.fillRect(wireGhost.current.x - 2, wireGhost.current.y - 2, 4, 4);
                
                // Weak line to mouse cursor
                ctx.beginPath();
                ctx.moveTo(wireGhost.current.x, wireGhost.current.y);
                ctx.lineTo(mousePos.current.x, mousePos.current.y);
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Draw Nodes
        nodes.forEach(n => {
            const conf = BLOCKS[n.type];
            const h = getNodeHeight(n);
            ctx.fillStyle = n === selectedNode.current ? '#444' : conf.c;
            ctx.shadowColor = isLight ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
            ctx.fillRect(n.x, n.y, conf.w, h);
            ctx.shadowBlur = 0; 
            ctx.strokeStyle = n === selectedNode.current ? '#007acc' : (isLight ? '#000' : '#222'); 
            ctx.lineWidth = isLight ? 1 : 2;
            ctx.strokeRect(n.x, n.y, conf.w, h);
            
            ctx.fillStyle = isLight && n !== selectedNode.current ? '#fff' : '#fff'; 
            ctx.font = `bold 11px sans-serif`; ctx.textAlign = 'center';
            let label = n.customLabel || n.type;
            if(label.length > 8) label = label.substring(0,8) + '..';
            ctx.fillText(label, n.x + conf.w/2, n.y + 15);
            
            if(n.type === 'CALC' && n.props) {
                 ctx.font = '10px monospace'; ctx.fillStyle='#0f0';
                 ctx.fillText(Number(n.props.val).toFixed(2), n.x + conf.w/2, n.y + h - 5);
            }

            if(n.varName) { 
                ctx.fillStyle = isLight ? '#000000' : '#FFD700'; 
                ctx.font = '10px monospace'; 
                ctx.fillText(`[${n.varName}]`, n.x + conf.w/2, n.y - 6); 
            }

            let varType: DataType | null = null;
            let val: any = n.state;
            if (n.varName) {
                const v = appState.current.variables.find(vx => vx.name === n.varName);
                if (v) {
                    varType = v.dataType;
                    val = v.value;
                }
            }

            if (n.type === 'INPUT' || n.type === 'SENSOR') {
                const innerX = n.x + 10;
                const innerY = n.y + 20;
                const innerW = conf.w - 20;
                const innerH = 20;
                const cx = n.x + conf.w/2;
                
                if (!varType) {
                    ctx.fillStyle = '#333'; ctx.fillRect(innerX, innerY, innerW, innerH);
                    ctx.strokeStyle = '#555'; ctx.strokeRect(innerX, innerY, innerW, innerH);
                    ctx.fillStyle = '#666'; ctx.font = 'italic 9px sans-serif'; ctx.textAlign = 'center';
                    ctx.fillText('No Tag', cx, n.y + 34);
                } else if (varType === 'BOOL') {
                    if (n.type === 'INPUT') {
                        const switchW = 36; const switchH = 14;
                        const swX = cx - switchW/2; const swY = n.y + 24;
                        const isActive = Boolean(val);
                        ctx.beginPath();
                        if(ctx.roundRect) ctx.roundRect(swX, swY, switchW, switchH, 7);
                        else ctx.rect(swX, swY, switchW, switchH);
                        ctx.fillStyle = isActive ? '#2e7d32' : '#3a3a3a'; ctx.fill();
                        ctx.beginPath();
                        const knobX = isActive ? swX + switchW - 14 : swX + 2;
                        ctx.arc(knobX + 6, swY + 7, 6, 0, Math.PI*2);
                        ctx.fillStyle = '#fff'; ctx.fill();
                    } else {
                        const isActive = Boolean(val);
                        ctx.fillStyle = '#222'; ctx.fillRect(cx - 10, n.y + 22, 20, 16);
                        ctx.beginPath(); ctx.arc(cx, n.y + 30, 4, 0, 2*Math.PI);
                        ctx.fillStyle = isActive ? '#ff0' : '#400'; ctx.fill();
                        if (isActive) { ctx.shadowBlur = 5; ctx.shadowColor = '#ff0'; ctx.fill(); ctx.shadowBlur=0; }
                    }
                } else {
                    ctx.fillStyle = '#111'; ctx.fillRect(innerX, innerY, innerW, innerH);
                    ctx.strokeStyle = '#0af'; ctx.lineWidth = 1; ctx.strokeRect(innerX, innerY, innerW, innerH);
                    ctx.fillStyle = '#0ff'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
                    let txt = String(Number(val).toFixed(varType === 'REAL' ? 2 : 0));
                    if(txt.length > 7) txt = txt.substring(0,6) + '..';
                    ctx.fillText(txt, cx, n.y + 34);
                }
            }
            else if (n.type === 'OUTPUT') {
                const cx = n.x + conf.w/2;
                if (!varType) {
                    ctx.beginPath(); ctx.arc(cx, n.y + 30, 8, 0, Math.PI*2);
                    ctx.strokeStyle = '#555'; ctx.stroke(); ctx.fillStyle = '#222'; ctx.fill();
                } else if (varType === 'BOOL') {
                    const isActive = Boolean(val);
                    ctx.beginPath(); ctx.arc(cx, n.y + 30, 10, 0, Math.PI*2);
                    if (isActive) {
                        ctx.shadowBlur = 12; ctx.shadowColor = '#ff3333';
                        ctx.fillStyle = '#ff4444';
                    } else {
                        ctx.fillStyle = '#4a0000';
                    }
                    ctx.fill(); ctx.shadowBlur = 0;
                    ctx.beginPath(); ctx.arc(cx - 3, n.y + 27, 2, 0, Math.PI*2);
                    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
                } else {
                    const innerX = n.x + 10; const innerY = n.y + 20; const innerW = conf.w - 20; const innerH = 20;
                    ctx.fillStyle = '#000'; ctx.fillRect(innerX, innerY, innerW, innerH);
                    ctx.strokeStyle = '#f80'; ctx.lineWidth = 1; ctx.strokeRect(innerX, innerY, innerW, innerH);
                    ctx.fillStyle = '#fa0'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
                    let txt = String(Number(val).toFixed(varType === 'REAL' ? 2 : 0));
                    if(txt.length > 7) txt = txt.substring(0,6) + '..';
                    ctx.fillText(txt, cx, n.y + 34);
                }
            }
            else if (n.type === 'PUSH') {
                const cx = n.x + conf.w/2;
                const cy = n.y + 30;
                const pressed = Boolean(n.state);
                ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI*2); ctx.fillStyle = '#444'; ctx.fill();
                ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2);
                if (pressed) {
                    ctx.fillStyle = '#09f'; ctx.shadowBlur = 4; ctx.shadowColor = '#0cf';
                } else {
                    const g = ctx.createRadialGradient(cx-2, cy-2, 2, cx, cy, 10);
                    g.addColorStop(0, '#555'); g.addColorStop(1, '#222');
                    ctx.fillStyle = g;
                }
                ctx.fill(); ctx.shadowBlur = 0;
            }
            
            const spacingIn = h / ((n.customIn || conf.in) + 1);
            for(let i=0; i<(n.customIn || conf.in); i++) {
                const p = { x: n.x, y: n.y + spacingIn * (i+1) };
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); 
                ctx.fillStyle = getTypeColor(getNodeIOType(n, variables, i, true, connections, nodes)); ctx.fill();
                if(conf.labels && conf.labels[i]) {
                    ctx.textAlign='left';
                    const isAdvanced = ['SR','RS','JK','TON','R_TRIG','SEL','CALC'].includes(n.type);
                    ctx.fillStyle = isLight ? (isAdvanced ? '#d48806' : '#666') : (isAdvanced ? '#ffcb6b' : '#ccc'); 
                    ctx.font = isAdvanced ? 'bold 10px monospace' : '9px sans-serif';
                    ctx.fillText(conf.labels[i], p.x + 8, p.y + 3);
                }
            }
            const spacingOut = h / (conf.out + 1);
            for(let i=0; i<conf.out; i++) {
                const p = { x: n.x + conf.w, y: n.y + spacingOut * (i+1) };
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); 
                ctx.fillStyle = getTypeColor(getNodeIOType(n, variables, i, false, connections, nodes)); ctx.fill();
            }
        });
        ctx.restore();
    }, [appState, isSimMode, hoveredSegment]);

    useEffect(() => {
        const resize = () => {
            if(containerRef.current && canvasRef.current) {
                const dpr = window.devicePixelRatio || 1;
                const rect = containerRef.current.getBoundingClientRect();
                canvasRef.current.width = rect.width * dpr;
                canvasRef.current.height = rect.height * dpr;
                canvasRef.current.style.width = `${rect.width}px`;
                canvasRef.current.style.height = `${rect.height}px`;
                draw(0);
            }
        };
        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, [draw]);

    useEffect(() => {
        ensurePathsExist();
        const loop = (time: number) => {
            runSimulationStep(time);
            draw(time);
            animationFrameRef.current = requestAnimationFrame(loop);
        };
        animationFrameRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [runSimulationStep, draw]);

    const handleWheel = (e: React.WheelEvent) => {
        const dir = e.deltaY > 0 ? -1 : 1;
        const factor = 1 + (dir * 0.1);
        if (view.current.scale * factor < 0.2 || view.current.scale * factor > 3) return;
        const m = getMouseWorld(e.nativeEvent);
        view.current.x -= m.x * (factor - 1) * view.current.scale;
        view.current.y -= m.y * (factor - 1) * view.current.scale;
        view.current.scale *= factor;
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            if (isWireMode.current) {
                isWireMode.current = false;
                wireStart.current = null;
                wirePath.current = [];
                wireGhost.current = null;
                onUpdateUI(); // Force redraw/state clear
            }
        }
    }, []);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if(isSimMode) return;
        
        // Edge Moving Logic
        if (e.button === 0 && hoveredSegment) {
            isDragging.current = true;
            dragSegment.current = {
                c: hoveredSegment.c,
                index: hoveredSegment.index,
                orientation: hoveredSegment.orientation,
                startVal: hoveredSegment.orientation === 'V' ? hoveredSegment.p.x : hoveredSegment.p.y,
                mouseStartVal: hoveredSegment.orientation === 'V' ? e.clientX : e.clientY
            };
            return;
        }

        // Right click cancels wiring
        if (e.button === 2) {
             if (isWireMode.current) {
                isWireMode.current = false;
                wireStart.current = null;
                wirePath.current = [];
                wireGhost.current = null;
                return;
             }
        }

        setCtxMenu(null); setFloatingInput(null);
        const m = getMouseWorld(e.nativeEvent);
        lastMouseScreen.current = { x: e.clientX, y: e.clientY };
        const { nodes, variables, connections } = appState.current;

        // 1. Check Output Ports to Start Wiring
        if (e.button === 0 && !isWireMode.current) {
            for(let n of nodes) {
                const conf = BLOCKS[n.type];
                for(let i=0; i<conf.out; i++) {
                    const portPos = getPortPos(n, i, 'out');
                    if(dist(m, portPos) < 10) {
                        isWireMode.current = true; 
                        const type = getNodeIOType(n, variables, i, false, connections, nodes);
                        wireStart.current = {nodeId: n.id, port: i, type: type as string, pos: portPos}; 
                        wirePath.current = [portPos]; // Start path
                        wireGhost.current = portPos;
                        return;
                    }
                }
            }
        }

        // 2. Add Anchor Point if Wiring
        if (isWireMode.current && e.button === 0 && wireGhost.current) {
             let hitInput = false;
             for(let n of nodes) {
                const inCount = n.customIn || BLOCKS[n.type].in;
                for(let i=0; i<inCount; i++) {
                    if(dist(m, getPortPos(n, i, 'in')) < 12) {
                         hitInput = true;
                         // Finalize Connection
                         const targetType = getNodeIOType(n, variables, i, true, connections, nodes);
                         if (areTypesCompatible(wireStart.current!.type as any, targetType)) {
                            const finalPath = [...wirePath.current, wireGhost.current, getPortPos(n, i, 'in')];
                            appState.current.connections = appState.current.connections.filter(c => !(c.to === n.id && c.inPort === i));
                            appState.current.connections.push({
                                from: wireStart.current!.nodeId, 
                                to: n.id, 
                                inPort: i, 
                                id: Date.now(),
                                path: finalPath 
                            });
                            
                            isWireMode.current = false; wireStart.current = null; wirePath.current = []; wireGhost.current = null;
                            onUpdateUI();
                            return;
                         } else {
                            setToast({ msg: `Type Mismatch`, x: e.clientX, y: e.clientY, type: 'error' });
                         }
                    }
                }
             }

             if (!hitInput) {
                 // Add Anchor
                 wirePath.current.push(wireGhost.current);
             }
             return;
        }

        const hitNode = nodes.slice().reverse().find(n => {
             const h = getNodeHeight(n);
             return m.x > n.x && m.x < n.x + BLOCKS[n.type].w && m.y > n.y && m.y < n.y + h;
        });

        if(hitNode) {
            let interacted = false;
            if (hitNode.type === 'INPUT') {
                if (m.x > hitNode.x + 20 && m.x < hitNode.x + 70 && m.y > hitNode.y + 20 && m.y < hitNode.y + 45) {
                     if (hitNode.varName) {
                         const v = variables.find(x => x.name === hitNode.varName);
                         if (v && v.dataType === 'BOOL') { v.value = !v.value; hitNode.state = Boolean(v.value); } 
                         else if (!v || v.dataType === 'BOOL') hitNode.state = !hitNode.state;
                     } else hitNode.state = !hitNode.state;
                     interacted = true;
                }
            } else if (hitNode.type === 'PUSH') {
                if (dist(m, {x: hitNode.x + 45, y: hitNode.y + 30}) < 15) {
                    hitNode.state = true;
                    if (hitNode.varName) {
                        const v = variables.find(x => x.name === hitNode.varName);
                        if (v && v.dataType === 'BOOL') v.value = true;
                    }
                    interacted = true;
                }
            } else if (hitNode.type === 'SENSOR') {
                if (m.x > hitNode.x + 30 && m.x < hitNode.x + 60 && m.y > hitNode.y + 20 && m.y < hitNode.y + 40) {
                     hitNode.state = !hitNode.state;
                     if(hitNode.varName) {
                         const v = variables.find(x => x.name === hitNode.varName);
                         if(v && v.dataType === 'BOOL') v.value = Boolean(hitNode.state);
                     }
                     interacted = true;
                }
            }

            if (interacted) { onUpdateUI(); return; }

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

        // --- 1. Edge Dragging Logic ---
        if (isDragging.current && dragSegment.current) {
            const ds = dragSegment.current;
            const isV = ds.orientation === 'V';
            // Calculate delta screen space then convert to world
            const deltaScreen = (isV ? e.clientX : e.clientY) - ds.mouseStartVal;
            const deltaWorld = deltaScreen / view.current.scale;
            
            const rawVal = ds.startVal + deltaWorld;
            const snappedVal = Math.round(rawVal / ROUTER_GRID_SIZE) * ROUTER_GRID_SIZE;
            
            const path = ds.c.path;
            if (path && path.length > ds.index + 1) {
                // Update both points of the segment to move it parallel
                if (isV) {
                    path[ds.index].x = snappedVal;
                    path[ds.index + 1].x = snappedVal;
                } else {
                    path[ds.index].y = snappedVal;
                    path[ds.index + 1].y = snappedVal;
                }
            }
            return;
        }

        // --- 2. Panning Logic ---
        if(isPanning.current) {
            view.current.x += e.clientX - lastMouseScreen.current.x;
            view.current.y += e.clientY - lastMouseScreen.current.y;
            lastMouseScreen.current = { x: e.clientX, y: e.clientY };
            return;
        } 
        
        // --- 3. Node Dragging Logic ---
        if(isDragging.current && dragNode.current) {
            const prevX = dragNode.current.x;
            const prevY = dragNode.current.y;
            
            dragNode.current.x = Math.round((m.x - dragOffset.current.x) / GRID_SIZE) * GRID_SIZE;
            dragNode.current.y = Math.round((m.y - dragOffset.current.y) / GRID_SIZE) * GRID_SIZE;
            
            // Drag attached wires (Simple Stretch)
            const { connections } = appState.current;
            const dx = dragNode.current.x - prevX;
            const dy = dragNode.current.y - prevY;

            connections.forEach(c => {
                if (c.from === dragNode.current?.id && c.path && c.path.length > 0) {
                    c.path[0].x += dx; c.path[0].y += dy;
                }
                if (c.to === dragNode.current?.id && c.path && c.path.length > 0) {
                     const last = c.path.length - 1;
                     c.path[last].x += dx; c.path[last].y += dy;
                }
            });
            return;
        } 
        
        // --- 4. Wiring Ghost Logic ---
        if(isWireMode.current && wireStart.current && wirePath.current.length > 0) {
            const { nodes, variables, connections } = appState.current;
            invalidTarget.current = false;
            
            // Check Input Hover
            for(let n of nodes) {
                const inCount = n.customIn || BLOCKS[n.type].in;
                for(let i=0; i<inCount; i++) {
                    const pPos = getPortPos(n, i, 'in');
                    if(dist(m, pPos) < 12) {
                        if (!areTypesCompatible(wireStart.current!.type as any, getNodeIOType(n, variables, i, true, connections, nodes))) {
                            invalidTarget.current = true;
                        }
                    }
                }
            }

            const lastAnchor = wirePath.current[wirePath.current.length - 1];
            const mx = Math.round(m.x / ROUTER_GRID_SIZE) * ROUTER_GRID_SIZE;
            const my = Math.round(m.y / ROUTER_GRID_SIZE) * ROUTER_GRID_SIZE;
            
            const dx = Math.abs(mx - lastAnchor.x);
            const dy = Math.abs(my - lastAnchor.y);

            if (dx > dy) {
                wireGhost.current = { x: mx, y: lastAnchor.y };
            } else {
                wireGhost.current = { x: lastAnchor.x, y: my };
            }
            return;
        }

        // --- 5. Hover Detection (Wires & Segments) ---
        // Used to show move handles or delete menu
        if (!isSimMode) {
            let foundSeg = null;
            let foundWire = null;
            const { connections } = appState.current;

            for(let c of connections) {
                if(!c.path) continue;
                for(let i=0; i<c.path.length-1; i++) {
                    const p1 = c.path[i];
                    const p2 = c.path[i+1];
                    const d = distToSegment(m, p1, p2);
                    
                    if(d < 8) { 
                        foundWire = c;
                        
                        // Check if movable segment
                        // Don't allow moving the very first or very last segment to maintain port attachment
                        if (i > 0 && i < c.path.length - 2) {
                            const isV = Math.abs(p1.x - p2.x) < 1;
                            const isH = Math.abs(p1.y - p2.y) < 1;
                            
                            // Only allow moving strictly orthogonal segments
                            if (isV || isH) {
                                const p = getClosestPointOnSegment(m, p1, p2);
                                foundSeg = { c, index: i, p, orientation: isV ? 'V' : 'H' };
                            }
                        }
                        break; 
                    }
                }
                if (foundWire) break;
            }
            
            hoveredWire.current = foundWire;
            setHoveredSegment(foundSeg as any);

            // Update Cursor
            if (foundSeg) {
                document.body.style.cursor = (foundSeg as any).orientation === 'V' ? 'col-resize' : 'row-resize';
            } else {
                document.body.style.cursor = 'default';
            }
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (dragSegment.current) {
            dragSegment.current = null;
            isDragging.current = false;
            onUpdateUI();
            return;
        }

        const { nodes, variables } = appState.current;
        let update = false;
        nodes.filter(n => n.type === 'PUSH' && n.state).forEach(n => {
            n.state = false;
            if(n.varName) {
                const v = variables.find(x => x.name === n.varName);
                if(v && v.dataType === 'BOOL') v.value = false;
            }
            update = true;
        });
        if(update) onUpdateUI();

        isPanning.current = false; 
        isDragging.current = false; 
        dragNode.current = null;
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isWireMode.current) {
            isWireMode.current = false;
            wireStart.current = null;
            wirePath.current = [];
            wireGhost.current = null;
            return;
        }

        if(hoveredWire.current) {
            const wire = hoveredWire.current;
             const colorOptions = [
                { label: 'Default', hex: undefined },
                { label: 'Red', hex: '#ef4444' },
                { label: 'Blue', hex: '#3b82f6' },
                { label: 'Green', hex: '#22c55e' },
                { label: 'Orange', hex: '#f97316' },
                { label: 'Purple', hex: '#a855f7' },
                { label: 'Cyan', hex: '#06b6d4' },
                { label: 'Pink', hex: '#ec4899' },
                { label: 'Yellow', hex: '#eab308' },
                { label: 'Lime', hex: '#84cc16' },
                { label: 'Teal', hex: '#14b8a6' },
                { label: 'Indigo', hex: '#6366f1' },
                { label: 'Rose', hex: '#f43f5e' },
                { label: 'White', hex: '#ffffff' },
                { label: 'Gray', hex: '#9ca3af' },
            ];
            setCtxMenu({ x: e.clientX, y: e.clientY, title: 'Wire Style', items: [
                ...colorOptions.map(opt => ({
                    html: `<div class="flex items-center gap-2"><div class="w-3 h-3 border border-gray-500 rounded-full" style="background:${opt.hex || '#444'}"></div> ${opt.label}</div>`,
                    onClick: () => { wire.color = opt.hex; onUpdateUI(); }
                })),
                { type: 'separator' },
                { label: 'Delete Wire', onClick: () => {
                    appState.current.connections = appState.current.connections.filter(c => c !== wire);
                    onUpdateUI();
                }}
            ]});
            return;
        }
        const m = getMouseWorld(e.nativeEvent);
        const n = appState.current.nodes.slice().reverse().find(n => {
            const h = getNodeHeight(n);
            return m.x > n.x && m.x < n.x + BLOCKS[n.type].w && m.y > n.y && m.y < n.y + h;
        });
        if(n) {
            const items: any[] = [];
            
            if(['AND','OR','NAND','NOR','XOR'].includes(n.type)) {
                items.push({ 
                    label: '+ Add Input Port', 
                    onClick: () => { 
                        n.customIn = (n.customIn || BLOCKS[n.type].in) + 1; 
                        n.inputs.push(0); 
                        onUpdateUI(); 
                    }
                });
                const currentIn = n.customIn || BLOCKS[n.type].in;
                if(currentIn > 2) {
                     items.push({ 
                        label: '- Remove Input Port', 
                        onClick: () => { 
                            n.customIn = currentIn - 1; 
                            n.inputs.pop(); 
                            appState.current.connections = appState.current.connections.filter(c => !(c.to === n.id && c.inPort >= n.customIn!));
                            onUpdateUI(); 
                        }
                    });
                }
                items.push({ type: 'separator' });
            }

            items.push({ label: 'Rename', onClick: () => setFloatingInput({ x: e.clientX, y: e.clientY, node: n, mode: 'rename' }) });
            items.push({ label: 'Assign Variable', onClick: () => setFloatingInput({ x: e.clientX, y: e.clientY, node: n, mode: 'variable' }) });
            items.push({ label: 'Delete', onClick: () => {
                appState.current.nodes = appState.current.nodes.filter(x => x.id !== n.id);
                appState.current.connections = appState.current.connections.filter(c => c.from !== n.id && c.to !== n.id);
                onUpdateUI();
            }});
            
            setCtxMenu({ x: e.clientX, y: e.clientY, title: n.type, items });
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData("type"); if(!type) return;
        const m = getMouseWorld(e.nativeEvent);
        appState.current.nodes.push({ id: appState.current.nextId++, type, x: Math.round(m.x/GRID_SIZE)*GRID_SIZE, y: Math.round(m.y/GRID_SIZE)*GRID_SIZE, inputs: Array(BLOCKS[type].in).fill(0), state: false, varName: null });
        onUpdateUI();
    };

    const handleFloatingInput = (val: string) => {
        if(!floatingInput) return;
        const n = floatingInput.node;
        
        if (floatingInput.mode === 'rename') {
             n.customLabel = val; 
             setFloatingInput(null); 
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
                } else {
                    setFloatingInput(prev => prev ? ({...prev, error: true}) : null);
                }
            } else {
                setFloatingInput(null);
            }
            return;
        }

        const v = appState.current.variables.find(x => x.name === val);
        if(!val) { n.varName = null; setFloatingInput(null); }
        else if(v) { n.varName = val; n.state = v.value; setFloatingInput(null); }
        else { setFloatingInput(prev => prev ? ({...prev, error: true}) : null); }
    };

    return (
        <div 
            className="flex-grow relative bg-[#1e1e1e] overflow-hidden outline-none" 
            ref={containerRef}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
        >
            <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel} onContextMenu={handleContextMenu} className="block h-full w-full" />
            {ctxMenu && <ContextMenu {...ctxMenu} onClose={() => setCtxMenu(null)} />}
            {toast && <FeedbackToast {...toast} />}
            {floatingInput && (
                <div className="absolute z-[999]" style={{left: floatingInput.x, top: floatingInput.y}}>
                    <input autoFocus className="bg-black/90 border border-accent text-white p-1 text-xs rounded w-[150px]" onKeyDown={e => {
                        if(e.key === 'Enter') {
                            const val = e.currentTarget.value.trim();
                            if(floatingInput.mode === 'variable') floatingInput.node.varName = val || null;
                            else floatingInput.node.customLabel = val;
                            setFloatingInput(null); onUpdateUI();
                        }
                        if(e.key === 'Escape') setFloatingInput(null);
                    }} onBlur={() => setFloatingInput(null)} />
                </div>
            )}
        </div>
    );
});

export default Canvas;
