
import p5Types from 'p5';
import { CircuitComponent, Wire, ComponentType, FunctionCircuit, PortSide } from '../types';
import { COMPONENT_DEFINITIONS, GRID_SIZE, COLOR_GRID, COLOR_WIRE_ON, COLOR_WIRE_OFF, COLOR_BUS_ON, COLOR_BUS_OFF, COLOR_COMPONENT_BG, COLOR_COMPONENT_STROKE } from '../constants';

type PortPoint = { x: number, y: number, side: 'top' | 'bottom' | 'left' | 'right' };

// Helper: Convert boolean array to Hex String using BigInt to support > 31 bits
export const bitsToHex = (bits: boolean[]): string => {
  if (!bits || bits.length === 0) return "0";
  let val = 0n;
  for (let i = 0; i < bits.length; i++) {
      if (bits[i]) val |= (1n << BigInt(i));
  }
  return val.toString(16).toUpperCase();
};

export class CircuitRenderer {
  
  static getSide(c: CircuitComponent, isInput: boolean): PortSide {
    return c.icPortSide || (isInput ? 'left' : 'right');
  }

  // --- Sorting Logic for Pins (Must match CircuitEngine) ---
  static sortICPorts(components: CircuitComponent[], isInput: boolean) {
      const sideOrder: Record<PortSide, number> = { top: 0, right: 1, bottom: 2, left: 3 };
      
      return [...components].sort((a, b) => {
          const sideA = CircuitRenderer.getSide(a, isInput);
          const sideB = CircuitRenderer.getSide(b, isInput);
          
          if (sideOrder[sideA] !== sideOrder[sideB]) {
              return sideOrder[sideA] - sideOrder[sideB];
          }
          if (sideA === 'top' || sideA === 'bottom') return a.x - b.x;
          return a.y - b.y;
      });
  }

  static getComponentDimensions(comp: CircuitComponent, library: FunctionCircuit[] = []) {
    const def = COMPONENT_DEFINITIONS[comp.type];
    
    if (comp.type === ComponentType.CUSTOM_IC && comp.functionId) {
       const funcDef = library.find(f => f.id === comp.functionId);
       if (funcDef) {
          const inputs = funcDef.components.filter(c => c.type === ComponentType.INPUT_SWITCH);
          const outputs = funcDef.components.filter(c => c.type === ComponentType.OUTPUT_LED);
          
          const countSide = (list: CircuitComponent[], side: PortSide, isInput: boolean) => 
              list.filter(c => CircuitRenderer.getSide(c, isInput) === side).length;

          const topCount = countSide(inputs, 'top', true) + countSide(outputs, 'top', false);
          const bottomCount = countSide(inputs, 'bottom', true) + countSide(outputs, 'bottom', false);
          const leftCount = countSide(inputs, 'left', true) + countSide(outputs, 'left', false);
          const rightCount = countSide(inputs, 'right', true) + countSide(outputs, 'right', false);

          const width = Math.max(1, topCount, bottomCount);
          const height = Math.max(1, leftCount, rightCount);
          
          return { w: width, h: height, inputs: inputs.length, outputs: outputs.length };
       }
       return { w: 1, h: 1, inputs: 0, outputs: 0 };
    }
    return { w: def.width, h: def.height, inputs: def.inputs, outputs: def.outputs };
  }

