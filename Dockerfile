# Use the official Node.js LTS image
FROM node:18

# Set the working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the code
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Set environment variables (Back4App will override these with your .env vars)
ENV PORT=3000

# Start your app
CMD ["npm", "start"]
