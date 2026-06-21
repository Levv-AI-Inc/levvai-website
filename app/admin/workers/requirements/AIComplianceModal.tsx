'use client'
//DEAD CODE. NOT NEEDED
import React, { useState } from 'react'
import { Cog, Zap, ShieldCheck, X, Plus, Trash2, Eye, Info, CheckCircle2 } from 'lucide-react'
import type { Requirement, ApproverGroup, ComplianceRule, LogicPrefix } from './requirementsStore'

type Props = {
  requirement: Requirement
  onSave: (updates: Partial<Requirement>) => void
  onClose: () => void
}

const PREFIX_OPTIONS: { value: LogicPrefix; label: string; color: string }[] = [
  { value: 'MUST_HAVE', label: 'Must Have', color: 'text-rose-600' },
  { value: 'SHOULD_HAVE', label: 'Should Have', color: 'text-amber-600' },
  { value: 'EQUAL_TO', label: 'Equal To', color: 'text-indigo-600' },
  { value: 'MATCHES_FORMAT', label: 'Matches Format', color: 'text-cyan-600' },
  { value: 'IS_GREATER_THAN', label: 'Greater Than', color: 'text-emerald-600' },
]

export function AIComplianceModal({ requirement, onSave, onClose }: Props) {
  const [localReq, setLocalReq] = useState<Requirement>({ ...requirement })
  const [showPreview, setShowPreview] = useState(false)

  const addRule = () => {
    const newRule: ComplianceRule = {
      id: crypto.randomUUID(),
      field: '',
      prefix: 'MUST_HAVE',
      logicValue: '',
      criticality: 'BLOCKER'
    }
    const rules = [...(localReq.compliance?.rules || []), newRule]
    setLocalReq({ ...localReq, compliance: { ...localReq.compliance!, rules } })
  }

  const updateRule = (id: string, updates: Partial<ComplianceRule>) => {
    const rules = (localReq.compliance?.rules || []).map(r => r.id === id ? { ...r, ...updates } : r)
    setLocalReq({ ...localReq, compliance: { ...localReq.compliance!, rules } })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 text-slate-900 font-sans">
      <div className={`bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex transition-all duration-500 ease-in-out ${showPreview ? 'max-w-6xl w-full' : 'max-w-2xl w-full'}`}>
        
        {/* CONFIGURATION SIDE */}
        <div className="flex-1 flex flex-col max-h-[85vh]">
          <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-slate-950 p-2 rounded-xl text-cyan-400"><Cog size={20} /></div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">Logic Architect</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{requirement.name}</p>
              </div>
            </div>
            <button onClick={() => setShowPreview(!showPreview)} className="text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 px-4 py-2 rounded-xl hover:bg-slate-50 transition-all">
              {showPreview ? 'Hide Test' : 'Simulate Logic'}
            </button>
          </div>

          <div className="p-8 overflow-y-auto space-y-10">
            {/* THRESHOLD */}
            <section className="space-y-4">
               <div className="flex justify-between items-end">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Zap size={14} className="text-indigo-500" /> Auto-Pass Threshold</h4>
                  <span className="text-3xl font-black text-indigo-600">{localReq.compliance?.confidenceThreshold}%</span>
               </div>
               <input 
                 type="range" min="50" max="100" 
                 value={localReq.compliance?.confidenceThreshold}
                 onChange={(e) => setLocalReq({...localReq, compliance: { ...localReq.compliance!, confidenceThreshold: parseInt(e.target.value) }})}
                 className="w-full h-2 bg-slate-100 rounded-full appearance-none cursor-pointer accent-indigo-600" 
               />
            </section>

            {/* HYBRID RULES */}
            <section className="space-y-6">
               <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Validation Rules</h4>
                  <button onClick={addRule} className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1 hover:underline"><Plus size={14} /> Add Logic Row</button>
               </div>

               <div className="space-y-4">
                 {localReq.compliance?.rules.map((rule) => (
                   <div key={rule.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 group hover:border-indigo-200 transition-colors">
                     <div className="flex items-center gap-2">
                        <input 
                          value={rule.field}
                          onChange={(e) => updateRule(rule.id, { field: e.target.value })}
                          placeholder="Field Name"
                          className="w-1/3 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold outline-none"
                        />
                        <div className="h-[1px] w-4 bg-slate-200" />
                        <select 
                          value={rule.prefix}
                          onChange={(e) => updateRule(rule.id, { prefix: e.target.value as LogicPrefix })}
                          className={`bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-black uppercase outline-none ${PREFIX_OPTIONS.find(o => o.value === rule.prefix)?.color}`}
                        >
                          {PREFIX_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                     </div>

                     <div className="relative group/input">
                        <textarea 
                          value={rule.logicValue}
                          onChange={(e) => updateRule(rule.id, { logicValue: e.target.value })}
                          placeholder="Define the logic for this field..."
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 min-h-[80px] resize-none"
                        />
                        <button 
                          onClick={() => {
                             const nextRules = localReq.compliance?.rules.filter(r => r.id !== rule.id);
                             setLocalReq({...localReq, compliance: { ...localReq.compliance!, rules: nextRules! }})
                          }}
                          className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                     </div>
                   </div>
                 ))}
               </div>
            </section>

            {/* ROUTING */}
            <section className="pt-8 border-t border-slate-100 space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-500" /> Human Gatekeeper</h4>
              <select 
                value={localReq.fallbackApprover}
                onChange={(e) => setLocalReq({ ...localReq, fallbackApprover: e.target.value as ApproverGroup })}
                className="w-full border border-slate-200 rounded-xl p-3 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="HR">Human Resources</option>
                <option value="LEGAL">Legal / Compliance</option>
                <option value="IT">IT Infrastructure</option>
                <option value="SECURITY">Security / Backgrounds</option>
              </select>
            </section>
          </div>

          <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
            <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500">Cancel</button>
            <button onClick={() => onSave(localReq)} className="px-8 py-2.5 bg-slate-900 text-white text-sm font-black rounded-xl shadow-lg hover:bg-black transition-all">Save Governance</button>
          </div>
        </div>

        {/* SIMULATION SIDE */}
        {showPreview && (
          <div className="w-[400px] border-l border-slate-100 bg-slate-50/80 p-8 animate-in slide-in-from-right duration-500">
             <div className="flex items-center gap-2 mb-8">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logic Interpreter</h4>
             </div>
             
             <div className="space-y-6">
                <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={60} /></div>
                   <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-4">Current Instruction Set</p>
                   <div className="space-y-4">
                      {localReq.compliance?.rules.map((rule, idx) => (
                        <div key={idx} className="border-l-2 border-cyan-400/30 pl-3 py-1">
                           <span className="text-[10px] font-black text-slate-400 block mb-1 uppercase tracking-tighter">{rule.field || 'General Scan'}</span>
                           <p className="text-xs font-medium leading-relaxed">
                              <span className="font-black text-cyan-400 mr-1 italic">[{PREFIX_OPTIONS.find(o => o.value === rule.prefix)?.label}]</span>
                              {rule.logicValue || '...'}
                           </p>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 flex gap-4 items-start">
                   <div className="p-2 bg-amber-50 rounded-lg text-amber-600"><Info size={16} /></div>
                   <div>
                      <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">Governance Note</p>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed italic">
                        The AI will prioritize "Must Have" conditions. If any "Must Have" condition fails, the confidence score will drop significantly regardless of other matches.
                      </p>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  )
}