  static getPortPosition(comp: CircuitComponent, index: number, type: 'input' | 'output', library: FunctionCircuit[] = []): PortPoint {
    const dims = CircuitRenderer.getComponentDimensions(comp, library);
    const w = dims.w * GRID_SIZE;
    const h = dims.h * GRID_SIZE;
    
    if (comp.type === ComponentType.INPUT_SWITCH && type === 'output') {
        const side = comp.icPortSide || 'right'; 
        if (side === 'right') return { x: comp.x + w, y: comp.y + (h/2), side: 'right' };
        if (side === 'left') return { x: comp.x, y: comp.y + (h/2), side: 'left' };
        if (side === 'top') return { x: comp.x + (w/2), y: comp.y, side: 'top' };
        if (side === 'bottom') return { x: comp.x + (w/2), y: comp.y + h, side: 'bottom' };
    }
    if (comp.type === ComponentType.OUTPUT_LED && type === 'input') {
        const side = comp.icPortSide || 'left';
        if (side === 'right') return { x: comp.x + w, y: comp.y + (h/2), side: 'right' };
        if (side === 'left') return { x: comp.x, y: comp.y + (h/2), side: 'left' };
        if (side === 'top') return { x: comp.x + (w/2), y: comp.y, side: 'top' };
        if (side === 'bottom') return { x: comp.x + (w/2), y: comp.y + h, side: 'bottom' };
    }

    if (comp.type === ComponentType.CUSTOM_IC && comp.functionId) {
         const funcDef = library.find(f => f.id === comp.functionId);
         if (funcDef) {
             const isInput = type === 'input';
             const unsorted = isInput 
                ? funcDef.components.filter(c => c.type === ComponentType.INPUT_SWITCH)
                : funcDef.components.filter(c => c.type === ComponentType.OUTPUT_LED);
             
             const sorted = CircuitRenderer.sortICPorts(unsorted, isInput);
             const targetComp = sorted[index];

             if (targetComp) {
                 const side = CircuitRenderer.getSide(targetComp, isInput);
                 
                 const inputsOnSide = funcDef.components.filter(c => c.type === ComponentType.INPUT_SWITCH && CircuitRenderer.getSide(c, true) === side);
                 const outputsOnSide = funcDef.components.filter(c => c.type === ComponentType.OUTPUT_LED && CircuitRenderer.getSide(c, false) === side);
                 
                 const allOnSide = [...inputsOnSide, ...outputsOnSide];
                 allOnSide.sort((a, b) => {
                    if (side === 'top' || side === 'bottom') return a.x - b.x;
                    return a.y - b.y;
                 });

                 const localIndex = allOnSide.indexOf(targetComp);
                 const count = allOnSide.length;
                 const stepX = w / (count + 1);
                 const stepY = h / (count + 1);
                 
                 if (side === 'top') return { x: comp.x + ((localIndex + 1) * stepX), y: comp.y, side: 'top' };
                 if (side === 'bottom') return { x: comp.x + ((localIndex + 1) * stepX), y: comp.y + h, side: 'bottom' };
                 if (side === 'left') return { x: comp.x, y: comp.y + ((localIndex + 1) * stepY), side: 'left' };
                 if (side === 'right') return { x: comp.x + w, y: comp.y + ((localIndex + 1) * stepY), side: 'right' };
             }
         }
    }

    if (comp.type === ComponentType.SPLITTER) {
        if (type === 'input') return { x: comp.x, y: comp.y + h/2, side: 'left' };
        const step = h / 3;
        return { x: comp.x + w, y: comp.y + ((index+1)*step), side: 'right' };
    }
    if (comp.type === ComponentType.MERGER) {
        if (type === 'output') return { x: comp.x + w, y: comp.y + h/2, side: 'right' };
        const step = h / 3;
        return { x: comp.x, y: comp.y + ((index+1)*step), side: 'left' };
    }

    const count = type === 'input' ? dims.inputs : dims.outputs;
    const yStep = h / (count + 1);
    return {
      x: type === 'input' ? comp.x : comp.x + w,
      y: comp.y + ((index + 1) * yStep),
      side: type === 'input' ? 'left' : 'right'
    };
  }

  // --- Helpers ---

  static getWireColor(width: number, hasSignal: boolean) {
      if (width === 1) return hasSignal ? COLOR_WIRE_ON : COLOR_WIRE_OFF;
      return hasSignal ? COLOR_BUS_ON : COLOR_BUS_OFF;
  }

  static getWireWeight(width: number) {
      if (width === 1) return 2;
      return Math.min(14, 2.5 + Math.ceil(Math.log2(width) * 1.1));
  }

  static isSignalActive(state: boolean[]): boolean {
      if (!state) return false;
      return state.some(b => b === true);
  }

  // --- Drawing ---

