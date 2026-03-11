
import { CircuitComponent, Wire, ComponentType, FunctionCircuit, PortSide } from '../types';
import * as GateLogic from './gateLogic';

/**
 * Logic Engine - Supports Multi-bit Bus Processing
 * Refactored for SOLID principles: Logic calculations delegated to GateLogic.
 */

// Helper: Ensure input array exists and has correct width
const safeInput = (inputs: boolean[][], idx: number, width: number): boolean[] => {
    if (!inputs[idx]) return new Array(width).fill(false);
    if (inputs[idx].length === width) return inputs[idx];
    
    // Resize/Pad if mismatch
    const current = inputs[idx];
    if (current.length < width) {
        return [...current, ...new Array(width - current.length).fill(false)];
    }
    return current.slice(0, width);
};

const evaluateComponent = (comp: CircuitComponent, inputs: boolean[][], currentOutputs: boolean[][]): boolean[][] => {
  const width = comp.bitWidth;

  switch (comp.type) {
    case ComponentType.INPUT_SWITCH:
      // State is maintained in outputValues[0] by the UI/Interaction layer.
      // We just ensure robustness here.
      if (!currentOutputs[0] || currentOutputs[0].length !== width) {
           // Preserve existing values if resizing, or default to false
           const old = currentOutputs[0] || [];
           const newArr = new Array(width).fill(false);
           for(let i=0; i<Math.min(old.length, width); i++) newArr[i] = old[i];
           return [newArr];
      }
      return currentOutputs;

    case ComponentType.OUTPUT_LED:
    case ComponentType.HEX_DISPLAY:
      return []; // Passive components have no logical output to propagate

    case ComponentType.BUFFER:
       return [safeInput(inputs, 0, width)];

    case ComponentType.NOT:
      return [GateLogic.gateNot(safeInput(inputs, 0, width))];

    case ComponentType.AND:
      return [GateLogic.gateAnd(safeInput(inputs, 0, width), safeInput(inputs, 1, width))];

    case ComponentType.OR:
      return [GateLogic.gateOr(safeInput(inputs, 0, width), safeInput(inputs, 1, width))];

    case ComponentType.NAND:
      return [GateLogic.gateNand(safeInput(inputs, 0, width), safeInput(inputs, 1, width))];

    case ComponentType.NOR:
      return [GateLogic.gateNor(safeInput(inputs, 0, width), safeInput(inputs, 1, width))];

    case ComponentType.XOR:
      return [GateLogic.gateXor(safeInput(inputs, 0, width), safeInput(inputs, 1, width))];

    case ComponentType.SPLITTER: {
        if (width < 2) return [safeInput(inputs, 0, width), safeInput(inputs, 0, width)];
        const [low, high] = GateLogic.splitBus(safeInput(inputs, 0, width), width);
        return [low, high];
    }

    case ComponentType.MERGER: {
        if (width < 2) return [safeInput(inputs, 0, width)]; 
        const half = Math.floor(width / 2);
        const merged = GateLogic.mergeBus(
            safeInput(inputs, 0, half), 
            safeInput(inputs, 1, half), 
            width
        );
        return [merged];
    }

    default:
      return currentOutputs;
  }
};

// Helper: Port Ordering for ICs
const getSide = (c: CircuitComponent, isInput: boolean): PortSide => {
    return c.icPortSide || (isInput ? 'left' : 'right');
};

const sideOrder: Record<PortSide, number> = { top: 0, right: 1, bottom: 2, left: 3 };

const sortComponents = (components: CircuitComponent[], isInput: boolean) => {
    return [...components].sort((a, b) => {
        const sideA = getSide(a, isInput);
        const sideB = getSide(b, isInput);
        
        if (sideOrder[sideA] !== sideOrder[sideB]) {
            return sideOrder[sideA] - sideOrder[sideB];
        }
        if (sideA === 'top' || sideA === 'bottom') return a.x - b.x;
        return a.y - b.y;
    });
};

