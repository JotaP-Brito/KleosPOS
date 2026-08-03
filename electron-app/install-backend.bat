@echo off
echo Instalando dependencias do backend...
cd /d "%~dp0..\pos-backend"
npm install --production
echo Pronto! Pode iniciar a aplicação.
pause