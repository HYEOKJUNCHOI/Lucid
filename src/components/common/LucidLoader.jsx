import React from 'react';

const LucidLoader = ({ text = "Initializing..." }) => {
  return (
    <div className="flex items-center justify-center p-20 bg-transparent overflow-hidden">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-theme-primary/20 border-t-theme-primary rounded-full animate-spin"></div>
        <div className="text-theme-primary/40 text-[11px] font-medium tracking-widest uppercase italic">
          {text}
        </div>
      </div>
    </div>
  );
};

export default LucidLoader;
