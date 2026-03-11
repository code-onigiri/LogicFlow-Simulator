
import React, { useRef } from 'react';
import { ComponentType } from '../types';

interface DraggableItemProps {
    type: ComponentType;
    label: string;
    subLabel: string;
    disabled: boolean;
    bitWidth: number;
    functionId?: string;
    isCustom?: boolean;
    onTouchStartItem?: (type: ComponentType, pos: {x: number, y: number}, functionId?: string) => void;
}

const useTouchDrag = (
    disabled: boolean, 
    callback: (pos: {x: number, y: number}) => void
) => {
    const onTouchStart = (e: React.TouchEvent) => {
        if (disabled) return;
        const touch = e.touches[0];
        const pos = { x: touch.clientX, y: touch.clientY };
        // Immediate Drag Start
        callback(pos);
    };

    return {
        onTouchStart,
        onContextMenu: (e: React.MouseEvent) => { if (!disabled) e.preventDefault(); }
    };
};

const DraggableItem: React.FC<DraggableItemProps> = ({ 
    type, label, subLabel, disabled, bitWidth, functionId, isCustom, onTouchStartItem 
}) => {
    
    const handleDragStart = (e: React.DragEvent) => {
        if (disabled) return;
        e.dataTransfer.setData('application/react-logic-sim', JSON.stringify({ type, functionId, bitWidth }));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const touchHandlers = useTouchDrag(disabled, (pos) => {
        if (onTouchStartItem) onTouchStartItem(type, pos, functionId);
    });

    if (isCustom) {
        return (
             <div
                draggable={!disabled}
                onDragStart={handleDragStart}
                {...touchHandlers}
                className="flex items-center p-2 rounded border border-slate-200 bg-blue-50 hover:border-blue-300 hover:shadow-sm transition-all duration-200 cursor-grab active:cursor-grabbing select-none"
            >
                 <div className="w-6 h-6 mr-3 border border-blue-200 rounded flex items-center justify-center bg-white text-[9px] font-bold text-blue-600 pointer-events-none">
                    IC
                 </div>
                 <span className="text-sm font-medium text-slate-700 pointer-events-none truncate">{label}</span>
            </div>
        );
    }

    return (
        <div
            draggable={!disabled}
            onDragStart={handleDragStart}
            {...touchHandlers}
            className={`flex flex-col items-center justify-center p-3 rounded border-2 transition-all duration-200 select-none
                ${disabled 
                    ? 'opacity-40 bg-slate-50 border-slate-100 cursor-not-allowed' 
                    : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm cursor-grab active:cursor-grabbing'}`}
        >
            <div className="w-8 h-8 mb-2 border border-slate-300 rounded flex items-center justify-center bg-white text-[10px] font-bold text-slate-600 pointer-events-none">
                {label.substring(0,3)}
            </div>
            <span className="text-xs font-medium text-slate-700 pointer-events-none">{label}</span>
            <span className="text-[9px] text-slate-400 font-mono mt-1">{subLabel}</span>
        </div>
    );
};

export default DraggableItem;
