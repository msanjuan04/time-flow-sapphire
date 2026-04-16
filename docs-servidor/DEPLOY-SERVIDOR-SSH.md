# Desplegar la app en tu servidor (VPS por SSH)

Conexión: `ssh root@46.101.185.148` (o el usuario que uses).

## Opción A: Build en tu máquina y subir solo `dist/`

1. **En tu Mac (en el proyecto)** — con las variables en `.env`:
   ```bash
   npm run build
   ```
2. **Subir la carpeta `dist/` al servidor**:
   ```bash
   rsync -avz --delete dist/ root@46.101.185.148:/var/www/time-flow-sapphire/dist/
   ```
   Si la ruta en el servidor no existe, créala antes por SSH:
   ```bash
   ssh root@46.101.185.148 "mkdir -p /var/www/time-flow-sapphire/dist"
   ```

## Opción B: Build en el servidor

1. **Entrar por SSH**:
   ```bash
   ssh root@46.101.185.148
   ```
2. **Instalar Node 18+** (si no está):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt-get install -y nodejs
   ```
3. **Subir el código** (desde tu Mac, en otra terminal):
   ```bash
   rsync -avz --exclude node_modules --exclude .git . root@46.101.185.148:/var/www/time-flow-sapphire/
   ```
4. **En el servidor**, crear `.env` con las variables de producción y hacer build:
   ```bash
   cd /var/www/time-flow-sapphire
   nano .env   # pega VITE_SUPABASE_URL=..., VITE_SUPABASE_ANON_KEY=..., etc.
   npm ci
   npm run build
   ```

## Nginx: servir la app y SPA

1. **En el servidor**, instalar nginx si no está:
   ```bash
   apt update && apt install -y nginx
   ```
2. **Copiar la config de ejemplo** (o crearla):
   - En tu repo está `docs-servidor/nginx-time-flow.conf.example`.
   - En el servidor:
     ```bash
     nano /etc/nginx/sites-available/time-flow
     ```
   - Pega el contenido del ejemplo y ajusta:
     - `server_name`: tu dominio (ej. `gneraitiq.com`) o deja la IP.
     - `root`: ruta donde está `dist/`, ej. `/var/www/time-flow-sapphire/dist`.
3. **Activar el sitio y comprobar**:
   ```bash
   ln -sf /etc/nginx/sites-available/time-flow /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   ```
4. **Asegurar que la ruta existe** y que nginx puede leerla:
   ```bash
   mkdir -p /var/www/time-flow-sapphire/dist
   chown -R www-data:www-data /var/www/time-flow-sapphire
   ```

## Resumen de pasos una vez conectado (SSH)

```bash
# 1. Conectar
ssh root@46.101.185.148

# 2. Ir al proyecto (si ya está clonado/subido)
cd /var/www/time-flow-sapphire

# 3. Si actualizaste código: pull o rsync desde tu Mac, luego:
npm ci
# Crear/editar .env con VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_PROJECT_ID, VITE_PUBLIC_SITE_URL, VITE_MAPBOX_PUBLIC_TOKEN
npm run build

# 4. Si nginx ya está configurado, no hace falta reiniciar; solo asegura que root apunta a .../dist
nginx -t && systemctl reload nginx
```

## Variables que debe tener el build (en `.env` del servidor o en tu máquina al hacer build)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_PUBLIC_SITE_URL` (ej. `https://gneraitiq.com`)
- `VITE_MAPBOX_PUBLIC_TOKEN` (opcional)

Recuerda: si cambias variables, hay que volver a hacer `npm run build` y, si usas Opción A, volver a subir `dist/` con rsync.
