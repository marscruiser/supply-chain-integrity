FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose Vite default port
EXPOSE 3000

# Start preview/dev server. In production, we'd build and serve statically.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
