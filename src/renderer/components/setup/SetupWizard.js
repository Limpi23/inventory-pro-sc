import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Card } from '../ui/card';
import { Steps, Step } from '../ui/steps';
import DatabaseSetup from './DatabaseSetup';
import CompanySetup from './CompanySetup';
import SetupComplete from './SetupComplete';
const SetupWizard = ({ onComplete, isFirstRun }) => {
    const [currentStep, setCurrentStep] = useState('database');
    const [setupData, setSetupData] = useState({});
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
    const handleDatabaseSetup = (values) => {
        setSetupData(prev => ({
            ...prev,
            database: values
        }));
        goToNextStep();
    };
    const handleCompanySetup = (values) => {
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
    const getStepNumber = (step) => {
        switch (step) {
            case 'database': return 0;
            case 'company': return 1;
            case 'complete': return 2;
            default: return 0;
        }
    };
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4", children: _jsxs(Card, { className: "w-full max-w-4xl p-6", children: [_jsx("div", { className: "mb-6", children: _jsxs(Steps, { currentStep: getStepNumber(currentStep), className: "mb-8", children: [_jsx(Step, { title: "Base de datos" }), _jsx(Step, { title: "Empresa" }), _jsx(Step, { title: "Finalizar" })] }) }), currentStep === 'database' && (_jsx(DatabaseSetup, { onComplete: handleDatabaseSetup, isFirstRun: isFirstRun })), currentStep === 'company' && (_jsx(CompanySetup, { onComplete: handleCompanySetup, initialData: setupData.database?.companyName || '' })), currentStep === 'complete' && (_jsx(SetupComplete, { setupData: setupData, onComplete: finishSetup }))] }) }));
};
export default SetupWizard;
