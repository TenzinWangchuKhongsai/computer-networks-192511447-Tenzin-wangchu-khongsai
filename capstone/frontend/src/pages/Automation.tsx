import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { fetchAutomationRules, updateAutomationRule } from '../services/api';
import { Zap, Shield, ShieldOff } from 'lucide-react';
import type { AutomationRule } from '../types';

export default function Automation() {
  const { automationRules, setAutomationRules } = useAppStore();
  const [editingThreshold, setEditingThreshold] = useState<{ id: number; value: string } | null>(null);

  useEffect(() => {
    fetchAutomationRules().then(setAutomationRules).catch(console.error);
  }, []);

  const handleToggle = async (rule: AutomationRule) => {
    try {
      const updated = await updateAutomationRule(rule.id, { enabled: !rule.enabled });
      setAutomationRules(automationRules.map(r => r.id === rule.id ? updated : r));
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleThresholdSave = async (rule: AutomationRule) => {
    if (!editingThreshold) return;
    const val = parseFloat(editingThreshold.value);
    if (isNaN(val) || val < 0) return;
    try {
      const updated = await updateAutomationRule(rule.id, { threshold: val });
      setAutomationRules(automationRules.map(r => r.id === rule.id ? updated : r));
      setEditingThreshold(null);
    } catch (err) {
      console.error('Failed to update threshold:', err);
    }
  };

  const conditionLabels: Record<string, string> = {
    empty_room: 'Room is empty (no occupancy detected)',
    low_light: 'Ambient light level falls below threshold',
    high_light: 'Ambient light level rises above threshold',
    high_temperature: 'Temperature rises above threshold',
    moderate_temperature: 'Temperature above comfort level',
    comfortable_temperature: 'Temperature drops to comfortable level',
  };

  const actionLabels: Record<string, string> = {
    turn_on: '↑ Switch ON',
    turn_off: '↓ Switch OFF',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Automation Rule Engine</h1>
        <p className="text-slate-500 text-sm mt-0.5">Configure rule-based automation parameters for intelligent device control</p>
      </div>

      {/* Engine Status */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Zap size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Central Automation Processor Active</h3>
            <p className="text-xs font-medium text-slate-600">
              {automationRules.filter(r => r.enabled).length} of {automationRules.length} rules active
            </p>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {automationRules.map(rule => (
          <div
            key={rule.id}
            className={`rounded-xl border p-5 transition-all shadow-2xs ${
              rule.enabled
                ? 'bg-white border-slate-200'
                : 'bg-slate-50 border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {rule.enabled ? (
                    <Shield size={16} className="text-emerald-600" />
                  ) : (
                    <ShieldOff size={16} className="text-slate-400" />
                  )}
                  <h3 className="text-base font-bold text-slate-900">{rule.name}</h3>
                </div>
                <p className="text-xs font-medium text-slate-600 mb-3">{rule.description}</p>

                {/* Condition & Action */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 font-medium text-slate-700 rounded-md">
                    IF: {conditionLabels[rule.condition_type] || rule.condition_type}
                  </span>
                  <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-md font-bold">
                    THEN: {actionLabels[rule.action_type] || rule.action_type} {rule.action_device}
                  </span>
                </div>

                {/* Threshold */}
                {rule.threshold !== null && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500">Configured Threshold:</span>
                    {editingThreshold?.id === rule.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={editingThreshold.value}
                          onChange={(e) => setEditingThreshold({ id: rule.id, value: e.target.value })}
                          className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-900 font-bold"
                          step="0.5"
                        />
                        <button
                          onClick={() => handleThresholdSave(rule)}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded-md text-xs font-bold hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingThreshold(null)}
                          className="px-2 py-1 bg-slate-200 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingThreshold({ id: rule.id, value: String(rule.threshold) })}
                        className="px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-md text-xs font-bold text-slate-900 hover:border-blue-500 transition-colors"
                      >
                        {rule.threshold}{rule.condition_type.includes('temperature') ? '°C' : '%'} (Click to Edit)
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Toggle */}
              <button
                onClick={() => handleToggle(rule)}
                className={`relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${
                  rule.enabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-300 ${
                  rule.enabled ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
