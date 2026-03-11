
import React, { useRef, useEffect } from 'react';
import { CircuitComponent, ComponentType } from '../types';
import { bitsToHex } from '../logic/circuitRenderer';

interface BitViewerProps {
    component: CircuitComponent;
    onToggleBit: (bitIndex: number) => void;
    onChangeAll?: (newVal: boolean[]) => void;
}

const BitViewer: React.FC<BitViewerProps> = ({ component, onToggleBit, onChangeAll }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    
    // FIX: Hooks must be called unconditionally. 
    // Moving useEffect before the 'if (!isInput && !isOutput) return null' check.
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault(); // Stop zoom, history nav, etc.
            e.stopPropagation();

            // Map scroll to horizontal movement
            let delta = e.deltaY;
            if (e.shiftKey && e.deltaX !== 0) {
                 delta = e.deltaX;
            } else if (e.deltaX !== 0) {
                 delta = e.deltaX;
            }

            el.scrollLeft += delta;
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [component.bitWidth]);

    const isInput = component.type === ComponentType.INPUT_SWITCH;
    const isOutput = component.type === ComponentType.OUTPUT_LED || component.type === ComponentType.HEX_DISPLAY;

    if (!isInput && !isOutput) return null;

    // Determine which array holds the "main" value. 
    // INPUT stores state in outputValues[0]. OUTPUT reads from inputValues[0].
    const valueBus = isInput ? component.outputValues[0] : component.inputValues[0];
    const bits = valueBus || new Array(component.bitWidth).fill(false);
    
    const hex = bitsToHex(bits);

    const handleAll = (val: boolean) => {
        if (onChangeAll) {
            const newBits = new Array(component.bitWidth).fill(val);
            onChangeAll(newBits);
        } else {
            // Fallback to loop if batch handler not provided
            for(let i=0; i<component.bitWidth; i++) {
                if (bits[i] !== val) onToggleBit(i);
            }
        }
    };

    // If bitWidth > 1, use the scrolling single-line view
    if (component.bitWidth > 1) {
        // Iterate high to low
        const indices = Array.from({ length: component.bitWidth }, (_, i) => component.bitWidth - 1 - i);
        
        return (
            <div 
                className="flex items-center space-x-2 bg-white/50 rounded-lg p-1 border border-slate-200/50 shadow-sm"
            >
                {/* Hex Summary */}
                <div className="flex flex-col items-center px-2 border-r border-slate-300 min-w-[50px]">
                    <span className="text-[9px] text-slate-500 font-bold uppercase">Hex</span>
                    <span className="font-mono font-bold text-xs text-slate-800">0x{hex}</span>
                </div>

                {/* All ON/OFF Buttons for Inputs */}
                {isInput && (
                    <div className="flex flex-col space-y-1 px-1">
                         <button 
                            onClick={() => handleAll(true)}
                            className="px-2 py-[2px] text-[9px] font-bold bg-blue-100 text-blue-700 rounded hover:bg-blue-200 border border-blue-200 leading-none shadow-sm whitespace-nowrap"
                         >
                            ALL ON
                         </button>
                         <button 
                            onClick={() => handleAll(false)}
                            className="px-2 py-[2px] text-[9px] font-bold bg-slate-100 text-slate-600 rounded hover:bg-slate-200 border border-slate-200 leading-none shadow-sm whitespace-nowrap"
                         >
                            ALL OFF
                         </button>
                    </div>
                )}

                {/* Scrolling Bits - Compact Mode */}
                <div 
                    ref={scrollContainerRef}
                    className="flex items-center overflow-x-auto flex-nowrap max-w-[150px] md:max-w-[300px] whitespace-nowrap no-scrollbar pb-1 px-1"
                >
                    {indices.map((bitIndex) => {
                        const isOn = bits[bitIndex];
                        return (
                            <div 
                                key={bitIndex}
                                onClick={() => isInput && onToggleBit(bitIndex)}
                                className={`
                                    flex-shrink-0 w-4 h-6 mx-[1px] flex items-center justify-center
                                    text-[9px] font-mono border rounded select-none
                                    transition-colors duration-100
                                    ${isOn 
                                        ? 'bg-blue-500 border-blue-600 text-white shadow-sm' 
                                        : 'bg-white border-slate-300 text-slate-400'}
                                    ${isInput ? 'cursor-pointer hover:border-blue-400' : 'cursor-default'}
                                `}
                                title={`Bit ${bitIndex}`}
                            >
                                {isOn ? '1' : '0'}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Single Bit View (Large Button)
    const isOn = bits[0];
    return (
        <div className="flex items-center">
            <button
                disabled={!isInput}
                onClick={() => onToggleBit(0)}
                className={`
                    w-10 h-10 text-xs font-bold border-2 rounded-md flex flex-col items-center justify-center select-none shadow-sm
                    transition-all duration-100
                    ${isOn 
                        ? 'bg-blue-500 border-blue-600 text-white' 
                        : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}
                    ${isInput ? 'cursor-pointer' : 'cursor-default'}
                `}
            >
                {isOn ? 'ON' : 'OFF'}
            </button>
        </div>
    );
};

export default BitViewer;
