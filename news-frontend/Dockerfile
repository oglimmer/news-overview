# Use the official Node.js image as the base image
FROM node:22-alpine

# make REST API URL configurable via environment variable
ARG API_URL
ARG API_USER
ARG API_PASSWORD

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Vue application
RUN npm run build

# Use the official Nginx image to serve the built application
FROM nginx:alpine

# Copy the built files from the previous stage
COPY --from=0 /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]