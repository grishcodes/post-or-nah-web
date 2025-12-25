FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build the backend
RUN npm run build:backend

# Expose the port the app runs on
EXPOSE 3001

# Start the server
CMD ["npm", "run", "start:backend"]
