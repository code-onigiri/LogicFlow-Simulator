
import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import LogicCanvas, { LogicCanvasHandle } from './components/LogicCanvas';
import Toolbar from './components/Toolbar';
import Modal from './components/Modal';
import { ComponentType, CircuitComponent } from './types';
import { COMPONENT_DEFINITIONS } from './constants';
import { useProjectManager } from './hooks/useProjectManager';

const App: React.FC = () => {
  // -- UI State --
  // CURSOR: Smart mode (Move/Edit + Desktop Box Select + Mobile Pan)
  // REGION: Force Box Selection
  // DELETE: Delete mode
  const [selectedTool, setSelectedTool] = useState<'CURSOR' | 'REGION' | 'DELETE'>('CURSOR');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedSlider, setSpeedSlider] = useState(90); 
  const [selectedBitWidth, setSelectedBitWidth] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newFuncName, setNewFuncName] = useState("");
  const [wireStyle, setWireStyle] = useState<'bezier' | 'orthogonal'>('orthogonal');
  
  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // -- Component Selection --
  const [selectedComponent, setSelectedComponent] = useState<CircuitComponent | null>(null);
  const [tempLabel, setTempLabel] = useState("");

  // -- Drag & Drop State --
  const [draggedType, setDraggedType] = useState<ComponentType | null>(null);
  const [draggedFuncId, setDraggedFuncId] = useState<string | undefined>(undefined);
  const [dragPos, setDragPos] = useState<{x: number, y: number} | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{type: ComponentType, x: number, y: number, functionId?: string, bitWidth: number} | null>(null);

  // Ref to track drag position without triggering re-renders or stale closures in event handlers
  const dragPosRef = useRef<{x: number, y: number} | null>(null);

  // -- Refs --
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<LogicCanvasHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Hooks --
  const {
      functions,
      activeFunctionId,
      activeFunction,
      lastSaved,
      dataVersion,
      switchToFunction,
      addFunction,
      deleteFunction,
      importData,
      clearData,
      persist
  } = useProjectManager(canvasRef);

  // Computed Values
  const tickSpeed = speedSlider === 100 ? 0 : Math.max(1, 500 - (speedSlider * 5));
  const speedLabel = speedSlider === 100 ? "MAX" : `${tickSpeed}ms`;

  // -- Interaction Handlers --

  const handleTouchStartItem = (type: ComponentType, pos: {x: number, y: number}, functionId?: string) => {
    setDraggedType(type);
    setDraggedFuncId(functionId);
    setDragPos(pos);
    dragPosRef.current = pos;
  };

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (draggedType) {
        e.preventDefault(); 
        const touch = e.touches[0];
        const newPos = { x: touch.clientX, y: touch.clientY };
        setDragPos(newPos);
        dragPosRef.current = newPos;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const finalPos = dragPosRef.current;
      if (draggedType && finalPos && canvasWrapperRef.current) {
        const rect = canvasWrapperRef.current.getBoundingClientRect();
        if (
          finalPos.x >= rect.left && finalPos.x <= rect.right &&
          finalPos.y >= rect.top && finalPos.y <= rect.bottom
        ) {
          setPendingDrop({ 
            type: draggedType, 
            x: finalPos.x - rect.left, 
            y: finalPos.y - rect.top, 
            functionId: draggedFuncId, 
            bitWidth: selectedBitWidth 
          });
        }
      }
      setDraggedType(null);
      setDraggedFuncId(undefined);
      setDragPos(null);
      dragPosRef.current = null;
    };

    if (draggedType) {
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);
    }
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [draggedType, draggedFuncId, selectedBitWidth]);

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target?.result as string);
            if (Array.isArray(parsed)) {
                if (confirm("Replace current project?")) {
                    importData(parsed, true);
                    setSelectedComponent(null);
                    setIsPlaying(false);
                }
            } else if (parsed.id) {
                importData(parsed, false);
                alert(`Imported: ${parsed.name}`);
            }
        } catch (err) { alert("Invalid File"); }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleExport = (type: 'PROJECT' | 'FUNCTION') => {
      const data = type === 'PROJECT' 
        ? functions.map(f => f.id === activeFunctionId && canvasRef.current ? {...f, ...canvasRef.current.getData()} : f)
        : (canvasRef.current ? {...activeFunction, ...canvasRef.current.getData()} : activeFunction);
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'PROJECT' ? `project.json` : `${activeFunction.name.replace(/\s+/g, '_')}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const updateProp = (updates: Partial<CircuitComponent>) => {
    if (selectedComponent && canvasRef.current) {
        canvasRef.current.updateSelectedComponent(updates);
        setSelectedComponent(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const handleSelectionChange = (comp: CircuitComponent | null) => {
      setSelectedComponent(comp);
      setTempLabel(comp?.customLabel || "");
  };

  // Poll for Simulation Updates (Live Monitor)
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { selectedIdRef.current = selectedComponent?.id || null; }, [selectedComponent]);

  useEffect(() => {
      if (!isPlaying) return;
      const interval = setInterval(() => {
          const currentId = selectedIdRef.current;
          if (!currentId || !canvasRef.current) return;

          const { components } = canvasRef.current.getData();
          const freshComp = components.find(c => c.id === currentId);
          
          if (freshComp) {
              setSelectedComponent(prev => {
                  if (!prev || prev.id !== currentId) return prev;
                  // Optimization: Only update React state if logic state changed
                  const prevHash = JSON.stringify({ i: prev.inputValues, o: prev.outputValues });
                  const newHash = JSON.stringify({ i: freshComp.inputValues, o: freshComp.outputValues });
                  return prevHash !== newHash ? { ...freshComp } : prev;
              });
          }
      }, 100);
      return () => clearInterval(interval);
  }, [isPlaying]); 

  return (
    <div className="fixed inset-0 flex bg-slate-50 text-slate-800 font-sans overflow-hidden select-none">
      <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />

      <Sidebar 
        selectedTool={selectedTool} 
        onSelectTool={setSelectedTool}
        selectedBitWidth={selectedBitWidth}
        onSelectBitWidth={setSelectedBitWidth}
        onTouchStartItem={handleTouchStartItem}
        functionLibrary={functions}
        onCopy={() => canvasRef.current?.copy()}
        onPaste={() => canvasRef.current?.paste()}
        onSelectAll={() => canvasRef.current?.selectAll()}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        <Toolbar 
            activeFunctionId={activeFunctionId}
            functions={functions}
            isPlaying={isPlaying}
            speedSlider={speedSlider}
            speedLabel={speedLabel}
            selectedComponent={selectedComponent}
            tempLabel={tempLabel}
            lastSaved={lastSaved}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onSpeedChange={setSpeedSlider}
            onFunctionChange={(id) => { setIsPlaying(false); switchToFunction(id); }}
            onAddFunction={() => setIsModalOpen(true)}
            onDeleteFunction={deleteFunction}
            onFocusComponent={() => selectedComponent && canvasRef.current?.focusComponent(selectedComponent.id)}
            onUpdateComponent={updateProp}
            onBitToggle={(idx) => {
                if (selectedComponent && canvasRef.current) {
                    const currentBus = selectedComponent.outputValues[0] || new Array(selectedComponent.bitWidth).fill(false);
                    canvasRef.current.setComponentOutputBit(selectedComponent.id, idx, !currentBus[idx]);
                    // Optimistic update
                    const newBus = [...currentBus]; newBus[idx] = !newBus[idx];
                    setSelectedComponent({ ...selectedComponent, outputValues: [newBus] });
                }
            }}
            onBatchBusChange={(newBus) => {
                if (selectedComponent && canvasRef.current) {
                    canvasRef.current.updateSelectedComponent({ outputValues: [newBus] });
                    setSelectedComponent({ ...selectedComponent, outputValues: [newBus] });
                }
            }}
            onLabelChange={(val) => { setTempLabel(val); updateProp({ customLabel: val }); }}
            onSave={persist}
            onImport={() => fileInputRef.current?.click()}
            onExportProject={() => handleExport('PROJECT')}
            onExportFunction={() => handleExport('FUNCTION')}
            onClear={() => { if(confirm("Clear all data?")) clearData(); }}
            onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Main Canvas */}
        <div className="flex-1 w-full h-full relative z-0" ref={canvasWrapperRef}>
          <LogicCanvas 
            key={`${activeFunctionId}-${dataVersion}`}
            ref={canvasRef}
            tool={selectedTool} 
            isPlaying={isPlaying} 
            tickSpeedMs={tickSpeed}
            pendingDrop={pendingDrop}
            initialComponents={activeFunction.components}
            initialWires={activeFunction.wires}
            functionLibrary={functions}
            onPendingDropHandled={() => setPendingDrop(null)}
            onSelectionChange={handleSelectionChange}
            wireStyle={wireStyle}
          />
        </div>

        {/* Drag Ghost Visual */}
        {draggedType && dragPos && (
          <div className="fixed pointer-events-none z-50 opacity-90" style={{ left: dragPos.x, top: dragPos.y, transform: 'translate(-50%, -50%)' }}>
            <div className="w-12 h-12 bg-white border-2 border-blue-500 rounded-lg flex items-center justify-center shadow-2xl">
              <span className="text-[10px] font-bold text-slate-800">{draggedType === 'IC' ? 'IC' : COMPONENT_DEFINITIONS[draggedType].label.substring(0,3)}</span>
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full shadow-sm">{selectedBitWidth}</span>
            </div>
          </div>
        )}

        {/* New Function Modal */}
        <Modal 
            isOpen={isModalOpen}
            title="Create New Function"
            onClose={() => setIsModalOpen(false)}
            onSubmit={() => {
                if (newFuncName.trim()) {
                    addFunction(newFuncName);
                    setNewFuncName("");
                    setIsModalOpen(false);
                }
            }}
        >
             <input 
                autoFocus 
                type="text" 
                value={newFuncName} 
                onChange={(e) => setNewFuncName(e.target.value)} 
                placeholder="Function Name (e.g., Full Adder)" 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none transition-all" 
            />
        </Modal>

        {/* Settings Modal */}
        <Modal
            isOpen={isSettingsOpen}
            title="Settings"
            onClose={() => setIsSettingsOpen(false)}
            onSubmit={() => setIsSettingsOpen(false)}
            confirmLabel="Done"
            showCancel={false}
        >
            <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Wire Style</label>
                    <div className="flex space-x-4">
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${wireStyle === 'bezier' ? 'border-blue-500' : 'border-slate-300'}`}>
                                {wireStyle === 'bezier' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                            </div>
                            <input 
                                type="radio" 
                                name="wireStyle" 
                                className="hidden"
                                checked={wireStyle === 'bezier'} 
                                onChange={() => setWireStyle('bezier')} 
                            />
                            <span className={`text-sm font-medium ${wireStyle === 'bezier' ? 'text-blue-700' : 'text-slate-600 group-hover:text-slate-800'}`}>Bezier (Curve)</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer group">
                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${wireStyle === 'orthogonal' ? 'border-blue-500' : 'border-slate-300'}`}>
                                {wireStyle === 'orthogonal' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                            </div>
                            <input 
                                type="radio" 
                                name="wireStyle" 
                                className="hidden"
                                checked={wireStyle === 'orthogonal'} 
                                onChange={() => setWireStyle('orthogonal')} 
                            />
                            <span className={`text-sm font-medium ${wireStyle === 'orthogonal' ? 'text-blue-700' : 'text-slate-600 group-hover:text-slate-800'}`}>Orthogonal (Straight)</span>
                        </label>
                    </div>
                </div>
            </div>
        </Modal>

      </main>
    </div>
  );
};

export default App;
