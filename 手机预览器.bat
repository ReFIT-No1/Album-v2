@echo off
for %%F in ("%~dp0*.html") do (
  if /I not "%%~nxF"=="index.html" start "" "%%~fF"
)
exit /b
