import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { FunctionCircuit, CircuitComponent, Wire } from '../types';
import { LogicCanvasHandle } from '../components/LogicCanvas';

const LOCAL_STORAGE_KEY = 'logicflow_autosave_v1';
const LOCAL_STORAGE_ID_KEY = 'logicflow_active_id_v1';

export const useProjectManager = (canvasRef: React.RefObject<LogicCanvasHandle | null>) => {
  // -- State --
  const [functions, setFunctions] = useState<FunctionCircuit[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) { console.error(e); }
    return [{ id: 'main', name: 'Main Circuit', components: [], wires: [] }];
  });

  const [activeFunctionId, setActiveFunctionId] = useState<string>(() => {
    try {
        const savedId = localStorage.getItem(LOCAL_STORAGE_ID_KEY);
        if (savedId) return savedId;
    } catch(e) {}
    return 'main';
  });

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [dataVersion, setDataVersion] = useState(0); // Used to force-refresh canvas on bulk updates

  // Refs for autosave callback access
  const functionsRef = useRef(functions);
  const activeIdRef = useRef(activeFunctionId);
  useEffect(() => { functionsRef.current = functions; }, [functions]);
  useEffect(() => { activeIdRef.current = activeFunctionId; }, [activeFunctionId]);

  // -- Validation --
  useLayoutEffect(() => {
    if (!functions.find(f => f.id === activeFunctionId)) {
        setActiveFunctionId(functions[0]?.id || 'main');
    }
  }, [functions, activeFunctionId]);

  // -- Helpers --
  const getLatestFunctionsState = (): FunctionCircuit[] => {
    let currentData = functionsRef.current;
    if (canvasRef.current) {
        const { components, wires } = canvasRef.current.getData();
        currentData = currentData.map(f => 
            f.id === activeIdRef.current 
              ? { ...f, components: [...components], wires: [...wires] } 
              : f
        );
    }
    return currentData;
  };

  const persist = () => {
    const data = getLatestFunctionsState();
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        localStorage.setItem(LOCAL_STORAGE_ID_KEY, activeIdRef.current);
        setLastSaved(new Date());
    } catch (e) { console.error("Save failed", e); }
    // Optimistic update of local state if needed, but usually we just sync refs
    // setFunctions(data); 
  };

  // -- Autosave Effect --
  useEffect(() => {
    const interval = setInterval(persist, 5000);
    const handleVis = () => { if (document.hidden) persist(); };
    const handleUnload = () => { persist(); };
    
    document.addEventListener("visibilitychange", handleVis);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", handleVis);
        window.removeEventListener("beforeunload", handleUnload);
        persist();
    };
  }, []);

  // -- Actions --

  const syncCanvasToState = () => {
      const updated = getLatestFunctionsState();
      setFunctions(updated);
      return updated;
  };

  const switchToFunction = (id: string) => {
    if (id === activeFunctionId) return;
    syncCanvasToState();
    setActiveFunctionId(id);
  };

  const addFunction = (name: string) => {
    const current = syncCanvasToState();
    const newId = crypto.randomUUID();
    const newFunc: FunctionCircuit = { id: newId, name, components: [], wires: [] };
    const next = [...current, newFunc];
    setFunctions(next);
    setActiveFunctionId(newId);
    persist();
  };

  const deleteFunction = (id: string) => {
    if (id === 'main') return;
    const next = functions.filter(f => f.id !== id);
    setFunctions(next);
    if (activeFunctionId === id) setActiveFunctionId('main');
    persist();
  };

  const importData = (data: any, isFullProject: boolean) => {
      if (isFullProject) {
        setFunctions(data);
        setActiveFunctionId(data[0].id);
        setDataVersion(v => v + 1);
      } else {
        const current = getLatestFunctionsState();
        setFunctions([...current, data]);
      }
      persist();
  };

  const clearData = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    localStorage.removeItem(LOCAL_STORAGE_ID_KEY);
    setFunctions([{ id: 'main', name: 'Main Circuit', components: [], wires: [] }]);
    setActiveFunctionId('main');
    setDataVersion(v => v + 1);
  };

  return {
      functions,
      activeFunctionId,
      activeFunction: functions.find(f => f.id === activeFunctionId) || functions[0],
      lastSaved,
      dataVersion,
      getLatestFunctionsState,
      switchToFunction,
      addFunction,
      deleteFunction,
      importData,
      clearData,
      persist // Quick save
  };
};