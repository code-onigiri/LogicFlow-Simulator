
import React, { useState } from 'react';
import { ComponentType, FunctionCircuit } from '../types';
import { COMPONENT_DEFINITIONS, VALID_BIT_WIDTHS } from '../constants';
import DraggableItem from './DraggableItem';

interface SidebarProps {
  selectedTool: 'CURSOR' | 'REGION' | 'DELETE';
  onSelectTool: (t: 'CURSOR' | 'REGION' | 'DELETE') => void;
  selectedBitWidth: number;
  onSelectBitWidth: (w: number) => void;
  onTouchStartItem?: (type: ComponentType, pos: {x: number, y: number}, functionId?: string) => void;
  functionLibrary: FunctionCircuit[];
  // Clipboard actions
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
    selectedTool, 
    onSelectTool, 
    selectedBitWidth, 
    onSelectBitWidth,
    onTouchStartItem, 
    functionLibrary,
    onCopy,
    onPaste,
    onSelectAll
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const groups = [
    { name: 'Bus Tools', items: [ComponentType.SPLITTER, ComponentType.MERGER] },
    { name: 'I/O', items: [ComponentType.INPUT_SWITCH, ComponentType.OUTPUT_LED, ComponentType.HEX_DISPLAY] },
    { name: 'Gates', items: [ComponentType.BUFFER, ComponentType.NOT, ComponentType.AND, ComponentType.OR, ComponentType.NAND, ComponentType.NOR, ComponentType.XOR] }
  ];

  // Search Logic
  const filteredGroups = groups.map(group => ({
    ...group,
    items: group.items.filter(type => {
        if (!searchTerm) return true;
        const def = COMPONENT_DEFINITIONS[type];
        const lowerTerm = searchTerm.toLowerCase();
        return def.label.toLowerCase().includes(lowerTerm) || 
               def.description.toLowerCase().includes(lowerTerm) ||
               type.toLowerCase().includes(lowerTerm);
    })
  })).filter(g => g.items.length > 0);

  const filteredFunctions = functionLibrary.filter(f => 
      f.id !== 'main' && 
      (searchTerm ? f.name.toLowerCase().includes(searchTerm.toLowerCase()) : true)
  );

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shadow-lg z-10">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">LogicFlow</h1>
        <p className="text-xs text-slate-400 mt-1">Bus Width Simulator</p>
      </div>

      <div className="p-3 border-b border-slate-50">
        <div className="relative">
            <span className="absolute left-2.5 top-1.5 text-slate-400 text-sm">🔍</span>
            <input 
                type="text"
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 border-transparent focus:bg-white border focus:border-blue-300 rounded-md outline-none transition-all placeholder-slate-400 text-slate-700"
            />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 overscroll-contain scrollbar-thin">
        
        {/* Tools Section */}
        <section>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 pl-1">Tools</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <button
              onClick={() => onSelectTool('CURSOR')}
              className={`p-2 rounded text-xs font-bold transition-colors flex flex-col items-center justify-center gap-1 ${selectedTool === 'CURSOR' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Move / Edit (Default)"
            >
              <span className="text-base">👆</span> Move
            </button>
            <button
              onClick={() => onSelectTool('REGION')}
              className={`p-2 rounded text-xs font-bold transition-colors flex flex-col items-center justify-center gap-1 ${selectedTool === 'REGION' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Area Selection Only"
            >
              <span className="text-base">⛶</span> Area
            </button>
            <button
              onClick={() => onSelectTool('DELETE')}
              className={`p-2 rounded text-xs font-bold transition-colors flex flex-col items-center justify-center gap-1 ${selectedTool === 'DELETE' ? 'bg-red-500 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              title="Delete Item"
            >
              <span className="text-base">🗑️</span> Del
            </button>
          </div>
          
          {/* Clipboard Actions for Touch Users */}
          <div className="grid grid-cols-3 gap-2">
             <button onClick={onCopy} className="py-1.5 px-2 bg-white border border-slate-200 rounded text-xs font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-transform" title="Copy">
                📋 Copy
             </button>
             <button onClick={onPaste} className="py-1.5 px-2 bg-white border border-slate-200 rounded text-xs font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-transform" title="Paste">
                📝 Paste
             </button>
             <button onClick={onSelectAll} className="py-1.5 px-2 bg-white border border-slate-200 rounded text-xs font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-transform" title="Select All">
                ✅ All
             </button>
          </div>
        </section>

        {/* Bit Width Section */}
        <section>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 pl-1">Bus Width</h3>
            <div className="flex flex-wrap gap-1.5">
                {VALID_BIT_WIDTHS.map(w => (
                    <button
                        key={w}
                        onClick={() => onSelectBitWidth(w)}
                        className={`px-2.5 py-1 text-xs font-bold rounded border transition-all ${selectedBitWidth === w 
                            ? 'bg-blue-100 border-blue-400 text-blue-700 shadow-sm scale-105' 
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                        {w}
                    </button>
                ))}
            </div>
        </section>

        {/* Component Groups */}
        {filteredGroups.map(group => (
          <section key={group.name}>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 pl-1">{group.name}</h3>
            <div className="grid grid-cols-2 gap-3">
              {group.items.map(type => {
                const def = COMPONENT_DEFINITIONS[type];
                const disabled = (type === ComponentType.SPLITTER || type === ComponentType.MERGER) && selectedBitWidth < 2;
                const subLabel = type === ComponentType.SPLITTER ? `${selectedBitWidth}→${selectedBitWidth/2}` : 
                                 type === ComponentType.MERGER ? `${selectedBitWidth/2}→${selectedBitWidth}` : 
                                 `x${selectedBitWidth}`;

                return (
                   <DraggableItem 
                        key={type}
                        type={type}
                        label={def.label}
                        subLabel={subLabel}
                        disabled={disabled}
                        bitWidth={selectedBitWidth}
                        onTouchStartItem={onTouchStartItem}
                   />
                );
              })}
            </div>
          </section>
        ))}

        {/* Custom Functions Section */}
        {(filteredFunctions.length > 0 || (searchTerm && filteredFunctions.length === 0)) && (
            <section>
                 <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 pl-1">My Functions</h3>
                 {filteredFunctions.length > 0 ? (
                     <div className="grid grid-cols-1 gap-2">
                        {filteredFunctions.map(func => (
                            <DraggableItem
                                key={func.id}
                                type={ComponentType.CUSTOM_IC}
                                label={func.name}
                                subLabel=""
                                disabled={false}
                                bitWidth={selectedBitWidth}
                                functionId={func.id}
                                isCustom={true}
                                onTouchStartItem={onTouchStartItem}
                            />
                        ))}
                     </div>
                 ) : (
                     <p className="text-xs text-slate-400 italic pl-1">No functions match search.</p>
                 )}
            </section>
        )}

      </div>
    </div>
  );
};

export default Sidebar;
