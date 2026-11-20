@echo off
title Zingify - update playlist
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\update-playlist.ps1"
pause
