FROM node:22-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application source code and Prisma schema
COPY . .

# Generate Prisma client for the container environment
RUN npx prisma generate

# Expose the Express port
EXPOSE 8080

# Command to run the application
CMD ["npm", "run", "dev"]