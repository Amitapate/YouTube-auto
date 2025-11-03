
import React from 'react';

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick, icon }) => {
  return (
    <button
      onClick={onClick}
      className={`flex-1 sm:flex-none flex sm:flex-col items-center justify-center p-3 sm:p-4 rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 ${
        isActive
          ? 'bg-purple-600 text-white shadow-lg'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      <div className="w-6 h-6 sm:w-8 sm:h-8 mb-0 sm:mb-2 mr-3 sm:mr-0">{icon}</div>
      <span className="text-sm sm:text-base font-medium">{label}</span>
    </button>
  );
};

export default TabButton;