export const stepSimulation = (
  currentComponents: CircuitComponent[],
  wires: Wire[],
  functionLibrary: FunctionCircuit[] = []
): { components: CircuitComponent[], wires: Wire[] } => {
  
  // 1. Double Buffering: Clone state to avoid mutation during read
  const nextComponents = currentComponents.map(c => ({
    ...c,
    inputValues: c.inputValues.map(arr => [...arr]),
    outputValues: c.outputValues.map(arr => [...arr]),
    internalState: c.internalState ? {
        components: [...c.internalState.components],
        wires: [...c.internalState.wires]
    } : undefined
  }));

  const prevCompMap = new Map(currentComponents.map(c => [c.id, c]));
  const nextCompMap = new Map(nextComponents.map(c => [c.id, c]));

  // 2. Clear Inputs for the next tick
  for (const comp of nextComponents) {
     comp.inputValues = []; 
  }

  // 3. Propagate Wires (Data Transfer)
  for (const wire of wires) {
    const sourceComp = prevCompMap.get(wire.fromCompId);
    const destComp = nextCompMap.get(wire.toCompId);

    if (sourceComp && destComp) {
      // Robustness: Handle missing outputs gracefully
      const sourceBus = sourceComp.outputValues[wire.fromPortIndex] || new Array(wire.bitWidth).fill(false);
      
      if (!destComp.inputValues[wire.toPortIndex]) {
          destComp.inputValues[wire.toPortIndex] = [...sourceBus];
      } else {
          // Bus contention logic: Bitwise OR
          const existing = destComp.inputValues[wire.toPortIndex];
          const combinedLen = Math.max(existing.length, sourceBus.length);
          const combined = new Array(combinedLen);
          for(let i=0; i<combinedLen; i++) {
              combined[i] = (existing[i] || false) || (sourceBus[i] || false);
          }
          destComp.inputValues[wire.toPortIndex] = combined;
      }
    }
  }

  // 4. Compute Logic for each component
  for (const comp of nextComponents) {
    // Input Switches don't calculate based on inputs, they hold user state
    if (comp.type === ComponentType.INPUT_SWITCH) continue;

    if (comp.type === ComponentType.CUSTOM_IC && comp.functionId && comp.internalState) {
        // --- CUSTOM IC RECURSION ---
        const funcDef = functionLibrary.find(f => f.id === comp.functionId);
        
        if (funcDef) {
            const inputsDef = sortComponents(
                funcDef.components.filter(c => c.type === ComponentType.INPUT_SWITCH),
                true
            );
            const outputsDef = sortComponents(
                funcDef.components.filter(c => c.type === ComponentType.OUTPUT_LED),
                false
            );

            const internalState = comp.internalState;

            // Map External Inputs -> Internal Switches
            inputsDef.forEach((def, index) => {
                const internalSwitch = internalState.components.find(c => c.id === def.id);
                if (internalSwitch) {
                    const val = comp.inputValues[index] || new Array(comp.bitWidth).fill(false);
                    internalSwitch.outputValues = [val]; 
                    // Dynamically update internal width to match external drive
                    internalSwitch.bitWidth = val.length; 
                }
            });

            // Step Internal Circuit
            const result = stepSimulation(internalState.components, internalState.wires, functionLibrary);
            comp.internalState = result;

            // Map Internal LEDs -> External Outputs
            const newOutputs: boolean[][] = [];
            outputsDef.forEach((def) => {
                const internalLed = result.components.find(c => c.id === def.id);
                if (internalLed && internalLed.inputValues[0]) {
                    newOutputs.push(internalLed.inputValues[0]);
                } else {
                    newOutputs.push(new Array(comp.bitWidth).fill(false)); 
                }
            });
            comp.outputValues = newOutputs;
        }
    } else {
        // Standard Component Logic
        comp.outputValues = evaluateComponent(comp, comp.inputValues, comp.outputValues);
    }
  }

  // 5. Update Wire Visual States for rendering
  const nextWires = wires.map(w => {
    const sourceComp = nextCompMap.get(w.fromCompId);
    let val: boolean[] = new Array(w.bitWidth).fill(false);
    if (sourceComp && sourceComp.outputValues[w.fromPortIndex]) {
        val = sourceComp.outputValues[w.fromPortIndex];
    }
    return { ...w, state: val };
  });

  return { components: nextComponents, wires: nextWires };
};