  static drawGrid(p: p5Types, viewport: { x: number, y: number, zoom: number }) {
    const visibleL = -viewport.x / viewport.zoom;
    const visibleT = -viewport.y / viewport.zoom;
    const visibleR = (p.width - viewport.x) / viewport.zoom;
    const visibleB = (p.height - viewport.y) / viewport.zoom;

    const startX = Math.floor(visibleL / GRID_SIZE) * GRID_SIZE;
    const endX = Math.ceil(visibleR / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor(visibleT / GRID_SIZE) * GRID_SIZE;
    const endY = Math.ceil(visibleB / GRID_SIZE) * GRID_SIZE;

    p.stroke(COLOR_GRID);
    p.strokeWeight(1 / viewport.zoom); 

    for (let x = startX; x <= endX; x += GRID_SIZE) p.line(x, visibleT, x, visibleB);
    for (let y = startY; y <= endY; y += GRID_SIZE) p.line(visibleL, y, visibleR, y);
  }

  static drawWire(p: p5Types, wire: Wire, components: CircuitComponent[], library: FunctionCircuit[], style: 'bezier' | 'orthogonal' = 'bezier') {
      const fromComp = components.find(c => c.id === wire.fromCompId);
      const toComp = components.find(c => c.id === wire.toCompId);
      if (fromComp && toComp) {
        const start = CircuitRenderer.getPortPosition(fromComp, wire.fromPortIndex, 'output', library);
        const end = CircuitRenderer.getPortPosition(toComp, wire.toPortIndex, 'input', library);
        
        const active = CircuitRenderer.isSignalActive(wire.state);
        const weight = CircuitRenderer.getWireWeight(wire.bitWidth);
        
        p.stroke(CircuitRenderer.getWireColor(wire.bitWidth, active));
        p.strokeWeight(weight);
        p.noFill();

        let midX = 0, midY = 0;

        if (style === 'orthogonal') {
            CircuitRenderer.drawOrthogonalWire(p, start, end);
            midX = (start.x + end.x) / 2;
            midY = start.y; // Simplified
            if ((start.side === 'top' || start.side === 'bottom') && (end.side === 'top' || end.side === 'bottom')) {
                midY = (start.y + end.y) / 2;
                midX = start.x;
            } else if (start.side === 'left' || start.side === 'right') {
                midY = start.y;
            }
        } else {
            const cpOffset = GRID_SIZE * 0.5;
            const cp1 = CircuitRenderer.getWireControlPoint(start, cpOffset);
            const cp2 = CircuitRenderer.getWireControlPoint(end, cpOffset);
            p.bezier(start.x, start.y, cp1.x, cp1.y, cp2.x, cp2.y, end.x, end.y);
            
            midX = p.bezierPoint(start.x, cp1.x, cp2.x, end.x, 0.5);
            midY = p.bezierPoint(start.y, cp1.y, cp2.y, end.y, 0.5);
        }
        
        if (wire.bitWidth > 1) {
             const circleSize = Math.max(12, weight + 4);
             p.noStroke();
             p.fill(COLOR_COMPONENT_BG);
             p.circle(midX, midY, circleSize);
             
             p.fill(COLOR_COMPONENT_STROKE);
             p.textAlign(p.CENTER, p.CENTER);
             p.textSize(8);
             p.textStyle(p.BOLD);
             p.text(wire.bitWidth, midX, midY);
             p.textStyle(p.NORMAL);
        }
      }
  }

  static drawOrthogonalWire(p: p5Types, start: PortPoint, end: PortPoint) {
      // Determine mid-point X
      let midX = (start.x + end.x) / 2;
      
      p.noFill();
      p.beginShape();
      p.vertex(start.x, start.y);
      
      const startVert = start.side === 'top' || start.side === 'bottom';
      const endVert = end.side === 'top' || end.side === 'bottom';
      
      if (startVert && endVert) {
          // Y-X-Y
          const midY = (start.y + end.y) / 2;
          p.vertex(start.x, midY);
          p.vertex(end.x, midY);
      } else if (startVert) {
          // Y-X
          p.vertex(start.x, end.y);
      } else if (endVert) {
          // X-Y
          p.vertex(end.x, start.y);
      } else {
          // Standard Horizontal Ports (Left/Right) -> X-Y-X
          p.vertex(midX, start.y);
          p.vertex(midX, end.y);
      }
      p.vertex(end.x, end.y);
      p.endShape();
  }

  static drawDraftWire(p: p5Types, startInfo: { compId: string, portIndex: number, type: 'input'|'output', bitWidth: number }, mouseWorld: {x:number, y:number}, components: CircuitComponent[], library: FunctionCircuit[], style: 'bezier' | 'orthogonal' = 'bezier') {
      const comp = components.find(c => c.id === startInfo.compId);
      if (comp) {
        const start = CircuitRenderer.getPortPosition(comp, startInfo.portIndex, startInfo.type, library);
        p.stroke(COLOR_WIRE_OFF);
        p.strokeWeight(CircuitRenderer.getWireWeight(startInfo.bitWidth));
        p.noFill();

        if (style === 'orthogonal') {
             // Fake an 'end' point that mimics a port on the opposite side
             const targetSide = start.side === 'left' ? 'right' : (start.side === 'right' ? 'left' : (start.side === 'top' ? 'bottom' : 'top'));
             CircuitRenderer.drawOrthogonalWire(p, start, { x: mouseWorld.x, y: mouseWorld.y, side: targetSide });
        } else {
            const cpOffset = GRID_SIZE * 0.5;
            const cp1 = CircuitRenderer.getWireControlPoint(start, cpOffset);
            let cp2 = { x: mouseWorld.x, y: mouseWorld.y };
            if (startInfo.type === 'output') cp2 = { x: mouseWorld.x - cpOffset, y: mouseWorld.y };
            else cp2 = { x: mouseWorld.x + cpOffset, y: mouseWorld.y };
            
            p.bezier(start.x, start.y, cp1.x, cp1.y, cp2.x, cp2.y, mouseWorld.x, mouseWorld.y);
        }
      }
  }

  static getWireControlPoint(pt: PortPoint, offset: number) {
    if (pt.side === 'top') return { x: pt.x, y: pt.y - offset };
    if (pt.side === 'bottom') return { x: pt.x, y: pt.y + offset };
    if (pt.side === 'left') return { x: pt.x - offset, y: pt.y };
    return { x: pt.x + offset, y: pt.y };
  }

  static drawComponent(p: p5Types, comp: CircuitComponent, library: FunctionCircuit[], isSelected: boolean) {
    const dims = CircuitRenderer.getComponentDimensions(comp, library);
    const w = dims.w * GRID_SIZE;
    const h = dims.h * GRID_SIZE;
    const inputs = dims.inputs;
    const outputs = dims.outputs;

    p.push();
    p.translate(comp.x, comp.y);

    if (comp.type === ComponentType.CUSTOM_IC) {
        CircuitRenderer.drawIC(p, comp, w, h, library);
    } else if (comp.type === ComponentType.SPLITTER) {
        CircuitRenderer.drawSplitter(p, comp, w, h);
    } else if (comp.type === ComponentType.MERGER) {
        CircuitRenderer.drawMerger(p, comp, w, h);
    } else if (comp.type === ComponentType.INPUT_SWITCH) {
        CircuitRenderer.drawSwitch(p, comp, w, h);
    } else if (comp.type === ComponentType.OUTPUT_LED) {
        CircuitRenderer.drawLED(p, comp, w, h);
    } else if (comp.type === ComponentType.HEX_DISPLAY) {
        CircuitRenderer.drawHex(p, comp, w, h);
    } else {
        CircuitRenderer.drawGate(p, comp, w, h);
    }

    if (comp.type !== ComponentType.CUSTOM_IC) {
        CircuitRenderer.drawLabels(p, comp, w, h);
    }

    if (!['IC','INPUT','OUTPUT','HEX','SPLIT','MERGE'].includes(comp.type)) {
        p.noStroke(); p.fill('#64748b');
        for (let i = 0; i < inputs; i++) p.circle(0, ((i+1) * (h/(inputs+1))), 4);
        for (let i = 0; i < outputs; i++) p.circle(w, ((i+1) * (h/(outputs+1))), 4);
    }

    if (isSelected) {
        p.noFill(); p.stroke('#3b82f6'); p.strokeWeight(2);
        p.rect(-4, -4, w + 12, h + 8, 4);
        
        p.noStroke(); p.fill('#3b82f6');
        p.textSize(10); p.textAlign(p.RIGHT, p.TOP);
        p.text(`w:${comp.bitWidth}`, w + 8, h + 6);
    } else if (comp.bitWidth > 1) {
        p.noStroke(); p.fill('#64748b'); 
        p.textSize(8); 
        p.textAlign(p.RIGHT, p.BOTTOM);
        p.text(comp.bitWidth, w - 2, h - 1);
    }

    p.pop();
  }

  static drawSelectionRect(p: p5Types, x: number, y: number, w: number, h: number) {
      // Normalize dimensions
      let rx = x;
      let ry = y;
      let rw = w;
      let rh = h;

      if (rw < 0) { rx += rw; rw = Math.abs(rw); }
      if (rh < 0) { ry += rh; rh = Math.abs(rh); }

      p.noStroke();
      p.fill(59, 130, 246, 30); // Blue-500 with low opacity
      p.rect(rx, ry, rw, rh);
      p.noFill();
      p.stroke(59, 130, 246, 150);
      p.strokeWeight(1);
      p.rect(rx, ry, rw, rh);
  }

  // --- Helper: Draw Fitted Text with Ellipsis ---
  private static drawFittedText(p: p5Types, text: string, x: number, y: number, maxW: number, maxH: number) {
      let fontSize = 12; 
      const minFontSize = 8;
      p.textSize(fontSize);
      p.textAlign(p.CENTER, p.CENTER);
      
      let currentText = text;
      let w = p.textWidth(currentText);
      
      if (w <= maxW) {
          p.text(currentText, x, y);
          return;
      }

      while (fontSize > minFontSize && w > maxW) {
          fontSize--;
          p.textSize(fontSize);
          w = p.textWidth(currentText);
      }

      if (w > maxW) {
          while (currentText.length > 0 && p.textWidth(currentText + '..') > maxW) {
              currentText = currentText.slice(0, -1);
          }
          currentText += '..';
      }
      
      p.text(currentText, x, y);
  }

  // --- Sub-Renderers ---

  private static drawSplitter(p: p5Types, comp: CircuitComponent, w: number, h: number) {
      p.fill(COLOR_COMPONENT_BG); p.stroke(COLOR_COMPONENT_STROKE); p.strokeWeight(2);
      p.beginShape();
      p.vertex(0, h * 0.3);
      p.vertex(w, 0);
      p.vertex(w, h);
      p.vertex(0, h * 0.7);
      p.endShape(p.CLOSE);
      
      p.fill('#64748b'); p.noStroke();
      p.circle(0, h/2, 5); 
      const step = h/3;
      p.circle(w, step, 4); 
      p.circle(w, step*2, 4); 
      
      p.fill('#0f172a'); p.textSize(10); p.textAlign(p.CENTER, p.CENTER);
      p.text("/", w/2, h/2);
  }

  private static drawMerger(p: p5Types, comp: CircuitComponent, w: number, h: number) {
      p.fill(COLOR_COMPONENT_BG); p.stroke(COLOR_COMPONENT_STROKE); p.strokeWeight(2);
      p.beginShape();
      p.vertex(0, 0);
      p.vertex(w, h * 0.3);
      p.vertex(w, h * 0.7);
      p.vertex(0, h);
      p.endShape(p.CLOSE);

      p.fill('#64748b'); p.noStroke();
      const step = h/3;
      p.circle(0, step, 4); 
      p.circle(0, step*2, 4);
      p.circle(w, h/2, 5);
      
      p.fill('#0f172a'); p.textSize(10); p.textAlign(p.CENTER, p.CENTER);
      p.text("&", w/2, h/2);
  }

  private static drawIC(p: p5Types, comp: CircuitComponent, w: number, h: number, library: FunctionCircuit[]) {
    p.fill('#eff6ff'); 
    p.stroke('#3b82f6'); 
    p.strokeWeight(2);
    p.rect(0, 0, w, h, 6);

    p.fill('#1e3a8a'); 
    p.noStroke(); 
    p.textStyle(p.BOLD);
    
    const label = comp.customLabel || "IC";
    CircuitRenderer.drawFittedText(p, label, w/2, h/2, w - 4, h - 4);

    if (comp.functionId) {
        const funcDef = library.find(f => f.id === comp.functionId);
        if (funcDef) {
            const inputs = CircuitRenderer.sortICPorts(funcDef.components.filter(c => c.type === ComponentType.INPUT_SWITCH), true);
            const outputs = CircuitRenderer.sortICPorts(funcDef.components.filter(c => c.type === ComponentType.OUTPUT_LED), false);

            const drawPort = (c: CircuitComponent, index: number, isInput: boolean) => {
                const pt = CircuitRenderer.getPortPosition(comp, index, isInput ? 'input' : 'output', library);
                const rx = pt.x - comp.x;
                const ry = pt.y - comp.y;
                
                p.fill(isInput ? '#3b82f6' : '#f59e0b');
                p.stroke('#1e293b'); p.strokeWeight(1);
                p.circle(rx, ry, 6);

                if (c.customLabel) {
                    p.noStroke();
                    p.fill('#334155');
                    p.textSize(8);
                    p.textStyle(p.NORMAL);
                    
                    if (pt.side === 'left') {
                        p.textAlign(p.LEFT, p.CENTER);
                        p.text(c.customLabel, rx + 6, ry);
                    } else if (pt.side === 'right') {
                        p.textAlign(p.RIGHT, p.CENTER);
                        p.text(c.customLabel, rx - 6, ry);
                    } else if (pt.side === 'top') {
                         p.textAlign(p.CENTER, p.TOP);
                         p.text(c.customLabel, rx, ry + 6);
                    } else { 
                         p.textAlign(p.CENTER, p.BOTTOM);
                         p.text(c.customLabel, rx, ry - 6);
                    }
                }
            };

            inputs.forEach((c, i) => drawPort(c, i, true));
            outputs.forEach((c, i) => drawPort(c, i, false));
        }
    }
  }

  private static drawSwitch(p: p5Types, comp: CircuitComponent, w: number, h: number) {
      const isOn = CircuitRenderer.isSignalActive(comp.outputValues[0]);
      const side = comp.icPortSide || 'right';
      const boxSize = GRID_SIZE * 0.6;
      const boxOffset = (GRID_SIZE - boxSize) / 2;

      let portX = w, portY = h/2;
      if (side === 'left') { portX = 0; }
      else if (side === 'top') { portX = w/2; portY = 0; }
      else if (side === 'bottom') { portX = w/2; portY = h; }

      p.stroke(isOn ? COLOR_BUS_ON : COLOR_COMPONENT_STROKE);
      p.strokeWeight(2);
      p.line(w/2, h/2, portX, portY);
      p.fill('#64748b'); p.noStroke(); p.circle(portX, portY, 6);

      p.stroke(isOn ? COLOR_BUS_ON : COLOR_COMPONENT_STROKE);
      p.fill(isOn ? COLOR_BUS_ON : COLOR_COMPONENT_BG);
      p.rect(boxOffset, boxOffset, boxSize, boxSize, 4);

      p.noStroke(); p.fill(isOn ? '#fff' : '#475569');
      
      if (comp.bitWidth >= 16) {
          p.textSize(9); p.textAlign(p.CENTER, p.CENTER);
          p.text(`${comp.bitWidth}b`, w/2, h/2);
      } else if (comp.bitWidth > 1) {
          const hex = "0x" + bitsToHex(comp.outputValues[0] || []);
          CircuitRenderer.drawFittedText(p, hex, w/2, h/2, boxSize - 2, boxSize - 2);
      } else {
          p.textSize(10); p.textAlign(p.CENTER, p.CENTER);
          p.text(isOn ? "1" : "0", w/2, h/2);
      }
  }

  private static drawLED(p: p5Types, comp: CircuitComponent, w: number, h: number) {
      const isOn = CircuitRenderer.isSignalActive(comp.inputValues[0]);
      const side = comp.icPortSide || 'left';
      const boxSize = GRID_SIZE * 0.6;
      const boxOffset = (GRID_SIZE - boxSize) / 2;
      
      let portX = 0, portY = h/2;
      if (side === 'right') { portX = w; }
      else if (side === 'top') { portX = w/2; portY = 0; }
      else if (side === 'bottom') { portX = w/2; portY = h; }

      p.stroke(COLOR_COMPONENT_STROKE); p.strokeWeight(2);
      p.line(w/2, h/2, portX, portY);
      p.fill('#64748b'); p.noStroke(); p.circle(portX, portY, 6);

      if (isOn) { p.noStroke(); p.fill(245, 158, 11, 80); p.rect(boxOffset-3, boxOffset-3, boxSize+6, boxSize+6, 6); }
      p.stroke(isOn ? COLOR_BUS_ON : '#334155');
      p.fill(isOn ? COLOR_BUS_ON : '#1e293b');
      p.rect(boxOffset, boxOffset, boxSize, boxSize, 4);

      p.noStroke(); p.fill(isOn ? '#fff' : '#475569');
      if (comp.bitWidth >= 16) {
           p.textSize(9); p.textAlign(p.CENTER, p.CENTER);
           p.text(`${comp.bitWidth}b`, w/2, h/2);
      } else if (comp.bitWidth > 1) {
           const hex = "0x" + bitsToHex(comp.inputValues[0] || []);
           CircuitRenderer.drawFittedText(p, hex, w/2, h/2, boxSize - 2, boxSize - 2);
      }
  }

  private static drawHex(p: p5Types, comp: CircuitComponent, w: number, h: number) {
      const padX = 4;
      p.fill('#0f172a'); p.stroke('#334155'); p.rect(padX, 4, w - (padX*2), h-8, 4);
      p.noStroke(); p.fill('#ef4444'); 
      
      const hex = bitsToHex(comp.inputValues[0] || []);
      
      CircuitRenderer.drawFittedText(p, hex, w/2, h/2, w - (padX*2) - 4, h - 12);
      
      p.fill('#64748b'); p.circle(0, h/2, 5);
  }

  private static drawGate(p: p5Types, comp: CircuitComponent, w: number, h: number) {
    const py = 6;
    const gateW = w - 4;
    const isNegated = ['NAND', 'NOR', 'NOT'].includes(comp.type);
    const bubbleR = 4;
    let bodyW = (isNegated || comp.type === 'BUFFER') ? gateW - (bubbleR*2) : gateW;

    p.stroke(COLOR_COMPONENT_STROKE); p.strokeWeight(2);
    p.line(isNegated ? gateW : bodyW, h/2, w, h/2); 

    if (comp.type === 'NOT' || comp.type === 'BUFFER') {
        p.fill(COLOR_COMPONENT_BG);
        (p as any).triangle(0, py, 0, h - py, bodyW, h / 2);
    } else {
        const isXor = comp.type === 'XOR';
        const isOrFamily = ['OR', 'NOR', 'XOR'].includes(comp.type);
        let startX = 0;

        if (isXor) {
            startX = 5;
            p.noFill();
            p.beginShape(); p.vertex(0, py); (p as any).bezierVertex(3, h * 0.33, 3, h * 0.66, 0, h - py); p.endShape();
        }

        p.fill(COLOR_COMPONENT_BG);
        p.beginShape();
        if (isOrFamily) {
            p.vertex(startX, py); p.vertex(bodyW * 0.5, py);
            (p as any).bezierVertex(bodyW, py, bodyW, h - py, bodyW * 0.5, h - py);
            p.vertex(startX, h - py);
            (p as any).bezierVertex(startX + 5, h * 0.75, startX + 5, h * 0.25, startX, py);
        } else {
            p.vertex(0, py); p.vertex(bodyW * 0.5, py);
            (p as any).bezierVertex(bodyW, py, bodyW, h - py, bodyW * 0.5, h - py);
            p.vertex(0, h - py); p.vertex(0, py);
        }
        p.endShape(p.CLOSE);
    }

    if (isNegated) {
        p.fill(COLOR_COMPONENT_BG); p.circle(gateW - bubbleR, h / 2, bubbleR*2);
    }
  }

  private static drawLabels(p: p5Types, comp: CircuitComponent, w: number, h: number) {
      if (comp.customLabel && comp.type !== ComponentType.CUSTOM_IC) {
        p.noStroke(); p.fill('#1e293b'); p.textSize(12); p.textStyle(p.BOLD);
        p.textAlign(p.CENTER, p.BOTTOM); p.text(comp.customLabel, w/2, -2);
        p.textStyle(p.NORMAL);
      }
  }
}
