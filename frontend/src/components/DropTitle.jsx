import React from 'react';

export default function DropTitle({ dropNumber = '001' }) {
  return (
    <div className="w-full bg-[#fdf8ee] py-2 flex justify-center">
      <h2 className="text-[30px] md:text-[40px] italic font-semibold font-main tracking-tight text-[#975023] drop-shadow-[2px_2px_0_#ffefd1]">
        Drop #{dropNumber}
      </h2>
    </div>
  );
}
