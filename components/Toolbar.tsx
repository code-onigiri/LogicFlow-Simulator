
import React, { useState } from 'react';
import { FunctionCircuit, CircuitComponent, PortSide, ComponentType } from '../types';
import BitViewer from './BitViewer';
import { LogicCanvasHandle } from './LogicCanvas';

interface ToolbarProps {
    activeFunctionId: string;
    functions: FunctionCircuit[];
    isPlaying: boolean;
    speedSlider: number;
    speedLabel: string;
    selectedComponent: CircuitComponent | null;
    tempLabel: string;
    lastSaved: Date | null;
    
    // Actions
    onTogglePlay: () => void;
    onSpeedChange: (val: number) => void;
    onFunctionChange: (id: string) => void;
    onAddFunction: () => void;
    onDeleteFunction: (id: string) => void;
    onFocusComponent: () => void;
    onUpdateComponent: (updates: Partial<CircuitComponent>) => void;
    onBitToggle: (idx: number) => void;
    onBatchBusChange: (val: boolean[]) => void;
    onLabelChange: (val: string) => void;
    
    // Project Actions
    onSave: () => void;
    onImport: () => void;
    onExportProject: () => void;
    onExportFunction: () => void;
    onClear: () => void;
    onOpenSettings: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
    activeFunctionId, functions, isPlaying, speedSlider, speedLabel,
    selectedComponent, tempLabel, lastSaved,
    onTogglePlay, onSpeedChange, onFunctionChange, onAddFunction, onDeleteFunction,
    onFocusComponent, onUpdateComponent, onBitToggle, onBatchBusChange, onLabelChange,
    onSave, onImport, onExportProject, onExportFunction, onClear, onOpenSettings
}) => {
    const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);

    return (
        <div className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur-md shadow-sm rounded-lg flex flex-wrap items-center justify-between px-4 py-2 z-10 border border-slate-200 gap-2 min-h-[52px]">
            
            {/* Left: Playback & Function Controls */}
            <div className="flex items-center space-x-3">
                
                {/* Function Selector */}
                <div className="flex items-center bg-slate-100 rounded-md p-1 border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 px-2 uppercase hidden sm:inline">Context</span>
                    <div className="relative">
                        <select 
                            value={activeFunctionId}
                            onChange={(e) => onFunctionChange(e.target.value)}
                            className="bg-transparent text-sm font-semibold text-slate-700 outline-none w-24 sm:w-32 cursor-pointer py-1 appearance-none pl-2"
                        >
                            {functions.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                    <div className="flex space-x-1 pl-1">
                        <button onClick={onAddFunction} className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 text-blue-600 rounded hover:bg-blue-50 hover:border-blue-300 font-bold text-lg leading-none pb-1" title="New Function">+</button>
                        {activeFunctionId !== 'main' && (
                            <button onClick={() => onDeleteFunction(activeFunctionId)} className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 text-red-500 rounded hover:bg-red-50 hover:border-red-300 font-bold text-lg leading-none pb-1" title="Delete Function">×</button>
                        )}
                    </div>
                </div>

                <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

                {/* Simulation Controls */}
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={onTogglePlay}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold w-20 border shadow-sm transition-all active:scale-95 ${isPlaying ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
                    >
                        {isPlaying ? 'PAUSE' : 'RUN'}
                    </button>

                    <div className="flex flex-col justify-center bg-slate-50 px-3 py-1 rounded-md border border-slate-200 w-28">
                        <div className="flex justify-between w-full mb-1">
                            <span className="text-[9px] font-bold text-slate-400">SPEED</span>
                            <span className="text-[9px] font-mono text-slate-500">{speedLabel}</span>
                        </div>
                        <input
                            type="range" min="0" max="100" step="5"
                            value={speedSlider}
                            onChange={(e) => onSpeedChange(Number(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>

                {/* Bit Viewer Injection */}
                {selectedComponent && selectedComponent.bitWidth >= 1 && (
                     <div className="hidden xl:block pl-2 border-l border-slate-200 animate-fade-in">
                        <BitViewer 
                          component={selectedComponent} 
                          onToggleBit={onBitToggle} 
                          onChangeAll={onBatchBusChange}
                        />
                     </div>
                 )}
            </div>

            {/* Right: Component Props & Project Menu */}
            <div className="flex items-center space-x-3 w-full md:w-auto justify-end mt-2 md:mt-0">
                {selectedComponent && (
                    <div className="flex items-center space-x-2 flex-1 md:flex-none justify-center bg-slate-50/50 p-1 rounded-lg border border-slate-100">
                        <button 
                            onClick={onFocusComponent}
                            className="bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded px-2 py-1 text-xs font-bold shadow-sm transition-colors"
                            title="Center View"
                        >
                           ⌖ Focus
                        </button>
                        
                        {(selectedComponent.type === ComponentType.INPUT_SWITCH || selectedComponent.type === ComponentType.OUTPUT_LED) && (
                          <div className="flex items-center bg-white px-2 py-1 rounded border border-slate-200">
                              <span className="text-[10px] font-bold text-slate-400 mr-1 uppercase">Side</span>
                              <select 
                                  value={selectedComponent.icPortSide || (selectedComponent.type === 'INPUT' ? 'right' : 'left')}
                                  onChange={(e) => onUpdateComponent({ icPortSide: e.target.value as PortSide })}
                                  className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                              >
                                  <option value="left">Left</option>
                                  <option value="right">Right</option>
                                  <option value="top">Top</option>
                                  <option value="bottom">Bottom</option>
                              </select>
                          </div>
                        )}

                        <div className="flex items-center bg-yellow-50 px-2 py-1 rounded border border-yellow-200 focus-within:ring-2 ring-yellow-100 transition-all">
                           <input 
                               type="text" 
                               value={tempLabel}
                               onChange={(e) => onLabelChange(e.target.value)}
                               className="bg-transparent text-sm text-slate-800 px-1 py-0.5 w-20 focus:outline-none placeholder-yellow-300/50"
                               placeholder="Label"
                           />
                        </div>
                    </div>
                )}

                {/* Settings & Menu */}
                <button 
                    onClick={onOpenSettings}
                    className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-md w-9 h-9 flex items-center justify-center transition-colors shadow-sm"
                    title="Settings"
                >
                     <span className="text-lg">⚙️</span>
                </button>

                <div className="relative">
                    <button 
                        onClick={() => setIsProjectMenuOpen(!isProjectMenuOpen)} 
                        className={`px-3 py-2 border rounded-md text-sm font-semibold transition-colors flex items-center gap-2
                        ${isProjectMenuOpen ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                        <span>Menu</span>
                        <span className="text-[10px]">▼</span>
                    </button>
                    {isProjectMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsProjectMenuOpen(false)}></div>
                            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-2 z-50 flex flex-col animate-scale-in origin-top-right">
                                <div className="px-4 py-2 text-[10px] font-mono text-slate-400 border-b mb-1 uppercase tracking-wider">
                                    {lastSaved ? `Saved: ${lastSaved.toLocaleTimeString()}` : 'Unsaved'}
                                </div>
                                <button onClick={() => { onSave(); setIsProjectMenuOpen(false); }} className="px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">💾 Save Project</button>
                                <button onClick={() => { onImport(); setIsProjectMenuOpen(false); }} className="px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">📂 Import JSON</button>
                                <button onClick={() => onExportProject()} className="px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">📦 Export All</button>
                                <button onClick={() => onExportFunction()} className="px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2">📄 Export Function</button>
                                <div className="h-px bg-slate-100 my-1"></div>
                                <button onClick={() => { onClear(); setIsProjectMenuOpen(false); }} className="px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">🗑️ Reset All</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Toolbar;
