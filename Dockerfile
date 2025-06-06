# Base image to use
FROM node:latest

# set a working directory
WORKDIR /src

# Copy across project configuration information
# Install application dependencies
COPY package*.json /src/

# Ask npm to install the dependencies
RUN npm install -g supervisor && npm install && npm install supervisor

# Create uploads directory
RUN mkdir -p /src/public/uploads/avatars && \
    chmod -R 777 /src/public/uploads

# Copy across all our files
COPY . /src

# Expose our application port (3000)
EXPOSE 3000


