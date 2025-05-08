; Script personalizado para el instalador de Inventario Pro

; Branding personalizado
!define MANUFACTURER "Inventario Pro"
; No definimos PRODUCT_NAME porque ya lo define electron-builder
!define PRODUCT_VERSION "${version}"
!define COPYRIGHT "Copyright © 2025"

; Personalizar el título y mensajes del instalador
Caption "${PRODUCT_NAME} ${PRODUCT_VERSION} - Asistente de Instalación"
SubCaption 0 " - Acuerdo de Licencia"
SubCaption 1 " - Opciones de Instalación"
SubCaption 2 " - Configuración de Empresa"
SubCaption 3 " - Instalando Archivos"
SubCaption 4 " - Completado"
BrandingText "${MANUFACTURER} | ${COPYRIGHT}"

; Personalizar mensajes del instalador
MiscButtonText "Atrás" "Siguiente" "Cancelar" "Cerrar"
DetailsButtonText "Detalles"
InstallButtonText "Instalar"
UninstallButtonText "Desinstalar"
ShowInstDetails show
ShowUninstDetails show

; Variables para la configuración
Var CompanyName
Var IsNewInstallation
Var LaunchAfterInstall
Var DbConnectionString
Var DbUserName
Var DbPassword
Var DbHost
Var DbPort
Var DbName

; Páginas personalizadas
Page custom CompanyNamePage CompanyNamePageLeave
Page custom DatabaseConfigPage DatabaseConfigPageLeave
Page instfiles

; Callback para páginas personalizadas
Function .onInit
  ; Mostrar splash screen mientras se carga el instalador
  InitPluginsDir
  File /oname=$PLUGINSDIR\splash.bmp "src\assets\splash.bmp"
  splash::show 1500 $PLUGINSDIR\splash
  Pop $0
  
  ; Valor predeterminado para la instalación
  StrCpy $IsNewInstallation "1"
  StrCpy $LaunchAfterInstall "1"
  
  ; Valores predeterminados para base de datos
  StrCpy $DbHost "localhost"
  StrCpy $DbPort "5432"
  StrCpy $DbName "inventario_pro"
FunctionEnd

; Página para configurar el nombre de la empresa
Function CompanyNamePage
  nsDialogs::Create 1018
  Pop $0
  
  ${If} $0 == error
    Abort
  ${EndIf}
  
  ; Título de la página
  ${NSD_CreateLabel} 0 0 100% 20u "Configuración inicial"
  Pop $0
  
  ; Subtítulo/descripción
  ${NSD_CreateLabel} 0 20u 100% 30u "Por favor, introduce el nombre de tu empresa. Este nombre será utilizado como identificador en el sistema."
  Pop $0
  
  ; Campo para el nombre de la empresa
  ${NSD_CreateLabel} 0 55u 100% 12u "Nombre de la empresa:"
  Pop $0
  
  ${NSD_CreateText} 0 70u 100% 15u ""
  Pop $CompanyName
  
  ; Opción para nueva instalación o conectar a existente
  ${NSD_CreateRadioButton} 0 100u 100% 15u "Nueva instalación (crear nueva base de datos)"
  Pop $0
  ${NSD_Check} $0
  
  ${NSD_CreateRadioButton} 0 120u 100% 15u "Conectar a una base de datos existente"
  Pop $1
  
  ; Opción para iniciar automáticamente después de instalar
  ${NSD_CreateCheckbox} 0 150u 100% 15u "Iniciar Inventario Pro automáticamente después de la instalación"
  Pop $LaunchAfterInstall
  ${NSD_Check} $LaunchAfterInstall
  
  nsDialogs::Show
FunctionEnd

Function CompanyNamePageLeave
  ${NSD_GetText} $CompanyName $0
  
  ; Validar que el nombre de la empresa no esté vacío
  ${If} $0 == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Por favor, introduce el nombre de tu empresa."
    Abort
  ${EndIf}
  
  ; Marcar que la configuración fue completada a través del instalador
  ; Estos valores se guardarán en el registro para su uso posterior por la aplicación
  WriteRegStr HKCU "Software\${MANUFACTURER}\${PRODUCT_NAME}" "CompanyName" $0
  WriteRegStr HKCU "Software\${MANUFACTURER}\${PRODUCT_NAME}" "IsNewInstallation" $IsNewInstallation
  WriteRegStr HKCU "Software\${MANUFACTURER}\${PRODUCT_NAME}" "SetupCompleted" "1"
