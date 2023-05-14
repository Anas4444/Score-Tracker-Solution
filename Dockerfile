FROM node:19-alpine3.15

# Create app directory
WORKDIR /

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./
COPY src/public/ ./dist/public/
RUN npm install --quiet
#RUN npx webpack --mode production --progress
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 8070
CMD ["npm", "run", "start"]