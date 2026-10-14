import { Info } from 'lucide-react';

export default function About() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">About SmartOffice</h1>
        <p className="text-slate-500 text-sm mt-0.5">Project background and team metadata</p>
      </div>

      {/* Project Metadata */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <Info size={18} className="text-slate-600" />
          <h3 className="text-sm font-bold text-slate-900">Project Information</h3>
        </div>
        <div className="space-y-3 text-sm">
          <InfoRow label="Project Title" value="Design and Simulation of an Intelligent IoT-Based Smart Office Network and Energy Optimization System" />
          <InfoRow label="Module" value="IoT Sensor Integration and System Architecture Implementation" />
          <InfoRow label="Student Name" value="Tenzin Wangchu Khongsai" />
          <InfoRow label="Register Number" value="192511447" />
          <InfoRow label="Team Number" value="10" />
          <InfoRow label="Degree" value="BE Computer Science Engineering" />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 font-medium flex-shrink-0 text-xs">{label}</span>
      <span className="text-slate-900 font-bold text-xs text-right">{value}</span>
    </div>
  );
}
