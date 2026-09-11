# Enfoca

Frontend de una experiencia para conocer preferencias laborales, completar evaluaciones y explorar vacantes compatibles.

## Ejecutar localmente

```powershell
pnpm install
pnpm dev
```

## Validar producción

```powershell
pnpm build
```

## Estado actual

- React, TypeScript y Vite.
- Flujo completo de datos básicos, preguntas, evaluaciones y resultados.
- Respuestas persistidas solo en `localStorage`.
- Preguntas, evaluaciones y vacantes mock centralizadas en `src/data.ts` para sustituirlas posteriormente por la API del backend.
