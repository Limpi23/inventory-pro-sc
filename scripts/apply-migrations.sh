#!/bin/bash

# Script para aplicar migraciones en Supabase
echo "Aplicando migraciones a la base de datos..."
npm run db:migration:apply

echo "Migraciones aplicadas con éxito"
echo "Ahora los campos de cliente están disponibles en la base de datos" 