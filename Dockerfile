# Use the official Node.js LTS image as the base image
FROM node:18-alpine

# Install system dependencies required for canvas and other native modules
RUN apk add --no-cache \
    build-base \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    python3 \
    make \
    gcc \
    g++

# Create and set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install application dependencies
RUN npm install --production

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on (from your .env or default 4444)
EXPOSE 4444

# Set environment variables
ENV NODE_ENV=production

# Command to run the application
CMD ["node", "index.js"]
