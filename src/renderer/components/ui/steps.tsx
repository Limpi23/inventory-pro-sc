import React from 'react';
import { cn } from '../../lib/utils';

interface StepsProps {
  children: React.ReactNode;
  currentStep: number;
  className?: string;
}

export const Steps: React.FC<StepsProps> = ({ 
  children, 
  currentStep,
  className
}) => {
  // Convierte los hijos en un array para manejarlos
  const steps = React.Children.toArray(children);
  
  return (
    <div className={cn("flex items-center justify-between w-full", className)}>
      {steps.map((step, index) => {
        // Añade propiedades a cada Step
        return React.cloneElement(step as React.ReactElement, {
          stepNumber: index,
          isActive: index === currentStep,
          isCompleted: index < currentStep,
          isLast: index === steps.length - 1,
          key: index,
        });
      })}
    </div>
  );
};

interface StepProps {
  title: string;
  stepNumber?: number;
  isActive?: boolean;
  isCompleted?: boolean;
  isLast?: boolean;
}

export const Step: React.FC<StepProps> = ({ 
  title, 
  stepNumber = 0, 
  isActive = false,
  isCompleted = false,
  isLast = false
}) => {
  return (
    <div className="flex flex-col items-center flex-1">
      <div className="flex items-center relative">
        {/* Número o check del paso */}
        <div 
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-full border-2 z-10",
            isActive && "border-primary bg-primary text-primary-foreground",
            isCompleted && "border-primary bg-primary text-primary-foreground",
            !isActive && !isCompleted && "border-muted-foreground"
          )}
        >
          {isCompleted ? (
            <svg 
              className="w-6 h-6" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          ) : (
            <span>{stepNumber + 1}</span>
          )}
        </div>
        
        {/* Línea conectora */}
        {!isLast && (
          <div 
            className={cn(
              "absolute left-10 w-full h-0.5",
              isCompleted ? "bg-primary" : "bg-muted-foreground"
            )}
          />
        )}
      </div>
      
      {/* Título del paso */}
      <div className="mt-2 text-sm text-center">
        <span 
          className={cn(
            "font-medium",
            isActive && "text-primary",
            isCompleted && "text-primary",
            !isActive && !isCompleted && "text-muted-foreground"
          )}
        >
          {title}
        </span>
      </div>
    </div>
  );
}; 