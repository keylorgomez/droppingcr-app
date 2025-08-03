import React from "react";
import { useTranslation } from "react-i18next";
import { Typewriter } from "react-simple-typewriter";

export default function TypewriterBanner() {
    const { t: informationCardTranslate } = useTranslation("informationCardFlow");
  return (
     <div className="max-w-3xl mx-auto mt-8 bg-[#fdf8ee] rounded-2xl border border-[#f0e3d0] shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.12)] transition-shadow duration-300 px-4 py-6 text-center">
      
      <span className="text-[#975023] text-xl md:text2xl font-bold">
        {informationCardTranslate("primaryInfo")}
      </span>

      <div className="text-[#6d6767] text-xl md:text-2xl font-semibold italic h-[40px] mt-2">
        <Typewriter
          words={[informationCardTranslate("phrase1"), informationCardTranslate("phrase2"), informationCardTranslate("phrase3")]}
          loop={0}
          cursor
          cursorStyle="|"
          typeSpeed={70}
          deleteSpeed={50}
          delaySpeed={1800}
        />
      </div>

      <span className="text-[#975023] text-xl md:text-xl font-semibold">
        {informationCardTranslate("nextNewDrop")}
      </span>

    </div>
  );
}
