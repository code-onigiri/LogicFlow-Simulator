
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import p5Types from 'p5'; 
import { ComponentType, CircuitComponent, Wire, Point, FunctionCircuit } from '../types';
import { GRID_SIZE, COLOR_BG } from '../constants';
import { stepSimulation } from '../logic/circuitEngine';
import { CircuitRenderer } from '../logic/circuitRenderer';

declare global {
  interface Window { p5: any; }
}

export interface LogicCanvasHandle {
  getData: () => { components: CircuitComponent[], wires: Wire[] };
  updateSelectedComponent: (updates: Partial<CircuitComponent>) => void;
  deleteSelected: () => void;
  setComponentOutputBit: (compId: string, bitIndex: number, value: boolean) => void;
  focusComponent: (compId: string) => void;
  copy: () => void;
  paste: () => void;
  selectAll: () => void;
}

interface LogicCanvasProps {
  tool: 'CURSOR' | 'REGION' | 'DELETE';
  isPlaying: boolean;
  tickSpeedMs: number; 
  pendingDrop?: { type: ComponentType, x: number, y: number, functionId?: string, bitWidth?: number } | null;
  initialComponents: CircuitComponent[];
  initialWires: Wire[];
  functionLibrary: FunctionCircuit[];
  wireStyle: 'bezier' | 'orthogonal';
  onPendingDropHandled?: () => void;
  onSelectionChange?: (component: CircuitComponent | null) => void;
}

interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
}

