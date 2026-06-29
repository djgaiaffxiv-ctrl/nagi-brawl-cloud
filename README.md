# NAGI BRAWL — Robot 24/7 ☁️

Captura tu historial de Brawl Stars **cada 5 minutos, las 24 horas**, aunque tu PC esté
apagado. Corre gratis en GitHub Actions. La app de escritorio luego se sincroniza con
`data/battles.json` y fusiona todo.

## Puesta en marcha (una vez)
1. **Token** (lo pones tú, es secreto):
   - Repo → **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `BS_TOKEN` · Value: tu token de developer.brawlstars.com.
2. **Etiqueta(s)** (ya configurada como variable `BS_TAGS`; puedes añadir más separadas por comas).
3. **Activar**: pestaña **Actions** → si pide habilitar workflows, dale a *"I understand… enable"*.
   Pulsa **Run workflow** una vez para arrancar; luego va solo cada 5 min.

> Funciona en repos **públicos** (minutos de Actions gratis e ilimitados). Los datos son
> solo estadísticas de juego. El token va como **secreto cifrado**, nunca se publica.

© 2026 NAGI STUDIOS
