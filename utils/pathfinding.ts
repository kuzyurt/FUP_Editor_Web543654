
import { Point, NodeData } from '../core/types';
import { BLOCKS, ROUTER_GRID_SIZE } from '../core/constants';

// ---- CONFIGURATION ----
const COST_STEP = 10;
const COST_TURN = 20; // Cost for turning (penalize slightly to prefer straight lines)
const PADDING = 15;   // Padding around nodes (px)

// ---- TYPES ----
type GridPoint = { x: number, y: number };

interface CellState {
    blocked: boolean;
    hWire: boolean; // occupied by horizontal wire
    vWire: boolean; // occupied by vertical wire
}

interface AStarNode {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent: AStarNode | null;
    direction: 'H' | 'V' | null;
}

class PriorityQueue<T> {
    private items: { item: T, priority: number }[] = [];

    enqueue(item: T, priority: number) {
        this.items.push({ item, priority });
        this.items.sort((a, b) => a.priority - b.priority);
    }

    dequeue(): T | undefined {
        return this.items.shift()?.item;
    }

    isEmpty(): boolean {
        return this.items.length === 0;
    }
}

export class PathFinder {
    private grid: Map<string, CellState> = new Map();
    private minX = Infinity;
    private minY = Infinity;
    private maxX = -Infinity;
    private maxY = -Infinity;

    constructor(nodes: NodeData[]) {
        // 1. Mark Obstacles (Nodes + Padding)
        nodes.forEach(n => {
            const conf = BLOCKS[n.type];
            const inCount = n.customIn || conf.in;
            const h = inCount > 2 ? Math.max(conf.h, (inCount + 1) * 20) : conf.h;
            
            const x1 = Math.floor((n.x - PADDING) / ROUTER_GRID_SIZE);
            const y1 = Math.floor((n.y - PADDING) / ROUTER_GRID_SIZE);
            const x2 = Math.ceil((n.x + conf.w + PADDING) / ROUTER_GRID_SIZE);
            const y2 = Math.ceil((n.y + h + PADDING) / ROUTER_GRID_SIZE);

            this.updateBounds(x1, y1);
            this.updateBounds(x2, y2);

            for (let x = x1; x <= x2; x++) {
                for (let y = y1; y <= y2; y++) {
                    this.markBlocked(x, y);
                }
            }
        });

        // 2. Carve Access Tunnels for Ports
        // This ensures that the exact start/end points of wires are not inside a blocked cell
        nodes.forEach(n => {
            const conf = BLOCKS[n.type];
            const inCount = n.customIn || conf.in;
            const h = inCount > 2 ? Math.max(conf.h, (inCount + 1) * 20) : conf.h;

            // Inputs (Left Side)
            const spacingIn = h / (inCount + 1);
            for(let i=0; i<inCount; i++) {
                const y = n.y + spacingIn * (i+1);
                // Clear path to the left of the node
                this.carveTunnel(n.x, y, -1);
            }

            // Outputs (Right Side)
            const spacingOut = h / (conf.out + 1);
            for(let i=0; i<conf.out; i++) {
                const y = n.y + spacingOut * (i+1);
                // Clear path to the right of the node
                this.carveTunnel(n.x + conf.w, y, 1);
            }
        });
    }

    private updateBounds(x: number, y: number) {
        this.minX = Math.min(this.minX, x);
        this.minY = Math.min(this.minY, y);
        this.maxX = Math.max(this.maxX, x);
        this.maxY = Math.max(this.maxY, y);
    }

    private key(x: number, y: number): string {
        return `${x},${y}`;
    }

    private getCell(x: number, y: number): CellState {
        const k = this.key(x, y);
        if (!this.grid.has(k)) {
            return { blocked: false, hWire: false, vWire: false };
        }
        return this.grid.get(k)!;
    }

    private markBlocked(x: number, y: number) {
        const k = this.key(x, y);
        const cell = this.getCell(x, y);
        cell.blocked = true;
        this.grid.set(k, cell);
    }

    private clearCell(x: number, y: number) {
        const k = this.key(x, y);
        const cell = this.getCell(x, y);
        cell.blocked = false;
        this.grid.set(k, cell);
    }

    private carveTunnel(worldX: number, worldY: number, dirX: number) {
        const startX = Math.round(worldX / ROUTER_GRID_SIZE);
        const startY = Math.round(worldY / ROUTER_GRID_SIZE);
        // Clear the port itself and 2 cells outward
        for(let i=0; i<=2; i++) {
            this.clearCell(startX + (i * dirX), startY);
        }
    }

    private markWire(x: number, y: number, isH: boolean) {
        const k = this.key(x, y);
        const cell = this.getCell(x, y);
        if (isH) cell.hWire = true;
        else cell.vWire = true;
        this.grid.set(k, cell);
    }