const LogicCanvas = forwardRef<LogicCanvasHandle, LogicCanvasProps>(({ 
  tool, 
  isPlaying, 
  tickSpeedMs, 
  pendingDrop, 
  initialComponents,
  initialWires,
  functionLibrary,
  wireStyle,
  onPendingDropHandled,
  onSelectionChange
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<p5Types | null>(null);

  // State Refs
  const componentsRef = useRef<CircuitComponent[]>(JSON.parse(JSON.stringify(initialComponents)));
  const wiresRef = useRef<Wire[]>(JSON.parse(JSON.stringify(initialWires)));
  
  const selectedCompIds = useRef<Set<string>>(new Set()); 
  const selectionBoxRef = useRef<SelectionBox>({ startX: 0, startY: 0, currentX: 0, currentY: 0, active: false });
  const clipboardRef = useRef<{ components: CircuitComponent[], wires: Wire[] } | null>(null);

  // Interaction State
  const activeDragIds = useRef<Set<string>>(new Set());
  const viewportRef = useRef<ViewportState>({ x: 0, y: 0, zoom: 1.0 });
  const isPanningRef = useRef<boolean>(false);
  const isDraggingComp = useRef<boolean>(false);
  const hasDraggedRef = useRef<boolean>(false); 
  const wiringStart = useRef<{ compId: string, portIndex: number, type: 'input'|'output', bitWidth: number } | null>(null);
  const dragStartPos = useRef<Point>({ x: 0, y: 0 }); 
  const accumTimeRef = useRef<number>(0);

  const tickSpeedRef = useRef(tickSpeedMs);
  const isPlayingRef = useRef(isPlaying);
  const toolRef = useRef(tool);
  const libraryRef = useRef(functionLibrary);
  const wireStyleRef = useRef(wireStyle);

  useEffect(() => { tickSpeedRef.current = tickSpeedMs; }, [tickSpeedMs]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { libraryRef.current = functionLibrary; }, [functionLibrary]);
  useEffect(() => { wireStyleRef.current = wireStyle; }, [wireStyle]);

  // -- Clipboard Logic --
  const handleCopy = () => {
      if (selectedCompIds.current.size === 0) return;
      const selectedComps = componentsRef.current.filter(c => selectedCompIds.current.has(c.id));
      const internalWires = wiresRef.current.filter(w => 
          selectedCompIds.current.has(w.fromCompId) && selectedCompIds.current.has(w.toCompId)
      );
      
      clipboardRef.current = {
          components: JSON.parse(JSON.stringify(selectedComps)),
          wires: JSON.parse(JSON.stringify(internalWires))
      };
      console.log(`Copied ${selectedComps.length} items to clipboard`);
  };

  const handlePaste = () => {
      if (!clipboardRef.current) return;
      const { components: clipComps, wires: clipWires } = clipboardRef.current;
      clearSelection();
      const idMap = new Map<string, string>();
      const OFFSET = GRID_SIZE; 
      const newComps: CircuitComponent[] = clipComps.map(c => {
          const newId = crypto.randomUUID();
          idMap.set(c.id, newId);
          return { ...c, id: newId, x: c.x + OFFSET, y: c.y + OFFSET, inputValues: c.inputValues.map(v => []), outputValues: c.outputValues.map(v => []) };
      });
      const newWires: Wire[] = clipWires.map(w => ({
          ...w, id: crypto.randomUUID(), fromCompId: idMap.get(w.fromCompId)!, toCompId: idMap.get(w.toCompId)!, state: new Array(w.bitWidth).fill(false)
      }));
      componentsRef.current.push(...newComps);
      wiresRef.current.push(...newWires);
      newComps.forEach(c => selectedCompIds.current.add(c.id));
      if (newComps.length > 0 && onSelectionChange) onSelectionChange(newComps[newComps.length - 1]);
  };

  const handleSelectAll = () => {
      componentsRef.current.forEach(c => selectedCompIds.current.add(c.id));
      if (onSelectionChange && componentsRef.current.length > 0) onSelectionChange(componentsRef.current[componentsRef.current.length - 1]);
  };

  const handleDelete = () => {
     if (selectedCompIds.current.size === 0) return;
     const idsToDelete = selectedCompIds.current;
     componentsRef.current = componentsRef.current.filter(c => !idsToDelete.has(c.id));
     wiresRef.current = wiresRef.current.filter(w => !idsToDelete.has(w.fromCompId) && !idsToDelete.has(w.toCompId));
     clearSelection();
  };

  useImperativeHandle(ref, () => ({
    getData: () => ({ components: componentsRef.current, wires: wiresRef.current }),
    updateSelectedComponent: (updates) => {
        let updatedCount = 0;
        componentsRef.current.forEach(c => {
            if (selectedCompIds.current.has(c.id)) { Object.assign(c, updates); updatedCount++; }
        });
        if (updatedCount > 0 && onSelectionChange) {
             const lastId = Array.from(selectedCompIds.current).pop();
             const comp = componentsRef.current.find(c => c.id === lastId) || null;
             onSelectionChange(comp); 
        }
    },
    deleteSelected: handleDelete,
    setComponentOutputBit: (compId, bitIndex, value) => {
        const comp = componentsRef.current.find(c => c.id === compId);
        if (comp && comp.type === ComponentType.INPUT_SWITCH) {
            const currentBus = comp.outputValues[0] || new Array(comp.bitWidth).fill(false);
            if (currentBus.length !== comp.bitWidth) while(currentBus.length < comp.bitWidth) currentBus.push(false);
            const newBus = [...currentBus]; newBus[bitIndex] = value;
            comp.outputValues[0] = newBus;
        }
    },
    focusComponent: (compId) => {
        const comp = componentsRef.current.find(c => c.id === compId);
        if (comp && containerRef.current) {
             const dims = CircuitRenderer.getComponentDimensions(comp, libraryRef.current);
             const cx = comp.x + (dims.w * GRID_SIZE)/2;
             const cy = comp.y + (dims.h * GRID_SIZE)/2;
             const sw = containerRef.current.clientWidth;
             const sh = containerRef.current.clientHeight;
             viewportRef.current.x = (sw/2) - (cx * viewportRef.current.zoom);
             viewportRef.current.y = (sh/2) - (cy * viewportRef.current.zoom);
        }
    },
    copy: handleCopy, paste: handlePaste, selectAll: handleSelectAll
  }));

  const screenToWorld = (sx: number, sy: number): Point => ({
    x: (sx - viewportRef.current.x) / viewportRef.current.zoom,
    y: (sy - viewportRef.current.y) / viewportRef.current.zoom
  });

  const clearSelection = () => { selectedCompIds.current.clear(); if (onSelectionChange) onSelectionChange(null); };
  const addToSelection = (id: string) => { selectedCompIds.current.add(id); const comp = componentsRef.current.find(c => c.id === id) || null; if (onSelectionChange) onSelectionChange(comp); };
  const toggleSelection = (id: string) => {
    if (selectedCompIds.current.has(id)) { selectedCompIds.current.delete(id); if (onSelectionChange) onSelectionChange(null); } 
    else { selectedCompIds.current.add(id); const comp = componentsRef.current.find(c => c.id === id) || null; if (onSelectionChange) onSelectionChange(comp); }
  };

  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
          const key = e.key.toLowerCase(); const ctrl = e.ctrlKey || e.metaKey;
          if (key === 'delete' || key === 'backspace') handleDelete();
          else if (ctrl && key === 'c') handleCopy();
          else if (ctrl && key === 'v') handlePaste();
          else if (ctrl && key === 'a') { e.preventDefault(); handleSelectAll(); }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addComponent = (type: ComponentType, screenX: number, screenY: number, functionId?: string, bitWidth: number = 1) => {
    const worldPos = screenToWorld(screenX, screenY);
    const snapX = Math.round(worldPos.x / GRID_SIZE) * GRID_SIZE;
    const snapY = Math.round(worldPos.y / GRID_SIZE) * GRID_SIZE;
    let inputsCount = 0, outputsCount = 0, label = "", internalState = undefined;
    const def = CircuitRenderer.getComponentDimensions({ type, functionId } as any, libraryRef.current);
    inputsCount = def.inputs; outputsCount = def.outputs;

    if (type === ComponentType.CUSTOM_IC && functionId) {
        const func = libraryRef.current.find(f => f.id === functionId);
        if (func) {
            label = func.name;
            internalState = { components: JSON.parse(JSON.stringify(func.components)), wires: JSON.parse(JSON.stringify(func.wires)) };
        }
    }
    const newComp: CircuitComponent = {
      id: crypto.randomUUID(), type: type, x: snapX, y: snapY,
      inputValues: new Array(inputsCount).fill([]), outputValues: new Array(outputsCount).fill([]),
      functionId: functionId, internalState: internalState, customLabel: type === ComponentType.CUSTOM_IC ? label : undefined, bitWidth: bitWidth
    };
    componentsRef.current.push(newComp);
    clearSelection(); addToSelection(newComp.id);
  };

  useEffect(() => {
    if (pendingDrop) {
      addComponent(pendingDrop.type, pendingDrop.x, pendingDrop.y, pendingDrop.functionId, pendingDrop.bitWidth);
      if (onPendingDropHandled) onPendingDropHandled();
    }
  }, [pendingDrop]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
        const data = e.dataTransfer.getData('application/react-logic-sim');
        if (data && containerRef.current) {
            const parsed = JSON.parse(data);
            const rect = containerRef.current.getBoundingClientRect();
            addComponent(parsed.type, e.clientX - rect.left, e.clientY - rect.top, parsed.functionId, parsed.bitWidth);
        }
    } catch(err) { console.error("Drop failed", err); }
  };

  const getPortWidth = (comp: CircuitComponent, index: number, type: 'input'|'output'): number => {
      if (comp.type === ComponentType.SPLITTER) return type === 'input' ? comp.bitWidth : comp.bitWidth / 2;
      if (comp.type === ComponentType.MERGER) return type === 'output' ? comp.bitWidth : comp.bitWidth / 2; 
      return comp.bitWidth;
  };

  // --- P5.js Sketch ---
  useEffect(() => {
    if (!containerRef.current || !(window as any).p5) return;
    if (p5InstanceRef.current) p5InstanceRef.current.remove();

    const sketch = (p: p5Types) => {
      let pinchDistStart = 0;
      let lastTouchX = 0; let lastTouchY = 0; let isCanvasInteraction = false;
      let isRightMousePressed = false;

      p.setup = () => {
        p.createCanvas(containerRef.current!.clientWidth, containerRef.current!.clientHeight);
        p.frameRate(60);
        document.oncontextmenu = () => false; 
      };

      (p as any).windowResized = () => { if(containerRef.current) p.resizeCanvas(containerRef.current.clientWidth, containerRef.current.clientHeight); };

      p.draw = () => {
        p.background(COLOR_BG);
        if (isPlayingRef.current) {
          const speed = tickSpeedRef.current;
          if (speed <= 0) {
              for(let i=0; i<10; i++) {
                const result = stepSimulation(componentsRef.current, wiresRef.current, libraryRef.current);
                componentsRef.current = result.components; wiresRef.current = result.wires;
              }
              accumTimeRef.current = 0;
          } else {
              accumTimeRef.current += p.deltaTime;
              if (accumTimeRef.current > 500) accumTimeRef.current = 500; 
              while (accumTimeRef.current >= speed) {
                const result = stepSimulation(componentsRef.current, wiresRef.current, libraryRef.current);
                componentsRef.current = result.components; wiresRef.current = result.wires;
                accumTimeRef.current -= speed;
              }
          }
        } else accumTimeRef.current = 0;
        
        p.push();
        p.translate(viewportRef.current.x, viewportRef.current.y);
        p.scale(viewportRef.current.zoom);

        CircuitRenderer.drawGrid(p, viewportRef.current);
        wiresRef.current.forEach(w => CircuitRenderer.drawWire(p, w, componentsRef.current, libraryRef.current, wireStyleRef.current));

        if (wiringStart.current) {
             const mouseWorld = screenToWorld(p.mouseX, p.mouseY);
             CircuitRenderer.drawDraftWire(p, wiringStart.current, mouseWorld, componentsRef.current, libraryRef.current, wireStyleRef.current);
        }

        componentsRef.current.forEach(comp => {
          CircuitRenderer.drawComponent(p, comp, libraryRef.current, selectedCompIds.current.has(comp.id));
        });

        if (selectionBoxRef.current.active) {
            CircuitRenderer.drawSelectionRect(p, 
                selectionBoxRef.current.startX, 
                selectionBoxRef.current.startY, 
                selectionBoxRef.current.currentX - selectionBoxRef.current.startX, 
                selectionBoxRef.current.currentY - selectionBoxRef.current.startY
            );
        }

        if (!isDraggingComp.current && !selectionBoxRef.current.active) {
            const mouseWorld = screenToWorld(p.mouseX, p.mouseY);
            const hPort = getHoveredPort(mouseWorld.x, mouseWorld.y);
            if (hPort) {
                const comp = componentsRef.current.find(c => c.id === hPort.compId);
                if (comp) {
                    const pos = CircuitRenderer.getPortPosition(comp, hPort.portIndex, hPort.type, libraryRef.current);
                    let isValid = true;
                    if (wiringStart.current) {
                        if (wiringStart.current.compId === comp.id) isValid = false; 
                        else if (wiringStart.current.type === hPort.type) isValid = false; 
                        else if (wiringStart.current.bitWidth !== getPortWidth(comp, hPort.portIndex, hPort.type)) isValid = false;
                    }
                    p.noFill(); p.stroke(isValid ? '#3b82f6' : '#ef4444'); p.strokeWeight(2); p.circle(pos.x, pos.y, 14);
                }
            }
        }
        p.pop();
      };
      
      const getHoveredPort = (wx: number, wy: number) => {
        const HIT_RADIUS = 15; // Increased hit radius for easier touch interaction
        for (const comp of componentsRef.current) {
          const dims = CircuitRenderer.getComponentDimensions(comp, libraryRef.current);
          for (let i = 0; i < dims.inputs; i++) {
            const pos = CircuitRenderer.getPortPosition(comp, i, 'input', libraryRef.current);
            if (p.dist(wx, wy, pos.x, pos.y) < HIT_RADIUS) return { compId: comp.id, portIndex: i, type: 'input' as const };
          }
          for (let i = 0; i < dims.outputs; i++) {
            const pos = CircuitRenderer.getPortPosition(comp, i, 'output', libraryRef.current);
            if (p.dist(wx, wy, pos.x, pos.y) < HIT_RADIUS) return { compId: comp.id, portIndex: i, type: 'output' as const };
          }
        }
        return null;
      };

      const getHoveredComponent = (wx: number, wy: number) => {
        for (let i = componentsRef.current.length - 1; i >= 0; i--) {
          const comp = componentsRef.current[i];
          const dims = CircuitRenderer.getComponentDimensions(comp, libraryRef.current);
          if (wx > comp.x && wx < comp.x + (dims.w * GRID_SIZE) &&
              wy > comp.y && wy < comp.y + (dims.h * GRID_SIZE)) {
            return comp.id;
          }
        }
        return null;
      };

      // --- Interaction Logic ---

      const handleDragMove = (dx: number, dy: number, currentX: number, currentY: number, isTouch: boolean) => {
          if (Math.abs(dx) > 0 || Math.abs(dy) > 0) hasDraggedRef.current = true;
          
          const mouseWorld = screenToWorld(currentX, currentY);

          if (isPanningRef.current) {
              // Explicit Pan state (Space/RightClick)
              viewportRef.current.x += dx;
              viewportRef.current.y += dy;
          } else if (isDraggingComp.current && activeDragIds.current.size > 0) {
              // Moving Object
              componentsRef.current.forEach(c => {
                  if (activeDragIds.current.has(c.id)) {
                      c.x += dx / viewportRef.current.zoom;
                      c.y += dy / viewportRef.current.zoom;
                  }
              });
              dragStartPos.current = mouseWorld;
          } else if (selectionBoxRef.current.active) {
              // Updating Selection Box
              selectionBoxRef.current.currentX = mouseWorld.x;
              selectionBoxRef.current.currentY = mouseWorld.y;
          } else if (isTouch) {
              // Touch on Background
              // CRITICAL FIX: Do not pan if we are in the middle of drawing a wire
              if (!wiringStart.current) {
                  if (toolRef.current === 'REGION') {
                      // REGION Mode -> treated as box select start usually, but if here...
                  } else {
                      // CURSOR Mode -> Pan
                      viewportRef.current.x += dx;
                      viewportRef.current.y += dy;
                  }
              }
          }
      };

      p.mousePressed = (e: any) => {
        if (e && e.target !== (p as any).canvas) return;
        
        hasDraggedRef.current = false;
        
        isRightMousePressed = (p.mouseButton === p.RIGHT) || p.keyIsDown(p.CONTROL); 
        const mouseWorld = screenToWorld(p.mouseX, p.mouseY);

        // Pan with Right Click or Space (regardless of tool)
        if (isRightMousePressed || p.keyIsDown(32)) { 
             isPanningRef.current = true;
             return;
        }

        const port = getHoveredPort(mouseWorld.x, mouseWorld.y);
        if (port) {
            // Handle wiring ...
            const comp = componentsRef.current.find(c => c.id === port.compId);
            if (!comp) return;
            if (port.type === 'input') {
                const existingWireIndex = wiresRef.current.findIndex(w => w.toCompId === port.compId && w.toPortIndex === port.portIndex);
                if (existingWireIndex !== -1) {
                    const existingWire = wiresRef.current[existingWireIndex];
                    wiresRef.current.splice(existingWireIndex, 1);
                    wiringStart.current = { compId: existingWire.fromCompId, portIndex: existingWire.fromPortIndex, type: 'output', bitWidth: existingWire.bitWidth };
                    return;
                }
            }
            wiringStart.current = { ...port, bitWidth: getPortWidth(comp, port.portIndex, port.type) };
            return;
        }

        const compId = getHoveredComponent(mouseWorld.x, mouseWorld.y);
        if (compId) {
            if (toolRef.current === 'DELETE') {
                 selectedCompIds.current.clear();
                 selectedCompIds.current.add(compId);
                 handleDelete();
                 return;
            }

            if (p.keyIsDown(p.SHIFT)) {
                toggleSelection(compId);
            } else if (!selectedCompIds.current.has(compId)) {
                clearSelection();
                addToSelection(compId);
            }

            if (selectedCompIds.current.has(compId)) {
                 isDraggingComp.current = true;
                 dragStartPos.current = { x: mouseWorld.x, y: mouseWorld.y };
                 activeDragIds.current = new Set(selectedCompIds.current);
            }
            return;
        }

        // Background Click Logic
        if (!wiringStart.current) {
            if (toolRef.current === 'REGION') {
                // REGION mode: Always Box Select
                clearSelection();
                selectionBoxRef.current = {
                    startX: mouseWorld.x, startY: mouseWorld.y,
                    currentX: mouseWorld.x, currentY: mouseWorld.y,
                    active: true
                };
            } else if (toolRef.current === 'CURSOR') {
                 // CURSOR mode on Desktop (Mouse): Pan
                 if (p.touches.length === 0) {
                    clearSelection();
                    isPanningRef.current = true;
                 }
            }
        }
      };

      p.mouseDragged = () => {
        if (p.touches.length === 0) {
            handleDragMove(p.mouseX - p.pmouseX, p.mouseY - p.pmouseY, p.mouseX, p.mouseY, false);
        }
      };

      p.mouseReleased = () => {
        const mouseWorld = screenToWorld(p.mouseX, p.mouseY);
        
        // Snap to Grid
        if (isDraggingComp.current) {
            componentsRef.current.forEach(c => {
                if (activeDragIds.current.has(c.id)) {
                    c.x = Math.round(c.x / GRID_SIZE) * GRID_SIZE;
                    c.y = Math.round(c.y / GRID_SIZE) * GRID_SIZE;
                }
            });
        }
        
        // Click interaction
        if (!isPanningRef.current && !selectionBoxRef.current.active && !wiringStart.current) {
             const compId = getHoveredComponent(mouseWorld.x, mouseWorld.y);
             if (compId && !hasDraggedRef.current) {
                  const comp = componentsRef.current.find(c => c.id === compId);
                  if (comp && comp.type === ComponentType.INPUT_SWITCH && comp.bitWidth === 1) {
                        const val = comp.outputValues[0]?.[0] || false;
                        comp.outputValues[0] = new Array(comp.bitWidth).fill(!val);
                  }
             }
        }

        // Finalize Box Selection
        if (selectionBoxRef.current.active) {
            const bx = Math.min(selectionBoxRef.current.startX, selectionBoxRef.current.currentX);
            const by = Math.min(selectionBoxRef.current.startY, selectionBoxRef.current.currentY);
            const bw = Math.abs(selectionBoxRef.current.currentX - selectionBoxRef.current.startX);
            const bh = Math.abs(selectionBoxRef.current.currentY - selectionBoxRef.current.startY);

            if (bw > 2 || bh > 2) {
                componentsRef.current.forEach(c => {
                    const dims = CircuitRenderer.getComponentDimensions(c, libraryRef.current);
                    const cw = dims.w * GRID_SIZE;
                    const ch = dims.h * GRID_SIZE;
                    if (c.x < bx + bw && c.x + cw > bx && c.y < by + bh && c.y + ch > by) {
                        selectedCompIds.current.add(c.id);
                    }
                });
                if (selectedCompIds.current.size > 0 && onSelectionChange) {
                     const ids = Array.from(selectedCompIds.current);
                     const last = componentsRef.current.find(c => c.id === ids[ids.length-1]) || null;
                     onSelectionChange(last);
                }
            }
        }

        activeDragIds.current.clear();
        isDraggingComp.current = false;
        isPanningRef.current = false;
        selectionBoxRef.current.active = false;
        hasDraggedRef.current = false;

        if (wiringStart.current) {
          const endPort = getHoveredPort(mouseWorld.x, mouseWorld.y);
          if (endPort && endPort.compId !== wiringStart.current.compId) {
             const endComp = componentsRef.current.find(c => c.id === endPort.compId);
             const endWidth = endComp ? getPortWidth(endComp, endPort.portIndex, endPort.type) : 0;
             if (endWidth === wiringStart.current.bitWidth) {
                let src = wiringStart.current.type === 'output' ? wiringStart.current : endPort;
                let dst = wiringStart.current.type === 'input' ? wiringStart.current : endPort;
                if (src.type === 'output' && dst.type === 'input') {
                  const exists = wiresRef.current.some(w => w.toCompId === dst.compId && w.toPortIndex === dst.portIndex);
                  if (!exists) {
                    wiresRef.current.push({
                      id: crypto.randomUUID(), fromCompId: src.compId, fromPortIndex: src.portIndex, toCompId: dst.compId, toPortIndex: dst.portIndex,
                      state: new Array(wiringStart.current.bitWidth).fill(false), bitWidth: wiringStart.current.bitWidth
                    });
                  }
                }
             }
          }
          wiringStart.current = null;
        }
      };

      // --- Touch Support ---
      (p as any).touchStarted = (e: any) => { 
        if (e.target !== (p as any).canvas) { isCanvasInteraction = false; return true; } 
        isCanvasInteraction = true; 
        
        if (p.touches.length === 2) { 
             const t0 = p.touches[0] as any, t1 = p.touches[1] as any; 
             pinchDistStart = p.dist(t0.x, t0.y, t1.x, t1.y); 
        } else if (p.touches.length === 1) { 
             lastTouchX = (p.touches[0] as any).x; 
             lastTouchY = (p.touches[0] as any).y; 
             
             // Trigger Logic
             const mouseWorld = screenToWorld(lastTouchX, lastTouchY);
             const compId = getHoveredComponent(mouseWorld.x, mouseWorld.y);
             const port = getHoveredPort(mouseWorld.x, mouseWorld.y);
             
             // If touching Component or Port, treat as interaction (wire/move)
             if (compId || port) {
                 p.mousePressed(undefined);
             } else {
                 // Background Touch
                 if (toolRef.current === 'REGION') {
                     // REGION Mode -> Box Select
                     p.mousePressed(undefined); 
                 } else {
                     // CURSOR Mode -> Pan
                     clearSelection();
                     // Do not trigger mousePressed to avoid box select conflict
                 }
             }
        } 
        return false; 
      };

      (p as any).touchMoved = (e: any) => { 
        if (!isCanvasInteraction) return true; 
        
        if (p.touches.length === 2) { 
            // Zoom logic ...
             const t0 = p.touches[0] as any, t1 = p.touches[1] as any; 
            const currentDist = p.dist(t0.x, t0.y, t1.x, t1.y); 
            if (pinchDistStart > 0) { 
                const scaleFactor = currentDist / pinchDistStart; 
                const newZoom = Math.min(Math.max(viewportRef.current.zoom * scaleFactor, 0.1), 5.0); 
                const cx = (t0.x + t1.x) / 2, cy = (t0.y + t1.y) / 2; 
                const wx = (cx - viewportRef.current.x) / viewportRef.current.zoom; 
                const wy = (cy - viewportRef.current.y) / viewportRef.current.zoom; 
                viewportRef.current.zoom = newZoom; 
                viewportRef.current.x = cx - wx * newZoom; 
                viewportRef.current.y = cy - wy * newZoom; 
                pinchDistStart = currentDist; 
            } 
        } else if (p.touches.length === 1) { 
            const tx = (p.touches[0] as any).x;
            const ty = (p.touches[0] as any).y;
            const dx = tx - lastTouchX;
            const dy = ty - lastTouchY;
            
            handleDragMove(dx, dy, tx, ty, true);
            
            lastTouchX = tx; 
            lastTouchY = ty; 
        } 
        return false; 
      };

      (p as any).touchEnded = () => { if (!isCanvasInteraction) return true; if (p.touches.length === 0) p.mouseReleased(); return false; };
      
      (p as any).mouseWheel = (e: any) => { 
        if (e.target !== (p as any).canvas) return true;
        const zoomFactor = Math.exp(-e.delta * 0.001); 
        const newZoom = Math.min(Math.max(viewportRef.current.zoom * zoomFactor, 0.1), 5.0); 
        const wx = (p.mouseX - viewportRef.current.x) / viewportRef.current.zoom; 
        const wy = (p.mouseY - viewportRef.current.y) / viewportRef.current.zoom; 
        viewportRef.current.zoom = newZoom; 
        viewportRef.current.x = p.mouseX - wx * newZoom; 
        viewportRef.current.y = p.mouseY - wy * newZoom; 
        return false; 
      };
    };

    p5InstanceRef.current = new (window as any).p5(sketch, containerRef.current);
    return () => { p5InstanceRef.current?.remove(); };
  }, []); 

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full cursor-crosshair touch-none select-none pointer-events-auto" 
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={handleDrop}
      tabIndex={0} 
    />
  );
});

export default LogicCanvas;
