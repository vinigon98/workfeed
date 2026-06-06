@echo off
title Radar Corp - Assistente de Deploy Firebase
color 0F

echo ======================================================================
echo          RADAR CORP - ASSISTENTE DE IMPLANTACAO GOOGLE FIREBASE
echo ======================================================================
echo.
echo Este script automatiza o preparo e a publicacao da sua Landing Page
echo comercial e do seu Servidor de API (Cloud Functions) no Firebase.
echo.
echo ======================================================================
echo PASSO 1: Verificando pre-requisitos...
echo ======================================================================

:: Verifica se o Node.js esta instalado
node -v >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERRO] O Node.js nao foi encontrado no sistema.
    echo Por favor, instale o Node.js em https://nodejs.org/ antes de continuar.
    echo.
    pause
    exit /b
)
echo [OK] Node.js detectado.

:: Verifica se o Firebase CLI esta instalado
call firebase --version >nul 2>&1
if errorlevel 1 goto INSTALL_FIREBASE
goto FIREBASE_OK

:INSTALL_FIREBASE
echo [AVISO] Firebase Tools CLI nao encontrado. Instalando globalmente...
echo Executando: npm install -g firebase-tools
call npm install -g firebase-tools
if errorlevel 1 (
    color 0C
    echo [ERRO] Falha ao instalar o Firebase Tools CLI.
    echo Execute o terminal como Administrador e tente novamente.
    pause
    exit /b
)

:FIREBASE_OK
echo [OK] Firebase Tools CLI detectado.
echo.

echo ======================================================================
echo PASSO 2: Autenticacao no Firebase
echo ======================================================================
echo Um navegador sera aberto para voce realizar o login no Google Firebase.
echo Se voce ja estiver logado, o processo avancara automaticamente.
echo.
call firebase login
echo.

echo ======================================================================
echo PASSO 3: Instalando dependencias das Cloud Functions
echo ======================================================================
echo Entrando no diretorio de funcoes para instalar as dependencias...
cd functions
call npm install
if errorlevel 1 (
    color 0C
    echo [ERRO] Falha ao instalar as dependencias da API do Firebase.
    cd ..
    pause
    exit /b
)
cd ..
echo [OK] Dependencias instaladas com sucesso!
echo.

echo ======================================================================
echo PASSO 4: Vinculando ao seu Projeto do Firebase
echo ======================================================================
echo Vamos listar seus projetos ativos no Firebase.
echo.
call firebase projects:list
echo.
set /p PROJ_ID="Digite o ID do projeto do Firebase para usar (Deixe em branco para ignorar): "
if "%PROJ_ID%"=="" goto SKIP_USE
call firebase use --add %PROJ_ID%
:SKIP_USE
echo.

echo ======================================================================
echo PASSO 5: Publicacao unificada (Firebase Deploy)
echo ======================================================================
echo Inciando o deploy completo (Landing Page + Cloud Functions de API)...
echo.
call firebase deploy
if errorlevel 1 (
    color 0C
    echo.
    echo [ERRO] Ocorreu uma falha durante o deploy.
    echo Verifique os detalhes do erro acima no terminal.
    echo Se necessario, inicialize o projeto com "firebase init" e tente novamente.
    pause
    exit /b
)

color 0A
echo.
echo ======================================================================
echo SUCESSO! SEU PROJETO RADAR CORP ESTA NO AR!
echo ======================================================================
echo.
echo O site (Front-end) e a API (Back-end) ja estao ativos na nuvem do Google.
echo Seus leads serao salvos de forma 100% segura no Google Cloud Firestore!
echo.
echo Acesse o console do Firebase para gerenciar seu projeto e seu banco:
echo https://console.firebase.google.com/
echo.
pause
