
// Logic component types
export enum ComponentType {
  INPUT_SWITCH = 'INPUT',
  OUTPUT_LED = 'OUTPUT',
  BUFFER = 'BUFFER', // Passthrough / Router
  NOT = 'NOT',
  AND = 'AND',
  OR = 'OR',
  NAND = 'NAND',
  NOR = 'NOR',
  XOR = 'XOR',
  HEX_DISPLAY = 'HEX',
  SPLITTER = 'SPLIT', // Splits N bits into N/2 and N/2
  MERGER = 'MERGE',   // Merges N/2 and N/2 bits into N
  CUSTOM_IC = 'IC'
}

export type PortSide = 'top' | 'bottom' | 'left' | 'right';

export interface Point {
  x: number;
  y: number;
}

// A connection point on a component
export interface Port {
  id: string; // "input-0", "output-0"
  type: 'input' | 'output';
  relativePos: Point;
  label?: string;
  bitWidth: number; // Enforce connection width
}

// The definition of how a component behaves and looks
export interface ComponentDef {
  type: ComponentType;
  label: string;
  width: number;
  height: number;
  inputs: number; // count of ports
  outputs: number; // count of ports
  description: string;
}

// Global simulation state
export interface CircuitState {
  components: CircuitComponent[];
  wires: Wire[];
  tick: number;
}

// An instance of a component on the canvas
export interface CircuitComponent {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  
  // Data State: Each port holds an array of booleans (the bus value)
  // Index corresponds to Port Index
  inputValues: boolean[][]; 
  outputValues: boolean[][];
  
  bitWidth: number; // The bus width this component operates on (1, 2, 4, 8...)

  customLabel?: string; 
  
  // For Custom ICs
  functionId?: string; 
  internalState?: {    
    components: CircuitComponent[];
    wires: Wire[];
  };
  
  icPortSide?: PortSide; 
}

// A connection between two ports
export interface Wire {
  id: string;
  fromCompId: string;
  fromPortIndex: number;
  toCompId: string;
  toPortIndex: number;
  
  state: boolean[]; // Array of bits (Bus)
  bitWidth: number;
}

// Function Circuit Definition (The "Class" of the IC)
export interface FunctionCircuit {
  id: string;
  name: string;
  components: CircuitComponent[];
  wires: Wire[];
}
