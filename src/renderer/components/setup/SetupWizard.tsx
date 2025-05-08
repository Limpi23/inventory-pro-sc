import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Steps, Step } from '../ui/steps';
import DatabaseSetup from './DatabaseSetup';
import CompanySetup from './CompanySetup';
import SetupComplete from './SetupComplete';

interface SetupWizardProps {
  onComplete: () => void;
  isFirstRun: boolean;
}

type StepType = 'database' | 'company' | 'complete';

// Datos de configuración que se recopilarán durante el proceso
interface SetupData {
  database: {
    setupType: 'new' | 'existing';
    companyName?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
  };
  company: {
    name: string;
    taxId: string;
    address: string;
    phone: string;
    email?: string;
    website?: string;
    logoUrl?: string;
  };
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, isFirstRun }) => {
  const [currentStep, setCurrentStep] = useState<StepType>('database');
  const [setupData, setSetupData] = useState<Partial<SetupData>>({});
  
  const goToNextStep = () => {
    switch (currentStep) {
      case 'database':
        setCurrentStep('company');
        break;
      case 'company':
        setCurrentStep('complete');
        break;
      case 'complete':
        finishSetup();
        break;
    }
  };
  
  const handleDatabaseSetup = (values: any) => {
    setSetupData(prev => ({
      ...prev,
      database: values
    }));
    goToNextStep();
  };
  
  const handleCompanySetup = (values: any) => {
    setSetupData(prev => ({
      ...prev,
      company: values
    }));
    goToNextStep();
  };
  
  const finishSetup = () => {
    // Aquí guardamos la configuración y completamos el setup
    // Para una instalación real, aquí crearíamos la base de datos 
    // o nos conectaríamos a una existente
    
    // Guardar la información de la empresa
    if (setupData.company) {
      localStorage.setItem('companySettings', JSON.stringify(setupData.company));
    }
    
    // Guardar la configuración de la base de datos
    if (setupData.database) {
      const { supabaseUrl, supabaseKey } = setupData.database;
      if (supabaseUrl && supabaseKey) {
        localStorage.setItem('supabaseConfig', JSON.stringify({ 
          url: supabaseUrl, 
          key: supabaseKey 
        }));
      }
    }
    
    // Marcar la aplicación como configurada
    localStorage.setItem('appConfigured', 'true');
    
    // Notificar al componente padre que el setup está completo
    onComplete();
  };
  
  const getStepNumber = (step: StepType): number => {
    switch (step) {
      case 'database': return 0;
      case 'company': return 1;
      case 'complete': return 2;
      default: return 0;
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-4xl p-6">
        <div className="mb-6">
          <Steps currentStep={getStepNumber(currentStep)} className="mb-8">
            <Step title="Base de datos" />
            <Step title="Empresa" />
            <Step title="Finalizar" />
          </Steps>
        </div>
        
        {currentStep === 'database' && (
          <DatabaseSetup 
            onComplete={handleDatabaseSetup} 
            isFirstRun={isFirstRun} 
          />
        )}
        
        {currentStep === 'company' && (
          <CompanySetup 
            onComplete={handleCompanySetup} 
            initialData={setupData.database?.companyName || ''}
          />
        )}
        
        {currentStep === 'complete' && (
          <SetupComplete 
            setupData={setupData} 
            onComplete={finishSetup} 
          />
        )}
      </Card>
    </div>
  );
};

export default SetupWizard; 