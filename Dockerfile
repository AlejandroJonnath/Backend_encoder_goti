# Usamos una imagen oficial de Node.js ligera basada en Alpine o Debian.
# Usar Debian (slim) suele ser más fácil para instalar Ghostscript.
FROM node:20-slim

# Actualizamos los repositorios e instalamos Ghostscript
RUN apt-get update && apt-get install -y ghostscript && rm -rf /var/lib/apt/lists/*

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos las dependencias de Node.js
RUN npm install --production

# Copiamos el resto del código del backend
COPY . .

# Creamos la carpeta uploads por si no existe
RUN mkdir -p uploads

# Exponemos el puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["npm", "start"]
