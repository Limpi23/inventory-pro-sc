!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!undef MUI_WELCOMEFINISHPAGE_BITMAP
!undef MUI_UNWELCOMEFINISHPAGE_BITMAP
; Script personalizado para el instalador de Inventario Pro con configuración de Supabase

!define MANUFACTURER "Inventario Pro"
!define PRODUCT_VERSION "${version}"
!define COPYRIGHT "Copyright © 2025"

Caption "Inventario Pro - SC ${PRODUCT_VERSION} - Instalación"
BrandingText "${MANUFACTURER} | ${COPYRIGHT}"

; Mensajes básicos
MiscButtonText "Atrás" "Siguiente" "Cancelar" "Cerrar"
DetailsButtonText "Detalles"
InstallButtonText "Instalar"
UninstallButtonText "Desinstalar"
ShowInstDetails show
ShowUninstDetails show

Var SupabaseUrl
Var SupabaseAnonKey

; Páginas estándar: bienvenida, ruta, instalación, finalización
Page directory
Page custom SupabaseConfigPage SupabaseConfigPageLeave
Page instfiles
Page finish

; Callback de inicio (puede quedar vacío)
Function .onInit
FunctionEnd

Function SupabaseConfigPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 20u "Configuración de Supabase"
  Pop $0
  ${NSD_CreateLabel} 0 20u 100% 30u "Por favor, introduce la URL y la ANON KEY de tu proyecto Supabase."
  Pop $0

  ${NSD_CreateLabel} 0 55u 100% 12u "Supabase URL:"
  Pop $0
  ${NSD_CreateText} 0 70u 100% 15u ""
  Pop $SupabaseUrl

  ${NSD_CreateLabel} 0 100u 100% 12u "Supabase ANON KEY:"
  Pop $0
  ${NSD_CreateText} 0 115u 100% 15u ""
  Pop $SupabaseAnonKey

  nsDialogs::Show
FunctionEnd

Function SupabaseConfigPageLeave
  ${NSD_GetText} $SupabaseUrl $0
  ${NSD_GetText} $SupabaseAnonKey $1

  ${If} $0 == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Por favor, introduce la URL de Supabase."
    Abort
  ${EndIf}
  ${If} $1 == ""
    MessageBox MB_OK|MB_ICONEXCLAMATION "Por favor, introduce la ANON KEY de Supabase."
    Abort
  ${EndIf}

  ; Guardar en archivo .env en el directorio de instalación
  FileOpen $2 "$INSTDIR\.env" w
  FileWrite $2 "SUPABASE_URL=$0$\r$\n"
  FileWrite $2 "SUPABASE_ANON_KEY=$1$\r$\n"
  FileClose $2
FunctionEnd

; Callback después de la instalación
Function .onInstSuccess
  MessageBox MB_OK|MB_ICONINFORMATION "¡La instalación se ha completado con éxito!"
FunctionEnd 