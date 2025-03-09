# Use the official nginx image as the base image
FROM nginx:alpine

# Copy the static files from your project to the nginx html directory
COPY ./static /usr/share/nginx/html

# Expose port 3000
EXPOSE 3000

# Start nginx when the container starts
CMD ["nginx", "-g", "daemon off;"]