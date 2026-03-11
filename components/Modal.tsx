
import React, { ReactNode } from 'react';

interface ModalProps {
    isOpen: boolean;
    title: string;
    children: ReactNode;
    onClose: () => void;
    onSubmit: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    showCancel?: boolean;
}

const Modal: React.FC<ModalProps> = ({ 
    isOpen, 
    title, 
    children, 
    onClose, 
    onSubmit,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    showCancel = true
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">{title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="p-4">
                    {children}
                    <div className="flex justify-end space-x-2 mt-4">
                        {showCancel && (
                            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">
                                {cancelLabel}
                            </button>
                        )}
                        <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">
                            {confirmLabel}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Modal;