    findPath(startWorld: Point, endWorld: Point): Point[] {
        // Snap world coords to grid
        const start = { 
            x: Math.round(startWorld.x / ROUTER_GRID_SIZE), 
            y: Math.round(startWorld.y / ROUTER_GRID_SIZE) 
        };
        const end = { 
            x: Math.round(endWorld.x / ROUTER_GRID_SIZE), 
            y: Math.round(endWorld.y / ROUTER_GRID_SIZE) 
        };

        // Safety: Ensure endpoints are definitely clear
        this.clearCell(start.x, start.y);
        this.clearCell(end.x, end.y);

        const openSet = new PriorityQueue<AStarNode>();
        const closedSet = new Set<string>();

        openSet.enqueue({
            x: start.x, y: start.y,
            g: 0, h: this.heuristic(start, end), f: 0,
            parent: null, direction: null
        }, 0);

        let bestNode: AStarNode | null = null;
        let iter = 0;
        const MAX_ITER = 4000; // Limit to prevent freeze

        // Expand bounds slightly for routing
        const searchPadding = 5;
        const sMinX = Math.min(this.minX, start.x, end.x) - searchPadding;
        const sMaxX = Math.max(this.maxX, start.x, end.x) + searchPadding;
        const sMinY = Math.min(this.minY, start.y, end.y) - searchPadding;
        const sMaxY = Math.max(this.maxY, start.y, end.y) + searchPadding;

        while (!openSet.isEmpty()) {
            if (iter++ > MAX_ITER) break;

            const curr = openSet.dequeue()!;

            // Target Reached
            if (curr.x === end.x && curr.y === end.y) {
                bestNode = curr;
                break;
            }

            // Visited Check (incorporate direction for penalty consistency)
            const key = `${curr.x},${curr.y}:${curr.direction}`;
            if (closedSet.has(key)) continue;
            closedSet.add(key);

            // Neighbors: Right, Left, Down, Up
            const neighbors = [
                { dx: 1, dy: 0, dir: 'H' }, 
                { dx: -1, dy: 0, dir: 'H' },
                { dx: 0, dy: 1, dir: 'V' }, 
                { dx: 0, dy: -1, dir: 'V' }
            ];

            for (const n of neighbors) {
                const nx = curr.x + n.dx;
                const ny = curr.y + n.dy;

                // Bounds Check
                if (nx < sMinX || nx > sMaxX || ny < sMinY || ny > sMaxY) continue;

                const cell = this.getCell(nx, ny);

                // Obstacle Check
                // Allow entering end node even if marked blocked (redundant but safe)
                if (cell.blocked && !(nx === end.x && ny === end.y)) continue;

                // Parallel Wire Overlap Check
                if (n.dir === 'H' && cell.hWire) continue;
                if (n.dir === 'V' && cell.vWire) continue;

                // Cost
                let newCost = COST_STEP;
                if (curr.direction !== null && curr.direction !== n.dir) {
                    newCost += COST_TURN;
                }

                const g = curr.g + newCost;
                const h = this.heuristic({ x: nx, y: ny }, end);
                
                openSet.enqueue({
                    x: nx, y: ny, g, h, f: g + h,
                    parent: curr, direction: n.dir as 'H' | 'V'
                }, g + h);
            }
        }

        if (bestNode) {
            // Reconstruct Path
            const gridPath: GridPoint[] = [];
            let c: AStarNode | null = bestNode;
            while(c) { gridPath.push({x: c.x, y: c.y}); c = c.parent; }
            gridPath.reverse();
            
            // Simplify (Collinear Reduction)
            const simple: Point[] = [];
            if (gridPath.length > 0) {
                simple.push({ x: gridPath[0].x * ROUTER_GRID_SIZE, y: gridPath[0].y * ROUTER_GRID_SIZE });
                for(let i=1; i<gridPath.length-1; i++) {
                    const prev = gridPath[i-1];
                    const pt = gridPath[i];
                    const next = gridPath[i+1];
                    // Skip if collinear
                    if ((prev.x === pt.x && pt.x === next.x) || (prev.y === pt.y && pt.y === next.y)) continue;
                    simple.push({ x: pt.x * ROUTER_GRID_SIZE, y: pt.y * ROUTER_GRID_SIZE });
                }
                const last = gridPath[gridPath.length-1];
                simple.push({ x: last.x * ROUTER_GRID_SIZE, y: last.y * ROUTER_GRID_SIZE });
            }

            // Mark this path on grid so future wires respect it
            this.commitPathToGrid(simple);
            return simple;
        }

        // Fallback: Manhattan Path (better than diagonal)
        // Midpoint logic
        const midX = (startWorld.x + endWorld.x) / 2;
        return [
            startWorld,
            { x: midX, y: startWorld.y },
            { x: midX, y: endWorld.y },
            endWorld
        ];
    }

    private heuristic(a: GridPoint, b: GridPoint): number {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    private commitPathToGrid(path: Point[]) {
        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];
            const isH = Math.abs(p1.y - p2.y) < 0.1;

            const startX = Math.round(Math.min(p1.x, p2.x) / ROUTER_GRID_SIZE);
            const endX = Math.round(Math.max(p1.x, p2.x) / ROUTER_GRID_SIZE);
            const startY = Math.round(Math.min(p1.y, p2.y) / ROUTER_GRID_SIZE);
            const endY = Math.round(Math.max(p1.y, p2.y) / ROUTER_GRID_SIZE);

            if (isH) {
                for (let x = startX; x <= endX; x++) this.markWire(x, startY, true);
            } else {
                for (let y = startY; y <= endY; y++) this.markWire(startX, y, false);
            }
        }
    }
}
