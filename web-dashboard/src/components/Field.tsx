import React from 'react';

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block font-medium text-slate-200">{label}</span>
      {children}
    </label>
  );
}
