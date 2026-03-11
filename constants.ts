
import { ComponentDef, ComponentType } from './types';

export const GRID_SIZE = 40; 
export const COLOR_WIRE_OFF = '#94a3b8'; // Slate 400
export const COLOR_WIRE_ON = '#f59e0b';  // Amber 500
export const COLOR_BUS_OFF = '#475569';  // Slate 600
export const COLOR_BUS_ON = '#3b82f6';   // Blue 500
export const COLOR_BG = '#f8fafc';       
export const COLOR_GRID = '#e2e8f0';     
export const COLOR_COMPONENT_BG = '#ffffff';
export const COLOR_COMPONENT_STROKE = '#334155';

export const VALID_BIT_WIDTHS = [1, 2, 4, 8, 16, 32, 64, 128, 256];

export const COMPONENT_DEFINITIONS: Record<ComponentType, ComponentDef> = {
  [ComponentType.INPUT_SWITCH]: {
    type: ComponentType.INPUT_SWITCH,
    label: 'IN',
    width: 1,
    height: 1,
    inputs: 0,
    outputs: 1,
    description: "Switch (Toggle All)"
  },
  [ComponentType.OUTPUT_LED]: {
    type: ComponentType.OUTPUT_LED,
    label: 'OUT',
    width: 1,
    height: 1,
    inputs: 1,
    outputs: 0,
    description: "Indicator"
  },
  [ComponentType.BUFFER]: {
    type: ComponentType.BUFFER,
    label: 'BUF',
    width: 1,
    height: 1,
    inputs: 1,
    outputs: 1,
    description: "Wire Router (Passthrough)"
  },
  [ComponentType.NOT]: {
    type: ComponentType.NOT,
    label: 'NOT',
    width: 1,
    height: 1,
    inputs: 1,
    outputs: 1,
    description: "Bitwise NOT"
  },
  [ComponentType.AND]: {
    type: ComponentType.AND,
    label: 'AND',
    width: 1,
    height: 1,
    inputs: 2,
    outputs: 1,
    description: "Bitwise AND"
  },
  [ComponentType.OR]: {
    type: ComponentType.OR,
    label: 'OR',
    width: 1,
    height: 1,
    inputs: 2,
    outputs: 1,
    description: "Bitwise OR"
  },
  [ComponentType.NAND]: {
    type: ComponentType.NAND,
    label: 'NAND',
    width: 1,
    height: 1,
    inputs: 2,
    outputs: 1,
    description: "Bitwise NAND"
  },
  [ComponentType.NOR]: {
    type: ComponentType.NOR,
    label: 'NOR',
    width: 1,
    height: 1,
    inputs: 2,
    outputs: 1,
    description: "Bitwise NOR"
  },
  [ComponentType.XOR]: {
    type: ComponentType.XOR,
    label: 'XOR',
    width: 1,
    height: 1,
    inputs: 2,
    outputs: 1,
    description: "Bitwise XOR"
  },
  [ComponentType.HEX_DISPLAY]: {
    type: ComponentType.HEX_DISPLAY,
    label: 'HEX',
    width: 2, // Wider for Hex values
    height: 1,
    inputs: 1, // Takes 1 bus input (internally takes N bits)
    outputs: 0,
    description: "Hex Value Display"
  },
  [ComponentType.SPLITTER]: {
    type: ComponentType.SPLITTER,
    label: 'SPLIT',
    width: 1,
    height: 2,
    inputs: 1,
    outputs: 2,
    description: "Split Bus (N -> N/2, N/2)"
  },
  [ComponentType.MERGER]: {
    type: ComponentType.MERGER,
    label: 'MERGE',
    width: 1,
    height: 2,
    inputs: 2,
    outputs: 1,
    description: "Merge Bus (N/2, N/2 -> N)"
  },
  [ComponentType.CUSTOM_IC]: {
    type: ComponentType.CUSTOM_IC,
    label: 'IC',
    width: 2, 
    height: 2, 
    inputs: 0, 
    outputs: 0, 
    description: "Custom Function"
  }
};