FunctionEnd

; Página para configurar la conexión a la base de datos
Function DatabaseConfigPage
  nsDialogs::Create 1018
  Pop $0
  
  ${If} $0 == error
    Abort
  ${EndIf}
  
  ; Título de la página
  ${NSD_CreateLabel} 0 0 100% 20u "Configuración de la Base de Datos"
  Pop $0
  
  ; Subtítulo/descripción
  ${NSD_CreateLabel} 0 20u 100% 30u "Por favor, proporciona la información de conexión a tu base de datos. Esta información se utilizará para conectar la aplicación a tu servidor de base de datos."
  Pop $0
  
  ; Campos para la configuración de la base de datos
  ${NSD_CreateLabel} 0 55u 100% 12u "Servidor (Host):"
  Pop $0
  ${NSD_CreateText} 0 70u 100% 15u "$DbHost"
  Pop $DbHost
  
  ${NSD_CreateLabel} 0 90u 100% 12u "Puerto:"
  Pop $0
  ${NSD_CreateText} 0 105u 100% 15u "$DbPort"
  Pop $DbPort
  
  ${NSD_CreateLabel} 0 125u 100% 12u "Nombre de la Base de Datos:"
  Pop $0
  ${NSD_CreateText} 0 140u 100% 15u "$DbName"
  Pop $DbName
  
  ${NSD_CreateLabel} 0 160u 100% 12u "Usuario:"
  Pop $0
  ${NSD_CreateText} 0 175u 100% 15u ""
  Pop $DbUserName
  
  ${NSD_CreateLabel} 0 195u 100% 12u "Contraseña:"
  Pop $0
  ${NSD_CreatePassword} 0 210u 100% 15u ""
  Pop $DbPassword
  
  nsDialogs::Show
FunctionEnd

Function DatabaseConfigPageLeave
  ; Obtener valores de los campos
  ${NSD_GetText} $DbHost $R0
  ${NSD_GetText} $DbPort $R1
  ${NSD_GetText} $DbName $R2
  ${NSD_GetText} $DbUserName $R3
  ${NSD_GetText} $DbPassword $R4
  
  ; Validar que los campos obligatorios no estén vacíos
  ${If} $R0 == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Por favor, introduce el servidor de la base de datos."
    Abort
  ${EndIf}
  
  ${If} $R1 == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Por favor, introduce el puerto de la base de datos."
    Abort
  ${EndIf}
  
  ${If} $R2 == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Por favor, introduce el nombre de la base de datos."
    Abort
  ${EndIf}
  
  ${If} $R3 == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Por favor, introduce el usuario de la base de datos."
    Abort
  ${EndIf}
  
  ; Construir cadena de conexión
  StrCpy $DbConnectionString "postgresql://$R3:$R4@$R0:$R1/$R2"
  
  ; Guardar la configuración de la base de datos
  WriteRegStr HKCU "Software\${MANUFACTURER}\${PRODUCT_NAME}" "DbConnectionString" $DbConnectionString
  
  ; Crear archivo .env con la configuración
  FileOpen $0 "$INSTDIR\.env" w
  FileWrite $0 "DATABASE_URL=$DbConnectionString$\r$\n"
  FileWrite $0 "DB_HOST=$R0$\r$\n"
  FileWrite $0 "DB_PORT=$R1$\r$\n"
  FileWrite $0 "DB_NAME=$R2$\r$\n"
  FileWrite $0 "DB_USER=$R3$\r$\n"
  FileWrite $0 "DB_PASSWORD=$R4$\r$\n"
  FileClose $0
FunctionEnd

; Callback después de la instalación
Function .onInstSuccess
  ${If} $LaunchAfterInstall == 1
    MessageBox MB_YESNO "¡La instalación se ha completado con éxito! ¿Desea iniciar Inventario Pro ahora?" IDNO NoLaunch
      Exec "$INSTDIR\${PRODUCT_NAME}.exe"
    NoLaunch:
  ${EndIf}
FunctionEnd 